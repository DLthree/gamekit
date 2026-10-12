import { describe, expect, it } from "vitest";
import { type Box, nearest } from "@/ui/pad-nav";

const box = (left: number, top: number, width = 100, height = 40): Box => ({
  left,
  top,
  width,
  height,
});

// A row of three buttons over a wide one, like a screen's actions over a wide one.
const from = box(200, 100);
const boxes = [box(0, 100), box(400, 100), box(0, 200, 600), box(260, 0)];

describe("nearest", () => {
  it("steps along a row both ways", () => {
    expect(nearest(from, boxes, "left")).toBe(0);
    expect(nearest(from, boxes, "right")).toBe(1);
  });

  it("goes down to the wide box below, and up to the one above", () => {
    expect(nearest(from, boxes, "down")).toBe(2);
    expect(nearest(from, boxes, "up")).toBe(3);
  });

  it("prefers the box in line over a nearer one off to the side", () => {
    const row = [box(330, 300), box(500, 100)];
    expect(nearest(from, row, "right")).toBe(1);
  });

  it("finds nothing past the edge", () => {
    expect(nearest(box(0, 100), [box(200, 100)], "left")).toBeNull();
    expect(nearest(from, [], "up")).toBeNull();
  });
});
