-- The fees are always supplied by the app at save time. Dropping the defaults
-- means a malformed insert raises a not-null violation instead of quietly
-- saving a £0 proposal.
alter table proposals
  alter column setup_fee drop default,
  alter column monthly_fee drop default;
