/** A 2D vector; world and screen share axes (+x right, +y down). */
export interface Vec {
  x: number;
  y: number;
}

/** Unit vector along (x, y). A zero vector has no direction, so the caller names one. */
export function unit(x: number, y: number, fallback: Vec): Vec {
  const d = Math.hypot(x, y);
  return d === 0 ? { x: fallback.x, y: fallback.y } : { x: x / d, y: y / d };
}

/** (x, y) shortened to at most `max` long. */
export function clampLength(x: number, y: number, max: number): Vec {
  const d = Math.hypot(x, y);
  return d <= max ? { x, y } : { x: (x / d) * max, y: (y / d) * max };
}

/** (x, y) rotated by `rad`; with +y down, a positive angle turns clockwise on screen. */
export function rotate(x: number, y: number, rad: number): Vec {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: x * c - y * s, y: x * s + y * c };
}
