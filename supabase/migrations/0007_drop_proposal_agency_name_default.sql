-- Same reasoning as 0006: the agency name is always supplied by the app at
-- save time, so the '' default only masked a malformed insert as a proposal
-- with a blank agency header.
alter table proposals alter column agency_name drop default;
