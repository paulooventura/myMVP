import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AgentStep,
  ChatMessage,
  InfluenceEntry,
  LiveUpdateEvent,
  Mode,
  ProviderResult,
  ProviderStatus,
  StoredQuestion,
  WebSnippet
} from '../../shared/types'
import { HistorySidebar } from './components/HistorySidebar'
import { InfluenceChart } from './components/InfluenceChart'
import { Settings } from './components/Settings'
import {
  digestChat,
  fetchProviderStatus,
  isWebApp,
  onLiveUpdate,
  runAgentChat
} from './api'

const WEB_STARTERS = [
  'Who is most likely to win the FIFA World Cup this year?',
  'What is the latest news on AI assistants?',
  'Compare electric vs hybrid cars for daily commuting',
  'Explain quantum computing in plain English'
]

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  sources?: ProviderResult[]
  steps?: AgentStep[]
  influence?: InfluenceEntry[]
  questionId?: string
  updateSummary?: string
  isLiveRevision?: boolean
  webSnippets?: WebSnippet[]
  webOnly?: boolean
}

const STARTERS = [
  'Organize my Downloads folder by file type',
  'Explain what this project does and how to run it',
  'Find the 5 biggest files in my workspace',
  'Compare React vs Svelte for a side project'
]

export default function App(): JSX.Element {
  const [mode, setMode] = useState<Mode>('digest')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [activeQuestionId, setActiveQuestionId] = useState<string>()
  const [liveBanner, setLiveBanner] = useState<LiveUpdateEvent | null>(null)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const chatRef = useRef<HTMLDivElement>(null)

  const refreshProviders = (): void => {
    fetchProviderStatus().then(setProviders)
  }

  const bumpHistory = (): void => setHistoryRefresh((k) => k + 1)

  const applyLiveUpdate = useCallback((event: LiveUpdateEvent) => {
    setLiveBanner(event)
    bumpHistory()
    setMessages((msgs) => {
      const idx = msgs.findIndex((m) => m.questionId === event.questionId && m.role === 'assistant')
      if (idx === -1) return msgs
      const copy = [...msgs]
      copy[idx] = {
        ...copy[idx],
        content: event.revisedAnswer,
        influence: event.influence,
        updateSummary: event.updateSummary,
        isLiveRevision: true
      }
      return copy
    })
  }, [])

  useEffect(() => {
    refreshProviders()
    return onLiveUpdate(applyLiveUpdate)
  }, [applyLiveUpdate])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, liveBanner])

  const anyConfigured = providers.some((p) => p.configured)

  const buildHistory = (extra: UIMessage[]): ChatMessage[] =>
    [...messages, ...extra]
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }))

  const loadFromRecord = (q: StoredQuestion): void => {
    setActiveQuestionId(q.id)
    setMessages([
      { role: 'user', content: q.question },
      {
        role: 'assistant',
        content: q.answer,
        influence: q.influence,
        sources: q.results,
        questionId: q.id,
        webSnippets: q.webSnippets,
        updateSummary: q.updateAvailable ? q.updateSummary : undefined,
        isLiveRevision: q.updateAvailable
      }
    ])
    setHistoryOpen(false)
  }

  const dismissBanner = async (): Promise<void> => {
    if (liveBanner) {
      await window.mvp.dismissUpdate(liveBanner.questionId)
      bumpHistory()
    }
    setLiveBanner(null)
  }

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setActiveQuestionId(undefined)
    setLiveBanner(null)
    const userMsg: UIMessage = { role: 'user', content: trimmed }
    const history = buildHistory([userMsg])
    setMessages((m) => [...m, userMsg, { role: 'assistant', content: '', pending: true, steps: [] }])
    setInput('')
    setBusy(true)

    try {
      if (mode === 'digest') {
        const res = await digestChat(history)
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = {
            role: 'assistant',
            content: res.answer,
            sources: res.results,
            influence: res.influence,
            questionId: res.questionId,
            webSnippets: res.webSnippets,
            webOnly: res.webOnly
          }
          return copy
        })
        bumpHistory()
      } else {
        const steps: AgentStep[] = []
        await runAgentChat(history, (step) => {
          steps.push(step)
          setMessages((m) => {
            const copy = [...m]
            const final = step.kind === 'final' || step.kind === 'error'
            copy[copy.length - 1] = {
              role: 'assistant',
              content: final ? step.content : '',
              pending: !final,
              steps: [...steps]
            }
            return copy
          })
        })
        setMessages((m) => {
          const copy = [...m]
          const last = copy[copy.length - 1]
          if (last.pending) {
            copy[copy.length - 1] = { ...last, pending: false, content: last.content || 'Done.' }
          }
          return copy
        })
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = {
          role: 'assistant',
          content: `Welp, that hit a snag: ${err instanceof Error ? err.message : String(err)}`
        }
        return copy
      })
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="app-shell">
      <HistorySidebar
        open={historyOpen && !isWebApp()}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadFromRecord}
        activeId={activeQuestionId}
        refreshKey={historyRefresh}
      />

      <div className="app">
        <header className="header">
          <button
            className="icon-btn"
            title={isWebApp() ? 'History — desktop app only' : 'Question history'}
            onClick={() => !isWebApp() && setHistoryOpen((o) => !o)}
            disabled={isWebApp()}
          >
            ☰
          </button>
          <div className="logo">
            <span className="mark">M</span>
            <span>
              <span className="my">my</span>
              <span className="mvp">MVP</span>
            </span>
          </div>
          <span className="tagline">I GOT YOU.</span>
        {isWebApp() && <span className="web-app-badge">Web</span>}
          <div className="header-spacer" />
          <div className="mode-toggle">
            <button
              className={mode === 'digest' ? 'active' : ''}
              onClick={() => setMode('digest')}
              title="Scouts gather intel, myMVP thinks and answers"
            >
              Digest
            </button>
          <button
            className={mode === 'agent' ? 'active' : ''}
            onClick={() => setMode('agent')}
            title={isWebApp() ? 'Agent mode — desktop app only' : 'Let myMVP take action on your machine'}
            disabled={isWebApp()}
          >
              Agent
            </button>
          </div>
          <button className="icon-btn" title="Settings" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </header>

        {liveBanner && (
          <div className="live-banner">
            <div className="live-banner-text">
              <strong>Live update</strong> — {liveBanner.updateSummary}
            </div>
            <button
              className="mini-btn"
              onClick={() => {
                setActiveQuestionId(liveBanner.questionId)
                setLiveBanner(null)
              }}
            >
              View
            </button>
            <button className="mini-btn" onClick={dismissBanner}>
              Dismiss
            </button>
          </div>
        )}

        <div className="pills">
          <span className="pills-label">Scouts</span>
          <span className="pill on" title="Search, wiki, news, video & discussion — always on">
            <span className="dot" />
            Web scouts
          </span>
          {providers.map((p) => (
            <span key={p.id} className={`pill ${p.configured ? 'on' : ''}`} title={p.model}>
              <span className="dot" />
              {p.label}
            </span>
          ))}
          {!anyConfigured && !isWebApp() && (
            <span className="tagline">API scouts optional — web scouts are live</span>
          )}
          {isWebApp() && (
            <span className="tagline">Web scouts live · desktop app for API scouts + Agent</span>
          )}
        </div>

        <div className="chat" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="welcome">
              <h1>
                What can I knock out for you? <span className="hype">I GOT YOU.</span>
              </h1>
              <p>
                {mode === 'digest'
                  ? isWebApp()
                    ? 'Digest mode in the browser: I\'m the brain — web scouts hit search, Wikipedia, news, video & forums. No install, no API keys.'
                    : 'Digest mode: I\'m the brain. Web scouts hit search, Wikipedia, news, video & forums — no API keys needed. Add API scouts in Settings for even deeper intel.'
                  : 'Agent mode: I roll up my sleeves and get it done on your machine — run commands, wrangle files, the works.'}
              </p>
              <div className="chips">
                {(isWebApp() ? WEB_STARTERS : STARTERS).map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Message key={i} msg={m} />)
          )}
        </div>

        <div className="composer">
          <div className="row">
            <textarea
              rows={1}
              placeholder={
                mode === 'digest'
                  ? "Ask me anything — I'll send scouts and think it through…"
                  : "Tell me what to do and I'll handle it…"
              }
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="send" disabled={busy || !input.trim()} onClick={() => send(input)}>
              {busy ? '…' : "Let's go"}
            </button>
          </div>
        </div>

        {showSettings && (
          <Settings onClose={() => setShowSettings(false)} onSaved={refreshProviders} />
        )}
      </div>
    </div>
  )
}

