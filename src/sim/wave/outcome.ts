import { playerOf, type World } from "@/sim/world";

/** Phase 9 (end): the wave is lost when the player's HP is gone, won when the timer runs out. */
export function checkOutcome(world: World): void {
  const died = playerOf(world).hp <= 0;
  if (!died && world.wave.elapsed < world.durationTicks) return;
  const outcome = died ? "died" : "survived";
  world.outcome = outcome;
  world.phase = "ended";
  world.report.ticks = world.wave.elapsed;
  world.events.push({ t: "waveEnded", tick: world.tick, outcome });
}
