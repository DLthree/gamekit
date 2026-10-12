import { nextFloat } from "@/core/rng";
import { rotate, unit, type Vec } from "@/core/vec";
import type { ProjectileNode } from "@/realtime/content/schema/skill";
import { nearestEnemies } from "@/realtime/sim/combat/targeting";
import { skillStat } from "@/realtime/sim/skills/instance";
import { queueVolume } from "@/realtime/sim/spawn-queue";
import type { Delivery, World } from "@/realtime/sim/world";

/** `count` directions fanned evenly over `spread` degrees around the delivery's direction. */
function fan(d: Delivery, count: number): Vec[] {
  const spread = (skillStat(d.skill, "spread") * Math.PI) / 180;
  const out: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? 0 : -spread / 2 + (spread * i) / (count - 1);
    out.push(rotate(d.dirX, d.dirY, angle));
  }
  return out;
}

/** One direction per projectile, by the node's multishot pattern (Multishot in the schema). */
function directions(world: World, d: Delivery, node: ProjectileNode, count: number): Vec[] {
  switch (node.multishot) {
    case "fan":
      return fan(d, count);
    case "nearest": {
      const targets = nearestEnemies(world, d.x, d.y, skillStat(d.skill, "range"), count);
      if (targets.length === 0) return fan(d, count);
      const own = { x: d.dirX, y: d.dirY };
      return Array.from({ length: count }, (_, i) => {
        const t = targets[i % targets.length];
        return unit(t.x - d.x, t.y - d.y, own);
      });
    }
    case "nova":
      return Array.from({ length: count }, (_, i) =>
        rotate(d.dirX, d.dirY, (2 * Math.PI * i) / count),
      );
    case "scatter":
      return Array.from({ length: count }, () => rotate(1, 0, 2 * Math.PI * nextFloat(world.rng)));
  }
}

/** `projectileCount` linear volumes aimed by the node's multishot pattern, each flying `range`. */
export function projectile(world: World, d: Delivery, node: ProjectileNode): void {
  const s = d.skill;
  const count = Math.round(skillStat(s, "projectileCount"));
  // No pierce stat means the projectile stops at its first body.
  const pierce = s.stats.pierce;
  const hitsLeft = pierce === undefined ? 1 : 1 + Math.round(pierce);
  for (const dir of directions(world, d, node, count)) {
    queueVolume(world, {
      kind: "projectile",
      vfx: node.vfx,
      owner: d.owner,
      ownerDef: d.ownerDef,
      team: d.team,
      skill: s,
      node,
      x: d.x,
      y: d.y,
      dirX: dir.x,
      dirY: dir.y,
      speed: skillStat(s, "projectileSpeed"),
      range: skillStat(s, "range"),
      radius: node.radius,
      shape: "circle",
      length: 0,
      halfAngle: Math.PI,
      damageScale: node.damageScale,
      knockback: skillStat(s, "knockback"),
      hitStop: false,
      lifeTicks: 0,
      pulseTicks: 0,
      hitsLeft,
      warnTicks: 0,
      cancelOnOwnerDeath: false,
      ox: d.x,
      oy: d.y,
    });
  }
}
