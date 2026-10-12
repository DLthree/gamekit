import { describe, expect, it } from "vitest";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { parseOn, SWITCH_IDS, switchOn } from "@/content/switches";
import type { Content } from "@/content/types";

function shipped(): Content {
  const r = loadContentDir(REPO_CONTENT_DIR, []);
  if (!r.ok) throw new Error("shipped content fails");
  return r.content;
}

describe("parseOn", () => {
  it("reads nothing as no switches", () => {
    expect(parseOn(null)).toEqual({ on: [] });
    expect(parseOn("")).toEqual({ on: [] });
  });

  it("reads each known id once", () => {
    const id = SWITCH_IDS[0];
    expect(parseOn(`${id},${id}`)).toEqual({ on: [id] });
  });

  it("fails on an unknown id instead of ignoring it", () => {
    expect(parseOn("nope")).toEqual({ problem: expect.stringContaining('no switch "nope"') });
  });
});

describe("switchOn", () => {
  it("returns the compiled content itself when every switch is on", () => {
    const content = shipped();
    expect(switchOn(content, SWITCH_IDS)).toBe(content);
  });

  it("cuts an off system from a frozen copy and leaves the original whole", () => {
    const content = shipped();
    const before = JSON.stringify(content.sim);
    const off = switchOn(content, []);
    expect(off).not.toBe(content);
    expect(Object.isFrozen(off.sim)).toBe(true);
    expect(JSON.stringify(content.sim)).toBe(before);
    expect(JSON.stringify(off.sim)).not.toBe(before);
  });
});
