import { describe, expect, it } from "vitest";
import { tickSeconds } from "@/core/clock";
import { applyEvents } from "@/present/feedback";
import { createPresentation } from "@/present/presentation";
import {
  circleHatch,
  hatchFor,
  laneHatch,
  type TelegraphDraw,
  Telegraphs,
} from "@/present/telegraphs";
import type { SimEvent } from "@/sim/events";
import { testContent } from "@/test/content";

type Started = Extract<SimEvent, { t: "volumeStarted" }>;
type Ended = Extract<SimEvent, { t: "volumeEnded" }>;

const EPS = 1e-3;

function started(over: Partial<Started> = {}): Started {
  return {
    t: "volumeStarted",
    tick: 60,
    id: 7,
    kind: "burst",
    vfx: "mark",
    team: "enemy",
    owner: 2,
    ownerDef: "dummy",
    x: 100,
    y: 50,
    r: 40,
    halfAngle: Math.PI,
    dirX: 1,
    dirY: 0,
    lifeTicks: 0,
    shape: "circle",
    length: 0,
    warnTicks: 30,
    ox: 0,
    oy: 0,
    ...over,
  };
}

function ended(over: Partial<Ended> = {}): Ended {
  return {
    t: "volumeEnded",
    tick: 90,
    id: 7,
    kind: "burst",
    vfx: "mark",
    team: "enemy",
    ownerDef: "dummy",
    x: 100,
    y: 50,
    r: 40,
    cancelled: false,
    ...over,
  };
}

function segments(a: Float32Array): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < a.length; i += 2) out.push([a[i], a[i + 1]]);
  return out;
}

describe("circleHatch", () => {
  it.each([
    [6, 6, 45],
    [40, 6, 45],
    [64, 7, -30],
    [25, 9, 0],
  ])("keeps every segment end inside a circle of r %d (spacing %d, %d°)", (r, spacing, angle) => {
    const a = circleHatch(r, spacing, angle);
    expect(a.length).toBeGreaterThanOrEqual(4);
    expect(a.length % 4).toBe(0);
    for (const [x, y] of segments(a)) expect(Math.hypot(x, y)).toBeLessThanOrEqual(r + EPS);
  });

  it("returns the cached array for the same rounded radius", () => {
    expect(circleHatch(40.2, 6, 45)).toBe(circleHatch(39.9, 6, 45));
    expect(circleHatch(40, 6, 45)).not.toBe(circleHatch(41, 6, 45));
  });
});

describe("laneHatch", () => {
  it.each([
    [300, 10, 6, 45],
    [120, 20, 8, -60],
    [5, 6, 6, 90],
  ])("keeps every segment end inside the capsule (L %d, w %d)", (length, w, spacing, angle) => {
    const a = laneHatch(length, w, spacing, angle);
    expect(a.length).toBeGreaterThanOrEqual(4);
    for (const [x, y] of segments(a)) {
      const along = Math.min(Math.max(x, 0), length);
      expect(Math.hypot(x - along, y)).toBeLessThanOrEqual(w + EPS);
    }
  });

  it("returns the cached array for the same rounded key", () => {
    expect(laneHatch(300.3, 10, 6, 45)).toBe(laneHatch(299.8, 10, 6, 45));
  });
});

describe("hatchFor", () => {
  const look = testContent().look;
  const mark = look.fx.vfx.mark;
  if (mark.recipe !== "telegraph") throw new Error("mark is a telegraph");

  /** Sorted perpendicular offsets of the segments' midpoints, for hatch lines at angleDeg. */
  function offsets(a: Float32Array, angleDeg: number): number[] {
    const t = (angleDeg * Math.PI) / 180;
    const out: number[] = [];
    for (let i = 0; i < a.length; i += 4) {
      const mx = (a[i] + a[i + 2]) / 2;
      const my = (a[i + 1] + a[i + 3]) / 2;
      out.push(-mx * Math.sin(t) + my * Math.cos(t));
    }
    return out.sort((x, y) => x - y);
  }

  it("keeps the line spacing as a circle grows, so its hatch never bunches into a disc", () => {
    const d = draws(64);
    for (const progress of [0.2, 0.5, 1]) {
      const o = offsets(hatchFor({ ...d, progress }, mark), mark.hatch.angleDeg);
      expect(o.length).toBeGreaterThan(0);
      for (let i = 1; i < o.length; i++) expect(o[i] - o[i - 1]).toBeCloseTo(mark.hatch.spacing);
    }
    const early = hatchFor({ ...d, progress: 0.25 }, mark);
    for (const [x, y] of segments(early)) expect(Math.hypot(x, y)).toBeLessThanOrEqual(16 + EPS);
  });

  it("strokes a full-fill circle at its whole radius from the start", () => {
    const full = { ...mark, fill: "full" as const };
    expect(hatchFor({ ...draws(40), progress: 0 }, full)).toBe(circleHatch(40, 6, 45));
  });

  function draws(r: number): TelegraphDraw {
    return {
      shape: "circle",
      x: 0,
      y: 0,
      r,
      dirX: 1,
      dirY: 0,
      length: 0,
      progress: 1,
      vfx: "mark",
      lob: null,
    };
  }
});

