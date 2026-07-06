import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import {
  budgetMonthOfExpense,
  budgetMonthOf,
  computeAdvice,
  computeCategoryBudgets,
  computeMonthSummary,
  computeWarnings,
  spendingByCategory,
} from '../lib/calculations';
import { eur, formatDate, pct, todayISO } from '../lib/format';
import { Badge, Card, ProgressBar, Stat, WarningCard } from '../components/ui';
import { BarList, ProportionBar } from '../components/charts';
import { ExpenseDialog, emptyExpenseDraft } from '../components/TransactionDialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Month pulse: the one-glance answer to "am I ahead of the month or behind?"
// Fill = share of the variable budget used; tick = share of the month passed.
// ---------------------------------------------------------------------------

function MonthPulse({
  usedFraction,
  paceFraction,
  showPace,
}: {
  usedFraction: number;
  paceFraction: number;
  showPace: boolean;
}) {
  const used = Math.max(0, Math.min(1, usedFraction));
  const pace = Math.max(0, Math.min(1, paceFraction));
  const tone =
    usedFraction > 1
      ? 'bg-destructive'
      : usedFraction > paceFraction + 0.1
        ? 'bg-warning'
        : 'bg-success';
  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width]', tone)}
          style={{ width: `${used * 100}%` }}
        />
        {showPace && (
          <div
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-foreground/60"
            style={{ left: `calc(${pace * 100}% - 1px)` }}
          />
        )}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {pct(Math.min(usedFraction, 9.99))} of budget used
        {showPace && <> · {pct(paceFraction)} of the month passed (marker)</>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, selectedMonth, addExpense } = useStore();
  const [adding, setAdding] = useState(false);

  const summary = useMemo(
    () => computeMonthSummary(data, selectedMonth),
    [data, selectedMonth],
  );
  const warnings = useMemo(() => computeWarnings(data, summary), [data, summary]);
  const advice = useMemo(() => computeAdvice(summary), [summary]);
  const categories = useMemo(
    () => spendingByCategory(data, selectedMonth),
    [data, selectedMonth],
  );
  const budgetPlan = useMemo(
    () => computeCategoryBudgets(data, summary),
    [data, summary],
  );

  // Latest movements of the selected month: expenses and income interleaved.
  const recent = useMemo(() => {
    const accountName = (id?: string) =>
      data.accounts.find((a) => a.id === id)?.name ?? '—';
    const rows = [
      ...data.expenses
        .filter((e) => budgetMonthOfExpense(e) === selectedMonth)
        .map((e) => ({
          id: e.id,
          date: e.date,
          label: e.category,
          account: accountName(e.accountId),
          amount: -e.amount,
          deferred: budgetMonthOfExpense(e) !== e.date.slice(0, 7),
        })),
      ...data.incomes
        .filter((i) => budgetMonthOf(i) === selectedMonth)
        .map((i) => ({
          id: i.id,
          date: i.date,
          label: i.source,
          account: accountName(i.accountId),
          amount: i.amount,
          deferred: false,
        })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [data, selectedMonth]);

  const spendable = summary.spendableRemaining;
  const overBy = spendable < 0 ? -spendable : 0;

  const remainingTone =
    spendable < 0 ? 'danger' : spendable < 250 ? 'warning' : 'safe';

  // No income entered yet for a current/future month: safe-to-spend is undefined,
  // not zero. Show a prompt instead of a misleading €0.
  const noIncome = summary.monthlyIncome === 0 && !summary.isPastMonth;

  const defaultAccount = data.accounts[0]?.id ?? '';

  return (
    <div className="flex flex-col gap-4">
      {/* Hero: the two numbers that matter most */}
      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Safe to spend · rest of {summary.isCurrentMonth ? 'this month' : 'the month'}
          </div>
          {noIncome ? (
            <>
              <div className="mt-1 text-4xl font-semibold tracking-tight">—</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Add this month's income to calculate your safe-to-spend.
              </p>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'mt-1 text-4xl font-semibold tracking-tight',
                  spendable < 0 && 'text-destructive',
                )}
              >
                {eur(Math.max(0, spendable))}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {summary.daysLeft > 0 ? (
                  <>
                    About {eur(Math.max(0, summary.safeToSpendPerDay))} per day ·{' '}
                    {eur(Math.max(0, summary.weeklyLimit))} per week · {summary.daysLeft}{' '}
                    days left
                    {summary.savingsGoal > 0 && (
                      <> · {eur(summary.savingsGoal)} set aside for savings</>
                    )}
                  </>
                ) : (
                  'This month is over.'
                )}
              </p>
              {overBy > 0 && (
                <p className="mt-1.5 text-sm font-medium text-destructive">
                  {summary.remainingMoney < 0
                    ? `${eur(overBy)} over this month's income — that came out of savings.`
                    : `${eur(overBy)} into your savings goal — the goal is no longer fully covered.`}
                </p>
              )}
              {summary.variableBudget > 0 && (
                <div className="mt-4">
                  <MonthPulse
                    usedFraction={summary.pctVariableUsed}
                    paceFraction={summary.expectedPaceFraction}
                    showPace={summary.isCurrentMonth}
                  />
                </div>
              )}
            </>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Real net money · after debt
          </div>
          <div
            className={cn(
              'mt-1 text-4xl font-semibold tracking-tight',
              summary.realNetWorth < 0 && 'text-destructive',
            )}
          >
            {eur(summary.realNetWorth)}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {eur(summary.totalBank)} in accounts − {eur(summary.totalDebt)} debt
          </p>
        </Card>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          value={noIncome ? '—' : eur(Math.max(0, summary.safeToSpendPerDay))}
          tone={noIncome ? 'neutral' : remainingTone}
          hint={spendable < 0 ? 'budget used up' : undefined}
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
        <Stat
          label="Total debt"
          value={eur(summary.totalDebt)}
          tone={summary.totalDebt > 0 ? 'warning' : 'neutral'}
        />
        <Stat
          label="Real net worth"
          value={eur(summary.realNetWorth)}
          tone={summary.realNetWorth < 0 ? 'danger' : 'neutral'}
          hint="bank − debt"
        />
      </div>

      {/* Charts + transactions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Spending by category</h2>
            <BarList
              data={categories.map((c) => ({ label: c.category, value: c.amount }))}
              emptyLabel="No expenses logged for this month yet."
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Income vs. expenses</h2>
            <BarList
              data={[
                { label: 'Income', value: summary.monthlyIncome, color: 'var(--chart-3)' },
                { label: 'Fixed costs', value: summary.fixedCosts, color: 'var(--chart-2)' },
                {
                  label: 'Variable spending',
                  value: summary.variableSpending,
                  color: 'var(--chart-4)',
                },
                {
                  label: 'Total out',
                  value: summary.fixedCosts + summary.variableSpending,
                  color: 'var(--chart-5)',
                },
              ]}
            />
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

        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Recent transactions</h2>
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus data-icon="inline-start" aria-hidden />
                Add expense
              </Button>
            </div>
            {recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing logged for this month yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(r.date)}
                      </TableCell>
                      <TableCell className="capitalize">
                        {r.label}
                        {r.deferred && <Badge tone="info">next month</Badge>}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-medium',
                          r.amount > 0 ? 'text-success' : 'text-foreground',
                        )}
                      >
                        {r.amount > 0 ? `+${eur(r.amount)}` : `−${eur(-r.amount)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold">What this means</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground marker:text-border">
              {advice.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Recommended category budgets */}
      {!noIncome && budgetPlan.budgets.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">Recommended category budgets</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {budgetPlan.fromHistory
              ? `Based on your average spending over the last ${budgetPlan.monthsOfHistory} months, fitted into this month's variable budget of ${eur(summary.variableBudget)}.`
              : `Starter suggestion based on this month's variable budget of ${eur(summary.variableBudget)} — once a couple of months of expenses exist, this adapts to your actual habits.`}
          </p>
          <div className="flex flex-col gap-4">
            {budgetPlan.budgets.map((b) => {
              const tone =
                b.status === 'over' ? 'danger' : b.status === 'fast' ? 'warning' : 'safe';
              const fraction = b.budget > 0 ? b.spent / b.budget : b.spent > 0 ? 1 : 0;
              const weeklyHint =
                summary.isCurrentMonth && summary.daysLeft > 0 && b.remaining > 0
                  ? ` · about ${eur((b.remaining / summary.daysLeft) * Math.min(7, summary.daysLeft))} per week`
                  : '';
              return (
                <div key={b.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="capitalize">
                      {b.category} {b.isNeed && <Badge tone="info">need</Badge>}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {eur(b.spent)} of {eur(b.budget)}
                    </span>
                  </div>
                  <ProgressBar fraction={fraction} tone={tone} />
                  <div className="mt-1 text-xs text-muted-foreground">
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
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              {eur(budgetPlan.unallocated)} of the variable budget is not assigned to any
              category — that is your buffer.
            </p>
          )}
        </Card>
      )}

      {adding && (
        <ExpenseDialog
          initial={emptyExpenseDraft(selectedMonth, defaultAccount, todayISO())}
          title="Add expense"
          accounts={data.accounts}
          onClose={() => setAdding(false)}
          onSave={(draft) => {
            addExpense(draft);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
