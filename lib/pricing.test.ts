import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appliedReturn,
  calculatePricing,
  defaultHoursForLevel,
  deliveryFloor,
  PRICING_DEFAULTS,
  suggestLevers,
  type DeliveryCost,
  type PricingInputs,
} from "./pricing.ts";

/** The worked example from the spec: Full Front-Desk, two levers. */
const EXAMPLE_INPUTS: PricingInputs = {
  levers: ["missed", "noshow"],
  missed: {
    enquiries: 120,
    missedRate: 30,
    recoveryRate: 50,
    closeRate: 30,
    avgCustomerValue: 600,
  },
  noshow: {
    appointments: 200,
    noShowRate: 12,
    reductionRate: 30,
    appointmentValue: 120,
  },
};

/** Full Front-Desk: h=25, g=0.5, S=4, T=40, U=25. */
const EXAMPLE_COST: DeliveryCost = {
  hourlyCost: 25,
  targetMargin: 0.5,
  toolCostMonthly: 40,
  supportHours: 4,
  setupHours: 25,
};

describe("the spec's worked example", () => {
  const result = calculatePricing(EXAMPLE_INPUTS, EXAMPLE_COST);

  it("totals the levers to V = 4104", () => {
    assert.equal(result.value.levers.missed, 3240);
    assert.equal(result.value.levers.noshow, 864);
    assert.equal(result.value.total, 4104);
  });

  it("applies k = 0.7 for a conservative 2872.8", () => {
    assert.equal(result.value.conservatismFactor, 0.7);
    assert.equal(result.value.conservative, 2872.8);
  });

  it("ranges 287 / 431 / 718", () => {
    assert.deepEqual(result.range, { low: 287, target: 431, high: 718 });
  });

  it("floors at 280 monthly and 1250 setup", () => {
    assert.deepEqual(result.floor, { monthly: 280, setup: 1250 });
  });

  it("recommends 431 monthly and 1250 setup", () => {
    assert.equal(result.status, "ok");
    assert.deepEqual(result.recommended, { monthly: 431, setup: 1250 });
  });

  it("reports ROI of about 6.7 and payback under a month", () => {
    assert.ok(
      Math.abs(result.roi! - 6.7) < 0.05,
      `expected ROI near 6.7, got ${result.roi}`
    );
    assert.ok(
      result.paybackMonths! < 1,
      `expected payback under 1 month, got ${result.paybackMonths}`
    );
  });

  it("does not warn on plausible figures", () => {
    assert.deepEqual(result.warnings, []);
  });
});

describe("verdict against the rate card fee", () => {
  /** Floor 180 (support 2h), low 287, high 718 — the only floor at which all
   * four of the spec's example fees land on four different verdicts. See the
   * note in the deviations list: with the worked example's own floor of 280,
   * a fee of 197 is below floor, not underpriced. */
  const tier1Cost: DeliveryCost = { ...EXAMPLE_COST, supportHours: 2 };
  const verdictFor = (fee: number, cost = tier1Cost) =>
    calculatePricing(EXAMPLE_INPUTS, cost, fee).verdict!;

  it("150 is below the floor", () => {
    const verdict = verdictFor(150);
    assert.equal(verdict.kind, "below_floor");
    assert.equal(
      verdict.message,
      "Below your own floor, you lose money at this price"
    );
  });

  it("197 is underpriced, and says by how much", () => {
    const verdict = verdictFor(197);
    assert.equal(verdict.kind, "underpriced");
    assert.equal(verdict.message, "Underpriced by 90 per month");
  });

  it("297 is inside the range, and says how far from target", () => {
    const verdict = verdictFor(297);
    assert.equal(verdict.kind, "inside_range");
    assert.equal(verdict.message, "Inside the range — 134 per month below target");
  });

  it("900 is above the range", () => {
    const verdict = verdictFor(900);
    assert.equal(verdict.kind, "above_range");
    assert.equal(
      verdict.message,
      "Above the value-justified range, expect pushback"
    );
  });

  it("puts the floor ahead of the range when a fee is below both", () => {
    // 197 against the worked example's own floor of 280.
    const verdict = verdictFor(197, EXAMPLE_COST);
    assert.equal(verdict.kind, "below_floor");
  });
});

