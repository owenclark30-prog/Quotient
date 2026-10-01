/**
 * The frozen "Price this client" snapshot.
 *
 * This is what goes into `proposals.pricing_inputs` and what a saved proposal
 * reads back out. Everything a client has already seen lives on the proposal's
 * own row, so a saved proposal renders its own numbers and never recalculates:
 * changing your cost settings, your rate card or these defaults cannot rewrite
 * a quote you have already sent.
 *
 * Deliberately free of DB and UI imports, like `pricing.ts` — the field labels
 * live here because both the agency's form and the client's section need the
 * same ones, and only one of them is allowed to see the agency's costs.
 */

import {
  defaultHoursForLevel,
  PRICING_DEFAULTS,
  type DeliveryCost,
  type LeverKey,
  type PricingInputs,
  type PricingResult,
} from "./pricing.ts";

/** Where the fees on this proposal came from. `rate_card` means the pricing
 * step ran but the agency kept its standard fees. */
export type FeeSource = "suggested" | "rate_card" | "custom";

export type PricingSnapshot = {
  /** Bumped if the shape changes. `parsePricingSnapshot` refuses anything it
   * doesn't recognise, so an old proposal degrades to no section rather than a
   * crash or, worse, a wrong number. */
  version: 1;
  calculatedAt: string;
  levers: LeverKey[];
  /** Every figure that went in, with the defaults already resolved — the form
   * pre-fills them visibly, so what's here is what was actually used. */
  inputs: PricingInputs;
  /** What the standing defaults were at the time, so a proposal still says
   * which assumptions were house defaults even after the defaults move. */
  defaults: typeof PRICING_DEFAULTS;
  /** The agency's own delivery economics. Never shown to a client. */
  cost: DeliveryCost;
  /** The rate card fees, read-only, for the verdict. The rate card itself is
   * never written to by this feature. */
  rateCard: { setupFee: number; monthlyFee: number } | null;
  result: PricingResult;
  /** The deal actually being offered, and its return. */
  applied: {
    source: FeeSource;
    setupFee: number;
    monthlyFee: number;
    roi: number | null;
    paybackMonths: number | null;
  };
};

/* ------------------------------------------------------------ reading it back */

/** Validates a jsonb column into a snapshot, or null.
 *
 * The column is jsonb, so what comes back is genuinely unknown — an older
 * shape, a hand-edited row, a half-written object. Null means the proposal
 * renders exactly as it did before this feature existed. */
export function parsePricingSnapshot(value: unknown): PricingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const snapshot = value as Partial<PricingSnapshot>;
  if (snapshot.version !== 1) return null;
  if (!Array.isArray(snapshot.levers)) return null;
  if (!snapshot.inputs || typeof snapshot.inputs !== "object") return null;

  const conservative = snapshot.result?.value?.conservative;
  if (typeof conservative !== "number" || !Number.isFinite(conservative)) {
    return null;
  }

  const applied = snapshot.applied;
  if (
    !applied ||
    typeof applied.setupFee !== "number" ||
    typeof applied.monthlyFee !== "number"
  ) {
    return null;
  }

  return snapshot as PricingSnapshot;
}

/* ------------------------------------------------------------- the lever form */

export type FieldUnit = "count" | "percent" | "money";

export type LeverFieldSpec = {
  /** Key within that lever's own input object. */
  key: string;
  /** Shown on the agency's form. */
  label: string;
  /** Shown to the client. */
  clientLabel: string;
  unit: FieldUnit;
  /** Pre-filled, visible and editable. Undefined means the agency has to
   * supply it — there is no honest house default for a client's own volume. */
  default?: number;
};

export type LeverSpec = {
  key: LeverKey;
  label: string;
  blurb: string;
  fields: LeverFieldSpec[];
};

