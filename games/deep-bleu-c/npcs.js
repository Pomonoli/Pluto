'use strict';

// De vaste cast van The Big Blue C. Elke NPC krijgt een eigen uiterlijk op
// dezelfde chibi-rig (client-side, zie NPC_APPEARANCE in client.js), een vaste
// vaste plek nabij een dorpsgebouw (`anchor`) waar hij op post staat, en één
// opdracht.
//
// `context`, `objective` en `reward` zijn de verhaaltekst in het gesprek;
// `goals` en `rewards` zijn wat de questmotor (quests.js) echt aftikt en
// uitbetaalt. Doelen zijn bewust geformuleerd in werkwoorden die de game al
// waarneemt (vangen, hakken, delven, oogsten, jagen, koken, ontdekken), zodat
// elke opdracht vandaag speelbaar is; een doel kan later verfijnd worden
// zonder de motor aan te raken.
const NPCS = [
  {
    id: 'elara',
    name: 'Elara',
    title: 'De Botanicus',
    anchor: 'lumberyard',
    dialogue: 'Nog één keer een stuk gerookte haring aanbieden en ik plant je als meststof onder mijn lavendel.',
    quest: {
      id: 'elara-botanicus',
      title: 'De Vegetarische Botanicus',
      type: 'Verzamelen',
      context: 'Haar voorraden zijn op en ze weigert het standaard zeedieet te volgen.',
      objective: 'Oogst 5 kelpvezel bij Wierlicht — het enige groen dat volgens haar de naam plant verdient.',
      reward: "Grondstof voor haar 'Vegetarische Stoofpot', en een royale vergoeding.",
      goals: [{ kind: 'gather', resource: 'kelp', count: 5, label: 'Kelpvezel geoogst' }],
      rewards: { cash: 150, xp: { collecting: 80 } }
    }
  },
  {
    id: 'krelis',
    name: 'Oude Krelis',
    title: 'De Ceremoniemeester',
    anchor: 'monument',
    dialogue: 'Je kunt de zee pas temmen als je je innerlijke blauwe bambi omarmt. Lach niet, ik ben hier serieus.',
    quest: {
      id: 'krelis-totem',
      title: 'Het Totem van de Diepzee',
      type: 'Jacht & Verzamelen',
      context: 'Twee jonge bemanningsleden zoeken een totem-inwijding voor hun huwelijksboot.',
      objective: 'Vel 1 stuk grofwild voor een vlekkeloze huid en oogst 1 kelpvezel als het blauwe hart van het totem.',
      reward: 'Zeemansaanzien, jachtervaring en een beurs voor het boegbeeld.',
      goals: [
        { kind: 'hunt', setId: 'grofwild', count: 1, label: 'Grofwild geveld' },
        { kind: 'gather', resource: 'kelp', count: 1, label: 'Kelpvezel geoogst' }
      ],
      rewards: { cash: 200, xp: { hunting: 100 } }
    }
  },
  {
    id: 'joris',
    name: 'Joris',
    title: 'De Kaartenmaker',
    anchor: 'haven',
    dialogue: 'Als je bij die rots was afgeslagen in plaats van te dobberen, had je dertien seconden bespaard. Zonde van je leven.',
    quest: {
      id: 'joris-route',
      title: 'De Perfecte Route',
      type: 'Navigatie',
      context: 'Joris beweert dat de tocht van zijn haven naar het oosten sneller kan voor het getij keert.',
      objective: 'Vaar oostwaarts en zet voet aan wal op Wierlicht, zodat hij zijn kaart eindelijk kan sluiten.',
      reward: 'Een vergoeding voor je vaarwerk en erkenning op zijn kaart.',
      goals: [{ kind: 'discovery', discovery: 'kelp-island', label: 'Wierlicht bereikt' }],
      rewards: { cash: 180, xp: { collecting: 90 } }
    }
  },
  {
    id: 'valerius',
    name: 'Inspecteur Valerius',
    title: 'De Toezichthouder',
    anchor: 'quarry',
    dialogue: 'Mooie sloep. Houtwerk is stevig. Spijtig van die toxische vezels op je dek. Dat wordt slopen, vrees ik.',
    quest: {
      id: 'valerius-vezels',
      title: 'De Vezelinventaris',
      type: 'Mijnen',
      context: 'Een wrak bij De Kelpwouden lekt giftige vezels. Dat moet geïnventariseerd worden voor havens besmet raken.',
      objective: 'Delf 10 steenmonsters met minstens een Houweel II — met blote handen laat hij je er niet aan beginnen.',
      reward: 'Gevarentoelage uit de staatskas, plus delfervaring op je dossier.',
      goals: [{ kind: 'gather', resource: 'rock', count: 10, minTool: { key: 'pickaxe', level: 2 }, label: 'Monsters gedolven (Houweel II+)' }],
      rewards: { cash: 220, xp: { mining: 120 } }
    }
  },
  {
    id: 'lars',
    name: 'Lars',
    title: 'De Taveerne-eigenaar',
    anchor: 'markt',
    dialogue: 'Schuif die schijf met een beetje beheersing door de poort, of je mag buiten gaan zwemmen met de kwallen.',
    quest: {
      id: 'lars-schuifbak',
      title: 'De Grote Schuifbak',
      type: 'Houthakken',
      context: 'Lars bouwt een traditionele houten schuifbak voor zijn taveerne, maar mist precisie-onderdelen.',
      objective: 'Hak 10 eiken — alleen eikenhout is hard genoeg voor schijven die recht door de poort schuiven.',
      reward: 'Een stevige vergoeding en een vaste plek aan zijn toog.',
      goals: [{ kind: 'gather', resource: 'wood', speciesId: 'eik', count: 10, label: 'Eiken gehakt' }],
      rewards: { cash: 300, xp: { woodcutting: 150 } }
    }
  },
  {
    id: 'anja',
    name: 'Anja',
    title: 'De Vissersvrouw',
    anchor: 'vishandel',
    dialogue: 'Hij heeft een dieet. Vraag me niet waarom, hij is gewoon geboren met grootheidswaanzin. Het is witte vis of hij krabt mijn oog uit.',
    quest: {
      id: 'anja-kat',
      title: 'De Kat op Dieet',
      type: 'Vissen',
      context: 'Haar binnenkat heeft zware voedselallergieën opgebouwd en verdraagt standaard vis niet meer.',
      objective: "Vang 2 zeldzame vissen 's nachts — overdag bijt volgens haar enkel wat de kat weigert.",
      reward: 'Een royale beloning uit haar viskas, en de zegen van de kat.',
      goals: [{ kind: 'fish', count: 2, rarity: ['rare', 'epic'], night: true, label: "Zeldzame nachtvangst" }],
      rewards: { cash: 260, xp: { fishing: 140 } }
    }
  },
  {
    id: 'nikos',
    name: 'Chef Nikos',
    title: 'De Kombuiskoning',
    anchor: 'aquarium',
    dialogue: 'Eén bord? Wat ben jij, een barbaar? We eten hier mezze. Als de tafel niet doorbuigt onder het gewicht, heb je niet gekookt.',
    quest: {
      id: 'nikos-mezze',
      title: 'Het Mezze-Banket',
      type: 'Koken',
      context: 'Nikos eist een traditioneel mezze-banket om de bemanning een hart onder de riem te steken.',
      objective: 'Bereid 3 gerechten aan het kookvuur — één bord is voor hem geen maaltijd maar een belediging.',
      reward: 'Een vorstelijke vergoeding uit de kombuiskas.',
      goals: [{ kind: 'cook', count: 3, label: 'Gerechten bereid' }],
      rewards: { cash: 240, xp: { collecting: 100 } }
    }
  },
  {
    id: 'kilgore',
    name: 'Kapitein Kilgore',
    title: 'De Veteraan',
    anchor: 'haven',
    dialogue: 'Ik hou van de geur van brandende hars en olie in de ochtend. Het ruikt naar... overwinning.',
    quest: {
      id: 'kilgore-sintel',
      title: 'De Geur van Sintel in de Ochtend',
      type: 'Verzamelen',
      context: 'Wil zijn sloep ombouwen tot een primitief stoomschip, voor de pure chaos en de geur van verbranding.',
      objective: 'Breng brandstof binnen: hak 15 stammen voor het vuur en delf 5 steen voor de ketelvoering.',
      reward: 'Een oorlogskas vol munten en de eeuwige dank van een pyromaan.',
      goals: [
        { kind: 'gather', resource: 'wood', count: 15, label: 'Stammen gehakt' },
        { kind: 'gather', resource: 'rock', count: 5, label: 'Steen gedolven' }
      ],
      rewards: { cash: 280, xp: { woodcutting: 80, mining: 80 } }
    }
  },
  {
    id: 'maria',
    name: 'Maria',
    title: 'De Ingenieur',
    anchor: 'quarry',
    dialogue: 'Water stroomt naar beneden. Behalve als er stenen in de weg liggen. Ga jij die weghakken of moet ik het uittekenen?',
    quest: {
      id: 'maria-levada',
      title: 'De Verlaten Levada',
      type: 'Mijnen',
      context: 'De zoetwatertoevoer via een steil irrigatiekanaal langs de kliffen is geblokkeerd door rotsverschuivingen.',
      objective: 'Ruim 3 rotsblokken op met je houweel, zodat het water weer naar beneden kan.',
      reward: 'Betaling uit haar werkbudget en toegang tot de zoetwatertap.',
      goals: [{ kind: 'gather', resource: 'rock', count: 3, label: 'Rotsblokken geruimd' }],
      rewards: { cash: 160, xp: { mining: 90 } }
    }
  },
  {
    id: 'borri',
    name: 'Borri',
    title: 'De Zoeker',
    anchor: 'monument',
    dialogue: 'Die ring... het is mijn schatje. Als je hem opdiept uit de maag van dat beest, haal het dan niet in je hoofd om hem zelf om je vinger te schuiven.',
    quest: {
      id: 'borri-ringworm',
      title: 'De Gouden Ringworm',
      type: 'Jacht',
      context: 'Borri liet zijn gouden zegelring vallen, waarna een massief beest hem opslokte.',
      objective: 'Win een dobbelgevecht tegen een zeldzaam beest — in díe maag ligt zijn schatje.',
      reward: 'De volle inhoud van Borri’s schatkist, en zijn ring blijft van hem.',
      goals: [{ kind: 'hunt', count: 1, rarity: ['rare', 'epic'], label: 'Zeldzaam beest geveld' }],
      rewards: { cash: 350, xp: { hunting: 180 } }
    }
  }
];

function getNpc(id) { return NPCS.find((npc) => npc.id === id) || null; }

// Wat de client nodig heeft om een gesprek te tonen; posities komen apart mee
// in de spelstate, omdat die per speelsessie in game.npcs staan.
function profiles() {
  return NPCS.map(({ id, name, title, dialogue, quest }) => ({ id, name, title, dialogue, quest }));
}

module.exports = { NPCS, getNpc, profiles };
