import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR, readContentTexts } from "@/content/load-node";

describe("the Node content loader", () => {
  it("compiles the shipped content", () => {
    const r = loadContentDir(REPO_CONTENT_DIR, []);
    if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
    expect(r.content.sim.skills.fireball.activation).toBe("manual");
    expect(r.content.sim.builds.wizard.tiers).toHaveLength(3);
  });

  it("keys files by path relative to content/ and skips generated JSON Schemas", () => {
    const texts = readContentTexts(REPO_CONTENT_DIR);
    expect(Object.keys(texts)).toContain("look/generated/sprites.json");
    expect(Object.keys(texts).some((k) => k.startsWith("schema/"))).toBe(false);
  });

  it("reports a file that is not JSON by name", () => {
    const dir = mkdtempSync(join(tmpdir(), "gamekit-content-"));
    writeFileSync(join(dir, "stray.json"), "{");
    const r = loadContentDir(dir, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].file).toBe("stray.json");
  });
});
