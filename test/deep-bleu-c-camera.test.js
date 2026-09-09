'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hexNeighbors } = require('../games/deep-bleu-c/hexmath');

const source = fs.readFileSync(path.join(__dirname, '../games/deep-bleu-c/hex-client.js'), 'utf8');
const math = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('vertical camera steps leave stationary world objects horizontally aligned', async () => {
  const { hexToViewport } = await math;
  for (const size of [18, 32]) {
    for (let cameraRow = 0; cameraRow < 140; cameraRow += 1) {
      for (const worldRow of [cameraRow, cameraRow + 1, cameraRow + 10]) {
        const before = hexToViewport(80, worldRow, 70, cameraRow, size);
        const below = hexToViewport(80, worldRow, 70, cameraRow + 1, size);
        assert.equal(before.x, below.x);
        near(below.y - before.y, -size * 1.5);
        const above = hexToViewport(80, worldRow, 70, cameraRow - 1, size);
        assert.equal(before.x, above.x);
      }
    }
  }
});

test('hex adjacency and coast directions stay consistent for both camera row parities', async () => {
  const { hexToPixel, hexToViewport } = await math;
  for (const cameraRow of [0, 1, 42, 43, 140]) {
    for (const row of [cameraRow + 5, cameraRow + 6]) {
      const center = hexToViewport(80, row, 70, cameraRow, 18);
      const worldCenter = hexToPixel(80, row, 18);
      for (const [x, y] of hexNeighbors(80, row)) {
        const neighbor = hexToViewport(x, y, 70, cameraRow, 18);
        const worldNeighbor = hexToPixel(x, y, 18);
        near(neighbor.x - center.x, worldNeighbor.x - worldCenter.x);
        near(neighbor.y - center.y, worldNeighbor.y - worldCenter.y);
        near(Math.hypot(neighbor.x - center.x, neighbor.y - center.y), 18 * Math.sqrt(3));
      }
    }
  }
});

test('horizontal camera steps translate the entire map by exactly one column', async () => {
  const { hexToViewport } = await math;
  for (const cameraRow of [0, 1, 40, 41]) {
    const before = hexToViewport(84, 48, 70, cameraRow, 18);
    const after = hexToViewport(84, 48, 71, cameraRow, 18);
    near(after.x - before.x, -18 * Math.sqrt(3));
    assert.equal(after.y, before.y);
  }
});
