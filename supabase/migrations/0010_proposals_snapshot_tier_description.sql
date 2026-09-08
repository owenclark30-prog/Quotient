-- The proposal document renders the tier description too, so it has to be
-- part of the snapshot or a saved proposal loses it when the tier is edited.
alter table public.proposals add column tier_description text;
