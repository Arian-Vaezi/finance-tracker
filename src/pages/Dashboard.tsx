import { useMemo } from 'react';
import { useStore } from '../store';
import {
  computeAdvice,
  computeCategoryBudgets,
  computeMonthSummary,
  computeWarnings,
  spendingByCategory,
} from '../lib/calculations';
import { eur } from '../lib/format';
import { Badge, Card, ProgressBar, Stat, WarningCard } from '../components/ui';
import { BarList, ProportionBar } from '../components/charts';

export default function Dashboard() {
  const { data, selectedMonth } = useStore();

  const summary = useMemo(
    () => computeMonthSummary(data, selectedMonth),
    [data, selectedMonth],
  );
  const warnings = useMemo(
    () => computeWarnings(data, summary),
    [data, summary],
  );
  const advice = useMemo(() => computeAdvice(summary), [summary]);
  const categories = useMemo(
    () => spendingByCategory(data, selectedMonth),
    [data, selectedMonth],
  );
  const budgetPlan = useMemo(
    () => computeCategoryBudgets(data, summary),
    [data, summary],
  );

  const remainingTone =
    summary.spendableRemaining < 0
      ? 'danger'
      : summary.spendableRemaining < 250
        ? 'warning'
        : 'safe';

  // No income entered yet for a current/future month: safe-to-spend is undefined,
  // not zero. Show a prompt instead of a misleading €0.
  const noIncome = summary.monthlyIncome === 0 && !summary.isPastMonth;

  return (
    <div className="stack">
      {/* Hero: the two numbers that matter most */}
      <div className="hero">
        <div className="grid grid-2" style={{ gap: 18 }}>
          <div>
            <div className="stat-label">Safe to spend · rest of {summary.isCurrentMonth ? 'this month' : 'the month'}</div>
            {noIncome ? (
              <>
                <div className="big">—</div>
                <div className="hero-sub">
                  Add this month's income to calculate your safe-to-spend.
                </div>
              </>
            ) : (
              <>
                <div className="big">{eur(Math.max(0, summary.spendableRemaining))}</div>
                <div className="hero-sub">
                  {summary.daysLeft > 0
                    ? `About ${eur(summary.safeToSpendPerDay)} per day · ${eur(summary.weeklyLimit)} per week · ${summary.daysLeft} days left (incl. today)${
                        summary.savingsGoal > 0
                          ? ` · ${eur(summary.savingsGoal)} set aside for savings`
                          : ''
                      }`
                    : 'This month is over.'}
                </div>
              </>
            )}
          </div>
          <div>
            <div className="stat-label">Real net money (after debt)</div>
            <div className="big">{eur(summary.realNetWorth)}</div>
            <div className="hero-sub">
              {eur(summary.totalBank)} in accounts − {eur(summary.totalDebt)} debt
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          {warnings.map((w, i) => (
            <WarningCard key={i} level={w.level} title={w.title} message={w.message} />
          ))}
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-stats">
        <Stat label="Monthly income" value={eur(summary.monthlyIncome)} tone="safe" />
        <Stat
          label="Fixed costs"
          value={eur(summary.fixedCosts)}
          hint={
            summary.monthlyIncome > 0
              ? `${Math.round((summary.fixedCosts / summary.monthlyIncome) * 100)}% of income`
              : undefined
          }
          tone={
            summary.monthlyIncome > 0 && summary.fixedCosts / summary.monthlyIncome > 0.7
              ? 'danger'
              : 'neutral'
          }
        />
        <Stat label="Variable spending" value={eur(summary.variableSpending)} />
        <Stat
          label="Remaining this month"
          value={noIncome ? '—' : eur(summary.remainingMoney)}
          tone={noIncome ? 'neutral' : remainingTone}
          hint="income − fixed − spending"
        />
        <Stat
          label="Safe to spend / day"
          value={noIncome ? '—' : eur(summary.safeToSpendPerDay)}
          tone={noIncome ? 'neutral' : remainingTone}
        />
        {summary.savingsGoal > 0 && (
          <Stat
            label="Savings goal"
            value={eur(summary.savingsGoal)}
            tone={
              noIncome
                ? 'neutral'
                : summary.remainingMoney >= summary.savingsGoal
                  ? 'safe'
                  : 'warning'
            }
            hint="set aside before spending"
          />
        )}
        <Stat label="Total bank balance" value={eur(summary.totalBank)} />
        <Stat label="Total debt" value={eur(summary.totalDebt)} tone={summary.totalDebt > 0 ? 'warning' : 'neutral'} />
        <Stat
          label="Real net worth"
          value={eur(summary.realNetWorth)}
          tone={summary.realNetWorth < 0 ? 'danger' : 'neutral'}
          hint="bank − debt"
        />
      </div>

      {/* Advice */}
      <Card>
        <div className="card-title">What this means</div>
        <ul className="advice-list">
          {advice.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </Card>

      {/* Recommended category budgets */}
      {!noIncome && budgetPlan.budgets.length > 0 && (
        <Card>
          <div className="card-title">Recommended category budgets</div>
          <p className="section-subtitle">
            {budgetPlan.fromHistory
              ? `Based on your average spending over the last ${budgetPlan.monthsOfHistory} months, fitted into this month's variable budget of ${eur(summary.variableBudget)}.`
              : `Starter suggestion based on this month's variable budget of ${eur(summary.variableBudget)} — once a couple of months of expenses exist, this adapts to your actual habits.`}
          </p>
          <div className="barlist">
            {budgetPlan.budgets.map((b) => {
              const tone =
                b.status === 'over' ? 'danger' : b.status === 'fast' ? 'warning' : 'safe';
              const fraction =
                b.budget > 0 ? b.spent / b.budget : b.spent > 0 ? 1 : 0;
              const weeklyHint =
                summary.isCurrentMonth && summary.daysLeft > 0 && b.remaining > 0
                  ? ` · about ${eur((b.remaining / summary.daysLeft) * Math.min(7, summary.daysLeft))} per week`
                  : '';
              return (
                <div className="barlist-row" key={b.category}>
                  <div className="barlist-top">
                    <span className="barlist-label">
                      {b.category} {b.isNeed && <Badge tone="info">need</Badge>}
                    </span>
                    <span className="barlist-value">
                      {eur(b.spent)} of {eur(b.budget)}
                    </span>
                  </div>
                  <ProgressBar fraction={fraction} tone={tone} />
                  <div className="stat-hint">
                    {b.status === 'over'
                      ? `Over by ${eur(b.spent - b.budget)}`
                      : b.status === 'fast'
                        ? `${eur(b.remaining)} left, but you are spending it faster than the month is passing${weeklyHint}`
                        : `${eur(b.remaining)} left${weeklyHint}`}
                  </div>
                </div>
              );
            })}
          </div>
          {budgetPlan.unallocated >= 1 && (
            <>
              <div className="divider" />
              <div className="stat-hint">
                {eur(budgetPlan.unallocated)} of the variable budget is not assigned to any
                category — that is your buffer.
              </div>
            </>
          )}
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-2">
        <Card>
          <div className="card-title">Spending by category</div>
          <BarList
            data={categories.map((c) => ({ label: c.category, value: c.amount }))}
            emptyLabel="No expenses logged for this month yet."
          />
        </Card>

        <Card>
          <div className="card-title">Income vs. expenses</div>
          <BarList
            data={[
              { label: 'Income', value: summary.monthlyIncome, color: '#16a34a' },
              { label: 'Fixed costs', value: summary.fixedCosts, color: '#0ea5e9' },
              { label: 'Variable spending', value: summary.variableSpending, color: '#f59e0b' },
              {
                label: 'Total out',
                value: summary.fixedCosts + summary.variableSpending,
                color: '#ef4444',
              },
            ]}
          />
          <div className="divider" />
          <ProportionBar
            partLabel="Fixed costs vs. income"
            part={summary.fixedCosts}
            whole={summary.monthlyIncome}
          />
          {summary.variableBudget > 0 && (
            <ProportionBar
              partLabel="Variable budget used"
              part={summary.variableSpending}
              whole={summary.variableBudget}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
