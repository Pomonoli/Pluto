const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function lines(rel){
 return fs.readFileSync(path.join(__dirname,'..',rel),'utf8').split(/\r?\n/).length;
}

test('server bootstrap bevat geen room/socket businesslogica meer',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.ok(lines('server.js') < 80);
 assert.doesNotMatch(server,/socket\.on\('room:create'/);
 assert.match(server,/createRealtime/);
 assert.match(server,/configureHttp/);
});

test('frontend controller en games zijn opgesplitst in modules',()=>{
 assert.ok(lines('public/app.js') < 700);
 assert.ok(fs.existsSync(path.join(__dirname,'../public/js/game-ui.js')));
 assert.ok(fs.existsSync(path.join(__dirname,'../public/js/map-editor.js')));
 for(const game of ['hofslag','blackjack','solitaire','presidenten','pesten','hartenjagen','cluedo','carcassonne','minigolf']){
  for(const file of ['manifest.json','server.js','client.js','rules.html'])assert.ok(fs.existsSync(path.join(__dirname,'..','games',game,file)),`${game}/${file} ontbreekt`);
  assert.ok(!fs.existsSync(path.join(__dirname,'..','src',`${game}.js`)),`obsolete src/${game}.js bestaat nog`);
 }
});

test('Minigolf mapgeneratie staat los van de engine',()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'../games/minigolf/generator.js')));
 assert.ok(lines('games/minigolf/server.js') < 1100);
});
