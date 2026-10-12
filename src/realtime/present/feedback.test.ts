import { describe, expect, it } from "vitest";
import { tickSeconds } from "@/core/clock";
import type { Role } from "@/realtime/content/schema/vocab";
import { applyEvents } from "@/realtime/present/feedback";
import { createPresentation, type Presentation } from "@/realtime/present/presentation";
import type { WarningDraw } from "@/realtime/present/spawn-warnings";
import { testContent, testFiles } from "@/realtime/test/content";
import { ROLE_A, ROLE_B } from "@/realtime/test/vocab";

function presentation(): Presentation {
  return createPresentation(testContent(), 1);
}

describe("applyEvents", () => {
  it("draws an explosion and starts its shake when a burst ends", () => {
    const p = presentation();
    applyEvents(
      p,
      [
        {
          t: "volumeEnded",
          tick: 1,
          id: 3,
          kind: "burst",
          vfx: "blast",
          team: "player",
          ownerDef: "hero",
          x: 0,
          y: 0,
          r: 50,
          cancelled: false,
        },
      ],
      1,
    );
    expect(p.em.pool.counts().total).toBe(2);
    expect(p.camera.shakeUntil).toBeCloseTo(1.1);
  });

  it("tracks projectiles from start to end", () => {
    const p = presentation();
    const started = {
      t: "volumeStarted",
      tick: 1,
      id: 9,
      kind: "projectile",
      vfx: "zap",
      team: "player",
      owner: 1,
      ownerDef: "hero",
      x: 0,
      y: 0,
      r: 4,
      halfAngle: Math.PI,
      lifeTicks: 0,
      dirX: 1,
      dirY: 0,
      shape: "circle",
      length: 0,
      warnTicks: 0,
      ox: 0,
      oy: 0,
    } as const;
    applyEvents(p, [started], 1);
    expect(p.tracker.size).toBe(1);
    applyEvents(
      p,
      [
        {
          t: "volumeEnded",
          tick: 5,
          id: 9,
          kind: "projectile",
          vfx: "zap",
          team: "player",
          ownerDef: "hero",
          x: 20,
          y: 0,
          r: 4,
          cancelled: false,
        },
      ],
      2,
    );
    expect(p.tracker.size).toBe(0);
  });

  it("inks hits and deaths, flashes the target and shakes on player hurt", () => {
    const p = presentation();
    applyEvents(
      p,
      [
        {
          t: "hit",
          tick: 1,
          target: 5,
          targetDef: "dummy",
          team: "enemy",
          source: 2,
          skill: "zap",
          amount: 5,
          x: 0,
          y: 0,
          kx: 0,
          ky: 0,
        },
        {
          t: "died",
          tick: 1,
          id: 5,
          def: "dummy",
          role: ROLE_A,
          x: 0,
          y: 0,
          killer: "hero",
          skill: "zap",
        },
        { t: "playerHurt", tick: 1, amount: 3, hp: 97, by: "dummy" },
      ],
      1,
    );
    expect(p.em.pool.counts().total).toBe(3);
    expect(p.anims.ghosts).toHaveLength(1);
    expect(p.camera.shakeUntil).toBeCloseTo(1.1);
  });

  it("starts ground fire for a zone's whole life", () => {
    const p = presentation();
    const fx = structuredClone(p.content.look.fx);
    fx.vfx.burn = {
      recipe: "ground",
      stains: { kind: "puff", count: 1, alpha: 1, size: [0.5, 1] },
      grass: { kind: "puff", count: 3, size: [20, 30] },
      flames: { kind: "puff", count: 1, size: [10, 20] },
      embers: { kind: "puff", count: 2, size: 5 },
      spreadS: 1,
      flat: 0.7,
      sound: null,
    };
    p.content = { ...p.content, look: { ...p.content.look, fx } };
    p.em.look = p.content.look;
    applyEvents(
      p,
      [
        {
          t: "volumeStarted",
          tick: 60,
          id: 4,
          kind: "zone",
          vfx: "burn",
          team: "player",
          owner: 1,
          ownerDef: "hero",
          x: 0,
          y: 0,
          r: 40,
          halfAngle: Math.PI,
          lifeTicks: 240,
          dirX: 1,
          dirY: 0,
          shape: "circle",
          length: 0,
          warnTicks: 0,
          ox: 0,
          oy: 0,
        },
      ],
      1,
    );
    expect(p.em.pool.counts().kinds.puff).toBe(7);
    expect(Math.max(...p.em.pool.items.map((i) => i.at + i.life))).toBeLessThanOrEqual(5 + 1e-9);
  });

  function died(role: Role) {
    return {
      t: "died",
      tick: 1,
      id: 5,
      def: "dummy",
      role,
      x: 0,
      y: 0,
      killer: "hero",
      skill: "zap",
    } as const;
  }

  it("drops gold flakes, a big shake and the gold sound when a big-death role dies", () => {
    for (const role of [ROLE_B]) {
      const p = presentation();
      p.sound.running = true;
      applyEvents(p, [died(role)], 1);
      expect(p.em.pool.counts().kinds["gold-flake"]).toBe(6);
      expect(p.camera.shakeUntil).toBeCloseTo(1.2);
      expect(p.sound.take().map((s) => s.id)).toContain("chime");
    }
  });

  it("keeps gold off other roles' deaths", () => {
    const p = presentation();
    p.sound.running = true;
    applyEvents(p, [died(ROLE_A)], 1);
    expect(p.em.pool.counts().kinds["gold-flake"]).toBe(0);
    expect(p.camera.shakeUntil).toBeLessThan(1);
    expect(p.sound.take().map((s) => s.id)).toEqual(["tick"]);
  });

  it("asks for the vfx and feedback sounds (dropped as locked until audio runs)", () => {
    const p = presentation();
    const hit = {
      t: "hit",
      tick: 1,
      target: 5,
      targetDef: "dummy",
      team: "enemy",
      source: 3,
      skill: "zap",
      amount: 1,
      x: 0,
      y: 0,
      kx: 0,
      ky: 0,
    } as const;
    applyEvents(p, [hit], 1);
    expect(p.sound.counts.locked).toBe(1);
    p.sound.running = true;
    applyEvents(p, [hit], 2);
    expect(p.sound.take().map((s) => s.id)).toEqual(["tick"]);
  });

  it("requests the cast sound for a manual cast but not an auto cast", () => {
    const p = presentation();
    p.sound.running = true;
    const cast = (skill: string) =>
      ({
        t: "cast",
        tick: 1,
        caster: 1,
        casterDef: "hero",
        team: "player",
        skill,
        ax: 1,
        ay: 0,
      }) as const;
    applyEvents(p, [cast("zap")], 1);
    expect(p.sound.take()).toEqual([]);
    applyEvents(p, [cast("zap"), cast("boom")], 2);
    expect(p.sound.take().map((s) => s.id)).toEqual(["tick"]);
  });

  it("requests the cast sound for a player cast but not an enemy cast", () => {
    const p = presentation();
    p.sound.running = true;
    applyEvents(
      p,
      [
        {
          t: "cast",
          tick: 1,
          caster: 1,
          casterDef: "hero",
          team: "player",
          skill: "boom",
          ax: 0,
          ay: 0,
        },
      ],
      1,
    );
    expect(p.sound.take().map((s) => s.id)).toEqual(["tick"]);
    applyEvents(
      p,
      [
        {
          t: "cast",
          tick: 2,
          caster: 5,
          casterDef: "dummy",
          team: "enemy",
          skill: "nibble",
          ax: 0,
          ay: 0,
        },
      ],
      2,
    );
    expect(p.sound.take()).toEqual([]);
  });

  it("loops a ground vfx's sound for the zone's whole life", () => {
    const sounds = structuredClone(testFiles()["look/sounds.json"]) as {
      sounds: Record<string, unknown>;
    };
    sounds.sounds.crackle = { cap: 1, minGapS: 0, volume: 1, pitch: 0, loop: true };
    const manifest = structuredClone(testFiles()["look/generated/sounds.json"]) as {
      sounds: { id: string; file: string; lengthS: number }[];
    };
    manifest.sounds.push({ id: "crackle", file: "sounds/crackle.wav", lengthS: 1 });
    const content = testContent({
      "look/sounds.json": sounds,
      "look/generated/sounds.json": manifest,
    });
    const p = createPresentation(content, 1);
    p.sound.running = true;
    const fx = structuredClone(p.content.look.fx);
    fx.vfx.burn = {
      recipe: "ground",
      stains: { kind: "puff", count: 1, alpha: 1, size: [0.5, 1] },
      grass: { kind: "puff", count: 3, size: [20, 30] },
      flames: { kind: "puff", count: 1, size: [10, 20] },
      embers: { kind: "puff", count: 2, size: 5 },
      spreadS: 1,
      flat: 0.7,
      sound: "crackle",
    };
    p.content = { ...p.content, look: { ...p.content.look, fx } };
    p.em.look = p.content.look;
    const t = 1;
    const lifeTicks = 240;
    applyEvents(
      p,
      [
        {
          t: "volumeStarted",
          tick: 60,
          id: 4,
          kind: "zone",
          vfx: "burn",
          team: "player",
          owner: 1,
          ownerDef: "hero",
          x: 0,
          y: 0,
          r: 40,
          halfAngle: Math.PI,
          lifeTicks,
          dirX: 1,
          dirY: 0,
          shape: "circle",
          length: 0,
          warnTicks: 0,
          ox: 0,
          oy: 0,
        },
      ],
      t,
    );
    const [play] = p.sound.take();
    expect(play.id).toBe("crackle");
    expect(play.untilT).toBeCloseTo(t + tickSeconds(lifeTicks));
  });

  it("rate-limits hit ink and hit sounds per target", () => {
    const p = presentation();
    const hit = (tick: number) =>
      ({
        t: "hit",
        tick,
        target: 5,
        targetDef: "dummy",
        team: "enemy",
        source: 3,
        skill: "zap",
        amount: 1,
        x: 0,
        y: 0,
        kx: 0,
        ky: 0,
      }) as const;
    applyEvents(p, [hit(60)], 1);
    applyEvents(p, [hit(61)], 1.02);
    applyEvents(p, [hit(72)], 1.2);
    expect(p.em.pool.counts().kinds.puff).toBe(2);
    expect(p.sound.counts.locked).toBe(2);
  });

  it("thrusts the player's prop on manual casts only", () => {
    const p = presentation();
    const cast = (skill: string) =>
      ({
        t: "cast",
        tick: 1,
        caster: 1,
        casterDef: "hero",
        team: "player",
        skill,
        ax: 1,
        ay: 0,
      }) as const;
    applyEvents(p, [cast("zap")], 1);
    expect(p.anims.state(1).thrustAt).toBe(Number.NEGATIVE_INFINITY);
    applyEvents(p, [cast("boom")], 2);
    expect(p.anims.state(1).thrustAt).toBe(2);
  });

  it("marks a warned spawn from its event's tick until its enemy appears, filling over the warning", () => {
    const p = presentation();
    const look = p.content.look.feedback.spawnWarning;
    // Presented in a later frame's batch (t 1.5): the marker still starts at tick 60 (1 s).
    applyEvents(
      p,
      [{ t: "spawnWarned", tick: 60, def: "dummy", x: 30, y: -40, spawnTick: 180 }],
      1.5,
    );
    const out: WarningDraw[] = [];
    expect(p.warnings.markers(1, look, out)).toBe(1);
    expect(out[0]).toMatchObject({ x: 30, y: -40, fill: 0 });
    expect(out[0].radius).toBeGreaterThan(0);
    p.warnings.markers(2, look, out);
    expect(out[0].fill).toBeCloseTo(0.5);
    p.warnings.prune(2.9);
    expect(p.warnings.size).toBe(1);
    p.warnings.prune(3);
    expect(p.warnings.size).toBe(0);
  });
});
