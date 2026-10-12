import { describe, expect, it } from "vitest";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { switchOn } from "@/content/switches";

describe("the throwers switch", () => {
  const r = loadContentDir(REPO_CONTENT_DIR, []);
  if (!r.ok) throw new Error("shipped content fails");
  const spawned = (on: "throwers"[]) =>
    Object.values(switchOn(r.content, on).sim.threats).flatMap((t) => t.spawns.map((s) => s.enemy));

  it("spawns throwers only when on", () => {
    expect(spawned(["throwers"])).toContain("thrower");
    expect(spawned([])).not.toContain("thrower");
  });

  it("leaves every other spawn", () => {
    const others = spawned(["throwers"]).filter((e) => e !== "thrower");
    expect(spawned([])).toEqual(others);
  });
});
