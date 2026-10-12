import type { SkillStats } from "@/content/schema/skill";
import type { StatId, StatMod, Tag } from "@/content/schema/vocab";

/** Skill stats besides damage. Each is optional in a skill file except range and knockback. */
export const SKILL_STAT_IDS = [
  "cooldown",
  "rate",
  "range",
  "area",
  "duration",
  "pulse",
  "projectileSpeed",
  "projectileCount",
  "spread",
  "pierce",
  "knockback",
] as const satisfies readonly StatId[];
export type SkillStatId = (typeof SKILL_STAT_IDS)[number];

export function modApplies(mod: StatMod, tags: readonly Tag[]): boolean {
  for (const t of mod.if) if (!tags.includes(t)) return false;
  return true;
}

/**
 * Whether a skill has a stat: a base number in its file, or an applicable flat line that creates
 * it from 0 (a modifier can give a skill a duration its file lacks). Checks and resolution
 * both ask this, so content that passes the check never reaches a missing stat in the sim.
 */
export function hasSkillStat(
  stats: SkillStats,
  stat: SkillStatId,
  mods: readonly StatMod[],
  tags: readonly Tag[],
): boolean {
  if (stats[stat] !== undefined) return true;
  return mods.some((m) => m.stat === stat && m.op === "flat" && modApplies(m, tags));
}
