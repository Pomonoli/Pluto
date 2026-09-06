'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { NPC_FIRST_NAMES, chooseNpcName } = require('../src/npc-names');

test('NPC-name pool contains varied real first names', () => {
  assert.ok(NPC_FIRST_NAMES.length >= 50);
  assert.ok(NPC_FIRST_NAMES.includes('Amélie'));
  assert.ok(NPC_FIRST_NAMES.includes('Bram'));
  assert.ok(NPC_FIRST_NAMES.includes('Alessandro'));
});

test('NPC-name selection avoids names already used in a room when possible', () => {
  const selected = chooseNpcName([{ name: 'Amélie' }], () => 0);
  assert.equal(selected, 'Arthur');
});
