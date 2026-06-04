import { AppData } from '../types';
import { budgetMonthOf } from './calculations';

// Trigger a browser download for a generated file (CSV or JSON).
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Escape a single CSV field (wrap in quotes, double up internal quotes).
function field(value: string | number | undefined): string {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rows(data: (string | number | undefined)[][]): string {
  return data.map((r) => r.map(field).join(',')).join('\r\n');
}

/**
 * Export all income and expense transactions as a single CSV.
 * Columns are shared between the two so they sit in one sheet nicely.
 */
export function transactionsToCSV(data: AppData): string {
  const accountName = (id: string) =>
    data.accounts.find((a) => a.id === id)?.name ?? '';

  const header = [
    'type',
    'date',
    'budget month',
    'category/source',
    'amount',
    'account',
    'note',
  ];

  const incomeRows = data.incomes.map((i) => [
    'income',
    i.date,
    budgetMonthOf(i),
    i.source,
    i.amount,
    '',
    i.note,
  ]);

  const expenseRows = data.expenses.map((e) => [
    'expense',
    e.date,
    e.date.slice(0, 7),
    e.category,
    e.amount,
    accountName(e.accountId),
    e.note,
  ]);

  const all = [...incomeRows, ...expenseRows].sort((a, b) =>
    String(a[1]).localeCompare(String(b[1])),
  );

  return rows([header, ...all]);
}

export function exportTransactionsCSV(data: AppData): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(
    `finance-transactions-${stamp}.csv`,
    transactionsToCSV(data),
    'text/csv;charset=utf-8',
  );
}

export function exportBackupJSON(data: AppData): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(
    `finance-backup-${stamp}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  );
}