describe("not viable", () => {
  it("returns no price when the floor exceeds the top of the range", () => {
    // Value is tiny, delivery is expensive: nothing justifies the cost.
    const result = calculatePricing(
      { levers: ["time"], time: { hoursSaved: 2, staffCostPerHour: 15 } },
      { ...EXAMPLE_COST, supportHours: 20, toolCostMonthly: 200 }
    );

    assert.equal(result.status, "not_viable");
    assert.equal(result.recommended, null);
    assert.equal(result.roi, null);
    assert.equal(result.paybackMonths, null);
    assert.ok(result.floor.monthly > result.range!.high);
  });

  it("takes the floor when it sits inside the range but above target", () => {
    const result = calculatePricing(EXAMPLE_INPUTS, {
      ...EXAMPLE_COST,
      supportHours: 10, // floor 580: above target 431, below high 718
    });

    assert.equal(result.status, "ok");
    assert.equal(result.floor.monthly, 580);
    assert.equal(result.recommended!.monthly, 580);
  });
});

describe("missing inputs", () => {
  it("names the missing field and withholds a price", () => {
    const result = calculatePricing(
      {
        levers: ["missed"],
        missed: { enquiries: 120, avgCustomerValue: 0 },
      },
      EXAMPLE_COST
    );

    assert.equal(result.status, "missing_inputs");
    assert.deepEqual(result.missingFields, ["missed.avgCustomerValue"]);
    assert.equal(result.range, null);
    assert.equal(result.recommended, null);
  });

  it("names every missing field, not just the first", () => {
    const result = calculatePricing(
      {
        levers: ["noshow"],
        noshow: { appointments: 0, noShowRate: 0, appointmentValue: 120 },
      },
      EXAMPLE_COST
    );

    assert.deepEqual(result.missingFields, [
      "noshow.appointments",
      "noshow.noShowRate",
    ]);
  });

  it("treats no levers at all as missing input", () => {
    const result = calculatePricing({ levers: [] }, EXAMPLE_COST);
    assert.equal(result.status, "missing_inputs");
    assert.ok(result.missingFields.includes("levers"));
  });

  it("still reports the floor, which does not depend on the client", () => {
    const result = calculatePricing({ levers: [] }, EXAMPLE_COST);
    assert.deepEqual(result.floor, { monthly: 280, setup: 1250 });
  });
});

describe("warnings on extreme inputs", () => {
  it("flags a close rate above 80", () => {
    const result = calculatePricing(
      { ...EXAMPLE_INPUTS, missed: { ...EXAMPLE_INPUTS.missed!, closeRate: 85 } },
      EXAMPLE_COST
    );
    assert.ok(result.warnings.some((w) => w.code === "close_rate_high"));
  });

  it("flags a missed rate above 70", () => {
    const result = calculatePricing(
      { ...EXAMPLE_INPUTS, missed: { ...EXAMPLE_INPUTS.missed!, missedRate: 75 } },
      EXAMPLE_COST
    );
    assert.ok(result.warnings.some((w) => w.code === "missed_rate_high"));
  });

  it("flags conservative value more than 10x the fee", () => {
    // Vc 2872.8 against a fee of 100 is 28x.
    const result = calculatePricing(EXAMPLE_INPUTS, EXAMPLE_COST, 100);
    assert.ok(result.warnings.some((w) => w.code === "value_far_above_fee"));
  });

  it("does not flag the ratio when the fee is proportionate", () => {
    const result = calculatePricing(EXAMPLE_INPUTS, EXAMPLE_COST, 431);
    assert.ok(!result.warnings.some((w) => w.code === "value_far_above_fee"));
  });
});

describe("levers in isolation", () => {
  it("an unselected lever contributes nothing", () => {
    const result = calculatePricing(
      {
        levers: ["time"],
        time: { hoursSaved: 10, staffCostPerHour: 20 },
        // Present but not selected — must be ignored entirely.
        missed: { enquiries: 500, avgCustomerValue: 5000 },
      },
      EXAMPLE_COST
    );

    assert.equal(result.value.levers.missed, 0);
    assert.equal(result.value.levers.time, 200);
    assert.equal(result.value.total, 200);
  });

  it("spreads reactivation over six months and never recurs", () => {
    const result = calculatePricing(
      {
        levers: ["react"],
        react: {
          dormantContacts: 1000,
          reactivationRate: 3,
          closeRate: 30,
          avgCustomerValue: 600,
        },
      },
      EXAMPLE_COST
    );

    // 1000 * 0.03 * 0.30 * 600 = 5400, over 6 months = 900/mo.
    assert.equal(result.value.levers.react, 900);
    assert.equal(PRICING_DEFAULTS.reactivationSpreadMonths, 6);
  });

  it("uses the documented defaults when percentages are omitted", () => {
    const result = calculatePricing(
      {
        levers: ["missed"],
        missed: { enquiries: 120, avgCustomerValue: 600 },
      },
      EXAMPLE_COST
    );

    // Same as the worked example's missed lever: defaults are 30/50/30.
    assert.equal(result.value.levers.missed, 3240);
  });
});

