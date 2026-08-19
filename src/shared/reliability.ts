import type { ConfidenceLevel, GroundedClaim, ReliabilityReport, WebSnippet } from './types'
import { extractGeoAnchors } from './web/query-planner'
import { isLowConfidence, scoreSnippetRelevance } from './web/relevance'

export function assessWebReliability(
  question: string,
  snippets: WebSnippet[],
  usedSnippets: WebSnippet[]
): ReliabilityReport {
  const caveats: string[] = []
  const channels = new Set(usedSnippets.map((s) => s.channel))

  if (snippets.length === 0) {
    return {
      confidence: 'insufficient',
      score: 0,
      caveats: ['No scout intel returned — cannot verify anything.'],
      corroboratingChannels: 0,
      groundedClaims: []
    }
  }

  if (isLowConfidence(question, usedSnippets)) {
    const anchors = extractGeoAnchors(question)
    if (anchors.length > 0) {
      caveats.push(
        `Scouts did not find strong evidence specific to ${anchors.join(', ')} — answer may be generic or off-target.`
      )
    } else {
      caveats.push('Scout intel was thin or loosely related to your question.')
    }
  }

  if (channels.size < 2) {
    caveats.push(
      `Only ${channels.size} scout channel(s) contributed — cross-check before trusting this.`
    )
  }

  const wikiOnly =
    channels.size === 1 && channels.has('wiki')
  if (wikiOnly) {
    caveats.push(
      'Wikipedia-only intel — weak for local, current, or opinion questions. Prefer desktop + search scouts.'
    )
  }

  const hasSearch = channels.has('search') || channels.has('news') || channels.has('discussion')
  if (!hasSearch && /\b(popular|best|current|latest|who|today|202[4-9])\b/i.test(question)) {
    caveats.push('No live web-search hits — this question usually needs fresher sources.')
  }

  const groundedClaims = buildGroundedClaims(question, usedSnippets)
  const score = computeScore(question, usedSnippets, channels.size, groundedClaims.length, caveats)
  const confidence = scoreToLevel(score, caveats.length)

  return {
    confidence,
    score,
    caveats: dedupeCaveats(caveats),
    corroboratingChannels: channels.size,
    groundedClaims
  }
}

/** Cap API-scout verdict confidence when scouts disagree or one failed. */
export function assessScoutReliability(
  okResults: { provider: string; content: string }[],
  parsedConfidence?: string,
  parsedCaveats?: string[]
): ReliabilityReport {
  const caveats = [...(parsedCaveats ?? [])]

  if (okResults.length === 0) {
    return {
      confidence: 'insufficient',
      score: 0,
      caveats: ['All API scouts failed.'],
      corroboratingChannels: 0,
      groundedClaims: []
    }
  }

  if (okResults.length === 1) {
    caveats.push('Only one API scout responded — no cross-check from other models.')
  }

  const disagreement = detectScoutDisagreement(okResults.map((r) => r.content))
  if (disagreement) {
    caveats.push(`Scouts disagreed: ${disagreement}`)
  }

  let score = 55 + okResults.length * 12
  if (disagreement) score -= 25
  if (okResults.length >= 3 && !disagreement) score += 15

  const fromModel = parseConfidenceLevel(parsedConfidence)
  if (fromModel) {
    score = Math.min(score, levelToMaxScore(fromModel))
  }

  score = Math.max(0, Math.min(100, score))

  return {
    confidence: scoreToLevel(score, caveats.length),
    score,
    caveats: dedupeCaveats(caveats),
    corroboratingChannels: okResults.length,
    groundedClaims: []
  }
}

export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence — multiple scouts align'
    case 'medium':
      return 'Medium confidence — verify key facts'
    case 'low':
      return 'Low confidence — treat as leads, not gospel'
    case 'insufficient':
      return 'Insufficient evidence — do not rely on this alone'
  }
}

function buildGroundedClaims(question: string, snippets: WebSnippet[]): GroundedClaim[] {
  const claims: GroundedClaim[] = []
  const seen = new Set<string>()

  for (const s of snippets.slice(0, 6)) {
    const sentences = s.excerpt.split(/(?<=[.!?])\s+/).filter((x) => x.length > 35)
    for (const sent of sentences.slice(0, 2)) {
      const key = sent.toLowerCase().slice(0, 60)
      if (seen.has(key)) continue
      seen.add(key)
      claims.push({
        text: sent.trim().slice(0, 220),
        sourceUrls: [s.url],
        sourceLabels: [s.channelLabel || s.channel]
      })
      if (claims.length >= 5) return claims
    }
  }

  return claims
}

function computeScore(
  question: string,
  snippets: WebSnippet[],
  channelCount: number,
  claimCount: number,
  caveats: string[]
): number {
  if (snippets.length === 0) return 0
  if (isLowConfidence(question, snippets)) return 22

  let score = 30
  score += Math.min(channelCount * 15, 45)
  score += Math.min(claimCount * 5, 20)

  const top = scoreSnippetRelevance(question, snippets[0])
  score += Math.min(top, 15)

  score -= caveats.length * 8
  return Math.max(0, Math.min(100, score))
}

function scoreToLevel(score: number, caveatCount: number): ConfidenceLevel {
  if (score < 20 || caveatCount >= 4) return 'insufficient'
  if (score < 45) return 'low'
  if (score < 72) return 'medium'
  return 'high'
}

function levelToMaxScore(level: ConfidenceLevel): number {
  switch (level) {
    case 'high':
      return 100
    case 'medium':
      return 71
    case 'low':
      return 44
    case 'insufficient':
      return 19
  }
}

function parseConfidenceLevel(raw?: string): ConfidenceLevel | null {
  if (!raw) return null
  const n = raw.toLowerCase().trim()
  if (n === 'high' || n === 'medium' || n === 'low' || n === 'insufficient') return n
  return null
}

function detectScoutDisagreement(contents: string[]): string | null {
  if (contents.length < 2) return null
  const a = contents[0].toLowerCase()
  const b = contents[1].toLowerCase()
  const neg = /\b(not|no|never|false|incorrect|wrong|myth)\b/
  if (neg.test(a) !== neg.test(b) && tokenOverlap(a, b) > 0.3) {
    return 'early scouts gave conflicting takes on the same topic'
  }
  return null
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\W+/).filter((w) => w.length > 4))
  const tb = new Set(b.split(/\W+/).filter((w) => w.length > 4))
  let hit = 0
  for (const t of ta) if (tb.has(t)) hit++
  return hit / Math.max(ta.size, 1)
}

function dedupeCaveats(caveats: string[]): string[] {
  return [...new Set(caveats.filter(Boolean))]
}

/** Append sources block — every claim traceable. */
export function formatGroundedSources(claims: GroundedClaim[]): string {
  if (claims.length === 0) return ''
  const lines = ['', '**Grounded in scout intel:**']
  for (const c of claims.slice(0, 5)) {
    const label = c.sourceLabels[0] ?? 'source'
    lines.push(`• ${c.text} — _${label}_`)
  }
  return lines.join('\n')
}

export function formatCaveats(caveats: string[]): string {
  if (caveats.length === 0) return ''
  return ['', '**Heads-up (reliability):**', ...caveats.map((c) => `• ${c}`)].join('\n')
}
