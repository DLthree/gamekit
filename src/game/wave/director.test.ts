import { describe, expect, it } from "vitest";
import { ticks } from "@/realtime/core/clock";
import { run, testWorld } from "@/realtime/test/world";

function threat(spawns: unknown[]) {
  return { "threats/tier-1.json": { durationS: 10, maxAlive: 200, spawns } };
}

describe("the wave director", () => {
  it("spawns along a rate ramp", () => {
    const w = testWorld(
      threat([{ enemy: "dummy", from: 0, to: 10, rate: [1, 3], pattern: "edge" }]),
    );
    const spawned = run(w, ticks(10)).filter((e) => e.t === "spawned");
    expect(spawned.length).toBeGreaterThanOrEqual(19);
    expect(spawned.length).toBeLessThanOrEqual(20);
  });

  it("spawns a ramp only inside its window", () => {
    // 15/s is 0.25 per tick, exact in binary, so the count is exact.
    const w = testWorld(
      threat([{ enemy: "dummy", from: 5, to: 6, rate: [15, 15], pattern: "edge" }]),
    );
    const spawned = run(w, ticks(10)).filter((e) => e.t === "spawned");
    expect(spawned).toHaveLength(15);
    expect(spawned.every((e) => e.tick > ticks(5) && e.tick <= ticks(6) + 1)).toBe(true);
  });

  it("places timed spawns at their moment", () => {
    const w = testWorld(threat([{ enemy: "dummy", at: 2, count: 3, pattern: "edge" }]));
    const spawned = run(w, ticks(10)).filter((e) => e.t === "spawned");
    expect(spawned.map((e) => e.tick)).toEqual([ticks(2) + 1, ticks(2) + 1, ticks(2) + 1]);
  });

  it("spawns off screen: spawnRadius from the player", () => {
    const w = testWorld(threat([{ enemy: "dummy", at: 0, count: 20, pattern: "edge" }]));
    const spawned = run(w, 2).filter((e) => e.t === "spawned");
    for (const e of spawned) expect(Math.hypot(e.x, e.y)).toBeCloseTo(600, 6);
  });

  it("places a timed ring spawn's enemies around the player on the tick it fires", () => {
    const w = testWorld(
      threat([{ enemy: "dummy", at: 0, count: 6, pattern: "ring", radius: 200 }]),
    );
    const spawned = run(w, 2).filter((e) => e.t === "spawned");
    expect(spawned).toHaveLength(6);
    expect(spawned.map((e) => e.tick)).toEqual(spawned.map(() => ticks(0) + 1));
    for (const e of spawned) expect(Math.hypot(e.x, e.y)).toBeCloseTo(200, 6);
  });

  it("warns of a field spawn at its moment, then spawns at the warned points warnS later", () => {
    const w = testWorld(
      threat([
        {
          enemy: "dummy",
          at: 1,
          count: 5,
          pattern: "field",
          minDistance: 100,
          maxDistance: 150,
          warnS: 0.5,
        },
      ]),
    );
    const events = run(w, ticks(3));
    const warned = events.filter((e) => e.t === "spawnWarned");
    const spawned = events.filter((e) => e.t === "spawned");
    expect(warned).toHaveLength(5);
    expect(spawned).toHaveLength(5);
    for (const [i, e] of warned.entries()) {
      expect(e.tick).toBe(ticks(1) + 1);
      expect(e.def).toBe("dummy");
      expect(e.spawnTick).toBe(e.tick + ticks(0.5));
      const d = Math.hypot(e.x, e.y);
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(150);
      expect(spawned[i]).toMatchObject({ tick: e.spawnTick, def: "dummy", x: e.x, y: e.y });
    }
  });

  it("throws on a warned spawn past its due tick instead of dropping it", () => {
    const w = testWorld(
      threat([
        {
          enemy: "dummy",
          at: 0,
          count: 1,
          pattern: "field",
          minDistance: 100,
          maxDistance: 150,
          warnS: 0.5,
        },
      ]),
    );
    run(w, 2);
    expect(w.wave.pending).toHaveLength(1);
    // A director that skipped the due tick: the spawn is behind the wave clock.
    w.wave.pending[0].due = w.wave.elapsed - 1;
    expect(() => run(w, 1)).toThrow(/warned dummy spawn was due at wave tick \d+/);
  });

  it("caps delayed field spawns at maxAlive like any other spawn", () => {
    const w = testWorld({
      "threats/tier-1.json": {
        durationS: 10,
        maxAlive: 3,
        spawns: [
          {
            enemy: "dummy",
            at: 0,
            count: 5,
            pattern: "field",
            minDistance: 100,
            maxDistance: 150,
            warnS: 0.5,
          },
        ],
      },
    });
    const spawned = run(w, ticks(1)).filter((e) => e.t === "spawned");
    expect(spawned).toHaveLength(3);
    expect(w.report.droppedSpawns).toBe(2);
  });
});
