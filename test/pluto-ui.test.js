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

test('spelruimte bevat geen chat of deelkaart en gebruikt alleen de compacte mobiele vertrekactie',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.doesNotMatch(html,/Kopieer link|id="roomShareBox"|id="shareLink"|id="roomFooterMeta"|id="roomLeaveButton"|id="leaveButton"|id="chatPanel"|id="chatForm"/);
  assert.match(html,/id="mobileGameLeaveButton"/);
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
  assert.match(css,/body\.game-active \.app-shell\{width:100%;max-width:none;padding-left:0;padding-right:0\}/);
  assert.match(css,/body\.game-active \.game-panel\{[\s\S]*?border-radius:0;/);
});

test('browser en tablet begrenzen gamebreedte zonder mobile te wijzigen',()=>{
  const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
  assert.match(css,/@media\(min-width:761px\)\{[\s\S]*?body\.game-active #gameStage\{[\s\S]*?width:min\(100%,1180px\);[\s\S]*?max-width:1180px/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?body\.game-active #gameStage\{overflow:auto/);
  assert.ok(css.lastIndexOf('@media(min-width:761px)')>css.lastIndexOf('@media(max-width:760px)'));
  for(const game of ['civilization','blackjack','cluedo','hartenjagen','hofslag','pesten','presidenten','quoridor','santorini','solitaire','stratego']){
    const gameCss=fs.readFileSync(path.join(root,'games',game,'styles.css'),'utf8');
    assert.match(gameCss,/@media\(min-width:761px\)\{#gameStage:has\(/,`${game} mist een desktop/tablet-breedtelimiet`);
  }
});

test('Age of Civilization blijft fixed en gebruikt overlays voor kaartinfo en upgrades',()=>{
  const client=fs.readFileSync(path.join(root,'games/civilization/client.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'games/civilization/styles.css'),'utf8');
  assert.match(css,/#gameStage:has\(\.civ-root\)\{[^}]*overflow:hidden!important/);
  assert.match(css,/\.civ-grid \{[^}]*grid-template-columns: repeat\(6, minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(min-height:720px\)\{[\s\S]*?\.civ-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.civ-modal-backdrop\{position:absolute;[^}]*place-items:center/);
  assert.match(client,/function showCivModal/);
  assert.match(client,/confirmLabel:'Bouw'/);
  assert.match(client,/eyebrow:'Jouw stad'/);
  assert.match(client,/eyebrow:'Vast gebouw'/);
  assert.match(client,/function upgradeDeltaText/);
  assert.match(client,/`ATK \+\$\{tile\.nextAttack-tile\.attack\}`/);
  assert.doesNotMatch(client,/body:`Niveau \$\{tile\.level\} →/);
  assert.match(css,/\.civ-modal-actions:has\(\.civ-modal-secondary\) \.civ-modal-confirm\{grid-column:1\/-1/);
  assert.doesNotMatch(client,/civ-detail-slot/);
});

test('7 Wonders Duel gebruikt een fixed scherm met kaarten- en rijk-tabs',()=>{
  const client=fs.readFileSync(path.join(root,'games/seven-wonders-duel/client.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'games/seven-wonders-duel/styles.css'),'utf8');
  assert.match(client,/state\.duelTab/);
  assert.match(client,/Kaarten/);
  assert.match(client,/Jouw wonders/);
  assert.match(client,/Vooruitgang/);
  assert.doesNotMatch(client,/logBox\(game\.log\)/);
  assert.match(css,/#gameStage:has\(\.duel-shell\)\{[^}]*overflow:hidden!important/);
  assert.match(css,/\.duel-tabs\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.duel-science-line\{[^}]*font-size:\.9rem/);
  assert.match(css,/\.duel-card\{[^}]*max-height:61px/);
  assert.match(css,/@media\(max-width:470px\)\{[\s\S]*?\.duel-header\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
  assert.match(app,/homeOpenLobbiesSection\.classList\.toggle\('hidden',!open\.length\)/);
  assert.match(app,/button\.onclick=\(\)=>joinRoom\(room\.id\)/);
  assert.match(app,/canResume\?'Ga terug':room\.resumable\?'Lopend'/);
});

test('homescreen bevat geen Recent-sectie meer',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.doesNotMatch(html,/id="recentGames(?:Section)?"|>RECENT</);
  assert.doesNotMatch(app,/recentGamesList|rememberRecentGame|renderRecentGames/);
});

test('lobby gebruikt game en games als zichtbare benaming',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const realtime=fs.readFileSync(path.join(root,'src/server/realtime.js'),'utf8');
  assert.match(html,/Beschikbare games/);
  assert.match(html,/Join game/);
  assert.match(app,/Geen open games/);
  assert.match(app,/Game \$\{room\.id\}/);
  assert.match(app,/Game verlaten\?/);
  assert.doesNotMatch(html,/Beschikbare rooms|Rooms laden|Join room/);
  assert.doesNotMatch(app,/Geen open rooms|Room \$\{room\.id\}|Join room|Room verlaten|roomcode|eerst de room/);
  assert.doesNotMatch(realtime,/room bestaat niet|room zit vol|in een room/);
});

test('sound button is icon-only en app knop heet App',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.match(html,/id="soundButton"[^>]*><\/button>/);
  assert.match(html,/id="installButton"[^>]*>App<\/button>/);
  assert.match(app,/Geluid uitzetten/);
  assert.match(app,/Geluid aanzetten/);
});

test('leaderboard toont wins voor games',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.match(app,/\['#','Speler','Wins','Games','Winrate'\]/);
  assert.match(app,/String\(row\.wins\).*String\(row\.games\).*row\.winRate/s);
});

test('profiel toont eerst maximaal vijf recente matches met toon meer',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  assert.match(app,/recent\.slice\(0,5\)\.forEach\(appendMatch\)/);
  assert.match(app,/if\(recent\.length>5\)/);
  assert.match(app,/Toon meer/);
  assert.match(app,/recent\.slice\(5\)\.forEach\(appendMatch\)/);
});

test('mobile UX heeft een uniforme gameheader, bevestiging, hervatten en compacte dataweergaves',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
  const filter=fs.readFileSync(path.join(root,'public/js/home-game-filter.js'),'utf8');
  assert.match(html,/id="mobileGameHeader"[\s\S]*id="mobileGameRulesButton"[\s\S]*id="mobileGameSoundButton"/);
  assert.match(html,/id="leaveGameModal"[\s\S]*id="cancelLeaveGameButton"[\s\S]*id="confirmLeaveGameButton"/);
  assert.match(app,/function requestLeaveRoom\(\)[\s\S]*requestAnimationFrame/);
  assert.doesNotMatch(app,/window\.confirm/);
  assert.match(app,/beforeunload/);
  assert.match(html,/id="resumeGameSection"[\s\S]*DOORGAAN MET SPELEN/);
  assert.match(app,/classList\.toggle\('hidden',!resumable\.length\)/);
  assert.match(css,/scroll-snap-type:x mandatory/);
  assert.match(css,/\.profile-mobile-stats\{display:grid/);
  assert.match(css,/#leaderboardContent \.stats-table\{width:100%;table-layout:fixed/);
  assert.match(css,/#loggedOutAccount #registerForm\{display:none\}/);
  assert.match(filter,/width:44px;height:44px;min-width:44px;min-height:44px/);
});

test('settings en mobiele gameheader tonen compacte consistente metadata',()=>{
  const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8');
  const light=fs.readFileSync(path.join(root,'public/themes/pluto-1.8.0.css'),'utf8');
  assert.match(html,/class="settings-version"[^>]*>Pluto v1\.12\.4</);
  assert.match(css,/\.connection-pill,\.badge\{[^}]*white-space:nowrap;[^}]*flex-shrink:0/);
  assert.match(css,/\.mobile-game-leave,\.mobile-game-menu-button\{[^}]*border:0;[^}]*background:transparent/);
  assert.match(css,/\.mobile-game-name\{[^}]*height:44px;[^}]*place-items:center;[^}]*line-height:1/);
  assert.match(light,/body\.game-active :is\(\.mobile-game-leave,\.mobile-game-menu-button\)\{[^}]*background:transparent;[^}]*border-color:transparent/);
});

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
});
