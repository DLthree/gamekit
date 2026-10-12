import type { Sprites } from "@/realtime/content/schema/sprites";

/**
 * Every sprite and fx frame the sprite manifest names is in the packed atlas. `readPublic` reads a
 * file under public/ (null when missing); content:check passes it.
 */
export function atlasProblems(
  sprites: Sprites,
  readPublic: (path: string) => string | null,
): string[] {
  const text = readPublic(sprites.atlas.json);
  if (text === null)
    return [`look/generated/sprites.json: public/${sprites.atlas.json} is missing`];
  const atlas = JSON.parse(text) as { frames: Record<string, unknown> };
  const frames = [...sprites.sprites.map((s) => s.frame), ...sprites.fx.flatMap((f) => f.frames)];
  return frames
    .filter((frame) => !Object.hasOwn(atlas.frames, frame))
    .map(
      (frame) =>
        `look/generated/sprites.json: frame ${frame} is not in public/${sprites.atlas.json}`,
    );
}
