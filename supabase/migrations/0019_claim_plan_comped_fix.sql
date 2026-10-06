-- Fix: a comped account with no plan was sold Standard even when founder spots
-- were free.
--
-- claim_plan short-circuited on `comped` alone and returned
-- coalesce(plan, 'standard'). For someone who had been a paying founder before
-- being comped that is right — the comp sits on top of a price they earned. For
-- an account that has never bought anything, and `comped` is exactly the flag
-- the owner's own account carries, it meant clicking Subscribe bought £39/mo
-- while twenty-five £29 spots sat unclaimed.
--
-- Caught by running the documented setup in order: comp the account, then test
-- checkout. Reproduced in a transaction — a comped user and an ordinary user
-- claiming side by side got 'standard' and 'founder' respectively.
--
-- Now: a comped account that already holds a plan keeps it; one with no plan
-- goes through the ordinary slot logic like anyone else.

create or replace function public.claim_plan(p_user_id uuid)
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

  -- A comped account that already holds a plan keeps it, with no Stripe
  -- subscription to check. One with no plan has never bought anything, so if it
  -- chooses to start paying it is priced like any other new customer.
  if v_existing.comped and v_existing.plan is not null then
    return v_existing.plan;
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
        -- Everything below belongs to the subscription being replaced, and
        -- only a user with no live subscription reaches this line. `comped` is
        -- deliberately absent: it is set by hand and checkout must not clear it.
        stripe_subscription_id = null,
        status = null,
        current_period_end = null,
        past_due_since = null,
        cancel_at_period_end = false,
        updated_at = now();

  return v_plan;
end;
$$;

-- CREATE OR REPLACE keeps the existing grants, but re-stating them costs
-- nothing and means this file is complete on its own.
revoke execute on function public.claim_plan(uuid) from public, anon, authenticated;
grant execute on function public.claim_plan(uuid) to service_role;
