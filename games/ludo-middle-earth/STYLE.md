# Ludo of Middle-earth — visuele stijl

- Isometrische parchment-kaart: het bord is een inline SVG met ruitvormige ("diamond") tegels op een klassieke iso-projectie (`isoX=(gx-gy)*w/2`, `isoY=(gx+gy)*h/2`), 48 padtegels rond een vierkante lus van 12 tegels per zijde.
- Kleurcode per rijk (`FACTIONS` in `client.js`/`server.js`, moet gesynchroniseerd blijven): Rivendell blauw/zilver `#7fb7e0`, Erebor goud `#e0b23c`, Barad-dûr rood/zwart `#c14a4a`, Minas Tirith wit/groen `#5fa06f`. Elk rijk heeft een vast hoekpunt (NW/NE/SE/SW) — nooit wijzigen zonder de geometrie-functies in beide bestanden gelijk te houden.
- Het bord zelf oogt als een verlicht perkament (warme radial-gradient) binnen de donkere Pluto-kaartstijl; geen losse afbeeldingen — alles is SVG-vormen en emoji-glyphs (geen externe assets/CDN's).
- Kastelen zijn simpele torensilhouetten (polygon) met een naamlabel, HP-balk en torenniveau (sterren) erboven; gevallen kastelen worden grijs en transparant.
- Eenheden zijn kleine cirkels in de rijkskleur met een klasse-emoji (🐎/⚔️/🗿), een HP-ring en een stippellijn-glow bij een actief schild.
- De bodemwerkbalk (actietray) is donker met perkament-tinten tekst; knoppen minimaal 44px hoog voor mobiel duimbereik.
- Houd nieuwe visuele elementen binnen dit palet en de iso-projectie; voeg geen realistische 3D-modellen of externe artwork toe — de stijl is bewust vlak/grafisch, consistent met de rest van Pluto.
