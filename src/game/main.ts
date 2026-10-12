import "@/ui/page.css";
import "@/realtime/arena.css";
import "@/game/ui/game.css";
import { clockHandle, installHandle } from "@/agent/handle";
import { recordText } from "@/agent/record";
import { classifyChange, loadContent, onContentReload } from "@/app/hot";
import { saveStore, steamDeeds, steamProblem } from "@/app/platform";
import { createTelemetry } from "@/app/telemetry-setup";
import { formatContentError } from "@/content/errors";
import { switchOn } from "@/content/switches";
import type { Content } from "@/content/types";
import { type Frame, FrameClock } from "@/core/frames";
import { actionCommand } from "@/game/actions";
import { deedList, deedsMet, readEarned, writeEarned } from "@/game/deeds";
import { type Flow, type FlowEvent, next } from "@/game/flow";
import { pickerModel } from "@/game/picker";
import { recordOf } from "@/game/record";
import type { WaveReport } from "@/game/report";
import { checkScenario, type Scenario, scenarioLabel, stageScenario } from "@/game/scenario";
import { Hud, hudModel } from "@/game/ui/hud";
import { PAD_KEYS } from "@/game/ui/pad-keys";
import { hidePause, showPause } from "@/game/ui/pause";
import { type DeedRow, hidePicker, type LastCell, showPicker } from "@/game/ui/picker";
import { hideResult, resultModel, showResult } from "@/game/ui/result";
import { type CellRequest, parseUrl, reproUrl, type UrlTarget, urlFor } from "@/game/url";
import { WaveSession } from "@/game/wave-session";
import { installIosGuards } from "@/input/ios-guards";
import { PerfMeter } from "@/realtime/agent/perf";
import type { ControlElements } from "@/realtime/input/controls";
import { computeViewport } from "@/realtime/present/camera";
import type { SoundStatus } from "@/realtime/present/sound";
import { AudioOut } from "@/realtime/render/audio";
import { bootRenderer } from "@/realtime/render/boot";
import type { WorldScene } from "@/realtime/render/world-scene";
import { summarize } from "@/realtime/sim/snapshot";
import { hideError, showError } from "@/ui/error";
import { markPadKeys } from "@/ui/pad-keys";
import { startPadNav } from "@/ui/pad-nav";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (e === null) throw new Error(`index.html has no #${id}`);
  return e;
}

const url = parseUrl(location.search, __RELEASE__ ? "release" : "dev");
/** Every frame runs on the kit clock: the display drives it, or a tool steps it (manual=1). */
const clock = new FrameClock(url.options.manual);
const perf = new PerfMeter(120);
const { telemetry, failures: telemetryFailures } = createTelemetry(url.options);
let lastPerfS = 0;
const elements: ControlElements = {
  touchZone: el("touch-zone"),
  stickBase: el("stick-base"),
  stickKnob: el("stick-knob"),
  skillButton: el("skill-button"),
  skillKnob: el("skill-knob"),
};
const hud = new Hud(el("hud"));
clock.onFrame(frame);
let flow: Flow = { screen: "boot" };
let content: Content | null = null;
/** The last compile succeeded; the grid and its picks only run on valid content (fail fast). */
let contentOk = false;
let scene: WorldScene | null = null;
let audio: AudioOut | null = null;
let wave: WaveSession | null = null;
let lastFrameMs: number | null = null;
/** The cell last played this session; the grid highlights it. */
let lastCell: LastCell | null = null;
/** The deeds earned, as the save has them (read at boot). */
let earned = new Set<string>();

function dispatch(ev: FlowEvent): void {
  const prev = flow;
  flow = next(prev, ev);
  if (flow !== prev) show(prev);
}

