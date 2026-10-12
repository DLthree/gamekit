import { describe, expect, it } from "vitest";
import { EventBuffer } from "@/sim/events";

describe("EventBuffer", () => {
  it("keeps events up to its capacity and counts the overflow", () => {
    const b = new EventBuffer(2);
    for (let i = 0; i < 5; i++) b.push({ t: "waveEnded", tick: i, outcome: "survived" });
    expect(b.items.map((e) => e.tick)).toEqual([0, 1]);
    expect(b.overflow).toBe(3);
  });

  it("clear empties the list but keeps the overflow count", () => {
    const b = new EventBuffer(1);
    b.push({ t: "waveEnded", tick: 0, outcome: "died" });
    b.push({ t: "waveEnded", tick: 1, outcome: "died" });
    b.clear();
    expect(b.items).toEqual([]);
    expect(b.overflow).toBe(1);
  });
});
