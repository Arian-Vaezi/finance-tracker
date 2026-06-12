// ===========================================================================
// Finance engine
// ===========================================================================
// This file contains ALL the money math. Nothing here touches React or the DOM,
// which makes the formulas easy to read, reason about and test.
//
// Quick glossary of the core formulas (for the selected month):
//
//   monthly_income        = sum of income entries dated in the month
//   fixed_costs           = sum of fixed costs that APPLY to the month
//                           (each cost has an optional start/end month, so a
//                            cost you cancel today no longer rewrites history)
//   variable_spending     = sum of expense entries dated in the month, EXCLUDING
//                           transfers (moving money between your own accounts is
//                           not spending). Fixed costs live in their own ledger,
//                           so they are never double-counted here.
//   remaining_after_fixed = monthly_income - fixed_costs
//   remaining_money       = monthly_income - fixed_costs - variable_spending
//   savings_goal          = optional amount set aside each month before spending
//   spendable_remaining   = remaining_money - savings_goal
//   days_left             = days remaining in the month, including today
//   safe_to_spend_per_day = spendable_remaining / days_left
//   weekly_limit          = safe_to_spend_per_day * min(7, days_left)
//
//   total_bank   = sum of account balances
//   total_debt   = sum of (borrowed - repaid) for each debt
//   real_net     = total_bank - total_debt   <- your actual free money
// ===========================================================================

import { AppData, FixedCost, IncomeEntry } from '../types';
import { addMonths, daysInMonth, eur, isInMonth, ordinal, pct, currentMonth } from './format';

/**
 * The month an income counts toward in the budget: its explicit `budgetMonth`,
 * or the month of its date when none is set. This is how income earned one month
 * but spent the next (gig early payouts) lands in the right month.
 */
export function budgetMonthOf(i: IncomeEntry): string {
  return i.budgetMonth ?? i.date.slice(0, 7);
}

// These expense rows may still move bank balances, but they are not variable
// spending for safe-to-spend: transfers move own money, while rent and health
// insurance belong in the fixed-costs ledger.
const TRANSFER_CATEGORY = 'transfer';
const NON_VARIABLE_SPENDING_CATEGORIES = new Set([
  TRANSFER_CATEGORY,
  'rent',
  'health insurance',
]);

export interface MonthSummary {
  month: string;

  // Core money figures
  monthlyIncome: number;
  fixedCosts: number;
  variableSpending: number;
  remainingAfterFixed: number;
  remainingMoney: number; // actual money left (savings goal still inside)
  savingsGoal: number;
  spendableRemaining: number; // remainingMoney - savingsGoal: what safe-to-spend uses

  // Time
  totalDays: number;
  daysElapsed: number; // days gone in the month, including today
  daysLeft: number; // days left, including today
  weeksLeft: number;

  // Pacing / safe-to-spend
  safeToSpendPerDay: number;
  weeklyLimit: number;
  variableBudget: number; // money available for variable spending = remainingAfterFixed
  pctVariableUsed: number; // variableSpending / variableBudget  (0..n)
  expectedPaceFraction: number; // daysElapsed / totalDays  (0..1)
  dailyPace: number; // average variable spend per elapsed day
  projectedVariable: number; // variable spend projected to month end at current pace
  projectedRemaining: number; // money left at month end if pace continues

  // Net worth
  totalBank: number;
  totalDebt: number;
  realNetWorth: number;

  // Where in time the selected month sits
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
}

/** Sum the remaining (still-owed) amount across all debts. */
export function totalDebt(data: AppData): number {
  return data.debts.reduce((s, d) => s + Math.max(0, d.totalBorrowed - d.repaid), 0);
}

/** Sum all bank account balances. */
export function totalBank(data: AppData): number {
  return data.accounts.reduce((s, a) => s + a.balance, 0);
}

