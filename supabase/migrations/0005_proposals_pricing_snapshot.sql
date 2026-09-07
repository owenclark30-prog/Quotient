-- Freeze the rate card onto each proposal at save time, so reopening a saved
-- proposal shows the numbers it was sent with even if pricing_rules changes.
alter table proposals
  add column setup_fee numeric(10, 2) not null default 0,
  add column monthly_fee numeric(10, 2) not null default 0,
  add column founding_setup_fee numeric(10, 2),
  add column founding_monthly_fee numeric(10, 2),
  add column founding_duration_months int;
