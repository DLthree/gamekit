import "@/ui/page.css";
import { installHandle } from "@/agent/handle";
import { PerfMeter } from "@/agent/perf";
import { classifyChange, loadContent, onContentReload } from "@/app/hot";
import { createTelemetry } from "@/app/telemetry-setup";
import { WaveSession } from "@/app/wave";
import { formatContentError } from "@/content/errors";
import type { Content } from "@/content/types";
import { type Flow, type FlowEvent, next } from "@/flow/machine";
import { pickerModel } from "@/flow/picker";
import { type CellRequest, parseUrl, reproUrl, urlFor } from "@/flow/url";
import type { ControlElements } from "@/input/controls";
import { installIosGuards } from "@/input/ios-guards";
import { computeViewport } from "@/present/camera";
import type { SoundStatus } from "@/present/sound";
import { AudioOut } from "@/render/audio";
import { bootRenderer } from "@/render/boot";
import type { WorldScene } from "@/render/world-scene";
import { IDLE } from "@/sim/command";
import { checkScenario, type Scenario, scenarioLabel } from "@/sim/scenario";
import { summarize } from "@/sim/snapshot";
import { hideError, showError } from "@/ui/error";
import { Hud, hudModel } from "@/ui/hud";
import { hidePause, showPause } from "@/ui/pause";
import { hidePicker, type LastCell, showPicker } from "@/ui/picker";
import { hideResult, resultModel, showResult } from "@/ui/result";

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (e === null) throw new Error(`index.html has no #${id}`);
  return e;
}

const url = parseUrl(location.search);
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
      scenario: flow.scenario,
      options: url.options,
      commit: __COMMIT__,
    });
    const back = flow.scenario?.character ?? flow.picker?.character ?? null;
    const onGrid = contentOk ? () => dispatch({ e: "showPicker", character: back }) : null;
    showError(el("error"), flow.title, flow.lines, onGrid);
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
    );
  }
  if (flow.screen === "wave") {
    if (prev.screen !== "wave" || prev.run !== flow.run) startWave(flow.scenario);
    applyPause(flow.paused, flow.scenario.character);
  }
  if (flow.screen === "result") {
    const { scenario } = flow;
    telemetry.record({
      kind: "wave",
      scenario,
      report: flow.report,
      sound: soundStatus(),
      options: url.options,
      commit: __COMMIT__,
    });
    showResult(
      el("result"),
      resultModel(flow.report, scenario, location.origin + reproUrl(scenario, url.options)),
      () => dispatch({ e: "retry", seed: runSeed() }),
      () => dispatch({ e: "showPicker", character: scenario.character }),
    );
  }
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

function frame(timeMs: number): void {
  if (wave === null) return;
  const started = performance.now();
  try {
    wave.frame(timeMs / 1000);
    hud.update(hudModel(wave.world));
  } catch (err) {
    crash(err);
    return;
  }
  if (lastFrameMs !== null) perf.frame(timeMs - lastFrameMs, performance.now() - started);
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

installHandle({
  flow: () => flow,
  state: () => summarize(need().world),
  step: (n, command = IDLE) => {
    if (!url.options.manual) throw new Error("step needs manual=1 in the URL");
    const w = need();
    try {
      w.step(n, command);
    } catch (err) {
      // Fail fast: the page shows the blocking panel, and the agent's call still throws.
      crash(err);
      throw err;
    }
    return summarize(w.world);
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
  content = compiled.content;
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
  scene.onFrame = frame;
  audio = new AudioOut(scene);
  const target = url.target;
  if (target === null)
    dispatch({ e: "failed", title: "Address", lines: url.errors, scenario: null });
  else if (target.screen === "cell") dispatch({ e: "loaded", scenario: scenarioFor(target.cell) });
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
  const change = classifyChange(content, compiled.content);
  if (change === "assets") {
    location.reload();
    return;
  }
  // Adopt the compiled content before any crash below, so a broken scenario doesn't leave the
  // Grid button (and a hot-reloaded picker) showing stale content (Minor m1).
  content = compiled.content;
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
    } else if (target.screen === "cell") {
      // A cell that failed at boot (no scenario, no picker to fall back to): content may have
      // fixed it, so rebuild and revalidate the scenario and retry the cell directly.
      try {
        dispatch({ e: "pickCell", scenario: scenarioFor(target.cell) });
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
