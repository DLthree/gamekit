import { z } from "zod";
import { ContentId, SchemaRef } from "@/content/schema/vocab";
import { DeliveryNode, LookKind, Multishot, PrimitiveKind } from "@/realtime/content/schema/skill";
import { StatMod, Tag } from "@/realtime/content/schema/vocab";

/** An action a modifier adds under every node of one primitive kind in its skill's tree. */
export const Attach = z.strictObject({
  to: PrimitiveKind,
  /** One hook: the action runs where the node ended. */
  hook: z.enum(["onEnd"]),
  action: DeliveryNode,
  /** Each time the hook fires, the action runs with this chance (world RNG); absent, always. */
  chance: z.number().gt(0).max(1).optional(),
});

/**
 * A doc-06 modifier, attached to one skill in a loadout. It may require tags, add or remove
 * tags, add skill-local StatMods, attach actions, swap the multishot pattern of every projectile
 * node, and swap vfx by primitive kind.
 */
export const Modifier = z.strictObject({
  $schema: SchemaRef,
  requires: z.array(Tag).default([]),
  addTags: z.array(Tag).default([]),
  removeTags: z.array(Tag).default([]),
  stats: z.array(StatMod).default([]),
  attach: z.array(Attach).default([]),
  multishot: Multishot.optional(),
  look: z.partialRecord(LookKind, ContentId).default({}),
});
export type Modifier = z.infer<typeof Modifier>;
