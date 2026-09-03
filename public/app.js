import { createGameUi } from './js/game-ui.js?v=1.18.1';
import { createScreenWakeLock } from './js/screen-wake-lock.js?v=1.18.1';
const socket = window.io();
const screenWakeLock = createScreenWakeLock({ navigator, document, window });
  const $ = (id) => document.getElementById(id);
  const els = {};
  ['brandButton','lobbyBrowserButton','leaderboardButton','soundButton','installButton','accountButton','mobileNav','mobilePlayButton','mobileLobbyButton','mobileLeaderboardButton','mobileProfileButton','mobileGameHeader','mobileGameLeaveButton','mobileGameName','mobileGameMenuButton','mobileGameMenu','mobileGameRulesButton','mobileGameSoundButton','mobileGameLeaveMenuButton','rulesButton','homeView','lobbyBrowserView','leaderboardView','profileView','roomView','homeGuestBar','guestName','homeAccountButton','inviteBox','inviteText','joinInviteButton','resumeGameSection','resumeGames','homeOpenLobbiesSection','homeOpenLobbies','gamesHeading','gameGrid','lobbyIdentityBar','lobbyIdentityText','lobbyGuestWrap','lobbyGuestName','openRoomCount','openRoomsContent','leaderboardGame','leaderboardContent','profileUsername','profileSummary','profileGames','profileRecent','showRenameButton','renameForm','renameUsername','cancelRenameButton','headToHeadCard','headToHeadGame','headToHeadContent','roomLayout','lobbySection','gameSection','playerCountBadge','lobbyPlayers','gameLobbyOptions','hostControls','addNpcButton','startGameButton','lobbyHint','gameStage','gameResult','accountModal','closeAccountButton','loggedOutAccount','loggedInAccount','loginForm','loginUsername','loginPassword','showRegisterButton','showLoginButton','registerForm','registerUsername','registerPassword','accountUsername','accountGames','accountWins','accountWinRate','myProfileButton','logoutButton','rulesModal','rulesGameName','rulesContent','closeRulesButton','leaveGameModal','leaveGameTitle','leaveGamePromptText','cancelLeaveGameButton','confirmLeaveGameButton','toast'].forEach((id) => els[id] = $(id));

  const state = {
    room: null,
    directRoomId: getRoomFromPath(),
    token: getOrCreateToken(),
    guestName: localStorage.getItem('minigames.guestName') || '',
    toastTimer: null,
    selection: null,
    authUser: null,
    authStats: null,
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
    expectedRoomId: getRoomFromPath(),
    roomStateBlocked: false,
    activeGameBodyClass: null
  };
  els.guestName.value = state.guestName;
  function E(tag, cls, text) { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; }
  function getRoomFromPath() { const m = location.pathname.match(/^\/room\/([A-Za-z0-9]+)\/?$/); return m ? m[1].toUpperCase() : null; }
  function getProfileFromPath() { const m = location.pathname.match(/^\/profile\/([^/]+)\/?$/); return m ? decodeURIComponent(m[1]) : null; }
  function isLeaderboardPath() { return /^\/leaderboard\/?$/.test(location.pathname); }
  function isLobbyPath() { return /^\/lobby\/?$/.test(location.pathname); }
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
  function action(action, data = {}) { if (socket.connected) socket.emit('game:action', { action, data }, handleAck); }
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
  function setRoomChrome(active) {
    screenWakeLock.setActive(active && state.room?.status === 'playing');
    document.body.classList.toggle('room-active', active);
    if(!active)document.body.classList.remove('game-active');
    if(!active)closeMobileGameMenu();
  }
  function closeMobileGameMenu(){if(!els.mobileGameMenu)return;els.mobileGameMenu.classList.add('hidden');els.mobileGameMenuButton.setAttribute('aria-expanded','false')}
  function toggleMobileGameMenu(){const open=els.mobileGameMenu.classList.contains('hidden');els.mobileGameMenu.classList.toggle('hidden',!open);els.mobileGameMenuButton.setAttribute('aria-expanded',open?'true':'false')}
  function isStandaloneApp() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function updateInstallButtonVisibility() {
    const onStandalone = isStandaloneApp();
    document.body.classList.toggle('standalone-mode', onStandalone);
    els.installButton.classList.toggle('hidden', onStandalone);
  }
  function hideMainViews() {
    document.querySelectorAll('main > .view').forEach(view=>view.classList.add('hidden'));
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
    setRoomChrome(false);
    hideMainViews(); setMobileNavActive('play'); els.homeView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden');
    const target = getRoomFromPath(); state.directRoomId = target;
    els.inviteBox.classList.toggle('hidden', !target); if (target) els.inviteText.textContent = `Je bent uitgenodigd voor game ${target}`;
    updateIdentityUi();
    loadHomeOpenLobbies();
  }
  async function showOpenLobby() {
    setRoomChrome(false);
    hideMainViews(); setMobileNavActive('lobby'); els.lobbyBrowserView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden');
    updateIdentityUi();
    await loadOpenRooms();
    state.lobbyRefreshTimer = setInterval(loadOpenRooms, 5000);
  }
  function showRoom() {
    setRoomChrome(true);
    hideMainViews(); setMobileNavActive('play'); els.roomView.classList.remove('hidden');
    els.rulesButton.classList.remove('hidden');
  }
  async function showLeaderboard(gameKey = '') {
    setRoomChrome(false);
    hideMainViews(); setMobileNavActive('leaderboard'); els.leaderboardView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden');
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
    setRoomChrome(false);
    hideMainViews(); setMobileNavActive('profile'); els.profileView.classList.remove('hidden');
    els.rulesButton.classList.add('hidden');
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
  function updateHomeGamesHeading() {
    const hasExtraSections=!els.resumeGameSection.classList.contains('hidden')||!els.homeOpenLobbiesSection.classList.contains('hidden');
    els.gamesHeading.classList.toggle('hidden',!hasExtraSections);
  }
  async function loadHomeOpenLobbies() {
    try {
      const response=await fetch('/api/rooms',{cache:'no-store',headers:{'X-Pluto-Player-Token':state.token}});
      const data=await response.json();
      if(!data.ok)throw new Error(data.error||'Kon games niet laden.');
      renderHomeOpenLobbies((data.rooms||[]).filter(room=>room.joinable||room.canResume));
    } catch {
      renderHomeOpenLobbies([]);
    }
  }
  function renderHomeOpenLobbies(rooms) {
    const resumable=rooms.filter(room=>room.resumable&&room.canResume);
    const open=rooms.filter(room=>!resumable.includes(room));
    els.resumeGames.replaceChildren();
    els.resumeGameSection.classList.toggle('hidden',!resumable.length);
    resumable.forEach(room=>{
      const card=E('div','resume-game-card');
      const button=E('button','resume-game-button');button.type='button';
      const copy=E('span','resume-game-copy');copy.append(E('small','',room.gameName),E('strong','','Doorgaan met spelen'),E('span','',`Game ${room.id} · ${room.playerCount}/${room.maxPlayers} spelers`));
      button.append(copy,E('span','resume-game-arrow','→'));button.onclick=()=>joinRoom(room.id);card.append(button);
      const close=E('button','resume-game-close','×');close.type='button';close.setAttribute('aria-label',`${room.gameName} niet meer hervatten`);close.onclick=()=>{if(!socket.connected)return;close.disabled=true;socket.emit('room:close',{roomId:room.id,token:state.token},response=>{if(!response?.ok){close.disabled=false;return handleAck(response)}loadHomeOpenLobbies()})};card.append(close);
      els.resumeGames.append(card)
    });
    els.homeOpenLobbies.replaceChildren();
    els.homeOpenLobbiesSection.classList.toggle('hidden',!open.length);
    open.forEach(room=>{
      const button=E('button','recent-game-button home-open-lobby-button');
      button.type='button';
      button.append(E('strong','',room.gameName),E('span','',`${room.resumable?'Lopend · ':''}${room.playerCount}/${room.maxPlayers} spelers · ${room.hostName}`));
      button.onclick=()=>joinRoom(room.id);
      els.homeOpenLobbies.append(button);
    });
    updateHomeGamesHeading();
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
      const response=await fetch('/api/rooms',{cache:'no-store',headers:{'X-Pluto-Player-Token':state.token}});
      const data=await response.json();
      if(!data.ok)throw new Error(data.error||'Kon games niet laden.');
      renderOpenRooms((data.rooms||[]).filter(room=>room.connectedHumanCount>0||room.canResume));
    } catch(error) {
      els.openRoomsContent.replaceChildren(E('div','panel',error.message));
    }
  }
  function renderOpenRooms(rooms) {
    els.openRoomCount.textContent=String(rooms.length);
    els.openRoomsContent.replaceChildren();
    if(!rooms.length){
      const empty=E('div','panel empty-rooms');
      empty.append(E('h3','','Geen open games'),E('p','muted','Maak zelf een game op Home, of wacht tot iemand een game opent.'));
      els.openRoomsContent.append(empty);return;
    }
    rooms.forEach(room=>{
      const card=E('article','open-room-card');
      const head=E('div','open-room-head');
      const left=E('div');
      left.append(E('span','eyebrow',room.gameName.toUpperCase()),E('h3','',`${room.resumable?'Lopend · ':''}Game ${room.id}`));
      head.append(left,E('span','badge',`${room.playerCount}/${room.maxPlayers}`));
      const players=E('div','open-room-players');
      room.playerNames.forEach(name=>players.append(E('span','open-room-player',name)));
      const meta=E('div','open-room-meta');
      meta.append(E('span','',`Host: ${room.hostName}`),E('span','',relativeAge(room.createdAt)));
      const canResume=Boolean(room.resumable&&room.canResume);
      const canEnter=room.joinable||canResume;
      const join=E('button',canEnter?'primary':'secondary',canResume?'Ga terug':room.resumable?'Lopend':room.joinable?'Join game':'Vol');
      join.type='button';join.disabled=!canEnter;
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
    if(els.mobileGameSoundButton){els.mobileGameSoundButton.textContent=muted?'Geluid aan':'Geluid uit';els.mobileGameSoundButton.setAttribute('aria-pressed',muted?'true':'false')}
  }
  function toggleSound(){state.soundMuted=!state.soundMuted;localStorage.setItem('minigames.soundMuted',state.soundMuted?'1':'0');updateSoundButton();if(!state.soundMuted){ensureAudio();sound('turn')}}
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
    state, els, E, action, profileButton, sound, socket, handleAck, cardNode, valueLabel, requestRematch, requestReturnToLobby
  });
  function handlePluginRoute(){return Object.values(state.gamePlugins).some(plugin=>plugin.handleRoute?.({path:location.pathname,state,setRoute,toast})===true)}
  function createRoom(gameKey) {
    const name = saveGuestName(); if (!name) return;
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
    const code = String(roomId || '').toUpperCase().replace(/[^A-Z0-9]/g,''); if (!code) return toast('Vul een gamecode in.');
    state.expectedRoomId = code;
    state.roomStateBlocked = false;
    socket.emit('room:join', { roomId: code, name, token: state.token }, (result) => {
      if (!result?.ok) { state.expectedRoomId=state.room?.id||null; return handleAck(result); }
      if (result.token && result.token !== state.token) { state.token = result.token; localStorage.setItem('minigames.token', state.token); }
      if (location.pathname !== `/room/${result.roomId}`) setRouteRoom(result.roomId);
    });
  }
  const GAME_NAMES = {}, RULES = {};
  async function loadGamePlugins(){
    try{
      const response=await fetch('/api/game-plugins',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();
      if(!data.ok)throw new Error(data.error||'Game-plugins konden niet laden.');
      for(const game of data.games||[]){
        let loadError=game.loadError?new Error(game.loadError):null;
        GAME_NAMES[game.key]=game.name;if(game.rules)RULES[game.key]=game.rules;
        if(game.styleUrl&&!document.querySelector(`link[data-game-plugin="${game.key}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=game.styleUrl;link.dataset.gamePlugin=game.key;document.head.append(link)}
        if(game.viewUrl){try{const viewResponse=await fetch(game.viewUrl);if(!viewResponse.ok)throw new Error(`HTTP ${viewResponse.status}`);const template=document.createElement('template');template.innerHTML=await viewResponse.text();document.querySelector('main').insertBefore(template.content,els.lobbyBrowserView)}catch(error){console.error(`Extra view van ${game.key} kon niet laden:`,error)}}
        if(game.clientUrl){try{const plugin=await import(game.clientUrl);gameUi.registerPlugin(game.key,plugin);state.gamePlugins[game.key]=plugin;plugin.mount?.({state,els,E,toast,openAccount,hideMainViews})}catch(error){loadError=error;console.error(`Game-plugin ${game.key} kon niet laden:`,error)}}
        if(!els.gameGrid.querySelector(`[data-game="${game.key}"]`)){
          const card=E('article','game-card'),icon=E('div','game-icon',game.icon),body=E('div','game-card-body'),titleRow=E('div','game-title-row');titleRow.append(E('h3','',game.name),E('span','badge',game.badge));
          const info=E('button','game-info','i');info.type='button';info.dataset.rulesGame=game.key;info.setAttribute('aria-label',`Spelregels van ${game.name}`);
          const launch=E('button','primary game-launch',game.actionLabel);launch.type='button';launch.dataset.game=game.key;
          if(loadError){launch.disabled=true;launch.textContent='Niet beschikbaar';card.classList.add('plugin-load-error');card.title=`${game.name} kon niet laden.`}
          if(game.toolLabel&&state.gamePlugins[game.key]?.openTool){const actions=E('div','game-card-actions'),tool=E('button','secondary',game.toolLabel);tool.type='button';tool.onclick=()=>state.gamePlugins[game.key].openTool({state,setRoute,toast});actions.append(launch,tool);body.append(titleRow,info,actions)}else body.append(titleRow,info,launch);
          card.append(icon,body);els.gameGrid.append(card)
        }
      }
      if(state.room?.gameState&&state.gamePlugins[state.room.gameKey]){state.renderedGameRevision=-1;gameUi.renderGame(state.room)}
    }catch(error){console.error('Game-plugins laden mislukt:',error);els.gameGrid.replaceChildren(E('div','plugin-error','Games konden niet geladen worden. Herlaad de pagina om opnieuw te proberen.'))}
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
    const plugin=state.gamePlugins[gameKey],columns=plugin?.leaderboardColumns||['#','Speler','Wins','Games','Winrate'];
    const shortLabels={'Speler':'Speler','Wins':'W','Games':'G','Winrate':'%','Chips':'Chips','Beste':'Beste'};
    const head=E('tr');columns.forEach(x=>{const th=E('th','',x);th.dataset.short=shortLabels[x]||x;head.append(th)});
    table.append(head);
    rows.forEach((row,index)=>{
      const tr=E('tr');
      tr.append(E('td','',String(index+1)));
      const td=E('td'); const link=E('button','profile-link',row.username); link.type='button'; link.onclick=()=>{setRoute(`/profile/${encodeURIComponent(row.username)}`);showProfile(row.username)};td.append(link);tr.append(td);
      const cells=plugin?.renderLeaderboardCells?.({row,E})||[E('td','',String(row.wins)),E('td','',String(row.games)),E('td','',`${row.winRate||0}%`)];tr.append(...cells);
      table.append(tr);
    });
    els.leaderboardContent.append(table);
  }
  function renderProfile(profile) {
    const {user,totals,perGame,recent}=profile;
    els.profileUsername.textContent=user.username;
    els.profileSummary.textContent=`${totals.games} games · ${totals.wins} wins · ${totals.winRate}% winrate`;
    const isOwnProfile=state.authUser?.id===user.id;
    els.showRenameButton.classList.toggle('hidden',!isOwnProfile);
    els.renameForm.classList.add('hidden');
    if(isOwnProfile)els.renameUsername.value=user.username;
    els.profileGames.replaceChildren();
    if(!perGame.length) els.profileGames.append(E('p','muted','Nog geen gespeelde matches.'));
    else {
      const table=E('table','stats-table'); const head=E('tr'); ['Game','Games','Wins','Winrate','Extra'].forEach(x=>head.append(E('th','',x)));table.append(head);
      perGame.forEach(g=>{const tr=E('tr'),extra=state.gamePlugins[g.gameKey]?.profileExtra?.({stat:g,formatDuration})||'—';tr.append(E('td','',GAME_NAMES[g.gameKey]||g.gameKey),E('td','',String(g.games)),E('td','',String(g.wins)),E('td','',`${g.winRate||0}%`),E('td','',extra));table.append(tr)});
      const mobile=E('div','profile-mobile-stats');
      perGame.forEach(g=>{
        const name=GAME_NAMES[g.gameKey]||g.gameKey,extra=state.gamePlugins[g.gameKey]?.profileExtra?.({stat:g,formatDuration})||'—';
        const row=E('article','profile-stat-row'),title=E('div','profile-stat-title'),values=E('div','profile-stat-values');
        title.append(E('strong','',name),E('small','',extra));
        [['Games',g.games],['Wins',g.wins],['Winrate',`${g.winRate||0}%`]].forEach(([label,value])=>{const stat=E('span');stat.append(E('small','',label),E('b','',String(value)));values.append(stat)});
        row.append(title,values);mobile.append(row)
      });
      els.profileGames.append(table,mobile);
    }
    els.profileRecent.replaceChildren();
    if(!recent.length) els.profileRecent.append(E('p','muted','Nog geen match history.'));
    else {
      const appendMatch=(m)=>{const item=E('div','recent-match');const d=new Date(Number(m.endedAt));item.append(E('strong','',GAME_NAMES[m.gameKey]||m.gameKey),E('span','',m.won?'Winst':m.outcome||'Match'),E('small','',`${d.toLocaleDateString('nl-BE')} ${d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'})}${m.durationMs?` · ${formatDuration(m.durationMs)}`:''}`));els.profileRecent.append(item)};
      recent.slice(0,5).forEach(appendMatch);
      if(recent.length>5){
        const more=E('button','secondary','Toon meer');more.type='button';
        more.onclick=()=>{recent.slice(5).forEach(appendMatch);more.remove()};
        els.profileRecent.append(more);
      }
    }
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
    finally { document.body.classList.remove('auth-pending');document.body.removeAttribute('aria-busy'); }
  }
  function openAccount() {
    els.accountModal.classList.remove('hidden');els.accountModal.setAttribute('aria-hidden','false');
    const loggedIn=Boolean(state.authUser);
    els.loggedOutAccount.classList.toggle('hidden',loggedIn);els.loggedInAccount.classList.toggle('hidden',!loggedIn);
    if(!loggedIn){els.loggedOutAccount.classList.remove('mobile-register-open');els.showRegisterButton.setAttribute('aria-expanded','false')}
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
    state.room = room; state.previousRoom=room; showRoom();
    const roomOptions=state.gamePlugins[room.gameKey]?.roomOptions||{},nextBodyClass=room.status!=='lobby'?roomOptions.bodyClass||null:null;if(state.activeGameBodyClass&&state.activeGameBodyClass!==nextBodyClass)document.body.classList.remove(state.activeGameBodyClass);state.activeGameBodyClass=nextBodyClass;if(state.activeGameBodyClass)document.body.classList.add(state.activeGameBodyClass);
    document.body.classList.toggle('game-active',room.status!=='lobby');
    els.mobileGameName.textContent=room.gameMeta?.name||GAME_NAMES[room.gameKey]||'Spel';
    if (room.status === 'lobby') {
      if(previous?.status !== 'lobby'){
        state.selection=null;state.scoreMemory={};gameUi.resetRoom();
        els.gameStage.replaceChildren();els.gameResult.replaceChildren();
        els.gameResult.classList.add('hidden');els.gameResult.setAttribute('aria-hidden','true');
      }
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
      if (room.isHost && !p.isMe) { const rm = E('button','ghost','Verwijder'); rm.type='button'; rm.setAttribute('aria-label',`${p.name} verwijderen`);rm.onclick=() => {if(socket.connected)socket.emit('room:removePlayer',{playerId:p.id},handleAck)}; act.append(rm); }
      row.append(dot,info,act); els.lobbyPlayers.append(row);
    });
    els.gameLobbyOptions.replaceChildren();state.gamePlugins[room.gameKey]?.renderLobbyOptions?.({room,container:els.gameLobbyOptions,E,socket,handleAck});
    const disconnected = room.players.find((p) => !p.isNpc && !p.connected);
    const enough = room.players.length >= meta.minPlayers && room.players.length <= meta.maxPlayers;
    els.startGameButton.disabled = !enough || Boolean(disconnected); els.addNpcButton.disabled = room.players.length >= meta.maxPlayers || !meta.supportsNpc;
    els.addNpcButton.classList.toggle('hidden', !meta.supportsNpc);
    els.startGameButton.textContent = `Start ${meta.name}`;
    if (room.isHost) {
      if (disconnected) els.lobbyHint.textContent = `Wachten tot ${disconnected.name} opnieuw verbonden is.`;
      else if (!enough) els.lobbyHint.textContent = meta.minPlayers === meta.maxPlayers ? `${meta.name} vereist exact ${meta.minPlayers} spelers. Voeg NPC's toe.` : `${meta.name} vereist minstens ${meta.minPlayers} spelers.`;
      else els.lobbyHint.textContent = 'Klaar om te starten.';
    } else els.lobbyHint.textContent = 'Wachten tot de host start.';
  }
  function openRules(gameKey,stateName){const key=gameKey||state.room?.gameKey;if(!key)return;const name=stateName||state.room?.gameMeta?.name||GAME_NAMES[key]||key;els.rulesGameName.textContent=name.toUpperCase();els.rulesContent.innerHTML=RULES[key]||'<p>Geen regels beschikbaar.</p>';els.rulesModal.classList.remove('hidden');els.rulesModal.setAttribute('aria-hidden','false')}
  function closeRules(){els.rulesModal.classList.add('hidden');els.rulesModal.setAttribute('aria-hidden','true')}
  function closeLeavePrompt(){els.leaveGameModal.classList.add('hidden');els.leaveGameModal.setAttribute('aria-hidden','true')}
  function requestLeaveRoom(){if(!state.room)return false;closeMobileGameMenu();if(getRoomFromPath()!==state.room.id)history.pushState({},'',`/room/${state.room.id}`);const active=state.room.status!=='lobby',name=state.room.gameMeta?.name||GAME_NAMES[state.room.gameKey]||'dit spel';els.leaveGameTitle.textContent=active?'Spel verlaten?':'Game verlaten?';els.leaveGamePromptText.textContent=active?`Weet je zeker dat je ${name} wilt verlaten? Je kunt een lopend spel later via de lobby hervatten.`:`Weet je zeker dat je de game van ${name} wilt verlaten?`;els.leaveGameModal.classList.remove('hidden');els.leaveGameModal.setAttribute('aria-hidden','false');requestAnimationFrame(()=>els.cancelLeaveGameButton.focus());return false}
  function leaveRoom({confirmed=false,removed=false}={}){
    if(state.room&&!confirmed)return requestLeaveRoom();
    closeLeavePrompt();
    state.roomStateBlocked=true;state.expectedRoomId=null;state.directRoomId=null;
    closeRules();gameUi.resetRoom();els.gameResult.classList.add('hidden');
    if(state.activeGameBodyClass)document.body.classList.remove(state.activeGameBodyClass);state.activeGameBodyClass=null;state.room=null;state.previousRoom=null;state.selection=null;state.renderedRoomId=null;state.renderedGameRevision=-1;
    history.replaceState({},'', '/');showHome();
    if(removed)return true;
    socket.emit('room:leave',{},()=>{state.roomStateBlocked=false;if(!els.homeView.classList.contains('hidden'))loadHomeOpenLobbies()});return true;
  }
  function requestRematch(button){
    if(!socket.connected)return;
    if(button){button.disabled=true;button.textContent='Starten…'}
    socket.emit('room:rematch',{},(response)=>{
      if(!response?.ok){if(button){button.disabled=false;button.textContent='Rematch'}return handleAck(response)}
      state.selection=null;gameUi.resetRoom();state.renderedGameRevision=-1;
    });
  }
  function requestReturnToLobby(button){
    if(!socket.connected)return;
    if(button)button.disabled=true;
    socket.emit('room:returnToLobby',{},response=>{
      if(!response?.ok){if(button)button.disabled=false;handleAck(response)}
    });
  }
  socket.on('connect',()=>{
    const target=getRoomFromPath();
    if(target){state.expectedRoomId=target;state.roomStateBlocked=false;}
    if(target&&(state.authUser||state.guestName)) joinRoom(target);
    else if(handlePluginRoute()) return;
    else if(isLobbyPath()) showOpenLobby();
    else if(isLeaderboardPath()) showLeaderboard(els.leaderboardGame.value||'');
    else { const profile=getProfileFromPath(); if(profile) showProfile(profile); else showHome(); }
  });
  socket.on('room:state',(room)=>renderRoom(room));
  socket.on('room:removed',({roomId})=>{
    if(roomId!==state.expectedRoomId&&roomId!==state.room?.id)return;
    leaveRoom({confirmed:true,removed:true});toast('De host heeft je uit de lobby verwijderd.');
  });
  socket.on('session:replaced',()=>toast('Deze speler is in een andere tab opnieuw verbonden.'));

  els.gameGrid.addEventListener('click',(e)=>{const info=e.target.closest('[data-rules-game]');if(info){openRules(info.dataset.rulesGame);return}const b=e.target.closest('.game-launch');if(b)createRoom(b.dataset.game)});
  els.joinInviteButton.onclick=()=>joinRoom(state.directRoomId);
  els.addNpcButton.onclick=()=>socket.emit('room:addNpc',{},handleAck);
  els.startGameButton.onclick=()=>socket.emit('room:start',{},handleAck);
  els.headToHeadGame.onchange=()=>{if(state.viewedProfileUsername)loadHeadToHead(state.viewedProfileUsername,els.headToHeadGame.value)};
  els.rulesButton.onclick=()=>openRules();
  els.mobileGameRulesButton.onclick=()=>{closeMobileGameMenu();openRules()};
  els.mobileGameMenuButton.onclick=(event)=>{event.stopPropagation();toggleMobileGameMenu()};
  els.mobileGameLeaveButton.onclick=()=>leaveRoom();
  els.mobileGameLeaveMenuButton.onclick=()=>{closeMobileGameMenu();leaveRoom()};
  els.closeRulesButton.onclick=closeRules;
  els.rulesModal.onclick=(e)=>{if(e.target===els.rulesModal)closeRules()};
  els.cancelLeaveGameButton.onclick=closeLeavePrompt;
  els.confirmLeaveGameButton.onclick=()=>leaveRoom({confirmed:true});
  els.leaveGameModal.onclick=(e)=>{if(e.target===els.leaveGameModal)closeLeavePrompt()};

  els.mobilePlayButton.onclick=()=>{
    if(state.room)return leaveRoom();
    setRoute('/');showHome();
  };
  els.mobileLobbyButton.onclick=()=>{
    if(state.room)return toast('Verlaat eerst de game.');
    setRoute('/lobby');showOpenLobby();
  };
  els.mobileLeaderboardButton.onclick=()=>{
    if(state.room)return toast('Verlaat eerst de game.');
    setRoute('/leaderboard');showLeaderboard('');
  };
  els.mobileProfileButton.onclick=()=>{
    if(state.room)return toast('Verlaat eerst de game.');
    if(!state.authUser){openAccount();return}
    setRoute(`/profile/${encodeURIComponent(state.authUser.username)}`);
    showProfile(state.authUser.username);
  };

  els.lobbyBrowserButton.onclick=()=>{if(state.room)return toast('Verlaat eerst de game.');setRoute('/lobby');showOpenLobby()};
  els.lobbyGuestName.oninput=()=>{if(!state.authUser){state.guestName=normalizeName(els.lobbyGuestName.value);els.lobbyIdentityText.textContent=state.guestName||'Guest'}};
  els.soundButton.onclick=toggleSound;
  els.mobileGameSoundButton.onclick=()=>{toggleSound();closeMobileGameMenu()};
  els.installButton.onclick=async()=>{
    if(state.deferredInstallPrompt){
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice.catch(()=>null);
      state.deferredInstallPrompt=null;els.installButton.classList.add('hidden');return;
    }
    const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(isiOS?'Safari: Deel → Zet op beginscherm.':'Gebruik het browsermenu → App installeren / Toevoegen aan beginscherm.');
  };
  els.leaderboardButton.onclick=()=>{if(state.room)return toast('Verlaat eerst de game.');setRoute('/leaderboard');showLeaderboard('')};
  els.leaderboardGame.onchange=()=>{const game=els.leaderboardGame.value;showLeaderboard(game)};
  els.accountButton.onclick=openAccount;
  els.homeAccountButton.onclick=openAccount;
  els.closeAccountButton.onclick=closeAccount;
  els.accountModal.onclick=(e)=>{if(e.target===els.accountModal)closeAccount()};
  els.showRegisterButton.onclick=()=>{els.loggedOutAccount.classList.add('mobile-register-open');els.showRegisterButton.setAttribute('aria-expanded','true');els.registerUsername.focus()};
  els.showLoginButton.onclick=()=>{els.loggedOutAccount.classList.remove('mobile-register-open');els.showRegisterButton.setAttribute('aria-expanded','false');els.loginUsername.focus()};

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
  els.showRenameButton.onclick=()=>{els.showRenameButton.classList.add('hidden');els.renameForm.classList.remove('hidden');els.renameUsername.value=state.authUser?.username||'';els.renameUsername.focus()};
  els.cancelRenameButton.onclick=()=>{els.renameForm.classList.add('hidden');els.showRenameButton.classList.remove('hidden')};
  els.renameForm.onsubmit=async(e)=>{
    e.preventDefault();
    const submit=els.renameForm.querySelector('[type="submit"]');submit.disabled=true;
    try{
      const response=await fetch('/api/account/username',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:els.renameUsername.value})});
      const data=await response.json();if(!data.ok)throw new Error(data.error||'Naam wijzigen mislukt.');
      state.authUser=data.user;history.replaceState({},'',`/profile/${encodeURIComponent(data.user.username)}`);location.reload();
    }catch(error){submit.disabled=false;toast(error.message)}
  };

  document.addEventListener('pointerdown',()=>ensureAudio(),{once:true});
  document.addEventListener('click',(event)=>{if(!els.mobileGameHeader.contains(event.target))closeMobileGameMenu()});
  window.addEventListener('beforeunload',(event)=>{if(state.room){event.preventDefault();event.returnValue=''}});
  window.addEventListener('beforeinstallprompt',(event)=>{event.preventDefault();state.deferredInstallPrompt=event;updateInstallButtonVisibility()});
  window.addEventListener('appinstalled',()=>{state.deferredInstallPrompt=null;updateInstallButtonVisibility();toast('Pluto is geïnstalleerd.')});
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', updateInstallButtonVisibility);
  updateInstallButtonVisibility();
  if('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js?v=1.18.1', {
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
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){closeMobileGameMenu();closeRules();closeAccount();closeLeavePrompt()}});
  els.brandButton.onclick=()=>{
    if(state.room)return leaveRoom();
    setRoute('/');showHome();
  };
  addEventListener('resize',()=>gameUi.onResize());
  addEventListener('popstate',()=>{
    const target=getRoomFromPath();
    if(!target&&state.room)return leaveRoom();
    if(target&&(!state.room||state.room.id!==target)){state.directRoomId=target;state.expectedRoomId=target;state.roomStateBlocked=false;if(state.authUser||state.guestName)joinRoom(target);else showHome();return}
    if(handlePluginRoute())return;
    if(isLobbyPath()){showOpenLobby();return}
    if(isLeaderboardPath()){showLeaderboard(els.leaderboardGame.value||'');return}
    const profile=getProfileFromPath();if(profile){showProfile(profile);return}
    showHome();
  });

  Promise.all([loadGamePlugins(),loadAuth()]).then(()=>{
    if(!socket.connected) return;
    const target=getRoomFromPath();
    if(target){state.expectedRoomId=target;state.roomStateBlocked=false;}
    if(target&&(state.authUser||state.guestName)) joinRoom(target);
    else if(handlePluginRoute()) return;
    else if(isLobbyPath()) showOpenLobby();
    else if(isLeaderboardPath()) showLeaderboard('');
    else {const profile=getProfileFromPath();if(profile)showProfile(profile);else showHome()}
  });
