import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { createReport } from "@/game/report";
import { resultModel } from "@/game/ui/result";
import { DEV_TERMS, devTerm } from "@/ui/vocabulary";

const r = loadContentDir(REPO_CONTENT_DIR, []);
if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
const { sim } = r.content;

/**
 * The example's banned words: the kit's dev terms. "build" and "threat" are the grid's own words
 * here, so they stay; a game whose players never see its tiers would add them.
 */
const TERMS = DEV_TERMS;

/** Fails naming the term and the full string, so a hit is easy to place. */
function clean(where: string, text: string, ids = true): void {
  expect(devTerm(text, TERMS, ids), `${where}: "${text}"`).toBeNull();
}

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Every quoted or templated string literal in a screen module (class names and all), a
 * template's `${…}` code left out.
 */
function moduleLiterals(file: string): string[] {
  const src = readFileSync(join(HERE, file), "utf8");
  const out: string[] = [];
  for (const m of src.matchAll(/`([^`]*)`|"([^"]*)"|'([^']*)'/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? "").replaceAll(/\$\{[^}]*\}/g, " ");
    if (s.length > 0) out.push(s);
  }
  return out;
}

describe("vocabulary: no dev term or content id reaches the player", () => {
  it("the result for every character, skill and killer", () => {
    for (const character of Object.keys(sim.characters)) {
      const scenario = { character, buildTier: 3, threatTier: 3, seed: 7, overrides: ["x=1"] };
      const report = {
        ...createReport(100),
        outcome: "died" as const,
        ticks: 1860,
        kills: 30,
        damageBySkill: Object.fromEntries(Object.keys(sim.skills).map((s) => [s, 10])),
        killsByRole: { fodder: 25, elite: 1 },
        spawnedByRole: { fodder: 40, elite: 1, boss: 1 },
        telegraphs: { started: 5, dodged: 3, taken: 1, cancelled: 1 },
      };
      for (const killer of Object.keys(sim.enemies)) {
        const m = resultModel({ ...report, causeOfDeath: killer }, scenario, "/?repro");
        clean("result title", m.title);
        for (const line of m.lines) clean("result line", line);
      }
    }
  });

  it("the screens' own strings: HUD, pause, picker, result", () => {
    for (const file of ["hud.ts", "pause.ts", "picker.ts", "result.ts"])
      for (const literal of moduleLiterals(file)) clean(`${file} literal`, literal, false);
  });
});
