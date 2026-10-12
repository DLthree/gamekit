import type { SwitchId } from "@/content/switches";
import type { FrameClock } from "@/core/frames";
import type { GameHandle } from "@/game/handle";

/**
 * What every game's handle offers the kit's tools (shot, film, screens, e2e fixtures): the screen
 * it is on, its state as JSON, the feature switches on, failed telemetry sends, and tool mode's
 * time: the kit frame clock (src/core/frames.ts) and the game's scripted actions.
 */
export interface KitHandle {
  flow(): { screen: string };
  state(): unknown;
  /** The feature switches the address turned on (`on=`, src/content/switches.ts), in its order. */
  on(): readonly SwitchId[];
  /** Telemetry POSTs that failed (network error or non-2xx) since boot. */
  telemetryFailures(): number;
  /** The kit clock's frames run since boot. */
  frame(): number;
  /** manual=1 only: runs n frames of the kit clock (the sim, rendering, animations). */
  frames(n: number): void;
  /**
   * manual=1 only: applies one scripted action, in the game's own shape (the example's:
   * src/game/actions.ts). Tools reach a moment by replaying actions, then running frames. An
   * action may run frames itself (a held command), or only change state (a move whose animation
   * the next frames play). Throws on an action the game doesn't know.
   */
  act(action: unknown): void | Promise<void>;
}

/** The kit clock's part of a handle. */
export function clockHandle(clock: FrameClock): Pick<KitHandle, "frame" | "frames"> {
  return {
    frame: () => clock.index,
    frames: (n) => clock.step(n),
  };
}

/**
 * What an agent (Playwright, a script, a person in the console) can read and drive: the kit's
 * part and the game's (src/game/handle.ts). The game's comes first, so its narrower `flow` and
 * `state` types are the ones callers see.
 */
export type Handle = GameHandle & KitHandle;

declare global {
  interface Window {
    __game?: Handle;
  }
}

export function installHandle(h: Handle): void {
  window.__game = h;
}
