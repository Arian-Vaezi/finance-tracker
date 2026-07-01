import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppData,
  BankAccount,
  Debt,
  DATA_VERSION,
  ExpenseEntry,
  FixedCost,
  IncomeEntry,
} from './types';
import { emptyData, makeDemoData, uid } from './defaults';
import { currentMonth } from './lib/format';
import { isFixedCostInMonth, isFixedCostPostable } from './lib/calculations';
import { useAuth } from './auth';
import { pullData, pushData } from './lib/cloud';

// ---------------------------------------------------------------------------
// Modes & persistence
// ---------------------------------------------------------------------------
// Two separate datasets in localStorage:
//   - "personal": the owner's real data (and, when signed in, synced to Supabase)
//   - "demo":     fictional data for portfolio visitors (always local)
// A `mode` flag decides which is active. This keeps real data out of the public
// repo and demo, while still allowing optional cross-device cloud sync.

export type Mode = 'personal' | 'demo';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const MODE_KEY = 'finance-tracker-mode';
const LEGACY_KEY = 'finance-tracker-data-v1';
const DATA_KEYS: Record<Mode, string> = {
  personal: 'finance-tracker-personal-v1',
  demo: 'finance-tracker-demo-v1',
};

export function isValidAppData(value: unknown): value is AppData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.incomes) &&
    Array.isArray(v.expenses) &&
    Array.isArray(v.fixedCosts) &&
    Array.isArray(v.accounts) &&
    Array.isArray(v.debts)
  );
}

function readData(key: string): AppData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidAppData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeData(key: string, data: AppData): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* storage full or disabled */
  }
}

function migrateLegacy(): void {
  const legacy = readData(LEGACY_KEY);
  if (legacy && !readData(DATA_KEYS.personal)) {
    writeData(DATA_KEYS.personal, legacy);
  }
}

function loadMode(): Mode {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === 'personal' || saved === 'demo') return saved;
  return readData(DATA_KEYS.personal) ? 'personal' : 'demo';
}

