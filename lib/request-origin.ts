/**
 * Where to send someone back to.
 *
 * Checkout success/cancel and the portal return all have to land on whichever
 * deployment the request came from, or a deploy preview sends its testers to
 * production. So: derive from the request, never from a build-time constant.
 * There is deliberately no NEXT_PUBLIC_SITE_URL anywhere in this project.
 */

function parseOrigin(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function requestOrigin(request: Request): string {
  const host = request.headers.get("host");

  // The Origin header, which is what the browser actually sent. It is also
  // attacker-controllable, so it is only trusted when it names the same host
  // the request arrived on — otherwise a crafted header could point a Checkout
  // success URL at someone else's site.
  const origin = parseOrigin(request.headers.get("origin"));
  if (origin && (!host || origin.host === host)) return origin.origin;

  // Netlify sets this per deploy, including on previews.
  const deploy = parseOrigin(process.env.DEPLOY_PRIME_URL);
  if (deploy) return deploy.origin;

  // Last resort: rebuild it from the hop that reached us.
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const rebuilt = parseOrigin(`${proto}://${host}`);
    if (rebuilt) return rebuilt.origin;
  }

  throw new Error(
    "Cannot determine the request origin: no usable Origin header, DEPLOY_PRIME_URL or Host"
  );
}
