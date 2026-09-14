-- Onboarding, phase 2: the per-tier process and a client's frozen checklist.
--
-- Same authoring/runtime split as 0014, and for the same reason:
--
--   Authoring   onboarding_stages     the process you define once per tier
--   Runtime     onboarding_run_steps  one client's copy, with ticks
--
-- A run snapshots its steps when it starts, so improving your process never
-- rewrites the checklist of a client already mid-onboarding — no step
-- appearing or vanishing under someone halfway through. "Re-sync from
-- template" pulls changes in deliberately; nothing is silent.
--
-- Requires Postgres 15+ for the ON DELETE SET NULL (column) syntax.

-- ---------------------------------------------------------------- authoring

create table public.onboarding_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier_id uuid not null,
  -- Deliberately NOT unique. Unique positions turn every reorder into a
  -- temp-value dance to dodge the constraint mid-swap. Ties break on
  -- created_at, so ordering stays deterministic without one.
  position integer not null default 0,
  -- Relative to kickoff: 0 is kickoff day, negatives are before it. Nullable,
  -- because not every stage is tied to a day.
  day_offset integer,
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_stages_id_user_id_key unique (id, user_id),
  constraint onboarding_stages_tier_fkey
    foreign key (tier_id, user_id) references public.tiers (id, user_id)
    on delete cascade
);

create index onboarding_stages_tier_idx
  on public.onboarding_stages (tier_id, position, created_at);

-- ----------------------------------------------------------------- runtime

create table public.onboarding_run_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null,
  -- Provenance only, and what re-sync matches on. Nothing reads through it:
  -- title/notes/day_offset below are this client's own frozen copy.
  stage_id uuid,
  position integer not null default 0,
  day_offset integer,
  title text not null,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint onboarding_run_steps_run_fkey
    foreign key (run_id, user_id) references public.onboarding_runs (id, user_id)
    on delete cascade,
  -- The column list is load-bearing, exactly as in 0014: a bare SET NULL on a
  -- composite FK nulls user_id too, which is NOT NULL, so deleting a stage any
  -- client had received would fail with 23502 instead of softening the link.
  constraint onboarding_run_steps_stage_fkey
    foreign key (stage_id, user_id)
    references public.onboarding_stages (id, user_id)
    on delete set null (stage_id)
);

create index onboarding_run_steps_run_idx
  on public.onboarding_run_steps (run_id, position, created_at);

-- ------------------------------------------------------------ access control

alter table public.onboarding_stages    enable row level security;
alter table public.onboarding_run_steps enable row level security;

grant select, insert, update, delete on public.onboarding_stages    to authenticated;
grant select, insert, update, delete on public.onboarding_run_steps to authenticated;

create policy "Users read own onboarding_stages" on public.onboarding_stages for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own onboarding_stages" on public.onboarding_stages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own onboarding_stages" on public.onboarding_stages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own onboarding_stages" on public.onboarding_stages for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own onboarding_run_steps" on public.onboarding_run_steps for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own onboarding_run_steps" on public.onboarding_run_steps for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own onboarding_run_steps" on public.onboarding_run_steps for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own onboarding_run_steps" on public.onboarding_run_steps for delete to authenticated using ((select auth.uid()) = user_id);
