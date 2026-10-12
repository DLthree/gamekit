/** Frames slower than two 60 Hz frames count as long. */
const LONG_FRAME_MS = 1000 / 30;

export interface PerfSummary {
  frames: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
  longFrames: number;
  simMeanMs: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** A ring of recent frame and sim times; the caller supplies the clock. */
export class PerfMeter {
  private readonly frameMs: Float64Array;
  private readonly simMs: Float64Array;
  private count = 0;
  private head = 0;

  constructor(capacity: number) {
    this.frameMs = new Float64Array(capacity);
    this.simMs = new Float64Array(capacity);
  }

  frame(frameMs: number, simMs: number): void {
    this.frameMs[this.head] = frameMs;
    this.simMs[this.head] = simMs;
    this.head = (this.head + 1) % this.frameMs.length;
    this.count = Math.min(this.count + 1, this.frameMs.length);
  }

  summary(): PerfSummary {
    const n = this.count;
    if (n === 0) return { frames: 0, meanMs: 0, p95Ms: 0, maxMs: 0, longFrames: 0, simMeanMs: 0 };
    const frames = Array.from(this.frameMs.subarray(0, n)).sort((a, b) => a - b);
    let total = 0;
    let sim = 0;
    let long = 0;
    for (let i = 0; i < n; i++) {
      total += this.frameMs[i];
      sim += this.simMs[i];
      if (this.frameMs[i] > LONG_FRAME_MS) long += 1;
    }
    return {
      frames: n,
      meanMs: round1(total / n),
      p95Ms: round1(frames[Math.min(n - 1, Math.floor(n * 0.95))]),
      maxMs: round1(frames[n - 1]),
      longFrames: long,
      simMeanMs: round1(sim / n),
    };
  }

  reset(): void {
    this.count = 0;
    this.head = 0;
  }
}
