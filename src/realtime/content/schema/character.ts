import { z } from "zod";
import { SchemaRef } from "@/content/schema/vocab";
import { Activation, ActorStats, SlotId } from "@/realtime/content/schema/vocab";

export const Character = z.strictObject({
  $schema: SchemaRef,
  stats: ActorStats,
  slots: z.array(z.strictObject({ id: SlotId, activation: Activation })).min(1),
});
export type Character = z.infer<typeof Character>;
