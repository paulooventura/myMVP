import type { WebChannel, WebSnippet } from '../../shared/types'
import { searchDuckDuckGo } from './search'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const CHANNEL_LABELS: Record<WebChannel, string> = {
  search: 'Search scout',
  wiki: 'Wikipedia scout',
  instant: 'Instant answer scout',
  news: 'News scout',
  video: 'Video scout',
  discussion: 'Discussion scout'
}

/** Fan out to diverse web scouts — no API keys required. */
export async function scoutWebWide(question: string): Promise<WebSnippet[]> {
  const q = question.trim()
  if (!q) return []

  const tasks = [
    scoutChannel('search', () => searchDuckDuckGo(q, 6)),
    scoutChannel('wiki', () => scoutWikipedia(q)),
    scoutChannel('instant', () => scoutDuckInstant(q)),
    scoutChannel('news', () => searchDuckDuckGo(`${q} news latest`, 4)),
    scoutChannel('video', () => searchDuckDuckGo(`${q} youtube video`, 4)),
    scoutChannel('discussion', () => searchDuckDuckGo(`${q} reddit discussion forum`, 4))
  ]

  const batches = await Promise.all(tasks)
  return dedupeSnippets(batches.flat()).slice(0, 24)
}

async function scoutChannel(
  channel: WebChannel,
  fn: () => Promise<WebSnippet[]>
): Promise<WebSnippet[]> {
  try {
    const items = await fn()
    return items.map((s) => ({
      ...s,
      channel,
      channelLabel: CHANNEL_LABELS[channel]
    }))
  } catch {
    return []
  }
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

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(12_000)
  })
  if (!res.ok) return []

  const data = (await res.json()) as {
    query?: { search?: { title: string; snippet: string; pageid: number }[] }
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
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return ''
    const data = (await res.json()) as { extract?: string }
    return (data.extract ?? '').slice(0, 600)
  } catch {
    return ''
  }
}

async function scoutDuckInstant(question: string): Promise<WebSnippet[]> {
  const params = new URLSearchParams({
    q: question,
    format: 'json',
    no_redirect: '1',
    skip_disambig: '1'
  })

  const res = await fetch(`https://api.duckduckgo.com/?${params}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) return []

  const data = (await res.json()) as {
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    Answer?: string
    RelatedTopics?: { Text?: string; FirstURL?: string; Topics?: { Text?: string; FirstURL?: string }[] }[]
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

  for (const topic of data.RelatedTopics ?? []) {
    if (topic.Text && topic.FirstURL) {
      out.push({
        title: topic.Text.slice(0, 120),
        url: topic.FirstURL,
        excerpt: topic.Text.slice(0, 400),
        channel: 'instant',
        channelLabel: CHANNEL_LABELS.instant
      })
    }
    for (const sub of topic.Topics ?? []) {
      if (sub.Text && sub.FirstURL) {
        out.push({
          title: sub.Text.slice(0, 120),
          url: sub.FirstURL,
          excerpt: sub.Text.slice(0, 400),
          channel: 'instant',
          channelLabel: CHANNEL_LABELS.instant
        })
      }
    }
    if (out.length >= 4) break
  }

  return out.slice(0, 5)
}

function stripWikiHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()
}

function dedupeSnippets(items: WebSnippet[]): WebSnippet[] {
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

export { CHANNEL_LABELS }
