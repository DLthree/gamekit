import type { Vec } from "@/core/vec";
import type { SlotId } from "@/realtime/content/schema/vocab";

/** A cast request: an aim direction in world axes (any length), or "auto" (quick-cast). */
export interface CastCommand {
  slot: SlotId;
  aim: Vec | "auto";
}

/** The sim's only input. Devices, the bot and tests all produce this. */
export interface Command {
  /** Move intent in [-1, 1] per axis; +y is down (screen and world agree). */
  moveX: number;
  moveY: number;
  cast: CastCommand | null;
}

export const IDLE: Command = Object.freeze({ moveX: 0, moveY: 0, cast: null });
