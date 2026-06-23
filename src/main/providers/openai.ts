import type { ChatMessage } from '../../shared/types'
import type { CompletionRequest, CompletionResult, Provider, ToolCall } from './types'

export class OpenAIProvider implements Provider {
  id = 'openai' as const
  label = 'GPT scout'

  constructor(
    private apiKey: string,
    private modelName: string
  ) {}

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0
  }

  model(): string {
    return this.modelName
  }

  async complete(messages: ChatMessage[], temperature = 0.7): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature,
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = (await res.json()) as {
      choices: { message: { content: string | null } }[]
    }
    return data.choices?.[0]?.message?.content ?? ''
  }

  async completeWithTools(req: CompletionRequest): Promise<CompletionResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: req.temperature ?? 0.3,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: req.tools?.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        })),
        tool_choice: req.tools && req.tools.length > 0 ? 'auto' : undefined
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = (await res.json()) as {
      choices: {
        message: {
          content: string | null
          tool_calls?: {
            id: string
            function: { name: string; arguments: string }
          }[]
        }
      }[]
    }

    const msg = data.choices?.[0]?.message
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      args: safeParse(tc.function.arguments)
    }))

    return { content: msg?.content ?? '', toolCalls }
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
