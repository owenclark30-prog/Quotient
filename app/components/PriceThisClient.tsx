"use client";

import { useEffect, useMemo, useState } from "react";
import {
  appliedReturn,
  calculatePricing,
  PRICING_DEFAULTS,
  suggestLevers,
  type LeverKey,
  type PricingInputs,
} from "@/lib/pricing";
import {
  deliveryCostFor,
  LEVER_SPECS,
  type FeeSource,
  type PricingSnapshot,
} from "@/lib/pricing-snapshot";
import type { PricingHandoff } from "@/lib/pricing-handoff";
import type { AgencyCostSettings } from "@/lib/data/cost-settings";
import type { PricingRule, Tier } from "@/lib/supabase/types";
import { formatGBP } from "@/lib/format";

/** Every field on the form, keyed `lever.field`, held as a string so a box can
 * be emptied. Defaults are pre-filled and visible, not applied behind the
 * scenes — an agency should be able to see and argue with every assumption. */
function initialFields(): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const spec of LEVER_SPECS) {
    for (const field of spec.fields) {
      fields[`${spec.key}.${field.key}`] =
        field.default == null ? "" : String(field.default);
    }
  }
  return fields;
}

const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  LEVER_SPECS.flatMap((spec) =>
    spec.fields.map((field) => [
      `${spec.key}.${field.key}`,
      `${spec.label}: ${field.label}`,
    ])
  )
);

function buildInputs(
  selected: ReadonlySet<LeverKey>,
  fields: Record<string, string>,
  conservatismFactor: number
): PricingInputs {
  const inputs: PricingInputs = {
    levers: LEVER_SPECS.filter((spec) => selected.has(spec.key)).map(
      (spec) => spec.key
    ),
    conservatismFactor,
  };

  for (const spec of LEVER_SPECS) {
    if (!selected.has(spec.key)) continue;

    const bag: Record<string, number> = {};
    for (const field of spec.fields) {
      const raw = fields[`${spec.key}.${field.key}`]?.trim();
      if (!raw) continue;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) bag[field.key] = parsed;
    }

    // Cast because a half-filled form is a legitimate state: the calculator is
    // what reports which fields are still missing, not the type system.
    (inputs as unknown as Record<string, unknown>)[spec.key] = bag;
  }

  return inputs;
}

const VERDICT_TONE: Record<string, string> = {
  below_floor: "bad",
  underpriced: "warn",
  above_range: "warn",
  inside_range: "good",
};

