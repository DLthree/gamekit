import type { Vec } from "@/core/vec";

export type AimMode = "absolute" | "relative";

/** A skill-button press: the finger's offset from the button centre (CSS px, +y down). */
export interface SkillDrag {
  dx: number;
  dy: number;
  /** True once the finger has been outside the button during this press. */
  leftButton: boolean;
}

export type SkillRelease =
  | { kind: "cast"; aimX: number; aimY: number }
  | { kind: "quick" }
  | { kind: "cancel" };

function inside(drag: SkillDrag, r: number): boolean {
  return Math.hypot(drag.dx, drag.dy) <= r;
}

export function moveDrag(drag: SkillDrag, dx: number, dy: number, r: number): SkillDrag {
  const next = { dx, dy, leftButton: drag.leftButton };
  if (!inside(next, r)) next.leftButton = true;
  return next;
}

/** Releasing now would cancel: dragged out, then back onto the button. */
export function isCancelArmed(drag: SkillDrag, r: number): boolean {
  return drag.leftButton && inside(drag, r);
}

/** The finger is out aiming (the aim indicator shows). */
export function isAiming(drag: SkillDrag, r: number): boolean {
  return !inside(drag, r);
}

/** Aim in screen axes: from the player (absolute) or the button centre (relative) to the finger. */
export function aimVector(mode: AimMode, finger: Vec, buttonCenter: Vec, player: Vec): Vec {
  const o = mode === "absolute" ? player : buttonCenter;
  return { x: finger.x - o.x, y: finger.y - o.y };
}

export function resolveRelease(drag: SkillDrag, r: number, aim: Vec): SkillRelease {
  if (!drag.leftButton) return { kind: "quick" };
  if (isCancelArmed(drag, r)) return { kind: "cancel" };
  return { kind: "cast", aimX: aim.x, aimY: aim.y };
}
