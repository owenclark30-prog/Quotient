import { test } from "node:test";
import assert from "node:assert/strict";
import { landingMode, safeNextPath, SIGNUP_PATH } from "./landing.ts";
import { launchGateDecision } from "./launch-gate.ts";

test("landingMode: only the exact string is waitlist", () => {
  assert.equal(landingMode("waitlist"), "waitlist");
  assert.equal(landingMode("live"), "live");
  assert.equal(landingMode(undefined), "live");
  assert.equal(landingMode(""), "live");
  assert.equal(landingMode("Waitlist"), "live");
  assert.equal(landingMode("waitlist "), "live");
});

test("landingMode agrees with the launch gate for every value", () => {
  // The page and the gate must never disagree about which mode this is.
  for (const value of ["waitlist", "live", undefined, "", "Waitlist", "off"]) {
    const gated = launchGateDecision(value, "/login").action !== "next";
    assert.equal(landingMode(value) === "waitlist", gated, String(value));
  }
});

test("safeNextPath keeps same-site paths", () => {
  assert.equal(safeNextPath("/subscribe"), "/subscribe");
  assert.equal(safeNextPath("/proposal?id=1"), "/proposal?id=1");
});

test("safeNextPath falls back for anything that could leave the site", () => {
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(""), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("/\\evil.example"), "/");
  assert.equal(safeNextPath("javascript:alert(1)"), "/");
});

test("the sign-up link lands on /subscribe", () => {
  const url = new URL(SIGNUP_PATH, "https://example.test");
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("mode"), "signup");
  assert.equal(safeNextPath(url.searchParams.get("next")), "/subscribe");
});
