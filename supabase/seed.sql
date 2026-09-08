-- OPTIONAL. Seeds one account's rate card with a sample offer.
--
-- New accounts are meant to start EMPTY and build their own rate card in the
-- app — this file is not part of normal setup. It exists so a fresh
-- environment can be populated with something to click through.
--
-- Set target_user below to the account that should own these rows:
--   select id from auth.users where email = 'you@example.com';

do $$
declare
  target_user uuid := '00000000-0000-0000-0000-000000000000'; -- <-- replace
  tier1 uuid;
  tier2 uuid;
  tier3 uuid;
begin
  if not exists (select 1 from auth.users where id = target_user) then
    raise exception 'Set target_user to a real auth.users id before running this file';
  end if;

  insert into public.services (user_id, name, description) values
    (target_user, 'Missed Call Text Back',   'Automatically texts back missed calls so no enquiry goes cold.'),
    (target_user, 'Multichannel Capture',    'Captures leads from calls, forms, DMs and web chat into one pipeline.'),
    (target_user, 'Qualification Logic',     'Screens and scores leads against your criteria before they reach a human.'),
    (target_user, 'Direct Calendar Booking', 'Lets qualified leads book straight into your calendar, no back-and-forth.'),
    (target_user, 'Reminder Sequence',       'Automated appointment reminders to cut no-shows.'),
    (target_user, 'Review Automation',       'Requests and collects reviews automatically after a completed visit.'),
    (target_user, 'AI Voice Reception',      'AI-handled inbound calls for after-hours and overflow coverage.'),
    (target_user, 'Reactivation Campaigns',  'Automated win-back campaigns for dormant leads and past clients.');

  insert into public.tiers (user_id, name, level, description)
  values (target_user, 'Missed Enquiry Recovery', 1, 'Catches and recovers enquiries you would otherwise lose.')
  returning id into tier1;

  insert into public.tiers (user_id, name, level, description)
  values (target_user, 'Full Front-Desk System', 2, 'A complete front-desk replacement: capture, qualify, book, remind, review.')
  returning id into tier2;

  insert into public.tiers (user_id, name, level, description)
  values (target_user, 'Complete Patient Comms', 3, 'Full front-desk system plus AI voice reception and reactivation.')
  returning id into tier3;

  insert into public.tier_services (user_id, tier_id, service_id)
  select target_user, tier1, s.id from public.services s
  where s.user_id = target_user
    and s.name in ('Missed Call Text Back', 'Multichannel Capture');

  insert into public.tier_services (user_id, tier_id, service_id)
  select target_user, tier2, s.id from public.services s
  where s.user_id = target_user
    and s.name in ('Missed Call Text Back', 'Multichannel Capture', 'Qualification Logic',
                   'Direct Calendar Booking', 'Reminder Sequence', 'Review Automation');

  insert into public.tier_services (user_id, tier_id, service_id)
  select target_user, tier3, s.id from public.services s
  where s.user_id = target_user;

  insert into public.pricing_rules
    (user_id, tier_id, industry_id, setup_fee, monthly_fee,
     founding_setup_fee, founding_monthly_fee, founding_duration_months)
  values
    (target_user, tier1, null,  497, 197, null, null, null),
    (target_user, tier2, null,  997, 297,  497,  197,    3),
    (target_user, tier3, null, 1497, 497, null, null, null);
end $$;
