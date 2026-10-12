import { parseActions, queryName, toolQuery, wholeArg } from "@scripts/game-page";
import { describe, expect, it } from "vitest";

describe("toolQuery", () => {
  it("pins telemetry off and seed 7, and lets the tool step and read the sim", () => {
    const q = new URLSearchParams(toolQuery("char=a&build=1&threat=2"));
    expect(q.get("telemetry")).toBe("0");
    expect(q.get("seed")).toBe("7");
    expect(q.get("manual")).toBe("1");
    expect(q.get("agent")).toBe("1");
    expect(q.get("threat")).toBe("2");
  });

  it("keeps the query's own seed and telemetry", () => {
    const q = new URLSearchParams(toolQuery("seed=3&telemetry=1"));
    expect(q.get("seed")).toBe("3");
    expect(q.get("telemetry")).toBe("1");
  });

  it("never doubles manual or agent", () => {
    const q = new URLSearchParams(toolQuery("manual=1&agent=1"));
    expect(q.getAll("manual")).toEqual(["1"]);
    expect(q.getAll("agent")).toEqual(["1"]);
  });
});

describe("queryName", () => {
  it("keeps letters, digits and = and joins the rest with _", () => {
    expect(queryName("char=a&build=1&o=rules/feel.x=2")).toBe("char=a_build=1_o=rules_feel_x=2");
  });
});

describe("toolQuery overrides", () => {
  it("adds each --o as an o= after the query's own", () => {
    const q = new URLSearchParams(toolQuery("o=a/b.c=1", ["d/e.f=2", 'g/h.i="x"']));
    expect(q.getAll("o")).toEqual(["a/b.c=1", "d/e.f=2", 'g/h.i="x"']);
  });
});

describe("parseActions", () => {
  it("reads a JSON array of the game's actions", () => {
    expect(parseActions('[{"frames":30,"cast":[1,0]},"move"]')).toEqual([
      { frames: 30, cast: [1, 0] },
      "move",
    ]);
  });

  it("refuses anything but a JSON array", () => {
    expect(() => parseActions("{frames:3}")).toThrow(/not JSON/);
    expect(() => parseActions('{"frames":3}')).toThrow(/JSON array/);
  });
});

describe("wholeArg", () => {
  it("takes a whole number at or above the minimum", () => {
    expect(wholeArg("frames", "600", 0)).toBe(600);
    expect(() => wholeArg("every", "0", 1)).toThrow("--every 0: expected a whole number ≥ 1");
    expect(() => wholeArg("frames", "1.5", 0)).toThrow(/--frames 1.5/);
  });
});
