'use strict';

const { version: APP_VERSION } = require('../package.json');
const authDb = require('./db');

const INITIAL_BASELINE_VERSION = '1.11.1';
const BASELINE_MIGRATION_KEY = 'v1.11.1-update-popup-baseline';

const RELEASES = [
  {
    version:'1.8.0',
    features:[
      'Thema’s en skins toegevoegd, inclusief de oranje Pluto-preview.'
    ]
  },
  {
    version:'1.8.1',
    features:[
      'Geluid en thema samengebracht in één instellingenpopup.'
    ]
  },
  {
    version:'1.8.2',
    improvements:[
      'Leaderboard en recente matchgeschiedenis overzichtelijker gemaakt.'
    ]
  },
  {
    version:'1.8.3',
    features:[
      'Games kunnen op aantal spelers gefilterd worden.'
    ],
    improvements:[
      'Games worden alfabetisch gesorteerd op hun zichtbare naam.'
    ]
  },
  {
    version:'1.9.0',
    games:[
      '7 Wonders Duel'
    ]
  },
  {
    version:'1.10.0',
    games:[
      'Kingdomino'
    ]
  },
  {
    version:'1.11.0',
    games:[
      'Cascadia'
    ]
  },
  {
    version:'1.11.1',
    features:[
      'Een compacte updatepopup toont voortaan alleen wat nieuw is sinds je vorige bezoek.'
    ]
  },
  {
    version:'1.11.2',
    improvements:[
      'De spelersfilter blokkeert Home, knoppen en mobiele layout niet langer.'
    ]
  },
  {
    version:'1.11.3',
    features:[
      'Het afgewerkte Light theme is voortaan standaard; Classic blijft beschikbaar via Instellingen.'
    ],
    improvements:[
      'Lobby\'s en games gebruiken een lichte, schermvullende layout met betere contrasten.',
      'De mobiele header, ondernavigatie en profieltabellen benutten kleine schermen beter.'
    ]
  },
  {
    version:'1.11.4',
    improvements:[
      'Carcassonne landbouwer-plaatsing verbeterd.'
    ]
  },
  {
    version:'1.11.9',
    features:[
      'Actieve games hebben op mobiel een compacte oranje gameheader en een visuele bevestiging bij het verlaten.',
      'Lopende games kunnen prominent via Doorgaan met spelen worden hervat.'
    ],
    improvements:[
      'Recent, profielen en leaderboards zijn compacter en beter bruikbaar op kleine schermen.',
      'De mobiele loginflow, safe areas en touch-targets zijn verbeterd.'
    ]
  },
  {
    version:'1.11.10',
    features:[
      'Carcassonne kan in de lobby met 72, 36 of 18 tegels worden gestart.',
      'Wachtende Carcassonne-spelers zien eerder hun verwachte volgende tegel en hoeveel spelers nog voor hen komen.'
    ],
    improvements:[
      'De oranje Home-banner heeft een subtiele planeet-, ringen- en sterrenachtergrond.'
    ]
  },
  {
    version:'1.11.11',
    features:[
      'De Carcassonne-host kan het aantal burgers per speler instellen van 1 tot 12, met 7 als standaard.'
    ],
    improvements:[
      'Game-lobby’s gebruiken dezelfde compacte oranje ruimtebanner als Home.'
    ]
  },
  {
    version:'1.11.12',
    improvements:[
      'De lobby gebruikt overal game en games in plaats van room en rooms.'
    ]
  },
  {
    version:'1.11.13',
    improvements:[
      'Games blijven in browser en tablet binnen een passende, gecentreerde breedte zonder de mobiele layout te wijzigen.'
    ]
  },
  {
    version:'1.11.14',
    features:[
      'Age of Civilization ondersteunt nu 2 tot 7 spelers, unieke leiders en gevechten in een kring.'
    ],
    improvements:[
      'Age of Civilization heeft vernieuwde vaste gebouwen, gebeurtenissen, upgradeprijzen, kaartinformatie en een lichtere spelweergave.'
    ]
  },
  {
    version:'1.12.0',
    games:['Isle of Skye','The Deep Bleu C','CycClub'],
    features:[
      'CycClub bewaart de wielerploeg van ingelogde spelers en heeft een eigen clubleaderboard.'
    ]
  },
  {
    version:'1.12.1',
    improvements:[
      'De mobiele gameheader is strakker uitgelijnd, spelersaantallen blijven op één regel en Instellingen toont de huidige versie.'
    ]
  },
  {
    version:'1.12.2',
    improvements:[
      'Age of Civilization past op één vast scherm en gebruikt verzorgde kaart- en upgradepopups met compacte statverschillen.'
    ]
  },
  {
    version:'1.12.3',
    features:[
      'Games kunnen alfabetisch of volgens je persoonlijke speelgeschiedenis worden gesorteerd.'
    ],
    improvements:[
      '7 Wonders Duel, Hartenjagen en Hofslag gebruiken compactere vaste spelweergaves met duidelijkere kaarten, spelers en scores.'
    ]
  },
  {
    version:'1.12.4',
    improvements:[
      'De gedeelde Light-header is compacter en de mobiele ondernavigatie is ruimer, scherper en beter leesbaar met een vernieuwde instellingenknop.'
    ]
  },
  {
    version:'1.12.5',
    features:[
      'Verlaten games blijven tijdelijk hervatbaar en kunnen via een kruisje op de kaart Doorgaan met spelen definitief worden gesloten.'
    ],
    improvements:[
      'De automatisch verversende lobby heeft geen overbodige knop Vernieuwen meer.'
    ]
  },
  {
    version:'1.13.0',
    features:[
      'Je kunt je echte, unieke accountnaam voortaan veilig wijzigen vanuit je profiel.',
      'De Minigolf Map editor staat voortaan in de spellobby.'
    ],
    improvements:[
      'Ingelogde spelers zien bij refresh geen login-scherm meer tijdens de sessiecheck.',
      'Tablet- en desktopweergaves zijn in Pluto en alle games compacter, evenwichtiger en beter gecentreerd.',
      'Presidenten verdeelt Jouw kaarten responsief over meerdere rijen zonder horizontale scroll.'
    ]
  },
  {
    version:'1.13.2',
    improvements:[
      'Age of Civilization wacht voortaan op jouw keuze: de verborgen timeout van 40 seconden is verwijderd.'
    ]
  },
  {
    version:'1.13.3',
    features:[
      'De host kan elke andere speler uit de lobby verwijderen, ook online en offline humans.',
      'Na afloop kun je met dezelfde spelers terug naar de lobby om instellingen aan te passen.',
      'Tijdens actieve games blijft je scherm wakker waar je toestel dit ondersteunt.'
    ],
    improvements:[
      'Andere beurten en NPC-acties gaan door wanneer een speler offline is; menselijke keuzes blijven wachten.',
      'Na 15 seconden offline neemt een verbonden speler het hostbeheer over.',
      'Het kruisje bij Doorgaan met spelen verwijdert jouw hervatkaart; de game sluit zodra de laatste human dit doet.'
    ]
  },
  {
    version:'1.14.0',
    features:[
      'De kaart van The Deep Bleu C is omgezet naar een hexagonaal tegelraster met meer rivieren, meren en een grotere binnenzee.',
      'Aquarium-Museum, Handelsmarkt en Hall of Fame zijn nu speelbaar met upgrades, sets-bonussen en een leaderboard.',
      'CycClub heeft een nieuw koersmodel: elke rit bestaat uit 8 segmenten met dobbelstenen plus ploegbonussen (net als bij D&D) — pech, een val, een opportuniteit of een topdag, met een segment-voor-segment logboek in het resultaatscherm.',
      'CycClub is herwerkt met de 10 grootste WorldTour-ploegen van het 2026-seizoen en hun actuele renners in plaats van willekeurig gegenereerde namen. De Koerskalender is beperkt tot monumenten, Vlaamse klassiekers, grote ritten en de 3 grote rondes.',
      'CycClub: Fietsen & Materiaal, Voeding & Supplementen, Trainers & Analyse en de Medische Staf hebben nu elk hun eigen concrete effect — snelheid en pechkans, duurvermogen en vermoeidheid, de 3 beste statistieken per renner, en blessuretijd en ziektekans.',
      'CycClub-ritten zijn nu zelf speelbaar: rol per segment de dobbelsteen en zie je ploeg vooruitgaan op een grafiek van het rittenprofiel. Kies elk segment om je verworven multiplier toe te passen of op te sparen voor het volgende segment (+12,5% per keer sparen), waarna de vertrouwde uitslag volgt. Alle ploegen rijden elk segment gelijktijdig en gaan pas samen naar het volgende segment zodra iedereen zijn worp heeft bevestigd.',
      'The Deep Bleu C heeft nu 80 vissoorten verdeeld over 8 sets van elk 10 vissen (2 per watersoort), elk met een eigen thema. Een set voltooien geeft naast de geldbonus en verkoopprijsbonus nu ook een gratis niveau voor hengel, aas of boot.',
      'Age of Civilization heeft een 8ste leider, King Harald Hardrada, die bij elke aanvalsgolf goud plundert van de speler die hij aanvalt.'
    ],
    improvements:[
      'Een minimap toont altijd je positie op de wereldkaart.',
      'Ingelogde spelers behouden voortaan hun geld, vangst en uitrusting tussen spelsessies.',
      'CycClub toont je ploeg nu als een overzichtstabel (naam, leeftijd, specialisme, eigenschappen, status, kostprijs, vermoeidheid en verkoopoptie) — je hele team in één oogopslag. Maximum 10 renners per ploeg.',
      'CycClub: de upgrade-status staat compact bovenaan, en Shop, Scoutingmarkt en Koerskalender openen voortaan als aparte tabs naast de Ploeg.',
      'CycClub: Shop & Upgrades staat in een 2×2-veld met een voortgangsbalk en de bonustekst per niveau, zodat het op één scherm past.',
      'CycClub: de Scoutingmarkt toont voortaan 10 renners tegelijk met filters op statistiek en kostprijs.',
      'CycClub: de Koerskalender onderscheidt nu monumenten, Vlaamse klassiekers, grote ritten en grote rondes, en het prijzengeld stijgt mee met de moeilijkheidsgraad van de rit.',
      'CycClub: je start voortaan met €100.000 budget en een lege ploeg — alle renners koop je zelf via de Scoutingmarkt.',
      'CycClub heeft nu een "Opnieuw beginnen"-knop waarmee je (na bevestiging) je volledige voortgang definitief kan wissen.',
      'CycClub: de 7 statistiekvakken bovenaan zijn samengevoegd tot één compacte, smalle balk, in één oogopslag.',
      'CycClub: de Scoutingmarkt staat nu ook in tabelvorm en vult zichzelf altijd meteen aan met een nieuwe renner.',
      'CycClub: de tabellen "Ploeg" en "Scoutingmarkt" zijn versmald (5 resp. 4 kolommen, 3 rijen per renner) zodat ze ook op mobiel goed passen, en de Scoutingmarkt heeft nu een ververs-knop.',
      'CycClub: rennerstatistieken zijn nu individueel afgestemd op hun echte specialiteiten (in lijn met ProCyclingStats), met een veel groter statistiek- en prijsbereik.',
      'The Deep Bleu C: het speelveld vult nu het volledige zichtbare veld zonder blauwe rand, met een reliëfachtige achtergrond van gebergte en bebossing die meer op Europa lijkt (ook op de minimap), naadloos aansluitende hexagontegels met een vagere omranding, en een speelfiguur dat nu een vis in vogelvluchtperspectief met hengellijn is.',
      'The Deep Bleu C: de kaart volgt nu een echte Europese kustlijn (Iberisch Schiereiland, Italië/Balkan, Oostzee, Zwarte Zee, Britse eilanden) met meer bos en deels onbegaanbare bergpieken, en alles past voortaan op één scherm — de 4 gebouwknoppen staan naast de kaart onder de minimap, vissen verschijnt als pop-up, en Vishandel/Aquarium/Handelsmarkt/Hall of Fame openen als apart scherm met een terugknop.',
      'De Vishandel toont nu de verkoopprijs per vis en laat je met selectievakjes precies kiezen welke vis(sen) je verkoopt — "Verkoop alles" blijft ook gewoon beschikbaar.',
      'Age of Civilization: het upgraden van een gebouw in je stad vermenigvuldigt de stat nu met x1.5 per niveau, waardoor upgraden duidelijk voordeliger is dan een nieuw gebouw kopen.',
      'Age of Civilization: Observatorium, Grote Tempel en Academie geven nu elk een gerichte bonus per gebeurtenis — Wetenschap → Attack, Cultuur → Goud, Religie → Defence — die met 10% per tijdperk groeit, tot +70% in tijdperk 7.',
      'Age of Civilization: de bevestigingspopup bij een vaste-gebouw-gebeurtenis toont voortaan het exacte bonuspercentage voor de betrokken stat.'
    ]
  },
  {
    version:'1.14.1',
    improvements:[
      'Age of Civilization: een gebouw in je stad upgraden geeft nu altijd minstens +2 op de stat per niveau, ook als x1.5 van een lage basiswaarde minder zou opleveren.',
      'Age of Civilization: de gebeurtenis van een vast gebouw (Observatorium, Grote Tempel, Academie) kan nog maar één keer per spel ontketend worden — daarna is dat gebouw volledig geüpgraded.'
    ]
  },
  {
    version:'1.14.2',
    improvements:[
      'The Deep Bleu C: de vangst-pop-up is groter en toont de vissoort nu als apart, groot symbool boven de tekst, zodat naam en gewicht niet meer over elkaar heen kunnen vallen.'
    ]
  },
  {
    version:'1.14.3',
    improvements:[
      'The Deep Bleu C: arctisch ijswater (de lichtblauwe tegels in het noorden) telde geen watersoort en was daardoor onbevisbaar — het hoort nu bij de Atlantische watersoort, zodat je in elke blauwe tegel kunt vissen.'
    ]
  },
  {
    version:'1.14.4',
    improvements:[
      'Age of Civilization: Observatorium, Grote Tempel en Academie geven hun bonus nu meteen zodra je ze aanduidt, in plaats van pas na een derde upgrade-stap. Elk vast gebouw kan nog steeds maar één keer per spel aangeduid worden.'
    ]
  },
  {
    version:'1.14.5',
    improvements:[
      'Age of Civilization: de bonus van een vast gebouw (Observatorium, Grote Tempel, Academie) is nu Tijdperk × 10% van je huidige stat, als eenmalige, permanente optelling — 10 Inkomen wordt bijvoorbeeld 14 Inkomen bij het ontketenen in Tijdperk 4, en latere uitbreidingen vermenigvuldigen die bonus niet opnieuw mee.',
      'Age of Civilization: Cleopatra duidt Religie en Cultuur voortaan gratis aan, in plaats van dat deze al bij spelstart nutteloos op 0 vuren.'
    ]
  },
  {
    version:'1.15.0',
    features:[
      'The Deep Bleu C is nu speelbaar met 1 tot 4 spelers in dezelfde wereld — nodig vrienden uit via de gamecode om samen te verkennen en te vissen.',
      'The Deep Bleu C: een nieuwe knop Ruilen laat je vis en geld ruilen met medespelers — kies wat jij aanbiedt en wat je vraagt, en de andere speler accepteert of weigert het voorstel.'
    ],
    improvements:[
      'The Deep Bleu C: andere spelers zijn zichtbaar op de kaart als gekleurde vis met naamlabel, met een hengelicoontje boven wie aan het vissen is.',
      'The Deep Bleu C: de spelerslijst bovenaan toont voortaan iedereen in de wereld met hun geld en aantal ontdekte soorten.'
    ]
  },
  {
    version:'1.15.2',
    improvements:[
      'The Deep Bleu C toont een groter zichtbaar speelveld zonder de hexagonen uit te rekken, en heeft een aparte knop voor een volledige wereldkaart.'
    ]
  },
  {
    version:'1.15.1',
    improvements:[
      'CycClub: het gelijktijdige segment-systeem tijdens een rit is gerepareerd — de segmentvoortgang werd voorheen onterecht per speler bijgehouden in plaats van gedeeld voor de hele rit, waardoor de rit niet correct verder ging zodra iedereen bevestigd had.'
    ]
  },
  {
    version:'1.16.0',
    features:[
      'CycClub: Tour de France, Giro d’Italia en Vuelta a España zijn nu volwaardige Grote Rondes van 21 ritten na elkaar, elk met de bestaande 8-segmenten dobbelstenenrit — ze vervangen de losse Tour-, Giro- en Vuelta-ritten op de koerskalender.'
    ],
    improvements:[
      'CycClub: na elke rit van een Grote Ronde toont het ritresultaat meteen de tussenstand van het eindklassement, met een knop om direct de volgende rit te starten.',
      'CycClub: de erelijst houdt Grote Ronde-eindzeges nu apart bij van individuele ritzeges.'
    ]
  },
  {
    version:'1.18.0',
    features:[
      'The Deep Bleu C: nieuwe Haven met bootjes in de Middellandse Zee — koop een boot om het water op te varen, en hak hout of delf steen naast bomen en bergpieken met bijl en houweel, net als vissen. Nieuwe Houthakkerij en Steengroeve naast het Aquarium-Museum, elk met vijf sets van 10 soorten.',
      'The Deep Bleu C: nieuwe vaardigheden-skilltree — Vissen, Houthakken, Delven, Verzamelen en Handelen gaan van niveau 1 tot 99. Je verdient xp bij elke vangst, kap, delving, nieuwe ontdekking en voltooide ruil.'
    ],
    improvements:[
      'The Deep Bleu C: de hex-tegels zijn twee keer zo groot, met kleur en reliëf (bomen, rotsen, heuvels, water) in Pokémon-achtige stijl.',
      'The Deep Bleu C: je speler is nu een 2D-chibi visser die alleen een hengel, bijl of houweel in de hand heeft tijdens de bijhorende actie.'
    ]
  },
  {
    version:'1.18.1',
    improvements:[
      'NPC\'s krijgen voortaan een willekeurige echte voornaam die gedurende de lobby en het spel behouden blijft.'
    ]
  },
  {
    version:'1.18.2',
    improvements:[
      'Niet-hosts kunnen na een multiplayerresultaat kiezen om in de game te blijven voor een rematch, of die meteen te verlaten.',
      'Leaderboards tonen voortaan ook het aantal gelijkspelen, zonder extra breedte op mobiel.'
    ]
  },
  {
    version:'1.18.3',
    improvements:[
      'Bestaande gelijkspelgeschiedenis wordt automatisch meegenomen in de draw-statistieken.'
    ]
  },
  {
    version:'1.18.4',
    improvements:[
      'Isle of Skye-tegels zijn veel groter en tonen weide, berg en water als duidelijke gekleurde vakken met een centraal symbool voor wegen, whisky, schapen, vee en schepen.',
      'Isle of Skye toont een vaste legenda van alle terrein- en tegelsymbolen, en je kasteel is meteen herkenbaar op elk eiland.'
    ]
  },
  {
    version:'1.18.5',
    improvements:[
      'Age of Civilization toont totale Attack en Defence weer permanent bij je andere statistieken.'
    ]
  },
  {
    version:'1.19.0',
    features:[
      'Age of Civilization heeft nu een Deathmatch-modus: speel na tijdperk 7 door met late-game content tot er maximaal één toren overblijft.',
      'Age of Civilization toont een volledig aanvalsoverzicht en duidelijkere statinformatie in kaart-, upgrade- en spelerpopups.'
    ]
  },
  {
    version:'1.18.6',
    games:['Ragnarok'],
    features:[
      'Ragnarok: verover in realtime een gedeelde hexkaart met je vikingclan, bouw je gebied uit en overleef het oordeel der goden.'
    ]
  },
  {
    version:'1.20.0',
    features:[
      'The Deep Bleu C heeft een nieuwe art direction: een "deep water, warm land"-kleurenpalet, een RPG-avonturier met kap en cape als speelfiguur, en een schermvullende kaart met zwevende actieknoppen in plaats van een vaste zijbalk.'
    ],
    improvements:[
      'The Deep Bleu C: een geopend paneel (Vishandel, Aquarium, Vaardigheden, ...) schuift nu als een sheet over de kaart heen in plaats van het scherm te vervangen.'
    ]
  },
  {
    version:'1.21.0',
    games:['Bakkermans Jones'],
    features:[
      'Bakkermans Jones: draai een vroege bakkersdienst — bak van 03:00 tot 07:00, bedien klanten en lever bestellingen en een dagelijks evenement tot de winkel om 12:00 sluit, en overleef willekeurige tegenslagen zoals een kapotte koeling of stroomstoring.'
    ]
  },
  {
    version:'1.21.1',
    features:[
      'Solitaire heeft nu een zichtbare knop om meteen met een vers spel opnieuw te beginnen.',
      'Het Solitaire-leaderboard toont voortaan de beste zetten en snelste voltooiing zonder overbodige gelijkspelkolom.'
    ],
    improvements:[
      'Hartenjagen spreidt resterende handkaarten steeds ruimer en houdt alle vier spelers zichtbaar.',
      'Age of Civilization houdt het actieve spel vast, maakt het eindscherm bereikbaar en toont daar goud, aanval, verdediging en inkomen.',
      'Ragnarok-rivieren worden correct als gelaagde lijnen getekend en de lichte UI is rustiger en consistenter.',
      'CycClub is leesbaar in het lichte thema; 7 Wonders Duel toont kaarteffecten mobiel en noemt ieder tijdperk consequent Tijdperk.'
    ]
  },
  {
    version:'1.21.2',
    improvements:[
      'Age of Civilization heeft een nieuwe alchemistenatelier-interface met walnoothout, perkament, messing accenten en consistente gegraveerde iconen, compact en schermvullend op ieder formaat.'
    ]
  },
  {
    version:'1.22.0',
    features:[
      'The Deep Bleu C: gezondheid, energie en pantser — jaag op wilde dieren en eet de buit op voor energie; een mislukte jacht kost gezondheid (verminderd door pantser).',
      'The Deep Bleu C: de Inventaris heeft een gear-screen en de Marktplaats verkoopt nu ook kleding, wapens en schilden.'
    ],
    improvements:[
      'The Deep Bleu C: de kaart is nu één eiland vol meren, volledig omringd door zee en oceaan, met een wereldrand-waterval die in het niets stort.'
    ]
  },
  {
    version:'1.22.1',
    improvements:[
      'De gamecontainer is op mobiel, tablet en desktop zelf de schermvullende, randloze ondergrond; terugknop, gametitel en spelmenu liggen voortaan in deze game-oppervlakte.',
      'Age of Civilization toont geen dubbele titel meer, houdt de tijdperk- en beurtstatus op één regel en maakt de spelerskaarten tijdens de leiderskeuze weer duidelijk leesbaar.'
    ]
  },
  {
    version:'1.22.2',
    improvements:[
      'The Deep Bleu C toont het hexraster niet langer zichtbaar op de kaart: elk tegeltype heeft één platte kleur zonder tegelrand, zodat aangrenzende tegels van hetzelfde type naadloos in elkaar overlopen tot doorlopend terrein.'
    ]
  },
  {
    version:'1.22.3',
    improvements:[
      'Alle games gebruiken nu een schermvullende gameshell met een transparante gedeelde header, een knopvormige titelbubbel, veilige ruimte voor spelinhoud en zonder dubbele interne gametitels.'
    ]
  },
  {
    version:'1.22.4',
    improvements:[
      'De buitenste fullscreen-gamesurface loopt nu zonder afgeronde hoeken door tot aan de schermranden.'
    ]
  },
  {
    version:"1.22.5",
    improvements:[
      "Age of Civilization toont heldenportretten en aanklikbare spelerskaarten; Pluto-releases kunnen voortaan lokaal veilig worden gepubliceerd."
    ]
  },
  {
    version:"1.22.6",
    improvements:[
      "Releases kunnen starten met niet-gecommitteerd werk"
    ]
  },
  {
    version:"1.22.7",
    improvements:[
      "Grotere gebouwiconen in Age of Civilization-pop-ups"
    ]
  },
  {
    version:"1.23.0",
    features:[
      "The Big Blue C (voorheen The Deep Bleu C): de jacht op wild gebruikt nu een dobbelsteen-gevecht (aanvallen, verdedigen, eten, vluchten) in plaats van een tijdvenster.",
      "The Big Blue C: nieuw kooksysteem — een Kampvuur roostert vlees gratis, een Kookvuur bereidt gerechten met een tijdelijke buff.",
      "The Big Blue C: combat-gear heeft nu slijtage en kan gerepareerd worden; je kunt een aanlegsteiger bouwen vanuit de Inventaris."
    ],
    improvements:[
      "The Big Blue C: volledig nieuwe visuele stijl met een licht, zongebleekt Noords palet — het water wordt donkerder naarmate de zone zwaarder is (Ondiep, Kelpwouden, Wadzee, Rifzee).",
      "The Big Blue C: een versnelde dag/nacht-cyclus ontgrendelt nachtsoorten bij het vissen en jagen."
    ]
  },
  {
    version:"1.23.1",
    improvements:[
      "Age of Civ icons gefixt"
    ]
  },
  {
    version:"1.23.2",
    improvements:[
      "The Big Blue C gebruikt nu een schermvullende kaart met de gamebanner als overlay en zonder dubbele statusregel."
    ]
  }
];

