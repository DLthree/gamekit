import { kite } from "@/game/kite-bot";
import type { Command } from "@/sim/command";
import type { World } from "@/sim/world";

/** The bots `?bot=` can name; each plays a tick in place of the controls. */
export const BOTS = { kite } satisfies Record<string, (w: World) => Command>;
export type BotId = keyof typeof BOTS;
