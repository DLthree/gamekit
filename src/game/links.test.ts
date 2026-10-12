import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CELL, PERF_QUERY, PHONE_QUERIES, SCREENS } from "@/game/links";
import { parseUrl } from "@/game/url";

describe("the tools' addresses", () => {
  it("all parse", () => {
    const queries = [
      CELL,
      PERF_QUERY,
      ...PHONE_QUERIES,
      ...Object.values(SCREENS).map((s) => s.query),
    ];
    for (const q of queries) expect(parseUrl(q).errors, q).toEqual([]);
  });

  it("the installed app opens on CELL (public/manifest.webmanifest start_url)", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(manifest.start_url).toBe(`/?${CELL}`);
  });
});
