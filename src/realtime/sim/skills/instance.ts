import type { DamageType, SlotId, SourcedMod, Tag } from "@/content/schema/vocab";
import { ticks } from "@/core/clock";
import { DAMAGE_TYPES } from "@/game/vocab";
import type { MergedSkill } from "@/realtime/content/loadout";
import type { DeliveryNode, Skill } from "@/realtime/content/schema/skill";
import { hasSkillStat, SKILL_STAT_IDS, type SkillStatId } from "@/realtime/content/skill-stats";
import { type Resolved, resolveDamage, resolveStat } from "@/realtime/sim/stats/resolve";

/** A skill's numbers for one wave: resolved once at world creation, snapshotted into volumes. */
export interface ResolvedSkill {
  id: string;
  def: Skill;
  tags: readonly Tag[];
  /** The merged delivery tree (modifier attachments and looks applied); activation runs this. */
  deliver: DeliveryNode;
  damage: Record<DamageType, number>;
  stats: Partial<Record<SkillStatId, number>>;
  /** Keyed "area", "damage.<type>", …: the lines behind each number. */
  breakdown: Record<string, Resolved>;
  /** Ticks between activations: 1/rate for auto skills, the cooldown for manual ones. */
  intervalTicks: number;
}

/** A skill on one actor: which slot it sits in (null for enemy skills) and when it is ready. */
export interface SkillInstance {
  skill: ResolvedSkill;
  slot: SlotId | null;
  readyTick: number;
}

/** A merged skill's numbers: its modifiers' StatMods first, then `mods` (build or threat). */
export function resolveSkill(merged: MergedSkill, mods: readonly SourcedMod[]): ResolvedSkill {
  const { id, def, tags } = merged;
  const all = [...merged.mods, ...mods];
  const plain = all.map((m) => m.mod);
  const breakdown: Record<string, Resolved> = {};
  const stats: Partial<Record<SkillStatId, number>> = {};
  for (const stat of SKILL_STAT_IDS) {
    if (!hasSkillStat(def.stats, stat, plain, tags)) continue;
    // Absent from the file but created by a flat line: the flat lines start from 0.
    const r = resolveStat(stat, def.stats[stat] ?? 0, all, tags);
    breakdown[stat] = r;
    stats[stat] = r.value;
  }
  const resolvedDamage = resolveDamage(def.stats.damage, all, tags);
  const damage = {} as Record<DamageType, number>;
  for (const type of DAMAGE_TYPES) {
    damage[type] = resolvedDamage[type].value;
    breakdown[`damage.${type}`] = resolvedDamage[type];
  }
  const skill: ResolvedSkill = {
    id,
    def,
    tags,
    deliver: merged.deliver,
    damage,
    stats,
    breakdown,
    intervalTicks: 1,
  };
  const seconds =
    def.activation === "auto" ? 1 / skillStat(skill, "rate") : skillStat(skill, "cooldown");
  skill.intervalTicks = Math.max(1, ticks(seconds));
  return skill;
}

/** A resolved stat the caller needs. Missing means content and code disagree: that's a bug. */
export function skillStat(s: ResolvedSkill, stat: SkillStatId): number {
  const v = s.stats[stat];
  if (v === undefined) throw new Error(`skill ${s.id} has no ${stat}`);
  return v;
}
