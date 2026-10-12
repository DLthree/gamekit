import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadMode, saveMode } from "@desktop/window-mode";
import { describe, expect, it } from "vitest";

const dir = () => mkdtempSync(join(tmpdir(), "gamekit-mode-"));

describe("the window mode", () => {
  it("is fullscreen on a fresh install, and round-trips", () => {
    const d = dir();
    expect(loadMode(d)).toEqual({ fullscreen: true, bounds: null });
    const mode = { fullscreen: false, bounds: { x: 1, y: 2, width: 1280, height: 800 } };
    saveMode(d, mode);
    expect(loadMode(d)).toEqual(mode);
  });

  it("refuses a file it can't use, naming it", () => {
    const d = dir();
    writeFileSync(join(d, "desktop.json"), '{"fullscreen": "yes"}');
    expect(() => loadMode(d)).toThrow(/desktop\.json: expected/);
  });
});
