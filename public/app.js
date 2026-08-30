import { RULES } from './js/rules.js?v=0.13.1';
import { createGameUi } from './js/game-ui.js?v=0.13.1';
import { createMapEditor } from './js/map-editor.js?v=0.13.1';

const socket = window.io();
  const $ = (id) => document.getElementById(id);
  const els = {};
  ['brandButton','lobbyBrowserButton','leaderboardButton','soundButton','installButton','accountButton','mobileNav','mobilePlayButton','mobileLobbyButton','mobileLeaderboardButton','mobileProfileButton','rulesButton','leaveButton','homeView','minigolfEditorView','lobbyBrowserView','leaderboardView','profileView','roomView','homeGuestBar','guestName','homeAccountButton','inviteBox','inviteText','joinInviteButton','recentGamesSection','recentGames','gamesHeading','gameGrid','joinCodeForm','joinCode','refreshRoomsButton','lobbyIdentityBar','lobbyIdentityText','lobbyGuestWrap','lobbyGuestName','openRoomCount','openRoomsContent','leaderboardGame','leaderboardContent','profileUsername','profileSummary','profileGames','profileRecent','headToHeadCard','headToHeadGame','headToHeadContent','roomShareFooter','roomFooterMeta','roomShareBox','roomGameName','roomCodeHeading','shareLink','copyLinkButton','roomRematchButton','roomLeaveButton','roomLayout','lobbySection','gameSection','playerCountBadge','lobbyPlayers','hostControls','addNpcButton','startGameButton','lobbyHint','gameStage','gameResult','chatPanel','chatMessages','chatForm','chatInput','minigolfEditorButton','newGolfMapButton','saveGolfMapButton','customMapCount','customMapList','mapNameInput','mapDifficultySelect','mapMaxStrokesInput','mapSaveState','mapToolGrid','mapToolHelp','deleteMapObjectButton','mapEditorCanvas','mapInspectorEmpty','mapInspectorFields','testGolfMapButton','resetGolfTestButton','mapTestHint','accountModal','closeAccountButton','loggedOutAccount','loggedInAccount','loginForm','loginUsername','loginPassword','registerForm','registerUsername','registerPassword','accountUsername','accountGames','accountWins','accountWinRate','myProfileButton','logoutButton','rulesModal','rulesGameName','rulesContent','closeRulesButton','toast'].forEach((id) => els[id] = $(id));

  const state = {
    room: null,
    directRoomId: getRoomFromPath(),
    token: getOrCreateToken(),
    guestName: localStorage.getItem('minigames.guestName') || '',
    toastTimer: null,
    selection: null,
    authUser: null,
    authStats: null,
    hofAnimation: null,
    hofAnimatedRound: 0,
    cluedoNotes: {},
    cluedoSelections: {},
    carcassonneViews: {},
    gamePlugins: {},
    soundMuted: localStorage.getItem('minigames.soundMuted') === '1',
    audioContext: null,
    deferredInstallPrompt: null,
    renderedRoomId: null,
    renderedGameRevision: -1,
    viewedProfileUsername: null,
    previousRoom: null,
    scoreMemory: {},
    lobbyRefreshTimer: null,
    minigolfShotAnimation: null,
    mapEditor: null,
    expectedRoomId: getRoomFromPath(),
    roomStateBlocked: false
  };
  els.guestName.value = state.guestName;



  function E(tag, cls, text) { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; }
  function getRoomFromPath() { const m = location.pathname.match(/^\/room\/([A-Za-z0-9]+)\/?$/); return m ? m[1].toUpperCase() : null; }
  function getProfileFromPath() { const m = location.pathname.match(/^\/profile\/([^/]+)\/?$/); return m ? decodeURIComponent(m[1]) : null; }
  function isLeaderboardPath() { return /^\/leaderboard\/?$/.test(location.pathname); }
  function isLobbyPath() { return /^\/lobby\/?$/.test(location.pathname); }
  function isMinigolfEditorPath() { return /^\/minigolf\/editor\/?$/.test(location.pathname); }
  function setRoute(path) { history.pushState({},'',path); }
  function getOrCreateToken() {
    let token = localStorage.getItem('minigames.token');
    if (token?.length >= 16) return token;
    token = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem('minigames.token', token); return token;
  }
  function normalizeName(v) { return String(v || '').replace(/\s+/g,' ').trim().slice(0,18); }
  function saveGuestName() {
    if (state.authUser) return state.authUser.username;
    const name = normalizeName(els.guestName.value);
    if (name.length < 2) { toast('Gebruik een guestnaam van minstens 2 tekens.'); els.guestName.focus(); return null; }
    state.guestName = name; localStorage.setItem('minigames.guestName', name); return name;
  }
  function toast(message) { els.toast.textContent = message; els.toast.classList.remove('hidden'); clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2800); }
  function setRouteRoom(roomId) { history.pushState({},'',roomId ? `/room/${roomId}` : '/'); state.directRoomId = roomId || null; }
  function handleAck(result) { if (!result?.ok) toast(result?.error || 'Actie mislukt.'); }
  function action(action, data = {}) { socket.emit('game:action', { action, data }, handleAck); }
  function isRed(card) { return card?.suit === '♥' || card?.suit === '♦'; }
  function cardNode(card, opts = {}) {
    const b = E(opts.button === false ? 'div' : 'button', `playing-card${opts.small ? ' small' : ''}${opts.selected ? ' selected' : ''}${opts.legal ? ' legal' : ''}${card?.hidden ? ' card-back' : ''}`);
    if (b.tagName === 'BUTTON') b.type = 'button';
    if (!card?.hidden) {
      b.dataset.rank = card.rank;
      b.append(E('div', `rank ${isRed(card) ? 'red' : 'black'}`, card.rank));
      b.append(E('div', `suit ${isRed(card) ? 'red' : 'black'}`, card.suit));
    }
    return b;
  }
  function valueLabel(v) { return v === 1 ? 'A' : String(v); }

  function setMobileNavActive(active) {
    if (!els.mobileNav) return;
    els.mobileNav.querySelectorAll('.mobile-nav-item').forEach((button) => {
      button.classList.toggle('active', button.dataset.nav === active);
      if (button.dataset.nav === active) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }


  function isStandaloneApp() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function updateInstallButtonVisibility() {
    const onStandalone = isStandaloneApp();
    document.body.classList.toggle('standalone-mode', onStandalone);
    els.installButton.classList.toggle('hidden', onStandalone);
  }

  function hideMainViews() {
    [els.homeView,els.minigolfEditorView,els.lobbyBrowserView,els.leaderboardView,els.profileView,els.roomView].forEach(v=>v.classList.add('hidden'));
    if (state.lobbyRefreshTimer) { clearInterval(state.lobbyRefreshTimer); state.lobbyRefreshTimer = null; }
  }
  function updateIdentityUi() {
    const loggedIn = Boolean(state.authUser);
    els.accountButton.textContent = loggedIn ? state.authUser.username : 'Inloggen';
    els.homeGuestBar.classList.toggle('hidden', loggedIn);
    els.homeAccountButton.classList.toggle('hidden', loggedIn);

    if (loggedIn) {
      els.guestName.value = state.authUser.username;
      els.lobbyIdentityText.textContent = state.authUser.username;
      els.lobbyGuestWrap.classList.add('hidden');
    } else {
      els.guestName.value = state.guestName;
      els.lobbyGuestName.value = state.guestName;
      els.lobbyIdentityText.textContent = state.guestName || 'Guest';
      els.lobbyGuestWrap.classList.remove('hidden');
    }
    updateSoundButton();
    updateInstallButtonVisibility();
  }
  function showHome() {
    hideMainViews(); setMobileNavActive('play'); els.homeView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden'); els.leaveButton.classList.add('hidden');
    const target = getRoomFromPath(); state.directRoomId = target;
    els.inviteBox.classList.toggle('hidden', !target); if (target) els.inviteText.textContent = `Je bent uitgenodigd voor room ${target}`;
    updateIdentityUi();
    renderRecentGames();
  }
  async function showOpenLobby() {
    hideMainViews(); setMobileNavActive('lobby'); els.lobbyBrowserView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden'); els.leaveButton.classList.add('hidden');
    updateIdentityUi();
    await loadOpenRooms();
    state.lobbyRefreshTimer = setInterval(loadOpenRooms, 5000);
  }
  function showRoom() {
    hideMainViews(); setMobileNavActive('play'); els.roomView.classList.remove('hidden');
    els.rulesButton.classList.remove('hidden'); els.leaveButton.classList.remove('hidden');
  }
  async function showLeaderboard(gameKey = '') {
    hideMainViews(); setMobileNavActive('leaderboard'); els.leaderboardView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden'); els.leaveButton.classList.add('hidden');
    els.leaderboardContent.innerHTML = '<p class="muted">Laden…</p>';
    const response = await fetch(`/api/leaderboard${gameKey ? `?game=${encodeURIComponent(gameKey)}` : ''}`);
    const data = await response.json();
    if (!data.ok) { els.leaderboardContent.textContent = data.error || 'Kon leaderboard niet laden.'; return; }
    if (!els.leaderboardGame.dataset.loaded) {
      for (const game of data.games) {
        const option = document.createElement('option'); option.value = game.key; option.textContent = game.name; els.leaderboardGame.append(option);
      }
      els.leaderboardGame.dataset.loaded = '1';
    }
    els.leaderboardGame.value = gameKey || '';
    renderLeaderboard(data.leaderboard, gameKey);
  }
  async function showProfile(username) {
    hideMainViews(); setMobileNavActive('profile'); els.profileView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden'); els.leaveButton.classList.add('hidden');
    els.profileUsername.textContent = username;
    els.profileSummary.textContent = 'Laden…';
    els.profileGames.replaceChildren(); els.profileRecent.replaceChildren();
    state.viewedProfileUsername=username;els.headToHeadCard.classList.add('hidden');els.headToHeadContent.replaceChildren();els.headToHeadGame.value='';
    const response = await fetch(`/api/profile/${encodeURIComponent(username)}`);
    const data = await response.json();
    if (!data.ok) { els.profileSummary.textContent = data.error || 'Profiel niet gevonden.'; return; }
    renderProfile(data.profile);
    if(state.authUser&&state.authUser.username.toLocaleLowerCase('nl-BE')!==data.profile.user.username.toLocaleLowerCase('nl-BE')){
      els.headToHeadCard.classList.remove('hidden');await loadHeadToHead(data.profile.user.username);
    }
  }

  function recentGamesList() {
    try { return JSON.parse(localStorage.getItem('minigames.recentGames') || '[]').filter(k=>GAME_NAMES[k]).slice(0,4); }
    catch { return []; }
  }
  function rememberRecentGame(gameKey) {
    if (!GAME_NAMES[gameKey]) return;
    const list = [gameKey, ...recentGamesList().filter(k=>k!==gameKey)].slice(0,4);
    localStorage.setItem('minigames.recentGames', JSON.stringify(list));
    if (!els.homeView.classList.contains('hidden')) renderRecentGames();
  }
  function renderRecentGames() {
    const list = recentGamesList();
    els.recentGamesSection.classList.toggle('hidden', !list.length);
    els.gamesHeading.classList.toggle('hidden', !list.length);
    els.recentGames.replaceChildren();
    list.forEach(gameKey=>{
      const b=E('button','recent-game-button');
      b.type='button';
      b.append(E('strong','',GAME_NAMES[gameKey]),E('span','', 'Nieuw spel'));
      b.onclick=()=>createRoom(gameKey);
      els.recentGames.append(b);
    });
  }
  function syncLobbyGuestName() {
    if (state.authUser) return state.authUser.username;
    const name=normalizeName(els.lobbyGuestName.value);
    if(name.length<2){toast('Vul eerst een guestnaam in.');els.lobbyGuestName.focus();return null}
    els.guestName.value=name;
    state.guestName=name;
    localStorage.setItem('minigames.guestName',name);
    els.lobbyIdentityText.textContent=name;
    return name;
  }
  function relativeAge(timestamp) {
    const sec=Math.max(0,Math.round((Date.now()-Number(timestamp||0))/1000));
    if(sec<60)return 'net geopend';
    const min=Math.floor(sec/60); if(min<60)return `${min} min geleden`;
    return `${Math.floor(min/60)} u geleden`;
  }
  async function loadOpenRooms() {
    if (els.lobbyBrowserView.classList.contains('hidden')) return;
    try {
      const response=await fetch('/api/rooms',{cache:'no-store'});
      const data=await response.json();
      if(!data.ok)throw new Error(data.error||'Kon rooms niet laden.');
      renderOpenRooms(data.rooms||[]);
    } catch(error) {
      els.openRoomsContent.replaceChildren(E('div','panel',error.message));
    }
  }
  function renderOpenRooms(rooms) {
    els.openRoomCount.textContent=String(rooms.length);
    els.openRoomsContent.replaceChildren();
    if(!rooms.length){
      const empty=E('div','panel empty-rooms');
      empty.append(E('h3','','Geen open rooms'),E('p','muted','Maak zelf een game op Home, of wacht tot iemand een room opent.'));
      els.openRoomsContent.append(empty);return;
    }
    rooms.forEach(room=>{
      const card=E('article','open-room-card');
      const head=E('div','open-room-head');
      const left=E('div');
      left.append(E('span','eyebrow',room.gameName.toUpperCase()),E('h3','',`Room ${room.id}`));
      head.append(left,E('span','badge',`${room.playerCount}/${room.maxPlayers}`));
      const players=E('div','open-room-players');
      room.playerNames.forEach(name=>players.append(E('span','open-room-player',name)));
      const meta=E('div','open-room-meta');
      meta.append(E('span','',`Host: ${room.hostName}`),E('span','',relativeAge(room.createdAt)));
      const join=E('button',room.joinable?'primary':'secondary',room.joinable?'Join room':'Vol');
      join.type='button';join.disabled=!room.joinable;
      join.onclick=()=>{if(!syncLobbyGuestName())return;joinRoom(room.id)};
      card.append(head,players,meta,join);
      els.openRoomsContent.append(card);
    });
  }

  function updateSoundButton() {
    const muted = state.soundMuted;
    els.soundButton.setAttribute('aria-label', muted ? 'Geluid aanzetten' : 'Geluid uitzetten');
    els.soundButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
    els.soundButton.setAttribute('title', muted ? 'Geluid aanzetten' : 'Geluid uitzetten');
    els.soundButton.innerHTML = muted
      ? '<span class="sound-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 14h4l5 4V6L8 10H4z"></path></svg></span>'
      : '<span class="sound-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 14h4l5 4V6L8 10H4z"></path><path d="M16 9c1.6 1.2 2.4 2.7 2.4 4.5S17.6 16.8 16 18"></path><path d="M18.6 6.8C21 8.7 22 10.9 22 13.5c0 1.5-.3 2.9-.9 4.1"></path><path d="M18.8 6.2 6.2 18.8"></path></svg></span>';
  }
  function ensureAudio() {
    if (state.soundMuted) return null;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!state.audioContext) state.audioContext=new Ctx();
    if(state.audioContext.state==='suspended') state.audioContext.resume().catch(()=>{});
    return state.audioContext;
  }
  function tone(freq=520,duration=.055,volume=.045,type='sine',delay=0) {
    const ctx=ensureAudio(); if(!ctx)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.value=freq;
    gain.gain.setValueAtTime(0.0001,ctx.currentTime+delay);
    gain.gain.exponentialRampToValueAtTime(volume,ctx.currentTime+delay+.008);
    gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+delay+duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+duration+.02);
  }
  function sound(kind) {
    if(state.soundMuted)return;
    if(kind==='card')tone(430,.045,.025,'triangle');
    else if(kind==='turn'){tone(660,.06,.04,'sine');tone(880,.07,.035,'sine',.07)}
    else if(kind==='score'){tone(720,.055,.035,'triangle');tone(920,.07,.03,'triangle',.06)}
    else if(kind==='win'){tone(523,.08,.045,'sine');tone(659,.08,.04,'sine',.09);tone(784,.13,.04,'sine',.18)}
    else if(kind==='lose')tone(330,.12,.035,'sine');
  }
  function didMeWin(game,myId) {
    const me=game.players?.find(p=>p.id===myId); if(!me)return false;
    const pluginWinner=state.gamePlugins[game.kind]?.isWinner;if(pluginWinner)return Boolean(pluginWinner({game,myId,player:me}));
    if(game.kind==='solitaire')return Boolean(game.gameOver);
    if(game.kind==='blackjack')return me.result==='Wint';
    if(game.kind==='presidenten')return me.place===1;
    if(game.kind==='pesten')return me.handCount===0;
    if(game.kind==='cluedo')return game.winnerId===myId;
    if(game.kind==='carcassonne'){const high=Math.max(...game.players.map(p=>p.score));return me.score===high&&game.players.filter(p=>p.score===high).length===1}
    if(game.kind==='hartenjagen'){const low=Math.min(...game.players.map(p=>p.totalScore));return me.totalScore===low}
    if(game.kind==='hofslag'){const high=Math.max(...game.players.map(p=>p.score));return me.score===high}
    return String(game.resultText||'').includes(me.name);
  }
  function handleRoomEffects(previous, next) {
    if(!next?.gameState)return;
    const prevGame=previous?.id===next.id?previous.gameState:null;
    const game=next.gameState;
    const myId=next.meId;
    if(prevGame){
      if(game.log?.[0] && game.log[0]!==prevGame.log?.[0]) sound('card');
      if(game.turnPlayerId===myId && prevGame.turnPlayerId!==myId && !game.gameOver) sound('turn');
      if(game.gameOver && !prevGame.gameOver){
        sound(didMeWin(game,myId) ? 'win' : 'lose');
      }
    }
  }
  function profileButton(name, registered, cls='player-profile-button') {
    if(!registered)return E('span','',name);
    const b=E('button',cls,name);b.type='button';b.title=`Profiel van ${name}`;
    b.onclick=(e)=>{e.stopPropagation();window.open(`/profile/${encodeURIComponent(name)}`,'_blank','noopener')};
    return b;
  }

  const gameUi = createGameUi({
    state, els, E, action, profileButton, sound, socket, handleAck, cardNode, valueLabel, requestRematch
  });

  const mapEditor = createMapEditor({
    state, els, E, toast, openAccount, hideMainViews,
    svgEl:gameUi.svgEl,
    minigolfPathPoint:gameUi.minigolfPathPoint,
    minigolfTerrainNode:gameUi.minigolfTerrainNode,
    minigolfBoostNode:gameUi.minigolfBoostNode
  });


  function createRoom(gameKey) {
    const name = saveGuestName(); if (!name) return;
    rememberRecentGame(gameKey);
    state.roomStateBlocked = true;
    state.expectedRoomId = null;
    socket.emit('room:create', { name, token: state.token, gameKey }, (result) => {
      if (!result?.ok) { state.roomStateBlocked=false; state.expectedRoomId=state.room?.id||null; return handleAck(result); }
      state.expectedRoomId = result.roomId;
      state.roomStateBlocked = false;
      if (result.token && result.token !== state.token) { state.token = result.token; localStorage.setItem('minigames.token', state.token); }
      setRouteRoom(result.roomId);
    });
  }
  function joinRoom(roomId) {
    const name = saveGuestName(); if (!name) return;
    const code = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g,''); if (!code) return toast('Vul een roomcode in.');
    state.expectedRoomId = code;
    state.roomStateBlocked = false;
    socket.emit('room:join', { roomId: code, name, token: state.token }, (result) => {
      if (!result?.ok) { state.expectedRoomId=state.room?.id||null; return handleAck(result); }
      if (result.token && result.token !== state.token) { state.token = result.token; localStorage.setItem('minigames.token', state.token); }
      if (location.pathname !== `/room/${result.roomId}`) setRouteRoom(result.roomId);
    });
  }


  const GAME_NAMES = {hofslag:'Hofslag',blackjack:'Blackjack',solitaire:'Solitaire',presidenten:'Presidenten',pesten:'Pesten',hartenjagen:'Hartenjagen',cluedo:'Cluedo',carcassonne:'Carcassonne',minigolf:'Minigolf'};
  async function loadGamePlugins(){
    try{
      const response=await fetch('/api/game-plugins',{cache:'no-store'}),data=await response.json();
      if(!data.ok)throw new Error(data.error||'Game-plugins konden niet laden.');
      for(const game of data.games||[]){
        GAME_NAMES[game.key]=game.name;RULES[game.key]=game.rules||'<p>Geen regels beschikbaar.</p>';
        if(game.styleUrl&&!document.querySelector(`link[data-game-plugin="${game.key}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=game.styleUrl;link.dataset.gamePlugin=game.key;document.head.append(link)}
        if(game.clientUrl){const plugin=await import(game.clientUrl);gameUi.registerPlugin(game.key,plugin);state.gamePlugins[game.key]=plugin}
        if(!els.gameGrid.querySelector(`[data-game="${game.key}"]`)){
          const card=E('article','game-card'),icon=E('div','game-icon',game.icon),body=E('div','game-card-body'),titleRow=E('div','game-title-row');titleRow.append(E('h3','',game.name),E('span','badge',game.badge));
          const info=E('button','game-info','i');info.type='button';info.dataset.rulesGame=game.key;info.setAttribute('aria-label',`Spelregels van ${game.name}`);
          const launch=E('button','primary game-launch',game.actionLabel);launch.type='button';launch.dataset.game=game.key;body.append(titleRow,info,launch);card.append(icon,body);els.gameGrid.append(card)
        }
      }
      if(state.room?.gameState&&state.gamePlugins[state.room.gameKey]){state.renderedGameRevision=-1;gameUi.renderGame(state.room)}
    }catch(error){console.error('Game-plugins laden mislukt:',error)}
  }
  function formatDuration(ms) {
    if (ms === null || ms === undefined) return '—';
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const min = Math.floor(total / 60), sec = total % 60;
    return `${min}:${String(sec).padStart(2,'0')}`;
  }
  function renderLeaderboard(rows, gameKey) {
    els.leaderboardContent.replaceChildren();
    if (!rows.length) { els.leaderboardContent.append(E('p','muted','Nog geen resultaten.')); return; }
    const table=E('table','stats-table');
    const columns=gameKey==='blackjack'?['#','Speler','Chips']:gameKey==='solitaire'?['#','Speler','Wins','Beste']:['#','Speler','Games','Wins','Winrate'];
    const head=E('tr');columns.forEach(x=>head.append(E('th','',x)));
    table.append(head);
    rows.forEach((row,index)=>{
      const tr=E('tr');
      tr.append(E('td','',String(index+1)));
      const td=E('td'); const link=E('button','profile-link',row.username); link.type='button'; link.onclick=()=>{setRoute(`/profile/${encodeURIComponent(row.username)}`);showProfile(row.username)};td.append(link);tr.append(td);
      if(gameKey==='blackjack')tr.append(E('td','',String(row.chips)));
      else if(gameKey==='solitaire')tr.append(E('td','',String(row.wins)),E('td','',row.bestSolitaireMoves?`${row.bestSolitaireMoves} zetten`:'—'));
      else tr.append(E('td','',String(row.games)),E('td','',String(row.wins)),E('td','',`${row.winRate||0}%`));
      table.append(tr);
    });
    els.leaderboardContent.append(table);
  }
  function renderProfile(profile) {
    const {user,totals,perGame,recent}=profile;
    els.profileUsername.textContent=user.username;
    els.profileSummary.textContent=`${totals.games} games · ${totals.wins} wins · ${totals.winRate}% winrate`;
    els.profileGames.replaceChildren();
    if(!perGame.length) els.profileGames.append(E('p','muted','Nog geen gespeelde matches.'));
    else {
      const table=E('table','stats-table'); const head=E('tr'); ['Game','Games','Wins','Winrate','Extra'].forEach(x=>head.append(E('th','',x)));table.append(head);
      perGame.forEach(g=>{const tr=E('tr');let extra='—';if(g.gameKey==='solitaire'&&g.bestTimeMs)extra=`Beste: ${formatDuration(g.bestTimeMs)} · ${g.bestMoves} zetten`;tr.append(E('td','',GAME_NAMES[g.gameKey]||g.gameKey),E('td','',String(g.games)),E('td','',String(g.wins)),E('td','',`${g.winRate||0}%`),E('td','',extra));table.append(tr)});
      els.profileGames.append(table);
    }
    els.profileRecent.replaceChildren();
    if(!recent.length) els.profileRecent.append(E('p','muted','Nog geen match history.'));
    recent.forEach(m=>{const item=E('div','recent-match');const d=new Date(Number(m.endedAt));item.append(E('strong','',GAME_NAMES[m.gameKey]||m.gameKey),E('span','',m.won?'Winst':m.outcome||'Match'),E('small','',`${d.toLocaleDateString('nl-BE')} ${d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}${m.durationMs?` · ${formatDuration(m.durationMs)}`:''}`));els.profileRecent.append(item)});
  }
  async function loadHeadToHead(username,gameKey=''){
    els.headToHeadContent.replaceChildren(E('p','muted','Laden…'));
    try{
      const response=await fetch(`/api/profile/${encodeURIComponent(username)}/head-to-head${gameKey?`?game=${encodeURIComponent(gameKey)}`:''}`,{cache:'no-store'});
      const data=await response.json();
      if(!data.ok)throw new Error(data.error||'Vergelijking kon niet geladen worden.');
      if(state.viewedProfileUsername!==username)return;
      if(!els.headToHeadGame.dataset.loaded){
        data.games.forEach(game=>{const option=document.createElement('option');option.value=game.key;option.textContent=game.name;els.headToHeadGame.append(option)});
        els.headToHeadGame.dataset.loaded='1';
      }
      const comparison=data.comparison;els.headToHeadContent.replaceChildren();
      if(!comparison.games){els.headToHeadContent.append(E('p','muted','Jullie hebben nog geen onderlinge matches gespeeld.'));return}
      const score=E('div','head-to-head-score');
      const mine=E('div','head-to-head-side');mine.append(E('strong','',String(comparison.viewerWins)),E('span','',state.authUser.username));
      const middle=E('div','head-to-head-middle');middle.append(E('span','','—'),E('small','',`${comparison.games} matches${comparison.draws?` · ${comparison.draws} gelijk`:''}`));
      const theirs=E('div','head-to-head-side');theirs.append(E('strong','',String(comparison.opponentWins)),E('span','',comparison.opponent.username));
      score.append(mine,middle,theirs);els.headToHeadContent.append(score);
    }catch(error){els.headToHeadContent.replaceChildren(E('p','muted',error.message))}
  }
  async function loadAuth() {
    try {
      const response=await fetch('/api/auth/me',{cache:'no-store'});
      const data=await response.json();
      state.authUser=data.user||null; state.authStats=data.stats||null; updateIdentityUi();
    } catch { state.authUser=null; state.authStats=null; updateIdentityUi(); }
  }
  function openAccount() {
    els.accountModal.classList.remove('hidden');els.accountModal.setAttribute('aria-hidden','false');
    const loggedIn=Boolean(state.authUser);
    els.loggedOutAccount.classList.toggle('hidden',loggedIn);els.loggedInAccount.classList.toggle('hidden',!loggedIn);
    if(loggedIn){els.accountUsername.textContent=state.authUser.username;els.accountGames.textContent=state.authStats?.games||0;els.accountWins.textContent=state.authStats?.wins||0;els.accountWinRate.textContent=`${state.authStats?.winRate||0}%`}
  }
  function closeAccount(){els.accountModal.classList.add('hidden');els.accountModal.setAttribute('aria-hidden','true')}
  async function authPost(url,payload){
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();if(!data.ok)throw new Error(data.error||'Actie mislukt.');return data;
  }

  function renderRoom(room) {
    const expected = state.expectedRoomId || getRoomFromPath();
    if (state.roomStateBlocked || !expected || room.id !== expected) return;
    state.expectedRoomId = room.id;
    const previous=state.previousRoom;
    handleRoomEffects(previous,room);
    if(state.renderedRoomId!==room.id){state.renderedRoomId=room.id;state.renderedGameRevision=-1;state.scoreMemory={};}
    state.room = room; state.previousRoom=room; rememberRecentGame(room.gameKey); showRoom();
    document.body.classList.toggle('minigolf-mode', room.gameKey==='minigolf' && room.status!=='lobby');
    els.roomGameName.textContent = room.gameMeta.name.toUpperCase(); els.roomCodeHeading.textContent = room.id; els.shareLink.value = `${location.origin}/room/${room.id}`;
    const solitaireRoom=room.gameKey==='solitaire';
    els.roomFooterMeta.classList.toggle('hidden',solitaireRoom);els.roomShareBox.classList.toggle('hidden',solitaireRoom);els.roomShareFooter.classList.toggle('solo-footer',solitaireRoom);
    const canRematch = room.gameKey !== 'blackjack' && room.status !== 'lobby' && room.gameState?.gameOver && room.isHost;
    els.roomRematchButton.classList.toggle('hidden', !canRematch);
    if(!canRematch){els.roomRematchButton.disabled=false;els.roomRematchButton.textContent='Rematch'}
    els.roomLayout.classList.toggle('solo', room.gameMeta.solo); els.chatPanel.classList.toggle('hidden', room.gameMeta.solo);
    renderChat(room.messages || []);
    if (room.status === 'lobby') {
      els.lobbySection.classList.remove('hidden'); els.gameSection.classList.add('hidden'); renderLobby(room);
      state.renderedGameRevision=-1;
    } else {
      els.lobbySection.classList.add('hidden'); els.gameSection.classList.remove('hidden');
      if(state.renderedGameRevision!==room.gameRevision){
        gameUi.renderGame(room);state.renderedGameRevision=room.gameRevision;
      }
    }
  }

  function renderLobby(room) {
    const meta = room.gameMeta; els.playerCountBadge.textContent = `${room.players.length}/${meta.maxPlayers}`; els.hostControls.classList.toggle('hidden', !room.isHost);
    els.lobbyPlayers.replaceChildren();
    room.players.forEach((p) => {
      const row = E('div','lobby-player'); const dot = E('span',`player-dot ${p.connected ? 'connected' : ''}`); const info = E('div');
      const nameLine=E('div','player-name');nameLine.append(profileButton(p.name,p.registered));if(p.isMe)nameLine.append(document.createTextNode(' (jij)'));if(p.isHost)nameLine.append(document.createTextNode(' · host'));if(p.registered)nameLine.append(document.createTextNode(' · account'));
      info.append(nameLine, E('div','player-note',p.isNpc ? 'NPC' : p.connected ? 'verbonden' : 'offline'));
      const act = E('div');
      if (room.isHost && p.isNpc) { const rm = E('button','ghost','Verwijder'); rm.type='button'; rm.onclick=() => socket.emit('room:removeNpc',{playerId:p.id},handleAck); act.append(rm); }
      row.append(dot,info,act); els.lobbyPlayers.append(row);
    });
    const disconnected = room.players.find((p) => !p.isNpc && !p.connected);
    const enough = room.players.length >= meta.minPlayers && room.players.length <= meta.maxPlayers;
    els.startGameButton.disabled = !enough || Boolean(disconnected); els.addNpcButton.disabled = room.players.length >= meta.maxPlayers || !meta.supportsNpc;
    els.addNpcButton.classList.toggle('hidden', !meta.supportsNpc);
    els.startGameButton.textContent = `Start ${meta.name}`;
    if (room.isHost) {
      if (disconnected) els.lobbyHint.textContent = `Wachten tot ${disconnected.name} opnieuw verbonden is.`;
      else if (!enough) els.lobbyHint.textContent = meta.minPlayers === meta.maxPlayers ? `${meta.name} vereist exact ${meta.minPlayers} spelers. Voeg NPC's toe of deel de link.` : `${meta.name} vereist minstens ${meta.minPlayers} spelers.`;
      else els.lobbyHint.textContent = 'Klaar om te starten.';
    } else els.lobbyHint.textContent = 'Wachten tot de host start.';
  }





  function renderChat(messages) { const near=els.chatMessages.scrollHeight-els.chatMessages.scrollTop-els.chatMessages.clientHeight<80;els.chatMessages.replaceChildren();messages.forEach(m=>{const d=E('div',`chat-message ${m.type==='system'?'system':''}`);d.append(E('strong','',m.name),E('p','',m.text));els.chatMessages.append(d)});if(near||messages.length<4)els.chatMessages.scrollTop=els.chatMessages.scrollHeight; }
  function openRules(gameKey,stateName){const key=gameKey||state.room?.gameKey;if(!key)return;const name=stateName||state.room?.gameMeta?.name||GAME_NAMES[key]||key;els.rulesGameName.textContent=name.toUpperCase();els.rulesContent.innerHTML=RULES[key]||'<p>Geen regels beschikbaar.</p>';els.rulesModal.classList.remove('hidden');els.rulesModal.setAttribute('aria-hidden','false')}
  function closeRules(){els.rulesModal.classList.add('hidden');els.rulesModal.setAttribute('aria-hidden','true')}
  function leaveRoom(){
    state.roomStateBlocked=true;state.expectedRoomId=null;state.directRoomId=null;
    document.body.classList.remove('minigolf-mode');state.room=null;state.previousRoom=null;state.selection=null;state.renderedRoomId=null;state.renderedGameRevision=-1;
    history.replaceState({},'', '/');showHome();
    socket.emit('room:leave',{},()=>{state.roomStateBlocked=false});
  }
  function requestRematch(button){
    if(button){button.disabled=true;button.textContent='Starten…'}
    socket.emit('room:rematch',{},(response)=>{
      if(!response?.ok){if(button){button.disabled=false;button.textContent='Rematch'}return handleAck(response)}
      state.selection=null;state.hofAnimation=null;state.hofAnimatedRound=0;state.minigolfShotAnimation=null;state.renderedGameRevision=-1;
    });
  }
  function copyLink(){const v=els.shareLink.value;if(navigator.clipboard&&isSecureContext)navigator.clipboard.writeText(v).then(()=>toast('Roomlink gekopieerd.')).catch(()=>toast(v));else{els.shareLink.select();toast('Selecteer en kopieer de link.')}}

  socket.on('connect',()=>{
    const target=getRoomFromPath();
    if(target){state.expectedRoomId=target;state.roomStateBlocked=false;}
    if(target&&(state.authUser||state.guestName)) joinRoom(target);
    else if(isMinigolfEditorPath()) mapEditor.showMinigolfEditor();
    else if(isLobbyPath()) showOpenLobby();
    else if(isLeaderboardPath()) showLeaderboard(els.leaderboardGame.value||'');
    else { const profile=getProfileFromPath(); if(profile) showProfile(profile); else showHome(); }
  });
  socket.on('room:state',(room)=>renderRoom(room));
  socket.on('session:replaced',()=>toast('Deze speler is in een andere tab opnieuw verbonden.'));

  els.gameGrid.addEventListener('click',(e)=>{const info=e.target.closest('[data-rules-game]');if(info){openRules(info.dataset.rulesGame);return}const b=e.target.closest('.game-launch');if(b)createRoom(b.dataset.game)});
  els.minigolfEditorButton.onclick=()=>{if(state.room)return toast('Verlaat eerst de room.');setRoute('/minigolf/editor');mapEditor.showMinigolfEditor()};
  els.mapToolGrid.addEventListener('click',(e)=>{const b=e.target.closest('.map-tool');if(b&&!mapEditor.ensureMapEditor().testMode)mapEditor.selectEditorTool(b.dataset.tool)});
  els.newGolfMapButton.onclick=()=>{if(mapEditor.ensureMapEditor().dirty&&!confirm('Niet-opgeslagen wijzigingen wissen?'))return;mapEditor.resetEditorMap()};
  els.saveGolfMapButton.onclick=mapEditor.saveEditorMap;
  els.deleteMapObjectButton.onclick=mapEditor.editorDeleteSelection;
  els.testGolfMapButton.onclick=mapEditor.toggleEditorTest;
  els.resetGolfTestButton.onclick=mapEditor.resetEditorTest;
  [els.mapNameInput,els.mapDifficultySelect,els.mapMaxStrokesInput].forEach(input=>input.addEventListener('change',()=>{mapEditor.syncEditorMetaToMap();mapEditor.editorMarkDirty()}));
  mapEditor.bindMapCanvasEvents();
  els.joinInviteButton.onclick=()=>joinRoom(state.directRoomId);
  els.joinCodeForm.onsubmit=(e)=>{e.preventDefault();joinRoom(els.joinCode.value)};
  els.addNpcButton.onclick=()=>socket.emit('room:addNpc',{},handleAck);
  els.startGameButton.onclick=()=>socket.emit('room:start',{},handleAck);
  els.chatForm.onsubmit=(e)=>{e.preventDefault();const text=els.chatInput.value.trim();if(!text)return;socket.emit('chat:send',{text},(r)=>{if(!r?.ok)return handleAck(r);els.chatInput.value=''})};
  els.copyLinkButton.onclick=copyLink;
  els.headToHeadGame.onchange=()=>{if(state.viewedProfileUsername)loadHeadToHead(state.viewedProfileUsername,els.headToHeadGame.value)};
  els.roomRematchButton.onclick=()=>requestRematch(els.roomRematchButton);
  els.roomLeaveButton.onclick=leaveRoom;
  els.rulesButton.onclick=()=>openRules();
  els.closeRulesButton.onclick=closeRules;
  els.leaveButton.onclick=leaveRoom;
  els.rulesModal.onclick=(e)=>{if(e.target===els.rulesModal)closeRules()};

  els.mobilePlayButton.onclick=()=>{
    if(state.room)return leaveRoom();
    setRoute('/');showHome();
  };
  els.mobileLobbyButton.onclick=()=>{
    if(state.room)return toast('Verlaat eerst de room.');
    setRoute('/lobby');showOpenLobby();
  };
  els.mobileLeaderboardButton.onclick=()=>{
    if(state.room)return toast('Verlaat eerst de room.');
    setRoute('/leaderboard');showLeaderboard('');
  };
  els.mobileProfileButton.onclick=()=>{
    if(state.room)return toast('Verlaat eerst de room.');
    if(!state.authUser){openAccount();return}
    setRoute(`/profile/${encodeURIComponent(state.authUser.username)}`);
    showProfile(state.authUser.username);
  };

  els.lobbyBrowserButton.onclick=()=>{if(state.room)return toast('Verlaat eerst de room.');setRoute('/lobby');showOpenLobby()};
  els.refreshRoomsButton.onclick=loadOpenRooms;
  els.lobbyGuestName.oninput=()=>{if(!state.authUser){state.guestName=normalizeName(els.lobbyGuestName.value);els.lobbyIdentityText.textContent=state.guestName||'Guest'}};
  els.soundButton.onclick=()=>{state.soundMuted=!state.soundMuted;localStorage.setItem('minigames.soundMuted',state.soundMuted?'1':'0');updateSoundButton();if(!state.soundMuted){ensureAudio();sound('turn')}};
  els.installButton.onclick=async()=>{
    if(state.deferredInstallPrompt){
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice.catch(()=>null);
      state.deferredInstallPrompt=null;els.installButton.classList.add('hidden');return;
    }
    const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(isiOS?'Safari: Deel → Zet op beginscherm.':'Gebruik het browsermenu → App installeren / Toevoegen aan beginscherm.');
  };
  els.leaderboardButton.onclick=()=>{if(state.room)return toast('Verlaat eerst de room.');setRoute('/leaderboard');showLeaderboard('')};
  els.leaderboardGame.onchange=()=>{const game=els.leaderboardGame.value;showLeaderboard(game)};
  els.accountButton.onclick=openAccount;
  els.homeAccountButton.onclick=openAccount;
  els.closeAccountButton.onclick=closeAccount;
  els.accountModal.onclick=(e)=>{if(e.target===els.accountModal)closeAccount()};

  els.loginForm.onsubmit=async(e)=>{
    e.preventDefault();
    try{await authPost('/api/auth/login',{username:els.loginUsername.value,password:els.loginPassword.value});location.reload()}
    catch(error){toast(error.message)}
  };
  els.registerForm.onsubmit=async(e)=>{
    e.preventDefault();
    try{await authPost('/api/auth/register',{username:els.registerUsername.value,password:els.registerPassword.value});location.reload()}
    catch(error){toast(error.message)}
  };
  els.logoutButton.onclick=async()=>{
    try{await authPost('/api/auth/logout',{});location.reload()}catch(error){toast(error.message)}
  };
  els.myProfileButton.onclick=()=>{if(!state.authUser)return;closeAccount();setRoute(`/profile/${encodeURIComponent(state.authUser.username)}`);showProfile(state.authUser.username)};

  document.addEventListener('pointerdown',()=>ensureAudio(),{once:true});
  window.addEventListener('beforeinstallprompt',(event)=>{event.preventDefault();state.deferredInstallPrompt=event;updateInstallButtonVisibility()});
  window.addEventListener('appinstalled',()=>{state.deferredInstallPrompt=null;updateInstallButtonVisibility();toast('Pluto is geïnstalleerd.')});
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', updateInstallButtonVisibility);
  updateInstallButtonVisibility();
  if('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js?v=0.13.1', {
          updateViaCache:'none'
        });
        await registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({type:'SKIP_WAITING'});
        }

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          location.reload();
        });
      } catch (_) {}
    });
  }
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){closeRules();closeAccount()}});
  els.brandButton.onclick=()=>{
    if(state.room)return leaveRoom();
    setRoute('/');showHome();
  };
  addEventListener('resize',()=>{if(state.room?.gameState?.kind==='hofslag'&&!state.hofAnimation?.active){const b=document.querySelector('.hof-board');if(b)gameUi.renderHofBoard(b,state.room.gameState)}});
  addEventListener('popstate',()=>{
    const target=getRoomFromPath();
    if(!target&&state.room)return leaveRoom();
    if(target&&(!state.room||state.room.id!==target)){state.directRoomId=target;state.expectedRoomId=target;state.roomStateBlocked=false;if(state.authUser||state.guestName)joinRoom(target);else showHome();return}
    if(isMinigolfEditorPath()){mapEditor.showMinigolfEditor();return}
    if(isLobbyPath()){showOpenLobby();return}
    if(isLeaderboardPath()){showLeaderboard(els.leaderboardGame.value||'');return}
    const profile=getProfileFromPath();if(profile){showProfile(profile);return}
    showHome();
  });

  loadGamePlugins();
  loadAuth().then(()=>{
    if(!socket.connected) return;
    const target=getRoomFromPath();
    if(target){state.expectedRoomId=target;state.roomStateBlocked=false;}
    if(target&&(state.authUser||state.guestName)) joinRoom(target);
    else if(isMinigolfEditorPath()) mapEditor.showMinigolfEditor();
    else if(isLobbyPath()) showOpenLobby();
    else if(isLeaderboardPath()) showLeaderboard('');
    else {const profile=getProfileFromPath();if(profile)showProfile(profile);else showHome()}
  });
  showHome();
