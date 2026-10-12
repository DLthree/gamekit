import type { Vec } from "@/core/vec";

/** Thumb offset (CSS px) → move vector: zero in the dead zone, ramping to length 1 at the radius. */
export function stickVector(dx: number, dy: number, radius: number, deadZone: number): Vec {
  const d = Math.hypot(dx, dy);
  if (d <= deadZone) return { x: 0, y: 0 };
  const m = Math.min(1, (d - deadZone) / (radius - deadZone));
  return { x: (dx / d) * m, y: (dy / d) * m };
}

/** A thumb past the radius drags the centre behind it, so reversing responds at once. */
export function followCenter(center: Vec, thumb: Vec, radius: number): Vec {
  const dx = thumb.x - center.x;
  const dy = thumb.y - center.y;
  const d = Math.hypot(dx, dy);
  if (d <= radius) return center;
  const excess = (d - radius) / d;
  return { x: center.x + dx * excess, y: center.y + dy * excess };
}

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

/** Floating stick: a touch on the left half drops its centre under the thumb. One pointer id. */
export class TouchStick {
  private pointerId = -1;
  private center: Vec = { x: 0, y: 0 };
  private thumb: Vec = { x: 0, y: 0 };
  private readonly zone: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly radius: number;
  private readonly deadZone: number;
  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || this.active || e.clientX > window.innerWidth / 2) return;
    this.pointerId = e.pointerId;
    tryCapture(this.zone, e.pointerId);
    this.center = { x: e.clientX, y: e.clientY };
    this.thumb = this.center;
    document.body.classList.add("stick-active");
    this.render();
  };
  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.thumb = { x: e.clientX, y: e.clientY };
    this.center = followCenter(this.center, this.thumb, this.radius);
    this.render();
  };
  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    document.body.classList.remove("stick-active");
  };

  constructor(
    zone: HTMLElement,
    base: HTMLElement,
    knob: HTMLElement,
    radius: number,
    deadZone: number,
  ) {
    this.zone = zone;
    this.base = base;
    this.knob = knob;
    this.radius = radius;
    this.deadZone = deadZone;
    base.style.width = `${radius * 2}px`;
    base.style.height = `${radius * 2}px`;
    zone.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  get active(): boolean {
    return this.pointerId !== -1;
  }

  vector(): Vec {
    if (!this.active) return { x: 0, y: 0 };
    return stickVector(
      this.thumb.x - this.center.x,
      this.thumb.y - this.center.y,
      this.radius,
      this.deadZone,
    );
  }

  release(): void {
    this.zone.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    document.body.classList.remove("stick-active");
  }

  private render(): void {
    const { x, y } = this.center;
    this.base.style.transform = `translate(${x - this.radius}px, ${y - this.radius}px)`;
    this.knob.style.transform = `translate(${this.thumb.x - x}px, ${this.thumb.y - y}px)`;
  }
}
