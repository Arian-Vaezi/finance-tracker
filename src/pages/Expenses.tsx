import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { EXPENSE_CATEGORIES, ExpenseEntry } from '../types';
import { addMonths, eur, formatDate, monthLabel, todayISO } from '../lib/format';
import { budgetMonthOfExpense, deferredIntoMonth } from '../lib/calculations';
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

  const accountName = (id?: string) =>
    data.accounts.find((a) => a.id === id)?.name ?? '—';

  const entries = useMemo(
    () =>
      data.expenses
        .filter((e) => budgetMonthOfExpense(e) === selectedMonth)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.expenses, selectedMonth],
  );

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const committed = useMemo(
    () => deferredIntoMonth(data, selectedMonth),
    [data, selectedMonth],
  );
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

        {committed > 0 && (
          <div className="tiny muted" style={{ marginBottom: 14 }}>
            {eur(committed)} of this month's budget was already committed by expenses deferred
            here from earlier months.
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState>No expenses for {monthLabel(selectedMonth)} yet.</EmptyState>
        ) : (
          <div className="item-list">
            {entries.map((e) => (
              <div className="item" key={e.id}>
                <div className="item-main">
                  <div className="item-title cap">
                    {e.category}
                    {e.category === 'transfer' && e.transferToAccountId
                      ? ` to ${accountName(e.transferToAccountId)}`
                      : ''}
                    {budgetMonthOfExpense(e) !== e.date.slice(0, 7) && (
                      <Badge tone="info">deferred from {monthLabel(e.date.slice(0, 7))}</Badge>
                    )}
                  </div>
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
  const [transferToAccountId, setTransferToAccountId] = useState(
    initial.transferToAccountId ?? '',
  );
  const [note, setNote] = useState(initial.note ?? '');
  // "Count against next month" is on when the saved budget month is the month
  // after the date. Transfers are never budgeted, so the option is hidden there.
  const [forNextMonth, setForNextMonth] = useState(
    !!initial.budgetMonth && initial.budgetMonth === addMonths(initial.date.slice(0, 7), 1),
  );
  const canDefer = category !== 'transfer';

  const submit = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!date || !Number.isFinite(value) || value <= 0) return;
    if (
      category === 'transfer' &&
      (!accountId || !transferToAccountId || accountId === transferToAccountId)
    ) {
      return;
    }
    onSave({
      date,
      category,
      amount: value,
      accountId,
      transferToAccountId: category === 'transfer' ? transferToAccountId : undefined,
      note: note.trim(),
      budgetMonth:
        canDefer && forNextMonth ? addMonths(date.slice(0, 7), 1) : undefined,
    });
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
        <Field label={category === 'transfer' ? 'From account' : 'Payment account'}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {category === 'transfer' && (
          <Field label="Transfer to account">
            <select
              value={transferToAccountId}
              onChange={(e) => setTransferToAccountId(e.target.value)}
            >
              <option value="">— choose account —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" />
        </Field>
      </div>

      {canDefer && (
        <>
          <label className="checkbox-row" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={forNextMonth}
              onChange={(e) => setForNextMonth(e.target.checked)}
            />
            Count against next month's budget (keeps this month's safe-to-spend intact)
          </label>
          {forNextMonth && (
            <div className="tiny muted" style={{ marginTop: 6 }}>
              Paid {date ? formatDate(date) : 'this month'}, but counts toward{' '}
              {monthLabel(addMonths(date.slice(0, 7), 1))}.
            </div>
          )}
        </>
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
