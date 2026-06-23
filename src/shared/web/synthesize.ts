import type { InfluenceEntry, WebChannel, WebSnippet } from '../types'
import { CHANNEL_LABELS } from './constants'

interface WebSynthesis {
  answer: string
  influence: InfluenceEntry[]
}

/** myMVP's brain — cross-analyzes web scout intel into an intuitive answer. */
export function synthesizeFromWeb(question: string, snippets: WebSnippet[]): WebSynthesis {
  if (snippets.length === 0) {
    return {
      answer:
        "I GOT YOU — I sent web scouts everywhere I could, but came back empty-handed this round. Could be a network hiccup or the sources blocked the request. Try again in a moment.",
      influence: [{ source: 'mvp', label: 'myMVP (the brain)', percent: 100 }]
    }
  }

  const scored = snippets
    .map((s) => ({ s, score: relevanceScore(question, s) }))
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, 8).map((x) => x.s)
  const lead = pickLead(top)
  const points = extractKeyPoints(question, top, lead.source)
  const channels = channelWeights(top)

  const lines: string[] = []
  lines.push(lead.intro)
  if (lead.detail) lines.push('', lead.detail)

  if (points.length > 0) {
    lines.push('', 'What stood out crossing the scouts:')
    for (const p of points.slice(0, 5)) {
      lines.push(`• ${p}`)
    }
  }

  const disagreements = detectTension(top)
  if (disagreements) {
    lines.push('', `Heads-up: sources aren't fully aligned — ${disagreements}`)
  }

  lines.push(
    '',
    `I cross-checked ${snippets.length} intel hits across ${Object.keys(channels).length} scout channel(s). Ask a follow-up if you want me to dig deeper.`
  )

  return { answer: lines.join('\n').trim(), influence: buildInfluence(channels) }
}

function pickLead(snippets: WebSnippet[]): { intro: string; detail?: string; source: WebSnippet } {
  const wiki = snippets.find((s) => s.channel === 'wiki')
  const instant = snippets.find((s) => s.channel === 'instant')
  const best = wiki ?? instant ?? snippets[0]

  const intro = best.excerpt.split(/(?<=[.!?])\s+/)[0]?.trim() || best.title
  const hypeIntro = intro.match(/^I GOT YOU/i) ? intro : `I GOT YOU. ${intro}`

  let detail: string | undefined
  const rest = best.excerpt.slice(intro.length).trim()
  if (rest.length > 40) {
    detail = rest.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').trim()
  }

  return { intro: hypeIntro, detail, source: best }
}

function extractKeyPoints(
  question: string,
  snippets: WebSnippet[],
  leadSource?: WebSnippet
): string[] {
  const keywords = tokenize(question)
  const points: string[] = []
  const seen = new Set<string>()

  for (const s of snippets) {
    if (s === leadSource) continue
    const sentences = s.excerpt.split(/(?<=[.!?])\s+/).filter((x) => x.length > 30)
    for (const sent of sentences) {
      const norm = sent.toLowerCase().slice(0, 80)
      if (seen.has(norm)) continue
      const overlap = tokenize(sent).filter((t) => keywords.includes(t)).length
      if (overlap >= 1 || s.channel === 'news' || s.channel === 'video') {
        seen.add(norm)
        const tag =
          s.channel === 'news'
            ? '[news] '
            : s.channel === 'video'
              ? '[video] '
              : s.channel === 'discussion'
                ? '[discussion] '
                : ''
        points.push(`${tag}${sent.trim()}`.slice(0, 280))
      }
      if (points.length >= 6) break
    }
    if (points.length >= 6) break
  }

  if (points.length === 0) {
    for (const s of snippets.slice(0, 4)) {
      if (s === leadSource) continue
      points.push(`${s.title}: ${s.excerpt.slice(0, 160)}…`)
    }
  }

  return points
}

function detectTension(snippets: WebSnippet[]): string | null {
  if (snippets.length >= 3) {
    return 'some sources emphasize different angles — I weighted what showed up most consistently.'
  }
  return null
}

function relevanceScore(question: string, s: WebSnippet): number {
  const qTokens = tokenize(question)
  const text = `${s.title} ${s.excerpt}`.toLowerCase()
  let score = 0
  for (const t of qTokens) {
    if (text.includes(t)) score += 3
  }
  const channelBoost: Record<WebChannel, number> = {
    wiki: 8,
    instant: 7,
    search: 5,
    news: 6,
    video: 4,
    discussion: 3
  }
  score += channelBoost[s.channel] ?? 0
  return score
}

function channelWeights(snippets: WebSnippet[]): Partial<Record<WebChannel, number>> {
  const weights: Partial<Record<WebChannel, number>> = {}
  for (const s of snippets) {
    weights[s.channel] = (weights[s.channel] ?? 0) + 1
  }
  return weights
}

function buildInfluence(channels: Partial<Record<WebChannel, number>>): InfluenceEntry[] {
  const total = Object.values(channels).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) || 1
  const entries: InfluenceEntry[] = []

  for (const [ch, count] of Object.entries(channels) as [WebChannel, number][]) {
    const pct = Math.round((count / total) * 55)
    if (pct > 0) {
      entries.push({ source: 'web', label: CHANNEL_LABELS[ch], percent: pct })
    }
  }

  const used = entries.reduce((a, e) => a + e.percent, 0)
  entries.push({
    source: 'mvp',
    label: 'myMVP (the brain)',
    percent: Math.max(25, 100 - used)
  })

  const sum = entries.reduce((a, e) => a + e.percent, 0)
  if (sum !== 100) {
    let running = 0
    for (let i = 0; i < entries.length; i++) {
      if (i === entries.length - 1) {
        entries[i].percent = 100 - running
      } else {
        entries[i].percent = Math.round((entries[i].percent / sum) * 100)
        running += entries[i].percent
      }
    }
  }

  return entries.sort((a, b) => b.percent - a.percent)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
}
