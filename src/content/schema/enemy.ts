import { z } from "zod";
import { ActorStats, ContentId, Role, SchemaRef } from "@/content/schema/vocab";

export const Behavior = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("chase") }),
  /** Approaches past `distance × 1.1`, backs off inside `distance × 0.9`, else holds still. */
  z.strictObject({ kind: z.literal("keepDistance"), distance: z.number().positive() }),
]);
export type Behavior = z.infer<typeof Behavior>;

export const Enemy = z.strictObject({
  $schema: SchemaRef,
  role: Role,
  stats: ActorStats,
  behavior: Behavior,
  skills: z.array(ContentId).min(1),
  /** A creature profile in look/creatures.json. */
  look: ContentId,
});
export type Enemy = z.infer<typeof Enemy>;
