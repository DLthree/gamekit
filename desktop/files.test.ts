import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendTelemetry, readSave, savePath, writeSave } from "@desktop/files";
import { beforeEach, describe, expect, it } from "vitest";

let dir: string;
beforeEach(() => {
  dir = join(mkdtempSync(join(tmpdir(), "gamekit-files-")), "save");
});

describe("saves on disk", () => {
  it("a key never written reads null, and the folder isn't made by a read", () => {
    expect(readSave(dir, "game.progress")).toBeNull();
    expect(existsSync(dir)).toBe(false);
  });

  it("a written document reads back exactly, as <key>.json", () => {
    const doc = JSON.stringify({ version: 11, run: { gold: 3 } });
    writeSave(dir, "game.progress", doc);
    expect(readSave(dir, "game.progress")).toBe(doc);
    expect(readFileSync(join(dir, "game.progress.json"), "utf8")).toBe(doc);
  });

  it("a write replaces the whole document and leaves no temp file", () => {
    writeSave(dir, "game.settings", JSON.stringify({ a: "a long first document" }));
    writeSave(dir, "game.settings", "{}");
    expect(readSave(dir, "game.settings")).toBe("{}");
    expect(readdirSync(dir)).toEqual(["game.settings.json"]);
  });

  it("a leftover temp file from a crashed write doesn't touch the saved document", () => {
    writeSave(dir, "game.progress", '{"version":11}');
    writeFileSync(join(dir, "game.progress.json.tmp"), '{"vers');
    expect(readSave(dir, "game.progress")).toBe('{"version":11}');
    writeSave(dir, "game.progress", '{"version":12}');
    expect(readdirSync(dir)).toEqual(["game.progress.json"]);
  });

  it("a corrupt file is an error naming the file, not an empty save", () => {
    writeSave(dir, "game.progress", "{}");
    writeFileSync(join(dir, "game.progress.json"), '{"version": 11, "ru');
    expect(() => readSave(dir, "game.progress")).toThrow(/game\.progress\.json is not JSON/);
  });

  it("a file that can't be read is an error naming it, not an empty save", () => {
    // A folder where the document should be: reading it fails (EISDIR).
    mkdirSync(join(dir, "game.progress.json"), { recursive: true });
    expect(() => readSave(dir, "game.progress")).toThrow(/game\.progress\.json can't be read/);
  });

  it("refuses a value that isn't JSON, and keeps the old document", () => {
    writeSave(dir, "game.progress", "{}");
    expect(() => writeSave(dir, "game.progress", "not json")).toThrow(/not JSON/);
    expect(readSave(dir, "game.progress")).toBe("{}");
  });

  it("refuses keys that aren't plain file names", () => {
    for (const key of ["../escape", "a/b", "", ".hidden", "a\\b"])
      expect(() => savePath(dir, key)).toThrow(/not a plain file name/);
  });
});

describe("the telemetry log", () => {
  it("appends each record as a line with its receipt time, in the day's file", () => {
    const at = new Date("2026-10-06T12:00:00.000Z");
    appendTelemetry(dir, JSON.stringify([{ kind: "a" }, { kind: "b" }]), at);
    appendTelemetry(dir, JSON.stringify([{ kind: "c" }]), at);
    appendTelemetry(dir, "[]", at);
    const lines = readFileSync(join(dir, "2026-10-06.jsonl"), "utf8").trim().split("\n");
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      { kind: "a", receivedAt: at.toISOString() },
      { kind: "b", receivedAt: at.toISOString() },
      { kind: "c", receivedAt: at.toISOString() },
    ]);
  });

  it("refuses a body that isn't a JSON array", () => {
    const at = new Date();
    expect(() => appendTelemetry(dir, '{"kind":"a"}', at)).toThrow(/JSON array/);
    expect(() => appendTelemetry(dir, "nope", at)).toThrow();
  });
});
