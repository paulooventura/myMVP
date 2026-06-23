import { randomUUID } from 'crypto'
import Store from 'electron-store'
import type { DigestResponse, StoredQuestion } from '../shared/types'

interface HistoryStore {
  questions: StoredQuestion[]
}

const store = new Store<HistoryStore>({
  name: 'mymvp-history',
  defaults: { questions: [] }
})

const MAX_QUESTIONS = 200

export function listQuestions(): StoredQuestion[] {
  return [...store.get('questions')].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function getQuestion(id: string): StoredQuestion | undefined {
  return store.get('questions').find((q) => q.id === id)
}

export function saveFromDigest(
  question: string,
  res: DigestResponse,
  liveMonitor = true
): StoredQuestion {
  const now = new Date().toISOString()
  const entry: StoredQuestion = {
    id: randomUUID(),
    question,
    answer: res.answer,
    influence: res.influence,
    results: res.results,
    penEngine: res.penEngine,
    advisorsConsulted: res.advisorsConsulted,
    createdAt: now,
    updatedAt: now,
    liveMonitor,
    updateAvailable: false,
    webSnippets: res.webSnippets
  }

  const questions = [entry, ...store.get('questions')].slice(0, MAX_QUESTIONS)
  store.set('questions', questions)
  return entry
}

export function updateQuestion(
  id: string,
  patch: Partial<StoredQuestion>
): StoredQuestion | undefined {
  const questions = store.get('questions')
  const idx = questions.findIndex((q) => q.id === id)
  if (idx === -1) return undefined

  const updated: StoredQuestion = {
    ...questions[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  }
  questions[idx] = updated
  store.set('questions', questions)
  return updated
}

export function setLiveMonitor(id: string, enabled: boolean): StoredQuestion | undefined {
  return updateQuestion(id, { liveMonitor: enabled, updateAvailable: false })
}

export function applyLiveUpdate(
  id: string,
  revisedAnswer: string,
  updateSummary: string,
  influence: StoredQuestion['influence'],
  webSnippets?: StoredQuestion['webSnippets']
): StoredQuestion | undefined {
  return updateQuestion(id, {
    answer: revisedAnswer,
    revisedAnswer,
    updateSummary,
    influence,
    webSnippets,
    updateAvailable: true,
    lastCheckedAt: new Date().toISOString()
  })
}

export function dismissUpdate(id: string): StoredQuestion | undefined {
  return updateQuestion(id, { updateAvailable: false, updateSummary: undefined })
}

export function questionsDueForCheck(intervalMinutes: number): StoredQuestion[] {
  const cutoff = Date.now() - intervalMinutes * 60_000
  return store.get('questions').filter((q) => {
    if (!q.liveMonitor) return false
    if (!q.lastCheckedAt) return true
    return new Date(q.lastCheckedAt).getTime() < cutoff
  })
}

export function touchChecked(id: string): void {
  updateQuestion(id, { lastCheckedAt: new Date().toISOString() })
}
