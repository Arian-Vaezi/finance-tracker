import { eur, pct } from '../lib/format';
import { cn } from '@/lib/utils';

// Lightweight, dependency-free charts built from plain divs.
// They stay readable on a phone and never need a charting library.
// Colors come from the theme's categorical chart tokens so both modes work.

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
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
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate capitalize">{d.label}</span>
            <span className="shrink-0 font-medium">{eur(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
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

const PROPORTION_FILL: Record<'safe' | 'warning' | 'danger', string> = {
  safe: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

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
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{partLabel}</span>
        <strong className="font-semibold">{pct(fraction)}</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', PROPORTION_FILL[tone ?? autoTone])}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {eur(part)} of {eur(whole)}
      </div>
    </div>
  );
}
