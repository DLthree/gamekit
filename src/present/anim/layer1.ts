import type { Feedback, Gait } from "@/content/schema/look";

/** Offset from the feet anchor (world units, creature frame facing right), scale and tilt. */
export interface Pose {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rot: number;
}

export function newPose(): Pose {
  return { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Gait and idle breathing. `t` is the creature's own animation clock (seconds), `walk` blends
 * idle (0) to full stride (1), `height` is the body height in world units.
 */
export function bodyPose(g: Gait, height: number, t: number, walk: number, out: Pose): Pose {
  out.dx = 0;
  out.dy = 0;
  out.rot = 0;
  const breath = Math.sin(TAU * g.breathHz * t) * g.breath;
  out.sy = 1 + breath * (1 - walk);
  out.sx = 1 - breath * 0.5 * (1 - walk);
  const w = g.kind === "flap" ? Math.max(walk, 0.6) : walk;
  if (w > 0) {
    const p = TAU * g.hz * t;
    const s = Math.sin(p);
    const c = Math.cos(p);
    switch (g.kind) {
      case "waddle": {
        const up = Math.abs(s);
        out.dy = -g.bob * height * up * w;
        const st = g.squash * (up - 0.5) * 2 * w;
        out.sy *= 1 + st;
        out.sx *= 1 - st * 0.5;
        out.rot = (g.rock * s + g.lean) * DEG * w;
        break;
      }
      case "hop": {
        const air = Math.abs(s);
        const lift = smoothstep(0, 0.3, air);
        out.dy = -g.bob * height * air * w;
        const st = g.squash * (0.9 * Math.abs(c) * lift - 0.8 * (1 - lift)) * w;
        out.sy *= 1 + st;
        out.sx *= 1 - st * 0.5;
        out.rot = (g.lean - g.rock * c * Math.sign(s)) * DEG * w;
        break;
      }
      case "slide": {
        const st = g.squash * s * w;
        out.sx *= 1 + st;
        out.sy *= 1 - st * 0.6;
        out.dx = st * height * 0.25;
        out.rot = g.rock * c * DEG * w;
        break;
      }
      case "flap": {
        out.sy *= 1 + g.squash * s * w;
        out.sx *= 1 - g.squash * 0.2 * s * w;
        out.dy = -g.bob * height * c * w;
        out.rot = g.rock * Math.sin(p * 0.25) * DEG * w;
        break;
      }
    }
  }
  out.dy -= g.hover;
  return out;
}

/** The spring's value `since` seconds after its event; 0 before it and after five decays. */
export function spring(since: number, s: Feedback["hitSpring"]): number {
  if (since < 0 || since > s.decayS * 5) return 0;
  return s.amount * Math.exp(-since / s.decayS) * Math.cos(since * s.hz * TAU);
}

/** Squash and stretch by a spring value: positive squashes wide, negative stretches tall. */
export function applySpring(k: number, out: Pose): Pose {
  out.sx *= 1 + k;
  out.sy *= 1 - k;
  return out;
}

/** A shove of distance × height along (dirX, dirY) in the creature frame, easing back. */
export function applyRecoil(
  since: number,
  height: number,
  r: Feedback["hitRecoil"],
  dirX: number,
  dirY: number,
  out: Pose,
): Pose {
  if (since < 0 || since > r.decayS * 5) return out;
  const d = r.distance * height * Math.exp(-since / r.decayS);
  out.dx += dirX * d;
  out.dy += dirY * d;
  return out;
}

/** An attack lunge: a short wind-up back, a fast strike forward that eases home. */
export function applyLunge(
  since: number,
  height: number,
  lunge: Feedback["lunge"],
  out: Pose,
): Pose {
  if (since < 0 || since > lunge.durationS) return out;
  const u = since / lunge.durationS;
  const wind = u < 0.3 ? -Math.sin((u / 0.3) * Math.PI) * 0.3 : 0;
  const strike = u >= 0.3 ? Math.sin(((u - 0.3) / 0.7) * Math.PI) : 0;
  const v = wind + strike;
  out.dx += lunge.reach * height * v;
  out.rot += lunge.leanDeg * DEG * v;
  out.sx *= 1 + 0.15 * v;
  out.sy *= 1 - 0.1 * v;
  return out;
}

export interface DeathLook {
  scale: number;
  alpha: number;
  spin: number;
  flash: boolean;
  visible: boolean;
}

export function newDeathLook(): DeathLook {
  return { scale: 1, alpha: 1, spin: 0, flash: false, visible: true };
}

/** The death pop: a quick flashing swell, then a shrinking spin to nothing. */
export function deathLook(since: number, death: Feedback["death"], out: DeathLook): DeathLook {
  const u = since / death.durationS;
  out.visible = u < 1;
  out.flash = u < 0.25;
  if (u < 0.2) {
    out.scale = 1 + death.pop * (u / 0.2);
    out.alpha = 1;
  } else {
    const d = (u - 0.2) / 0.8;
    out.scale = (1 + death.pop) * (1 - d) ** 2;
    out.alpha = 1 - smoothstep(0.4, 1, d);
  }
  out.spin = death.spinDeg * DEG * u;
  return out;
}

export function isFlashing(since: number, durationS: number): boolean {
  return since >= 0 && since < durationS;
}
