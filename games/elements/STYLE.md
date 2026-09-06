# Elements Arena

`MOODBOARD.html` is de visuele en gameplay-referentie. Dit bestand is de korte, canonieke implementatiegids voor UI- en stylingwerk.

## Kernidentiteit

- **Pluto Original** voor 2–4 spelers.
- Digitaal tafelspel: **curling/carrom × rock-paper-scissors**.
- Geen RPG-brawler en geen action-combat game.
- De skill komt uit **mikken, kracht en rebounds**; de tactiek uit **elementkeuze, positionering en counters**.
- De game moet even snel te begrijpen en te spelen zijn als Pluto Minigolf, Dominoes of Ludo.

## Canonieke v1-gameplay

- Per speler per end: exact 4 stenen: **Fire, Water, Earth, Air**.
- Beurt: kies ongebruikte steen → drag om richting/kracht te zetten → release.
- 2 ends per match.
- Cirkelvormige arena met 4 scorezones: **Outer 1 / Middle 2 / Inner 3 / Nexus 5**.
- Counter-ring: **Water > Fire > Earth > Air > Water**.
- Bij een winnende elementbotsing verdwijnt de zwakke steen; de sterke steen gaat verder met gereduceerd momentum.
- Neutrale of gelijke elementen botsen met gewone circle-to-circle physics; beide stenen blijven bestaan.
- Buiten de arena = steen verdwijnt en scoort 0.
- Hoogste totaalscore na 2 ends wint.
- Geen arena-obstakels in v1.
- Geen vroege eliminatie.

## Layout

- **Mobile-first en fixed fullscreen** binnen de gedeelde Pluto game shell.
- De arena is de hoofdinterface en moet volledig zichtbaar blijven zonder verticale scroll, zoom of pan.
- Houd de structuur extreem beperkt:
  1. geïntegreerde Pluto game header;
  2. compacte turn/status-indicatie;
  3. kleine publieke player-score + resterende-elementen info;
  4. volledige arena;
  5. onderaan de vier elementstenen + minimale aim/power feedback.
- Geen aparte panels voor abilities, inventory, stats of uitleg tijdens gameplay.
- Gebruik dezelfde drag-back → aim → release-interactie als referentierichting voor het gevoel van Minigolf, zonder de Minigolf-code visueel te kopiëren.

## Arena

- Grote ronde stenen arena, centraal in beeld.
- Vier duidelijke concentrische scorezones.
- Nexus in het midden is klein en waardevol.
- Materiaal: verweerde natuursteen, warme zand-/aardetonen, subtiele gegraveerde patronen.
- Omgeving mag tempelarchitectuur, bergen, water, hout en rustige natuur suggereren, maar mag de leesbaarheid van het speelvlak nooit verminderen.
- Geen drukke obstakels of decoratie bovenop het speelvlak.

## Elementstenen

- Voelen als fysieke, tactiele game pieces: chunky ronde stenen/discs met gegraveerde rand en geschilderde elementkern.
- Duidelijk onderscheid op kleur én origineel symbool; vertrouw niet alleen op kleur.
- Productie-UI gebruikt **geen emoji** voor elementen.
- Fire: `#D95736`, highlight `#F39A45`.
- Water: `#3F82B8`, highlight `#86C9D8`.
- Earth: `#647A46`, secondary `#A18A5B`.
- Air: `#91B7C0`, highlight `#D8E4E1`.
- Nexus accent: `#E8B84A`.

## Art direction

- Originele **hand-painted elemental martial fantasy**.
- Sfeer: expressieve penseellijnen, rustige natuur, verweerde tempelmaterialen, subtiele Oost-Aziatisch geïnspireerde architectuur en kalligrafische accenten.
- Gebruik warme paper/stone/wood neutrals rondom de sterke elementkleuren.
- Achtergrond/paper: `#F3E9D1`.
- Temple wood: `#4C3728`.
- Dark ink: `#263229`.
- Geen neon sci-fi look.
- Geen bestaande franchise-personages, natie-symbolen, kostuums of exacte iconografie kopiëren.

## Aim & physics feedback

- Drag achteruit vanaf de actieve steen om te mikken.
- Toon tijdens aim een duidelijke trajectory/ghost line en compacte power-indicatie.
- Release vuurt onmiddellijk.
- Physics moeten voorspelbaar en visueel uitlegbaar zijn.
- Element-VFX zijn kort en functioneel: fire sparks, water splash, earth dust, air brush-stroke.
- VFX mogen nooit steenposities, trajectory of collision-resultaat verbergen.
- Vermijd overmatige particles, camera shake en lange animaties.

## Player/status UI

- Actieve speler duidelijk markeren.
- Toon score compact.
- Toon publiek welke elementen iedere speler nog niet gebruikt heeft.
- Gebruikte eigen stenen worden gedimd/disabled.
- Elementkeuze moet één tap zijn; geen submenu.
- Rematch en next-end transitions moeten snel zijn.

## Niet doen

- Geen heroes/classes.
- Geen health, mana, spells, cooldowns of ultimates.
- Geen random element-draw in de basisregels.
- Geen permanente upgrades of gameplay progression.
- Geen grote tekstblokken tijdens de match.
- Geen camera-management.
- Geen over-engineered physics of complexe special cases die de basisregel minder voorspelbaar maken.

## Prioriteit

1. Correcte en consistente physics.
2. Aim input die op touch goed voelt.
3. Glasheldere element-counter feedback.
4. Volledige arena leesbaar op één mobiel scherm.
5. Pas daarna polish, particles en extra decoratie.
