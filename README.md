# HK Aufnahme

Handy-App für die Datenaufnahme von Energieausweisen (Wohngebäude, Bedarfsausweis).
Vor Ort Gebäude, Konstruktionen, Bauteile mit Fenstern, Heizung und Ausweis-Angaben erfassen,
dann eine EVEBI-Projektdatei (`.evex`) erzeugen und am PC mit EVEBI öffnen.

- Läuft im Browser, auch offline, und lässt sich auf den Startbildschirm legen.
- Alle Eingaben bleiben auf dem Gerät (localStorage). Es gibt keinen Server.
- `vorlage.js` enthält ein neutrales EVEBI-14-Gerüst ohne Kunden- oder Ausstellerdaten.
