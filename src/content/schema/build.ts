import { z } from "zod";
import { LOOK_KINDS } from "@/content/schema/skill";
import { ContentId, SchemaRef, SlotId, StatMod } from "@/content/schema/vocab";

export const SlotLoadout = z.strictObject({
  skill: ContentId,
  /** Applied in order: a modifier's `requires` sees the tags earlier ones added. */
  modifiers: z.array(ContentId).default([]),
});
export type SlotLoadout = z.infer<typeof SlotLoadout>;

/** "<skill>.<kind that draws a vfx>", e.g. "fire-bolt.projectile". A dash has no vfx to key. */
export const LookKey = z
  .string()
  .regex(
    new RegExp(`^[a-z0-9]+(-[a-z0-9]+)*\\.(${LOOK_KINDS.join("|")})$`),
    `look keys are <skill>.<${LOOK_KINDS.join("|")}>`,
  );

/**
 * One build tier: skills in slots with their modifiers, character-wide StatMods (gem
 * vocabulary), and vfx swaps for every node of a kind in a skill (applied after modifiers').
 */
export const BuildTier = z.strictObject({
  loadout: z.partialRecord(SlotId, SlotLoadout),
  stats: z.array(StatMod).default([]),
  look: z.record(LookKey, ContentId).default({}),
});
export type BuildTier = z.infer<typeof BuildTier>;

/** Exactly three build tiers per character (roadmap ruling 4): the rows of the picker's grid. */
export const Build = z.strictObject({
  $schema: SchemaRef,
  character: ContentId,
  tiers: z.tuple([BuildTier, BuildTier, BuildTier]),
});
export type Build = z.infer<typeof Build>;
