-- Price rounding for "Price this client".
--
-- Additive only: three new columns on agency_cost_settings, with defaults, and
-- nothing else changed. Existing rows (there are none at the time of writing)
-- would pick up the defaults; existing RLS policies are untouched and cover the
-- new columns, since they are row policies, not column ones.
--
-- Read by the pricing step to round a suggested fee into a price someone would
-- actually quote. The unrounded figure is always kept alongside — see
-- lib/pricing.ts — and a saved proposal freezes both, plus these settings, in
-- its pricing_inputs snapshot, so changing them later never rewrites a quote.

alter table public.agency_cost_settings
  -- 'off'   no rounding
  -- 'clean' nearest multiple of the step: 425, 450, 1250
  -- 'charm' just under a multiple, ending in rounding_ending: 447, 497, 1297
  add column rounding_style text not null default 'clean',

  -- The last digit of a charm price. Ignored unless rounding_style = 'charm'.
  add column rounding_ending smallint not null default 7,

  -- The step to round to, in whole pounds. NULL means "use the scaled default",
  -- which grows with the price: £5 under £100 a month up to £100 over £2,000.
  -- NULL rather than a stored default so the scale can be retuned in code
  -- without a data migration, and so "never set" stays distinct from a chosen
  -- step that happens to equal today's default.
  add column rounding_step numeric(10, 2);

alter table public.agency_cost_settings
  add constraint agency_cost_settings_rounding_style_check
    check (rounding_style in ('off', 'clean', 'charm')),
  add constraint agency_cost_settings_rounding_ending_check
    check (rounding_ending in (7, 9)),
  -- Whole pounds, at least £1. Charm rounding needs an integer step to land on
  -- a price ending in the chosen digit, and a fractional step is not something
  -- an agency quotes in.
  add constraint agency_cost_settings_rounding_step_check
    check (
      rounding_step is null
      or (rounding_step >= 1 and rounding_step = trunc(rounding_step))
    );

comment on column public.agency_cost_settings.rounding_style is
  'How suggested fees are rounded: off, clean (nearest multiple of the step) or charm (ending in rounding_ending).';
comment on column public.agency_cost_settings.rounding_ending is
  'Last digit of a charm price, 7 or 9. Only read when rounding_style = charm.';
comment on column public.agency_cost_settings.rounding_step is
  'Rounding step in whole pounds. NULL means the scaled default in lib/pricing.ts.';

-- ------------------------------------------------------------ access control
--
-- This project's default privileges grant no DML on new objects, so every new
-- table needs explicit grants. New *columns* on an existing table are different:
-- a table-level privilege covers every column, including ones added later.
-- Verified before writing this: `authenticated` holds table-level SELECT,
-- INSERT, UPDATE and DELETE on agency_cost_settings (from 0017) and there are
-- no column-level grants that could leave the new columns out.
--
-- Restated here anyway, so this file is complete on its own and the grant the
-- settings form depends on is visible next to the columns it covers. GRANT is
-- idempotent. anon gets nothing, as before; service_role is not granted because
-- no server code reads or writes this table.
grant select, insert, update on public.agency_cost_settings to authenticated;
