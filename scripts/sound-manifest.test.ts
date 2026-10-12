import { wavLengthS } from "@scripts/sound-manifest";
import { describe, expect, it } from "vitest";

function chunk(id: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.write(id, 0, "ascii");
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}

function fmt(format: number, rate: number): Buffer {
  const b = Buffer.alloc(16);
  b.writeUInt16LE(format, 0);
  b.writeUInt16LE(1, 2);
  b.writeUInt32LE(rate, 4);
  b.writeUInt32LE(rate * 2, 8);
  b.writeUInt16LE(2, 12);
  b.writeUInt16LE(16, 14);
  return chunk("fmt ", b);
}

function riff(...chunks: Buffer[]): Buffer {
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(4 + chunks.reduce((n, c) => n + c.length, 0), 4);
  head.write("WAVE", 8, "ascii");
  return Buffer.concat([head, ...chunks]);
}

describe("wavLengthS", () => {
  it("reads a mono 16-bit PCM length from its data chunk", () => {
    expect(wavLengthS(riff(fmt(1, 1000), chunk("data", Buffer.alloc(500))))).toBe(0.25);
  });

  it("skips other chunks, including odd-sized ones with their pad byte", () => {
    const b = riff(chunk("LIST", Buffer.alloc(3)), fmt(1, 1000), chunk("data", Buffer.alloc(2000)));
    expect(wavLengthS(b)).toBe(1);
  });

  it("rounds to the millisecond", () => {
    expect(wavLengthS(riff(fmt(1, 44_100), chunk("data", Buffer.alloc(3))))).toBe(0);
    expect(wavLengthS(riff(fmt(1, 3000), chunk("data", Buffer.alloc(4))))).toBe(0.001);
  });

  it("rejects what it can't measure", () => {
    expect(() => wavLengthS(Buffer.from("OggS not a wav"))).toThrow("not a RIFF/WAVE file");
    expect(() => wavLengthS(riff(fmt(3, 1000), chunk("data", Buffer.alloc(8))))).toThrow("not PCM");
    expect(() => wavLengthS(riff(chunk("data", Buffer.alloc(8)), fmt(1, 1000)))).toThrow(
      "data chunk before fmt chunk",
    );
    expect(() => wavLengthS(riff(fmt(1, 1000)))).toThrow("no data chunk");
  });
});
