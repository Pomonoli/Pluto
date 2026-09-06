'use strict';

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { getGame, listGames, listGamePlugins, getGamePlugin, modules } = require('../games');
const authDb = require('../db');
const updates = require('../updates');

function isSecureRequest(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
}

function publicUser(user) {
  return user ? { id: user.id, username: user.username, createdAt: user.createdAt, gameSort:user.gameSort||'alphabetical' } : null;
}

function requireUser(req, res) {
  const user = authDb.getUserFromCookieHeader(req.headers.cookie);
  if (!user) {
    res.status(401).json({ ok:false, error:'Log eerst in.' });
    return null;
  }
  return user;
}

function configureHttp(app, runtime) {
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(express.json({ limit:'128kb' }));

  app.get('/api/game-plugins', (req, res) => {
    res.setHeader('Cache-Control','no-store');
    const user=authDb.getUserFromCookieHeader(req.headers.cookie);
    const counts=new Map(authDb.gamePopularity(user?.id).map((row)=>[row.gameKey,Number(row.games)||0]));
    res.json({
      ok:true,
      gameSort:user?.gameSort||null,
      games:listGamePlugins().map((game)=>({...game,playCount:counts.get(game.key)||0}))
    });
  });

  app.post('/api/preferences/game-sort', (req,res)=>{
    const user=requireUser(req,res);if(!user)return;
    const gameSort=String(req.body?.gameSort||'');
    if(!['alphabetical','popular'].includes(gameSort))return res.status(400).json({ok:false,error:'Ongeldige sorteerkeuze.'});
    res.json({ok:true,gameSort:authDb.setGameSort(user.id,gameSort)});
  });

  for (const game of modules) game.configureHttp?.({ app, db:authDb, requireUser });

  app.get('/game-plugins/:key/:asset', (req, res, next) => {
    const plugin=getGamePlugin(req.params.key);
    const requested=String(req.params.asset||'');
    const allowed=/^[a-z0-9_-]+\.js$/i.test(requested)||requested==='styles.css'||requested==='view.html'?requested:null;
    if (!plugin || !allowed) return next();
    const filePath=path.join(plugin.directory,allowed);
    if (!fs.existsSync(filePath)) return next();
    res.setHeader('Cache-Control','no-store');
    res.type(allowed.endsWith('.js')?'text/javascript':allowed.endsWith('.css')?'text/css':'text/html');
    res.sendFile(filePath);
  });

  app.get('/game-plugins/:key/assets/:asset', (req,res,next)=>{
    const plugin=getGamePlugin(req.params.key),asset=String(req.params.asset||'');
    if(!plugin||!/^[a-z0-9_-]+\.(?:svg|png|webp)$/i.test(asset))return next();
    const filePath=path.join(plugin.directory,'assets',asset);
    if(!fs.existsSync(filePath))return next();
    res.setHeader('Cache-Control','public, max-age=3600');
    res.sendFile(filePath);
  });

  app.get('/game-plugins/:key/assets/:folder/:asset', (req,res,next)=>{
    const plugin=getGamePlugin(req.params.key),folder=String(req.params.folder||''),asset=String(req.params.asset||'');
    if(!plugin||!/^[a-z0-9_-]+$/i.test(folder)||!/^[a-z0-9_-]+\.(?:svg|png|webp)$/i.test(asset))return next();
    const filePath=path.join(plugin.directory,'assets',folder,asset);
    if(!fs.existsSync(filePath))return next();
    res.setHeader('Cache-Control','public, max-age=3600');
    res.sendFile(filePath);
  });

  app.get('/game-plugins/:key/assets/:folder/:subfolder/:asset', (req,res,next)=>{
    const plugin=getGamePlugin(req.params.key),folder=String(req.params.folder||''),subfolder=String(req.params.subfolder||''),asset=String(req.params.asset||'');
    if(!plugin||!/^[a-z0-9_-]+$/i.test(folder)||!/^[a-z0-9_-]+$/i.test(subfolder)||!/^[a-z0-9_-]+\.(?:svg|png|webp)$/i.test(asset))return next();
    const filePath=path.join(plugin.directory,'assets',folder,subfolder,asset);
    if(!fs.existsSync(filePath))return next();
    res.setHeader('Cache-Control','public, max-age=3600');
    res.sendFile(filePath);
  });

  app.use('/game-plugins',(_req,res)=>res.status(404).json({ok:false,error:'Game-pluginbestand niet gevonden.'}));

  app.get('/api/auth/me', (req, res) => {
    const user = authDb.getUserFromCookieHeader(req.headers.cookie);
    res.json({ ok:true, user:publicUser(user), stats:user ? authDb.getOwnStats(user.id) : null });
  });

  app.get('/api/updates', (req, res) => {
    const user=authDb.getUserFromCookieHeader(req.headers.cookie);
    res.setHeader('Cache-Control','no-store');
    res.json(updates.payloadFor({user,since:req.query.since}));
  });

  app.post('/api/updates/seen', (req, res) => {
    const user=authDb.getUserFromCookieHeader(req.headers.cookie);
    if (user) updates.markSeen(user.id);
    res.json({ok:true,currentVersion:updates.APP_VERSION});
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const result = authDb.register(req.body?.username, req.body?.password);
      if (!result.ok) return res.status(400).json(result);
      updates.markSeen(result.user.id);
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

  app.get('/api/rooms', (req, res) => {
    res.setHeader('Cache-Control','no-store');
    const user=authDb.getUserFromCookieHeader(req.headers.cookie);
    const token=String(req.get('x-pluto-player-token')||'').trim();
    res.json({ ok:true, rooms:runtime.openRoomSummaries({token,userId:user?.id||null}) });
  });

  app.put('/api/account/username', (req, res) => {
    const user = requireUser(req, res); if (!user) return;
    try {
      const result = authDb.changeUsername(user.id, req.body?.username);
      if (!result.ok) return res.status(400).json(result);
      const refreshed = authDb.getUserFromCookieHeader(req.headers.cookie);
      res.json({ ok:true, user:publicUser(refreshed) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok:false, error:'Naam wijzigen mislukt.' });
    }
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

  app.get(['/room/:roomId','/lobby','/leaderboard','/profile/:username'], (_req, res) => {
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(publicDir,'index.html'));
  });

  app.use((_req, res) => {
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(publicDir,'index.html'));
  });
}

module.exports = { configureHttp };
