import { describe, expect, it } from "vitest";
import { mergeSkill } from "@/realtime/content/loadout";
import { TICK_HZ } from "@/realtime/core/clock";
import { resolveSkill, skillStat } from "@/realtime/sim/skills/instance";
import { testContent } from "@/realtime/test/content";
import { DMG_A, damageOf, TAG_B, TAG_C } from "@/realtime/test/vocab";

describe("resolveSkill", () => {
  const c = testContent();

  it("resolves base stats and damage, and turns rate into an interval in ticks", () => {
    const zap = resolveSkill(mergeSkill("zap", c.sim.skills.zap, [], {}), []);
    expect(zap.damage).toEqual(damageOf({ [DMG_A]: 5 }));
    expect(skillStat(zap, "range")).toBe(200);
    expect(zap.intervalTicks).toBe(TICK_HZ / 2);
  });

  it("uses the cooldown for manual skills and applies tagged mods with a breakdown", () => {
    const boom = resolveSkill(mergeSkill("boom", c.sim.skills.boom, [], {}), [
      {
        mod: { stat: "area", op: "increased", value: 0.5, if: [TAG_B] },
        source: "builds/hero.json tier 1",
      },
      {
        mod: { stat: "damage", op: "more", value: 1, if: [TAG_C] },
        source: "builds/hero.json tier 1",
      },
    ]);
    expect(skillStat(boom, "area")).toBe(75);
    expect(boom.breakdown.area.lines).toEqual([
      { source: "builds/hero.json tier 1", op: "increased", value: 0.5 },
    ]);
    expect(boom.damage[DMG_A]).toBe(10);
    expect(boom.intervalTicks).toBe(TICK_HZ);
  });

  it("throws when code reads a stat the skill does not have", () => {
    const zap = resolveSkill(mergeSkill("zap", c.sim.skills.zap, [], {}), []);
    expect(() => skillStat(zap, "area")).toThrow("skill zap has no area");
  });

  it("resolves a stat a flat line creates from base 0, with the line in the breakdown", () => {
    const boom = resolveSkill(mergeSkill("boom", c.sim.skills.boom, [], {}), [
      { mod: { stat: "duration", op: "flat", value: 4.5, if: [] }, source: "test" },
      { mod: { stat: "duration", op: "increased", value: 1, if: [] }, source: "test" },
    ]);
    expect(skillStat(boom, "duration")).toBe(9);
    expect(boom.breakdown.duration.base).toBe(0);
    expect(() => skillStat(boom, "pulse")).toThrow("skill boom has no pulse");
  });
});
