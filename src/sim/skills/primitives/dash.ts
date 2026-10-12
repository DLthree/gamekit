import { TICK_S, ticks } from "@/core/clock";
import { getActor } from "@/sim/actors/store";
import { skillStat } from "@/sim/skills/instance";
import type { Delivery, World } from "@/sim/world";

/**
 * Moves the owner in a straight line over the skill's `duration`, covering its `range`. Reads
 * the skill (not the node): a dash node carries no numbers of its own. Starts on the tick after
 * its parent ended, like every `onEnd` child. If the owner is gone or already dead, it does
 * nothing: it never reaches into a new actor that reused the owner's slot.
 */
export function dash(world: World, d: Delivery): void {
  const owner = getActor(world.actors, d.owner);
  if (owner === null || owner.hp <= 0) return;
  const s = d.skill;
  const dashTicks = Math.max(1, ticks(skillStat(s, "duration")));
  const speed = skillStat(s, "range") / (dashTicks * TICK_S);
  owner.dashTicks = dashTicks;
  owner.dashVX = d.dirX * speed;
  owner.dashVY = d.dirY * speed;
}
