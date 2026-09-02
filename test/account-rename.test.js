const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'pluto-rename-'));
const db=require('../src/db');

test('accountnaam wijzigen behoudt identiteit, sessie en statistieken',()=>{
  const first=db.register('RenameOne','password123');
  const second=db.register('RenameTwo','password123');
  db.recordMatch({gameKey:'pesten',roomId:'TEST',players:[
    {userId:first.user.id,displayName:'RenameOne',won:true},
    {userId:second.user.id,displayName:'RenameTwo',won:false}
  ]});

  const changed=db.changeUsername(first.user.id,'NieuweNaam');
  assert.equal(changed.ok,true);
  assert.equal(changed.user.id,first.user.id);
  assert.equal(db.getUserFromCookieHeader(`${db.SESSION_COOKIE}=${first.session.token}`).username,'NieuweNaam');
  assert.equal(db.getProfile('NieuweNaam').totals.wins,1);
  assert.equal(db.getProfile('RenameOne'),null);
  assert.equal(db.login('NieuweNaam','password123').ok,true);
  assert.equal(db.login('RenameOne','password123').ok,false);

  const duplicate=db.changeUsername(first.user.id,'renametwo');
  assert.equal(duplicate.ok,false);
  assert.equal(duplicate.error,'Die username bestaat al.');
  assert.equal(db.db.prepare('SELECT display_name FROM match_players WHERE user_id=?').get(first.user.id).display_name,'NieuweNaam');
});
