import { describe, expect, it } from "vitest";
import { DAMAGE_TYPES, TAGS } from "@/game/vocab";
import { StatMod } from "@/realtime/content/schema/vocab";

describe("vocab", () => {
  it("every damage type is also a tag (damage type is an implicit tag)", () => {
    for (const t of DAMAGE_TYPES) expect(TAGS).toContain(t);
  });

  it("a StatMod without a condition gets if: []", () => {
    expect(StatMod.parse({ stat: "area", op: "increased", value: 0.25 })).toEqual({
      stat: "area",
      op: "increased",
      value: 0.25,
      if: [],
    });
  });

  it("rejects an unknown stat id and an unknown key", () => {
    expect(StatMod.safeParse({ stat: "fireDamage", op: "flat", value: 1 }).success).toBe(false);
    expect(StatMod.safeParse({ stat: "area", op: "flat", value: 1, typo: 1 }).success).toBe(false);
  });
});
