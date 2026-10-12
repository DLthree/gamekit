/**
 * The example game's run model for `pnpm sweep`: a run is one cell played to its end by the kite
 * bot, and a row is its outcome. The kit (scripts/sweep-run.ts) spreads (run, seed) jobs over
 * worker threads and prints `sweepTable(rows)`.
 */
import type { SimContent } from "@/content/types";
import { TICK_HZ } from "@/core/clock";
import { kite } from "@/game/kite-bot";
import { worldFor } from "@/game/setup";
import type { Outcome } from "@/sim/events";
import { step } from "@/sim/step";

/** One played run. */
export interface SweepRow {
  run: string;
  seed: number;
  outcome: Outcome;
  secs: number;
  kills: number;
  /** Damage taken as % of max life (regen-free, so ≥ 100 means dead). */
  lifeLost: number;
  killer: string | null;
}

/** A run id: `<character>-b<build tier>-t<threat tier>`. */
const RUN = /^([a-z0-9-]+)-b(\d+)-t(\d+)$/;

/** Every cell this content has, as run ids, in grid order. */
export function sweepRuns(content: SimContent): string[] {
  const ids: string[] = [];
  const threats = Object.keys(content.threats).length;
  for (const character of Object.keys(content.characters)) {
    const builds = content.builds[character]?.tiers.length ?? 0;
    for (let b = 1; b <= builds; b++)
      for (let t = 1; t <= threats; t++) ids.push(`${character}-b${b}-t${t}`);
  }
  return ids;
}

/** Plays run `run` on `seed` to its end with the kite bot. Throws on a run id it can't read. */
export function playRun(content: SimContent, run: string, seed: number): SweepRow {
  const m = RUN.exec(run);
  if (m === null) throw new Error(`run ${run}: expected <character>-b<build>-t<threat>`);
  const world = worldFor(
    { character: m[1], buildTier: Number(m[2]), threatTier: Number(m[3]), seed, overrides: [] },
    content,
  );
  // A wave always ends (its timer runs out), so this loop does too.
  while (world.phase !== "ended") step(world, kite(world));
  const r = world.report;
  if (r.outcome === null) throw new Error(`sweep ${run} seed ${seed}: ended with no outcome`);
  const life = content.characters[m[1]].stats.life;
  return {
    run,
    seed,
    outcome: r.outcome,
    secs: Math.round(r.ticks / TICK_HZ),
    kills: r.kills,
    lifeLost: Math.round((r.damageTaken / life) * 100),
    killer: r.causeOfDeath,
  };
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/** Per run: win rate, runs, median secs, kills and life lost, and the commonest killer. */
export function sweepTable(rows: readonly SweepRow[]): Record<string, Record<string, string>> {
  const table: Record<string, Record<string, string>> = {};
  for (const run of [...new Set(rows.map((r) => r.run))]) {
    const rs = rows.filter((r) => r.run === run);
    const won = rs.filter((r) => r.outcome === "survived").length;
    const killers = new Map<string, number>();
    for (const r of rs)
      if (r.killer !== null) killers.set(r.killer, (killers.get(r.killer) ?? 0) + 1);
    const top = [...killers].sort((a, b) => b[1] - a[1])[0];
    table[run] = {
      win: `${Math.round((won / rs.length) * 100)}%`,
      n: String(rs.length),
      secs: String(median(rs.map((r) => r.secs))),
      kills: String(median(rs.map((r) => r.kills))),
      lifeLost: `${median(rs.map((r) => r.lifeLost))}%`,
      killer: top === undefined ? "-" : `${top[0]} ×${top[1]}`,
    };
  }
  return table;
}
