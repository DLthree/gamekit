import { nextFloat, type Rng } from "@/core/rng";
import type { Vec } from "@/core/vec";
import type { ArenaRules } from "@/realtime/content/schema/rules";

/**
 * (px + dx, py + dy), mirrored to the player's other side on whichever axis would leave the
 * arena: same distance from the player, and inside, because the content check keeps spawnRadius,
 * ring radii and field distances within the arena's smaller half extent.
 */
function mirrorInside(px: number, py: number, dx: number, dy: number, arena: ArenaRules): Vec {
  if (Math.abs(px + dx) > arena.halfWidth) dx = -dx;
  if (Math.abs(py + dy) > arena.halfHeight) dy = -dy;
  return { x: px + dx, y: py + dy };
}

/**
 * (x, y) mirrored back across whichever wall it crossed, as far inside as it was outside: the
 * same flip `mirrorInside` makes. A point more than a full arena width out can't be mirrored in;
 * nothing places one (scatter marks land within a few body widths of a point inside), so it throws.
 */
export function insideArena(x: number, y: number, arena: ArenaRules): Vec {
  const w = arena.halfWidth;
  const h = arena.halfHeight;
  const mx = x > w ? 2 * w - x : x < -w ? -2 * w - x : x;
  const my = y > h ? 2 * h - y : y < -h ? -2 * h - y : y;
  if (Math.abs(mx) > w || Math.abs(my) > h) {
    throw new Error(`insideArena: (${x}, ${y}) is too far outside the arena to mirror back in`);
  }
  return { x: mx, y: my };
}

/** A point `spawnRadius` from (px, py) at a random angle, kept inside the arena. */
export function edgePoint(rng: Rng, px: number, py: number, arena: ArenaRules): Vec {
  const a = nextFloat(rng) * Math.PI * 2;
  return mirrorInside(
    px,
    py,
    Math.cos(a) * arena.spawnRadius,
    Math.sin(a) * arena.spawnRadius,
    arena,
  );
}

function clampTo(v: number, half: number): number {
  return Math.max(-half, Math.min(half, v));
}

/**
 * Moves `p` directly away from `other` until it's exactly `diameter` out, clamped to stay inside
 * the arena; when the two coincide (mirroring collapsed them to the same spot), "away" falls back
 * to the wall's tangent (`flippedX`: the point was mirrored across a vertical wall, so the tangent
 * runs along y) rather than an undefined direction. Deterministic: everything it uses comes from
 * the two points and which wall, never the rng.
 */
function nudgeApart(
  p: Vec,
  other: Vec,
  flippedX: boolean,
  arena: ArenaRules,
  diameter: number,
): Vec {
  const dx = p.x - other.x;
  const dy = p.y - other.y;
  const d = Math.hypot(dx, dy);
  const [ux, uy] = d > 1e-9 ? [dx / d, dy / d] : flippedX ? [0, 1] : [1, 0];
  return {
    x: clampTo(other.x + ux * diameter, arena.halfWidth),
    y: clampTo(other.y + uy * diameter, arena.halfHeight),
  };
}

/**
 * `count` points `radius` from (px, py), evenly spaced starting at a random angle: a ring spawn
 * closes in on the player from every side at once. Each point is kept inside the arena the same
 * way `edgePoint` is. Near a corner, mirroring can bring two points closer than `diameter` (an
 * enemy's own width); every pass, the later point of any such pair is nudged the rest of the way
 * to `diameter` apart (`nudgeApart`, deterministic, no RNG), until none are left or the pass budget
 * runs out (bounded so a pathological input can't loop forever; feasible layouts settle in a few).
 */
export function ringPoints(
  rng: Rng,
  px: number,
  py: number,
  arena: ArenaRules,
  radius: number,
  count: number,
  diameter: number,
): Vec[] {
  const start = nextFloat(rng) * Math.PI * 2;
  const points: Vec[] = [];
  const flippedX: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const a = start + (Math.PI * 2 * i) / count;
    const dx = Math.cos(a) * radius;
    const dy = Math.sin(a) * radius;
    flippedX.push(Math.abs(px + dx) > arena.halfWidth);
    points.push(mirrorInside(px, py, dx, dy, arena));
  }
  for (let pass = 0; pass < count * count; pass++) {
    let collapsed = false;
    for (let i = 1; i < count; i++) {
      const collider = points
        .slice(0, i)
        .find((o) => Math.hypot(points[i].x - o.x, points[i].y - o.y) < diameter);
      if (collider === undefined) continue;
      collapsed = true;
      points[i] = nudgeApart(points[i], collider, flippedX[i], arena, diameter);
    }
    if (!collapsed) break;
  }
  return points;
}

/**
 * `count` points, each at a random angle and a random distance in [minDistance, maxDistance]
 * from (px, py): a field spawn scatters enemies around the player, none closer than minDistance.
 * Each point is kept inside the arena the same way `edgePoint` is.
 */
export function fieldPoints(
  rng: Rng,
  px: number,
  py: number,
  arena: ArenaRules,
  minDistance: number,
  maxDistance: number,
  count: number,
): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const a = nextFloat(rng) * Math.PI * 2;
    const d = minDistance + nextFloat(rng) * (maxDistance - minDistance);
    points.push(mirrorInside(px, py, Math.cos(a) * d, Math.sin(a) * d, arena));
  }
  return points;
}
