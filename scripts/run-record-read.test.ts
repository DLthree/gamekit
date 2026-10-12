import { describe, recordsIn } from "@scripts/run-record-read";
import { expect, describe as group, it } from "vitest";
import { recordText } from "@/agent/record";

const rec = { build: "abc", seed: 9, choices: ["char=wizard", "build=2", "threat=3"] };
const text = recordText(rec);

group("recordsIn", () => {
  it("reads a record's own text", () => {
    expect(recordsIn(text)).toEqual([{ record: rec, ended: null }]);
  });

  it("reads wave and error lines of a telemetry jsonl, in order, skipping the rest", () => {
    const jsonl = [
      JSON.stringify({ kind: "load", url: "/" }),
      JSON.stringify({ kind: "wave", record: text, report: { outcome: "died" } }),
      "",
      JSON.stringify({ kind: "error", title: "Crash", record: text }),
      JSON.stringify({ kind: "error", title: "Address", record: null }),
    ].join("\n");
    expect(recordsIn(jsonl).map((f) => f.ended)).toEqual(["died", "error: Crash"]);
  });

  it("throws on a log with no records, or a line that is not JSON", () => {
    expect(() => recordsIn(JSON.stringify({ kind: "load" }))).toThrow(/no run records/);
    expect(() => recordsIn("{nope")).toThrow(/line 1 is not JSON/);
  });
});

group("describe", () => {
  it("writes the replay address and flags another build", () => {
    const lines = describe({ record: rec, ended: "died" }, "def", "http://h:5280");
    expect(lines.at(-1)).toBe("replay   http://h:5280/?char=wizard&build=2&threat=3&seed=9");
    expect(lines[0]).toContain("!! this checkout is def");
    expect(describe({ record: rec, ended: null }, "abc", "http://h")[0]).toBe("build    abc");
  });
});