function show(prev: Flow): void {
  document.body.dataset.screen = flow.screen;
  const address = urlFor(flow, location.search);
  if (address !== null) history.replaceState(null, "", address);
  if (flow.screen !== "result") hideResult(el("result"));
  if (flow.screen !== "picker") hidePicker(el("picker"));
  if (flow.screen !== "wave" || !flow.paused) hidePause(el("pause"));
  if (flow.screen === "error") {
    endWave();
    telemetry.record({
      kind: "error",
      title: flow.title,
      lines: flow.lines,
      options: url.options,
      commit: __COMMIT__,
      record:
        flow.scenario === null
          ? null
          : recordText(recordOf(flow.scenario, url.options, __COMMIT__)),
    });
    const back = flow.scenario?.character ?? flow.picker?.character ?? null;
    const toGrid = () => dispatch({ e: "showPicker", character: back });
    const exit = contentOk ? { id: "grid", label: "Grid", onClick: toGrid } : null;
    showError(el("error"), flow.title, flow.lines, exit, __RELEASE__);
    markPadKeys(PAD_KEYS, el("error"));
    return;
  }
  hideError(el("error"));
  if (flow.screen === "picker") {
    endWave();
    if (content === null) throw new Error("the grid before content loaded");
    showPicker(
      el("picker"),
      pickerModel(content.sim, flow.character),
      (character, b, t) =>
        dispatch({
          e: "pickCell",
          scenario: scenarioFor({ character, buildTier: b, threatTier: t }),
        }),
      lastCell,
      deedRows(),
    );
  }
  if (flow.screen === "wave") {
    if (prev.screen !== "wave" || prev.run !== flow.run) startWave(flow.scenario);
    applyPause(flow.paused, flow.scenario.character);
  }
  if (flow.screen === "result") {
    const { scenario } = flow;
    earn(scenario, flow.report);
    telemetry.record({
      kind: "run",
      report: { ...flow.report, sound: soundStatus() },
      options: url.options,
      commit: __COMMIT__,
      record: recordText(recordOf(scenario, url.options, __COMMIT__)),
    });
    showResult(
      el("result"),
      // The replay address is for bug reports in dev; the release build leaves its row empty.
      resultModel(
        flow.report,
        scenario,
        __RELEASE__ ? "" : location.origin + reproUrl(scenario, url.options),
      ),
      () => dispatch({ e: "retry", seed: runSeed() }),
      () => dispatch({ e: "showPicker", character: scenario.character }),
    );
    markPadKeys(PAD_KEYS, el("result"));
  }
}

function deedRows(): DeedRow[] {
  if (content === null) throw new Error("deeds before content loaded");
  return deedList(content.sim).map((d) => ({ ...d, earned: earned.has(d.id) }));
}

/** Saves the deeds the wave met that weren't earned yet, and unlocks them on Steam. */
function earn(scenario: Scenario, report: WaveReport): void {
  if (content === null) throw new Error("deeds before content loaded");
  const fresh = deedsMet(content.sim, scenario, report).filter((id) => !earned.has(id));
  if (fresh.length === 0) return;
  earned = new Set([...earned, ...fresh]);
  writeEarned(saveStore(), earned);
  telemetry.record({ kind: "deeds", earned: fresh });
  steamDeeds(fresh);
}

/** The URL's seed, or a fresh random uint32 for every run (the sim itself stays seeded). */
function runSeed(): number {
  if (url.seed !== null) return url.seed;
  const out = new Uint32Array(1);
  crypto.getRandomValues(out);
  return out[0];
}

/** A checked cell, from the URL or the grid: the URL's seed and overrides apply either way. */
function scenarioFor(cell: CellRequest): Scenario {
  if (content === null) throw new Error("a cell before content loaded");
  const scenario: Scenario = { ...cell, seed: runSeed(), overrides: url.overrides };
  checkScenario(scenario, content.sim);
  return scenario;
}

/** The checked scenario a cell or stage address opens. */
function scenarioForTarget(target: Extract<UrlTarget, { screen: "cell" | "stage" }>): Scenario {
  if (target.screen === "cell") return scenarioFor(target.cell);
  if (content === null) throw new Error("a stage before content loaded");
  const scenario = stageScenario(content.sim, target.stage, runSeed(), url.overrides);
  checkScenario(scenario, content.sim);
  return scenario;
}

function crash(err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const scenario = "scenario" in flow ? flow.scenario : null;
  const lines = [
    scenario === null ? "no scenario" : scenarioLabel(scenario),
    wave === null ? "before the first tick" : `tick ${wave.world.tick}`,
    e.message,
    ...(e.stack ?? "").split("\n").slice(1, 9),
  ];
  dispatch({
    e: "failed",
    title: e.name === "ScenarioError" ? "Scenario" : "Crash",
    lines,
    scenario,
  });
}

/** The loop follows the flow's pause; the overlay is the only way back in. */
function applyPause(paused: boolean, character: string): void {
  const w = need();
  if (paused) {
    w.loop.pause();
    showPause(
      el("pause"),
      () => dispatch({ e: "resume" }),
      () => dispatch({ e: "showPicker", character }),
    );
    markPadKeys(PAD_KEYS, el("pause"));
  } else if (w.loop.paused) {
    w.loop.resume();
    // The paused gap is not a frame: the perf meter restarts its frame clock too.
    lastFrameMs = null;
  }
}

