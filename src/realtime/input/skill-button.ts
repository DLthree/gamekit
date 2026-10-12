import { clampLength, type Vec } from "@/core/vec";
import {
  type AimMode,
  aimVector,
  isAiming,
  isCancelArmed,
  moveDrag,
  resolveRelease,
  type SkillDrag,
  type SkillRelease,
} from "@/realtime/input/gesture";

/** One skill-button pointer event as the gesture logic saw it (telemetry `gesture` records). */
export interface SkillTrace {
  phase: "down" | "move" | "up" | "cancel";
  mode: AimMode;
  x: number;
  y: number;
  cx: number;
  cy: number;
  px: number;
  py: number;
  aimX: number;
  aimY: number;
  result?: SkillRelease["kind"];
}

export interface SkillButtonOptions {
  mode: AimMode;
  /** The player's on-screen position in CSS px (absolute aim's origin). */
  playerCss: () => Vec;
  onTrace: (t: SkillTrace) => void;
}

const TRACE_MOVE_MS = 50;

/**
 * Attempt to capture a pointer so this element keeps receiving its events even if the
 * finger drifts over other elements. A synthetic or already-released pointer id throws
 * NotFoundError/InvalidStateError; that's fine, input just falls back to bubbling — any
 * other error is a real bug and rethrows.
 */
function tryCapture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "NotFoundError" || err.name === "InvalidStateError")
    )
      return;
    throw err;
  }
}

/** Press, drag out to aim, release to cast; drag back on to cancel; tap to quick-cast. */
export class SkillButton {
  private pointerId = -1;
  private center: Vec = { x: 0, y: 0 };
  private finger: Vec = { x: 0, y: 0 };
  private radius = 1;
  private drag: SkillDrag = { dx: 0, dy: 0, leftButton: false };
  private released: SkillRelease | null = null;
  private lastCooldown = "";
  private lastMoveTrace = 0;
  private readonly el: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly opts: SkillButtonOptions;
  private readonly onDown = (e: PointerEvent) => {
    if (this.pressed || (e.pointerType === "mouse" && e.button !== 0)) return;
    const rect = this.el.getBoundingClientRect();
    this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.radius = rect.width / 2;
    this.pointerId = e.pointerId;
    tryCapture(this.el, e.pointerId);
    this.drag = { dx: 0, dy: 0, leftButton: false };
    this.track(e);
    this.trace("down");
  };
  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.track(e);
    const now = performance.now();
    if (now - this.lastMoveTrace >= TRACE_MOVE_MS) {
      this.lastMoveTrace = now;
      this.trace("move");
    }
  };
  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const cancelled = e.type === "pointercancel";
    this.track(e);
    this.released = cancelled
      ? { kind: "cancel" }
      : resolveRelease(this.drag, this.radius, this.aim());
    this.trace(cancelled ? "cancel" : "up", this.released.kind);
    this.pointerId = -1;
    this.render();
  };

  constructor(el: HTMLElement, knob: HTMLElement, opts: SkillButtonOptions) {
    this.el = el;
    this.knob = knob;
    this.opts = opts;
    el.classList.toggle("relative", opts.mode === "relative");
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  get pressed(): boolean {
    return this.pointerId !== -1;
  }

  get aiming(): boolean {
    return this.pressed && isAiming(this.drag, this.radius);
  }

  get cancelArmed(): boolean {
    return this.pressed && isCancelArmed(this.drag, this.radius);
  }

  /** The current aim (recomputed as the player moves under a held finger). */
  aim(): Vec {
    return aimVector(this.opts.mode, this.finger, this.center, this.opts.playerCss());
  }

  /** The gesture that finished since the last call, once. */
  takeRelease(): SkillRelease | null {
    const r = this.released;
    this.released = null;
    return r;
  }

  /** Cooldown sweep: `fraction` 1 right after a cast, 0 when ready. Touches the DOM on change only. */
  setCooldown(fraction: number, secondsLeft: number): void {
    const text = secondsLeft > 0 ? secondsLeft.toFixed(1) : "";
    const key = `${text}|${Math.round(fraction * 20)}`;
    if (key === this.lastCooldown) return;
    this.lastCooldown = key;
    this.el.style.setProperty("--cd", String(Math.round(fraction * 20) / 20));
    this.el.dataset.cooldown = text;
    this.el.classList.toggle("cooling", text !== "");
  }

  release(): void {
    this.el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    this.pointerId = -1;
    this.drag = { dx: 0, dy: 0, leftButton: false };
    this.render();
  }

  private track(e: PointerEvent): void {
    this.finger = { x: e.clientX, y: e.clientY };
    this.drag = moveDrag(
      this.drag,
      e.clientX - this.center.x,
      e.clientY - this.center.y,
      this.radius,
    );
    this.render();
  }

  private trace(phase: SkillTrace["phase"], result?: SkillRelease["kind"]): void {
    const p = this.opts.playerCss();
    const a = this.aim();
    const t: SkillTrace = {
      phase,
      mode: this.opts.mode,
      x: this.finger.x,
      y: this.finger.y,
      cx: this.center.x,
      cy: this.center.y,
      px: p.x,
      py: p.y,
      aimX: a.x,
      aimY: a.y,
    };
    if (result !== undefined) t.result = result;
    this.opts.onTrace(t);
  }

  private render(): void {
    this.el.classList.toggle("pressed", this.pressed);
    this.el.classList.toggle("aiming", this.aiming);
    this.el.classList.toggle("cancel", this.cancelArmed);
    if (this.opts.mode !== "relative") return;
    const k = this.pressed ? clampLength(this.drag.dx, this.drag.dy, this.radius) : { x: 0, y: 0 };
    this.knob.style.transform = `translate(${k.x}px, ${k.y}px)`;
  }
}
