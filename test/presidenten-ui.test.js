const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Presidenten legt jouw kaarten in responsieve rijen zonder horizontale scroll',()=>{
  const client=fs.readFileSync(path.join(root,'games/presidenten/client.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'games/presidenten/styles.css'),'utf8');
  assert.match(client,/JOUW KAARTEN/);
  assert.match(css,/\.presidenten-fan\{display:grid;grid-template-columns:repeat\(auto-fit/);
  assert.doesNotMatch(css,/\.presidenten-fan\{[^}]*overflow-x:auto/);
});

