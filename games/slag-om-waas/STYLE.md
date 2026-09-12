# Total Waas — stijlgids

Visuele referentie: de conceptkaart "De Slag om Waas" (oude naam) (tabletop-strategiekaart van het Waasland in een donkerhouten kist); `assets/waas-board-reference.png` is een export van het huidige bord. Deze gids is de canonieke, compacte samenvatting; `GAME_SPEC.md` beschrijft de spelregels.

## Kernregel

- **Bordspel-first**: de kaart is het scherm. Panelen zijn compact en ondersteunend; geen mobiele-game-menu's, geen overdaad aan knoppen.
- Toon alleen geldige acties. De speler moet het bord kunnen lezen zonder de regels te raadplegen.
- Alles is gescoped onder `.sow-root`; niets lekt naar de Pluto-shell.

## Layout

1. Titlebar (Pluto) met ronde en speler aan de beurt.
2. Bord links (of bovenaan op mobiel), paneel rechts (320px) of eronder.
3. Paneel-volgorde: beurtblok → spelerskaarten (factie, schatkist, draagvlak, sectoren, legermacht) → sectorinfo (perkament) → legende → log.

## Bord

- Donkerhouten achtergrond (`#1e130c`) met afgeschuinde houten lijst (border-image-gradient, houtnerf via repeating-gradient, inset-schaduw). Het bord zelf is perkament (gradient `#f4e8cf`→`#dcc9a3`) met twee donkere offset-lagen eronder voor 2.5D-dikte.
- Provincies zijn Voronoi-cellen, gegroepeerd per regio (`#regio-<id>`, `.biome-*`). Basiskleur per biome (licht/donker naargelang terrein): Noord `#d4e6f1`/`#85c1e9` sparren, West `#f8c471`/`#e59866` duinarcering, Oost `#58d68d`/`#28b463` akkerrijen, Zuid `#5dade2`/`#2e86c1` waterrimpels, Sint-Niklaas `#a6acaf`/`#7f8c8d` metselwerk. Veroverd gebied krijgt een tint (38 %) van de veroveraar; rebellenland wordt licht gedoofd.
- Factiegrenzen: brede gekleurde lijn met feDropShadow-gloed in de factiekleur plus een dunne lichte kernlijn (neon-effect), naar binnen geclipt en enkel waar de buur tot een andere groep behoort. Interne celgrenzen dun, halftransparant perkamentbruin.
- Hover: lichte brightness. Geselecteerd: witte rand met gloed; buren: crème rand; overige sectoren gedimd (55 %).
- Hoofdwegen: crème dashed op donkere onderlijn, vloeiend (Catmull-Rom). Moervaart: blauw met lichte oever, houten brugjes op de bruggen. Schelde: brede meanderende band met lichte oeverrand, koggeschepen. Stadsmuur: cirkel met kantelen rond Sint-Niklaas.
- Troepenbadges: cirkel in factiekleur; rebellen donkerbruin met gestippelde rand.
- Labels in Cinzel (fallback Georgia) met lichte outline; hoofdsteden groter, Sint-Niklaas het grootst. Vector-POI-iconen: kasteel (Sint-Niklaas), stadstoren (Lokerzand), haven/kogge (Temsehaven, Steendorpwerf, Doelhaven, Zwijndrechtwerf), bomenclusters (Stekenburg, Pauwelsbos, Stropersbos, Sinaaiwoud), molens (Beverhof, Kielpolder).
- Perkament-titelbanner linksboven, kompasroos eronder; buitenwereld (Nederland, Antwerpen, Bornem, Gent) als kapitalen buiten de bordrand.

## Palet

- Zuid (water): `#22b8dd` · West (droog): `#f0a12e` · Noord (bos/sneeuw): `#2f6fd6` · Oost (landbouw): `#7cbf2a` · Sint-Niklaas: `#d9c58a`.
- Terreinkleuren zitten in de biome-paletten hierboven; `TERRAINS.fill` in board.js dient nog enkel voor de legende.
- Perkament `#f3e7cf` / inkt `#2b2118` / goud `#c9a24b` / hout `#1e130c`–`#5a3a22`.

## Thema's

- Panelen gebruiken de Pluto-variabelen (`--panel`, `--text`, `--muted`, `--border`) zodat licht en donker thema automatisch kloppen.
- Het bord en het perkamenten sectorpaneel houden hun vaste tabletop-look in beide thema's.
