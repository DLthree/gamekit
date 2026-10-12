import { describe, expect, it } from "vitest";
import { achievementName, achievementProblems, achievementTable } from "@/content/achievements";

describe("achievements from deeds", () => {
  it("names each deed's achievement in upper snake case", () => {
    expect(achievementName("wyrmslayer")).toBe("DEED_WYRMSLAYER");
    expect(achievementName("lion-tamer")).toBe("DEED_LION_TAMER");
  });

  it("lists the deeds as achievement rows, in order", () => {
    expect(achievementTable([{ id: "first-light", name: "First Light", text: "Win." }])).toEqual([
      {
        deed: "first-light",
        apiName: "DEED_FIRST_LIGHT",
        name: "First Light",
        description: "Win.",
      },
    ]);
  });

  it("flags an API name Steam refuses and one two deeds share", () => {
    expect(achievementProblems(["a-b", "a_b", "ok"])).toEqual([
      { deed: "a_b", message: "Steam API name DEED_A_B is also deed a-b's" },
    ]);
    expect(achievementProblems(["bad.id"])[0].message).toContain("DEED_BAD.ID is not");
  });
});
