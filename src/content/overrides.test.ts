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
    expect(ok("skills/zap.stats.area=55")).toEqual({
      raw: "skills/zap.stats.area=55",
      file: "skills/zap.json",
      path: ["stats", "area"],
      value: 55,
    });
    expect(ok("threats/tier-1.spawns=[]").value).toEqual([]);
    expect(ok('look/camera.background="ink"').value).toBe("ink");
  });

  it("rejects a missing field path or a non-JSON value, naming the override", () => {
    const noPath = parseOverride("skills/zap=1");
    expect(isOverride(noPath)).toBe(false);
    const bare = parseOverride("look/camera.background=ink");
    expect(isOverride(bare)).toBe(false);
    if (!isOverride(bare)) expect(formatContentError(bare)).toContain("look/camera.background=ink");
  });
});

describe("applyOverrides", () => {
  const files = {
    "skills/zap.json": { stats: { area: 60 }, deliver: { onEnd: [{ hitStop: true }] } },
  };

  it("patches nested fields and array items without touching the input", () => {
    const r = applyOverrides(files, [
      ok("skills/zap.stats.area=55"),
      ok("skills/zap.deliver.onEnd.0.hitStop=false"),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.files["skills/zap.json"]).toEqual({
      stats: { area: 55 },
      deliver: { onEnd: [{ hitStop: false }] },
    });
    expect(files["skills/zap.json"].stats.area).toBe(60);
  });

  it("reports an unknown file or a missing intermediate field", () => {
    const r = applyOverrides(files, [ok("skills/nope.stats.area=1"), ok("skills/zap.x.y=1")]);
    expect(r.errors.map((e) => e.file)).toEqual(["skills/nope.json", "skills/zap.json"]);
    expect(r.errors[1].path).toBe("x.y");
  });
});
