import type { InfluenceEntry, ReliabilityReport, WebChannel, WebSnippet } from '../types'
import {
  assessWebReliability,
  formatCaveats,
  formatGroundedSources
} from '../reliability'
import { CHANNEL_LABELS } from './constants'
import { extractGeoAnchors } from './query-planner'
import {
  filterWeakSnippets,
  isLowConfidence,
  isSnippetOnTopic,
  scoreSnippetRelevance,
  wrongYearRejected
} from './relevance'
import {
  formatTemporalAbstention,
  isPredictionQuestion,
  resolvePrimaryYear
} from './temporal'
import { buildLogicalAnswer } from './logical-answer'
import { formatHowToAbstention, isHowToQuestion } from './question-intent'

interface WebSynthesis {
  answer: string
  influence: InfluenceEntry[]
  reliability: ReliabilityReport
}

/** myMVP brain — logic and precision from verified scout evidence only. */
export function synthesizeFromWeb(question: string, snippets: WebSnippet[]): WebSynthesis {
  if (snippets.length === 0) {
    return {
      answer:
        'No verified data for this question. Scouts returned nothing — I will not guess. Rephrase with specifics, or use the desktop app for deeper search.',
      influence: [{ source: 'mvp', label: 'myMVP (the brain)', percent: 100 }],
      reliability: assessWebReliability(question, [], [])
    }
  }

  const filtered = filterWeakSnippets(question, snippets)
  const targetYear = resolvePrimaryYear(question)
  const rejectedWrongYear = wrongYearRejected(question, snippets)

  if (filtered.length === 0) {
    const reliability = assessWebReliability(question, snippets, [])
    const answer =
      isHowToQuestion(question)
        ? formatHowToAbstention(question)
        : rejectedWrongYear !== null && targetYear !== null
          ? formatTemporalAbstention(question, targetYear, rejectedWrongYear)
          : buildHonestWeakAnswer(question, snippets, extractGeoAnchors(question), snippets.length) +
            formatCaveats(reliability.caveats)
    return {
      answer,
      influence: [{ source: 'mvp', label: 'myMVP (the brain)', percent: 100 }],
      reliability: { ...reliability, confidence: 'insufficient', score: 0 }
    }
  }

  const lowConfidence = isLowConfidence(question, filtered)
  const anchors = extractGeoAnchors(question)

  const scored = filtered
    .map((s) => ({ s, score: scoreSnippetRelevance(question, s) }))
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, 8).map((x) => x.s)
  const channels = channelWeights(top)
  const reliability = assessWebReliability(question, snippets, top)

  if (lowConfidence || reliability.confidence === 'insufficient') {
    const answer =
      isHowToQuestion(question)
        ? formatHowToAbstention(question)
        : targetYear !== null && isPredictionQuestion(question)
          ? formatTemporalAbstention(question, targetYear, rejectedWrongYear ?? undefined)
          : buildHonestWeakAnswer(question, top, anchors, snippets.length) +
            formatCaveats(reliability.caveats)
    return {
      answer,
      influence: buildInfluence(channels),
      reliability
    }
  }

  const answer =
    buildLogicalAnswer(question, top) +
    formatGroundedSources(reliability.groundedClaims) +
    formatCaveats(reliability.caveats)

  return {
    answer,
    influence: buildInfluence(channels),
    reliability
  }
}

function buildHonestWeakAnswer(
  _question: string,
  top: WebSnippet[],
  anchors: string[],
  _totalHits: number
): string {
  const relevant = top.filter((s) => isSnippetOnTopic(_question, s))

  const lines: string[] = [
    'No verified source answers this question. Showing unrelated pages would be misleading — I will not do that.'
  ]

  if (relevant.length > 0) {
    lines.push('', 'Partially related leads only:')
    for (const s of relevant.slice(0, 3)) {
      const tag = s.channelLabel ?? s.channel
      lines.push(`• [${tag}] ${s.title}: ${s.excerpt.slice(0, 140).trim()}…`)
    }
  }

  if (anchors.length > 0) {
    lines.push('', `Try adding more detail about ${anchors.join(', ')} or rephrase with specific terms.`)
  } else {
    lines.push('', 'Try rephrasing with specific terms (e.g. "potty training age" instead of a long question).')
  }

  lines.push('', 'The desktop app runs full web search scouts — better for questions like this.')

  return lines.join('\n')
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
