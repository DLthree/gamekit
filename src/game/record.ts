import type { RunRecord } from "@/agent/record";
import type { UrlOptions } from "@/agent/url-options";
import type { Scenario } from "@/game/scenario";
import { reproUrl } from "@/game/url";

/**
 * The example game's run record: its one choice is the cell (or stage) and how it was played,
 * so the choices are the replay address's parameters, the seed apart.
 */
export function recordOf(scenario: Scenario, options: UrlOptions, build: string): RunRecord {
  const q = new URLSearchParams(reproUrl(scenario, options).slice("/?".length));
  q.delete("seed");
  return { build, seed: scenario.seed, choices: [...q].map(([k, v]) => `${k}=${v}`) };
}

/** The address (query, no `?`) that replays `record`. */
export function replayQuery(record: RunRecord): string {
  const q = new URLSearchParams();
  for (const c of record.choices) {
    const eq = c.indexOf("=");
    if (eq <= 0) throw new Error(`choice ${c}: expected key=value`);
    q.append(c.slice(0, eq), c.slice(eq + 1));
  }
  q.set("seed", String(record.seed));
  return q.toString();
}
