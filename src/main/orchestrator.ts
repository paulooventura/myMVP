import type {
  AppSettings,
  ChatMessage,
  DigestResponse,
  InfluenceEntry,
  InfluenceSource,
  ProviderId,
  ProviderResult
} from '../shared/types'
import { configuredProviders, getProvider } from './providers'
import { digestFromWeb } from './web-digest'

const SCOUT_PERSONA = `You are a data scout for myMVP. Gather and report the best answer you can to the user's question — clear, correct, concise. Your output is raw intel for myMVP's brain, not the final word.`

const MVP_PERSONA = `You are myMVP — THE brain. The user's enthusiastic, ultra-capable assistant with "I GOT YOU" energy: confident, warm, and decisive.

You are not a router and you are not one of the scouts. YOU think. GPT, Gemini, and Claude are data scouts — they fed you intel. Their reports are inputs, not authority. You are free to agree with all of them, some of them, or none of them. Trust your own judgment above any scout.

Deliver YOUR answer in YOUR voice. Lead with the answer, then the why. Be concise, never waffle. Never mention scouts, advisors, synthesis, or other models — the user is talking to myMVP, and this is simply your answer.`

const SOURCE_LABELS: Record<InfluenceSource, string> = {
  openai: 'GPT scout',
  gemini: 'Gemini scout',
  anthropic: 'Claude scout',
  mvp: 'myMVP (the brain)',
  web: 'Web scout'
}

let penCursor = 0

interface VerdictJson {
  answer: string
  influence: { provider: string; percent: number }[]
}

export async function digest(
  settings: AppSettings,
  history: ChatMessage[]
): Promise<DigestResponse> {
  const lastUser =
    [...history].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''

  if (!lastUser) {
    return emptyResponse('Ask me something — I GOT YOU.')
  }

  const providers = configuredProviders(settings)

  // No API scouts? myMVP still answers — web scouts only.
  if (providers.length === 0) {
    return digestFromWeb(lastUser)
  }

  const scoutMessages = [
    { role: 'system', content: SCOUT_PERSONA } as ChatMessage,
    ...history
  ]

  const results: ProviderResult[] = await Promise.all(
    providers.map(async (p) => {
      const start = Date.now()
      try {
        const content = await p.complete(scoutMessages, 0.7)
        return {
          provider: p.id,
          label: p.label,
          model: p.model(),
          ok: true,
          content,
          ms: Date.now() - start
        }
      } catch (err) {
        return {
          provider: p.id,
          label: p.label,
          model: p.model(),
          ok: false,
          content: '',
          error: err instanceof Error ? err.message : String(err),
          ms: Date.now() - start
        }
      }
    })
  )

  const good = results.filter((r) => r.ok && r.content.trim().length > 0)

  if (good.length === 0) {
    // API scouts failed — fall back to web scouts so the user still gets an answer.
    const web = await digestFromWeb(lastUser)
    return { ...web, results }
  }

  const penResult = good[penCursor % good.length]
  penCursor++
  const pen =
    getProvider(settings, penResult.provider) ?? getProvider(settings, good[0].provider)

  if (!pen) {
    const fastest = [...good].sort((a, b) => a.ms - b.ms)[0]
    return {
      answer: fastest.content,
      penEngine: fastest.provider,
      advisorsConsulted: good.length,
      results,
      influence: fallbackInfluence(good, true)
    }
  }

  const panel = good
    .map((r, i) => `Scout ${i + 1} (${r.label}, id=${r.provider}):\n${r.content.trim()}`)
    .join('\n\n')

  const scoutIds = good.map((r) => r.provider).join(', ')

  const verdictPrompt: ChatMessage[] = [
    { role: 'system', content: MVP_PERSONA },
    {
      role: 'user',
      content: `The user asked you:
"""${lastUser}"""

Your scouts returned intel. Here are their field reports:

${panel}

Now give the user YOUR answer as myMVP — the brain. Weigh the scout intel, keep what's right, toss what's wrong or redundant, and add anything they all missed. Own it.

Respond with ONLY valid JSON (no markdown fences, no commentary):
{
  "answer": "your final answer in myMVP voice",
  "influence": [
    {"provider": "openai", "percent": 25},
    {"provider": "gemini", "percent": 20},
    {"provider": "anthropic", "percent": 15},
    {"provider": "mvp", "percent": 40}
  ]
}

Rules for influence:
- Include ONLY scouts that actually contributed (${scoutIds}) plus "mvp" for myMVP's own reasoning as the brain.
- Percentages MUST sum to exactly 100.
- "mvp" is how much came from YOUR brain beyond any scout — never 0 if you disagreed or added insight.
- Be honest: if one scout nailed it, say so with high percent for that scout.`
    }
  ]

  try {
    const raw = await pen.complete(verdictPrompt, 0.4)
    const parsed = parseVerdictJson(raw)
    if (parsed) {
      return {
        answer: parsed.answer,
        penEngine: pen.id as ProviderId,
        advisorsConsulted: good.length,
        results,
        influence: normalizeInfluence(parsed.influence, good)
      }
    }
    // JSON parse failed — use raw text as answer.
    return {
      answer: stripJsonAttempt(raw),
      penEngine: pen.id as ProviderId,
      advisorsConsulted: good.length,
      results,
      influence: fallbackInfluence(good, false)
    }
  } catch {
    const fastest = [...good].sort((a, b) => a.ms - b.ms)[0]
    return {
      answer: fastest.content,
      penEngine: fastest.provider,
      advisorsConsulted: good.length,
      results,
      influence: fallbackInfluence(good, true)
    }
  }
}

