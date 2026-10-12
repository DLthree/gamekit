/**
 * The part of a playing Phaser sound the loop tracker needs to release it later. `destroy()`
 * (not `stop()`): Phaser's `WebAudioSound.stop()` leaves the sound registered in the manager's
 * `sounds` list — only a one-shot's own COMPLETE handler destroys it (see AudioOut.play). A loop
 * never completes on its own, so without an explicit `destroy()` here it would leak a sound and
 * its audio nodes for every zone, across waves (Review I1).
 */
export interface LoopSound {
  destroy(): void;
}

/**
 * Tracks the loop sounds `AudioOut.play` starts: the only looping sound is crackle,
 * for a burning zone's lifetime). Stopping is driven by presentation time rather than a real
 * timer: the wave already advances that clock every tick, so `update(t)` just compares against
 * it — no wall-clock waits, so it's deterministic under test. Kept free of any Phaser import so
 * it can be unit tested directly (Phaser needs `window`, which this project's vitest run — node
 * environment, no jsdom — doesn't provide). `stopAll` covers wave teardown, where loops must not
 * keep sounding into the next wave.
 */
export class LoopTracker {
  private readonly loops: { sound: LoopSound; untilT: number }[] = [];

  add(sound: LoopSound, untilT: number): void {
    this.loops.push({ sound, untilT });
  }

  /** Destroys every loop whose end time has passed; call each tick with presentation time. */
  update(t: number): void {
    let n = 0;
    for (const l of this.loops) {
      if (l.untilT <= t) l.sound.destroy();
      else this.loops[n++] = l;
    }
    this.loops.length = n;
  }

  /** Destroys every live loop regardless of its end time (wave teardown). */
  stopAll(): void {
    for (const l of this.loops) l.sound.destroy();
    this.loops.length = 0;
  }
}
