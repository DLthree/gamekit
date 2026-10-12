/**
 * Layer 3: rigid props posed by code. A pose is the prop's angle from upright
 * (positive tips its head forward) and its grip's offset from the hand, in the owner's frame
 * (facing right, +x forward, +y down). Attacks read through these poses, never body frames.
 */
export interface PropPose {
  angle: number;
  dx: number;
  dy: number;
}

export function newPropPose(): PropPose {
  return { angle: 0, dx: 0, dy: 0 };
}

const DEG = Math.PI / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 2;
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function set(out: PropPose, angleDeg: number, dx: number, dy: number): PropPose {
  out.angle = angleDeg * DEG;
  out.dx = dx;
  out.dy = dy;
  return out;
}

/** Held at rest with a slow sway of up to 3°, so a standing prop isn't glued on. */
export function propRest(restDeg: number, t: number, out: PropPose): PropPose {
  return set(out, restDeg + Math.sin(t * 1.3) * 3, 0, 0);
}

/**
 * The staff thrust over u = 0..1: draw back and tilt away, jab forward to near-horizontal (gem
 * leading) by u = 0.5, hold, then return to rest. `h` is the owner's height in world units.
 */
export function staffThrust(u: number, restDeg: number, h: number, out: PropPose): PropPose {
  const back = { a: restDeg - 25, dx: -0.1 * h, dy: 0.02 * h };
  const jab = { a: 72, dx: 0.28 * h, dy: -0.06 * h };
  if (u < 0.35) {
    const k = easeOut(u / 0.35);
    return set(out, lerp(restDeg, back.a, k), back.dx * k, back.dy * k);
  }
  if (u < 0.5) {
    const k = easeIn((u - 0.35) / 0.15);
    return set(out, lerp(back.a, jab.a, k), lerp(back.dx, jab.dx, k), lerp(back.dy, jab.dy, k));
  }
  if (u < 0.7) return set(out, jab.a, jab.dx, jab.dy);
  const k = easeInOut(clamp01((u - 0.7) / 0.3));
  return set(out, lerp(jab.a, restDeg, k), lerp(jab.dx, 0, k), lerp(jab.dy, 0, k));
}

/** The transform the renderer gives a body: position, scale (facing in x) and rotation. */
export interface BodyTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rot: number;
}

/** A point in the body's local frame (feet pivot at the origin) → world, as Phaser places it. */
export function bodyToWorld(
  body: BodyTransform,
  lx: number,
  ly: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const px = lx * body.scaleX;
  const py = ly * body.scaleY;
  const c = Math.cos(body.rot);
  const s = Math.sin(body.rot);
  out.x = body.x + px * c - py * s;
  out.y = body.y + px * s + py * c;
  return out;
}
