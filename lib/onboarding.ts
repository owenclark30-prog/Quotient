import type { ProposalServiceSnapshot } from "@/lib/supabase/types";

/** The values a template can interpolate. Everything here comes off the
 * proposal, so a generated document can never disagree with the quote it
 * was attached to. */
export type PlaceholderValues = {
  client_name: string;
  agency_name: string;
  tier_name: string;
  services: ProposalServiceSnapshot[];
};

export const PLACEHOLDERS = [
  { token: "client_name", description: "The client's name" },
  { token: "agency_name", description: "Your agency name" },
  { token: "tier_name", description: "The tier they're on" },
  { token: "services", description: "What's included, one per line" },
] as const;

const TOKEN_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function isKnownPlaceholder(token: string) {
  return PLACEHOLDERS.some((p) => p.token === token.toLowerCase());
}

/** Every `{{token}}` in the body that isn't one we can fill. Surfaced in the
 * editor so a typo is caught while writing, not after it reaches a client. */
export function unknownPlaceholders(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const token = match[1].toLowerCase();
    if (!isKnownPlaceholder(token)) found.add(token);
  }
  return [...found];
}

/** Which known placeholders this template actually uses. */
export function usedPlaceholders(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const token = match[1].toLowerCase();
    if (isKnownPlaceholder(token)) found.add(token);
  }
  return [...found];
}

function serviceLines(services: ProposalServiceSnapshot[]) {
  if (services.length === 0) return "";
  return services
    .map((service) =>
      service.description
        ? `- ${service.name} — ${service.description}`
        : `- ${service.name}`
    )
    .join("\n");
}

/** Fills a template. Unknown tokens are left exactly as written rather than
 * blanked: a visible `{{welcom_pack}}` in the preview is a typo you can fix,
 * whereas a silent gap is a sentence that lost a word on its way to a client.
 *
 * Output is plain text. Templates are never treated as HTML — they're rendered
 * with `white-space: pre-wrap` — so a body can't inject markup into a document
 * that gets printed and sent on. */
export function renderTemplate(body: string, values: PlaceholderValues) {
  return body.replace(TOKEN_PATTERN, (whole, rawToken: string) => {
    switch (rawToken.toLowerCase()) {
      case "client_name":
        return values.client_name;
      case "agency_name":
        return values.agency_name;
      case "tier_name":
        return values.tier_name;
      case "services":
        return serviceLines(values.services);
      default:
        return whole;
    }
  });
}
