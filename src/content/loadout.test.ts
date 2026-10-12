import { describe, expect, it } from "vitest";
import { type AppliedModifier, mergeSkill, nodesOf } from "@/content/loadout";
import { Modifier } from "@/content/schema/modifier";
import { testContent } from "@/test/content";

const boom = testContent().sim.skills.boom;

function mod(id: string, body: Record<string, unknown>): AppliedModifier {
  return { id, def: Modifier.parse({ $schema: "../schema/modifier.schema.json", ...body }) };
}

const lingering = mod("lingering", {
  requires: ["area"],
  addTags: ["duration"],
  stats: [
    { stat: "duration", op: "flat", value: 2 },
    { stat: "pulse", op: "flat", value: 0.5 },
  ],
  attach: [
    {
      to: "burst",
      hook: "onEnd",
      action: { do: "zone", motion: "static", vfx: "none", areaScale: 0.5 },
    },
  ],
});

const echo = (id: string) =>
  mod(id, {
    attach: [
      {
        to: "burst",
        hook: "onEnd",
        action: { do: "burst", shape: { kind: "circle" }, vfx: "blast" },
      },
    ],
  });

describe("mergeSkill", () => {
  it("adds and removes tags in order and labels the modifiers' StatMods", () => {
    const m = mergeSkill("boom", boom, [lingering, mod("dry", { removeTags: ["fire"] })], {});
    expect(m.tags).toEqual(["spell", "projectile", "area", "duration"]);
    expect(m.mods.map((s) => [s.mod.stat, s.source])).toEqual([
      ["duration", "modifiers/lingering.json"],
      ["pulse", "modifiers/lingering.json"],
    ]);
  });

  it("attaches under every node of the named kind and never touches the content", () => {
    const m = mergeSkill("boom", boom, [lingering], {});
    expect(nodesOf(m.deliver, "burst")[0].onEnd.map((n) => n.do)).toEqual(["zone"]);
    expect(nodesOf(boom.deliver, "zone")).toEqual([]);
  });

  it("attaches to the nodes that existed before each modifier, not to its own additions", () => {
    expect(nodesOf(mergeSkill("boom", boom, [echo("a")], {}).deliver, "burst")).toHaveLength(2);
    const twice = mergeSkill("boom", boom, [echo("a"), echo("b")], {});
    expect(nodesOf(twice.deliver, "burst")).toHaveLength(4);
  });

  it("swaps vfx by kind: modifier looks in order, then the tier's look for this skill", () => {
    const flame = mod("flame", { look: { projectile: "zap", burst: "none" } });
    const m = mergeSkill("boom", boom, [flame], {
      "boom.burst": "blast",
      "zap.projectile": "boom",
    });
    if (m.deliver.do === "dash") throw new Error("boom's root is never a dash");
    expect(m.deliver.vfx).toBe("zap");
    expect(nodesOf(m.deliver, "burst")[0].vfx).toBe("blast");
  });

  it("sets a modifier's multishot pattern on every projectile node", () => {
    const nova = mod("nova", { multishot: "nova" });
    const m = mergeSkill("boom", boom, [lingering, nova, mod("again", { multishot: "nova" })], {});
    expect(nodesOf(m.deliver, "projectile").map((n) => n.multishot)).toEqual(["nova"]);
    expect(boom.deliver.do === "projectile" && boom.deliver.multishot).toBe("fan");
  });

  it("throws on two modifiers with different multishot patterns", () => {
    const nova = mod("nova", { multishot: "nova" });
    expect(() =>
      mergeSkill("boom", boom, [nova, mod("spray", { multishot: "scatter" })], {}),
    ).toThrow("boom: nova sets multishot nova, spray sets scatter");
  });
});
