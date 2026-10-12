import { describe, expect, it } from "vitest";
import { createRng, nextFloat, nextRange } from "@/core/rng";

describe("rng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRng(7);
    const b = createRng(7);
    const xs = Array.from({ length: 5 }, () => nextFloat(a));
    const ys = Array.from({ length: 5 }, () => nextFloat(b));
    expect(xs).toEqual(ys);
  });

  it("gives different sequences for different seeds", () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)));
  });

  it("resumes exactly from a copied state", () => {
    const a = createRng(99);
    nextFloat(a);
    const copy = { state: a.state };
    expect(nextFloat(copy)).toBe(nextFloat(a));
  });

  it("stays inside [min, max)", () => {
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = nextRange(r, -2, 5);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(5);
    }
  });
});
