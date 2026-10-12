import { describe, expect, it } from "vitest";
import { kite } from "@/game/kite-bot";
import { TICK_S } from "@/realtime/core/clock";
import { IDLE } from "@/realtime/sim/command";
import { summarize } from "@/realtime/sim/snapshot";
import { step } from "@/realtime/sim/step";
import { playerOf } from "@/realtime/sim/world";
import { quietZap } from "@/realtime/test/content";
import { place, testWorld } from "@/realtime/test/world";

/** Where the kite loop pulls toward on this tick (LOOP_RADIUS 90, LOOP_S 14 in kite.ts). */
function loopPoint(tick: number): { x: number; y: number } {
  const a = ((tick * TICK_S) / 14) * Math.PI * 2;
  return { x: Math.cos(a) * 90, y: Math.sin(a) * 90 };
}

describe("kite", () => {
  it("walks a loop and aims the area skill at the densest cluster", () => {
    const w = testWorld();
    place(w, "dummy", 200, 0);
    place(w, "dummy", 210, 10);
    place(w, "dummy", -150, 0);
    step(w, IDLE);
    const c = kite(w);
    expect(Math.hypot(c.moveX, c.moveY)).toBeLessThanOrEqual(1);
    expect(c.cast?.slot).toBe("cast");
    const aim = c.cast?.aim;
    if (aim === undefined || aim === "auto") throw new Error("expected an aimed cast");
    expect(aim.x).toBeGreaterThan(0);
  });

  it("never writes the world", () => {
    const w = testWorld();
    place(w, "dummy", 100, 0);
    const before = JSON.stringify(summarize(w));
    kite(w);
    expect(JSON.stringify(summarize(w))).toBe(before);
  });

  it("steps out of a slam warning centred on it before it lands", () => {
    // An enemy far off slams where the player stands: a 60-radius circle warned for 1 s. The
    // player waits on its loop point, where the loop alone barely moves it (about 40 units in
    // the warning), so only the dodge gets it out.
    const w = testWorld({
      ...quietZap,
      "skills/slam.json": {
        tags: ["attack", "area", "physical"],
        activation: "auto",
        target: "player",
        stats: { damage: { physical: 5 }, rate: 0.25, range: 400, area: 60, knockback: 0 },
        deliver: { do: "burst", vfx: "mark", shape: { kind: "circle" }, at: "target", warn: 1 },
      },
      "enemies/caster.json": {
        role: "fodder",
        stats: { life: 1000, moveSpeed: 0, radius: 10, knockbackResist: 0 },
        behavior: { kind: "chase" },
        skills: ["slam"],
        look: "dummy",
      },
    });
    place(w, "caster", -200, 0);
    const p = playerOf(w);
    let started = null;
    for (let i = 0; i < 600 && started === null; i++) {
      Object.assign(p, loopPoint(w.tick));
      step(w, IDLE);
      started = w.events.items.find((e) => e.t === "volumeStarted") ?? null;
    }
    if (started === null || started.t !== "volumeStarted") throw new Error("no slam started");
    expect(Math.hypot(started.x - p.x, started.y - p.y)).toBeLessThan(1);
    for (let i = 0; i < 600; i++) {
      step(w, kite(w));
      if (w.events.items.some((e) => e.t === "telegraphResolved")) break;
    }
    expect(Math.hypot(p.x - started.x, p.y - started.y)).toBeGreaterThan(60 + p.radius);
    expect(w.report.telegraphs.dodged).toBe(1);
    expect(w.report.telegraphs.taken).toBe(0);
  });

  it("steps away from a warned spawn point", () => {
    const w = testWorld();
    step(w, IDLE);
    const p = playerOf(w);
    Object.assign(p, loopPoint(w.tick));
    w.wave.pending.push({ def: "dummy", x: p.x + 10, y: p.y, due: w.wave.elapsed + 60 });
    expect(kite(w).moveX).toBeLessThan(-0.5);
  });
});
