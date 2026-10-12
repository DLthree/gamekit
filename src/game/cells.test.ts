import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { kite } from "@/game/kite-bot";
import { step } from "@/sim/step";
import { createWorld } from "@/sim/world";

const loaded = loadContentDir(REPO_CONTENT_DIR, []);
if (!loaded.ok) throw new Error(loaded.errors.map(formatContentError).join("\n"));
const content = loaded.content.sim;
const SEED = 7;

const cells: [string, number, number][] = [];
for (const character of Object.keys(content.characters)) {
  const tiers = content.builds[character].tiers.length;
  for (let b = 1; b <= tiers; b++) {
    for (const threat of Object.keys(content.threats))
      cells.push([character, b, Number(threat.slice(5))]);
  }
}

describe("every shipped cell", () => {
  it.each(cells)(
    "%s build %i × threat %i plays a whole wave with the kite bot",
    (character, buildTier, threatTier) => {
      const w = createWorld(
        { character, buildTier, threatTier, seed: SEED, overrides: [] },
        content,
      );
      for (let i = 0; i < 20_000 && w.phase !== "ended"; i++) step(w, kite(w));
      expect(w.outcome).not.toBeNull();
      expect(w.events.overflow).toBe(0);
      expect(w.report.spawned).toBeGreaterThan(0);
      expect(w.report.kills).toBeGreaterThan(0);
    },
  );
});
