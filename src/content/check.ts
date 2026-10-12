import type { ContentError, Push } from "@/content/errors";
import type { Content } from "@/content/types";
import { checkGame, checkGameResolved } from "@/game/check";

/** Every sound file has a tuning and every tuning a file. */
function checkSounds(c: Content, push: Push): void {
  const { sounds, soundManifest } = c.look;
  const files = new Set(soundManifest.sounds.map((s) => s.id));
  for (const id of Object.keys(sounds.sounds)) {
    if (!files.has(id))
      push(
        "look/sounds.json",
        `sounds.${id}`,
        "not in look/generated/sounds.json; run pnpm sounds",
      );
  }
  for (const id of files) {
    if (!Object.hasOwn(sounds.sounds, id))
      push("look/sounds.json", "sounds", `no tuning for ${id}`);
  }
}

/** Rules that span files, the kit's and then the game's. Every error is collected, not just the first. */
export function checkContent(c: Content): ContentError[] {
  const errors: ContentError[] = [];
  const push: Push = (file, path, message) => {
    errors.push({ file, path, message });
  };
  checkSounds(c, push);
  checkGame(c, push);
  // The game's checks that resolve its numbers, so only once the rest holds.
  if (errors.length === 0) checkGameResolved(c, push);
  return errors;
}
