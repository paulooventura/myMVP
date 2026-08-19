import type { ReliabilityReport } from '../types'
import { tryCapitalAnswer, tryDistanceAnswer } from './geography'

export interface DirectAnswer {
  answer: string
  reliability: ReliabilityReport
}

const DIRECT_RELIABILITY: ReliabilityReport = {
  confidence: 'high',
  score: 95,
  caveats: [],
  corroboratingChannels: 0,
  groundedClaims: []
}

/** Sync direct answers (math, capitals, known facts). */
export function tryDirectKnowledgeAnswer(question: string): DirectAnswer | null {
  return tryArithmetic(question) ?? tryPottyTraining(question) ?? tryCapitalAnswer(question) ?? tryWellKnownFact(question)
}

/** Sync + async direct answers — brain logic before web scouts. */
export async function tryDirectKnowledgeAnswerAsync(question: string): Promise<DirectAnswer | null> {
  const sync = tryDirectKnowledgeAnswer(question)
  if (sync) return sync
  return tryDistanceAnswer(question)
}

function tryPottyTraining(question: string): DirectAnswer | null {
  const q = question.toLowerCase()
  if (!/\b(diaper|nappy|potty|toilet)\b/.test(q)) return null
  if (!/\b(baby|toddler|child|kid|old|age|when|stop|until|till)\b/.test(q)) return null

  return {
    answer:
      'Most children move out of diapers during potty training, usually between **2 and 3 years old** (often 18–36 months). ' +
      'Daytime dryness typically comes first; staying dry at night may take until **3–5+**. ' +
      'There is no single required age — pediatric guidance is to watch readiness (staying dry longer, showing interest in the toilet) rather than forcing a date. ' +
      'Ask your pediatrician if you have concerns about delays.',
    reliability: {
      ...DIRECT_RELIABILITY,
      caveats: [
        'General pediatric guidance — not medical advice for your specific child.'
      ]
    }
  }
}

function tryArithmetic(question: string): DirectAnswer | null {
  const q = question.trim().replace(/[?¿!]+$/g, '').trim()

  let expr = q
    .replace(/^(what is|what's|whats|how much is|calculate|compute|solve|evaluate)\s+/i, '')
    .replace(/^does\s+/i, '')
    .replace(/\s+(equal|equals|make|give)\s*.*$/i, '')
    .trim()

  // "1 + 1" inside longer question
  const embedded = q.match(
    /(-?\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(-?\d+(?:\.\d+)?)/
  )
  if (embedded && expr.length > 40) {
    expr = embedded[0]
  }

  const match = expr.match(
    /^(-?\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(-?\d+(?:\.\d+)?)$/
  )
  if (!match) return null

  const a = parseFloat(match[1])
  const op = match[2]
  const b = parseFloat(match[3])
  let result: number

  switch (op) {
    case '+':
      result = a + b
      break
    case '-':
      result = a - b
      break
    case '*':
    case '×':
      result = a * b
      break
    case '/':
    case '÷':
      if (b === 0) {
        return {
          answer: 'Division by zero is undefined.',
          reliability: DIRECT_RELIABILITY
        }
      }
      result = a / b
      break
    default:
      return null
  }

  const symbol = op === '*' ? '×' : op
  const value = formatNumber(result)

  return {
    answer: `${a} ${symbol} ${b} = ${value}`,
    reliability: DIRECT_RELIABILITY
  }
}

function tryWellKnownFact(question: string): DirectAnswer | null {
  const q = question.toLowerCase()

  if (/\b1\s*\+\s*1\b/.test(q) && /(equal|equals|2|always)/.test(q)) {
    return {
      answer:
        'In standard arithmetic, 1 + 1 = 2. (Formal math can redefine symbols in exotic systems, but for everyday counting the answer is 2.)',
      reliability: DIRECT_RELIABILITY
    }
  }

  return null
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(8).replace(/\.?0+$/, '')
}

/** Web scouts waste time on these — skip them entirely. */
export function shouldSkipWebScouts(question: string): boolean {
  return tryDirectKnowledgeAnswer(question) !== null
}
