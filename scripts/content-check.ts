/**
 * pnpm content:check   compile content/, check the JSON Schemas are current, every sound file
 *                      matches the sound manifest and the game's files (`checkGameFiles`: the
 *                      example's atlas frames); print every problem; exit 1 if any.
 * pnpm content:schema  (re)write content/schema/*.schema.json from the Zod schemas.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { wavLengthS } from "@scripts/sound-manifest";
import { z } from "zod";
import { formatContentError } from "@/content/errors";
import { KINDS } from "@/content/kinds";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { checkGameFiles } from "@/game/check";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIR = join(REPO_CONTENT_DIR, "schema");

function schemaTexts(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const kind of Object.values(KINDS)) {
    const schema = z.toJSONSchema(kind.schema, { io: "input", unrepresentable: "any" });
    out[`${kind.schemaName}.schema.json`] = `${JSON.stringify(schema, null, 2)}\n`;
  }
  return out;
}

if (process.argv.includes("--write-schemas")) {
  mkdirSync(SCHEMA_DIR, { recursive: true });
  for (const [name, text] of Object.entries(schemaTexts()))
    writeFileSync(join(SCHEMA_DIR, name), text);
  console.log(`wrote ${Object.keys(schemaTexts()).length} JSON Schemas to content/schema/`);
  process.exit(0);
}

const problems: string[] = [];
const expected = schemaTexts();
for (const [name, text] of Object.entries(expected)) {
  const path = join(SCHEMA_DIR, name);
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) {
    problems.push(`schema/${name}: stale or missing, run pnpm content:schema`);
  }
}
for (const name of existsSync(SCHEMA_DIR) ? readdirSync(SCHEMA_DIR) : []) {
  if (!Object.hasOwn(expected, name)) problems.push(`schema/${name}: no content kind uses it`);
}

const r = loadContentDir(REPO_CONTENT_DIR, []);
if (!r.ok) {
  problems.push(...r.errors.map(formatContentError));
} else {
  const readPublic = (path: string) => {
    const file = join(ROOT, "public", path);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  };
  problems.push(...checkGameFiles(r.content, readPublic));
  for (const s of r.content.look.soundManifest.sounds) {
    const path = join(ROOT, "public", s.file);
    if (!existsSync(path)) {
      problems.push(`look/generated/sounds.json: public/${s.file} is missing; run pnpm sounds`);
    } else if (wavLengthS(readFileSync(path)) !== s.lengthS) {
      problems.push(`look/generated/sounds.json: ${s.id}'s lengthS is stale; run pnpm sounds`);
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error(`content check: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("content check: ok");
