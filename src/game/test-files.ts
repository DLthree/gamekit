import type { FilePatch } from "@/test/content";

/** builds/hero.json with one loadout as all three tiers (the schema requires three). */
export function heroBuild(auto: string, cast: string): FilePatch {
  const tier = { loadout: { auto: { skill: auto }, cast: { skill: cast } } };
  return { "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] } };
}

/**
 * The game's files in the kit's small test content (src/test/content.ts): the hero's zap and boom
 * in every build tier, and a quiet ten-second wave that spawns nothing.
 */
export const GAME_TEST_FILES: FilePatch = {
  ...heroBuild("zap", "boom"),
  "threats/tier-1.json": { durationS: 10, maxAlive: 100, spawns: [] },
};
