-- Auth: settings and proposals become per-user instead of global.

-- settings: one row per user, replacing the global singleton
drop table public.settings;

create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agency_name text not null
);

alter table public.settings enable row level security;

grant select, insert, update on public.settings to authenticated;

create policy "Users read own settings" on public.settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own settings" on public.settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own settings" on public.settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- proposals: every proposal now belongs to a user. The old FK was
-- `on delete set null`, which can't coexist with a not-null column.
alter table public.proposals drop constraint proposals_user_id_fkey;
alter table public.proposals
  add constraint proposals_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.proposals alter column user_id set not null;

alter table public.proposals enable row level security;

drop policy "Public read access" on public.proposals;
drop policy "Public insert access" on public.proposals;

revoke all on public.proposals from anon;
grant select, insert on public.proposals to authenticated;

create policy "Users read own proposals" on public.proposals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own proposals" on public.proposals
  for insert to authenticated with check ((select auth.uid()) = user_id);
