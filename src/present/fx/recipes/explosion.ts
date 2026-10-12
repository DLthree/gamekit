import type { ExplosionVfx } from "@/content/schema/look-fx";
import { type Emitter, emit, jitter } from "@/present/fx/emit";

const TAU = Math.PI * 2;

/**
 * A burst marked in ink (spike 3's verdict): a black shock ring sized from the burst radius, an
 * optional faint scorch, and delayed smoke. Returns the shake to start, if any.
 */
export function explosion(
  em: Emitter,
  vfx: ExplosionVfx,
  x: number,
  y: number,
  r: number,
  t: number,
  build: string | null,
): string | null {
  emit(em, vfx.ring.kind, t, x, y, 2 * r * vfx.ring.scale, { rot: jitter(em, 0, TAU), build });
  if (vfx.scorch !== null) {
    emit(em, vfx.scorch.kind, t, x, y, 2 * r * vfx.scorch.scale, {
      rot: jitter(em, 0, TAU),
      build,
    });
  }
  const s = vfx.smoke;
  for (let k = 0; k < s.count; k++) {
    emit(em, s.kind, t + s.delayS + k * s.everyS, x + jitter(em, -0.4, 0.4) * r, y - 6, s.size, {
      vx: jitter(em, -14, 14),
      rot: jitter(em, 0, TAU),
      spin: jitter(em, -0.8, 0.8),
      build,
    });
  }
  return vfx.shake;
}
