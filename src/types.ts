// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------
// Everything in the app is described by a single `AppData` object. That object
// is what gets saved to / loaded from localStorage and what gets
// exported/imported as JSON. Keeping all state in one serialisable object makes
// backup, import and "reset demo data" trivial.

export type AccountType = 'main' | 'savings' | 'cash';

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  type: AccountType;
}

export interface IncomeEntry {
  id: string;
  date: string; // ISO date: "YYYY-MM-DD" - when the money actually arrived
  source: string; // e.g. part-time job, gig, family, refund, other
  amount: number;
  accountId?: string; // references BankAccount.id (""/undefined = not applied to a balance)
  note?: string;
  // Optional "budget month" ("YYYY-MM"): the month this money is meant to be
  // spent in. Defaults to the month of `date` when omitted. Lets income you earn
  // one month but spend the next (e.g. gig early payouts) count toward the
  // month you actually spend it.
  budgetMonth?: string;
  balanceImpactApplied?: boolean;
}

// Fixed list of expense categories requested in the brief.
export const EXPENSE_CATEGORIES = [
  'groceries',
  'eating out',
  'rent',
  'health insurance',
  'transport',
  'gym',
  'phone',
  'subscriptions',
  'clothes',
  'pharmacy/health',
  'university',
  'household',
  'social',
  'transfer',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  category: string;
  amount: number;
  accountId: string; // references BankAccount.id ("" = unassigned)
  transferToAccountId?: string; // for category === "transfer"
  note?: string;
  // Optional "budget month" ("YYYY-MM"): the month this expense should count
  // against in the budget. Defaults to the month of `date` when omitted. Lets an
  // expense paid this month be funded from a different month's budget (e.g.
  // deferring a purchase to next month to keep this month's safe-to-spend
  // intact). The transaction date stays honest; only the budget bucket moves.
  // Mirrors `IncomeEntry.budgetMonth`.
  budgetMonth?: string;
  // True once this expense has been applied to the linked account balance.
  // Older saved expenses do not have this flag, so edits can avoid refunding
  // money that was never subtracted in the first place.
  balanceImpactApplied?: boolean;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  paymentDay?: number; // day of the month the money is debited (1..31)
  active: boolean; // false = no longer ongoing (see endMonth); kept for reference
  essential: boolean; // non-essential costs are the ones Panic Mode suggests cutting
  // Optional effective window ("YYYY-MM"). A cost only counts toward months
  // inside [startMonth, endMonth]. Both are inclusive and either can be omitted:
  //   - startMonth absent => applies from the earliest data (open lower bound)
  //   - endMonth absent    => still ongoing (open upper bound)
  // This is what keeps cancelling a cost from silently rewriting past months:
  // ending it stamps endMonth, so history before then is preserved.
  startMonth?: string;
  endMonth?: string;
}

export interface Debt {
  id: string;
  lender: string;
  totalBorrowed: number;
  repaid: number;
  dateBorrowed?: string;
  repaymentPlan?: string;
  note?: string;
}

export interface AppData {
  version: number;
  incomes: IncomeEntry[];
  expenses: ExpenseEntry[];
  fixedCosts: FixedCost[];
  accounts: BankAccount[];
  debts: Debt[];
  // Optional amount (€) to set aside every month BEFORE anything is treated as
  // spendable. The safe-to-spend numbers and category budgets are computed from
  // what's left after this goal. Absent/0 = spend-to-zero (old behaviour).
  savingsGoal?: number;
}

// Suggestions only - the source field is still free text so you can type anything.
export const INCOME_SOURCES = [
  'part-time job',
  'gig',
  'family',
  'refund',
  'other',
] as const;

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'main', label: 'Main account' },
  { value: 'savings', label: 'Savings account' },
  { value: 'cash', label: 'Cash' },
];

export const DATA_VERSION = 1;
