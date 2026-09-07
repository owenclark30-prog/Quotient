# Quotient

Pricing/proposal calculator. Set a tier and client, see live pricing, and
generate a printable proposal you can save and revisit. No auth yet — the
agency name is a single global setting and proposals aren't scoped to a user.

## Stack

Next.js (App Router, TypeScript) + Supabase.

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy the env file and fill in your Supabase project details (already pre-filled with the values you gave me):

   ```
   cp .env.local.example .env.local
   ```

3. Apply the schema and seed data. Migrations `0001`–`0004` and `seed.sql`
   have already been applied to the live project — this step is only needed
   when setting up a fresh Supabase project.

   Via the SQL Editor (https://supabase.com/dashboard/project/cjfkmoymcineajkdjfmv/sql/new),
   run each file in `supabase/migrations/` in numeric order, then `supabase/seed.sql`.

   Or with the Supabase CLI, linked to the project
   (`supabase link --project-ref cjfkmoymcineajkdjfmv`):

   ```
   supabase db push
   psql "$(supabase db remote-url)" -f supabase/seed.sql
   ```

4. Run the dev server:

   ```
   npm run dev
   ```

## Schema

- `services` — catalogue of individual automations (`missed_call_text_back`, `multichannel_capture`, etc.)
- `tiers` — the three pricing tiers, ordered by `level`
- `tier_services` — join table: which services belong to which tier
- `industries` — optional vertical (e.g. aesthetics, home services); empty for now
- `pricing_rules` — setup/monthly fee per tier, optionally scoped to an industry; `industry_id IS NULL` is the generic/default rate. Tier 2 also carries a founding-rate discount for the first 3 months.
- `proposals` — a saved quote: client name, chosen tier, optional industry, and the agency name snapshotted at save time
- `settings` — single row holding the agency name shown on proposals

### Access control

There's no auth, so migration `0002` grants the `anon` role read access to the
catalog tables, read/insert on `proposals`, and read/update on `settings`, with
matching permissive RLS policies. Supabase auto-enables RLS on new tables, so
any table added later needs its own grants and policies or it will be
inaccessible to the publishable key.

## Data access

Query functions live in `lib/data/*.ts` (`getServices`, `getTiers`,
`getTierById`, `getTierWithServices`, `getIndustries`, `getIndustryById`,
`getPricingRule`, `getPricingRules`, `createProposal`, `getProposalById`,
`getProposals`, `getAgencyName`, `updateAgencyName`). The Supabase client is in
`lib/supabase/client.ts`, typed against `lib/supabase/types.ts`.

## Routes

- `/` — calculator: agency name setting, client name, industry, tier, live pricing
- `/proposal?client=&tier=&industry=` — freshly generated proposal, savable
- `/proposal?id=` — a saved proposal
- `/proposals` — list of saved proposals
