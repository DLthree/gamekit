import { describe, expect, it } from "vitest";
import { contentTexts, loadContent } from "@/content/load";
import { REPO_CONTENT_DIR, readContentTexts } from "@/content/load-node";

describe("browser content loader", () => {
  it("sees exactly the files the Node loader sees, schemas excluded", () => {
    expect(Object.keys(contentTexts()).sort()).toEqual(
      Object.keys(readContentTexts(REPO_CONTENT_DIR)).sort(),
    );
    expect(Object.keys(contentTexts()).some((k) => k.startsWith("schema/"))).toBe(false);
  });

  it("compiles the shipped content", () => {
    const r = loadContent([]);
    expect(r.ok).toBe(true);
  });
});
