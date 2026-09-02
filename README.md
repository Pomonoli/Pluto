# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.14.0

De kaart van **The Deep Bleu C** is omgezet naar een hexagonaal tegelraster met meer rivieren, grotere meren en een uitgestrekte binnenzee. Aquarium-Museum, Handelsmarkt en Hall of Fame zijn nu speelbaar en samen met De Vishandel bereikbaar via een vaste knoppenbalk, zonder ernaartoe te hoeven lopen. De Handelsmarkt verkoopt upgrades voor hengel, aas en boot (nodig om het uitgebreide water over te steken), volledige visverzamelingen geven een geldbonus en blijvend hogere verkoopprijs, de Hall of Fame toont een leaderboard, een minimap toont altijd je positie, en ingelogde spelers behouden voortaan hun voortgang tussen speelsessies. Het speelveld vult nu het volledige zichtbare veld zonder blauwe rand, met een reliëfachtige achtergrond van gebergte en bebossing die de kaart meer op Europa laat lijken, naadloos aansluitende hexagontegels met een vagere omranding, en een speelfiguur dat een vis in vogelvluchtperspectief met hengellijn is. De kaart volgt inmiddels een echte Europese kustlijn (Iberisch Schiereiland, Italië/Balkan, Oostzee, Zwarte Zee, Britse eilanden) met meer bos en deels onbegaanbare bergpieken, en het hele spel past voortaan op één scherm: de 4 gebouwknoppen staan naast de kaart onder de minimap, vissen verschijnt als pop-up op de kaart, en Vishandel, Aquarium-Museum, Handelsmarkt en Hall of Fame openen als apart scherm met een terugknop. Er zijn nu 80 vissoorten verdeeld over 8 sets van elk 10 vissen (2 per watersoort); een set voltooien geeft naast de geldbonus en verkoopprijsbonus ook een gratis niveau voor hengel, aas of boot. De Vishandel toont de verkoopprijs per vis en laat je met selectievakjes precies kiezen welke vis(sen) je verkoopt, naast de bestaande "Verkoop alles"-knop. Daarnaast toont **CycClub** je ploeg nu als een overzichtstabel (naam, leeftijd, specialisme, eigenschappen, status, kostprijs, vermoeidheid en verkoopoptie) — je hele team in één oogopslag, met een maximum van 10 renners per ploeg. Je start voortaan met €100.000 budget en een lege ploeg; alle renners koop je zelf via de Scoutingmarkt, die nu ook in tabelvorm staat en zichzelf altijd aanvult. Een "Opnieuw beginnen"-knop laat je (na bevestiging) je volledige voortgang definitief wissen, en de 7 statistiekvakken bovenaan zijn samengevoegd tot één compact overzicht. De upgrade-status staat compact bovenaan, en Shop, Scoutingmarkt en Koerskalender openen als aparte tabs naast de Ploeg. Shop & Upgrades staat in een 2×2-veld met een voortgangsbalk en de concrete bonus per niveau: Fietsen & Materiaal verhogen de snelheid en verlagen de pechkans, Voeding & Supplementen verbeteren het duurvermogen en verminderen vermoeidheid, Trainers & Analyse versterken de 3 beste statistieken van elke renner, en de Medische Staf verkort blessuretijd en verlaagt ziektekans. De Koerskalender onderscheidt nu monumenten, Vlaamse klassiekers, grote ritten en grote rondes — met prijzengeld dat meestijgt met de moeilijkheidsgraad. Elke rit bestaat uit 8 dobbelsteen-segmenten met ploegbonussen (net als bij D&D) — pech, een val, een opportuniteit of een topdag — met een segment-logboek in het resultaatscherm. Ritten zijn nu ook echt zelf te spelen: je rolt per segment de dobbelsteen en ziet je ploeg als gekleurde stippen vooruitgaan op een grafiek van het rittenprofiel, en kiest telkens om je verworven multiplier meteen toe te passen of op te sparen voor het volgende segment (+12,5% per keer sparen). Alle ploegen rijden elk segment gelijktijdig en gaan pas samen naar het volgende segment zodra iedereen zijn worp heeft bevestigd. De renners komen voortaan uit de 10 grootste WorldTour-ploegen van het 2026-seizoen, met hun actuele team erbij in de ploeg- en scoutingtabel, en hun statistieken zijn individueel afgestemd op hun echte specialiteiten (in lijn met ProCyclingStats) voor een veel groter statistiek- en prijsbereik. De tabellen "Ploeg" en "Scoutingmarkt" zijn versmald naar 5 resp. 4 kolommen met 3 rijen per renner, mobielvriendelijker dan voorheen; de Scoutingmarkt toont voortaan 10 renners tegelijk, met filters op statistiek en kostprijs en een ververs-knop om nieuwe renners in te laden. **Age of Civilization** heeft een 8ste leider, King Harald Hardrada, die bij elke aanvalsgolf goud plundert van zijn doelwit; het upgraden van een gebouw in je stad vermenigvuldigt de stat nu met x1.5 per niveau (voordeliger dan een nieuw gebouw kopen); Observatorium, Grote Tempel en Academie geven elk een gerichte bonus per gebeurtenis (Wetenschap → Attack, Cultuur → Goud, Religie → Defence) die met 10% per tijdperk groeit tot +70% in tijdperk 7; en de bevestigingspopup bij zo'n gebeurtenis toont voortaan het exacte bonuspercentage.

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
| The Deep Bleu C | 1 | Niet van toepassing |
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
