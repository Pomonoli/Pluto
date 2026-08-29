# Pluto v0.11.6

Pluto is de nieuwe naam van de private custom-minigames app.

## v0.11 UI / rebrand

- naam en PWA branding: Pluto
- origineel planeetlogo als home-knop en app-icon
- tagline: `custom minigames`
- geluid is één compacte icon-knop die de actie toont
- `Installeren` heet `App`
- mobiel: vaste compacte bottom navigation met Play, Lobby, Leaderboard en Profile
- mobiel bovenaan: alleen Pluto/home en mute/unmute
- desktop behoudt volledige navigatie

## v0.10.3: ranked matches + leaderboard reset

- matches tellen alleen mee voor permanente stats/leaderboards als minstens 2 menselijke spelers deelnemen
- 1 mens + alleen NPC's is een oefenmatch en wordt niet opgeslagen in match history
- bestaande match/leaderboard-history wordt bij de eerste start van v0.10.3 éénmalig gewist
- accounts, sessies en custom Minigolf-maps blijven behouden
- de reset gebruikt een persistente migration marker en gebeurt dus niet opnieuw bij latere restarts

# Pluto v0.11

## v0.10.1 hotfix

- herstelt frontend bootstrap: een overbodige afsluitende accolade maakte `app.js` ongeldig als ES module
- game renderer krijgt gedeelde kaarthelpers expliciet geïnjecteerd
- Minigolf Map Editor leest test-shot response opnieuw correct
- extra ES-module regressietest toegevoegd zodat deze volledige-site fout niet opnieuw ongemerkt kan passeren


Private self-hosted minigame-platform voor vrienden.

## Games

- Hofslag
- Blackjack
- Solitaire
- Presidenten
- Pesten
- Zenuwen
- Hartenjagen
- Cluedo Lite
- Minigolf

## v0.10

### Minigolf

- 5 holes per match.
- Per hole: met `X` spelers krijgt de beste score `X-1` punten, daarna `X-2`, enzovoort.
- Ex aequo krijgt dezelfde positie-score.
- DNF = 0 punten.
- Als nog één speler overblijft, krijgt die maximaal één laatste poging tot de stroke-count van de laatste finisher.
- Op je eerste beurt van een hole kies je eerst je plek in het startvak en speel je meteen slag 1.
- Alleen het middelpunt van de bal moet in het startvak liggen.
- De server genereert per match een slimme pool van 20 speelbare maps uit 10 archetypes/gimmicks en kiest daar 5 unieke maps uit.
- Voorbeelden van archetypes: poorten, zandroute, roze slowdown, boerderij, boosts, waterchicane, pinball, eilanden, kruispunt en hindernisbaan.
- Iedere gegenereerde/custom map passeert de playability-validator voordat hij in een match kan komen.
- Gras = normaal, zand = slowdown, roze cement = extreme slowdown, water = reset na de slag.
- Boostpijlen versnellen de bal in hun richting.
- Ballen botsen met elkaar.
- Bomen, tractors en hooibalen hebben echte collision en verdwijnen pas na de impact.
- Rotsen en andere vaste objecten blijven staan.

### Fixes

- Roomwissel/reconnect is afgeschermd tegen stale room states. Een verlaten Golf-room kan een later gestarte Hofslag-room niet meer overschrijven.
- Bij Zenuwen blijven niet-speelbare kaarten volledig zichtbaar; speelbare kaarten krijgen alleen een subtiele highlight.

## Architectuur

Zie `ARCHITECTURE.md`.

Belangrijkste structuur:

```text
server.js                 bootstrap
src/server/http.js        HTTP/API/static
src/server/realtime.js    Socket.IO + rooms
src/server/maintenance.js backups
src/<game>.js             server-authoritative game engines
src/minigolf.js           Minigolf physics + flow
src/minigolf/generator.js smart procedural map generation
public/app.js             platform controller
public/js/game-ui.js      game rendering
public/js/map-editor.js   Minigolf Map Editor
public/js/rules.js        spelregels
```

Er is bewust geen frontend build pipeline of extra database-server. Deployment blijft één Docker-container met SQLite.

## Persistente data

```text
data/minigames.db
```

De `data/` map bevat accounts, sessies, match history, leaderboards en custom maps. Bewaar deze map bij iedere upgrade.

## Upgrade

```bash
cd ~/homelab/minigames

cd minigames-platform
docker compose down
cd ..

mv minigames-platform minigames-platform-v0.9-backup
unzip minigames-platform-v0.10.zip
cp -a minigames-platform-v0.9-backup/data minigames-platform/

cd minigames-platform
docker compose up -d --build
```

Controle:

```bash
docker compose ps
docker compose logs --tail=100
```

Cloudflare blijft op dezelfde service/poort staan.

## Tests

```bash
npm test
```

## Map Editor

`/minigolf/editor`

Custom maps worden in SQLite opgeslagen. Opslaan vereist een account. Een onbereikbare map wordt geweigerd en komt niet in random matches.

## v0.11.1: Pluto visual refresh

- Android/PWA app-icoon vervangen door planeet-icoon
- maskable Android icons toegevoegd
- merknaam overal op `Pluto`
- desktop `App`-knop terug normaal
- UI dichter naar de space/cartoon mockup
- kleurrijke ruimte-achtergrond
- speelsere kaarten, panels en knoppen
- home blijft het Play-tabblad met de gamelijst


## v0.11.2: scenic background + mobile install button + mute fix

- nieuwe space-landscape achtergrond
- cards/panels aangepast aan beter thema-palet
- mute-icoon wisselt nu correct mee met status
- App-knop terug zichtbaar op mobile browser
- App-knop blijft verborgen in standalone/PWA-modus


## v0.11.3: visual polish

- home-icoon en app-icoon nu identiek
- nieuwe rustige space-wallpaper als achtergrond
- coherenter kleurenpalet voor cards en knoppen
- recent gespeelde games mee in thema


## v0.11.4: unified logo

- header gebruikt exact hetzelfde Pluto-icoon als Android/PWA
- geen extra frame meer rond het headerlogo
- ondertitel gewijzigd naar `gaming space`
