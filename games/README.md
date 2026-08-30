# Pluto game-plugins

Nieuwe spellen kunnen als zelfstandige map worden toegevoegd. De server ontdekt deze mappen automatisch bij een herstart; centrale bestanden hoeven niet aangepast te worden.

## Snel starten

1. Kopieer de map `_template` naar bijvoorbeeld `games/mijnspel`.
2. Zet in `manifest.json` de `key` op exact dezelfde kleine mapnaam (`mijnspel`).
3. Pas `server.js`, `client.js`, `styles.css` en de regels in `manifest.json` aan.
4. Herstart Pluto en voer `npm test` uit.

Een pluginmap bevat:

```text
games/mijnspel/
  manifest.json  # naam, spelers, homekaart, regels en assetversie
  server.js      # server-authoritatieve spelregels
  client.js      # renderer en optionele resultaathelpers
  styles.css     # alleen CSS van dit spel
```

## Servercontract

`server.js` exporteert minimaal:

- `createGame(roomPlayers)` — maakt de volledige serverstate;
- `handleAction(game, playerId, action, payload)` — valideert en verwerkt acties;
- `serialize(game, requesterId, connected)` — stuurt uitsluitend publieke/persoonlijke clientstate;
- optioneel `tick(game, now)` — verwerkt NPCs en timers en retourneert `true` als state veranderde;
- optioneel `results(game, durationMs)` — vertaalt het eindresultaat naar matchstatistieken.

Vertrouw nooit op de client voor beurten, scores, kaartgeheimen of geldige zetten. Valideer iedere actie in `handleAction`.

## Clientcontract

`client.js` exporteert `render(api)`. De belangrijkste waarden in `api` zijn:

- `room`, `game`, `state`, `els`;
- `E(tag, className, text)` voor DOM-elementen;
- `action(name, payload)` voor een serveractie;
- `titlebar(name, status)` en `logBox(lines)`;
- `sound(kind)`.

Optioneel kan het bestand `metric`, `presentResult` en `isWinner` exporteren.

## Publiceren

Verhoog bij een client- of CSS-wijziging de `version` in het pluginmanifest. Bij een Pluto-release moeten daarnaast de normale app- en service-workerversies worden verhoogd.

Mappen die met `_` of `.` beginnen worden genegeerd. Daarom verschijnt `_template` niet als spel.
