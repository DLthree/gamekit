import { afterEach, describe, expect, it, vi } from "vitest";
import { deadZone, glyph, glyphSet, PAD, Pad } from "@/input/gamepad";
import { fakePad } from "@/test/pad";

let pads: unknown[] = [];

function stubPads(): void {
  vi.stubGlobal("navigator", { getGamepads: () => pads });
}

afterEach(() => {
  vi.unstubAllGlobals();
  pads = [];
});

describe("deadZone", () => {
  it("centres small tilts and rescales from the edge to full tilt", () => {
    expect(deadZone(0.1, 0.1)).toEqual({ x: 0, y: 0 });
    expect(deadZone(1, 0).x).toBeCloseTo(1);
    expect(deadZone(0.6, 0).x).toBeCloseTo(0.5);
    const d = deadZone(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
  });
});

describe("Pad", () => {
  it("reads nothing without the Gamepad API or a connected pad", () => {
    vi.stubGlobal("navigator", {});
    const p = new Pad();
    p.poll();
    expect(p.move()).toEqual({ x: 0, y: 0 });
    expect(p.aim()).toBeNull();
    stubPads();
    pads = [null, { ...fakePad(["a"]), connected: false }];
    p.poll();
    expect(p.held("a")).toBe(false);
    expect(p.active()).toBe(false);
  });

  it("reports a press once, while it stays held", () => {
    stubPads();
    const p = new Pad();
    pads = [null, fakePad(["a"])];
    p.poll();
    expect(p.pressed("a")).toBe(true);
    expect(p.active()).toBe(true);
    p.poll();
    expect(p.pressed("a")).toBe(false);
    expect(p.held("a")).toBe(true);
    expect(p.active()).toBe(false);
    pads = [fakePad()];
    p.poll();
    expect(p.held("a")).toBe(false);
  });

  it("reads a half-pulled trigger as pressed", () => {
    stubPads();
    const pad = fakePad();
    pad.buttons[PAD.rt] = { pressed: false, value: 0.8 };
    pads = [pad];
    const p = new Pad();
    p.poll();
    expect(p.pressed("rt")).toBe(true);
  });

  it("moves on the left stick past the dead zone, else on the D-pad", () => {
    stubPads();
    const p = new Pad();
    pads = [fakePad([], [0.1, -0.1, 0, 0])];
    p.poll();
    expect(p.move()).toEqual({ x: 0, y: 0 });
    pads = [fakePad([], [0, -1, 0, 0])];
    p.poll();
    expect(p.move().y).toBeCloseTo(-1);
    pads = [fakePad(["right", "down"])];
    p.poll();
    expect(p.move().x).toBeCloseTo(Math.SQRT1_2);
    expect(p.move().y).toBeCloseTo(Math.SQRT1_2);
  });

  it("aims on the right stick, null while centred", () => {
    stubPads();
    const p = new Pad();
    pads = [fakePad([], [0, 0, -1, 0])];
    p.poll();
    expect(p.aim()?.x).toBeCloseTo(-1);
    expect(p.active()).toBe(true);
    pads = [fakePad([], [0, 0, 0.05, 0])];
    p.poll();
    expect(p.aim()).toBeNull();
  });
});

describe("glyphs", () => {
  it("names a PlayStation pad's buttons by their shapes, every other pad's by Xbox letters", () => {
    expect(glyphSet("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)")).toBe(
      "playstation",
    );
    expect(glyphSet("054c-09cc-Wireless Controller")).toBe("playstation");
    expect(glyphSet("Steam Virtual Gamepad (STANDARD GAMEPAD Vendor: 28de)")).toBe("xbox");
    expect(glyphSet("Xbox Wireless Controller (STANDARD GAMEPAD)")).toBe("xbox");
    expect(glyph("xbox", "x")).toBe("X");
    expect(glyph("playstation", "x")).toBe("□");
    expect(glyph("playstation", "a")).toBe("✕");
    expect(glyph("xbox", "lb")).toBe("LB");
    expect(glyph("playstation", "rb")).toBe("R1");
  });

  it("reads the glyph set from the pad connected at the last poll", () => {
    stubPads();
    const p = new Pad();
    p.poll();
    expect(p.glyphs()).toBeNull();
    pads = [fakePad([], [0, 0, 0, 0], "Sony PLAYSTATION(R)3 Controller")];
    p.poll();
    expect(p.glyphs()).toBe("playstation");
    pads = [null, fakePad()];
    p.poll();
    expect(p.glyphs()).toBe("xbox");
  });
});
