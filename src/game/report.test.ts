import { describe, expect, it } from "vitest";
import { createReport, recordEvents } from "@/game/report";
import type { SimEvent } from "@/sim/events";

const volume = {
  tick: 1,
  kind: "burst",
  vfx: "none",
  ownerDef: "caster",
  x: 0,
  y: 0,
  r: 40,
} as const;

function started(id: number, team: "player" | "enemy", warnTicks: number): SimEvent {
  return {
    ...volume,
    t: "volumeStarted",
    id,
    team,
    owner: 1,
    halfAngle: Math.PI,
    dirX: 1,
    dirY: 0,
    lifeTicks: 0,
    shape: "circle",
    length: 0,
    warnTicks,
    ox: 0,
    oy: 0,
  };
}

function resolved(id: number, hitPlayer: boolean): SimEvent {
  return {
    t: "telegraphResolved",
    tick: 31,
    id,
    vfx: "none",
    ownerDef: "caster",
    x: 0,
    y: 0,
    r: 40,
    hitPlayer,
  };
}

function ended(id: number, cancelled: boolean, team: "player" | "enemy" = "enemy"): SimEvent {
  return { ...volume, t: "volumeEnded", id, team, cancelled };
}

describe("recordEvents: telegraphs", () => {
  it("counts enemy telegraphs started, dodged, taken and cancelled", () => {
    const r = createReport(100);
    recordEvents(r, [
      started(1, "enemy", 30),
      started(2, "enemy", 30),
      started(3, "enemy", 30),
      started(4, "enemy", 0),
      started(5, "player", 30),
      resolved(1, true),
      ended(1, false),
      resolved(2, false),
      ended(2, false),
      ended(3, true),
      ended(4, false),
      ended(5, true, "player"),
    ]);
    expect(r.telegraphs).toEqual({ started: 3, dodged: 1, taken: 1, cancelled: 1 });
  });

  it("starts at zero", () => {
    expect(createReport(100).telegraphs).toEqual({ started: 0, dodged: 0, taken: 0, cancelled: 0 });
  });
});
