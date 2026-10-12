import { deepFreeze } from "@/content/compile";
import type { Content, SimContent } from "@/content/types";
import { SWITCHES } from "@/game/switches";

/**
 * A feature switch: an optional system that is off unless the address turns it on with
 * `on=a,b`, so a playtest adds one feature at a time to the base game. A switch is a real one:
 * an off system stops happening, not just its UI. `cut` takes it out of a copy of the sim content;
 * compiled content has every system on (tests, bots, scripts that don't ask otherwise).
 */
export interface Switch {
  /** One line: what the system is, for the address error and the tools. */
  about: string;
  /** Removes the system from `sim` (a mutable copy). */
  cut(sim: SimContent): void;
}

export type SwitchId = keyof typeof SWITCHES;
export const SWITCH_IDS = Object.keys(SWITCHES) as SwitchId[];

/** `on=` as the address gives it: the ids, or why not (an unknown id fails, never ignored). */
export function parseOn(raw: string | null): { on: SwitchId[] } | { problem: string } {
  if (raw === null || raw === "") return { on: [] };
  const on: SwitchId[] = [];
  for (const id of raw.split(",")) {
    const hit = SWITCH_IDS.find((s) => s === id);
    if (hit === undefined)
      return {
        problem: `on=${raw}: no switch "${id}"; expected ${SWITCH_IDS.join(", ") || "none (the game has no switches)"}`,
      };
    if (!on.includes(hit)) on.push(hit);
  }
  return { on };
}

/** A copy of `content` with only the systems in `on`, the rest cut out, frozen like the original. */
export function switchOn(content: Content, on: readonly SwitchId[]): Content {
  const off = SWITCH_IDS.filter((id) => !on.includes(id));
  if (off.length === 0) return content;
  const copy = structuredClone(content);
  for (const id of off) SWITCHES[id].cut(copy.sim);
  return deepFreeze(copy);
}