function Message({ msg }: { msg: UIMessage }): JSX.Element {
  return (
    <div className={`msg ${msg.role}`}>
      <div className="avatar">{msg.role === 'user' ? 'You' : 'MVP'}</div>
      <div style={{ flex: 1 }}>
        {msg.isLiveRevision && msg.updateSummary && (
          <div className="live-revision">
            <span className="live-badge">Updated from web</span>
            {msg.updateSummary}
          </div>
        )}
        {msg.steps && msg.steps.length > 0 && <AgentSteps steps={msg.steps} />}
        {msg.pending && (!msg.steps || msg.steps.length === 0) ? (
          <div className="bubble thinking">
            <span className="dots">Scouting the web</span>
          </div>
        ) : msg.content ? (
          <div className="bubble">
            {msg.webOnly && <span className="web-only-badge">Web intel mode</span>}
            {msg.content}
          </div>
        ) : null}
        {msg.influence && msg.influence.length > 0 && (
          <InfluenceChart influence={msg.influence} />
        )}
        {msg.webSnippets && msg.webSnippets.length > 0 && (
          <WebIntel snippets={msg.webSnippets} />
        )}
        {msg.sources && msg.sources.length > 0 && <Sources sources={msg.sources} />}
      </div>
    </div>
  )
}

function AgentSteps({ steps }: { steps: AgentStep[] }): JSX.Element {
  return (
    <div className="steps">
      {steps
        .filter((s) => s.kind !== 'final')
        .map((s, i) => (
          <div key={i} className={`step ${s.kind}`}>
            <div className="tag">
              {s.kind === 'tool_call'
                ? `→ ${s.tool}`
                : s.kind === 'tool_result'
                  ? `✓ ${s.tool}`
                  : s.kind === 'error'
                    ? 'error'
                    : 'thinking'}
            </div>
            {s.kind === 'tool_call' && s.args ? (
              <pre>{JSON.stringify(s.args, null, 2)}</pre>
            ) : s.content ? (
              s.kind === 'tool_result' ? (
                <pre>{s.content}</pre>
              ) : (
                <div>{s.content}</div>
              )
            ) : null}
          </div>
        ))}
    </div>
  )
}

