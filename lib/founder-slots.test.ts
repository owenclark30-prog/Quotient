import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { FOUNDER_SLOT_LIMIT, founderSlotsRemaining } from "./billing.ts";

/**
 * The founder-slot count and claim, run as the real SQL from the migrations in
 * an in-process Postgres (PGlite). Not a TypeScript copy of the rule: the
 * functions under test are the ones /api/billing/founder-slots and checkout
 * call.
 *
 * Supabase's auth schema and roles don't exist in a bare Postgres, so the few
 * pieces the migrations reference are stubbed first.
 */

const migration = (name: string) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

const SUPABASE_STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql as 'select null::uuid';
  create role anon;
  create role authenticated;
  create role service_role;
`;

async function database({ withFix = true } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(migration("0018_billing.sql"));
  await db.exec(migration("0019_claim_plan_comped_fix.sql"));
  if (withFix) await db.exec(migration("0021_founder_slots_exclude_comped.sql"));
  return db;
}

async function newUser(db: PGlite): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users default values returning id"
  );
  return rows[0].id;
}

type Row = {
  plan?: string | null;
  comped?: boolean;
  status?: string | null;
  stripe_subscription_id?: string | null;
  claimed_at?: string | null;
};

async function subscription(db: PGlite, row: Row): Promise<string> {
  const id = await newUser(db);
  await db.query(
    `insert into public.subscriptions
       (user_id, plan, comped, status, stripe_subscription_id, claimed_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      row.plan ?? null,
      row.comped ?? false,
      row.status ?? null,
      row.stripe_subscription_id ?? null,
      row.claimed_at ?? null,
    ]
  );
  return id;
}

/** The owner's account as it is in production: comped, on the founder plan,
 * with a test subscription since canceled. */
const OWNER: Row = {
  plan: "founder",
  comped: true,
  status: "canceled",
  stripe_subscription_id: "sub_owner",
};

async function used(db: PGlite): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    "select public.founder_slots_used() as n"
  );
  return rows[0].n;
}

async function claim(db: PGlite, userId: string): Promise<string> {
  const { rows } = await db.query<{ plan: string }>(
    "select public.claim_plan($1) as plan",
    [userId]
  );
  return rows[0].plan;
}

let paying = 0;
const payingFounder = (): Row => ({
  plan: "founder",
  status: "active",
  stripe_subscription_id: `sub_paying_${++paying}`,
});

test("before 0021: the comped owner took a public spot (the 24 of 25 bug)", async () => {
  const db = await database({ withFix: false });
  await subscription(db, OWNER);
  assert.equal(await used(db), 1);
  assert.equal(founderSlotsRemaining(await used(db)), 24);
});

test("a comped founder row doesn't reduce spots left", async () => {
  const db = await database();
  await subscription(db, OWNER);
  assert.equal(await used(db), 0);
  assert.equal(founderSlotsRemaining(await used(db)), FOUNDER_SLOT_LIMIT);
});

test("comped never counts, whatever the status", async () => {
  const db = await database();
  for (const status of ["active", "trialing", "past_due", "canceled", null]) {
    await subscription(db, { ...OWNER, status, stripe_subscription_id: null });
  }
  // A comped row with a fresh claim doesn't count either.
  await subscription(db, {
    plan: "founder",
    comped: true,
    claimed_at: new Date().toISOString(),
  });
  assert.equal(await used(db), 0);
});

test("paying founders and fresh claims still count; expired claims don't", async () => {
  const db = await database();
  await subscription(db, OWNER);
  await subscription(db, payingFounder());
  await subscription(db, { plan: "founder", claimed_at: new Date().toISOString() });
  await subscription(db, {
    plan: "founder",
    claimed_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  });
  await subscription(db, { plan: "founder", status: "canceled", stripe_subscription_id: "sub_gone" });
  await subscription(db, { plan: "standard", status: "active", stripe_subscription_id: "sub_std" });
  assert.equal(await used(db), 2);
});

test("claim_plan: with a comped owner and 24 paying founders, the 25th public spot is still sold", async () => {
  const db = await database();
  await subscription(db, OWNER);
  for (let i = 0; i < FOUNDER_SLOT_LIMIT - 1; i++) {
    await subscription(db, payingFounder());
  }
  assert.equal(await used(db), 24);

  assert.equal(await claim(db, await newUser(db)), "founder");
  assert.equal(await used(db), 25);
  assert.equal(await claim(db, await newUser(db)), "standard");
});

test("claim_plan: the comped owner keeps the founder plan without using a spot", async () => {
  const db = await database();
  const owner = await subscription(db, OWNER);
  assert.equal(await claim(db, owner), "founder");
  assert.equal(await used(db), 0);
});
