import { describe, expect, it } from "vitest";
import { classifyChange } from "@/app/hot";
import { testContent, testFiles } from "@/test/content";

const base = testContent();

describe("classifyChange", () => {
  it("sees no change in an identical compile", () => {
    expect(classifyChange(base, testContent())).toBe("none");
  });

  it("tells a sim edit from a look edit", () => {
    const threat = testFiles()["threats/tier-1.json"];
    expect(
      classifyChange(
        base,
        testContent({ "threats/tier-1.json": { ...Object(threat), durationS: 20 } }),
      ),
    ).toBe("sim");
    const controls = testFiles()["look/controls.json"];
    expect(
      classifyChange(
        base,
        testContent({ "look/controls.json": { ...Object(controls), stickRadius: 70 } }),
      ),
    ).toBe("look");
  });

  it("flags a sprite or sound manifest change as new assets", () => {
    const sprites = testFiles()["look/generated/sprites.json"];
    const next = testContent({
      "look/generated/sprites.json": { ...Object(sprites), pxPerWorldUnit: 9 },
    });
    expect(classifyChange(base, next)).toBe("assets");

    const manifest = testFiles()["look/generated/sounds.json"];
    const louder = testContent({
      "look/generated/sounds.json": {
        ...Object(manifest),
        sounds: [
          { id: "tick", file: "sounds/tick.wav", lengthS: 0.2 },
          { id: "chime", file: "sounds/chime.wav", lengthS: 0.4 },
        ],
      },
    });
    expect(classifyChange(base, louder)).toBe("assets");
  });
});
