import { NextResponse, type NextRequest } from "next/server";
import { launchGateDecision, WAITLIST_PATH } from "@/lib/launch-gate";

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
 * The rule itself lives in lib/launch-gate.ts so it can be tested without a
 * server; this is the shell that turns its decision into a response.
 */
export function middleware(request: NextRequest) {
  const decision = launchGateDecision(
    process.env.LAUNCH_MODE,
    request.nextUrl.pathname
  );

  switch (decision.action) {
    case "rewrite":
      return NextResponse.rewrite(new URL(decision.to, request.url));
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, request.url));
    default:
      return NextResponse.next();
  }
}

export const config = {
  // Static assets and image optimisation are excluded, so the page can style
  // itself. Anything with a file extension is left alone for the same reason.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};

export { WAITLIST_PATH };