export function PriceThisClient({
  tier,
  serviceNames,
  rule,
  costSettings,
  onChange,
}: {
  tier: Tier;
  serviceNames: string[];
  /** The rate card fees for this tier. Read-only here, always. */
  rule: PricingRule;
  costSettings: AgencyCostSettings;
  onChange: (handoff: PricingHandoff | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<LeverKey>>(
    () => new Set(suggestLevers(serviceNames))
  );
  const [fields, setFields] = useState<Record<string, string>>(initialFields);
  const [feeSource, setFeeSource] = useState<FeeSource>("rate_card");
  const [customSetup, setCustomSetup] = useState("");
  const [customMonthly, setCustomMonthly] = useState("");

  const { result, fees, handoff } = useMemo(() => {
    const cost = deliveryCostFor(tier, costSettings);
    const inputs = buildInputs(
      selected,
      fields,
      costSettings.conservatismFactor
    );
    const result = calculatePricing(inputs, cost, rule.monthly_fee);

    const custom = {
      setup_fee: Number(customSetup),
      monthly_fee: Number(customMonthly),
    };
    const customUsable =
      customSetup.trim() !== "" &&
      customMonthly.trim() !== "" &&
      Number.isFinite(custom.setup_fee) &&
      custom.setup_fee >= 0 &&
      Number.isFinite(custom.monthly_fee) &&
      custom.monthly_fee >= 0;

    // Fees for this proposal only. Null means the rate card stands — and the
    // rate card itself is never written to, whichever branch this takes.
    let fees: { setup_fee: number; monthly_fee: number } | null = null;
    if (feeSource === "suggested" && result.recommended) {
      fees = {
        setup_fee: result.recommended.setup,
        monthly_fee: result.recommended.monthly,
      };
    } else if (feeSource === "custom" && customUsable) {
      fees = custom;
    }

    // Founding rates belong to the rate card's own fee, so a fee set for this
    // one client has no founding variant to fall back to.
    const setupFee = fees?.setup_fee ?? rule.founding_setup_fee ?? rule.setup_fee;
    const monthlyFee =
      fees?.monthly_fee ?? rule.founding_monthly_fee ?? rule.monthly_fee;

    const conservative = result.value.conservative;
    const snapshot: PricingSnapshot = {
      version: 1,
      calculatedAt: new Date().toISOString(),
      levers: inputs.levers,
      inputs,
      defaults: PRICING_DEFAULTS,
      cost,
      rateCard: { setupFee: rule.setup_fee, monthlyFee: rule.monthly_fee },
      result,
      applied: {
        source: feeSource,
        setupFee,
        monthlyFee,
        ...appliedReturn(conservative, setupFee, monthlyFee),
      },
    };

    // No usable estimate means no section on the proposal and no suggested fee
    // — the figures aren't there yet, and a blank "Expected return" would be
    // worse than none.
    const usable = result.status === "ok" || result.status === "not_viable";

    return {
      result,
      fees,
      handoff: open && usable ? { snapshot, fees } : null,
    };
  }, [
    tier,
    costSettings,
    rule,
    selected,
    fields,
    feeSource,
    customSetup,
    customMonthly,
    open,
  ]);

  useEffect(() => {
    onChange(handoff);
  }, [handoff, onChange]);

  function toggleLever(key: LeverKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function chooseSuggested() {
    setFeeSource("suggested");
  }

  function chooseCustom() {
    // Seeded with the suggestion, falling back to the rate card: typing a fee
    // should start from a number, not an empty box.
    if (customSetup.trim() === "" && customMonthly.trim() === "") {
      setCustomSetup(String(result.recommended?.setup ?? rule.setup_fee));
      setCustomMonthly(String(result.recommended?.monthly ?? rule.monthly_fee));
    }
    setFeeSource("custom");
  }

  if (!open) {
    return (
      <section>
        <label>Price this client</label>
        <div className="price-step-closed">
          <p className="field-hint">
            Optional. Take the client&rsquo;s own numbers, estimate what the
            automation is worth to them each month, and check it against what
            this tier costs you to deliver.
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setOpen(true)}
          >
            Price this client
          </button>
        </div>
      </section>
    );
  }

  const missing = result.missingFields;

  return (
    <section className="price-step">
      <div className="price-step-header">
        <label>Price this client</label>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setOpen(false);
            setFeeSource("rate_card");
          }}
        >
          Skip this step
        </button>
      </div>

      <p className="field-hint">
        Tick what this package actually moves for them, then put their numbers
        in. The boxes are pre-filled with sensible defaults — change any of them.
      </p>

      {LEVER_SPECS.map((spec) => {
        const on = selected.has(spec.key);

        return (
          <div
            key={spec.key}
            className={`lever-block${on ? " lever-block-on" : ""}`}
          >
            <label className="checkbox-item lever-head">
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggleLever(spec.key)}
              />
              <span>
                <span className="lever-name">{spec.label}</span>
                <span className="lever-blurb">{spec.blurb}</span>
              </span>
            </label>

            {on && (
              <div className="fee-grid lever-fields">
                {spec.fields.map((field) => {
                  const path = `${spec.key}.${field.key}`;
                  const unit =
                    field.unit === "money"
                      ? " (£)"
                      : field.unit === "percent"
                        ? " (%)"
                        : "";

                  return (
                    <label key={path}>
                      {field.label}
                      {unit}
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={fields[path] ?? ""}
                        onChange={(e) =>
                          setFields((current) => ({
                            ...current,
                            [path]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {missing.length > 0 ? (
        <div className="empty-state">
          {missing.includes("levers")
            ? "Tick at least one lever to see an estimate."
            : `Still needed: ${missing
                .map((path) => FIELD_LABELS[path] ?? path)
                .join(", ")}.`}
        </div>
      ) : (
        <div className="price-results">
          <div className="price-headline">
            <span className="price-headline-label">
              Conservative monthly value
            </span>
            {/* Whole pounds: pence on an estimate this soft is false
                precision, and £2,872.8 reads as a typo. */}
            <span className="price-headline-value">
              {formatGBP(Math.round(result.value.conservative))}
              <span className="price-headline-unit">/mo</span>
            </span>
            <span className="field-hint">
              {formatGBP(Math.round(result.value.total))}/mo estimated, held
              back to {Math.round(result.value.conservatismFactor * 100)}%.
            </span>
          </div>

          {result.range && (
            <div className="price-range">
              <div className="price-range-cell">
                <span className="price-range-label">Low</span>
                <span className="price-range-value">
                  {formatGBP(result.range.low)}
                </span>
              </div>
              <div className="price-range-cell price-range-target">
                <span className="price-range-label">Target</span>
                <span className="price-range-value">
                  {formatGBP(result.range.target)}
                </span>
              </div>
              <div className="price-range-cell">
                <span className="price-range-label">High</span>
                <span className="price-range-value">
                  {formatGBP(result.range.high)}
                </span>
              </div>
            </div>
          )}

          <div className="pricing-box">
            <div className="pricing-row">
              <span className="pricing-label">Your floor (monthly)</span>
              <span className="pricing-value">
                {formatGBP(result.floor.monthly)}/mo
              </span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label">Your floor (setup)</span>
              <span className="pricing-value">
                {formatGBP(result.floor.setup)}
              </span>
            </div>
            <div className="pricing-row">
              <span className="pricing-label">Rate card</span>
              <span className="pricing-value">
                {formatGBP(rule.setup_fee)} + {formatGBP(rule.monthly_fee)}/mo
              </span>
            </div>
            {result.recommended && (
              <div className="pricing-row">
                <span className="pricing-label">Suggested</span>
                <span className="pricing-value">
                  {formatGBP(result.recommended.setup)} +{" "}
                  {formatGBP(result.recommended.monthly)}/mo
                </span>
              </div>
            )}
            {result.roi != null && (
              <div className="pricing-row">
                <span className="pricing-label">
                  Return on the suggested fee
                </span>
                <span className="pricing-value">
                  {result.roi.toFixed(1)}×
                  {result.paybackMonths != null &&
                    ` · setup paid back in ${result.paybackMonths.toFixed(1)} months`}
                </span>
              </div>
            )}
          </div>

          {result.status === "not_viable" && (
            <div className="empty-state error-state">
              No viable price. Your floor of{" "}
              {formatGBP(result.floor.monthly)}/mo is above the most this
              client&rsquo;s own numbers can justify (
              {formatGBP(result.range?.high ?? 0)}/mo). Either the figures are
              too low to automate profitably, or this tier is too heavy for
              them.
            </div>
          )}

          {result.verdict && (
            <p
              className={`price-verdict price-verdict-${
                VERDICT_TONE[result.verdict.kind] ?? "warn"
              }`}
            >
              <span className="price-verdict-label">
                Rate card at {formatGBP(rule.monthly_fee)}/mo
              </span>{" "}
              — {result.verdict.message}
            </p>
          )}

          {result.warnings.map((warning) => (
            <p key={warning.code} className="price-warning">
              {warning.message}
            </p>
          ))}

          <div className="fee-choice">
            <button
              type="button"
              className={`fee-choice-button${
                feeSource === "suggested" ? " selected" : ""
              }`}
              aria-pressed={feeSource === "suggested"}
              disabled={!result.recommended}
              onClick={chooseSuggested}
            >
              Use suggested fees
              <span className="fee-choice-note">This proposal only</span>
            </button>
            <button
              type="button"
              className={`fee-choice-button${
                feeSource === "rate_card" ? " selected" : ""
              }`}
              aria-pressed={feeSource === "rate_card"}
              onClick={() => setFeeSource("rate_card")}
            >
              Keep rate card fees
              <span className="fee-choice-note">
                {formatGBP(rule.monthly_fee)}/mo
              </span>
            </button>
            <button
              type="button"
              className={`fee-choice-button${
                feeSource === "custom" ? " selected" : ""
              }`}
              aria-pressed={feeSource === "custom"}
              onClick={chooseCustom}
            >
              Type custom
              <span className="fee-choice-note">Your own number</span>
            </button>
          </div>

          {feeSource === "custom" && (
            <div className="fee-grid">
              <label>
                Setup fee (£)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={customSetup}
                  onChange={(e) => setCustomSetup(e.target.value)}
                />
              </label>
              <label>
                Monthly fee (£)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={customMonthly}
                  onChange={(e) => setCustomMonthly(e.target.value)}
                />
              </label>
            </div>
          )}

          <p className="field-hint">
            {fees
              ? `This proposal will use ${formatGBP(
                  fees.setup_fee
                )} setup and ${formatGBP(
                  fees.monthly_fee
                )}/mo. Your rate card is unchanged.`
              : "This proposal will use your rate card fees."}
          </p>

          <p className="price-disclaimer">
            Estimate based on the figures entered, not market benchmarks.
          </p>
          <p className="field-hint">
            Your client sees the conservative figure, the fee, the payback and
            the return — never your floor, your range or what delivery costs
            you.
          </p>
        </div>
      )}
    </section>
  );
}
