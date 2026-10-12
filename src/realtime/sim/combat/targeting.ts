import type { Actor } from "@/realtime/sim/actors/store";
import type { World } from "@/realtime/sim/world";

/** The nearest living enemy whose centre is within `range` of (x, y), or null. */
export function nearestEnemy(world: World, x: number, y: number, range: number): Actor | null {
  const items = world.actors.items;
  const slot = world.hash.nearest(x, y, range, (s) => {
    const a = items[s];
    return a.alive && a.hp > 0 && a.team === "enemy";
  });
  return slot === -1 ? null : items[slot];
}

/**
 * Up to `n` distinct living enemies whose centres are within `range` of (x, y), nearest first
 * (ties by id, so the order doesn't depend on the hash's layout).
 */
export function nearestEnemies(
  world: World,
  x: number,
  y: number,
  range: number,
  n: number,
): Actor[] {
  const items = world.actors.items;
  const found = world.hash.queryCircle(x, y, range, world.scratch);
  const out: { a: Actor; d2: number }[] = [];
  for (let i = 0; i < found; i++) {
    const a = items[world.scratch[i]];
    if (!a.alive || a.hp <= 0 || a.team !== "enemy") continue;
    out.push({ a, d2: (a.x - x) ** 2 + (a.y - y) ** 2 });
  }
  out.sort((p, q) => p.d2 - q.d2 || p.a.id - q.a.id);
  return out.slice(0, n).map((e) => e.a);
}

/** Distance between two bodies' edges (negative when they overlap). */
export function playerGap(actor: Actor, player: Actor): number {
  return Math.hypot(player.x - actor.x, player.y - actor.y) - actor.radius - player.radius;
}
