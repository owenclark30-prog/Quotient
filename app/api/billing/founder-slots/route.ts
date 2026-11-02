import { NextResponse } from "next/server";
import { FOUNDER_SLOT_LIMIT, founderSlotsRemaining } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How many founder spots are left, for /subscribe and the public landing page.
 *
 * This is a route rather than an RPC the browser calls directly because
 * founder_slots_used is granted to service_role only: its exclude-user argument
 * would otherwise let a caller test whether one specific person holds a slot by
 * diffing two counts. Here the argument is never passed, so only the total
 * leaves the server.
 *
 * Public: the landing page shows this number to signed-out visitors, and it
 * says nothing about who holds a spot. The CDN keeps it for 30 seconds, so a
 * busy page or a scraper costs one database call per half minute rather than
 * one per visit. Spots are claimed against the database at checkout, never
 * against this figure, so a stale count can only be a stale label.
 *
 * In waitlist mode the launch gate redirects this path like any other, and the
 * landing page doesn't ask for it.
 */
export async function GET() {
  let admin;
  try {
    admin = supabaseAdmin();
  } catch (err) {
    console.error("[billing/founder-slots] configuration", err);
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 500 }
    );
  }

  const { data, error } = await admin.rpc("founder_slots_used");

  if (error || typeof data !== "number") {
    console.error("[billing/founder-slots] rpc", error);
    return NextResponse.json(
      { error: "Couldn't count the founder spots." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      used: data,
      limit: FOUNDER_SLOT_LIMIT,
      remaining: founderSlotsRemaining(data),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control":
          "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
