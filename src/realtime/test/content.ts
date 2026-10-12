import { DMG_A, ROLE_B, TAG_A } from "@/realtime/test/vocab";
import { type FilePatch, testFiles } from "@/test/content";

/** The hero's auto zap with range 1, so it never fires and only the skill under test acts. */
export const quietZap: FilePatch = {
  "skills/zap.json": {
    tags: [TAG_A, DMG_A],
    activation: "auto",
    target: "nearest",
    stats: {
      damage: { [DMG_A]: 5 },
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

/** A patch whose hero holds a "staff" prop (layer 3) at its bent hand. */
export function staffFiles(): FilePatch {
  const creatures = structuredClone(testFiles()["look/creatures.json"]) as {
    creatures: Record<string, Record<string, unknown>>;
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

/** staffFiles plus a ROLE_B enemy, "brute", drawn with a ROLE_B sprite. */
export function bruteFiles(): FilePatch {
  const files = staffFiles();
  const creatures = files["look/creatures.json"] as {
    creatures: Record<string, Record<string, unknown>>;
  };
  creatures.creatures.brute = {
    ...creatures.creatures.dummy,
    sprite: "brute",
  };
  const sprites = files["look/generated/sprites.json"] as { sprites: Record<string, unknown>[] };
  sprites.sprites.push({
    ...sprites.sprites[1],
    id: "brute",
    role: ROLE_B,
    frame: "creature/brute",
  });
  const dummy = structuredClone(testFiles()["enemies/dummy.json"]) as Record<string, unknown>;
  const brute = { ...dummy, role: ROLE_B, look: "brute" };
  return { ...files, "enemies/brute.json": brute };
}
