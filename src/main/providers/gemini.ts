import type { ChatMessage } from '../../shared/types'
import type { Provider } from './types'

export class GeminiProvider implements Provider {
  id = 'gemini' as const
  label = 'Gemini scout'

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

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
        generationConfig: { temperature }
      })
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    return (
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    )
  }
}
