/**
 * The Deck check's report (`pnpm deck:check`): each test's part (tests/deck/pad.ts Report)
 * merged into one JSON and one Markdown page. Text is judged by a capital's rendered height in
 * screen px at the Deck's 1280×800: under FAIL_PX fails, under WARN_PX warns. Canvas text is
 * not DOM and not measured.
 */

export const FAIL_PX = 9;
export const WARN_PX = 12;

export interface DeckText {
  screen: string;
  text: string;
  where: string;
  fontPx: number;
  capPx: number;
}

export interface DeckPart {
  name: string;
  reached: { screen: string; acts: number }[];
  findings: { screen: string; kind: string; detail: string }[];
  texts: DeckText[];
}

/** One row per text on a screen (the same words in the same place count once), smallest first. */
function dedupe(texts: readonly DeckText[]): DeckText[] {
  const seen = new Map<string, DeckText>();
  for (const t of texts) {
    const k = `${t.screen}|${t.text}|${t.where}`;
    const had = seen.get(k);
    if (had === undefined || t.capPx < had.capPx) seen.set(k, t);
  }
  return [...seen.values()].sort((a, b) => a.capPx - b.capPx);
}

const cell = (s: string) => s.replace(/\|/g, "\\|");

export function deckReport(
  parts: readonly DeckPart[],
  when: string,
): { json: unknown; md: string; summary: string } {
  const texts = dedupe(parts.flatMap((p) => p.texts));
  const fail = texts.filter((t) => t.capPx < FAIL_PX);
  const warn = texts.filter((t) => t.capPx >= FAIL_PX && t.capPx < WARN_PX);
  const findings = parts.flatMap((p) => p.findings.map((f) => ({ test: p.name, ...f })));
  const reached = parts.flatMap((p) => p.reached.map((r) => ({ test: p.name, ...r })));
  const rows = (ts: DeckText[]) =>
    ts.map(
      (t) => `| ${t.capPx} | ${t.fontPx} | ${cell(t.screen)} | ${cell(t.text)} | ${t.where} |`,
    );
  const md = [
    "# Steam Deck check",
    "",
    `${when} · \`pnpm deck:check\` · 1280×800, dpr 1, Chromium (the desktop shell's engine).`,
    "",
    `Text size is a capital's rendered height in screen px: fail under ${FAIL_PX}, warn under ${WARN_PX}.`,
    "",
    `- texts measured: ${texts.length} · under ${FAIL_PX} px: ${fail.length} · under ${WARN_PX} px: ${warn.length}`,
    `- findings: ${findings.length}`,
    "",
    "## Findings",
    "",
    "| test | screen | kind | detail |",
    "|---|---|---|---|",
    ...findings.map((f) => `| ${f.test} | ${cell(f.screen)} | ${f.kind} | ${cell(f.detail)} |`),
    "",
    "## Pad reach per screen",
    "",
    "| test | screen | controls reached |",
    "|---|---|---|",
    ...reached.map((r) => `| ${r.test} | ${cell(r.screen)} | ${r.acts} |`),
    "",
    `## Text under ${FAIL_PX} px (fail)`,
    "",
    "| cap px | font px | screen | text | where |",
    "|---|---|---|---|---|",
    ...rows(fail),
    "",
    `## Text under ${WARN_PX} px (warn)`,
    "",
    "| cap px | font px | screen | text | where |",
    "|---|---|---|---|---|",
    ...rows(warn),
    "",
  ].join("\n");
  const json = { when, failPx: FAIL_PX, warnPx: WARN_PX, findings, reached, fail, warn, texts };
  const summary = `deck check: ${findings.length} findings, ${fail.length} texts under ${FAIL_PX} px, ${warn.length} under ${WARN_PX} px`;
  return { json, md, summary };
}
