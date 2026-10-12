import type { TestNames } from "@/realtime/test/vocab";

const bend = { lean: 0.05, sway: 0.03, stride: 0.05, spread: 0.1, breath: 0.035, hip: 0.55 };

const gait = {
  kind: "waddle",
  hz: 2,
  bob: 0.04,
  squash: 0.05,
  rock: 4,
  lean: 0,
  breath: 0.02,
  breathHz: 0.8,
  hover: 0,
};

const fxKind = {
  texture: "smoke",
  variants: null,
  cap: 50,
  evict: false,
  band: "fx",
  tint: "white",
  life: 0.5,
  growS: 0.2,
  scaleFrom: 0.5,
  scaleTo: 1,
  popS: 0.05,
  fadeFrom: 0.5,
  alpha: 1,
  drag: 2,
  rise: 0,
  flicker: 0,
  flickerHz: 0,
  sway: null,
};

const projectileVfx = {
  recipe: "projectile",
  head: { texture: "spark", frame: 0, size: 10, spinHz: 1, pulse: 0.1, pulseHz: 4, tint: "build" },
  trail: { kind: "puff", everyS: 0.05, size: 8, jitter: 2, drift: 5, flame: null },
  sound: "tick",
};

const telegraphVfx = {
  recipe: "telegraph",
  hatch: { spacing: 6, width: 1.5, angleDeg: 45, alpha: 0.8 },
  halo: { width: 6, alpha: 0.7 },
  outline: { width: 2, alpha: 1 },
  fill: "grow",
  lob: null,
  resolve: { kind: "ring", scale: 1, shake: "blast", sound: "tick" },
  sound: "tick",
};

/**
 * The real-time layer's files in the real-time tests' small content: a hero, a dummy enemy, a zap and
 * a boom, and the look they need. A real-time game spreads them into its `GAME_TEST_FILES`
 * (src/game/test-files.ts); `names` are the game's `TEST_NAMES`.
 */
