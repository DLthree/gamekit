import type { WaveReport } from "@/sim/report";
import type { Scenario } from "@/sim/scenario";

/** Every screen the app can be on. */
export type Flow =
  | { screen: "boot" }
  | { screen: "picker"; character: string | null }
  | {
      screen: "error";
      title: string;
      lines: string[];
      scenario: Scenario | null;
      /** The grid this error interrupted; a content fix returns to it. */
      picker: { character: string | null } | null;
    }
  | { screen: "wave"; scenario: Scenario; run: number; paused: boolean }
  | { screen: "result"; scenario: Scenario; report: WaveReport; run: number };

export type FlowEvent =
  | { e: "loaded"; scenario: Scenario }
  | { e: "showPicker"; character: string | null }
  | { e: "pickCell"; scenario: Scenario }
  | { e: "failed"; title: string; lines: string[]; scenario: Scenario | null }
  | { e: "waveEnded"; report: WaveReport }
  /** A new run of the result's cell with this seed (the URL's, or a fresh random one). */
  | { e: "retry"; seed: number }
  | { e: "pause" }
  | { e: "resume" }
  | { e: "contentReloaded" };

/** The one place screens change. Events that don't apply return the same flow object. */
export function next(flow: Flow, ev: FlowEvent): Flow {
  if (ev.e === "failed") {
    const picker = flow.screen === "picker" ? { character: flow.character } : null;
    return { screen: "error", title: ev.title, lines: ev.lines, scenario: ev.scenario, picker };
  }
  switch (flow.screen) {
    case "boot":
      if (ev.e === "loaded")
        return { screen: "wave", scenario: ev.scenario, run: 1, paused: false };
      if (ev.e === "showPicker") return { screen: "picker", character: ev.character };
      return flow;
    case "picker":
      if (ev.e === "pickCell")
        return { screen: "wave", scenario: ev.scenario, run: 1, paused: false };
      // A new object, so main redraws the grid: a sim edit can add tiers or threats.
      if (ev.e === "contentReloaded") return { screen: "picker", character: flow.character };
      return flow;
    case "wave":
      if (ev.e === "waveEnded")
        return { screen: "result", scenario: flow.scenario, report: ev.report, run: flow.run };
      if (ev.e === "pause" && !flow.paused) return { ...flow, paused: true };
      if (ev.e === "resume" && flow.paused) return { ...flow, paused: false };
      // The pause overlay's Grid button; a running wave has no way to the grid.
      if (ev.e === "showPicker" && flow.paused)
        return { screen: "picker", character: ev.character };
      if (ev.e === "contentReloaded")
        return { screen: "wave", scenario: flow.scenario, run: flow.run + 1, paused: false };
      return flow;
    case "result":
      if (ev.e === "retry") {
        const scenario = { ...flow.scenario, seed: ev.seed };
        return { screen: "wave", scenario, run: flow.run + 1, paused: false };
      }
      if (ev.e === "showPicker") return { screen: "picker", character: ev.character };
      return flow;
    case "error":
      if (ev.e === "showPicker") return { screen: "picker", character: ev.character };
      // A cell whose scenario failed at boot (no scenario, no picker to fall back to): once
      // content is fixed, main.ts rebuilds and revalidates the scenario and retries it directly.
      if (ev.e === "pickCell")
        return { screen: "wave", scenario: ev.scenario, run: 1, paused: false };
      if (ev.e !== "contentReloaded") return flow;
      if (flow.scenario !== null)
        return { screen: "wave", scenario: flow.scenario, run: 1, paused: false };
      if (flow.picker !== null) return { screen: "picker", character: flow.picker.character };
      return flow;
  }
}
