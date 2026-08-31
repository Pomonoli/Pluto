# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.7.3

Ticket to Ride heeft een duidelijker en zoombaar speelveld: slepen, pinch-zoom en muiswielzoom werken zoals bij Carcassonne, stadnamen en routebadges overlappen minder en bezette routebadges krijgen een extra rand in de spelerskleur. NPC's kiezen voortaan ook nuttige open treinkaarten in plaats van uitsluitend van de gesloten stapel te trekken. De vijf open kaarten plus stapel en de zes kaarten van `Jouw hand` blijven elk op één rij staan, ook op smallere schermen.

## Nieuw in versie 1.7.0

Age of Civilization is grondig herzien. Victory Points zijn verdwenen: Religie- en Cultuurkaarten verdelen hun bonus nu over Attack, Defence en goud per beurt. Gebouwen kun je voortaan ook upgraden — elke stat schaalt met factor 1,5 en het gebouw krijgt een naam passend bij het huidige tijdperk. Een tijdperk telt drie beurten en de aanvalsgolf wordt alleen op de derde beurt verwerkt. Torens beginnen op 100 in plaats van 20 levenspunten.

## Nieuw in versie 1.0.0

Alle games zijn ondergebracht in zelfstandige modules onder `games/`. Iedere game beheert daar zijn eigen serverlogica, client-entrypoint, metadata, spelregels en resultaten, en de server ontdekt deze mappen automatisch zonder een hardcoded gamelijst in de centrale registry.
Actieve spellen gebruiken zoveel mogelijk de volledige schermhoogte zonder paginascroll. De ongebruikte chat en aparte vertrekknoppen zijn verwijderd; het Pluto-logo brengt je rechtstreeks terug naar Home.

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
