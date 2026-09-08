-- The rate card (services, tiers, tier_services, pricing_rules, industries)
-- becomes user-owned. New users start with an empty rate card and build their
-- own offer; nobody inherits anyone else's.
--
-- The backfill attributes the existing seeded rows to the first account. On a
-- fresh project there is nothing to backfill and those UPDATEs are no-ops.

-- 1. ownership columns
alter table public.services      add column user_id uuid references auth.users (id) on delete cascade;
alter table public.tiers         add column user_id uuid references auth.users (id) on delete cascade;
alter table public.tier_services add column user_id uuid references auth.users (id) on delete cascade;
alter table public.pricing_rules add column user_id uuid references auth.users (id) on delete cascade;
alter table public.industries    add column user_id uuid references auth.users (id) on delete cascade;

update public.services      set user_id = 'c95fd732-a592-4068-8902-7f343386a826';
update public.tiers         set user_id = 'c95fd732-a592-4068-8902-7f343386a826';
update public.tier_services set user_id = 'c95fd732-a592-4068-8902-7f343386a826';
update public.pricing_rules set user_id = 'c95fd732-a592-4068-8902-7f343386a826';
update public.industries    set user_id = 'c95fd732-a592-4068-8902-7f343386a826';

alter table public.services      alter column user_id set not null;
alter table public.tiers         alter column user_id set not null;
alter table public.tier_services alter column user_id set not null;
alter table public.pricing_rules alter column user_id set not null;
alter table public.industries    alter column user_id set not null;

-- 2. uniqueness becomes per-user, not global, so two users can both have a
--    service called "onboarding" or a tier at level 1.
alter table public.services   drop constraint services_name_key;
alter table public.services   add constraint services_user_id_name_key unique (user_id, name);
alter table public.tiers      drop constraint tiers_level_key;
alter table public.tiers      add constraint tiers_user_id_level_key unique (user_id, level);
alter table public.industries drop constraint industries_name_key;
alter table public.industries add constraint industries_user_id_name_key unique (user_id, name);

-- 3. composite FKs make cross-user links impossible at the schema level, not
--    just blocked by policy — you cannot attach another user's service to your
--    tier even if you know its id.
alter table public.services   add constraint services_id_user_id_key unique (id, user_id);
alter table public.tiers      add constraint tiers_id_user_id_key unique (id, user_id);
alter table public.industries add constraint industries_id_user_id_key unique (id, user_id);

alter table public.tier_services drop constraint tier_services_tier_id_fkey;
alter table public.tier_services drop constraint tier_services_service_id_fkey;
alter table public.tier_services
  add constraint tier_services_tier_fkey foreign key (tier_id, user_id)
  references public.tiers (id, user_id) on delete cascade;
alter table public.tier_services
  add constraint tier_services_service_fkey foreign key (service_id, user_id)
  references public.services (id, user_id) on delete cascade;

alter table public.pricing_rules drop constraint pricing_rules_tier_id_fkey;
alter table public.pricing_rules drop constraint pricing_rules_industry_id_fkey;
alter table public.pricing_rules
  add constraint pricing_rules_tier_fkey foreign key (tier_id, user_id)
  references public.tiers (id, user_id) on delete cascade;
alter table public.pricing_rules
  add constraint pricing_rules_industry_fkey foreign key (industry_id, user_id)
  references public.industries (id, user_id) on delete cascade;

-- 4. UNIQUE(tier_id, industry_id) never constrained the generic rule, because
--    NULLs never compare equal — two rows with the same tier and a NULL
--    industry were both allowed. Split into two partial indexes.
alter table public.pricing_rules drop constraint pricing_rules_tier_id_industry_id_key;
create unique index pricing_rules_tier_industry_key
  on public.pricing_rules (tier_id, industry_id) where industry_id is not null;
create unique index pricing_rules_tier_generic_key
  on public.pricing_rules (tier_id) where industry_id is null;

-- 5. proposals snapshot the tier name and service list the same way they
--    already freeze fees, so editing the rate card cannot rewrite a proposal
--    that has already been sent. tier_id/industry_id stay as soft links that
--    null out if the underlying row is deleted.
alter table public.proposals add column tier_name text not null;
alter table public.proposals add column services jsonb not null;

alter table public.proposals drop constraint proposals_tier_id_fkey;
alter table public.proposals alter column tier_id drop not null;
alter table public.proposals add constraint proposals_tier_id_fkey
  foreign key (tier_id) references public.tiers (id) on delete set null;

alter table public.proposals drop constraint proposals_industry_id_fkey;
alter table public.proposals add constraint proposals_industry_id_fkey
  foreign key (industry_id) references public.industries (id) on delete set null;

-- 6. per-user RLS replaces public read
drop policy "Public read access" on public.services;
drop policy "Public read access" on public.tiers;
drop policy "Public read access" on public.tier_services;
drop policy "Public read access" on public.pricing_rules;
drop policy "Public read access" on public.industries;

revoke all on public.services      from anon;
revoke all on public.tiers         from anon;
revoke all on public.tier_services from anon;
revoke all on public.pricing_rules from anon;
revoke all on public.industries    from anon;

grant select, insert, update, delete on public.services      to authenticated;
grant select, insert, update, delete on public.tiers         to authenticated;
grant select, insert, update, delete on public.tier_services to authenticated;
grant select, insert, update, delete on public.pricing_rules to authenticated;
grant select, insert, update, delete on public.industries    to authenticated;

create policy "Users read own services" on public.services for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own services" on public.services for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own services" on public.services for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own services" on public.services for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own tiers" on public.tiers for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own tiers" on public.tiers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own tiers" on public.tiers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own tiers" on public.tiers for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own tier_services" on public.tier_services for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own tier_services" on public.tier_services for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own tier_services" on public.tier_services for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own tier_services" on public.tier_services for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own pricing_rules" on public.pricing_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own pricing_rules" on public.pricing_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own pricing_rules" on public.pricing_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own pricing_rules" on public.pricing_rules for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own industries" on public.industries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own industries" on public.industries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own industries" on public.industries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own industries" on public.industries for delete to authenticated using ((select auth.uid()) = user_id);
