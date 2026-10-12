import { describe, expect, it } from "vitest";
import { DEV_TERMS, devTerm, idWords } from "@/ui/vocabulary";

describe("devTerm", () => {
  it("finds a dev term from a word's start, in any case", () => {
    expect(devTerm("Telegraphs dodged 3", DEV_TERMS, false)).toBe("telegraph");
    expect(devTerm("120 ticks", DEV_TERMS, false)).toBe("tick");
    expect(devTerm("stick", DEV_TERMS, false)).toBeNull();
    expect(devTerm("Kills 12", DEV_TERMS, false)).toBeNull();
  });

  it("finds content ids only when asked", () => {
    expect(devTerm("fire-bolt 90 damage", DEV_TERMS, true)).toBe("fire-bolt");
    expect(devTerm("fire-bolt 90 damage", DEV_TERMS, false)).toBeNull();
    expect(devTerm("Fire bolt 90 damage", DEV_TERMS, true)).toBeNull();
  });
});

describe("idWords", () => {
  it("turns a content id into words", () => {
    expect(idWords("fire-bolt")).toBe("Fire bolt");
    expect(idWords("hero")).toBe("Hero");
  });
});
