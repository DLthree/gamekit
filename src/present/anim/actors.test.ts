import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { ActorDraws } from "@/present/anim/actors";
import { ActorAnims } from "@/present/anim/creatures";
import { playerOf } from "@/sim/world";
import { eliteMeshFiles, meshFiles, testContent } from "@/test/content";
import { place, testWorld } from "@/test/world";

const anims = () => new ActorAnims(createRng(1), 0);

describe("ActorDraws", () => {
  it("draws a bent player on the mesh path and everyone else flat", () => {
    const files = meshFiles();
    const world = testWorld(files);
    place(world, "dummy", 50, 0);
    const d = new ActorDraws();
    d.collect(testContent(files), anims(), world, 0);
    expect(d.meshCount).toBe(1);
    expect(d.meshes[0].body.visible).toBe(true);
    expect(d.count).toBe(1);
    expect(d.flat[0].frame).toBe("creature/dummy");
  });

  it("draws a player without a mesh flat", () => {
    const d = new ActorDraws();
    d.collect(testContent(), anims(), testWorld(), 0);
    expect(d.meshCount).toBe(0);
    expect(d.count).toBe(1);
    expect(d.flat[0].frame).toBe("creature/hero");
  });

  it("stops bending the player once it is dead, and keeps its grid", () => {
    const files = meshFiles();
    const world = testWorld(files);
    const d = new ActorDraws();
    d.collect(testContent(files), anims(), world, 0);
    const grid = d.meshes[0].grid;
    playerOf(world).hp = 0;
    d.collect(testContent(files), anims(), world, 0.1);
    expect(d.meshCount).toBe(0);
    expect(d.meshes[0].grid).toBe(grid);
  });

  it("bends an elite beside the player, each with its own grid, until the elite dies", () => {
    const files = eliteMeshFiles();
    const content = testContent(files);
    const world = testWorld(files);
    const lion = place(world, "lion", 50, 0);
    const d = new ActorDraws();
    d.collect(content, anims(), world, 0);
    expect(d.meshCount).toBe(2);
    expect(d.meshes.slice(0, 2).map((m) => m.def)).toEqual(["hero", "lion"]);
    expect(d.meshes[0].grid).not.toBe(d.meshes[1].grid);
    expect(d.meshes[1].prop).toBeNull();
    expect(d.count).toBe(0);
    lion.hp = 0;
    d.collect(content, anims(), world, 0.1);
    expect(d.meshCount).toBe(1);
    expect(d.meshes[0].def).toBe("hero");
  });
});
