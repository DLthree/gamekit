import type { SaveStore } from "@/app/platform";
import type { DeedEntry } from "@/content/achievements";
import type { SimContent } from "@/content/types";
import type { WaveReport } from "@/game/report";
import type { Scenario } from "@/game/scenario";

/** The deeds as the kit sees them (achievements, `pnpm steam:achievements`), in id order. */
export function deedList(sim: SimContent): DeedEntry[] {
  return Object.keys(sim.deeds)
    .sort()
    .map((id) => ({ id, name: sim.deeds[id].name, text: sim.deeds[id].text }));
}

function count(m: Record<string, number>, key: string): number {
  return Object.hasOwn(m, key) ? m[key] : 0;
}

/** The deeds a finished wave meets. A stage (a dev bench) earns none. */
export function deedsMet(sim: SimContent, scenario: Scenario, report: WaveReport): string[] {
  if (scenario.stage !== undefined) return [];
  return deedList(sim)
    .map((d) => d.id)
    .filter((id) => {
      const { won, threat, kills } = sim.deeds[id].needs;
      if (won === true && report.outcome !== "survived") return false;
      if (threat !== undefined && scenario.threatTier < threat) return false;
      if (kills !== undefined && count(report.killsByRole, kills.role) < kills.count) return false;
      return true;
    });
}

/** The save's key: `<userData>/save/deeds.json` on desktop, localStorage's `deeds` on the web. */
export const DEEDS_KEY = "deeds";
const VERSION = 1;

/** The earned deeds in the save (none on a fresh one). Throws, naming the save, on a bad one. */
export function readEarned(store: SaveStore): Set<string> {
  const text = store.getItem(DEEDS_KEY);
  if (text === null) return new Set();
  const bad = (why: string) => new Error(`the ${DEEDS_KEY} save ${why}`);
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (err) {
    throw bad(`is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const save = v as { version?: unknown; earned?: unknown };
  if (typeof v !== "object" || v === null || save.version !== VERSION)
    throw bad(`is not version ${VERSION}: ${text.slice(0, 80)}`);
  if (!Array.isArray(save.earned) || !save.earned.every((id) => typeof id === "string"))
    throw bad("has no earned list of deed ids");
  return new Set(save.earned);
}

/** Writes the earned deeds, in id order. */
export function writeEarned(store: SaveStore, earned: ReadonlySet<string>): void {
  store.setItem(DEEDS_KEY, JSON.stringify({ version: VERSION, earned: [...earned].sort() }));
}
