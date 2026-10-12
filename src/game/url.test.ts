import { describe, expect, it } from "vitest";
import type { Flow } from "@/game/flow";
import { BOT, CAST_SKILL, HERO, STAGE, SWITCH } from "@/game/links";
import { parseUrl, reproUrl, urlFor } from "@/game/url";
import { TEST_SCENARIO } from "@/realtime/test/world";

describe("parseUrl", () => {
  it("reads a cell with seed, overrides and options", () => {
    const r = parseUrl(
      `?char=${HERO}&build=1&threat=1&seed=9&o=skills/${CAST_SKILL}.stats.area=55&o=rules/feel.hitStopS=0&aim=relative&bot=${BOT}&manual=1&ui=0&dpr=2&hot=keep&on=${SWITCH}`,
    );
    expect(r.errors).toEqual([]);
    expect(r.target).toEqual({
      screen: "cell",
      cell: { character: HERO, buildTier: 1, threatTier: 1 },
    });
    expect(r.seed).toBe(9);
    expect(r.overrides).toEqual([`skills/${CAST_SKILL}.stats.area=55`, "rules/feel.hitStopS=0"]);
    expect(r.options).toEqual({
      bot: BOT,
      manual: true,
      agent: false,
      ui: false,
      aim: "relative",
      dpr: 2,
      telemetry: null,
      hot: "keep",
      dev: false,
      on: [SWITCH],
    });
  });

  it("refuses an unknown switch, naming the known ones", () => {
    const r = parseUrl(`?char=${HERO}&build=1&threat=1&on=${SWITCH},nope`);
    expect(r.target).toBeNull();
    expect(r.errors).toEqual([`on=${SWITCH},nope: no switch "nope"; expected ${SWITCH}`]);
  });

  it("defaults options and leaves the seed unset (a random one per run)", () => {
    const r = parseUrl(`?char=${HERO}&build=1&threat=1`);
    expect(r.seed).toBeNull();
    expect(r.options).toMatchObject({
      bot: null,
      manual: false,
      ui: true,
      aim: "relative",
      hot: "restart",
    });
  });

  it("opens the grid without a cell: every character, or the one named", () => {
    expect(parseUrl("")).toMatchObject({
      target: { screen: "picker", character: null },
      errors: [],
    });
    expect(parseUrl(`?char=${HERO}&bot=${BOT}`).target).toEqual({
      screen: "picker",
      character: HERO,
    });
  });

  it("names every bad or missing parameter", () => {
    const r = parseUrl(`?char=${HERO}&build=x&aim=sideways&bot=dodge`);
    expect(r.target).toBeNull();
    expect(r.errors).toEqual([
      "build=x: expected a whole number from 1",
      "threat is missing",
      `bot=dodge: expected ${BOT}`,
      "aim=sideways: expected absolute or relative",
    ]);
    expect(parseUrl("?build=2&threat=1").errors).toEqual(["char is missing"]);
  });
});

describe("urlFor", () => {
  const wave: Flow = { screen: "wave", scenario: TEST_SCENARIO, run: 3, paused: false };

  it("writes the cell first and keeps every other parameter", () => {
    expect(urlFor(wave, `?bot=${BOT}&char=x&build=9&threat=9&seed=4&o=a.b=1`)).toBe(
      `/?char=hero&build=1&threat=1&bot=${BOT}&seed=4&o=a.b%3D1`,
    );
  });

  it("gives the grid its character or none", () => {
    expect(
      urlFor({ screen: "picker", character: "hero" }, "?char=x&build=1&threat=1&aim=relative"),
    ).toBe("/?char=hero&aim=relative");
    expect(urlFor({ screen: "picker", character: null }, "?char=x&build=1&threat=1")).toBe("/");
  });

  it("keeps an error at the address it interrupted, and leaves a bad address alone", () => {
    const error = { screen: "error" as const, title: "t", lines: [] as string[] };
    expect(urlFor({ ...error, scenario: TEST_SCENARIO, picker: null }, "")).toBe(
      "/?char=hero&build=1&threat=1",
    );
    expect(urlFor({ ...error, scenario: null, picker: { character: null } }, "?o=x")).toBe("/?o=x");
    expect(urlFor({ ...error, scenario: null, picker: null }, "?build=x")).toBeNull();
    expect(urlFor({ screen: "boot" }, "")).toBeNull();
  });
});

