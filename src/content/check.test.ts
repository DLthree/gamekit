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

  it("keeps spawns off screen and inside the arena", () => {
    const e = errs({ "rules/arena.json": { halfWidth: 1000, halfHeight: 500, spawnRadius: 400 } });
    expect(e.some((m) => m.startsWith("rules/arena.json › spawnRadius: at least 448"))).toBe(true);
    const f = errs({ "rules/arena.json": { halfWidth: 1000, halfHeight: 450, spawnRadius: 500 } });
    expect(f).toContain(
      "rules/arena.json › spawnRadius: at most 450 (the arena's smaller half extent)",
    );
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
      "look/creatures.json › creatures.dummy.mesh: dummy is drawn as fodder; meshRoles has player, elite, boss",
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
