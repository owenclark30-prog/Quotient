# Quotient

Pricing/proposal calculator. This is the data layer only — no auth, no UI polish yet.

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

3. Apply the schema and seed data. You don't have a service role key or DB
   password wired up here, so the simplest path is the Supabase SQL Editor:

   - Open your project's SQL Editor: https://supabase.com/dashboard/project/cjfkmoymcineajkdjfmv/sql/new
   - Paste and run `supabase/migrations/0001_init_schema.sql`
   - Then paste and run `supabase/seed.sql`

   Alternatively, if you have the Supabase CLI installed and linked to this
   project (`supabase link --project-ref cjfkmoymcineajkdjfmv`), run:

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
- `proposals` — a saved quote: client name, chosen tier, optional industry

## Data access

Query functions live in `lib/data/*.ts` (`getServices`, `getTiers`,
`getTierWithServices`, `getIndustries`, `getPricingRule`, `getPricingRules`,
`createProposal`, `getProposals`). The Supabase client is in
`lib/supabase/client.ts`, typed against `lib/supabase/types.ts`.
