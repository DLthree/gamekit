/**
 * The desktop shell's files under userData (node only, run in the main process): the saves, one
 * JSON document per key, written atomically; and the telemetry log, one jsonl file per day.
 */
import {
  appendFileSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";

const KEY = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** `<dir>/<key>.json`; throws on a key that isn't a plain file name. */
export function savePath(dir: string, key: string): string {
  if (!KEY.test(key)) throw new Error(`save key ${JSON.stringify(key)} is not a plain file name`);
  return join(dir, `${key}.json`);
}

/** The key's document as written, or null when it was never written. Throws on any other read error or a file that isn't JSON. */
export function readSave(dir: string, key: string): string | null {
  const file = savePath(dir, key);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`${file} can't be read: ${message(err)}`);
  }
  try {
    JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not JSON: ${message(err)}`);
  }
  return text;
}

/**
 * Writes the key's document atomically: to `<key>.json.tmp`, flushed to disk, then renamed over
 * `<key>.json`, so a crash or power loss leaves the old document or the new one, never half of
 * either. Throws when the value isn't JSON or the disk refuses.
 */
export function writeSave(dir: string, key: string, value: string): void {
  const file = savePath(dir, key);
  try {
    JSON.parse(value);
  } catch (err) {
    throw new Error(`${file}: refusing a value that is not JSON: ${message(err)}`);
  }
  mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, value);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}

/**
 * Appends one telemetry flush (a JSON array of records) to `<dir>/<date>.jsonl`, a record a line
 * with its receipt time, as the dev server's /__telemetry does. Throws on a body that isn't one.
 */
export function appendTelemetry(dir: string, body: string, receivedAt: Date): void {
  const records: unknown = JSON.parse(body);
  if (!Array.isArray(records)) throw new Error("telemetry body must be a JSON array");
  if (records.length === 0) return;
  const at = receivedAt.toISOString();
  const lines = records.map((r: unknown) => JSON.stringify({ ...(r as object), receivedAt: at }));
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${at.slice(0, 10)}.jsonl`), `${lines.join("\n")}\n`);
}
