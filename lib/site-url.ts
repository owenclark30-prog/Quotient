/**
 * The site's public address, for the few places that need an absolute URL
 * baked in: metadataBase (and so the Open Graph and canonical URLs Next builds
 * from it), and the link in Supabase's sign-up confirmation email.
 *
 * Set NEXT_PUBLIC_SITE_URL per deployment (https://worthmark.netlify.app in
 * production). It is inlined at build time, so a change needs a redeploy.
 * Unset or unparseable falls back to local dev.
 *
 * Not for Stripe: Checkout success/cancel and the portal return must land on
 * whichever deployment the request came from, or a deploy preview sends its
 * testers to production. Those use lib/request-origin.ts.
 */

export const LOCAL_SITE_URL = "http://localhost:3000";

/** The origin only, with no trailing slash: "https://worthmark.netlify.app". */
export function siteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (!value) return LOCAL_SITE_URL;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return LOCAL_SITE_URL;
    return url.origin;
  } catch {
    return LOCAL_SITE_URL;
  }
}

/** An absolute URL on this site for a same-site path. */
export function siteHref(path: string, base: string = siteUrl()): string {
  return new URL(path.startsWith("/") ? path : `/${path}`, base).toString();
}
