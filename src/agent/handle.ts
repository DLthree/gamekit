import type { PerfSummary } from "@/agent/perf";
import type { SwitchId } from "@/content/switches";
import type { Vec } from "@/core/vec";
import type { Flow } from "@/game/flow";
import type { WaveReport } from "@/game/report";
import type { FxCounts } from "@/present/fx/pool";
import type { SoundStatus } from "@/present/sound";
import type { Command } from "@/sim/command";
import type { SimEvent } from "@/sim/events";
import type { WorldSummary } from "@/sim/snapshot";

/** What an agent (Playwright, a script, a person in the console) can read and drive. */
export interface GameHandle {
  flow(): Flow;
  /** The feature switches the address turned on (`on=`, src/content/switches.ts), in its order. */
  on(): readonly SwitchId[];
  state(): WorldSummary;
  /** manual=1 only: runs n ticks (the command's cast on the first) and returns the new state. */
  step(n: number, command?: Command): WorldSummary;
  /** agent=1 only: this wave's events with tick ≥ since. */
  events(since?: number): SimEvent[];
  report(): WaveReport;
  fx(): FxCounts;
  /** Enemy telegraphs drawn in the last frame. */
  telegraphs(): number;
  /** Stop spawning effects so a test can watch the pool drain to zero. */
  stopFx(): void;
  perf(): PerfSummary;
  /** From the result screen: a new run of the same scenario. */
  retry(): void;
  /** Pauses the running wave behind the pause overlay (`flow().paused`), as the HUD button does. */
  pause(): void;
  /** Resumes a paused wave, as the overlay's Resume button does. */
  resume(): void;
  /** Telemetry POSTs that failed (network error or non-2xx) since boot. */
  telemetryFailures(): number;
  /** The player's feet on screen (CSS px); absolute aim goes from here to the finger. */
  playerCss(): Vec;
  /** Sound requests this wave (played or why dropped), the audio context state, failed resumes. */
  sound(): SoundStatus;
  /**
   * manual=1 only, test hook: forces the audio context back to "suspended" so an e2e can prove a
   * later gesture is resumed by AudioUnlock, not Phaser's own one-shot unlock listener (already
   * spent by the first successful resume).
   */
  suspendAudio(): Promise<void>;
}

declare global {
  interface Window {
    __game?: GameHandle;
  }
}

export function installHandle(h: GameHandle): void {
  window.__game = h;
}
