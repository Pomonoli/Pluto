# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.0.0

Pluto 1 vormt de eerste stabiele hoofdversie van het platform. De app combineert negen minigames met realtime rooms, NPCs, accounts, blijvende statistieken, leaderboards en een installeerbare mobiele PWA in één self-hosted omgeving.

Games zijn zelfstandige modules onder `games/`. Elke game beheert daar zijn serverlogica, client-entrypoint, metadata, spelregels en resultaten. De server ontdekt deze mappen automatisch, waardoor nieuwe games vanuit de meegeleverde template kunnen worden toegevoegd zonder de centrale registry aan te passen.

## Nieuw in versie 1.0.1

De Docker-deployment bevat nu ook de volledige `games/`-map. Daarmee is de opstartcrash uit 1.0.0 opgelost en zijn alle negen games beschikbaar in een gebouwde container. Een regressietest bewaakt dat deze map in toekomstige images aanwezig blijft.

## Games

Hofslag, Blackjack, Solitaire, Presidenten, Pesten, Hartenjagen, Cluedo, Carcassonne en Minigolf met een Map Editor.

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
