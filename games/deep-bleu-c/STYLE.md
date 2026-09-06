# The Big Blue C

## Visual direction

- Zongebleekt en aards Noords palet — licht draagt de diepte, niet duisternis.
- Land blijft licht en uitnodigend (weide, naaldwoud, zonhout); het water
  wordt donkerder naarmate de zone zwaarder is (Ondiep → Kelpwouden → Wadzee
  → Rifzee). De waterkleur is zelf de moeilijkheidsindicator.
- Bleke berkenpanelen met een dunne inktrand i.p.v. donker glas; scherpe
  hoeken, geen zware slagschaduwen op UI-chrome.
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

- Ronde actieknoppen (thumb-friendly) maar met bleek berken-vlak, dunne
  inktrand en géén gradient — geen "speelgoed"-glans meer.
- Vierkante, licht afgeronde knoppen voor systeem-/menufuncties.
- De belangrijkste actie is sintel/ember, niet groter — er is geen apart
  uitgelicht "primary"-anker meer; alle railknoppen zijn gelijkwaardig.

## HUD and layout

- Alle actieknoppen (Inventaris, Marktplaats, Hall of Fame, Vaardigheden,
  Map) staan samen in één rail rechts, verticaal gecentreerd — geen losse
  rail linksboven.
- Gezondheid/energie als balken, pantser als badge, actieve buffs als kleine
  klok-badges — allemaal net onder de geld/soorten/level-pillen.
- Dag/nacht toont zich als een ☀️/🌙-pil plus een koelere, donkerdere tint
  over de hele kaart 's nachts — geen aparte UI nodig.
- Een geopend paneel (Inventaris, Marktplaats, ...) schuift als een sheet
  over de kaart; de kaart blijft altijd zichtbaar.
- Houd alle belangrijke controls bereikbaar rond de rand van het scherm,
  zonder paginascroll op de kaart zelf.

## World and character style

- Top-down camera, licht "2.5D": de kaart blijft het bestaande gedeelde
  hex-coördinatensysteem (positie, camera, klikafhandeling ongewijzigd), maar
  alles wat op het terrein staat toont een front-facade/dimensie i.p.v. een
  plat silhouet — geen volledige derde-persoonscamera.
- Eén doorlopend terreinvlak (geen zichtbaar hexraster, geen blur/waas);
  reliëf komt uit een kaartbrede lichtval en losse decor-objecten (bomen,
  rotsen, golven) met een ovale slagschaduw, niet uit een per-tegel gradient
  of een geblurde textuur.
- Gebouwen zijn echte kleine illustraties (muur, dak, deur, venster, hangend
  uithangbord met het bestaande emoji-icoon) i.p.v. een icoon-in-kader; het
  Hall of Fame-monument is een obelisk, havens/aanlegsteigers zijn een
  dokplateau op palen — geen generieke iconenset.
- Personages blijven chunky RPG-avonturiers (kap, cape, zichtbaar
  gereedschap/wapen); vermijd een vlak silhouet.
- De wereldrand (buitenste rand van de kaart) is een donkere, vage waterval
  die in het niets stort — het platte-aarde-thema.
- Vermijd fotorealisme en details die de leesbaarheid van het speelveld
  verminderen.

## Responsive rules

- De game moet op mobiel, tablet en desktop functioneel en compact blijven.
- Gebruik extra schermruimte om kaart en informatie beter te tonen, niet om
  knoppen buitensporig groot uit te rekken.
- Controls mogen de kaart niet onnodig bedekken en moeten zonder scrollen
  bereikbaar blijven waar de spelstructuur dat toelaat.
