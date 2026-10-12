import { expect, open, test } from "@e2e/fixtures";

for (const build of [1, 2, 3]) {
  test(`wizard build ${build} × threat 1 plays a whole wave in the browser, dropping nothing`, async ({
    page,
  }) => {
    await open(page, `char=wizard&build=${build}&threat=1&manual=1&bot=kite&agent=1`);
    await page.evaluate(() => window.__game?.step(20_000));
    const report = await page.evaluate(() => window.__game?.report());
    expect(report?.outcome).not.toBeNull();
    expect(report?.kills).toBeGreaterThan(0);
    expect(report?.droppedVolumes).toBe(0);
    const fx = await page.evaluate(() => window.__game?.fx());
    expect(fx?.dropped).toBe(0);
    expect(fx?.droppedByKind).toEqual({});
    const zones = await page.evaluate(
      () =>
        window.__game?.events(0).filter((e) => e.t === "volumeStarted" && e.kind === "zone").length,
    );
    expect((zones ?? 0) > 0).toBe(build === 3);
  });
}
