/**
 * The game's side of the headless tools (`pnpm ticks`, `pnpm sweep`): a query's world built as the
 * page builds it, and which sim events make a tick worth aiming a shot or film at.
 */
import type { SimContent } from "@/content/types";
import { checkScenario, type Scenario, stageScenario } from "@/game/scenario";
import { worldFor } from "@/game/setup";
import { parseUrl } from "@/game/url";
import type { SimEvent } from "@/sim/events";
import type { World } from "@/sim/world";

/**
 * The world a page at `search` would play: its cell or stage, seed and overrides. `content` must already
 * carry the query's overrides. Throws naming why when the query opens neither.
 */
export function worldForQuery(search: string, content: SimContent): World {
  const url = parseUrl(search);
  if (url.errors.length > 0) throw new Error(url.errors.join("\n"));
  const target = url.target;
  if (target === null || target.screen === "picker")
    throw new Error(`${search}: opens the ${target?.screen ?? "nothing"}, not a cell or stage`);
  if (url.seed === null) throw new Error(`${search}: no seed`);
  const scenario: Scenario =
    target.screen === "stage"
      ? stageScenario(content, target.stage, url.seed, url.overrides)
      : { ...target.cell, seed: url.seed, overrides: url.overrides };
  checkScenario(scenario, content);
  return worldFor(scenario, content);
}

/**
 * A tick's telling moment as a line (`pnpm ticks`), or null: an enemy's warned volume (a
 * telegraph), a non-fodder spawn or death, the wave's end.
 */
export function tickLine(e: SimEvent): string | null {
  if (e.t === "volumeStarted" && e.team === "enemy" && e.warnTicks > 0)
    return `warn ${e.vfx} ${e.ownerDef}`;
  if (e.t === "spawned" && e.role !== "fodder" && e.role !== "player")
    return `spawned ${e.def} ${e.role}`;
  if (e.t === "died" && e.role !== "fodder") return `died ${e.def} ${e.role}`;
  if (e.t === "waveEnded") return `ended ${e.outcome}`;
  return null;
}
