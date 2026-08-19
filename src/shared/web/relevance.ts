import type { WebSnippet } from '../types'
import { extractGeoAnchors, extractSearchKeywords } from './query-planner'
import {
  isEncyclopedicOverview,
  isHowToQuestion,
  snippetAnswersHowTo
} from './question-intent'
import {
  isHardYearMismatch,
  isPredictionQuestion,
  resolvePrimaryYear,
  yearMismatch,
  yearsInSnippet
} from './temporal'

const CONFLICTING_PLACES: Record<string, string[]> = {
  nashville: ['los angeles', 'la-based', 'palo alto', 'california-based', 'brooklyn'],
  memphis: ['los angeles', 'new york city'],
  austin: ['los angeles', 'nashville'],
  'new york': ['los angeles', 'nashville', 'chicago'],
  chicago: ['los angeles', 'nashville']
}

const MIN_KEYWORD_HITS = 2

export function scoreSnippetRelevance(question: string, s: WebSnippet): number {
  const overlap = keywordOverlapCount(question, s)
  const text = `${s.title} ${s.excerpt}`.toLowerCase()
  let score = overlap * 8

  const channelBoost: Record<string, number> = {
    search: 6,
    news: 5,
    discussion: 4,
    instant: 4,
    video: 3,
    wiki: 2
  }
  score += channelBoost[s.channel] ?? 0
  score += geoFitScore(question, s)
  score += temporalFitScore(question, s)

  if (s.channel === 'wiki' && /\(disambiguation\)|honorific nicknames|list of .* episodes/i.test(s.title)) {
    score -= 30
  }

  if (/\b(episode|season \d|novel|film|tv series|sitcom)\b/i.test(text) && overlap < 2) {
    score -= 25
  }

  if (isHowToQuestion(question)) {
    if (!snippetAnswersHowTo(question, s)) score -= 60
    else if (isEncyclopedicOverview(s)) score -= 40
  }

  return score
}

function temporalFitScore(question: string, s: WebSnippet): number {
  const target = resolvePrimaryYear(question)
  if (target === null) return 0

  const mismatch = yearMismatch(target, s)
  if (mismatch === 'hard') return -80
  if (mismatch === 'ok') return 20
  return -15
}

export function keywordOverlapCount(question: string, s: WebSnippet): number {
  const keywords = extractSearchKeywords(question)
  const text = `${s.title} ${s.excerpt}`.toLowerCase()
  let hits = 0
  for (const k of keywords) {
    if (text.includes(k)) hits++
  }
  return hits
}

export function isSnippetOnTopic(question: string, s: WebSnippet): boolean {
  const target = resolvePrimaryYear(question)
  if (target !== null && isHardYearMismatch(target, s)) return false

  if (isPredictionQuestion(question) && target !== null) {
    const years = yearsInSnippet(s)
    if (years.length > 0 && !years.includes(target)) return false
  }

  if (isHowToQuestion(question) && !snippetAnswersHowTo(question, s)) return false

  return keywordOverlapCount(question, s) >= MIN_KEYWORD_HITS || scoreSnippetRelevance(question, s) >= 18
}

export function geoFitScore(question: string, s: WebSnippet): number {
  const anchors = extractGeoAnchors(question).map((a) => a.toLowerCase())
  if (anchors.length === 0) return 0

  const text = `${s.title} ${s.excerpt}`.toLowerCase()
  let score = 0

  for (const anchor of anchors) {
    if (text.includes(anchor)) score += 12
    const conflicts = CONFLICTING_PLACES[anchor] ?? []
    for (const bad of conflicts) {
      if (text.includes(bad)) score -= 18
    }
  }

  return score
}

export function filterWeakSnippets(question: string, snippets: WebSnippet[]): WebSnippet[] {
  const target = resolvePrimaryYear(question)
  let pool = snippets

  if (target !== null) {
    pool = snippets.filter((s) => !isHardYearMismatch(target, s))
  }

  const onTopic = pool.filter((s) => isSnippetOnTopic(question, s))

  if (onTopic.length > 0) {
    return onTopic.sort(
      (a, b) => scoreSnippetRelevance(question, b) - scoreSnippetRelevance(question, a)
    )
  }

  return []
}

export function isLowConfidence(question: string, snippets: WebSnippet[]): boolean {
  if (snippets.length === 0) return true

  const target = resolvePrimaryYear(question)
  if (target !== null && isPredictionQuestion(question)) return true
  if (isHowToQuestion(question)) return true

  const top = scoreSnippetRelevance(question, snippets[0])
  if (top < 14) return true
  if (keywordOverlapCount(question, snippets[0]) < MIN_KEYWORD_HITS) return true

  const anchors = extractGeoAnchors(question)
  if (anchors.length > 0 && !snippets.some((s) => geoFitScore(question, s) >= 8)) return true

  return false
}

/** If scouts returned wrong-year pages after user said "this year". */
export function wrongYearRejected(question: string, raw: WebSnippet[]): number | null {
  const target = resolvePrimaryYear(question)
  if (target === null || raw.length === 0) return null
  const bad = raw.find((s) => isHardYearMismatch(target, s))
  if (!bad) return null
  const years = yearsInSnippet(bad)
  return years.find((y) => y !== target) ?? null
}
