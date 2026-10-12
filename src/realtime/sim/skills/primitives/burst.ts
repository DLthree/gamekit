import { nextFloat } from "@/core/rng";
import type { Vec } from "@/core/vec";
import type { BurstNode } from "@/realtime/content/schema/skill";
import { ticks } from "@/realtime/core/clock";
import { skillStat } from "@/realtime/sim/skills/instance";
import { insideArena } from "@/realtime/sim/spawn-points";
import { queueVolume } from "@/realtime/sim/spawn-queue";
import type { Delivery, World } from "@/realtime/sim/world";

/**
 * Where each of the node's `count` marks goes: the first on its point (the delivery point, or
 * the target point for `at: "target"`), the rest uniformly in a disc of radius `scatter` around
 * it, mirrored back inside the arena.
 */
function marks(world: World, d: Delivery, node: BurstNode): Vec[] {
  const x = node.at === "target" ? d.tx : d.x;
  const y = node.at === "target" ? d.ty : d.y;
  const out: Vec[] = [{ x, y }];
  for (let i = 1; i < node.count; i++) {
    const r = node.scatter * Math.sqrt(nextFloat(world.rng));
    const a = 2 * Math.PI * nextFloat(world.rng);
    out.push(insideArena(x + Math.cos(a) * r, y + Math.sin(a) * r, world.content.rules.arena));
  }
  return out;
}

/**
 * One sweep per mark, after `warn` seconds (harmless until then): a circle, an arc facing the
 * delivery direction, or a lane `range` long along it, of radius (half-width) area × scale.
 */
export function burst(world: World, d: Delivery, node: BurstNode): void {
  const s = d.skill;
  const shape = node.shape;
  const radius = skillStat(s, "area") * node.areaScale;
  const knockback = skillStat(s, "knockback");
  const length = shape.kind === "lane" ? skillStat(s, "range") : 0;
  const warnTicks = ticks(node.warn);
  for (const m of marks(world, d, node)) {
    queueVolume(world, {
      kind: "burst",
      vfx: node.vfx,
      owner: d.owner,
      ownerDef: d.ownerDef,
      team: d.team,
      skill: s,
      node,
      x: m.x,
      y: m.y,
      dirX: d.dirX,
      dirY: d.dirY,
      speed: 0,
      range: 0,
      radius,
      shape: shape.kind,
      length,
      halfAngle: shape.kind === "arc" ? (shape.halfAngleDeg * Math.PI) / 180 : Math.PI,
      damageScale: node.damageScale,
      knockback,
      hitStop: node.hitStop,
      lifeTicks: 0,
      pulseTicks: 0,
      hitsLeft: 0,
      warnTicks,
      cancelOnOwnerDeath: node.cancelOnOwnerDeath,
      ox: d.x,
      oy: d.y,
    });
  }
}
