import { DAMAGE_TYPES } from "@/game/vocab";
import type {
  ActorStats,
  DamageType,
  SourcedMod,
  StatId,
  StatMod,
  Tag,
} from "@/realtime/content/schema/vocab";
import { modApplies } from "@/realtime/content/skill-stats";
import { clampStat } from "@/realtime/sim/stats/ids";

export interface StatLine {
  source: string;
  op: StatMod["op"];
  value: number;
}

/** A resolved number and the lines that made it (the breakdown tests assert on). */
export interface Resolved {
  value: number;
  base: number;
  lines: StatLine[];
}

/** (base + Σ flat) × (1 + Σ increased) × Π (1 + more), clamped to the stat's range. */
export function resolveStat(
  stat: StatId,
  base: number,
  mods: readonly SourcedMod[],
  tags: readonly Tag[],
): Resolved {
  let flat = 0;
  let increased = 0;
  let more = 1;
  const lines: StatLine[] = [];
  for (const { mod, source } of mods) {
    if (mod.stat !== stat || !modApplies(mod, tags)) continue;
    lines.push({ source, op: mod.op, value: mod.value });
    if (mod.op === "flat") flat += mod.value;
    else if (mod.op === "increased") increased += mod.value;
    else more *= 1 + mod.value;
  }
  const value = clampStat(stat, (base + flat) * (1 + increased) * more);
  return { value, base, lines };
}

/** Each damage portion is resolved with the skill's tags plus its own type. */
export function resolveDamage(
  base: Partial<Record<DamageType, number>>,
  mods: readonly SourcedMod[],
  tags: readonly Tag[],
): Record<DamageType, Resolved> {
  const out = {} as Record<DamageType, Resolved>;
  for (const type of DAMAGE_TYPES) {
    const b = base[type];
    out[type] =
      b === undefined
        ? { value: 0, base: 0, lines: [] }
        : resolveStat("damage", b, mods, [...tags, type]);
  }
  return out;
}

export function resolveActorStats(base: ActorStats, mods: readonly SourcedMod[]): ActorStats {
  return {
    life: resolveStat("life", base.life, mods, []).value,
    moveSpeed: resolveStat("moveSpeed", base.moveSpeed, mods, []).value,
    radius: resolveStat("radius", base.radius, mods, []).value,
    knockbackResist: resolveStat("knockbackResist", base.knockbackResist, mods, []).value,
  };
}
