import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePricing,
  defaultMonthlyStep,
  defaultSetupStep,
  nearestCandidate,
  roundFee,
  ROUNDING_DEFAULTS,
  type DeliveryCost,
  type PricingInputs,
  type RoundingSettings,
} from "./pricing.ts";

const off: RoundingSettings = { style: "off", ending: 7, step: null };
const clean = (step: number | null = null): RoundingSettings => ({
  style: "clean",
  ending: 7,
  step,
});
const charm = (ending: 7 | 9, step: number | null = null): RoundingSettings => ({
  style: "charm",
  ending,
  step,
});

/** The dental worked example: floor 280, range 287/431/718, setup floor 1250. */
const DENTAL: PricingInputs = {
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

const COST: DeliveryCost = {
  hourlyCost: 25,
  targetMargin: 0.5,
  toolCostMonthly: 40,
  supportHours: 4,
  setupHours: 25,
};

/** Floor = 50 × supportHours + 80 with this cost, so a floor can be dialled in. */
const costWithFloor = (monthlyFloor: number): DeliveryCost => ({
  ...COST,
  supportHours: (monthlyFloor - 80) / 50,
});

const dental = (rounding: RoundingSettings, cost: DeliveryCost = COST) =>
  calculatePricing(DENTAL, cost, 197, rounding);

describe("the dental worked example", () => {
  it("has the floor, range and setup floor the example states", () => {
    const result = dental(off);
    assert.deepEqual(result.floor, { monthly: 280, setup: 1250 });
    assert.deepEqual(result.range, { low: 287, target: 431, high: 718 });
  });

  it("clean rounds monthly to 425 and leaves setup at 1250", () => {
    const result = dental(clean());
    assert.deepEqual(result.recommended, { monthly: 425, setup: 1250 });
  });

  it("charm 7 with step 50 rounds monthly to 447", () => {
    assert.equal(dental(charm(7, 50)).recommended!.monthly, 447);
  });

  it("charm 7 with step 50 rounds setup to 1297, not below its 1250 floor", () => {
    // The nearest charm price to 1250 is 1247, which is £3 under the setup
    // floor. Setup must be at least floorSetup, so the guard takes the next
    // candidate up. See the PR for the conflict with the brief's 1247.
    const result = dental(charm(7, 50));
    assert.equal(result.recommended!.setup, 1297);
    assert.ok(result.recommended!.setup >= result.floor.setup);
  });

  it("charm 7 on the scaled default lands on the same 447 / 1297", () => {
    // 431 is in the £25 band; a charm price on a £25 step ending in 7 is a
    // £50 spacing in practice, so the answer matches step 50.
    assert.deepEqual(dental(charm(7)).recommended, { monthly: 447, setup: 1297 });
  });

  it("keeps the unrounded figures alongside", () => {
    for (const rounding of [clean(), charm(7, 50), charm(9), off]) {
      assert.deepEqual(dental(rounding).calculated, { monthly: 431, setup: 1250 });
    }
  });
});

describe("clean", () => {
  it("rounds to the nearest multiple of the step", () => {
    assert.equal(roundFee(431, clean(25), "monthly", { min: 0 }).price, 425);
    assert.equal(roundFee(440, clean(25), "monthly", { min: 0 }).price, 450);
    assert.equal(roundFee(431, clean(50), "monthly", { min: 0 }).price, 450);
    assert.equal(roundFee(1249, clean(50), "setup", { min: 0 }).price, 1250);
  });

  it("rounds a tie up", () => {
    assert.equal(roundFee(425, clean(50), "monthly", { min: 0 }).price, 450);
  });

  it("leaves an amount already on the grid alone", () => {
    assert.equal(roundFee(450, clean(50), "monthly", { min: 0 }).price, 450);
  });
});

describe("charm", () => {
  const charmAt = (amount: number, ending: 7 | 9, step: number) =>
    roundFee(amount, charm(ending, step), "monthly", { min: 0 }).price;

  it("ending 7, step 50: 447, 497, 547", () => {
    assert.equal(charmAt(440, 7, 50), 447);
    assert.equal(charmAt(495, 7, 50), 497);
    assert.equal(charmAt(551, 7, 50), 547);
  });

  it("ending 9, step 50: 449, 499, 549", () => {
    assert.equal(charmAt(440, 9, 50), 449);
    assert.equal(charmAt(495, 9, 50), 499);
    assert.equal(charmAt(551, 9, 50), 549);
  });

  it("ending 7, step 100: 397, 497, 597", () => {
    assert.equal(charmAt(410, 7, 100), 397);
    assert.equal(charmAt(480, 7, 100), 497);
    assert.equal(charmAt(620, 7, 100), 597);
  });

  it("always ends in the chosen digit, whatever the step", () => {
    // A multiple of 25 minus 3 could end in 2 (72); the grid skips those.
    for (const step of [5, 8, 15, 25, 50, 100]) {
      for (const ending of [7, 9] as const) {
        for (let amount = 30; amount <= 3000; amount += 37) {
          const price = charmAt(amount, ending, step);
          assert.equal(price % 10, ending, `step ${step}, ending ${ending}, ${amount} → ${price}`);
        }
      }
    }
  });
});

describe("off", () => {
  it("returns the amount untouched, with no step", () => {
    assert.deepEqual(roundFee(431, off, "monthly", { min: 0 }), { price: 431, step: null });
  });

  it("gives exactly the result of calling with no rounding at all", () => {
    assert.deepEqual(
      calculatePricing(DENTAL, COST, 197, off),
      calculatePricing(DENTAL, COST, 197)
    );
  });

  it("leaves recommended equal to calculated", () => {
    const result = dental(off);
    assert.deepEqual(result.recommended, result.calculated);
  });
});

describe("the scaled default step", () => {
  it("monthly: £5, £25, £50, £100 by size", () => {
    assert.equal(defaultMonthlyStep(60), 5);
    assert.equal(defaultMonthlyStep(431), 25);
    assert.equal(defaultMonthlyStep(800), 50);
    assert.equal(defaultMonthlyStep(3000), 100);
  });

  it("puts a boundary amount in the band above", () => {
    assert.equal(defaultMonthlyStep(99), 5);
    assert.equal(defaultMonthlyStep(100), 25);
    assert.equal(defaultMonthlyStep(499), 25);
    assert.equal(defaultMonthlyStep(500), 50);
    assert.equal(defaultMonthlyStep(1999), 50);
    assert.equal(defaultMonthlyStep(2000), 100);
  });

  it("setup: £50 under £2,000, £100 from £2,000", () => {
    assert.equal(defaultSetupStep(1250), 50);
    assert.equal(defaultSetupStep(1999), 50);
    assert.equal(defaultSetupStep(2000), 100);
    assert.equal(defaultSetupStep(5000), 100);
  });

  it("is overridden by an explicit step", () => {
    assert.equal(roundFee(431, clean(50), "monthly", { min: 0 }).step, 50);
    assert.equal(roundFee(431, clean(null), "monthly", { min: 0 }).step, 25);
  });

  it("ignores a step that isn't a whole pound of at least £1", () => {
    for (const bad of [0, -5, 12.5, Number.NaN]) {
      assert.equal(roundFee(431, clean(bad), "monthly", { min: 0 }).step, 25, `step ${bad}`);
    }
  });
});

describe("the floor guard", () => {
  it("takes the next candidate up when the nearest is below the floor", () => {
    // 310 rounds to 300 on a £50 step, but the floor is 305.
    assert.equal(nearestCandidate(310, clean(), 50, 305, 500), 350);
  });

  it("holds through the full calculation", () => {
    // Floor 437: the recommendation is the floor itself (target 431 is below
    // it). Clean on £25 would give 425 — under the floor — so 450.
    const result = dental(clean(), costWithFloor(437));
    assert.equal(result.floor.monthly, 437);
    assert.equal(result.calculated!.monthly, 437);
    assert.equal(result.recommended!.monthly, 450);
  });

  it("holds for charm too", () => {
    // Floor 450: nearest charm-7 is 447, under the floor, so 497.
    const result = dental(charm(7, 50), costWithFloor(450));
    assert.equal(result.recommended!.monthly, 497);
  });
});

describe("the range guard", () => {
  it("takes the next candidate down when the nearest is above the range", () => {
    // 760 rounds to 800 on a £100 step, but the top of the range is 765.
    assert.equal(nearestCandidate(760, clean(), 100, 600, 765), 700);
  });

  it("never leaves [floor, high] across a sweep of floors and styles", () => {
    const styles = [clean(), clean(50), clean(100), charm(7), charm(9), charm(7, 50), charm(9, 100)];
    for (let floor = 280; floor <= 718; floor += 7) {
      for (const rounding of styles) {
        const result = dental(rounding, costWithFloor(floor));
        if (!result.recommended) continue;
        const { monthly } = result.recommended;
        const min = Math.max(result.floor.monthly, result.range!.low);
        assert.ok(
          monthly >= min && monthly <= result.range!.high,
          `floor ${floor}, ${rounding.style}/${rounding.ending}/${rounding.step}: ${monthly} outside [${min}, ${result.range!.high}]`
        );
      }
    }
  });
});

describe("when no candidate fits", () => {
  it("returns null from the candidate search", () => {
    // [305, 340] holds no multiple of 50.
    assert.equal(nearestCandidate(310, clean(), 50, 305, 340), null);
  });

  it("falls back to the unrounded recommendation", () => {
    // Floor 710 against a high of 718: no multiple of 50 lies in [710, 718].
    const result = dental(clean(50), costWithFloor(710));
    assert.equal(result.calculated!.monthly, 710);
    assert.equal(result.recommended!.monthly, 710);
  });

  it("falls back when the step is too coarse for the range", () => {
    // No multiple of £1,000 between 287 and 718.
    assert.equal(dental(clean(1000)).recommended!.monthly, 431);
  });
});

describe("the setup fee", () => {
  it("is never below the setup floor", () => {
    for (const rounding of [clean(), charm(7), charm(9), charm(7, 100), clean(100)]) {
      const result = dental(rounding);
      assert.ok(result.recommended!.setup >= result.floor.setup, rounding.style);
    }
  });

  it("is at least twice the rounded monthly", () => {
    // ~£1,000/mo: twice the monthly outweighs the £1,250 setup floor.
    const big: PricingInputs = {
      levers: ["time"],
      time: { hoursSaved: 400, staffCostPerHour: 24 },
    };
    const cleanResult = calculatePricing(big, COST, undefined, clean());
    assert.equal(cleanResult.recommended!.monthly, 1000);
    assert.equal(cleanResult.recommended!.setup, 2000);

    const charmResult = calculatePricing(big, COST, undefined, charm(7, 50));
    const { monthly, setup } = charmResult.recommended!;
    assert.ok(setup >= 2 * monthly, `${setup} < 2 × ${monthly}`);
    assert.equal(setup % 10, 7);
  });

  it("is re-derived from the rounded monthly, not the calculated one", () => {
    // Rounded monthly 1000 → setup minimum 2000. From the calculated 1008 it
    // would have been 2016, rounding to 2100.
    const big: PricingInputs = {
      levers: ["time"],
      time: { hoursSaved: 400, staffCostPerHour: 24 },
    };
    const result = calculatePricing(big, COST, undefined, clean());
    assert.equal(result.calculated!.monthly, 1008);
    assert.equal(result.calculated!.setup, 2016);
    assert.equal(result.recommended!.setup, 2000);
  });

  it("only rounds up", () => {
    // Its band has no ceiling and its starting point is its own minimum.
    assert.equal(roundFee(1250, clean(), "setup", { min: 1250 }).price, 1250);
    assert.equal(roundFee(1251, clean(), "setup", { min: 1251 }).price, 1300);
    assert.equal(roundFee(1250, charm(7), "setup", { min: 1250 }).price, 1297);
  });
});

describe("ROI and payback use the rounded fee", () => {
  it("measures ROI against what would be charged", () => {
    // 2872.8 / 425, not 2872.8 / 431.
    const result = dental(clean());
    assert.equal(result.roi, 6.76);
    assert.notEqual(result.roi, dental(off).roi);
  });

  it("measures payback against the rounded setup and monthly", () => {
    // 1297 / (2872.8 - 447) = 0.5347…
    assert.equal(dental(charm(7, 50)).paybackMonths, 0.53);
  });
});

describe("what a result records about its rounding", () => {
  it("the settings, and the steps they resolved to", () => {
    assert.deepEqual(dental(charm(9)).rounding, {
      style: "charm",
      ending: 9,
      step: null,
      monthlyStep: 25,
      setupStep: 50,
    });
  });

  it("no steps when there was nothing to round", () => {
    const notViable = calculatePricing(
      { levers: ["time"], time: { hoursSaved: 2, staffCostPerHour: 15 } },
      { ...COST, supportHours: 20, toolCostMonthly: 200 },
      undefined,
      clean()
    );
    assert.equal(notViable.status, "not_viable");
    assert.equal(notViable.recommended, null);
    assert.equal(notViable.calculated, null);
    assert.equal(notViable.rounding.monthlyStep, null);
  });

  it("defaults an agency that has never set it to clean", () => {
    assert.deepEqual(ROUNDING_DEFAULTS, { style: "clean", ending: 7, step: null });
  });
});
