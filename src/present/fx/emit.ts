import type { Content, LookContent } from "@/content/types";
import { nextFloat, nextRange, type Rng } from "@/core/rng";
import type { FxPool } from "@/present/fx/pool";

/** What recipes need: the pool, presentation's own seeded generator, and the current look. */
export interface Emitter {
  pool: FxPool;
  rng: Rng;
  look: LookContent;
}

export interface EmitOptions {
  vx?: number;
  vy?: number;
  rot?: number;
  spin?: number;
  life?: number;
  alpha?: number;
  /** The owner's build colour (palette name), for kinds tinted "build". */
  build?: string | null;
}

export function hex(css: string): number {
  return Number.parseInt(css.slice(1), 16);
}

/** A character's build colour; enemies have none (colour belongs to the player's build). */
export function buildColorOf(content: Content, def: string): string | null {
  const c = content.look.characters.characters[def];
  return c === undefined ? null : c.buildColor;
}

/** A content tint ("build" or a palette name) as a colour; `what` names it in the error. */
export function resolveTint(
  look: LookContent,
  tint: string,
  build: string | null,
  what: string,
): number {
  if (tint !== "build") return hex(look.palette.colors[tint]);
  if (build === null) throw new Error(`${what} is tinted by build colour, but its owner has none`);
  return hex(look.palette.colors[build]);
}

export function tintFor(look: LookContent, kind: string, build: string | null): number {
  const k = look.fx.kinds[kind];
  if (k === undefined) throw new Error(`no fx kind ${kind} in look/fx.json`);
  return resolveTint(look, k.tint, build, `fx kind ${kind}`);
}

/** A uniform number in [min, max) from presentation's generator. */
export function jitter(em: Emitter, min: number, max: number): number {
  return nextRange(em.rng, min, max);
}

export function emit(
  em: Emitter,
  kind: string,
  at: number,
  x: number,
  y: number,
  size: number,
  o: EmitOptions = {},
): void {
  const k = em.look.fx.kinds[kind];
  if (k === undefined) throw new Error(`no fx kind ${kind} in look/fx.json`);
  em.pool.spawn({
    kind,
    x,
    y,
    vx: o.vx ?? 0,
    vy: o.vy ?? 0,
    at,
    life: o.life ?? k.life,
    size,
    rot: o.rot ?? 0,
    spin: o.spin ?? 0,
    variant: Math.floor(nextFloat(em.rng) * 64),
    tint: tintFor(em.look, kind, o.build ?? null),
    alpha: o.alpha ?? 1,
    seed: nextFloat(em.rng),
  });
}
