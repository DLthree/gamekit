import { describe, expect, it } from "vitest";
import { parseRecord, RecordError, recordText } from "@/agent/record";

describe("run record text", () => {
  it("round-trips, choices with ; and spaces included", () => {
    const r = { build: "abc123-dirty", seed: 42, choices: ["a=1", 'o=x/y.z="a; b"'] };
    expect(parseRecord(recordText(r))).toEqual(r);
  });

  it("keeps an empty choice list", () => {
    expect(parseRecord("rr1;abc;7")).toEqual({ build: "abc", seed: 7, choices: [] });
  });

  it("refuses text that is not a record, or lacks its build or seed", () => {
    for (const t of ["hello", "rr1;;7", "rr1;abc", "rr1;abc;x"])
      expect(() => parseRecord(t)).toThrow(RecordError);
  });

  it("refuses a build it could not write back", () => {
    expect(() => recordText({ build: "a;b", seed: 1, choices: [] })).toThrow(RecordError);
  });
});
