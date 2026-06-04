import { useState } from 'react';
import { useStore } from './store';
import { addMonths, monthLabel } from './lib/format';
import { Segmented } from './components/ui';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import Expenses from './pages/Expenses';
import FixedCosts from './pages/FixedCosts';
import Accounts from './pages/Accounts';
import DebtPage from './pages/Debt';
import PanicMode from './pages/PanicMode';
import Settings from './pages/Settings';

type Tab =
  | 'dashboard'
  | 'income'
  | 'expenses'
  | 'fixed'
  | 'accounts'
  | 'debt'
  | 'panic'
  | 'settings';

interface NavEntry {
  id: Tab;
  label: string;
  icon: string;
}

const NAV: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'income', label: 'Income', icon: '💶' },
  { id: 'expenses', label: 'Expenses', icon: '🧾' },
  { id: 'fixed', label: 'Fixed', icon: '🔁' },
  { id: 'accounts', label: 'Accounts', icon: '🏦' },
  { id: 'debt', label: 'Debt', icon: '⚖️' },
  { id: 'settings', label: 'Data', icon: '⚙️' },
];

const TITLES: Record<Tab, string> = {
  dashboard: 'Dashboard',
  income: 'Income',
  expenses: 'Expenses',
  fixed: 'Fixed costs',
  accounts: 'Bank accounts',
  debt: 'Debt',
  panic: 'Panic Mode',
  settings: 'Data & settings',
};

// Tabs that care about the selected-month picker.
const MONTH_TABS: Tab[] = ['dashboard', 'income', 'expenses', 'panic'];

function MonthSelector() {
  const { selectedMonth, setSelectedMonth } = useStore();
  return (
    <div className="month-selector">
      <button
        onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
        aria-label="Previous month"
      >
        ‹
      </button>
      <span className="month-label">{monthLabel(selectedMonth)}</span>
      <button
        onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
        aria-label="Next month"
      >
        ›
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { mode, setMode } = useStore();

  return (
    <div className={`app ${tab === 'panic' ? 'panic' : ''}`}>
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-logo">€</span>
          <span>Finance</span>
        </div>

        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}

        <button
          className={`nav-item nav-panic ${tab === 'panic' ? 'active' : ''}`}
          onClick={() => setTab('panic')}
        >
          <span className="nav-icon">🆘</span>
          <span>Panic</span>
        </button>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{TITLES[tab]}</div>
          <div className="topbar-right">
            <Segmented<typeof mode>
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'personal', label: 'Personal' },
                { value: 'demo', label: 'Demo' },
              ]}
            />
            {MONTH_TABS.includes(tab) && <MonthSelector />}
          </div>
        </header>

        {mode === 'demo' && (
          <div className="demo-banner">
            <span>
              👁️ You're viewing <strong>demo data</strong> — all figures are fictional.
            </span>
            <button className="btn btn--secondary" onClick={() => setMode('personal')}>
              Switch to Personal
            </button>
          </div>
        )}

        <main className="content">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'income' && <Income />}
          {tab === 'expenses' && <Expenses />}
          {tab === 'fixed' && <FixedCosts />}
          {tab === 'accounts' && <Accounts />}
          {tab === 'debt' && <DebtPage />}
          {tab === 'panic' && <PanicMode />}
          {tab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
