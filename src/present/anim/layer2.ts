import type { MeshBend } from "@/content/schema/look";

/**
 * Layer 2: a grid laid over a creature image, bent every frame (lean, stride, breathing).
 * Coordinates are world units around the feet pivot, facing right (+x forward, +y down); the
 * renderer hands `vertices` and `indices` to a Phaser 4 Mesh2D, which keeps the array.
 */
export interface MeshGrid {
  cols: number;
  rows: number;
  width: number;
  height: number;
  pivotU: number;
  pivotV: number;
  /** x, y, u, v per vertex; x and y are rewritten every frame. */
  vertices: number[];
  /** a, b, c, page per triangle. */
  indices: number[];
}

/** The creature's animation clock (s), its stride and breath rates, and walk 0..1. */
export interface MeshClock {
  t: number;
  gaitHz: number;
  breathHz: number;
  walk: number;
}

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function buildGrid(
  cols: number,
  rows: number,
  width: number,
  height: number,
  pivotU: number,
  pivotV: number,
): MeshGrid {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      vertices.push((u - pivotU) * width, (v - pivotV) * height, u, v);
    }
  }
  const at = (c: number, r: number) => r * (cols + 1) + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Two triangles sharing the TR-BL diagonal, so Mesh2D can pair them into one quad.
      indices.push(at(c, r), at(c, r + 1), at(c + 1, r), 0);
      indices.push(at(c + 1, r), at(c, r + 1), at(c + 1, r + 1), 0);
    }
  }
  return { cols, rows, width, height, pivotU, pivotV, vertices, indices };
}

/** Maps the grid's texture coordinates onto an atlas frame (u0..u1, v0..v1). */
export function setGridUV(grid: MeshGrid, u0: number, v0: number, u1: number, v1: number): void {
  const { cols, rows, vertices } = grid;
  let i = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      vertices[i + 2] = u0 + (u1 - u0) * (c / cols);
      vertices[i + 3] = v0 + (v1 - v0) * (r / rows);
      i += 4;
    }
  }
}

/**
 * The bend at image point (u, v), in world units: the top leans forward while walking and sways
 * per stride (more the higher it is); the legs shear and spread per stride; the torso widens and
 * the top rises on the in-breath. The feet row moves only with the stride, so it stays planted.
 */
export function meshOffset(
  u: number,
  v: number,
  grid: MeshGrid,
  m: MeshBend,
  clk: MeshClock,
  out: { x: number; y: number },
): { x: number; y: number } {
  const { width: W, height: H, pivotU } = grid;
  const p = TAU * clk.gaitHz * clk.t;
  const breathWave = Math.sin(TAU * clk.breathHz * clk.t);
  const walk = clk.walk;
  const up = (1 - v) ** 1.5;
  const legs = clamp01((v - m.hip) / (1 - m.hip));
  // The torso (below the head, above the hips) widens on the in-breath; the legs never do.
  const torso = v < m.hip ? Math.sin(Math.PI * clamp01((v - 0.1) / (m.hip - 0.1))) : 0;
  const above = clamp01((m.hip - v) / m.hip);
  let dx =
    (m.lean * walk + m.sway * Math.sin(p) * walk + m.sway * 0.4 * breathWave * (1 - walk)) * H * up;
  dx += m.stride * H * legs * Math.sin(p) * walk;
  dx += (u - pivotU) * W * m.spread * legs * Math.abs(Math.sin(p)) * walk;
  const br = m.breath * breathWave;
  dx += (u - pivotU) * W * br * torso;
  out.x = dx;
  out.y = -br * H * 0.4 * above;
  return out;
}

const scratch = { x: 0, y: 0 };

/** Rewrites every vertex position: rest position + meshOffset. */
export function deformGrid(grid: MeshGrid, m: MeshBend, clk: MeshClock): void {
  const { cols, rows, vertices, width, height, pivotU, pivotV } = grid;
  let i = 0;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const v = r / rows;
      meshOffset(u, v, grid, m, clk, scratch);
      vertices[i] = (u - pivotU) * width + scratch.x;
      vertices[i + 1] = (v - pivotV) * height + scratch.y;
      i += 4;
    }
  }
}

/** Where image point (u, v) sits after bending (a hand a prop is held in). */
export function meshPoint(
  u: number,
  v: number,
  grid: MeshGrid,
  m: MeshBend,
  clk: MeshClock,
  out: { x: number; y: number },
): { x: number; y: number } {
  meshOffset(u, v, grid, m, clk, out);
  out.x += (u - grid.pivotU) * grid.width;
  out.y += (v - grid.pivotV) * grid.height;
  return out;
}
