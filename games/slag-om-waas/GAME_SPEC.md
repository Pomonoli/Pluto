# TOTAL WAAS
## Game Design & Board Specification

> De game heette tot v1.34 "De Slag om Waas"; de pluginmap blijft `games/slag-om-waas` zodat bestaande rooms en statistieken blijven werken.
Version: 0.2 · Status: MVP foundation

> **Pluto-implementatie.** De oorspronkelijke briefing gaat uit van React/TypeScript. Pluto heeft geen buildstap of frontendframework, dus de mapping is:
>
> | Briefing | Pluto |
> | --- | --- |
> | `src/types`, `src/data/board.ts` | `board.js` (facties, sectoren, verbindingen, wegen) |
> | `src/config` | `config.js` (alle cijfers op één plek) |
> | `src/engine` (rules engine) | `server.js` (server-authoritatief, CommonJS) |
> | `src/components` (React board) | `client.js` (ESM-renderer, SVG-bord) + `styles.css` |
> | `assets/maps/waas-board-reference.png` | `assets/waas-board-reference.png` — export van het huidige bord (de originele conceptkaart blijft de art direction, zie `STYLE.md`) |
>
> Geometrie (Voronoi-cellen uit seed-punten) zit in `geometry.js`. De spelregels gebruiken uitsluitend sector-id's en de expliciete `CONNECTIONS`; `test/slag-om-waas.test.js` bewaakt dat elke verbinding ook een echte gedeelde grens is. De client krijgt het statische bord via `serialize()` en kent zelf geen regels.
>
> **Status:** Fase 1 (bord, provincies, selectie, adjacency, eigenaarschap, beurtstructuur) is gebouwd. Fase 2–7 volgen.
>
> **Bordindeling (v2):** vijf regio's — vier facties plus de neutrale Sint-Niklaas-regio — verdeeld in 45 provincies (Noord 9, Oost 13, Zuid 10, West 9, Sint-Niklaas 4: de stad plus de buitenwijken Sinaaiwoud, Nieuwkerkhove en Belselveld). De ligging volgt het echte Waasland bij benadering; de namen zijn fictief maar herkenbaar (Stekenburg, Beverhof, Temsehaven, Lokerzand, Kielpolder, Rupelburcht …). Elke factie heeft een totaal inkomen van 12–14; Oost heeft méér provincies (dun verdedigd) met twee waardeloze polders, Noord minder maar betere verdediging.
>
> **Richting: Rome: Total War, niet Risk.** Het spel leunt op een campagnekaart met provincies en nederzettingen, legers als stacks van eenheden, garnizoenen, gebouwen per nederzetting, rebellen in onbeheerde provincies en publieke orde (Draagvlak). Concreet voor de volgende fases:
> - **Rebellen (Fase 1, al aanwezig):** elke neutrale provincie — de Sint-Niklaas-buitenwijken en de provincies van niet-gekozen facties — start met een rebellengarnizoen (`CONFIG.rebelGarrison`); de stad Sint-Niklaas met `CONFIG.neutralGarrison`.
> - **Legers (Fase 2):** troepen zijn stacks van eenheidstypes in een provincie; beweging kost bewegingspunten per verbinding (hoofdweg goedkoper, moeras/bos/sneeuw duurder voor niet-thuisfacties). Een gevecht vergelijkt totale gevechtskracht met terrein-, fort- en draagvlakmodifiers en een beperkte willekeur (geen Risk-dobbelsteen per troep); de verliezer trekt zich terug of wordt vernietigd, de winnaar lijdt verliezen naar verhouding.
> - **Nederzettingen (Fase 3):** `buildSlots` zijn de bouwrijen van de nederzetting; kazernes bepalen welke eenheden gerekruteerd kunnen worden; economische gebouwen en handelsroutes (wegen, Schelde) bepalen het inkomen.
> - **Publieke orde (Fase 4):** Draagvlak per factie zoals in §15, maar bezette provincies met vreemde cultuur drukken de orde; opstanden spawnen rebellen.
> Dit vervangt de Risk-mechanieken in §11–12 waar ze botsen; de rest van dit document blijft gelden.

---

# 1. PROJECTDOEL

