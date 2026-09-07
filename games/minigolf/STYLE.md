# Minigolf

`MOODBOARD.html` is de visuele referentie. Dit bestand is de korte, canonieke implementatiegids voor UI- en stylingwerk aan Pluto Minigolf.

## Kernregel

- Dit is een **visuele reskin + layout-rework**, geen redesign van de spelregels.
- Behoud de bestaande Minigolf-mechanics en physics uit GitHub.
- De aangeleverde Plato Minigolf-screenshot bepaalt de visuele richting: fel groen, compacte multiplayer-HUD, volledige baan in beeld, houten muren, duidelijke hazards, speelse props en een dikke witte aim-vector.
- Gebruik geen Plato-logo's of branding.

## Gameplay die niet gewijzigd mag worden

- Match = **5 holes**.
- **1–4 spelers**, met bestaande NPC-support.
- Op de eerste beurt kiest de speler een positie in het **startvak**.
- Schieten gebeurt door **drag-to-aim** op de baan: richting + kracht in één gesture.
- Elke hole heeft een **maxStrokes**-limiet.
- Hole-score blijft Pluto's bestaande rankingmodel: succesvolle spelers krijgen punten volgens hun unieke stroke-rank; DNF = 0 punten.
- Na hole 5 wint de speler met de hoogste **totalPoints**.
- Bestaande physics blijven intact: muur-bounces, bal-bal botsingen, friction en stopgedrag.
- Terrain blijft functioneel identiek:
  - grass = normaal;
  - sand = trager;
  - cement = sterk remmend;
  - water = hazard/reset.
- Bestaande **boosts**, destructible props en vaste obstakels blijven behouden.
- Smart map pool, custom maps en map editor blijven bestaan.

## Visuele identiteit

- Casual mobile-game look, zeer dicht bij de screenshot.
- Hoofdkleuren:
  - sky/header: `#5D9F13` / `#4D8910`
  - grass: `#81D015` / `#95DF1E`
  - boost field: `#4D9C3B`
  - boost arrows: `#9BD97E`
  - wood: `#B96F29`, highlight `#D48B3B`, dark `#8B501E`
  - sand: `#F2CC73`
  - cement: `#EB6E9A`
  - water: `#4FB8E9`
  - hole: `#171B17`
  - flag: `#F23D45`
  - UI white: `#F7FFF0`
- Vermijd dark/neon Pluto-styling binnen de course.
- Gebruik zachte, eenvoudige schaduwen. Geen glassmorphism, zware gradients of dashboard-cards rond de baan.

## Gameplay viewport

- Gameplay is **mobile-first en fixed full-screen**.
- Richt op `100dvh`; geen verticale of horizontale paginascroll tijdens gameplay.
- De baan is het dominante vlak en vult vrijwel alle ruimte onder de HUD.
- Toon de **hele hole in één blik** waar redelijk mogelijk.
- Op desktop: centreer dezelfde game-stage en schaal proportioneel op. Niet uitrekken tot een breed dashboard.
- Geen chatbalk onderaan.
- Geen permanente footer onder de baan.

## Multiplayer HUD

- Eén compacte rij bovenaan met maximaal 4 spelers.
- Per speler:
  - kleine ronde avatar;
  - naam;
  - `SHOT: n` of `START`;
  - kleine ronde badge met `totalPoints`.
- Actieve speler krijgt een duidelijke maar compacte ring/highlight.
- Geen grote player cards.
- Hole-info blijft compact: `HOLE x/5`, naam/gimmick en `MAX SHOTS: n`.
- `MAX SHOTS` mag als kleine houten/plank-badge op de bovenzijde van de course staan, zoals in het moodboard.

## Course styling

- Grass = fel, vlak limegroen.
- Muren = dunne warme houten planken met minimale textuur.
- Layouts moeten visueel boxy/maze-like en helder leesbaar blijven.
- Functionele zones moeten direct herkenbaar zijn:
  - sand = warm geel;
  - cement = roze;
  - water = helder blauw;
  - boost = donkerder groen veld met herhaalde pijlen.
- **Belangrijk:** de pijlenvelden zijn alleen de skin van de bestaande boost-mechanic. Voeg geen nieuwe directional-terrain mechanic toe.
- Startvak = duidelijk wit omlijnd, subtiel checker/grid-patroon.
- Hole = zwarte cup met lichte rand + simpele rode vlag.

## Props

- Gebruik bestaande Minigolf-assets waar mogelijk: boom, tractor, rots, hooibaal, molen.
- Visuele stijl: eenvoudig low-poly/cartoon, zoals de screenshot.
- Functionele collision-props moeten door schaal en schaduw duidelijk "solid" lezen.
- Decoratief gras, bloemen en kleine details mogen alleen wanneer ze niet op collision-objecten lijken.
- Props mogen de leesbaarheid van baan, bal, startvak, hazards of aim-vector nooit hinderen.

## Aim interaction

- Geen aparte power-slider, shoot-knop of control panel.
- Alle primaire interactie gebeurt rechtstreeks op de course.
- Tijdens drag:
  - toon een dikke witte vector vanuit de bal;
  - richting = duidelijk via arrowhead;
  - lengte = relatieve kracht;
  - bestaande powerberekening en shot-logica blijven intact.
- De aim-vector moet boven terrain en decoratie staan en altijd duidelijk leesbaar zijn.

## Status en transitions

- Geen permanente statusregel/footer.
- Status zoals `Jouw beurt`, `Tik in het startvak` of `X slaat…` verschijnt als kleine tijdelijke/translucente pill **over de course**.
- Hole-resultaten verschijnen als tijdelijke gecentreerde overlay tussen holes.
- Daarna verdwijnt de overlay automatisch en wordt de volgende hole getoond.
- Eindresultaat mag als aparte result-state verschijnen, maar niet als permanent onderdeel van de gameplay-layout.

## Map editor

- Functionaliteit van de bestaande map editor niet verwijderen of versimpelen.
- Tools blijven inhoudelijk hetzelfde: startvak, hole, sand, cement, water, muur, boost en props.
- Editor mag dezelfde terrain- en prop-styling gebruiken als de gameplay zodat wat de gebruiker bouwt overeenkomt met wat in-game verschijnt.
- De fixed full-screen gameplayregels gelden niet noodzakelijk voor de editor; bruikbaarheid primeert daar.

## Guardrails

### Do

- Match `MOODBOARD.html` en de screenshot zo dicht mogelijk qua compositie en kleur.
- Maak de course visueel dominant.
- Behoud alle bestaande Minigolf-mechanics, physics, maps en editor.
- Gebruik tijdelijke overlays in plaats van permanente UI onder de baan.
- Hou controls direct, touch-friendly en minimalistisch.

### Don't

- Geen chatbalk.
- Geen permanente footer.
- Geen dashboard/card-shell rond de course.
- Geen aparte power slider of shoot button.
- Geen nieuwe game mechanic introduceren om de screenshot na te bootsen.
- Geen klassieke par-score invoeren ter vervanging van Pluto's bestaande puntenmodel.
- Geen layouts die scroll vereisen tijdens een hole.
