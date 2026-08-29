'use strict';

const path = require('node:path');
const express = require('express');
const { getGame, listGames } = require('../games');
const minigolf = require('../minigolf');
const authDb = require('../db');

function isSecureRequest(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
}

function publicUser(user) {
  return user ? { id: user.id, username: user.username, createdAt: user.createdAt } : null;
}

function requireUser(req, res) {
  const user = authDb.getUserFromCookieHeader(req.headers.cookie);
  if (!user) {
    res.status(401).json({ ok:false, error:'Log eerst in.' });
    return null;
  }
  return user;
}

function publicCustomMap(row, viewerUserId = null) {
  let validation;
  try {
    const map = minigolf.sanitizeMapDefinition(row.map, { validate:false });
    validation = minigolf.validateMapPlayability(map);
  } catch (error) {
    validation = { ok:false, errors:[error.message || 'Ongeldige map.'] };
  }

  return {
    id:row.id,
    name:row.name,
    ownerName:row.ownerName,
    ownerUserId:row.ownerUserId,
    createdAt:row.createdAt,
    updatedAt:row.updatedAt,
    map:row.map,
    canEdit:Boolean(viewerUserId && Number(viewerUserId) === Number(row.ownerUserId)),
    validation
  };
}

function configureHttp(app, runtime) {
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(express.json({ limit:'128kb' }));

  app.get('/api/auth/me', (req, res) => {
    const user = authDb.getUserFromCookieHeader(req.headers.cookie);
    res.json({ ok:true, user:publicUser(user), stats:user ? authDb.getOwnStats(user.id) : null });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const result = authDb.register(req.body?.username, req.body?.password);
      if (!result.ok) return res.status(400).json(result);
      res.setHeader('Set-Cookie', authDb.cookieHeader(result.session.token, result.session.expiresAt, isSecureRequest(req)));
      res.json({ ok:true, user:result.user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok:false, error:'Account kon niet worden gemaakt.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const result = authDb.login(req.body?.username, req.body?.password);
      if (!result.ok) return res.status(401).json(result);
      res.setHeader('Set-Cookie', authDb.cookieHeader(result.session.token, result.session.expiresAt, isSecureRequest(req)));
      res.json({ ok:true, user:result.user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok:false, error:'Inloggen mislukt.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = authDb.sessionTokenFromCookie(req.headers.cookie);
    authDb.logoutByToken(token);
    res.setHeader('Set-Cookie', authDb.clearCookieHeader(isSecureRequest(req)));
    res.json({ ok:true });
  });

  app.get('/api/leaderboard', (req, res) => {
    const gameKey = req.query.game ? String(req.query.game).toLowerCase() : null;
    if (gameKey && !getGame(gameKey)) return res.status(400).json({ ok:false, error:'Onbekend spel.' });
    res.json({
      ok:true,
      gameKey,
      games:listGames().map((g) => ({ key:g.key, name:g.name })),
      leaderboard:authDb.leaderboard(gameKey)
    });
  });

  app.get('/api/profile/:username', (req, res) => {
    const profile = authDb.getProfile(req.params.username);
    if (!profile) return res.status(404).json({ ok:false, error:'Profiel niet gevonden.' });
    res.json({ ok:true, profile });
  });

  app.get('/api/profile/:username/head-to-head', (req, res) => {
    const viewer = requireUser(req, res); if (!viewer) return;
    const gameKey = req.query.game ? String(req.query.game).toLowerCase() : null;
    if (gameKey && !getGame(gameKey)) return res.status(400).json({ ok:false, error:'Onbekend spel.' });
    const comparison = authDb.headToHead(viewer.id, req.params.username, gameKey);
    if (!comparison) return res.status(404).json({ ok:false, error:'Profiel niet gevonden.' });
    res.json({
      ok:true,
      comparison,
      games:listGames().map((game) => ({ key:game.key, name:game.name }))
    });
  });

  app.get('/api/minigolf/maps', (req, res) => {
    try {
      const viewer = authDb.getUserFromCookieHeader(req.headers.cookie);
      res.json({
        ok:true,
        maps:authDb.listMinigolfMaps().map((row) => publicCustomMap(row, viewer?.id))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok:false, error:'Maps konden niet geladen worden.' });
    }
  });

  app.post('/api/minigolf/maps', (req, res) => {
    try {
      const user = requireUser(req, res); if (!user) return;
      const map = minigolf.sanitizeMapDefinition(req.body?.map || req.body || {});
      const row = authDb.createMinigolfMap(user.id, map.name, map);
      res.json({ ok:true, map:publicCustomMap(row, user.id) });
    } catch (error) {
      res.status(400).json({ ok:false, error:error.message || 'Map kon niet opgeslagen worden.' });
    }
  });

  app.put('/api/minigolf/maps/:id', (req, res) => {
    try {
      const user = requireUser(req, res); if (!user) return;
      const map = minigolf.sanitizeMapDefinition(req.body?.map || req.body || {});
      const row = authDb.updateMinigolfMap(Number(req.params.id), user.id, map.name, map);
      if (!row) return res.status(404).json({ ok:false, error:'Map niet gevonden of niet van jou.' });
      res.json({ ok:true, map:publicCustomMap(row, user.id) });
    } catch (error) {
      res.status(400).json({ ok:false, error:error.message || 'Map kon niet aangepast worden.' });
    }
  });

  app.delete('/api/minigolf/maps/:id', (req, res) => {
    const user = requireUser(req, res); if (!user) return;
    const deleted = authDb.deleteMinigolfMap(Number(req.params.id), user.id);
    if (!deleted) return res.status(404).json({ ok:false, error:'Map niet gevonden of niet van jou.' });
    res.json({ ok:true });
  });

  app.post('/api/minigolf/test-shot', (req, res) => {
    try {
      const map = minigolf.sanitizeMapDefinition(req.body?.map || {}, {validate:false});
      const start = {
        x:Number(req.body?.ball?.x ?? map.start.x),
        y:Number(req.body?.ball?.y ?? map.start.y)
      };
      const result = minigolf.simulateShot(
        map,
        start,
        Number(req.body?.angle),
        Number(req.body?.power),
        Array.isArray(req.body?.removedPropIds) ? req.body.removedPropIds.map(String) : []
      );
      res.json({ ok:true, result });
    } catch (error) {
      res.status(400).json({ ok:false, error:error.message || 'Testslag mislukt.' });
    }
  });

  app.get('/api/rooms', (_req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.json({ ok:true, rooms:runtime.openRoomSummaries() });
  });

  app.get('/health', (_req, res) => {
    res.json({
      ok:true,
      rooms:runtime.rooms.size,
      games:listGames().map((g) => g.key),
      database:path.basename(authDb.DB_PATH)
    });
  });

  const publicDir = path.join(__dirname, '..', '..', 'public');
  app.use(express.static(publicDir, {
    etag:true,
    maxAge:0,
    setHeaders(res, filePath) {
      if (/service-worker\.js$/i.test(filePath)) {
        res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Service-Worker-Allowed','/');
        return;
      }
      if (/\.(html|js|css|webmanifest)$/i.test(filePath)) {
        res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    }
  }));

  app.get(['/room/:roomId','/lobby','/leaderboard','/profile/:username','/minigolf/editor'], (_req, res) => {
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(publicDir,'index.html'));
  });

  app.use((_req, res) => {
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(publicDir,'index.html'));
  });
}

module.exports = { configureHttp, publicCustomMap };
