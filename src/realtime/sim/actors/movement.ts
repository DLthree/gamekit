import { clampLength } from "@/core/vec";
import type { MovementRules } from "@/realtime/content/schema/rules";
import { TICK_S } from "@/realtime/core/clock";
import type { Actor } from "@/realtime/sim/actors/store";
import type { Command } from "@/realtime/sim/command";
import { playerOf, type World } from "@/realtime/sim/world";

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Phase 1: the player's move intent and this tick's cast request. */
export function applyCommand(world: World, command: Command): void {
  const p = playerOf(world);
  const m = clampLength(command.moveX, command.moveY, 1);
  p.moveX = m.x;
  p.moveY = m.y;
  world.cast = command.cast;
}

/** Pushes an enemy away from neighbours (the player included) closer than the separation radius. */
function separate(world: World, a: Actor, rules: MovementRules): void {
  const r = rules.separationRadius;
  const n = world.hash.queryCircle(a.x, a.y, r, world.scratch);
  for (let k = 0; k < n; k++) {
    const b = world.actors.items[world.scratch[k]];
    if (b === a || !b.alive || b.hp <= 0) continue;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    // Exactly on top of each other: split by slot order so the pair moves apart, never NaN.
    const ux = d === 0 ? (a.slot < b.slot ? 1 : -1) : dx / d;
    const uy = d === 0 ? 0 : dy / d;
    const push = ((r - d) / r) * rules.separationStrength * TICK_S;
    a.x += ux * push;
    a.y += uy * push;
  }
}

/**
 * Phase 4 (actors): intent (none while held or dashing) + knockback, damping, separation (skipped
 * while dashing), arena clamp, facing.
 */
export function moveActors(world: World): void {
  const { movement, arena } = world.content.rules;
  const damp = Math.exp(-movement.knockbackDamping * TICK_S);
  for (const a of world.actors.items) {
    if (!a.alive || a.hp <= 0) continue;
    const dashing = a.dashTicks > 0;
    let faceX: number;
    if (dashing) {
      a.x += (a.dashVX + a.vx) * TICK_S;
      a.y += (a.dashVY + a.vy) * TICK_S;
      a.dashTicks -= 1;
      faceX = a.dashVX;
    } else {
      // While held (charge warning), zero the move intent too, not just the speed, so the
      // view's gait (driven by moveX/moveY) stops rather than walking in place.
      if (world.tick < a.holdUntilTick) {
        a.moveX = 0;
        a.moveY = 0;
      }
      const walkX = a.moveX * a.moveSpeed;
      a.x += (walkX + a.vx) * TICK_S;
      a.y += (a.moveY * a.moveSpeed + a.vy) * TICK_S;
      faceX = walkX;
    }
    a.vx *= damp;
    a.vy *= damp;
    if (a.team === "enemy" && !dashing) separate(world, a, movement);
    a.x = clamp(a.x, -arena.halfWidth + a.radius, arena.halfWidth - a.radius);
    a.y = clamp(a.y, -arena.halfHeight + a.radius, arena.halfHeight - a.radius);
    if (Math.abs(faceX) > movement.facingDeadZone) a.facing = faceX > 0 ? 1 : -1;
  }
}

/** Phase 5: rebuild the hash of living actors (by slot) for this tick's queries and the next think. */
export function indexActors(world: World): void {
  const h = world.hash;
  h.reset();
  for (const a of world.actors.items) {
    if (a.alive && a.hp > 0) h.insert(a.slot, a.x, a.y);
  }
  h.build();
}
