import { z } from "zod";
import { SchemaRef } from "@/content/schema/vocab";
import { Role } from "@/realtime/content/schema/vocab";

/**
 * What a wave must show for the deed: every field given must hold. `won`: the player survived;
 * `threat`: at that threat tier or above; `kills`: at least `count` kills of that enemy role.
 */
export const DeedNeeds = z
  .strictObject({
    won: z.literal(true).optional(),
    threat: z.number().int().positive().optional(),
    kills: z.strictObject({ role: Role, count: z.number().int().positive() }).optional(),
  })
  .refine((n) => Object.keys(n).length > 0, "a deed needs at least one of won, threat, kills");
export type DeedNeeds = z.infer<typeof DeedNeeds>;

/** A deed (an achievement): earned once, kept in the save, shown on the grid, and Steam's. */
export const Deed = z.strictObject({
  $schema: SchemaRef,
  /** The player's words: the deed's name and what it asks. */
  name: z.string().min(1),
  text: z.string().min(1),
  needs: DeedNeeds,
});
export type Deed = z.infer<typeof Deed>;
