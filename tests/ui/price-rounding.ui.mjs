/**
 * Price rounding UI tests — the setting in agency settings, the
 * "Suggested £X (calculated £Y)" line in Price this client, and what a saved
 * proposal freezes.
 *
 * Supabase is mocked at the network layer, so no keys or database are needed:
 * each scenario sets the agency_cost_settings row the page will receive. Run it
 * against a dev server; see tests/ui/billing.ui.mjs for the environment
 * variables (BASE_URL, PLAYWRIGHT_MODULE, PLAYWRIGHT_CHROMIUM_PATH,
 * SCREENSHOT_DIR). Exits non-zero if any check fails.
 */

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR ?? null;
const USER = "44444444-0000-0000-0000-000000000004";

// ------------------------------------------------------------------ fixtures

const costRow = (rounding) => ({
  user_id: USER,
  hourly_cost: 25,
  target_margin: 0.5,
  tool_cost_monthly: 40,
  conservatism_factor: 0.7,
  rounding_style: rounding.style,
  rounding_ending: rounding.ending,
  rounding_step: rounding.step,
});

// The dental worked example: floor 280, range 287/431/718, setup floor 1250.
const store = {
  services: [
    { id: "s1", user_id: USER, name: "Missed-call text back", description: "Instant SMS on a missed call." },
    { id: "s2", user_id: USER, name: "Appointment reminders", description: "Confirmations and reminders." },
  ],
  tiers: [
    { id: "t2", user_id: USER, name: "Full Front-Desk", level: 2, description: "The whole front desk.", setup_hours: 25, support_hours: 4 },
  ],
  tier_services: [
    { user_id: USER, tier_id: "t2", service_id: "s1" },
    { user_id: USER, tier_id: "t2", service_id: "s2" },
  ],
  pricing_rules: [
    { id: "p2", user_id: USER, tier_id: "t2", industry_id: null, setup_fee: 1500, monthly_fee: 197, founding_setup_fee: null, founding_monthly_fee: null, founding_duration_months: null },
  ],
  industries: [],
  proposals: [],
  settings: [{ user_id: USER, agency_name: "Accelerate", logo: null, contact_email: null, website: null }],
  // Comped, so the paywall lets every page through.
  subscriptions: [{ user_id: USER, comped: true, status: null, plan: null, stripe_customer_id: null, stripe_subscription_id: null, current_period_end: null, cancel_at_period_end: false, past_due_since: null, claimed_at: null }],
  agency_cost_settings: [costRow({ style: "clean", ending: 7, step: null })],
};

let costUpserts = [];

// ------------------------------------------------------------------ browser

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (m.text().startsWith("Failed to fetch RSC payload")) return;
  errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

