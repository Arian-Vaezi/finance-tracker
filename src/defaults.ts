import { AppData, DATA_VERSION } from './types';

// A small id helper. crypto.randomUUID is available in every modern browser,
// but we keep a fallback just in case.
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// DEMO DATA  ·  100% fictional
// ---------------------------------------------------------------------------
// This is the dataset shown to portfolio visitors in "Demo mode". It contains
// NO real personal information - no real balances, debts or income. The owner's
// real numbers live only in the browser's localStorage under "Personal mode"
// and are never committed to source control.
// ---------------------------------------------------------------------------
export function makeDemoData(now: Date = new Date()): AppData {
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const day = (d: number) => `${ym}-${pad(d)}`;

  const accA = uid();
  const accB = uid();

  return {
    version: DATA_VERSION,

    // Put €50 aside each month before anything counts as spendable.
    savingsGoal: 50,

    // Monthly income -> €1,350 total (variable, entered per month).
    incomes: [
      { id: uid(), date: day(1), source: 'Part-time job', amount: 900, note: 'Monthly wage' },
      { id: uid(), date: day(3), source: 'Tutoring', amount: 450, note: 'Side income' },
    ],

    // Example day-to-day expenses (kept modest so the demo opens healthy).
    expenses: [
      { id: uid(), date: day(2), category: 'groceries', amount: 18.5, accountId: accA, note: 'Supermarket' },
      { id: uid(), date: day(3), category: 'eating out', amount: 11, accountId: accA, note: 'Lunch with friends' },
      { id: uid(), date: day(4), category: 'pharmacy/health', amount: 8.5, accountId: accA, note: 'Pharmacy' },
      { id: uid(), date: day(4), category: 'university', amount: 12, accountId: accA, note: 'Printing & supplies' },
      { id: uid(), date: day(5), category: 'gym', amount: 9, accountId: accA, note: 'Day pass' },
    ],

    // Fixed monthly costs -> €917 total.
    fixedCosts: [
      { id: uid(), name: 'Rent', amount: 675, paymentDay: 1, active: true, essential: true },
      { id: uid(), name: 'Health insurance', amount: 144, paymentDay: 15, active: true, essential: true },
      { id: uid(), name: 'Transport', amount: 43, paymentDay: 1, active: true, essential: true },
      { id: uid(), name: 'Subscriptions', amount: 55, active: true, essential: false },
    ],

    // Two bank accounts -> €2,700 total.
    accounts: [
      { id: accA, name: 'Bank account A', balance: 1800, type: 'main' },
      { id: accB, name: 'Bank account B', balance: 900, type: 'savings' },
    ],

    // Debt -> €1,000 (example only).
    debts: [
      {
        id: uid(),
        lender: 'Family loan',
        totalBorrowed: 1000,
        repaid: 0,
        repaymentPlan: '€100 / month',
        note: 'Example debt - borrowed money, not free cash.',
      },
    ],
  };
}

// A blank dataset - the starting point for "Personal mode" so the owner enters
// their own numbers from scratch (nothing personal is ever pre-filled).
export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    incomes: [],
    expenses: [],
    fixedCosts: [],
    accounts: [],
    debts: [],
  };
}
