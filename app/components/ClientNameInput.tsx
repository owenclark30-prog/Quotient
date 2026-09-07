"use client";

export function ClientNameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <section>
      <label htmlFor="client-name">Client name</label>
      <input
        id="client-name"
        type="text"
        placeholder="e.g. Riverside Aesthetics Clinic"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </section>
  );
}
