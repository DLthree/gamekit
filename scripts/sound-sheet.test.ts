import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { licenseRows, sheetHtml } from "@scripts/sound-sheet";
import { describe, expect, it } from "vitest";

const SOUNDS = fileURLToPath(new URL("../public/sounds", import.meta.url));

describe("licenseRows", () => {
  it("reads file, source and license from the table, skipping other lines", () => {
    const md = [
      "# Sources",
      "| file | source | original file | license |",
      "|------|--------|---------------|---------|",
      "| hit.wav | Kenney, https://kenney.nl/assets/impact-sounds | `a.ogg` | CC0 |",
    ].join("\n");
    expect([...licenseRows(md)]).toEqual([
      ["hit.wav", { source: "Kenney, https://kenney.nl/assets/impact-sounds", license: "CC0" }],
    ]);
  });

  it("rejects a sound row missing a cell", () => {
    expect(() => licenseRows("| hit.wav | Kenney | CC0 |")).toThrow("hit.wav needs 4 cells");
  });

  it("credits every shipped sound as CC0", () => {
    const rows = licenseRows(readFileSync(join(SOUNDS, "LICENSE.md"), "utf8"));
    const files = readdirSync(SOUNDS).filter((f) => /\.(wav|ogg)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect([f, rows.get(f)?.license]).toEqual([f, "CC0"]);
  });
});

describe("sheetHtml", () => {
  it("escapes credits and marks loops with their game level", () => {
    const html = sheetHtml([
      {
        id: "crackle",
        dataUri: "data:audio/wav;base64,AA==",
        lengthS: 4,
        tuning: { cap: 1, minGapS: 0, volume: 0.5, pitch: 0, loop: true },
        level: 0.35,
        credit: { source: "<b>x</b> & y", license: "CC0" },
      },
    ]);
    expect(html).toContain('loop data-level="0.350" src="data:audio/wav;base64,AA=="');
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y (CC0)");
  });
});
