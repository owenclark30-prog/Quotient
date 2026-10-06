import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appliedReturn,
  calculatePricing,
  type PricingInputs,
} from "./pricing.ts";
import {
  deliveryCostFor,
  expectedReturnFromSnapshot,
  LEVER_SPECS,
  parsePricingSnapshot,
  type PricingSnapshot,
} from "./pricing-snapshot.ts";

function snapshotFixture(): PricingSnapshot {
  const inputs: PricingInputs = {
    levers: ["missed"],
    missed: {
      enquiries: 120,
      missedRate: 30,
      recoveryRate: 50,
      closeRate: 30,
      avgCustomerValue: 600,
    },
  };
  const cost = {
    hourlyCost: 25,
    targetMargin: 0.5,
    toolCostMonthly: 40,
    setupHours: 25,
    supportHours: 4,
  };
  const result = calculatePricing(inputs, cost, 400);

  return {
    version: 1,
    calculatedAt: "2026-10-01T00:00:00.000Z",
    levers: ["missed"],
    inputs,
    defaults: {} as PricingSnapshot["defaults"],
    cost,
    rateCard: { setupFee: 1000, monthlyFee: 400 },
    result,
    applied: {
      source: "rate_card",
      setupFee: 1000,
      monthlyFee: 400,
      ...appliedReturn(result.value.conservative, 1000, 400),
    },
  };
}

describe("parsing a stored snapshot", () => {
  it("accepts one this build wrote", () => {
    const snapshot = snapshotFixture();
    const parsed = parsePricingSnapshot(
      JSON.parse(JSON.stringify(snapshot)) as unknown
    );
    assert.equal(parsed?.applied.monthlyFee, 400);
  });

  it("rejects null, a non-object and an array", () => {
    assert.equal(parsePricingSnapshot(null), null);
    assert.equal(parsePricingSnapshot("{}"), null);
    assert.equal(parsePricingSnapshot([snapshotFixture()]), null);
  });

  it("rejects an unknown version rather than guessing at it", () => {
    assert.equal(
      parsePricingSnapshot({ ...snapshotFixture(), version: 2 }),
      null
    );
  });

  it("rejects one with no conservative value to show", () => {
    const snapshot = snapshotFixture();
    assert.equal(
      parsePricingSnapshot({
        ...snapshot,
        result: { ...snapshot.result, value: { conservative: "lots" } },
      }),
      null
    );
  });

  it("rejects one with no applied fee", () => {
    const snapshot = snapshotFixture();
    assert.equal(parsePricingSnapshot({ ...snapshot, applied: {} }), null);
  });
});

describe("what the client is shown", () => {
  const expected = expectedReturnFromSnapshot(snapshotFixture());

  it("shows the conservative value, never the raw total", () => {
    // 120 * 0.3 * 0.5 * 0.3 * 600 = 3240, held back to 70%.
    assert.equal(expected.conservativeMonthly, 2268);
    const serialised = JSON.stringify(expected);
    assert.ok(!serialised.includes("3240"), "the un-shaved total leaked");
  });

  it("carries none of the agency's economics", () => {
    const serialised = JSON.stringify(expected);
    for (const forbidden of [
      "hourlyCost",
      "targetMargin",
      "toolCostMonthly",
      "setupHours",
      "supportHours",
      "floor",
      "range",
      "verdict",
      "rateCard",
    ]) {
      assert.ok(
        !serialised.includes(forbidden),
        `${forbidden} reached the client-facing shape`
      );
    }
  });

  it("lists the client's own figures under the lever they belong to", () => {
    assert.equal(expected.levers.length, 1);
    assert.equal(expected.levers[0].label, "Missed enquiries");
    assert.deepEqual(expected.levers[0].lines[0], {
      label: "Enquiries per month",
      value: 120,
      unit: "count",
    });
  });

  it("drops a lever naming something this build doesn't know", () => {
    const snapshot = snapshotFixture();
    const result = expectedReturnFromSnapshot({
      ...snapshot,
      levers: [...snapshot.levers, "telepathy" as never],
    });
    assert.equal(result.levers.length, 1);
  });
});

