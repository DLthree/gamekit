import { nextRange, type Rng } from "@/core/rng";
import type { Vec } from "@/core/vec";
import type { ArenaRules } from "@/realtime/content/schema/rules";

/** The canvas: CSS size, the capped DPR, device-pixel size, and device pixels per world unit. */
export interface Viewport {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  width: number;
  height: number;
  zoom: number;
}

export function computeViewport(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  dprCap: number,
  shortSideSpan: number,
): Viewport {
  const dpr = Math.min(Math.max(devicePixelRatio, 1), dprCap);
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);
  return { cssWidth, cssHeight, dpr, width, height, zoom: Math.min(width, height) / shortSideSpan };
}

export interface CameraState {
  /** World point at the screen's centre (before shake). */
  x: number;
  y: number;
  shakeFrom: number;
  shakeUntil: number;
  shakeIntensity: number;
  /** The lead offset (world units) and the sim time it was last eased at. */
  leadX: number;
  leadY: number;
  leadT: number | null;
}

export function createCamera(): CameraState {
  return {
    x: 0,
    y: 0,
    shakeFrom: 0,
    shakeUntil: 0,
    shakeIntensity: 0,
    leadX: 0,
    leadY: 0,
    leadT: null,
  };
}

function clampAxis(v: number, half: number, arenaHalf: number): number {
  return half >= arenaHalf ? 0 : Math.min(arenaHalf - half, Math.max(-arenaHalf + half, v));
}

/** Centre on the player's focus point, never showing past the arena's edge. */
export function followCamera(
  cam: CameraState,
  view: Viewport,
  px: number,
  py: number,
  arena: ArenaRules,
  focusOffsetY: number,
): void {
  cam.x = clampAxis(px, view.width / 2 / view.zoom, arena.halfWidth);
  cam.y = clampAxis(py + focusOffsetY, view.height / 2 / view.zoom, arena.halfHeight);
}

/** World → CSS pixels (translation and uniform zoom only, so directions are preserved). */
export function worldToCss(cam: CameraState, view: Viewport, x: number, y: number): Vec {
  return {
    x: ((x - cam.x) * view.zoom + view.width / 2) / view.dpr,
    y: ((y - cam.y) * view.zoom + view.height / 2) / view.dpr,
  };
}

/**
 * Eases the lead toward lead world units along the move intent. Runs on sim time, so the frame
 * rate never changes where the camera sits; the first call only starts the clock.
 */
export function updateLead(
  cam: CameraState,
  t: number,
  moveX: number,
  moveY: number,
  lead: number,
  smoothS: number,
): void {
  const dt = cam.leadT === null ? 0 : Math.max(0, t - cam.leadT);
  cam.leadT = t;
  const k = 1 - Math.exp(-dt / smoothS);
  cam.leadX += (moveX * lead - cam.leadX) * k;
  cam.leadY += (moveY * lead - cam.leadY) * k;
}

/** Starts a shake unless a stronger one is still running. */
export function startShake(
  cam: CameraState,
  t: number,
  shake: { durationS: number; intensity: number },
): void {
  if (t < cam.shakeUntil && cam.shakeIntensity > shake.intensity) return;
  cam.shakeFrom = t;
  cam.shakeUntil = t + shake.durationS;
  cam.shakeIntensity = shake.intensity;
}

/** The shake's offset in world units at sim time t: random, fading to zero over its duration. */
export function shakeOffset(cam: CameraState, view: Viewport, t: number, rng: Rng): Vec {
  if (t >= cam.shakeUntil) return { x: 0, y: 0 };
  const left = (cam.shakeUntil - t) / (cam.shakeUntil - cam.shakeFrom);
  const amp = cam.shakeIntensity * (view.width / view.zoom) * left;
  return { x: nextRange(rng, -amp, amp), y: nextRange(rng, -amp, amp) };
}
