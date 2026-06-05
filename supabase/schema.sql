-- ============================================================================
-- Finance Tracker — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query.
-- ============================================================================
-- Stores each user's whole dataset as a single JSON row, protected by Row Level
-- Security so a user can only ever read/write their OWN row.

create table if not exists public.finance_data (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_data enable row level security;

-- A user may read their own row.
create policy "finance_data_select_own"
  on public.finance_data for select
  using (auth.uid() = user_id);

-- A user may create their own row.
create policy "finance_data_insert_own"
  on public.finance_data for insert
  with check (auth.uid() = user_id);

-- A user may update their own row.
create policy "finance_data_update_own"
  on public.finance_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (Optional) A user may delete their own row.
create policy "finance_data_delete_own"
  on public.finance_data for delete
  using (auth.uid() = user_id);
