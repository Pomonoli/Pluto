const test = require('node:test');
const assert = require('node:assert/strict');
const { getMoves } = require('../src/hofslag');

test('Hofslag: hoogste beweegt volledig, lagere één minder', () => {
  assert.deepEqual(getMoves([9, 7, 3]), [9, 6, 2]);
});

test('Hofslag: Aas verlaagt hogere kaarten', () => {
  assert.deepEqual(getMoves([9, 7, 1]), [8, 6, 1]);
});

test('Hofslag: gelijke hoogste bewegen normaal', () => {
  assert.deepEqual(getMoves([9, 9, 3]), [9, 9, 2]);
});
