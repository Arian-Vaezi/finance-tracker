import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { EXPENSE_CATEGORIES, ExpenseEntry } from '../types';
import { eur, formatDate, isInMonth, monthLabel, todayISO } from '../lib/format';
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Modal,
  SectionHeader,
} from '../components/ui';

type Draft = Omit<ExpenseEntry, 'id'>;

function emptyDraft(month: string, accountId: string): Draft {
  const day = todayISO().slice(8);
  return {
    date: `${month}-${day > '28' ? '28' : day}`,
    category: 'groceries',
    amount: 0,
    accountId,
    note: '',
  };
}

export default function Expenses() {
  const { data, selectedMonth, addExpense, updateExpense, deleteExpense } = useStore();
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [adding, setAdding] = useState(false);

  const accountName = (id: string) =>
    data.accounts.find((a) => a.id === id)?.name ?? '—';

  const entries = useMemo(
    () =>
      data.expenses
        .filter((e) => isInMonth(e.date, selectedMonth))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.expenses, selectedMonth],
  );

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const defaultAccount = data.accounts[0]?.id ?? '';

  return (
    <div className="stack">
      <SectionHeader
        title={`Expenses · ${monthLabel(selectedMonth)}`}
        subtitle="Day-to-day spending. Fixed monthly bills live in the Fixed costs tab."
        action={<Button onClick={() => setAdding(true)}>+ Add expense</Button>}
      />

      <Card>
        <div className="spread" style={{ marginBottom: 14 }}>
          <span className="muted">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
          <span className="item-amount amount-neg" style={{ fontSize: 18 }}>
            {eur(total)}
          </span>
        </div>

        {entries.length === 0 ? (
          <EmptyState>No expenses for {monthLabel(selectedMonth)} yet.</EmptyState>
        ) : (
          <div className="item-list">
            {entries.map((e) => (
              <div className="item" key={e.id}>
                <div className="item-main">
                  <div className="item-title cap">{e.category}</div>
                  <div className="item-sub">
                    {formatDate(e.date)} · {accountName(e.accountId)}
                    {e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <div className="item-amount amount-neg">−{eur(e.amount)}</div>
                <div className="item-actions">
                  <Button variant="ghost" onClick={() => setEditing(e)}>
                    Edit
                  </Button>
                  <ConfirmButton onConfirm={() => deleteExpense(e.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <ExpenseForm
          initial={editing ?? emptyDraft(selectedMonth, defaultAccount)}
          title={editing ? 'Edit expense' : 'Add expense'}
          accounts={data.accounts}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(draft) => {
            if (editing) updateExpense(editing.id, draft);
            else addExpense(draft);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ExpenseForm({
  initial,
  title,
  accounts,
  onClose,
  onSave,
}: {
  initial: Draft;
  title: string;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [date, setDate] = useState(initial.date);
  const [category, setCategory] = useState(initial.category);
  const [amount, setAmount] = useState(String(initial.amount || ''));
  const [accountId, setAccountId] = useState(initial.accountId);
  const [note, setNote] = useState(initial.note ?? '');

  const submit = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!date || !Number.isFinite(value) || value <= 0) return;
    onSave({ date, category, amount: value, accountId, note: note.trim() });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        <Field label="Payment account">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
        </Field>
      </div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </div>
    </Modal>
  );
}
