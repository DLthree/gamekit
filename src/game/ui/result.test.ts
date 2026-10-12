import { describe, expect, it } from "vitest";
import { createReport } from "@/game/report";
import { resultModel } from "@/game/ui/result";
import { TEST_SCENARIO } from "@/realtime/test/world";

describe("resultModel", () => {
  it("summarises a survived wave", () => {
    const r = { ...createReport(100), outcome: "survived" as const, ticks: 600, kills: 12 };
    r.damageBySkill = { zap: 40.4, boom: 120 };
    expect(resultModel(r, TEST_SCENARIO, "/?repro")).toEqual({
      title: "Survived",
      lines: [
        "Hero · build 1 · threat 1",
        "Time 10.0 s",
        "Kills 12",
        "Boom 120 damage",
        "Zap 40 damage",
      ],
      repro: "/?repro",
    });
  });

  it("names what killed the player", () => {
    const r = { ...createReport(100), outcome: "died" as const, ticks: 300, causeOfDeath: "dummy" };
    expect(resultModel(r, TEST_SCENARIO, "/?repro").lines).toEqual([
      "Hero · build 1 · threat 1",
      "Time 5.0 s",
      "Kills 0",
      "Killed by Dummy",
    ]);
    expect(resultModel(r, TEST_SCENARIO, "/?repro").title).toBe("Defeated");
  });

  it("refuses a report without an outcome", () => {
    expect(() => resultModel(createReport(100), TEST_SCENARIO, "/?repro")).toThrow("no outcome");
  });

  it("counts dodged warned attacks out of those that landed, hidden when none landed", () => {
    const r = { ...createReport(100), outcome: "survived" as const, ticks: 600 };
    expect(resultModel(r, TEST_SCENARIO, "/?repro").lines.join("|")).not.toContain("Warned");
    r.telegraphs = { started: 9, dodged: 5, taken: 2, cancelled: 1 };
    expect(resultModel(r, TEST_SCENARIO, "/?repro").lines).toContain(
      "Warned attacks dodged 5 of 7",
    );
  });

  it("says whether the boss fell, only when one spawned", () => {
    const r = { ...createReport(100), outcome: "died" as const, ticks: 600 };
    const lines = () => resultModel(r, TEST_SCENARIO, "/?repro").lines.join("|");
    expect(lines()).not.toContain("Boss");
    r.spawnedByRole = { fodder: 30, boss: 1 };
    expect(lines()).toContain("Boss survived");
    r.killsByRole = { fodder: 20, boss: 1 };
    expect(lines()).toContain("Boss defeated");
  });
});
