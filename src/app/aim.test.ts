import { describe, expect, it } from "vitest";
import { buildAim } from "@/app/aim";
import type { ControlState } from "@/input/controls";
import type { ResolvedSkill, SkillInstance } from "@/sim/skills/instance";

const skill: ResolvedSkill = {
  id: "boom",
  def: {} as ResolvedSkill["def"],
  deliver: {} as ResolvedSkill["deliver"],
  tags: [],
  damage: { fire: 0, physical: 0 },
  stats: { range: 300, area: 50 },
  breakdown: {},
  intervalTicks: 60,
};

function cast(readyTick: number): SkillInstance {
  return { skill, slot: "cast", readyTick };
}

const aiming: ControlState = {
  pressed: true,
  aiming: true,
  cancelArmed: false,
  aimX: 1,
  aimY: 0,
};

describe("buildAim", () => {
  it("is null when controls are absent or not aiming", () => {
    expect(buildAim({ x: 0, y: 0 }, cast(0), 10, null)).toBeNull();
    expect(buildAim({ x: 0, y: 0 }, cast(0), 10, { ...aiming, aiming: false })).toBeNull();
  });

  it("marks the aim ready once the cast skill's cooldown has elapsed", () => {
    const readyAt10 = buildAim({ x: 0, y: 0 }, cast(10), 10, aiming);
    expect(readyAt10?.ready).toBe(true);

    const readyAt11 = buildAim({ x: 0, y: 0 }, cast(11), 10, aiming);
    expect(readyAt11?.ready).toBe(false);
  });

  it("carries the player position, aim direction, range, area and cancel state through", () => {
    const aim = buildAim({ x: 5, y: 6 }, cast(0), 10, { ...aiming, cancelArmed: true });
    expect(aim).toEqual({
      x: 5,
      y: 6,
      dirX: 1,
      dirY: 0,
      length: 300,
      radius: 50,
      cancel: true,
      ready: true,
    });
  });
});
