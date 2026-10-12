import { isKind, type Kind, type KindTree, kind } from "@/content/kind";
import { LookSounds, SoundManifest } from "@/content/schema/sounds";
import { GAME_KINDS } from "@/game/content";

/**
 * The kit's own content kinds: how sounds play and the generated sound manifest. The game's
 * (`GAME_KINDS`, src/game/content.ts) sit beside them: `sim` is what the rules read, `look` is
 * presentation only, so a look edit never restarts a run.
 */
export const KIT_KINDS = {
  look: {
    sounds: kind("look/sounds", "look-sounds", LookSounds, false),
    soundManifest: kind("look/generated/sounds", "look-generated-sounds", SoundManifest, false),
  },
} satisfies { look: KindTree };

function flatten(tree: KindTree): Kind<unknown>[] {
  return Object.values(tree).flatMap((node) => (isKind(node) ? [node] : flatten(node)));
}

for (const key of Object.keys(KIT_KINDS.look)) {
  if (Object.hasOwn(GAME_KINDS.look, key))
    throw new Error(`GAME_KINDS.look.${key} is a kit kind (src/content/kinds.ts)`);
}

/** Every content kind, the game's and the kit's. */
export const KINDS: readonly Kind<unknown>[] = [
  ...flatten(GAME_KINDS.sim),
  ...flatten(GAME_KINDS.look),
  ...flatten(KIT_KINDS.look),
];

/**
 * The look keys of generated asset manifests (`look/generated/*`): a change needs a page reload
 * to load the new files.
 */
export const GENERATED_LOOK_KEYS: readonly string[] = Object.entries({
  ...GAME_KINDS.look,
  ...KIT_KINDS.look,
}).flatMap(([key, node]) => (isKind(node) && node.path.startsWith("look/generated/") ? [key] : []));

/** The `$schema` a file must carry: relative from the file's folder to content/schema/. */
export function schemaRefFor(file: string, schemaName: string): string {
  const depth = file.split("/").length - 1;
  return `${"../".repeat(depth)}schema/${schemaName}.schema.json`;
}
