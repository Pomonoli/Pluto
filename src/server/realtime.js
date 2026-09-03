'use strict';

const crypto = require('node:crypto');
const { getGame } = require('../games');
const authDb = require('../db');
const { resultsForGame } = require('../results');
const { chooseNpcName } = require('../npc-names');

const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const HOST_GRACE_MS = 15 * 1000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRealtime(io) {
  const rooms = new Map();

  function makeId() { return crypto.randomUUID(); }

  function makeRoomCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      let code = '';
      for (let i = 0; i < 5; i += 1) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
    throw new Error('Kon geen vrije gamecode genereren.');
  }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function sanitizeName(value) {
    return String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  }

  function sanitizeMessage(value) {
    return String(value || '').normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 300);
  }

  function normalizeToken(value) {
    const token = String(value || '').trim();
    return /^[A-Za-z0-9_-]{16,100}$/.test(token) ? token : crypto.randomUUID();
  }

  function touch(room) { room.updatedAt = Date.now(); }

  function getHumanByToken(room, token) {
    return room.players.find((p) => !p.isNpc && !p.hasLeft && p.token === token);
  }

  function getHumanByUserId(room, userId) {
    if (!userId) return null;
    return room.players.find((p) => !p.isNpc && !p.hasLeft && p.userId === userId);
  }

  function getPlayerForSocket(socket) {
    const room = socket.data.roomId ? rooms.get(socket.data.roomId) : null;
    const player = room ? getHumanByToken(room, socket.data.token) : null;
    return { room, player: player?.socketId === socket.id ? player : null };
  }

  function connectedMap(room) {
    return new Map(room.players.map((p) => [p.id, p.isNpc || p.connected]));
  }

  function addSystemMessage(room, text) {
    room.messages.push({ id: makeId(), type: 'system', name: 'Systeem', text, at: Date.now() });
    if (room.messages.length > 80) room.messages = room.messages.slice(-80);
  }

  function gameModule(room) { return getGame(room.gameKey); }

  function openRoomSummaries({token=null,userId=null}={}) {
    return [...rooms.values()]
      .filter((room) => {
        const meta = gameModule(room).meta;
        const humans=room.players.filter((p)=>!p.isNpc&&!p.hasLeft);
        const publiclyVisible=!meta.solo&&humans.some((p)=>p.connected);
        const ownedResumable=room.status!=='lobby'&&humans.some((p)=>
          (token&&p.token===token)||(userId&&p.userId===userId)
        );
        return ['lobby','playing','finished'].includes(room.status)&&(publiclyVisible||ownedResumable);
      })
      .map((room) => {
        const meta = gameModule(room).meta;
        const humans = room.players.filter((p) => !p.isNpc && !p.hasLeft);
        const connectedHumans = humans.filter((p) => p.connected);
        const npcs = room.players.filter((p) => p.isNpc);
        const host = room.players.find((p) => !p.isNpc && p.token === room.hostToken);
        return {
          id: room.id,
          gameKey: room.gameKey,
          gameName: meta.name,
          minPlayers: meta.minPlayers,
          maxPlayers: meta.maxPlayers,
          playerCount: room.players.length,
          humanCount: humans.length,
          npcCount: npcs.length,
          status: room.status,
          joinable: room.status === 'lobby' && humans.length < meta.maxPlayers,
          resumable: room.status !== 'lobby',
          canResume: Boolean(humans.some((p)=>(token&&p.token===token)||(userId&&p.userId===userId))),
          connectedHumanCount: connectedHumans.length,
          hostName: host?.name || connectedHumans[0]?.name || 'Onbekend',
          playerNames: room.players.map((p) => p.name),
          createdAt: room.createdAt,
          updatedAt: room.updatedAt
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function allHumansConnected(room) {
    return room.players.filter((p) => !p.isNpc).every((p) => p.connected);
  }

  function serializeRoom(room, requesterToken) {
    const me = getHumanByToken(room, requesterToken);
    const module = gameModule(room);

    return {
      id: room.id,
      gameKey: room.gameKey,
      gameMeta: module.meta,
      status: room.status,
      gameRevision: room.gameRevision || 0,
      gameOptions: room.gameOptions || {},
      isHost: Boolean(me && me.token === room.hostToken),
      meId: me?.id || null,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isNpc: p.isNpc,
        registered: Boolean(p.userId),
        connected: p.isNpc || p.connected,
        isHost: !p.isNpc && p.token === room.hostToken,
        isMe: Boolean(me && me.id === p.id)
      })),
      messages: room.messages,
      gameState: room.gameState ? module.serialize(room.gameState, me?.id || null, connectedMap(room)) : null
    };
  }

  function broadcastRoom(room) {
    touch(room);
    for (const p of room.players) {
      if (p.isNpc || !p.socketId) continue;
      io.to(p.socketId).emit('room:state', serializeRoom(room, p.token));
    }
  }

  function setSocketPlayer(socket, room, player) {
    if (player.socketId && player.socketId !== socket.id) {
      io.to(player.socketId).emit('session:replaced');
      const oldSocket = io.sockets.sockets.get(player.socketId);
      if (oldSocket) oldSocket.leave(room.id);
    }

    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
    socket.data.roomId = room.id;
    socket.data.token = player.token;
    socket.join(room.id);
  }

  function promoteHostIfNeeded(room) {
    if (getHumanByToken(room, room.hostToken)) return;
    const humans = room.players.filter((p) => !p.isNpc && !p.hasLeft);
    room.hostToken = (humans.find((p) => p.connected) || humans[0])?.token || null;
    room.gameRevision = (room.gameRevision || 0) + 1;
  }

  function removeLobbyHuman(room, player) {
    room.players = room.players.filter((p) => p.id !== player.id);
    promoteHostIfNeeded(room);

    if (!room.players.some((p) => !p.isNpc)) {
      rooms.delete(room.id);
      return true;
    }
    return false;
  }

  function leaveCurrentRoom(socket, explicit = false) {
    const { room, player } = getPlayerForSocket(socket);
    if (!room || !player) {
      socket.data.roomId = null;
      socket.data.token = null;
      return;
    }

    if (player.socketId === socket.id) {
      player.socketId = null;
      player.connected = false;
      player.disconnectedAt = Date.now();
    }

    socket.leave(room.id);

    if (explicit && room.status === 'lobby') {
      const deleted = removeLobbyHuman(room, player);
      if (!deleted) broadcastRoom(room);
    } else {
      broadcastRoom(room);
    }

    socket.data.roomId = null;
    socket.data.token = null;
  }

  function ackError(ack, message) {
    if (typeof ack === 'function') ack({ ok: false, error: message });
  }

  function playerIdentity(socket, payload) {
    const authUser = socket.data.authUser;
    if (authUser) {
      return { name: authUser.username, userId: authUser.id };
    }

    const name = sanitizeName(payload.name);
    if (name.length < 2) throw new Error('Gebruik een naam van minstens 2 tekens.');
    return { name, userId: null };
  }

  function maybeRecordMatch(room) {
    if (!room.gameState?.gameOver || room.matchRecorded) return;

    const humanCount = room.players.filter((player) => !player.isNpc).length;
    if (humanCount < 2 && !gameModule(room).meta.solo) {
      // Practice matches (one human + NPCs) never affect persistent stats/leaderboards.
      // True solo games, such as Solitaire, do count.
      room.matchRecorded = true;
      return;
    }

    const durationMs = room.startedAt ? Math.max(0, Date.now() - room.startedAt) : null;
    const results = resultsForGame(room.gameKey, room.gameState, durationMs);
    const resultByPlayer = new Map(results.map((r) => [r.playerId, r]));

    const players = room.players.map((roomPlayer) => {
      const result = resultByPlayer.get(roomPlayer.id) || {};
      return {
        userId: roomPlayer.userId || null,
        displayName: roomPlayer.name,
        placement: result.placement,
        score: result.score,
        won: Boolean(result.won),
        draw: Boolean(result.draw),
        outcome: result.outcome || null,
        durationMs: result.durationMs ?? null,
        moves: result.moves ?? null
      };
    });

    authDb.recordMatch({
      gameKey: room.gameKey,
      roomId: room.id,
      startedAt: room.startedAt,
      endedAt: Date.now(),
      players
    });

    room.matchRecorded = true;
  }

  function runGameHook(room){gameModule(room).afterStateChange?.(room,{db:authDb})}

  function startGame(room) {
    const module = gameModule(room);
    const { minPlayers, maxPlayers } = module.meta;

    if (room.players.length < minPlayers || room.players.length > maxPlayers) {
      throw new Error(
        minPlayers === maxPlayers
          ? `${module.meta.name} vereist exact ${minPlayers} speler${minPlayers === 1 ? '' : 's'}.`
          : `${module.meta.name} vereist ${minPlayers}-${maxPlayers} spelers.`
      );
    }

    if (!allHumansConnected(room)) throw new Error('Niet alle spelers zijn verbonden.');

    const gamePlayers = module.preparePlayers?.(room.players,{db:authDb}) || room.players;
    room.gameState = module.createGame(gamePlayers, room.gameOptions || {});
    room.status = room.gameState.gameOver ? 'finished' : 'playing';
    room.startedAt = Date.now();
    room.matchRecorded = false;
    room.gameRevision = (room.gameRevision || 0) + 1;

    addSystemMessage(room, `${module.meta.name} is gestart.`);
    maybeRecordMatch(room);
  }

  io.use((socket, next) => {
    try {
      socket.data.authUser = authDb.getUserFromCookieHeader(socket.handshake.headers.cookie);
      next();
    } catch (error) {
      console.error('Socket auth error', error);
      next();
    }
  });

  io.on('connection', (socket) => {
    socket.on('room:create', (payload = {}, ack) => {
      try {
        leaveCurrentRoom(socket, true);

        const identity = playerIdentity(socket, payload);
        const module = getGame(payload.gameKey);
        if (!module) return ackError(ack, 'Onbekend spel.');

        const token = normalizeToken(payload.token);
        const roomId = makeRoomCode();

        const player = {
          id: makeId(),
          token,
          name: identity.name,
          userId: identity.userId,
          isNpc: false,
          socketId: socket.id,
          connected: true
        };

        const room = {
          id: roomId,
          gameKey: module.meta.key,
          status: 'lobby',
          hostToken: token,
          players: [player],
          messages: [],
          gameState: null,
          gameOptions: typeof module.normalizeRoomOptions === 'function' ? module.normalizeRoomOptions({}) : {},
          startedAt: null,
          matchRecorded: false,
          gameRevision: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        rooms.set(roomId, room);
        setSocketPlayer(socket, room, player);
        addSystemMessage(room, `${identity.name} heeft ${module.meta.name} geopend.`);

        if (module.meta.solo) startGame(room);

        if (typeof ack === 'function') ack({ ok: true, roomId, token });
        broadcastRoom(room);
      } catch (error) {
        console.error(error);
        ackError(ack, error.message || 'Kon de game niet maken.');
      }
    });

    socket.on('room:join', (payload = {}, ack) => {
      try {
        const room = rooms.get(normalizeRoomCode(payload.roomId));
        if (!room) return ackError(ack, 'Deze game bestaat niet meer.');

        const identity = playerIdentity(socket, payload);
        const token = normalizeToken(payload.token);

        let player =
          getHumanByToken(room, token) ||
          getHumanByUserId(room, identity.userId);

        if (player) {
          leaveCurrentRoom(socket, false);

          if (identity.userId && player.userId === identity.userId) {
            if (room.hostToken === player.token) room.hostToken = token;
            player.token = token;
            player.name = identity.name;
          }

          setSocketPlayer(socket, room, player);
          if (typeof ack === 'function') ack({ ok: true, roomId: room.id, token, resumed: true });
          broadcastRoom(room);
          return;
        }

        if (room.status !== 'lobby') return ackError(ack, 'Het spel is al gestart.');

        if (room.players.some((p) => !p.isNpc && p.name.toLowerCase() === identity.name.toLowerCase())) {
          return ackError(ack, 'Die naam is al in gebruik.');
        }

        const module = gameModule(room);

        if (room.players.length >= module.meta.maxPlayers) {
          const idx = [...room.players]
            .map((item, index) => ({ item, index }))
            .reverse()
            .find(({ item }) => item.isNpc)?.index;

          if (idx === undefined) return ackError(ack, 'Deze game zit vol.');
          room.players.splice(idx, 1);
        }

        leaveCurrentRoom(socket, true);

        player = {
          id: makeId(),
          token,
          name: identity.name,
          userId: identity.userId,
          isNpc: false,
          socketId: socket.id,
          connected: true
        };

        room.players.push(player);
        setSocketPlayer(socket, room, player);
        addSystemMessage(room, `${identity.name} is toegetreden.`);

        if (typeof ack === 'function') ack({ ok: true, roomId: room.id, token, resumed: false });
        broadcastRoom(room);
      } catch (error) {
        console.error(error);
        ackError(ack, error.message || 'Kon niet toetreden.');
      }
    });

    socket.on('room:leave', (_payload, ack) => {
      leaveCurrentRoom(socket, true);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('room:leaveFinished', (_payload, ack) => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return ackError(ack, 'Je zit niet in een game.');
      if (room.status !== 'finished') return ackError(ack, 'Het spel is nog niet afgelopen.');
      if (player.token === room.hostToken) return ackError(ack, 'De host blijft in de game.');

      socket.leave(room.id);
      room.players = room.players.filter((participant) => participant.id !== player.id);
      socket.data.roomId = null;
      socket.data.token = null;

      if (!room.players.some((participant) => !participant.isNpc)) rooms.delete(room.id);
      else broadcastRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('room:close', (payload = {}, ack) => {
      const room=rooms.get(normalizeRoomCode(payload.roomId));
      if(!room)return ackError(ack,'Deze game bestaat niet meer.');
      if(room.status==='lobby')return ackError(ack,'Een lobby sluit je door ze te verlaten.');
      const token=String(payload.token||'').trim();
      const userId=socket.data.authUser?.id||null;
      const participant=getHumanByToken(room,token)||getHumanByUserId(room,userId);
      if(!participant)return ackError(ack,'Je kunt deze game niet sluiten.');
      if(participant.connected)return ackError(ack,'Verlaat eerst de game op je andere scherm.');
      // Keep the original seat for game rules and match results, but revoke resuming.
      participant.hasLeft=true;
      promoteHostIfNeeded(room);
      if(!room.players.some((p)=>!p.isNpc&&!p.hasLeft))rooms.delete(room.id);
      else broadcastRoom(room);
      if(typeof ack==='function')ack({ok:true});
    });

    socket.on('room:addNpc', (_payload, ack) => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return ackError(ack, 'Je zit niet in een lobby.');

      const module = gameModule(room);

      if (room.status !== 'lobby') return ackError(ack, 'Het spel is al gestart.');
      if (player.token !== room.hostToken) return ackError(ack, 'Alleen de host kan NPC’s toevoegen.');
      if (!module.meta.supportsNpc) return ackError(ack, 'Dit spel ondersteunt geen NPC’s.');
      if (room.players.length >= module.meta.maxPlayers) return ackError(ack, `Maximum ${module.meta.maxPlayers} spelers.`);

      room.players.push({
        id: makeId(),
        token: null,
        name: chooseNpcName(room.players),
        userId: null,
        isNpc: true,
        socketId: null,
        connected: true
      });

      broadcastRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('room:removeNpc', (payload = {}, ack) => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return ackError(ack, 'Je zit niet in een lobby.');
      if (room.status !== 'lobby' || player.token !== room.hostToken) {
        return ackError(ack, 'Alleen de host kan dit in de lobby.');
      }

      const npc = room.players.find((p) => p.id === payload.playerId && p.isNpc);
      if (!npc) return ackError(ack, 'NPC niet gevonden.');

      room.players = room.players.filter((p) => p.id !== npc.id);
      broadcastRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('room:removePlayer', (payload = {}, ack) => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return ackError(ack, 'Je zit niet in een lobby.');
      if (room.status !== 'lobby' || player.token !== room.hostToken) {
        return ackError(ack, 'Alleen de host kan dit in de lobby.');
      }
      const target = room.players.find((p) => p.id === payload.playerId);
      if (!target || target.id === player.id) return ackError(ack, 'Kies een andere speler.');
      if (target.socketId) {
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.leave(room.id);
          targetSocket.data.roomId = null;
          targetSocket.data.token = null;
        }
        io.to(target.socketId).emit('room:removed', { roomId: room.id });
      }
      room.players = room.players.filter((p) => p.id !== target.id);
      addSystemMessage(room, `${target.name} is door de host verwijderd.`);
      broadcastRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('room:setOptions', (payload = {}, ack) => {
      try {
        const { room, player } = getPlayerForSocket(socket);
        if (!room || !player) return ackError(ack, 'Je zit niet in een lobby.');
        if (room.status !== 'lobby' || player.token !== room.hostToken) return ackError(ack, 'Alleen de host kan spelopties aanpassen.');
        const normalize=gameModule(room).normalizeRoomOptions;
        if(typeof normalize!=='function')return ackError(ack,'Dit spel heeft geen instelbare opties.');
        room.gameOptions=normalize({...room.gameOptions,...payload});broadcastRoom(room);
        if(typeof ack==='function')ack({ok:true,gameOptions:room.gameOptions});
      } catch (error) { ackError(ack,error.message||'Kon spelopties niet aanpassen.'); }
    });

    socket.on('room:start', (_payload, ack) => {
      try {
        const { room, player } = getPlayerForSocket(socket);
        if (!room || !player) return ackError(ack, 'Je zit niet in een lobby.');
        if (room.status !== 'lobby') return ackError(ack, 'Het spel is al gestart.');
        if (player.token !== room.hostToken) return ackError(ack, 'Alleen de host kan starten.');

        startGame(room);
        broadcastRoom(room);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        ackError(ack, error.message);
      }
    });

    socket.on('game:action', (payload = {}, ack) => {
      try {
        const { room, player } = getPlayerForSocket(socket);

        if (!room || !player || !room.gameState) return ackError(ack, 'Geen actief spel.');
        if (room.status !== 'playing') return ackError(ack, 'Het spel is niet actief.');

        const module = gameModule(room);
        module.handleAction(
          room.gameState,
          player.id,
          String(payload.action || ''),
          payload.data || {}
        );
        runGameHook(room);
        room.gameRevision = (room.gameRevision || 0) + 1;

        if (room.gameState.gameOver) {
          room.status = 'finished';
          addSystemMessage(room, room.gameState.resultText || `${module.meta.name} is afgelopen.`);
          maybeRecordMatch(room);
        }

        broadcastRoom(room);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (error) {
        console.error(error);
        ackError(ack, error.message || 'Actie mislukt.');
      }
    });

    socket.on('room:returnToLobby', (_payload, ack) => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return ackError(ack, 'Je zit niet in een game.');
      if (room.status !== 'finished') return ackError(ack, 'Het spel is nog niet afgelopen.');
      if (player.token !== room.hostToken) return ackError(ack, 'Alleen de host kan terug naar de lobby.');
      room.players = room.players.filter((p) => !p.hasLeft);
      room.gameState = null;
      room.status = 'lobby';
      room.startedAt = null;
      room.matchRecorded = false;
      room.gameRevision = (room.gameRevision || 0) + 1;
      addSystemMessage(room, 'Terug in de lobby. De host kan spelers en instellingen aanpassen.');
      broadcastRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('room:rematch', (_payload, ack) => {
      try {
        const { room, player } = getPlayerForSocket(socket);

        if (!room || !player) return ackError(ack, 'Je zit niet in een game.');
        if (room.status !== 'finished') return ackError(ack, 'Het spel is nog niet afgelopen.');
        if (player.token !== room.hostToken) return ackError(ack, 'Alleen de host kan opnieuw spelen.');
        if (!allHumansConnected(room)) return ackError(ack, 'Niet alle spelers zijn verbonden.');

        // Een rematch is altijd één actie: zelfde spelers, verse game, direct spelen.
        // Er is bewust geen tussenstap via de lobby.
        room.gameState = null;
        room.status = 'starting';
        room.matchRecorded = false;

        startGame(room);

        addSystemMessage(room, 'Nieuw spel gestart met dezelfde spelers.');
        broadcastRoom(room);

        if (typeof ack === 'function') {
          ack({
            ok: true,
            started: true,
            roomId: room.id,
            gameRevision: room.gameRevision
          });
        }
      } catch (error) {
        ackError(ack, error.message);
      }
    });

    socket.on('chat:send', (payload = {}, ack) => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return ackError(ack, 'Je zit niet in een game.');

      const text = sanitizeMessage(payload.text);
      if (!text) return ackError(ack, 'Leeg bericht.');

      room.messages.push({
        id: makeId(),
        type: 'user',
        playerId: player.id,
        name: player.name,
        text,
        at: Date.now()
      });

      if (room.messages.length > 80) room.messages = room.messages.slice(-80);

      broadcastRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('disconnect', () => {
      const { room, player } = getPlayerForSocket(socket);
      if (!room || !player) return;

      if (player.socketId === socket.id) {
        player.socketId = null;
        player.connected = false;
        player.disconnectedAt = Date.now();
        broadcastRoom(room);
      }
    });
  });



  function startMaintenance() {
    setInterval(() => {
      const now = Date.now();

      for (const room of rooms.values()) {
        const host = getHumanByToken(room, room.hostToken);
        if (host && !host.connected && now - (host.disconnectedAt ?? now) >= HOST_GRACE_MS) {
          const nextHost = room.players.find((p) => !p.isNpc && !p.hasLeft && p.connected);
          if (nextHost) {
            room.hostToken = nextHost.token;
            room.gameRevision = (room.gameRevision || 0) + 1;
            addSystemMessage(room, `${nextHost.name} is nu de host.`);
            broadcastRoom(room);
          }
        }
        if (room.status !== 'playing' || !room.gameState || !room.players.some((p) => !p.isNpc && p.connected)) continue;

        const module = gameModule(room);
        if (typeof module.tick !== 'function') continue;

        try {
          const changed = module.tick(room.gameState, now);
          runGameHook(room);

          if (room.gameState.gameOver) {
            room.status = 'finished';
            addSystemMessage(room, room.gameState.resultText || `${module.meta.name} is afgelopen.`);
            maybeRecordMatch(room);
          }

          if (changed) {
            room.gameRevision = (room.gameRevision || 0) + 1;
            broadcastRoom(room);
          }
        } catch (error) {
          console.error('tick error', room.id, error);
        }
      }
    }, 120).unref();

    setInterval(() => {
      const now = Date.now();

      for (const [roomId, room] of rooms.entries()) {
        const connected = room.players.some((p) => !p.isNpc && p.connected);
        if (!connected && now - room.updatedAt > ROOM_TTL_MS) rooms.delete(roomId);
      }

      authDb.clearExpiredSessions();
    }, 15 * 60 * 1000).unref();
  }

  return {
    rooms,
    openRoomSummaries,
    startMaintenance
  };
}

module.exports = { createRealtime };
