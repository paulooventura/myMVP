import { useEffect, useState } from 'react'
import type { StoredQuestion } from '../../../shared/types'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (q: StoredQuestion) => void
  activeId?: string
  refreshKey: number
}

export function HistorySidebar({
  open,
  onClose,
  onSelect,
  activeId,
  refreshKey
}: Props): JSX.Element | null {
  const [items, setItems] = useState<StoredQuestion[]>([])
  const [checking, setChecking] = useState<string | null>(null)

  useEffect(() => {
    if (open) window.mvp.listHistory().then(setItems)
  }, [open, refreshKey])

  if (!open) return null

  const toggleMonitor = async (q: StoredQuestion): Promise<void> => {
    const updated = await window.mvp.toggleMonitor(q.id, !q.liveMonitor)
    if (updated) setItems((prev) => prev.map((i) => (i.id === q.id ? updated : i)))
  }

  const recheck = async (q: StoredQuestion): Promise<void> => {
    setChecking(q.id)
    try {
      await window.mvp.recheckQuestion(q.id)
      const fresh = await window.mvp.listHistory()
      setItems(fresh)
    } finally {
      setChecking(null)
    }
  }

  return (
    <aside className="history-sidebar">
      <div className="history-head">
        <h3>Your questions</h3>
        <button className="icon-btn" onClick={onClose} title="Close">
          ×
        </button>
      </div>
      <p className="history-sub">
        myMVP keeps every answer on record and sends web scouts for live updates.
      </p>
      <div className="history-list">
        {items.length === 0 ? (
          <div className="history-empty">No questions yet — ask me something!</div>
        ) : (
          items.map((q) => (
            <div
              key={q.id}
              className={`history-item ${activeId === q.id ? 'active' : ''} ${q.updateAvailable ? 'has-update' : ''}`}
              onClick={() => onSelect(q)}
            >
              <div className="history-q">{q.question}</div>
              <div className="history-meta">
                {new Date(q.updatedAt).toLocaleString()}
                {q.updateAvailable && <span className="live-badge">Live update</span>}
              </div>
              <div className="history-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`mini-btn ${q.liveMonitor ? 'on' : ''}`}
                  title={q.liveMonitor ? 'Web monitoring on' : 'Web monitoring off'}
                  onClick={() => toggleMonitor(q)}
                >
                  {q.liveMonitor ? '👁 On' : '👁 Off'}
                </button>
                <button
                  className="mini-btn"
                  disabled={checking === q.id}
                  onClick={() => recheck(q)}
                >
                  {checking === q.id ? '…' : '↻ Check web'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
