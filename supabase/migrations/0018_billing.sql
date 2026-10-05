-- Billing: subscriptions, the founder-slot claim, and webhook idempotency.
--
-- TEST MODE. Every Stripe id stored by this schema comes from a test-mode
-- account; nothing here assumes otherwise.
--
-- Shape of the thing: Stripe is the source of truth for money, this table is a
-- local cache of it so the app can answer "does this user have access?" without
-- a network call on every page. Only server code holding the service role ever
-- writes to it. The browser gets SELECT on its own row and nothing else.

-- --------------------------------------------------------- 1. subscriptions

create table public.subscriptions (
  -- One row per user, so the primary key is the uniqueness constraint asked
  -- for. Matches `settings` and `agency_cost_settings`, which key the same way.
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Unique because two users sharing either id would mean one person's card
  -- paying for another's access.
  stripe_customer_id text unique,
  stripe_subscription_id text unique,

  -- Stripe's own subscription status, stored verbatim and deliberately NOT
  -- constrained: Stripe has added statuses before (`paused`) and will again. A
  -- CHECK here would turn a new status into a failed webhook, which loses the
  -- update entirely — far worse than storing a string the app doesn't know.
  -- lib/billing.ts decides what each status means; see founder_slot_statuses().
  status text,

  plan text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,

  -- Access granted by hand, outside Stripe: the owner's own account, support
  -- cases, anyone being comped. Set by SQL, never by the app.
  comped boolean not null default false,

  -- When the subscription first went past_due, cleared when it recovers. The
  -- grace period in lib/billing.ts is measured from here.
  past_due_since timestamptz,

  -- When this user last claimed a plan at checkout. Only meaningful while
  -- stripe_subscription_id is still null — see founder_slots_used().
  claimed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_plan_check
    check (plan is null or plan in ('founder', 'standard'))
);

comment on table public.subscriptions is
  'Local cache of each user''s Stripe subscription. Written only by server code holding the service role; the browser may read its own row.';

comment on column public.subscriptions.status is
  'Stripe subscription status, verbatim and unconstrained on purpose so a status Stripe adds later cannot fail a webhook.';

-- ------------------------------------------------------- 2. founder slots

-- The limit, in one place, so the claim function and the "X of 25 left" count
-- can never disagree about what full means.
create function public.founder_slot_limit()
returns integer
language sql
immutable
as $$ select 25 $$;

-- The statuses that still hold a slot. Everything else -- canceled,
-- incomplete_expired, unpaid -- has lost it.
--
-- `past_due` holds deliberately: a founder whose card bounced for a week has
-- not given up their price, and releasing the slot would let someone else take
-- it while they were still being retried.
create function public.founder_slot_statuses()
returns text[]
language sql
immutable
as $$ select array['active', 'trialing', 'past_due', 'incomplete', 'paused'] $$;

-- How long a claim made at checkout holds a slot before Stripe has confirmed
-- anything. Without an expiry, twenty-five abandoned checkouts would close the
-- founder tier permanently.
create function public.founder_claim_ttl()
returns interval
language sql
immutable
as $$ select interval '30 minutes' $$;

-- How many of the 25 are currently spoken for.
--
-- `p_exclude_user` leaves one user out of the count. The claim function passes
-- the person claiming, because their own half-finished claim from a minute ago
-- must not be the thing that tells them the tier is full.
create function public.founder_slots_used(p_exclude_user uuid default null)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.subscriptions
  where plan = 'founder'
    and (p_exclude_user is null or user_id <> p_exclude_user)
    and (
      comped
      or status = any (public.founder_slot_statuses())
      or (stripe_subscription_id is null
          and claimed_at is not null
          and claimed_at > now() - public.founder_claim_ttl())
    )
$$;

-- Claim a plan for one user, and record it. Returns 'founder' or 'standard'.
--
-- Race safety: the question "are fewer than 25 taken?" is a predicate over rows
-- that do not exist yet, so no row lock can cover it -- two transactions can
-- both count 24 and both insert. The advisory lock is what stands between them.
-- It is transaction-scoped (`_xact_`), not session-scoped, which is the only
-- variant that is safe behind a transaction-mode connection pooler: it is
-- released on commit or rollback rather than left on a pooled connection.
--
-- Called in a single `select claim_plan(...)` statement, so the implicit
-- transaction around that statement is the lock's lifetime.
create function public.claim_plan(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.subscriptions%rowtype;
  v_plan text;
begin
  if p_user_id is null then
    raise exception 'claim_plan requires a user id';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('quotient'), hashtext('founder_slots')
  );

  select * into v_existing
  from public.subscriptions
  where user_id = p_user_id;

  -- Someone with a live subscription keeps the plan they are already paying
  -- for. The checkout route turns these people away before they get here and
  -- sends them to the billing portal; this is the backstop, and it is what
  -- stops a second trip through checkout from silently repricing anyone.
  if v_existing.stripe_subscription_id is not null
     and v_existing.status = any (public.founder_slot_statuses()) then
    return v_existing.plan;
  end if;

  -- A comped founder has no Stripe subscription to check, and still keeps it.
  if v_existing.plan = 'founder' and v_existing.comped then
    return 'founder';
  end if;

  if public.founder_slots_used(p_user_id) < public.founder_slot_limit() then
    v_plan := 'founder';
  else
    v_plan := 'standard';
  end if;

  insert into public.subscriptions (user_id, plan, claimed_at)
  values (p_user_id, v_plan, now())
  on conflict (user_id) do update
    set plan = excluded.plan,
        claimed_at = excluded.claimed_at,
        updated_at = now();

  return v_plan;
end;
$$;

-- ------------------------------------------- 3. webhook idempotency ledger

-- Stripe retries a webhook until it gets a 2xx, and will happily deliver the
-- same event twice on its own. Every handler checks this table first.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Stripe event ids already processed. The primary key is the idempotency guarantee: a duplicate delivery fails the insert and the handler stops.';

-- ------------------------------------------------------------ access control

alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

-- Read-only, own row only. No insert, update or delete grant to any browser
-- role, and no policy for them either -- a user must not be able to write
-- themselves a subscription, flip `comped`, or move `current_period_end`.
-- Every write goes through server code holding the service role, which bypasses
-- RLS by design.
grant select on public.subscriptions to authenticated;

create policy "Users read own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

-- stripe_events gets no grants and no policies at all. Only the service role.

-- The functions are SECURITY DEFINER, so they run as the owner and see through
-- RLS. claim_plan takes a user id as an argument, which means EXECUTE on it is
-- the right to claim a plan for *any* user -- so no browser role gets it.
-- founder_slots_used is kept private for the same reason: its p_exclude_user
-- argument would let a caller test whether one specific user holds a slot by
-- diffing two counts. The /subscribe page reads the count through a server
-- route instead.
revoke all on function public.claim_plan(uuid) from public, anon, authenticated;
revoke all on function public.founder_slots_used(uuid) from public, anon, authenticated;

grant execute on function public.claim_plan(uuid) to service_role;
grant execute on function public.founder_slots_used(uuid) to service_role;
