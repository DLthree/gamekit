/**
 * Words a player should never read: the sim's and the tools' own terms. A game passes its own
 * list (this default plus its dev words) to `devTerm` in a test over every player-facing string.
 */
export const DEV_TERMS: readonly string[] = [
  "tick",
  "fodder",
  "telegraph",
  "volume",
  "seed",
  "override",
  "undefined",
  "null",
  "NaN",
];

/** A content id as written in files (`fire-bolt`): never shown as is. */
const CONTENT_ID = /\b[a-z0-9]+(?:-[a-z0-9]+)+\b/;

/**
 * The first dev term in `text`, or null. Terms match case-insensitively from a word's start, so
 * "ticks" and "Telegraphed" are caught; `ids` also catches content ids (lower-case, hyphenated),
 * which a page should show through `idWords`.
 */
export function devTerm(text: string, terms: readonly string[], ids: boolean): string | null {
  const lower = text.toLowerCase();
  for (const t of terms) {
    const re = new RegExp(`\\b${t.toLowerCase()}`);
    if (re.test(lower)) return t;
  }
  if (ids) return text.match(CONTENT_ID)?.[0] ?? null;
  return null;
}

/** A content id as words a page shows: `fire-bolt` → "Fire bolt". */
export function idWords(id: string): string {
  const words = id.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
