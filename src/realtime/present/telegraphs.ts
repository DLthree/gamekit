import type { LookContent } from "@/content/types";
import type { TelegraphVfx } from "@/realtime/content/schema/look-fx";
import { tickSeconds } from "@/realtime/core/clock";
import type { Id } from "@/realtime/core/ids";
import type { SimEvent } from "@/realtime/sim/events";

type VolumeStartedEvent = Extract<SimEvent, { t: "volumeStarted" }>;

/** One telegraph as drawn this frame. */
export interface TelegraphDraw {
  shape: "circle" | "lane";
  x: number;
  y: number;
  /** A circle's radius; a lane's half-width. */
  r: number;
  dirX: number;
  dirY: number;
  length: number;
  /** 0 → 1 across the warning. */
  progress: number;
  vfx: string;
  /** The lobbed stone this frame, or null. */
  lob: { x: number; y: number; size: number } | null;
}

interface Telegraph {
  shape: "circle" | "lane";
  x: number;
  y: number;
  r: number;
  dirX: number;
  dirY: number;
  length: number;
  vfx: string;
  ox: number;
  oy: number;
  start: number;
  warnS: number;
  /** Reused for this telegraph's stone every frame. */
  lob: { x: number; y: number; size: number };
}

/** Enemy warned bursts as the view sees them: from volumeStarted until their volumeEnded. */
export class Telegraphs {
  private readonly items = new Map<Id, Telegraph>();

  /** Tracks an enemy's warned burst from sim time t; anything else is not a telegraph. */
  start(e: VolumeStartedEvent, t: number): boolean {
    if (e.team !== "enemy" || e.warnTicks <= 0) return false;
    if (e.shape === "arc")
      throw new Error(`volume ${e.id}: a warned arc can't be drawn (${e.vfx})`);
    this.items.set(e.id, {
      shape: e.shape,
      x: e.x,
      y: e.y,
      r: e.r,
      dirX: e.dirX,
      dirY: e.dirY,
      length: e.length,
      vfx: e.vfx,
      ox: e.ox,
      oy: e.oy,
      start: t,
      warnS: tickSeconds(e.warnTicks),
      lob: { x: 0, y: 0, size: 0 },
    });
    return true;
  }

  /** On every volumeEnded, resolved or cancelled (other volumes are not tracked). */
  end(id: Id): void {
    this.items.delete(id);
  }

  /** Fills `out` (grown as needed) with each telegraph at sim time t; returns how many. */
  draws(t: number, look: LookContent, out: TelegraphDraw[]): number {
    let i = 0;
    for (const tg of this.items.values()) {
      if (out.length <= i) out.push(newDraw());
      const d = out[i++];
      const p = Math.min(1, Math.max(0, (t - tg.start) / tg.warnS));
      d.shape = tg.shape;
      d.x = tg.x;
      d.y = tg.y;
      d.r = tg.r;
      d.dirX = tg.dirX;
      d.dirY = tg.dirY;
      d.length = tg.length;
      d.progress = p;
      d.vfx = tg.vfx;
      const lob = telegraphVfx(look, tg.vfx).lob;
      if (lob === null) d.lob = null;
      else {
        // A parabola from the owner to the mark, `arc` world units high at its middle.
        tg.lob.x = tg.ox + (tg.x - tg.ox) * p;
        tg.lob.y = tg.oy + (tg.y - tg.oy) * p - lob.arc * 4 * p * (1 - p);
        tg.lob.size = lob.size;
        d.lob = tg.lob;
      }
    }
    return i;
  }
}

function newDraw(): TelegraphDraw {
  return {
    shape: "circle",
    x: 0,
    y: 0,
    r: 0,
    dirX: 1,
    dirY: 0,
    length: 0,
    progress: 0,
    vfx: "",
    lob: null,
  };
}

/** The telegraph recipe a vfx key names; anything else is a content bug the check should catch. */
export function telegraphVfx(look: LookContent, key: string): TelegraphVfx {
  const v = look.fx.vfx[key];
  if (v === undefined || v.recipe !== "telegraph")
    throw new Error(`vfx ${key} is not a telegraph recipe in look/fx.json`);
  return v;
}