describe("delivery cost for a tier", () => {
  const settings = { hourlyCost: 30, targetMargin: 0.6, toolCostMonthly: 50 };

  it("uses the hours the agency set", () => {
    const cost = deliveryCostFor(
      { level: 2, setup_hours: 18, support_hours: 3 },
      settings
    );
    assert.equal(cost.setupHours, 18);
    assert.equal(cost.supportHours, 3);
    assert.equal(cost.hourlyCost, 30);
  });

  it("falls back to the level's defaults when they're unset", () => {
    const cost = deliveryCostFor(
      { level: 3, setup_hours: null, support_hours: null },
      settings
    );
    assert.equal(cost.setupHours, 40);
    assert.equal(cost.supportHours, 6);
  });

  it("keeps a deliberate 0, which is not the same as unset", () => {
    const cost = deliveryCostFor(
      { level: 1, setup_hours: 0, support_hours: 0 },
      settings
    );
    assert.equal(cost.setupHours, 0);
    assert.equal(cost.supportHours, 0);
  });
});

describe("the lever form", () => {
  it("has a spec for every lever, with a client label on every field", () => {
    assert.deepEqual(
      LEVER_SPECS.map((spec) => spec.key),
      ["missed", "noshow", "react", "time"]
    );
    for (const spec of LEVER_SPECS) {
      for (const field of spec.fields) {
        assert.ok(field.label, `${spec.key}.${field.key} has no label`);
        assert.ok(
          field.clientLabel,
          `${spec.key}.${field.key} has no client label`
        );
      }
    }
  });

  it("leaves the no-show rate without a default", () => {
    const noshow = LEVER_SPECS.find((spec) => spec.key === "noshow")!;
    const rate = noshow.fields.find((field) => field.key === "noShowRate")!;
    assert.equal(rate.default, undefined);
  });
});

describe("a snapshot freezes the rounding", () => {
  // Built the way PriceThisClient builds one: the result carries the
  // calculated figures, the rounded ones and the settings that produced them,
  // and the snapshot stores the result whole.
  function roundedSnapshot(): PricingSnapshot {
    const snapshot = snapshotFixture();
    const result = calculatePricing(snapshot.inputs, snapshot.cost, 400, {
      style: "charm",
      ending: 7,
      step: 50,
    });
    return { ...snapshot, result };
  }

  it("stores the calculated and the rounded fees", () => {
    const stored = parsePricingSnapshot(
      JSON.parse(JSON.stringify(roundedSnapshot())) as unknown
    );
    // Missed lever alone: Vc 2268, target 340 → charm 7 on £50 → 347.
    assert.deepEqual(stored?.result.calculated, { monthly: 340, setup: 1250 });
    assert.deepEqual(stored?.result.recommended, { monthly: 347, setup: 1297 });
  });

  it("stores the settings used and the steps they resolved to", () => {
    const stored = parsePricingSnapshot(
      JSON.parse(JSON.stringify(roundedSnapshot())) as unknown
    );
    assert.deepEqual(stored?.result.rounding, {
      style: "charm",
      ending: 7,
      step: 50,
      monthlyStep: 50,
      setupStep: 50,
    });
  });

  it("still parses a snapshot saved before rounding existed", () => {
    // Older proposals have no `calculated` or `rounding` on their result. They
    // must keep rendering exactly as they did.
    const old = JSON.parse(JSON.stringify(snapshotFixture())) as {
      result: Record<string, unknown>;
    };
    delete old.result.calculated;
    delete old.result.rounding;
    const parsed = parsePricingSnapshot(old as unknown);
    assert.ok(parsed, "an old snapshot was rejected");
    assert.equal(expectedReturnFromSnapshot(parsed!).monthlyFee, 400);
  });
});
