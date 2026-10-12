import { describe, expect, it } from "vitest";
import { type PadKeyMap, padKeys } from "@/ui/pad-keys";

const all = () => true;
const MAP: PadKeyMap = {
  menu: [
    ["continue", "a"],
    ["begin", "a"],
    ["settings", "start"],
    ["back", "b"],
  ],
};
const keysOf = (map: PadKeyMap, screen: string, enabled: (id: string) => boolean = all) =>
  Object.fromEntries(padKeys(map, screen, enabled));

describe("padKeys", () => {
  it("gives a pad button to the first listed button that is there and enabled", () => {
    expect(keysOf(MAP, "menu")).toEqual({ continue: "a", settings: "start", back: "b" });
    expect(keysOf(MAP, "menu", (id) => id !== "continue")).toEqual({
      begin: "a",
      settings: "start",
      back: "b",
    });
  });

  it("has none on a screen it doesn't know", () => {
    expect(keysOf(MAP, "notice")).toEqual({});
  });
});
