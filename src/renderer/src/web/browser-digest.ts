import type { DigestResponse } from '../../../shared/types'
import { scoutInBrowser } from '../../../shared/web/browser-scouts'
import { synthesizeFromWeb } from '../../../shared/web/synthesize'

/** Full digest in the browser — no server, works on pauloventura.org static hosting. */
export async function digestInBrowser(question: string): Promise<DigestResponse> {
  const snippets = await scoutInBrowser(question)
  const { answer, influence } = synthesizeFromWeb(question, snippets)
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
