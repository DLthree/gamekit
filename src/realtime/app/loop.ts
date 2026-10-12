import { FixedClock, MAX_TICKS_PER_FRAME } from "@/core/clock";
import type { CastCommand, Command } from "@/realtime/sim/command";
import type { SimEvent } from "@/realtime/sim/events";
import { step } from "@/realtime/sim/step";
import type { World } from "@/realtime/sim/world";

export interface LoopOptions {
  world: World;
  /** Manual mode: only stepManual advances the sim (tests, screenshots). */
  manual: boolean;
  /** When set, the bot plays instead of the controls. */
  bot: ((w: World) => Command) | null;
}

/**
 * Real time in, ticks out; a latched cast survives frames that run no tick.
 *
 * The latch is not cleared after every step: hit-stop freezes and countdown ticks run no
 * skills, so clearing it there would drop a tap. The latch is only cleared for a tick that was actually playing and
 * unfrozen (checked on `world.phase` / `world.freezeTicks` *before* calling `step`,
 * since a step can transition phase or decrement freezeTicks without consuming a cast).
 */
export class GameLoop {
  readonly world: World;
  private readonly clock = new FixedClock(MAX_TICKS_PER_FRAME);
  private readonly manual: boolean;
  private readonly bot: ((w: World) => Command) | null;
  private last: number | null = null;
  private latched: CastCommand | null = null;
  paused = false;

  constructor(o: LoopOptions) {
    this.world = o.world;
    this.manual = o.manual;
    this.bot = o.bot;
  }

  get ended(): boolean {
    return this.world.phase === "ended";
  }

  requestCast(c: CastCommand): void {
    this.latched = c;
  }

  /** Runs the ticks this frame's elapsed time earns; returns their events in order. */
  frame(nowS: number, moveX: number, moveY: number): SimEvent[] {
    const last = this.last;
    this.last = nowS;
    if (last === null || this.paused || this.manual) return [];
    const n = this.clock.advance(nowS - last);
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

  /** Manual mode: exactly n steps with this command (its cast only on the first). */
  stepManual(n: number, command: Command): SimEvent[] {
    const out: SimEvent[] = [];
    for (let i = 0; i < n && !this.ended; i++) {
      const c = i === 0 ? command : { ...command, cast: null };
      step(this.world, this.bot === null ? c : this.bot(this.world));
      out.push(...this.world.events.items);
    }
    return out;
  }

  /** The page is hidden: no ticks until resume. */
  pause(): void {
    this.paused = true;
  }

  /** Back: the hidden time is dropped; the next frame only sets the time base. */
  resume(): void {
    this.paused = false;
    this.last = null;
    this.clock.reset();
  }
}
