# CycClub

`MOODBOARD.html` is de visuele referentie. Dit bestand is de canonieke, compacte implementatiegids voor Codex bij UI-wijzigingen in CycClub.

## Kernregel

- Dit is een **volledige UI-redesign, geen wijziging van de gamelogica**.
- Behoud alle bestaande mechanics, acties, data, fases, berekeningen en servergedrag.
- De layout mag fundamenteel veranderen wanneer dat clicks, scroll of cognitieve belasting vermindert.
- Ontwerp mobile-first rond de echte spelcyclus: **ploeg beheren → koers kiezen → max. 3 renners opstellen → 8 segmenten racen → resultaat**.
- Gebruik `MOODBOARD.html` voor extra visuele context; deze `STYLE.md` blijft leidend voor implementatiebeslissingen.

## Informatiearchitectuur

### Clubfase

Gebruik vijf vaste primaire bestemmingen in een bottom navigation:

1. **Ploeg**
2. **Koersen**
3. **Markt**
4. **Upgrades**
5. **Erelijst**

- `Ploeg` is het standaardlandingsscherm. Voeg geen extra dashboard/HQ-tussenlaag toe.
- Budget blijft zichtbaar in de vaste header van de managerfase.
- Bottom navigation blijft stabiel en op dezelfde plaats.
- Managerpagina's mogen alleen binnen hun contentzone verticaal scrollen.
- Nooit horizontaal scrollen.

### Ploeg

- Toon renners als compacte verticale cards/rows, niet als brede tabellen.
- Per renner direct zichtbaar: naam, team, leeftijd/specialisme, status, zes stats en vermoeidheid.
- `Rust` is direct zichtbaar wanneer relevant.
- Detailinformatie mag via een secundaire detailactie/opening.
- Verkoop is destructief en minder frequent: plaats die achter een overflow/detailactie in plaats van als dominante knop.
- Geblesseerde/zieke renners blijven zichtbaar met duidelijke status en resterende uitvaltijd.

### Koersen

- Er is geen kalenderjaar; behandel het scherm als een **catalogus van permanent beschikbare koersen**.
- Gebruik een dropdown/select voor koerscategorie en eventueel sortering. Gebruik hiervoor geen rij van veel kleine tabs.
- Toon elke koers als compacte card met naam, moeilijkheid, belangrijkste terreinmix en prijzengeld/context.
- Host krijgt een duidelijke `Start koers` CTA direct op de race-card.
- Niet-hosts zien dezelfde informatie maar geen misleidende actieve startactie.

### Scoutingmarkt

- Gebruik cards/rows, nooit een brede mobiele tabel.
- Toon alle zes stats compact op de rennercard.
- Budget en kostprijs moeten in één blik vergelijkbaar zijn.
- Filters openen vanuit één compacte filter-control/sheet; actieve filters mogen als chips zichtbaar blijven.
- Gebruik directe filters voor statistiek/minimum en max. kostprijs; laat ruimte om later specialisme/team toe te voegen zonder de layout te breken.
- `Ververs` blijft direct bereikbaar maar is secundair aan kopen/filteren.
- `Koop` is de duidelijke primaire actie op een kandidaat.

### Upgrades

- Toon de vier upgradecategorieën compact als één overzicht, bij voorkeur 2×2 op mobiel wanneer dit leesbaar blijft.
- Per categorie zichtbaar: naam, huidig niveau 1-5, huidige bonus/effect, volgende kost en upgrade-actie.
- Maximum niveau is duidelijk maar niet dominant.
- Onbetaalbare upgrade is disabled, maar prijs en effect blijven leesbaar.

## Opstellingsfase

- Ontwerp als aparte, gefocuste fase, niet als manager-tab.
- Bovenaan: koersnaam + compacte koerscontext met de belangrijkste terreinpercentages.
- Renners staan in één selecteerbare lijst; geen detailpagina nodig om een basiskeuze te maken.
- Toon naast elke renner vooral de stats die voor de gekozen koers relevant zijn plus status/vermoeidheid.
- Maximaal drie geselecteerde renners duidelijk markeren.
- Niet-beschikbare renners blijven zichtbaar maar disabled.
- `Klaar` staat in een **fixed bottom bar** met teller `x / 3` en korte samenvatting van de selectie.
- Alleen de rennerslijst mag verticaal scrollen.

## Live koers

Dit is het belangrijkste scherm en heeft de strengste layoutregels.

- De live koers is **fixed full screen: 100vw × 100dvh**.
- **Geen verticale page scroll en nooit horizontale scroll.**
- Alles wat nodig is om een segment te spelen moet tegelijk zichtbaar zijn:
  - koersnaam en huidig segment;
  - leider / relevante koerssituatie;
  - volledig koersprofiel;
  - alle 8 segmenten met huidig segment duidelijk gemarkeerd;
  - alle maximaal 3 eigen renners;
  - groep + exacte achterstand per renner;
  - vermoeidheid per renner;
  - resterende gels;
  - tactiekkeuze;
  - knop om het segment te werpen.

### Koersprofiel

- Gebruik een **duidelijk hoekig/gesegmenteerd profiel**, geen vloeiende decoratieve curve.
- Het profiel moet de 8 echte segmenten leesbaar ondersteunen.
- Markeer het actieve segment en de huidige positie duidelijk.
- Terreinsegmenten mogen subtiel semantisch getint zijn, maar het profiel blijft de visuele hoofdlaag.
- Toon relevante sprint/berg/monumentmarkeringen alleen wanneer ze echte game-informatie representeren.

### Tactieken

