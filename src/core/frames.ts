/** A stepped frame's length: tool mode runs the page at this rate, whatever the machine's speed. */
export const FRAME_HZ = 60;

export interface Frame {
  /** Frames run since the page booted; the first is 1. */
  index: number;
  /** Seconds since the previous frame: 0 on the first real-time frame, 1 / FRAME_HZ when stepped. */
  dtS: number;
  /** Page time in seconds: the display's clock in real time, index / FRAME_HZ when stepped. */
  nowS: number;
}

/**
 * The kit's frame clock: everything that moves on the page (the sim, rendering, animations)
 * runs in its frame callbacks. In real time the display drives it; stepped (`manual=1`, tool
 * mode), only `step` does, so a tool sees the same frames on every machine.
 */
export class FrameClock {
  readonly stepped: boolean;
  index = 0;
  private lastS: number | null = null;
  private readonly callbacks = new Set<(f: Frame) => void>();

  constructor(stepped: boolean) {
    this.stepped = stepped;
  }

  /** Runs `cb` on every frame, in subscription order; returns the unsubscribe. */
  onFrame(cb: (f: Frame) => void): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  /** Real time: the display's frame at `nowS` (a renderer's loop or `start`). Stepped: ignored. */
  display(nowS: number): void {
    if (this.stepped) return;
    const dtS = this.lastS === null ? 0 : nowS - this.lastS;
    this.lastS = nowS;
    this.run(nowS, dtS);
  }

  /** Stepped only: runs `n` frames of 1 / FRAME_HZ s. A callback's throw stops it and propagates. */
  step(n: number): void {
    if (!this.stepped) throw new Error("the frame clock steps only in tool mode (manual=1)");
    if (!(Number.isInteger(n) && n >= 0)) throw new Error(`step(${n}): expected a whole number`);
    for (let i = 0; i < n; i++) this.run((this.index + 1) / FRAME_HZ, 1 / FRAME_HZ);
  }

  /** Real time: drives `display` from requestAnimationFrame, for a page without a renderer loop. */
  start(): void {
    if (this.stepped) return;
    const loop = (ms: number) => {
      this.display(ms / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private run(nowS: number, dtS: number): void {
    this.index++;
    const f: Frame = { index: this.index, dtS, nowS };
    for (const cb of [...this.callbacks]) cb(f);
  }
}
