import { describe, expect, it } from "vitest";
import { Threat } from "@/game/schema/threat";

const base = { $schema: "../schema/threat.schema.json", durationS: 60, maxAlive: 120 };

describe("Threat schema", () => {
  it("accepts rate ramps and timed spawns, and defaults enemyMods to []", () => {
    const t = Threat.parse({
      ...base,
      spawns: [
        { enemy: "snail", from: 0, to: 60, rate: [0.8, 1.6], pattern: "edge" },
        { enemy: "bat", at: 20, count: 3, pattern: "edge" },
      ],
    });
    expect(t.enemyMods).toEqual([]);
    expect("at" in t.spawns[1]).toBe(true);
  });

  it("rejects an entry that mixes a ramp and a timed spawn", () => {
    const r = Threat.safeParse({
      ...base,
      spawns: [{ enemy: "snail", from: 0, to: 60, rate: [1, 2], at: 5, pattern: "edge" }],
    });
    expect(r.success).toBe(false);
  });

  it("allows an empty spawn list (tests place enemies themselves)", () => {
    expect(Threat.safeParse({ ...base, spawns: [] }).success).toBe(true);
  });

  it("accepts a timed ring spawn with a radius", () => {
    const t = Threat.parse({
      ...base,
      spawns: [{ enemy: "snail", at: 0, count: 6, pattern: "ring", radius: 220 }],
    });
    expect(t.spawns[0]).toMatchObject({ pattern: "ring", radius: 220 });
  });

  it("rejects ring without a radius", () => {
    const r = Threat.safeParse({
      ...base,
      spawns: [{ enemy: "snail", at: 0, count: 6, pattern: "ring" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects edge with a radius", () => {
    const r = Threat.safeParse({
      ...base,
      spawns: [{ enemy: "snail", at: 0, count: 6, pattern: "edge", radius: 220 }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects ring on a ramp spawn (ramps stay edge only)", () => {
    const r = Threat.safeParse({
      ...base,
      spawns: [{ enemy: "snail", from: 0, to: 60, rate: [1, 2], pattern: "ring", radius: 220 }],
    });
    expect(r.success).toBe(false);
  });

  const field = {
    enemy: "snail",
    at: 0,
    count: 8,
    pattern: "field",
    minDistance: 140,
    maxDistance: 240,
    warnS: 2,
  };

  it("accepts a timed field spawn with distances and a warning", () => {
    const t = Threat.parse({ ...base, spawns: [field] });
    expect(t.spawns[0]).toMatchObject(field);
  });

  it.each(["minDistance", "maxDistance", "warnS"])("rejects field without %s", (key) => {
    const s: Record<string, unknown> = { ...field };
    delete s[key];
    expect(Threat.safeParse({ ...base, spawns: [s] }).success).toBe(false);
  });

  it("rejects field with a radius, and a negative warning", () => {
    expect(Threat.safeParse({ ...base, spawns: [{ ...field, radius: 200 }] }).success).toBe(false);
    expect(Threat.safeParse({ ...base, spawns: [{ ...field, warnS: -1 }] }).success).toBe(false);
  });
});
