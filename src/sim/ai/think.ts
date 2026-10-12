import { chase, keepDistance } from "@/sim/ai/behaviors";
import { playerOf, type World } from "@/sim/world";

/** Phase 2 (AI): every enemy picks its move intent from its behaviour. */
export function thinkEnemies(world: World): void {
  const player = playerOf(world);
  for (const a of world.actors.items) {
    if (!a.alive || a.hp <= 0 || a.team !== "enemy") continue;
    const behavior = world.content.enemies[a.def].behavior;
    switch (behavior.kind) {
      case "chase":
        chase(a, player);
        break;
      case "keepDistance":
        keepDistance(a, player, behavior.distance);
        break;
    }
  }
}
