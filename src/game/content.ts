import type { Kind } from "@/content/kinds";
import { Build } from "@/game/schema/build";
import { Threat } from "@/game/schema/threat";

/**
 * The game's own content folders, compiled beside the kit's (src/content/kinds.ts) into
 * `SimContent`. Each is a collection: one file per id.
 */
export const GAME_KINDS = {
  builds: { path: "builds", schemaName: "build", schema: Build, collection: true },
  threats: { path: "threats", schemaName: "threat", schema: Threat, collection: true },
} satisfies Record<string, Kind<unknown> & { collection: true }>;
