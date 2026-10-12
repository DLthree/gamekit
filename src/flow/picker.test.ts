import { describe, expect, it } from "vitest";
import { pickerModel } from "@/flow/picker";
import { ScenarioError } from "@/sim/scenario";
import { testContent } from "@/test/content";

describe("pickerModel", () => {
  const sim = testContent().sim;

  it("lays out 3 build tiers × 3 threat tiers, build 1 first (spec 05, ruling P8)", () => {
    const [grid] = pickerModel(sim, "hero");
    expect(grid.character).toBe("hero");
    expect(grid.cells.slice(0, 4).map((c) => [c.buildTier, c.threatTier])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 1],
    ]);
  });

  it("enables only cells whose build tier and threat file exist (Review Focus 3)", () => {
    const enabled = pickerModel(sim, null)[0].cells.filter((c) => c.enabled);
    expect(enabled.map((c) => [c.buildTier, c.threatTier])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
  });

  it("stops on a character the content doesn't have", () => {
    expect(() => pickerModel(sim, "nobody")).toThrow(ScenarioError);
    expect(() => pickerModel(sim, "nobody")).toThrow(
      "no character nobody; content/characters has hero",
    );
  });
});
