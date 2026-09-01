# Changelog

## v1.12.1 — Compactere gameheader en versie-info

- De instellingenpopup toont subtiel de huidige Pluto-versie.
- De terugpijl en menupuntjes in de mobiele gameheader hebben geen zichtbare omlijning of achtergrond meer.
- De gamenaam staat verticaal gecentreerd in de mobiele bovenbanner.
- Spelersaantallen zoals `2-7` blijven op Home altijd op één regel staan.
- De headeracties behouden hun volledige touch-target en toegankelijke toetsenbordfocus.

## v1.12.0 — Isle of Skye, The Deep Bleu C en CycClub

- Isle of Skye is toegevoegd voor 2 tot 4 spelers, met tegelprijzen, afleggen, onderlinge aankopen, eilandbouw en NPC's.
- The Deep Bleu C is toegevoegd als solospel met een grote Europese kaart, routezoeking, vissen en verkoop bij De Vishandel.
- CycClub is toegevoegd voor 1 tot 6 spelers, met ploegopbouw, renners kopen en trainen, races, NPC's en prijzengeld.
- Ingelogde CycClub-spelers behouden hun ploeg tussen games; hun clubprestaties verschijnen op een eigen leaderboard.
- Alle drie games zijn als zelfstandige plugins geïntegreerd en vallen onder de bestaande lobby-, room- en hervatlogica.
- De Ragnarok-branch is mee samengevoegd als ontwerpdocument; een speelbare plugin volgt pas zodra client- en servercode beschikbaar zijn.

## v1.11.14 — Uitgebreid Age of Civilization

- Age of Civilization ondersteunt nu 2 tot 7 spelers in plaats van uitsluitend twee spelers.
- Voor het eerste tijdperk kiest iedere speler een unieke leider met een eigen permanente bonus.
- Aanvalsgolven verlopen kloksgewijs in een kring; uitgeschakelde spelers vallen af en de rest speelt door.
- Observatorium, Grote Tempel en Academie zijn vaste gebouwen met stapelbare gebeurtenissen bij mijlpalen.
- Vrije gebouwen, vaste gebouwen en gebeurtenisstappen hebben herwerkte upgradeprijzen en bonussen.
- Kaarten en gebouwen tonen hun actuele effecten direct en gebruiken duidelijkere categorie- en tijdperkkleuren.
- De Civilization-interface is lichter, leesbaarder en compact ingericht voor grotere spelersgroepen.
- Extra regressietests bewaken leiders, multiplayergevechten, eliminatie, upgrades en gebeurtenissen.

## v1.11.13 — Passende gamebreedtes voor browser en tablet

- Alle actieve games gebruiken vanaf 761px een gecentreerde gamecanvas van maximaal 1180px.
- Panelen, handen, kaarten en actierijen blijven binnen de beschikbare schermbreedte.
- Compacte spellen zoals Age of Civilization, Santorini, Stratego, Quoridor en Solitaire gebruiken kleinere spel-eigen maxima.
- Brede bordspellen behouden voldoende ruimte zonder over ultrabrede schermen uit te rekken.
- De mobiele layout tot en met 760px blijft volledig ongewijzigd.

## v1.11.12 — Consistente lobbyterminologie

- Alle zichtbare lobbyteksten gebruiken voortaan `game` en `games` in plaats van `room` en `rooms`.
- Het lobbyoverzicht, lege toestand, uitnodigingen, hervatbare games en join-knoppen zijn aangepast.
- Gamecodes, vertrekbevestigingen, navigatiemeldingen en serverfouten gebruiken dezelfde terminologie.
- Interne roomroutes en socket-events blijven ongewijzigd voor technische compatibiliteit.

## v1.11.11 — Carcassonne-burgers en uniforme lobbybanner

- De Carcassonne-lobby heeft onder de tegelkeuze een slider voor het aantal burgers per speler.
- De slider gebruikt standaard 7 burgers en kan door de host worden ingesteld van 1 tot 12.
- De gekozen hoeveelheid geldt voor menselijke spelers en NPC's en blijft behouden bij een rematch.
- Alle game-lobby's gebruiken nu dezelfde hoogte, branding en subtiele ruimteachtergrond als de Home-banner.
- Actieve games behouden hun bestaande compacte gameheader.

