/** Helpers for the agency identity fields that render on a proposal.
 *
 * Both of these produce `href`s on a document the agency sends to its own
 * clients, so neither trusts what was typed into settings. */

/** Only http(s) gets through. A `javascript:` or `data:` value typed into the
 * website field would otherwise become a live link on every proposal. Bare
 * domains are the common case, so they're promoted to https rather than
 * rejected. Returns null when it can't be made into a safe absolute URL. */
export function websiteHref(website: string | null | undefined): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

/** What the client actually reads: the scheme is noise on a printed page, and
 * a trailing slash looks like a typo. */
export function websiteLabel(
  website: string | null | undefined
): string | null {
  const href = websiteHref(website);
  if (!href) return null;
  return href.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Deliberately loose about what counts as an address — this only has to avoid
 * producing a broken or dangerous mailto. Anything rejected still renders as
 * plain text, so a client can read it either way.
 *
 * The excluded characters are the ones that would turn the address into extra
 * mailto headers (`?subject=`, `&bcc=`, a second recipient after a comma), so
 * the address itself can then go in unencoded — percent-encoding the `@` is
 * not what RFC 6068 asks for. */
const MAILTO_UNSAFE = '\\s@,;?&<>"';
const EMAIL_SHAPE = new RegExp(
  `^[^${MAILTO_UNSAFE}]+@[^${MAILTO_UNSAFE}]+\\.[^${MAILTO_UNSAFE}]+$`
);

export function emailHref(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  return EMAIL_SHAPE.test(trimmed) ? `mailto:${trimmed}` : null;
}
