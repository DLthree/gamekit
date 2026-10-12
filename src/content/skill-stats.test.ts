import { describe, expect, it } from "vitest";
import type { StatMod } from "@/content/schema/vocab";
import { hasSkillStat, modApplies, SKILL_STAT_IDS } from "@/content/skill-stats";

describe("hasSkillStat", () => {
  const stats = { damage: { fire: 1 }, range: 100, knockback: 0, area: 20 };

  it("is true for a base number in the skill file", () => {
    expect(hasSkillStat(stats, "area", [], ["area"])).toBe(true);
    expect(hasSkillStat(stats, "duration", [], ["area"])).toBe(false);
  });

  it("is true when an applicable flat line creates the stat, and only then", () => {
    const flat: StatMod = { stat: "duration", op: "flat", value: 4.5, if: [] };
    const more: StatMod = { stat: "duration", op: "more", value: 1, if: [] };
    const tagged: StatMod = { stat: "duration", op: "flat", value: 4.5, if: ["duration"] };
    expect(hasSkillStat(stats, "duration", [flat], ["area"])).toBe(true);
    expect(hasSkillStat(stats, "duration", [more], ["area"])).toBe(false);
    expect(hasSkillStat(stats, "duration", [tagged], ["area"])).toBe(false);
    expect(hasSkillStat(stats, "duration", [tagged], ["area", "duration"])).toBe(true);
  });

  it("lists the new skill stats", () => {
    expect(SKILL_STAT_IDS).toEqual(expect.arrayContaining(["duration", "pulse", "pierce"]));
  });

  it("modApplies needs every condition tag", () => {
    const m: StatMod = { stat: "area", op: "increased", value: 1, if: ["fire", "area"] };
    expect(modApplies(m, ["fire"])).toBe(false);
    expect(modApplies(m, ["fire", "area", "spell"])).toBe(true);
  });
});
