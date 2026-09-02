// Browser-side hex math for The Deep Bleu C. Pointy-top hexagons, "odd-r"
// horizontal offset layout — keep the distance/axial math in sync with
// hexmath.js (the server-side CommonJS copy); duplicated deliberately since a
// browser ES module can't `require()` a CJS file.

export function offsetToAxial(col, row) {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

export function hexDistance(x1, y1, x2, y2) {
  const a = offsetToAxial(x1, y1), b = offsetToAxial(x2, y2);
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function hexToPixel(col, row, size) {
  return {
    x: size * Math.sqrt(3) * (col + 0.5 * (row & 1)),
    y: size * 1.5 * row
  };
}

export function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}
