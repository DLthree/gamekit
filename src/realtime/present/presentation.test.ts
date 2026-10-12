import { describe, expect, it } from "vitest";
import { nextFloat } from "@/core/rng";
import { createPresentation } from "@/realtime/present/presentation";
import { testContent } from "@/test/content";

describe("createPresentation", () => {
  it("gives shakes and sound their own streams, so neither shifts the effects", () => {
    const p = createPresentation(testContent(), 7);
    const fx = p.em.rng.state;
    nextFloat(p.shakeRng);
    nextFloat(p.sound.rng);
    expect(p.em.rng.state).toBe(fx);
    expect(new Set([p.em.rng.state, p.shakeRng.state, p.sound.rng.state]).size).toBe(3);
  });
});
