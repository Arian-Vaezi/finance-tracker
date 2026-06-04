import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Debt } from '../types';
import { totalBank, totalDebt } from '../lib/calculations';
import { eur, formatDate, pct } from '../lib/format';
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Modal,
  ProgressBar,
  SectionHeader,
} from '../components/ui';

type Draft = Omit<Debt, 'id'>;

const emptyDraft: Draft = {
  lender: '',
  totalBorrowed: 0,
  repaid: 0,
  dateBorrowed: '',
  repaymentPlan: '',
  note: '',
};

export default function DebtPage() {
  const { data, addDebt, updateDebt, deleteDebt } = useStore();
  const [editing, setEditing] = useState<Debt | null>(null);
  const [adding, setAdding] = useState(false);

  const debt = useMemo(() => totalDebt(data), [data]);
  const bank = useMemo(() => totalBank(data), [data]);
  const real = bank - debt;

  return (
    <div className="stack">
      <SectionHeader
        title="Debt"
        subtitle="Money you owe. This is NOT part of your free money."
        action={<Button onClick={() => setAdding(true)}>+ Add debt</Button>}
      />

      <div className="callout callout--debt">
        You have <strong>{eur(bank)}</strong> in your accounts but owe <strong>{eur(debt)}</strong>.
        Your real free money is <strong>{eur(real)}</strong>. Debt money is borrowed, not earned —
        spending it just grows what you have to pay back.
      </div>

      <Card>
        {data.debts.length === 0 ? (
          <EmptyState>No debts tracked. 🎉</EmptyState>
        ) : (
          <div className="stack">
            {data.debts.map((d) => {
              const remaining = Math.max(0, d.totalBorrowed - d.repaid);
              const progress = d.totalBorrowed > 0 ? d.repaid / d.totalBorrowed : 0;
              return (
                <div className="item" key={d.id} style={{ alignItems: 'stretch' }}>
                  <div className="item-main" style={{ flex: 1 }}>
                    <div className="item-title">{d.lender}</div>
                    <div className="item-sub">
                      Borrowed {eur(d.totalBorrowed)} · repaid {eur(d.repaid)}
                      {d.dateBorrowed ? ` · since ${formatDate(d.dateBorrowed)}` : ''}
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <ProgressBar fraction={progress} tone="safe" />
                      <div className="tiny muted" style={{ marginTop: 5 }}>
                        {pct(progress)} repaid · {eur(remaining)} remaining
                      </div>
                    </div>
                    {d.repaymentPlan && (
                      <div className="item-sub" style={{ marginTop: 6 }}>
                        Plan: {d.repaymentPlan}
                      </div>
                    )}
                    {d.note && (
                      <div className="item-sub" style={{ marginTop: 2 }}>
                        {d.note}
                      </div>
                    )}
                  </div>
                  <div className="item-actions" style={{ alignItems: 'flex-start' }}>
                    <Button variant="ghost" onClick={() => setEditing(d)}>
                      Edit
                    </Button>
                    <ConfirmButton onConfirm={() => deleteDebt(d.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <DebtForm
          initial={editing ?? emptyDraft}
          title={editing ? 'Edit debt' : 'Add debt'}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(draft) => {
            if (editing) updateDebt(editing.id, draft);
            else addDebt(draft);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DebtForm({
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
  const [lender, setLender] = useState(initial.lender);
  const [totalBorrowed, setTotalBorrowed] = useState(String(initial.totalBorrowed || ''));
  const [repaid, setRepaid] = useState(String(initial.repaid || ''));
  const [dateBorrowed, setDateBorrowed] = useState(initial.dateBorrowed ?? '');
  const [repaymentPlan, setRepaymentPlan] = useState(initial.repaymentPlan ?? '');
  const [note, setNote] = useState(initial.note ?? '');

  const borrowedNum = parseFloat(totalBorrowed.replace(',', '.')) || 0;
  const repaidNum = parseFloat(repaid.replace(',', '.')) || 0;
  const remaining = Math.max(0, borrowedNum - repaidNum);

  const submit = () => {
    if (!lender.trim() || !Number.isFinite(borrowedNum) || borrowedNum < 0) return;
    onSave({
      lender: lender.trim(),
      totalBorrowed: borrowedNum,
      repaid: repaidNum,
      dateBorrowed: dateBorrowed || undefined,
      repaymentPlan: repaymentPlan.trim(),
      note: note.trim(),
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <Field label="Lender">
          <input
            value={lender}
            onChange={(e) => setLender(e.target.value)}
            placeholder="e.g. Aunt"
          />
        </Field>
        <Field label="Total borrowed (€)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={totalBorrowed}
            onChange={(e) => setTotalBorrowed(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Already repaid (€)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={repaid}
            onChange={(e) => setRepaid(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Date borrowed (optional)">
          <input
            type="date"
            value={dateBorrowed}
            onChange={(e) => setDateBorrowed(e.target.value)}
          />
        </Field>
      </div>

      <div style={{ marginTop: 13 }}>
        <Field label="Repayment plan (optional)">
          <input
            value={repaymentPlan}
            onChange={(e) => setRepaymentPlan(e.target.value)}
            placeholder="e.g. €100 / month from September"
          />
        </Field>
      </div>
      <div style={{ marginTop: 13 }}>
        <Field label="Note (optional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="tiny muted" style={{ marginTop: 12 }}>
        Remaining debt: <strong>{eur(remaining)}</strong>
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
