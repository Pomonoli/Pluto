# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.6.4

Drie oude Age of Civilization-testbestanden zijn uit `games/` verwijderd, zodat daar alleen de echte gamefolders, template en documentatie overblijven.

## Nieuw in versie 1.6.0

Actieve spellen gebruiken zoveel mogelijk de volledige schermhoogte zonder paginascroll. De ongebruikte chat en aparte vertrekknoppen zijn verwijderd; het Pluto-logo brengt je rechtstreeks terug naar Home.

Carcassonne behandelt kruispunthoeken als afzonderlijke akkers, toont de volgende tegel alvast aan de volgende speler en gebruikt een compacte eindtabel die binnen één schermbreedte past.

## Nieuw in versie 1.0.0

Pluto kreeg een modulaire game-architectuur: alle games leven als zelfstandige modules onder `games/`, met eigen serverlogica, client-entrypoint, metadata, spelregels en resultaten. De server ontdekt deze modules automatisch, waardoor nieuwe games kunnen worden toegevoegd zonder de centrale registry aan te passen.

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