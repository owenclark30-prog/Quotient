-- Fix: comped accounts were counted against the 25 public founder spots.
--
-- founder_slots_used counted a row when it was `comped OR live OR freshly
-- claimed`. The owner's own account is comped with plan 'founder', so with no
-- paying founders at all the landing page and /subscribe showed "24 of 25".
-- A comp is granted by hand, outside the public offer, and must not use up a
-- spot someone could buy.
--
-- Now a comped row never counts, whatever its status. claim_plan needs no change
-- of its own: it asks this function whether a spot is free, so the fix reaches
-- checkout and /api/billing/founder-slots together. A comped account that holds
-- the founder plan still keeps it (0019); it just no longer occupies a public
-- spot while doing so.
--
-- Same signature, so CREATE OR REPLACE keeps the existing grants; they are
-- restated below so this file is complete on its own.

create or replace function public.founder_slots_used(p_exclude_user uuid default null)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.subscriptions
  where plan = 'founder'
    and not comped
    and (p_exclude_user is null or user_id <> p_exclude_user)
    and (
      status = any (public.founder_slot_statuses())
      or (stripe_subscription_id is null
          and claimed_at is not null
          and claimed_at > now() - public.founder_claim_ttl())
    )
$$;

revoke execute on function public.founder_slots_used(uuid) from public, anon, authenticated;
grant execute on function public.founder_slots_used(uuid) to service_role;
