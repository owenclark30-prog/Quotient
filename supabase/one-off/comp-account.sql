-- One-off, run by hand. Not a migration: it names specific people.
--
-- Comping an account grants access with no Stripe subscription behind it. It is
-- the flag the owner's own account uses, and the one to reach for when someone
-- needs letting in outside billing — a support case, a refund in flight, a
-- partner.
--
-- `comped` is only ever set this way. The app has no grant that would let a
-- user set it on themselves, and claim_plan never touches it.
--
-- Safe to re-run: the upsert leaves everything else alone.

insert into public.subscriptions (user_id, comped)
select id, true
from auth.users
where email = 'owen.clark30@gmail.com'
on conflict (user_id) do update
  set comped = true,
      updated_at = now();

-- Check it landed. Expect one row, comped = true.
select u.email, s.comped, s.plan, s.status
from public.subscriptions s
join auth.users u on u.id = s.user_id
where s.comped;

-- To take it away again:
--
--   update public.subscriptions set comped = false, updated_at = now()
--   where user_id = (select id from auth.users where email = '...');
--
-- Note what that does NOT do: if they have no Stripe subscription, removing the
-- flag locks them out at the next page load. That is the intended behaviour, but
-- it is worth knowing before running it on someone who is mid-proposal.
