import { recordEvents } from "@/game/report";
import { tickDirector } from "@/game/wave/director";
import { checkOutcome } from "@/game/wave/outcome";
import { applyCommand, indexActors, moveActors } from "@/sim/actors/movement";
import { releaseActor } from "@/sim/actors/store";
import { thinkEnemies } from "@/sim/ai/think";
import type { Command } from "@/sim/command";
import { thinkSkills } from "@/sim/skills/activate";
import { activate } from "@/sim/skills/deliver";
import { drainSpawns } from "@/sim/spawn-queue";
import { applyHits, collectHits, endVolumes } from "@/sim/volumes/hits";
import { moveVolumes } from "@/sim/volumes/motion";
import { releaseVolume } from "@/sim/volumes/store";
import type { World } from "@/sim/world";

/** Phase 10 (start): the sim forgets the dead and the ended; their events already went out. */
function cleanup(world: World): void {
  for (const a of world.actors.items) {
    if (a.alive && a.hp <= 0 && a.id !== world.playerId) releaseActor(world.actors, a);
  }
  for (const v of world.volumes.items) {
    if (v.alive && v.ended) releaseVolume(world.volumes, v);
  }
}

/** One tick. The phase order is a design decision; keep it readable here. */
export function step(world: World, command: Command): void {
  world.events.clear();
  if (world.phase === "ended") return;
  if (world.freezeTicks > 0) {
    world.freezeTicks -= 1;
    return;
  }
  world.tick += 1;
  if (world.phase === "countdown") {
    if (world.tick >= world.countdownTicks) world.phase = "playing";
    return;
  }
  // 1. apply command
  applyCommand(world, command);
  // 2. think
  thinkEnemies(world);
  thinkSkills(world);
  // 3. activate
  activate(world);
  // 4. move
  moveActors(world);
  moveVolumes(world);
  // 5. index
  indexActors(world);
  // 6. hit
  collectHits(world);
  // 7. resolve
  applyHits(world);
  endVolumes(world);
  // 8. triggers: reserved; nothing reacts to this tick's events inside the sim
  // 9. wave
  tickDirector(world);
  world.wave.elapsed += 1;
  checkOutcome(world);
  // 10. cleanup + spawn
  cleanup(world);
  drainSpawns(world);
  recordEvents(world.report, world.events.items);
}