/** The four levers, in the order the form lists them. */
export const LEVER_SPECS: readonly LeverSpec[] = [
  {
    key: "missed",
    label: "Missed enquiries",
    blurb: "Enquiries that never get answered, recovered by instant follow-up.",
    fields: [
      {
        key: "enquiries",
        label: "Enquiries per month",
        clientLabel: "Enquiries per month",
        unit: "count",
      },
      {
        key: "missedRate",
        label: "Missed or unanswered",
        clientLabel: "Currently missed or unanswered",
        unit: "percent",
        default: PRICING_DEFAULTS.missedRate,
      },
      {
        key: "recoveryRate",
        label: "Recovered by follow-up",
        clientLabel: "Recovered by instant follow-up",
        unit: "percent",
        default: PRICING_DEFAULTS.recoveryRate,
      },
      {
        key: "closeRate",
        label: "Of those, convert",
        clientLabel: "Of those, convert",
        unit: "percent",
        default: PRICING_DEFAULTS.closeRate,
      },
      {
        key: "avgCustomerValue",
        label: "Average customer value",
        clientLabel: "Average customer value",
        unit: "money",
      },
    ],
  },
  {
    key: "noshow",
    label: "No-shows",
    blurb: "Appointments lost to no-shows, cut by reminders and confirmations.",
    fields: [
      {
        key: "appointments",
        label: "Appointments per month",
        clientLabel: "Appointments per month",
        unit: "count",
      },
      {
        key: "noShowRate",
        // No default on purpose: an agency guessing a client's no-show rate is
        // the single number most likely to be wrong.
        label: "No-show rate",
        clientLabel: "Current no-show rate",
        unit: "percent",
      },
      {
        key: "reductionRate",
        label: "Reduction from reminders",
        clientLabel: "Reduction from reminders",
        unit: "percent",
        default: PRICING_DEFAULTS.noShowReduction,
      },
      {
        key: "appointmentValue",
        label: "Value per appointment",
        clientLabel: "Value per appointment",
        unit: "money",
      },
    ],
  },
  {
    key: "react",
    label: "Database reactivation",
    blurb: `A one-off campaign, spread over ${PRICING_DEFAULTS.reactivationSpreadMonths} months. Never counted as recurring.`,
    fields: [
      {
        key: "dormantContacts",
        label: "Dormant contacts",
        clientLabel: "Dormant contacts",
        unit: "count",
      },
      {
        key: "reactivationRate",
        label: "Respond to reactivation",
        clientLabel: "Respond to reactivation",
        unit: "percent",
        default: PRICING_DEFAULTS.reactivationRate,
      },
      {
        key: "closeRate",
        label: "Of those, convert",
        clientLabel: "Of those, convert",
        unit: "percent",
        default: PRICING_DEFAULTS.reactivationCloseRate,
      },
      {
        key: "avgCustomerValue",
        label: "Average customer value",
        clientLabel: "Average customer value",
        unit: "money",
      },
    ],
  },
  {
    key: "time",
    label: "Time saved",
    blurb: "Staff hours the automation gives back each month.",
    fields: [
      {
        key: "hoursSaved",
        label: "Hours saved per month",
        clientLabel: "Staff hours saved per month",
        unit: "count",
      },
      {
        key: "staffCostPerHour",
        label: "Staff cost per hour",
        clientLabel: "Staff cost per hour",
        unit: "money",
      },
    ],
  },
];

/** Takes a plain string, not a `LeverKey`: the levers on a stored snapshot come
 * out of a jsonb column and may name a lever this build has never heard of. */
export function findLeverSpec(key: string): LeverSpec | undefined {
  return LEVER_SPECS.find((spec) => spec.key === key);
}

/* --------------------------------------------------- what the client is shown */

export type ExpectedReturnLine = {
  label: string;
  value: number;
  unit: FieldUnit;
};

/** The client-facing half of a snapshot. Built by `expectedReturnFromSnapshot`
 * and nothing else, which is how the agency's hourly cost, target margin, value
 * range, floor and verdict are kept off a document a client reads: they have no
 * field to arrive in. Only the conservative value ever appears. */
export type ExpectedReturn = {
  levers: { label: string; blurb: string; lines: ExpectedReturnLine[] }[];
  conservativeMonthly: number;
  setupFee: number;
  monthlyFee: number;
  roi: number | null;
  paybackMonths: number | null;
};

export function expectedReturnFromSnapshot(
  snapshot: PricingSnapshot
): ExpectedReturn {
  const levers = snapshot.levers
    .map((key) => {
      const spec = findLeverSpec(key);
      if (!spec) return null;

      const values = (snapshot.inputs as Record<string, unknown>)[key];
      if (!values || typeof values !== "object") return null;
      const bag = values as Record<string, unknown>;

      const lines = spec.fields
        .map((field) => {
          const raw = bag[field.key] ?? field.default;
          return typeof raw === "number" && Number.isFinite(raw)
            ? { label: field.clientLabel, value: raw, unit: field.unit }
            : null;
        })
        .filter((line): line is ExpectedReturnLine => line !== null);

      return { label: spec.label, blurb: spec.blurb, lines };
    })
    .filter(
      (lever): lever is ExpectedReturn["levers"][number] =>
        lever !== null && lever.lines.length > 0
    );

  return {
    levers,
    conservativeMonthly: snapshot.result.value.conservative,
    setupFee: snapshot.applied.setupFee,
    monthlyFee: snapshot.applied.monthlyFee,
    roi: snapshot.applied.roi,
    paybackMonths: snapshot.applied.paybackMonths,
  };
}

/* ---------------------------------------------------------- delivery cost */

/** The agency's cost of delivering one tier: its own settings, plus the hours
 * it has set for that tier, falling back to the by-level defaults where it
 * hasn't. Structurally typed rather than taking a `Tier`, to keep this module
 * free of DB types. */
export function deliveryCostFor(
  tier: {
    level: number;
    setup_hours: number | null;
    support_hours: number | null;
  },
  settings: {
    hourlyCost: number;
    targetMargin: number;
    toolCostMonthly: number;
  }
): DeliveryCost {
  const fallback = defaultHoursForLevel(tier.level);

  return {
    hourlyCost: settings.hourlyCost,
    targetMargin: settings.targetMargin,
    toolCostMonthly: settings.toolCostMonthly,
    setupHours: tier.setup_hours ?? fallback.setupHours,
    supportHours: tier.support_hours ?? fallback.supportHours,
  };
}
