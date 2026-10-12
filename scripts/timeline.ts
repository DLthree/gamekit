/**
 * The headless event timeline behind `pnpm ticks`: a query's world (the game's worldForQuery) run
 * without the renderer, its telling moments (the game's tickLine) listed by tick.
 */
import { toolQuery } from "@scripts/game-page";
import { parseOptions } from "@/agent/url-options";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { switchOn } from "@/content/switches";
import { ticks } from "@/core/clock";
import { BOTS } from "@/game/bots";
import { tickLine, worldForQuery } from "@/game/headless";
import { IDLE } from "@/sim/command";
import { step } from "@/sim/step";

/**
 * `<tick> <line>` for each telling moment of the query's run, made reproducible as the shot tools
 * make it (seed 7 unless given, `overrides` as `o=`), on the content its `on=` switches leave, so the ticks match theirs. The query's bot plays, else the player
 * stands idle, as on the page. Stops at the wave's end or after `maxS` sim seconds.
 */
export function timeline(query: string, maxS: number, overrides: readonly string[] = []): string[] {
  const search = toolQuery(query, overrides);
  const errors: string[] = [];
  const { overrides: all, options } = parseOptions(new URLSearchParams(search), errors);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const loaded = loadContentDir(REPO_CONTENT_DIR, all);
  if (!loaded.ok) throw new Error(loaded.errors.map(formatContentError).join("\n"));
  const world = worldForQuery(search, switchOn(loaded.content, options.on).sim);
  const bot = options.bot === null ? null : BOTS[options.bot];
  const out: string[] = [];
  for (let i = 0; i < ticks(maxS) && world.phase !== "ended"; i++) {
    step(world, bot === null ? IDLE : bot(world));
    for (const e of world.events.items) {
      const line = tickLine(e);
      if (line !== null) out.push(`${world.tick} ${line}`);
    }
  }
  return out;
}
