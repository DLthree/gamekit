import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { buildColorOf, emit, tintFor } from "@/realtime/present/fx/emit";
import { FxPool } from "@/realtime/present/fx/pool";
import { testContent } from "@/realtime/test/content";

describe("emit", () => {
  const c = testContent();

  it("tints by the palette, or by the owner's build colour for build kinds", () => {
    expect(tintFor(c.look, "puff", null)).toBe(0xffffff);
    const look = structuredClone(c.look);
    look.fx.kinds.puff.tint = "build";
    expect(tintFor(look, "puff", "red")).toBe(0xe52b0a);
    expect(() => tintFor(look, "puff", null)).toThrow("fx kind puff is tinted by build colour");
  });

  it("knows which defs have a build colour", () => {
    expect(buildColorOf(c, "hero")).toBe("red");
    expect(buildColorOf(c, "dummy")).toBeNull();
  });

  it("spawns an instance with the kind's life and a seeded variant", () => {
    const pool = new FxPool(c.look.fx);
    emit({ pool, rng: createRng(1), look: c.look }, "puff", 3, 1, 2, 10, { vx: 5 });
    const inst = pool.items[0];
    expect(inst).toMatchObject({ kind: "puff", at: 3, x: 1, y: 2, vx: 5, life: 0.5, size: 10 });
    expect(inst.variant).toBeGreaterThanOrEqual(0);
  });
});
