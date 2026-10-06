import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  launchGateDecision,
  WAITLIST_PATH,
  WEBHOOK_PATH,
} from "./launch-gate.ts";

const APP_PATHS = [
  "/",
  "/login",
  "/rate-card",
  "/settings",
  "/settings/billing",
  "/subscribe",
  "/proposals",
  "/proposals/new",
  "/proposal",
  "/onboarding/documents",
  "/onboarding/clients/abc-123",
  "/api/billing/checkout",
  "/api/billing/portal",
  "/api/billing/founder-slots",
];

describe("the gate is down", () => {
  for (const mode of [undefined, "", "live", "Waitlist", "WAITLIST", "nonsense"]) {
    it(`lets everything through when LAUNCH_MODE is ${JSON.stringify(mode)}`, () => {
      for (const path of [...APP_PATHS, WAITLIST_PATH, WEBHOOK_PATH]) {
        assert.deepEqual(
          launchGateDecision(mode, path),
          { action: "next" },
          `${path} was gated with LAUNCH_MODE=${JSON.stringify(mode)}`
        );
      }
    });
  }

  it("is case-sensitive, so only the exact string raises it", () => {
    // Fail open: a typo must not hide the product behind a signup form.
    assert.deepEqual(launchGateDecision("Waitlist", "/rate-card"), {
      action: "next",
    });
  });
});

describe("the gate is up", () => {
  const gated = (path: string) => launchGateDecision("waitlist", path);

  it("serves the waitlist page itself, or it would redirect forever", () => {
    assert.deepEqual(gated(WAITLIST_PATH), { action: "next" });
  });

  it("rewrites the root, so the waitlist is what / actually is", () => {
    assert.deepEqual(gated("/"), { action: "rewrite", to: WAITLIST_PATH });
  });

  it("sends every app page to the front door", () => {
    for (const path of [
      "/login",
      "/rate-card",
      "/settings",
      "/settings/billing",
      "/subscribe",
      "/proposals/new",
      "/onboarding/clients/abc-123",
    ]) {
      assert.deepEqual(gated(path), { action: "redirect", to: "/" }, path);
    }
  });
});

describe("the Stripe webhook stays open while the gate is up", () => {
  it("lets the webhook through", () => {
    // A redirect is a 307 Stripe records as a failed delivery. Without this,
    // subscriptions would be paid for and never sync, silently.
    assert.deepEqual(launchGateDecision("waitlist", WEBHOOK_PATH), {
      action: "next",
    });
  });

  it("exempts that path and nothing else", () => {
    assert.equal(WEBHOOK_PATH, "/api/stripe/webhook");

    // The sibling billing routes are still sealed: they are browser endpoints
    // and have no business being reachable before launch.
    for (const path of [
      "/api/billing/checkout",
      "/api/billing/portal",
      "/api/billing/founder-slots",
      "/api/stripe",
      "/api/stripe/webhook/extra",
      "/api/stripe/webhook2",
      "/api",
    ]) {
      assert.deepEqual(
        launchGateDecision("waitlist", path),
        { action: "redirect", to: "/" },
        `${path} should not be exempt`
      );
    }
  });

  it("matches exactly, not as a prefix or with a trailing slash", () => {
    // Next normalises trailing slashes before middleware sees the pathname, so
    // an exact comparison is the right one — but if that ever changed, this
    // test says what the behaviour is rather than leaving it a surprise.
    assert.deepEqual(launchGateDecision("waitlist", "/api/stripe/webhook/"), {
      action: "redirect",
      to: "/",
    });
  });

  it("is irrelevant when the gate is down, like everything else", () => {
    assert.deepEqual(launchGateDecision("live", WEBHOOK_PATH), {
      action: "next",
    });
  });
});
