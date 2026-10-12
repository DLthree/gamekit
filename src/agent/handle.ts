import type { SwitchId } from "@/content/switches";
import type { GameHandle } from "@/game/handle";

/**
 * What every game's handle offers the kit's tools (shot, screens, e2e fixtures): the screen it
 * is on, its state as JSON, the feature switches on, and failed telemetry sends.
 */
export interface KitHandle {
  flow(): { screen: string };
  state(): unknown;
  /** The feature switches the address turned on (`on=`, src/content/switches.ts), in its order. */
  on(): readonly SwitchId[];
  /** Telemetry POSTs that failed (network error or non-2xx) since boot. */
  telemetryFailures(): number;
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
