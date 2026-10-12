import { describe, expect, it } from "vitest";
import { createRng, nextRange } from "@/core/rng";
import { SpatialHash } from "@/realtime/core/spatial-hash";

function filled(points: [number, number][]): SpatialHash {
  const h = new SpatialHash(32, points.length + 1);
  h.reset();
  for (let slot = 0; slot < points.length; slot++) h.insert(slot, points[slot][0], points[slot][1]);
  h.build();
  return h;
}

describe("SpatialHash.queryCircle", () => {
  it("returns exactly the items within the radius", () => {
    const h = filled([
      [0, 0],
      [10, 0],
      [49, 0],
      [51, 0],
      [-300, 200],
    ]);
    const out = new Int32Array(8);
    const n = h.queryCircle(0, 0, 50, out);
    expect([...out.subarray(0, n)].sort()).toEqual([0, 1, 2]);
  });

  it("caps output at the buffer length", () => {
    const h = filled([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect(h.queryCircle(0, 0, 10, new Int32Array(2))).toBe(2);
  });

  it("throws when inserting past capacity", () => {
    const h = new SpatialHash(32, 1);
    h.reset();
    h.insert(0, 0, 0);
    expect(() => h.insert(1, 0, 0)).toThrow(/capacity/);
  });

  it("returns each slot once at radii spanning far more than 64 cells", () => {
    const points: [number, number][] = [];
    for (let x = -300; x <= 300; x += 20) for (let y = -300; y <= 300; y += 20) points.push([x, y]);
    const h = filled(points);
    const out = new Int32Array(points.length);
    const n = h.queryCircle(0, 0, 250, out);
    const got = [...out.subarray(0, n)];
    expect(new Set(got).size).toBe(got.length);
    const want = points.flatMap(([x, y], i) => (x * x + y * y <= 250 * 250 ? [i] : []));
    expect(got.sort((a, b) => a - b)).toEqual(want);
  });

  it("stays exact over many queries (the visit stamp never goes stale)", () => {
    const h = filled([
      [0, 0],
      [40, 0],
    ]);
    const out = new Int32Array(4);
    for (let i = 0; i < 1000; i++) h.queryCircle(0, 0, 200, out);
    expect(h.queryCircle(0, 0, 200, out)).toBe(2);
  });
});

describe("SpatialHash.nearest", () => {
  it("matches a brute-force scan on random points", () => {
    const rng = createRng(11);
    const pts: [number, number][] = [];
    for (let i = 0; i < 300; i++) pts.push([nextRange(rng, -800, 800), nextRange(rng, -800, 800)]);
    const h = filled(pts);
    for (let q = 0; q < 200; q++) {
      const x = nextRange(rng, -900, 900);
      const y = nextRange(rng, -900, 900);
      let best = -1;
      let bestD = Number.POSITIVE_INFINITY;
      for (let slot = 0; slot < pts.length; slot++) {
        const d = Math.hypot(pts[slot][0] - x, pts[slot][1] - y);
        if (d <= 250 && d < bestD) {
          bestD = d;
          best = slot;
        }
      }
      const got = h.nearest(x, y, 250, () => true);
      if (best === -1) expect(got).toBe(-1);
      else expect(Math.hypot(pts[got][0] - x, pts[got][1] - y)).toBeCloseTo(bestD);
    }
  });

  it("skips rejected slots and respects maxR", () => {
    const h = filled([
      [5, 0],
      [40, 0],
      [400, 0],
    ]);
    expect(h.nearest(0, 0, 100, (s) => s !== 0)).toBe(1);
    expect(h.nearest(0, 0, 100, (s) => s === 2)).toBe(-1);
  });

  it("returns -1 on an empty hash", () => {
    expect(filled([]).nearest(0, 0, 500, () => true)).toBe(-1);
  });
});
