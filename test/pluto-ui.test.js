const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('Pluto branding staat in HTML en manifest',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/manifest.webmanifest'),'utf8'));
  assert.match(html,/<strong>Pluto<\/strong>/);
  assert.match(html,/gaming space/);
  assert.equal(manifest.name,'Pluto');
  assert.equal(manifest.short_name,'Pluto');
});

test('mobile nav bevat exact de vier gevraagde hoofdbestemmingen',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  for(const label of ['Speel','Lobby','Leaderboard','Profiel']) assert.match(html,new RegExp(`>${label}<`));
  assert.match(html,/id="mobileNav"/);
});

test('mobile nav wordt in een actieve room verborgen',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
  assert.match(app,/function setRoomChrome\(active\)/);
  assert.match(app,/function showRoom\(\) \{\s*setRoomChrome\(true\)/);
  assert.match(app,/function showHome\(\) \{\s*setRoomChrome\(false\)/);
  assert.match(css,/body\.room-active \.mobile-nav\{display:none\}/);
  assert.match(css,/body\.room-active\{padding-bottom:env\(safe-area-inset-bottom\)\}/);
});

test('spelruimte bevat geen chat, vertrekknop of deelkaart',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.doesNotMatch(html,/Kopieer link|id="roomShareBox"|id="shareLink"|id="roomFooterMeta"|id="roomLeaveButton"|id="leaveButton"|id="chatPanel"|id="chatForm"/);
  assert.doesNotMatch(app,/function copyLink|Roomlink gekopieerd|els\.shareLink|renderChat|els\.chatForm|els\.roomLeaveButton/);
});

test('actieve spellen gebruiken een viewporthoge layout met interne fallback',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
  assert.match(app,/classList\.toggle\('game-active',room\.status!=='lobby'\)/);
  assert.match(css,/body\.game-active\{height:100dvh;min-height:100dvh;overflow:hidden\}/);
  assert.match(css,/body\.game-active \.game-panel\{[^}]*overflow:hidden/);
  assert.match(css,/body\.game-active #gameStage\{[^}]*overflow:auto/);
  assert.match(css,/body\.game-active \.log-box\{display:none!important\}/);
});

test('homescreen bevat geen kaart meer om via een code te joinen',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.doesNotMatch(html,/HEB JE AL EEN CODE|id="joinCodeForm"|id="joinCode"/);
  assert.doesNotMatch(app,/els\.joinCodeForm|els\.joinCode\.value/);
});

test('homescreen toont alleen beschikbare open lobbykaarten',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.match(html,/id="homeOpenLobbiesSection" class="recent-games-section hidden"/);
  assert.match(html,/id="homeOpenLobbies" class="recent-game-row"/);
  assert.match(app,/room\.joinable\|\|\(room\.resumable&&room\.playerNames\.some/);
  assert.match(app,/homeOpenLobbiesSection\.classList\.toggle\('hidden',!rooms\.length\)/);
  assert.match(app,/button\.onclick=\(\)=>joinRoom\(room\.id\)/);
  assert.match(app,/canResume\?'Ga terug':room\.resumable\?'Lopend'/);
});

test('sound button is icon-only en app knop heet App',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.match(html,/id="soundButton"[^>]*><\/button>/);
  assert.match(html,/id="installButton"[^>]*>App<\/button>/);
  assert.match(app,/Geluid uitzetten/);
  assert.match(app,/Geluid aanzetten/);
});
