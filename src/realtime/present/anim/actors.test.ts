import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { ActorDraws } from "@/realtime/present/anim/actors";
import { ActorAnims } from "@/realtime/present/anim/creatures";
import { playerOf } from "@/realtime/sim/world";
import { bruteFiles, staffFiles, testContent } from "@/realtime/test/content";
import { place, testWorld } from "@/realtime/test/world";

const anims = () => new ActorAnims(createRng(1), 0);

describe("ActorDraws", () => {
  it("draws every creature as a bent grid, the player and a fodder alike", () => {
    const world = testWorld();
    place(world, "dummy", 50, 0);
    const d = new ActorDraws();
    d.collect(testContent(), anims(), world, 0);
    expect(d.count).toBe(2);
    expect(d.draws.slice(0, 2).map((m) => m.body.frame)).toEqual([
      "creature/hero",
      "creature/dummy",
    ]);
    expect(d.draws[0].grid).not.toBe(d.draws[1].grid);
  });

  it("stops drawing the player once it is dead, and keeps its grid", () => {
    const files = staffFiles();
    const world = testWorld(files);
    const d = new ActorDraws();
    d.collect(testContent(files), anims(), world, 0);
    const grid = d.draws[0].grid;
    playerOf(world).hp = 0;
    d.collect(testContent(files), anims(), world, 0.1);
    expect(d.count).toBe(0);
    expect(d.draws[0].grid).toBe(grid);
  });

  it("draws a dead creature's ghost on its own grid after the living, until it is pruned", () => {
    const files = bruteFiles();
    const content = testContent(files);
    const world = testWorld(files);
    const brute = place(world, "brute", 50, 0);
    const a = anims();
    const d = new ActorDraws();
    d.collect(content, a, world, 0);
    expect(d.draws.slice(0, 2).map((m) => m.def)).toEqual(["hero", "brute"]);
    expect(d.draws[1].prop).toBeNull();
    brute.hp = 0;
    a.died(brute.id, "brute", 50, 0, 0.1);
    d.collect(content, a, world, 0.15);
    expect(d.count).toBe(2);
    expect(d.draws[1].def).toBe("brute");
    expect(d.draws[1].body.flash).toBe(true);
    a.prune(5, content.look.feedback.death.durationS);
    d.collect(content, a, world, 5);
    expect(d.count).toBe(1);
  });
});
