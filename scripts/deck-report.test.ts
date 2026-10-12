import { type DeckPart, deckReport } from "@scripts/deck-report";
import { describe, expect, it } from "vitest";

const text = (capPx: number, t = "Hi") => ({
  screen: "grid",
  text: t,
  where: "#picker b",
  fontPx: capPx * 1.4,
  capPx,
});

describe("the Deck check's report", () => {
  it("sorts text into fail and warn by capital height, counting repeats once", () => {
    const parts: DeckPart[] = [
      {
        name: "walk",
        reached: [{ screen: "grid", acts: 9 }],
        findings: [],
        texts: [text(8), text(8), text(10, "Mid"), text(14, "Big")],
      },
      {
        name: "result",
        reached: [],
        findings: [{ screen: "result", kind: "input word", detail: '"click"' }],
        texts: [],
      },
    ];
    const r = deckReport(parts, "2026-10-11");
    expect(r.summary).toBe("deck check: 1 findings, 1 texts under 9 px, 1 under 12 px");
    expect(r.md).toContain('| result | result | input word | "click" |');
    expect(r.md).toContain("| walk | grid | 9 |");
    expect(r.json).toMatchObject({ fail: [{ text: "Hi" }], warn: [{ text: "Mid" }] });
  });
});
