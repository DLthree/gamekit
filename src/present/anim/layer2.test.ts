import { describe, expect, it } from "vitest";
import type { MeshBend } from "@/content/schema/look";
import { buildGrid, deformGrid, type MeshClock, meshPoint, setGridUV } from "@/present/anim/layer2";

const bend: MeshBend = {
  lean: 0.05,
  sway: 0.03,
  stride: 0.05,
  spread: 0.1,
  breath: 0.035,
  hip: 0.55,
};
const at = (t: number, walk: number): MeshClock => ({ t, gaitHz: 1.7, breathHz: 0.5, walk });

/** Vertex (c, r) of a grid as [x, y]. */
function vertex(g: ReturnType<typeof buildGrid>, c: number, r: number): [number, number] {
  const i = (r * (g.cols + 1) + c) * 4;
  return [g.vertices[i], g.vertices[i + 1]];
}

describe("layer 2 mesh", () => {
  it("lays a (cols × rows) grid over the image around the feet pivot", () => {
    const g = buildGrid(4, 6, 40, 48, 0.5, 1);
    expect(g.vertices).toHaveLength(5 * 7 * 4);
    expect(g.indices).toHaveLength(4 * 6 * 2 * 4);
    expect(g.vertices.slice(0, 4)).toEqual([-20, -48, 0, 0]);
    expect(g.vertices.slice(-4)).toEqual([20, 0, 1, 1]);
  });

  it("maps the grid's texture coordinates onto an atlas frame", () => {
    const g = buildGrid(4, 6, 40, 48, 0.5, 1);
    setGridUV(g, 0.25, 0.5, 0.75, 1);
    expect(g.vertices.slice(2, 4)).toEqual([0.25, 0.5]);
    expect(g.vertices.slice(-2)).toEqual([0.75, 1]);
  });

  it("leans the top forward while walking, and keeps the feet row at rest when standing", () => {
    const rest = buildGrid(4, 6, 40, 48, 0.5, 1);
    const g = buildGrid(4, 6, 40, 48, 0.5, 1);
    deformGrid(g, bend, at(0, 1));
    expect(vertex(g, 2, 0)[0]).toBeGreaterThan(vertex(rest, 2, 0)[0]);
    for (const t of [0, 0.3, 0.9]) {
      deformGrid(g, bend, at(t, 0));
      for (let c = 0; c <= 4; c++) expect(vertex(g, c, 6)).toEqual(vertex(rest, c, 6));
    }
  });

  it("breathes when standing: the top rises and falls", () => {
    const g = buildGrid(4, 6, 40, 48, 0.5, 1);
    deformGrid(g, bend, at(0.5, 0));
    const inhale = vertex(g, 2, 0)[1];
    deformGrid(g, bend, at(1.5, 0));
    expect(inhale).toBeLessThan(vertex(g, 2, 0)[1]);
  });

  it("finds where an image point (a hand) sits after bending", () => {
    const g = buildGrid(4, 6, 40, 48, 0.5, 1);
    const rest = meshPoint(0.9, 0.5, g, bend, at(0, 0), { x: 0, y: 0 });
    expect(rest.x).toBeCloseTo(16);
    expect(rest.y).toBeCloseTo(-24);
    expect(meshPoint(0.9, 0.5, g, bend, at(0, 1), { x: 0, y: 0 }).x).toBeGreaterThan(16);
  });
});
