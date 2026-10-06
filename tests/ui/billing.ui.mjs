/**
 * Billing UI tests — the paywall, /subscribe and /settings/billing, driven in a
 * real browser against a running dev server.
 *
 * Supabase and the founder-slots route are mocked at the network layer, so no
 * keys, no database and no Stripe are needed: each scenario sets the
 * subscription row the page will receive, then loads the page.
 *
 * Not part of `npm test` because it needs a server and a browser. To run:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… npx next dev
 *   npm run test:ui
 *
 * Environment:
 *   BASE_URL                  default http://localhost:3000
 *   PLAYWRIGHT_MODULE         where to import Playwright from (default "playwright";
 *                             it is not a project dependency, so point this at a
 *                             global install if needed)
 *   PLAYWRIGHT_CHROMIUM_PATH  a Chromium binary, if Playwright's own isn't installed
 *   SCREENSHOT_DIR            write a screenshot per scenario here
 *
 * Exits non-zero if any check fails.
 */

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR ?? null;
const USER = "33333333-0000-0000-0000-000000000003";
const PERIOD_END = "2026-11-05T12:00:00Z";
const PERIOD_END_TEXT = "5 November 2026";

// Mutable fixture: each scenario sets these, then loads a page.
let subRow = null;
let slots = { used: 3, limit: 25, remaining: 22 };
let subscriptionReads = 0;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await (
  await browser.newContext({ viewport: { width: 1100, height: 900 } })
).newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  // Next dev logs this when a soft navigation is interrupted by the next one,
  // then falls back to a full navigation. A harness artefact, not an app error.
  if (m.text().startsWith("Failed to fetch RSC payload")) return;
  errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

