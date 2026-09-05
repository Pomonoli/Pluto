# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.23.1

Age of Civ icons gefixt

## Nieuw in versie 1.23.0

**The Deep Bleu C** heet nu **The Big Blue C** en heeft een volledig nieuwe visuele stijl: een licht, zongebleekt Noords palet waarbij het water donkerder wordt naarmate de zone zwaarder is. De jacht gebruikt nu een dobbelsteen-gevecht (aanvallen, verdedigen, eten, vluchten), er is een nieuw kooksysteem met tijdelijke buffs, combat-gear heeft slijtage en kan gerepareerd worden, je kunt een aanlegsteiger bouwen, en een dag/nacht-cyclus ontgrendelt nachtsoorten.

## Nieuw in versie 1.0.0

Alle games zijn ondergebracht in zelfstandige modules onder `games/`. Iedere game beheert daar zijn eigen serverlogica, client-entrypoint, metadata, spelregels en resultaten, en de server ontdekt deze mappen automatisch zonder een hardcoded gamelijst in de centrale registry.

## Games

| Spel | Spelers | NPC's |
| --- | ---: | :---: |
| 7 Wonders Duel | 2 | Ja |
| Age of Civilization | 2-7 | Ja |
| Bakkermans Jones | 1 | Niet van toepassing |
| The Big Blue C | 1-4 | Niet van toepassing |
| Blackjack | 1-4 | Ja |
| Carcassonne | 2-5 | Ja |
| Cascadia | 2-4 | Ja |
| Cluedo | 2-6 | Ja |
| CycClub | 1-6 | Ja |
| Hartenjagen | 4 | Ja |
| Hofslag | 2-4 | Ja |
| Isle of Skye | 2-4 | Ja |
| Kingdomino | 2-4 | Ja |
| Minigolf | 1-4 | Ja |
| Pesten | 2-4 | Ja |
| Presidenten | 3-4 | Ja |
| Quoridor | 2-4 | Ja |
| Santorini | 2-4 | Ja |
| Solitaire | 1 | Niet van toepassing |
| Stratego | 2 | Ja |
| Ticket to Ride | 2-5 | Ja |

Minigolf bevat daarnaast een Map Editor voor eigen banen.

De volledige versiegeschiedenis staat in de [changelog](CHANGELOG.md).

## Installeren

```bash
git clone https://github.com/Pomonoli/Pluto.git
cd Pluto
docker compose up -d --build
```

Open daarna `http://localhost:3000`.

## Homelab bijwerken

```bash
cd ~/homelab/pluto && git pull --ff-only origin main && docker compose up -d --build
```

## Data

Accounts, Blackjack-chips, sessies, statistieken en custom maps staan in `data/minigames.db`. Back-ups staan in `data/backups/`.

## Ontwikkelen

Vereist Node.js 22 of nieuwer.

```bash
npm install
npm start
npm test
```

`npm test` selecteert de gewijzigde games plus de algemene tests voor accounts, lobby,
rooms, frontend en pluginintegratie. Een nieuwe game vereist geen vaste gameteller meer.
`npm run check` doet dezelfde selectie met syntaxcontrole.

| Commando | Gebruik |
| --- | --- |
| `npm test` | Automatisch relevante tests |
| `npm run check` | Relevante tests plus syntaxcontrole |
| `npm test -- --game hartenjagen` | Bewust alleen deze game plus algemene tests |
| `npm test -- --base origin/main` | Alle wijzigingen op de branch sinds de gemeenschappelijke basis |
| `npm test -- --list` | Alleen de selectie tonen |
| `npm run test:all` | Volledige testsuite |
| `npm run check:all` | Volledige testsuite plus syntaxcontrole |

Automatische selectie telt gecommitte branchwijzigingen, staged/unstaged wijzigingen
én nieuwe bestanden mee. Op een schone main wordt de laatste commit bekeken.
`--game` is een expliciete afbakening en kan herhaald worden; gebruik dit alleen als
je zeker weet dat de wijziging geen gedeelde code raakt. `--base` gebruikt lokale Git-refs;
voer zo nodig eerst `git fetch origin` uit.

Wijzigingen aan gedeelde code (zoals registry, sockets, auth, templates, globale UI,
dependencies of de testrunner) starten automatisch de volledige suite. Zuivere
versiebumpjes en releasebeschrijvingen verbreden de selectie niet. Zonder bruikbare
Git-historiek draait uit voorzorg de volledige suite. Een ongeldige expliciete
`--base` of gamenaam geeft een fout.

Plaats gametests in `test/<game>.test.js`, `test/<game>-*.test.js`,
`test/<game>/` of `games/<game>/`, met de extensie `.test.js`, `.test.cjs` of `.test.mjs`.
Andere bestanden onder `test/` vormen de algemene suite. De integratiechecks laden
alle plugins en controleren manifests en HTTP-assets, zonder alle spellen uit te spelen.

Zie [ARCHITECTURE.md](ARCHITECTURE.md) voor de opbouw en [CHANGELOG.md](CHANGELOG.md) voor releases.
Nieuwe games kunnen vanuit de zelfstandige [gametemplate](games/README.md) worden toegevoegd.