## v1.11.10 — Carcassonne spelduur en Home-banner

- De Carcassonne-host kan in de lobby kiezen uit 72 tegels (standaard), 36 tegels (short) of 18 tegels (blitz).
- De gekozen tegelset blijft behouden bij het starten en bij een rematch.
- Iedere wachtende speler ziet vanaf de beurt direct na zijn eigen beurt al de verwachte volgende tegel.
- De tegelpreview toont compact hoeveel spelers nog voor jou aan de beurt komen.
- De oranje Home-banner heeft een subtiele planeet, ringen, gloed en sterren gekregen zonder de bestaande hoogte te wijzigen.

## v1.11.9 — Mobiele spelervaring

- Actieve games gebruiken op mobiel één compacte oranje header met terugknop, gamenaam en een menu voor spelregels en geluid.
- Interne vertrekacties tonen een visuele Pluto-bevestiging met duidelijke keuzes om te blijven of het spel te verlaten.
- Hervatbare games verschijnen prominent op Home als `Doorgaan met spelen`.
- Recente games scrollen vloeiender met horizontale snap en de spelersfilter heeft een touch-target van minstens 44 × 44 px.
- Profielstatistieken gebruiken compacte mobiele kaarten en leaderboards passen zonder horizontaal scrollen.
- Op mobiel staat inloggen centraal en is `Account maken` een secundaire flow.
- Safe areas, modals, spacing, interne game-scroll en algemene mobiele touch-targets zijn verder verfijnd.

## v1.11.8 — Carcassonne vult schermhoogte

- Het Carcassonne-speelveld gebruikt op mobiel alle resterende hoogte van de gamecontainer.
- De oude vaste `100dvh - 300px`-hoogte en 430px-limiet zijn verwijderd voor actieve mobiele games.
- Titel, spelers en tegelbediening blijven vast; alleen het bord groeit of krimpt met de beschikbare schermruimte.

## v1.11.7 — Minimale game-header

- Tijdens actieve games op mobiel klapt de oranje header terug tot een minimale exit-strip.
- Alleen het klikbare Pluto-logo blijft zichtbaar zodat spelers snel naar Home kunnen terugkeren en de game vrijwel het volledige scherm gebruikt.

## v1.11.6 — Compactere mobiele Light-header

- De oranje banner op mobiele niet-game-schermen is lager gemaakt zodat Home meer verticale ruimte overhoudt.
- Logo, titel en verticale padding zijn licht verkleind; actieve rooms en games behouden hun bestaande headerhoogte.

## v1.11.5 — Recente gamekaarten zonder schaduw

- De schaduw onder de recente gamekaarten op Home is verwijderd in het Light theme.

## v1.11.4 — Minor carcassonne fixes

- Landbouwer placement in Carcassonne verbeterd.

## v1.11.3 — Light theme en schermvullende games

- Het oranje Light theme is volledig afgewerkt en voortaan standaard; Classic blijft beschikbaar via Instellingen.
- Lobby's en actieve games gebruiken de lichte stijl, waarbij gamepanelen de beschikbare ruimte onder de header volledig benutten.
- De mobiele header is compacter en blijft staan; de onderste navigatie sluit schermbreed aan op de onderrand.
- Scores, chips, spelersnamen en spelregels hebben sterker contrast in het Light theme.
- Donkere vaste spelpanelen en speelvelden in onder meer Age of Civilization, Carcassonne, Cluedo, Blackjack en Ticket to Ride zijn aangepast aan het Light theme.
- Cluedo-kaarten en de definitieve beschuldigingsknop zijn beter leesbaar.
- Profielstatistieken en recente matches blijven op mobiel binnen het scherm en scrollen alleen wanneer dat echt nodig is.

## v1.11.2 — Homefilter hersteld