function endWave(): void {
  if (wave !== null) wave.destroy();
  wave = null;
}

function startWave(scenario: Scenario): void {
  endWave();
  if (content === null || scene === null || audio === null)
    throw new Error("startWave before boot");
  lastCell = {
    character: scenario.character,
    buildTier: scenario.buildTier,
    threatTier: scenario.threatTier,
  };
  perf.reset();
  lastFrameMs = null;
  wave = new WaveSession({
    content,
    scenario,
    options: url.options,
    scene,
    audio,
    elements,
    onTrace: (trace) =>
      telemetry.record({ kind: "gesture", tick: wave === null ? 0 : wave.world.tick, trace }),
    onEnded: (report) => dispatch({ e: "waveEnded", report }),
  });
}

function frame(f: Frame): void {
  if (wave === null) return;
  const timeMs = f.nowS * 1000;
  const started = performance.now();
  const frozenBefore = wave.world.frozenSteps;
  try {
    wave.frame(f.dtS);
    hud.update(hudModel(wave.world));
  } catch (err) {
    crash(err);
    // A stepping tool's call fails too, not only the page.
    if (clock.stepped) throw err;
    return;
  }
  if (scene === null) throw new Error("a frame before boot");
  // Phaser renders after this callback: its time is the last frame's render.
  if (lastFrameMs !== null)
    perf.frame(
      timeMs - lastFrameMs,
      performance.now() - started,
      scene.renderMs,
      wave.world.frozenSteps - frozenBefore,
    );
  lastFrameMs = timeMs;
  const nowS = timeMs / 1000;
  if (nowS - lastPerfS >= 2) {
    lastPerfS = nowS;
    telemetry.record({ kind: "perf", tick: wave.world.tick, perf: perf.summary() });
    perf.reset();
  }
}

function soundStatus(): SoundStatus {
  if (audio === null) throw new Error("no audio before boot");
  return { ...need().pres.sound.counts, state: audio.state, unlockFailures: audio.unlock.failures };
}

function need(): WaveSession {
  if (wave === null) throw new Error(`no wave running (screen: ${flow.screen})`);
  return wave;
}

// The agent handle is a dev tool: the release build has none.
if (!__RELEASE__)
  installHandle({
    flow: () => flow,
    on: () => url.options.on,
    state: () => summarize(need().world),
    ...clockHandle(clock),
    act: (action) => {
      if (!url.options.manual) throw new Error("act needs manual=1 in the URL");
      const { command, frames } = actionCommand(action);
      const w = need();
      w.script(command);
      try {
        for (let i = 0; i < frames && !w.loop.ended; i++) clock.step(1);
      } finally {
        w.script(null);
      }
    },
    events: (since = 0) => {
      if (!url.options.agent) throw new Error("events needs agent=1 in the URL");
      return need().log.filter((e) => e.tick >= since);
    },
    report: () => need().world.report,
    fx: () => need().pres.em.pool.counts(),
    telegraphs: () => need().telegraphCount,
    stopFx: () => {
      need().pres.em.pool.stopped = true;
    },
    perf: () => perf.summary(),
    retry: () => dispatch({ e: "retry", seed: runSeed() }),
    pause: () => {
      need();
      dispatch({ e: "pause" });
    },
    resume: () => {
      need();
      dispatch({ e: "resume" });
    },
    telemetryFailures,
    playerCss: () => need().playerCss(),
    sound: soundStatus,
    suspendAudio: () => {
      if (!url.options.manual) throw new Error("suspendAudio needs manual=1 in the URL");
      if (audio === null) throw new Error("no audio before boot");
      return audio.suspend();
    },
  });

