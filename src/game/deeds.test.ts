import { describe, expect, it } from "vitest";
import type { SaveStore } from "@/app/platform";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { DEEDS_KEY, deedList, deedsMet, readEarned, writeEarned } from "@/game/deeds";
import { createReport } from "@/game/report";
import type { Scenario } from "@/game/scenario";
import { TEST_SCENARIO } from "@/realtime/test/world";

const compiled = loadContentDir(REPO_CONTENT_DIR, []);
if (!compiled.ok) throw new Error("the repo's content doesn't compile");
const { sim } = compiled.content;

function memory(init: Record<string, string> = {}): SaveStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (Object.hasOwn(data, k) ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("deeds", () => {
  it("lists the example's deeds in id order", () => {
    expect(deedList(sim).map((d) => d.id)).toEqual(["first-light", "lion-tamer", "wyrmslayer"]);
  });

  it("are met by what the wave shows: a win, a threat tier, kills by role", () => {
    const at = (threatTier: number): Scenario => ({ ...TEST_SCENARIO, threatTier });
    const won = { ...createReport(10), outcome: "survived" as const };
    expect(deedsMet(sim, at(1), won)).toEqual(["first-light"]);
    const elite = { ...createReport(10), outcome: "died" as const, killsByRole: { elite: 1 } };
    expect(deedsMet(sim, at(1), elite)).toEqual(["lion-tamer"]);
    const boss = { ...won, killsByRole: { boss: 1 } };
    expect(deedsMet(sim, at(2), boss)).toEqual(["first-light"]);
    expect(deedsMet(sim, at(3), boss)).toEqual(["first-light", "wyrmslayer"]);
  });

  it("are never met on a stage, a developer bench", () => {
    const won = { ...createReport(10), outcome: "survived" as const };
    expect(deedsMet(sim, { ...TEST_SCENARIO, stage: "dragon" }, won)).toEqual([]);
  });
});

describe("the deeds save", () => {
  it("is empty on a fresh save, and round-trips", () => {
    const store = memory();
    expect(readEarned(store)).toEqual(new Set());
    writeEarned(store, new Set(["wyrmslayer", "first-light"]));
    expect(JSON.parse(store.data[DEEDS_KEY])).toEqual({
      version: 1,
      earned: ["first-light", "wyrmslayer"],
    });
    expect(readEarned(store)).toEqual(new Set(["first-light", "wyrmslayer"]));
  });

  it("throws, naming the save, on one it can't read", () => {
    expect(() => readEarned(memory({ deeds: '{"version": 1, "ea' }))).toThrow(
      "the deeds save is not JSON",
    );
    expect(() => readEarned(memory({ deeds: '{"version": 2}' }))).toThrow("is not version 1");
    expect(() => readEarned(memory({ deeds: '{"version": 1, "earned": [3]}' }))).toThrow(
      "has no earned list",
    );
  });
});