Bouw een digitale strategische bordgame genaamd **De Slag om Waas**.

Inspiratie:
- Risk: territoriumcontrole en eenvoudige dobbelgevechten
- Total War: economie, gebouwen, terrein, beweging en facties
- Bordspel-first: duidelijk, eenvoudig, snel begrijpbaar

Het spel speelt zich af op een fictief-strategische versie van het Waasland.

Belangrijk ontwerpprincipe: **Keep it simple.** De speler moet op het bord zoveel mogelijk visueel kunnen begrijpen zonder voortdurend regels te moeten raadplegen.

# 2. SPELERS

- 4 speelbare facties
- 1 neutrale centrale factie
- MVP: 2–4 menselijke spelers; niet-gekozen facties blijven neutraal/inactief; AI-spelers later mogelijk.

# 3. HET SPELBORD

```
                    NOORD — FACTIE 3
              Stekene / Sint-Gillis-Waas  ❄ BOS/SNEEUW

 WEST — FACTIE 2                          OOST — FACTIE 4
 Lokeren/Moerbeke      SINT-NIKLAAS       Beveren/Kruibeke/Zwijndrecht
 ☀ DROOG                 FACTIE 0 🏰       🌾 GRAS/LANDBOUW

                    ZUID — FACTIE 1
                 Temse / Waasmunster  🌊 WATER
```

CRUCIAAL: alle vier speelbare facties grenzen rechtstreeks aan Sint-Niklaas. Sint-Niklaas ligt exact centraal en is de strategische hoofdprijs.

# 4. FACTIES

| Factie | Gebied | Thema | Kleur | Identiteit | Hoofdkern |
| --- | --- | --- | --- | --- | --- |
| 1 — Zuid | Temse, Waasmunster | water, rivieren, moeras, bruggen, havens | blauw/cyaan | sterk in watergebied, verdediging aan bruggen, flexibel door nat terrein | Temse |
| 2 — West | Lokeren, Moerbeke | droog, zand, open vlakten, ruïnes/outposts | oranje/geel | hoge mobiliteit, goedkope militaire infrastructuur, sterk in open terrein | Lokeren |
| 3 — Noord | Stekene, Sint-Gillis-Waas | bos, sneeuw, winter, bevroren water | donkerblauw | sterke verdediging, hinderlagen, vijand beweegt moeilijker | Stekene |
| 4 — Oost | Beveren-Waas, Kruibeke, Zwijndrecht | grasland, landbouw, industrie, polders, haven | groen | sterke economie, productie en sectorontwikkeling | Beveren-Waas |

De **Moervaart** vormt een waterlijn tussen Moerbeke/Lokeren (West) en Stekene (Noord).

# 5. FACTIE 0 — SINT-NIKLAAS

Geen speelbare startfactie. Ligt centraal, grenst aan alle vier facties, begint neutraal met een neutraal garnizoen en voert geen spelerbeurten uit. Visueel: grootstad op heuvel, stadsmuren, kathedraal, meerdere poorten, hoofdwegen naar alle windrichtingen. Functie: militair knooppunt, economisch centrum, mobiliteitscentrum, strategische overwinningslocatie. Controle geeft sterke voordelen maar betekent NIET automatisch overwinning.

# 6. SECTOREN

Een sector is de kleinste territoriale eenheid: kan gecontroleerd worden, troepen bevatten, aangevallen worden, gebouwen bevatten en verbonden zijn met andere sectoren. Elke factie heeft ongeveer een vergelijkbare totale spelwaarde (niet noodzakelijk hetzelfde aantal sectoren); balans via aantal sectoren, inkomsten, terrein, verbindingen, bouwplaatsen en factiebonus.

# 7. DATASTRUCTUUR VAN HET BORD

Data-driven, geen hardcoded gameplay in UI-componenten.

```ts
type FactionId = "south" | "west" | "north" | "east" | "center";
type TerrainType = "water" | "marsh" | "desert" | "plains" | "forest" | "snow" | "farmland" | "urban";
type Sector = {
  id: string; name: string; factionHome: FactionId; controller: FactionId | null;
  terrain: TerrainType; connections: string[]; roadConnections?: string[]; waterConnections?: string[];
  buildSlots: number; economicValue: number; isCapital?: boolean; isStrategic?: boolean;
};
```

