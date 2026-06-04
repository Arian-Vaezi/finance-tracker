import { IncomeEntry } from '../types';
import { addMonths } from './format';

// ---------------------------------------------------------------------------
// Gig pays in two parts:
//   - an "early payout" of part of the shift, the day AFTER the shift (reliable)
//   - the remaining halves of ALL the month's shifts are pooled, TAXED, and
//     paid as one lump sum on the 15th of the FOLLOWING month
//
// The 15th lump sum can't be predicted (it's aggregated and after tax), so we
// only ever log the early payout as real income. `remainder` here is just a
// rough BEFORE-TAX estimate used for an on-screen hint - it is never saved.
// The user adds the real lump sum by hand when it actually arrives.
// ---------------------------------------------------------------------------

type DraftIncome = Omit<IncomeEntry, 'id'>;

export interface GigSplit {
  early: DraftIncome;
  remainder: DraftIncome;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Split one Gig shift into its two real payments.
 * @param shiftDate ISO date ("YYYY-MM-DD") of the day you worked
 * @param total     total pay for the shift
 * @param earlyPct  percentage paid early (default 50)
 */
export function splitGigShift(
  shiftDate: string,
  total: number,
  earlyPct = 50,
): GigSplit {
  const [y, m, d] = shiftDate.split('-').map(Number);

  // Early payout: the day after the shift.
  const earlyDate = iso(new Date(y, m - 1, d + 1));

  // Remainder: the 15th of the month after the shift's month.
  // `m` is 1-based, so new Date(y, m, 15) is already the next month, 0-based.
  const remainderDate = iso(new Date(y, m, 15));

  const earlyAmount = round2(total * (earlyPct / 100));
  const remainderAmount = round2(total - earlyAmount); // keeps the two halves summing exactly

  // You spend Gig money the month AFTER you earn it, so the early payout
  // (received in the work month) is budgeted to the following month.
  const spendMonth = addMonths(shiftDate.slice(0, 7), 1);

  return {
    early: {
      date: earlyDate,
      source: 'Gig',
      amount: earlyAmount,
      budgetMonth: spendMonth,
      note: `Shift ${shiftDate} · early ${earlyPct}%`,
    },
    // Display-only estimate (before tax). Not saved as income.
    remainder: {
      date: remainderDate,
      source: 'Gig',
      amount: remainderAmount,
      note: `Shift ${shiftDate} · remainder estimate (before tax)`,
    },
  };
}
