import { type Emitter, emit, jitter } from "@/present/fx/emit";

const TAU = Math.PI * 2;

/** Black ink splatter at the body's middle (`bodyH` above the feet). */
export function hitInk(em: Emitter, x: number, y: number, bodyH: number, t: number): void {
  const h = em.look.fx.hit;
  emit(em, h.kind, t, x + jitter(em, -4, 4), y - bodyH * 0.5, h.size * jitter(em, 0.8, 1.2), {
    rot: jitter(em, 0, TAU),
  });
}

/** Death: an ink splatter and an ink puff. */
export function deathInk(em: Emitter, x: number, y: number, bodyH: number, t: number): void {
  const d = em.look.fx.death;
  emit(em, d.splatter, t, x, y - bodyH * 0.35, d.splatterSize, { rot: jitter(em, 0, TAU) });
  emit(em, d.puff, t + 0.03, x, y - bodyH * 0.45, d.puffSize, {
    rot: jitter(em, 0, TAU),
    spin: jitter(em, -1, 1),
  });
}

/**
 * An elite or boss death: `count` gold flakes (look/feedback.json goldFlakes) scattered over the
 * body's height, each popping upward and outward, then drifting down as their kind falls.
 */
export function goldFlakes(
  em: Emitter,
  x: number,
  y: number,
  bodyH: number,
  t: number,
  count: number,
): void {
  const g = em.look.feedback.goldFlakes;
  for (let i = 0; i < count; i++) {
    const a = jitter(em, -Math.PI * 0.85, -Math.PI * 0.15);
    const v = g.pop * jitter(em, 0.4, 1);
    emit(
      em,
      g.kind,
      t,
      x + jitter(em, -0.3, 0.3) * bodyH,
      y - jitter(em, 0, 1) * bodyH,
      g.size * jitter(em, 0.7, 1.3),
      {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: jitter(em, 0, TAU),
        spin: jitter(em, -4, 4),
      },
    );
  }
}
