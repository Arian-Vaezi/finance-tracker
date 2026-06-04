import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { INCOME_SOURCES, IncomeEntry } from '../types';
import { addMonths, eur, formatDate, monthLabel, todayISO } from '../lib/format';
import { splitGigShift } from '../lib/gigShift';
import { budgetMonthOf } from '../lib/calculations';
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Modal,
  SectionHeader,
} from '../components/ui';

type Draft = Omit<IncomeEntry, 'id'>;

function emptyDraft(month: string): Draft {
  // Default the date into the currently-selected month.
  const day = todayISO().slice(8);
  return { date: `${month}-${day > '28' ? '28' : day}`, source: 'part-time job', amount: 0, note: '' };
}

export default function Income() {
  const { data, selectedMonth, addIncome, updateIncome, deleteIncome } = useStore();
  const [editing, setEditing] = useState<IncomeEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [gigShift, setGig] = useState(false);

  const entries = useMemo(
    () =>
      data.incomes
        .filter((i) => budgetMonthOf(i) === selectedMonth)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.incomes, selectedMonth],
  );

  const total = entries.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="stack">
      <SectionHeader
        title={`Income · ${monthLabel(selectedMonth)}`}
        subtitle="Enter each payment you receive. They are summed automatically."
        action={
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setGig(true)}>
              + Gig shift
            </Button>
            <Button onClick={() => setAdding(true)}>+ Add income</Button>
          </div>
        }
      />

      <Card>
        <div className="spread" style={{ marginBottom: 14 }}>
          <span className="muted">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
          <span className="item-amount amount-pos" style={{ fontSize: 18 }}>
            {eur(total)}
          </span>
        </div>

        {entries.length === 0 ? (
          <EmptyState>
            No income for {monthLabel(selectedMonth)} yet. Use the month switcher at the top to
            change month, or add an entry.
          </EmptyState>
        ) : (
          <div className="item-list">
            {entries.map((i) => (
              <div className="item" key={i.id}>
                <div className="item-main">
                  <div className="item-title">
                    {i.source}
                    {budgetMonthOf(i) !== i.date.slice(0, 7) && (
                      <Badge tone="info">for {monthLabel(budgetMonthOf(i))}</Badge>
                    )}
                  </div>
                  <div className="item-sub">
                    {formatDate(i.date)}
                    {i.note ? ` · ${i.note}` : ''}
                  </div>
                </div>
                <div className="item-amount amount-pos">{eur(i.amount)}</div>
                <div className="item-actions">
                  <Button variant="ghost" onClick={() => setEditing(i)}>
                    Edit
                  </Button>
                  <ConfirmButton onConfirm={() => deleteIncome(i.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <IncomeForm
          initial={editing ?? emptyDraft(selectedMonth)}
          title={editing ? 'Edit income' : 'Add income'}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(draft) => {
            if (editing) updateIncome(editing.id, draft);
            else addIncome(draft);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      {gigShift && (
        <GigShiftForm
          month={selectedMonth}
          onClose={() => setGig(false)}
          onSave={(entries) => {
            entries.forEach((e) => addIncome(e));
            setGig(false);
          }}
        />
      )}
    </div>
  );
}

function IncomeForm({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: Draft;
  title: string;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [source, setSource] = useState(initial.source);
  const [amount, setAmount] = useState(String(initial.amount || ''));
  const [note, setNote] = useState(initial.note ?? '');
  // "For next month" is on when the saved budget month is the month after the date.
  const [forNextMonth, setForNextMonth] = useState(
    !!initial.budgetMonth && initial.budgetMonth === addMonths(initial.date.slice(0, 7), 1),
  );

  const submit = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!date || !source.trim() || !Number.isFinite(value) || value <= 0) return;
    onSave({
      date,
      source: source.trim(),
      amount: value,
      note: note.trim(),
      budgetMonth: forNextMonth ? addMonths(date.slice(0, 7), 1) : undefined,
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Source" hint="e.g. part-time job, Gig, family, refund">
          <input
            list="income-sources"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source"
          />
          <datalist id="income-sources">
            {INCOME_SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Amount (€)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
        </Field>
      </div>

      <label className="checkbox-row" style={{ marginTop: 14 }}>
        <input
          type="checkbox"
          checked={forNextMonth}
          onChange={(e) => setForNextMonth(e.target.checked)}
        />
        This money is for next month (earned now, spent next month)
      </label>
      {forNextMonth && (
        <div className="tiny muted" style={{ marginTop: 6 }}>
          Counts toward {monthLabel(addMonths(date.slice(0, 7), 1))}.
        </div>
      )}

      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </div>
    </Modal>
  );
}

function GigShiftForm({
  month,
  onClose,
  onSave,
}: {
  month: string;
  onClose: () => void;
  onSave: (entries: Omit<IncomeEntry, 'id'>[]) => void;
}) {
  // Default the shift date to today if we're viewing the current month.
  const [date, setDate] = useState(() => {
    const t = todayISO();
    return t.startsWith(month) ? t : `${month}-15`;
  });
  const [total, setTotal] = useState('');
  const [earlyPct, setEarlyPct] = useState('50');

  const totalNum = parseFloat(total.replace(',', '.'));
  const pctNum = Math.min(100, Math.max(0, parseFloat(earlyPct.replace(',', '.')) || 0));
  const valid = !!date && Number.isFinite(totalNum) && totalNum > 0;
  const preview = valid ? splitGigShift(date, totalNum, pctNum) : null;

  const submit = () => {
    if (!preview) return;
    onSave([preview.early]); // only the reliable early payout is saved
  };

  return (
    <Modal title="Log Gig shift" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0, marginBottom: 14 }}>
        Logs only the reliable early payout you receive the day after the shift. Because you
        spend Gig money the following month, it is counted toward next month's budget. The
        other half is pooled with your other shifts, taxed, and paid as one lump sum on the 15th
        of next month — add that manually when it lands, since the taxed amount can't be known now.
      </p>
      <div className="form-grid">
        <Field label="Shift date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Total shift pay (€)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Paid early (%)" hint="How much you get the next day">
          <input
            type="number"
            min="0"
            max="100"
            value={earlyPct}
            onChange={(e) => setEarlyPct(e.target.value)}
          />
        </Field>
      </div>

      {preview && (
        <div className="callout" style={{ background: 'var(--surface-2)', marginTop: 16 }}>
          <div className="spread">
            <span>
              ✅ Added now · early payout {formatDate(preview.early.date)} · counts toward{' '}
              {monthLabel(preview.early.budgetMonth ?? preview.early.date.slice(0, 7))}
            </span>
            <strong className="amount-pos">{eur(preview.early.amount)}</strong>
          </div>
          <div className="tiny muted" style={{ marginTop: 8 }}>
            Remainder ≈ {eur(preview.remainder.amount)} (before tax) is pooled and paid, after
            tax, around {formatDate(preview.remainder.date)}. Not added now — log the real amount
            manually when it arrives.
          </div>
        </div>
      )}

      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid}>
          Add early payout
        </Button>
      </div>
    </Modal>
  );
}
