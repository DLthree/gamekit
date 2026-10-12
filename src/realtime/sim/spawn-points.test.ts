import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { edgePoint, fieldPoints, ringPoints } from "@/realtime/sim/spawn-points";

const arena = { $schema: "x", halfWidth: 1000, halfHeight: 1000, spawnRadius: 600 };

describe("edgePoint", () => {
  it("is spawnRadius from the player and inside the arena, even from a corner", () => {
    const rng = createRng(3);
    for (const [px, py] of [
      [0, 0],
      [990, 990],
      [-990, 500],
      [0, -990],
    ]) {
      for (let i = 0; i < 500; i++) {
        const p = edgePoint(rng, px, py, arena);
        expect(Math.hypot(p.x - px, p.y - py)).toBeCloseTo(600, 6);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1000);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1000);
      }
    }
  });
});

describe("ringPoints", () => {
  it("places count points radius from the player, evenly spaced", () => {
    const rng = createRng(7);
    const pts = ringPoints(rng, 0, 0, arena, 200, 6, 40);
    expect(pts).toHaveLength(6);
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(200, 6);
    const angles = pts.map((p) => Math.atan2(p.y, p.x)).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i] - angles[i - 1]).toBeCloseTo((Math.PI * 2) / 6, 6);
    }
  });

  it("is deterministic per seed", () => {
    const a = ringPoints(createRng(11), 0, 0, arena, 200, 6, 40);
    const b = ringPoints(createRng(11), 0, 0, arena, 200, 6, 40);
    expect(a).toEqual(b);
  });

  it("mirrors a point back inside the arena near a wall", () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      // Near one wall only (not a corner), so mirroring never doubles up two points onto the same
      // spot; a diameter this small (well under the ~0.65 closest raw pair over these 500 draws)
      // never fires the collapse nudge (its own test below), so every point stays exactly on the
      // ring.
      const pts = ringPoints(rng, 990, 0, arena, 200, 6, 0.1);
      for (const p of pts) {
        expect(Math.hypot(p.x - 990, p.y - 0)).toBeCloseTo(200, 6);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1000);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(1000);
      }
    }
  });

  it("nudges collapsed points apart near a corner, never closer than the enemy's diameter", () => {
    // A 900-half arena, a 10-enemy ring at radius 170, a 12-radius (24-diameter) enemy. The player
    // sits well into the corner (120 from each wall), close enough that most points mirror.
    const corner = { $schema: "x", halfWidth: 900, halfHeight: 900, spawnRadius: 660 };
    const diameter = 24;
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const pts = ringPoints(rng, 780, 780, corner, 170, 10, diameter);
      expect(pts).toHaveLength(10);
      for (const p of pts) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(corner.halfWidth);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(corner.halfHeight);
      }
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          expect(Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)).toBeGreaterThanOrEqual(
            diameter - 1e-6,
          );
        }
      }
    }
  });
});

describe("fieldPoints", () => {
  it("places count points between min and max distance from the player, inside the arena", () => {
    const rng = createRng(5);
    for (const [px, py] of [
      [0, 0],
      [990, 990],
      [-990, 0],
    ]) {
      for (let i = 0; i < 200; i++) {
        const pts = fieldPoints(rng, px, py, arena, 140, 240, 8);
        expect(pts).toHaveLength(8);
        for (const p of pts) {
          const d = Math.hypot(p.x - px, p.y - py);
          expect(d).toBeGreaterThanOrEqual(140);
          expect(d).toBeLessThanOrEqual(240);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1000);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1000);
        }
      }
    }
  });

  it("is deterministic per seed and differs across seeds", () => {
    const a = fieldPoints(createRng(11), 0, 0, arena, 140, 240, 8);
    expect(fieldPoints(createRng(11), 0, 0, arena, 140, 240, 8)).toEqual(a);
    expect(fieldPoints(createRng(12), 0, 0, arena, 140, 240, 8)).not.toEqual(a);
  });
});
