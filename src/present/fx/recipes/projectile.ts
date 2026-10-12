import type { ProjectileVfx } from "@/content/schema/look-fx";
import { type Emitter, emit, jitter } from "@/present/fx/emit";

const TAU = Math.PI * 2;

/** One trail puff behind a projectile flying along (dirX, dirY) at `speed`. */
export function trailStep(
  em: Emitter,
  vfx: ProjectileVfx,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  speed: number,
  t: number,
  build: string | null,
): void {
  const tr = vfx.trail;
  emit(em, tr.kind, t, x, y, tr.size * jitter(em, 0.8, 1.2), {
    vx: -dirX * speed * tr.drift + jitter(em, -tr.jitter, tr.jitter),
    vy: -dirY * speed * tr.drift + jitter(em, -tr.jitter, tr.jitter),
    rot: jitter(em, 0, TAU),
    spin: jitter(em, -2, 2),
    build,
  });
  if (tr.flame !== null) {
    // The flame texture's top points back along the flight, like the head.
    emit(em, tr.flame.kind, t, x, y, tr.size * tr.flame.scale, {
      rot: Math.atan2(-dirY, -dirX) + Math.PI / 2 + jitter(em, -0.3, 0.3),
      life: tr.flame.lifeS,
      build,
    });
  }
}

export interface HeadDraw {
  texture: string;
  frame: number;
  x: number;
  y: number;
  size: number;
  rot: number;
  /** Multiply tint (0xRRGGBB), resolved from the head's content tint when the projectile starts. */
  tint: number;
}

export function newHeadDraw(): HeadDraw {
  return { texture: "", frame: 0, x: 0, y: 0, size: 0, rot: 0, tint: 0xffffff };
}

/** The projectile's body: the texture's top (−y) trails behind the motion; it spins and pulses. */
export function headDraw(
  vfx: ProjectileVfx,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  age: number,
  out: HeadDraw,
): HeadDraw {
  const h = vfx.head;
  out.texture = h.texture;
  out.frame = h.frame;
  out.x = x;
  out.y = y;
  out.size = h.size * (1 + h.pulse * Math.sin(age * h.pulseHz * TAU));
  out.rot = Math.atan2(-dirY, -dirX) + Math.PI / 2 + age * h.spinHz * TAU;
  return out;
}
