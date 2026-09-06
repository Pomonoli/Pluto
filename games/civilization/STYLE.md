# Age of Civilization

`MOODBOARD.html` is de visuele referentie. Dit bestand is de korte, canonieke implementatiegids voor UI-wijzigingen.

## Kernregel

- Dit is een **reskin, geen redesign van de gamelogica**.
- Behoud de bestaande informatie-architectuur, secties, acties, kaarttypes en spelgedrag.
- Voeg geen nieuwe gameplayzones of UI-blokken toe om de stijl te realiseren.
- De primaire mobiele gamescreen moet als **fixed full screen** ontworpen worden: alle hoofdsecties passen tegelijk binnen één schermhoogte, zonder verticale paginascroll.

## Layout

Behoud op de primaire gamescreen deze volgorde:

1. header met terugknop, titel en overflow-menu;
2. Age of Civilization-logo + tijdperk/mode/beurt/status;
3. horizontale spelersrij;
4. tijdperk- en beurtregel + tijdperktitel;
5. statbalk met **goud, attack, defence, inkomen en toren**;
6. `Vaste gebouwen`;
7. `Jouw stad`;
8. `Kies één kaart`.

- Spelerskaarten blijven compact en horizontaal; lange namen afkappen in plaats van kaarten groter te maken.
- `Jouw stad` behoudt de bestaande grid en lege slots. Op mobiel waar zes slots zichtbaar zijn: 2 rijen van 3.
- Gebruik extra ruimte op tablet/desktop voor betere spacing en leesbaarheid, niet voor gigantische knoppen of uitgerekte kaarten.

## Visual direction

- Sfeer: **alchemist workshop / middeleeuws atelier**, maar als moderne mobiele game-UI.
- Gebruik donker walnoothout als shell/framing en warme lichte perkamentvlakken voor echte content.
- Messing en amber zijn accenten, geen dominante achtergrondkleur.
- Licht theme blijft duidelijk licht: vermijd grote donkere kaders rond alle content.
- Decoratie mag tactiel en rijk ogen, maar mag informatie nooit verdringen.

## Palette

- Walnut Dark: `#2B1B13`
- Walnut Mid: `#3C2618`
- Parchment: `#F3DFB3`
- Parchment Mid: `#E9D09A`
- Gold Accent: `#D9A541`
- Amber CTA: `#CB7C24`
- Ink: `#2B2018`
- Health: `#6D8F58`
- Attack: `#C16F3E`
- Defence: `#72C6CF`
- Income: `#CDA249`
- Off White: `#FFF6E4`

## Typography

- `Cinzel` 700-800 voor schermtitels, sectietitels en logo-achtige headings.
- `Inter` 600-800 voor functionele UI-tekst, labels, cijfers en kaartinhoud.
- Gebruik geen decoratief fantasy-font voor kleine tekst of stats.

## Cards and panels

- Contentpanelen: warm perkament, duidelijke donkere tekst, subtiele messing/bruinachtige rand en beperkte diepte/schaduw.
- Kaarten blijven compact en scannable. Toon bestaande statinformatie rechtstreeks op de kaart.
- Behoud semantische statuskleuren: attack warm oranje, defence cyaan, income goud, health groen.
- Disabled/onbetaalbare kaarten mogen visueel gedimd zijn, maar info moet leesbaar blijven en inspecteerbaar blijven wanneer de game dat toelaat.
- Bestaande event-/active-/selected-states blijven functioneel onderscheidbaar.

## Icons

- Gebruik **geen emoji's als hoofdiconen op kaarten of gebouwen**.
- Gebruik één coherent iconensysteem: eenvoudige gegraveerde/etched glyphs in een compacte perkament/messing badge.
- Iconen moeten dezelfde functie en betekenis houden als de bestaande kaartinhoud; geen nieuwe mechanics impliceren.
- Vermijd fotorealisme en inconsistente clipart.

## Controls

- Primary CTA: amber/goud, duidelijk maar compact.
- Secondary actions: licht perkament met donkere tekst.
- Destructieve acties blijven rood.
- Disabled acties blijven herkenbaar maar niet dominant.
- Knoppen mogen tactiel aanvoelen via rand + subtiele harde onderschaduw, zonder overdreven skeuomorfisme.

## Combat and popups

- Combat-resultaten wachten op expliciete spelerinput waar dat functioneel voorzien is.
- Damage calculation wordt als duidelijke popup/tabel getoond met attack, defence, doelwit en damage.
- Toon geen inkomen in de damage-calculation popup.
- Hero/player popup toont Hero, hero power en tower-health; geen overbodige stats toevoegen.

## Don't

- Geen nieuwe arena, battlefield, torenveld of andere gameplayzone toevoegen.
- Geen secties herschikken enkel voor visuele redenen.
- Geen verticale scroll vereisen voor de primaire mobiele gamescreen.
- Geen donkere container rond elk individueel element in light theme.
- Geen emoji-stickers op kaarten.
- Geen bestaande stats verbergen die nodig zijn om keuzes te maken.
- Geen generic fantasy-content gebruiken ter vervanging van echte Age of Civilization-data.
