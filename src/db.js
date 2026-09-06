const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'minigames.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    game_sort TEXT NOT NULL DEFAULT 'alphabetical'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_key TEXT NOT NULL,
    room_id TEXT,
    started_at INTEGER,
    ended_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    placement INTEGER,
    score REAL,
    won INTEGER NOT NULL DEFAULT 0,
    drawn INTEGER NOT NULL DEFAULT 0,
    outcome TEXT,
    duration_ms INTEGER,
    moves INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
  CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game_key);
  CREATE INDEX IF NOT EXISTS idx_matches_ended ON matches(ended_at DESC);

  CREATE TABLE IF NOT EXISTS minigolf_maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    map_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_minigolf_maps_owner ON minigolf_maps(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_minigolf_maps_updated ON minigolf_maps(updated_at DESC);

  CREATE TABLE IF NOT EXISTS app_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cycclub_teams (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deep_bleu_c_players (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

if (!db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === 'blackjack_chips')) {
  db.exec('ALTER TABLE users ADD COLUMN blackjack_chips INTEGER NOT NULL DEFAULT 100');
}
if (!db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === 'game_sort')) {
  db.exec("ALTER TABLE users ADD COLUMN game_sort TEXT NOT NULL DEFAULT 'alphabetical'");
}
if (!db.prepare("PRAGMA table_info(match_players)").all().some((column) => column.name === 'drawn')) {
  // Existing match rows remain valid and start with zero draws.
  db.exec('ALTER TABLE match_players ADD COLUMN drawn INTEGER NOT NULL DEFAULT 0');
}

function applyDataMigrations() {
  const resetKey = 'v0.10.3-reset-leaderboards';
  const alreadyApplied = db.prepare(
    'SELECT migration_key FROM app_migrations WHERE migration_key = ?'
  ).get(resetKey);

  if (!alreadyApplied) {
    db.exec('BEGIN IMMEDIATE');
    try {
      // v0.10.3 intentionally starts leaderboard/stat history from zero.
      // Accounts, sessions and custom minigolf maps are left untouched.
      db.exec('DELETE FROM match_players; DELETE FROM matches;');
      db.prepare('INSERT INTO app_migrations(migration_key,applied_at) VALUES(?,?)')
        .run(resetKey, Date.now());
      db.exec('COMMIT');
      console.log('Leaderboard/stat history reset voor v0.10.3.');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

applyDataMigrations();

function applyDrawMigration() {
  const migrationKey = 'v1.18.2-backfill-draws';
  if (db.prepare('SELECT migration_key FROM app_migrations WHERE migration_key = ?').get(migrationKey)) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    // Older match rows encoded draws in their outcome. Ticket to Ride's old
    // result contract also marked every tied winner as won; that is a draw,
    // except for Blackjack where multiple players can beat the dealer in one
    // recorded round.
    db.exec(`
      UPDATE match_players
      SET drawn = 1
      WHERE drawn = 0
        AND match_id IN (
          SELECT match_id
          FROM match_players
          GROUP BY match_id
          HAVING COUNT(*) > 1
        )
        AND (
          outcome LIKE 'Gelijkspel%'
          OR match_id IN (
            SELECT mp.match_id
            FROM match_players mp
            JOIN matches m ON m.id = mp.match_id
            WHERE m.game_key NOT IN ('blackjack','solitaire','cycclub','deep-bleu-c')
            GROUP BY mp.match_id
            HAVING COUNT(*) > 1 AND SUM(mp.won) > 1
          )
        )
    `);
    db.prepare('INSERT INTO app_migrations(migration_key,applied_at) VALUES(?,?)').run(migrationKey, Date.now());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

applyDrawMigration();

const SESSION_COOKIE = 'mg_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeUsername(value) {
  return String(value || '').normalize('NFKC').trim();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (username.length < 3 || username.length > 18) {
    return { ok: false, error: 'Username moet 3-18 tekens lang zijn.' };
  }
  if (!/^[\p{L}\p{N}_-]+$/u.test(username)) {
    return { ok: false, error: 'Gebruik alleen letters, cijfers, _ of -.' };
  }
  return { ok: true, username, key: username.toLocaleLowerCase('nl-BE') };
}

function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 8) return { ok: false, error: 'Wachtwoord moet minstens 8 tekens hebben.' };
  if (password.length > 128) return { ok: false, error: 'Wachtwoord is te lang.' };
  return { ok: true, password };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [saltHex, hashHex] = String(stored || '').split(':');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = now + SESSION_MS;
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .run(tokenHash(token), userId, expiresAt, now);
  return { token, expiresAt };
}

function clearExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

function getUserBySessionToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.created_at AS createdAt, u.game_sort AS gameSort, s.expires_at AS expiresAt
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), Date.now());
  return row || null;
}

