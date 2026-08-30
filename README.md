# Pluto

Private, self-hosted minigameplatform voor vrienden, met realtime rooms, accounts, leaderboards en een installeerbare PWA.

## Nieuw in versie 1.0.0

Pluto 1 vormt de eerste stabiele hoofdversie van het platform. De app combineert negen minigames met realtime rooms, NPCs, accounts, blijvende statistieken, leaderboards en een installeerbare mobiele PWA in één self-hosted omgeving.

Games zijn zelfstandige modules onder `games/`. Elke game beheert daar zijn serverlogica, client-entrypoint, metadata, spelregels en resultaten. De server ontdekt deze mappen automatisch, waardoor nieuwe games vanuit de meegeleverde template kunnen worden toegevoegd zonder de centrale registry aan te passen.

## Nieuw in versie 1.1.0

Games zijn nu werkelijk self-contained: hun renderer, helpers, CSS, spelregels, assets en eventuele extra views of modules leven samen in één pluginmap. Pluto ontdekt en laadt die onderdelen dynamisch, terwijl een defecte plugin alleen de betreffende game uitschakelt. De Minigolf Map Editor is eveneens volledig naar zijn plugin verhuisd en nieuwe productiechecks bewaken alle browser- en Docker-paden.

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
