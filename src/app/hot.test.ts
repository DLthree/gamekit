import { describe, expect, it } from "vitest";
import { classifyChange } from "@/app/hot";
import { aSimEdit, testContent, testFiles } from "@/test/content";

const base = testContent();
const simEdit = aSimEdit();

describe("classifyChange", () => {
  it("sees no change in an identical compile", () => {
    expect(classifyChange(base, testContent())).toBe("none");
  });

  it.skipIf(simEdit === null)("tells a rules edit", () => {
    expect(classifyChange(base, testContent(simEdit ?? {}))).toBe("sim");
  });

  it("tells a look edit", () => {
    const sounds = testFiles()["look/sounds.json"] as { volume: number };
    const quieter = { ...sounds, volume: sounds.volume / 2 };
    expect(classifyChange(base, testContent({ "look/sounds.json": quieter }))).toBe("look");
  });

  it("flags a generated manifest change as new assets", () => {
    const manifest = testFiles()["look/generated/sounds.json"] as {
      sounds: { id: string; file: string; lengthS: number }[];
    };
    const longer = {
      ...manifest,
      sounds: manifest.sounds.map((s, i) => (i === 0 ? { ...s, lengthS: s.lengthS + 1 } : s)),
    };
    expect(classifyChange(base, testContent({ "look/generated/sounds.json": longer }))).toBe(
      "assets",
    );
  });
});
