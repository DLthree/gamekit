import { describe, expect, it } from "vitest";
import type { StatMod } from "@/content/schema/vocab";
import { hasSkillStat, modApplies, SKILL_STAT_IDS } from "@/content/skill-stats";
import { DMG_A, TAG_A, TAG_B } from "@/test/vocab";

describe("hasSkillStat", () => {
  const stats = { damage: { [DMG_A]: 1 }, range: 100, knockback: 0, area: 20 };

  it("is true for a base number in the skill file", () => {
    expect(hasSkillStat(stats, "area", [], [TAG_A])).toBe(true);
    expect(hasSkillStat(stats, "duration", [], [TAG_A])).toBe(false);
  });

  it("is true when an applicable flat line creates the stat, and only then", () => {
    const flat: StatMod = { stat: "duration", op: "flat", value: 4.5, if: [] };
    const more: StatMod = { stat: "duration", op: "more", value: 1, if: [] };
    const tagged: StatMod = { stat: "duration", op: "flat", value: 4.5, if: [TAG_B] };
    expect(hasSkillStat(stats, "duration", [flat], [TAG_A])).toBe(true);
    expect(hasSkillStat(stats, "duration", [more], [TAG_A])).toBe(false);
    expect(hasSkillStat(stats, "duration", [tagged], [TAG_A])).toBe(false);
    expect(hasSkillStat(stats, "duration", [tagged], [TAG_A, TAG_B])).toBe(true);
  });

  it("lists the new skill stats", () => {
    expect(SKILL_STAT_IDS).toEqual(expect.arrayContaining(["duration", "pulse", "pierce"]));
  });

  it("modApplies needs every condition tag", () => {
    const m: StatMod = { stat: "area", op: "increased", value: 1, if: [DMG_A, TAG_A] };
    expect(modApplies(m, [DMG_A])).toBe(false);
    expect(modApplies(m, [DMG_A, TAG_A, TAG_B])).toBe(true);
  });
});
