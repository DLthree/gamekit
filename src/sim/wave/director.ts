import type { TimedSpawn } from "@/content/schema/threat";
import { TICK_S, ticks } from "@/core/clock";
import { queueEnemy } from "@/sim/spawn-queue";
import { edgePoint, fieldPoints, ringPoints } from "@/sim/wave/spawn-points";
import { type PendingSpawn, playerOf, type World } from "@/sim/world";

function spawnAtEdge(world: World, def: string): void {
  const p = playerOf(world);
  const at = edgePoint(world.rng, p.x, p.y, world.content.rules.arena);
  queueEnemy(world, def, at.x, at.y);
}

/**
 * A timed spawn: edge places each enemy independently, ring places all of them at once, field
 * announces its points now and spawns there `warnS` later.
 */
function spawnTimed(world: World, s: TimedSpawn): void {
  if (s.pattern === "edge") {
    for (let n = 0; n < s.count; n++) spawnAtEdge(world, s.enemy);
    return;
  }
  const p = playerOf(world);
  const { arena } = world.content.rules;
  if (s.pattern === "ring") {
    const diameter = world.templates[s.enemy].stats.radius * 2;
    const points = ringPoints(world.rng, p.x, p.y, arena, s.radius, s.count, diameter);
    for (const at of points) queueEnemy(world, s.enemy, at.x, at.y);
    return;
  }
  const warn = ticks(s.warnS);
  const points = fieldPoints(world.rng, p.x, p.y, arena, s.minDistance, s.maxDistance, s.count);
  for (const at of points) {
    world.wave.pending.push({ def: s.enemy, x: at.x, y: at.y, due: world.wave.elapsed + warn });
    world.events.push({
      t: "spawnWarned",
      tick: world.tick,
      def: s.enemy,
      x: at.x,
      y: at.y,
      spawnTick: world.tick + warn,
    });
  }
}

/**
 * Queues the warned field spawns due this wave tick (after the timeline, so warnS 0 works). The
 * director runs every wave tick, so a spawn past its due tick is a bug: it throws rather than
 * spawning late or never.
 */
function releasePending(world: World): void {
  const { wave } = world;
  if (wave.pending.length === 0) return;
  const waiting: PendingSpawn[] = [];
  for (const s of wave.pending) {
    if (s.due < wave.elapsed)
      throw new Error(
        `warned ${s.def} spawn was due at wave tick ${s.due} but the director is at ${wave.elapsed}`,
      );
    if (s.due === wave.elapsed) queueEnemy(world, s.def, s.x, s.y);
    else waiting.push(s);
  }
  wave.pending = waiting;
}

/** Phase 9: the threat tier's timeline queues this wave tick's spawns. */
export function tickDirector(world: World): void {
  const threat = world.content.threats[`tier-${world.scenario.threatTier}`];
  const index = world.wave.elapsed;
  const nowS = index * TICK_S;
  for (let i = 0; i < threat.spawns.length; i++) {
    const s = threat.spawns[i];
    if ("at" in s) {
      if (index === ticks(s.at)) spawnTimed(world, s);
      continue;
    }
    if (nowS < s.from || nowS >= s.to) continue;
    const u = (nowS - s.from) / (s.to - s.from);
    world.wave.carry[i] += (s.rate[0] + (s.rate[1] - s.rate[0]) * u) * TICK_S;
    while (world.wave.carry[i] >= 1) {
      world.wave.carry[i] -= 1;
      spawnAtEdge(world, s.enemy);
    }
  }
  releasePending(world);
}
