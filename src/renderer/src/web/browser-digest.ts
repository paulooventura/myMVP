import type { DigestResponse } from '../../../shared/types'
import { tryDirectKnowledgeAnswerAsync } from '../../../shared/web/question-kind'
import { scoutInBrowser } from '../../../shared/web/browser-scouts'
import { synthesizeFromWeb } from '../../../shared/web/synthesize'

/** Full digest in the browser — brain logic first, then web scouts. */
export async function digestInBrowser(question: string): Promise<DigestResponse> {
  const direct = await tryDirectKnowledgeAnswerAsync(question)
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

  const snippets = await scoutInBrowser(question)
  const { answer, influence, reliability } = synthesizeFromWeb(question, snippets)
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
