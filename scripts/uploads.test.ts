import { butlerPushes } from "@scripts/itch-push";
import { appBuildVdf, depotBuildVdf, uploadIds } from "@scripts/steam-upload";
import { describe, expect, it } from "vitest";

describe("SteamPipe build scripts", () => {
  it("names each depot's script in the app build", () => {
    expect(appBuildVdf(1234560, [1234561, 1234562], "v0.1.0")).toBe(
      [
        '"AppBuild"',
        "{",
        '\t"AppID"\t"1234560"',
        '\t"Desc"\t"v0.1.0"',
        '\t"BuildOutput"\t"output/"',
        '\t"ContentRoot"\t""',
        '\t"SetLive"\t""',
        '\t"Depots"',
        "\t{",
        '\t\t"1234561"\t"depot_build_1234561.vdf"',
        '\t\t"1234562"\t"depot_build_1234562.vdf"',
        "\t}",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("maps a depot's whole content folder to its root, quoting the path", () => {
    const vdf = depotBuildVdf(1234562, '/repo/"x"/mac-universal');
    expect(vdf).toContain('\t"DepotID"\t"1234562"');
    expect(vdf).toContain('\t"ContentRoot"\t"/repo/\\"x\\"/mac-universal"');
    expect(vdf).toContain('\t\t"Recursive"\t"1"');
  });

  it("refuses to upload to Spacewar, Valve's test app", () => {
    const depots = { win: 1, mac: 2, linux: 3 };
    expect(() => uploadIds({ appId: 480, depots })).toThrow("Spacewar's (480)");
    expect(uploadIds({ appId: 9, depots })).toEqual({ appId: 9, depots });
  });
});

describe("itch push", () => {
  it("pushes one channel per OS at the package version", () => {
    expect(butlerPushes("someone/a-game", "0.1.0")).toEqual([
      ["push", "release/itch/mac-universal", "someone/a-game:mac", "--userversion", "0.1.0"],
      ["push", "release/itch/win-unpacked", "someone/a-game:windows", "--userversion", "0.1.0"],
      ["push", "release/itch/linux-unpacked", "someone/a-game:linux", "--userversion", "0.1.0"],
    ]);
  });
});
