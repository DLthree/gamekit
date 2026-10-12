import { readFileSync } from "node:fs";
import { MANIFEST, parseManifest, xfadeGraph } from "@scripts/store-media";
import { describe, expect, it } from "vitest";

const example = () => JSON.parse(readFileSync(MANIFEST, "utf8"));

describe("the store media manifest", () => {
  it("reads the example's", () => {
    expect(parseManifest(JSON.stringify(example())).capsules[0].name).toBe("steam-header");
  });

  it("names a capsule without its screenshot and a gif past its beat", () => {
    const m = example();
    m.capsules[0].shot = "nope";
    m.gifs[0].seconds = 99;
    expect(() => parseManifest(JSON.stringify(m))).toThrow(
      "capsule steam-header: no screenshot nope; gif dragon: runs past its beat's 3 s",
    );
  });

  it("wants a frame rate that steps whole ticks", () => {
    const m = example();
    m.trailer.fps = 25;
    expect(() => parseManifest(JSON.stringify(m))).toThrow("must divide the sim's 60 ticks");
  });
});

describe("the trailer's crossfades", () => {
  it("fades each clip into the next, shortening the whole by each fade", () => {
    expect(xfadeGraph([{ seconds: 3 }, { seconds: 1.5 }, { seconds: 2 }], 0.5)).toEqual({
      filters: [
        "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=2.500[v1]",
        "[v1][2:v]xfade=transition=fade:duration=0.5:offset=3.500[v2]",
      ],
      last: "[v2]",
      total: 5.5,
    });
  });

  it("is one clip as it is", () => {
    expect(xfadeGraph([{ seconds: 2 }], 0.3)).toEqual({ filters: [], last: "[0:v]", total: 2 });
  });
});
