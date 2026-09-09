'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loader(fetch) {
  const source = fs.readFileSync(path.join(__dirname, '../games/deep-bleu-c/client.js'), 'utf8');
  const context = vm.createContext({ fetch, console, WORLD_VERSION: 9,
    state: { room: {} }, renderGame() {}, minimapBase: {}, minimapWorldRef: {} });
  vm.runInContext(source.slice(source.indexOf('let world = null;'), source.indexOf("let activePanel = 'map';")), context);
  return context;
}

test('world loader bypasses cached pre-expansion HTTP responses and replaces an old in-memory map', async () => {
  const requests = [];
  let response = { ok: true, width: 48, height: 48 };
  const context = loader(async (url, options) => {
    requests.push({ url, options });
    return { json: async () => response };
  });
  vm.runInContext('ensureWorld({width:48,height:48})', context);
  await vm.runInContext('worldPromise', context);
  assert.equal(vm.runInContext('world.width', context), 48);
  response = { ok: true, width: 160, height: 160, version: 9 };
  assert.equal(vm.runInContext('ensureWorld({width:160,height:160,version:9})', context), null);
  await vm.runInContext('worldPromise', context);
  assert.equal(vm.runInContext('world.width', context), 160);
  assert.equal(vm.runInContext('minimapBase', context), null);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.options.cache === 'no-store'));
  vm.runInContext('ensureWorld({width:160,height:160,version:9})', context);
  assert.equal(requests.length, 2);
});

test('world loader rejects incompatible terrain and permits a fresh retry', async () => {
  let response = { ok: true, width: 48, height: 48 };
  const context = loader(async () => ({ json: async () => response }));
  context.console = { error() {} };
  vm.runInContext('ensureWorld({width:160,height:160,version:9})', context);
  await vm.runInContext('worldPromise', context);
  assert.equal(vm.runInContext('world', context), null);
  assert.equal(vm.runInContext('worldPromise', context), null);
  response = { ok: true, width: 160, height: 160, version: 9 };
  vm.runInContext('ensureWorld({width:160,height:160,version:9})', context);
  await vm.runInContext('worldPromise', context);
  assert.equal(vm.runInContext('world.version', context), 9);
});
