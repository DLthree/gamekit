import { parseOn, type SwitchId } from "@/content/switches";
import { BOTS, type BotId } from "@/game/bots";

/** How a page runs, whatever it opens: who plays, what agents may read, and what it records. */
export interface UrlOptions {
  bot: BotId | null;
  manual: boolean;
  agent: boolean;
  ui: boolean;
  aim: "absolute" | "relative";
  dpr: number | null;
  telemetry: boolean | null;
  hot: "restart" | "keep";
  /** Developer pages (stages) may open: `dev=1`. */
  dev: boolean;
  /** The feature switches turned on (`on=a,b`, src/content/switches.ts). */
  on: SwitchId[];
}

/** `key` as a whole number ≥ min, or null when absent; anything else is an error. */
export function wholeFrom(
  p: URLSearchParams,
  key: string,
  min: number,
  errors: string[],
): number | null {
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

const BOT_IDS = Object.keys(BOTS) as BotId[];

/** The parameters every address shares: the seed, content overrides (`o=`) and options. */
export function parseOptions(
  p: URLSearchParams,
  errors: string[],
): { seed: number | null; overrides: string[]; options: UrlOptions } {
  const seed = wholeFrom(p, "seed", 0, errors);
  const on = parseOn(p.get("on"));
  if ("problem" in on) errors.push(on.problem);
  const options: UrlOptions = {
    bot: oneOf(p, "bot", BOT_IDS, errors),
    manual: flag(p, "manual", errors) === true,
    agent: flag(p, "agent", errors) === true,
    ui: flag(p, "ui", errors) !== false,
    aim: oneOf(p, "aim", ["absolute", "relative"], errors) ?? "relative",
    dpr: wholeFrom(p, "dpr", 1, errors),
    telemetry: flag(p, "telemetry", errors),
    hot: oneOf(p, "hot", ["keep"], errors) === "keep" ? "keep" : "restart",
    dev: flag(p, "dev", errors) === true,
    on: "on" in on ? on.on : [],
  };
  return { seed, overrides: p.getAll("o"), options };
}

/**
 * The options that change play (aim, bot, manual…) as URL parameters, for a replay address.
 * Telemetry is left out: it records the run, it doesn't shape it.
 */
export function optionParams(options: UrlOptions): [string, string][] {
  const q: [string, string][] = [["aim", options.aim]];
  if (options.bot !== null) q.push(["bot", options.bot]);
  if (options.manual) q.push(["manual", "1"]);
  if (options.agent) q.push(["agent", "1"]);
  if (!options.ui) q.push(["ui", "0"]);
  if (options.dpr !== null) q.push(["dpr", String(options.dpr)]);
  if (options.hot === "keep") q.push(["hot", "keep"]);
  if (options.dev) q.push(["dev", "1"]);
  if (options.on.length > 0) q.push(["on", options.on.join(",")]);
  return q;
}
