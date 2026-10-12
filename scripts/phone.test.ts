import { phoneUrls } from "@scripts/phone";
import { describe, expect, it } from "vitest";

describe("phoneUrls", () => {
  it("gives the grid, the diagonal, one overkill and one struggle cell, on the LAN address", () => {
    const base = "http://192.168.1.20:5282";
    expect(phoneUrls("192.168.1.20", 5282)).toEqual([
      `${base}/`,
      `${base}/?char=wizard&build=1&threat=1`,
      `${base}/?char=wizard&build=2&threat=2`,
      `${base}/?char=wizard&build=3&threat=3`,
      `${base}/?char=wizard&build=3&threat=1`,
      `${base}/?char=wizard&build=1&threat=3`,
    ]);
  });
});
