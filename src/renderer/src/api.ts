import type {
  AgentStep,
  AppSettings,
  ChatMessage,
  DigestResponse,
  LiveUpdateEvent,
  ProviderStatus,
  StoredQuestion
} from '../../shared/types'

const isElectron = (): boolean =>
  typeof window !== 'undefined' && typeof window.mvp !== 'undefined'

export async function digestChat(history: ChatMessage[]): Promise<DigestResponse> {
  if (isElectron()) return window.mvp.digest(history)

  const question =
    [...history].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''
  if (!question) throw new Error('Ask me something first.')

  const res = await fetch('/.netlify/functions/digest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    const hint =
      res.status === 404
        ? ' — for local web dev run: npm run dev:web (or restart electron-vite dev)'
        : ''
    throw new Error((err.error ?? `Request failed (${res.status})`) + hint)
  }

  return res.json() as Promise<DigestResponse>
}

export async function runAgentChat(
  history: ChatMessage[],
  onStep: (step: AgentStep) => void
): Promise<void> {
  if (isElectron()) return window.mvp.runAgent(history, onStep)
  onStep({
    kind: 'error',
    content:
      'Agent mode runs on your machine — grab the desktop app (GitHub releases) or run locally with npm run dev.'
  })
}

export async function getAppSettings(): Promise<AppSettings | null> {
  if (!isElectron()) return null
  return window.mvp.getSettings()
}

export async function saveAppSettings(partial: Partial<AppSettings>): Promise<void> {
  if (!isElectron()) return
  await window.mvp.saveSettings(partial)
}

export async function fetchProviderStatus(): Promise<ProviderStatus[]> {
  if (isElectron()) return window.mvp.providerStatus()
  return [
    { id: 'openai', label: 'GPT scout', model: 'desktop only', configured: false },
    { id: 'gemini', label: 'Gemini scout', model: 'desktop only', configured: false },
    { id: 'anthropic', label: 'Claude scout', model: 'desktop only', configured: false }
  ]
}

export async function listHistory(): Promise<StoredQuestion[]> {
  if (!isElectron()) return []
  return window.mvp.listHistory()
}

export function onLiveUpdate(cb: (event: LiveUpdateEvent) => void): (() => void) | undefined {
  if (!isElectron()) return undefined
  return window.mvp.onLiveUpdate(cb)
}

export function isWebApp(): boolean {
  return !isElectron()
}
