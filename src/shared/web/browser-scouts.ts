import type { WebSnippet } from '../types'
import { CHANNEL_LABELS } from './constants'

/** Browser-safe scouts (CORS-friendly) — for pauloventura.org static hosting. */
export async function scoutInBrowser(question: string): Promise<WebSnippet[]> {
  const q = question.trim()
  if (!q) return []

  const [wiki, instant] = await Promise.all([scoutWikipedia(q), scoutDuckInstant(q)])
  const out = [...wiki, ...instant]

  // Extra Wikipedia pass with news-flavored query for fresher topics.
  if (out.length < 4) {
    const extra = await scoutWikipedia(`${q} 2025 2026`)
    out.push(...extra)
  }

  return dedupe(out).slice(0, 12)
}

async function scoutWikipedia(question: string): Promise<WebSnippet[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: question,
    srlimit: '3',
    format: 'json',
    origin: '*'
  })

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`)
  if (!res.ok) return []

  const data = (await res.json()) as {
    query?: { search?: { title: string; snippet: string }[] }
  }
  const hits = data.query?.search ?? []
  const out: WebSnippet[] = []

  for (const hit of hits.slice(0, 2)) {
    const summary = await fetchWikiSummary(hit.title)
    out.push({
      title: hit.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
      excerpt: summary || stripWikiHtml(hit.snippet),
      channel: 'wiki',
      channelLabel: CHANNEL_LABELS.wiki
    })
  }
  return out
}

async function fetchWikiSummary(title: string): Promise<string> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
    )
    if (!res.ok) return ''
    const data = (await res.json()) as { extract?: string }
    return (data.extract ?? '').slice(0, 600)
  } catch {
    return ''
  }
}

async function scoutDuckInstant(question: string): Promise<WebSnippet[]> {
  const params = new URLSearchParams({ q: question, format: 'json', no_redirect: '1' })
  const res = await fetch(`https://api.duckduckgo.com/?${params}`)
  if (!res.ok) return []

  const data = (await res.json()) as {
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    Answer?: string
    RelatedTopics?: { Text?: string; FirstURL?: string }[]
  }

  const out: WebSnippet[] = []
  const abstract = (data.AbstractText ?? '').trim()
  if (abstract) {
    out.push({
      title: data.Heading || 'Instant answer',
      url: data.AbstractURL || 'https://duckduckgo.com/',
      excerpt: abstract.slice(0, 500),
      channel: 'instant',
      channelLabel: CHANNEL_LABELS.instant
    })
  }
  const answer = (data.Answer ?? '').trim()
  if (answer) {
    out.push({
      title: 'Quick fact',
      url: data.AbstractURL || 'https://duckduckgo.com/',
      excerpt: answer.slice(0, 400),
      channel: 'instant',
      channelLabel: CHANNEL_LABELS.instant
    })
  }
  for (const t of data.RelatedTopics ?? []) {
    if (t.Text && t.FirstURL) {
      out.push({
        title: t.Text.slice(0, 120),
        url: t.FirstURL,
        excerpt: t.Text.slice(0, 400),
        channel: 'instant',
        channelLabel: CHANNEL_LABELS.instant
      })
    }
    if (out.length >= 4) break
  }
  return out
}

function stripWikiHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
}

function dedupe(items: WebSnippet[]): WebSnippet[] {
  const seen = new Set<string>()
  const out: WebSnippet[] = []
  for (const s of items) {
    const key = `${s.url}|${s.title.slice(0, 40)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}
