-- Pre-launch waitlist capture.
--
-- The only table in this schema that `anon` can touch at all. Everything else
-- had anon revoked in 0009 and stays that way — this grants INSERT and nothing
-- else, on this table and nothing else.
--
-- A public insert endpoint is inherently spammable; that is the cost of having
-- a signup form at all. What's mitigated:
--
--   * unique on lower(email), so the same address can't pile up rows — and the
--     app reports a duplicate as success, so the form never reveals who is
--     already on the list
--   * length and shape CHECKs, so a row can't be used as bulk storage
--   * no SELECT grant and no select policy, so the list cannot be read back
--     with the publishable key. Read it in the Supabase table editor, which
--     uses the service role and bypasses RLS.

create table public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  constraint waitlist_emails_email_shape check (
    length(email) between 3 and 320 and position('@' in email) > 1
  ),
  constraint waitlist_emails_name_length check (
    name is null or length(name) <= 120
  )
);

-- Case-insensitive: Owen@x.co and owen@x.co are the same person.
create unique index waitlist_emails_email_key
  on public.waitlist_emails (lower(email));

alter table public.waitlist_emails enable row level security;

-- INSERT only. Deliberately no select/update/delete grant to either role.
grant insert on public.waitlist_emails to anon;
grant insert on public.waitlist_emails to authenticated;

create policy "Anyone can join the waitlist"
  on public.waitlist_emails for insert to anon, authenticated
  with check (true);
