import type { FxKind } from "@/content/schema/look-fx";
import type { FxInstance } from "@/present/fx/pool";

/** How one effect instance draws at a moment. */
export interface FxDraw {
  visible: boolean;
  x: number;
  y: number;
  /** Size in world units per axis (flicker stretches y). */
  w: number;
  h: number;
  rot: number;
  alpha: number;
  variant: number;
}

export function newFxDraw(): FxDraw {
  return { visible: false, x: 0, y: 0, w: 0, h: 0, rot: 0, alpha: 0, variant: 0 };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
const TAU = Math.PI * 2;

/** Distance a unit-speed start covers under exponential drag after `age` seconds. */
function dragged(age: number, drag: number): number {
  return drag > 0 ? (1 - Math.exp(-drag * age)) / drag : age;
}

/** The effect timeline at sim time t. */
export function fxDraw(inst: FxInstance, k: FxKind, t: number, out: FxDraw): FxDraw {
  const age = t - inst.at;
  if (age < 0 || age >= inst.life) {
    out.visible = false;
    return out;
  }
  const u = age / inst.life;
  const grow = easeOutCubic(clamp01(k.growS > 0 ? age / k.growS : 1));
  const s = inst.size * (k.scaleFrom + (k.scaleTo - k.scaleFrom) * grow);
  const fadeIn = k.popS > 0 ? clamp01(age / k.popS) : 1;
  const fadeOut = u <= k.fadeFrom ? 1 : 1 - (u - k.fadeFrom) / (1 - k.fadeFrom);
  const wob = k.flicker > 0 ? k.flicker * Math.sin(age * k.flickerHz * TAU + inst.seed * 6.28) : 0;
  let rot = inst.rot + inst.spin * age;
  let breathe = 0;
  let variant = inst.variant;
  const sw = k.sway;
  if (sw !== null) {
    // Each instance sways at its own rate and phase, so a burning patch never moves in lockstep.
    const rate = 0.8 + 0.4 * ((inst.seed * 7.31) % 1);
    const phase = inst.seed * TAU;
    rot += sw.amount * Math.sin(age * sw.hz * rate * TAU + phase);
    breathe = sw.breathe * Math.sin(age * sw.breatheHz * rate * TAU + phase * 1.7);
    if (sw.swapS > 0) variant += Math.floor(age / sw.swapS + inst.seed);
  }
  const d = dragged(age, k.drag);
  out.visible = true;
  out.x = inst.x + inst.vx * d;
  out.y = inst.y + inst.vy * d - k.rise * age;
  out.w = s * (1 - wob * 0.4) * (1 - breathe * 0.3);
  out.h = s * (1 + wob) * (1 + breathe);
  out.rot = rot;
  out.alpha = k.alpha * inst.alpha * fadeIn * fadeOut;
  out.variant = variant;
  return out;
}
