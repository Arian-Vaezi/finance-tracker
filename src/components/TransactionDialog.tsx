import { useId, useState } from 'react';
import { EXPENSE_CATEGORIES, ExpenseEntry } from '../types';
import { addMonths, formatDate, monthLabel } from '../lib/format';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ExpenseDraft = Omit<ExpenseEntry, 'id'>;

export function emptyExpenseDraft(month: string, accountId: string, todayIso: string): ExpenseDraft {
  const day = todayIso.slice(8);
  return {
    date: `${month}-${day > '28' ? '28' : day}`,
    category: 'groceries',
    amount: 0,
    accountId,
    note: '',
  };
}

/**
 * Add/edit expense dialog. Shared by the Dashboard quick-add and the Expenses
 * page so the form only exists once.
 */
export function ExpenseDialog({
  initial,
  title,
  accounts,
  onClose,
  onSave,
}: {
  initial: ExpenseDraft;
  title: string;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSave: (draft: ExpenseDraft) => void;
}) {
  const id = useId();
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
      budgetMonth: canDefer && forNextMonth ? addMonths(date.slice(0, 7), 1) : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-md"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
                <Input
                  id={`${id}-date`}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-amount`}>Amount (€)</FieldLabel>
                <Input
                  id={`${id}-amount`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id={`${id}-category`} className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${id}-account`}>
                {category === 'transfer' ? 'From account' : 'Payment account'}
              </FieldLabel>
              <Select
                value={accountId || 'none'}
                onValueChange={(v) => setAccountId(v === 'none' ? '' : v)}
              >
                <SelectTrigger id={`${id}-account`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {category === 'transfer' && (
              <Field>
                <FieldLabel htmlFor={`${id}-transfer-to`}>Transfer to account</FieldLabel>
                <Select
                  value={transferToAccountId || 'none'}
                  onValueChange={(v) => setTransferToAccountId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger id={`${id}-transfer-to`} className="w-full">
                    <SelectValue placeholder="— choose account —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— choose account —</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor={`${id}-note`}>Note (optional)</FieldLabel>
              <Input
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note"
              />
            </Field>

            {canDefer && (
              <Field orientation="horizontal">
                <Checkbox
                  id={`${id}-defer`}
                  checked={forNextMonth}
                  onCheckedChange={(v) => setForNextMonth(v === true)}
                />
                <FieldLabel htmlFor={`${id}-defer`} className="font-normal">
                  Count against next month's budget
                </FieldLabel>
              </Field>
            )}
            {canDefer && forNextMonth && (
              <FieldDescription className="-mt-2">
                Paid {date ? formatDate(date) : 'this month'}, but counts toward{' '}
                {monthLabel(addMonths(date.slice(0, 7), 1))}.
              </FieldDescription>
            )}
          </FieldGroup>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
