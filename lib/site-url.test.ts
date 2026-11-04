import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCAL_SITE_URL, siteHref, siteUrl } from "./site-url.ts";

test("siteUrl: the configured origin, normalised", () => {
  assert.equal(siteUrl("https://worthmark.netlify.app"), "https://worthmark.netlify.app");
  assert.equal(siteUrl("https://worthmark.netlify.app/"), "https://worthmark.netlify.app");
  assert.equal(siteUrl(" https://worthmark.netlify.app/some/path "), "https://worthmark.netlify.app");
});

test("siteUrl: falls back to local dev when unset or unusable", () => {
  assert.equal(siteUrl(undefined), LOCAL_SITE_URL);
  assert.equal(siteUrl(""), LOCAL_SITE_URL);
  assert.equal(siteUrl("worthmark.netlify.app"), LOCAL_SITE_URL);
  assert.equal(siteUrl("javascript:alert(1)"), LOCAL_SITE_URL);
  assert.equal(LOCAL_SITE_URL, "http://localhost:3000");
});

test("siteHref: absolute URLs on the site", () => {
  const base = "https://worthmark.netlify.app";
  assert.equal(siteHref("/login?next=/subscribe", base), "https://worthmark.netlify.app/login?next=/subscribe");
  assert.equal(siteHref("login", base), "https://worthmark.netlify.app/login");
});
