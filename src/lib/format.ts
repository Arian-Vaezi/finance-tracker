// Small formatting + date helpers used across the whole app.
// Months are represented everywhere as the string "YYYY-MM".

const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

/** Format a number as euros, e.g. 965.5 -> "965,50 €". */
export function eur(n: number): string {
  return eurFormatter.format(Number.isFinite(n) ? n : 0);
}

/** Format a fraction (0..1) as a whole-number percentage, e.g. 0.74 -> "74%". */
export function pct(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0%';
  return `${Math.round(fraction * 100)}%`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The current month as "YYYY-MM". */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** Human label for a month, e.g. "2026-06" -> "June 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Shift a "YYYY-MM" month by a number of months (can be negative). */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Number of days in a given "YYYY-MM" month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
}

/** True if an ISO date string ("YYYY-MM-DD") falls inside the given month. */
export function isInMonth(dateStr: string, month: string): boolean {
  return dateStr.startsWith(month);
}

/** Format an ISO date for display, e.g. "2026-06-04" -> "4 Jun 2026". */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today as an ISO date string, handy as a form default. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Add an ordinal suffix to a day number, e.g. 15 -> "15th". */
export function ordinal(day: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return day + (s[(v - 20) % 10] || s[v] || s[0]);
}
