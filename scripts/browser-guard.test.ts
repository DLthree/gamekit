import { checkE2eArgs, parseFreePercent, parseTopMemGb } from "@scripts/browser-guard";
import { describe, expect, it } from "vitest";

describe("checkE2eArgs", () => {
  it("allows plain runs, up to three workers and small repeats", () => {
    expect(() => checkE2eArgs([])).not.toThrow();
    expect(() =>
      checkE2eArgs(["tests/e2e/sound.spec.ts", "--workers=3", "--repeat-each", "3"]),
    ).not.toThrow();
  });

  it("rejects more workers in every flag form", () => {
    for (const argv of [["--workers=4"], ["--workers", "6"], ["-j", "4"], ["--workers=50%"]])
      expect(() => checkE2eArgs(argv)).toThrow(/at most 3 workers/);
  });

  it("rejects big repeats", () => {
    expect(() => checkE2eArgs(["--repeat-each=10"])).toThrow(/at most 3/);
    expect(() => checkE2eArgs(["--repeat-each", "5"])).toThrow(/at most 3/);
  });
});

describe("parseFreePercent", () => {
  it("reads memory_pressure -Q", () => {
    expect(
      parseFreePercent(
        "The system has 17179869184 (4194304 pages with a page size of 4096).\nSystem-wide memory free percentage: 88%\n",
      ),
    ).toBe(88);
  });

  it("throws on output it does not recognise", () => {
    expect(() => parseFreePercent("nope")).toThrow(/unexpected output/);
  });
});

describe("parseTopMemGb", () => {
  it("reads top's MEM units", () => {
    expect(parseTopMemGb("106G")).toBe(106);
    expect(parseTopMemGb("512M")).toBe(0.5);
    expect(parseTopMemGb(" 3.5G+ ")).toBe(3.5);
  });

  it("throws on a value it does not recognise", () => {
    expect(() => parseTopMemGb("MEM")).toThrow(/unexpected MEM/);
  });
});
