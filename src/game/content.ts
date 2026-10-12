import { type KindTree, kind } from "@/content/kind";
import { Build } from "@/game/schema/build";
import { Deed } from "@/game/schema/deed";
import { Threat } from "@/game/schema/threat";
import { REALTIME_KINDS } from "@/realtime/content/kinds";

/**
 * The game's content kinds, compiled beside the kit's (src/content/kinds.ts) into `Content`:
 * the real-time layer's, then the example's own folders (one file per id).
 */
export const GAME_KINDS = {
  sim: {
    ...REALTIME_KINDS.sim,
    builds: kind("builds", "build", Build, true),
    threats: kind("threats", "threat", Threat, true),
    deeds: kind("deeds", "deed", Deed, true),
  },
  look: REALTIME_KINDS.look,
} satisfies { sim: KindTree; look: KindTree };
