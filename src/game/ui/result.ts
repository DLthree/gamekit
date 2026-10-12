import { TICK_HZ } from "@/core/clock";
import type { WaveReport } from "@/game/report";
import type { Scenario } from "@/game/scenario";
import { actionButton } from "@/ui/button";
import { showPage } from "@/ui/page";
import { idWords } from "@/ui/vocabulary";

export interface ResultModel {
  title: string;
  lines: string[];
  /**
   * The address that replays this run (cell, seed, overrides, options), shown as small
   * selectable text for bug reports: the one line on the page not in the player's words.
   */
  repro: string;
}

function count(byRole: Record<string, number>, role: string): number {
  return Object.hasOwn(byRole, role) ? byRole[role] : 0;
}

export function resultModel(report: WaveReport, scenario: Scenario, repro: string): ResultModel {
  if (report.outcome === null) throw new Error("result screen for a wave with no outcome");
  const damage = Object.entries(report.damageBySkill)
    .sort((a, b) => b[1] - a[1])
    .map(([skill, dmg]) => `${idWords(skill)} ${Math.round(dmg)} damage`);
  const lines = [
    `${idWords(scenario.character)} · build ${scenario.buildTier} · threat ${scenario.threatTier}`,
    `Time ${(report.ticks / TICK_HZ).toFixed(1)} s`,
    `Kills ${report.kills}`,
    ...damage,
  ];
  const { dodged, taken } = report.telegraphs;
  if (dodged + taken > 0) lines.push(`Warned attacks dodged ${dodged} of ${dodged + taken}`);
  const bosses = count(report.spawnedByRole, "boss");
  if (bosses > 0)
    lines.push(count(report.killsByRole, "boss") >= bosses ? "Boss defeated" : "Boss survived");
  if (report.causeOfDeath !== null) lines.push(`Killed by ${idWords(report.causeOfDeath)}`);
  return { title: report.outcome === "survived" ? "Survived" : "Defeated", lines, repro };
}

export function showResult(
  root: HTMLElement,
  m: ResultModel,
  onRetry: () => void,
  onGrid: () => void,
): void {
  const list = document.createElement("ul");
  for (const line of m.lines) {
    const li = document.createElement("li");
    li.textContent = line;
    list.append(li);
  }
  const repro = document.createElement("p");
  repro.className = "repro";
  repro.textContent = m.repro;
  showPage(root, {
    title: m.title,
    body: [list, repro],
    buttons: [actionButton("retry", "Retry", onRetry), actionButton("grid", "Grid", onGrid)],
  });
}
