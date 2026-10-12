import { describe, expect, it } from "vitest";
import { parseRecord, recordText } from "@/agent/record";
import { recordOf, replayQuery } from "@/game/record";
import { parseUrl } from "@/game/url";

describe("the example's run record", () => {
  it("replays the cell, seed, overrides and options it was played with", () => {
    const url = parseUrl("?char=wizard&build=2&threat=3&seed=9&o=a/b.c=1&bot=kite&on=throwers");
    if (url.target?.screen !== "cell" || url.seed === null) throw new Error("expected a cell");
    const scenario = { ...url.target.cell, seed: url.seed, overrides: url.overrides };
    const record = parseRecord(recordText(recordOf(scenario, url.options, "abc")));
    const again = parseUrl(replayQuery(record));
    expect(again.errors).toEqual([]);
    expect(again.target).toEqual(url.target);
    expect(again.seed).toBe(9);
    expect(again.overrides).toEqual(["a/b.c=1"]);
    expect(again.options).toEqual(url.options);
  });
});
