import type { InfluenceEntry, InfluenceSource } from '../../../shared/types'

const COLORS: Record<InfluenceSource, string> = {
  openai: '#10a37f',
  gemini: '#4285f4',
  anthropic: '#d97757',
  mvp: '#ffb020',
  web: '#9b59b6'
}

interface Props {
  influence: InfluenceEntry[]
  compact?: boolean
}

export function InfluenceChart({ influence, compact }: Props): JSX.Element | null {
  if (!influence.length) return null

  return (
    <div className={`influence ${compact ? 'compact' : ''}`}>
      <div className="influence-title">Brain vs scouts — who shaped this</div>
      <div className="influence-bar">
        {influence.map((e, i) => (
          <div
            key={`${e.source}-${e.label}-${i}`}
            className="influence-segment"
            style={{ width: `${e.percent}%`, background: COLORS[e.source] }}
            title={`${e.label}: ${e.percent}%`}
          />
        ))}
      </div>
      <div className="influence-legend">
        {influence.map((e, i) => (
          <span key={`${e.source}-${e.label}-${i}`} className="influence-item">
            <span className="swatch" style={{ background: COLORS[e.source] }} />
            {e.label} <strong>{e.percent}%</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
