import type { DigestResponse } from '../../shared/types'
import { scoutWebWide } from './scout-all'
import { synthesizeFromWeb } from '../../shared/web/synthesize'

/** Shared digest logic — used by Netlify, Vite dev server, and tests. */
export async function handleDigest(question: string): Promise<DigestResponse> {
  const q = question.trim()
  if (!q) throw new Error('question required')

  const snippets = await scoutWebWide(q)
  const { answer, influence } = synthesizeFromWeb(q, snippets)

  return {
    answer,
    influence,
    webSnippets: snippets,
    webOnly: true,
    penEngine: null,
    advisorsConsulted: 0,
    results: []
  }
}