describe("stage addresses", () => {
  it("open a stage with dev=1", () => {
    const r = parseUrl(`?stage=${STAGE}&dev=1&seed=3`);
    expect(r.errors).toEqual([]);
    expect(r.target).toEqual({ screen: "stage", stage: STAGE });
  });

  it("need dev=1, and no cell beside them", () => {
    expect(parseUrl(`?stage=${STAGE}`).errors).toEqual([
      `stage=${STAGE} needs dev=1: stages are developer benches`,
    ]);
    expect(parseUrl(`?stage=${STAGE}&dev=1&char=${HERO}&build=1&threat=1`).errors).toEqual([
      `stage=${STAGE} opens a bench: drop char, build and threat`,
    ]);
  });

  it("replay as the stage, not its cell", () => {
    const r = parseUrl(`?stage=${STAGE}&dev=1`);
    const scenario = { ...TEST_SCENARIO, stage: STAGE, seed: 5 };
    expect(reproUrl(scenario, r.options)).toBe(`/?stage=${STAGE}&seed=5&aim=relative&dev=1`);
    const wave: Flow = { screen: "wave", scenario, run: 1, paused: false };
    expect(urlFor(wave, `?stage=${STAGE}&dev=1&seed=5`)).toBe(`/?stage=${STAGE}&dev=1&seed=5`);
  });
});

describe("the release build's addresses", () => {
  it("refuse every dev parameter, by name", () => {
    const r = parseUrl(
      `?char=${HERO}&build=1&threat=1&dev=1&bot=${BOT}&manual=1&agent=1&telemetry=1&o=x&on=${SWITCH}&hot=keep&ui=0&dpr=2`,
      "release",
    );
    expect(r.target).toBeNull();
    expect(r.errors).toEqual(
      ["dev", "bot", "manual", "agent", "telemetry", "o", "on", "hot", "ui", "dpr"].map(
        (k) => `${k}: not in this build`,
      ),
    );
  });

  it("refuse a stage", () => {
    expect(parseUrl(`?stage=${STAGE}`, "release").errors).toEqual(["stage: not in this build"]);
  });

  it("still open a cell with a seed", () => {
    const r = parseUrl(`?char=${HERO}&build=2&threat=1&seed=4`, "release");
    expect(r.errors).toEqual([]);
    expect(r.seed).toBe(4);
  });
});

describe("reproUrl", () => {
  it("round-trips the scenario and the options that shape play", () => {
    const search = `?char=${HERO}&build=2&threat=1&seed=123&o=skills/${CAST_SKILL}.stats.area=55&aim=absolute&bot=${BOT}&manual=1&agent=1&ui=0&dpr=2&hot=keep&dev=1&on=${SWITCH}&telemetry=1`;
    const r = parseUrl(search);
    if (r.target?.screen !== "cell" || r.seed === null) throw new Error("expected a seeded cell");
    const scenario = { ...r.target.cell, seed: r.seed, overrides: r.overrides };
    const again = parseUrl(reproUrl(scenario, r.options).slice(1));
    expect(again.errors).toEqual([]);
    expect(again.target).toEqual(r.target);
    expect(again.seed).toBe(123);
    expect(again.overrides).toEqual(r.overrides);
    expect(again.options).toEqual({ ...r.options, telemetry: null });
  });

  it("always names the aim mode and the seed", () => {
    const { options } = parseUrl("");
    expect(reproUrl({ ...TEST_SCENARIO, seed: 42 }, options)).toBe(
      "/?char=hero&build=1&threat=1&seed=42&aim=relative",
    );
  });
});
