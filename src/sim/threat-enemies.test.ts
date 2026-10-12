import { describe, expect, it } from "vitest";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import type { SimEvent } from "@/sim/events";
import { createWorld, playerOf, type World } from "@/sim/world";
import { enemies, place, run, runUntilEvent } from "@/test/world";

/**
 * The real shipped content: the wizard on tier-1 (no threat file spawns these enemies yet, so
 * they're placed directly). The player's own auto skill is defanged (range 1) so only the
 * enemies under test cast. The player starts at the origin, idle throughout.
 */
function worldWithShippedContent(): World {
  const r = loadContentDir(REPO_CONTENT_DIR, ["skills/fire-bolt.stats.range=1"]);
  if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
  return createWorld(
    { character: "wizard", buildTier: 1, threatTier: 1, seed: 1, overrides: [] },
    r.content.sim,
  );
}

function only<T extends SimEvent["t"]>(events: SimEvent[], t: T): Extract<SimEvent, { t: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { t: T }> => e.t === t);
}

function castsBy(events: SimEvent[], def: string): boolean {
  return only(events, "cast").some((e) => e.casterDef === def);
}

describe("threat enemies (M3)", () => {
  it("the elite lion casts, and its charge resolves then dashes at the player", () => {
    const w = worldWithShippedContent();
    const lion = place(w, "elite-lion", 100, 0);
    const cast = runUntilEvent(w, "cast", 600);
    expect(cast.casterDef).toBe("elite-lion");
    const resolved = runUntilEvent(w, "telegraphResolved", 600);
    expect(resolved.ownerDef).toBe("elite-lion");
    // The lion is held through the warn: it hasn't moved past where the charge fired.
    const heldX = lion.x;
    // The charge's onEnd dash then carries it further toward the player over its duration.
    run(w, 30);
    expect(lion.x).toBeLessThan(heldX);
  });

  it("the thrower casts stone-volley and settles near its keepDistance band (180 ± 10%)", () => {
    const w = worldWithShippedContent();
    const thrower = place(w, "thrower", 400, 0);
    const events = run(w, 600);
    expect(castsBy(events, "thrower")).toBe(true);
    const gap = Math.hypot(thrower.x - playerOf(w).x, thrower.y - playerOf(w).y);
    expect(gap).toBeGreaterThan(180 * 0.9 - 20);
    expect(gap).toBeLessThan(180 * 1.1 + 20);
  });

  it("the dragon boss casts slam, which resolves on the player", () => {
    const w = worldWithShippedContent();
    place(w, "boss-dragon", 100, 0);
    const hp0 = playerOf(w).hp;
    const events = run(w, 600);
    expect(castsBy(events, "boss-dragon")).toBe(true);
    expect(only(events, "telegraphResolved")).toContainEqual(
      expect.objectContaining({ ownerDef: "boss-dragon", hitPlayer: true }),
    );
    expect(playerOf(w).hp).toBeLessThan(hp0);
  });

  it("all three new enemies cast their skill once placed near the player", () => {
    const w = worldWithShippedContent();
    place(w, "elite-lion", 100, 0);
    place(w, "thrower", 150, 0);
    place(w, "boss-dragon", 100, 100);
    const events = run(w, 600);
    expect(castsBy(events, "elite-lion")).toBe(true);
    expect(castsBy(events, "thrower")).toBe(true);
    expect(castsBy(events, "boss-dragon")).toBe(true);
    expect(enemies(w)).toHaveLength(3);
  });
});
