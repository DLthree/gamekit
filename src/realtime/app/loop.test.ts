import { describe, expect, it } from "vitest";
import { GameLoop } from "@/realtime/app/loop";
import { place, testWorld } from "@/realtime/test/world";

const FRAME = 1 / 60;

describe("GameLoop", () => {
  it("runs one tick per 60 Hz frame and at most five after a stall", () => {
    const loop = new GameLoop({ world: testWorld(), bot: null });
    loop.frame(0, 0, 0);
    loop.frame(FRAME, 0, 0);
    expect(loop.world.tick).toBe(1);
    loop.frame(FRAME + 2, 0, 0);
    expect(loop.world.tick).toBe(6);
  });

  it("does not fast-forward after a pause", () => {
    const loop = new GameLoop({ world: testWorld(), bot: null });
    loop.frame(FRAME, 0, 0);
    loop.pause();
    expect(loop.frame(5, 0, 0)).toEqual([]);
    expect(loop.world.tick).toBe(1);
    loop.resume();
    loop.frame(FRAME, 0, 0);
    expect(loop.world.tick).toBe(2);
  });

  it("keeps a cast requested on a frame that ran no tick", () => {
    const w = testWorld();
    place(w, "dummy", 300, 0);
    const loop = new GameLoop({ world: w, bot: null });
    loop.frame(0, 0, 0);
    loop.requestCast({ slot: "cast", aim: { x: 1, y: 0 } });
    expect(loop.frame(FRAME / 4, 0, 0)).toEqual([]);
    const events = loop.frame(FRAME, 0, 0);
    expect(events.some((e) => e.t === "cast" && e.skill === "boom")).toBe(true);
    expect(loop.frame(FRAME, 0, 0).some((e) => e.t === "cast" && e.skill === "boom")).toBe(false);
  });

  it("keeps a cast requested during a hit-stop freeze until the first playing tick", () => {
    const w = testWorld();
    place(w, "dummy", 300, 0);
    const loop = new GameLoop({ world: w, bot: null });
    loop.frame(0, 0, 0);
    w.freezeTicks = 1;
    loop.requestCast({ slot: "cast", aim: { x: 1, y: 0 } });
    const frozen = loop.frame(FRAME, 0, 0);
    expect(frozen.some((e) => e.t === "cast")).toBe(false);
    expect(w.tick).toBe(0);
    const events = loop.frame(FRAME, 0, 0);
    expect(events.some((e) => e.t === "cast" && e.skill === "boom")).toBe(true);
  });

  it("keeps a cast requested during the countdown until the first playing tick", () => {
    const w = testWorld({ "rules/feel.json": { hitStopS: 0, countdownS: 2 / 60 } });
    place(w, "dummy", 300, 0);
    const loop = new GameLoop({ world: w, bot: null });
    loop.frame(0, 0, 0);
    loop.requestCast({ slot: "cast", aim: { x: 1, y: 0 } });
    const t1 = loop.frame(FRAME, 0, 0);
    expect(t1.some((e) => e.t === "cast")).toBe(false);
    expect(w.phase).toBe("countdown");
    const t2 = loop.frame(FRAME, 0, 0);
    expect(t2.some((e) => e.t === "cast")).toBe(false);
    expect(w.phase).toBe("playing");
    const t3 = loop.frame(FRAME, 0, 0);
    expect(t3.some((e) => e.t === "cast" && e.skill === "boom")).toBe(true);
  });

  it("stops ticking once the wave has ended", () => {
    const loop = new GameLoop({ world: testWorld(), bot: null });
    const events = [];
    for (let i = 0; i < 1000; i++) events.push(...loop.frame(FRAME, 0, 0));
    expect(events.filter((e) => e.t === "waveEnded")).toHaveLength(1);
    expect(loop.ended).toBe(true);
  });
});
