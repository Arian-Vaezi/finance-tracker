import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { FixedCost } from '../types';
import { eur, ordinal } from '../lib/format';
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

const emptyDraft: Draft = {
  name: '',
  amount: 0,
  paymentDay: undefined,
  active: true,
  essential: true,
};

export default function FixedCosts() {
  const { data, addFixedCost, updateFixedCost, deleteFixedCost } = useStore();
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [adding, setAdding] = useState(false);

  const list = useMemo(
    () => [...data.fixedCosts].sort((a, b) => b.amount - a.amount),
    [data.fixedCosts],
  );
  const activeTotal = list.filter((f) => f.active).reduce((s, f) => s + f.amount, 0);

  return (
    <div className="stack">
      <SectionHeader
        title="Fixed costs"
        subtitle="Recurring monthly costs. Disable a cost to keep it but stop counting it."
        action={<Button onClick={() => setAdding(true)}>+ Add fixed cost</Button>}
      />

      <Card>
        <div className="spread" style={{ marginBottom: 14 }}>
          <span className="muted">Active monthly total</span>
          <span className="item-amount" style={{ fontSize: 18 }}>
            {eur(activeTotal)}
          </span>
        </div>

        {list.length === 0 ? (
          <EmptyState>No fixed costs yet.</EmptyState>
        ) : (
          <div className="item-list">
            {list.map((f) => (
              <div className={`item ${f.active ? '' : 'disabled-row'}`} key={f.id}>
                <div className="item-main">
                  <div className="item-title">
                    {f.name}
                    {!f.essential && <Badge tone="info">optional</Badge>}
                    {!f.active && <Badge>disabled</Badge>}
                  </div>
                  <div className="item-sub">
                    {f.paymentDay
                      ? `Debited on the ${ordinal(f.paymentDay)}`
                      : 'No fixed payment date'}
                  </div>
                </div>
                <div className="item-amount">{eur(f.amount)}</div>
                <div className="item-actions">
                  <Button
                    variant="ghost"
                    onClick={() => updateFixedCost(f.id, { active: !f.active })}
                    title={f.active ? 'Disable' : 'Enable'}
                  >
                    {f.active ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(f)}>
                    Edit
                  </Button>
                  <ConfirmButton onConfirm={() => deleteFixedCost(f.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <FixedCostForm
          initial={editing ?? emptyDraft}
          title={editing ? 'Edit fixed cost' : 'Add fixed cost'}
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
  onClose,
  onSave,
}: {
  initial: Draft;
  title: string;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(String(initial.amount || ''));
  const [paymentDay, setPaymentDay] = useState(
    initial.paymentDay ? String(initial.paymentDay) : '',
  );
  const [active, setActive] = useState(initial.active);
  const [essential, setEssential] = useState(initial.essential);

  const submit = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(value) || value < 0) return;
    const day = paymentDay ? Math.min(31, Math.max(1, parseInt(paymentDay, 10))) : undefined;
    onSave({
      name: name.trim(),
      amount: value,
      paymentDay: day,
      active,
      essential,
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
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <label className="checkbox-row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (counts toward fixed costs)
        </label>
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
