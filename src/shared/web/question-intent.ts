import { parseQuestionFocus } from '../principles'
import type { WebSnippet } from '../types'
import { extractSearchKeywords } from './query-planner'

export type QuestionIntent = 'how-to' | 'what-is' | 'prediction' | 'general'

/** What kind of question the user is asking — drives relevance checks. */
export function detectQuestionIntent(question: string): QuestionIntent {
  const q = question.toLowerCase()
  if (/\b(most likely|who will win|odds|predict)\b/.test(q)) return 'prediction'
  if (/\b(how do i|how can i|how to|how should i|what'?s the best way to|tips for|improve my|enhance my|get better at|learn to)\b/.test(q)) {
    return 'how-to'
  }
  if (/\b(what is|what are|who is|who was|define|explain what)\b/.test(q)) return 'what-is'
  return 'general'
}

export function isHowToQuestion(question: string): boolean {
  return detectQuestionIntent(question) === 'how-to'
}

/** Verbs/goals the user wants steps for (aim, build, configure…). */
export function extractHowToActionKeywords(question: string): string[] {
  const q = question.toLowerCase()
  const found = new Set<string>()

  const patterns = [
    /\b(aim|aiming)\b/,
    /\b(improve|enhance|boost|increase|better|master|learn|practice)\b/,
    /\b(fix|solve|troubleshoot|repair|configure|setup|set up|install)\b/,
    /\b(optimize|tune|adjust|calibrate)\b/,
    /\b(win|beat|rank up|climb)\b/
  ]
  for (const p of patterns) {
    const m = q.match(p)
    if (m) found.add(m[1])
  }

  // Also keep meaningful non-stopword tokens from "how do I X on Y"
  for (const w of extractSearchKeywords(question)) {
    if (['apex', 'legends', 'game', 'games'].includes(w)) continue
    if (w.length >= 4) found.add(w)
  }

  return [...found]
}

/** Game/product/context from a how-to question. */
export function extractHowToContext(question: string): string | null {
  const q = question.toLowerCase()
  const onMatch = q.match(/\bon\s+([a-z0-9][a-z0-9\s'-]{2,40}?)(?:\?|$)/i)
  if (onMatch) return onMatch[1].trim()

  const inMatch = q.match(/\bin\s+([a-z0-9][a-z0-9\s'-]{2,40}?)(?:\?|$)/i)
  if (inMatch) return inMatch[1].trim()

  return null
}

/** Wikipedia game/product stub — not a how-to guide. */
export function isEncyclopedicOverview(s: WebSnippet): boolean {
  const text = `${s.title} ${s.excerpt}`.toLowerCase()
  const title = s.title.toLowerCase()

  if (/\b(guide|how to|tips|tutorial|walkthrough|settings|improve)\b/i.test(title)) {
    return false
  }

  const overviewSignals = [
    /\bis a\b.*\b(video game|game|film|novel|series|app|software|service)\b/,
    /\bdeveloped by\b/,
    /\bfree-to-play\b/,
    /\bbattle royale\b/,
    /\breleased (in|for|on)\b/,
    /\bwas released\b/,
    /\bpublished by\b/,
    /\bfirst released\b/
  ]

  let hits = 0
  for (const p of overviewSignals) {
    if (p.test(text)) hits++
  }
  return hits >= 2
}

/** Does this scout hit actually address a how-to question? */
export function snippetAnswersHowTo(question: string, s: WebSnippet): boolean {
  if (!isHowToQuestion(question)) return true

  const text = `${s.title} ${s.excerpt}`.toLowerCase()
  const actions = extractHowToActionKeywords(question)
  if (actions.length === 0) return !isEncyclopedicOverview(s)

  const actionHit = actions.some((a) => text.includes(a))
  if (!actionHit) return false
  if (isEncyclopedicOverview(s) && !/\b(tip|guide|how|practice|setting|sensitivity|drill|training)\b/i.test(text)) {
    return false
  }

  return true
}

export function formatHowToAbstention(question: string): string {
  const focus = parseQuestionFocus(question)
  const context = extractHowToContext(question)
  const ctx = context ? ` for ${context}` : ''

  return (
    `**Question:** ${focus}\n\n` +
    `**Answer:** Scouts only returned general background about ${context ?? 'the topic'} — not steps for your how-to question. A game overview does not explain *how* to do what you asked.\n\n` +
    `**Reasoning:** You asked for actionable guidance${ctx}. Wikipedia summaries describe *what something is*, not *how to improve at it*.\n\n` +
    `**Next steps:** Try the desktop app (search + forum scouts), or search: "${context ?? focus} aim tips sensitivity guide".\n\n` +
    `**General FPS aim logic** (not scraped — apply if useful): lower sensitivity until you can track smoothly, practice firing-range drills daily, keep crosshair at head height before you see enemies, and minimize movement while shooting.`
  )
}
