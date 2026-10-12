import { TICK_HZ } from "@/core/clock";
import type { WaveReport } from "@/sim/report";
import { type Scenario, scenarioLabel } from "@/sim/scenario";

export interface ResultModel {
  title: string;
  lines: string[];
  /** The address that replays this run (cell, seed, overrides, options), shown as selectable text. */
  repro: string;
}

function count(byRole: Record<string, number>, role: string): number {
  return Object.hasOwn(byRole, role) ? byRole[role] : 0;
}

export function resultModel(report: WaveReport, scenario: Scenario, repro: string): ResultModel {
  if (report.outcome === null) throw new Error("result screen for a wave with no outcome");
  const damage = Object.entries(report.damageBySkill)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, dmg]) => `${skill} ${Math.round(dmg)} damage`);
  const lines = [
    scenarioLabel(scenario),
    `Time ${(report.ticks / TICK_HZ).toFixed(1)} s`,
    `Kills ${report.kills}`,
    ...damage,
  ];
  const { dodged, taken } = report.telegraphs;
  if (dodged + taken > 0) lines.push(`Telegraphs dodged ${dodged} of ${dodged + taken}`);
  const bosses = count(report.spawnedByRole, "boss");
  if (bosses > 0)
    lines.push(count(report.killsByRole, "boss") >= bosses ? "Boss defeated" : "Boss survived");
  if (report.causeOfDeath !== null) lines.push(`Killed by ${report.causeOfDeath}`);
  return { title: report.outcome === "survived" ? "Survived" : "Defeated", lines, repro };
}

export function showResult(
  root: HTMLElement,
  m: ResultModel,
  onRetry: () => void,
  onGrid: () => void,
): void {
  const h = document.createElement("h1");
  h.textContent = m.title;
  const list = document.createElement("ul");
  for (const line of m.lines) {
    const li = document.createElement("li");
    li.textContent = line;
    list.append(li);
  }
  const repro = document.createElement("p");
  repro.className = "repro";
  repro.textContent = m.repro;
  const retry = document.createElement("button");
  retry.id = "retry";
  retry.textContent = "Retry";
  retry.addEventListener("click", onRetry);
  const grid = document.createElement("button");
  grid.id = "grid";
  grid.textContent = "Grid";
  grid.addEventListener("click", onGrid);
  const box = document.createElement("div");
  box.append(h, list, repro, retry, grid);
  root.replaceChildren(box);
  root.hidden = false;
}

export function hideResult(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
