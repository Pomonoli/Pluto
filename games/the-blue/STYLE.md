# The Blue

## Visual direction

- Zongebleekt en aards Noords palet — licht draagt de diepte, niet duisternis.
  Land blijft licht en uitnodigend; het water wordt donkerder naarmate de
  zone zwaarder is (Ondiep → Kelpwouden). De waterkleur is zelf de
  moeilijkheidsindicator. Zie `moodboard.html` voor de volledige referentie.
- Bleke berkenpanelen met een dunne inktrand i.p.v. donker glas; scherpe
  hoeken, geen zware slagschaduwen op UI-chrome.
- Sintel/ember blijft het enige warme accent: vuur, de actieknop, het
  dobbelgevecht. Verder blijft alles gedempt en licht.
- Het eiland en de speelwereld blijven de visuele hero; UI zweeft eromheen
  zonder belangrijke kaartdelen te bedekken.
- Dag/nacht toont zich als een koelere, donkerdere tint over de hele kaart
  's nachts — geen aparte UI nodig, gewoon een subtiele blauwe overlay.

## Palette

- Nevel: `#EDF1EA` · Mist: `#D3DCD2` · Verte: `#A9B6A9`
- Weide: `#8FAE72` · Grasland: `#6C8F56` · Naaldwoud: `#3F6247` · Naaldwoud donker: `#2A4433`
- Zonhout: `#A8875F` · Kernhout: `#75593A` · Steen: `#949D98` · IJzer: `#5F6864`
- Ondiep: `#8FC6CC` · Kustzee: `#4E8FA0` · Diepzee: `#2A5A6B` · Afgrond: `#17414F`
- Berkenwit: `#F6F2E7` · Sintel/ember: `#C4611F` · Sintel-licht: `#EFA04A` · Bloed: `#A34433`
- Papier: `#FBFCF8` · Paneel: `#F3F6EF` · Lijn: `#C7D2C6` · Inkt: `#24332C` · Inkt-2: `#5C6B62`

## Typography

- `Grenze` (serif, gekerfd) voor titels, zonenamen en vangstmeldingen. Nooit
  onder 15px.
- `Barlow` voor HUD, knoppen, cijfers en leestekst — tabular nums voor
  tellers en balken. Nooit onder 11px.

## World and interaction

- Vrij bewegen op een doorlopend terreinvlak — geen zichtbaar raster. Tikken
  op de kaart zet een bestemming of opent een contextuele actie (hakken,
  mijnen, vissen, aanvallen) afhankelijk van wat daar staat.
- Eén silhouet per object: bomen, rotsen en dieren zijn leesbare vlakke
  vormen met een lichte en een donkere zijde, met een ovale slagschaduw.
- Het kamp (kampvuur + werkbank, later kookvuur + smidse) is de enige vaste
  structuur en het visuele hart van het eiland.
- De rand van de wereld (buiten de diepe ring) is duidelijk niets — een
  donkere vervaging, geen harde muur maar ook geen twijfel dat je er niet
  hoort te zijn.

## HUD and layout

- Status (leven, energie, dag/nacht) linksboven; boot/vlot-indicator en
  belangrijkste acties rechts; onderaan een contextpaneel dat alleen
  verschijnt bij een actie (vissen, gevecht, kamp).
- Een geopend paneel (Inventaris, Codex, Maken) schuift als een sheet over
  de kaart; de kaart blijft altijd zichtbaar eronder.
- Houd alle controls bereikbaar rond de rand van het scherm, zonder
  paginascroll op de kaart zelf.

## Responsive rules

- Functioneel en compact op mobiel, tablet en desktop.
- Gebruik extra schermruimte om de kaart groter te tonen, niet om knoppen
  buitensporig uit te rekken.
