import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { getAppSettings, isWebApp, saveAppSettings } from '../api'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function Settings({ onClose, onSaved }: Props): JSX.Element {
  const [s, setS] = useState<AppSettings | null>(null)

  useEffect(() => {
    if (isWebApp()) return
    getAppSettings().then((s) => s && setS(s))
  }, [])

  if (isWebApp()) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Web app</h2>
          <p className="sub">
            This browser build uses <strong>web scouts only</strong> (search, Wikipedia, news,
            video, forums). API scouts and Agent mode need the desktop app — clone from GitHub and
            run <code>npm run dev</code>.
          </p>
          <p className="sub">
            <a href="https://github.com/paulooventura/myMVP" target="_blank" rel="noreferrer">
              github.com/paulooventura/myMVP
            </a>
          </p>
          <div className="modal-actions">
            <button className="btn primary" onClick={onClose}>
              Got it
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!s) return <div className="overlay" />

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]): void =>
    setS({ ...s, [k]: v })

  const save = async (): Promise<void> => {
    await saveAppSettings(s)
    onSaved()
    onClose()
  }

  const pickFolder = async (): Promise<void> => {
    if (!window.mvp) return
    const dir = await window.mvp.pickFolder()
    if (dir) set('workspaceDir', dir)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <p className="sub">
          myMVP is the brain. GPT, Gemini, and Claude are data scouts — they gather intel;
          myMVP thinks and answers. Drop in scout keys so I can send them out. Keys never
          leave your machine.
        </p>

        <div className="section-title">Data scouts</div>

        <div className="field">
          <label>
            OpenAI API Key <span className="hint">— GPT scout</span>
          </label>
          <input
            type="password"
            placeholder="sk-..."
            value={s.openaiApiKey}
            onChange={(e) => set('openaiApiKey', e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Google Gemini API Key <span className="hint">— Gemini scout</span>
          </label>
          <input
            type="password"
            placeholder="AIza..."
            value={s.geminiApiKey}
            onChange={(e) => set('geminiApiKey', e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Anthropic API Key <span className="hint">— Claude scout</span>
          </label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={s.anthropicApiKey}
            onChange={(e) => set('anthropicApiKey', e.target.value)}
          />
        </div>

        <div className="section-title">Live updates</div>

        <div className="field checkbox-field">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={s.liveMonitorEnabled}
              onChange={(e) => set('liveMonitorEnabled', e.target.checked)}
            />
            Watch the web for new info on past answers
          </label>
          <span className="hint">
            myMVP cross-analyzes web results, filters noise, and notifies you when something
            would change an answer.
          </span>
        </div>

        {s.liveMonitorEnabled && (
          <div className="field">
            <label>
              Check interval <span className="hint">— minutes between web scans</span>
            </label>
            <input
              type="number"
              min={5}
              max={1440}
              value={s.liveMonitorIntervalMinutes}
              onChange={(e) =>
                set('liveMonitorIntervalMinutes', Math.max(5, Number(e.target.value) || 30))
              }
            />
          </div>
        )}

        <div className="section-title">Tuning</div>

        <div className="field">
          <label>
            Workspace folder <span className="hint">— where Agent mode operates</span>
          </label>
          <div className="folder-row">
            <input
              value={s.workspaceDir}
              onChange={(e) => set('workspaceDir', e.target.value)}
            />
            <button onClick={pickFolder}>Browse…</button>
          </div>
        </div>

        <details>
          <summary className="hint" style={{ cursor: 'pointer' }}>
            Advanced: model names
          </summary>
          <div style={{ marginTop: 12 }}>
            <div className="field">
              <label>OpenAI model</label>
              <input value={s.openaiModel} onChange={(e) => set('openaiModel', e.target.value)} />
            </div>
            <div className="field">
              <label>Gemini model</label>
              <input value={s.geminiModel} onChange={(e) => set('geminiModel', e.target.value)} />
            </div>
            <div className="field">
              <label>Anthropic model</label>
              <input
                value={s.anthropicModel}
                onChange={(e) => set('anthropicModel', e.target.value)}
              />
            </div>
          </div>
        </details>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
