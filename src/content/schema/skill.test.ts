import { describe, expect, it } from "vitest";
import { Skill } from "@/content/schema/skill";

const fireball = {
  $schema: "../schema/skill.schema.json",
  tags: ["spell", "projectile", "area", "fire"],
  activation: "manual",
  target: "aim",
  stats: {
    damage: { fire: 6 },
    cooldown: 2.5,
    range: 380,
    area: 60,
    projectileSpeed: 300,
    projectileCount: 1,
    spread: 0,
    knockback: 520,
  },
  deliver: {
    do: "projectile",
    multishot: "fan",
    impact: "trigger",
    radius: 8,
    vfx: "fireball",
    onEnd: [{ do: "burst", shape: { kind: "circle" }, vfx: "explosion", hitStop: true }],
  },
};

describe("Skill schema", () => {
  it("parses a delivery tree and fills node defaults", () => {
    const s = Skill.parse(fireball);
    if (s.deliver.do !== "projectile") throw new Error("fireball's root is a projectile");
    expect(s.deliver.damageScale).toBe(1);
    const burst = s.deliver.onEnd[0];
    expect(burst.do).toBe("burst");
    expect(burst.onEnd).toEqual([]);
    if (burst.do === "burst") {
      expect(burst.areaScale).toBe(1);
      expect(burst.hitStop).toBe(true);
    }
  });

  it("names the path of a bad nested field", () => {
    const bad = structuredClone(fireball);
    bad.deliver.onEnd[0].shape = { kind: "square" };
    const r = Skill.safeParse(bad);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path.join(".")).toMatch(/^deliver\.onEnd\.0\.shape/);
  });

  it("requires impact and multishot on projectiles and halfAngleDeg on arcs", () => {
    const noImpact = structuredClone(fireball) as Record<string, unknown>;
    noImpact.deliver = { do: "projectile", multishot: "fan", radius: 8, vfx: "fireball" };
    expect(Skill.safeParse(noImpact).success).toBe(false);
    const noMultishot = structuredClone(fireball) as Record<string, unknown>;
    noMultishot.deliver = { do: "projectile", impact: "trigger", radius: 8, vfx: "fireball" };
    expect(Skill.safeParse(noMultishot).success).toBe(false);
    const arc = structuredClone(fireball) as Record<string, unknown>;
    arc.deliver = { do: "burst", shape: { kind: "arc" }, vfx: "none" };
    expect(Skill.safeParse(arc).success).toBe(false);
  });

  it("rejects unknown keys and unknown tags", () => {
    expect(Skill.safeParse({ ...fireball, colour: "red" }).success).toBe(false);
    expect(Skill.safeParse({ ...fireball, tags: ["lightning"] }).success).toBe(false);
  });
});
