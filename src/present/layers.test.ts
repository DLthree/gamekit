import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { depthFor } from "@/present/layers";

const r = loadContentDir(REPO_CONTENT_DIR, []);
if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
const { layers, camera } = r.content.look;
const edge = r.content.sim.rules.arena.halfHeight;

describe("draw bands (shipped look/layers.json)", () => {
  it("draws the player above every creature and effect, whatever their y", () => {
    const player = depthFor(layers, "player", -edge);
    for (const band of [
      "floor",
      "ground",
      "blast",
      "clearing",
      "shadows",
      "actors",
      "fx",
    ] as const) {
      expect(player).toBeGreaterThan(depthFor(layers, band, edge));
    }
  });

  it("draws telegraphs above every band a build effect can use", () => {
    for (const band of ["ground", "blast", "actors", "fx"] as const)
      expect(depthFor(layers, "telegraphs", -edge)).toBeGreaterThan(depthFor(layers, band, edge));
  });

  it("draws the player above telegraphs", () => {
    expect(depthFor(layers, "player", -edge)).toBeGreaterThan(depthFor(layers, "telegraphs", edge));
  });

  it("y-sorts creatures by their feet inside their band", () => {
    expect(depthFor(layers, "actors", 10)).toBeGreaterThan(depthFor(layers, "actors", -10));
    expect(depthFor(layers, "actors", -edge)).toBeGreaterThan(depthFor(layers, "shadows", edge));
  });

  it("keeps the aim indicator on top and the floor at the bottom", () => {
    expect(depthFor(layers, "aim", 0)).toBeGreaterThan(depthFor(layers, "player", edge));
    expect(depthFor(layers, "floor", 0)).toBe(0);
    expect(camera.shortSideSpan).toBeGreaterThan(0);
  });
});
