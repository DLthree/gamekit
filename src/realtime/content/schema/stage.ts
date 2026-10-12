import { z } from "zod";
import { ContentId, SchemaRef } from "@/content/schema/vocab";

/**
 * A bench: an isolated scene for looking at a few enemies or effects, opened with
 * `?stage=<id>&dev=1`. The listed enemies stand at their places (respawning if asked) around the
 * player, with no wave spawns; the player's life never drops below 1, so the bench runs its whole
 * duration.
 */
export const Stage = z.strictObject({
  $schema: SchemaRef,
  name: z.string().min(1),
  /**
   * The game address whose player and enemy stats the stage borrows (e.g. a cell's query); the
   * game resolves it, and its waves never run.
   */
  from: z.string().min(1),
  durationS: z.number().positive(),
  /** The player uses its skills; unarmed, it only moves (hits on it still land and show). */
  armed: z.boolean(),
  /** Enemies stay where they're placed (they still turn and attack). */
  hold: z.boolean(),
  actors: z
    .array(
      z.strictObject({
        enemy: ContentId,
        /** World position; the player starts at the origin. */
        x: z.number(),
        y: z.number(),
        /** Seconds after it dies until the same enemy stands at its place again; absent, never. */
        respawnS: z.number().positive().optional(),
      }),
    )
    .min(1),
});
export type Stage = z.infer<typeof Stage>;
