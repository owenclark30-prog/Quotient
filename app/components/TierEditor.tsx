"use client";

import { useState } from "react";
import type { PricingRule, Service, Tier } from "@/lib/supabase/types";
import {
  addServiceToTier,
  deleteTier,
  removeServiceFromTier,
  updateTier,
} from "@/lib/data/tiers";
import { saveGenericPricingRule } from "@/lib/data/pricing-rules";
import { errorMessage } from "@/lib/errors";

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function TierEditor({
  tier,
  services,
  memberServiceIds,
  rule,
  onChanged,
  onError,
}: {
  tier: Tier;
  services: Service[];
  memberServiceIds: Set<string>;
  rule: PricingRule | null;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [name, setName] = useState(tier.name);
  const [description, setDescription] = useState(tier.description ?? "");

  const [setupFee, setSetupFee] = useState(String(rule?.setup_fee ?? ""));
  const [monthlyFee, setMonthlyFee] = useState(String(rule?.monthly_fee ?? ""));
  const [foundingSetup, setFoundingSetup] = useState(
    rule?.founding_setup_fee != null ? String(rule.founding_setup_fee) : ""
  );
  const [foundingMonthly, setFoundingMonthly] = useState(
    rule?.founding_monthly_fee != null ? String(rule.founding_monthly_fee) : ""
  );
  const [foundingMonths, setFoundingMonths] = useState(
    rule?.founding_duration_months != null
      ? String(rule.founding_duration_months)
      : ""
  );

  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    onError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      onError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  const detailsDirty =
    name.trim() !== tier.name ||
    (description.trim() || null) !== tier.description;

  return (
    <div className="tier-editor">
      <div className="tier-editor-header">
        <span className="tier-level">Tier {tier.level}</span>
        <button
          type="button"
          className="link-button danger"
          disabled={busy}
          onClick={() => run(() => deleteTier(tier.id))}
        >
          Delete tier
        </button>
      </div>

      <div className="editor-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          className="button-secondary"
          disabled={!detailsDirty || !name.trim() || busy}
          onClick={() =>
            run(() =>
              updateTier(tier.id, {
                name: name.trim(),
                description: description.trim() || null,
                level: tier.level,
              })
            )
          }
        >
          Save
        </button>
      </div>

      <div className="tier-editor-block">
        <span className="proposal-label">Included services</span>
        {services.length === 0 ? (
          <p className="field-hint">Add a service first.</p>
        ) : (
          <div className="checkbox-list">
            {services.map((service) => {
              const checked = memberServiceIds.has(service.id);
              return (
                <label key={service.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() =>
                      run(() =>
                        checked
                          ? removeServiceFromTier(tier.id, service.id)
                          : addServiceToTier(tier.id, service.id)
                      )
                    }
                  />
                  <span>{service.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="tier-editor-block">
        <span className="proposal-label">Pricing</span>
        <div className="fee-grid">
          <label>
            Setup fee (£)
            <input
              type="number"
              min="0"
              step="1"
              value={setupFee}
              onChange={(e) => setSetupFee(e.target.value)}
            />
          </label>
          <label>
            Monthly fee (£)
            <input
              type="number"
              min="0"
              step="1"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
            />
          </label>
        </div>

        <p className="field-hint">
          Founding rate (optional) — a discounted rate for the first months.
        </p>
        <div className="fee-grid">
          <label>
            Founding setup (£)
            <input
              type="number"
              min="0"
              step="1"
              value={foundingSetup}
              onChange={(e) => setFoundingSetup(e.target.value)}
            />
          </label>
          <label>
            Founding monthly (£)
            <input
              type="number"
              min="0"
              step="1"
              value={foundingMonthly}
              onChange={(e) => setFoundingMonthly(e.target.value)}
            />
          </label>
          <label>
            For how many months
            <input
              type="number"
              min="1"
              step="1"
              value={foundingMonths}
              onChange={(e) => setFoundingMonths(e.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          className="button-secondary"
          disabled={busy || !setupFee.trim() || !monthlyFee.trim()}
          onClick={() =>
            run(() =>
              saveGenericPricingRule(tier.id, rule?.id ?? null, {
                setup_fee: toNumber(setupFee),
                monthly_fee: toNumber(monthlyFee),
                founding_setup_fee: toNullableNumber(foundingSetup),
                founding_monthly_fee: toNullableNumber(foundingMonthly),
                founding_duration_months: toNullableNumber(foundingMonths),
              })
            )
          }
        >
          {busy ? "Saving…" : rule ? "Save pricing" : "Set pricing"}
        </button>

        {!rule && (
          <p className="field-hint">
            This tier has no pricing yet, so it can&rsquo;t be quoted.
          </p>
        )}
      </div>
    </div>
  );
}
