import { unit, type Vec } from "@/core/vec";

/** The push (units/s) a hit from (fromX, fromY) gives a body at (toX, toY). */
export function knockbackImpulse(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fallback: Vec,
  strength: number,
  resist: number,
): Vec {
  const d = unit(toX - fromX, toY - fromY, fallback);
  const s = strength * (1 - resist);
  return { x: d.x * s, y: d.y * s };
}