function WebIntel({ snippets }: { snippets: WebSnippet[] }): JSX.Element {
  const byChannel = snippets.reduce<Record<string, WebSnippet[]>>((acc, s) => {
    const k = s.channelLabel
    acc[k] = acc[k] ?? []
    acc[k].push(s)
    return acc
  }, {})

  return (
    <details className="sources web-intel">
      <summary>
        {snippets.length} web intel hit(s) across {Object.keys(byChannel).length} scout
        channel(s) — see field reports
      </summary>
      {Object.entries(byChannel).map(([channel, items]) => (
        <div key={channel} className="web-channel">
          <div className="meta">{channel}</div>
          {items.map((s, i) => (
            <div key={i} className="source">
              <div className="meta">
                <a href={s.url} onClick={(e) => e.preventDefault()} title={s.url}>
                  {s.title}
                </a>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{s.excerpt}</div>
            </div>
          ))}
        </div>
      ))}
    </details>
  )
}

function Sources({ sources }: { sources: ProviderResult[] }): JSX.Element {
  return (
    <details className="sources">
      <summary>
        myMVP's answer — {sources.filter((s) => s.ok).length} scout report(s).
        See their field intel
      </summary>
      {sources.map((s, i) => (
        <div key={i} className={`source ${s.ok ? '' : 'fail'}`}>
          <div className="meta">
            {s.label} · {s.model} · {s.ms}ms {s.ok ? '' : '· failed'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{s.ok ? s.content : s.error}</div>
        </div>
      ))}
    </details>
  )
}
