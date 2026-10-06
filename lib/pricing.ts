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
  /** The suggested fees: rounded, when rounding is on. This is what "use
   * suggested fees" charges, so ROI and payback below are measured against it. */
  recommended: { monthly: number; setup: number } | null;
  /** The same suggestion before rounding — the maths, kept visible beside the
   * price. Equal to `recommended` when rounding is off or changed nothing. */
  calculated: { monthly: number; setup: number } | null;
  /** The rounding settings this result was produced with, and the steps they
   * resolved to. Frozen into a proposal's snapshot with everything else. */
  rounding: AppliedRounding;
  roi: number | null;
  paybackMonths: number | null;
  verdict: Verdict | null;
};

/* ----------------------------------------------------------- price rounding */

export type RoundingStyle = "off" | "clean" | "charm";
export type RoundingEnding = 7 | 9;

export type RoundingSettings = {
  style: RoundingStyle;
  /** Last digit of a charm price. Ignored for clean and off. */
  ending: RoundingEnding;
  /** Whole pounds. Null means the scaled default for the amount being rounded. */
  step: number | null;
};

export type AppliedRounding = RoundingSettings & {
  /** The step actually used for each fee — the override, or the scaled
   * default for that fee's own size. Null when rounding is off or there was
   * nothing to round. */
  monthlyStep: number | null;
  setupStep: number | null;
};

/** The default for an agency that has never opened the setting. */
export const ROUNDING_DEFAULTS: RoundingSettings = {
  style: "clean",
  ending: 7,
  step: null,
};

/** Used when no rounding is passed, so every caller that predates rounding —
 * and every existing test — gets exactly the numbers it always did. */
export const ROUNDING_OFF: RoundingSettings = {
  style: "off",
  ending: 7,
  step: null,
};

/**
 * The step a monthly fee rounds to when no override is set. Grows with the
 * price, so a £60 fee isn't rounded in £100s and a £3,000 one isn't in £5s.
 *
 * Bands are half-open — a fee exactly on a boundary takes the band above —
 * so every amount has exactly one answer: under £100 → £5, £100 to under
 * £500 → £25, £500 to under £2,000 → £50, £2,000 and over → £100.
 */
export function defaultMonthlyStep(amount: number): number {
  if (amount < 100) return 5;
  if (amount < 500) return 25;
  if (amount < 2000) return 50;
  return 100;
}

/** As above, for a setup fee: £50 under £2,000, £100 from £2,000. */
export function defaultSetupStep(amount: number): number {
  return amount < 2000 ? 50 : 100;
}

