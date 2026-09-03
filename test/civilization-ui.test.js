const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Age of Civilization houdt spelerkaarten vast, toont details en laat onbetaalbare upgrades inspecteren',()=>{
  const client=fs.readFileSync(path.join(root,'games/civilization/client.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'games/civilization/styles.css'),'utf8');
  assert.match(css,/#gameStage:has\(\.civ-root\)\{[^}]*overflow:hidden!important/);
  assert.match(css,/\.civ-grid \{[^}]*grid-template-columns: repeat\(6, minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(min-height:720px\)\{[\s\S]*?\.civ-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.civ-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.civ-modal-backdrop\{position:absolute;[^}]*place-items:center/);
  assert.match(client,/function showCivModal/);
  assert.match(client,/confirmLabel:'Bouw'/);
  assert.match(client,/eyebrow:'Jouw stad'/);
  assert.match(client,/eyebrow:'Vast gebouw'/);
  assert.match(client,/function upgradeDeltaText/);
  assert.match(css,/\.civ-player-chip \{[\s\S]*?flex: 0 0 92px; width:92px/);
  assert.match(css,/\.civ-chip-name \{[^}]*text-overflow:ellipsis/);
  assert.match(client,/eyebrow:'Speler'/);
  assert.match(client,/Held: \$\{player\.leaderName/);
  assert.match(client,/if\(!afford\)node\.classList\.add\('unaffordable'\)/);
  assert.match(client,/confirmDisabled:!afford/);
  assert.match(client,/Kost \$\{cost\} goud/);
  assert.match(client,/function showCombatModal/);
  assert.match(client,/ATK \$\{result\.incoming\}.*DEF \$\{result\.defence\}.*\$\{result\.damage\} schade/);
  assert.match(client,/confirmLabel:'Doorgaan',required:true/);
  assert.doesNotMatch(client,/body:`Niveau \$\{tile\.level\} →/);
  assert.match(css,/\.civ-modal-actions:has\(\.civ-modal-secondary\) \.civ-modal-confirm\{grid-column:1\/-1/);
  assert.doesNotMatch(client,/civ-detail-slot/);
});

