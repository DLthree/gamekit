import { describe, expect, it } from "vitest";
import { buildContent, compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { testContent, testFiles, testTexts } from "@/test/content";

function errorsOf(r: ReturnType<typeof compileContent>): string[] {
  return r.ok ? [] : r.errors.map(formatContentError);
}

describe("compileContent", () => {
  it("compiles the test content into a deep-frozen snapshot", () => {
    const c = testContent();
    expect(c.sim.skills.boom.stats.area).toBe(50);
    expect(c.look.camera.shortSideSpan).toBe(400);
    expect(Object.isFrozen(c.sim.skills.boom.deliver)).toBe(true);
    expect(() => {
      (c.sim.rules.feel as { hitStopS: number }).hitStopS = 1;
    }).toThrow(TypeError);
  });

  it("names the file and field of a schema error", () => {
    const zap = structuredClone(testFiles()["skills/zap.json"]) as { stats: { range: unknown } };
    zap.stats.range = "far";
    const errs = errorsOf(compileContent({ ...testFiles(), "skills/zap.json": zap }));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/^skills\/zap\.json › stats\.range: /);
  });

  it("rejects a wrong $schema path", () => {
    const errs = errorsOf(
      compileContent(
        testFiles({
          "rules/feel.json": { $schema: "../schema/feel.schema.json", hitStopS: 0, countdownS: 0 },
        }),
      ),
    );
    expect(errs).toEqual(["rules/feel.json › $schema: expected ../schema/rules-feel.schema.json"]);
  });

  it("rejects an unexpected file and reports a missing one", () => {
    const errs = errorsOf(
      compileContent({ ...testFiles({ "rules/limits.json": null }), "rules/typo.json": {} }),
    );
    expect(errs).toContain("rules/typo.json: not a known content file");
    expect(errs).toContain("rules/limits.json: missing");
  });

  it("rejects a file name that is not kebab-case", () => {
    const zap = testFiles()["skills/zap.json"];
    const errs = errorsOf(compileContent({ ...testFiles(), "skills/Zap_2.json": zap }));
    expect(errs).toContain("skills/Zap_2.json: file names are kebab-case ids");
  });
});

describe("buildContent", () => {
  it("names the file when its JSON does not parse (a half-saved file)", () => {
    const texts = testTexts();
    texts["skills/zap.json"] = texts["skills/zap.json"].slice(0, 25);
    const r = buildContent(texts, []);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].file).toBe("skills/zap.json");
      expect(r.errors[0].message).toMatch(/^invalid JSON: /);
    }
  });

  it("applies URL overrides before validation", () => {
    const r = buildContent(testTexts(), ["skills/boom.stats.area=55"]);
    expect(r.ok && r.content.sim.skills.boom.stats.area).toBe(55);
  });

  it("fails on an override that produces an invalid value", () => {
    const r = buildContent(testTexts(), ['skills/boom.stats.area="big"']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatContentError(r.errors[0])).toMatch(/^skills\/boom\.json › stats\.area/);
  });

  it("fails on a malformed override", () => {
    const r = buildContent(testTexts(), ["skills/boom=1"]);
    expect(r.ok).toBe(false);
  });
});
