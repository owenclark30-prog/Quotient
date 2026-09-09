-- Onboarding, phase 1: document templates and the frozen copies a client gets.
--
-- Two halves, and the split is the whole point:
--
--   Authoring   onboarding_documents, tier_onboarding_documents
--               The agency's own reusable assets. Edit and delete freely.
--
--   Runtime     onboarding_runs, onboarding_run_documents
--               One record per client engagement, holding frozen copies with
--               placeholders already filled. Nothing here reads a template
--               again, so improving a template never rewrites a welcome pack
--               that has already gone out — the same rule fees, tier names and
--               agency identity already follow.
--
-- Phase 2 adds onboarding_stages and onboarding_run_steps (the checklist) to
-- the same run, which is why the run exists as its own table now rather than
-- hanging documents directly off the proposal.
--
-- Requires Postgres 15+ for the ON DELETE SET NULL (column) syntax below.

-- ---------------------------------------------------------------- authoring

create table public.onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_documents_user_id_name_key unique (user_id, name),
  -- Composite FK target, so a tier can only ever reference its owner's docs.
  constraint onboarding_documents_id_user_id_key unique (id, user_id)
);

-- Which documents a tier pre-selects when a proposal for it is generated.
create table public.tier_onboarding_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  tier_id uuid not null,
  document_id uuid not null,
  primary key (tier_id, document_id),
  constraint tier_onboarding_documents_tier_fkey
    foreign key (tier_id, user_id) references public.tiers (id, user_id)
    on delete cascade,
  constraint tier_onboarding_documents_document_fkey
    foreign key (document_id, user_id)
    references public.onboarding_documents (id, user_id) on delete cascade
);

-- ----------------------------------------------------------------- runtime

-- A client's onboarding. client_name and tier_name are snapshots, so this
-- survives the proposal being deleted and the tier being renamed — deleting a
-- quote must not destroy the record of work being done for a client.
create table public.onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  tier_id uuid,
  client_name text not null,
  tier_name text not null,
  created_at timestamptz not null default now(),
  constraint onboarding_runs_id_user_id_key unique (id, user_id),
  -- The column list on SET NULL is load-bearing. A composite FK with a bare
  -- ON DELETE SET NULL nulls EVERY referencing column, user_id included — and
  -- user_id is NOT NULL, so deleting a tier failed with 23502 instead of
  -- softening the link. Naming the column keeps both properties: cross-user
  -- links are impossible, and the parent can still be deleted.
  constraint onboarding_runs_tier_fkey
    foreign key (tier_id, user_id) references public.tiers (id, user_id)
    on delete set null (tier_id)
);

-- The document as the client received it. document_id is a soft link kept only
-- so the UI can say which template it came from; nothing reads through it.
create table public.onboarding_run_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  run_id uuid not null,
  document_id uuid,
  name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint onboarding_run_documents_run_fkey
    foreign key (run_id, user_id) references public.onboarding_runs (id, user_id)
    on delete cascade,
  -- Same column-list requirement as onboarding_runs_tier_fkey above:
  -- without it, deleting a template that any client has received throws.
  constraint onboarding_run_documents_document_fkey
    foreign key (document_id, user_id)
    references public.onboarding_documents (id, user_id)
    on delete set null (document_id)
);

create index onboarding_run_documents_run_idx
  on public.onboarding_run_documents (run_id);
create index onboarding_runs_proposal_idx
  on public.onboarding_runs (proposal_id);

-- ------------------------------------------------------------ access control

-- Supabase auto-enables RLS on new tables, so without these the publishable
-- key cannot see them at all.
alter table public.onboarding_documents       enable row level security;
alter table public.tier_onboarding_documents  enable row level security;
alter table public.onboarding_runs            enable row level security;
alter table public.onboarding_run_documents   enable row level security;

grant select, insert, update, delete on public.onboarding_documents      to authenticated;
grant select, insert, update, delete on public.tier_onboarding_documents to authenticated;
grant select, insert, update, delete on public.onboarding_runs           to authenticated;
grant select, insert, update, delete on public.onboarding_run_documents  to authenticated;

create policy "Users read own onboarding_documents" on public.onboarding_documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own onboarding_documents" on public.onboarding_documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own onboarding_documents" on public.onboarding_documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own onboarding_documents" on public.onboarding_documents for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own tier_onboarding_documents" on public.tier_onboarding_documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own tier_onboarding_documents" on public.tier_onboarding_documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own tier_onboarding_documents" on public.tier_onboarding_documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own tier_onboarding_documents" on public.tier_onboarding_documents for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own onboarding_runs" on public.onboarding_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own onboarding_runs" on public.onboarding_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own onboarding_runs" on public.onboarding_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own onboarding_runs" on public.onboarding_runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own onboarding_run_documents" on public.onboarding_run_documents for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own onboarding_run_documents" on public.onboarding_run_documents for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own onboarding_run_documents" on public.onboarding_run_documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own onboarding_run_documents" on public.onboarding_run_documents for delete to authenticated using ((select auth.uid()) = user_id);
