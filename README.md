# 💶 Finance Tracker

A clean, mobile-first **personal finance tracker** built for the reality of **variable monthly income**. It turns raw numbers into plain-language
advice: how much is safe to spend per day, whether fixed costs are too high, and —
crucially — how much money is *really* yours once debt is subtracted.

**Local-first** (all data lives in your browser), **no backend, no login, no tracking.**
Installable as a PWA. Built with **React + TypeScript + Vite**.

> 🔒 **Privacy by design:** the public source and demo contain only *fictional* data.
> Real financial data is entered in **Personal mode** and never leaves your browser.

<!-- Add real images to docs/screenshots/ then these will render -->
![Dashboard](docs/screenshots/dashboard.png)

| Panic Mode | Mobile |
| :--------: | :----: |
| ![Panic Mode](docs/screenshots/panic-mode.png) | ![Mobile](docs/screenshots/mobile.png) |

---

## Why I built it

Most budgeting apps assume a fixed salary. Mine doesn't exist — my income changes every month, some of it arrives late, and some of it may be borrowed. They can make a balance look healthier than it really is. I wanted one that answers a single question honestly:

> *"Given everything — variable income, fixed bills, and debt — how much can I
> actually spend today without getting into trouble?"*

So I built it, and used it as a portfolio project to practise production-quality
React + TypeScript, financial logic, and deployment.

## Features

- **Dashboard** — income, fixed costs, variable spending, remaining money, bank
  balance, total debt, **debt-aware real net worth**, and safe-to-spend per day/week.
- **Variable income tracking** — enter each payment manually; income is grouped by a
  **budget month** so money earned one month but spent the next counts correctly.
- **Expense tracking** — categorised, per-account, fully editable.
- **Fixed costs** — recurring bills you can add/edit/disable/delete, with payment dates.
- **Bank accounts** — manual balances and account types.
- **Debt tracking** — separate ledger with repayment progress; clearly *not* free money.
- **Safe-to-spend engine** — daily and weekly limits from what's left in the month.
- **Warning engine** — automatic alerts when:
  - fixed costs exceed 70% of income,
  - you're spending faster than the calendar,
  - the projected end-of-month balance goes negative,
  - your real net worth is much lower than your bank balance because of debt,
  - a fixed cost (e.g. health insurance) is about to be debited.
- **Panic Mode** — a stripped-down survival view: money left after rent + health
  insurance, this week's food budget, what to cut first, and whether you're spending
  borrowed money.
- **Personal / Demo modes** — keep real data private; show fictional data to visitors.
- **Data portability** — export to **CSV**, full **JSON backup/import**, reset demo data.
- **PWA** — installable to your phone home screen, works offline.
- **Responsive** — sidebar on desktop, bottom tab bar on mobile.

## Engineering Highlights

- **Local-first data persistence** — single serialisable `AppData` object mirrored to
  `localStorage`; survives refresh, exportable/importable, with structural validation
  on load so corrupt data can't crash the app.
- **Privacy-aware architecture** — Personal and Demo datasets are stored under separate
  keys and switched at runtime; no real data is ever hard-coded in source.
- **Financial forecasting logic** — projects end-of-month balance from current spending
  pace and compares budget-used vs. time-elapsed to detect overspending early.
- **Debt-aware net worth** — `real_net_worth = total_bank − total_debt`, surfaced
  everywhere so borrowed money is never mistaken for spendable money.
- **Budget warning engine** — pure functions turn the numbers into ranked,
  human-readable warnings (`danger` / `warning` / `info` / `safe`).
- **Pure, framework-free domain layer** — all money math lives in `src/lib/` with no
  React or DOM dependencies, making it easy to read, reason about, and test.
- **Responsive, accessible UI** — hand-built component library and charts, zero UI/chart
  dependencies, mobile-first CSS.
- **Resilience** — React error boundary with a one-click data-reset recovery screen.
- **Deployment-ready** — type-checked production build, Vercel config, and a dependency-free
  Node script that generates the PWA icons.

## Tech stack

| Area | Choice |
| ---- | ------ |
| Framework | React 18 + TypeScript (strict) |
| Build tool | Vite 5 |
| State | React Context + hooks (no external state lib) |
| Styling | Hand-written CSS (CSS variables, mobile-first) |
| Charts | Custom, dependency-free (CSS/flex bars) |
| Persistence | `localStorage` |
| PWA | Web app manifest + minimal service worker |
| Deploy | Vercel (static) |

**Zero runtime dependencies** beyond React itself — deliberately, to keep it small,
fast, and easy to audit.

## Run locally

Requires Node 18+.

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build -> dist/
npm run preview  # preview the production build locally
npm run icons    # (optional) regenerate the PWA icons
```

The dev server is exposed on your local network, so you can open the **Network** URL
it prints on your phone (same Wi-Fi) to test mobile.

## Deploy to Vercel

This is a static Vite app — deployment is zero-config.

**Option A — dashboard:**
1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), **Add New → Project** and import the repo.
3. Vercel auto-detects Vite (Build: `npm run build`, Output: `dist`). Click **Deploy**.

**Option B — CLI:**
```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production deploy
```

The included `vercel.json` pins the framework, build command, output directory, and an
SPA rewrite. Because the app stores everything in `localStorage`, the public deployment
shows **Demo mode** to visitors and never has access to any real data.

## Add to your phone (PWA)

1. Open the deployed site in your mobile browser.
2. **iОS Safari:** Share → *Add to Home Screen*.
   **Android Chrome:** menu → *Install app* / *Add to Home screen*.
3. Launch it from your home screen — it runs full-screen and works offline.

## Project structure

```
src/
  main.tsx              App entry (error boundary + service worker registration)
  App.tsx               Layout, navigation, mode toggle, demo banner
  store.tsx             Context store, Personal/Demo modes, localStorage persistence
  types.ts              Data model (AppData and friends)
  defaults.ts           Fictional demo data + empty dataset (no real data)
  index.css             Global styles (mobile-first, theme variables)
  lib/
    calculations.ts     Finance engine: summaries, warnings, advice, panic, budget month
    format.ts           Currency / date / month helpers
    csv.ts              CSV export + JSON backup/download
    gigShift.ts           Split-payment helper for variable gig income
  components/
    ui.tsx              Reusable UI primitives (Card, Stat, Modal, Segmented, …)
    charts.tsx          Dependency-free bar/proportion charts
    ErrorBoundary.tsx   Crash recovery screen
  pages/                One file per section (Dashboard, Income, Expenses, …)
public/                 manifest, service worker, icons
scripts/
  generate-icons.mjs    Dependency-free PNG icon generator
```

## How the safe-to-spend math works

For the selected month (full details in `src/lib/calculations.ts`):

```
monthly_income        = sum of income whose budget month is the month
fixed_costs           = sum of active fixed monthly costs
variable_spending     = sum of expense entries in the month
remaining_money       = monthly_income − fixed_costs − variable_spending
safe_to_spend_per_day = remaining_money / days_left (incl. today)
weekly_limit          = remaining_money / weeks_left

real_net_worth        = total_bank − total_debt
```

## Future improvements

- Recurring-income templates and auto-rollover of fixed costs each month.
- Optional charts over time (monthly trend, savings rate).
- Multi-currency support.
- Cloud sync behind an optional login (end-to-end encrypted) for cross-device use.
- Unit tests for the finance engine (the pure `lib/` layer is built for it).
- Category budgets and goals.

## License

MIT — see `LICENSE`. Personal project; use it freely.
