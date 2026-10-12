import { compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { KINDS, schemaRefFor } from "@/content/kinds";
import type { Content } from "@/content/types";
import { GAME_TEST_FILES } from "@/game/test-files";

/** path → replacement file (without `$schema`, which is inserted), or null to delete the file. */
export type FilePatch = Record<string, unknown>;

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

const BASE: Record<string, Record<string, unknown>> = {
  "characters/hero.json": {
    stats: { life: 100, moveSpeed: 100, radius: 10, knockbackResist: 0 },
    slots: [
      { id: "auto", activation: "auto" },
      { id: "cast", activation: "manual" },
    ],
  },
  "skills/zap.json": {
    tags: ["spell", "projectile", "fire"],
    activation: "auto",
    target: "nearest",
    stats: {
      damage: { fire: 5 },
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
    tags: ["spell", "projectile", "area", "fire"],
    activation: "manual",
    target: "aim",
    stats: {
      damage: { fire: 10 },
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
    tags: ["attack", "melee", "physical"],
    activation: "auto",
    target: "player",
    stats: { damage: { physical: 3 }, rate: 1, range: 20, area: 20, knockback: 0 },
    deliver: { do: "burst", shape: { kind: "arc", halfAngleDeg: 60 }, vfx: "none" },
  },
  "enemies/dummy.json": {
    role: "fodder",
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
    meshRoles: ["player", "elite", "boss"],
    creatures: {
      hero: { sprite: "hero", gait, mesh: null, prop: null },
      dummy: { sprite: "dummy", gait, mesh: null, prop: null },
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
    bigDeathRoles: ["elite", "boss"],
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
        role: "fodder",
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
  "look/sounds.json": {
    volume: 1,
    sounds: {
      tick: { cap: 2, minGapS: 0.05, volume: 0.5, pitch: 1, loop: false },
      chime: { cap: 2, minGapS: 0.05, volume: 0.5, pitch: 1, loop: false },
    },
  },
  "look/generated/sounds.json": {
    sounds: [
      { id: "tick", file: "sounds/tick.wav", lengthS: 0.1 },
      { id: "chime", file: "sounds/chime.wav", lengthS: 0.4 },
    ],
  },
};

function schemaNameFor(file: string): string {
  for (const kind of Object.values(KINDS)) {
    const owned = kind.collection
      ? file.startsWith(`${kind.path}/`) && !file.slice(kind.path.length + 1).includes("/")
      : file === `${kind.path}.json`;
    if (owned) return kind.schemaName;
  }
  throw new Error(`testFiles: ${file} is not a content kind`);
}

/** The base test files with `patch` applied; `$schema` is inserted where missing. */
export function testFiles(patch: FilePatch = {}): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  const merged: Record<string, unknown> = { ...BASE, ...GAME_TEST_FILES, ...patch };
  for (const [file, body] of Object.entries(merged)) {
    if (body === null) continue;
    if (typeof body !== "object") throw new Error(`testFiles: ${file} must be an object or null`);
    files[file] = { $schema: schemaRefFor(file, schemaNameFor(file)), ...body };
  }
  return files;
}

/** The same files as JSON texts, the form the loaders produce. */
export function testTexts(patch: FilePatch = {}): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const [file, body] of Object.entries(testFiles(patch))) texts[file] = JSON.stringify(body);
  return texts;
}

/** Compiled test content; invalid content throws with every error, file and field. */
export function testContent(patch: FilePatch = {}): Content {
  const r = compileContent(testFiles(patch));
  if (!r.ok) throw new Error(r.errors.map(formatContentError).join("\n"));
  return r.content;
}

/** The hero's auto zap with range 1, so it never fires and only the skill under test acts. */
export const quietZap: FilePatch = {
  "skills/zap.json": {
    tags: ["spell", "projectile", "fire"],
    activation: "auto",
    target: "nearest",
    stats: {
      damage: { fire: 5 },
      rate: 2,
      range: 1,
      projectileSpeed: 300,
      projectileCount: 1,
      spread: 0,
      knockback: 0,
    },
    deliver: { do: "projectile", multishot: "fan", impact: "damage", radius: 4, vfx: "zap" },
  },
};

/** A patch whose hero is bent (layer 2) and holds a "staff" prop (layer 3). */
export function meshFiles(): FilePatch {
  const creatures = structuredClone(testFiles()["look/creatures.json"]) as {
    creatures: Record<string, Record<string, unknown>>;
  };
  creatures.creatures.hero.mesh = {
    lean: 0.05,
    sway: 0.03,
    stride: 0.05,
    spread: 0.1,
    breath: 0.035,
    hip: 0.55,
  };
  creatures.creatures.hero.prop = {
    sprite: "staff",
    hand: [0.9, 0.5],
    restDeg: 12,
    scale: 1,
    thrustS: 0.4,
  };
  const sprites = structuredClone(testFiles()["look/generated/sprites.json"]) as {
    sprites: Record<string, unknown>[];
  };
  sprites.sprites.push({
    id: "staff",
    role: "prop",
    frame: "prop/staff",
    px: [20, 100],
    world: [4, 20],
    pivot: [0.5, 0.6],
    flying: false,
    grip: [0.5, 0.6],
    owner: "hero",
  });
  return { "look/creatures.json": creatures, "look/generated/sprites.json": sprites };
}

/** meshFiles plus a bent elite enemy, "lion", drawn with an elite sprite. */
export function eliteMeshFiles(): FilePatch {
  const files = meshFiles();
  const creatures = files["look/creatures.json"] as {
    creatures: Record<string, Record<string, unknown>>;
  };
  creatures.creatures.lion = {
    ...creatures.creatures.dummy,
    sprite: "lion",
    mesh: creatures.creatures.hero.mesh,
  };
  const sprites = files["look/generated/sprites.json"] as { sprites: Record<string, unknown>[] };
  sprites.sprites.push({
    ...sprites.sprites[1],
    id: "lion",
    role: "elite",
    frame: "creature/lion",
  });
  const lion = { ...BASE["enemies/dummy.json"], role: "elite", look: "lion" };
  return { ...files, "enemies/lion.json": lion };
}