- Een zichzelf activerende `MutationObserver` in de spelersfilter is idempotent gemaakt.
- Gamecards, navigatieknoppen en responsive device emulation blokkeren niet langer na het renderen van Home.
- Alle frontend-cacheverwijzingen zijn verhoogd zodat browsers het defecte 1.11.1-filterbestand niet hergebruiken.
- Een regressietest bewaakt dat de heading-observer alleen een werkelijk aanwezige klasse verwijdert.
- Releasechecks zijn bijgewerkt voor alle zeventien games.

## v1.11.1 — PWA-updatepopup

- De geïnstalleerde PWA controleert bij openen welke gebruikersrelevante wijzigingen sinds het vorige bezoek zijn toegevoegd.
- Nieuwe games, nieuwe features en verbeteringen worden over meerdere gemiste releases heen samengevoegd in drie compacte categorieën.
- Ingelogde accounts bewaren de laatst geziene versie centraal in SQLite; gasten bewaren die versie lokaal op hun toestel.
- Bestaande gebruikers krijgen bij deze eerste rollout stil een 1.11.1-baseline zodat er geen historische changelogdump verschijnt.
- Wanneer er geen nieuwe items zijn, verschijnt expliciet geen popup en wordt een versie zonder gebruikersnieuws stil als gezien verwerkt.
- `src/updates.js` is voortaan de centrale catalogus voor gebruikerszichtbare release-items.

## v1.11.0 — Cascadia

- Cascadia toegevoegd voor 2 tot 4 spelers met NPC-ondersteuning.
- Habitattegels en dieren worden via een gedeelde markt gedraft en in een eigen hexagonaal ecosysteem geplaatst.
- Dierpatronen, habitatcorridors en habitatmeerderheden bepalen de eindscore.
- Natuurfiches ondersteunen marktcombinaties en het verversen van dieren.

## v1.10.0 — Kingdomino

- Kingdomino toegevoegd voor 2 tot 4 spelers met NPC-ondersteuning.
- Domino's worden in nummerorde gedraft en moeten geldig aan hetzelfde terrein of het kasteel aansluiten.
- Gebieden scoren als aantal vakken × aantal kronen en het koninkrijk blijft binnen de toegestane afmetingen.
- De 2-spelervariant gebruikt twee koningen per speler; bij 3 spelers wordt de vierde domino per rij afgelegd.

## v1.9.0 — 7 Wonders Duel

- 7 Wonders Duel toegevoegd als tweespelersgame met NPC-ondersteuning.
- De kaartpiramide, grondstoffen, munten, militaire vooruitgang, wetenschap en wonderen worden server-side beheerd.
- NPC's kunnen zelfstandig volledige duels spelen.

## v1.8.3 — Gamefilter en alfabetische sortering

- Op Home kan de gamelijst via een compacte filterknop op aantal spelers worden gefilterd.
- Games worden alfabetisch gesorteerd op hun zichtbare displaynaam in plaats van op de interne map- of gamekey.

## v1.8.2 — Leaderboard en compacte matchgeschiedenis

- Het algemene leaderboard toont voortaan `Wins` vóór `Games`, gevolgd door `Winrate`.
- Profielen tonen standaard maximaal vijf recente matches.
- Bij meer dan vijf matches verschijnt `Toon meer`; na een klik worden de overige matches toegevoegd.
- Frontend-, server- en PWA-cacheversies zijn bijgewerkt naar 1.8.2.
- Nieuwe regressietests bewaken de kolomvolgorde en de limiet van vijf recente matches.

## v1.8.1 — Centrale instellingenpopup

- De losse mute-knop in de header is vervangen door een instellingen-tandwiel.
- Geluid en thema staan samen in één compacte instellingenpopup die op desktop en mobiel beschikbaar blijft.
- De themakeuze is uit Profiel verwijderd; Profiel bevat opnieuw alleen account- en spelstatistieken.
- De bestaande lokale opslag voor geluidsstatus en skin blijft behouden, zodat gebruikers hun huidige voorkeur niet verliezen.
- De PWA-cache bevat de nieuwe settings-assets en regressietests bewaken de instellingenpopup en versiegebonden frontendassets.

