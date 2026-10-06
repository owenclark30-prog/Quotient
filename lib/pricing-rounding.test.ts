import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePricing,
  charmStep,
  cleanStep,
  nearestCandidate,
  roundFee,
  ROUNDING_DEFAULT,
  type DeliveryCost,
  type PricingInputs,
  type RoundingStyle,
} from "./pricing.ts";

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

const dental = (rounding: RoundingStyle, cost: DeliveryCost = COST) =>
  calculatePricing(DENTAL, cost, 197, rounding);

/** Round a monthly fee with nothing in the way. */
const monthly = (amount: number, style: RoundingStyle) =>
  roundFee(amount, style, "monthly", { min: 0 }).price;
/** Round a setup fee with nothing in the way. */
const setup = (amount: number, style: RoundingStyle) =>
  roundFee(amount, style, "setup", { min: 0 }).price;

describe("the dental worked example", () => {
  it("has the floor, range and setup floor the example states", () => {
    const result = dental("off");
    assert.deepEqual(result.floor, { monthly: 280, setup: 1250 });
    assert.deepEqual(result.range, { low: 287, target: 431, high: 718 });
  });

  it("clean: £425 a month, £1,250 setup", () => {
    assert.deepEqual(dental("clean").recommended, { monthly: 425, setup: 1250 });
  });

  it("charm: £429 a month", () => {
    assert.equal(dental("charm").recommended!.monthly, 429);
  });

  it("charm: setup respects the floor guard — £1,299, not £1,249", () => {
    // The nearest setup price ending in 9 is £1,249, £1 under the £1,250
    // setup floor. The guard takes the next one up.
    const result = dental("charm");
    assert.equal(result.recommended!.setup, 1299);
    assert.ok(result.recommended!.setup >= result.floor.setup);
  });

  it("keeps the unrounded figures alongside", () => {
    for (const style of ["off", "clean", "charm"] as const) {
      assert.deepEqual(dental(style).calculated, { monthly: 431, setup: 1250 });
    }
  });
});

describe("clean", () => {
  it("rounds to the nearest multiple of the scaled step", () => {
    assert.equal(monthly(62, "clean"), 60); // £5 step
    assert.equal(monthly(431, "clean"), 425); // £25 step
    assert.equal(monthly(812, "clean"), 800); // £50 step
    assert.equal(monthly(3140, "clean"), 3100); // £100 step
  });

  it("rounds setup on £50 under £2,000 and £100 above", () => {
    assert.equal(setup(1270, "clean"), 1250);
    assert.equal(setup(2140, "clean"), 2100);
  });

  it("rounds a tie up", () => {
    assert.equal(monthly(437.5, "clean"), 450);
  });

  it("leaves an amount already on a step alone", () => {
    assert.equal(monthly(450, "clean"), 450);
  });
});

describe("charm", () => {
  it("under £500 a month: nearest £10, less £1", () => {
    assert.equal(monthly(431, "charm"), 429);
    assert.equal(monthly(436, "charm"), 439);
    assert.equal(monthly(62, "charm"), 59);
  });

  it("£500 to £2,000 a month: nearest £50, less £1", () => {
    assert.equal(monthly(560, "charm"), 549);
    assert.equal(monthly(580, "charm"), 599);
    assert.equal(monthly(1490, "charm"), 1499);
  });

  it("over £2,000 a month: nearest £100, less £1", () => {
    assert.equal(monthly(2440, "charm"), 2399);
    assert.equal(monthly(2460, "charm"), 2499);
  });

  it("setup: nearest £50 less £1 under £2,000, £100 less £1 above", () => {
    assert.equal(setup(1260, "charm"), 1249);
    assert.equal(setup(1280, "charm"), 1299);
    assert.equal(setup(2440, "charm"), 2399);
  });

  it("always ends in 9", () => {
    for (let amount = 20; amount <= 5000; amount += 13) {
      assert.equal(monthly(amount, "charm") % 10, 9, `monthly ${amount}`);
      assert.equal(setup(amount, "charm") % 10, 9, `setup ${amount}`);
    }
  });
});

