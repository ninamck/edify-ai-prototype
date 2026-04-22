// Non-linear batch time lookup (spec §5.11). For each product we know
// roughly how many minutes a given batch size takes — batches scale
// sublinearly because of parallelism (e.g. one tray of muffins bakes
// the same minutes as two if both fit in the oven). Three data points per
// product; linear interpolation between them.

type Point = [quantity: number, minutes: number];

const TABLE: Record<string, Point[]> = {
  // Bakery — oven-bound, sublinear.
  'prd-banana-muffin':    [[12, 28], [36, 45], [72, 78]],
  'prd-blueberry-muffin': [[12, 26], [36, 42], [72, 72]],
  'prd-almond-friand':    [[12, 30], [36, 48], [72, 80]],
  'prd-choc-traybake':    [[6, 32], [18, 55], [36, 90]],

  // Savoury — assembly-bound, roughly linear.
  'prd-ham-croissant':    [[12, 22], [36, 55], [72, 105]],
  'prd-chicken-pesto':    [[12, 28], [36, 72], [72, 135]],
  'prd-vegan-slaw':       [[12, 22], [36, 58], [72, 110]],

  // Cold brew — dilution + filling, very sublinear once the tub's running.
  'prd-coldbrew-tub':     [[1, 18], [3, 30], [6, 45]],
};

export function getBatchMinutes(productId: string, quantity: number): number {
  const points = TABLE[productId];
  if (!points || quantity <= 0) return Math.ceil(quantity * 1.2); // fallback

  // Below lowest point: pro-rata from (0, 0) to first point.
  if (quantity <= points[0][0]) {
    return Math.round((quantity / points[0][0]) * points[0][1]);
  }

  // Within a segment: linear interpolation between adjacent points.
  for (let i = 1; i < points.length; i++) {
    const [q1, m1] = points[i - 1];
    const [q2, m2] = points[i];
    if (quantity <= q2) {
      const ratio = (quantity - q1) / (q2 - q1);
      return Math.round(m1 + ratio * (m2 - m1));
    }
  }

  // Above highest point: extrapolate at the last segment's slope.
  const [qa, ma] = points[points.length - 2];
  const [qb, mb] = points[points.length - 1];
  const slope = (mb - ma) / (qb - qa);
  return Math.round(mb + (quantity - qb) * slope);
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
