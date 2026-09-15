import { NextResponse, type NextRequest } from "next/server";

/**
 * Pre-launch gate.
 *
 * Deliberately middleware rather than a change inside the app: every existing
 * page, RequireAuth and AppNav stay byte-identical, and when the gate is down
 * this returns `next()` before anything else runs.
 *
 * `LAUNCH_MODE` is a plain server env var, not NEXT_PUBLIC_*, so it is never
 * inlined into the client bundle and the gate cannot be flipped from the
 * browser.
 *
 * Fail-open by design: only the exact string "waitlist" raises the gate.
 * Unset, mistyped, or anything else runs the app as normal — losing an env var
 * should not hide the whole product behind a signup form.
 */
const WAITLIST_PATH = "/waitlist";

export function middleware(request: NextRequest) {
  if (process.env.LAUNCH_MODE !== "waitlist") return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Serve the page itself, or the gate would redirect to itself forever.
  if (pathname === WAITLIST_PATH) return NextResponse.next();

  // Rewrite rather than redirect, so the waitlist is what "/" actually is.
  if (pathname === "/") {
    return NextResponse.rewrite(new URL(WAITLIST_PATH, request.url));
  }

  // Everything else — /login, /rate-card, /onboarding/* — goes to the front
  // door. The whole app is sealed while the gate is up.
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  // Static assets and image optimisation are excluded, so the page can style
  // itself. Anything with a file extension is left alone for the same reason.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
