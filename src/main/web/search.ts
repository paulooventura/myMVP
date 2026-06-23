import type { WebSnippet } from '../../shared/types'

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
    return parseDuckDuckGo(html, max)
  } catch {
    return []
  }
}

/** @deprecated use searchDuckDuckGo */
export const searchWeb = searchDuckDuckGo

function parseDuckDuckGo(html: string, max: number): WebSnippet[] {
  const snippets: WebSnippet[] = []
  const seen = new Set<string>()

  const blockRe =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<span class="result__snippet"[^>]*>([\s\S]*?)<\/span>)/gi

  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && snippets.length < max) {
    const rawUrl = decodeHtml(m[1])
    const title = stripTags(decodeHtml(m[2])).trim()
    const excerpt = stripTags(decodeHtml(m[3] || m[4] || '')).trim()

    const url = normalizeUrl(rawUrl)
    if (!url || !title || seen.has(url)) continue
    if (isNoise(title, excerpt)) continue

    seen.add(url)
    snippets.push({
      title: title.slice(0, 200),
      url,
      excerpt: excerpt.slice(0, 400) || title,
      channel: 'search',
      channelLabel: 'Search scout'
    })
  }

  if (snippets.length === 0) {
    const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    while ((m = linkRe.exec(html)) !== null && snippets.length < max) {
      const url = normalizeUrl(decodeHtml(m[1]))
      const title = stripTags(decodeHtml(m[2])).trim()
      if (!url || !title || seen.has(url) || isNoise(title, '')) continue
      seen.add(url)
      snippets.push({
        title: title.slice(0, 200),
        url,
        excerpt: title,
        channel: 'search',
        channelLabel: 'Search scout'
      })
    }
  }

  return snippets
}

function normalizeUrl(href: string): string {
  if (href.startsWith('//')) return `https:${href}`
  if (href.startsWith('http')) return href
  const uddg = href.match(/uddg=([^&]+)/)
  if (uddg) {
    try {
      return decodeURIComponent(uddg[1])
    } catch {
      return href
    }
  }
  return href
}

function isNoise(title: string, excerpt: string): boolean {
  const t = `${title} ${excerpt}`.toLowerCase()
  const junk = ['login', 'sign up', 'cookie', 'captcha', '404 not found', 'access denied']
  return junk.some((j) => t.includes(j))
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}
