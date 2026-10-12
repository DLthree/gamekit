import { kite } from "@/game/kite-bot";
import type { Command } from "@/realtime/sim/command";
import type { World } from "@/realtime/sim/world";

/** The bots `?bot=` can name; each plays a tick in place of the controls. */
export const BOTS = { kite } satisfies Record<string, (w: World) => Command>;
export type BotId = keyof typeof BOTS;
export const BOT_IDS = Object.keys(BOTS) as BotId[];