describe("off", () => {
  it("returns the amount untouched, with no step", () => {
    assert.deepEqual(roundFee(431, "off", "monthly", { min: 0 }), {
      price: 431,
      step: null,
    });
  });

  it("gives exactly the result of calling with no rounding at all", () => {
    assert.deepEqual(
      calculatePricing(DENTAL, COST, 197, "off"),
      calculatePricing(DENTAL, COST, 197)
    );
  });

  it("leaves recommended equal to calculated", () => {
    const result = dental("off");
    assert.deepEqual(result.recommended, result.calculated);
  });
});

describe("the scales", () => {
  it("clean monthly: £5, £25, £50, £100, a boundary amount taking the band above", () => {
    assert.equal(cleanStep(99, "monthly"), 5);
    assert.equal(cleanStep(100, "monthly"), 25);
    assert.equal(cleanStep(499, "monthly"), 25);
    assert.equal(cleanStep(500, "monthly"), 50);
    assert.equal(cleanStep(1999, "monthly"), 50);
    assert.equal(cleanStep(2000, "monthly"), 100);
  });

  it("charm monthly: £10 under £500, £50 to £2,000, £100 above", () => {
    assert.equal(charmStep(99, "monthly"), 10);
    assert.equal(charmStep(499, "monthly"), 10);
    assert.equal(charmStep(500, "monthly"), 50);
    assert.equal(charmStep(1999, "monthly"), 50);
    assert.equal(charmStep(2000, "monthly"), 100);
  });

  it("setup: £50 under £2,000, £100 from £2,000, for both styles", () => {
    for (const step of [cleanStep, charmStep]) {
      assert.equal(step(1999, "setup"), 50);
      assert.equal(step(2000, "setup"), 100);
    }
  });
});

describe("the floor guard", () => {
  it("takes the next price up when the nearest is below the floor", () => {
    // 310 rounds to 300 on a £50 step, but the floor is 305.
    assert.equal(nearestCandidate(310, 50, 0, 305, 500), 350);
  });

  it("clean: holds through the full calculation", () => {
    // Floor 437, so the recommendation is the floor itself (target 431 is
    // below it). Nearest £25 is 425, under the floor, so 450.
    const result = dental("clean", costWithFloor(437));
    assert.equal(result.calculated!.monthly, 437);
    assert.equal(result.recommended!.monthly, 450);
  });

  it("charm: takes the next price ending in 9 above the floor", () => {
    // Floor 432: nearest charm is 429, under it, so 439.
    const result = dental("charm", costWithFloor(432));
    assert.equal(result.calculated!.monthly, 432);
    assert.equal(result.recommended!.monthly, 439);
  });
});

describe("the range guard", () => {
  it("takes the next price down when the nearest is above the range", () => {
    // 760 rounds to 800 on a £100 step, but the top of the range is 765.
    assert.equal(nearestCandidate(760, 100, 0, 600, 765), 700);
  });

  it("never leaves [floor, high] across a sweep of floors", () => {
    for (let floor = 280; floor <= 718; floor += 3) {
      for (const style of ["clean", "charm"] as const) {
        const result = dental(style, costWithFloor(floor));
        if (!result.recommended) continue;
        const { monthly: price } = result.recommended;
        const min = Math.max(result.floor.monthly, result.range!.low);
        assert.ok(
          price >= min && price <= result.range!.high,
          `floor ${floor}, ${style}: ${price} outside [${min}, ${result.range!.high}]`
        );
      }
    }
  });
});

