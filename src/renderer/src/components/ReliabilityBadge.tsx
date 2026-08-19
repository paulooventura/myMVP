import type { ReliabilityReport } from '../../../shared/types'
import { confidenceLabel } from '../../../shared/reliability'

export function ReliabilityBadge({ report }: { report: ReliabilityReport }): JSX.Element {
  const level = report.confidence

  return (
    <div className={`reliability-panel confidence-${level}`}>
      <div className="reliability-header">
        <span className={`reliability-badge confidence-${level}`}>{level}</span>
        <span className="reliability-title">{confidenceLabel(level)}</span>
        <span className="reliability-meta">
          {report.corroboratingChannels} channel(s) · score {report.score}
        </span>
      </div>
      {report.caveats.length > 0 && (
        <ul className="reliability-caveats">
          {report.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
      {report.groundedClaims.length > 0 && (
        <details className="reliability-grounded">
          <summary>{report.groundedClaims.length} grounded claim(s) with sources</summary>
          <ul>
            {report.groundedClaims.map((c, i) => (
              <li key={i}>
                {c.text}
                {c.sourceUrls[0] && (
                  <>
                    {' '}
                    <a href={c.sourceUrls[0]} target="_blank" rel="noreferrer">
                      ({c.sourceLabels[0] ?? 'source'})
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
