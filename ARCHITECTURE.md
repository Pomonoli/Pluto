# Architectuur

v0.9 is een structurele refactor. Er zijn bewust geen nieuwe spelregels of features toegevoegd.

## Backend

```text
server.js
└── bootstrap / dependency wiring

src/
├── server/
│   ├── http.js          Express routes + static app
│   ├── realtime.js      rooms + Socket.IO lifecycle
│   └── maintenance.js   database backups
├── minigolf.js          Minigolf game engine
├── minigolf/
│   └── generator.js     smart procedural map archetypes
├── db.js                persistence
├── results.js           match → leaderboard result conversion
└── <game>.js            one server-authoritative engine per game
```

### Regels

- `server.js` bevat geen businesslogica.
- HTTP kent geen Socket.IO eventimplementaties.
- Realtime roombeheer kent geen Express routes.
- Minigolf mapgeneratie staat los van de physics/game-engine.
- Iedere game blijft server-authoritative.

## Frontend

```text
public/
├── app.js
└── js/
    ├── rules.js         statische spelregels
    ├── game-ui.js       game renderers + game-specific UI
    └── map-editor.js    Minigolf Map Editor
```

`app.js` is de platform-controller: routing, auth, lobby, room lifecycle, chat en event wiring.

Game-specifieke rendering zit niet meer tussen account/lobby/router-code.
De Map Editor heeft een eigen module.

## Waarom geen framework/build step?

Voor deze homelab-app is een React/Vite/Webpack-stack niet nodig. ES modules in de browser en CommonJS in Node houden deployment op:

```bash
docker compose up -d --build
```

Er is dus nog steeds:
- één container
- geen frontend build pipeline
- geen extra database-server
- geen Redis
- geen package-manager tooling op de client

Dat is bewust: modulair waar het regressies voorkomt, simpel waar extra infrastructuur niets oplevert.
