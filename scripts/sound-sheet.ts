/**
 * pnpm sound-sheet: writes scratchpad/sound-sheet/index.html, a listening page with a player for
 * every sound in public/sounds/, its source and license from public/sounds/LICENSE.md, its tuning
 * from look/sounds.json and the level it plays at in the game (master × sound volume). The sounds
 * are embedded, so the page opens straight from disk.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LookSounds, SoundManifest, type SoundTuning } from "@/content/schema/sounds";

export interface LicenseRow {
  source: string;
  license: string;
}

export interface SheetRow {
  id: string;
  dataUri: string;
  lengthS: number;
  tuning: SoundTuning;
  level: number;
  credit: LicenseRow;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A LICENSE.md table's rows by file name: | file | source | original file | license |.
 * Throws on a sound row without four cells.
 */
export function licenseRows(md: string): Map<string, LicenseRow> {
  const out = new Map<string, LicenseRow>();
  for (const line of md.split("\n")) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length === 0 || !/\.(wav|ogg)$/.test(cells[0])) continue;
    if (cells.length !== 4) throw new Error(`LICENSE.md row for ${cells[0]} needs 4 cells`);
    out.set(cells[0], { source: cells[1], license: cells[3] });
  }
  return out;
}

/** The page: one table row per sound, a toggle between the file's level and the game's. */
export function sheetHtml(rows: readonly SheetRow[]): string {
  const body = rows
    .map(
      (r) => `<tr><th>${esc(r.id)}</th>
<td><audio controls preload="none"${r.tuning.loop ? " loop" : ""} data-level="${r.level.toFixed(3)}" src="${r.dataUri}"></audio></td>
<td>${r.lengthS.toFixed(2)} s${r.tuning.loop ? " · loops" : ""}</td>
<td>${r.level.toFixed(2)}</td><td>±${r.tuning.pitch} st</td><td>${r.tuning.cap} · ${r.tuning.minGapS} s</td>
<td>${esc(r.credit.source)} (${esc(r.credit.license)})</td></tr>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sound sheet</title>
<style>
:root { --paper: #efe6d2; --ink: #2a2118; --rule: #b9a98a; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --paper: #1d1914; --ink: #e8dcc4; --rule: #5a4e3c; } }
body { margin: 0 auto; padding: 16px; max-width: 80em; background: var(--paper); color: var(--ink); font: 16px/1.4 Georgia, serif; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid var(--rule); padding: 6px 8px; text-align: left; vertical-align: middle; }
td:last-child { font-size: 13px; overflow-wrap: anywhere; }
audio { width: 220px; max-width: 100%; }
@media (max-width: 640px) { td:nth-child(n+4), th:nth-child(n+4) { display: none; } }
</style></head><body>
<h1>Sound sheet</h1>
<p>Every sound, loudness-matched to -16 LUFS by scripts/build-sounds.sh. "Game level" is the
volume it plays at in the game: look/sounds.json's master volume × the sound's. Pitch varies
randomly per play by up to the semitones shown; cap is how many copies may overlap, then the
minimum gap between starts.</p>
<p><label><input type="checkbox" id="game-level" checked> Play at game level</label></p>
<table><thead><tr><th>id</th><th>listen</th><th>length</th><th>game level</th><th>pitch</th><th>cap · gap</th><th>source</th></tr></thead>
<tbody>
${body}
</tbody></table>
<script>
const box = document.getElementById("game-level");
const apply = () => { for (const a of document.querySelectorAll("audio")) a.volume = box.checked ? Number(a.dataset.level) : 1; };
box.addEventListener("change", apply);
apply();
</script>
</body></html>
`;
}

function main(): void {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const look = LookSounds.parse(JSON.parse(read("content/look/sounds.json")));
  const manifest = SoundManifest.parse(JSON.parse(read("content/look/generated/sounds.json")));
  const credits = licenseRows(read("public/sounds/LICENSE.md"));
  const rows = manifest.sounds.map((s): SheetRow => {
    const tuning = look.sounds[s.id];
    if (tuning === undefined) throw new Error(`no tuning for ${s.id} in look/sounds.json`);
    const name = s.file.slice("sounds/".length);
    const credit = credits.get(name);
    if (credit === undefined) throw new Error(`${name} has no row in public/sounds/LICENSE.md`);
    const wav = readFileSync(join(root, "public", s.file)).toString("base64");
    return {
      id: s.id,
      dataUri: `data:audio/wav;base64,${wav}`,
      lengthS: s.lengthS,
      tuning,
      level: look.volume * tuning.volume,
      credit,
    };
  });
  const dir = join(root, "scratchpad", "sound-sheet");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), sheetHtml(rows));
  console.log(`wrote scratchpad/sound-sheet/index.html (${rows.length} sounds)`);
}

if (import.meta.main) main();
