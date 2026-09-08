# Quotient

Pricing/proposal calculator. Set a tier and client, see live pricing, and
generate a printable proposal you can save and revisit. Email/password auth
via Supabase Auth; each account has its own agency name and proposals.

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

3. Apply the schema. Migrations `0001`–`0012` have already been applied to the
   live project — this step is only needed when setting up a fresh Supabase
   project. `seed.sql` is optional and seeds one named account; new users are
   meant to start with an empty rate card and build their own.

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

All of the rate card is per-user: a user only ever sees their own offer.

- `services` — the individual things a user delivers
- `tiers` — a user's packages, ordered by `level` (per-user sort order, no fixed count)
- `tier_services` — join table: which services belong to which tier
- `industries` — optional vertical a proposal can be tagged with, managed in the rate-card builder. **Label and tailoring only — deliberately not a price differentiator** (see below)
- `pricing_rules` — setup/monthly fee per tier. Optional founding rate (discounted setup/monthly for a set number of months). `industry_id` exists and the resolution logic prefers an industry-specific rule over the generic one, but **no UI writes industry-specific rules and none should be added without an explicit decision** — see below. In practice every rule has `industry_id IS NULL`.

### Why industries don't affect price

A deliberate product decision, not an unfinished feature. The service delivered
is the same regardless of the client's vertical, so pricing by industry would be
pricing on what the client can pay rather than what delivery costs — a different
model (selling an outcome) from the one this tool is for (selling a service).
The industry field is for labelling and tailoring a proposal only.

The schema and `getPricingRule` fallback still support per-industry rules, so
this is reversible if the decision changes.
- `proposals` — a saved quote. The agency name, tier name and description, industry name, service list and all fees are snapshotted at save time, so a saved proposal renders entirely from its own row and never reads the live rate card. `tier_id`/`industry_id` are soft links that null out if the row is deleted — you can edit or delete anything on your rate card without touching a proposal already sent.
- `settings` — one row per user (`user_id` PK) holding the agency name shown on their proposals

### Access control

Every table is per-user. `anon` has no access to anything; `authenticated`
holds CRUD grants, and RLS scopes every row to `(select auth.uid()) = user_id`
for select, insert, update and delete.

Two guarantees beyond RLS:

- **Composite foreign keys.** `tier_services` and `pricing_rules` reference
  `(id, user_id)` on their parents, so attaching another user's service to your
  tier fails at the schema level even if you know its id — it isn't only policy
  that stops it.
- **Per-user uniqueness.** `services.name` and `tiers.level` are unique per
  user, not globally, so two users can both have a service called "onboarding".

Supabase auto-enables RLS on new tables, so any table added later needs its own
grants and policies or it will be inaccessible to the publishable key.

## Data access

Query functions live in `lib/data/*.ts` (`getServices`, `getTiers`,
`getTierById`, `getTierWithServices`, `getIndustries`, `getIndustryById`,
`getPricingRule`, `getPricingRules`, `saveGenericPricingRule`,
`createIndustry`/`updateIndustry`/`deleteIndustry`,
`createService`/`updateService`/`deleteService`,
`createTier`/`updateTier`/`deleteTier`, `addServiceToTier`/`removeServiceFromTier`,
`createProposal`, `getProposalById`, `getProposals`, `getAgencyName`,
`getAgencyNameOrDefault`, `updateAgencyName`). Writes stamp `user_id` from the
session so call sites don't have to. The Supabase client is in
`lib/supabase/client.ts`, typed against `lib/supabase/types.ts`.

## Branching and deploys

`main` is the trunk and Netlify's production branch. Pushing to `main` deploys
to https://quotient-proposals.netlify.app.

Netlify builds whichever branch is set as *Production branch* in its build
settings — it does not follow GitHub's default branch, so those two settings
have to be changed together.

Other branches get Netlify branch deploys at
`<branch-name>--quotient-proposals.netlify.app`, which is the place to check a
risky change before it reaches production.

## Routes

- `/login` — email/password sign in and sign up (the only public route)
- `/` — calculator: agency name setting, client name, industry, tier, live pricing
- `/rate-card` — builder: create services, group them into tiers, set fees, manage industries
- `/proposal?client=&tier=&industry=` — freshly generated proposal, savable
- `/proposal?id=` — a saved proposal
- `/proposals` — list of saved proposals
