const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');
const {configureHttp}=require('../src/server/http');

test('productieserver levert alle pluginclients, CSS, views en assets',async(t)=>{
 const app=express(),runtime={rooms:new Map(),openRoomSummaries:()=>[]};
 configureHttp(app,runtime);
 const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/id="gameGrid"/);
 const registry=await (await fetch(`${base}/api/game-plugins`)).json();assert.equal(registry.games.length,20);
 for(const plugin of registry.games){
  const client=await fetch(base+plugin.clientUrl);assert.equal(client.status,200,plugin.clientUrl);assert.match(client.headers.get('content-type'),/javascript/);
  const style=await fetch(base+plugin.styleUrl);assert.equal(style.status,200,plugin.styleUrl);assert.match(style.headers.get('content-type'),/css/);
  if(plugin.viewUrl)assert.equal((await fetch(base+plugin.viewUrl)).status,200,plugin.viewUrl);
 }
 assert.equal((await fetch(`${base}/game-plugins/minigolf/assets/tree.svg`)).status,200);
 assert.equal((await fetch(`${base}/game-plugins/onbekend/client.js`)).status,404);
});

test('frontend vangt een kapotte plugin af zonder de volledige loader te stoppen',()=>{
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/app.js'),'utf8');
 assert.match(source,/try\{const plugin=await import\(game\.clientUrl\)/);
 assert.match(source,/loadError=error/);
 assert.match(source,/launch\.textContent='Niet beschikbaar'/);
});
