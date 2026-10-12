import type { Push } from "@/content/check-tree";
import { BANDS } from "@/content/schema/look";
import type { Content } from "@/content/types";

/** Sprite roles drawn with the mesh bend; fodder stays flat, so a crowd costs one image each. */
const BENT_ROLES = new Set(["player", "elite", "boss"]);

export function checkLook(c: Content, push: Push): void {
  const {
    palette,
    fx,
    feedback,
    camera,
    controls,
    layers,
    sprites,
    creatures,
    sounds,
    soundManifest,
  } = c.look;
  const colour = (file: string, path: string, name: string) => {
    if (!Object.hasOwn(palette.colors, name)) push(file, path, `no palette colour ${name}`);
  };
  const kind = (file: string, path: string, name: string) => {
    if (!Object.hasOwn(fx.kinds, name)) push(file, path, `no fx kind ${name}`);
  };
  /** `mustLoop` is true only for a ground vfx's sound: everything else plays once. */
  const tuned = (file: string, path: string, id: string | null, mustLoop: boolean) => {
    if (id === null) return;
    const tuning = sounds.sounds[id];
    if (tuning === undefined) {
      push(file, path, `no sound ${id} in look/sounds.json`);
      return;
    }
    if (mustLoop && !tuning.loop)
      push(file, path, `sound ${id} does not loop; ground vfx need a loop`);
    if (!mustLoop && tuning.loop) push(file, path, `sound ${id} loops; only ground vfx may loop`);
  };
  const soundFiles = new Set(soundManifest.sounds.map((s) => s.id));
  for (const id of Object.keys(sounds.sounds)) {
    if (!soundFiles.has(id))
      push(
        "look/sounds.json",
        `sounds.${id}`,
        `not in look/generated/sounds.json; run pnpm sounds`,
      );
  }
  for (const id of soundFiles) {
    if (!Object.hasOwn(sounds.sounds, id))
      push("look/sounds.json", "sounds", `no tuning for ${id}`);
  }
  const textures = new Map(sprites.fx.map((t) => [t.id, t]));
  const spriteIds = new Set(sprites.sprites.map((s) => s.id));

  for (const [id, look] of Object.entries(c.look.characters.characters)) {
    const at = `characters.${id}`;
    if (!Object.hasOwn(c.sim.characters, id))
      push("look/characters.json", at, `no character ${id}`);
    colour("look/characters.json", `${at}.buildColor`, look.buildColor);
    const creature = creatures.creatures[look.creature];
    if (creature === undefined)
      push("look/characters.json", `${at}.creature`, `no creature ${look.creature}`);
    else if (sprites.sprites.find((s) => s.id === creature.sprite)?.role !== "player") {
      push(
        "look/characters.json",
        `${at}.creature`,
        `${look.creature} is not drawn with a player sprite`,
      );
    }
  }
  for (const id of Object.keys(c.sim.characters)) {
    if (!Object.hasOwn(c.look.characters.characters, id))
      push("look/characters.json", "characters", `no look for ${id}`);
  }
  for (const [id, creature] of Object.entries(creatures.creatures)) {
    if (!spriteIds.has(creature.sprite)) {
      push("look/creatures.json", `creatures.${id}.sprite`, `no sprite ${creature.sprite}`);
    }
    const role = sprites.sprites.find((s) => s.id === creature.sprite)?.role;
    if (creature.mesh !== null && role !== undefined && !BENT_ROLES.has(role)) {
      push(
        "look/creatures.json",
        `creatures.${id}.mesh`,
        `${id} is drawn as ${role}; only player, elite and boss creatures bend`,
      );
    }
    const prop = creature.prop;
    if (prop !== null) {
      const at = `creatures.${id}.prop`;
      const s = sprites.sprites.find((it) => it.id === prop.sprite);
      if (s === undefined) push("look/creatures.json", `${at}.sprite`, `no sprite ${prop.sprite}`);
      else if (s.role !== "prop")
        push("look/creatures.json", `${at}.sprite`, `${s.id} is not drawn as a prop`);
      if (creature.mesh === null)
        push(
          "look/creatures.json",
          at,
          "a prop is held at the mesh's hand; give the creature a mesh",
        );
    }
  }
  /** A tint is "build" or a palette colour; untintable textures (ink, gold) take only white. */
  const tint = (path: string, textureId: string, name: string) => {
    const texture = textures.get(textureId);
    if (texture !== undefined && !texture.tintable && name !== "white") {
      push("look/fx.json", path, `${textureId} is not tintable (black ink or gold): use white`);
    }
    if (name !== "build" && !Object.hasOwn(palette.colors, name)) {
      push("look/fx.json", path, "not build and not a palette colour");
    }
  };
  for (const [id, k] of Object.entries(fx.kinds)) {
    const texture = textures.get(k.texture);
    if (texture === undefined)
      push("look/fx.json", `kinds.${id}.texture`, `no fx texture ${k.texture}`);
    else if (k.variants !== null && k.variants > texture.frames.length)
      push(
        "look/fx.json",
        `kinds.${id}.variants`,
        `${k.texture} has ${texture.frames.length} frames`,
      );
    tint(`kinds.${id}.tint`, k.texture, k.tint);
  }
  for (const [id, v] of Object.entries(fx.vfx)) {
    const at = `vfx.${id}`;
    if (v.recipe !== "none") tuned("look/fx.json", `${at}.sound`, v.sound, v.recipe === "ground");
    if (v.recipe === "projectile") {
      const t = textures.get(v.head.texture);
      if (t === undefined)
        push("look/fx.json", `${at}.head.texture`, `no fx texture ${v.head.texture}`);
      else if (v.head.frame >= t.frames.length)
        push("look/fx.json", `${at}.head.frame`, `${v.head.texture} has ${t.frames.length} frames`);
      tint(`${at}.head.tint`, v.head.texture, v.head.tint);
      kind("look/fx.json", `${at}.trail.kind`, v.trail.kind);
      if (v.trail.flame !== null)
        kind("look/fx.json", `${at}.trail.flame.kind`, v.trail.flame.kind);
    } else if (v.recipe === "explosion") {
      kind("look/fx.json", `${at}.ring.kind`, v.ring.kind);
      kind("look/fx.json", `${at}.smoke.kind`, v.smoke.kind);
      if (v.shake !== null && !Object.hasOwn(feedback.shake, v.shake)) {
        push("look/fx.json", `${at}.shake`, `no shake ${v.shake} in look/feedback.json`);
      }
      if (v.scorch !== null) kind("look/fx.json", `${at}.scorch.kind`, v.scorch.kind);
    } else if (v.recipe === "ground") {
      kind("look/fx.json", `${at}.stains.kind`, v.stains.kind);
      kind("look/fx.json", `${at}.grass.kind`, v.grass.kind);
      kind("look/fx.json", `${at}.flames.kind`, v.flames.kind);
      kind("look/fx.json", `${at}.embers.kind`, v.embers.kind);
    } else if (v.recipe === "telegraph") {
      const ring = fx.kinds[v.resolve.kind];
      if (ring === undefined) kind("look/fx.json", `${at}.resolve.kind`, v.resolve.kind);
      else if (textures.get(ring.texture)?.tintable !== false || ring.tint !== "white") {
        push(
          "look/fx.json",
          `${at}.resolve.kind`,
          `${v.resolve.kind} must be ink: an untintable texture tinted white`,
        );
      }
      if (ring !== undefined && ring.band !== "telegraphs") {
        push(
          "look/fx.json",
          `${at}.resolve.kind`,
          `${v.resolve.kind} must draw in the telegraphs band`,
        );
      }
      if (v.resolve.shake !== null && !Object.hasOwn(feedback.shake, v.resolve.shake)) {
        push(
          "look/fx.json",
          `${at}.resolve.shake`,
          `no shake ${v.resolve.shake} in look/feedback.json`,
        );
      }
      tuned("look/fx.json", `${at}.resolve.sound`, v.resolve.sound, false);
    }
  }
  kind("look/fx.json", "hit.kind", fx.hit.kind);
  kind("look/fx.json", "death.splatter", fx.death.splatter);
  kind("look/fx.json", "death.puff", fx.death.puff);
  colour("look/feedback.json", "hitFlash.color", feedback.hitFlash.color);
  colour("look/feedback.json", "spawnWarning.color", feedback.spawnWarning.color);
  if (!Object.hasOwn(feedback.shake, feedback.playerHurtShake)) {
    push("look/feedback.json", "playerHurtShake", `no shake ${feedback.playerHurtShake}`);
  }
  if (!Object.hasOwn(feedback.shake, feedback.bigDeathShake)) {
    push("look/feedback.json", "bigDeathShake", `no shake ${feedback.bigDeathShake}`);
  }
  kind("look/feedback.json", "goldFlakes.kind", feedback.goldFlakes.kind);
  tuned("look/feedback.json", "sounds.hit", feedback.sounds.hit, false);
  tuned("look/feedback.json", "sounds.death", feedback.sounds.death, false);
  tuned("look/feedback.json", "sounds.playerHurt", feedback.sounds.playerHurt, false);
  tuned("look/feedback.json", "sounds.cast", feedback.sounds.cast, false);
  tuned("look/feedback.json", "sounds.bigDeath", feedback.sounds.bigDeath, false);
  colour("look/camera.json", "background", camera.background);
  colour("look/camera.json", "clearing.color", camera.clearing.color);
  colour("look/camera.json", "edge.color", camera.edge.color);
  colour("look/camera.json", "floor.color", camera.floor.color);
  colour("look/controls.json", "cancelColor", controls.cancelColor);
  colour("look/controls.json", "aim.color", controls.aim.color);
  colour("look/controls.json", "aim.cooldownColor", controls.aim.cooldownColor);
  if (controls.stickDeadZone >= controls.stickRadius) {
    push(
      "look/controls.json",
      "stickDeadZone",
      `must be less than stickRadius (${controls.stickRadius}); stickVector divides by their difference`,
    );
  }
  if (controls.knobRadius >= Math.min(controls.buttonRadius, controls.stickRadius)) {
    push(
      "look/controls.json",
      "knobRadius",
      `must be less than buttonRadius (${controls.buttonRadius}) and stickRadius (${controls.stickRadius})`,
    );
  }
  const unique = new Set(layers.bands);
  if (unique.size !== layers.bands.length || unique.size !== BANDS.length) {
    push("look/layers.json", "bands", `list each band exactly once: ${BANDS.join(", ")}`);
  }
}
