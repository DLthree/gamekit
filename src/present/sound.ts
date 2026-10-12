import type { LookContent } from "@/content/types";
import { nextRange, type Rng } from "@/core/rng";

export interface SoundPlay {
  id: string;
  /** Playback rate: the pitch variation (2^(semitones/12)). */
  rate: number;
  volume: number;
  /**
   * Looping sounds only: the sim time this play should stop at, so the audio output
   * can loop the clip and stop it then. Absent for one-shot sounds.
   */
  untilT?: number;
}

export interface SoundCounts {
  played: number;
  locked: number;
  capped: number;
  gapped: number;
}

/** A wave's sound requests with the audio context's state and failed resumes (handle, telemetry). */
export type SoundStatus = SoundCounts & { state: string; unlockFailures: number };

/**
 * Which sounds play, on sim time. A request is dropped and counted, never
 * queued: while audio is locked (so unlocking never releases a backlog), within the sound's
 * minGapS of its last play, or while `cap` copies are still playing. Pitch varies per play from
 * presentation's sound generator. A looping sound (e.g. a burning zone's crackle)
 * takes an end time instead of relying on the clip's own length; the cap and min-gap still apply,
 * so a flood of zones can't stack unbounded loops.
 */
export class SoundPlan {
  /** Whether the audio context runs; the app sets it every frame. */
  running = false;
  readonly rng: Rng;
  readonly counts: SoundCounts = { played: 0, locked: 0, capped: 0, gapped: 0 };
  private look: LookContent;
  private lengths: ReadonlyMap<string, number>;
  private readonly ends = new Map<string, number[]>();
  private readonly last = new Map<string, number>();
  private readonly queue: SoundPlay[] = [];

  constructor(look: LookContent, rng: Rng) {
    this.look = look;
    this.rng = rng;
    this.lengths = new Map(look.soundManifest.sounds.map((s) => [s.id, s.lengthS]));
  }

  /**
   * A look-only hot swap (src/app/wave.ts): the sound config may have changed, but the caps and
   * gaps already in flight are real playback state, not something a dev edit should reset.
   */
  setLook(look: LookContent): void {
    this.look = look;
    this.lengths = new Map(look.soundManifest.sounds.map((s) => [s.id, s.lengthS]));
  }

  /**
   * `until` is required for a looping sound (its end, e.g. a zone's `t + tickSeconds(lifeTicks)`)
   * and forbidden for a one-shot: a mismatch is a programming error, so this throws rather than
   * guessing (fail fast).
   */
  request(id: string, t: number, until?: number): void {
    const s = this.look.sounds.sounds[id];
    if (s === undefined) throw new Error(`no sound ${id} in look/sounds.json`);
    const length = this.lengths.get(id);
    if (length === undefined) throw new Error(`no sound ${id} in look/generated/sounds.json`);
    if (s.loop && until === undefined) {
      throw new Error(`sound ${id} loops; request() needs an end time`);
    }
    if (!s.loop && until !== undefined) {
      throw new Error(`sound ${id} does not loop; request() was given an end time`);
    }
    if (until !== undefined && until <= t) {
      throw new Error(`sound ${id}: end time ${until} is not after its start ${t}`);
    }
    if (!this.running) {
      this.counts.locked += 1;
      return;
    }
    const last = this.last.get(id);
    if (last !== undefined && t - last < s.minGapS) {
      this.counts.gapped += 1;
      return;
    }
    let ends = this.ends.get(id);
    if (ends === undefined) {
      ends = [];
      this.ends.set(id, ends);
    }
    let n = 0;
    for (const end of ends) if (end > t) ends[n++] = end;
    ends.length = n;
    if (n >= s.cap) {
      this.counts.capped += 1;
      return;
    }
    const rate = 2 ** (nextRange(this.rng, -s.pitch, s.pitch) / 12);
    const end = until ?? t + length / rate;
    ends.push(end);
    this.last.set(id, t);
    const play: SoundPlay = { id, rate, volume: this.look.sounds.volume * s.volume };
    if (until !== undefined) play.untilT = until;
    this.queue.push(play);
    this.counts.played += 1;
  }

  /** The sounds to start now, oldest first; empties the queue. */
  take(): SoundPlay[] {
    return this.queue.splice(0);
  }
}
