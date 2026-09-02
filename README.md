# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.15.1

CycClub: het gelijktijdige segment-systeem tijdens een rit (iedereen rijdt een segment, en de rit gaat pas verder zodra alle spelers hun worp voor dat segment bevestigd hebben) is gerepareerd — de segmentvoortgang werd voorheen onterecht per speler bijgehouden in plaats van gedeeld voor de hele rit.

## Nieuw in versie 1.15.0

**The Deep Bleu C** is nu speelbaar met 1 tot 4 spelers in dezelfde wereld — nodig vrienden uit via de gamecode om samen te verkennen en te vissen. Andere spelers zijn zichtbaar op de kaart als gekleurde vis met naamlabel, en een nieuwe knop "Ruilen" laat je vis en geld ruilen met je medespelers: kies wat jij aanbiedt en wat je vraagt, en zij accepteren of weigeren het voorstel. De spelerslijst bovenaan toont voortaan iedereen in de wereld met hun geld en aantal ontdekte soorten.

## Nieuw in versie 1.0.0

Alle games zijn ondergebracht in zelfstandige modules onder `games/`. Iedere game beheert daar zijn eigen serverlogica, client-entrypoint, metadata, spelregels en resultaten, en de server ontdekt deze mappen automatisch zonder een hardcoded gamelijst in de centrale registry.
Actieve spellen gebruiken zoveel mogelijk de volledige schermhoogte zonder paginascroll. De ongebruikte chat en aparte vertrekknoppen zijn verwijderd; het Pluto-logo brengt je rechtstreeks terug naar Home.

## Games

| Spel | Spelers | NPC's |
| --- | ---: | :---: |
| 7 Wonders Duel | 2 | Ja |
| Age of Civilization | 2-7 | Ja |
| Blackjack | 1-4 | Ja |
| Carcassonne | 2-5 | Ja |
| Cascadia | 2-4 | Ja |
| Cluedo | 2-6 | Ja |
| CycClub | 1-6 | Ja |
| The Deep Bleu C | 1-4 | Niet van toepassing |
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
