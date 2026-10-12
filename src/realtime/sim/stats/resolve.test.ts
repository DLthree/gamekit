import { describe, expect, it } from "vitest";
import type { SourcedMod, StatMod } from "@/content/schema/vocab";
import { ticks } from "@/core/clock";
import { STAT_CLAMPS } from "@/realtime/sim/stats/ids";
import { resolveActorStats, resolveDamage, resolveStat } from "@/realtime/sim/stats/resolve";
import { DMG_A, DMG_B, second, TAG_A, TAG_B, TAG_C } from "@/realtime/test/vocab";

function mod(
  stat: StatMod["stat"],
  op: StatMod["op"],
  value: number,
  tags: StatMod["if"] = [],
): SourcedMod {
  return { mod: { stat, op, value, if: tags }, source: "test" };
}

describe("resolveStat", () => {
  it("adds flats, sums increased and multiplies more", () => {
    const r = resolveStat(
      "area",
      40,
      [
        mod("area", "flat", 10),
        mod("area", "increased", 0.2),
        mod("area", "increased", 0.2),
        mod("area", "more", 0.2),
        mod("area", "more", 0.2),
      ],
      [TAG_A],
    );
    expect(r.value).toBeCloseTo(50 * 1.4 * 1.44);
    expect(r.base).toBe(40);
    expect(r.lines).toHaveLength(5);
  });

  it("applies a conditioned mod only when the skill has every tag", () => {
    const both = mod("area", "increased", 0.5, [TAG_A, TAG_B]);
    expect(resolveStat("area", 10, [both], [TAG_B]).value).toBe(10);
    expect(resolveStat("area", 10, [both], [TAG_B, TAG_A, TAG_C]).value).toBe(15);
  });

  it("ignores mods for other stats and keeps them out of the breakdown", () => {
    const r = resolveStat("range", 100, [mod("area", "flat", 5)], []);
    expect(r.value).toBe(100);
    expect(r.lines).toEqual([]);
  });

  it("clamps to the stat's range", () => {
    expect(resolveStat("knockbackResist", 0.5, [mod("knockbackResist", "flat", 2)], []).value).toBe(
      1,
    );
    expect(resolveStat("cooldown", 1, [mod("cooldown", "more", -0.999)], []).value).toBe(0.05);
  });
});

describe("resolveDamage", () => {
  it.skipIf(DMG_B === null)("treats each damage type as an implicit tag of its portion", () => {
    const b = second();
    const d = resolveDamage(
      { [DMG_A]: 10, [b]: 10 },
      [mod("damage", "increased", 1, [DMG_A]), mod("damage", "flat", 2, [b])],
      [TAG_A],
    );
    expect(d[DMG_A].value).toBe(20);
    expect(d[b].value).toBe(12);
  });

  it.skipIf(DMG_B === null)("leaves types absent from the base at 0", () => {
    const b = second();
    const d = resolveDamage({ [DMG_A]: 5 }, [mod("damage", "flat", 3, [b])], []);
    expect(d[b].value).toBe(0);
    expect(d[b].lines).toEqual([]);
  });
});

describe("resolveActorStats", () => {
  it("resolves every actor stat with unconditioned mods", () => {
    const s = resolveActorStats({ life: 10, moveSpeed: 20, radius: 9, knockbackResist: 0 }, [
      mod("life", "more", 0.5),
      mod("moveSpeed", "increased", 0.15),
    ]);
    expect(s).toEqual({ life: 15, moveSpeed: 23, radius: 9, knockbackResist: 0 });
  });
});

describe("STAT_CLAMPS", () => {
  it("keep every resolved zone above the zone floor, whatever the mods", () => {
    // Content checks only a skill file's base duration/pulse; the sim trusts the clamps for the
    // rest, so a clamp change that lets a zone end before it pulses must fail here.
    expect(ticks(STAT_CLAMPS.duration[0])).toBeGreaterThanOrEqual(2);
    expect(ticks(STAT_CLAMPS.pulse[0])).toBeGreaterThanOrEqual(1);
    const shrink = [mod("duration", "more", -1), mod("pulse", "more", -1)];
    expect(ticks(resolveStat("duration", 0, shrink, []).value)).toBeGreaterThanOrEqual(2);
    expect(ticks(resolveStat("pulse", 0, shrink, []).value)).toBeGreaterThanOrEqual(1);
  });
});
