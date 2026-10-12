import type { StatId } from "@/content/schema/vocab";

/**
 * The legal range of every stat, applied after resolution. Typed over every StatId, so adding a
 * stat id in content/schema/vocab.ts without a clamp here fails typecheck.
 */
export const STAT_CLAMPS: Record<StatId, readonly [number, number]> = {
  life: [1, 1_000_000],
  moveSpeed: [0, 1000],
  radius: [1, 500],
  knockbackResist: [0, 1],
  damage: [0, 1_000_000],
  cooldown: [0.05, 60],
  rate: [0.01, 60],
  range: [1, 5000],
  area: [1, 2000],
  duration: [0.05, 600],
  pulse: [0.05, 60],
  projectileSpeed: [1, 5000],
  projectileCount: [1, 50],
  spread: [0, 360],
  pierce: [0, 15],
  knockback: [0, 5000],
};

export function clampStat(stat: StatId, value: number): number {
  const [min, max] = STAT_CLAMPS[stat];
  return Math.min(max, Math.max(min, value));
}
