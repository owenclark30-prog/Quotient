/**
 * Landing page UI tests: both modes of the public page, its CTAs, the waitlist
 * form, focus rings, measured text contrast, and the mobile layout.
 *
 * The page renders differently by LAUNCH_MODE, which is read on the server, so
 * this needs two servers from the same build:
 *
 *   npm run build
 *   LAUNCH_MODE=live     npx next start -p 3000
 *   LAUNCH_MODE=waitlist npx next start -p 3001
 *   WAITLIST_BASE_URL=http://localhost:3001 npm run test:ui
 *
 * Supabase and the founder-slots route are mocked in the browser, so no keys or
 * database are needed. Without WAITLIST_BASE_URL the waitlist half is reported
 * as skipped. See tests/ui/billing.ui.mjs for the other environment variables.
 *
 * Exits non-zero if any check fails.
 */

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const LIVE = process.env.BASE_URL ?? "http://localhost:3000";
const WAITLIST = process.env.WAITLIST_BASE_URL ?? null;
const SHOTS = process.env.SCREENSHOT_DIR ?? null;
const SIGNUP = "/login?mode=signup&next=/subscribe";

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

const results = [];
const errors = [];
const check = (name, actual, expected) => {
  const ok = String(actual) === String(expected);
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}  → ${actual}${ok ? "" : `  (expected ${expected})`}`);
};

// Mutable fixtures, set per scenario.
let slots = { used: 3, limit: 25, remaining: 22 };
let slotsStatus = 200;
let slotRequests = 0;
let waitlistStatus = 201;
let waitlistBodies = [];

async function newPage(width = 1280, height = 900) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (m.text().startsWith("Failed to fetch RSC payload")) return;
    // Mocked failures, asserted on below: a duplicate signup (409), a failed
    // insert and a failed founder count (500).
    if (/Failed to load resource: .* status of (409|500)\b/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    if (r.url().includes("/api/billing/founder-slots")) slotRequests++;
  });

  await page.route("**/auth/v1/**", (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p.endsWith("/signup") || p.endsWith("/token")) return r.fulfill({ json: session() });
    if (p.endsWith("/user")) return r.fulfill({ json: session().user });
    return r.fulfill({ json: {} });
  });
  await page.route("**/rest/v1/**", (route) => {
    const single = (route.request().headers()["accept"] || "").includes("vnd.pgrst.object");
    return route.fulfill({ json: single ? null : [] });
  });
  await page.route("**/rest/v1/waitlist_emails*", (route) => {
    waitlistBodies.push(route.request().postDataJSON());
    if (waitlistStatus === 201) return route.fulfill({ status: 201, body: "" });
    if (waitlistStatus === 409)
      return route.fulfill({ status: 409, json: { code: "23505", message: "duplicate key" } });
    return route.fulfill({ status: 500, json: { code: "XX000", message: "boom" } });
  });
  await page.route("**/api/billing/founder-slots", (route) =>
    slotsStatus === 200
      ? route.fulfill({ json: slots })
      : route.fulfill({ status: slotsStatus, json: { error: "nope" } })
  );
  return page;
}

function session() {
  return {
    access_token: "fake-token", token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r",
    user: { id: "55555555-0000-0000-0000-000000000005", aud: "authenticated", role: "authenticated", email: "new@agency.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
}

const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

// ------------------------------------------------------------ shared checks

/** Copy rules: no em dashes, never "locked forever". */
async function copyRules(page, label) {
  const text = await page.locator("[class*='landing']").first().innerText();
  check(`${label}: no em dashes in copy`, text.includes("—"), false);
  check(`${label}: never says "locked forever"`, /locked forever/i.test(text), false);
  check(`${label}: hero H1`, await page.locator("h1").innerText(), "Price every client from their own numbers.");
  check(`${label}: pill`, await page.getByText("For AI and automation agencies", { exact: true }).count(), 1);
  check(`${label}: hero note`, await page.getByText("£29/mo for the first 25 agencies, locked while you stay subscribed.").count(), 1);
  check(`${label}: cancel note`, await page.getByText("Cancel anytime from your billing page.").count(), 1);
  check(`${label}: three steps`, await page.locator("#how ol > li").count(), 3);
  check(`${label}: suggested price on the card`, await page.getByText("£380/mo", { exact: true }).count(), 1);
  check(`${label}: app nav hidden`, await page.locator(".app-nav").count(), 0);
}

/**
 * Every visible text element against the colour actually behind it, alpha
 * blended down through its ancestors onto the page ground. AA: 4.5:1, or 3:1
 * for large text. Disabled controls are exempt under WCAG. The dot texture and
 * glow are background images, not colours; at 7% white and 16% teal they move
 * the worst pair (muted on ground) from 9.4:1 to about 8:1.
 */
async function contrast(page, label) {
  const failures = await page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const over = (top, bottom) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
    };
    const lum = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

    const root = document.querySelector("[class*='landing']");
    const ground = parse(getComputedStyle(root).backgroundColor);
    const out = [];
    for (const el of root.querySelectorAll("*")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own || el.closest("[disabled]")) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || el.closest("[class*='srOnly']")) continue;

      const chain = [];
      for (let n = el; n && n !== root; n = n.parentElement) chain.push(parse(getComputedStyle(n).backgroundColor));
      let bg = ground;
      for (const layer of chain.reverse()) if (layer[3] > 0) bg = over(layer, bg);

      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const r = ratio(over(parse(style.color), bg), bg);
      if (r < (large ? 3 : 4.5)) out.push(`${el.textContent.trim().slice(0, 30)} ${r.toFixed(2)}`);
    }
    return out;
  });
  check(`${label}: every text element passes AA contrast`, failures.length ? failures.join("; ") : "all pass", "all pass");
}

/** Tab through the page: every stop is a link, button or field, and shows a
 * ring of at least 2px. */
async function focusRings(page, label) {
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  const stops = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const st = getComputedStyle(el);
      return { tag: el.tagName, text: (el.textContent || el.id).trim().slice(0, 24), ring: st.outlineStyle !== "none" && parseFloat(st.outlineWidth) >= 2 };
    });
    if (s) stops.push(s);
  }
  const bad = stops.filter((s) => !["A", "BUTTON", "INPUT"].includes(s.tag) || !s.ring);
  check(`${label}: tab stops reached`, stops.length >= 6, true);
  check(`${label}: every tab stop is a link/button/field with a visible ring`, bad.length ? JSON.stringify(bad) : "ok", "ok");
}

async function mobile(base, label) {
  const page = await newPage(375, 812);
  await page.goto(base);
  await page.waitForTimeout(600);
  check(`${label} 375px: no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= 375), true);
  check(`${label} 375px: streak hidden`, await page.locator("svg[class*='streak']").isVisible(), false);
  const layout = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const text = r("[class*='heroText']");
    // Sorted by position: CSS order puts the pricing card first on a phone.
    const cards = [...document.querySelectorAll("[class*='visual'] > [class*='card']")].map((c) => c.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    const stacked = cards.every((c, i) => i === 0 || c.top >= cards[i - 1].bottom - 0.5);
    return { below: cards.every((c) => c.top >= text.bottom), stacked, count: cards.length };
  });
  check(`${label} 375px: cards below the text`, layout.below, true);
  check(`${label} 375px: three cards stacked, none overlapping`, `${layout.count} ${layout.stacked}`, "3 true");
  await shot(page, `${label}-375`);
  await page.context().close();
}