Pluto: `board.js` — `SECTOR_ROWS` + `CONNECTIONS` (per paar een lijst soorten: `land`, `road`, `bridge`, `water`).

# 8. VERBINDINGEN

Sectoren mogen enkel aangevallen worden wanneer ze verbonden zijn.
- **Normale verbinding**: standaard landverbinding.
- **Hoofdweg** (N70, E17, E34, …): snellere beweging, belangrijk voor mobiele eenheden.
- **Waterverbinding**: voor waterfactie, speciale units, bepaalde infrastructuur.
- **Brug**: strategisch chokepoint; verdedigers kunnen voordeel krijgen.

# 9. DE MOERVAART

Zichtbaar en functioneel: natuurlijke grens, alternatieve route, strategisch knelpunt, extra water in het noordwesten. Oversteken kan enkel via brug, specifieke overgang of latere gespecialiseerde unit.

# 10. DRIE HOOFDPIJLERS

1. Militair · 2. Economie · 3. Draagvlak — beïnvloeden elkaar.

# 11. MILITAIR

- **Militie**: goedkoop, gevechtswaarde 1, normale beweging, ideaal voor bezetting.
- **Gepantserde colonne**: duurder, gevechtswaarde 2, sneller via hoofdwegen.
- **Fortificatie**: gebouw (geen unit) dat verdediging verhoogt.

# 12. GEVECHTEN

Risk-achtige dobbelmechaniek, eenvoudig. Aanvaller kiest aangrenzende vijandelijke sector, selecteert troepen, rolt; verdediger rolt; hoogste worpen vergeleken. Modifiers uit terrein, fortificatie, factiebonus en Draagvlak. Geen complexe combat trees.

# 13. ECONOMIE

Schatkist (numeriek). Inkomsten uit gecontroleerde sectoren, strategische sectoren, economische gebouwen, steden en factie-eigenschappen; toegekend aan het begin van de beurt.

# 14. GEBOUWEN

Sectoren hebben `buildSlots`. Vijf types: economisch (+inkomsten), kazerne (rekrutering), fort (defensiebonus), burgerlijk (draagvlakbonus), infrastructuur (mobiliteit). Kosten configureerbaar in `config.js`:

```js
buildings: {
  economy: { cost: 3, incomeBonus: 1 }, barracks: { cost: 4 }, fort: { cost: 4, defenseBonus: 1 },
  civic: { cost: 3, supportBonus: 1 }, infrastructure: { cost: 3 }
}
```

# 15. DRAAGVLAK

`support: 0–10`, start 6.
- 8–10 Enthousiast: kleine positieve bonus (lagere rekruteringskost, kleine combat bonus, extra inkomen).
- 4–7 Stabiel: geen modifier.
- 1–3 Onrust: duurdere troepen, verminderde inkomsten.
- 0 Opstand: één eigen sector komt tijdelijk in opstand (neutraal of rebellen).

# 16. DRAAGVLAKWIJZIGINGEN

Daalt door verloren veldslag, zware verliezen, verlies van thuissector/hoofdstad, langdurige bezetting, negatieve eventkaart. Stijgt door overwinning, herovering, burgerlijk gebouw, investering, succesvol opgeloste externe dreiging.

# 17. TERREINBONUSSEN

- Water/marsh: Zuid minder bewegingsstraf; anderen beperkte mobiliteit.
- Desert/plains: West mobiliteitsbonus.
- Forest/snow: Noord defensiebonus; vijand trager.
- Farmland/industrial: Oost economische bonus.

# 18. EXTERNE MACHTEN

- **Noord — Nederland** (Stekene/SGW): grenscontrole, smokkel, blokkade, interventie.
- **Oost — Antwerpen** (Beveren/Kruibeke/Zwijndrecht): havenconflict, economische sanctie, industriële crisis, interventie.
- **Zuid — Bornem/Klein-Brabant** (Temse/Waasmunster): Scheldebrug geblokkeerd, watercrisis, sabotage, overstroming.
- **West — Gent** (Lokeren/Moerbeke): transportstaking, handelsdruk, westelijke interventie, spoorproblemen.

