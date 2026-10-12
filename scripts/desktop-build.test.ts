import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readShip } from "@desktop/ship";
import { builderConfig, missingSdkFiles, targetOses } from "@scripts/desktop-build";
import { describe, expect, it } from "vitest";

describe("desktop flavours", () => {
  it("names the app from ship/config.json", () => {
    const itch = builderConfig("itch", readShip());
    expect(itch).toMatchObject({ productName: "Gamekit Example", appId: "com.example.gamekit" });
    expect(itch.directories).toEqual({ output: "release/itch", buildResources: "ship" });
  });

  it("ships the Steam binding and SDK library only in the Steam build", () => {
    const steam = builderConfig("steam", readShip());
    const itch = builderConfig("itch", readShip());
    expect(JSON.stringify(itch)).not.toMatch(/steam/i);
    expect(steam.asarUnpack).toContain("node_modules/steamworks-ffi-node/**");
    expect(steam.mac).toMatchObject({
      extraResources: [
        {
          from: "vendor/steamworks_sdk/redistributable_bin/osx",
          to: "steamworks_sdk/redistributable_bin/osx",
        },
      ],
    });
    expect(steam.linux).toMatchObject({
      extraResources: [{ from: "vendor/steamworks_sdk/redistributable_bin/linux64" }],
    });
    expect(steam.win).toMatchObject({
      extraResources: [{ from: "vendor/steamworks_sdk/redistributable_bin/win64" }],
    });
  });

  it("builds every OS unless the flags name some", () => {
    expect(targetOses({})).toEqual(["mac", "win", "linux"]);
    expect(targetOses({ mac: true })).toEqual(["mac"]);
    expect(targetOses({ linux: true, win: true })).toEqual(["win", "linux"]);
  });

  it("names the SDK files missing for the OSes built", () => {
    const sdk = mkdtempSync(join(tmpdir(), "gamekit-sdk-"));
    const mac = join(sdk, "redistributable_bin/osx/libsteam_api.dylib");
    mkdirSync(dirname(mac), { recursive: true });
    writeFileSync(mac, "");
    expect(missingSdkFiles(["mac"], sdk)).toEqual([]);
    expect(missingSdkFiles(["mac", "linux", "win"], sdk)).toEqual([
      join(sdk, "redistributable_bin/linux64/libsteam_api.so"),
      join(sdk, "redistributable_bin/win64/steam_api64.dll"),
    ]);
  });
});
