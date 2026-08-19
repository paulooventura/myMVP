/** What year the user is asking about (if any). */
export function resolvePrimaryYear(question: string, now = new Date()): number | null {
  const q = question.toLowerCase()
  const current = now.getFullYear()

  const explicit = q.match(/\b(20\d{2})\b/)
  if (explicit) return parseInt(explicit[1], 10)

  if (/\b(this year|current year|right now|today)\b/.test(q)) return current
  if (/\b(last year|previous year)\b/.test(q)) return current - 1
  if (/\bnext year\b/.test(q)) return current + 1

  return null
}

/** Years prominently referenced in a scout hit (title weighted). */
export function yearsInSnippet(s: { title: string; excerpt: string }): number[] {
  const found = new Set<number>()
  const titleYears = s.title.match(/\b(20\d{2})\b/g) ?? []
  for (const y of titleYears) found.add(parseInt(y, 10))
  const excerptYears = s.excerpt.slice(0, 200).match(/\b(20\d{2})\b/g) ?? []
  for (const y of excerptYears) found.add(parseInt(y, 10))
  return [...found]
}

export type YearMismatch = 'ok' | 'soft' | 'hard'

/** hard = wrong year in title (e.g. user asked 2026, hit is "2030 FIFA World Cup"). */
export function yearMismatch(targetYear: number, s: { title: string; excerpt: string }): YearMismatch {
  const titleYears = (s.title.match(/\b(20\d{2})\b/g) ?? []).map((y) => parseInt(y, 10))

  if (titleYears.length > 0) {
    const titleMatches = titleYears.includes(targetYear)
    const titleWrong = titleYears.some((y) => Math.abs(y - targetYear) >= 2)
    if (titleWrong && !titleMatches) return 'hard'
    if (!titleMatches && titleYears.every((y) => y > targetYear + 1)) return 'hard'
  }

  const allYears = yearsInSnippet(s)
  if (allYears.length === 0) return 'soft'
  if (allYears.includes(targetYear)) return 'ok'
  if (allYears.every((y) => Math.abs(y - targetYear) >= 2)) return 'hard'

  return 'soft'
}

export function isHardYearMismatch(targetYear: number, s: { title: string; excerpt: string }): boolean {
  return yearMismatch(targetYear, s) === 'hard'
}

export function isPredictionQuestion(question: string): boolean {
  return /\b(most likely|who will win|who'?s going to win|who is going to win|predict|prediction|favorite|favourite|favorites|favourites|odds|likely to win)\b/i.test(
    question
  )
}

export function formatTemporalAbstention(
  question: string,
  targetYear: number,
  wrongYear?: number
): string {
  const wrong =
    wrongYear && wrongYear !== targetYear
      ? `Scouts returned **${wrongYear}** material instead — that does **not** answer a question about **${targetYear}**.`
      : `Scouts did not return **${targetYear}**-specific sources.`

  const predict = isPredictionQuestion(question)
    ? `\n\nPredicting a winner needs **current** news and odds for ${targetYear}, not a Wikipedia page about another edition. I won't guess or swap years.`
    : ''

  return (
    `You asked about **${targetYear}** ("this year" = ${targetYear}). ${wrong}${predict}\n\n` +
    `Use the desktop app for live news/search scouts, or check current sports coverage for ${targetYear}.`
  )
}