describe("the floor", () => {
  it("is computed from delivery cost alone", () => {
    assert.deepEqual(
      deliveryFloor({ hourlyCost: 25, targetMargin: 0.5, toolCostMonthly: 40, supportHours: 4, setupHours: 25 }),
      { monthly: 280, setup: 1250 }
    );
  });

  it("falls back to the documented defaults", () => {
    const floor = deliveryFloor({ supportHours: 4, setupHours: 25 });
    assert.deepEqual(floor, { monthly: 280, setup: 1250 });
    assert.equal(PRICING_DEFAULTS.hourlyCost, 25);
    assert.equal(PRICING_DEFAULTS.targetMargin, 0.5);
    assert.equal(PRICING_DEFAULTS.toolCostMonthly, 40);
  });

  it("does not divide by zero at a margin of 100%", () => {
    const floor = deliveryFloor({ targetMargin: 1, supportHours: 4, setupHours: 25 });
    assert.ok(Number.isFinite(floor.monthly) && floor.monthly > 0);
    assert.ok(Number.isFinite(floor.setup) && floor.setup > 0);
  });

  it("supplies per-tier hour defaults of 12/25/40 and 2/4/6", () => {
    assert.deepEqual(defaultHoursForLevel(1), { setupHours: 12, supportHours: 2 });
    assert.deepEqual(defaultHoursForLevel(2), { setupHours: 25, supportHours: 4 });
    assert.deepEqual(defaultHoursForLevel(3), { setupHours: 40, supportHours: 6 });
    // A fourth tier holds at the last defined value rather than crashing.
    assert.deepEqual(defaultHoursForLevel(7), { setupHours: 40, supportHours: 6 });
  });
});

describe("payback", () => {
  it("is positive and finite whenever a price was recommended", () => {
    // The divide-by-zero guard is deliberately unreachable on this path: a
    // recommended monthly never exceeds high (0.25 * Vc), so the surplus is
    // always at least 0.75 * Vc. The guard stays in for the degenerate case.
    const result = calculatePricing(EXAMPLE_INPUTS, EXAMPLE_COST);
    assert.equal(result.status, "ok");
    assert.ok(result.paybackMonths! > 0);
    assert.ok(Number.isFinite(result.paybackMonths!));
    // 1250 setup against a 2441.80 monthly surplus.
    assert.equal(result.paybackMonths, 0.51);
  });

  it("never returns Infinity", () => {
    const result = calculatePricing(EXAMPLE_INPUTS, EXAMPLE_COST);
    assert.ok(result.paybackMonths === null || Number.isFinite(result.paybackMonths));
  });
});

describe("suggesting levers from a tier's services", () => {
  it("picks the levers the services actually speak to", () => {
    assert.deepEqual(
      suggestLevers(["Missed-call text back", "Appointment reminders"]),
      ["missed", "noshow"]
    );
  });

  it("returns them in a fixed order, not the services' order", () => {
    assert.deepEqual(
      suggestLevers(["Workflow automation", "Database reactivation"]),
      ["react", "time"]
    );
  });

  it("ignores case", () => {
    assert.deepEqual(suggestLevers(["DORMANT LIST CAMPAIGN"]), ["react"]);
  });

  it("suggests nothing rather than guessing", () => {
    assert.deepEqual(suggestLevers(["Brand photography"]), []);
    assert.deepEqual(suggestLevers([]), []);
  });
});

describe("the return on the fee actually charged", () => {
  it("measures against that fee, not the recommended one", () => {
    // Vc 2872.80 against a 297 fee, 1250 setup.
    const { roi, paybackMonths } = appliedReturn(2872.8, 1250, 297);
    assert.equal(roi, 9.67);
    assert.equal(paybackMonths, 0.49);
  });

  it("reports no payback when the fee swallows the value", () => {
    const { roi, paybackMonths } = appliedReturn(400, 1000, 400);
    assert.equal(roi, 1);
    assert.equal(paybackMonths, null);
  });

  it("reports no ROI on a free month rather than dividing by zero", () => {
    assert.deepEqual(appliedReturn(2872.8, 1250, 0), {
      roi: null,
      paybackMonths: 0.44,
    });
  });
});

describe("the rate card is never touched", () => {
  it("treats the fee as read-only input", () => {
    const fee = 297;
    const inputsBefore = JSON.stringify(EXAMPLE_INPUTS);
    const costBefore = JSON.stringify(EXAMPLE_COST);

    calculatePricing(EXAMPLE_INPUTS, EXAMPLE_COST, fee);

    assert.equal(fee, 297);
    assert.equal(JSON.stringify(EXAMPLE_INPUTS), inputsBefore);
    assert.equal(JSON.stringify(EXAMPLE_COST), costBefore);
  });
});
