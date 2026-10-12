import type { Stage } from "@/realtime/content/schema/stage";
import { ticks } from "@/realtime/core/clock";
import type { Id } from "@/realtime/core/ids";
import { getActor } from "@/realtime/sim/actors/store";
import type { World } from "@/realtime/sim/world";

/** One placed stage actor: who stands there now, or when it next does (null: never again). */
export interface StageSlot {
  def: string;
  x: number;
  y: number;
  respawnTicks: number | null;
  id: Id | null;
  dueTick: number | null;
}

/** A running stage (content/stages): its id and its places. */
export interface StageState {
  id: string;
  slots: StageSlot[];
}

/** A stage's places, each due on the first tick. */
export function createStageState(id: string, stage: Stage): StageState {
  return {
    id,
    slots: stage.actors.map((a) => ({
      def: a.enemy,
      x: a.x,
      y: a.y,
      respawnTicks: a.respawnS === undefined ? null : ticks(a.respawnS),
      id: null,
      dueTick: 0,
    })),
  };
}

/**
 * Phase 9 on a stage, in place of the game's wave timeline: a dead actor's place comes due
 * `respawnS` later, and a due place queues its enemy (drainSpawns names the slot's new actor).
 */
export function tickStage(world: World): void {
  const stage = world.stage;
  if (stage === null) throw new Error("tickStage on a world with no stage");
  for (const [i, slot] of stage.slots.entries()) {
    if (slot.id !== null) {
      const a = getActor(world.actors, slot.id);
      if (a !== null && a.hp > 0) continue;
      slot.id = null;
      slot.dueTick = slot.respawnTicks === null ? null : world.tick + slot.respawnTicks;
    }
    if (slot.dueTick !== null && world.tick >= slot.dueTick) {
      slot.dueTick = null;
      world.spawns.enemies.push({ def: slot.def, x: slot.x, y: slot.y, stageSlot: i });
    }
  }
}