/**
 * Whether a fixed cost applies to a given budget month ("YYYY-MM").
 *
 * A cost counts toward a month only inside its effective window:
 *   - before `startMonth` (when set): not yet active.
 *   - after `endMonth` (when set): already cancelled.
 * When there is no `endMonth`, the cost is ongoing iff it is `active`. This is
 * the crucial fix: ending a cost stamps `endMonth`, so past months keep it and
 * only the future drops it — disabling no longer rewrites history.
 */
export function isFixedCostInMonth(f: FixedCost, month: string): boolean {
  if (f.startMonth && month < f.startMonth) return false;
  if (f.endMonth) return month <= f.endMonth;
  return f.active;
}

/** Sum of fixed costs that apply to a specific month. */
export function fixedCostsForMonth(data: AppData, month: string): number {
  return data.fixedCosts
    .filter((f) => isFixedCostInMonth(f, month))
    .reduce((s, f) => s + f.amount, 0);
}

/** Sum of the currently ongoing fixed costs (this month's live total). */
export function totalFixedCosts(data: AppData): number {
  return fixedCostsForMonth(data, currentMonth());
}

/**
 * Compute every derived figure for a given month.
 * `now` is injected so the time-based math is deterministic and testable.
 */
export function computeMonthSummary(
  data: AppData,
  month: string,
  now: Date = new Date(),
): MonthSummary {
  const nowMonth = currentMonth(now);
  const isCurrentMonth = month === nowMonth;
  const isPastMonth = month < nowMonth;
  const isFutureMonth = month > nowMonth;

  const totalDays = daysInMonth(month);

  // How much of the month has elapsed / remains.
  let daysElapsed: number;
  let daysLeft: number;
  if (isCurrentMonth) {
    daysElapsed = now.getDate(); // today counts as (partly) spent
    daysLeft = totalDays - now.getDate() + 1; // ...and today still counts as spendable
  } else if (isPastMonth) {
    daysElapsed = totalDays;
    daysLeft = 0;
  } else {
    daysElapsed = 0;
    daysLeft = totalDays;
  }
  const weeksLeft = daysLeft > 0 ? Math.ceil(daysLeft / 7) : 0;

  // Income / spending for the month.
  // Income is grouped by its budget month (the month it is meant to fund), so a
  // A gig early payout received this month but earmarked for next month counts
  // toward next month's budget.
  const monthlyIncome = data.incomes
    .filter((i) => budgetMonthOf(i) === month)
    .reduce((s, i) => s + i.amount, 0);

  // Fixed costs that actually applied to THIS month (respecting each cost's
  // start/end window), so past months are never retroactively rewritten when a
  // cost is later cancelled or added.
  const fixedCosts = fixedCostsForMonth(data, month);

  const variableSpending = data.expenses
    .filter((e) => isInMonth(e.date, month) && !NON_VARIABLE_SPENDING_CATEGORIES.has(e.category))
    .reduce((s, e) => s + e.amount, 0);

  const remainingAfterFixed = monthlyIncome - fixedCosts;
  const remainingMoney = remainingAfterFixed - variableSpending;

  // The savings goal is set aside up front: everything "safe to spend" is
  // computed from what's left after it. No goal = spend-to-zero.
  const savingsGoal = Math.max(0, data.savingsGoal ?? 0);
  const spendableRemaining = remainingMoney - savingsGoal;

  // Safe-to-spend: spread what's left across the days that remain.
  // When the month is over (daysLeft === 0) we just surface the leftover number.
  // The weekly limit is the daily pace over the next 7 days (or fewer if the
  // month ends sooner), so the daily and weekly numbers always agree.
  const safeToSpendPerDay =
    daysLeft > 0 ? spendableRemaining / daysLeft : spendableRemaining;
  const weeklyLimit =
    daysLeft > 0 ? safeToSpendPerDay * Math.min(7, daysLeft) : spendableRemaining;

  // Pace: are we burning the variable budget faster than time is passing?
  const variableBudget = Math.max(0, remainingAfterFixed - savingsGoal);
  const pctVariableUsed = variableBudget > 0 ? variableSpending / variableBudget : 0;
  const expectedPaceFraction = totalDays > 0 ? daysElapsed / totalDays : 0;
  const dailyPace = daysElapsed > 0 ? variableSpending / daysElapsed : 0;
  const projectedVariable = isFutureMonth ? variableSpending : dailyPace * totalDays;
  const projectedRemaining = monthlyIncome - fixedCosts - projectedVariable;

  // Net worth.
  const bank = totalBank(data);
  const debt = totalDebt(data);

  return {
    month,
    monthlyIncome,
    fixedCosts,
    variableSpending,
    remainingAfterFixed,
    remainingMoney,
    savingsGoal,
    spendableRemaining,
    totalDays,
    daysElapsed,
    daysLeft,
    weeksLeft,
    safeToSpendPerDay,
    weeklyLimit,
    variableBudget,
    pctVariableUsed,
    expectedPaceFraction,
    dailyPace,
    projectedVariable,
    projectedRemaining,
    totalBank: bank,
    totalDebt: debt,
    realNetWorth: bank - debt,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
  };
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export type WarningLevel = 'danger' | 'warning' | 'info' | 'safe';

export interface WarningItem {
  level: WarningLevel;
  title: string;
  message: string;
}

/**
 * Turn the raw numbers into the human warnings described in the brief.
 * Ordered roughly by severity so the dashboard shows the scariest first.
 */
export function computeWarnings(
  data: AppData,
  s: MonthSummary,
  now: Date = new Date(),
): WarningItem[] {
  const out: WarningItem[] = [];

  // 1. Projected end-of-month balance negative -> red.
  if (s.monthlyIncome > 0 && s.projectedRemaining < 0 && !s.isPastMonth) {
    out.push({
      level: 'danger',
      title: 'Projected to end the month in the red',
      message: `At your current pace you are heading for about ${eur(
        s.projectedRemaining,
      )} left at month end. Slow down or add income.`,
    });
  }

  // Already overspent the month (variable spend > what income could cover).
  if (s.monthlyIncome > 0 && s.remainingMoney < 0) {
    out.push({
      level: 'danger',
      title: 'You have overspent this month',
      message: `Income minus fixed costs minus spending is ${eur(
        s.remainingMoney,
      )}. You are dipping into savings or borrowed money.`,
    });
  }

  // Savings goal at risk: still money left, but less than the goal...
  if (
    s.savingsGoal > 0 &&
    s.monthlyIncome > 0 &&
    s.remainingMoney >= 0 &&
    s.remainingMoney < s.savingsGoal
  ) {
    out.push({
      level: 'warning',
      title: 'You are eating into your savings goal',
      message: `Only ${eur(s.remainingMoney)} is left, but your savings goal is ${eur(
        s.savingsGoal,
      )}. Every further euro spent comes out of your savings.`,
    });
  } else if (
    // ...or current pace projects to land below it at month end.
    s.savingsGoal > 0 &&
    s.monthlyIncome > 0 &&
    s.isCurrentMonth &&
    s.projectedRemaining >= 0 &&
    s.projectedRemaining < s.savingsGoal
  ) {
    out.push({
      level: 'warning',
      title: 'On pace to miss your savings goal',
      message: `At your current pace about ${eur(
        s.projectedRemaining,
      )} will be left at month end - short of your ${eur(s.savingsGoal)} savings goal.`,
    });
  }

  // 2. Fixed costs > 70% of income.
  if (s.monthlyIncome > 0 && s.fixedCosts / s.monthlyIncome > 0.7) {
    out.push({
      level: 'danger',
      title: 'Fixed costs are dangerously high',
      message: `Your fixed costs are ${pct(
        s.fixedCosts / s.monthlyIncome,
      )} of your income. Your fixed costs are dangerously high compared to your income.`,
    });
  }

  // 3. Spending too fast (pace).
  if (
    s.isCurrentMonth &&
    s.variableBudget > 0 &&
    s.pctVariableUsed > s.expectedPaceFraction + 0.1 &&
    s.remainingMoney >= 0
  ) {
    out.push({
      level: 'warning',
      title: 'You are spending too fast',
      message: `You have used ${pct(s.pctVariableUsed)} of your variable budget but only ${pct(
        s.expectedPaceFraction,
      )} of the month has passed.`,
    });
  }

  // 4. Tight month: < €250 left after fixed costs.
  if (s.monthlyIncome > 0 && s.remainingAfterFixed < 250) {
    out.push({
      level: 'warning',
      title: 'Very tight month',
      message: `Only ${eur(
        s.remainingAfterFixed,
      )} is left after fixed costs. Very tight month - avoid non-essential spending.`,
    });
  }

  // 5. Bank balance includes borrowed money.
  if (s.totalDebt > 0) {
    const heavy = s.realNetWorth < s.totalBank * 0.6;
    out.push({
      level: heavy ? 'warning' : 'info',
      title: 'Your bank balance includes borrowed money',
      message: `Your accounts hold ${eur(s.totalBank)}, but after ${eur(
        s.totalDebt,
      )} of debt your real money is only ${eur(s.realNetWorth)}.`,
    });
  }

  // 6. Upcoming fixed-cost debit reminders (e.g. health insurance on the 15th).
  if (s.isCurrentMonth) {
    for (const f of data.fixedCosts) {
      if (!f.paymentDay || !isFixedCostInMonth(f, s.month)) continue;
      const daysUntil = f.paymentDay - now.getDate();
      if (daysUntil >= 0 && daysUntil <= 5) {
        out.push({
          level: 'info',
          title:
            daysUntil === 0
              ? `${f.name} is debited today`
              : `${f.name} debits in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          message: `${eur(f.amount)} for ${f.name} will be debited on the ${ordinal(
            f.paymentDay,
          )}. Keep it in your account.`,
        });
      }
    }
  }

  // No income entered yet for a current/future month.
  if (s.monthlyIncome === 0 && !s.isPastMonth) {
    out.push({
      level: 'info',
      title: 'No income entered for this month',
      message:
        'Add your income for this month so the safe-to-spend numbers can be calculated.',
    });
  }

  // If nothing fired, reassure.
  if (out.length === 0 && s.monthlyIncome > 0) {
    out.push({
      level: 'safe',
      title: 'You are on track',
      message: `You have ${eur(s.spendableRemaining)} left to spend this month${
        s.savingsGoal > 0 ? ` (with ${eur(s.savingsGoal)} set aside for savings)` : ''
      } - about ${eur(s.safeToSpendPerDay)} per day.`,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Plain-language advice (the "don't just show numbers" requirement)
// ---------------------------------------------------------------------------

export function computeAdvice(s: MonthSummary): string[] {
  const tips: string[] = [];

  if (s.monthlyIncome > 0) {
    tips.push(
      `Your fixed costs are ${eur(s.fixedCosts)}, which is about ${pct(
        s.fixedCosts / s.monthlyIncome,
      )} of your monthly income.`,
    );
  } else {
    tips.push(`Your fixed costs are ${eur(s.fixedCosts)} per month.`);
  }

  if (s.daysLeft > 0 && s.monthlyIncome > 0) {
    tips.push(
      `You can spend about ${eur(s.safeToSpendPerDay)} per day for the rest of this month (${eur(
        s.weeklyLimit,
      )} per week).`,
    );
  }

  if (s.variableBudget > 0) {
    tips.push(
      `You have already spent ${pct(s.pctVariableUsed)} of your variable budget (${eur(
        s.variableSpending,
      )} of ${eur(s.variableBudget)}).`,
    );
  }

  if (s.savingsGoal > 0 && s.monthlyIncome > 0) {
    tips.push(
      s.remainingMoney >= s.savingsGoal
        ? `${eur(s.savingsGoal)} is set aside for savings this month - the safe-to-spend numbers already account for it.`
        : `Your ${eur(s.savingsGoal)} savings goal is no longer fully covered: only ${eur(
            Math.max(0, s.remainingMoney),
          )} is left in the month.`,
    );
  }

  if (s.totalDebt > 0) {
    tips.push(
      `Your total bank balance looks high (${eur(
        s.totalBank,
      )}), but after subtracting your debt your real net money is only ${eur(
        s.realNetWorth,
      )}.`,
    );
  }

  return tips;
}

// ---------------------------------------------------------------------------
// Spending grouped by category (for the chart)
// ---------------------------------------------------------------------------

export interface CategoryTotal {
  category: string;
  amount: number;
}

export function spendingByCategory(data: AppData, month: string): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const e of data.expenses) {
    if (!isInMonth(e.date, month) || NON_VARIABLE_SPENDING_CATEGORIES.has(e.category)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Suggested savings goal
// ---------------------------------------------------------------------------
// A pragmatic take on the classic "save 20% of income" rule for people whose
// fixed costs eat a big share of it: suggest 20% of what is typically LEFT
// after fixed costs, averaged over recent months of income, rounded to €5.

const SAVINGS_LOOKBACK = 6; // scan up to this many months (incl. selected)...
const SAVINGS_MONTHS = 3; // ...for up to this many months with income
const SAVINGS_RATE = 0.2;

export interface SavingsSuggestion {
  amount: number; // suggested goal; 0 = nothing sensible to suggest
  monthsUsed: number;
  avgIncome: number;
  avgAfterFixed: number;
}

export function suggestSavingsGoal(data: AppData, month: string): SavingsSuggestion {
  const incomes: number[] = [];
  let probe = month; // the selected month counts too, then walk backwards
  for (let i = 0; i < SAVINGS_LOOKBACK && incomes.length < SAVINGS_MONTHS; i++) {
    const total = data.incomes
      .filter((inc) => budgetMonthOf(inc) === probe)
      .reduce((s, inc) => s + inc.amount, 0);
    if (total > 0) incomes.push(total);
    probe = addMonths(probe, -1);
  }
  if (incomes.length === 0) {
    return { amount: 0, monthsUsed: 0, avgIncome: 0, avgAfterFixed: 0 };
  }
  const avgIncome = incomes.reduce((s, v) => s + v, 0) / incomes.length;
  const avgAfterFixed = avgIncome - totalFixedCosts(data);
  const rounded = Math.floor((Math.max(0, avgAfterFixed) * SAVINGS_RATE) / 5) * 5;
  return {
    amount: rounded >= 10 ? rounded : 0, // below €10 a goal is just noise
    monthsUsed: incomes.length,
    avgIncome,
    avgAfterFixed,
  };
}

// ---------------------------------------------------------------------------
// Recommended category budgets
// ---------------------------------------------------------------------------
// Split this month's variable budget across spending categories. With enough
// history the split mirrors how the user actually spends; before that, a
// sensible default split is used. Needs are protected: when a typical month
// doesn't fit the budget, the wants are scaled down first.

// Categories that are not variable spending behaviour, so never budgeted here:
// transfers just move money between own accounts, and rent / health insurance
// belong in the fixed-costs ledger.
const NON_BUDGET_CATEGORIES = NON_VARIABLE_SPENDING_CATEGORIES;

// Needs survive a tight month; every other category is a want and is cut first.
const NEED_CATEGORIES = new Set([
  'groceries',
  'transport',
  'pharmacy/health',
  'university',
  'household',
]);

// Default split of the variable budget, used until enough history exists.
// (University is left out on purpose: semester fees are too lumpy to guess.)
const DEFAULT_SHARES: Record<string, number> = {
  groceries: 0.4,
  'eating out': 0.12,
  transport: 0.1,
  household: 0.08,
  social: 0.08,
  'pharmacy/health': 0.05,
  clothes: 0.05,
  subscriptions: 0.04,
  gym: 0.03,
  phone: 0.03,
  other: 0.02,
};

const HISTORY_LOOKBACK = 6; // scan up to this many past months...
const HISTORY_MONTHS = 3; // ...for up to this many months with expenses
const MIN_HISTORY_MONTHS = 2; // fewer than this -> fall back to DEFAULT_SHARES

export type CategoryBudgetStatus = 'over' | 'fast' | 'ok';

export interface CategoryBudget {
  category: string;
  isNeed: boolean;
  budget: number; // recommended amount for this month
  spent: number; // spent so far this month
  remaining: number; // budget - spent (negative = over)
  status: CategoryBudgetStatus;
}

export interface CategoryBudgetPlan {
  budgets: CategoryBudget[];
  fromHistory: boolean; // true when based on the user's own past months
  monthsOfHistory: number;
  unallocated: number; // part of the variable budget left as buffer
}

/** Variable spending per category for one month, skipping non-budget categories. */
function budgetableSpend(data: AppData, month: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of data.expenses) {
    if (!isInMonth(e.date, month) || NON_BUDGET_CATEGORIES.has(e.category)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return map;
}

export function computeCategoryBudgets(data: AppData, s: MonthSummary): CategoryBudgetPlan {
  // 1. Gather history: the closest past months that actually have expenses.
  const histTotals = new Map<string, number>();
  let monthsOfHistory = 0;
  let probe = s.month;
  for (let i = 0; i < HISTORY_LOOKBACK && monthsOfHistory < HISTORY_MONTHS; i++) {
    probe = addMonths(probe, -1);
    const spend = budgetableSpend(data, probe);
    if (spend.size === 0) continue;
    monthsOfHistory++;
    for (const [cat, amount] of spend) {
      histTotals.set(cat, (histTotals.get(cat) ?? 0) + amount);
    }
  }
  const fromHistory = monthsOfHistory >= MIN_HISTORY_MONTHS;

  // 2. The "typical" month: historical averages, or default shares of the budget.
  const typical = new Map<string, number>();
  if (fromHistory) {
    for (const [cat, total] of histTotals) typical.set(cat, total / monthsOfHistory);
  } else {
    for (const [cat, share] of Object.entries(DEFAULT_SHARES)) {
      typical.set(cat, share * s.variableBudget);
    }
  }

  // 3. Fit the typical month into this month's variable budget. Needs keep
  //    their typical amount as long as possible; wants absorb the squeeze.
  let needTotal = 0;
  let wantTotal = 0;
  for (const [cat, amount] of typical) {
    if (NEED_CATEGORIES.has(cat)) needTotal += amount;
    else wantTotal += amount;
  }
  let needScale = 1;
  let wantScale = 1;
  if (needTotal + wantTotal > s.variableBudget) {
    if (needTotal >= s.variableBudget) {
      needScale = needTotal > 0 ? s.variableBudget / needTotal : 0;
      wantScale = 0;
    } else {
      wantScale = wantTotal > 0 ? (s.variableBudget - needTotal) / wantTotal : 0;
    }
  }

  // 4. Build the rows: every typical category plus anything spent this month.
  const spentNow = budgetableSpend(data, s.month);
  const categories = new Set([...typical.keys(), ...spentNow.keys()]);
  const budgets: CategoryBudget[] = [];
  for (const category of categories) {
    const isNeed = NEED_CATEGORIES.has(category);
    const budget = (typical.get(category) ?? 0) * (isNeed ? needScale : wantScale);
    const spent = spentNow.get(category) ?? 0;
    if (budget < 0.5 && spent === 0) continue; // nothing to say about this one

    let status: CategoryBudgetStatus = 'ok';
    if (spent > budget) {
      status = 'over';
    } else if (
      s.isCurrentMonth &&
      budget > 0 &&
      spent / budget > s.expectedPaceFraction + 0.15
    ) {
      status = 'fast';
    }
    budgets.push({ category, isNeed, budget, spent, remaining: budget - spent, status });
  }
  budgets.sort((a, b) => b.budget - a.budget || b.spent - a.spent);

  const allocated = budgets.reduce((sum, b) => sum + b.budget, 0);
  return {
    budgets,
    fromHistory,
    monthsOfHistory,
    unallocated: Math.max(0, s.variableBudget - allocated),
  };
}

// ---------------------------------------------------------------------------
// Panic Mode
// ---------------------------------------------------------------------------
// When money is scary, strip everything down to the four questions that matter.

export interface PanicInfo {
  rent: FixedCost | undefined;
  health: FixedCost | undefined;
  afterEssentials: number; // income - rent - health insurance
  weeklyFoodBudget: number; // safe weekly spend (prioritise food in panic mode)
  dailyFoodBudget: number;
  cutFirst: FixedCost[]; // optional/active costs, biggest first
  cutFirstTotal: number;
  touchingBorrowed: boolean;
  realNetWorth: number;
  borrowedMessage: string;
}

function findFixed(data: AppData, keyword: string, month: string): FixedCost | undefined {
  return data.fixedCosts.find(
    (f) => isFixedCostInMonth(f, month) && f.name.toLowerCase().includes(keyword),
  );
}

export function computePanic(data: AppData, s: MonthSummary): PanicInfo {
  const rent = findFixed(data, 'rent', s.month);
  const health = findFixed(data, 'health', s.month) ?? findFixed(data, 'insurance', s.month);

  const afterEssentials =
    s.monthlyIncome - (rent?.amount ?? 0) - (health?.amount ?? 0);

  // In panic mode, almost everything optional is cut and saving is paused -
  // every remaining euro goes to surviving the month, so the food budget is
  // computed from remainingMoney (ignoring the savings goal). Never negative.
  const dailyFoodBudget =
    s.daysLeft > 0 ? Math.max(0, s.remainingMoney / s.daysLeft) : Math.max(0, s.remainingMoney);
  const weeklyFoodBudget =
    s.daysLeft > 0 ? dailyFoodBudget * Math.min(7, s.daysLeft) : Math.max(0, s.remainingMoney);

  const cutFirst = data.fixedCosts
    .filter((f) => isFixedCostInMonth(f, s.month) && !f.essential)
    .sort((a, b) => b.amount - a.amount);
  const cutFirstTotal = cutFirst.reduce((sum, f) => sum + f.amount, 0);

  // Are you spending money that is really your aunt's?
  const touchingBorrowed = s.realNetWorth <= 0 || s.remainingMoney < 0;
  let borrowedMessage: string;
  if (s.totalDebt <= 0) {
    borrowedMessage = 'You have no tracked debt - all the money in your accounts is really yours.';
  } else if (s.realNetWorth <= 0) {
    borrowedMessage = `Yes. Your real money is ${eur(
      s.realNetWorth,
    )} - every euro you spend now is borrowed money.`;
  } else if (s.remainingMoney < 0) {
    borrowedMessage = `This month you are overspending by ${eur(
      Math.abs(s.remainingMoney),
    )}, which eats into your ${eur(s.realNetWorth)} of real money and toward borrowed funds.`;
  } else {
    borrowedMessage = `Not yet. You have ${eur(
      s.realNetWorth,
    )} of real money. Spending more than that means using borrowed money.`;
  }

  return {
    rent,
    health,
    afterEssentials,
    weeklyFoodBudget,
    dailyFoodBudget,
    cutFirst,
    cutFirstTotal,
    touchingBorrowed,
    realNetWorth: s.realNetWorth,
    borrowedMessage,
  };
}
