# Lutro — visuele stijl

- Bovenaanzicht: een vierkant Ludo-bord van 15 × 15 interactieve vakken boven een geschilderde Midden-aarde-kaart. Geen isometrie of perspectiefkanteling.
- Vaste facties: rood/Sauron linksboven (vuur, basalt, zwarte vesting), groen/Elven rechtsboven (zilverbomen, smaragdlicht), geel/Dwergen rechtsonder (bergen, poorten, goud vuur) en blauw/Mensen linksonder (witte vestingstad, blauw-zilver).
- Gebruik `assets/four-realms-board.png` als decoratieve onderlaag. Houd de 52 routevakken, veilige startvakken en zes thuisvakken per factie als contrastrijke DOM-lagen erboven; artwork mag de spelstaat nooit verbergen.
- Routevakjes zijn halftransparant perkament met subtiele runen. Factiestartvakken dragen een eenvoudig herkenningsteken; het centrale gouden ringmotief blijft zichtbaar.
- Pionnen zijn donkere, metalen factiemedaillons met een factieteken en afzonderlijk nummerplaatje. Selecteerbare pionnen krijgen een duidelijke lichte ring en rustige pulse.
- Spelerskaart en dobbelpaneel gebruiken perkament, donker gesmeed metaal en warm oranje vuurlicht. Behoud minimaal 44px voor primaire mobiele acties.
- Spelerskaarten tonen kasteel-HP en coins zonder het bord te verdringen. Iedere actieve troep toont een kleine HP-balk; type en factie blijven herkenbaar via teken, rand en medaillon.
- De actietray bevat de worp, vier compacte koopkaarten en alleen wanneer relevant kasteelaanvallen. Toon stats steeds in de vaste volgorde damage/HP/bewegingsbonus.
- Maak na de worp duidelijk dat alleen de gekozen oplichtende troep beweegt en dat zijn eigen bewegingsbonus bovenop de worp komt.
- Markeer de acht vaste kasteelaanvalsvakken met een helderrode vierkante omlijning; twee vakken per kasteel, op de dwarsroute direct naast het rijk.
- Toon in de lobby vier grote thematische heldenkaarten. De gekozen kaart krijgt een gouden/factiekleurige focusring en bepaalt de startfactie van de eerste speler; de overige spelers volgen met de resterende rijken.
- Gebruik de transparante `units-*.png`-atlassen voor alle pionnen en koopkaarten. De 2×2-posities zijn steeds normaal linksboven, snel rechtsboven, sterk linksonder en held rechtsonder; behoud de factiekleurige medaillonrand en HP-balk voor spelduidelijkheid.