// ================================================================ live mode

// Claim → sign-up → /subscribe, from a fresh visit.
{
  const page = await newPage();
  await page.goto(`${LIVE}/waitlist`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Claim a founder spot" }).first().click();
  await page.waitForURL("**/login**");
  check("live: claim opens account creation", await page.getByText("Create an account").count(), 1);
  await page.fill("#email", "new@agency.test");
  await page.fill("#password", "correct-horse");
  await page.getByRole("button", { name: "Create account" }).click();
  // Polled rather than waitForURL, which stalls on this client-side replace.
  await page.waitForFunction(() => location.pathname === "/subscribe", null, { timeout: 8000 }).catch(() => {});
  check("live: after sign-up lands on /subscribe", new URL(page.url()).pathname, "/subscribe");
  await page.context().close();
}

{
  const page = await newPage();
  slotRequests = 0;
  await page.goto(`${LIVE}/waitlist`);
  await page.getByText("22 of 25 spots left").waitFor({ timeout: 5000 }).catch(() => {});

  await copyRules(page, "live");
  check("live: spots left from the route", await page.getByText("22 of 25 spots left").count(), 1);
  check("live: founder-slots asked once", slotRequests, 1);
  check("live: no waitlist form", await page.locator("#waitlist").count(), 0);

  const claims = await page.getByRole("link", { name: "Claim a founder spot" }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  check("live: three founder CTAs", claims.length, 3);
  check("live: every founder CTA goes to sign-up then /subscribe", claims.every((h) => h === SIGNUP), true);
  check("live: Sign in link", await page.getByRole("link", { name: "Sign in", exact: true }).getAttribute("href"), "/login");
  check("live: How it works link", await page.getByRole("link", { name: "How it works", exact: true }).getAttribute("href"), "#how");
  check("live: Pricing link", await page.getByRole("link", { name: "Pricing", exact: true }).getAttribute("href"), "#pricing");
  check("live: See how it works link", await page.getByRole("link", { name: "See how it works" }).getAttribute("href"), "#how");
  check("live: streak is aria-hidden", await page.locator("svg[class*='streak']").getAttribute("aria-hidden"), "true");
  check("live: streak shown on desktop", await page.locator("svg[class*='streak']").isVisible(), true);

  const overlap = await page.evaluate(() => {
    const [proposal, price] = [...document.querySelectorAll("[class*='visual'] > [class*='card']")].map((c) => c.getBoundingClientRect());
    return price.left < proposal.right && price.top < proposal.bottom;
  });
  check("live: cards overlap on desktop", overlap, true);

  const markers = await page.evaluate(() => ["floorMark", "targetMark"].map((k) => document.querySelector(`[class*='${k}']`).style.left));
  check("live: floor and target markers", markers.join(" "), "6.8% 33.2%");

  await contrast(page, "live");
  await focusRings(page, "live");
  await shot(page, "live-desktop");

  // See how it works scrolls to the section.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: "See how it works" }).click();
  await page.waitForTimeout(900);
  const howTop = await page.evaluate(() => document.getElementById("how").getBoundingClientRect().top);
  check("live: See how it works scrolls to #how", Math.abs(howTop) < 40, true);

  await page.context().close();
}

// No spots left, and a failed count.
{
  slots = { used: 25, limit: 25, remaining: 0 };
  const page = await newPage();
  await page.goto(`${LIVE}/waitlist`);
  await page.getByText("All founder spots are taken").waitFor({ timeout: 5000 }).catch(() => {});
  check("live: sold out says so", await page.getByText("All founder spots are taken. New agencies join on Standard.").count(), 1);
  await page.context().close();

  slotsStatus = 500;
  const failing = await newPage();
  await failing.goto(`${LIVE}/waitlist`);
  await failing.waitForTimeout(1200);
  check("live: failed count shows no counter", (await failing.locator("[class*='spots']").innerText()).trim(), "");
  check("live: failed count leaves the CTA", await failing.locator("[class*='planCta']").count(), 1);
  await failing.context().close();
  slotsStatus = 200;
  slots = { used: 3, limit: 25, remaining: 22 };
}

// A tablet width keeps the streak; a phone stacks the cards.
{
  const page = await newPage(800, 1000);
  await page.goto(`${LIVE}/waitlist`);
  check("live 800px: streak shown", await page.locator("svg[class*='streak']").isVisible(), true);
  check("live 800px: no horizontal scroll", await page.evaluate(() => document.documentElement.scrollWidth <= 800), true);
  await page.context().close();
}
await mobile(`${LIVE}/waitlist`, "live");

// ============================================================ waitlist mode

if (!WAITLIST) {
  results.push("SKIP  waitlist mode: set WAITLIST_BASE_URL to a server started with LAUNCH_MODE=waitlist");
} else {
  const page = await newPage();
  slotRequests = 0;
  await page.goto(`${WAITLIST}/`);
  await page.waitForTimeout(800);

  check("waitlist: / is the landing page (gate rewrite)", new URL(page.url()).pathname, "/");
  await copyRules(page, "waitlist");
  check("waitlist: founder-slots never asked", slotRequests, 0);
  check("waitlist: no counter", await page.locator("[class*='spots']").count(), 0);
  check("waitlist: no Sign in link", await page.getByRole("link", { name: "Sign in", exact: true }).count(), 0);
  check("waitlist: form present", await page.locator("#waitlist form").count(), 1);

  const claims = await page.getByRole("link", { name: "Claim a founder spot" }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  check("waitlist: three founder CTAs", claims.length, 3);
  check("waitlist: every founder CTA scrolls to the form", claims.every((h) => h === "#waitlist"), true);

  await contrast(page, "waitlist");
  await focusRings(page, "waitlist");
  await shot(page, "waitlist-desktop");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("[class*='heroActions']").getByRole("link", { name: "Claim a founder spot" }).click();
  await page.waitForTimeout(900);
  check("waitlist: claim focuses the email field", await page.evaluate(() => document.activeElement?.id), "waitlist-email");
  check("waitlist: form scrolled into view", await page.locator("#waitlist form").isVisible() && await page.evaluate(() => { const r = document.getElementById("waitlist").getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), true);

  // The existing form logic: lower-cased email, optional name, success.
  waitlistBodies = [];
  await page.fill("#waitlist-name", "  Sam  ");
  await page.fill("#waitlist-email", "  Owner@Agency.CO ");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await page.getByText("You’re on the list").waitFor({ timeout: 5000 }).catch(() => {});
  check("waitlist: joined message", await page.getByText("You’re on the list. We’ll email you when it opens.").count(), 1);
  check("waitlist: email lower-cased and trimmed", waitlistBodies[0]?.email, "owner@agency.co");
  check("waitlist: name trimmed", waitlistBodies[0]?.name, "Sam");
  await page.context().close();

  // A duplicate is still a success; a real failure shows an error.
  waitlistStatus = 409;
  const dup = await newPage();
  await dup.goto(`${WAITLIST}/`);
  await dup.fill("#waitlist-email", "owner@agency.co");
  await dup.getByRole("button", { name: "Join the waitlist" }).click();
  await dup.getByText("You’re on the list").waitFor({ timeout: 5000 }).catch(() => {});
  check("waitlist: duplicate signup reads as success", await dup.getByText("You’re on the list").count(), 1);
  await dup.context().close();

  waitlistStatus = 500;
  const bad = await newPage();
  await bad.goto(`${WAITLIST}/`);
  await bad.fill("#waitlist-email", "owner@agency.co");
  await bad.getByRole("button", { name: "Join the waitlist" }).click();
  const alert = bad.locator("#waitlist [role='alert']");
  await alert.waitFor({ timeout: 5000 }).catch(() => {});
  check("waitlist: failed insert shows an error", await alert.count(), 1);
  check("waitlist: form still there to retry", await bad.locator("#waitlist-email").count(), 1);
  await bad.context().close();
  waitlistStatus = 201;

  // The gate is unchanged: the app stays sealed. Asked directly rather than
  // through a page, whose founder-slots mock would answer first.
  const gate = await browser.newContext();
  for (const p of ["/login", "/subscribe", "/api/billing/founder-slots"]) {
    const res = await gate.request.get(`${WAITLIST}${p}`, { maxRedirects: 0 });
    check(`waitlist: ${p} still redirects to the front door`, `${res.status()} ${new URL(res.headers().location ?? "", WAITLIST).pathname}`, "307 /");
  }
  await gate.close();

  await mobile(`${WAITLIST}/`, "waitlist");
}

// ================================================================= report

await browser.close();

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} passed`);
console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");

if (failed.length || errors.length) process.exit(1);
