import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

// ---------------------------------------------------------------------------
// Modes & persistence
// ---------------------------------------------------------------------------
// The app keeps two completely separate datasets in localStorage:
//   - "personal": the owner's real data (starts empty, never shipped in source)
//   - "demo":     fictional data for portfolio visitors
// A small `mode` flag decides which one is active. This is what keeps real
// financial data out of the public repo and public demo.

export type Mode = 'personal' | 'demo';

const MODE_KEY = 'finance-tracker-mode';
const LEGACY_KEY = 'finance-tracker-data-v1'; // pre-modes single dataset
const DATA_KEYS: Record<Mode, string> = {
  personal: 'finance-tracker-personal-v1',
  demo: 'finance-tracker-demo-v1',
};

/** Light structural validation so corrupt/foreign data can't crash the app. */
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
    // storage full or disabled - nothing we can do
  }
}

/** One-time upgrade: move data saved before modes existed into the personal slot. */
function migrateLegacy(): void {
  const legacy = readData(LEGACY_KEY);
  if (legacy && !readData(DATA_KEYS.personal)) {
    writeData(DATA_KEYS.personal, legacy);
  }
}

function loadMode(): Mode {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === 'personal' || saved === 'demo') return saved;
  // First visit with no saved choice: returning owners (with personal data)
  // start in Personal mode; new visitors start in Demo mode.
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

  replaceData: (data: AppData) => void;
  resetDemoData: () => void; // restore fictional demo data
  clearAllData: () => void; // wipe the active dataset
}

const StoreContext = createContext<StoreValue | null>(null);

// Generic list helpers keep the CRUD methods tiny and consistent.
function withItem<T extends { id: string }>(list: T[], entry: Omit<T, 'id'>): T[] {
  return [...list, { ...(entry as T), id: uid() }];
}
function patchItem<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}
function removeItem<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    migrateLegacy();
    return loadMode();
  });
  const [data, setData] = useState<AppData>(() => loadForMode(mode));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth());

  // Persist the active dataset under the key for the current mode.
  useEffect(() => {
    writeData(DATA_KEYS[mode], data);
  }, [mode, data]);

  const setMode = (next: Mode) => {
    if (next === mode) return;
    localStorage.setItem(MODE_KEY, next);
    setData(loadForMode(next)); // load the other dataset...
    setModeState(next); // ...batched into one render, so it persists correctly
  };

  const value = useMemo<StoreValue>(() => {
    const update = (fn: (d: AppData) => AppData) => setData((d) => fn(d));

    return {
      data,
      mode,
      setMode,
      selectedMonth,
      setSelectedMonth,

      addIncome: (e) => update((d) => ({ ...d, incomes: withItem(d.incomes, e) })),
      updateIncome: (id, p) => update((d) => ({ ...d, incomes: patchItem(d.incomes, id, p) })),
      deleteIncome: (id) => update((d) => ({ ...d, incomes: removeItem(d.incomes, id) })),

      addExpense: (e) => update((d) => ({ ...d, expenses: withItem(d.expenses, e) })),
      updateExpense: (id, p) => update((d) => ({ ...d, expenses: patchItem(d.expenses, id, p) })),
      deleteExpense: (id) => update((d) => ({ ...d, expenses: removeItem(d.expenses, id) })),

      addFixedCost: (e) => update((d) => ({ ...d, fixedCosts: withItem(d.fixedCosts, e) })),
      updateFixedCost: (id, p) =>
        update((d) => ({ ...d, fixedCosts: patchItem(d.fixedCosts, id, p) })),
      deleteFixedCost: (id) => update((d) => ({ ...d, fixedCosts: removeItem(d.fixedCosts, id) })),

      addAccount: (e) => update((d) => ({ ...d, accounts: withItem(d.accounts, e) })),
      updateAccount: (id, p) => update((d) => ({ ...d, accounts: patchItem(d.accounts, id, p) })),
      deleteAccount: (id) => update((d) => ({ ...d, accounts: removeItem(d.accounts, id) })),

      addDebt: (e) => update((d) => ({ ...d, debts: withItem(d.debts, e) })),
      updateDebt: (id, p) => update((d) => ({ ...d, debts: patchItem(d.debts, id, p) })),
      deleteDebt: (id) => update((d) => ({ ...d, debts: removeItem(d.debts, id) })),

      replaceData: (incoming) =>
        setData({ ...incoming, version: incoming.version ?? DATA_VERSION }),
      resetDemoData: () => setData(makeDemoData()),
      clearAllData: () => setData(emptyData()),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, selectedMonth]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
