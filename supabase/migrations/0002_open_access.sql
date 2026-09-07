-- Supabase auto-enables RLS on every new table with no policies, which
-- silently denies the anon key entirely (not just RLS — no table grants
-- either). This is a no-auth app, so open read access to the catalog
-- tables and read/insert access to proposals.

grant select on public.services to anon, authenticated;
grant select on public.tiers to anon, authenticated;
grant select on public.tier_services to anon, authenticated;
grant select on public.industries to anon, authenticated;
grant select on public.pricing_rules to anon, authenticated;
grant select, insert on public.proposals to anon, authenticated;

create policy "Public read access" on public.services for select using (true);
create policy "Public read access" on public.tiers for select using (true);
create policy "Public read access" on public.tier_services for select using (true);
create policy "Public read access" on public.industries for select using (true);
create policy "Public read access" on public.pricing_rules for select using (true);
create policy "Public read access" on public.proposals for select using (true);
create policy "Public insert access" on public.proposals for insert with check (true);
