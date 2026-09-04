"use client";

import type { Service, Tier } from "@/lib/supabase/types";
import { formatSlug } from "@/lib/format";

export function TierPicker({
  tiers,
  tierServices,
  selectedTierId,
  onSelect,
}: {
  tiers: Tier[];
  tierServices: Record<string, Service[]>;
  selectedTierId: string | null;
  onSelect: (tierId: string) => void;
}) {
  return (
    <section>
      <label>Tier</label>
      <div className="tier-grid">
        {tiers.map((tier) => {
          const selected = tier.id === selectedTierId;
          const services = tierServices[tier.id] ?? [];

          return (
            <button
              key={tier.id}
              type="button"
              className={`tier-card${selected ? " selected" : ""}`}
              onClick={() => onSelect(tier.id)}
            >
              <div className="tier-card-header">
                <h3>{tier.name}</h3>
                <span className="tier-level">Tier {tier.level}</span>
              </div>
              {tier.description && (
                <p className="tier-card-description">{tier.description}</p>
              )}

              {selected && services.length > 0 && (
                <ul className="service-list">
                  {services.map((service) => (
                    <li key={service.id}>
                      <span>
                        {formatSlug(service.name)}
                        {service.description && (
                          <span className="service-desc">
                            {" "}
                            — {service.description}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
