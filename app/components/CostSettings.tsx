"use client";

import { useState } from "react";
import {
  updateCostSettings,
  type AgencyCostSettings,
} from "@/lib/data/cost-settings";
import { updateTierHours } from "@/lib/data/tiers";
import {
  defaultHoursForLevel,
  type RoundingEnding,
  type RoundingStyle,
} from "@/lib/pricing";
import { errorMessage } from "@/lib/errors";
import type { Tier } from "@/lib/supabase/types";

/** Hours held as strings so a field can be emptied back to "use the default"
 * rather than being stuck at 0, which is a different thing. */
type HoursDraft = { setup: string; support: string };

const hoursOf = (tier: Tier): HoursDraft => ({
  setup: tier.setup_hours == null ? "" : String(tier.setup_hours),
  support: tier.support_hours == null ? "" : String(tier.support_hours),
});

/** "" means not set. Anything unparseable is also not set — the field is
 * validated before save, so this only ever sees a blank or a number. */
const toHours = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const isBadHours = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = Number(trimmed);
  return !Number.isFinite(parsed) || parsed < 0;
};

export function CostSettings({
  value,
  tiers,
  onSaved,
}: {
  value: AgencyCostSettings;
  tiers: Tier[];
  onSaved: (settings: AgencyCostSettings, tiers: Tier[]) => void;
}) {
  // Margin and conservatism are fractions in the database and percentages here,
  // because nobody thinks in 0.5. Converted at the boundary, both ways.
  const [hourly, setHourly] = useState(String(value.hourlyCost));
  const [margin, setMargin] = useState(String(Math.round(value.targetMargin * 100)));
  const [tools, setTools] = useState(String(value.toolCostMonthly));
  const [conservatism, setConservatism] = useState(
    String(Math.round(value.conservatismFactor * 100))
  );
  const [hours, setHours] = useState<Record<string, HoursDraft>>(() =>
    Object.fromEntries(tiers.map((tier) => [tier.id, hoursOf(tier)]))
  );
  const [roundingStyle, setRoundingStyle] = useState<RoundingStyle>(
    value.rounding.style
  );
  const [roundingEnding, setRoundingEnding] = useState<RoundingEnding>(
    value.rounding.ending
  );
  // Blank means "use the scaled default" — kept as a string so the box can be
  // emptied back to that, rather than being stuck on a number.
  const [roundingStep, setRoundingStep] = useState(
    value.rounding.step == null ? "" : String(value.rounding.step)
  );

  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touched = () => setJustSaved(false);

  const hourlyValue = Number(hourly);
  const marginValue = Number(margin);
  const toolsValue = Number(tools);
  const conservatismValue = Number(conservatism);
  const stepText = roundingStep.trim();
  const stepValue = stepText === "" ? null : Number(stepText);
  // Whole pounds, at least £1 — the database's own CHECK, caught here first.
  const stepValid =
    stepValue === null || (Number.isInteger(stepValue) && stepValue >= 1);

  const valid =
    stepValid &&
    Number.isFinite(hourlyValue) &&
    hourlyValue >= 0 &&
    // 0.95 is the database's own cap: at a margin of 1 the floor divides by zero.
    Number.isFinite(marginValue) &&
    marginValue >= 0 &&
    marginValue <= 95 &&
    Number.isFinite(toolsValue) &&
    toolsValue >= 0 &&
    Number.isFinite(conservatismValue) &&
    conservatismValue > 0 &&
    conservatismValue <= 100 &&
    Object.values(hours).every(
      (draft) => !isBadHours(draft.setup) && !isBadHours(draft.support)
    );

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    try {
      const settings: AgencyCostSettings = {
        hourlyCost: hourlyValue,
        targetMargin: marginValue / 100,
        toolCostMonthly: toolsValue,
        conservatismFactor: conservatismValue / 100,
        rounding: {
          style: roundingStyle,
          ending: roundingEnding,
          step: stepValue,
        },
      };
      await updateCostSettings(settings);

      // Only the tiers whose hours actually changed. A tier left alone isn't
      // written to at all, so this can't quietly set 0 where NULL was meant.
      const changed = tiers.filter((tier) => {
        const original = hoursOf(tier);
        const draft = hours[tier.id] ?? original;
        return (
          draft.setup.trim() !== original.setup ||
          draft.support.trim() !== original.support
        );
      });

      const updated = tiers.map((tier) => {
        if (!changed.includes(tier)) return tier;
        const draft = hours[tier.id];
        return {
          ...tier,
          setup_hours: toHours(draft.setup),
          support_hours: toHours(draft.support),
        };
      });

      for (const tier of changed) {
        const draft = hours[tier.id];
        await updateTierHours(tier.id, {
          setup_hours: toHours(draft.setup),
          support_hours: toHours(draft.support),
        });
      }

      onSaved(settings, updated);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your cost settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && <div className="empty-state error-state">{error}</div>}

      <section>
        <label>Delivery cost</label>
        <div className="fee-grid">
          <label>
            Your hourly cost (£)
            <input
              type="number"
              min="0"
              step="1"
              value={hourly}
              onChange={(e) => {
                setHourly(e.target.value);
                touched();
              }}
            />
          </label>
          <label>
            Target margin (%)
            <input
              type="number"
              min="0"
              max="95"
              step="1"
              value={margin}
              onChange={(e) => {
                setMargin(e.target.value);
                touched();
              }}
            />
          </label>
          <label>
            Tool cost (£/mo)
            <input
              type="number"
              min="0"
              step="1"
              value={tools}
              onChange={(e) => {
                setTools(e.target.value);
                touched();
              }}
            />
          </label>
          <label>
            Conservatism (%)
            <input
              type="number"
              min="1"
              max="100"
              step="5"
              value={conservatism}
              onChange={(e) => {
                setConservatism(e.target.value);
                touched();
              }}
            />
          </label>
        </div>
        <p className="field-hint">
          Used to work out the lowest fee that still hits your margin — your
          floor. Conservatism shaves every value estimate before you see it: at
          70%, a £1,000/mo estimate is quoted as £700. None of this appears on a
          proposal, and none of it changes your rate card.
        </p>
      </section>

      <section className="rounding-settings">
        <label>Price rounding</label>
        <div className="fee-grid">
          <label>
            Style
            <select
              aria-label="Rounding style"
              value={roundingStyle}
              onChange={(e) => {
                setRoundingStyle(e.target.value as RoundingStyle);
                touched();
              }}
            >
              <option value="off">Off</option>
              <option value="clean">Clean — 425, 450</option>
              <option value="charm">Charm — 447, 497</option>
            </select>
          </label>
          {/* The ending only means something for charm prices. */}
          {roundingStyle === "charm" && (
            <label>
              Ending
              <select
                aria-label="Charm ending"
                value={roundingEnding}
                onChange={(e) => {
                  setRoundingEnding(Number(e.target.value) as RoundingEnding);
                  touched();
                }}
              >
                <option value={7}>7 — 447, 497</option>
                <option value={9}>9 — 449, 499</option>
              </select>
            </label>
          )}
          {roundingStyle !== "off" && (
            <label>
              Step (£)
              <input
                aria-label="Rounding step"
                type="number"
                min="1"
                step="1"
                placeholder="Scaled to price"
                value={roundingStep}
                onChange={(e) => {
                  setRoundingStep(e.target.value);
                  touched();
                }}
              />
            </label>
          )}
        </div>
        <p className="field-hint">
          {roundingStyle === "off"
            ? "Suggested fees are shown exactly as calculated."
            : "Rounds the suggested fees into prices you'd quote, never below your floor or outside the value range. Leave the step blank to scale it with the price: £5 under £100/mo, £25 to £500, £50 to £2,000, £100 above — and £50 or £100 for setup. The calculated figure is always shown beside it."}
        </p>
      </section>

      <section>
        <label>Hours per tier</label>
        {tiers.length === 0 ? (
          <div className="empty-state">
            No tiers yet. Hours are per tier, so there&rsquo;s nothing to set
            until your rate card has one.
          </div>
        ) : (
          <>
            {tiers.map((tier) => {
              const fallback = defaultHoursForLevel(tier.level);
              const draft = hours[tier.id] ?? { setup: "", support: "" };

              return (
                <div key={tier.id} className="cost-tier">
                  <h3 className="cost-tier-name">{tier.name}</h3>
                  <div className="fee-grid">
                    <label>
                      Setup hours
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={String(fallback.setupHours)}
                        value={draft.setup}
                        onChange={(e) => {
                          setHours((current) => ({
                            ...current,
                            [tier.id]: { ...draft, setup: e.target.value },
                          }));
                          touched();
                        }}
                      />
                    </label>
                    <label>
                      Support hours (per month)
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={String(fallback.supportHours)}
                        value={draft.support}
                        onChange={(e) => {
                          setHours((current) => ({
                            ...current,
                            [tier.id]: { ...draft, support: e.target.value },
                          }));
                          touched();
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            <p className="field-hint">
              Leave a field blank to use the default for that tier&rsquo;s level
              — shown greyed in the box.
            </p>
          </>
        )}
      </section>

      <section>
        <button
          type="button"
          className="button-primary"
          onClick={handleSave}
          disabled={!valid || saving}
        >
          {saving ? "Saving…" : justSaved ? "Saved" : "Save cost settings"}
        </button>
        {!valid && (
          <p className="field-hint">
            Check the figures above — margin is 0–95%, conservatism 1–100%,
            the rounding step is whole pounds, and hours can&rsquo;t be
            negative.
          </p>
        )}
      </section>
    </>
  );
}
