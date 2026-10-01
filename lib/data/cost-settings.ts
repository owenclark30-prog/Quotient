import { supabase } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/supabase/session";
import { errorMessage } from "@/lib/errors";
import { PRICING_DEFAULTS } from "@/lib/pricing";

/** What it costs this agency to deliver, and how cautious it wants its own
 * estimates to be. Nothing here is ever shown to a client, and nothing here
 * touches the rate card. */
export type AgencyCostSettings = {
  hourlyCost: number;
  /** A fraction, 0–0.95. Stored as entered; the UI shows it as a percentage. */
  targetMargin: number;
  toolCostMonthly: number;
  /** k, also a fraction. Shaves the estimate before it's ever quoted. */
  conservatismFactor: number;
};

export const DEFAULT_COST_SETTINGS: AgencyCostSettings = {
  hourlyCost: PRICING_DEFAULTS.hourlyCost,
  targetMargin: PRICING_DEFAULTS.targetMargin,
  toolCostMonthly: PRICING_DEFAULTS.toolCostMonthly,
  conservatismFactor: PRICING_DEFAULTS.conservatismFactor,
};

/** PostgREST emits `numeric` as a JSON number, but a row written by hand or by
 * an older client could still hand back a string. Coerce, and fall back rather
 * than letting NaN through into a fee. */
function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? parsed
    : fallback;
}

export async function getCostSettings(): Promise<AgencyCostSettings> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("agency_cost_settings")
    .select("hourly_cost, target_margin, tool_cost_monthly, conservatism_factor")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  // No row yet means this agency has never opened the settings. The documented
  // defaults are the same ones lib/pricing.ts falls back to, so pricing works
  // before anything is saved.
  if (!data) return DEFAULT_COST_SETTINGS;

  return {
    hourlyCost: toNumber(data.hourly_cost, DEFAULT_COST_SETTINGS.hourlyCost),
    targetMargin: toNumber(
      data.target_margin,
      DEFAULT_COST_SETTINGS.targetMargin
    ),
    toolCostMonthly: toNumber(
      data.tool_cost_monthly,
      DEFAULT_COST_SETTINGS.toolCostMonthly
    ),
    conservatismFactor: toNumber(
      data.conservatism_factor,
      DEFAULT_COST_SETTINGS.conservatismFactor
    ),
  };
}

/** Never throws. The pricing step is an aid, not a gate — a failure fetching
 * these shouldn't take down the proposal flow, which works without them. */
export async function getCostSettingsOrDefault(): Promise<{
  settings: AgencyCostSettings;
  warning: string | null;
}> {
  try {
    return { settings: await getCostSettings(), warning: null };
  } catch (err) {
    return {
      settings: DEFAULT_COST_SETTINGS,
      warning: errorMessage(err, "Couldn't load your delivery cost settings"),
    };
  }
}

export async function updateCostSettings(settings: AgencyCostSettings) {
  const userId = await getCurrentUserId();

  const { error } = await supabase.from("agency_cost_settings").upsert({
    user_id: userId,
    hourly_cost: settings.hourlyCost,
    target_margin: settings.targetMargin,
    tool_cost_monthly: settings.toolCostMonthly,
    conservatism_factor: settings.conservatismFactor,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
