import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentStep,
  AppSettings,
  ChatMessage,
  DigestResponse,
  LiveUpdateEvent,
  ProviderStatus,
  StoredQuestion
} from '../shared/types'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),

  saveSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', partial),

  providerStatus: (): Promise<ProviderStatus[]> =>
    ipcRenderer.invoke('providers:status'),

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),

  digest: (history: ChatMessage[]): Promise<DigestResponse> =>
    ipcRenderer.invoke('chat:digest', history),

  runAgent: (
    history: ChatMessage[],
    onStep: (step: AgentStep) => void
  ): Promise<void> => {
    const runId = Math.random().toString(36).slice(2)
    const stepChannel = `agent:step:${runId}`
    const doneChannel = `agent:done:${runId}`

    return new Promise((resolve) => {
      const stepHandler = (_e: unknown, step: AgentStep): void => onStep(step)
      const doneHandler = (): void => {
        ipcRenderer.removeListener(stepChannel, stepHandler)
        ipcRenderer.removeListener(doneChannel, doneHandler)
        resolve()
      }
      ipcRenderer.on(stepChannel, stepHandler)
      ipcRenderer.once(doneChannel, doneHandler)
      ipcRenderer.invoke('agent:run', runId, history)
    })
  },

  listHistory: (): Promise<StoredQuestion[]> => ipcRenderer.invoke('history:list'),

  getQuestion: (id: string): Promise<StoredQuestion | undefined> =>
    ipcRenderer.invoke('history:get', id),

  toggleMonitor: (id: string, enabled: boolean): Promise<StoredQuestion | undefined> =>
    ipcRenderer.invoke('history:toggleMonitor', id, enabled),

  dismissUpdate: (id: string): Promise<StoredQuestion | undefined> =>
    ipcRenderer.invoke('history:dismissUpdate', id),

  recheckQuestion: (id: string): Promise<LiveUpdateEvent | null> =>
    ipcRenderer.invoke('history:recheck', id),

  onLiveUpdate: (cb: (event: LiveUpdateEvent) => void): (() => void) => {
    const handler = (_e: unknown, event: LiveUpdateEvent): void => cb(event)
    ipcRenderer.on('live:update', handler)
    return () => ipcRenderer.removeListener('live:update', handler)
  }
}

contextBridge.exposeInMainWorld('mvp', api)

export type MvpApi = typeof api
