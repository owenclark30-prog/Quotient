-- "Price this client": delivery-cost settings, per-tier hours, and the frozen
-- pricing snapshot on a proposal.
--
-- NOTHING HERE TOUCHES pricing_rules. The rate card stays the single source of
-- the agency's standard fees; this feature only reads it for a verdict.
--
-- Requires Postgres 15+ for ON DELETE SET NULL (column), consistent with 0014.

-- ------------------------------------------------- 1. agency cost settings
--
-- Separate from `settings` rather than more columns on it. `settings` is the
-- agency's client-facing identity — name, logo, email — and is read on every
-- proposal render. Delivery economics are a different concern, read only by
-- this feature, and keeping them apart means the proposal path never pulls
-- the agency's margin into memory alongside what a client sees.

create table public.agency_cost_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hourly_cost numeric(10, 2) not null default 25,
  -- Fraction, not a percentage: used directly as (1 - g). Capped below 1 so
  -- the floor formula can never divide by zero.
  target_margin numeric(4, 3) not null default 0.5,
  tool_cost_monthly numeric(10, 2) not null default 40,
  conservatism_factor numeric(4, 3) not null default 0.7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_cost_settings_hourly_cost_check
    check (hourly_cost >= 0),
  constraint agency_cost_settings_target_margin_check
    check (target_margin >= 0 and target_margin <= 0.95),
  constraint agency_cost_settings_tool_cost_check
    check (tool_cost_monthly >= 0),
  constraint agency_cost_settings_conservatism_check
    check (conservatism_factor > 0 and conservatism_factor <= 1)
);

-- --------------------------------------------- 2. per-tier delivery hours
--
-- Columns on `tiers`, not a separate tier_delivery_costs table.
--
-- Reasoning: the relationship is strictly 1:1 and mandatory-ish — every tier
-- has delivery hours, there is never more than one row, and there is no
-- history to keep. A side table would buy nothing and cost a join on a hot
-- path (the rate card and the calculator both already load tiers), plus
-- another composite-FK + RLS surface to keep in step. Columns also mean the
-- hours cascade with the tier automatically.
--
-- Nullable, with the app falling back to the 12/25/40 and 2/4/6 defaults by
-- level. NULL means "never set", which is different from a deliberate 0, and
-- existing tiers stay valid without a backfill.

alter table public.tiers
  add column setup_hours numeric(6, 2),
  add column support_hours numeric(6, 2);

alter table public.tiers
  add constraint tiers_setup_hours_check
    check (setup_hours is null or setup_hours >= 0),
  add constraint tiers_support_hours_check
    check (support_hours is null or support_hours >= 0);

-- --------------------------------------------- 3. the proposal's snapshot
--
-- One nullable jsonb column holding the levers chosen, every input, which
-- defaults were in play, and every computed output — frozen at save time like
-- agency_name, tier_name and the fees before it. A saved proposal renders its
-- own numbers and never recalculates, so changing your cost settings or the
-- defaults cannot rewrite a proposal already sent.
--
-- Nullable on purpose: every existing proposal keeps NULL and renders exactly
-- as it does today. The UI hides the "Expected return" section when it's null.

alter table public.proposals add column pricing_inputs jsonb;

comment on column public.proposals.pricing_inputs is
  'Frozen "Price this client" snapshot: levers, inputs, defaults used and computed outputs. NULL for proposals priced straight from the rate card. Never recalculated on read.';

-- ------------------------------------------------------------ access control

alter table public.agency_cost_settings enable row level security;

grant select, insert, update, delete on public.agency_cost_settings to authenticated;

create policy "Users read own agency_cost_settings" on public.agency_cost_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own agency_cost_settings" on public.agency_cost_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own agency_cost_settings" on public.agency_cost_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own agency_cost_settings" on public.agency_cost_settings for delete to authenticated using ((select auth.uid()) = user_id);

-- tiers and proposals already carry their own per-user RLS; the new columns
-- inherit it, so there is nothing further to grant.
