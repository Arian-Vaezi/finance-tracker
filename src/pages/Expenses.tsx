import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { EXPENSE_CATEGORIES, ExpenseEntry } from '../types';
import { eur, formatDate, monthLabel, todayISO } from '../lib/format';
import { budgetMonthOfExpense, deferredIntoMonth } from '../lib/calculations';
import { Badge, ConfirmButton, EmptyState, SectionHeader } from '../components/ui';
import {
  ExpenseDialog,
  emptyExpenseDraft,
  type ExpenseDraft,
} from '../components/TransactionDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Expenses() {
  const { data, selectedMonth, addExpense, updateExpense, deleteExpense } = useStore();
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<string>('all');

  const accountName = (id?: string) =>
    data.accounts.find((a) => a.id === id)?.name ?? '—';

  const monthEntries = useMemo(
    () =>
      data.expenses
        .filter((e) => budgetMonthOfExpense(e) === selectedMonth)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.expenses, selectedMonth],
  );

  // Only offer categories that actually occur this month (plus the active one).
  const presentCategories = useMemo(() => {
    const present = new Set(monthEntries.map((e) => e.category));
    return EXPENSE_CATEGORIES.filter((c) => present.has(c));
  }, [monthEntries]);

  const entries = useMemo(
    () => (category === 'all' ? monthEntries : monthEntries.filter((e) => e.category === category)),
    [monthEntries, category],
  );

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const committed = useMemo(
    () => deferredIntoMonth(data, selectedMonth),
    [data, selectedMonth],
  );
  const defaultAccount = data.accounts[0]?.id ?? '';

  const save = (draft: ExpenseDraft) => {
    if (editing) updateExpense(editing.id, draft);
    else addExpense(draft);
    setAdding(false);
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title={`Expenses · ${monthLabel(selectedMonth)}`}
        subtitle="Day-to-day spending. Fixed monthly bills live in the Fixed costs tab."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            Add expense
          </Button>
        }
      />

      <Card className="block gap-0 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 capitalize" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {presentCategories.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} ·{' '}
            <span className="font-semibold text-foreground">{eur(total)}</span>
          </div>
        </div>

        {committed > 0 && category === 'all' && (
          <p className="mb-4 text-xs text-muted-foreground">
            {eur(committed)} of this month's budget was already committed by expenses
            deferred here from earlier months.
          </p>
        )}

        {entries.length === 0 ? (
          <EmptyState>
            {category === 'all'
              ? `No expenses for ${monthLabel(selectedMonth)} yet.`
              : `No ${category} expenses for ${monthLabel(selectedMonth)}.`}
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="max-sm:hidden">Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(e.date)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {e.category}
                    {e.category === 'transfer' && e.transferToAccountId
                      ? ` to ${accountName(e.transferToAccountId)}`
                      : ''}
                    {budgetMonthOfExpense(e) !== e.date.slice(0, 7) && (
                      <Badge tone="info">deferred from {monthLabel(e.date.slice(0, 7))}</Badge>
                    )}
                    {e.note ? (
                      <span className="block max-w-64 text-xs normal-case break-words text-muted-foreground">
                        {e.note}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-sm:hidden">
                    {accountName(e.accountId)}
                  </TableCell>
                  <TableCell className="text-right font-medium">−{eur(e.amount)}</TableCell>
                  <TableCell className="py-1.5 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                      Edit
                    </Button>
                    <ConfirmButton onConfirm={() => deleteExpense(e.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {(adding || editing) && (
        <ExpenseDialog
          initial={editing ?? emptyExpenseDraft(selectedMonth, defaultAccount, todayISO())}
          title={editing ? 'Edit expense' : 'Add expense'}
          accounts={data.accounts}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
    </div>
  );
}