## v1.8.0 — Thema's en oranje preview-skin

- Onder Profiel staat voortaan een themakeuze waarmee skins zonder frontendkopie kunnen worden gewisseld.
- `Pluto 1.7.3` blijft de standaard skin; `Pluto 1.8.0 Preview` voegt een lichte interface met een oranje basiskleurenpalet toe.
- In de preview-skin is de volledige gamekaart klikbaar en toetsenbordtoegankelijk; de aparte `Nieuw spel`-actie wordt verborgen en een pijltje rechts verduidelijkt de navigatie.
- Recente games verbergen in de preview de tekst `Nieuw spel` en behouden de volledige kaart als startactie.
- De gekozen skin wordt lokaal per toestel onthouden en de browser-theme-color volgt de actieve skin.
- De PWA-cache bevat de nieuwe theme-assets en een regressietest bewaakt de selector, standaardskin en kaartinteractie.

## v1.7.3 — Ticket to Ride leesbaarheid en NPC-kaartkeuze

- NPC's kiezen voortaan nuttige open treinkaarten en jokers wanneer die hun nog vrije routes helpen; de gesloten stapel blijft de fallback.
- Het Ticket to Ride-speelveld ondersteunt slepen, pinch-zoom en muiswielzoom, met een per-room bewaarde zoompositie zoals bij Carcassonne.
- Stadnamen staan in compacte labels en routekosten/spelersbadges zijn van de routemiddens weggezet om overlap te verminderen.
- Bezette routebadges hebben naast de witte binnenrand een duidelijke buitenrand in de kleur van de speler.
- De vijf open treinkaarten plus stapel en de zes handkleuren gebruiken vaste zeskolomsrijen zodat ze op één schermbreedte blijven.
- Een regressietest bewaakt dat NPC's daadwerkelijk de open treinkaartenmarkt gebruiken.

## v1.7.2 — Kleurrijke game-iconen

- Cluedo, Hartenjagen, Hofslag, Pesten en Solitaire gebruiken voortaan gekleurde emoji-iconen in het gameoverzicht.
- Achtergebleven dubbele 1.6.x-versiereferenties uit de Civilization-merge zijn verwijderd uit de frontend, service worker, serverstart en package metadata.

## v1.7.1 — Winnen op levenspunten

- Overleven beide torens alle zeven tijdperken, dan wint voortaan wie de meeste levenspunten over heeft, niet het meeste goud.
- Goud beslist alleen nog als tiebreaker wanneer beide torens met exact evenveel levenspunten eindigen.
- Matchstatistieken (`results`) gebruiken nu overal dezelfde winnaar als het spel zelf, ook bij een gelijkspel.

## v1.7.0 — Age of Civilization v4

- Victory Points zijn verwijderd; Religie- en Cultuurkaarten verdelen hun bonus voortaan over Attack, Defence en goud per beurt.
- Nieuwe actie: gebouwen upgraden. Elke stat schaalt met factor 1,5 (naar beneden afgerond), behalve een stat van 1 die altijd 2 wordt.
- Een tijdperk telt nu drie beurten; de aanvalsgolf wordt alleen nog op de derde beurt van elk tijdperk verwerkt (21 beurten totaal).
- Zes categorieën vervangen de oude drie: Attack, Defence, Science (voedt Defence), Economy (goud per beurt), Religie en Cultuur.
- Gebouwen zijn uniek per speler en krijgen bij upgraden een naam passend bij het huidige tijdperk.
- Torens beginnen op 100 in plaats van 20 levenspunten; zonder VP is er geen genezing meer. Overleven beide torens alle tijdperken, dan wint het meeste goud.
- Nieuwe regressietests bewaken de upgrademechaniek, de unieke gebouwen, de driebeurtstructuur en de goudgebaseerde eindstand.
## v1.6.3 — Solitaire-weergave en solo-leaderboard

