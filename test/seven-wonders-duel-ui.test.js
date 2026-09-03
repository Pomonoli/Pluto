const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('7 Wonders Duel gebruikt een fixed scherm met kaarten- en rijk-tabs',()=>{
  const client=fs.readFileSync(path.join(root,'games/seven-wonders-duel/client.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'games/seven-wonders-duel/server.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'games/seven-wonders-duel/styles.css'),'utf8');
  assert.match(client,/state\.duelTab/);
  assert.match(client,/Kaarten/);
  assert.match(client,/Jouw wonders/);
  assert.match(client,/Vooruitgang/);
  assert.match(client,/Bouwkosten:/);
  assert.match(client,/Directe handel:/);
  assert.match(client,/Effect na bouw:/);
  assert.match(client,/function constructionCostText/);
  assert.match(client,/function costDetails/);
  assert.match(server,/trade:info \? \{baseCoins:info\.baseCoins,tradeCoins:info\.tradeCoins,purchases:info\.purchases\}/);
  assert.doesNotMatch(client,/logBox\(game\.log\)/);
  assert.match(css,/#gameStage:has\(\.duel-shell\)\{[^}]*overflow:hidden!important/);
  assert.match(css,/\.duel-tabs\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.duel-science-line\{[^}]*font-size:\.9rem/);
  assert.match(css,/\.duel-card\{[^}]*max-height:61px/);
  assert.match(css,/@media\(max-width:470px\)\{[\s\S]*?\.duel-header\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

