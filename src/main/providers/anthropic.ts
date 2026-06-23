import type { ChatMessage } from '../../shared/types'
import type { Provider } from './types'

export class AnthropicProvider implements Provider {
  id = 'anthropic' as const
  label = 'Claude scout'

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
    const systemText = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')

    const msgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: 2048,
        temperature,
        system: systemText || undefined,
        messages: msgs
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[]
    }
    return (
      data.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('') ?? ''
    )
  }
}
