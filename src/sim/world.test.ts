import { describe, expect, it } from "vitest";
import { ScenarioError } from "@/game/scenario";
import { createWorld, playerOf } from "@/sim/world";
import { testContent } from "@/test/content";
import { place, run, TEST_SCENARIO, testWorld } from "@/test/world";

describe("createWorld", () => {
  it("places the player at the arena centre with the build's skills in slot order", () => {
    const w = testWorld();
    const p = playerOf(w);
    expect([p.x, p.y, p.hp, p.team, p.role]).toEqual([0, 0, 100, "player", "player"]);
    expect(p.skills.map((s) => [s.slot, s.skill.id])).toEqual([
      ["auto", "zap"],
      ["cast", "boom"],
    ]);
  });

  it("applies the build tier's StatMods to the player's skills and stats", () => {
    const tier = {
      loadout: { auto: { skill: "zap" }, cast: { skill: "boom" } },
      stats: [
        { stat: "area", op: "increased", value: 0.2 },
        { stat: "life", op: "more", value: 0.5 },
      ],
    };
    const w = testWorld({
      "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] },
    });
    const p = playerOf(w);
    expect(p.maxHp).toBe(150);
    expect(p.skills[1].skill.stats.area).toBe(60);
    expect(p.skills[1].skill.breakdown.area.lines[0].source).toBe("builds/hero.json tier 1");
  });

  it("stops with the file name when a tier isn't authored", () => {
    expect(() => testWorld({}, { buildTier: 4 })).toThrow(ScenarioError);
    expect(() => testWorld({}, { buildTier: 4 })).toThrow(
      "builds/hero.json has 3 tiers; build tier 4 is not authored",
    );
    expect(() => testWorld({}, { threatTier: 3 })).toThrow("threats/tier-3.json does not exist");
    expect(() => testWorld({}, { character: "rogue" })).toThrow("no character rogue");
  });

  const twin = { stats: [{ stat: "projectileCount", op: "flat", value: 1 }] };
  const linger = { addTags: ["duration"] };
  function withTier(tier: Record<string, unknown>) {
    return {
      "modifiers/twin.json": twin,
      "modifiers/linger.json": linger,
      "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] },
    };
  }

  it("applies a slot's modifiers, with the modifier named in the breakdown", () => {
    const w = testWorld(
      withTier({
        loadout: {
          auto: { skill: "zap", modifiers: ["twin", "linger"] },
          cast: { skill: "boom" },
        },
      }),
    );
    const zap = playerOf(w).skills[0].skill;
    expect(zap.stats.projectileCount).toBe(2);
    expect(zap.breakdown.projectileCount.lines[0].source).toBe("modifiers/twin.json");
    expect(zap.tags).toContain("duration");
  });

  it("filters the tier's StatMods by the tags modifiers added", () => {
    const w = testWorld(
      withTier({
        loadout: {
          auto: { skill: "zap", modifiers: ["twin", "linger"] },
          cast: { skill: "boom" },
        },
        stats: [{ stat: "range", op: "increased", value: 1, if: ["duration"] }],
      }),
    );
    const [zap, boom] = playerOf(w).skills.map((s) => s.skill);
    expect(zap.stats.range).toBe(400);
    expect(boom.stats.range).toBe(300);
  });

  it("puts the tier's look on the volumes the merged tree makes", () => {
    const w = testWorld(
      withTier({
        loadout: {
          auto: { skill: "zap", modifiers: ["twin", "linger"] },
          cast: { skill: "boom" },
        },
        look: { "zap.projectile": "boom" },
      }),
    );
    place(w, "dummy", 100, 0);
    const started = run(w, 30).filter((e) => e.t === "volumeStarted");
    expect(started.length).toBeGreaterThan(0);
    expect(started.every((e) => e.t === "volumeStarted" && e.vfx === "boom")).toBe(true);
  });

  it("stops before a projectile could step through the smallest enemy", () => {
    // The content check rejects this, so patch compiled content to reach the assertion.
    const sim = testContent().sim;
    const zap = sim.skills.zap;
    const fast = {
      ...sim,
      skills: { ...sim.skills, zap: { ...zap, stats: { ...zap.stats, projectileSpeed: 3000 } } },
    };
    expect(() => createWorld(TEST_SCENARIO, fast)).toThrow(ScenarioError);
    expect(() => createWorld(TEST_SCENARIO, fast)).toThrow(
      "builds/hero.json tier 1: zap projectiles move 50.0 a tick, more than 28",
    );
  });
});
