/**
 * Uniform-grid spatial hash over slot indices with fixed memory. Per tick:
 * reset() → insert() each item → build() → query any number of times. Cells hash into a
 * power-of-two bucket table and build() counting-sorts items by bucket, so nothing allocates.
 * Distinct cells colliding in one bucket only add candidates; queries filter by exact distance.
 */
export class SpatialHash {
  readonly cellSize: number;
  private readonly invCell: number;
  private readonly mask: number;
  private readonly bucketStart: Int32Array;
  private readonly bucketCount: Int32Array;
  private readonly itemSlot: Int32Array;
  private readonly itemX: Float32Array;
  private readonly itemY: Float32Array;
  private readonly itemBucket: Int32Array;
  private readonly sorted: Int32Array;
  /** Per bucket: the query number that last scanned it, so a bucket is scanned once per query. */
  private readonly bucketStamp: Int32Array;
  private stamp = 0;
  private count = 0;

  constructor(cellSize: number, capacity: number, bucketLog2 = 12) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
    const buckets = 1 << bucketLog2;
    this.mask = buckets - 1;
    this.bucketStart = new Int32Array(buckets + 1);
    this.bucketCount = new Int32Array(buckets);
    this.bucketStamp = new Int32Array(buckets);
    this.itemSlot = new Int32Array(capacity);
    this.itemX = new Float32Array(capacity);
    this.itemY = new Float32Array(capacity);
    this.itemBucket = new Int32Array(capacity);
    this.sorted = new Int32Array(capacity);
  }

  get size(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
    this.bucketCount.fill(0);
  }

  insert(slot: number, x: number, y: number): void {
    const i = this.count;
    if (i >= this.itemSlot.length) throw new Error("SpatialHash capacity exceeded");
    const b = this.bucketOf(Math.floor(x * this.invCell), Math.floor(y * this.invCell));
    this.itemSlot[i] = slot;
    this.itemX[i] = x;
    this.itemY[i] = y;
    this.itemBucket[i] = b;
    this.bucketCount[b] += 1;
    this.count = i + 1;
  }

  build(): void {
    const start = this.bucketStart;
    const counts = this.bucketCount;
    let running = 0;
    for (let b = 0; b < counts.length; b++) {
      start[b] = running;
      running += counts[b];
    }
    start[counts.length] = running;
    counts.fill(0);
    for (let i = 0; i < this.count; i++) {
      const b = this.itemBucket[i];
      this.sorted[start[b] + counts[b]] = i;
      counts[b] += 1;
    }
  }

  /** Writes slots within `r` of (x, y) into `out` (capped at its length); returns the count. */
  queryCircle(x: number, y: number, r: number, out: Int32Array): number {
    const inv = this.invCell;
    const minCx = Math.floor((x - r) * inv);
    const maxCx = Math.floor((x + r) * inv);
    const minCy = Math.floor((y - r) * inv);
    const maxCy = Math.floor((y + r) * inv);
    const r2 = r * r;
    this.stamp += 1;
    if (this.stamp === 0x7fffffff) {
      this.bucketStamp.fill(0);
      this.stamp = 1;
    }
    const stamp = this.stamp;
    let found = 0;
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const b = this.bucketOf(cx, cy);
        // Distinct cells can share a bucket; its items were all distance-tested the first time.
        if (this.bucketStamp[b] === stamp) continue;
        this.bucketStamp[b] = stamp;
        const end = this.bucketStart[b + 1];
        for (let k = this.bucketStart[b]; k < end; k++) {
          const i = this.sorted[k];
          const dx = this.itemX[i] - x;
          const dy = this.itemY[i] - y;
          if (dx * dx + dy * dy > r2) continue;
          if (found >= out.length) return found;
          out[found++] = this.itemSlot[i];
        }
      }
    }
    return found;
  }

  /**
   * The accepted slot nearest to (x, y) within `maxR`, or -1. Scans rings of cells outward and
   * stops once a ring can't hold anything closer than the best so far.
   */
  nearest(x: number, y: number, maxR: number, accept: (slot: number) => boolean): number {
    const cx = Math.floor(x * this.invCell);
    const cy = Math.floor(y * this.invCell);
    const rings = Math.ceil(maxR * this.invCell) + 1;
    const maxR2 = maxR * maxR;
    let best = -1;
    let bestD2 = maxR2;
    for (let k = 0; k <= rings; k++) {
      const ringMin = (k - 1) * this.cellSize;
      if (best !== -1 && ringMin > 0 && ringMin * ringMin > bestD2) break;
      for (let gy = cy - k; gy <= cy + k; gy++) {
        const edgeRow = gy === cy - k || gy === cy + k;
        const stepX = edgeRow || k === 0 ? 1 : 2 * k;
        for (let gx = cx - k; gx <= cx + k; gx += stepX) {
          const b = this.bucketOf(gx, gy);
          const end = this.bucketStart[b + 1];
          for (let n = this.bucketStart[b]; n < end; n++) {
            const i = this.sorted[n];
            const dx = this.itemX[i] - x;
            const dy = this.itemY[i] - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > maxR2) continue;
            if (best !== -1 && d2 >= bestD2) continue;
            const slot = this.itemSlot[i];
            if (!accept(slot)) continue;
            best = slot;
            bestD2 = d2;
          }
        }
      }
    }
    return best;
  }

  private bucketOf(cx: number, cy: number): number {
    return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & this.mask;
  }
}
