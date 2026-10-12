/**
 * Steam achievements are the game's deeds, one for one: a deed's achievement has the API name
 * `DEED_<ID_UPPER_SNAKE>` and the deed's name and text. The desktop shell unlocks by these
 * names; `pnpm steam:achievements` writes the dashboard's list from this table. No runtime
 * imports: the desktop shell's main process bundles this file.
 */

/** A deed as the kit sees it: an id and the player's words (the game's `deedList`). */
export interface DeedEntry {
  id: string;
  name: string;
  text: string;
}

/** Steamworks API names: letters, digits and underscores (we use upper case), at most 128. */
const API_NAME = /^[A-Z][A-Z0-9_]{0,127}$/;

/** A deed id's achievement API name: `wyrmslayer` → `DEED_WYRMSLAYER`, `lion-tamer` → `DEED_LION_TAMER`. */
export function achievementName(deedId: string): string {
  return `DEED_${deedId.toUpperCase().replaceAll("-", "_")}`;
}

/** One row of the Steamworks achievements page. */
export interface Achievement {
  deed: string;
  apiName: string;
  name: string;
  description: string;
}

/** The achievements, in the deeds' order. */
export function achievementTable(deeds: readonly DeedEntry[]): Achievement[] {
  return deeds.map((d) => ({
    deed: d.id,
    apiName: achievementName(d.id),
    name: d.name,
    description: d.text,
  }));
}

/** Why a deed can't be a Steam achievement: an API name Steam refuses, or one two deeds share. */
export function achievementProblems(ids: readonly string[]): { deed: string; message: string }[] {
  const seen = new Map<string, string>();
  const out: { deed: string; message: string }[] = [];
  for (const deed of ids) {
    const apiName = achievementName(deed);
    if (!API_NAME.test(apiName))
      out.push({ deed, message: `Steam API name ${apiName} is not ${API_NAME}` });
    const other = seen.get(apiName);
    if (other !== undefined)
      out.push({ deed, message: `Steam API name ${apiName} is also deed ${other}'s` });
    seen.set(apiName, deed);
  }
  return out;
}
