import { describe, expect, it } from "vitest";
import { compileContent } from "@/content/compile";
import { formatContentError } from "@/content/errors";
import { testFiles } from "@/realtime/test/content";
import type { FilePatch } from "@/test/content";

function errs(patch: FilePatch): string[] {
  const r = compileContent(testFiles(patch));
  return r.ok ? [] : r.errors.map(formatContentError);
}

function base<T>(file: string): T {
  return structuredClone(testFiles()[file]) as T;
}

/** The dummy's nibble as a burst with these fields. */
function nibble(node: Record<string, unknown>): FilePatch {
  const skill = base<{ deliver: Record<string, unknown> }>("skills/nibble.json");
  skill.deliver = { ...skill.deliver, ...node };
  return { "skills/nibble.json": skill };
}

type Fx = { kinds: Record<string, Record<string, unknown>> };

describe("checkContent: telegraphs", () => {
  it("accepts a warned circle or lane burst drawn by a telegraph", () => {
    expect(errs(nibble({ shape: { kind: "circle" }, warn: 0.5, vfx: "mark" }))).toEqual([]);
    expect(errs(nibble({ shape: { kind: "lane" }, warn: 0.5, vfx: "mark" }))).toEqual([]);
  });

  it("draws a warned burst only with a telegraph vfx", () => {
    expect(errs(nibble({ shape: { kind: "circle" }, warn: 0.5, vfx: "blast" }))).toContain(
      "skills/nibble.json › deliver.vfx: blast is an explosion recipe; a warned burst needs telegraph",
    );
  });

  it("keeps telegraph vfx for warned bursts", () => {
    expect(errs(nibble({ shape: { kind: "circle" }, vfx: "mark" }))).toContain(
      "skills/nibble.json › deliver.vfx: mark is a telegraph recipe; a burst needs explosion or none",
    );
  });

  it("does not warn an arc: telegraphs draw circles and lanes", () => {
    expect(errs(nibble({ warn: 0.5, vfx: "mark" }))).toContain(
      "skills/nibble.json › deliver.shape: a warned burst is a circle or a lane",
    );
  });

  it("rejects a telegraph resolve kind with a non-white tint", () => {
    const fx = base<Fx>("look/fx.json");
    fx.kinds.ring = { ...fx.kinds.ring, texture: "smoke", tint: "ink" };
    expect(errs({ "look/fx.json": fx })).toContain(
      "look/fx.json › vfx.mark.resolve.kind: ring must be ink: an untintable texture tinted white",
    );
  });

  it("rejects a telegraph resolve kind, shake or sound that does not exist", () => {
    const fx = base<{ vfx: Record<string, { resolve: Record<string, unknown> }> }>("look/fx.json");
    fx.vfx.mark.resolve = { kind: "nope", scale: 1, shake: "nope", sound: "nope" };
    const e = errs({ "look/fx.json": fx });
    expect(e).toContain("look/fx.json › vfx.mark.resolve.kind: no fx kind nope");
    expect(e).toContain(
      "look/fx.json › vfx.mark.resolve.shake: no shake nope in look/feedback.json",
    );
    expect(e).toContain("look/fx.json › vfx.mark.resolve.sound: no sound nope in look/sounds.json");
  });

  it("keeps warned bursts off player skills: telegraphs are enemy-only", () => {
    const boom = base<{ deliver: { onEnd: Record<string, unknown>[] } }>("skills/boom.json");
    boom.deliver.onEnd[0] = { ...boom.deliver.onEnd[0], warn: 0.5, vfx: "mark" };
    expect(errs({ "skills/boom.json": boom })).toContain(
      "builds/hero.json › tiers.0.loadout.cast: boom has a warned burst; telegraphs are enemy-only",
    );
  });

  it("keeps the resolve ring in the telegraphs band, above build effects", () => {
    const fx = base<Fx>("look/fx.json");
    fx.kinds.ring = { ...fx.kinds.ring, band: "ground" };
    expect(errs({ "look/fx.json": fx })).toContain(
      "look/fx.json › vfx.mark.resolve.kind: ring must draw in the telegraphs band",
    );
  });
});
