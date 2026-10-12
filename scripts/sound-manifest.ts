/**
 * pnpm sounds: writes content/look/generated/sounds.json from the WAV files in public/sounds/
 * (id = file name, lengthS read from the header). The files are CC0 recordings prepared by
 * scratchpad/sounds/build.sh; sources and licenses are in public/sounds/LICENSE.md.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** A PCM WAV's length in seconds, rounded to the millisecond; throws on anything else. */
export function wavLengthS(b: Buffer): number {
  if (
    b.length < 12 ||
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("not a RIFF/WAVE file");
  let byteRate: number | undefined;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") {
      if (b.readUInt16LE(at + 8) !== 1) throw new Error("not PCM");
      byteRate = b.readUInt32LE(at + 16);
    } else if (id === "data") {
      if (byteRate === undefined) throw new Error("data chunk before fmt chunk");
      return Math.round((size / byteRate) * 1000) / 1000;
    }
    at += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

function main(): void {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dir = join(root, "public", "sounds");
  const sounds = readdirSync(dir)
    .filter((f) => f.endsWith(".wav"))
    .sort()
    .map((f) => {
      const lengthS = wavLengthS(readFileSync(join(dir, f)));
      return { id: f.slice(0, -".wav".length), file: `sounds/${f}`, lengthS };
    });
  const manifest = { $schema: "../../schema/look-generated-sounds.schema.json", sounds };
  writeFileSync(
    join(root, "content", "look", "generated", "sounds.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`wrote ${sounds.length} sounds to content/look/generated/sounds.json`);
}

if (import.meta.main) main();
