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
- `proposals` — a saved quote. The agency name, tier name and description, industry name, service list and all fees are snapshotted at save time, so a saved proposal renders entirely from its own row and never reads the live rate card. `tier_id`/`industry_id` are soft links that null out if the row is deleted — you can edit or delete anything on your rate card without touching a proposal already sent.
- `settings` — one row per user (`user_id` PK) holding the agency name shown on their proposals

### Why industries don't affect price

A deliberate product decision, not an unfinished feature. The service delivered
is the same regardless of the client's vertical, so pricing by industry would be
pricing on what the client can pay rather than what delivery costs — a different
model (selling an outcome) from the one this tool is for (selling a service).
The industry field is for labelling and tailoring a proposal only.

The schema and `getPricingRule` fallback still support per-industry rules, so
this is reversible if the decision changes.

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
- `/` — home: wordmark, motto, and a dashboard of real counts and recent proposals
- `/proposals/new` — calculator: client name, industry, tier, live pricing
- `/proposals` — list of saved proposals
- `/proposal?client=&tier=&industry=` — freshly generated proposal, savable
- `/proposal?id=` — a saved proposal
- `/rate-card` — builder: create services, group them into tiers, set fees, manage industries
- `/settings` — agency name shown on proposals

`/` is an in-app home, not a marketing page — it sits behind `RequireAuth` like
everything else, because everything it links to needs a session.

Its dashboard is **real data only**: proposals sent, tiers and services are
counted from the user's own rows, and "recent proposals" are their three latest.
Nothing on it is a placeholder or a sample figure, so a brand-new account sees a
prompt to build a rate card rather than a wall of zeros.

Every signed-in route renders `AppNav` (`app/components/AppNav.tsx`) from the
root layout: branding, a "Proposals" dropdown, and an account menu holding
agency settings and sign out. It returns `null` when there's no session, so
`/login` has no chrome, and it's hidden in print. The brand is the link home;
there's no separate "Home" nav item.

Navigation is a **dropdown, not a row of links**, so a new area is one entry in
`NAV_MENUS` and the bar itself never has to change shape. Two details are load-
bearing:

- `.app-nav-inner` sits **above** the click-catching backdrop. Without that, an
  open menu covers the other menu's trigger and you have to close one before
  opening the other.
- `.app-nav-links` must **not** set `overflow-x`. Clipping one axis forces the
  other to clip too, which silently cuts off the dropdown panel hanging below
  the bar — it stays in the DOM and renders nowhere.

Active state is computed per menu (does any item match, plus `/proposal` for the
proposals group) rather than by prefix: `/proposals` is a prefix of
`/proposals/new`, so `startsWith` would light up two things at once.

## Theme

Dark by default. All colours come from custom properties on `:root` in
`app/globals.css` — pages and components never hardcode a colour, so the theme
is changed in one place.

Two things are deliberate rather than accidental:

- **The accent is Petronas teal (`#00d2be`) and it takes dark ink, not white.**
  At 10.04:1 on the page background it's bright enough to serve as link, border
  and wordmark colour directly — but that same brightness means white text on
  top of it fails badly (1.92:1). Filled surfaces therefore use `--accent-ink`
  (`#07120f`, 9.94:1). Never put `#fff` on the accent.
- **`--border` vs `--border-strong`.** `--border` is a decorative hairline.
  Anything that bounds a control (inputs, hover states, the account menu) uses
  `--border-strong`, which clears the 3:1 WCAG ratio for non-text contrast.

`.proposal` is a **light island**: it re-declares the same tokens with light
values and sets `color-scheme: light`, so the document an agency owner sends to
their own client stays white on screen and in print regardless of the app's
theme. It overrides variables, not rules — there is no duplicated styling to
keep in sync. Changing the app theme cannot change the proposal.
