import type { DigestResponse } from '../shared/types'
import { handleDigest } from './web/digest-http'

/** myMVP answers using only web scouts — no API keys required. */
export async function digestFromWeb(question: string): Promise<DigestResponse> {
  return handleDigest(question)
}
