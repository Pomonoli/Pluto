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

test('frontend controller is opgesplitst in game UI en map editor modules',()=>{
 assert.ok(lines('public/app.js') < 700);
 assert.ok(fs.existsSync(path.join(__dirname,'../public/js/game-ui.js')));
 assert.ok(fs.existsSync(path.join(__dirname,'../public/js/map-editor.js')));
 assert.ok(fs.existsSync(path.join(__dirname,'../public/js/rules.js')));
});

test('Minigolf mapgeneratie staat los van de engine',()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'../src/minigolf/generator.js')));
 assert.ok(lines('src/minigolf.js') < 1100);
});
