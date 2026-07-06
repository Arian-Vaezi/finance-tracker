import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Landmark,
  LayoutDashboard,
  Moon,
  ReceiptText,
  RefreshCw,
  Repeat2,
  Scale,
  Settings2,
  Siren,
  Sun,
  Wallet,
} from 'lucide-react';
import { useStore } from './store';
import { useAuth } from './auth';
import { useTheme } from './components/theme-provider';
import { addMonths, monthLabel } from './lib/format';
import { Segmented } from './components/ui';
import { Button } from '@/components/ui/button';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
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
  icon: typeof LayoutDashboard;
}

const NAV: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: Wallet },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'fixed', label: 'Fixed costs', icon: Repeat2 },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'debt', label: 'Debt', icon: Scale },
  { id: 'settings', label: 'Data', icon: Settings2 },
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

const PAGES: Record<Tab, () => ReturnType<typeof Dashboard>> = {
  dashboard: Dashboard,
  income: Income,
  expenses: Expenses,
  fixed: FixedCosts,
  accounts: Accounts,
  debt: DebtPage,
  panic: PanicMode,
  settings: Settings,
};

function MonthSelector() {
  const { selectedMonth, setSelectedMonth } = useStore();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-card px-1 py-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium">
        {monthLabel(selectedMonth)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
        aria-label="Next month"
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
    >
      {resolved === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

const SYNC_STYLE: Record<string, { label: string; dot: string }> = {
  syncing: { label: 'Syncing…', dot: 'bg-warning animate-pulse' },
  synced: { label: 'Synced', dot: 'bg-success' },
  error: { label: 'Sync error', dot: 'bg-destructive' },
  idle: { label: 'Synced', dot: 'bg-success' },
};

function SyncPill({ status }: { status: string }) {
  const s = SYNC_STYLE[status] ?? SYNC_STYLE.idle;
  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex"
      title="Cloud sync status"
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

/** Sidebar nav; lives inside SidebarProvider so it can close the mobile sheet. */
function AppSidebar({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  const { setOpenMobile } = useSidebar();
  const select = (t: Tab) => {
    onSelect(t);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground"
          >
            €
          </span>
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Finance
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    isActive={tab === n.id}
                    tooltip={n.label}
                    onClick={() => select(n.id)}
                  >
                    <n.icon />
                    <span>{n.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={tab === 'panic'}
              tooltip="Panic Mode"
              onClick={() => select('panic')}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive data-[active=true]:bg-destructive/10 data-[active=true]:text-destructive"
            >
              <Siren />
              <span>Panic Mode</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { mode, setMode, cloudActive, syncStatus } = useStore();
  const { configured, session } = useAuth();

  const Page = PAGES[tab];

  return (
    <TooltipProvider>
    <SidebarProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppSidebar tab={tab} onSelect={setTab} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-base font-semibold tracking-tight">{TITLES[tab]}</h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {cloudActive && <SyncPill status={syncStatus} />}
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
            <ThemeToggle />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className={cn(
            'flex-1 px-4 py-5 outline-none md:px-6',
            tab === 'panic' && 'bg-destructive/5',
          )}
        >
          <div className="mx-auto w-full max-w-5xl">
            {mode === 'demo' && (
              <Alert className="mb-4">
                <Eye aria-hidden />
                <AlertDescription>
                  You're viewing <strong>demo data</strong> — all figures are fictional.
                </AlertDescription>
                <AlertAction>
                  <Button variant="outline" size="sm" onClick={() => setMode('personal')}>
                    Switch to Personal
                  </Button>
                </AlertAction>
              </Alert>
            )}

            {mode === 'personal' && configured && !session && (
              <Alert className="mb-4">
                <RefreshCw aria-hidden />
                <AlertDescription>
                  Sign in to sync your data between your laptop and phone.
                </AlertDescription>
                <AlertAction>
                  <Button variant="outline" size="sm" onClick={() => setTab('settings')}>
                    Set up sync
                  </Button>
                </AlertAction>
              </Alert>
            )}

            <Page />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
