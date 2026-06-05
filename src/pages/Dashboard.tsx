import { useMemo } from 'react';
import { useStore } from '../store';
import {
  computeAdvice,
  computeMonthSummary,
  computeWarnings,
  spendingByCategory,
} from '../lib/calculations';
import { eur } from '../lib/format';
import { Card, Stat, WarningCard } from '../components/ui';
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

  const remainingTone =
    summary.remainingMoney < 0
      ? 'danger'
      : summary.remainingMoney < 250
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
                <div className="big">{eur(Math.max(0, summary.remainingMoney))}</div>
                <div className="hero-sub">
                  {summary.daysLeft > 0
                    ? `About ${eur(summary.safeToSpendPerDay)} per day · ${eur(summary.weeklyLimit)} per week · ${summary.daysLeft} days left (incl. today)`
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
