import { timeline } from "@scripts/timeline";
import { describe, expect, it } from "vitest";
import { PERF_QUERY } from "@/game/links";

describe("timeline", () => {
  it("lists a run's telling moments in tick order, ending with the wave", () => {
    const lines = timeline(PERF_QUERY, 600);
    const ticks = lines.map((l) => Number(l.split(" ")[0]));
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(lines.at(-1)).toMatch(/^\d+ ended (survived|died)$/);
  });

  it("replays the same from the same query", () => {
    expect(timeline(PERF_QUERY, 30)).toEqual(timeline(PERF_QUERY, 30));
  });

  it("stops at max-s", () => {
    const lines = timeline(PERF_QUERY, 5);
    expect(lines.every((l) => Number(l.split(" ")[0]) <= 300)).toBe(true);
  });

  it("refuses a query that opens no cell", () => {
    expect(() => timeline("char=wizard", 5)).toThrow(/not a cell/);
  });
});
