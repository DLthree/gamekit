import { tickDirector } from "@/game/wave/director";
import { checkOutcome } from "@/game/wave/outcome";
import type { World } from "@/sim/world";

/** Phase 9: the threat's timeline queues spawns, the wave clock advances, and the wave may end. */
export function tickWave(world: World): void {
  tickDirector(world);
  world.wave.elapsed += 1;
  checkOutcome(world);
}
