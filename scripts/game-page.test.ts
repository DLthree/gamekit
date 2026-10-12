import { queryName, toolQuery } from "@scripts/game-page";
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
