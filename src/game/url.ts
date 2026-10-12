import { optionParams, parseOptions, type UrlOptions, wholeFrom } from "@/agent/url-options";
import type { Flow } from "@/game/flow";
import type { Scenario } from "@/game/scenario";

/** A cell asked for by URL; the seed and overrides apply to whatever the URL opens. */
export interface CellRequest {
  character: string;
  buildTier: number;
  threatTier: number;
}

/** What an address opens: a grid (every character, or one), a cell, or a stage (a dev bench). */
export type UrlTarget =
  | { screen: "picker"; character: string | null }
  | { screen: "cell"; cell: CellRequest }
  | { screen: "stage"; stage: string };

function required(p: URLSearchParams, key: string, errors: string[]): number | null {
  if (!p.has(key)) {
    errors.push(`${key} is missing`);
    return null;
  }
  return wholeFrom(p, key, 1, errors);
}

/**
 * The URL is the flow's address: every screen and scenario an agent can reach is a link. No
 * build or threat opens the grid; `target` is null only when `errors` explains why. A `release`
 * build (main passes `__RELEASE__`) refuses the dev parameters (RELEASE_REFUSED).
 */
export function parseUrl(
  search: string,
  build: "dev" | "release" = "dev",
): {
  target: UrlTarget | null;
  seed: number | null;
  overrides: string[];
  options: UrlOptions;
  errors: string[];
} {
  const p = new URLSearchParams(search);
  const errors: string[] = [];
  const character = p.get("char");
  const cell = p.has("build") || p.has("threat");
  if (cell && character === null) errors.push("char is missing");
  const buildTier = cell ? required(p, "build", errors) : null;
  const threatTier = cell ? required(p, "threat", errors) : null;
  const { seed, overrides, options } = parseOptions(p, errors, build);
  const stage = p.get("stage");
  if (stage !== null && (cell || character !== null))
    errors.push(`stage=${stage} opens a bench: drop char, build and threat`);
  if (stage !== null && !options.dev && build === "dev")
    errors.push(`stage=${stage} needs dev=1: stages are developer benches`);
  let target: UrlTarget | null = null;
  if (stage !== null) target = { screen: "stage", stage };
  else if (!cell) target = { screen: "picker", character };
  else if (character !== null && buildTier !== null && threatTier !== null)
    target = { screen: "cell", cell: { character, buildTier, threatTier } };
  return {
    target: errors.length > 0 ? null : target,
    seed,
    overrides,
    options,
    errors,
  };
}

const CELL_KEYS = ["char", "build", "threat", "stage"];

const cellHead = (s: Scenario): [string, string][] =>
  s.stage !== undefined
    ? [["stage", s.stage]]
    : [
        ["char", s.character],
        ["build", String(s.buildTier)],
        ["threat", String(s.threatTier)],
      ];
const pickerHead = (character: string | null): [string, string][] =>
  character === null ? [] : [["char", character]];

/**
 * The address of a screen, written with history.replaceState so a reload lands there: the cell
 * or grid first, then every other parameter of `search` unchanged. A result shares its cell's
 * address (the report isn't in the URL, so a reload replays the cell). Boot and an error with
 * nothing to return to have none: a bad address stays as typed.
 */
export function urlFor(flow: Flow, search: string): string | null {
  let head: [string, string][];
  if (flow.screen === "wave" || flow.screen === "result") head = cellHead(flow.scenario);
  else if (flow.screen === "picker") head = pickerHead(flow.character);
  else if (flow.screen === "error" && flow.scenario !== null) head = cellHead(flow.scenario);
  else if (flow.screen === "error" && flow.picker !== null)
    head = pickerHead(flow.picker.character);
  else return null;
  const q = new URLSearchParams(head);
  for (const [k, v] of new URLSearchParams(search)) if (!CELL_KEYS.includes(k)) q.append(k, v);
  const s = q.toString();
  return s === "" ? "/" : `/?${s}`;
}

/** The address that replays a run: its cell, seed and overrides, and the options that change play. */
export function reproUrl(scenario: Scenario, options: UrlOptions): string {
  const q = new URLSearchParams(cellHead(scenario));
  q.append("seed", String(scenario.seed));
  for (const o of scenario.overrides) q.append("o", o);
  for (const [k, v] of optionParams(options)) q.append(k, v);
  return `/?${q.toString()}`;
}
