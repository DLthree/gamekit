import { describe, expect, it } from "vitest";
import { type Flow, next } from "@/game/flow";
import { createReport } from "@/game/report";
import { TEST_SCENARIO } from "@/realtime/test/world";

const report = createReport(100);

describe("flow", () => {
  const wave = next({ screen: "boot" }, { e: "loaded", scenario: TEST_SCENARIO });

  it("boots into the wave and ends on the result", () => {
    expect(wave).toEqual({ screen: "wave", scenario: TEST_SCENARIO, run: 1, paused: false });
    expect(next(wave, { e: "waveEnded", report })).toEqual({
      screen: "result",
      scenario: TEST_SCENARIO,
      report,
      run: 1,
    });
  });

  it("retry starts a new run of the same cell with the given seed", () => {
    const result = next(wave, { e: "waveEnded", report });
    expect(next(result, { e: "retry", seed: 99 })).toEqual({
      screen: "wave",
      scenario: { ...TEST_SCENARIO, seed: 99 },
      run: 2,
      paused: false,
    });
  });

  it("a content reload restarts a running wave and recovers from an error with a scenario", () => {
    expect(next(wave, { e: "contentReloaded" })).toMatchObject({ screen: "wave", run: 2 });
    const failed: Flow = {
      screen: "error",
      title: "Content",
      lines: ["x"],
      scenario: TEST_SCENARIO,
      picker: null,
    };
    expect(next(failed, { e: "contentReloaded" })).toMatchObject({ screen: "wave", run: 1 });
    const noCell: Flow = {
      screen: "error",
      title: "No cell",
      lines: [],
      scenario: null,
      picker: null,
    };
    expect(next(noCell, { e: "contentReloaded" })).toBe(noCell);
  });

  it("any failure shows the error screen", () => {
    expect(
      next(wave, { e: "failed", title: "Crash", lines: ["tick 5"], scenario: TEST_SCENARIO }),
    ).toEqual({
      screen: "error",
      title: "Crash",
      lines: ["tick 5"],
      scenario: TEST_SCENARIO,
      picker: null,
    });
  });

  it("pauses and resumes a wave in place; a paused wave can go to the grid", () => {
    const paused = next(wave, { e: "pause" });
    expect(paused).toEqual({ ...wave, paused: true });
    expect(next(paused, { e: "pause" })).toBe(paused);
    expect(next(paused, { e: "resume" })).toEqual(wave);
    expect(next(wave, { e: "resume" })).toBe(wave);
    expect(next(paused, { e: "showPicker", character: "hero" })).toEqual({
      screen: "picker",
      character: "hero",
    });
    expect(next(paused, { e: "contentReloaded" })).toMatchObject({ run: 2, paused: false });
    const result = next(wave, { e: "waveEnded", report });
    expect(next(result, { e: "pause" })).toBe(result);
  });

  it("ignores events that don't apply", () => {
    expect(next(wave, { e: "retry", seed: 1 })).toBe(wave);
    const boot: Flow = { screen: "boot" };
    expect(next(boot, { e: "waveEnded", report })).toBe(boot);
  });

  it("the grid starts a picked cell, and results and errors go back to it", () => {
    const picker = next({ screen: "boot" }, { e: "showPicker", character: null });
    expect(picker).toEqual({ screen: "picker", character: null });
    expect(next(picker, { e: "pickCell", scenario: TEST_SCENARIO })).toEqual({
      screen: "wave",
      scenario: TEST_SCENARIO,
      run: 1,
      paused: false,
    });
    const result = next(wave, { e: "waveEnded", report });
    expect(next(result, { e: "showPicker", character: "hero" })).toEqual({
      screen: "picker",
      character: "hero",
    });
    expect(next(wave, { e: "showPicker", character: null })).toBe(wave);
  });

  it("an error on the grid returns to it once content is fixed", () => {
    const picker: Flow = { screen: "picker", character: "hero" };
    const failed = next(picker, { e: "failed", title: "Content", lines: ["x"], scenario: null });
    expect(failed).toMatchObject({ screen: "error", picker: { character: "hero" } });
    expect(next(failed, { e: "contentReloaded" })).toEqual(picker);
    expect(next(picker, { e: "contentReloaded" })).not.toBe(picker);
  });

  it("a cell that failed at boot with no scenario and no picker retries directly on pickCell", () => {
    const noCell: Flow = {
      screen: "error",
      title: "Scenario",
      lines: ["x"],
      scenario: null,
      picker: null,
    };
    expect(next(noCell, { e: "contentReloaded" })).toBe(noCell);
    expect(next(noCell, { e: "pickCell", scenario: TEST_SCENARIO })).toEqual({
      screen: "wave",
      scenario: TEST_SCENARIO,
      run: 1,
      paused: false,
    });
  });
});
