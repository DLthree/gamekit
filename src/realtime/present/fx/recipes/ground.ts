import type { GroundVfx } from "@/realtime/content/schema/look-fx";
import { type Emitter, emit, jitter } from "@/realtime/present/fx/emit";

const TAU = Math.PI * 2;
const at = { x: 0, y: 0 };

/** A point at fraction u of the radius in a random direction, squashed in y by the slant. */
function spot(em: Emitter, vfx: GroundVfx, x: number, y: number, r: number, u: number) {
  const a = jitter(em, 0, TAU);
  at.x = x + Math.cos(a) * r * u;
  at.y = y + Math.sin(a) * r * u * vfx.flat;
  return at;
}

/**
 * A burning patch of radius r at (x, y) lasting lifeS from sim time t (recipe
 * `burningGround`): scorch stains, grass strips and flames that catch as the spread reaches them,
 * embers rising over its life. Swaying and frame swaps come from the kinds (FxKind.sway).
 */
export function groundFire(
  em: Emitter,
  vfx: GroundVfx,
  x: number,
  y: number,
  r: number,
  lifeS: number,
  t: number,
  build: string | null,
): void {
  const st = vfx.stains;
  for (let k = 0; k < st.count; k++) {
    const p = spot(em, vfx, x, y, r, 0.5 * Math.sqrt(jitter(em, 0, 1)));
    emit(em, st.kind, t + k * 0.15, p.x, p.y, r * jitter(em, st.size[0], st.size[1]), {
      rot: jitter(em, 0, TAU),
      life: lifeS - k * 0.15,
      alpha: st.alpha,
      build,
    });
  }
  const piece = (kind: string, size: number) => {
    const u = Math.sqrt(jitter(em, 0, 1)) * 0.9;
    const delay = u * vfx.spreadS;
    const p = spot(em, vfx, x, y, r, u);
    emit(em, kind, t + delay, p.x, p.y, size, {
      rot: jitter(em, -0.08, 0.08),
      life: (lifeS - delay) * jitter(em, 0.75, 1),
      build,
    });
  };
  for (let k = 0; k < vfx.grass.count; k++)
    piece(vfx.grass.kind, jitter(em, vfx.grass.size[0], vfx.grass.size[1]));
  for (let k = 0; k < vfx.flames.count; k++)
    piece(vfx.flames.kind, jitter(em, vfx.flames.size[0], vfx.flames.size[1]));
  const e = vfx.embers;
  const emberLife = em.look.fx.kinds[e.kind].life;
  for (let k = 0; k < e.count; k++) {
    const start = t + jitter(em, 0.2, Math.max(0.3, lifeS - emberLife));
    const p = spot(em, vfx, x, y, r, Math.sqrt(jitter(em, 0, 1)) * 0.9);
    emit(em, e.kind, start, p.x, p.y - 10, e.size * jitter(em, 0.7, 1.3), {
      vx: jitter(em, -12, 12),
      rot: jitter(em, 0, TAU),
      spin: jitter(em, -2, 2),
      build,
    });
  }
}
