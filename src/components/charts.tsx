import { eur, pct } from '../lib/format';

// Lightweight, dependency-free charts built from plain divs.
// They stay readable on a phone and never need a charting library.

const PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#a855f7', '#eab308', '#22c55e', '#64748b',
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Horizontal bar list - good for "spending by category". */
export function BarList({
  data,
  emptyLabel = 'No data yet.',
}: {
  data: BarDatum[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="chart-empty">{emptyLabel}</p>;
  }
  return (
    <div className="barlist">
      {data.map((d, i) => (
        <div className="barlist-row" key={d.label}>
          <div className="barlist-top">
            <span className="barlist-label">{d.label}</span>
            <span className="barlist-value">{eur(d.value)}</span>
          </div>
          <div className="barlist-track">
            <div
              className="barlist-bar"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color ?? colorForIndex(i),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Single proportion bar, e.g. "fixed costs are 74% of income".
 * Shows the part against the whole with a percentage label.
 */
export function ProportionBar({
  partLabel,
  part,
  whole,
  tone,
}: {
  partLabel: string;
  part: number;
  whole: number;
  tone?: 'safe' | 'warning' | 'danger';
}) {
  const fraction = whole > 0 ? part / whole : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  const autoTone: 'safe' | 'warning' | 'danger' =
    fraction > 0.7 ? 'danger' : fraction > 0.5 ? 'warning' : 'safe';
  return (
    <div className="proportion">
      <div className="proportion-top">
        <span>{partLabel}</span>
        <strong>{pct(fraction)}</strong>
      </div>
      <div className="proportion-track">
        <div
          className={`proportion-fill proportion-fill--${tone ?? autoTone}`}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <div className="proportion-foot">
        {eur(part)} of {eur(whole)}
      </div>
    </div>
  );
}
