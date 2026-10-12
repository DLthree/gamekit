import type { Actor } from "@/sim/actors/store";
import type { World } from "@/sim/world";

/**
 * The game's own enemy behaviours, beside the kit's (chase, keepDistance): an enemy file names
 * one as `behavior: { kind: "game", id }`. Each runs in step phase 2 and sets the actor's move
 * intent (moveX, moveY, length ≤ 1) for the tick; per-actor state belongs in the game's
 * WaveState (`world.wave`). The example has none.
 */
export const BEHAVIORS: Record<string, (world: World, actor: Actor) => void> = {};
