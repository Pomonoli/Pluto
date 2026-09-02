const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Minigolf editor staat in de spellobby en niet meer op de homekaart',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'games/minigolf/manifest.json'),'utf8'));
  const client=fs.readFileSync(path.join(root,'games/minigolf/client.js'),'utf8');
  assert.equal(manifest.toolLabel,undefined);
  assert.match(client,/export function renderLobbyOptions/);
  assert.match(client,/Map editor/);
});

