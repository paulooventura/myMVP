import { parseQuestionFocus } from '../principles'
import type { WebSnippet } from '../types'
import { scoreSnippetRelevance } from './relevance'
import { resolvePrimaryYear } from './temporal'

/** Build a precise, logical answer from on-topic scout evidence. */
export function buildLogicalAnswer(question: string, snippets: WebSnippet[]): string {
  const year = resolvePrimaryYear(question)
  const focus = parseQuestionFocus(question, year)
  const ranked = [...snippets].sort(
    (a, b) => scoreSnippetRelevance(question, b) - scoreSnippetRelevance(question, a)
  )
  const best = ranked[0]
  if (!best) {
    return `I could not find evidence that answers: ${focus}.`
  }

  const lines: string[] = []
  lines.push(`**Question:** ${focus}`)
  lines.push('')

  const direct = extractDirectStatement(best)
  lines.push(`**Answer:** ${direct}`)

  const supporting = extractSupportingPoints(ranked.slice(1), best)
  if (supporting.length > 0) {
    lines.push('', '**Reasoning:**')
    for (const p of supporting) {
      lines.push(`• ${p}`)
    }
  }

  const extra = best.excerpt
    .split(/(?<=[.!?])\s+/)
    .slice(1, 3)
    .join(' ')
    .trim()
  if (extra.length > 40 && supporting.length === 0) {
    lines.push('', extra)
  }

  return lines.join('\n').trim()
}

function extractDirectStatement(s: WebSnippet): string {
  const first =
    s.excerpt.split(/(?<=[.!?])\s+/)[0]?.trim() ||
    s.title.replace(/^List of /i, '')
  return first.endsWith('.') || first.endsWith('!') || first.endsWith('?') ? first : `${first}.`
}

function extractSupportingPoints(rest: WebSnippet[], skip: WebSnippet): string[] {
  const points: string[] = []
  const seen = new Set<string>()

  for (const s of rest) {
    if (s === skip) continue
    const sent = s.excerpt.split(/(?<=[.!?])\s+/)[0]?.trim()
    if (!sent || sent.length < 30) continue
    const key = sent.slice(0, 60).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    points.push(`${sent} (${s.channelLabel})`)
    if (points.length >= 3) break
  }

  return points
}
