import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { applyOverrides, isOverride, type Override, parseOverride } from "@/content/overrides";

function ok(raw: string): Override {
  const o = parseOverride(raw);
  if (!isOverride(o)) throw new Error(formatContentError(o));
  return o;
}

describe("parseOverride", () => {
  it("splits file, field path and JSON value", () => {
    expect(ok("cards/ace.stats.cost=55")).toEqual({
      raw: "cards/ace.stats.cost=55",
      file: "cards/ace.json",
      path: ["stats", "cost"],
      value: 55,
    });
    expect(ok("decks/start.cards=[]").value).toEqual([]);
    expect(ok('look/table.cloth="felt"').value).toBe("felt");
  });

  it("rejects a missing field path or a non-JSON value, naming the override", () => {
    const noPath = parseOverride("cards/ace=1");
    expect(isOverride(noPath)).toBe(false);
    const bare = parseOverride("look/table.cloth=felt");
    expect(isOverride(bare)).toBe(false);
    if (!isOverride(bare)) expect(formatContentError(bare)).toContain("look/table.cloth=felt");
  });
});

describe("applyOverrides", () => {
  const files = {
    "cards/ace.json": { stats: { cost: 60 }, effects: { onPlay: [{ draw: true }] } },
  };

  it("patches nested fields and array items without touching the input", () => {
    const r = applyOverrides(files, [
      ok("cards/ace.stats.cost=55"),
      ok("cards/ace.effects.onPlay.0.draw=false"),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.files["cards/ace.json"]).toEqual({
      stats: { cost: 55 },
      effects: { onPlay: [{ draw: false }] },
    });
    expect(files["cards/ace.json"].stats.cost).toBe(60);
  });

  it("reports an unknown file or a missing intermediate field", () => {
    const r = applyOverrides(files, [ok("cards/nope.stats.cost=1"), ok("cards/ace.x.y=1")]);
    expect(r.errors.map((e) => e.file)).toEqual(["cards/nope.json", "cards/ace.json"]);
    expect(r.errors[1].path).toBe("x.y");
  });
});