De kernactie is frequent, dus optimaliseer op één tap.

- Toon voor elke renner de vijf tactieken als **directe knoppen**:
  - Herstel
  - Volg
  - Kop
  - Val aan
  - Bidons
- Gebruik hier **geen dropdowns**: dat zou elke segmentbeurt extra taps geven.
- Geselecteerde tactiek is onmiddellijk en sterk herkenbaar.
- `Val aan` krijgt een duidelijk warm/rood risico-accent.
- Disabled tactieken, bijvoorbeeld door Hongerklop, blijven zichtbaar met duidelijk disabled state.
- Gel staat direct bij de betreffende renner en toont het resterende aantal.
- Alle drie rennerblokken moeten tegelijk zichtbaar blijven; geen carousel of swipe nodig om tussen renners te wisselen.

### Segment werpen

- `Werp segment` is de primaire CTA onderaan.
- Houd deze fixed binnen het koersscherm.
- Maak duidelijk wanneer nog een tactiek ontbreekt en disable de worp dan.
- Toon een compacte samenvatting van gekozen tactieken vlak bij de CTA indien ruimte dit toelaat.

## Resultaten en Grote Rondes

- Resultaatscherm mag intern verticaal scrollen.
- Toon eerst wat de speler direct wil weten: beste resultaat, prijzengeld en relevante carrière-impact.
- Podium mag prominent zijn.
- Gebruik een dropdown/select voor Grote-Rondeklassementen: Algemeen, Punten, Bergen, Jongeren, Ploegen.
- Toon ranking als compacte rows, geen brede tabel.
- Hostactie `Volgende rit` of terugkeer naar club staat duidelijk onderaan.

## Wanneer buttons, dropdowns en tabs gebruiken

- **Directe buttons**: veelgebruikte, tijdkritische of herhaalde acties zoals tactieken, kopen, rusten, upgraden, starten en werpen.
- **Dropdown/select**: één keuze uit een langere lijst die niet voortdurend verandert, zoals koerscategorie, sortering of klassement.
- **Tabs/segmented controls**: alleen voor 2-3 gelijkwaardige views die frequent gewisseld worden. Vermijd vier of meer kleine tabs op mobiel wanneer bottom navigation of select beter is.
- **Overflow menu**: zeldzame/destructieve acties zoals verkoop of secundaire details.

## Visual direction

- Sfeer: moderne premium cycling-manager game, rustig en functioneel, niet een webformulier.
- Manager/content surfaces zijn licht en warm; vaste headers zijn donker groen.
- Light theme moet daadwerkelijk licht blijven: geen grote donkere kader rond elke card.
- Gebruik beperkte diepte, subtiele borders en consistente afgeronde hoeken.
- Data-dichtheid mag hoog zijn zolang scanbaarheid goed blijft.

## Palette

- Canvas dark: `#09110E`
- Header dark: `#0F241B`
- Header mid: `#17382A`
- App surface: `#F4F1E8`
- Card surface: `#FBFAF6`
- Soft green: `#E9EEE7`
- Border: `#D7DDD5`
- Ink: `#141A17`
- Muted: `#68736C`
- Primary green: `#1D7A50`
- Bright green: `#29A36A`
- Prestige/yellow: `#E3BD4F`
- Attack/risk: `#CF604B`
- Info/gel: `#5A8EA8`
- Mountain/accent: `#7E5DB0`

## Typography

- Gebruik `Inter` / systeem-sans voor de volledige functionele UI.
- Titels: 700-900, compact en duidelijk.
- Stats/cijfers: zwaar genoeg om snel te scannen.
- Kleine labels mogen uppercase met extra letterspacing, maar blijven leesbaar.
- Geen decoratief wielerfont voor functionele tekst.

## Icons

- Gebruik consistente SVG/line-icons voor navigatie en functionele controls.
- Gebruik geen emoji's als primaire productie-iconen.
- Iconen ondersteunen labels; belangrijke gameacties mogen niet alleen door een icoon begrijpelijk zijn.

## Spacing en componenten

- Baseline mockup: ongeveer 390×844 mobiel.
- Gebruik compacte 8-14px gaps binnen data-heavy gamezones.
- Cards: circa 16-20px radius; grotere shell/panelzones circa 22-24px.
- Touch targets voor primaire acties minimaal circa 40-44px hoog waar ruimte dit toelaat.
- Gebruik `minmax(0,1fr)` en `min-width:0` om overflow te voorkomen.

## Responsive contract

- Altijd `width:100%` / viewportbreedte; geen horizontale paginascroll.
- Tablet/desktop krijgt meer lucht en eventueel bredere cards, maar geen compleet andere informatiearchitectuur.
- Managerfase: vaste header + vaste bottom nav; alleen middencontent scrollt.
- Opstelling: vaste context + scrollbare rennerslijst + fixed Klaar-bar.
- Live koers: volledig fixed, zonder scroll.

## Don't

- Geen extra HQ/dashboard toevoegen tussen de speler en de vier hoofdacties.
- Geen brede HTML-tabellen op mobiel.
- Geen horizontale scroll of swipe-carousels voor noodzakelijke informatie.
- Geen dropdown voor tactieken.
- Geen aparte detailpagina vereisen om een renner voor een koers te selecteren.
- Geen grote donkere container rond elk individueel element in light theme.
- Geen vloeiend/decoratief koersprofiel dat de acht segmenten verbergt.
- Geen bestaande game-informatie of acties verwijderen om het scherm mooier te maken.
- Geen nieuwe mechanics suggereren via UI-elementen die de server niet ondersteunt.
