import { useMemo } from 'react';
import { useStore } from '../store';
import { computeMonthSummary, computePanic } from '../lib/calculations';
import { eur, monthLabel } from '../lib/format';
import { Card, EmptyState } from '../components/ui';

export default function PanicMode() {
  const { data, selectedMonth } = useStore();
  const summary = useMemo(
    () => computeMonthSummary(data, selectedMonth),
    [data, selectedMonth],
  );
  const panic = useMemo(() => computePanic(data, summary), [data, summary]);

  return (
    <div className="stack">
      <div className="hero">
        <div className="stat-label">Panic Mode · {monthLabel(selectedMonth)}</div>
        <div className="big">{eur(Math.max(0, panic.afterEssentials))}</div>
        <div className="hero-sub">
          left after rent ({eur(panic.rent?.amount ?? 0)}) and health insurance (
          {eur(panic.health?.amount ?? 0)})
        </div>
      </div>

      <div className="grid grid-2">
        {/* 1. Food budget */}
        <Card>
          <div className="card-title">🍞 Food this week</div>
          <div className="stat-value" style={{ fontSize: 30 }}>
            {eur(panic.weeklyFoodBudget)}
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            That is about <strong>{eur(panic.dailyFoodBudget)}</strong> per day. In Panic Mode,
            spend this on food and essentials only — no eating out, no extras.
          </p>
        </Card>

        {/* 2. Borrowed money check */}
        <Card accent={panic.touchingBorrowed ? 'danger' : 'safe'}>
          <div className="card-title">
            {panic.touchingBorrowed ? '⛔ Borrowed money' : '✅ Borrowed money'}
          </div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: panic.realNetWorth < 0 ? 'var(--danger)' : 'var(--text)',
            }}
          >
            {eur(panic.realNetWorth)} real money
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            {panic.borrowedMessage}
          </p>
        </Card>
      </div>

      {/* 3. What to cut first */}
      <Card>
        <div className="card-title">✂️ Cut these first</div>
        {panic.cutFirst.length === 0 ? (
          <EmptyState>
            No optional costs are active. Mark any non-essential fixed cost as “optional” in the
            Fixed costs tab so it shows up here.
          </EmptyState>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12, fontSize: 13.5 }}>
              Cancelling these optional costs would free up{' '}
              <strong>{eur(panic.cutFirstTotal)}</strong> per month:
            </p>
            <div className="item-list">
              {panic.cutFirst.map((f, idx) => (
                <div className="item" key={f.id}>
                  <div className="item-main">
                    <div className="item-title">
                      {idx + 1}. {f.name}
                    </div>
                    <div className="item-sub">Optional monthly cost</div>
                  </div>
                  <div className="item-amount amount-neg">{eur(f.amount)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Bottom line */}
      <Card accent={summary.remainingMoney < 0 ? 'danger' : 'safe'}>
        <div className="card-title">📌 Bottom line</div>
        <ul className="advice-list">
          <li>
            After rent and health insurance you have{' '}
            <strong>{eur(panic.afterEssentials)}</strong> for everything else this month.
          </li>
          <li>
            Keep food + essentials under <strong>{eur(panic.weeklyFoodBudget)}</strong> this week.
          </li>
          <li>
            Cutting optional subscriptions saves <strong>{eur(panic.cutFirstTotal)}</strong> per
            month.
          </li>
          <li>{panic.borrowedMessage}</li>
        </ul>
      </Card>
    </div>
  );
}