async function boot(): Promise<void> {
  installIosGuards();
  telemetry.record({
    kind: "load",
    url: location.pathname + location.search,
    userAgent: navigator.userAgent,
    css: [window.innerWidth, window.innerHeight],
    dpr: window.devicePixelRatio,
    commit: __COMMIT__,
    options: url.options,
  });
  if (!url.options.ui) document.body.classList.add("no-ui");
  const compiled = loadContent(url.overrides);
  if (!compiled.ok) {
    dispatch({
      e: "failed",
      title: "Content",
      lines: compiled.errors.map(formatContentError),
      scenario: null,
    });
    return;
  }
  content = switchOn(compiled.content, url.options.on);
  // Nothing plays without Steam in the Steam build, or on a save the game can't read: their
  // panels have no way on (contentOk stays false until both are good).
  const steam = steamProblem();
  if (steam !== null) {
    dispatch({ e: "failed", title: "Steam", lines: [steam], scenario: null });
    return;
  }
  try {
    earned = readEarned(saveStore());
  } catch (err) {
    dispatch({ e: "failed", title: "Save", lines: [String(err)], scenario: null });
    return;
  }
  // Steam re-syncs every earned deed at start-up (one earned offline, or before a reinstall).
  steamDeeds([...earned]);
  contentOk = true;
  const cam = content.look.camera;
  const view = computeViewport(
    window.innerWidth,
    window.innerHeight,
    url.options.dpr ?? window.devicePixelRatio,
    cam.dprCap,
    cam.shortSideSpan,
  );
  // The renderer boots before the address and cell are checked, so their error panels can lead
  // to the grid and on to a playable cell.
  scene = await bootRenderer(el("game"), content, view);
  scene.onFrame = (timeMs) => clock.display(timeMs / 1000);
  audio = new AudioOut(scene);
  const target = url.target;
  if (target === null)
    dispatch({ e: "failed", title: "Address", lines: url.errors, scenario: null });
  else if (target.screen !== "picker")
    dispatch({ e: "loaded", scenario: scenarioForTarget(target) });
  else {
    pickerModel(content.sim, target.character);
    dispatch({ e: "showPicker", character: target.character });
  }
}

// A hidden page pauses the wave, and it stays paused behind the overlay on return.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  telemetry.flush(true);
  dispatch({ e: "pause" });
});
el("pause-button").addEventListener("click", () => dispatch({ e: "pause" }));
startPadNav({
  modals: ["error"],
  screens: ["pause", "picker", "result"],
  inFight: () => flow.screen === "wave" && !flow.paused,
  start: () => {
    if (flow.screen === "wave") dispatch({ e: flow.paused ? "resume" : "pause" });
  },
  // Every screen with a way back has it on B (game/ui/pad-keys.ts); the grid has none.
  back: () => {},
});
window.addEventListener("error", (e) => crash(e.error));
window.addEventListener("unhandledrejection", (e) => crash(e.reason));
setInterval(() => telemetry.flush(false), 5000);

onContentReload((load) => {
  const target = url.target;
  const scenario = "scenario" in flow ? flow.scenario : null;
  const compiled = load(url.overrides);
  if (!compiled.ok) {
    contentOk = false;
    dispatch({
      e: "failed",
      title: "Content",
      lines: compiled.errors.map(formatContentError),
      scenario,
    });
    return;
  }
  if (content === null || scene === null) {
    // Boot never finished (content was invalid at load): boot again on the fixed files.
    location.reload();
    return;
  }
  const switched = switchOn(compiled.content, url.options.on);
  const change = classifyChange(content, switched);
  if (change === "assets") {
    location.reload();
    return;
  }
  // Adopt the compiled content before any crash below, so a broken scenario doesn't leave the
  // Grid button (and a hot-reloaded picker) showing stale content.
  content = switched;
  contentOk = true;
  if (change === "sim" && scenario !== null) {
    // Validate against the running cell before adopting: an edit that breaks it shows the
    // Scenario error panel now, even under hot=keep, instead of a generic crash at retry.
    try {
      checkScenario(scenario, content.sim);
    } catch (err) {
      crash(err);
      return;
    }
  }
  if (change === "look" && wave !== null && flow.screen !== "error") wave.swapLook(content);
  if (flow.screen === "error") {
    if (flow.scenario !== null || flow.picker !== null) {
      dispatch({ e: "contentReloaded" });
    } else if (target === null) {
      // The address is still malformed: boot again to its Address panel (with its Grid button).
      location.reload();
    } else if (target.screen !== "picker") {
      // A cell that failed at boot (no scenario, no picker to fall back to): content may have
      // fixed it, so rebuild and revalidate the scenario and retry the cell directly.
      try {
        dispatch({ e: "pickCell", scenario: scenarioForTarget(target) });
      } catch (err) {
        crash(err);
      }
    } else {
      dispatch({ e: "showPicker", character: target.character });
    }
    // A sim edit redraws the grid even under hot=keep, because it may add tiers or threats.
  } else if (change === "sim" && (url.options.hot === "restart" || flow.screen === "picker")) {
    dispatch({ e: "contentReloaded" });
  }
});

boot().catch(crash);
