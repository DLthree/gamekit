import { describe, expect, it } from "vitest";
import { compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { testFiles } from "@/realtime/test/content";
import type { FilePatch } from "@/test/content";

function errs(patch: FilePatch): string[] {
  const r = compileContent(testFiles(patch));
  return r.ok ? [] : r.errors.map(formatContentError);
}

function base(file: string): Record<string, unknown> {
  const body = structuredClone(testFiles()[file]);
  if (typeof body !== "object" || body === null) throw new Error(file);
  return body as Record<string, unknown>;
}

describe("checkGame", () => {
  it("rejects a projectile that could step through an enemy, as world creation would", () => {
    const r = loadContentDir(REPO_CONTENT_DIR, ["skills/fire-bolt.stats.projectileSpeed=2000"]);
    const e = r.ok ? [] : r.errors.map(formatContentError);
    expect(e).toContainEqual(
      expect.stringMatching(
        /^builds\/wizard\.json › tiers\.0: against tier-1: fire-bolt projectiles move 33\.3 a tick, more than \d+/,
      ),
    );
  });

  it("rejects a loadout skill that does not exist, naming the path", () => {
    const tier = { loadout: { auto: { skill: "zapp" }, cast: { skill: "boom" } } };
    const e = errs({
      "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] },
    });
    expect(e).toContain("builds/hero.json › tiers.0.loadout.auto.skill: no skill zapp");
  });

  it("rejects a skill whose activation does not match its slot", () => {
    const tier = { loadout: { auto: { skill: "boom" }, cast: { skill: "zap" } } };
    const e = errs({
      "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] },
    });
    expect(e).toContain(
      "builds/hero.json › tiers.0.loadout.auto.skill: boom is manual, slot auto is auto",
    );
  });

  it("rejects a deed asking for a threat tier the content lacks", () => {
    const e = errs({
      "deeds/far.json": { name: "Far", text: "Go far.", needs: { threat: 9 } },
    });
    expect(e).toContain("deeds/far.json › needs.threat: no threats/tier-9.json");
  });

  it("rejects a deed that needs nothing", () => {
    const e = errs({ "deeds/free.json": { name: "Free", text: "Nothing.", needs: {} } });
    expect(e.join("\n")).toContain("a deed needs at least one of won, threat, kills");
  });

  it("keeps spawn timelines inside the wave", () => {
    const e = errs({
      "threats/tier-1.json": {
        durationS: 10,
        maxAlive: 10,
        spawns: [{ enemy: "dummy", from: 0, to: 12, rate: [1, 1], pattern: "edge" }],
      },
    });
    expect(e).toContain("threats/tier-1.json › spawns.0.to: after the wave ends at 10 s");
  });

  it("keeps a ring spawn's radius inside the arena", () => {
    const e = errs({
      "threats/tier-1.json": {
        durationS: 10,
        maxAlive: 10,
        spawns: [{ enemy: "dummy", at: 0, count: 4, pattern: "ring", radius: 1500 }],
      },
      "rules/arena.json": { halfWidth: 1000, halfHeight: 1000, spawnRadius: 600 },
    });
    expect(e).toContain(
      "threats/tier-1.json › spawns.0.radius: at most 1000 (the arena's smaller half extent)",
    );
  });

  it("keeps a field spawn's distances ordered, on screen and inside the arena", () => {
    const field = { enemy: "dummy", at: 0, count: 4, pattern: "field", warnS: 1 };
    const e = errs({
      "threats/tier-1.json": {
        durationS: 10,
        maxAlive: 10,
        spawns: [
          { ...field, minDistance: 150, maxDistance: 150 },
          { ...field, minDistance: 100, maxDistance: 250 },
          { ...field, at: 9, minDistance: 100, maxDistance: 150 },
        ],
      },
      "rules/arena.json": { halfWidth: 1000, halfHeight: 180, spawnRadius: 180 },
    });
    expect(e).toContain(
      "threats/tier-1.json › spawns.0.minDistance: must be less than maxDistance",
    );
    expect(e).toContain(
      "threats/tier-1.json › spawns.1.maxDistance: at most 200 (half of look/camera.json shortSideSpan, so spawns stay on screen)",
    );
    expect(e).toContain(
      "threats/tier-1.json › spawns.1.maxDistance: at most 180 (the arena's smaller half extent)",
    );
    expect(e).toContain("threats/tier-1.json › spawns.2.warnS: after the wave ends at 10 s");
  });

  it("names threat files tier-N", () => {
    const e = errs({ "threats/hard.json": { durationS: 10, maxAlive: 10, spawns: [] } });
    expect(e).toContain("threats/hard.json: threat files are named tier-1, tier-2, …");
  });
});

describe("loadout modifiers", () => {
  const lingering = {
    requires: ["area"],
    addTags: ["duration"],
    stats: [
      { stat: "duration", op: "flat", value: 2 },
      { stat: "pulse", op: "flat", value: 0.5 },
    ],
    attach: [
      {
        to: "burst",
        hook: "onEnd",
        action: { do: "zone", motion: "static", vfx: "none", areaScale: 0.5 },
      },
    ],
  };
  const stoke = { requires: ["duration"], stats: [{ stat: "pulse", op: "more", value: -0.2 }] };

  function build(cast: string[], extra: Record<string, unknown> = {}, auto: string[] = []) {
    const tier = {
      loadout: {
        auto: { skill: "zap", modifiers: auto },
        cast: { skill: "boom", modifiers: cast },
      },
      ...extra,
    };
    return { "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] } };
  }
  const withMods = (patch: FilePatch): FilePatch => ({
    "modifiers/lingering.json": lingering,
    "modifiers/stoke.json": stoke,
    ...patch,
  });

  it("accepts modifiers whose requirements are met in order", () => {
    expect(errs(withMods(build(["lingering", "stoke"])))).toEqual([]);
  });

  it("checks requires against the tags earlier modifiers added", () => {
    expect(errs(withMods(build(["stoke", "lingering"])))).toContain(
      "builds/hero.json › tiers.0.loadout.cast.modifiers.0: stoke requires duration; boom has projectile, area, fire here",
    );
    expect(errs(withMods(build(["lingering", "stoke"], {}, ["lingering"])))).toContain(
      "builds/hero.json › tiers.0.loadout.auto.modifiers.0: lingering requires area; zap has projectile, fire here",
    );
  });

  it("rejects unknown and repeated modifiers", () => {
    const e = errs(withMods(build(["lingering", "stoke", "stoke", "nope"])));
    expect(e).toContain(
      "builds/hero.json › tiers.0.loadout.cast.modifiers.2: stoke is already on boom; a modifier doesn't stack with itself",
    );
    expect(e).toContain("builds/hero.json › tiers.0.loadout.cast.modifiers.3: no modifier nope");
  });

  it("validates the merged tree: an attached zone needs its stats", () => {
    const noPulse = { ...lingering, stats: [lingering.stats[0]] };
    expect(
      errs({ ...withMods(build(["lingering"])), "modifiers/lingering.json": noPulse }),
    ).toContain(
      "builds/hero.json › tiers.0.loadout.cast: boom with its modifiers: stats.pulse required by the zone in deliver.onEnd.0.onEnd.0",
    );
  });

  it("keeps actor stats out of modifiers and flags modifiers no build uses", () => {
    const e = errs({
      ...withMods(build(["lingering", "stoke"])),
      "modifiers/spare.json": { stats: [{ stat: "life", op: "flat", value: 5 }] },
    });
    expect(e).toContain(
      "modifiers/spare.json › stats.0.stat: life is an actor stat; a modifier changes one skill (put it in a build tier's stats)",
    );
    expect(e).toContain("modifiers/spare.json: no build uses it");
  });

  it("checks tier look keys and the vfx they put in the merged tree", () => {
    const e = errs(
      withMods(
        build(["lingering", "stoke"], {
          look: { "boom.burst": "zap", "nope.burst": "blast", "zap.zone": "none" },
        }),
      ),
    );
    expect(e).toContain(
      "builds/hero.json › tiers.0.loadout.cast: boom with its modifiers: deliver.onEnd.0.vfx: zap is a projectile recipe; a burst needs explosion or none",
    );
    expect(e).toContain(
      "builds/hero.json › tiers.0.look.nope.burst: no nope in this tier's loadout",
    );
    expect(e).toContain("builds/hero.json › tiers.0.look.zap.zone: zap has no zone in this tier");
  });

  it("rejects an attach to a kind the tree doesn't have when that modifier applies", () => {
    const ripple = {
      attach: [
        {
          to: "zone",
          hook: "onEnd",
          action: { do: "burst", shape: { kind: "circle" }, vfx: "blast" },
        },
      ],
    };
    const late = "builds/hero.json › tiers.0.loadout.cast.modifiers.";
    const ok = errs(
      withMods({ ...build(["lingering", "ripple"]), "modifiers/ripple.json": ripple }),
    );
    expect(ok.filter((m) => m.startsWith(late))).toEqual([]);
    expect(
      errs(withMods({ ...build(["ripple", "lingering"]), "modifiers/ripple.json": ripple })),
    ).toContain(`${late}0: ripple attaches to zone; boom has no zone here`);
  });

  it("rejects a modifier that attaches to dash: a dash never queues onEnd children", () => {
    // dashify attaches a dash under boom's burst; dashattach then attaches under that dash, once
    // the tree has one to attach to (kindsOf sees only kinds applied before the current modifier).
    const dashify = { attach: [{ to: "burst", hook: "onEnd", action: { do: "dash" } }] };
    const dashattach = {
      attach: [
        {
          to: "dash",
          hook: "onEnd",
          action: { do: "burst", shape: { kind: "circle" }, vfx: "none" },
        },
      ],
    };
    const e = errs(
      withMods({
        ...build(["dashify", "dashattach"], {
          stats: [{ stat: "duration", op: "flat", value: 0.3 }],
        }),
        "modifiers/dashify.json": dashify,
        "modifiers/dashattach.json": dashattach,
      }),
    );
    expect(e).toContain(
      "builds/hero.json › tiers.0.loadout.cast: boom with its modifiers: deliver.onEnd.0.onEnd.0.onEnd: a dash has no end to hang children on (onEnd)",
    );
  });

  it("takes an attach chance in (0, 1]", () => {
    const at = (chance: number) =>
      errs(
        withMods({
          ...build(["lingering", "stoke"]),
          "modifiers/lingering.json": {
            ...lingering,
            attach: [{ ...lingering.attach[0], chance }],
          },
        }),
      ).filter((m) => m.includes("chance"));
    expect(at(1)).toEqual([]);
    expect(at(0.25)).toEqual([]);
    expect(at(0)).toHaveLength(1);
    expect(at(1.5)).toHaveLength(1);
  });

  it("rejects two modifiers setting different multishot patterns on one skill", () => {
    const ring = { requires: ["projectile"], multishot: "nova" };
    const spray = { requires: ["projectile"], multishot: "scatter" };
    const patch = { "modifiers/ring.json": ring, "modifiers/spray.json": spray };
    expect(
      errs(withMods({ ...build(["ring", "spray"], {}, ["ring"]), ...patch })).filter(
        (m) => m.includes("tiers.0") && m.includes("multishot"),
      ),
    ).toEqual([
      "builds/hero.json › tiers.0.loadout.cast.modifiers.1: spray sets multishot scatter but ring sets nova on boom; one pattern per skill",
    ]);
    const again = { "modifiers/again.json": { multishot: "nova" }, ...patch };
    expect(errs({ ...build(["ring", "again"], {}, ["spray"]), ...again })).toEqual([]);
  });

  it("still checks a later modifier's other problems after a multishot conflict", () => {
    const ring = { requires: ["projectile"], multishot: "nova" };
    const spray = {
      requires: ["projectile"],
      multishot: "scatter",
      attach: [
        { to: "zone", hook: "onEnd", action: { do: "zone", motion: "static", vfx: "none" } },
      ],
    };
    const patch = { "modifiers/ring.json": ring, "modifiers/spray.json": spray };
    const e = errs(withMods({ ...build(["ring", "spray"]), ...patch }));
    expect(e).toContain(
      "builds/hero.json › tiers.0.loadout.cast.modifiers.1: spray sets multishot scatter but ring sets nova on boom; one pattern per skill",
    );
    expect(e).toContain(
      "builds/hero.json › tiers.0.loadout.cast.modifiers.1: spray attaches to zone; boom has no zone here",
    );
  });

  it("rejects a multishot pattern on a skill with no projectile", () => {
    const bursty = base("skills/boom.json") as Record<string, unknown>;
    bursty.deliver = { do: "burst", shape: { kind: "circle" }, vfx: "blast" };
    expect(
      errs({
        ...withMods(build(["ring"])),
        "skills/boom.json": bursty,
        "modifiers/ring.json": { multishot: "nova" },
      }),
    ).toContain(
      "builds/hero.json › tiers.0.loadout.cast.modifiers.0: ring sets multishot nova; boom has no projectile here",
    );
  });

  it("rejects a modifier look for a kind the merged tree doesn't have", () => {
    const tint = { look: { zone: "none" } };
    expect(errs(withMods({ ...build(["tint"]), "modifiers/tint.json": tint }))).toContain(
      "builds/hero.json › tiers.0.loadout.cast.modifiers.0: tint swaps the zone vfx; boom has no zone in this tier",
    );
    expect(
      errs(withMods({ ...build(["lingering", "tint"]), "modifiers/tint.json": tint })),
    ).toEqual(expect.not.arrayContaining([expect.stringContaining("tint swaps")]));
  });

  it("rejects a modifier look keyed by dash: a dash has no vfx to swap", () => {
    const e = errs(
      withMods({ ...build(["tint"]), "modifiers/tint.json": { look: { dash: "none" } } }),
    );
    expect(e.some((m) => m.startsWith("modifiers/tint.json › look"))).toBe(true);
  });

  it("rejects a tier look key naming dash: a dash has no vfx to swap", () => {
    const e = errs(withMods(build(["lingering", "stoke"], { look: { "boom.dash": "none" } })));
    expect(e.some((m) => m.startsWith("builds/hero.json › tiers.0.look"))).toBe(true);
  });

  it("rejects repeated tags and a tag both added and removed", () => {
    const e = errs({
      ...withMods(build(["lingering", "stoke", "clash"])),
      "modifiers/clash.json": {
        requires: ["area", "area"],
        addTags: ["fire"],
        removeTags: ["fire"],
      },
    });
    expect(e).toContain("modifiers/clash.json › requires.1: area is listed twice");
    expect(e).toContain("modifiers/clash.json › addTags.0: fire is also in removeTags");
  });

  it("reports a broken skill tree once, in the skill file, not again per build tier", () => {
    const boom = base("skills/boom.json") as { deliver: { vfx: string } };
    boom.deliver.vfx = "blast";
    const e = errs({ ...withMods(build(["lingering", "stoke"])), "skills/boom.json": boom });
    expect(e).toContain(
      "skills/boom.json › deliver.vfx: blast is an explosion recipe; a projectile needs projectile or none",
    );
    expect(e.filter((m) => m.includes("with its modifiers"))).toEqual([]);
  });
});

describe("stages", () => {
  const stage = (from: string, enemy = "dummy") => ({
    "stages/bench.json": {
      name: "Bench",
      from,
      durationS: 5,
      armed: false,
      hold: false,
      actors: [{ enemy, x: 0, y: 50 }],
    },
  });

  it("accept a stage whose from is a cell the content has", () => {
    expect(errs(stage("char=hero&build=1&threat=1"))).toEqual([]);
  });

  it("reject a from that is no cell, or a cell the content lacks", () => {
    expect(errs(stage("char=hero"))).toEqual([
      "stages/bench.json › from: stages/bench.json from: char=hero is not a cell (char, build and threat)",
    ]);
    expect(errs(stage("char=hero&build=1&threat=7"))).toEqual([
      "stages/bench.json › from: threats/tier-7.json does not exist",
    ]);
  });

  it("reject an actor that is no enemy", () => {
    expect(errs(stage("char=hero&build=1&threat=1", "ghost"))).toEqual([
      "stages/bench.json › actors.0.enemy: no enemy ghost",
    ]);
  });
});
