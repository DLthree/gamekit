/**
 * The game's closed name lists. The kit builds its schemas from them (src/content/schema/vocab.ts)
 * and treats every entry alike: content gives each one its meaning.
 */

/** Skill tags: modifiers and StatMods select skills by them. */
export const TAGS = [
  "attack",
  "spell",
  "melee",
  "projectile",
  "area",
  "duration",
  "fire",
  "physical",
] as const;

/** Each damage type is also a tag, carried implicitly by that portion of a skill's damage. */
export const DAMAGE_TYPES = [
  "physical",
  "fire",
] as const satisfies readonly (typeof TAGS)[number][];

/** Enemy roles: the report counts kills and spawns by role, and look rules key off them. */
export const ROLES = ["fodder", "elite", "boss"] as const;
