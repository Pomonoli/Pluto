# Gravity

`MOODBOARD.html` is de visuele referentie. Dit bestand is de korte, canonieke implementatiegids voor UI- en stylingwerk aan Gravity.

## Kernidentiteit

- Pluto Original logicapuzzel met een lichte ruimte-/planeetstijl.
- Speels, clean, rustig en direct leesbaar. Niet donker, druk of sci-fi zwaar.
- De puzzel zelf blijft altijd het dominante element.

## Spelbord

- Mobile-first vierkant raster met royale touch targets.
- Planeten zijn kleurrijk, rond en duidelijk herkenbaar; het cijfer staat als compacte badge op de planeet.
- Asteroïden zijn neutraal grijs en visueel ondergeschikt aan planeten.
- Obstakels zijn donkere, eenvoudige blokken zonder decoratieve ruis.
- De speler tekent zelf de volledige paden. Pluto tekent of kiest geen route voor de speler.
- Paden zijn dik, afgerond en krijgen de kleur van hun doelplaneet.
- Elk pad beweegt alleen orthogonaal en elke stap moet de Manhattan-afstand tot de gekozen doelplaneet exact met één verkleinen. Geen omwegen of teruggaande segmenten.
- Paden kruisen of delen geen routevak. Meerdere paden mogen alleen samenkomen op hun gezamenlijke doelplaneet.
- Ongeldige kruisingen/conflicten subtiel rood markeren, zonder modals of storende foutmeldingen.

## Interactie

- Drag/swipe is de primaire input voor tekenen.
- Terugslepen over het vorige vak wist de laatste stap van de actieve lijn.
- Undo en reset zijn altijd snel bereikbaar.
- Een hint markeert alleen één asteroïde en zijn doelplaneet; hij tekent nooit een route.
- Correcties moeten onmiddellijk en zonder bevestigingsdialogen kunnen.
- Overgangen kort en rustig; geen overmatige animaties.

## Visuele taal

- Achtergrond: zeer licht grijs/blauw (`#F6F8FB`).
- Hoofdtekst: diep navy (`#11284D`).
- Primaire accentkleur: Pluto Blue (`#3B82F6`).
- Secundaire accenten: mint `#2EC4B6`, geel `#F6C453`, coral `#FF6B6B`, paars `#8B5CF6`.
- Witte kaarten, afgeronde hoeken, subtiele borders en zachte schaduw.
- Gebruik een ronde, moderne system sans; zware titels, rustige bodycopy.

## Layout

- Op mobiel: bord centraal en zo groot mogelijk; controls compact eronder.
- Op desktop/tablet: bord blijft compact en wordt niet uitgerekt over de volledige breedte.
- Vermijd permanente uitleg tijdens het spelen. Regels horen in onboarding/help, niet rond het bord.
