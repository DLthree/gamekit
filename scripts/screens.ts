/**
 * pnpm screens [--screen NAME|all] [--device desktop|deck|phone|phone-landscape|all] [--out DIR]
 *
 * Screenshots the game's pages that are not a moment of a wave (the game's SCREENS in
 * src/game/links.ts: its grid, pause, result, error…) at every device size, on the shot tools'
 * own server (scripts/game-page.ts). A page is ready once the flow reaches its screen. Writes
 * <out>/<screen>-<device>.png; default out shots/screens.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DEVICES, openPage, toolQuery, withGameBrowser } from "@scripts/game-page";
import { SCREENS } from "@/game/links";

const NAMES = Object.keys(SCREENS);
const USAGE = `usage: pnpm screens [--screen ${NAMES.join("|")}|all] [--device ${DEVICES.join("|")}|all] [--out DIR]`;

const { values } = parseArgs({
  options: {
    screen: { type: "string", default: "all" },
    device: { type: "string", default: "all" },
    out: { type: "string", default: "shots/screens" },
  },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const screens =
  values.screen === "all"
    ? NAMES
    : NAMES.includes(values.screen)
      ? [values.screen]
      : fail(`--screen ${values.screen}: no such page`);
const devices =
  values.device === "all"
    ? DEVICES
    : [DEVICES.find((d) => d === values.device) ?? fail(`--device ${values.device}`)];

mkdirSync(values.out, { recursive: true });
await withGameBrowser("pnpm screens", async (browser, base) => {
  for (const name of screens) {
    const spec = SCREENS[name];
    for (const device of devices) {
      const { page, errors } = await openPage(browser, device);
      await page.goto(`${base}/?${toolQuery(spec.query)}`);
      await page.waitForFunction(() => !["boot", undefined].includes(window.__game?.flow().screen));
      if (spec.act !== undefined) await page.evaluate(spec.act);
      await page.waitForFunction((s) => window.__game?.flow().screen === s, spec.screen);
      // Let CSS transitions and the canvas finish their first frames.
      await page.waitForTimeout(300);
      if (errors.length > 0) {
        console.error(`${name} (${device}): ${errors.join("\n")}`);
        process.exitCode = 1;
      } else {
        const path = join(values.out, `${name}-${device}.png`);
        await page.screenshot({ path });
        console.log(path);
      }
      await page.context().close();
    }
  }
});
