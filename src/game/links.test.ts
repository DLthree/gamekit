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
});
