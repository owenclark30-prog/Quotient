"use client";

import type { Industry } from "@/lib/supabase/types";

export function IndustrySelect({
  industries,
  value,
  onChange,
}: {
  industries: Industry[];
  value: string | null;
  onChange: (industryId: string | null) => void;
}) {
  return (
    <section>
      <label htmlFor="industry">Industry (optional)</label>
      <select
        id="industry"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">No industry — standard pricing</option>
        {industries.map((industry) => (
          <option key={industry.id} value={industry.id}>
            {industry.name}
          </option>
        ))}
      </select>
    </section>
  );
}
