# Changelog

## v1.1.0 — Self-contained game-plugins

- Iedere game beheert voortaan zijn eigen browserrenderer, helpers, styling, spelregels en optionele assets.
- De centrale frontend bevat alleen nog gedeelde Pluto-infrastructuur en bouwt het gameoverzicht dynamisch uit de pluginmanifests op.
- Minigolf bevat nu ook zijn Map Editor, extra view, HTTP-hooks en assets volledig in de eigen pluginmap.
- Pluginclients, CSS, views en assets worden lokaal en in Docker via expliciete, veilige Express-routes geladen.
- Een ontbrekende of defecte frontendplugin schakelt alleen die game uit en haalt niet langer de volledige Pluto-frontend onderuit.
- Architectuur- en productieroutetests bewaken alle pluginbestanden en Docker-paden.

## v1.0.1 — Docker deployment fix

- De volledige `games/`-map wordt voortaan naar `/app/games` in de Docker-image gekopieerd.
- Een regressietest voorkomt dat modulaire games opnieuw uit toekomstige images verdwijnen.

## v1.0.0 — Modulaire games

- Alle bestaande games staan als zelfstandige modules onder `games/`.
- Iedere game beheert zijn serverlogica, client-entrypoint, metadata, spelregels en resultaten in de eigen map.
- De server ontdekt games automatisch; de centrale registry bevat geen hardcoded gamelijst meer.
- Oude losse gamebestanden en centrale spelregels zijn opgeruimd.
- De template en architectuurtests bewaken de nieuwe uitbreidbare structuur.

## v0.13.1 — Uitbreidbare game-architectuur

- Nieuwe games kunnen als zelfstandige map onder `games/` worden toegevoegd.
- Serverlogica, frontendweergave, styling, metadata en spelregels worden automatisch geladen.
- Een kopieerbare template en Nederlandstalige handleiding maken handmatig toevoegen eenvoudiger.
- De bestaande games blijven volledig compatibel.

## v0.13.0 — Carcassonne

- Carcassonne toegevoegd voor 2 tot 5 spelers, inclusief NPCs.
- Server-gevalideerde tegelplaatsing, rotatie, verbonden projecten, horigen en volledige puntentelling.
- Mobiel landschap met legale plaatsingsvelden, pannen, pinch-zoom en een compacte spelerstatus.
- Carcassonne-resultaten werken mee in profielen, matchgeschiedenis en leaderboards.

## v0.12.2 — Cluedo-notitieblok

- Cluedo Lite heet voortaan Cluedo.
- Het notitieblok wisselt correct tussen onbekend, uitgesloten en verdacht zonder dat de pagina verspringt.
- Suggestiekeuzes blijven behouden en tonen de notities en eigen kaarten met duidelijke kleurcodes.
- Bekende kaarten zijn per soort gegroepeerd en de spelweergave is compacter.

## v0.12.1 — Spelregels en Solitaire draw-3

- Infoknoppen op het startscherm openen voortaan de volledige spelregels.
- Korte spelbeschrijvingen zijn uit de gamekaarten verwijderd.
- Solitaire gebruikt nu de uitdagendere Klondike draw-3-variant.

## v0.12.0 — Kaartspellen verfijnd

- Hartenjagen heeft een stabiele mobiele tafel, compacte score- en handkaarten en logisch gesorteerde speelkaarten.
- Presidenten en Pesten tonen speelbaarheid, tegenstanders en vorige kaarten duidelijker.
- Solitaire en Blackjack kregen verbeterde bediening, statistieken en leaderboards.
- Speltitels zijn compacter en Zenuwen is verwijderd.

## v0.11.9 — Pesten-kaarten en scrollbars

- Niet-speelbare kaarten blijven gedempt maar zijn volledig ondoorzichtig.
- Kaarten rechts krijgen altijd voorrang in de waaier.
- Native scrollbars zijn verborgen zonder het scrollgedrag uit te schakelen.

## v0.11.8 — Pesten-weergave

- Mobiele spelkaart blijft binnen de toestelbreedte.
- Eigen hand is leesbaar gestapeld met de rechtse kaart bovenaan.
- Handen van tegenstanders worden als kaart-ruggen rond de tafel getoond.
- Dubbel Pesten-label verwijderd.

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
