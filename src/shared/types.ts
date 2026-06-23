// Shared types used across main, preload, and renderer.

export type ProviderId = 'openai' | 'gemini' | 'anthropic'

export type InfluenceSource = ProviderId | 'mvp' | 'web'

export type Mode = 'digest' | 'agent'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** A single model's answer to a fanned-out prompt. */
export interface ProviderResult {
  provider: ProviderId
  label: string
  model: string
  ok: boolean
  content: string
  error?: string
  ms: number
}

/** How much a source shaped myMVP's final answer (percentages sum to 100). */
export interface InfluenceEntry {
  source: InfluenceSource
  label: string
  percent: number
}

/** The final verdict myMVP renders for "digest" mode. */
export interface DigestResponse {
  answer: string
  penEngine: ProviderId | null
  advisorsConsulted: number
  results: ProviderResult[]
  /** Who shaped the answer and by how much. Always includes myMVP's own slice. */
  influence: InfluenceEntry[]
  /** Saved question id (for history + live monitoring). */
  questionId?: string
  /** Intel gathered from web scouts (always populated in web-only mode). */
  webSnippets?: WebSnippet[]
  /** True when answer came from web scouts only (no API scouts). */
  webOnly?: boolean
}

/** Status of a configured provider (does it have a key?). */
export interface ProviderStatus {
  id: ProviderId
  label: string
  model: string
  configured: boolean
}

export interface AppSettings {
  openaiApiKey: string
  geminiApiKey: string
  anthropicApiKey: string
  openaiModel: string
  geminiModel: string
  anthropicModel: string
  workspaceDir: string
  /** Background web checks for past answers. */
  liveMonitorEnabled: boolean
  /** Minutes between live web scans per question. */
  liveMonitorIntervalMinutes: number
}

/** A question myMVP answered and keeps on record. */
export interface StoredQuestion {
  id: string
  question: string
  answer: string
  influence: InfluenceEntry[]
  results: ProviderResult[]
  penEngine: ProviderId | null
  advisorsConsulted: number
  createdAt: string
  updatedAt: string
  liveMonitor: boolean
  lastCheckedAt?: string
  /** True when new web intel would change the answer. */
  updateAvailable: boolean
  updateSummary?: string
  revisedAnswer?: string
  /** Snippets from the latest web scan (for transparency). */
  webSnippets?: WebSnippet[]
}

export type WebChannel =
  | 'search'
  | 'wiki'
  | 'instant'
  | 'news'
  | 'video'
  | 'discussion'

export interface WebSnippet {
  title: string
  url: string
  excerpt: string
  channel: WebChannel
  channelLabel: string
}

/** Pushed to the UI when live monitoring finds new relevant info. */
export interface LiveUpdateEvent {
  questionId: string
  question: string
  updateSummary: string
  revisedAnswer: string
  influence: InfluenceEntry[]
}

/** A step the agent took (tool call + result) — streamed to the UI. */
export interface AgentStep {
  kind: 'thought' | 'tool_call' | 'tool_result' | 'final' | 'error'
  tool?: string
  args?: Record<string, unknown>
  content: string
}
