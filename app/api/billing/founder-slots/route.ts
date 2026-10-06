import { NextResponse } from "next/server";
import { FOUNDER_SLOT_LIMIT, founderSlotsRemaining } from "@/lib/billing";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How many founder spots are left, for the /subscribe page.
 *
 * This is a route rather than an RPC the browser calls directly because
 * founder_slots_used is granted to service_role only: its exclude-user argument
 * would otherwise let a caller test whether one specific person holds a slot by
 * diffing two counts. Here the argument is never passed, so only the total
 * leaves the server.
 *
 * Signed-in only — the page behind it is too, and an open counter is something
 * to scrape.
 */
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

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

  return NextResponse.json({
    used: data,
    limit: FOUNDER_SLOT_LIMIT,
    remaining: founderSlotsRemaining(data),
  });
}
