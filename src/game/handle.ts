import type { Vec } from "@/core/vec";
import type { Flow } from "@/game/flow";
import type { WaveReport } from "@/game/report";
import type { PerfSummary } from "@/realtime/agent/perf";
import type { FxCounts } from "@/realtime/present/fx/pool";
import type { SoundStatus } from "@/realtime/present/sound";
import type { SimEvent } from "@/realtime/sim/events";
import type { WorldSummary } from "@/realtime/sim/snapshot";

/**
 * The example's part of the agent handle (`window.__game`, src/agent/handle.ts adds the kit's):
 * its screens, the running wave, and what tests and tools drive it with. Its scripted action
 * (`act`) is src/game/actions.ts.
 */
export interface GameHandle {
  flow(): Flow;
  state(): WorldSummary;
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
