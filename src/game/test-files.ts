import { realtimeTestFiles } from "@/realtime/test/files";
import type { TestNames } from "@/realtime/test/vocab";
import type { FilePatch } from "@/test/content";

/** builds/hero.json with one loadout as all three tiers (the schema requires three). */
export function heroBuild(auto: string, cast: string): FilePatch {
  const tier = { loadout: { auto: { skill: auto }, cast: { skill: cast } } };
  return { "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] } };
}

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

/**
 * The game's files in the kit's small test content (src/test/content.ts): the real-time layer's
 * (src/realtime/test/files.ts), the hero's zap and boom in every build tier, and a quiet
 * ten-second wave that spawns nothing. Kit tests rely on the
 * quiet wave's contract, whatever the game's win rule: it does not end in its first 10 s while
 * the player lives (they step worlds for seconds), and it ends by itself within 10 minutes.
 */
export const GAME_TEST_FILES: FilePatch = {
  ...realtimeTestFiles(TEST_NAMES),
  ...heroBuild("zap", "boom"),
  "threats/tier-1.json": { durationS: 10, maxAlive: 100, spawns: [] },
};
