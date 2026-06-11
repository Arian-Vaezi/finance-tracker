import { useMemo, useRef, useState } from 'react';
import { useStore, isValidAppData } from '../store';
import { exportBackupJSON, exportTransactionsCSV } from '../lib/csv';
import { suggestSavingsGoal } from '../lib/calculations';
import { currentMonth, eur } from '../lib/format';
import { Button, Card, ConfirmButton, Field, SectionHeader, Segmented } from '../components/ui';
import { AccountSync } from '../components/AccountSync';

export default function Settings() {
  const { data, mode, setMode, replaceData, resetDemoData, clearAllData, setSavingsGoal } =
    useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const suggestion = useMemo(() => suggestSavingsGoal(data, currentMonth()), [data]);

  const counts = {
    income: data.incomes.length,
    expenses: data.expenses.length,
    fixed: data.fixedCosts.length,
    accounts: data.accounts.length,
    debts: data.debts.length,
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isValidAppData(parsed)) {
          setMessage({ tone: 'err', text: 'That file is not a valid Finance Tracker backup.' });
          return;
        }
        replaceData(parsed);
        setMessage({
          tone: 'ok',
          text: `Backup imported into ${mode === 'demo' ? 'Demo' : 'Personal'} mode.`,
        });
      } catch {
        setMessage({ tone: 'err', text: 'Could not read that file — is it valid JSON?' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="stack">
      <SectionHeader
        title="Data & settings"
        subtitle="Everything is stored only in this browser (localStorage). Nothing is uploaded."
      />

      {/* Mode */}
      <Card>
        <div className="card-title">Mode</div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'personal', label: 'Personal' },
            { value: 'demo', label: 'Demo' },
          ]}
        />
        <p className="muted" style={{ fontSize: 13.5, marginTop: 12 }}>
          <strong>Personal</strong> keeps your own data privately in this browser.{' '}
          <strong>Demo</strong> shows fictional example data for sharing or screenshots. The two
          datasets are stored separately and never mix.
        </p>
      </Card>

      {/* Savings goal */}
      <Card>
        <div className="card-title">Monthly savings goal</div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          Set an amount to put aside every month <strong>before</strong> spending. The
          safe-to-spend numbers and category budgets are calculated from what's left after this
          goal. Leave it at 0 to plan with every euro spendable.
        </p>
        <Field label="Amount per month (€)">
          <input
            type="number"
            min={0}
            step={10}
            value={data.savingsGoal ?? ''}
            placeholder="0"
            onChange={(e) => {
              const n = Number(e.target.value);
              setSavingsGoal(Number.isFinite(n) ? n : 0);
            }}
          />
        </Field>
        {suggestion.amount > 0 && suggestion.amount !== (data.savingsGoal ?? 0) && (
          <>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 12, marginBottom: 10 }}>
              Suggested for you: <strong>{eur(suggestion.amount)}</strong> — about 20% of
              what's typically left after fixed costs ({eur(suggestion.avgAfterFixed)},
              averaged over {suggestion.monthsUsed}{' '}
              {suggestion.monthsUsed === 1 ? 'month' : 'months'} of income). Saving a share
              of what you can actually spare beats a fixed rule when income varies.
            </p>
            <Button variant="secondary" onClick={() => setSavingsGoal(suggestion.amount)}>
              Use {eur(suggestion.amount)}
            </Button>
          </>
        )}
      </Card>

      {/* Account & cloud sync */}
      <AccountSync />

      {/* Export */}
      <Card>
        <div className="card-title">Export</div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          Download the active dataset to keep a copy or open it in Excel / Google Sheets.
        </p>
        <div className="btn-row">
          <Button variant="secondary" onClick={() => exportTransactionsCSV(data)}>
            ⬇️ Export transactions (CSV)
          </Button>
          <Button variant="secondary" onClick={() => exportBackupJSON(data)}>
            ⬇️ Backup all data (JSON)
          </Button>
        </div>
      </Card>

      {/* Import */}
      <Card>
        <div className="card-title">Import backup</div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
          Restore from a JSON backup. <strong>This replaces the current {mode} dataset.</strong>
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          ⬆️ Import JSON backup
        </Button>
        {message && (
          <div
            className="callout"
            style={
              message.tone === 'ok'
                ? { background: 'var(--safe-bg)', color: '#166534', marginTop: 14 }
                : { background: 'var(--danger-bg)', color: '#991b1b', marginTop: 14 }
            }
          >
            {message.text}
          </div>
        )}
      </Card>

      {/* Current data */}
      <Card>
        <div className="card-title">Current data ({mode})</div>
        <div className="wrap-gap">
          <span className="badge">{counts.income} income</span>
          <span className="badge">{counts.expenses} expenses</span>
          <span className="badge">{counts.fixed} fixed costs</span>
          <span className="badge">{counts.accounts} accounts</span>
          <span className="badge">{counts.debts} debts</span>
        </div>
      </Card>

      {/* Danger zone - mode aware */}
      {mode === 'demo' ? (
        <Card accent="warning">
          <div className="card-title">Reset demo data</div>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            Restore the original fictional example data. Only affects Demo mode.
          </p>
          <ConfirmButton
            onConfirm={() => {
              resetDemoData();
              setMessage({ tone: 'ok', text: 'Demo data restored.' });
            }}
            label="Reset demo data"
            confirmLabel="Yes, reset demo"
          />
        </Card>
      ) : (
        <Card accent="danger">
          <div className="card-title">Clear personal data</div>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>
            Wipe all of your personal entries and start from scratch. Export a backup first if you
            want to keep them.
          </p>
          <ConfirmButton
            onConfirm={() => {
              clearAllData();
              setMessage({ tone: 'ok', text: 'Personal data cleared.' });
            }}
            label="Clear my data"
            confirmLabel="Yes, wipe everything"
          />
        </Card>
      )}
    </div>
  );
}
