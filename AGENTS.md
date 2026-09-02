# Pluto

Lees en volg de releaseregels in `CLAUDE.md` bij wijzigingen die naar main gaan.

## Gericht testen

- Gebruik standaard één keer `npm run check` (syntax plus relevante tests), of
  `npm test` als syntax al afzonderlijk gecontroleerd is. Draai niet daarna
  nog eens dezelfde tests met `node --test` of de volledige suite.
- Een wijziging in één game vraagt de tests van die game plus algemene
  integratiechecks. Test relevante NPC-logica, scoring en beurtverloop bij
  logische wijzigingen; controleer het scherm bij visuele wijzigingen.
- De runner selecteert automatisch breder bij gedeelde infrastructuur,
  registry/loader, sockets, rooms, auth, dependencies, templates en globale UI.
  Gebruik `npm run check:all` voor een expliciete brede releasecontrole of
  als je concrete impact kent die de automatische selectie mist.
- `npm test -- --game <mapnaam>` begrenst de scope expliciet; gebruik dit
  alleen voor geïsoleerd gamewerk. `--base <ref>` selecteert branchwijzigingen;
  `--list` toont de selectie zonder tests te draaien.
- Bewaar bestaande regressietests. Voeg alleen tests toe die betekenisvol
  gedrag of een concrete fout bewaken, geen tests die enkel de implementatie
  overschrijven. Plaats gametests volgens de naamconventie in README.md.
- Een nieuwe game krijgt eigen gerichte tests; andere games hoeven geen
  volledige functionele hertest. De algemene checks bewaken laden,
  manifests, HTTP-assets, accounts, lobby en roomintegratie.
- Rapporteer kort welke scope is gecontroleerd en eventuele fouten.
