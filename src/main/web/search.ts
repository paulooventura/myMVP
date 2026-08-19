import type { WebSnippet } from '../../shared/types'
import { parseDuckDuckGoHtml } from '../../shared/web/duck-search'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function searchDuckDuckGo(query: string, max = 6): Promise<WebSnippet[]> {
  const q = query.trim()
  if (!q) return []

  try {
    const body = new URLSearchParams({ q, kl: 'us-en' })
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000)
    })

    if (!res.ok) return []
    const html = await res.text()
    return parseDuckDuckGoHtml(html, max)
  } catch {
    return []
  }
}

/** @deprecated use searchDuckDuckGo */
export const searchWeb = searchDuckDuckGo