function session() {
  return {
    access_token: "fake-token", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
    user: { id: USER, aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}

await page.route("**/auth/v1/**", (r) => {
  const p = new URL(r.request().url()).pathname;
  if (p.endsWith("/token") || p.endsWith("/signup")) return r.fulfill({ json: session() });
  if (p.endsWith("/user")) return r.fulfill({ json: session().user });
  return r.fulfill({ json: {} });
});

await page.route("**/rest/v1/**", (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const table = url.pathname.split("/").pop();
  const method = req.method();
  const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
  const eq = (key) => url.searchParams.get(key)?.replace(/^eq\./, "");
  const rows = store[table] ?? [];
  const body = () => {
    const parsed = req.postDataJSON();
    return Array.isArray(parsed) ? parsed[0] : parsed;
  };

  if (method === "POST" && table === "agency_cost_settings") {
    // An upsert: one row per user, replaced rather than appended.
    const row = body();
    costUpserts.push(row);
    store.agency_cost_settings = [{ ...store.agency_cost_settings[0], ...row }];
    return route.fulfill({ json: single ? store.agency_cost_settings[0] : store.agency_cost_settings });
  }
  if (method === "POST") {
    const row = { id: randomUUID(), created_at: new Date().toISOString(), ...body() };
    rows.push(row);
    return route.fulfill({ json: single ? row : [row] });
  }
  if (method === "PATCH") {
    return route.fulfill({ json: single ? null : [] });
  }

  let result = rows.filter((r) => !("user_id" in r) || r.user_id === USER);
  if (eq("id")) result = result.filter((r) => r.id === eq("id"));
  if (eq("tier_id")) result = result.filter((r) => r.tier_id === eq("tier_id"));
  if (url.searchParams.get("industry_id") === "is.null") result = result.filter((r) => r.industry_id == null);
  if (table === "tier_services" && url.searchParams.get("select")?.includes("services")) {
    result = result.map((r) => ({ service_id: r.service_id, services: store.services.find((s) => s.id === r.service_id) }));
  }
  return route.fulfill({ json: single ? (result[0] ?? null) : result });
});

// ------------------------------------------------------------------ helpers

const results = [];
const check = (name, actual, expected) => {
  const ok = String(actual) === String(expected);
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}  → ${actual}${ok ? "" : `  (expected ${expected})`}`);
};
const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const setRounding = (rounding) => {
  store.agency_cost_settings = [costRow(rounding)];
};

async function openPricingStep() {
  await page.goto(`${BASE}/proposals/new`);
  await page.waitForSelector(".tier-card");
  await page.fill('input[type="text"]', "Bright Smile Dental");
  await page.locator(".tier-card", { hasText: "Full Front-Desk" }).click();
  await page.locator("button", { hasText: "Price this client" }).last().click();
  await page.waitForSelector(".lever-block");
  const field = (lever, label) =>
    page.locator(".lever-block").filter({ hasText: lever }).locator("label", { hasText: label }).locator("input");
  await field("Missed enquiries", "Enquiries per month").fill("120");
  await field("Missed enquiries", "Average customer value").fill("600");
  await field("No-shows", "Appointments per month").fill("200");
  await field("No-shows", "No-show rate").fill("12");
  await field("No-shows", "Value per appointment").fill("120");
  await page.waitForSelector(".suggested-monthly");
}

const suggested = async () => ({
  monthly: (await page.locator(".suggested-monthly .pricing-value").innerText()).trim(),
  setup: (await page.locator(".suggested-setup .pricing-value").innerText()).trim(),
});

// ------------------------------------------------------------------ sign in

await page.goto(`${BASE}/login`);
await page.fill("#email", "owner@example.test");
await page.fill("#password", "password123");
await page.locator("button.button-primary").click();
await page.waitForTimeout(800);

// ===================================================== the settings control

setRounding({ style: "charm", ending: 9, step: null });
await page.goto(`${BASE}/settings`);
await page.waitForSelector(".rounding-settings");

const styleSelect = page.getByLabel("Rounding style");
const endingSelect = page.getByLabel("Charm ending");
const stepInput = page.getByLabel("Rounding step");

check("settings: loads the saved style", await styleSelect.inputValue(), "charm");
check("settings: charm shows the ending", await endingSelect.count(), 1);
check("settings: loads the saved ending", await endingSelect.inputValue(), "9");
check("settings: blank step means scaled", await stepInput.inputValue(), "");
check("settings: step placeholder says it scales", await stepInput.getAttribute("placeholder"), "Scaled to price");
await shot("rounding-settings-charm");

await styleSelect.selectOption("clean");
check("settings: clean hides the ending", await endingSelect.count(), 0);
check("settings: clean keeps the step", await stepInput.count(), 1);

await styleSelect.selectOption("off");
check("settings: off hides the step too", await stepInput.count(), 0);

await styleSelect.selectOption("charm");
await endingSelect.selectOption("7");
await stepInput.fill("12.5");
check("settings: a fractional step blocks saving", await page.locator("button", { hasText: "Save cost settings" }).isDisabled(), true);

await stepInput.fill("50");
costUpserts = [];
await page.locator("button", { hasText: "Save cost settings" }).click();
await page.waitForTimeout(800);
const saved = costUpserts.at(-1) ?? {};
check("settings: saves the style", saved.rounding_style, "charm");
check("settings: saves the ending", saved.rounding_ending, 7);
check("settings: saves the step", saved.rounding_step, 50);
await shot("rounding-settings-saved");

await stepInput.fill("");
costUpserts = [];
await page.locator("button", { hasText: "Save cost settings" }).click();
await page.waitForTimeout(800);
check("settings: an emptied step saves as null (scaled)", (costUpserts.at(-1) ?? {}).rounding_step, null);

// ============================================== "Suggested £X (calculated £Y)"

setRounding({ style: "clean", ending: 7, step: null });
await openPricingStep();
{
  const s = await suggested();
  check("clean: monthly", s.monthly, "£425/mo (calculated £431)");
  check("clean: setup", s.setup, "£1,250 (calculated £1,250)");
  await shot("rounding-suggested-clean");
}

setRounding({ style: "charm", ending: 7, step: 50 });
await openPricingStep();
{
  const s = await suggested();
  check("charm 7 step 50: monthly", s.monthly, "£447/mo (calculated £431)");
  check("charm 7 step 50: setup", s.setup, "£1,297 (calculated £1,250)");
  check(
    "charm: ROI is against the rounded fee",
    (await page.locator(".price-results .pricing-row", { hasText: "Return on the suggested fee" }).innerText()).includes("6.4×"),
    true
  );
  await shot("rounding-suggested-charm");
}

setRounding({ style: "off", ending: 7, step: null });
await openPricingStep();
{
  const s = await suggested();
  check("off: monthly, no calculated note", s.monthly, "£431/mo");
  check("off: setup, no calculated note", s.setup, "£1,250");
}

// ============================================== custom fees are untouched

setRounding({ style: "charm", ending: 7, step: 50 });
await openPricingStep();
await page.locator("button", { hasText: "Type custom" }).click();
const customInputs = page.locator(".price-results > .fee-grid input");
check("custom: seeded from the suggested setup", await customInputs.nth(0).inputValue(), "1297");
check("custom: seeded from the suggested monthly", await customInputs.nth(1).inputValue(), "447");
await customInputs.nth(1).fill("433");
await page.waitForTimeout(300);
check(
  "custom: the typed fee is used as typed, not rounded",
  (await page.locator(".price-results > .field-hint").first().innerText()).includes("£433/mo"),
  true
);

// ============================================== what a saved proposal freezes

await openPricingStep();
await page.locator("button", { hasText: "Use suggested fees" }).click();
await page.evaluate(() => document.activeElement?.blur());
await page.locator("button", { hasText: "Generate Proposal" }).click();
await page.waitForSelector(".proposal");
check(
  "proposal: charges the rounded monthly",
  (await page.locator(".proposal-pricing").first().innerText()).includes("£447/mo"),
  true
);

store.proposals = [];
await page.locator("button", { hasText: "Save Proposal" }).click();
await page.waitForTimeout(1000);
const frozen = store.proposals[0]?.pricing_inputs ?? {};
check("snapshot: calculated fees", JSON.stringify(frozen.result?.calculated), JSON.stringify({ monthly: 431, setup: 1250 }));
check("snapshot: rounded fees", JSON.stringify(frozen.result?.recommended), JSON.stringify({ monthly: 447, setup: 1297 }));
check(
  "snapshot: the rounding settings used",
  JSON.stringify(frozen.result?.rounding),
  JSON.stringify({ style: "charm", ending: 7, step: 50, monthlyStep: 50, setupStep: 50 })
);
check("snapshot: fees charged are the rounded ones", `${frozen.applied?.setupFee}/${frozen.applied?.monthlyFee}`, "1297/447");
check("snapshot: saved proposal's fee columns match", `${store.proposals[0]?.setup_fee}/${store.proposals[0]?.monthly_fee}`, "1297/447");

// Change the setting afterwards and reopen: the saved proposal must not move.
setRounding({ style: "clean", ending: 7, step: null });
const savedId = store.proposals[0]?.id;
await page.goto(`${BASE}/proposal?id=${savedId}`);
await page.waitForSelector(".proposal");
check(
  "saved proposal ignores a later change to the setting",
  (await page.locator(".proposal-pricing").first().innerText()).includes("£447/mo"),
  true
);
await shot("rounding-saved-proposal");

// ------------------------------------------------------------------ report

await browser.close();

const failed = results.filter((r) => !r.startsWith("PASS"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");

if (failed.length || errors.length) process.exit(1);
