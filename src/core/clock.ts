/** The sim's fixed rate. A code constant: tuned feel numbers depend on it. */
export const TICK_HZ = 60;
export const TICK_S = 1 / TICK_HZ;
/** A stall never runs more than this many ticks in one frame; the excess time is dropped. */
export const MAX_TICKS_PER_FRAME = 5;

/** Content authors durations in seconds; this is the one place they become ticks. */
export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_HZ);
}

/** Sim time in seconds at a tick; presentation animates on this, not on wall time. */
export function tickSeconds(tick: number): number {
  return tick * TICK_S;
}

/** Accumulator clock: real elapsed time in, whole ticks to run out. */
export class FixedClock {
  readonly maxTicks: number;
  private accumulator = 0;

  constructor(maxTicksPerFrame: number) {
    this.maxTicks = maxTicksPerFrame;
  }

  advance(elapsedS: number): number {
    this.accumulator += elapsedS;
    // The epsilon keeps a 16.67 ms frame from rounding down to 0 ticks, then 2 the next frame.
    let n = Math.floor(this.accumulator / TICK_S + 1e-6);
    if (n > this.maxTicks) {
      n = this.maxTicks;
      this.accumulator = 0;
    } else {
      this.accumulator = Math.max(0, this.accumulator - n * TICK_S);
    }
    return n;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
