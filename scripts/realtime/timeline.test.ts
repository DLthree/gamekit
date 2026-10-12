import { timeline } from "@scripts/realtime/timeline";
import { describe, expect, it } from "vitest";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { tickLine } from "@/game/headless";
import { PERF_QUERY } from "@/game/links";
import { OUTCOMES } from "@/game/vocab";

describe("timeline", () => {
  it("lists a run's telling moments in frame order, ending with the wave", () => {
    const lines = timeline(PERF_QUERY, 600);
    const frames = lines.map((l) => Number(l.split(" ")[0]));
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    const ends = OUTCOMES.map((outcome) => tickLine({ t: "waveEnded", tick: 0, outcome }));
    expect(ends).toContain(lines.at(-1)?.split(" ").slice(1).join(" "));
  });

  it("replays the same from the same query", () => {
    expect(timeline(PERF_QUERY, 30)).toEqual(timeline(PERF_QUERY, 30));
  });

  it("stops at max-s", () => {
    const lines = timeline(PERF_QUERY, 5);
    expect(lines.every((l) => Number(l.split(" ")[0]) <= 300)).toBe(true);
  });

  it("refuses a query that opens no wave (the game's first page)", () => {
    expect(() => timeline("", 5)).toThrow();
  });
});

describe("timeline overrides", () => {
  it("runs the content the overrides make", () => {
    const loaded = loadContentDir(REPO_CONTENT_DIR, []);
    if (!loaded.ok) throw new Error("repo content does not compile");
    const character = Object.keys(loaded.content.sim.characters)[0];
    expect(() => timeline(PERF_QUERY, 5, [`characters/${character}.stats.life=-1`])).toThrow(
      new RegExp(`characters/${character}.json`),
    );
  });

  it("names a bad override's file", () => {
    expect(() => timeline(PERF_QUERY, 5, ["threats/nope.durationS=2"])).toThrow(/threats\/nope/);
  });
});
