import { Notification, BrowserWindow } from 'electron'
import type {
  AppSettings,
  InfluenceEntry,
  LiveUpdateEvent,
  StoredQuestion
} from '../shared/types'
import { getSettings } from './config'
import {
  applyLiveUpdate,
  getQuestion,
  questionsDueForCheck,
  touchChecked
} from './history'
import { configuredProviders, getProvider } from './providers'
import { normalizeInfluence, labelForSource } from './orchestrator'
import { scoutWebWide } from './web/scout-all'
import { synthesizeFromWeb } from './web/synthesize'

let timer: ReturnType<typeof setInterval> | null = null
let scanning = false

interface LiveAssessment {
  shouldUpdate: boolean
  updateSummary: string
  revisedAnswer: string
  influence: { provider: string; percent: number }[]
}

export function startLiveMonitor(): void {
  stopLiveMonitor()
  const settings = getSettings()
  if (!settings.liveMonitorEnabled) return

  const ms = Math.max(5, settings.liveMonitorIntervalMinutes) * 60_000
  timer = setInterval(() => void runScan(), ms)
  // First scan shortly after launch.
  setTimeout(() => void runScan(), 15_000)
}

export function stopLiveMonitor(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function restartLiveMonitor(): void {
  stopLiveMonitor()
  startLiveMonitor()
}

async function runScan(): Promise<void> {
  if (scanning) return
  scanning = true

  try {
    const settings = getSettings()
    if (!settings.liveMonitorEnabled) return

    const due = questionsDueForCheck(settings.liveMonitorIntervalMinutes)
    for (const q of due.slice(0, 3)) {
      await checkQuestion(q, settings)
    }
  } finally {
    scanning = false
  }
}

async function checkQuestion(q: StoredQuestion, settings: AppSettings): Promise<void> {
  touchChecked(q.id)

  const snippets = await scoutWebWide(`${q.question} latest news updates`)
  if (snippets.length === 0) return

  const providers = configuredProviders(settings)

  if (providers.length === 0) {
    await checkQuestionWebOnly(q, snippets)
    return
  }

  const pen = providers[0]
  const webPanel = snippets
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.excerpt}`)
    .join('\n\n')

  const prompt = `You are myMVP doing a LIVE UPDATE check on a past answer.

Original question:
"""${q.question}"""

Current answer myMVP gave:
"""${q.answer}"""

Fresh web snippets (cross-analyze these — filter noise, find signal):
${webPanel}

Decide if NEW, RELEVANT information exists that would materially change the answer.
Ignore duplicate info, spam, opinion fluff, and outdated noise. Only flag real shifts: new facts, corrected data, breaking changes.

Respond with ONLY valid JSON:
{
  "shouldUpdate": true or false,
  "updateSummary": "1-2 sentence plain summary of what changed (empty if shouldUpdate is false)",
  "revisedAnswer": "full updated answer in myMVP voice if shouldUpdate is true, else empty string",
  "influence": [
    {"provider": "web", "percent": 35},
    {"provider": "openai", "percent": 20},
    {"provider": "mvp", "percent": 45}
  ]
}

Influence rules: include "web" for web scout intel, "mvp" for myMVP's brain, and any scout ids if relevant. Sum to 100.`

  try {
    const raw = await pen.complete([{ role: 'user', content: prompt }], 0.3)
    const assessment = parseAssessment(raw)
    if (!assessment?.shouldUpdate || !assessment.revisedAnswer.trim()) return

    const influence = normalizeInfluence(assessment.influence, q.results).map((e) =>
      e.source === 'web' ? { ...e, label: labelForSource('web') } : e
    )

    // Ensure web appears in influence when we used web data.
    if (!influence.some((e) => e.source === 'web')) {
      influence.unshift({ source: 'web', label: labelForSource('web'), percent: 25 })
      rebalance(influence)
    }

    const updated = applyLiveUpdate(
      q.id,
      assessment.revisedAnswer.trim(),
      assessment.updateSummary.trim(),
      influence,
      snippets
    )
    if (!updated) return

    notifyUser(updated, assessment.updateSummary.trim())
    broadcastUpdate({
      questionId: updated.id,
      question: updated.question,
      updateSummary: assessment.updateSummary.trim(),
      revisedAnswer: assessment.revisedAnswer.trim(),
      influence
    })
  } catch {
    /* skip this cycle */
  }
}

function parseAssessment(raw: string): LiveAssessment | null {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as LiveAssessment
  } catch {
    /* fall through */
  }
  const match = trimmed.match(/\{[\s\S]*"shouldUpdate"[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as LiveAssessment
  } catch {
    return null
  }
}

function rebalance(entries: InfluenceEntry[]): void {
  const sum = entries.reduce((a, e) => a + e.percent, 0)
  if (sum === 0 || sum === 100) return
  const factor = 100 / sum
  let running = 0
  for (let i = 0; i < entries.length; i++) {
    if (i === entries.length - 1) {
      entries[i].percent = 100 - running
    } else {
      entries[i].percent = Math.round(entries[i].percent * factor)
      running += entries[i].percent
    }
  }
}

function notifyUser(q: StoredQuestion, summary: string): void {
  if (!Notification.isSupported()) return
  const n = new Notification({
    title: 'myMVP — live update',
    body: `"${truncate(q.question, 60)}" — ${truncate(summary, 120)}`
  })
  n.show()
}

function broadcastUpdate(event: LiveUpdateEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('live:update', event)
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

/** Web-only live check — compares fresh intel to stored answer without API scouts. */
async function checkQuestionWebOnly(
  q: StoredQuestion,
  snippets: Awaited<ReturnType<typeof scoutWebWide>>
): Promise<void> {
  const fresh = synthesizeFromWeb(q.question, snippets)
  const oldNorm = q.answer.replace(/\s+/g, ' ').trim().toLowerCase()
  const newNorm = fresh.answer.replace(/\s+/g, ' ').trim().toLowerCase()

  // Significant change if answers diverge meaningfully.
  const overlap = tokenOverlap(oldNorm, newNorm)
  if (overlap > 0.72) return

  const summary = 'Fresh web intel shifts the picture — myMVP revised the answer.'
  const updated = applyLiveUpdate(q.id, fresh.answer, summary, fresh.influence, snippets)
  if (!updated) return

  notifyUser(updated, summary)
  broadcastUpdate({
    questionId: updated.id,
    question: updated.question,
    updateSummary: summary,
    revisedAnswer: fresh.answer,
    influence: fresh.influence
  })
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter((w) => w.length > 4))
  const tb = new Set(b.split(/\s+/).filter((w) => w.length > 4))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

/** Manual re-check triggered from the UI. */
export async function recheckQuestion(id: string): Promise<LiveUpdateEvent | null> {
  const q = getQuestion(id)
  if (!q) return null

  const settings = getSettings()
  await checkQuestion(q, settings)

  const refreshed = getQuestion(id)
  if (!refreshed?.updateAvailable || !refreshed.revisedAnswer) return null

  return {
    questionId: refreshed.id,
    question: refreshed.question,
    updateSummary: refreshed.updateSummary ?? 'Answer updated from new web intel.',
    revisedAnswer: refreshed.revisedAnswer,
    influence: refreshed.influence
  }
}
