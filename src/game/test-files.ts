import type { FilePatch } from "@/test/content";
import type { TestNames } from "@/test/vocab";

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

/**
 * Which of the game's names (src/game/vocab.ts) the kit's test content and kit tests use: the
 * zap is `[tags[0], damageTypes[0]]`, the boom adds `tags[1]`, a test modifier adds `tags[2]`;
 * roles[1] is a big-death role (look/feedback.json bigDeathRoles). A second damage type is
 * optional; the kit tests that need one skip without it.
 */
export const TEST_NAMES: TestNames = {
  tags: ["projectile", "area", "duration"],
  damageTypes: ["fire", "physical"],
  roles: ["fodder", "elite"],
};
