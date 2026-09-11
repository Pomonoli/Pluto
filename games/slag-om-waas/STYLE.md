# De Slag om Waas — stijlgids

Visuele referentie: de conceptkaart "De Slag om Waas" (tabletop-strategiekaart van het Waasland in een donkerhouten kist); `assets/waas-board-reference.png` is een export van het huidige bord. Deze gids is de canonieke, compacte samenvatting; `GAME_SPEC.md` beschrijft de spelregels.

## Kernregel

- **Bordspel-first**: de kaart is het scherm. Panelen zijn compact en ondersteunend; geen mobiele-game-menu's, geen overdaad aan knoppen.
- Toon alleen geldige acties. De speler moet het bord kunnen lezen zonder de regels te raadplegen.
- Alles is gescoped onder `.sow-root`; niets lekt naar de Pluto-shell.

## Layout

1. Titlebar (Pluto) met ronde en speler aan de beurt.
2. Bord links (of bovenaan op mobiel), paneel rechts (320px) of eronder.
3. Paneel-volgorde: beurtblok → spelerskaarten (factie, schatkist, draagvlak, sectoren, legermacht) → sectorinfo (perkament) → legende → log.

## Bord

- Donkerhouten kader (`#3a2216`/`#55321f`) met gouden binnenlijn; het bord zelf is perkament (`#e5d5b4`) met slagschaduw.
- Provincies zijn Voronoi-cellen met **terreinkleur** als basis, een **terreinpatroon** (bomen, sneeuwvlokken, duinen, golven, akkerrijen, huizenblokken) en een **factietint** (34 %) eroverheen. De neutrale Sint-Niklaas-regio is goudkleurig (26 %); rebellenprovincies van niet-gekozen facties krijgen een vage thuiskleur (10 %) met een gestippelde rand.
- Factiegrenzen: dikke gekleurde rand naar binnen geclipt, alleen waar de buur een andere controller heeft. Interne sectorgrenzen dun donker.
- Hover: lichte brightness. Geselecteerd: witte rand met gloed; buren: crème rand; overige sectoren gedimd (55 %).
- Hoofdwegen: crème dashed op donkere onderlijn. Moervaart: blauwe lijn op donkerblauwe onderlijn langs de Noord|West-grens, brug-glyph op de bruggen. Schelde: brede rivier op de oost- en zuidrand met schepen. Stadsmuur: gestippelde crème cirkel rond Sint-Niklaas.
- Troepenbadges: cirkel in factiekleur; rebellen donkerbruin met gestippelde rand.
- Labels in serif (Georgia) met lichte outline; hoofdsteden groter met factie-embleem, Sint-Niklaas het grootst met 🏰.
- Buitenwereld (Nederland, Antwerpen, Bornem, Gent) als kleine kapitalen buiten de bordrand; kompas linksboven.

## Palet

- Zuid (water): `#22b8dd` · West (droog): `#f0a12e` · Noord (bos/sneeuw): `#2f6fd6` · Oost (landbouw): `#7cbf2a` · Sint-Niklaas: `#d9c58a`.
- Terrein: water `#3c8fc4`, moeras `#5fa88a`, zand `#e2b96a`, vlakte `#d8c689`, bos `#3f7a4a`, sneeuw `#dfe8f2`, landbouw `#9ccf5a`, stad `#b9b0a0`.
- Perkament `#f3e7cf` / inkt `#2b2118` / goud `#c9a24b`.

## Thema's

- Panelen gebruiken de Pluto-variabelen (`--panel`, `--text`, `--muted`, `--border`) zodat licht en donker thema automatisch kloppen.
- Het bord en het perkamenten sectorpaneel houden hun vaste tabletop-look in beide thema's.
