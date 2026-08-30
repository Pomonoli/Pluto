# Architectuur

Pluto gebruikt een lichte pluginarchitectuur zonder buildstap of frontendframework.

## Game-plugins

Elke game staat volledig onder `games/<game>/`:

```text
client.js       browserrenderer en client-hooks
server.js       server-authoritatieve spelregels
manifest.json   metadata en cacheversie
rules.html      spelregels-popup
styles.css      uitsluitend game-specifieke styling
assets/         optionele eigen afbeeldingen
```

Extra modules en views mogen in dezelfde map staan. Minigolf gebruikt zo ook `map-editor.js`, `view.html`, `http.js`, `generator.js` en `assets/`.

`src/games.js` ontdekt plugins bij het starten. Express serveert browserbestanden veilig onder `/game-plugins/<game>/`. De frontend haalt de registry op via `/api/game-plugins` en laadt clients, CSS en eventuele views dynamisch. Een defecte clientmodule schakelt alleen de betreffende game uit.

## Gedeeld platform

- `server.js`: bootstrap en generieke dependency-wiring.
- `src/server/http.js`: gedeelde Express-routes en veilige plugin-serving.
- `src/server/realtime.js`: generieke room- en Socket.IO-lifecycle met optionele game-hooks.
- `src/db.js`: accounts, sessies, statistieken en persistente opslag.
- `public/app.js`: routing, auth, lobby, rooms en dynamische pluginloader.
- `public/js/game-ui.js`: rendererregistratie en werkelijk gedeelde UI-helpers.
- `public/styles.css`: Pluto-shell en gedeelde componenten.

Een game toevoegen of verwijderen vereist geen centrale registrywijziging. Alles wat maar door één game wordt gebruikt hoort in zijn pluginmap.

## Deployment

De Dockerfile kopieert zowel `src/`, `public/` als de volledige `games/`-map naar `/app`. Browsercode heeft geen compilatiestap; lokaal en in Docker worden dus exact dezelfde bestanden en URL's gebruikt.

```bash
docker compose up -d --build
```
