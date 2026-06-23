import type { ChatMessage, ProviderId } from '../../shared/types'

export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON schema
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface CompletionRequest {
  messages: ChatMessage[]
  tools?: ToolSpec[]
  temperature?: number
}

export interface CompletionResult {
  content: string
  toolCalls: ToolCall[]
}

export interface Provider {
  id: ProviderId
  label: string
  /** Returns true if an API key is configured. */
  isConfigured(): boolean
  model(): string
  /** Basic text completion (used for fan-out + synthesis). */
  complete(messages: ChatMessage[], temperature?: number): Promise<string>
  /** Tool-capable completion (used by the agent loop). Optional per provider. */
  completeWithTools?(req: CompletionRequest): Promise<CompletionResult>
}
