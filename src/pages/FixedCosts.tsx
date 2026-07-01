import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { FixedCost } from '../types';
import { fixedCostsForMonth, isFixedCostInMonth } from '../lib/calculations';
import { currentMonth, eur, monthLabel, ordinal } from '../lib/format';
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

type Draft = Omit<FixedCost, 'id'>;

// A brand-new cost defaults to starting THIS month, so adding it never
// retroactively rewrites past months. Clear the "First month" field to apply it
// to earlier months on purpose.
function makeEmptyDraft(): Draft {
  return {
    name: '',
    amount: 0,
    paymentDay: undefined,
    active: true,
    essential: true,
    startMonth: currentMonth(),
    endMonth: undefined,
  };
}

/** Short note about a cost's effective window, or null if it's open-ended/ongoing. */
function windowBadge(f: FixedCost, thisMonth: string): { tone?: 'info'; text: string } | null {
  if (f.endMonth && f.endMonth < thisMonth) return { text: `ended ${monthLabel(f.endMonth)}` };
  if (f.endMonth) return { text: `until ${monthLabel(f.endMonth)}` };
  if (f.startMonth && f.startMonth > thisMonth)
    return { tone: 'info', text: `from ${monthLabel(f.startMonth)}` };
  return null;
}

export default function FixedCosts() {
  const { data, addFixedCost, updateFixedCost, deleteFixedCost } = useStore();
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [adding, setAdding] = useState(false);

  const thisMonth = currentMonth();
  const list = useMemo(
    () => [...data.fixedCosts].sort((a, b) => b.amount - a.amount),
    [data.fixedCosts],
  );
  const monthlyTotal = useMemo(() => fixedCostsForMonth(data, thisMonth), [data, thisMonth]);
  const accountName = (id?: string) => data.accounts.find((a) => a.id === id)?.name ?? '—';

  // One line describing when/whether a cost hits a balance.
  const scheduleLabel = (f: FixedCost): string => {
    if (!f.paymentDay) return 'No fixed payment date';
    const on = `on the ${ordinal(f.paymentDay)}`;
    if (!f.accountId) return `Debited ${on}`;
    const paid = (f.postedMonths ?? []).includes(thisMonth);
    return paid
      ? `Paid from ${accountName(f.accountId)} ${on}`
      : `Auto-debits from ${accountName(f.accountId)} ${on}`;
  };

  return (
    <div className="stack">
      <SectionHeader
        title="Fixed costs"
        subtitle="Recurring monthly costs. Ending a cost keeps it in past months and only stops counting it from next month."
        action={<Button onClick={() => setAdding(true)}>+ Add fixed cost</Button>}
      />

      <Card>
        <div className="spread" style={{ marginBottom: 14 }}>
          <span className="muted">This month's total</span>
          <span className="item-amount" style={{ fontSize: 18 }}>
            {eur(monthlyTotal)}
          </span>
        </div>

        {list.length === 0 ? (
          <EmptyState>No fixed costs yet.</EmptyState>
        ) : (
          <div className="item-list">
            {list.map((f) => {
              const appliesNow = isFixedCostInMonth(f, thisMonth);
              const win = windowBadge(f, thisMonth);
              const ended = !!f.endMonth;
              return (
                <div className={`item ${appliesNow ? '' : 'disabled-row'}`} key={f.id}>
                  <div className="item-main">
                    <div className="item-title">
                      {f.name}
                      {!f.essential && <Badge tone="info">optional</Badge>}
                      {f.accountId && f.paymentDay && <Badge tone="info">auto</Badge>}
                      {win && <Badge tone={win.tone}>{win.text}</Badge>}
                    </div>
                    <div className="item-sub">{scheduleLabel(f)}</div>
                  </div>
                  <div className="item-amount">{eur(f.amount)}</div>
                  <div className="item-actions">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        updateFixedCost(
                          f.id,
                          ended
                            ? { active: true, endMonth: undefined }
                            : { active: false, endMonth: thisMonth },
                        )
                      }
                      title={ended ? 'Resume this cost' : 'Stop counting this cost from next month'}
                    >
                      {ended ? 'Resume' : 'End'}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(f)}>
                      Edit
                    </Button>
                    <ConfirmButton onConfirm={() => deleteFixedCost(f.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <FixedCostForm
          initial={editing ?? makeEmptyDraft()}
          title={editing ? 'Edit fixed cost' : 'Add fixed cost'}
          accounts={data.accounts}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(draft) => {
            if (editing) updateFixedCost(editing.id, draft);
            else addFixedCost(draft);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function FixedCostForm({
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
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(String(initial.amount || ''));
  const [paymentDay, setPaymentDay] = useState(
    initial.paymentDay ? String(initial.paymentDay) : '',
  );
  const [startMonth, setStartMonth] = useState(initial.startMonth ?? '');
  const [endMonth, setEndMonth] = useState(initial.endMonth ?? '');
  const [essential, setEssential] = useState(initial.essential);
  const [accountId, setAccountId] = useState(initial.accountId ?? '');

  const submit = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(value) || value < 0) return;
    const day = paymentDay ? Math.min(31, Math.max(1, parseInt(paymentDay, 10))) : undefined;
    const end = endMonth || undefined;
    onSave({
      name: name.trim(),
      amount: value,
      paymentDay: day,
      essential,
      active: !end, // ongoing while there is no last month
      startMonth: startMonth || undefined,
      endMonth: end,
      accountId: accountId || undefined,
      postedMonths: initial.postedMonths, // preserve past auto-debits on edit
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gym" />
        </Field>
        <Field label="Amount (€ / month)">
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
        <Field label="Payment day" hint="Day of the month it is debited (optional)">
          <input
            type="number"
            min="1"
            max="31"
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
            placeholder="e.g. 15"
          />
        </Field>
        <Field
          label="Auto-debit account"
          hint={
            accountId && !paymentDay
              ? 'Add a payment day to auto-debit this account.'
              : accountId
                ? 'Debited from this account when the payment day arrives.'
                : 'Optional. Leave as none to keep it informational only.'
          }
        >
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First month" hint="When it started. Empty = also counts earlier months.">
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />
        </Field>
        <Field label="Last month" hint="When it stops. Empty = ongoing. Past months stay counted.">
          <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={essential}
            onChange={(e) => setEssential(e.target.checked)}
          />
          Essential (uncheck for costs Panic Mode can suggest cutting)
        </label>
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
