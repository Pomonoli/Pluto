# Ragnarok Mobile — Design document

Een vereenvoudigde, realtime mobile versie van het originele Ragnarok bordspel.

**Doel:** een volledige match tussen vrienden speel je uit in 10-15 minuten.

> Status: geïmplementeerd (`manifest.json`, `server.js`, `client.js`) — Ragnarok
> is speelbaar in Pluto. De implementatie wijkt op één belangrijk punt af van
> het oorspronkelijke ontwerp hieronder: in plaats van 8 discrete rondes met
> een geheime-gelijktijdige-actie-timer (§4) is het een continu, tickless
> spel geworden, geïnspireerd door Age of Civilization/Age of Civilizations —
> Erts en IJzer groeien voortdurend aan, en iedere clan (mens of NPC) handelt
> zodra die het kan betalen, zichtbaar en direct voor iedereen. Het "8 rondes →
> eindsprint"-ritme uit §8 is vertaald naar verstreken speeltijd: na verloop
> van tijd breekt de eindstrijd aan en wordt het oordeel der goden frequenter
> en heftiger. Er is dus geen zichtbare, opjagende per-actie-timer — enkel een
> stille server-side veiligheidsklep tegen een oneindig durende expeditie.
> Zie `games/ragnarok/server.js` voor de exacte tijdsconstantes.

---

## 1. Overzicht

- 2 tot 6 spelers, elk met een eigen vikingbeschaving op een gedeelde kaart.
- Spel verloopt in 8 vaste rondes (ontwikkeling), gevolgd door een finale
  eindsprint zonder rondelimiet.
- Iedere ronde bestaat uit 3 stappen: verzamelen → actiefase (gelijktijdig) →
  oordeel van de goden.
- Winnaar = laatste overlevende, of hoogste score als de finale eindigt met
  meerdere spelers nog in leven (zie §9).

## 2. Spelopzet

- Lobby: host maakt een spel aan, vrienden joinen via een code. Geen
  matchmaking met vreemden (voorlopig).
- Kaart: gedeelde hexkaart, random gegenereerd per match (herspeelbaarheid) en
  schaalt in grootte mee met het aantal spelers.
- Elke speler start met een kleine thuisbasis op een eigen startpositie op de
  kaart.

## 3. Resources

Drie resource-types, bewust minimaal gehouden:

| Resource | Functie |
| --- | --- |
| Erts (economie) | basis voor uitbreiden en thuisbasis-investering |
| IJzer (militair) | basis voor upgraden van pionnen |
| Gunst der goden | schaarse valuta, verdiend via offers, ingezet voor bescherming of bonus |

Resources worden automatisch verdiend op basis van geplaatste arbeiders — geen
aparte dobbelworp per resource nodig (die vertraagt het tempo).

## 4. Rondestructuur

### Stap 1 — Verzamelen (automatisch)

Elke speler ontvangt Erts en IJzer op basis van actieve arbeiders. Geen input
nodig, puur informatief moment.

### Stap 2 — Actiefase (gelijktijdig, 30-45 sec timer)

Alle spelers kiezen tegelijk en geheim één actie. Na de timer worden alle
acties onthuld en gelijktijdig verwerkt.

Mogelijke acties:

- **Uitbreiden**: claim een aangrenzende onbezette tegel (kost Erts).
- **Upgraden**: verhoog een pion één niveau (kost IJzer) — zie §5.
- **Aanvallen**: val een zichtbare tegel binnen bereik aan (bereik hangt af
  van pion-type). Bij winst: verliezer verliest de tegel én de pionnen erop
  volledig.
- **Offeren aan de goden**: besteed resources aan Gunst der goden. Bij het
  offeren kiest de speler zelf: bescherming tegen het volgende slechte
  god-event, óf een kans op bonus.

### Stap 3 — Oordeel van de goden (automatisch)

Elke ronde treft één event de spelers. Het event target bij voorkeur de
speler(s) met de laagste score (zie §9) — dit werkt meteen als
comeback-mechanisme voor wie achterstaat.

## 5. Pion-niveaus

Drie niveaus, zoals in het origineel:

- **Arbeider** — basis, levert resources.
- **Krijger** — sterker in aanval, groter bereik voor verovering.
- **Graaf of Boot** (keuze bij laatste upgrade):
  - Graaf → sterker in verdediging.
  - Boot → sneller/verder bewegen over de kaart.

## 6. Thuisbasis

De thuisbasis groeit niet automatisch — de speler kiest bewust om te
investeren (kost Erts). Een grotere thuisbasis levert meer resource-opbrengst
per ronde op.

## 7. Score & "zwakte"

Score = combinatie van territorium (aantal tegels) + totale resources.

Deze score bepaalt:

- wie er getarget wordt door het oordeel van de goden (zwakste eerst —
  comeback-mechanisme),
- de eindstand als de finale met meerdere overlevenden zou eindigen.

## 8. Finale eindsprint

Na 8 rondes start de finale: geen vaste rondelimiet, maar om het spel toch
kort te houden worden de god-events elke ronde heftiger en frequenter. Dit
dwingt vanzelf een snelle beslissing af zonder een harde tijdslimiet nodig te
hebben.

Een speler die tijdens de finale al zijn tegels verliest, is geëlimineerd en
wordt toeschouwer.

De finale eindigt zodra er nog maar 1 speler over is → die speler wint.

## 9. Wat we bewust hebben geschrapt (t.o.v. het origineel)

- Markt/handelssysteem met oplopende prijzen per kaart — te traag voor
  realtime spel. Kan later terugkomen als lichte "snelle ruil"-actie
  (voorstel + accept/decline binnen de timer).
- Beurt-per-beurt spelen — vervangen door gelijktijdige actierondes zodat
  niemand moet wachten.
- Losse runenworp per grondstof — resources worden nu automatisch verdiend;
  runen (staafvormige dobbelstenen) worden wel behouden, maar enkel voor
  gevechtsresolutie.

## 10. Technische aandachtspunten voor implementatie

- **Datamodel (voorstel)**: `Player`, `Tile`, `Pawn` (type:
  arbeider/krijger/graaf/boot), `Resource` (erts/ijzer/gunst), `Action`
  (type, actor, target), `GodEvent` (type, target, effect).
- **Realtime sync**: alle spelers kiezen geheim binnen de timer → server
  onthult en verwerkt alle acties simultaan. Pluto's bestaande
  Socket.IO-realtimelaag (`src/server/realtime.js`) en het
  `tick(game, now)`-plugincontract volstaan hiervoor; er is geen aparte
  backend nodig.
- **Belangrijkste aanname om vroeg te testen**: blijft een match (8 rondes ×
  30-45 sec + finale) echt binnen 10-15 minuten met 4-6 spelers? De
  escalerende god-events in de finale zijn de enige garantie hiervoor — dit
  verdient een vroege speeltest.
- **Kaartgeneratie**: random per match, grootte schaalt met aantal spelers
  (bv. formule: basisgrootte + N tegels per extra speler).
