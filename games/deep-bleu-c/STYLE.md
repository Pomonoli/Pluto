# The Big Blue C · style guide v6

## Visual direction

- Warme, handgeïllustreerde zee-RPG: zachte hexlandschappen, perkamenten
  systeemschermen en tastbaar hout/brons voor handelingen en bootbeheer.
- Land blijft licht en uitnodigend (weide, naaldwoud, zonhout); het water
  wordt donkerder naarmate de zone zwaarder is (Ondiep → Kelpwouden → Wadzee
  → Rifzee). De waterkleur is zelf de moeilijkheidsindicator.
- Perkament is het informatiemateriaal; hout en brons markeren tabs, acties en
  de permanente bootbasis-HUD. Schaduwen zijn zacht en functioneel.
- Sintel/ember blijft het enige warme accent: de actieknop, vuur, zeil, het
  dobbelgevecht. Verder blijft alles gedempt en licht.
- Het eiland en de speelwereld blijven de visuele hero; UI zweeft eromheen
  zonder belangrijke kaartdelen te bedekken.

## Palette

- Nevel: `#EDF1EA` · Mist: `#D3DCD2` · Verte: `#A9B6A9`
- Weide: `#8FAE72` · Grasland: `#6C8F56` · Naaldwoud: `#3F6247` · Naaldwoud donker: `#2A4433`
- Zonhout: `#A8875F` · Kernhout: `#75593A` · Steen: `#949D98` · IJzer: `#5F6864`
- Ondiep: `#8FC6CC` · Kustzee: `#4E8FA0` · Diepzee: `#2A5A6B` · Afgrond: `#17414F`
- Berkenwit: `#F6F2E7` · Sintel/ember: `#C4611F` · Sintel-licht: `#EFA04A` · Bloed: `#A34433`
- Papier: `#FBFCF8` · Paneel: `#F3F6EF` · Lijn: `#C7D2C6` · Inkt: `#24332C` · Inkt-2: `#5C6B62`

## Typography

- `Grenze` (serif, gekerfd) voor titels en zonenamen.
- `Barlow` voor HUD, knoppen, cijfers en alle leestekst — tabular nums voor
  tellers en balken die niet mogen trillen.
- Niets onder 11px; `Grenze` nooit onder 15px.

## Controls

- Ronde actieknoppen zijn thumb-friendly en minimaal `44×44px`; systeemschermen
  gebruiken brede houten tabs en een duidelijke ronde sluitknop.
- Vierkante, licht afgeronde knoppen voor systeem-/menufuncties.
- De belangrijkste actie gebruikt sintel/ember; vaste menuacties in de
  bootbasis blijven onderling gelijkwaardig.

## HUD and layout

- Alle vaste menuacties (Inventaris, Marktplaats, Hall of Fame, Vaardigheden,
  Map) staan samen met de bootstatus in de compacte boat-base HUD rechtsboven;
  op mobiel vormt die HUD een compacte balk onderaan.
- De bootbasis toont de vaartuigupgrade direct onder de boot; Hengel, Bijl en Houweel hebben drie tabs met hun niveau (1-10),
  volgende upgrade en vereisten; Inventaris > Uitrusting bevat alleen kleding,
  wapens en schilden.
- De bovenste HUD volgt twee duidelijke rijen in houten kaders: dag en geld,
  ontdekte soorten en level bovenaan; brede gezondheid/energiebalken en een
  compacte edelsteenbadge voor pantser eronder. Iconen mogen het kader licht
  overlappen; waarden gebruiken grote, stabiele cijfers.
- Actieve buffs blijven kleine klok-badges onder of naast de statusmeters.
- Dag/nacht toont zich als een ☀️/🌙-pil plus een koelere, donkerdere tint
  over de hele kaart 's nachts — geen aparte UI nodig.
- Een geopend paneel (Inventaris, Marktplaats, ...) schuift als een sheet
  over de kaart; de kaart blijft altijd zichtbaar.
- Bootbasis is op mobiel de uitzondering: dit complexe beheerscherm gebruikt
  een vaste fullscreen sheet met een sticky sluitkop. Alleen de paneelinhoud
  scrollt; boot, stations, gereedschappen en creëren blijven aparte secties.
