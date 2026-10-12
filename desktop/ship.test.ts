import { itchTarget, readShip, type ShipConfig, steamIds } from "@desktop/ship";
import { describe, expect, it } from "vitest";

const filled: ShipConfig = {
  productName: "A Game",
  appId: "com.someone.agame",
  executableName: "a-game",
  steam: { appId: 1234560, depots: { win: 1234561, mac: 1234562, linux: 1234563 } },
  itch: { target: "someone/a-game" },
};

describe("ship/config.json", () => {
  it("reads the example's, placeholders and all", () => {
    expect(readShip().steam.appId).toMatch(/^TODO/);
  });

  it("names every Steam placeholder still there", () => {
    expect(() => steamIds(readShip())).toThrow(
      "fill in the Steam IDs first: steam.appId, steam.depots.win, steam.depots.mac, steam.depots.linux still TODO",
    );
    const half = {
      ...filled,
      steam: { ...filled.steam, depots: { ...filled.steam.depots, mac: "TODO" } },
    };
    expect(() => steamIds(half)).toThrow("steam.depots.mac still TODO");
    expect(steamIds(filled)).toEqual(filled.steam);
  });

  it("refuses the itch target while it's a placeholder or not <user>/<game>", () => {
    expect(() => itchTarget(readShip())).toThrow("fill in itch.target");
    expect(() => itchTarget({ ...filled, itch: { target: "a-game" } })).toThrow(
      "expected <itch user>/<game>",
    );
    expect(itchTarget(filled)).toBe("someone/a-game");
  });
});
