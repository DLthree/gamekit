import type { Vec } from "@/core/vec";

/** Desktop mouse: its position (the aim) and left clicks on the play area (casts). */
export class Mouse {
  position: Vec | null = null;
  private clicked = false;
  private readonly zone: HTMLElement;
  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") this.position = { x: e.clientX, y: e.clientY };
  };
  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    this.position = { x: e.clientX, y: e.clientY };
    this.clicked = true;
  };

  constructor(zone: HTMLElement) {
    this.zone = zone;
    window.addEventListener("pointermove", this.onMove);
    zone.addEventListener("pointerdown", this.onDown);
  }

  takeClick(): boolean {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  release(): void {
    window.removeEventListener("pointermove", this.onMove);
    this.zone.removeEventListener("pointerdown", this.onDown);
  }
}
