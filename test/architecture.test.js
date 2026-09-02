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
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(app,/import \{ createGameUi \} from/);
 assert.doesNotMatch(app,/function render(?:Hofslag|Blackjack|Solitaire|Presidenten|Pesten|Hartenjagen|Cluedo|Carcassonne|Minigolf)\(/);
 assert.ok(fs.existsSync(path.join(__dirname,'../public/js/game-ui.js')));
 for(const game of ['hofslag','blackjack','solitaire','presidenten','pesten','hartenjagen','cluedo','carcassonne','minigolf']){
  for(const file of ['manifest.json','server.js','client.js','rules.html','styles.css'])assert.ok(fs.existsSync(path.join(__dirname,'..','games',game,file)),`${game}/${file} ontbreekt`);
  assert.ok(!fs.existsSync(path.join(__dirname,'..','src',`${game}.js`)),`obsolete src/${game}.js bestaat nog`);
 }
 assert.ok(fs.existsSync(path.join(__dirname,'../games/minigolf/map-editor.js')));
 assert.ok(fs.existsSync(path.join(__dirname,'../games/minigolf/view.html')));
 assert.ok(fs.existsSync(path.join(__dirname,'../games/minigolf/assets/tree.svg')));
});

test('gedeelde frontend bevat geen game-renderers of game-specifieke CSS',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../public/js/game-ui.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../public/styles.css'),'utf8');
 assert.doesNotMatch(ui,/function render(?:Hofslag|Blackjack|Solitaire|Presidenten|Pesten|Hartenjagen|Cluedo|Carcassonne|Minigolf)/);
 assert.doesNotMatch(css,/\.(?:hof-|blackjack|sol-|cluedo|carc-|golf-|map-editor)/);
});

test('Minigolf mapgeneratie staat los van de engine',()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'../games/minigolf/generator.js')));
 assert.ok(lines('games/minigolf/server.js') < 1100);
});

test('Docker-image bevat de volledige games-map',()=>{
 const dockerfile=fs.readFileSync(path.join(__dirname,'../Dockerfile'),'utf8');
 assert.match(dockerfile,/^COPY games \.\/games$/m);
});