export function realtimeTestFiles(names: TestNames): Record<string, Record<string, unknown>> {
  const [TAG_A, TAG_B, TAG_C] = names.tags;
  const DMG_A = names.damageTypes[0];
  const DMG_B = names.damageTypes[1] ?? null;
  const [ROLE_A, ROLE_B] = names.roles;
  return {
    "characters/hero.json": {
      stats: { life: 100, moveSpeed: 100, radius: 10, knockbackResist: 0 },
      slots: [
        { id: "auto", activation: "auto" },
        { id: "cast", activation: "manual" },
      ],
    },
    "skills/zap.json": {
      tags: [TAG_A, DMG_A],
      activation: "auto",
      target: "nearest",
      stats: {
        damage: { [DMG_A]: 5 },
        rate: 2,
        range: 200,
        projectileSpeed: 300,
        projectileCount: 1,
        spread: 0,
        knockback: 0,
      },
      deliver: { do: "projectile", multishot: "fan", impact: "damage", radius: 4, vfx: "zap" },
    },
    "skills/boom.json": {
      tags: [TAG_A, TAG_B, DMG_A],
      activation: "manual",
      target: "aim",
      stats: {
        damage: { [DMG_A]: 10 },
        cooldown: 1,
        range: 300,
        area: 50,
        projectileSpeed: 600,
        projectileCount: 1,
        spread: 0,
        knockback: 200,
      },
      deliver: {
        do: "projectile",
        multishot: "fan",
        impact: "trigger",
        radius: 6,
        vfx: "boom",
        onEnd: [{ do: "burst", shape: { kind: "circle" }, vfx: "blast" }],
      },
    },
    "skills/nibble.json": {
      tags: [TAG_C, DMG_B ?? DMG_A],
      activation: "auto",
      target: "player",
      stats: { damage: { [DMG_B ?? DMG_A]: 3 }, rate: 1, range: 20, area: 20, knockback: 0 },
      deliver: { do: "burst", shape: { kind: "arc", halfAngleDeg: 60 }, vfx: "none" },
    },
    "enemies/dummy.json": {
      role: ROLE_A,
      stats: { life: 10, moveSpeed: 0, radius: 10, knockbackResist: 0 },
      behavior: { kind: "chase" },
      skills: ["nibble"],
      look: "dummy",
    },
    "rules/arena.json": { halfWidth: 1000, halfHeight: 1000, spawnRadius: 600 },
    "rules/movement.json": {
      separationRadius: 20,
      separationStrength: 50,
      knockbackDamping: 8,
      facingDeadZone: 4,
    },
    "rules/feel.json": { hitStopS: 0, countdownS: 0 },
    "rules/limits.json": {
      actors: 256,
      volumes: 256,
      events: 1024,
      hits: 1024,
      hashCellSize: 32,
    },
    "look/palette.json": {
      colors: { ink: "#231d17", white: "#ffffff", red: "#e52b0a", smoke: "#9a8e7c" },
    },
    "look/characters.json": { characters: { hero: { creature: "hero", buildColor: "red" } } },
    "look/creatures.json": {
      speedJitter: 0.1,
      meshGrid: { cols: 2, rows: 2 },
      creatures: {
        hero: { sprite: "hero", gait, mesh: bend, prop: null },
        dummy: { sprite: "dummy", gait, mesh: bend, prop: null },
      },
    },
    "look/fx.json": {
      capacity: 200,
      kinds: {
        puff: fxKind,
        ring: { ...fxKind, texture: "ink", band: "telegraphs" },
        "gold-flake": { ...fxKind, texture: "gold", rise: -8 },
      },
      vfx: {
        none: { recipe: "none" },
        mark: telegraphVfx,
        zap: projectileVfx,
        boom: projectileVfx,
        blast: {
          recipe: "explosion",
          ring: { kind: "puff", scale: 1 },
          smoke: { kind: "puff", count: 1, size: 20, delayS: 0.05, everyS: 0.05 },
          shake: "blast",
          scorch: null,
          sound: "tick",
        },
      },
      hit: { kind: "puff", size: 10 },
      death: { splatter: "puff", splatterSize: 20, puff: "puff", puffSize: 20 },
    },
    "look/feedback.json": {
      hitFlash: { durationS: 0.1, color: "white" },
      hitSpring: { amount: 0.1, hz: 6, decayS: 0.1 },
      hitRecoil: { distance: 0.1, decayS: 0.1 },
      castSpring: { amount: 0.1, hz: 5, decayS: 0.1 },
      castRecoil: { distance: 0.1, decayS: 0.1 },
      hitLimitS: 0.1,
      lunge: { durationS: 0.2, reach: 4, leanDeg: 8 },
      death: { durationS: 0.3, pop: 0.3, spinDeg: 30 },
      shadow: { alpha: 0.3, width: 1, height: 0.3 },
      shake: {
        blast: { durationS: 0.1, intensity: 0.004 },
        hurt: { durationS: 0.1, intensity: 0.003 },
        big: { durationS: 0.2, intensity: 0.01 },
      },
      playerHurtShake: "hurt",
      bigDeathRoles: [ROLE_B],
      bigDeathShake: "big",
      sounds: { hit: "tick", death: "tick", playerHurt: "tick", cast: "tick", bigDeath: "chime" },
      goldFlakes: { kind: "gold-flake", count: 6, size: 4, pop: 30 },
      spawnWarning: {
        color: "ink",
        alpha: 0.6,
        fillAlpha: 0.3,
        width: 2,
        scale: 1,
        pulse: 0.1,
        pulseHz: 2,
      },
    },
    "look/camera.json": {
      shortSideSpan: 400,
      maxAspect: 2,
      dprCap: 2,
      focusOffsetY: 0,
      lead: 0,
      leadSmoothS: 0.3,
      background: "ink",
      clearing: { width: 100, height: 50, alpha: 0.5, color: "white" },
      edge: { color: "ink", width: 4, alpha: 1 },
      floor: { density: 1, alpha: 0.3, color: "ink" },
    },
    "look/controls.json": {
      stickRadius: 50,
      stickDeadZone: 5,
      buttonRadius: 40,
      knobRadius: 20,
      cancelColor: "red",
      aim: { color: "ink", cooldownColor: "smoke", alpha: 0.5, width: 3 },
    },
    "look/layers.json": {
      bands: [
        "floor",
        "ground",
        "blast",
        "clearing",
        "shadows",
        "actors",
        "fx",
        "telegraphs",
        "player",
        "aim",
      ],
      ySorted: ["actors"],
    },
    "look/generated/sprites.json": {
      atlas: { png: "atlas/game.png", json: "atlas/game.json" },
      pxPerWorldUnit: 4.5,
      sprites: [
        {
          id: "hero",
          role: "player",
          frame: "creature/hero",
          px: [90, 90],
          world: [20, 20],
          pivot: [0.5, 0.9],
          flying: false,
          grip: null,
          owner: null,
        },
        {
          id: "dummy",
          role: ROLE_A,
          frame: "creature/dummy",
          px: [90, 90],
          world: [20, 20],
          pivot: [0.5, 0.9],
          flying: false,
          grip: null,
          owner: null,
        },
      ],
      fx: [
        {
          id: "spark",
          frames: ["fx/spark/0"],
          px: [[32, 32]],
          pivot: [0.5, 0.5],
          worldSize: 10,
          tintable: true,
        },
        {
          id: "smoke",
          frames: ["fx/smoke/0"],
          px: [[32, 32]],
          pivot: [0.5, 0.5],
          worldSize: 10,
          tintable: true,
        },
        {
          id: "ink",
          frames: ["fx/ink/0"],
          px: [[32, 32]],
          pivot: [0.5, 0.5],
          worldSize: 10,
          tintable: false,
        },
        {
          id: "gold",
          frames: ["fx/gold/0"],
          px: [[32, 32]],
          pivot: [0.5, 0.5],
          worldSize: 10,
          tintable: false,
        },
      ],
    },
  };
}