function loadForMode(mode: Mode): AppData {
  return readData(DATA_KEYS[mode]) ?? (mode === 'demo' ? makeDemoData() : emptyData());
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface StoreValue {
  data: AppData;
  mode: Mode;
  setMode: (mode: Mode) => void;

  // Cloud sync status (personal mode + signed in)
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  cloudActive: boolean;
  syncNow: () => void;

  selectedMonth: string;
  setSelectedMonth: (m: string) => void;

  addIncome: (entry: Omit<IncomeEntry, 'id'>) => void;
  updateIncome: (id: string, patch: Partial<IncomeEntry>) => void;
  deleteIncome: (id: string) => void;

  addExpense: (entry: Omit<ExpenseEntry, 'id'>) => void;
  updateExpense: (id: string, patch: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: string) => void;

  addFixedCost: (entry: Omit<FixedCost, 'id'>) => void;
  updateFixedCost: (id: string, patch: Partial<FixedCost>) => void;
  deleteFixedCost: (id: string) => void;

  addAccount: (entry: Omit<BankAccount, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<BankAccount>) => void;
  deleteAccount: (id: string) => void;

  addDebt: (entry: Omit<Debt, 'id'>) => void;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;

  setSavingsGoal: (amount: number) => void;

  replaceData: (data: AppData) => void;
  resetDemoData: () => void;
  clearAllData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function withItem<T extends { id: string }>(list: T[], entry: Omit<T, 'id'>): T[] {
  return [...list, { ...(entry as T), id: uid() }];
}
function patchItem<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
function removeItem<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isPositiveMoney(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function applyAccountDelta(accounts: BankAccount[], accountId: string, delta: number): BankAccount[] {
  if (!accountId) return accounts;
  return accounts.map((account) =>
    account.id === accountId
      ? { ...account, balance: roundMoney(account.balance + delta) }
      : account,
  );
}

function applyAccountDeltas(
  accounts: BankAccount[],
  deltas: { accountId: string; amount: number }[],
): BankAccount[] {
  return deltas.reduce(
    (nextAccounts, delta) => applyAccountDelta(nextAccounts, delta.accountId, delta.amount),
    accounts,
  );
}

function incomeBalanceDeltas(
  income: Pick<IncomeEntry, 'accountId' | 'amount'>,
  direction: 1 | -1,
): { accountId: string; amount: number }[] {
  if (!income.accountId || !isPositiveMoney(income.amount)) return [];
  return [{ accountId: income.accountId, amount: direction * income.amount }];
}

function expenseBalanceDeltas(
  expense: Pick<ExpenseEntry, 'accountId' | 'transferToAccountId' | 'category' | 'amount'>,
  direction: 1 | -1,
): { accountId: string; amount: number }[] {
  if (!isPositiveMoney(expense.amount)) return [];

  if (expense.category === 'transfer') {
    if (
      !expense.accountId ||
      !expense.transferToAccountId ||
      expense.accountId === expense.transferToAccountId
    ) {
      return [];
    }
    return [
      { accountId: expense.accountId, amount: direction * -expense.amount },
      { accountId: expense.transferToAccountId, amount: direction * expense.amount },
    ];
  }

  if (!expense.accountId) return [];
  return [{ accountId: expense.accountId, amount: direction * -expense.amount }];
}

// When auto-debit is enabled (an account is linked) but this month's payment day
// has ALREADY passed at save time, mark the current month as posted so enabling
// never retroactively charges a payment that predates opting in — it may already
// be logged as an expense. The first real auto-debit is then next month's.
function armFixedCost(f: FixedCost, now: Date): FixedCost {
  if (!f.accountId || !f.paymentDay) return f;
  const month = currentMonth(now);
  if (!isFixedCostInMonth(f, month)) return f;
  const posted = f.postedMonths ?? [];
  if (posted.includes(month) || now.getDate() < f.paymentDay) return f;
  return { ...f, postedMonths: [...posted, month] };
}

// Debit any fixed cost whose current-month payment day has arrived and hasn't
// been posted yet. Idempotent: returns the same object when nothing is due, so a
// no-op setData bails out instead of looping.
function reconcileFixedCosts(d: AppData, now: Date): AppData {
  const month = currentMonth(now);
  let accounts = d.accounts;
  let changed = false;
  const fixedCosts = d.fixedCosts.map((f) => {
    if (!isFixedCostPostable(f, now)) return f;
    accounts = applyAccountDelta(accounts, f.accountId as string, -f.amount);
    changed = true;
    return { ...f, postedMonths: [...(f.postedMonths ?? []), month] };
  });
  return changed ? { ...d, accounts, fixedCosts } : d;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, configured } = useAuth();
  const userId = session?.user.id ?? null;

  const [mode, setModeState] = useState<Mode>(() => {
    migrateLegacy();
    return loadMode();
  });
  const [data, setData] = useState<AppData>(() => loadForMode(mode));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Cloud sync is active only when configured, signed in, and in personal mode.
  const cloudActive = configured && !!userId && mode === 'personal';

  // Refs so async sync callbacks always see the latest values without re-binding.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const syncReadyRef = useRef(false); // becomes true once the initial pull/seed is done
  const dirtyRef = useRef(false); // unsynced local edits pending a push
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always cache the active dataset locally (offline support + non-synced use).
  useEffect(() => {
    writeData(DATA_KEYS[mode], data);
  }, [mode, data]);

  // Auto-post fixed costs whose payment day has arrived. Runs once the active
  // dataset is settled (immediately when offline, after the first cloud pull when
  // synced) so a debit is never applied to stale data and then overwritten. The
  // per-(mode, month) guard keeps it from firing on every render; reconcile is
  // idempotent, so a no-op simply returns the same data.
  const reconciledRef = useRef<string>('');
  useEffect(() => {
    if (cloudActive && syncStatus !== 'synced') return;
    const key = `${mode}:${currentMonth()}`;
    if (reconciledRef.current === key) return;
    reconciledRef.current = key;
    setData((d) => reconcileFixedCosts(d, new Date()));
  }, [cloudActive, syncStatus, mode]);

  // (1) When cloud sync becomes active, pull the cloud copy first. If the cloud
  //     has nothing yet (new account), seed it from the current local data.
  useEffect(() => {
    syncReadyRef.current = false;
    if (!cloudActive) {
      setSyncStatus('idle');
      return;
    }
    let cancelled = false;
    setSyncStatus('syncing');
    (async () => {
      try {
        const remote = await pullData(userId as string);
        if (cancelled) return;
        if (remote) {
          setData(remote);
        } else {
          await pushData(userId as string, dataRef.current);
        }
        syncReadyRef.current = true;
        dirtyRef.current = false;
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch {
        if (!cancelled) setSyncStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudActive, userId]);

  // (2) Push local changes up (debounced), once the initial pull/seed finished.
  useEffect(() => {
    if (!cloudActive || !syncReadyRef.current) return;
    dirtyRef.current = true;
    setSyncStatus('syncing');
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        await pushData(userId as string, dataRef.current);
        dirtyRef.current = false;
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      } catch {
        setSyncStatus('error');
      }
    }, 800);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [data, cloudActive, userId]);

  // (3) When returning to the tab, pull the latest (unless we have unsaved edits).
  useEffect(() => {
    if (!cloudActive) return;
    const onFocus = async () => {
      if (dirtyRef.current) return;
      try {
        const remote = await pullData(userId as string);
        if (remote) {
          setData(remote);
          setLastSyncedAt(Date.now());
        }
      } catch {
        /* ignore transient focus-pull errors */
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [cloudActive, userId]);

  const setMode = (next: Mode) => {
    if (next === mode) return;
    localStorage.setItem(MODE_KEY, next);
    setData(loadForMode(next));
    setModeState(next);
  };

  const syncNow = () => {
    if (!cloudActive) return;
    setSyncStatus('syncing');
    pullData(userId as string)
      .then((remote) => {
        if (remote) setData(remote);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
      })
      .catch(() => setSyncStatus('error'));
  };

  const value = useMemo<StoreValue>(() => {
    const update = (fn: (d: AppData) => AppData) => setData((d) => fn(d));

    return {
      data,
      mode,
      setMode,
      syncStatus,
      lastSyncedAt,
      cloudActive,
      syncNow,
      selectedMonth,
      setSelectedMonth,

      addIncome: (e) =>
        update((d) => {
          const balanceImpactApplied = incomeBalanceDeltas(e, 1).length > 0;
          const entry = { ...e, balanceImpactApplied };
          return {
            ...d,
            incomes: withItem(d.incomes, entry),
            accounts: balanceImpactApplied
              ? applyAccountDeltas(d.accounts, incomeBalanceDeltas(entry, 1))
              : d.accounts,
          };
        }),
      updateIncome: (id, p) =>
        update((d) => {
          const existing = d.incomes.find((income) => income.id === id);
          if (!existing) return d;
          const next = { ...existing, ...p };
          const nextBalanceImpactApplied = incomeBalanceDeltas(next, 1).length > 0;
          let accounts = d.accounts;
          if (existing.balanceImpactApplied) {
            accounts = applyAccountDeltas(accounts, incomeBalanceDeltas(existing, -1));
          }
          if (nextBalanceImpactApplied) {
            accounts = applyAccountDeltas(accounts, incomeBalanceDeltas(next, 1));
          }
          return {
            ...d,
            incomes: patchItem(d.incomes, id, {
              ...p,
              balanceImpactApplied: nextBalanceImpactApplied,
            }),
            accounts,
          };
        }),
      deleteIncome: (id) =>
        update((d) => {
          const existing = d.incomes.find((income) => income.id === id);
          if (!existing) return d;
          return {
            ...d,
            incomes: removeItem(d.incomes, id),
            accounts: existing.balanceImpactApplied
              ? applyAccountDeltas(d.accounts, incomeBalanceDeltas(existing, -1))
              : d.accounts,
          };
        }),

      addExpense: (e) =>
        update((d) => {
          const balanceImpactApplied = expenseBalanceDeltas(e, 1).length > 0;
          const entry = { ...e, balanceImpactApplied };
          return {
            ...d,
            expenses: withItem(d.expenses, entry),
            accounts: balanceImpactApplied
              ? applyAccountDeltas(d.accounts, expenseBalanceDeltas(entry, 1))
              : d.accounts,
          };
        }),
      updateExpense: (id, p) =>
        update((d) => {
          const existing = d.expenses.find((expense) => expense.id === id);
          if (!existing) return d;
          const next = { ...existing, ...p };
          const nextBalanceImpactApplied = expenseBalanceDeltas(next, 1).length > 0;
          let accounts = d.accounts;
          if (existing.balanceImpactApplied) {
            accounts = applyAccountDeltas(accounts, expenseBalanceDeltas(existing, -1));
          }
          if (nextBalanceImpactApplied) {
            accounts = applyAccountDeltas(accounts, expenseBalanceDeltas(next, 1));
          }
          return {
            ...d,
            expenses: patchItem(d.expenses, id, {
              ...p,
              balanceImpactApplied: nextBalanceImpactApplied,
            }),
            accounts,
          };
        }),
      deleteExpense: (id) =>
        update((d) => {
          const existing = d.expenses.find((expense) => expense.id === id);
          if (!existing) return d;
          return {
            ...d,
            expenses: removeItem(d.expenses, id),
            accounts: existing.balanceImpactApplied
              ? applyAccountDeltas(d.accounts, expenseBalanceDeltas(existing, -1))
              : d.accounts,
          };
        }),

      addFixedCost: (e) =>
        update((d) => ({
          ...d,
          fixedCosts: [...d.fixedCosts, armFixedCost({ ...(e as FixedCost), id: uid() }, new Date())],
        })),
      updateFixedCost: (id, p) =>
        update((d) => ({
          ...d,
          fixedCosts: d.fixedCosts.map((f) =>
            f.id === id ? armFixedCost({ ...f, ...p }, new Date()) : f,
          ),
        })),
      deleteFixedCost: (id) => update((d) => ({ ...d, fixedCosts: removeItem(d.fixedCosts, id) })),

      addAccount: (e) => update((d) => ({ ...d, accounts: withItem(d.accounts, e) })),
      updateAccount: (id, p) => update((d) => ({ ...d, accounts: patchItem(d.accounts, id, p) })),
      deleteAccount: (id) => update((d) => ({ ...d, accounts: removeItem(d.accounts, id) })),

      addDebt: (e) => update((d) => ({ ...d, debts: withItem(d.debts, e) })),
      updateDebt: (id, p) => update((d) => ({ ...d, debts: patchItem(d.debts, id, p) })),
      deleteDebt: (id) => update((d) => ({ ...d, debts: removeItem(d.debts, id) })),

      setSavingsGoal: (amount) =>
        update((d) => ({ ...d, savingsGoal: amount > 0 ? amount : undefined })),

      replaceData: (incoming) =>
        setData({ ...incoming, version: incoming.version ?? DATA_VERSION }),
      resetDemoData: () => setData(makeDemoData()),
      clearAllData: () => setData(emptyData()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, selectedMonth, syncStatus, lastSyncedAt, cloudActive]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
