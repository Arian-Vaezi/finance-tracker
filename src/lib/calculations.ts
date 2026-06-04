// ===========================================================================
// Finance engine
// ===========================================================================
// This file contains ALL the money math. Nothing here touches React or the DOM,
// which makes the formulas easy to read, reason about and test.
//
// Quick glossary of the core formulas (for the selected month):
//
//   monthly_income        = sum of income entries dated in the month
//   fixed_costs           = sum of ACTIVE fixed monthly costs
//   variable_spending     = sum of expense entries dated in the month
//                           (fixed costs live in their own ledger, so they are
//                            never double-counted here)
//   remaining_after_fixed = monthly_income - fixed_costs
//   remaining_money       = monthly_income - fixed_costs - variable_spending
//   days_left             = days remaining in the month, including today
//   safe_to_spend_per_day = remaining_money / days_left
//   weekly_limit          = remaining_money / weeks_left
//
//   total_bank   = sum of account balances
//   total_debt   = sum of (borrowed - repaid) for each debt
//   real_net     = total_bank - total_debt   <- your actual free money
// ===========================================================================

import { AppData, FixedCost, IncomeEntry } from '../types';
import { daysInMonth, eur, isInMonth, ordinal, pct, currentMonth } from './format';

/**
 * The month an income counts toward in the budget: its explicit `budgetMonth`,
 * or the month of its date when none is set. This is how income earned one month
 * but spent the next (Gig early payouts) lands in the right month.
 */
export function budgetMonthOf(i: IncomeEntry): string {
  return i.budgetMonth ?? i.date.slice(0, 7);
}

export interface MonthSummary {
  month: string;

  // Core money figures
  monthlyIncome: number;
  fixedCosts: number;
  variableSpending: number;
  remainingAfterFixed: number;
  remainingMoney: number;

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

/** Sum of active fixed costs. */
export function totalFixedCosts(data: AppData): number {
  return data.fixedCosts
    .filter((f) => f.active)
    .reduce((s, f) => s + f.amount, 0);
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
  // Gig early payout received this month but earmarked for next month counts
  // toward next month's budget.
  const monthlyIncome = data.incomes
    .filter((i) => budgetMonthOf(i) === month)
    .reduce((s, i) => s + i.amount, 0);

  const fixedCosts = totalFixedCosts(data);

  const variableSpending = data.expenses
    .filter((e) => isInMonth(e.date, month))
    .reduce((s, e) => s + e.amount, 0);

  const remainingAfterFixed = monthlyIncome - fixedCosts;
  const remainingMoney = remainingAfterFixed - variableSpending;

  // Safe-to-spend: spread what's left across the days/weeks that remain.
  // When the month is over (daysLeft === 0) we just surface the leftover number.
  const safeToSpendPerDay = daysLeft > 0 ? remainingMoney / daysLeft : remainingMoney;
  const weeklyLimit = weeksLeft > 0 ? remainingMoney / weeksLeft : remainingMoney;

  // Pace: are we burning the variable budget faster than time is passing?
  const variableBudget = Math.max(0, remainingAfterFixed);
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
      if (!f.active || !f.paymentDay) continue;
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
      message: `You have ${eur(
        s.remainingMoney,
      )} left for the rest of the month - about ${eur(s.safeToSpendPerDay)} per day.`,
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
    if (!isInMonth(e.date, month)) continue;
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
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

function findFixed(data: AppData, keyword: string): FixedCost | undefined {
  return data.fixedCosts.find(
    (f) => f.active && f.name.toLowerCase().includes(keyword),
  );
}

export function computePanic(data: AppData, s: MonthSummary): PanicInfo {
  const rent = findFixed(data, 'rent');
  const health = findFixed(data, 'health') ?? findFixed(data, 'insurance');

  const afterEssentials =
    s.monthlyIncome - (rent?.amount ?? 0) - (health?.amount ?? 0);

  // In panic mode, almost everything optional is cut, so the weekly safe-spend
  // is effectively the food budget. Never suggest a negative number.
  const weeklyFoodBudget = Math.max(0, s.weeklyLimit);
  const dailyFoodBudget = Math.max(0, s.safeToSpendPerDay);

  const cutFirst = data.fixedCosts
    .filter((f) => f.active && !f.essential)
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
