-- Snapshot the agency name onto each proposal at save time, so a saved
-- proposal doesn't change retroactively if the agency name is edited later.
alter table proposals add column agency_name text not null default '';
