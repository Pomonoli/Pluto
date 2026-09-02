# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.13.0

Accountnamen kunnen voortaan veilig vanuit het profiel worden gewijzigd zonder verlies van sessie, statistieken of match history. Pluto wacht bij refresh op de sessiecheck, gebruikt tablet- en desktopruimte compacter in de volledige app en alle games, en Presidenten verdeelt `Jouw kaarten` zonder horizontale scroll. De Minigolf Map editor staat nu in de spellobby.

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

Zie [ARCHITECTURE.md](ARCHITECTURE.md) voor de opbouw en [CHANGELOG.md](CHANGELOG.md) voor releases.
Nieuwe games kunnen vanuit de zelfstandige [gametemplate](games/README.md) worden toegevoegd.
