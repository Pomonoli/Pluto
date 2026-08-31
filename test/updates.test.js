'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'pluto-updates-'));
process.env.DATA_DIR=dataDir;

const updates=require('../src/updates');

test.after(() => {
  fs.rmSync(dataDir,{recursive:true,force:true});
});

test('current version has no unseen changes', () => {
  const changes=updates.changesSince(updates.APP_VERSION);
  assert.equal(updates.hasChanges(changes),false);
});

test('missed releases are grouped instead of shown as version history', () => {
  const changes=updates.changesSince('1.9.0');
  assert.deepEqual(changes.games,['Kingdomino','Cascadia']);
  assert.ok(changes.features.some((item) => item.includes('updatepopup')));
});

test('first guest visit establishes a silent baseline', () => {
  const payload=updates.payloadFor();
  assert.equal(payload.currentVersion,updates.APP_VERSION);
  assert.equal(updates.hasChanges(payload.changes),false);
});

test('guest with an older seen version gets only relevant grouped changes', () => {
  const payload=updates.payloadFor({since:'1.11.0'});
  assert.deepEqual(payload.changes.games,[]);
  assert.equal(payload.changes.features.length,1);
  assert.deepEqual(payload.changes.improvements,[]);
});
