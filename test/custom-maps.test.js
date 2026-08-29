const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');

test('custom minigolf map kan persistent worden opgeslagen, aangepast en verwijderd', () => {
  const username = `m${String(Date.now()).slice(-10)}`;
  const reg = db.register(username, 'password123');
  assert.equal(reg.ok, true);
  const map = {
    name:'Custom Test',difficulty:'Normaal',maxStrokes:5,
    start:{x:100,y:400},cup:{x:800,y:100},terrain:[],walls:[],props:[]
  };
  const created = db.createMinigolfMap(reg.user.id, map.name, map);
  assert.equal(created.ownerUserId, reg.user.id);
  assert.ok(db.listMinigolfMapsForGame().some(x => x.id === `custom-${created.id}`));
  map.name = 'Custom Test 2';
  const updated = db.updateMinigolfMap(created.id, reg.user.id, map.name, map);
  assert.equal(updated.ok, true);
  assert.equal(updated.map.name, 'Custom Test 2');
  const deleted = db.deleteMinigolfMap(created.id, reg.user.id);
  assert.equal(deleted.ok, true);
  assert.equal(db.getMinigolfMap(created.id), null);
});
