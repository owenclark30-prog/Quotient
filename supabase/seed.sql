-- Services
insert into services (name, description) values
  ('missed_call_text_back', 'Automatically texts back missed calls so no enquiry goes cold.'),
  ('multichannel_capture', 'Captures leads from calls, forms, DMs and web chat into one pipeline.'),
  ('qualification_logic', 'Screens and scores leads against your criteria before they reach a human.'),
  ('direct_calendar_booking', 'Lets qualified leads book straight into your calendar, no back-and-forth.'),
  ('reminder_sequence', 'Automated appointment reminders to cut no-shows.'),
  ('review_automation', 'Requests and collects reviews automatically after a completed visit.'),
  ('ai_voice_reception', 'AI-handled inbound calls for after-hours and overflow coverage.'),
  ('reactivation_campaigns', 'Automated win-back campaigns for dormant leads and past clients.');

-- Tiers
insert into tiers (name, level, description) values
  ('Missed Enquiry Recovery', 1, 'Catches and recovers enquiries you would otherwise lose.'),
  ('Full Front-Desk System', 2, 'A complete front-desk replacement: capture, qualify, book, remind, review.'),
  ('Complete Patient Comms', 3, 'Full front-desk system plus AI voice reception and reactivation.');

-- Tier <-> service mapping
insert into tier_services (tier_id, service_id)
select t.id, s.id
from tiers t
join services s on s.name in ('missed_call_text_back', 'multichannel_capture')
where t.level = 1;

insert into tier_services (tier_id, service_id)
select t.id, s.id
from tiers t
join services s on s.name in (
  'missed_call_text_back',
  'multichannel_capture',
  'qualification_logic',
  'direct_calendar_booking',
  'reminder_sequence',
  'review_automation'
)
where t.level = 2;

insert into tier_services (tier_id, service_id)
select t.id, s.id
from tiers t
join services s on s.name in (
  'missed_call_text_back',
  'multichannel_capture',
  'qualification_logic',
  'direct_calendar_booking',
  'reminder_sequence',
  'review_automation',
  'ai_voice_reception',
  'reactivation_campaigns'
)
where t.level = 3;

-- Pricing rules (generic, industry_id left null)
insert into pricing_rules (
  tier_id, industry_id, setup_fee, monthly_fee,
  founding_setup_fee, founding_monthly_fee, founding_duration_months
)
select t.id, null, 497, 197, null, null, null
from tiers t where t.level = 1;

insert into pricing_rules (
  tier_id, industry_id, setup_fee, monthly_fee,
  founding_setup_fee, founding_monthly_fee, founding_duration_months
)
select t.id, null, 997, 297, 497, 197, 3
from tiers t where t.level = 2;

insert into pricing_rules (
  tier_id, industry_id, setup_fee, monthly_fee,
  founding_setup_fee, founding_monthly_fee, founding_duration_months
)
select t.id, null, 1497, 497, null, null, null
from tiers t where t.level = 3;
