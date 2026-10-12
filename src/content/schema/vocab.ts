import { z } from "zod";
import { DAMAGE_TYPES, ROLES, TAGS } from "@/game/vocab";

/**
 * The closed vocabularies content refers to. Stat ids change slowly and code interprets them, so
 * they live in code; their values live in content. The clamp for each stat id is in
 * src/sim/stats/ids.ts, typed so a new id without a clamp fails typecheck. Tags, damage types and
 * roles are the game's lists (src/game/vocab.ts).
 */
export const STAT_IDS = [
  "life",
  "moveSpeed",
  "radius",
  "knockbackResist",
  "damage",
  "cooldown",
  "rate",
  "range",
  "area",
  "duration",
  "pulse",
  "projectileSpeed",
  "projectileCount",
  "spread",
  "pierce",
  "knockback",
] as const;
export const StatId = z.enum(STAT_IDS);
export type StatId = z.infer<typeof StatId>;

export const ACTOR_STAT_IDS = ["life", "moveSpeed", "radius", "knockbackResist"] as const;
export type ActorStatId = (typeof ACTOR_STAT_IDS)[number];

export const Tag = z.enum(TAGS);
export type Tag = z.infer<typeof Tag>;

export const DamageType = z.enum(DAMAGE_TYPES);
export type DamageType = z.infer<typeof DamageType>;

export const SlotId = z.enum(["auto", "cast"]);
export type SlotId = z.infer<typeof SlotId>;

export const Activation = z.enum(["auto", "manual"]);
export type Activation = z.infer<typeof Activation>;

export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** The `$schema` every content file starts with (checked against its path by the compiler). */
export const SchemaRef = z.string().min(1);

/** Content ids and palette names: kebab-case, the same as file names. */
export const ContentId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are kebab-case");

export const StatMod = z.strictObject({
  stat: StatId,
  op: z.enum(["flat", "increased", "more"]),
  value: z.number(),
  if: z.array(Tag).default([]),
});
export type StatMod = z.infer<typeof StatMod>;

/** A StatMod with where it came from ("builds/<id>.json tier 1", "modifiers/<id>.json"). */
export interface SourcedMod {
  mod: StatMod;
  source: string;
}

export const ActorStats = z.strictObject({
  life: z.number().positive(),
  moveSpeed: z.number().nonnegative(),
  radius: z.number().positive(),
  knockbackResist: z.number().min(0).max(1),
});
export type ActorStats = z.infer<typeof ActorStats>;