# 19. EVENT DECK

Elke ronde één wereldgebeurtenis, data-driven (`{ id, title, description, targetFaction?, effects[] }`), eenvoudig uitbreidbaar.

# 20. BEURTSTRUCTUUR

1. Buitenwereld (event; MVP: 1 per ronde) · 2. Inkomsten · 3. Bestuur (draagvlak, opstanden, crises, bezetting) · 4. Bouw & rekrutering · 5. Militaire beweging (bewegen, aanvallen) · 6. Consolidatie (beperkte herpositionering) → victory check.

# 21. SINT-NIKLAAS VEROVEREN

`neutralGarrison = 6` (configureerbaar). Na verovering: controller verandert, economische bonus, hoofdwegen via Sint-Niklaas beschikbaar, anderen kunnen opnieuw aanvallen. Mag niet onmiddellijk onneembaar worden.

# 22. OVERWINNING

- **A. Militair**: controleer Sint-Niklaas, twee vijandelijke hoofdsteden en eigen hoofdstad tot het einde van een volledige ronde.
- **B. Economisch**: configureerbaar vermogen (voorlopig 50) plus belangrijke economische locaties; Sint-Niklaas is minstens één voorwaarde.
- **C. Maatschappelijk**: Draagvlak 10 gedurende 3 opeenvolgende rondes, eigen thuisgebied grotendeels onder controle, meerdere externe dreigingen opgelost. Later verfijnen.

# 23. UI

Professioneel, eenvoudig, bordspel, kaart centraal, geen mobiele-game-interface, geen overdaad aan menu's. Elementen: huidige speler; spelersinformatie (factie, schatkist, draagvlak, sectoren, legermacht); sector-contextpanel (naam, controller, terrein, troepen, gebouwen, verbindingen, inkomen) met enkel geldige acties (Move, Attack, Build, Recruit).

# 24. BOARD INTERACTION

Interactieve kaart: geen clickable bitmap; achtergrond mag visuele basis zijn met daarboven een interactieve laag (SVG-polygons per sector). Lagen: background → faction regions → sector polygons → connections → buildings → armies → selection/highlight → UI overlay. Sectoren hebben hover-, selected- en factiekleur-states en kunnen geldige doelwitten highlighten.

# 25. BOARD MODEL VERSUS ARTWORK

Artwork (hoe het eruitziet) ≠ Board Model (hoe het werkt). Spelregels zijn niet afhankelijk van pixelcoördinaten; elke sector heeft een unieke id (`south_temse_01`, `north_sgw_01`, `center_sint_niklaas`, …).

# 26. MVP IMPLEMENTATIEVOLGORDE

1. **Bord** — interactieve kaart, sectoren, selectie, adjacency, eigenaarschap ✅
2. **Troepen** — militia, armored, movement, combat
3. **Economie** — schatkist, inkomsten, gebouwen, rekrutering
4. **Draagvlak** — support meter
5. **Sint-Niklaas** — neutral faction behaviour
6. **Events** — buitenwereld/eventdeck
7. **Victory conditions** — alle drie de types

# 27. ONTWIKKELPRINCIPES

1. Gameplay data-driven. 2. Geen magic numbers: centrale config. 3. Rules engine gescheiden van UI. 4. Multiplayer mogelijk: state serialiseerbaar (Pluto-rooms). 5. Geen extra backend. 6. Geen regels bijmaken die niet in dit document staan — bij onduidelijkheid: configureerbaar maken, TODO, eenvoudigste oplossing. 7. Keep it simple.

# 28–30. EERSTE BUILD

Na Fase 1 moet je het volledige bord zien, sectoren kunnen aanklikken, factie per sector zien, buren zien, Sint-Niklaas centraal neutraal zien, de vier facties eromheen, en een fundament hebben voor beweging, gebouwen en combat. Het bord behoudt: centrale Sint-Niklaas, vier gekleurde biome-facties, sneeuw noord, zand west, water zuid, landbouw oost, Moervaart noordwest, wegen naar Sint-Niklaas, interne sectorverdeling, tabletop-uitstraling.
