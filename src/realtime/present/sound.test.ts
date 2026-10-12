import { describe, expect, it } from "vitest";
import { createRng } from "@/core/rng";
import { SoundPlan } from "@/realtime/present/sound";
import { testContent, testFiles } from "@/realtime/test/content";

function plan(minGapS = 0.05) {
  const sounds = structuredClone(testFiles()["look/sounds.json"]) as {
    sounds: Record<string, { minGapS: number }>;
  };
  sounds.sounds.tick.minGapS = minGapS;
  const look = testContent({ "look/sounds.json": sounds }).look;
  const p = new SoundPlan(look, createRng(3));
  p.running = true;
  return p;
}

/** A plan with a looping sound ("crackle") alongside the one-shot "tick" (loops). */
function loopPlan(cap = 1, minGapS = 0) {
  const sounds = structuredClone(testFiles()["look/sounds.json"]) as {
    sounds: Record<string, unknown>;
  };
  sounds.sounds.crackle = { cap, minGapS, volume: 0.5, pitch: 0, loop: true };
  const manifest = structuredClone(testFiles()["look/generated/sounds.json"]) as {
    sounds: { id: string; file: string; lengthS: number }[];
  };
  manifest.sounds.push({ id: "crackle", file: "sounds/crackle.wav", lengthS: 1.2 });
  const look = testContent({
    "look/sounds.json": sounds,
    "look/generated/sounds.json": manifest,
  }).look;
  const p = new SoundPlan(look, createRng(3));
  p.running = true;
  return p;
}

describe("SoundPlan", () => {
  it("drops requests while audio is locked and never plays them later", () => {
    const p = plan();
    p.running = false;
    for (let i = 0; i < 50; i++) p.request("tick", i);
    expect(p.counts.locked).toBe(50);
    p.running = true;
    expect(p.take()).toEqual([]);
  });

  it("keeps minGapS between plays of one sound", () => {
    const p = plan();
    p.request("tick", 1);
    p.request("tick", 1.01);
    p.request("tick", 1.06);
    expect(p.take().length).toBe(2);
    expect(p.counts.gapped).toBe(1);
  });

  it("plays at most cap copies at once, freeing a copy when it has finished", () => {
    const p = plan(0);
    for (const t of [0, 0.001, 0.002]) p.request("tick", t);
    expect(p.counts).toMatchObject({ played: 2, capped: 1 });
    p.request("tick", 0.5);
    expect(p.counts.played).toBe(3);
  });

  it("varies pitch within ± pitch semitones and scales volume by the master", () => {
    const p = plan(0);
    p.request("tick", 0);
    p.request("tick", 1);
    const plays = p.take();
    for (const s of plays) {
      expect(s.rate).toBeGreaterThanOrEqual(2 ** (-1 / 12));
      expect(s.rate).toBeLessThanOrEqual(2 ** (1 / 12));
      expect(s.volume).toBeCloseTo(0.5);
    }
    expect(plays[0].rate).not.toBe(plays[1].rate);
    expect(p.take()).toEqual([]);
  });

  it("stops on a sound nobody tuned", () => {
    expect(() => plan().request("boing", 0)).toThrow("no sound boing in look/sounds.json");
  });

  it("carries a loop's end time through to its play, and frees its cap slot only at that time", () => {
    const p = loopPlan(1, 0);
    p.request("crackle", 0, 4);
    const [play] = p.take();
    expect(play.untilT).toBe(4);
    // The single cap slot is held until the requested end time, not the clip's own length.
    p.request("crackle", 3.99, 8);
    expect(p.counts.capped).toBe(1);
    p.request("crackle", 4, 8);
    expect(p.counts.played).toBe(2);
  });

  it("throws when a looping sound is requested without an end time, or a one-shot with one", () => {
    const p = loopPlan();
    expect(() => p.request("crackle", 0)).toThrow(
      "sound crackle loops; request() needs an end time",
    );
    expect(() => p.request("tick", 0, 1)).toThrow(
      "sound tick does not loop; request() was given an end time",
    );
  });

  it("keeps cap and gap state across setLook, a look-only hot swap (dev only)", () => {
    const p = plan(10);
    p.request("tick", 0);
    p.request("tick", 0.01);
    expect(p.counts).toMatchObject({ played: 1, gapped: 1 });
    const sounds = structuredClone(testFiles()["look/sounds.json"]) as {
      sounds: Record<string, { minGapS: number }>;
    };
    sounds.sounds.tick.minGapS = 10;
    const swapped = testContent({ "look/sounds.json": sounds }).look;
    p.setLook(swapped);
    // Still within the old request's minGapS: a swap that reset `last` would let this play.
    p.request("tick", 0.02);
    expect(p.counts).toMatchObject({ played: 1, gapped: 2 });
  });

  it("throws when a loop's end time is not after its start", () => {
    const p = loopPlan();
    expect(() => p.request("crackle", 4, 4)).toThrow(
      "sound crackle: end time 4 is not after its start 4",
    );
    expect(() => p.request("crackle", 4, 3)).toThrow(
      "sound crackle: end time 3 is not after its start 4",
    );
  });
});
