import { describe, expect, it } from "vitest";
import { treeProblems } from "@/content/check-tree";
import { compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import type { DeliveryNode } from "@/content/schema/skill";
import { drainSpawns, queueEnemy } from "@/sim/spawn-queue";
import { eliteMeshFiles, type FilePatch, testContent, testFiles } from "@/test/content";
import { testWorld } from "@/test/world";

function errs(patch: FilePatch): string[] {
  const r = compileContent(testFiles(patch));
  return r.ok ? [] : r.errors.map(formatContentError);
}

function base(file: string): Record<string, unknown> {
  const body = structuredClone(testFiles()[file]);
  if (typeof body !== "object" || body === null) throw new Error(file);
  return body as Record<string, unknown>;
}

describe("checkContent", () => {
  it("accepts the test content", () => {
    expect(() => testContent()).not.toThrow();
  });

  it("rejects an fx kind with more variants than its texture has frames", () => {
    const r = loadContentDir(REPO_CONTENT_DIR, ["look/fx.kinds.grass.variants=9"]);
    const e = r.ok ? [] : r.errors.map(formatContentError);
    expect(e).toContainEqual(
      expect.stringMatching(/^look\/fx\.json › kinds\.grass\.variants: \S+ has 3 frames$/),
    );
  });

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

  it("requires the stats a delivery node reads", () => {
    const boom = base("skills/boom.json") as { stats: Record<string, unknown> };
    delete boom.stats.area;
    expect(errs({ "skills/boom.json": boom })).toContain(
      "skills/boom.json › stats.area: required by the burst in deliver.onEnd.0",
    );
  });

  it("requires rate on auto skills and cooldown on manual ones", () => {
    const zap = base("skills/zap.json") as { stats: Record<string, unknown> };
    delete zap.stats.rate;
    expect(errs({ "skills/zap.json": zap })).toContain(
      "skills/zap.json › stats.rate: required by auto activation",
    );
  });

  it("requires each vfx to exist with a recipe for its node kind", () => {
    const boom = base("skills/boom.json") as { deliver: { vfx: string } };
    boom.deliver.vfx = "blast";
    expect(errs({ "skills/boom.json": boom })).toContain(
      "skills/boom.json › deliver.vfx: blast is an explosion recipe; a projectile needs projectile or none",
    );
  });

  it("keeps gold off fodder: a creature's sprite role must equal the enemy role", () => {
    const sprites = base("look/generated/sprites.json") as { sprites: { role: string }[] };
    sprites.sprites[1].role = "elite";
    expect(errs({ "look/generated/sprites.json": sprites })).toContain(
      "enemies/dummy.json › look: sprite dummy is drawn for elite, the enemy is fodder",
    );
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

  it("keeps spawns off screen and inside the arena", () => {
    const e = errs({ "rules/arena.json": { halfWidth: 1000, halfHeight: 500, spawnRadius: 400 } });
    expect(e.some((m) => m.startsWith("rules/arena.json › spawnRadius: at least 448"))).toBe(true);
    const f = errs({ "rules/arena.json": { halfWidth: 1000, halfHeight: 450, spawnRadius: 500 } });
    expect(f).toContain(
      "rules/arena.json › spawnRadius: at most 450 (the arena's smaller half extent)",
    );
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

  it("requires a flat damage StatMod to name exactly one damage type", () => {
    const tier = {
      loadout: { auto: { skill: "zap" }, cast: { skill: "boom" } },
      stats: [{ stat: "damage", op: "flat", value: 2, if: ["spell"] }],
    };
    const e = errs({
      "builds/hero.json": { character: "hero", tiers: [tier, tier, tier] },
    });
    expect(e).toContain(
      "builds/hero.json › tiers.0.stats.0.if: flat damage needs exactly one damage type tag",
    );
  });

  it("rejects tag conditions on actor stats", () => {
    const e = errs({
      "threats/tier-1.json": {
        durationS: 10,
        maxAlive: 10,
        enemyMods: [{ stat: "life", op: "more", value: 1, if: ["fire"] }],
        spawns: [],
      },
    });
    expect(e).toContain("threats/tier-1.json › enemyMods.0.if: actor stats take no tag condition");
  });

  it("names threat files tier-N", () => {
    const e = errs({ "threats/hard.json": { durationS: 10, maxAlive: 10, spawns: [] } });
    expect(e).toContain("threats/hard.json: threat files are named tier-1, tier-2, …");
  });

  it("checks look references to the palette, fx kinds and textures", () => {
    const fx = base("look/fx.json") as { kinds: { puff: { texture: string; tint: string } } };
    fx.kinds.puff.texture = "glitter";
    fx.kinds.puff.tint = "mauve";
    const e = errs({ "look/fx.json": fx });
    expect(e).toContain("look/fx.json › kinds.puff.texture: no fx texture glitter");
    expect(e).toContain("look/fx.json › kinds.puff.tint: not build and not a palette colour");
  });

  it("checks projectile head tints like fx kind tints", () => {
    const fx = base("look/fx.json") as { vfx: { zap: { head: { tint: string } } } };
    fx.vfx.zap = { ...fx.vfx.zap, head: { ...fx.vfx.zap.head, tint: "mauve" } };
    expect(errs({ "look/fx.json": fx })).toContain(
      "look/fx.json › vfx.zap.head.tint: not build and not a palette colour",
    );
  });

  it("rejects a stick dead zone that is not smaller than its radius", () => {
    const controls = base("look/controls.json") as { stickRadius: number; stickDeadZone: number };
    controls.stickDeadZone = controls.stickRadius;
    expect(errs({ "look/controls.json": controls })).toContain(
      `look/controls.json › stickDeadZone: must be less than stickRadius (${controls.stickRadius}); stickVector divides by their difference`,
    );
  });

  it("keeps the knobs smaller than the button and the stick", () => {
    const controls = base("look/controls.json") as Record<string, number>;
    controls.knobRadius = controls.buttonRadius;
    expect(errs({ "look/controls.json": controls })).toContain(
      `look/controls.json › knobRadius: must be less than buttonRadius (${controls.buttonRadius}) and stickRadius (${controls.stickRadius})`,
    );
  });

  it("names sounds that are not tuned or not generated", () => {
    const sounds = {
      volume: 1,
      sounds: {
        tick: { cap: 1, minGapS: 0, volume: 1, pitch: 0, loop: false },
        boing: { cap: 1, minGapS: 0, volume: 1, pitch: 0, loop: false },
      },
    };
    const feedback = structuredClone(testFiles()["look/feedback.json"]) as {
      sounds: Record<string, string>;
    };
    feedback.sounds.hit = "clang";
    const e = errs({ "look/sounds.json": sounds, "look/feedback.json": feedback });
    expect(e).toContain(
      "look/sounds.json › sounds.boing: not in look/generated/sounds.json; run pnpm sounds",
    );
    expect(e).toContain("look/feedback.json › sounds.hit: no sound clang in look/sounds.json");
  });

  it("requires a ground vfx's sound to loop", () => {
    const fx = base("look/fx.json") as { vfx: Record<string, unknown> };
    fx.vfx.burn = {
      recipe: "ground",
      stains: { kind: "puff", count: 0, alpha: 1, size: [0.5, 1] },
      grass: { kind: "puff", count: 0, size: [1, 1] },
      flames: { kind: "puff", count: 0, size: [1, 1] },
      embers: { kind: "puff", count: 0, size: 1 },
      spreadS: 0,
      flat: 1,
      sound: "tick",
    };
    const e = errs({ "look/fx.json": fx });
    expect(e).toContain(
      "look/fx.json › vfx.burn.sound: sound tick does not loop; ground vfx need a loop",
    );
  });

  it("rejects a looping sound on anything but a ground vfx", () => {
    const sounds = base("look/sounds.json") as { sounds: Record<string, unknown> };
    sounds.sounds.loopy = { cap: 1, minGapS: 0, volume: 1, pitch: 0, loop: true };
    const fx = base("look/fx.json") as { vfx: { blast: { sound: string } } };
    fx.vfx.blast.sound = "loopy";
    const e = errs({ "look/sounds.json": sounds, "look/fx.json": fx });
    expect(e).toContain(
      "look/fx.json › vfx.blast.sound: sound loopy loops; only ground vfx may loop",
    );
  });

  it("requires the spawn warning colour in the palette", () => {
    const feedback = base("look/feedback.json") as { spawnWarning: { color: string } };
    feedback.spawnWarning.color = "mauve";
    expect(errs({ "look/feedback.json": feedback })).toContain(
      "look/feedback.json › spawnWarning.color: no palette colour mauve",
    );
  });

  it("requires the skill button's cancel colour in the palette", () => {
    const controls = base("look/controls.json") as { cancelColor: string };
    controls.cancelColor = "mauve";
    expect(errs({ "look/controls.json": controls })).toContain(
      "look/controls.json › cancelColor: no palette colour mauve",
    );
  });

  it("requires every draw band exactly once", () => {
    const e = errs({
      "look/layers.json": { bands: ["floor", "actors", "actors"], ySorted: ["actors"] },
    });
    expect(e).toContain(
      "look/layers.json › bands: list each band exactly once: floor, ground, blast, clearing, shadows, actors, fx, telegraphs, player, aim",
    );
  });

  it("requires area, duration and pulse on a zone, and a vfx a zone can draw", () => {
    const e = errs({
      "skills/pool.json": {
        tags: ["spell", "area", "fire"],
        activation: "manual",
        target: "aim",
        stats: { damage: { fire: 1 }, cooldown: 1, range: 100, area: 30, knockback: 0 },
        deliver: { do: "zone", motion: "static", vfx: "blast" },
      },
    });
    expect(e).toContain("skills/pool.json › stats.duration: required by the zone in deliver");
    expect(e).toContain("skills/pool.json › stats.pulse: required by the zone in deliver");
    expect(e).toContain(
      "skills/pool.json › deliver.vfx: blast is an explosion recipe; a zone needs ground or none",
    );
  });

  it("rejects a zone whose duration or pulse is too short to ever pulse", () => {
    const e = errs({
      "skills/pool.json": {
        tags: ["spell", "area", "fire"],
        activation: "manual",
        target: "aim",
        stats: {
          damage: { fire: 1 },
          cooldown: 1,
          range: 100,
          area: 30,
          duration: 1 / 60,
          pulse: 0.001,
          knockback: 0,
        },
        deliver: { do: "zone", motion: "static", vfx: "none" },
      },
    });
    expect(e).toContain(
      "skills/pool.json › stats.duration: a zone's duration must be at least 2 ticks so it pulses before it ends (1)",
    );
    expect(e).toContain(
      "skills/pool.json › stats.pulse: a zone's pulse must be at least 1 tick (0)",
    );
  });

  it("bends player, elite and boss creatures but never fodder", () => {
    const creatures = structuredClone(testFiles()["look/creatures.json"]) as {
      creatures: Record<string, Record<string, unknown>>;
    };
    creatures.creatures.dummy.mesh = {
      lean: 0,
      sway: 0,
      stride: 0,
      spread: 0,
      breath: 0,
      hip: 0.5,
    };
    expect(errs({ "look/creatures.json": creatures })).toContain(
      "look/creatures.json › creatures.dummy.mesh: dummy is drawn as fodder; only player, elite and boss creatures bend",
    );
    expect(errs(eliteMeshFiles())).toEqual([]);
  });

  it("rejects pierce on a trigger projectile", () => {
    const boom = base("skills/boom.json") as { stats: Record<string, unknown> };
    boom.stats.pierce = 1;
    expect(errs({ "skills/boom.json": boom })).toContain(
      "skills/boom.json › deliver.impact: a trigger projectile ends on its first contact; it can't pierce",
    );
  });

  it("requires scatter on a burst with more than one mark", () => {
    const nibble = base("skills/nibble.json") as { deliver: Record<string, unknown> };
    nibble.deliver.count = 3;
    expect(errs({ "skills/nibble.json": nibble })).toContain(
      "skills/nibble.json › deliver.scatter: a burst with count > 1 needs scatter > 0",
    );
    nibble.deliver.scatter = 20;
    expect(errs({ "skills/nibble.json": nibble })).toEqual([]);
  });

  it("requires a warning on an owner-bound burst", () => {
    const nibble = base("skills/nibble.json") as { deliver: Record<string, unknown> };
    nibble.deliver.cancelOnOwnerDeath = true;
    expect(errs({ "skills/nibble.json": nibble })).toContain(
      "skills/nibble.json › deliver.cancelOnOwnerDeath: only a warned burst (warn > 0) can be cancelled",
    );
    Object.assign(nibble.deliver, { warn: 0.5, shape: { kind: "circle" }, vfx: "mark" });
    expect(errs({ "skills/nibble.json": nibble })).toEqual([]);
  });

  it("requires range on a lane burst's skill", () => {
    // The skill schema makes range required, so this rule guards the tree walk itself.
    const c = testContent();
    const lane = {
      ...c.sim.skills.nibble.deliver,
      shape: { kind: "lane" as const },
    } as DeliveryNode;
    const problems = treeProblems(
      c,
      lane,
      (stat) => stat !== "range",
      () => undefined,
    );
    expect(problems).toContainEqual({
      stat: "range",
      path: "deliver",
      message: "required by the lane burst in deliver",
    });
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
      "builds/hero.json › tiers.0.loadout.cast.modifiers.0: stoke requires duration; boom has spell, projectile, area, fire here",
    );
    expect(errs(withMods(build(["lingering", "stoke"], {}, ["lingering"])))).toContain(
      "builds/hero.json › tiers.0.loadout.auto.modifiers.0: lingering requires area; zap has spell, projectile, fire here",
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

  it("holds props only on mesh creatures, with a prop sprite", () => {
    const creatures = structuredClone(testFiles()["look/creatures.json"]) as {
      creatures: Record<string, Record<string, unknown>>;
    };
    creatures.creatures.hero.prop = {
      sprite: "dummy",
      hand: [0.9, 0.5],
      restDeg: 0,
      scale: 1,
      thrustS: 0.4,
    };
    const e = errs({ "look/creatures.json": creatures });
    expect(e).toContain(
      "look/creatures.json › creatures.hero.prop.sprite: dummy is not drawn as a prop",
    );
    expect(e).toContain(
      "look/creatures.json › creatures.hero.prop: a prop is held at the mesh's hand; give the creature a mesh",
    );
  });

  it("rejects a dash node whose skill has no duration", () => {
    const e = errs({
      "skills/nibble.json": {
        ...base("skills/nibble.json"),
        deliver: {
          do: "burst",
          shape: { kind: "arc", halfAngleDeg: 60 },
          vfx: "none",
          onEnd: [{ do: "dash" }],
        },
      },
    });
    expect(e).toContain(
      "skills/nibble.json › stats.duration: required by the dash in deliver.onEnd.0",
    );
  });

  it("rejects a dash node with onEnd children: a dash never queues them", () => {
    const nibble = base("skills/nibble.json") as { stats: Record<string, unknown> };
    nibble.stats.duration = 0.3;
    const e = errs({
      "skills/nibble.json": {
        ...nibble,
        deliver: {
          do: "burst",
          shape: { kind: "arc", halfAngleDeg: 60 },
          vfx: "none",
          onEnd: [{ do: "dash", onEnd: [{ do: "burst", shape: { kind: "circle" }, vfx: "none" }] }],
        },
      },
    });
    expect(e).toContain(
      "skills/nibble.json › deliver.onEnd.0.onEnd: a dash has no end to hang children on (onEnd)",
    );
  });

  it("rejects a keepDistance enemy with no skill whose range reaches distance × 1.1", () => {
    const distance = 50;
    const e = errs({
      "enemies/dummy.json": {
        ...base("enemies/dummy.json"),
        behavior: { kind: "keepDistance", distance },
      },
    });
    expect(e).toContain(
      `enemies/dummy.json › behavior.distance: no skill has range ≥ ${distance * 1.1}; this enemy would never attack`,
    );
  });

  it("keepDistance's range rule holds at the boundary: range ≥ distance × 1.1 passes, just under it fails", () => {
    const nibbleWithRange = (range: number) => {
      const nibble = base("skills/nibble.json") as { stats: { range: number } };
      nibble.stats.range = range;
      return nibble;
    };
    const dummyAt = (distance: number) => ({
      ...base("enemies/dummy.json"),
      behavior: { kind: "keepDistance", distance },
    });
    // distance 10 × 1.1 = 11 exactly (no floating-point remainder at this scale).
    const passing = errs({
      "skills/nibble.json": nibbleWithRange(11),
      "enemies/dummy.json": dummyAt(10),
    });
    expect(passing.some((m) => m.includes("would never attack"))).toBe(false);
    const failing = errs({
      "skills/nibble.json": nibbleWithRange(10.9),
      "enemies/dummy.json": dummyAt(10),
    });
    expect(failing).toContain(
      "enemies/dummy.json › behavior.distance: no skill has range ≥ 11; this enemy would never attack",
    );
  });

  it("drainSpawns names an unknown enemy def", () => {
    const w = testWorld();
    queueEnemy(w, "nope", 0, 0);
    expect(() => drainSpawns(w)).toThrow(
      `tick ${w.tick}: no enemy template "nope" (content/enemies/nope.json)`,
    );
  });
});