/**
 * The hatch segments to stroke for a telegraph this frame, in its local space (+x along a lane).
 * A growing circle is hatched at its grown radius, never scaled, so the line spacing holds and
 * the early warning stays hatched rather than a solid ink disc. A lane is hatched whole; the
 * view clips it at the front that grows from the start.
 */
export function hatchFor(d: TelegraphDraw, v: TelegraphVfx): Float32Array {
  const { spacing, angleDeg } = v.hatch;
  if (d.shape === "lane") return laneHatch(d.length, d.r, spacing, angleDeg);
  const grow = v.fill === "grow" ? d.progress : 1;
  return circleHatch(d.r * grow, spacing, angleDeg);
}

const CACHE_LIMIT = 400;
const hatchCache = new Map<string, Float32Array>();

function cached(key: string, make: () => number[]): Float32Array {
  let a = hatchCache.get(key);
  if (a === undefined) {
    if (hatchCache.size >= CACHE_LIMIT) hatchCache.clear();
    a = Float32Array.from(make());
    hatchCache.set(key, a);
  }
  return a;
}

/**
 * Parallel lines at angleDeg, `spacing` apart, through a region centred at (cx, 0) that fits
 * inside `reach` of it; `clip` returns the [s0, s1] span of the line c + d·n + s·u inside the
 * region, or null.
 */
function hatch(
  cx: number,
  reach: number,
  spacing: number,
  angleDeg: number,
  clip: (px: number, py: number, ux: number, uy: number) => [number, number] | null,
): number[] {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const out: number[] = [];
  const k = Math.floor(reach / spacing);
  for (let i = -k; i <= k; i++) {
    const px = cx - uy * i * spacing;
    const py = ux * i * spacing;
    const span = clip(px, py, ux, uy);
    if (span === null) continue;
    const [s0, s1] = span;
    out.push(px + ux * s0, py + uy * s0, px + ux * s1, py + uy * s1);
  }
  return out;
}

/** The [s0, s1] span of p + s·u (u unit) inside the disc at (qx, 0) of radius r, or null. */
function discSpan(px: number, py: number, ux: number, uy: number, qx: number, r: number) {
  const mx = px - qx;
  const b = mx * ux + py * uy;
  const disc = b * b - (mx * mx + py * py - r * r);
  if (disc <= 0) return null;
  const h = Math.sqrt(disc);
  return [-b - h, -b + h] as [number, number];
}

/** Hatch segments clipped to a circle of radius r centred at 0,0: pure, cached by rounded r. */
export function circleHatch(r: number, spacing: number, angleDeg: number): Float32Array {
  const rr = Math.round(r);
  return cached(`c${rr}|${spacing}|${angleDeg}`, () =>
    hatch(0, rr, spacing, angleDeg, (px, py, ux, uy) => discSpan(px, py, ux, uy, 0, rr)),
  );
}

/** The same, clipped to a lane (capsule) of length L and half-width w along +x from 0,0. */
export function laneHatch(
  length: number,
  w: number,
  spacing: number,
  angleDeg: number,
): Float32Array {
  const L = Math.round(length);
  const ww = Math.round(w);
  return cached(`l${L}|${ww}|${spacing}|${angleDeg}`, () =>
    hatch(L / 2, L / 2 + ww, spacing, angleDeg, (px, py, ux, uy) => {
      // The capsule is convex: its span is the union of the caps' and the rectangle's spans.
      const spans = [
        discSpan(px, py, ux, uy, 0, ww),
        discSpan(px, py, ux, uy, L, ww),
        rectSpan(px, py, ux, uy, L, ww),
      ].filter((s) => s !== null);
      if (spans.length === 0) return null;
      return [Math.min(...spans.map((s) => s[0])), Math.max(...spans.map((s) => s[1]))];
    }),
  );
}

/** The span of p + s·u inside [0, L] × [-w, w] (slab clipping), or null. */
function rectSpan(px: number, py: number, ux: number, uy: number, L: number, w: number) {
  let s0 = -Infinity;
  let s1 = Infinity;
  for (const [p, u, lo, hi] of [
    [px, ux, 0, L],
    [py, uy, -w, w],
  ]) {
    if (Math.abs(u) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    const a = (lo - p) / u;
    const b = (hi - p) / u;
    s0 = Math.max(s0, Math.min(a, b));
    s1 = Math.min(s1, Math.max(a, b));
  }
  return s1 > s0 ? ([s0, s1] as [number, number]) : null;
}
