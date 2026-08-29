# Changelog

## v0.11.7 — Blackjack fixen

- Accountbrede chips met correcte uitbetalingen en automatische reset bij nul.
- Volwaardige rondes met Hit, Stand, Double en Split.
- De afrekening blijft zichtbaar tot `Opnieuw` wordt gekozen.
- Compactere mobiele weergave van inzetten, handtotalen en resultaten.

## v0.11.6

- De App-knop blijft zichtbaar in de browser en gebruikt hetzelfde normale lettergewicht als de andere navigatieknoppen.
- Frontend- en service-worker-cache bijgewerkt.

## v0.11.5

- Nieuw Pluto frontier-thema met een rustiger kleurenpalet en compacter kaartoverzicht.
- Nieuw Pluto-logo voor header, PWA, Apple-touch-icon en maskable Android-iconen.
- Volledige mobiele en desktopbrede bovenbanner.
- Nederlandstalige mobiele navigatie.
- Compacte spelkaarten met optionele beschrijvingen achter een infoknop.
- Vereenvoudigde lobby en compact leaderboard.
- Roomcode en deelbare link verplaatst naar de onderkant van rooms.
- Centrale uitslagpopup met rematch- en sluitactie.
- Permanente rematch- en verlaatknoppen in afgelopen games.
- Head-to-headstatistieken op profielen van andere spelers.

## v0.11.4

- Header en Android/PWA gebruiken hetzelfde Pluto-icoon.
- Extra frame rond het headerlogo verwijderd.
- Ondertitel gewijzigd naar `gaming space`.

## v0.11.3

- Rustigere space-wallpaper en coherenter kleurenpalet.
- Recent gespeelde games in dezelfde visuele stijl gebracht.

## v0.11.2

- Nieuwe space-landscapeachtergrond.
- App-knop toegevoegd aan mobiele browsers en verborgen in standalone-modus.
- Mute-icoon volgt de geluidsstatus correct.

## v0.11.1

- Pluto-rebrand doorgetrokken naar merknaam en PWA-iconen.
- Mobiele bottom navigation en vernieuwde cards, panels en knoppen.

## v0.11.0

- Nieuwe Pluto-naam en PWA-branding.
- Compacte geluidsknop en App-installatieknop.
- Mobiele hoofdnavigatie voor Speel, Lobby, Leaderboard en Profiel.
- Desktop behoudt de volledige navigatie.

## v0.10.3

- Alleen matches met minstens twee menselijke spelers tellen mee voor permanente statistieken en leaderboards.
- Matches met één mens en NPC's gelden als oefenmatch.
- Eenmalige reset van oude match- en leaderboardhistoriek; accounts, sessies en custom maps blijven behouden.

## v0.10.1

- Frontendbootstrap en ES-modulefout hersteld.
- Gedeelde kaarthelpers expliciet aan de game-renderer doorgegeven.
- Test-shotresponse van de Minigolf Map Editor hersteld.
- Extra frontendregressietest toegevoegd.

## v0.10.0

- Minigolf toegevoegd met vijf holes per match, dense ranking en een laatste-kansregel.
- Procedurele pool van twintig gevalideerde maps uit verschillende archetypes.
- Ondersteuning voor zand, cement, water, boosts, balbotsingen en interactieve objecten.
- Bescherming tegen stale room states tijdens roomwissels en reconnects.
