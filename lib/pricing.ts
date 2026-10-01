/**
 * "Price this client" — the pure calculation.
 *
 * Deliberately free of DB and UI imports: this module is the whole of the
 * arithmetic, so it can be unit-tested without a browser or a database, and so
 * a saved proposal can replay stored numbers without re-deriving anything.
 *
 * It never reads or writes the rate card. The agency's own fees are an input
 * used for the verdict, nothing more.
 *
 * Every figure here is an estimate from the numbers a client gave you. It is
 * not a market benchmark, and the UI says so.
 */

export type LeverKey = "missed" | "noshow" | "react" | "time";

/** Percentages are whole numbers (30 means 30%). Fractions — margin and
 * conservatism — are 0–1, because they're used directly in the formulas. */
export const PRICING_DEFAULTS = {
  missedRate: 30,
  recoveryRate: 50,
  closeRate: 30,
  noShowReduction: 30,
  reactivationRate: 3,
  reactivationCloseRate: 30,
  /** React value is a one-off burst of work spread across half a year, never
   * recurring revenue — hence the /6 and this constant living here. */
  reactivationSpreadMonths: 6,
  conservatismFactor: 0.7,
  hourlyCost: 25,
  targetMargin: 0.5,
  toolCostMonthly: 40,
  /** By tier level (1-indexed). Beyond the third tier, the last value holds. */
  setupHoursByLevel: [12, 25, 40],
  supportHoursByLevel: [2, 4, 6],
} as const;

/** Share of conservative value the agency can justify charging. */
export const RANGE_MULTIPLIERS = { low: 0.1, target: 0.15, high: 0.25 } as const;

/** Thresholds past which a figure is implausible enough to flag rather than
 * silently price against. */
export const WARNING_THRESHOLDS = {
  closeRate: 80,
  missedRate: 70,
  valueToFeeRatio: 10,
} as const;

export type MissedInputs = {
  enquiries: number;
  missedRate?: number;
  recoveryRate?: number;
  closeRate?: number;
  avgCustomerValue: number;
};

export type NoShowInputs = {
  appointments: number;
  noShowRate: number;
  reductionRate?: number;
  appointmentValue: number;
};

export type ReactInputs = {
  dormantContacts: number;
  reactivationRate?: number;
  closeRate?: number;
  avgCustomerValue: number;
};

export type TimeInputs = {
  hoursSaved: number;
  staffCostPerHour: number;
};

export type PricingInputs = {
  levers: LeverKey[];
  missed?: MissedInputs;
  noshow?: NoShowInputs;
  react?: ReactInputs;
  time?: TimeInputs;
  /** k. Editable; defaults to 0.7. */
  conservatismFactor?: number;
};

/** What it costs this agency to deliver this tier. Comes from agency settings
 * and per-tier hours — never from the rate card. */
export type DeliveryCost = {
  hourlyCost?: number;
  targetMargin?: number;
  toolCostMonthly?: number;
  setupHours: number;
  supportHours: number;
};

export type PricingStatus = "ok" | "not_viable" | "missing_inputs";

export type VerdictKind =
  | "below_floor"
  | "underpriced"
  | "above_range"
  | "inside_range";

export type Verdict = {
  kind: VerdictKind;
  message: string;
  /** Signed gap to the middle of the range: positive means the fee is under
   * target. Always present so a caller can show "how far from target". */
  targetGap: number | null;
};

export type PricingWarning = {
  code: "close_rate_high" | "missed_rate_high" | "value_far_above_fee";
  message: string;
};

export type PricingResult = {
  status: PricingStatus;
  /** Named so the UI can point at the field, not just say "something's wrong". */
  missingFields: string[];
  warnings: PricingWarning[];
  value: {
    levers: Record<LeverKey, number>;
    total: number;
    conservative: number;
    conservatismFactor: number;
  };
  floor: { monthly: number; setup: number };
  range: { low: number; target: number; high: number } | null;
  recommended: { monthly: number; setup: number } | null;
  roi: number | null;
  paybackMonths: number | null;
  verdict: Verdict | null;
};

const round = (n: number) => Math.round(n);
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => n / 100;

/** Treats null/undefined/NaN as absent, but lets a deliberate 0 through so the
 * caller can distinguish "not filled in" from "genuinely zero". */
