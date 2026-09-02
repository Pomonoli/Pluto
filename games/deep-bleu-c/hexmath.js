'use strict';

// Pointy-top hexagons, "odd-r" horizontal offset layout: tiles stay stored in
// the existing flat row-major `tiles[y*WIDTH+x]` array (row=y, col=x), only
// neighbor/distance math changes vs. the old 4-directional square grid.
// Keep in sync with hex-client.js (browser copy of the distance/axial math).

const EVEN_OFFSETS = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD_OFFSETS = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const AXIAL_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

function hexNeighbors(col, row) {
  const offsets = (row & 1) ? ODD_OFFSETS : EVEN_OFFSETS;
  return offsets.map(([dx, dy]) => [col + dx, row + dy]);
}

function offsetToAxial(col, row) {
  return { q: col - ((row - (row & 1)) >> 1), r: row };
}

function axialToOffset(q, r) {
  return [q + ((r - (r & 1)) >> 1), r];
}

function hexDistance(x1, y1, x2, y2) {
  const a = offsetToAxial(x1, y1), b = offsetToAxial(x2, y2);
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

function hexRing(centerCol, centerRow, radius) {
  if (radius <= 0) return [[centerCol, centerRow]];
  const c = offsetToAxial(centerCol, centerRow);
  let q = c.q + AXIAL_DIRS[4][0] * radius, r = c.r + AXIAL_DIRS[4][1] * radius;
  const out = [];
  for (let side = 0; side < 6; side += 1) {
    for (let step = 0; step < radius; step += 1) {
      out.push(axialToOffset(q, r));
      q += AXIAL_DIRS[side][0];
      r += AXIAL_DIRS[side][1];
    }
  }
  return out;
}

module.exports = { hexNeighbors, offsetToAxial, axialToOffset, hexDistance, hexRing };
