import { TICK_S } from "@/realtime/core/clock";
import { getActor } from "@/realtime/sim/actors/store";
import type { Volume } from "@/realtime/sim/volumes/store";
import type { World } from "@/realtime/sim/world";

/**
 * An owner-bound volume whose owner died while it warned. The sweep tick counts too: this runs
 * before collectHits, so a death seen here happened during the warning (on its last tick at the
 * latest), and the volume must not sweep.
 */
function ownerLost(world: World, v: Volume): boolean {
  if (!v.cancelOnOwnerDeath || world.tick > v.bornTick + v.warnTicks) return false;
  const owner = getActor(world.actors, v.owner);
  return owner === null || owner.hp <= 0;
}

/**
 * Phase 4 (volumes): projectiles fly straight and end at their range; zones end at their life;
 * an owner-bound telegraph whose owner died is cancelled.
 */
export function moveVolumes(world: World): void {
  for (const v of world.volumes.items) {
    if (!v.alive || v.ended) continue;
    if (ownerLost(world, v)) {
      v.ended = true;
      v.cancelled = true;
      continue;
    }
    if (v.kind === "zone") {
      if (world.tick - v.bornTick >= v.lifeTicks) v.ended = true;
      continue;
    }
    // Bursts don't move: they sweep once, in collectHits, where they were delivered.
    if (v.kind !== "projectile") continue;
    let len = v.speed * TICK_S;
    const left = v.range - v.travelled;
    if (len >= left) {
      len = left;
      v.ended = true;
    }
    v.x += v.dirX * len;
    v.y += v.dirY * len;
    v.travelled += len;
  }
}
