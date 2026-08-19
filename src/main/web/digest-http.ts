import type { DigestResponse } from '../../shared/types'
import { tryDirectKnowledgeAnswerAsync } from '../../shared/web/question-kind'
import { scoutWebWide } from './scout-all'
import { synthesizeFromWeb } from '../../shared/web/synthesize'

/** Shared digest logic — used by Netlify, Vite dev server, and tests. */
export async function handleDigest(question: string): Promise<DigestResponse> {
  const q = question.trim()
  if (!q) throw new Error('question required')

  const direct = await tryDirectKnowledgeAnswerAsync(q)
  if (direct) {
    return {
      answer: direct.answer,
      influence: [{ source: 'mvp', label: 'myMVP (the brain)', percent: 100 }],
      reliability: direct.reliability,
      webSnippets: [],
      webOnly: false,
      penEngine: null,
      advisorsConsulted: 0,
      results: []
    }
  }

  const snippets = await scoutWebWide(q)
  const { answer, influence, reliability } = synthesizeFromWeb(q, snippets)

  return {
    answer,
    influence,
    reliability,
    webSnippets: snippets,
    webOnly: true,
    penEngine: null,
    advisorsConsulted: 0,
    results: []
  }
}