function wholeStep(step: number | null): number | null {
  return typeof step === "number" && Number.isInteger(step) && step >= 1
    ? step
    : null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * The candidate prices for a style, as `n * spacing - offset` for whole n.
 *
 * Clean: every multiple of the step.
 *
 * Charm: each multiple of the step, less the offset that makes it end in the
 * chosen digit — 3 for a 7, 1 for a 9. With step 50 that is 447, 497, 547.
 * But a multiple of 25 minus 3 can end in 2 (72) as easily as 7 (47), so only
 * the multiples that are also multiples of 10 qualify: the spacing is the
 * lowest common multiple of the step and 10. For steps of 10, 50 and 100 that
 * is the step itself; for the scaled £5 and £25 it is £10 and £50.
 */
function candidateGrid(
  settings: RoundingSettings,
  step: number
): { spacing: number; offset: number } | null {
  if (settings.style === "clean") return { spacing: step, offset: 0 };
  if (settings.style === "charm") {
    return {
      spacing: (step * 10) / gcd(step, 10),
      offset: 10 - settings.ending,
    };
  }
  return null;
}

/**
 * The candidate price nearest `amount` that lies within [min, max], or null if
 * no candidate does.
 *
 * Nearest within the band, rather than nearest and then corrected, so both
 * guardrails fall out of one rule: when the nearest candidate is below the
 * floor this returns the next one up, and when it is above the range it returns
 * the next one down. Ties round up.
 */
export function nearestCandidate(
  amount: number,
  settings: RoundingSettings,
  step: number,
  min: number,
  max: number = Number.POSITIVE_INFINITY
): number | null {
  const grid = candidateGrid(settings, step);
  if (!grid) return null;
  const { spacing, offset } = grid;

  // Candidates are n * spacing - offset, so the band in terms of n:
  const nMin = Math.ceil((min + offset) / spacing);
  const nMax = Number.isFinite(max)
    ? Math.floor((max + offset) / spacing)
    : Number.POSITIVE_INFINITY;
  if (nMin > nMax) return null;

  const nearest = Math.floor((amount + offset) / spacing + 0.5);
  const n = Math.min(Math.max(nearest, nMin), nMax);
  const candidate = n * spacing - offset;

  // A price of zero or less is not a price, whatever the band says.
  return candidate > 0 ? candidate : null;
}

/**
 * Round one fee, inside its guardrails.
 *
 * Off returns the amount untouched. If no candidate fits the band, the
 * unrounded amount is returned too: an honest odd number beats a round one
 * that breaks the floor or the range.
 */
export function roundFee(
  amount: number,
  settings: RoundingSettings,
  kind: "monthly" | "setup",
  band: { min: number; max?: number }
): { price: number; step: number | null } {
  if (settings.style === "off") return { price: amount, step: null };

  const step =
    wholeStep(settings.step) ??
    (kind === "monthly" ? defaultMonthlyStep(amount) : defaultSetupStep(amount));

  const price = nearestCandidate(amount, settings, step, band.min, band.max);
  return { price: price ?? amount, step };
}

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

/* ------------------------------------------------- picking levers for a tier */

/** Words in a service name that mark it as addressing a lever. Lowercase,
 * matched as substrings. Only ever used to pre-tick boxes the agency can
 * untick, so a loose match costs nothing and a missed one costs a click. */
const LEVER_KEYWORDS: Record<LeverKey, readonly string[]> = {
  missed: [
    "missed call",
    "missed-call",
    "missed",
    "speed to lead",
    "instant response",
    "instant reply",
    "lead response",
    "enquiry",
    "enquiries",
    "inbound",
    "sms",
    "text back",
    "callback",
    "call back",
    "follow-up",
    "follow up",
    "qualification",
  ],
  noshow: [
    "no-show",
    "no show",
    "noshow",
    "reminder",
    "confirmation",
    "booking",
    "appointment",
    "rebook",
    "re-book",
  ],
  react: [
    "reactivation",
    "reactivate",
    "dormant",
    "database",
    "win-back",
    "winback",
    "lapsed",
    "past client",
    "nurture",
  ],
  time: [
    "automation",
    "automate",
    "workflow",
    "admin",
    "crm",
    "reporting",
    "dashboard",
    "integration",
  ],
};

/** Which levers a tier's services plausibly move. Returns them in the fixed
 * order the UI lists them, never a per-tier order, so the form doesn't
 * reshuffle as services change. */
export function suggestLevers(serviceNames: readonly string[]): LeverKey[] {
  const haystack = serviceNames.map((name) => name.toLowerCase());
  const order: LeverKey[] = ["missed", "noshow", "react", "time"];

  return order.filter((lever) =>
    LEVER_KEYWORDS[lever].some((keyword) =>
      haystack.some((name) => name.includes(keyword))
    )
  );
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

/* ------------------------------------------- the return on the fee charged */

/** ROI and payback against the fees actually being charged.
 *
 * Distinct from the ROI in `PricingResult`, which is against the *recommended*
 * monthly. The agency may keep its rate card fee or type its own, and the
 * client's "Expected return" has to describe the deal in front of them rather
 * than one they were never offered. */
export function appliedReturn(
  conservativeMonthly: number,
  setupFee: number,
  monthlyFee: number
): { roi: number | null; paybackMonths: number | null } {
  const surplus = conservativeMonthly - monthlyFee;

  return {
    roi: monthlyFee > 0 ? round2(conservativeMonthly / monthlyFee) : null,
    // A fee at or above the value it creates never pays back, and this one is
    // reachable: nothing stops an agency typing a fee above the estimate.
    paybackMonths: surplus > 0 ? round2(setupFee / surplus) : null,
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
  rateCardMonthlyFee?: number,
  /** How to round the suggested fees. Off when omitted. */
  rounding: RoundingSettings = ROUNDING_OFF
): PricingResult {
  /** Rounding as recorded on a result with nothing to round. */
  const noRounding: AppliedRounding = {
    ...rounding,
    monthlyStep: null,
    setupStep: null,
  };

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
      calculated: null,
      rounding: noRounding,
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
      calculated: null,
      rounding: noRounding,
      roi: null,
      paybackMonths: null,
      verdict,
    };
  }

  const calculated = { monthly, setup: Math.max(floor.setup, 2 * monthly) };

  // Round the monthly fee inside the same guardrails the recommendation
  // already respects: never below the floor, never outside the range. The
  // recommendation itself always sits inside that band, so there is always
  // something to fall back to.
  const roundedMonthly = roundFee(monthly, rounding, "monthly", {
    min: Math.max(floor.monthly, range.low),
    max: range.high,
  });

  // Setup is re-derived from the *rounded* monthly, then rounded upward only:
  // it must still clear the setup floor and twice the monthly actually charged.
  const setupMinimum = Math.max(floor.setup, 2 * roundedMonthly.price);
  const roundedSetup = roundFee(setupMinimum, rounding, "setup", {
    min: setupMinimum,
  });

  const charged = roundedMonthly.price;
  const setup = roundedSetup.price;
  const surplus = conservative - charged;

  return {
    status: "ok",
    missingFields,
    warnings,
    value,
    floor,
    range,
    recommended: { monthly: charged, setup },
    calculated,
    rounding: {
      ...rounding,
      monthlyStep: roundedMonthly.step,
      setupStep: roundedSetup.step,
    },
    // Against the fee that would be charged — the rounded one — the same rule
    // as a custom fee. Quoting a return on £431 while charging £425 would be
    // describing a deal nobody was offered.
    roi: charged > 0 ? round2(conservative / charged) : null,
    // Guarded: a fee at or above the value it creates never pays back.
    paybackMonths: surplus > 0 ? round2(setup / surplus) : null,
    verdict,
  };
}
