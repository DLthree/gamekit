import { unit } from "@/core/vec";
import type { Actor } from "@/sim/actors/store";

/** Walk straight at the target. On top of it, stand still. */
export function chase(actor: Actor, target: Actor): void {
  const d = unit(target.x - actor.x, target.y - actor.y, { x: 0, y: 0 });
  actor.moveX = d.x;
  actor.moveY = d.y;
}

/**
 * Holds around `distance` from the target: approaches past `distance × 1.1`, backs off inside
 * `distance × 0.9`, and stands still in the 10% dead band between so it doesn't jitter.
 */
export function keepDistance(actor: Actor, target: Actor, distance: number): void {
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  const gap = Math.hypot(dx, dy);
  if (gap > distance * 1.1) {
    const d = unit(dx, dy, { x: 0, y: 0 });
    actor.moveX = d.x;
    actor.moveY = d.y;
  } else if (gap < distance * 0.9) {
    const d = unit(-dx, -dy, { x: 0, y: 0 });
    actor.moveX = d.x;
    actor.moveY = d.y;
  } else {
    actor.moveX = 0;
    actor.moveY = 0;
  }
}