- Solitaire draw-3 toont de drie getrokken kaarten overlappend, waarbij alleen de bovenste kaart speelbaar is.
- Na het spelen van kaarten blijven de overige kaarten uit dezelfde draw zichtbaar en correct speelbaar in volgorde.
- Lange tableau-stacks verkleinen hun verticale overlap automatisch op lage schermen zodat de onderste kaart zichtbaar blijft.
- Voltooide Solitaire-runs van ingelogde spelers tellen nu mee voor wins, beste score en het Solitaire-leaderboard.
- De algemene regel die oefenmatches met minder dan twee menselijke spelers uitsluit, maakt voortaan expliciet uitzondering voor echte solo-games.
- De GitHub-frontpage toont voortaan alleen de huidige release, de `.0`-release van de huidige minorreeks en de `.0.0`-release van de huidige majorreeks; volledige historie blijft in deze changelog.

## v1.6.2 — Vaste spelweergave

- De volledige spelpagina blijft binnen de viewport en kan niet meer als geheel scrollen.
- Alleen de centrale spelinhoud behoudt een interne scrollfallback wanneer een spel aantoonbaar niet binnen het scherm past.
- Spellogs zijn tijdens actieve spellen overal verborgen, zodat ze geen onnodige schermruimte innemen.
- Santorini bouwt zijn spellog niet langer op en schaalt het bord dynamisch op basis van de beschikbare schermhoogte.
- Op bijzonder lage schermen verbergt Santorini secundaire uitleg en compacte spelersdetails om het bord speelbaar te houden.
- Nieuwe regressiechecks bewaken de vaste spelkaart, interne fallback en verborgen spellogs.

## v1.6.1 — Lopende spellen hervatten

- Lopende en afgelopen rooms blijven zichtbaar in het lobbyoverzicht zolang minstens één menselijke speler verbonden is.
- Bestaande deelnemers krijgen bij een lopend spel de actie `Ga terug` en hervatten hun oorspronkelijke speler via hun token of account.
- Niet-deelnemers zien dat een room loopt, maar kunnen niet halverwege toetreden.
- Op Home verschijnen lopende rooms alleen voor een bij naam herkende deelnemer.
- Een expliciet verlaten room wordt pas verwijderd wanneer de laatste verbonden menselijke speler vertrekt.
- Netwerkonderbrekingen behouden de bestaande herstelperiode, zodat een tijdelijke verbindingsfout de room niet wist.
- Nieuwe lifecycle-tests bewaken zichtbaarheid, hervatten en cleanup na het laatste vertrek.

## v1.6.0 — Schermvullende games en Carcassonne-hoekakkers

- Actieve spellen gebruiken de viewporthoogte en beperken scrollen tot een interne fallback wanneer inhoud echt niet binnen het scherm past.
- De chat, vaste vertrekkaart en overige `Verlaat spel`-knoppen zijn verwijderd; Home via het Pluto-logo verlaat de ruimte.
- Carcassonne-kruispunten behandelen de vier hoeken als afzonderlijke akkers, zonder verbinding over een weg heen.
- Landbouwerkeuzes benoemen exacte posities zoals `linksboven`, `rechtsonder` en `midden-boven`, en bewaren die positie bij de pion.
- De volgende Carcassonne-speler ziet tijdens de huidige beurt alvast de tegel bovenaan de stapel.
- De Carcassonne-eindtabel gebruikt compacte pictogramkolommen en past zonder horizontale scroll binnen één schermbreedte.
- Nieuwe regressietests bewaken kruispuntakkers, duidelijke labels, tegelpreview, eindtabel en de chatloze viewportinterface.

## v1.5.0 — Age of Civilization