function getUserFromCookieHeader(header) {
  const token = parseCookies(header)[SESSION_COOKIE];
  return getUserBySessionToken(token);
}

function register(usernameValue, passwordValue) {
  const userCheck = validateUsername(usernameValue);
  if (!userCheck.ok) return userCheck;
  const passCheck = validatePassword(passwordValue);
  if (!passCheck.ok) return passCheck;

  try {
    const now = Date.now();
    const result = db.prepare(
      'INSERT INTO users(username,username_key,password_hash,created_at) VALUES(?,?,?,?)'
    ).run(userCheck.username, userCheck.key, hashPassword(passCheck.password), now);

    const user = { id: Number(result.lastInsertRowid), username: userCheck.username, createdAt: now, gameSort:'alphabetical' };
    const session = createSession(user.id);
    return { ok: true, user, session };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return { ok: false, error: 'Die username bestaat al.' };
    throw error;
  }
}

function login(usernameValue, passwordValue) {
  const username = normalizeUsername(usernameValue);
  const password = String(passwordValue || '');
  const row = db.prepare(
    'SELECT id,username,password_hash,created_at AS createdAt,game_sort AS gameSort FROM users WHERE username_key = ?'
  ).get(username.toLocaleLowerCase('nl-BE'));

  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: 'Username of wachtwoord is fout.' };
  }

  const session = createSession(row.id);
  return {
    ok: true,
    user: { id: row.id, username: row.username, createdAt: row.createdAt, gameSort:row.gameSort },
    session
  };
}

function logoutByToken(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
}

function sessionTokenFromCookie(header) {
  return parseCookies(header)[SESSION_COOKIE] || null;
}

