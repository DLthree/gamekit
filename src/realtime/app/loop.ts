import { FixedClock, MAX_TICKS_PER_FRAME } from "@/realtime/core/clock";
import type { CastCommand, Command } from "@/realtime/sim/command";
import type { SimEvent } from "@/realtime/sim/events";
import { step } from "@/realtime/sim/step";
import type { World } from "@/realtime/sim/world";

export interface LoopOptions {
  world: World;
  /** When set, the bot plays instead of the controls. */
  bot: ((w: World) => Command) | null;
}

/**
 * The kit clock's frames in (src/core/frames.ts), ticks out; a latched cast survives frames
 * that run no tick. Stepped (tool mode), each frame is one tick.
 *
 * The latch is not cleared after every step: hit-stop freezes and countdown ticks run no
 * skills, so clearing it there would drop a tap. The latch is only cleared for a tick that was actually playing and
 * unfrozen (checked on `world.phase` / `world.freezeTicks` *before* calling `step`,
 * since a step can transition phase or decrement freezeTicks without consuming a cast).
 */
export class GameLoop {
  readonly world: World;
  private readonly clock = new FixedClock(MAX_TICKS_PER_FRAME);
  private readonly bot: ((w: World) => Command) | null;
  private latched: CastCommand | null = null;
  paused = false;

  constructor(o: LoopOptions) {
    this.world = o.world;
    this.bot = o.bot;
  }

  get ended(): boolean {
    return this.world.phase === "ended";
  }

  requestCast(c: CastCommand): void {
    this.latched = c;
  }

  /** Runs the ticks a frame of `dtS` seconds earns; returns their events in order. */
  frame(dtS: number, moveX: number, moveY: number): SimEvent[] {
    if (this.paused) return [];
    const n = this.clock.advance(dtS);
    const out: SimEvent[] = [];
    for (let i = 0; i < n && !this.ended; i++) {
      const command: Command =
        this.bot === null ? { moveX, moveY, cast: this.latched } : this.bot(this.world);
      const consumesCast = this.world.phase === "playing" && this.world.freezeTicks === 0;
      step(this.world, command);
      if (this.bot === null && consumesCast) this.latched = null;
      out.push(...this.world.events.items);
    }
    return out;
  }

  /** The page is hidden or paused: frames run no ticks until resume. */
  pause(): void {
    this.paused = true;
  }

  /** Back: the paused time was never fed to the clock; a partial tick is dropped too. */
  resume(): void {
    this.paused = false;
    this.clock.reset();
  }
}
