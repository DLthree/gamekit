import type { ZoneNode } from "@/realtime/content/schema/skill";
import { ticks } from "@/realtime/core/clock";
import { skillStat } from "@/realtime/sim/skills/instance";
import { queueVolume } from "@/realtime/sim/spawn-queue";
import type { Delivery, World } from "@/realtime/sim/world";

/**
 * One lasting circle of radius area × scale where the delivery happened. It sweeps every body
 * inside it every `pulse` seconds for `duration` seconds. No knockback, no hit-stop: a patch
 * under a crowd must not shove or freeze it.
 */
export function zone(world: World, d: Delivery, node: ZoneNode): void {
  const s = d.skill;
  const lifeTicks = ticks(skillStat(s, "duration"));
  const pulseTicks = ticks(skillStat(s, "pulse"));
  // STAT_CLAMPS keeps every resolved duration ≥ 2 ticks and pulse ≥ 1 (resolve.test.ts).
  queueVolume(world, {
    kind: "zone",
    vfx: node.vfx,
    owner: d.owner,
    ownerDef: d.ownerDef,
    team: d.team,
    skill: s,
    node,
    x: d.x,
    y: d.y,
    dirX: d.dirX,
    dirY: d.dirY,
    speed: 0,
    range: 0,
    radius: skillStat(s, "area") * node.areaScale,
    shape: "circle",
    length: 0,
    halfAngle: Math.PI,
    damageScale: node.damageScale,
    knockback: 0,
    hitStop: false,
    lifeTicks,
    pulseTicks,
    hitsLeft: 0,
    warnTicks: 0,
    cancelOnOwnerDeath: false,
    ox: d.x,
    oy: d.y,
  });
}
