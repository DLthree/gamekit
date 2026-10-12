import type { DamageType, Role, Tag } from "@/content/schema/vocab";
import { TEST_NAMES } from "@/game/test-files";
import { DAMAGE_TYPES } from "@/game/vocab";

/** The game's names the kit's test content uses (src/game/test-files.ts `TEST_NAMES`). */
export interface TestNames {
  tags: readonly [Tag, Tag, Tag];
  damageTypes: readonly [DamageType] | readonly [DamageType, DamageType];
  roles: readonly [Role, Role];
}

/**
 * Kit tests and src/test content name tags, damage types and roles only through these, so a new
 * game's vocabulary never breaks a kit test.
 */
export const [TAG_A, TAG_B, TAG_C] = TEST_NAMES.tags;
export const DMG_A: DamageType = TEST_NAMES.damageTypes[0];
/** The game's second test damage type, or null: tests that need two skip without it. */
export const DMG_B: DamageType | null = TEST_NAMES.damageTypes[1] ?? null;
export const [ROLE_A, ROLE_B] = TEST_NAMES.roles;

/** DMG_B inside a test that skips when it is null. */
export function second(): DamageType {
  if (DMG_B === null) throw new Error("this test needs a second damage type in TEST_NAMES");
  return DMG_B;
}

/** A damage record with every type at 0 except those given. */
export function damageOf(amounts: Partial<Record<DamageType, number>>): Record<DamageType, number> {
  const out = {} as Record<DamageType, number>;
  for (const type of DAMAGE_TYPES) out[type] = amounts[type] ?? 0;
  return out;
}
