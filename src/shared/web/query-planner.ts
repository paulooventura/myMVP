/** Expand one user question into targeted scout queries (better Wikipedia/search hits). */
import { extractHowToActionKeywords, extractHowToContext, isHowToQuestion } from './question-intent'
import { resolvePrimaryYear } from './temporal'

export function planScoutQueries(question: string): string[] {
  const q = question.trim()
  if (!q) return []

  const out = new Set<string>()
  const keywords = extractSearchKeywords(q)
  const year = resolvePrimaryYear(q)

  for (const rewrite of topicRewrites(q, year)) {
    out.add(rewrite)
  }

  if (year !== null) {
    const withYear = q.replace(/\b(this year|current year|right now)\b/gi, String(year))
    out.add(withYear)
  }

  if (keywords.length > 0) {
    out.add(keywords.slice(0, 6).join(' '))
    if (year !== null) {
      out.add(`${year} ${keywords.slice(0, 5).join(' ')}`)
    }
  }

  out.add(q)

  const anchors = extractGeoAnchors(q)
  if (anchors.length > 0) {
    const anchor = anchors[0]
    const topic = keywords.join(' ')
    if (topic.length > 3) {
      out.add(`${anchor} ${topic}`)
    }
  }

  return [...out].slice(0, 8)
}

/** Place names the question anchors to (city/region). */
export function extractGeoAnchors(question: string): string[] {
  const anchors = new Set<string>()

  const inMatch = question.match(
    /\b(?:in|around|near|from|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/g
  )
  if (inMatch) {
    for (const m of inMatch) {
      const place = m.replace(/^(?:in|around|near|from|at)\s+/i, '').trim()
      if (place.length > 2) anchors.add(place)
    }
  }

  for (const city of KNOWN_PLACES) {
    if (new RegExp(`\\b${escapeRe(city)}\\b`, 'i').test(question)) {
      anchors.add(city)
    }
  }

  return [...anchors]
}

/** Meaningful terms for overlap checks (not stopwords). */
export function extractSearchKeywords(question: string): string[] {
  const raw = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))

  return [...new Set(raw)]
}

function topicRewrites(question: string, year: number | null): string[] {
  const q = question.toLowerCase()
  const out: string[] = []

  if (/\bfifa world cup\b|\bworld cup\b/.test(q) && year !== null) {
    out.push(`${year} FIFA World Cup`)
    out.push(`${year} FIFA World Cup favorites predictions`)
    out.push(`${year} world cup winner odds`)
  }

  if (/\b(diaper|nappy|potty)\b/.test(q) && /\b(baby|toddler|child|old|age|when|stop)\b/.test(q)) {
    out.push('toilet training age children')
    out.push('potty training typical age')
    out.push('when toddlers stop wearing diapers')
  }

  if (/\bhow old\b/.test(q) || /\bwhat age\b/.test(q)) {
    const subject = q
      .replace(/\b(how old|what age|when|does|do|is|are|the|a|an|to|have|has|until|till)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (subject.length > 4) out.push(subject)
  }

  if (/\b(symptom|treat|cause|cure)\b/.test(q)) {
    out.push(question.replace(/\?/g, '').trim())
  }

  if (isHowToQuestion(question)) {
    const ctx = extractHowToContext(question)
    const actions = extractHowToActionKeywords(question)
    const actionPhrase = actions.slice(0, 3).join(' ')
    if (ctx && actionPhrase) {
      out.push(`${ctx} ${actionPhrase} tips guide`)
      out.push(`how to ${actionPhrase} ${ctx}`)
      out.push(`${ctx} improve ${actionPhrase} settings`)
    }
  }

  return out
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'what',
  'when',
  'where',
  'who',
  'whom',
  'which',
  'why',
  'how',
  'old',
  'till',
  'until',
  'from',
  'with',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'of',
  'in',
  'for',
  'on',
  'at',
  'by',
  'and',
  'or',
  'but',
  'not',
  'no',
  'so',
  'if',
  'then',
  'than',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'they',
  'them',
  'their',
  'you',
  'your',
  'we',
  'our',
  'he',
  'she',
  'his',
  'her',
  'my',
  'me',
  'i',
  'must',
  'need',
  'want',
  'get',
  'got',
  'like',
  'just',
  'also',
  'very',
  'much',
  'many',
  'some',
  'any',
  'all',
  'most',
  'more',
  'other',
  'such',
  'only',
  'own',
  'same',
  'too',
  'out',
  'up',
  'down',
  'off',
  'over',
  'under',
  'again',
  'ever',
  'never',
  'always',
  'still',
  'already',
  'even',
  'well',
  'way',
  'make',
  'made',
  'take',
  'took',
  'give',
  'gave',
  'go',
  'going',
  'went',
  'come',
  'came',
  'see',
  'know',
  'think',
  'say',
  'said',
  'tell',
  'ask',
  'asked',
  'use',
  'used',
  'using',
  'wear',
  'wearing',
  'stop',
  'stopping'
])

const KNOWN_PLACES = [
  'Nashville',
  'Memphis',
  'Tennessee',
  'New York',
  'Los Angeles',
  'Chicago',
  'Austin',
  'Miami',
  'Atlanta',
  'London',
  'Brooklyn',
  'Manhattan'
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
