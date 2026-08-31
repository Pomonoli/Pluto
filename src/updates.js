'use strict';

const { version: APP_VERSION } = require('../package.json');
const authDb = require('./db');

const RELEASES = [
  {
    version:'1.8.0',
    features:[
      'Thema’s en skins toegevoegd, inclusief de oranje Pluto-preview.'
    ]
  },
  {
    version:'1.8.1',
    features:[
      'Geluid en thema samengebracht in één instellingenpopup.'
    ]
  },
  {
    version:'1.8.2',
    improvements:[
      'Leaderboard en recente matchgeschiedenis overzichtelijker gemaakt.'
    ]
  },
  {
    version:'1.8.3',
    features:[
      'Games kunnen op aantal spelers gefilterd worden.'
    ],
    improvements:[
      'Games worden alfabetisch gesorteerd op hun zichtbare naam.'
    ]
  },
  {
    version:'1.9.0',
    games:[
      '7 Wonders Duel'
    ]
  },
  {
    version:'1.10.0',
    games:[
      'Kingdomino'
    ]
  },
  {
    version:'1.11.0',
    games:[
      'Cascadia'
    ]
  },
  {
    version:'1.11.1',
    features:[
      'Een compacte updatepopup toont voortaan alleen wat nieuw is sinds je vorige bezoek.'
    ]
  }
];

const CATEGORIES = ['games','features','improvements'];

function parseVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  const left=parseVersion(a), right=parseVersion(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  for (let i=0;i<3;i+=1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function emptyChanges() {
  return { games:[], features:[], improvements:[] };
}

function changesSince(lastSeenVersion) {
  const changes=emptyChanges();
  if (!parseVersion(lastSeenVersion)) return changes;

  for (const release of RELEASES) {
    if (compareVersions(release.version,lastSeenVersion) <= 0) continue;
    if (compareVersions(release.version,APP_VERSION) > 0) continue;
    for (const category of CATEGORIES) {
      for (const item of release[category] || []) {
        if (!changes[category].includes(item)) changes[category].push(item);
      }
    }
  }
  return changes;
}

function hasChanges(changes) {
  return CATEGORIES.some((category) => changes[category]?.length);
}

authDb.db.exec(`
  CREATE TABLE IF NOT EXISTS user_update_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_version TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

function getLastSeenVersion(userId) {
  return authDb.db.prepare(
    'SELECT last_seen_version AS lastSeenVersion FROM user_update_state WHERE user_id = ?'
  ).get(Number(userId))?.lastSeenVersion || null;
}

function markSeen(userId, version = APP_VERSION) {
  authDb.db.prepare(`
    INSERT INTO user_update_state(user_id,last_seen_version,updated_at)
    VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      last_seen_version=excluded.last_seen_version,
      updated_at=excluded.updated_at
  `).run(Number(userId), version, Date.now());
}

function payloadFor({ user = null, since = null } = {}) {
  let lastSeenVersion = user ? getLastSeenVersion(user.id) : String(since || '').trim() || null;

  // First rollout / first device visit: establish a silent baseline instead of
  // dumping the historical changelog on the user.
  if (!lastSeenVersion || !parseVersion(lastSeenVersion)) {
    if (user) markSeen(user.id);
    return {
      ok:true,
      authenticated:Boolean(user),
      currentVersion:APP_VERSION,
      lastSeenVersion:APP_VERSION,
      changes:emptyChanges()
    };
  }

  const changes=changesSince(lastSeenVersion);

  // A version can contain no user-facing announcement. Advance the account
  // silently so the client never shows an empty popup or repeats this check.
  if (!hasChanges(changes) && compareVersions(lastSeenVersion,APP_VERSION) !== 0) {
    if (user) markSeen(user.id);
    lastSeenVersion=APP_VERSION;
  }

  return {
    ok:true,
    authenticated:Boolean(user),
    currentVersion:APP_VERSION,
    lastSeenVersion,
    changes
  };
}

module.exports = {
  APP_VERSION,
  RELEASES,
  compareVersions,
  changesSince,
  hasChanges,
  payloadFor,
  markSeen
};
