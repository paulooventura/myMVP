import type {
  AgentStep,
  AppSettings,
  ChatMessage,
  DigestResponse,
  InfluenceEntry,
  LiveUpdateEvent,
  ProviderStatus,
  StoredQuestion
} from '../../shared/types'

declare global {
  interface Window {
    mvp: {
      getSettings(): Promise<AppSettings>
      saveSettings(partial: Partial<AppSettings>): Promise<AppSettings>
      providerStatus(): Promise<ProviderStatus[]>
      pickFolder(): Promise<string | null>
      digest(history: ChatMessage[]): Promise<DigestResponse>
      runAgent(history: ChatMessage[], onStep: (step: AgentStep) => void): Promise<void>
      listHistory(): Promise<StoredQuestion[]>
      getQuestion(id: string): Promise<StoredQuestion | undefined>
      toggleMonitor(id: string, enabled: boolean): Promise<StoredQuestion | undefined>
      dismissUpdate(id: string): Promise<StoredQuestion | undefined>
      recheckQuestion(id: string): Promise<LiveUpdateEvent | null>
      onLiveUpdate(cb: (event: LiveUpdateEvent) => void): () => void
    }
  }
}

export type { InfluenceEntry, LiveUpdateEvent, StoredQuestion }

export {}
