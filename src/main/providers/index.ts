import type { AppSettings, ProviderId, ProviderStatus } from '../../shared/types'
import { AnthropicProvider } from './anthropic'
import { GeminiProvider } from './gemini'
import { OpenAIProvider } from './openai'
import type { Provider } from './types'

export function buildProviders(settings: AppSettings): Provider[] {
  return [
    new OpenAIProvider(settings.openaiApiKey, settings.openaiModel),
    new GeminiProvider(settings.geminiApiKey, settings.geminiModel),
    new AnthropicProvider(settings.anthropicApiKey, settings.anthropicModel)
  ]
}

export function configuredProviders(settings: AppSettings): Provider[] {
  return buildProviders(settings).filter((p) => p.isConfigured())
}

export function getProvider(
  settings: AppSettings,
  id: ProviderId
): Provider | undefined {
  return buildProviders(settings).find((p) => p.id === id)
}

export function providerStatuses(settings: AppSettings): ProviderStatus[] {
  return buildProviders(settings).map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model(),
    configured: p.isConfigured()
  }))
}