- Age of Civilization toegevoegd als veertiende Pluto-game voor exact twee spelers.
- Bouw gedurende zeven tijdperken militaire, economische en culturele kaarten of unieke wonderen in een 3×3-stad.
- Iedere aanvalsgolf wordt volledig op de server verwerkt en kan een onvoldoende verdedigde toren beschadigen of doen instorten.
- Geheime handen worden uitsluitend aan de betreffende speler verstuurd en alle bouw-, goud- en scoreacties worden server-side gevalideerd.
- Een zelfstandige NPC kan draften, bouwen en volledige wedstrijden spelen.
- Eindresultaten werken mee in profielen, wedstrijdgeschiedenis en leaderboards.
- Nieuwe integratie- en regressietests bewaken pluginregistratie, geheime informatie, acties, NPC-beurten en plotselinge winst door een ingestorte toren.

## v1.4.0 — Lobbygerichte interface en Carcassonne-eindtelling

- Open lobby's verschijnen op Home als compacte kaartjes onder de recent gespeelde games en verdwijnen automatisch wanneer er geen beschikbare lobby's zijn.
- De oude code-invoer op Home en de deelbare roomlink in spellen zijn verwijderd; spelers vinden en joinen games via de centrale lobby.
- De onderste mobiele navigatie is verborgen in lobby's en actieve spellen, zodat niet-beschikbare acties geen ruimte meer innemen.
- De vaste spelkaart bevat alleen nog `Verlaat spel`; rematches blijven beschikbaar via het eindscherm.
- Het Carcassonne-eindscherm toont per speler de punten tijdens het spel, landbouwers en onafgewerkte wegen, steden en kloosters, plus het eindtotaal.
- Nieuwe regressietests bewaken de lobbykaarten, vereenvoudigde spelinterface, mobiele navigatie en Carcassonne-puntencategorieën.

## v1.3.0 — Carcassonne-akkers en mobiele Minigolf-card

- Carcassonne behandelt afzonderlijke groene gebieden op één tegel als afzonderlijke, verbonden akkersegmenten.
- Wegen en steden scheiden akkers; kloosters laten het omliggende akkergebied verbonden.
- Landbouwerkeuzes tonen waar het segment ligt en de pion staat in het juiste kwart, langs de juiste zijde of in het midden van de tegel.
- Een bestaande landbouwer blokkeert alleen het werkelijk verbonden akkersegment en de eindscore gebruikt dezelfde segmentgraph.
- Tijdens de burgerkeuze kan een speler teruggaan en dezelfde tegel op een andere geldige locatie leggen.
- De laatst gespeelde Carcassonne-tegel blijft zichtbaar met een rode omlijning.
- De knoppen `Nieuw spel` en `Map Editor` staan op de mobiele Minigolf-card naast elkaar, zoals op desktop.
- Nieuwe regressietests bewaken akkers, kloosters, terugplaatsen en de blijvende tegelmarkering.

## v1.2.1 — Quoridor NPC's en stabiele layout

- Quoridor ondersteunt nu NPC-spelers die doelgericht bewegen en geldige strategische muren kunnen plaatsen.
- De Quoridor-statusbalk houdt altijd dezelfde hoogte, zodat het bord niet meer verspringt tussen beurten.
- De README vermeldt de actuele NPC-ondersteuning en een regressietest bewaakt zelfstandige NPC-beurten.

## v1.2.0 — Vier nieuwe bordspellen

- Stratego toegevoegd als compact duel met geheime rangen, vrije beginopstelling, gevechten en NPC-tegenstander.
- Santorini toegevoegd voor 2 tot 4 spelers met workerplaatsing, bouwen, niveau-3-overwinning, blokkeren en NPC's.
- Ticket to Ride toegevoegd voor 2 tot 5 spelers met treinkaarten, routes, bestemmingen, eindtelling en NPC's.
- Quoridor toegevoegd voor 2 tot 4 spelers met padvalidatie, pionzetten en strategische muren.
- Stratego toont vijandelijke stukken als herkenbare verborgen pionnen en houdt alle bordcellen even groot.
- Ticket to Ride markeert eigen routes met een duidelijke `JIJ`-badge, spelerskleur en contrastrijke omlijning.
- De pluginregistry, productie-assets en regressietests zijn bijgewerkt voor alle dertien spellen.
- De README en installatie-informatie beschrijven weer de volledige actuele inhoud van Pluto.

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
