import { expect, open, test } from "@e2e/fixtures";
import type { Page } from "@playwright/test";
import { CELL } from "@/game/links";

/** Waits for the audio context state; a timeout names the step and the state it was stuck in. */
async function audioRunning(page: Page, step: string, running: boolean): Promise<void> {
  const poll = expect.poll(() => page.evaluate(() => window.__game?.sound().state ?? "none"), {
    message: `audio state at: ${step}`,
    timeout: 10_000,
  });
  await (running ? poll.toBe("running") : poll.not.toBe("running"));
}

async function castFireball(page: Page): Promise<void> {
  await page.evaluate(() => window.__game?.act({ frames: 30, cast: [1, 0] }));
}

test("audio waits for the first touch, drops what it couldn't play, then plays", async ({
  page,
}) => {
  await open(page, `${CELL}&manual=1`, "wave");
  // The wave starts in its 1s countdown (rules/feel.json's countdownS): step() there returns
  // before applying a command at all, so a cast during it is lost, not queued (sim/step.ts).
  // Clear it first, as tests/e2e/wave.spec.ts does, so the cast actually lands.
  await page.evaluate(() => window.__game?.frames(240));
  await castFireball(page);
  const before = await page.evaluate(() => window.__game?.sound());
  // "suspended" or "interrupted": Phaser 4.2.1's own visibility-change guard (onGameVisible,
  // for iOS 17/18) suspends and resumes the context once at boot, which WebKit here reports as
  // "interrupted" rather than "suspended" (checked against this repo's pinned Playwright/WebKit,
  // 2026-09-26). Either way it isn't unlocked yet, so the sound is dropped and counted, not played.
  expect(["suspended", "interrupted"]).toContain(before?.state);
  expect(before?.played).toBe(0);
  expect(before?.locked).toBeGreaterThan(0);
  await page.touchscreen.tap(60, 300);
  await audioRunning(page, "first tap", true);
  await page.evaluate(() => window.__game?.frames(200));
  await castFireball(page);
  const after = await page.evaluate(() => window.__game?.sound());
  expect(after?.played).toBeGreaterThan(0);
  expect(after?.unlockFailures).toBe(0);

  // Phaser resumes a suspended context itself every frame (WebAudioSoundManager#update →
  // onFocus), which AudioOut routes through AudioUnlock's counted resume. Refuse the next resume,
  // as iOS can after an interruption: it must be counted, not crash the wave, and a later
  // resume must still bring audio back.
  await page.evaluate(() => {
    const proto = AudioContext.prototype;
    const resume = proto.resume;
    let refused = false;
    proto.resume = function (this: AudioContext) {
      if (refused) return resume.call(this);
      refused = true;
      return Promise.reject(new Error("e2e: resume refused"));
    };
  });
  await page.evaluate(() => window.__game?.suspendAudio());
  await expect
    .poll(() => page.evaluate(() => window.__game?.sound().unlockFailures), { timeout: 10_000 })
    .toBe(1);
  // A tap as well, in case this page lacks focus (then only gestures resume, via AudioUnlock).
  await page.touchscreen.tap(60, 300);
  await audioRunning(page, "after a refused resume", true);
  expect(await page.evaluate(() => window.__game?.flow().screen)).toBe("wave");
});