function provided(value: number | undefined | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function required(
  value: number | undefined | null,
  field: string,
  missing: string[]
): number {
  if (!provided(value) || value <= 0) {
    missing.push(field);
    return 0;
  }
  return value;
}

function withDefault(value: number | undefined, fallback: number): number {
  return provided(value) ? value : fallback;
}

function clampLevel(level: number, table: readonly number[]): number {
  const index = Math.min(Math.max(Math.trunc(level), 1), table.length) - 1;
  return table[index];
}

/** Delivery-hour defaults for a tier, by its level. Callers override with
 * whatever the agency has actually set. */
export function defaultHoursForLevel(level: number) {
  return {
    setupHours: clampLevel(level, PRICING_DEFAULTS.setupHoursByLevel),
    supportHours: clampLevel(level, PRICING_DEFAULTS.supportHoursByLevel),
  };
}

/* -------------------------------------------------------------- the levers */

function missedValue(input: MissedInputs, missing: string[]) {
  const enquiries = required(input.enquiries, "missed.enquiries", missing);
  const avgValue = required(
    input.avgCustomerValue,
    "missed.avgCustomerValue",
    missing
  );
  return (
    enquiries *
    pct(withDefault(input.missedRate, PRICING_DEFAULTS.missedRate)) *
    pct(withDefault(input.recoveryRate, PRICING_DEFAULTS.recoveryRate)) *
    pct(withDefault(input.closeRate, PRICING_DEFAULTS.closeRate)) *
    avgValue
  );
}

function noShowValue(input: NoShowInputs, missing: string[]) {
  const appointments = required(
    input.appointments,
    "noshow.appointments",
    missing
  );
  // No default: an agency guessing a client's no-show rate is the one number
  // most likely to be wrong, so it has to be entered.
  const noShowRate = required(input.noShowRate, "noshow.noShowRate", missing);
  const value = required(
    input.appointmentValue,
    "noshow.appointmentValue",
    missing
  );
  return (
    appointments *
    pct(noShowRate) *
    pct(withDefault(input.reductionRate, PRICING_DEFAULTS.noShowReduction)) *
    value
  );
}

function reactValue(input: ReactInputs, missing: string[]) {
  const contacts = required(
    input.dormantContacts,
    "react.dormantContacts",
    missing
  );
  const avgValue = required(
    input.avgCustomerValue,
    "react.avgCustomerValue",
    missing
  );
  return (
    (contacts *
      pct(
        withDefault(input.reactivationRate, PRICING_DEFAULTS.reactivationRate)
      ) *
      pct(withDefault(input.closeRate, PRICING_DEFAULTS.reactivationCloseRate)) *
      avgValue) /
    PRICING_DEFAULTS.reactivationSpreadMonths
  );
}

function timeValue(input: TimeInputs, missing: string[]) {
  const hours = required(input.hoursSaved, "time.hoursSaved", missing);
  const cost = required(input.staffCostPerHour, "time.staffCostPerHour", missing);
  return hours * cost;
}

/* --------------------------------------------------------------- the floor */

/** What the agency must charge to hit its target margin on this tier.
 * Independent of the client's numbers — it's a cost fact, not an estimate. */
export function deliveryFloor(cost: DeliveryCost) {
  const hourly = withDefault(cost.hourlyCost, PRICING_DEFAULTS.hourlyCost);
  const margin = withDefault(cost.targetMargin, PRICING_DEFAULTS.targetMargin);
  const tools = withDefault(cost.toolCostMonthly, PRICING_DEFAULTS.toolCostMonthly);

  // A margin of 1 (or more) would divide by zero or flip the sign. Cap just
  // below so a mistyped setting produces a huge floor rather than nonsense.
  const retained = Math.max(1 - margin, 0.01);

  return {
    monthly: round((cost.supportHours * hourly + tools) / retained),
    setup: round((cost.setupHours * hourly) / retained),
  };
}

/* -------------------------------------------------------------- the verdict */

function buildVerdict(
  fee: number,
  floorMonthly: number,
  range: { low: number; target: number; high: number } | null
): Verdict {
  const targetGap = range ? round(range.target - fee) : null;

  // Floor first, deliberately. Losing money is the more serious finding than
  // being under the value range, and a fee can be both.
  if (fee < floorMonthly) {
    return {
      kind: "below_floor",
      message: "Below your own floor, you lose money at this price",
      targetGap,
    };
  }

  if (!range) {
    return { kind: "inside_range", message: "Inside the range", targetGap };
  }

  if (fee < range.low) {
    return {
      kind: "underpriced",
      message: `Underpriced by ${round(range.low - fee)} per month`,
      targetGap,
    };
  }

  if (fee > range.high) {
    return {
      kind: "above_range",
      message: "Above the value-justified range, expect pushback",
      targetGap,
    };
  }

  const gap = targetGap ?? 0;
  const detail =
    gap === 0
      ? "on target"
      : gap > 0
        ? `${gap} per month below target`
        : `${Math.abs(gap)} per month above target`;
  return { kind: "inside_range", message: `Inside the range — ${detail}`, targetGap };
}

/* ---------------------------------------------------------------- the whole */

export function calculatePricing(
  inputs: PricingInputs,
  cost: DeliveryCost,
  /** The rate card fee for this tier, for the verdict only. Never written to. */
  rateCardMonthlyFee?: number
): PricingResult {
  const missingFields: string[] = [];
  const levers: Record<LeverKey, number> = {
    missed: 0,
    noshow: 0,
    react: 0,
    time: 0,
  };

  const selected = new Set(inputs.levers);
  // Each lever is rounded to pence on the way out. Left raw, a chain like
  // 120 * 0.3 * 0.5 * 0.3 * 600 returns 3239.9999999999995.
  if (selected.has("missed")) {
    levers.missed = inputs.missed
      ? missedValue(inputs.missed, missingFields)
      : (missingFields.push("missed.enquiries"), 0);
  }
  if (selected.has("noshow")) {
    levers.noshow = inputs.noshow
      ? noShowValue(inputs.noshow, missingFields)
      : (missingFields.push("noshow.appointments"), 0);
  }
  if (selected.has("react")) {
    levers.react = inputs.react
      ? reactValue(inputs.react, missingFields)
      : (missingFields.push("react.dormantContacts"), 0);
  }
  if (selected.has("time")) {
    levers.time = inputs.time
      ? timeValue(inputs.time, missingFields)
      : (missingFields.push("time.hoursSaved"), 0);
  }

  if (selected.size === 0) missingFields.push("levers");

  const k = withDefault(
    inputs.conservatismFactor,
    PRICING_DEFAULTS.conservatismFactor
  );
  for (const key of Object.keys(levers) as LeverKey[]) {
    levers[key] = round2(levers[key]);
  }
  const total = round2(levers.missed + levers.noshow + levers.react + levers.time);
  const conservative = round2(total * k);
  const floor = deliveryFloor(cost);

  const warnings: PricingWarning[] = [];
  const closeRates = [inputs.missed?.closeRate, inputs.react?.closeRate];
  if (closeRates.some((r) => provided(r) && r > WARNING_THRESHOLDS.closeRate)) {
    warnings.push({
      code: "close_rate_high",
      message: `A close rate above ${WARNING_THRESHOLDS.closeRate}% is optimistic — the estimate rests on it`,
    });
  }
  if (
    provided(inputs.missed?.missedRate) &&
    inputs.missed!.missedRate! > WARNING_THRESHOLDS.missedRate
  ) {
    warnings.push({
      code: "missed_rate_high",
      message: `Missing more than ${WARNING_THRESHOLDS.missedRate}% of enquiries is unusual — check the figure`,
    });
  }

  const value = { levers, total, conservative, conservatismFactor: k };

  if (missingFields.length > 0) {
    return {
      status: "missing_inputs",
      missingFields,
      warnings,
      value,
      floor,
      range: null,
      recommended: null,
      roi: null,
      paybackMonths: null,
      verdict:
        rateCardMonthlyFee != null
          ? buildVerdict(rateCardMonthlyFee, floor.monthly, null)
          : null,
    };
  }

  const range = {
    low: round(conservative * RANGE_MULTIPLIERS.low),
    target: round(conservative * RANGE_MULTIPLIERS.target),
    high: round(conservative * RANGE_MULTIPLIERS.high),
  };

  if (
    rateCardMonthlyFee != null &&
    rateCardMonthlyFee > 0 &&
    conservative > rateCardMonthlyFee * WARNING_THRESHOLDS.valueToFeeRatio
  ) {
    warnings.push({
      code: "value_far_above_fee",
      message: `Estimated value is more than ${WARNING_THRESHOLDS.valueToFeeRatio}× the fee — a client may not believe it`,
    });
  }

  const verdict =
    rateCardMonthlyFee != null
      ? buildVerdict(rateCardMonthlyFee, floor.monthly, range)
      : null;

  // The floor wins when it's inside what the value can justify. When even the
  // floor costs more than the top of the range, there is no honest price.
  let monthly: number | null = null;
  if (range.target >= floor.monthly) monthly = range.target;
  else if (floor.monthly <= range.high) monthly = floor.monthly;

  if (monthly == null) {
    return {
      status: "not_viable",
      missingFields,
      warnings,
      value,
      floor,
      range,
      recommended: null,
      roi: null,
      paybackMonths: null,
      verdict,
    };
  }

  const setup = Math.max(floor.setup, 2 * monthly);
  const surplus = conservative - monthly;

  return {
    status: "ok",
    missingFields,
    warnings,
    value,
    floor,
    range,
    recommended: { monthly, setup },
    roi: monthly > 0 ? round2(conservative / monthly) : null,
    // Guarded: a fee at or above the value it creates never pays back.
    paybackMonths: surplus > 0 ? round2(setup / surplus) : null,
    verdict,
  };
}