const CATEGORIES = ['games','features','improvements'];

function parseVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  const left=parseVersion(a), right=parseVersion(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  for (let i=0;i<3;i+=1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function emptyChanges() {
  return { games:[], features:[], improvements:[] };
}

function changesSince(lastSeenVersion) {
  const changes=emptyChanges();
  if (!parseVersion(lastSeenVersion)) return changes;

  for (const release of RELEASES) {
    if (compareVersions(release.version,lastSeenVersion) <= 0) continue;
    if (compareVersions(release.version,APP_VERSION) > 0) continue;
    for (const category of CATEGORIES) {
      for (const item of release[category] || []) {
        if (!changes[category].includes(item)) changes[category].push(item);
      }
    }
  }
  return changes;
}

function hasChanges(changes) {
  return CATEGORIES.some((category) => changes[category]?.length);
}

authDb.db.exec(`
  CREATE TABLE IF NOT EXISTS user_update_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_version TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

function applyInitialBaseline() {
  const alreadyApplied=authDb.db.prepare(
    'SELECT migration_key FROM app_migrations WHERE migration_key = ?'
  ).get(BASELINE_MIGRATION_KEY);
  if (alreadyApplied) return;

  authDb.db.exec('BEGIN IMMEDIATE');
  try {
    const now=Date.now();
    authDb.db.prepare(`
      INSERT OR IGNORE INTO user_update_state(user_id,last_seen_version,updated_at)
      SELECT id, ?, ? FROM users
    `).run(INITIAL_BASELINE_VERSION,now);
    authDb.db.prepare(
      'INSERT INTO app_migrations(migration_key,applied_at) VALUES(?,?)'
    ).run(BASELINE_MIGRATION_KEY,now);
    authDb.db.exec('COMMIT');
  } catch (error) {
    authDb.db.exec('ROLLBACK');
    throw error;
  }
}

applyInitialBaseline();

function getLastSeenVersion(userId) {
  return authDb.db.prepare(
    'SELECT last_seen_version AS lastSeenVersion FROM user_update_state WHERE user_id = ?'
  ).get(Number(userId))?.lastSeenVersion || null;
}

function markSeen(userId, version = APP_VERSION) {
  authDb.db.prepare(`
    INSERT INTO user_update_state(user_id,last_seen_version,updated_at)
    VALUES(?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      last_seen_version=excluded.last_seen_version,
      updated_at=excluded.updated_at
  `).run(Number(userId), version, Date.now());
}

function payloadFor({ user = null, since = null } = {}) {
  let lastSeenVersion = user ? getLastSeenVersion(user.id) : String(since || '').trim() || null;

  // New accounts and first-time guest devices start silently at the current
  // release. Existing accounts were already pinned to the 1.11.1 baseline by
  // the one-time migration above.
  if (!lastSeenVersion || !parseVersion(lastSeenVersion)) {
    if (user) markSeen(user.id);
    return {
      ok:true,
      authenticated:Boolean(user),
      currentVersion:APP_VERSION,
      lastSeenVersion:APP_VERSION,
      changes:emptyChanges()
    };
  }

  const changes=changesSince(lastSeenVersion);

  // A version can contain no user-facing announcement. Advance the account
  // silently so the client never shows an empty popup or repeats this check.
  if (!hasChanges(changes) && compareVersions(lastSeenVersion,APP_VERSION) !== 0) {
    if (user) markSeen(user.id);
    lastSeenVersion=APP_VERSION;
  }

  return {
    ok:true,
    authenticated:Boolean(user),
    currentVersion:APP_VERSION,
    lastSeenVersion,
    changes
  };
}

module.exports = {
  APP_VERSION,
  INITIAL_BASELINE_VERSION,
  RELEASES,
  compareVersions,
  changesSince,
  hasChanges,
  payloadFor,
  markSeen
};
