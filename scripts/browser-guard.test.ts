import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  BROWSER_LOCK,
  checkE2eArgs,
  parseFreePercent,
  parseTopMemGb,
  tryLock,
} from "@scripts/browser-guard";
import { describe, expect, it } from "vitest";

describe("the browser lock", () => {
  it("is one per machine, under the user's home, not in the repo", () => {
    expect(BROWSER_LOCK).toBe(join(homedir(), ".cache/browser-guard/lock"));
  });

  it("is taken once, names its live holder, and clears a dead holder's", () => {
    const path = join(mkdtempSync(join(tmpdir(), "guard-")), "sub/lock");
    expect(tryLock(path, "first")).toBeNull();
    expect(readFileSync(path, "utf8")).toBe(`${process.pid} first\n`);
    expect(tryLock(path, "second")).toBe(`pid ${process.pid}: first`);
    writeFileSync(path, "999999999 gone\n");
    expect(tryLock(path, "third")).toBeNull();
    expect(readFileSync(path, "utf8")).toBe(`${process.pid} third\n`);
  });
});

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
