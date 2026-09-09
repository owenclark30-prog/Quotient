-- Agency identity: logo, contact email and website.
--
-- All three are optional, so unlike agency_name and the fees these stay
-- nullable — NULL means "not set", not a malformed insert.
--
-- The logo is stored as a data URI rather than a file in a storage bucket.
-- That is a deliberate trade of row size for two properties this app depends
-- on:
--
--   1. Snapshot integrity. A proposal must render exactly as it was sent,
--      forever. A URL to a mutable file breaks that — replace your logo and
--      every proposal you have already sent silently changes; delete it and
--      they 404. Bytes on the proposal row cannot be retroactively rewritten.
--   2. Printing. An external image can lose the race with the print dialog and
--      come out blank. A data URI is already in the document.
--
-- Logos are downscaled client-side before they get here, so these stay small.

alter table public.settings
  add column logo text,
  add column contact_email text,
  add column website text;

-- Frozen onto the proposal at save time, exactly like agency_name, tier_name
-- and industry_name before them. A saved proposal reads only its own row.
alter table public.proposals
  add column agency_logo text,
  add column agency_email text,
  add column agency_website text;
