import { describe, expect, it } from "vitest";
import { buildContent, compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { aCollection, testContent, testFiles, testTexts } from "@/test/content";

function errorsOf(r: ReturnType<typeof compileContent>): string[] {
  return r.ok ? [] : r.errors.map(formatContentError);
}

const SOUNDS = "look/sounds.json";
const sounds = () => structuredClone(testFiles()[SOUNDS]) as Record<string, unknown>;
const collection = aCollection();

describe("compileContent", () => {
  it("compiles the content into a deep-frozen snapshot", () => {
    const c = testContent();
    expect(c.look.sounds.volume).toBe((testFiles()[SOUNDS] as { volume: number }).volume);
    expect(Object.isFrozen(c.look.sounds.sounds)).toBe(true);
    expect(() => {
      (c.look.sounds as { volume: number }).volume = 0;
    }).toThrow(TypeError);
  });

  it("names the file and field of a schema error", () => {
    const errs = errorsOf(compileContent(testFiles({ [SOUNDS]: { ...sounds(), volume: "loud" } })));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/^look\/sounds\.json › volume: /);
  });

  it("rejects a wrong $schema path", () => {
    const wrong = { ...sounds(), $schema: "../schema/sounds.schema.json" };
    const errs = errorsOf(compileContent(testFiles({ [SOUNDS]: wrong })));
    expect(errs).toEqual([
      "look/sounds.json › $schema: expected ../schema/look-sounds.schema.json",
    ]);
  });

  it("rejects an unexpected file and reports a missing one", () => {
    const errs = errorsOf(
      compileContent({ ...testFiles({ [SOUNDS]: null }), "zz-typo/x.json": {} }),
    );
    expect(errs).toContain("zz-typo/x.json: not a known content file");
    expect(errs).toContain("look/sounds.json: missing");
  });

  it.skipIf(collection === null)("rejects a file name that is not kebab-case", () => {
    if (collection === null) return;
    const bad = `${collection.folder}/Bad_2.json`;
    const errs = errorsOf(compileContent({ ...testFiles(), [bad]: collection.body }));
    expect(errs).toContain(`${bad}: file names are kebab-case ids`);
  });
});

describe("buildContent", () => {
  it("names the file when its JSON does not parse (a half-saved file)", () => {
    const texts = testTexts();
    texts[SOUNDS] = texts[SOUNDS].slice(0, 25);
    const r = buildContent(texts, []);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].file).toBe(SOUNDS);
      expect(r.errors[0].message).toMatch(/^invalid JSON: /);
    }
  });

  it("applies URL overrides before validation", () => {
    const r = buildContent(testTexts(), ["look/sounds.volume=0.25"]);
    expect(r.ok && r.content.look.sounds.volume).toBe(0.25);
  });

  it("fails on an override that produces an invalid value", () => {
    const r = buildContent(testTexts(), ['look/sounds.volume="big"']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatContentError(r.errors[0])).toMatch(/^look\/sounds\.json › volume/);
  });

  it("fails on a malformed override", () => {
    const r = buildContent(testTexts(), ["look/sounds=1"]);
    expect(r.ok).toBe(false);
  });
});
