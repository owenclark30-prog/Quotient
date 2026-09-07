-- Single-row app settings (currently just the agency name shown on
-- proposals). No auth yet, so this is a global setting, not per-user.
create table settings (
  id uuid primary key default gen_random_uuid(),
  agency_name text not null default 'Your Agency'
);

insert into settings (id, agency_name)
values ('00000000-0000-0000-0000-000000000001', 'Your Agency');

grant select, update on public.settings to anon, authenticated;

create policy "Public read access" on public.settings for select using (true);
create policy "Public update access" on public.settings for update using (true) with check (true);
