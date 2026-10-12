import { describe, expect, it } from "vitest";
import { idGeneration, idIndex, nextGeneration, packId } from "@/realtime/core/ids";

describe("generational ids", () => {
  it("round-trips index and generation", () => {
    const id = packId(513, 7);
    expect(idIndex(id)).toBe(513);
    expect(idGeneration(id)).toBe(7);
  });

  it("gives a reused slot a different id", () => {
    expect(packId(4, 0)).not.toBe(packId(4, nextGeneration(0)));
  });

  it("wraps the generation after 4096 reuses", () => {
    expect(nextGeneration(4095)).toBe(0);
  });

  it("rejects an index or generation out of range", () => {
    expect(() => packId(1 << 20, 0)).toThrow(/index/);
    expect(() => packId(0, 4096)).toThrow(/generation/);
  });
});
