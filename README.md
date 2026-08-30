# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.6.0

Spellen gebruiken voortaan zoveel mogelijk de volledige schermhoogte zonder paginascroll. De ongebruikte chat en aparte vertrekknoppen zijn verwijderd; het Pluto-logo brengt je rechtstreeks terug naar Home.

Carcassonne toont de eindscore in een compacte tabel met pictogrammen, laat de volgende speler alvast zijn tegel bekijken en plaatst landbouwers correct in afzonderlijke hoekakkers rond kruispunten.

## Nieuw in versie 1.5.0

Age of Civilization is toegevoegd als veertiende spel. Twee spelers bouwen gedurende zeven tijdperken een beschaving met militaire, economische en culturele kaarten, verdedigen hun toren tegen steeds sterkere aanvalsgolven en strijden om de hoogste eindscore. Het spel ondersteunt ook een NPC-tegenstander.

## Nieuw in versie 1.4.0

Pluto werkt voortaan volledig via de centrale lobby: open lobby's verschijnen als compacte kaartjes op Home, terwijl oude roomlinks en code-invoer uit de interface zijn verwijderd. Tijdens een spel verdwijnt de mobiele ondernavigatie en blijft alleen een duidelijke knop `Verlaat spel` over.

Carcassonne toont op het eindscherm nu een volledige puntentabel met de punten tijdens het spel en de eindpunten voor landbouwers, onafgewerkte wegen, steden en kloosters.

## Nieuw in versie 1.3.0

Carcassonne gebruikt nu afzonderlijke akkersegmenten: wegen en steden scheiden akkers, kloosters niet. Landbouwers verschijnen op het juiste deel van de tegel, spelers kunnen tijdens de burgerkeuze teruggaan om hun tegel anders te leggen en de laatst gespeelde tegel heeft een rode markering. Op mobiel staan de twee Minigolf-acties voortaan naast elkaar.

Pluto bevat nu veertien spellen met realtime rooms, accounts, blijvende statistieken, leaderboards en een installeerbare mobiele PWA in één self-hosted omgeving.

Games zijn zelfstandige modules onder `games/`. Elke game beheert daar zijn serverlogica, client-entrypoint, metadata, spelregels en resultaten. De server ontdekt deze mappen automatisch, waardoor nieuwe games vanuit de meegeleverde template kunnen worden toegevoegd zonder de centrale registry aan te passen.

## Nieuw in versie 1.1.0

Games zijn nu werkelijk self-contained: hun renderer, helpers, CSS, spelregels, assets en eventuele extra views of modules leven samen in één pluginmap. Pluto ontdekt en laadt die onderdelen dynamisch, terwijl een defecte plugin alleen de betreffende game uitschakelt. De Minigolf Map Editor is eveneens volledig naar zijn plugin verhuisd en nieuwe productiechecks bewaken alle browser- en Docker-paden.

## Games

| Spel | Spelers | NPC's |
| --- | ---: | :---: |
| Age of Civilization | 2 | Ja |
| Blackjack | 1-4 | Ja |
| Carcassonne | 2-5 | Ja |
| Cluedo | 2-6 | Ja |
| Hartenjagen | 4 | Ja |
| Hofslag | 2-4 | Ja |
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

Zie [ARCHITECTURE.md](ARCHITECTURE.md) voor de opbouw en [CHANGELOG.md](CHANGELOG.md) voor releases.
Nieuwe games kunnen vanuit de zelfstandige [gametemplate](games/README.md) worden toegevoegd.
