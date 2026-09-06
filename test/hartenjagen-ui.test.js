const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Hartenjagen houdt het speelveld fixed en toont de score in een popup',()=>{
  const client=fs.readFileSync(path.join(root,'games/hartenjagen/client.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'games/hartenjagen/styles.css'),'utf8');
  assert.match(client,/hearts-score-button/);
  assert.match(client,/function openScorePopup/);
  assert.match(client,/hearts-score-backdrop/);
  assert.doesNotMatch(client,/els\.gameStage\.append\(scores,logBox/);
  assert.match(css,/#gameStage:has\(\.hearts-table\)\{[^}]*overflow:hidden!important/);
  assert.match(css,/\.hearts-score-backdrop\{position:absolute/);
});

test('Hartenjagen houdt alle spelersvakken even groot zonder ze uit te rekken',()=>{
  const css=fs.readFileSync(path.join(root,'games/hartenjagen/styles.css'),'utf8');
  assert.match(css,/#gameStage:has\(\.hearts-table\)\{--hearts-trick-height:clamp\(320px,38dvh,380px\)/);
  assert.match(css,/\.hearts-trick\{[^}]*flex:0 0 var\(--hearts-trick-height\);[^}]*height:var\(--hearts-trick-height\);[^}]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\);[^}]*align-items:stretch/);
  assert.match(css,/\.trick-seat\{[^}]*height:100%;[^}]*grid-template-rows:auto minmax\(0,1fr\)/);
  assert.match(css,/\.trick-seat \.playing-card\{[^}]*align-self:center/);
  assert.match(css,/\.hearts-fan:not\(:has\(\.playing-card:nth-child\(9\)\)\) \.playing-card\{margin-right:0\}/);
});