describe("when nothing fits", () => {
  it("the search returns null", () => {
    // [305, 340] holds no multiple of 50.
    assert.equal(nearestCandidate(310, 50, 0, 305, 340), null);
  });

  it("clean falls back to the unrounded recommendation", () => {
    // Floor 710 against a high of 718: the recommendation is 710, in the £50
    // band, and no multiple of 50 lies in [710, 718].
    const result = dental("clean", costWithFloor(710));
    assert.equal(result.calculated!.monthly, 710);
    assert.equal(result.recommended!.monthly, 710);
  });

  it("charm falls back too", () => {
    // Floor 702: £50 band, so 649 / 699 / 749 — none in [702, 718].
    const result = dental("charm", costWithFloor(702));
    assert.equal(result.calculated!.monthly, 702);
    assert.equal(result.recommended!.monthly, 702);
  });
});

describe("the setup fee", () => {
  const BIG: PricingInputs = {
    levers: ["time"],
    time: { hoursSaved: 400, staffCostPerHour: 24 },
  };

  it("is never below the setup floor", () => {
    for (const style of ["clean", "charm"] as const) {
      const result = dental(style);
      assert.ok(result.recommended!.setup >= result.floor.setup, style);
    }
  });

  it("is at least twice the rounded monthly", () => {
    // ~£1,000/mo, so twice the monthly outweighs the £1,250 setup floor.
    const clean = calculatePricing(BIG, COST, undefined, "clean");
    assert.deepEqual(clean.recommended, { monthly: 1000, setup: 2000 });

    const charm = calculatePricing(BIG, COST, undefined, "charm");
    const { monthly: m, setup: s } = charm.recommended!;
    assert.equal(m, 999);
    assert.ok(s >= 2 * m, `${s} < 2 × ${m}`);
    assert.equal(s, 1999);
  });

  it("is re-derived from the rounded monthly, not the calculated one", () => {
    // Calculated monthly 1008 → setup 2016. Rounded monthly 1000 → setup 2000.
    const result = calculatePricing(BIG, COST, undefined, "clean");
    assert.deepEqual(result.calculated, { monthly: 1008, setup: 2016 });
    assert.equal(result.recommended!.setup, 2000);
  });

  it("only rounds up", () => {
    assert.equal(roundFee(1250, "clean", "setup", { min: 1250 }).price, 1250);
    assert.equal(roundFee(1251, "clean", "setup", { min: 1251 }).price, 1300);
    assert.equal(roundFee(1250, "charm", "setup", { min: 1250 }).price, 1299);
  });
});

describe("ROI and payback use the rounded fee", () => {
  it("measures ROI against what would be charged", () => {
    // 2872.8 / 425 = 6.76, not 2872.8 / 431 = 6.67.
    assert.equal(dental("clean").roi, 6.76);
    assert.equal(dental("off").roi, 6.67);
  });

  it("measures payback against the rounded setup and monthly", () => {
    // 1299 / (2872.8 - 429) = 0.5315…
    assert.equal(dental("charm").paybackMonths, 0.53);
  });
});

describe("what a result records about its rounding", () => {
  it("the style, and the steps it resolved to", () => {
    assert.deepEqual(dental("charm").rounding, {
      style: "charm",
      monthlyStep: 10,
      setupStep: 50,
    });
    assert.deepEqual(dental("clean").rounding, {
      style: "clean",
      monthlyStep: 25,
      setupStep: 50,
    });
  });

  it("no steps when there was nothing to round", () => {
    const notViable = calculatePricing(
      { levers: ["time"], time: { hoursSaved: 2, staffCostPerHour: 15 } },
      { ...COST, supportHours: 20, toolCostMonthly: 200 },
      undefined,
      "clean"
    );
    assert.equal(notViable.status, "not_viable");
    assert.equal(notViable.recommended, null);
    assert.equal(notViable.calculated, null);
    assert.deepEqual(notViable.rounding, {
      style: "clean",
      monthlyStep: null,
      setupStep: null,
    });
  });

  it("defaults an agency that has never set it to clean", () => {
    assert.equal(ROUNDING_DEFAULT, "clean");
  });
});
