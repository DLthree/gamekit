import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { tickSeconds } from "@/core/clock";
import { kite } from "@/game/kite-bot";
import { HERO } from "@/game/links";
import { worldFor } from "@/game/setup";
import { applyEvents } from "@/realtime/present/feedback";
import { createPresentation } from "@/realtime/present/presentation";
import { step } from "@/realtime/sim/step";

function load(overrides: string[]) {
  const loaded = loadContentDir(REPO_CONTENT_DIR, overrides);
  if (!loaded.ok) throw new Error(loaded.errors.map(formatContentError).join("\n"));
  return loaded.content;
}
/** The whole wave, however the bot fares: an unkillable wizard sees every spawn of the timeline. */
const UNKILLABLE = `characters/${HERO}.stats.life=1000000`;

/**
 * Each shipped wizard tier plays a whole wave with the kite bot through
 * the sim and the presentation (as src/game/wave-session.ts runs them each tick), and nothing is
 * dropped. Evict kinds replace their oldest instance at their cap, which is not a drop, and the
 * caps sum below the pool's capacity, so any drop is a tuning error to fix here.
 */
describe(`shipped ${HERO} tiers at full load`, () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 1],
    [3, 3],
  ])("build %i × threat %i drops no volume, event or effect", (buildTier, threatTier) => {
    const seed = 7;
    const overrides = threatTier === 1 ? [] : [UNKILLABLE];
    const content = load(overrides);
    const w = worldFor({ character: HERO, buildTier, threatTier, seed, overrides }, content.sim);
    const p = createPresentation(content, seed);
    let zones = 0;
    let peak = 0;
    for (let i = 0; i < 20_000 && w.phase !== "ended"; i++) {
      step(w, kite(w));
      const t = tickSeconds(w.tick);
      const events = w.events.items;
      zones += events.filter((e) => e.t === "volumeStarted" && e.kind === "zone").length;
      applyEvents(p, events, t);
      p.tracker.update(w, p.em, t);
      p.em.pool.expire(t);
      p.anims.prune(t, content.look.feedback.death.durationS);
      peak = Math.max(peak, p.em.pool.counts().total);
    }
    const fx = p.em.pool.counts();
    expect(w.outcome).not.toBeNull();
    if (threatTier > 1) expect(w.outcome).toBe("survived");
    expect(w.events.overflow).toBe(0);
    expect(w.report.droppedVolumes).toBe(0);
    expect(fx.droppedByKind).toEqual({});
    expect(fx.dropped).toBe(0);
    expect(peak).toBeLessThan(content.look.fx.capacity);
    expect(zones > 0).toBe(buildTier === 3);
  });
});