- Gereedschappen gebruikt mobiel drie kleine keuzetabs en toont slechts één
  detailkaart tegelijk. De maakactie is compact en rechts uitgelijnd, nooit
  een overgrote schermbrede knop.
- Houd alle belangrijke controls bereikbaar rond de rand van het scherm,
  zonder paginascroll op de kaart zelf.

## World and character style

- Boten volgen tien geïllustreerde zijaanzichten: Vlot, Kano, Roeiboot,
  Zeilboot, Kustboot, Langschip, Vrachtschip, Oorlogsschip, Drakkar en
  Koningsschip. Gebruik dezelfde SVG per niveau in de wereld, HUD en Bootbasis.
  Warm hout, crèmekleurig doek, gedempt groen en roestrode zeilstrepen;
  hogere niveaus krijgen meer masten, roeispanen, schilden en boegversiering.
  Bootbasisslots staan onder de illustratie zodat de romp en zeilen vrij blijven.

- Top-down camera, licht "2.5D": de kaart blijft het bestaande gedeelde
  hex-coördinatensysteem (positie, camera, klikafhandeling ongewijzigd), maar
  alles wat op het terrein staat toont een front-facade/dimensie i.p.v. een
  plat silhouet — geen volledige derde-persoonscamera.
- Hexen blijven zichtbaar met een lage-contrastlijn, maar beweging blijft vrij.
  Objecten overschrijden visueel celranden; reliëf komt uit kaartbrede lichtval,
  zachte schildertextuur en losse decor-objecten met een ovale grondschaduw.
- Terrein gebruikt per type drie nabije schildertonen: weide met grassprieten en
  bloemen, zand met fijne ribbels, gemengd loof-/naaldwoud, en gefacetteerde
  rotsen en sneeuwtoppen. De vormen blijven helder leesbaar op mobiel.
- Bomen gebruiken een vast SVG-pictogram per houtset, gedeeld met Inventaris.
  Geen cijferbadges op de kaart; niveaus staan bij de sets en in tooltips.
  Vinkje, slot en zandloper tonen
  respectievelijk kapbaar, te weinig bijlniveau/Kappen en bronherstel. Gebruik
  dezelfde serververeisten voor status en tekst; eik behoudt Kappen 8.
- Wildlife gebruikt vaste pictogrammen per set (kleinwild, grofwild,
  nachtdieren) op de kaart en in Inventaris. Statusicoontjes blijven even klein
  en gedempt als bij bomen, zonder cijfers. Een slotje volgt de werkelijke
  jachtvoorwaarden, waaronder dag/nacht; het getoonde dier blijft vast per plek.
- Kusten krijgen een lichte schuimrand. Water toont meerdere losse golfstreken;
  de vier dieptezones lopen van helder cyaan naar donker petrol, met sterker
  zichtbare glinstering en visscholen in open water.
- Vaste gebouwen zijn uitsluitend decoratieve oriëntatiepunten: rustieke
  huisjes, een zuilentempel, een koepelgebouw, een groeveloods en een
  havengebouw. Ze hebben geen labels, emoji-uithangbord, status of klikfunctie;
  alleen een door spelers gebouwde aanlegsteiger blijft een functioneel dok.
- Personages blijven chunky RPG-avonturiers (kap, cape, zichtbaar
  gereedschap/wapen); vermijd een vlak silhouet.
- De wereldrand (buitenste rand van de kaart) is een donkere, vage waterval
  die in het niets stort — het platte-aarde-thema.
- Vermijd fotorealisme en details die de leesbaarheid van het speelveld
  verminderen.

## Responsive rules

- De game moet op mobiel, tablet en desktop functioneel en compact blijven.
- De sandbox toont circa 50% meer kaart dan de vorige 18×12-uitsnede; portret
  gebruikt een hoge 9×20-uitsnede zodat ook achter de mobiele HUD voldoende
  omgeving rond het personage zichtbaar blijft.
- Gebruik extra schermruimte om kaart en informatie beter te tonen, niet om
  knoppen buitensporig groot uit te rekken.
- Controls mogen de kaart niet onnodig bedekken en moeten zonder scrollen
  bereikbaar blijven waar de spelstructuur dat toelaat.
