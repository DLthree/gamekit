import { describe, expect, it } from "vitest";
import { Palette } from "@/realtime/content/schema/look";
import { LookFx } from "@/realtime/content/schema/look-fx";

const kind = {
  texture: "smoke",
  variants: null,
  cap: 10,
  evict: false,
  band: "fx",
  tint: "smoke",
  life: 0.4,
  growS: 0.4,
  scaleFrom: 0.5,
  scaleTo: 1.3,
  popS: 0.04,
  fadeFrom: 0.35,
  alpha: 0.8,
  drag: 4,
  rise: 10,
  flicker: 0,
  flickerHz: 0,
  sway: null,
};

describe("look schemas", () => {
  it("palette colours are lowercase #rrggbb under kebab-case names", () => {
    expect(Palette.safeParse({ $schema: "x", colors: { "hero-red": "#e52b0a" } }).success).toBe(
      true,
    );
    expect(Palette.safeParse({ $schema: "x", colors: { red: "red" } }).success).toBe(false);
    expect(Palette.safeParse({ $schema: "x", colors: { wizardRed: "#e52b0a" } }).success).toBe(
      false,
    );
  });

  it("vfx entries are a union on recipe", () => {
    const fx = LookFx.parse({
      $schema: "x",
      capacity: 100,
      kinds: { trail: kind },
      vfx: {
        none: { recipe: "none" },
        blast: {
          recipe: "explosion",
          ring: { kind: "trail", scale: 0.6 },
          smoke: { kind: "trail", count: 1, size: 12, delayS: 0.08, everyS: 0.06 },
          shake: null,
          scorch: null,
          sound: null,
        },
      },
      hit: { kind: "trail", size: 16 },
      death: { splatter: "trail", splatterSize: 30, puff: "trail", puffSize: 26 },
    });
    expect(fx.vfx.blast.recipe).toBe("explosion");
    expect(
      LookFx.safeParse({ ...fx, vfx: { bad: { recipe: "sparkles" } }, $schema: "x" }).success,
    ).toBe(false);
  });
});
