-- Price rounding for "Price this client".
--
-- Additive only: one new column on agency_cost_settings, with a default, and
-- nothing else changed. Existing RLS policies are untouched and cover it —
-- they are row policies, not column ones.
--
-- Read by the pricing step to round a suggested fee into a price someone would
-- actually quote. The scales themselves live in lib/pricing.ts, not here, so
-- they can be retuned without a data migration. The unrounded figure is always
-- kept alongside, and a saved proposal freezes both, plus the style used, in
-- its pricing_inputs snapshot — changing this setting later never rewrites a
-- quote already sent.

alter table public.agency_cost_settings
  -- 'off'   exactly as calculated
  -- 'clean' nearest multiple of a step that grows with the price: 425, 1250
  -- 'charm' nearest price ending in 9 on a similar scale: 429, 1299
  add column rounding_style text not null default 'clean';

alter table public.agency_cost_settings
  add constraint agency_cost_settings_rounding_style_check
    check (rounding_style in ('off', 'clean', 'charm'));

comment on column public.agency_cost_settings.rounding_style is
  'How suggested fees are rounded: off, clean (nearest scaled step) or charm (nearest price ending in 9). Scales are defined in lib/pricing.ts.';

-- ------------------------------------------------------------ access control
--
-- This project's default privileges grant no DML on new objects, so every new
-- table needs explicit grants. A new *column* on an existing table is
-- different: a table-level privilege covers every column, including ones added
-- later. Checked before writing this: `authenticated` holds table-level SELECT,
-- INSERT, UPDATE and DELETE on agency_cost_settings (from 0017) and there are no
-- column-level grants that could leave the new column out.
--
-- Restated anyway, so this file is complete on its own and the grant the
-- settings form depends on sits next to the column it covers. GRANT is
-- idempotent. anon gets nothing, as before; service_role is not granted because
-- no server code reads or writes this table.
grant select, insert, update on public.agency_cost_settings to authenticated;
