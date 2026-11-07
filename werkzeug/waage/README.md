# Die Waage

Eine Küchenwaage ohne Display: Ein ESP32 liest eine Wägezelle und schickt
die Gramm ins Internet, die App hört zu. Im Kochmodus steht dann unter dem
Schritt die Zutat mit Bild und Ziel („Paprika → Schale 3, 188 / ca. 450 g“),
der Schritt hakt sich von selbst ab, sobald es passt, und beim Portionieren
zählt sie Box für Box. Ist die Waage aus, bleibt alles wie bisher.

Warum der Umweg über Supabase: Die App läuft als HTTPS-Seite, und Safari auf
dem iPad lässt eine HTTPS-Seite nicht mit einem Gerät im Heimnetz reden
(Mixed Content). Die Waage sendet darum an **Supabase Realtime** (Broadcast
auf einem Kanal), die App abonniert den Kanal. Das geht mit dem Supabase-
Projekt, das die Freizeit-App schon hat – eine Tabelle braucht es nicht, nur
Adresse und anon-Schlüssel (`Project Settings → API`).

## Teile (≈ 20–30 €)

| Teil | Hinweis |
| --- | --- |
| ESP32 DevKit (ESP32-WROOM-32, 30 Pins) | mit USB, jedes gängige Board |
| Balken-Wägezelle 10 oder 20 kg + HX711-Modul | gibt es als Set („YZC-131 20 kg HX711“); 20 kg, damit der volle Topf draufpasst (1–2 g genau) |
| 2 Kunststoff-Schneidebretter (≈ 25 × 15 cm) | Boden- und Deckplatte, abwischbar |
| 4 Schrauben M4 + Muttern + 2 Distanzhülsen (≈ 10 mm) | je zwei Schrauben an jedem Ende der Zelle |
| Jumper-Kabel Buchse–Buchse | 4 für den HX711 |
| USB-Kabel + altes Handy-Ladegerät | die Waage läuft an einer Steckdose |
| Kork-Untersetzer | zwischen heißem Topf und Platte, sonst driftet die Anzeige |
| 1 kg Zucker (ungeöffnet) | zum Kalibrieren |

## Mechanik

Die Zelle ist ein Balken mit je zwei Gewindelöchern an jedem Ende. Ein Ende
kommt mit zwei Schrauben und ~10 mm Abstand (Distanzhülsen) **unter** die
Deckplatte, das andere Ende genauso **auf** die Bodenplatte – versetzt, so
dass die Zelle frei in der Mitte durchbiegt und die Platten sich nirgends
berühren. Der Pfeil auf der Zelle zeigt nach unten (Richtung der Last). Das
ist schon alles; ersatzweise eine 10-kg-Küchenwaage ausschlachten, dann sind
Plattform und Zelle fertig.

## Verdrahtung

| Wägezelle | HX711 | | HX711 | ESP32 |
| --- | --- | --- | --- | --- |
| rot | E+ | | VCC | 3V3 |
| schwarz | E- | | GND | GND |
| weiß | A- | | DT (DOUT) | GPIO 16 |
| grün | A+ | | SCK (PD_SCK) | GPIO 4 |

Die Pins stehen in `include/config.h`, falls andere passen. B+/B- am HX711
bleiben frei. Zählt die Waage beim Kalibrieren rückwärts, A+ und A-
tauschen (die Firmware rechnet es sonst selbst um).

## Flashen

1. VS Code mit der Erweiterung **PlatformIO IDE**, den Ordner `werkzeug/waage`
   öffnen.
2. `include/config.example.h` nach `include/config.h` kopieren: WLAN
   (2,4 GHz), Supabase-Adresse und anon-Schlüssel, Kanal (`waage`).
3. ESP32 per USB anstecken, unten in der Leiste **Upload** (Pfeil). Beim
   ersten Mal lädt PlatformIO den Compiler nach (ein paar Minuten).
4. **Serial Monitor** (Stecker-Symbol) öffnen, 115200 Baud.

Mit der Arduino IDE geht es auch: `src/main.cpp` als Sketch, Bibliothek
„HX711“ von bogde, Board „ESP32 Dev Module“.

## Kalibrieren (einmal)

Im seriellen Monitor (Enter nach jedem Befehl):

| Befehl | |
| --- | --- |
| `t` | Nullpunkt – nichts auf der Waage |
| `c 1000` | Kalibrieren – 1 kg Zucker drauf, dann der Befehl mit den Gramm |
| `r` | den rohen Wert zeigen |
| `?` | Stand: WLAN, Kalibrierung, letzter Wert, Zähler |

Beides bleibt im Flash des ESP32, auch ohne Strom. Die Waage tariert nie von
selbst – das macht die App bei jedem Schritt (`js/wiegen.js`); darum muss der
Nullpunkt nur grob stimmen.

## Supabase

- Adresse und anon-Schlüssel: `Project Settings → API` (`Project URL` und
  `anon public`). Beides in `config.h` **und** in der App unter
  Einstellungen → Waage – die App merkt es sich in `liste.json` für alle
  Geräte der Liste, das iPad hat es dann auch.
- Der Kanal ist ein Name (`waage`); wer Adresse, Schlüssel und Kanal kennt,
  kann mithören oder Gramm schicken – mehr nicht. Der anon-Schlüssel ist
  dafür gedacht, öffentlich zu sein.
- Gesendet wird per HTTPS an `/realtime/v1/api/broadcast/<kanal>/events/g`
  mit `{ "g": 123.4, "s": 1 }`; die App liest `g`. Solange sich in der
  letzten Minute etwas getan hat, kommen fünf Werte pro Sekunde (daran
  erkennt die App, wann ein Wert steht), danach nur noch einer alle
  10 Sekunden – ein Abend Kochen sind ein paar zehntausend Nachrichten, das
  kostenlose Kontingent sind zwei Millionen im Monat.
- In der App: Einstellungen → Waage → **Verbindung testen** zeigt, ob Werte
  ankommen.

## Wenn es klemmt

- **„HX711 antwortet nicht“:** DT/SCK vertauscht oder Wackelkontakt. `r`
  sollte einen Wert zeigen, der sich beim Drücken auf die Platte ändert.
- **Anzeige wandert:** heißer Topf ohne Untersetzer, oder die Platten
  berühren sich irgendwo. Die Zelle muss frei hängen.
- **„Waage aus“ in der App, obwohl sie an ist:** `?` im Monitor – WLAN da?
  Fehler beim Senden? 5-GHz-WLAN kann der ESP32 nicht.
- **Werte springen beim Schöpfen:** nicht auf dem Topf abstützen, den Löffel
  nicht anlehnen. Die App zählt nur, was still steht.