function cookieHeader(token, expiresAt, secure = false) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader(secure = false) {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function recordMatch({ gameKey, roomId, startedAt, endedAt = Date.now(), players }) {
  if (!players.some((p) => p.userId)) return null;

  db.exec('BEGIN IMMEDIATE');
  try {
    const matchResult = db.prepare(
      'INSERT INTO matches(game_key,room_id,started_at,ended_at) VALUES(?,?,?,?)'
    ).run(gameKey, roomId || null, startedAt || null, endedAt);

    const matchId = Number(matchResult.lastInsertRowid);
    const insertPlayer = db.prepare(`
      INSERT INTO match_players(
        match_id,user_id,display_name,placement,score,won,drawn,outcome,duration_ms,moves
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
    `);

    for (const p of players) {
      insertPlayer.run(
        matchId,
        p.userId || null,
        p.displayName,
        p.placement ?? null,
        p.score ?? null,
        p.won ? 1 : 0,
        p.draw ? 1 : 0,
        p.outcome || null,
        p.durationMs ?? null,
        p.moves ?? null
      );
    }

    db.exec('COMMIT');
    return matchId;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function leaderboard(gameKey = null, limit = 100) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  if (gameKey === 'blackjack') {
    return db.prepare(`
      SELECT username, blackjack_chips AS chips, 0 AS draws
      FROM users
      ORDER BY blackjack_chips DESC, username COLLATE NOCASE ASC
      LIMIT ${safeLimit}
    `).all();
  }
  if (gameKey === 'cycclub') {
    return cycclubLeaderboard(safeLimit);
  }
  if (gameKey === 'deep-bleu-c') {
    return deepBleuCLeaderboard(safeLimit);
  }
  if (gameKey === 'solitaire') {
    return db.prepare(`
      SELECT
        u.username,
        COALESCE(s.games,0) AS games,
        COALESCE(s.wins,0) AS wins,
        COALESCE(s.draws,0) AS draws,
        CASE WHEN COALESCE(s.games,0) = 0 THEN 0 ELSE ROUND(100.0 * s.wins / s.games,1) END AS winRate,
        s.bestSolitaireMs,
        s.bestSolitaireMoves
      FROM users u
      LEFT JOIN (
        SELECT mp.user_id,COUNT(*) AS games,COALESCE(SUM(mp.won),0) AS wins,COALESCE(SUM(mp.drawn),0) AS draws,
          MIN(CASE WHEN mp.won = 1 THEN mp.duration_ms END) AS bestSolitaireMs,
          MIN(CASE WHEN mp.won = 1 THEN mp.moves END) AS bestSolitaireMoves
        FROM match_players mp
        JOIN matches m ON m.id = mp.match_id
        WHERE m.game_key = 'solitaire'
        GROUP BY mp.user_id
      ) s ON s.user_id = u.id
      ORDER BY wins DESC, bestSolitaireMoves ASC, u.username COLLATE NOCASE ASC
      LIMIT ${safeLimit}
    `).all();
  }
  const params = [];
  let where = 'mp.user_id IS NOT NULL';
  if (gameKey) {
    where += ' AND m.game_key = ?';
    params.push(gameKey);
  }

  const rows = db.prepare(`
    SELECT
      u.username,
      COUNT(*) AS games,
      SUM(mp.won) AS wins,
      COALESCE(SUM(mp.drawn),0) AS draws,
      ROUND(100.0 * SUM(mp.won) / COUNT(*), 1) AS winRate,
      MIN(CASE WHEN m.game_key = 'solitaire' AND mp.won = 1 THEN mp.duration_ms END) AS bestSolitaireMs,
      MIN(CASE WHEN m.game_key = 'solitaire' AND mp.won = 1 THEN mp.moves END) AS bestSolitaireMoves
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    JOIN users u ON u.id = mp.user_id
    WHERE ${where}
    GROUP BY u.id, u.username
    ORDER BY wins DESC, winRate DESC, games DESC, u.username COLLATE NOCASE ASC
    LIMIT ${safeLimit}
  `).all(...params);

  return rows;
}

function changeUsername(userId, usernameValue) {
  const userCheck = validateUsername(usernameValue);
  if (!userCheck.ok) return userCheck;
  const current = db.prepare('SELECT id,username,username_key FROM users WHERE id = ?').get(userId);
  if (!current) return { ok:false, error:'Account niet gevonden.' };
  if (current.username === userCheck.username && current.username_key === userCheck.key) {
    return { ok:true, user:{ id:current.id, username:current.username } };
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE users SET username = ?, username_key = ? WHERE id = ?')
      .run(userCheck.username, userCheck.key, userId);
    // Guest names remain snapshots; registered match rows follow the account name.
    db.prepare('UPDATE match_players SET display_name = ? WHERE user_id = ?')
      .run(userCheck.username, userId);
    db.exec('COMMIT');
    return { ok:true, user:{ id:Number(userId), username:userCheck.username } };
  } catch (error) {
    db.exec('ROLLBACK');
    if (String(error.message).includes('UNIQUE')) return { ok:false, error:'Die username bestaat al.' };
    throw error;
  }
}

function gamePopularity(userId) {
  if (!userId) return [];
  return db.prepare(`
    SELECT m.game_key AS gameKey, COUNT(*) AS games
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
    GROUP BY m.game_key
    ORDER BY games DESC, m.game_key ASC
  `).all(userId);
}

function setGameSort(userId, value) {
  const gameSort=value==='popular'?'popular':'alphabetical';
  db.prepare('UPDATE users SET game_sort = ? WHERE id = ?').run(gameSort,userId);
  return gameSort;
}

function getProfile(usernameValue) {
  const key = normalizeUsername(usernameValue).toLocaleLowerCase('nl-BE');
  const user = db.prepare(
    'SELECT id,username,created_at AS createdAt FROM users WHERE username_key = ?'
  ).get(key);
  if (!user) return null;

  const totals = db.prepare(`
    SELECT COUNT(*) AS games, COALESCE(SUM(won),0) AS wins, COALESCE(SUM(drawn),0) AS draws
    FROM match_players
    WHERE user_id = ?
  `).get(user.id);

  const perGame = db.prepare(`
    SELECT
      m.game_key AS gameKey,
      COUNT(*) AS games,
      COALESCE(SUM(mp.won),0) AS wins,
      COALESCE(SUM(mp.drawn),0) AS draws,
      ROUND(100.0 * SUM(mp.won) / COUNT(*), 1) AS winRate,
      MIN(CASE WHEN m.game_key = 'solitaire' AND mp.won = 1 THEN mp.duration_ms END) AS bestTimeMs,
      MIN(CASE WHEN m.game_key = 'solitaire' AND mp.won = 1 THEN mp.moves END) AS bestMoves
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
    GROUP BY m.game_key
    ORDER BY wins DESC, games DESC, m.game_key
  `).all(user.id);

  const recent = db.prepare(`
    SELECT
      m.id,
      m.game_key AS gameKey,
      m.ended_at AS endedAt,
      mp.placement,
      mp.score,
      mp.won,
      mp.outcome,
      mp.duration_ms AS durationMs,
      mp.moves
    FROM match_players mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = ?
    ORDER BY m.ended_at DESC
    LIMIT 20
  `).all(user.id);

  const games = Number(totals.games || 0);
  const wins = Number(totals.wins || 0);

  return {
    user,
    totals: {
      games,
      wins,
      draws:Number(totals.draws || 0),
      winRate: games ? Math.round((wins / games) * 1000) / 10 : 0
    },
    perGame,
    recent
  };
}

function getOwnStats(userId) {
  const totals = db.prepare(`
    SELECT COUNT(*) AS games, COALESCE(SUM(won),0) AS wins, COALESCE(SUM(drawn),0) AS draws
    FROM match_players
    WHERE user_id = ?
  `).get(userId);
  const games = Number(totals.games || 0);
  const wins = Number(totals.wins || 0);
  return { games, wins, draws:Number(totals.draws || 0), winRate: games ? Math.round((wins / games) * 1000) / 10 : 0 };
}

function getBlackjackChips(userId) {
  const row = db.prepare('SELECT blackjack_chips AS chips FROM users WHERE id = ?').get(userId);
  return Math.max(0, Number(row?.chips ?? 100));
}

function adjustBlackjackChips(userId, delta) {
  const current = getBlackjackChips(userId);
  let chips = current + Number(delta || 0);
  const reset = chips <= 0;
  if (reset) chips = 100;
  db.prepare('UPDATE users SET blackjack_chips = ? WHERE id = ?').run(chips, userId);
  return { chips, delta:Number(delta || 0), reset };
}

function setBlackjackChips(userId, value) {
  let chips = Math.max(0, Number(value ?? 100));
  const reset = chips <= 0;
  if (reset) chips = 100;
  db.prepare('UPDATE users SET blackjack_chips = ? WHERE id = ?').run(chips, userId);
  return { chips, reset };
}

function getCycClubTeam(userId) {
  const row = db.prepare('SELECT state_json AS stateJson FROM cycclub_teams WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    return JSON.parse(row.stateJson);
  } catch {
    return null;
  }
}

function saveCycClubTeam(userId, state) {
  db.prepare(`
    INSERT INTO cycclub_teams(user_id,state_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at
  `).run(userId, JSON.stringify(state), Date.now());
}

function getDeepBleuCPlayer(userId) {
  const row = db.prepare('SELECT state_json AS stateJson FROM deep_bleu_c_players WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    return JSON.parse(row.stateJson);
  } catch {
    return null;
  }
}

function saveDeepBleuCPlayer(userId, state) {
  db.prepare(`
    INSERT INTO deep_bleu_c_players(user_id,state_json,updated_at) VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at
  `).run(userId, JSON.stringify(state), Date.now());
}

function deepBleuCLeaderboard(limit = 100) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  const rows = db.prepare(`
    SELECT u.username, p.state_json AS stateJson FROM deep_bleu_c_players p JOIN users u ON u.id = p.user_id
  `).all();
  return rows.map((row) => {
    let state;
    try {
      state = JSON.parse(row.stateJson);
    } catch {
      return null;
    }
    return {
      username: row.username,
      draws: 0,
      cash: Math.round(Number(state?.cash || 0)),
      discovered: Array.isArray(state?.discovered) ? state.discovered.length : 0,
      heaviestKg: Math.round(Number(state?.heaviestKg || 0) * 10) / 10
    };
  }).filter(Boolean)
    .sort((a, b) => b.cash - a.cash || b.discovered - a.discovered || a.username.localeCompare(b.username, 'nl-BE', { sensitivity: 'base' }))
    .slice(0, safeLimit);
}

function cycclubLeaderboard(limit = 100) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  const rows = db.prepare(`
    SELECT u.username, t.state_json AS stateJson
    FROM cycclub_teams t
    JOIN users u ON u.id = t.user_id
  `).all();

  return rows
    .map((row) => {
      let state;
      try { state = JSON.parse(row.stateJson); } catch { return null; }
      const wallet = Number(state?.wallet || 0);
      const netWorth = wallet + (state?.riders || []).reduce((sum, rider) => sum + Number(rider.marketValue || 0), 0);
      const career = state?.career || {};
      return {
        username: row.username,
        draws: 0,
        netWorth: Math.round(netWorth),
        victories: Number(career.victories || 0),
        podiums: Number(career.podiums || 0),
        monumentsWon: Number(career.monumentsWon || 0),
        grandToursWon: Number(career.grandToursWon || 0),
        gtStagesWon: Number(career.gtStagesWon || 0),
        prizeMoney: Math.round(Number(career.prizeMoney || 0))
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.victories - a.victories || b.netWorth - a.netWorth || a.username.localeCompare(b.username, 'nl-BE', { sensitivity: 'base' }))
    .slice(0, safeLimit);
}

function headToHead(viewerUserId, opponentUsername, gameKey = null) {
  const key = normalizeUsername(opponentUsername).toLocaleLowerCase('nl-BE');
  const opponent = db.prepare(
    'SELECT id,username FROM users WHERE username_key = ?'
  ).get(key);
  if (!opponent) return null;

  const params = [viewerUserId, opponent.id];
  let gameFilter = '';
  if (gameKey) {
    gameFilter = 'AND m.game_key = ?';
    params.push(gameKey);
  }

  const row = db.prepare(`
    SELECT
      COUNT(*) AS games,
      COALESCE(SUM(CASE
        WHEN mine.placement IS NOT NULL AND theirs.placement IS NOT NULL AND mine.placement < theirs.placement THEN 1
        WHEN mine.placement IS NULL AND mine.won = 1 AND theirs.won = 0 THEN 1
        ELSE 0 END),0) AS viewerWins,
      COALESCE(SUM(CASE
        WHEN mine.placement IS NOT NULL AND theirs.placement IS NOT NULL AND mine.placement > theirs.placement THEN 1
        WHEN mine.placement IS NULL AND theirs.won = 1 AND mine.won = 0 THEN 1
        ELSE 0 END),0) AS opponentWins
    FROM match_players mine
    JOIN match_players theirs ON theirs.match_id = mine.match_id AND theirs.user_id = ?
    JOIN matches m ON m.id = mine.match_id
    WHERE mine.user_id = ? ${gameFilter}
  `).get(params[1], params[0], ...params.slice(2));

  const games = Number(row.games || 0);
  const viewerWins = Number(row.viewerWins || 0);
  const opponentWins = Number(row.opponentWins || 0);
  return {
    opponent:{ id:Number(opponent.id), username:opponent.username },
    gameKey:gameKey || null,
    games,
    viewerWins,
    opponentWins,
    draws:Math.max(0, games - viewerWins - opponentWins)
  };
}


function listMinigolfMaps() {
  return db.prepare(`
    SELECT m.id, m.name, m.map_json AS mapJson, m.created_at AS createdAt,
           m.updated_at AS updatedAt, u.username AS ownerName, u.id AS ownerUserId
    FROM minigolf_maps m
    JOIN users u ON u.id = m.owner_user_id
    ORDER BY m.updated_at DESC
  `).all().map((row) => ({
    id: Number(row.id),
    name: row.name,
    map: JSON.parse(row.mapJson),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    ownerName: row.ownerName,
    ownerUserId: Number(row.ownerUserId)
  }));
}

function listMinigolfMapsForGame() {
  return listMinigolfMaps().map((row) => ({
    ...row.map,
    id: `custom-${row.id}`,
    customMapId: row.id,
    custom: true,
    ownerName: row.ownerName
  }));
}

function getMinigolfMap(id) {
  const row = db.prepare(`
    SELECT m.id, m.name, m.map_json AS mapJson, m.created_at AS createdAt,
           m.updated_at AS updatedAt, u.username AS ownerName, u.id AS ownerUserId
    FROM minigolf_maps m JOIN users u ON u.id = m.owner_user_id
    WHERE m.id = ?
  `).get(Number(id));
  if (!row) return null;
  return {
    id: Number(row.id), name: row.name, map: JSON.parse(row.mapJson),
    createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt),
    ownerName: row.ownerName, ownerUserId: Number(row.ownerUserId)
  };
}

function createMinigolfMap(userId, name, map) {
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO minigolf_maps(owner_user_id,name,map_json,created_at,updated_at)
    VALUES(?,?,?,?,?)
  `).run(userId, name, JSON.stringify(map), now, now);
  return getMinigolfMap(Number(result.lastInsertRowid));
}

function updateMinigolfMap(id, userId, name, map) {
  const existing = getMinigolfMap(id);
  if (!existing) return { ok:false, error:'Map niet gevonden.' };
  if (existing.ownerUserId !== Number(userId)) return { ok:false, error:'Alleen de maker kan deze map aanpassen.' };
  db.prepare(`UPDATE minigolf_maps SET name=?, map_json=?, updated_at=? WHERE id=?`)
    .run(name, JSON.stringify(map), Date.now(), Number(id));
  return { ok:true, map:getMinigolfMap(id) };
}

function deleteMinigolfMap(id, userId) {
  const existing = getMinigolfMap(id);
  if (!existing) return { ok:false, error:'Map niet gevonden.' };
  if (existing.ownerUserId !== Number(userId)) return { ok:false, error:'Alleen de maker kan deze map verwijderen.' };
  db.prepare('DELETE FROM minigolf_maps WHERE id=?').run(Number(id));
  return { ok:true };
}

let lastBackup = null;

function backupDatabase() {
  const backupDir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `minigames-${stamp}.db`;
  const target = path.join(backupDir, filename);
  const sqlPath = target.replace(/'/g, "''");

  db.exec(`VACUUM INTO '${sqlPath}'`);

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const backups = fs.readdirSync(backupDir)
    .filter((name) => /^minigames-.*\.db$/.test(name))
    .map((name) => ({
      name,
      path: path.join(backupDir, name),
      mtime: fs.statSync(path.join(backupDir, name)).mtimeMs
    }));

  for (const old of backups.filter((item) => item.mtime < cutoff)) {
    fs.unlinkSync(old.path);
  }

  lastBackup = { filename, at: Date.now() };
  return lastBackup;
}

function getBackupStatus() {
  return lastBackup;
}

module.exports = {
  db,
  DB_PATH,
  SESSION_COOKIE,
  register,
  login,
  changeUsername,
  logoutByToken,
  getUserFromCookieHeader,
  sessionTokenFromCookie,
  cookieHeader,
  clearCookieHeader,
  clearExpiredSessions,
  recordMatch,
  leaderboard,
  gamePopularity,
  setGameSort,
  getProfile,
  getOwnStats,
  getBlackjackChips,
  adjustBlackjackChips,
  setBlackjackChips,
  getCycClubTeam,
  saveCycClubTeam,
  cycclubLeaderboard,
  getDeepBleuCPlayer,
  saveDeepBleuCPlayer,
  deepBleuCLeaderboard,
  headToHead,
  validateUsername,
  listMinigolfMaps,
  listMinigolfMapsForGame,
  getMinigolfMap,
  createMinigolfMap,
  updateMinigolfMap,
  deleteMinigolfMap,
  backupDatabase,
  getBackupStatus
};
