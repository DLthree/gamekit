/** Does a body at (tx, ty) with radius tr touch the circle (cx, cy, r)? */
export function inCircle(
  cx: number,
  cy: number,
  r: number,
  tx: number,
  ty: number,
  tr: number,
): boolean {
  const dx = tx - cx;
  const dy = ty - cy;
  const reach = r + tr;
  return dx * dx + dy * dy <= reach * reach;
}

/**
 * Does a body touch the arc of radius r around (dirX, dirY) (unit) spanning ±halfAngle?
 * A body overlapping the arc's centre is always inside.
 */
export function inArc(
  cx: number,
  cy: number,
  r: number,
  dirX: number,
  dirY: number,
  halfAngle: number,
  tx: number,
  ty: number,
  tr: number,
): boolean {
  if (!inCircle(cx, cy, r, tx, ty, tr)) return false;
  const dx = tx - cx;
  const dy = ty - cy;
  const d = Math.hypot(dx, dy);
  if (d <= tr) return true;
  const cos = (dx * dirX + dy * dirY) / d;
  return cos >= Math.cos(halfAngle);
}

/**
 * Does a body touch the lane (a capsule) from (x, y) along (dirX, dirY) (unit) for `length`,
 * with round caps of radius halfWidth at both ends?
 */
export function inLane(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  length: number,
  halfWidth: number,
  tx: number,
  ty: number,
  tr: number,
): boolean {
  const along = (tx - x) * dirX + (ty - y) * dirY;
  const s = along < 0 ? 0 : along > length ? length : along;
  return inCircle(x + dirX * s, y + dirY * s, halfWidth, tx, ty, tr);
}
