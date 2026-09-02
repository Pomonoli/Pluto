'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dataDir=fs.mkdtempSync(path.join(__dirname,'tmp-updates-'));
process.env.DATA_DIR=dataDir;

const updates=require('../src/updates');

test.after(() => {
  require('../src/db').db.close();
  fs.rmSync(dataDir,{recursive:true,force:true,maxRetries:3,retryDelay:50});
});

test('current version has no unseen changes', () => {
  const changes=updates.changesSince(updates.APP_VERSION);
  assert.equal(updates.hasChanges(changes),false);
});

test('missed releases are grouped instead of shown as version history', () => {
  const changes=updates.changesSince('1.9.0');
  assert.deepEqual(changes.games,['Kingdomino','Cascadia','Isle of Skye','The Deep Bleu C','CycClub']);
  assert.ok(changes.features.some((item) => item.includes('updatepopup')));
});

test('first guest visit establishes a silent baseline', () => {
  const payload=updates.payloadFor();
  assert.equal(payload.currentVersion,updates.APP_VERSION);
  assert.equal(updates.hasChanges(payload.changes),false);
});

test('guest with an older seen version gets only relevant grouped changes', () => {
  const payload=updates.payloadFor({since:'1.11.0'});
  assert.deepEqual(payload.changes.games,['Isle of Skye','The Deep Bleu C','CycClub']);
  assert.equal(payload.changes.features.length,13);
  assert.equal(payload.changes.improvements.length,20);
  assert.ok(payload.changes.features.some((item)=>item.includes('Light theme')));
  assert.ok(payload.changes.features.some((item)=>item.includes('gameheader')));
  assert.ok(payload.changes.features.some((item)=>item.includes('72, 36 of 18 tegels')));
  assert.ok(payload.changes.features.some((item)=>item.includes('burgers per speler')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('planeet-')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('ruimtebanner')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('in plaats van room')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('passende, gecentreerde breedte')));
  assert.ok(payload.changes.features.some((item)=>item.includes('2 tot 7 spelers')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('vernieuwde vaste gebouwen')));
  assert.ok(payload.changes.features.some((item)=>item.includes('wielerploeg')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('huidige versie')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('upgradepopups')));
  assert.ok(payload.changes.features.some((item)=>item.includes('persoonlijke speelgeschiedenis')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('Hartenjagen en Hofslag')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('mobiele ondernavigatie')));
  assert.ok(payload.changes.features.some((item)=>item.includes('tijdelijk hervatbaar')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('knop Vernieuwen')));
  assert.ok(payload.changes.features.some((item)=>item.includes('accountnaam')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('sessiecheck')));
  assert.ok(payload.changes.improvements.some((item)=>item.includes('timeout van 40 seconden')));
});
