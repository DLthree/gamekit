import type { Flow } from "@/flow/machine";
import type { Scenario } from "@/sim/scenario";

/** A cell asked for by URL; the seed and overrides apply to whatever the URL opens. */
export interface CellRequest {
  character: string;
  buildTier: number;
  threatTier: number;
}

/** What an address opens: a grid (every character, or one) or a cell. */
export type UrlTarget =
  | { screen: "picker"; character: string | null }
  | { screen: "cell"; cell: CellRequest };

export interface UrlOptions {
  bot: "kite" | null;
  manual: boolean;
  agent: boolean;
  ui: boolean;
  aim: "absolute" | "relative";
  dpr: number | null;
  telemetry: boolean | null;
  hot: "restart" | "keep";
}

function wholeFrom(p: URLSearchParams, key: string, min: number, errors: string[]): number | null {
  const raw = p.get(key);
  if (raw === null) return null;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < min) {
    errors.push(`${key}=${raw}: expected a whole number from ${min}`);
    return null;
  }
  return n;
}

function oneOf<T extends string>(
  p: URLSearchParams,
  key: string,
  allowed: readonly T[],
  errors: string[],
): T | null {
  const raw = p.get(key);
  if (raw === null) return null;
  const hit = allowed.find((a) => a === raw);
  if (hit === undefined) errors.push(`${key}=${raw}: expected ${allowed.join(" or ")}`);
  return hit === undefined ? null : hit;
}

function flag(p: URLSearchParams, key: string, errors: string[]): boolean | null {
  const v = oneOf(p, key, ["0", "1"], errors);
  return v === null ? null : v === "1";
}

function required(p: URLSearchParams, key: string, errors: string[]): number | null {
  if (!p.has(key)) {
    errors.push(`${key} is missing`);
    return null;
  }
  return wholeFrom(p, key, 1, errors);
}

/**
 * The URL is the flow's address: every screen and scenario an agent can reach is a link. No
 * build or threat opens the grid; `target` is null only when `errors` explains why.
 */
export function parseUrl(search: string): {
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
  const seed = wholeFrom(p, "seed", 0, errors);
  const options: UrlOptions = {
    bot: oneOf(p, "bot", ["kite"], errors),
    manual: flag(p, "manual", errors) === true,
    agent: flag(p, "agent", errors) === true,
    ui: flag(p, "ui", errors) !== false,
    aim: oneOf(p, "aim", ["absolute", "relative"], errors) ?? "relative",
    dpr: wholeFrom(p, "dpr", 1, errors),
    telemetry: flag(p, "telemetry", errors),
    hot: oneOf(p, "hot", ["keep"], errors) === "keep" ? "keep" : "restart",
  };
  let target: UrlTarget | null = null;
  if (!cell) target = { screen: "picker", character };
  else if (character !== null && buildTier !== null && threatTier !== null)
    target = { screen: "cell", cell: { character, buildTier, threatTier } };
  return {
    target: errors.length > 0 ? null : target,
    seed,
    overrides: p.getAll("o"),
    options,
    errors,
  };
}

const CELL_KEYS = ["char", "build", "threat"];

const cellHead = (s: Scenario): [string, string][] => [
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

/**
 * The address that replays a run: its cell, seed and overrides, and the options that change play
 * (aim, bot, manual…). Telemetry is left out: it records the run, it doesn't shape it.
 */
export function reproUrl(scenario: Scenario, options: UrlOptions): string {
  const q = new URLSearchParams(cellHead(scenario));
  q.append("seed", String(scenario.seed));
  for (const o of scenario.overrides) q.append("o", o);
  q.append("aim", options.aim);
  if (options.bot !== null) q.append("bot", options.bot);
  if (options.manual) q.append("manual", "1");
  if (options.agent) q.append("agent", "1");
  if (!options.ui) q.append("ui", "0");
  if (options.dpr !== null) q.append("dpr", String(options.dpr));
  if (options.hot === "keep") q.append("hot", "keep");
  return `/?${q.toString()}`;
}
