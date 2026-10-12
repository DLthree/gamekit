/** The part of an AudioContext the unlock needs (a fake in tests). */
export interface AudioContextLike {
  readonly state: string;
  resume(): Promise<void>;
}

/** Gestures iOS accepts for starting audio (touchend, not touchstart). */
const GESTURES = ["touchend", "pointerup", "keydown"] as const;

/**
 * Keeps audio running on iOS Safari: the context starts suspended until a gesture and goes
 * "interrupted" after a call or Siri, so every gesture while it isn't running tries resume()
 * again. A rejected resume is counted and logged, never left unhandled (that would crash the
 * wave through the page's unhandledrejection handler).
 */
export class AudioUnlock {
  failures = 0;
  /** In a streak of failed resumes, already warned about. */
  private failing = false;
  /** A frame's resume() has not settled yet; another from a frame would only duplicate it. */
  private pending = false;
  private readonly ctx: AudioContextLike;
  private readonly target: EventTarget;
  /**
   * A gesture always tries: iOS only accepts a resume inside one, and it can leave an earlier
   * resume from a frame pending until then, so the in-flight guard must not block it.
   */
  private readonly onGesture = (): void => {
    if (this.ctx.state !== "running") this.attempt();
  };

  constructor(ctx: AudioContextLike, target: EventTarget) {
    this.ctx = ctx;
    this.target = target;
    for (const g of GESTURES) target.addEventListener(g, this.onGesture);
  }

  /**
   * Tries resume() unless already running or one is in flight, so `failures` counts attempts,
   * not frames; a rejection is counted, never thrown. Phaser retries every frame, so only the
   * first failure of a streak is logged; a resume that succeeds ends it.
   */
  resume(): void {
    if (this.ctx.state === "running" || this.pending) return;
    this.attempt();
  }

  private attempt(): void {
    this.pending = true;
    this.ctx.resume().then(
      () => {
        this.pending = false;
        this.failing = false;
      },
      (err: unknown) => {
        this.pending = false;
        this.failures += 1;
        if (this.failing) return;
        this.failing = true;
        console.warn("audio: resume failed", err);
      },
    );
  }

  get running(): boolean {
    return this.ctx.state === "running";
  }

  release(): void {
    for (const g of GESTURES) this.target.removeEventListener(g, this.onGesture);
  }
}
