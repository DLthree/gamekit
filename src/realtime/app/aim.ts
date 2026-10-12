import type { Vec } from "@/core/vec";
import type { ControlState } from "@/realtime/input/controls";
import type { AimDraw } from "@/realtime/render/aim-view";
import { type SkillInstance, skillStat } from "@/realtime/sim/skills/instance";

/** Builds the aim indicator for this frame from the player, the cast skill and the controls. */
export function buildAim(
  player: Vec,
  cast: SkillInstance,
  tick: number,
  controls: ControlState | null,
): AimDraw | null {
  if (controls === null || !controls.aiming) return null;
  return {
    x: player.x,
    y: player.y,
    dirX: controls.aimX,
    dirY: controls.aimY,
    length: skillStat(cast.skill, "range"),
    radius: skillStat(cast.skill, "area"),
    cancel: controls.cancelArmed,
    ready: cast.readyTick <= tick,
  };
}
