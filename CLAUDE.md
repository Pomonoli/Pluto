# Pluto — releaseregels

Bij **elke wijziging aan Pluto die naar GitHub gaat**, gelden onderstaande
versioneringsregels. Dit geldt voor elke commit/PR die als "release" naar de
main-tak gaat, niet voor losse experimenten of werk-in-uitvoering-branches.

## Versiebump kiezen

Huidig versienummer staat in `package.json` (`major.minor.patch`).

- **Patch** (`1.2.3 → 1.2.4`): kleine fixes en kleine wijzigingen.
- **Minor** (`1.2.3 → 1.3.0`): grote features of een nieuwe game.
- **Major** (`1.2.3 → 2.0.0`): grote architectuurwijzigingen of breaking changes.

## Bij elke release bijwerken

Alle versiereferenties in Pluto moeten gelijk lopen met het nieuwe
versienummer:

- `package.json` (`version`)
- `package-lock.json` (beide `version`-velden: root en het `""`-package)
- `server.js` (de opstart-`console.log` met `Pluto vX.Y.Z`)
- `public/app.js` (`?v=X.Y.Z`-querystrings)
- `public/index.html` (alle `?v=X.Y.Z`-querystrings)
- `public/service-worker.js` (de `CACHE`-constante `pluto-vX.Y.Z` én de
  `?v=X.Y.Z`-querystrings in `OFFLINE_SHELL`)

Daarnaast altijd:

- **CHANGELOG.md**: voeg bovenaan een nieuwe `## vX.Y.Z — <titel>`-sectie toe
  met bullets die de wijziging beschrijven. Bestaande secties blijven
  **volledig en ongewijzigd** staan — dit is de plek waar de complete
  geschiedenis (inclusief elke tussenliggende patchversie) bewaard blijft.
- **README.md**: werk de "Nieuw in versie …"-sectie op de GitHub-frontpage bij
  (zie hieronder voor welke versies daar mogen staan).

Als de wijziging een nieuwe game toevoegt of de speltabel in README.md
verandert, werk die tabel ook bij.

## Wat README.md mag tonen

De frontpage (README.md) toont **maximaal drie** "Nieuw in versie …"-secties,
in deze volgorde:

1. de huidige versie (bv. "Nieuw in versie 1.2.3");
2. de laatste `.0`-versie van dezelfde minorreeks (bv. "Nieuw in versie 1.2.0");
3. de laatste `.0.0`-versie van dezelfde majorreeks (bv. "Nieuw in versie 1.0.0").

Vallen twee van deze drie samen (bijvoorbeeld omdat de huidige versie zelf al
een `X.Y.0`-release is), dan toon je die versie maar één keer — geen
duplicaten.

Toon **geen** andere tussenliggende patch- of minorversies op de frontpage
(dus geen "1.2.2", "1.2.1", "1.1.5", oudere "1.1.0" enzovoort), ook al stonden
die daar in een eerdere release nog wel. Die blijven volledig terug te vinden
in CHANGELOG.md — pas dus bij elke release de bestaande README-secties aan in
plaats van er alleen maar één toe te voegen.