function emptyResponse(answer: string, results: ProviderResult[] = []): DigestResponse {
  return {
    answer,
    penEngine: null,
    advisorsConsulted: 0,
    results,
    influence: []
  }
}

function parseVerdictJson(raw: string): VerdictJson | null {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as VerdictJson
  } catch {
    /* fall through */
  }
  const match = trimmed.match(/\{[\s\S]*"answer"[\s\S]*"influence"[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as VerdictJson
  } catch {
    return null
  }
}

function stripJsonAttempt(raw: string): string {
  const parsed = parseVerdictJson(raw)
  if (parsed?.answer) return parsed.answer
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function normalizeInfluence(
  entries: { provider: string; percent: number }[],
  good: ProviderResult[]
): InfluenceEntry[] {
  const validSources = new Set<InfluenceSource>([
    ...good.map((r) => r.provider),
    'mvp',
    'web'
  ])

  const mapped: InfluenceEntry[] = []
  for (const e of entries) {
    const src = e.provider as InfluenceSource
    if (!validSources.has(src)) continue
    mapped.push({
      source: src,
      label: labelFor(src, good),
      percent: Math.max(0, Math.round(e.percent))
    })
  }

  if (mapped.length === 0) return fallbackInfluence(good, false)

  const sum = mapped.reduce((a, e) => a + e.percent, 0)
  if (sum === 0) return fallbackInfluence(good, false)

  // Normalize to 100.
  if (sum !== 100) {
    const factor = 100 / sum
    let running = 0
    for (let i = 0; i < mapped.length; i++) {
      if (i === mapped.length - 1) {
        mapped[i].percent = 100 - running
      } else {
        mapped[i].percent = Math.round(mapped[i].percent * factor)
        running += mapped[i].percent
      }
    }
  }

  return mapped.sort((a, b) => b.percent - a.percent)
}

function fallbackInfluence(good: ProviderResult[], adoptFastest: boolean): InfluenceEntry[] {
  if (good.length === 0) {
    return [{ source: 'mvp', label: SOURCE_LABELS.mvp, percent: 100 }]
  }
  if (good.length === 1) {
    const only = good[0]
    return adoptFastest
      ? [
          { source: only.provider, label: only.label, percent: 70 },
          { source: 'mvp', label: SOURCE_LABELS.mvp, percent: 30 }
        ]
      : [
          { source: only.provider, label: only.label, percent: 55 },
          { source: 'mvp', label: SOURCE_LABELS.mvp, percent: 45 }
        ]
  }

  const share = Math.floor(70 / good.length)
  const entries: InfluenceEntry[] = good.map((r) => ({
    source: r.provider,
    label: r.label,
    percent: share
  }))
  const used = share * good.length
  entries.push({ source: 'mvp', label: SOURCE_LABELS.mvp, percent: 100 - used })
  return entries.sort((a, b) => b.percent - a.percent)
}

function labelFor(src: InfluenceSource, good: ProviderResult[]): string {
  if (src === 'mvp' || src === 'web') return SOURCE_LABELS[src]
  return good.find((r) => r.provider === src)?.label ?? SOURCE_LABELS[src]
}

/** Exported for live monitor re-assessment passes. */
export function labelForSource(src: InfluenceSource, good?: ProviderResult[]): string {
  if (src === 'mvp' || src === 'web') return SOURCE_LABELS[src]
  return good?.find((r) => r.provider === src)?.label ?? SOURCE_LABELS[src as ProviderId]
}

export { normalizeInfluence, SOURCE_LABELS, parseVerdictJson }