function session() {
  return {
    access_token: "fake-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "r",
    user: {
      id: USER,
      aud: "authenticated",
      role: "authenticated",
      email: "owner@example.test",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

await page.route("**/auth/v1/**", (r) => {
  const p = new URL(r.request().url()).pathname;
  if (p.endsWith("/token") || p.endsWith("/signup")) return r.fulfill({ json: session() });
  if (p.endsWith("/user")) return r.fulfill({ json: session().user });
  return r.fulfill({ json: {} });
});

// Playwright matches the most recently registered route first, so the
// catch-all goes in before the specific one or it would swallow it.
await page.route("**/rest/v1/**", (route) => {
  const single = (route.request().headers()["accept"] || "").includes("vnd.pgrst.object");
  return route.fulfill({ json: single ? null : [] });
});
await page.route("**/rest/v1/subscriptions*", (route) => {
  subscriptionReads++;
  const single = (route.request().headers()["accept"] || "").includes("vnd.pgrst.object");
  return route.fulfill({ json: single ? subRow : subRow ? [subRow] : [] });
});
await page.route("**/api/billing/founder-slots", (route) => route.fulfill({ json: slots }));

const results = [];
const check = (name, actual, expected) => {
  const ok = String(actual) === String(expected);
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}  → ${actual}${ok ? "" : `  (expected ${expected})`}`);
};
const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const path = () => new URL(page.url()).pathname;
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();

const row = (o = {}) => ({
  user_id: USER,
  stripe_customer_id: "cus_test_1",
  stripe_subscription_id: "sub_test_1",
  status: "active",
  plan: "founder",
  current_period_end: PERIOD_END,
  cancel_at_period_end: false,
  comped: false,
  past_due_since: null,
  claimed_at: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...o,
});

/** The owner's account after comp-account.sql: comped, nothing in Stripe. */
const compedOnly = (o = {}) =>
  row({
    comped: true,
    status: null,
    plan: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    current_period_end: null,
    ...o,
  });

async function billing(query = "") {
  await page.goto(`${BASE}/settings/billing${query}`);
  await page.waitForSelector(".pricing-box");
  return {
    box: await page.locator(".pricing-box").innerText(),
    main: await page.locator("main").innerText(),
  };
}

// ---------------------------------------------------------------- sign in
await page.goto(`${BASE}/login`);
await page.fill("#email", "owner@example.test");
await page.fill("#password", "password123");
await page.locator("button.button-primary").click();
await page.waitForTimeout(800);

// ===================================================== the paywall & /subscribe

subRow = null;
await page.goto(`${BASE}/rate-card`);
await page.waitForURL("**/subscribe", { timeout: 10000 }).catch(() => {});
check("no subscription: /rate-card redirects to /subscribe", path(), "/subscribe");
await page.waitForSelector(".plan-card");
check("subscribe: spots remaining", (await page.locator(".plan-slots").innerText()).includes("22 of 25 founder spots left"), true);
check("subscribe: founder price", await page.locator(".plan-price").innerText(), "£29/mo");
await shot("subscribe-founder");

slots = { used: 25, limit: 25, remaining: 0 };
await page.reload();
await page.waitForSelector(".plan-card");
check("tier full: Standard", await page.locator(".plan-name").innerText(), "Standard");
check("tier full: £39/mo", await page.locator(".plan-price").innerText(), "£39/mo");
check("tier full: says spots have gone", (await page.locator(".plan-slots").innerText()).includes("All 25 founder spots have gone"), true);
slots = { used: 3, limit: 25, remaining: 22 };

subRow = compedOnly();
await page.goto(`${BASE}/rate-card`);
await page.waitForTimeout(1200);
check("comped: reaches /rate-card", path(), "/rate-card");

subRow = row({ status: "past_due", past_due_since: daysAgo(2) });
await page.goto(`${BASE}/rate-card`);
await page.waitForTimeout(1200);
check("past_due day 2: reaches /rate-card", path(), "/rate-card");

subRow = row({ status: "past_due", past_due_since: daysAgo(9) });
await page.goto(`${BASE}/rate-card`);
await page.waitForURL("**/subscribe", { timeout: 10000 }).catch(() => {});
check("past_due day 9: paywalled", path(), "/subscribe");

subRow = row({ status: "canceled" });
await page.goto(`${BASE}/proposals/new`);
await page.waitForURL("**/subscribe", { timeout: 10000 }).catch(() => {});
check("canceled: paywalled", path(), "/subscribe");

// ============================================ /settings/billing — ordinary customer

subRow = row();
{
  const { box } = await billing();
  check("active: founder badge", await page.locator(".founder-badge").count(), 1);
  check("active: status Active", box.includes("Active"), true);
  check("active: price £29/mo", box.includes("£29/mo"), true);
  check("active: Next renewal + date", box.includes("Next renewal") && box.includes(PERIOD_END_TEXT), true);
  check("active: Manage billing", await page.locator("button", { hasText: "Manage billing" }).count(), 1);
  check("active: no comped note", await page.locator(".comped-note").count(), 0);
  await shot("billing-active");
}

// ================================================ comped, nothing in Stripe

subRow = compedOnly();
{
  const { box } = await billing();
  check("comped only: status Complimentary", box.includes("Complimentary"), true);
  check("comped only: no Price row", box.includes("Price"), false);
  check("comped only: no Next renewal", box.includes("Next renewal"), false);
  check("comped only: no Access ends", box.includes("Access ends"), false);
  check("comped only: says no card on file", (await page.locator(".comped-note").innerText()).includes("no card on file"), true);
  await shot("billing-comped-only");
}

// A former founder comped after their subscription ended: plan and old period
// end linger on the row, but nothing will be charged.
subRow = compedOnly({ plan: "founder", status: "canceled", stripe_subscription_id: "sub_old", stripe_customer_id: "cus_old", current_period_end: PERIOD_END });
{
  const { box } = await billing();
  check("comped + ended sub: no Price row", box.includes("Price"), false);
  check("comped + ended sub: no Next renewal", box.includes("Next renewal"), false);
  check("comped + ended sub: still the no-card note", (await page.locator(".comped-note").innerText()).includes("no card on file"), true);
}

// ================================================ comped AND a live subscription

subRow = row({ comped: true });
{
  const { box } = await billing();
  const note = await page.locator(".comped-note").innerText();
  check("comped + live: Price shown", box.includes("£29/mo"), true);
  check("comped + live: Next renewal shown", box.includes("Next renewal") && box.includes(PERIOD_END_TEXT), true);
  check("comped + live: note says they have both", note.includes("live Stripe subscription"), true);
  check("comped + live: does NOT say no card on file", note.includes("no card on file"), false);
  await shot("billing-comped-and-live");
}

subRow = row({ comped: true, cancel_at_period_end: true });
{
  await billing();
  const banner = await page.locator(".cancelling-banner").innerText();
  // The page sets a typographic apostrophe (&rsquo;), not a straight one.
  check("comped + live + cancelling: banner says comp unaffected", banner.includes("complimentary access isn’t affected"), true);
  check("comped + live + cancelling: doesn't claim access ends", banner.includes("You keep access until"), false);
}

// ================================================ cancellation and renewal dates

subRow = row({ cancel_at_period_end: true });
{
  const { box } = await billing();
  check("live + cancelling: Access ends + date", box.includes("Access ends") && box.includes(PERIOD_END_TEXT), true);
  check("live + cancelling: no Next renewal", box.includes("Next renewal"), false);
  check("live + cancelling: banner shown", await page.locator(".cancelling-banner").count(), 1);
  await shot("billing-cancelling");
}

// Stripe can leave cancel_at_period_end true on a subscription that has ended.
subRow = row({ status: "canceled", cancel_at_period_end: true });
{
  const { box } = await billing();
  check("canceled: no Next renewal", box.includes("Next renewal"), false);
  check("canceled + flag still set: no Access ends", box.includes("Access ends"), false);
  check("canceled + flag still set: no cancelling banner", await page.locator(".cancelling-banner").count(), 0);
  check("canceled: status Cancelled", box.includes("Cancelled"), true);
  await shot("billing-canceled");
}

subRow = row({ status: "canceled", cancel_at_period_end: false });
{
  const { box } = await billing();
  check("canceled, flag false: no Next renewal", box.includes("Next renewal"), false);
}

subRow = row({ status: "paused" });
{
  const { box } = await billing();
  check("paused: no Next renewal", box.includes("Next renewal"), false);
}

subRow = row({ status: "past_due", past_due_since: daysAgo(2) });
{
  const { box } = await billing();
  check("past_due (live): still shows Next renewal", box.includes("Next renewal"), true);
  check("past_due: grace warning", (await page.locator(".warning-banner").first().innerText()).includes("last payment failed"), true);
}

// ================================================ the payment-received banner

// Back from Stripe before the webhook has landed: the row is the claim, with no
// subscription id yet.
subRow = row({ stripe_subscription_id: null, status: null, current_period_end: null });
{
  await billing("?checkout=success");
  check("checkout, webhook pending: banner shown", await page.locator(".checkout-notice").count(), 1);

  // Sample the page while it polls: it must keep its content, never blank to
  // "Loading…" on a background re-read.
  let blanked = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    if ((await page.locator(".pricing-box").count()) === 0) blanked = true;
  }
  check("checkout, polling: page never blanks to Loading", blanked, false);

  // The webhook lands.
  subRow = row();
  await page.waitForSelector(".checkout-notice", { state: "detached", timeout: 6000 }).catch(() => {});
  check("checkout, webhook landed: banner gone", await page.locator(".checkout-notice").count(), 0);
  check("checkout, webhook landed: subscription now shown", (await page.locator(".pricing-box").innerText()).includes("Next renewal"), true);

  // And it stops asking.
  const readsAtLanding = subscriptionReads;
  await page.waitForTimeout(5000);
  check("checkout, after landing: polling stopped", subscriptionReads - readsAtLanding, 0);
  await shot("billing-checkout-landed");
}

// Arriving with the subscription already there: no banner at all.
subRow = row();
{
  await billing("?checkout=success");
  await page.waitForTimeout(500);
  check("checkout, already reflected: banner never shown", await page.locator(".checkout-notice").count(), 0);
}

// ================================================================ the rest

subRow = row({ status: "canceled" });
await page.goto(`${BASE}/settings/billing`);
await page.waitForTimeout(1200);
check("billing reachable while locked out", path(), "/settings/billing");

subRow = row();
await page.goto(`${BASE}/`);
await page.waitForTimeout(1200);
await page.locator("button", { hasText: "Account" }).click();
check("nav: Billing link", await page.locator(".app-nav-menu-item", { hasText: "Billing" }).count(), 1);

// ================================================================= report

await browser.close();

const failed = results.filter((r) => !r.startsWith("PASS"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");

if (failed.length || errors.length) process.exit(1);
