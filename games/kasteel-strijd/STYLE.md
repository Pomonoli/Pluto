# Kasteel Strijd — stijl

- **Thema**: speelgoedsoldaatjes op een toy-diorama. Canvasveld met lucht, heuvels, gras en aarde; groene legermannetjes (`#4f7942`) tegen grijze (`#6b6f76`).
- **HUD**: donkerhout-panelen (`linear-gradient(#3a2716, #241608)`) met gouden rand (`#f0b429`), perkamenttekst (`#eee0c2`), gedempte labels (`#c9b183`).
- **Typografie**: koppen, tijdperkbadge en knopnamen in een serif (Georgia-stack, geen externe fonts); overige tekst in de Pluto-basisfont.
- **Status-kleuren**: betaalbaar groen (`#5fa85f`), te duur rood (`#c14545`), cooldown grijsblauw (`#8fa0ac`).
- **Layout**: veld 1400×584 (aspect-ratio), daaronder twee rijen van vier knoppen (upgrades, vaardigheden); onder 560 px twee kolommen.
- **Per tijdperk** wisselen kasteel-, helm- en wapentekening in `engine.js`; nieuwe tijdperken volgen dat patroon (één tekenfunctie per gebouw, helmtype en wapen).
