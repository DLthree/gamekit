import { describe, expect, it } from "vitest";
import { PAD_KEYS } from "@/game/ui/pad-keys";
import { padKeys } from "@/ui/pad-keys";

describe("PAD_KEYS", () => {
  it("never gives one pad button two buttons on a screen", () => {
    for (const s of Object.keys(PAD_KEYS)) {
      const pads = [...padKeys(PAD_KEYS, s, () => true).values()];
      expect(new Set(pads).size).toBe(pads.length);
    }
  });
});
