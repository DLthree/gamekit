import { describe, expect, it } from "vitest";
import { summarize } from "@/realtime/sim/snapshot";
import { place, run, testWorld } from "@/realtime/test/world";

describe("summarize", () => {
  it("is plain JSON with the player, enemies, skills and counters", () => {
    const w = testWorld();
    place(w, "dummy", 150, 0);
    run(w, 5);
    const s = summarize(w);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(s.tick).toBe(5);
    expect(s.player).toMatchObject({ def: "hero", hp: 100, team: "player" });
    expect(s.enemies).toBe(1);
    expect(s.skills.map((k) => [k.slot, k.skill])).toEqual([
      ["auto", "zap"],
      ["cast", "boom"],
    ]);
    expect(s.skills[1].stats.area).toBe(50);
    expect(s.counters).toEqual({ eventOverflow: 0, droppedSpawns: 0, droppedVolumes: 0 });
  });
});
