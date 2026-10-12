import type { Compiled } from "@/content/kind";
import type { KIT_KINDS } from "@/content/kinds";
import type { GAME_KINDS } from "@/game/content";

/** What the rules read: the game's sim kinds, compiled. */
export type SimContent = Compiled<typeof GAME_KINDS.sim>;

/** Presentation only; the rules never read it, so look edits never restart a run. */
export type LookContent = Compiled<typeof GAME_KINDS.look> & Compiled<typeof KIT_KINDS.look>;

/** One valid, deep-frozen content snapshot. */
export interface Content {
  sim: SimContent;
  look: LookContent;
}
