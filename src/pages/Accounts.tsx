import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { ACCOUNT_TYPES, AccountType, BankAccount } from '../types';
import { totalBank, totalDebt } from '../lib/calculations';
import { eur } from '../lib/format';
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

type Draft = Omit<BankAccount, 'id'>;

const emptyDraft: Draft = { name: '', balance: 0, type: 'main' };

const typeLabel = (t: AccountType) =>
  ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export default function Accounts() {
  const { data, addAccount, updateAccount, deleteAccount } = useStore();
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [adding, setAdding] = useState(false);

  const bank = useMemo(() => totalBank(data), [data]);
  const debt = useMemo(() => totalDebt(data), [data]);
  const real = bank - debt;

  return (
    <div className="stack">
      <SectionHeader
        title="Bank accounts"
        subtitle="Linked income, expenses, and transfers update balances automatically; you can still correct balances manually."
        action={<Button onClick={() => setAdding(true)}>+ Add account</Button>}
      />

      <div className="grid grid-stats">
        <div className="stat">
          <div className="stat-label">Total bank balance</div>
          <div className="stat-value">{eur(bank)}</div>
        </div>
        <div className="stat stat--warning">
          <div className="stat-label">Total debt</div>
          <div className="stat-value">{eur(debt)}</div>
        </div>
        <div className={`stat ${real < 0 ? 'stat--danger' : 'stat--safe'}`}>
          <div className="stat-label">Real net money</div>
          <div className="stat-value">{eur(real)}</div>
          <div className="stat-hint">bank − debt</div>
        </div>
      </div>

      <Card>
        {data.accounts.length === 0 ? (
          <EmptyState>No accounts yet.</EmptyState>
        ) : (
          <div className="item-list">
            {data.accounts.map((a) => (
              <div className="item" key={a.id}>
                <div className="item-main">
                  <div className="item-title">
                    {a.name} <Badge>{typeLabel(a.type)}</Badge>
                  </div>
                </div>
                <div className="item-amount">{eur(a.balance)}</div>
                <div className="item-actions">
                  <Button variant="ghost" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  <ConfirmButton onConfirm={() => deleteAccount(a.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {debt > 0 && (
        <div className="callout callout--debt">
          Your accounts show {eur(bank)}, but {eur(debt)} of that is borrowed. Your real free
          money is <strong>{eur(real)}</strong>. Treat the rest as money you owe.
        </div>
      )}

      {(adding || editing) && (
        <AccountForm
          initial={editing ?? emptyDraft}
          title={editing ? 'Edit account' : 'Add account'}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(draft) => {
            if (editing) updateAccount(editing.id, draft);
            else addAccount(draft);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AccountForm({
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
  const [name, setName] = useState(initial.name);
  const [balance, setBalance] = useState(String(initial.balance ?? ''));
  const [type, setType] = useState<AccountType>(initial.type);

  const submit = () => {
    const value = parseFloat(balance.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(value)) return;
    onSave({ name: name.trim(), balance: value, type });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <Field label="Account name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bank account 1"
          />
        </Field>
        <Field label="Current balance (€)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