describe("Telegraphs", () => {
  const look = testContent().look;

  function draws(tg: Telegraphs, t: number): TelegraphDraw[] {
    const out: TelegraphDraw[] = [];
    out.length = tg.draws(t, look, out);
    return out;
  }

  it("runs progress from 0 to 1 over the warning", () => {
    const tg = new Telegraphs();
    tg.start(started(), 1);
    expect(draws(tg, 1)[0].progress).toBe(0);
    expect(draws(tg, 1.25)[0].progress).toBeCloseTo(0.5);
    expect(draws(tg, 1.5)[0].progress).toBe(1);
    expect(draws(tg, 2)[0].progress).toBe(1);
    expect(draws(tg, 1)[0]).toMatchObject({ shape: "circle", x: 100, y: 50, r: 40, vfx: "mark" });
  });

  it("drops a telegraph on end, cancelled or not", () => {
    const tg = new Telegraphs();
    tg.start(started({ id: 1 }), 0);
    tg.start(started({ id: 2 }), 0);
    tg.end(1);
    expect(draws(tg, 0.1)).toHaveLength(1);
    tg.end(2);
    expect(draws(tg, 0.1)).toHaveLength(0);
  });

  it("ignores player-team and unwarned volumes", () => {
    const tg = new Telegraphs();
    expect(tg.start(started({ team: "player" }), 0)).toBe(false);
    expect(tg.start(started({ warnTicks: 0 }), 0)).toBe(false);
    expect(draws(tg, 0.1)).toHaveLength(0);
  });

  it("lobs the stone from the owner at progress 0 to the mark at progress 1", () => {
    const withLob = structuredClone(look);
    const mark = withLob.fx.vfx.mark;
    if (mark.recipe !== "telegraph") throw new Error("mark is a telegraph");
    mark.lob = { size: 5, arc: 30 };
    const tg = new Telegraphs();
    tg.start(started({ ox: -20, oy: 10 }), 0);
    const out: TelegraphDraw[] = [];
    tg.draws(0, withLob, out);
    expect(out[0].lob).toEqual({ x: -20, y: 10, size: 5 });
    tg.draws(0.25, withLob, out);
    // Halfway: midpoint y 30, lifted by the full arc of 30.
    expect(out[0].lob?.y).toBeCloseTo(0);
    tg.draws(0.5, withLob, out);
    expect(out[0].lob?.x).toBeCloseTo(100);
    expect(out[0].lob?.y).toBeCloseTo(50);
    expect(draws(tg, 0)[0].lob).toBeNull();
  });
});

describe("applyEvents: telegraphs", () => {
  it("starts a telegraph at the event's tick and ends it on volumeEnded", () => {
    const p = createPresentation(testContent(), 1);
    applyEvents(p, [started()], 5);
    const out: TelegraphDraw[] = [];
    expect(p.telegraphs.draws(tickSeconds(60) + 0.25, p.content.look, out)).toBe(1);
    expect(out[0].progress).toBeCloseTo(0.5);
    applyEvents(p, [ended({ cancelled: true })], 5);
    expect(p.telegraphs.draws(5, p.content.look, out)).toBe(0);
  });

  it("rings, shakes and sounds on resolve", () => {
    const p = createPresentation(testContent(), 1);
    p.sound.running = true;
    applyEvents(
      p,
      [
        {
          t: "telegraphResolved",
          tick: 90,
          id: 7,
          vfx: "mark",
          ownerDef: "dummy",
          x: 100,
          y: 50,
          r: 40,
          hitPlayer: false,
        },
        ended(),
      ],
      1.5,
    );
    expect(p.em.pool.counts().kinds.ring).toBe(1);
    expect(p.camera.shakeUntil).toBeCloseTo(1.6);
    expect(p.sound.take().map((s) => s.id)).toContain("tick");
  });

  it("draws no explosion for a burst cancelled while warning", () => {
    const p = createPresentation(testContent(), 1);
    applyEvents(p, [ended({ vfx: "blast", team: "player", ownerDef: "hero", cancelled: true })], 1);
    expect(p.em.pool.counts().total).toBe(0);
    expect(p.camera.shakeUntil).toBe(0);
  });
});
