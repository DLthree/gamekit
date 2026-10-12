import { achievementsCsv } from "@scripts/steam-dashboard";
import { describe, expect, it } from "vitest";

describe("the Steamworks achievements list", () => {
  it("is CSV, quoting fields with commas or quotes", () => {
    const row = { deed: "x", apiName: "DEED_X", name: "X", description: "Do x." };
    expect(
      achievementsCsv([row, { ...row, apiName: "DEED_Y", name: 'The "Y"', description: "A, b." }]),
    ).toBe(
      [
        "API name,Display name,Description",
        "DEED_X,X,Do x.",
        'DEED_Y,"The ""Y""","A, b."',
        "",
      ].join("\n"),
    );
  });
});
