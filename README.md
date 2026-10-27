# Boxenstopp

Meal-Prep-Rezepte für je 8 Boxen und eine gemeinsame Einkaufsliste – als App
fürs Handy, für Tobi und seine Freundin.

**Adresse:** <https://finanzdienste.github.io/Boxenstopp/>
(in Chrome öffnen, dann Menü ⋮ → „App installieren“; auf dem iPhone in
Safari: Teilen → „Zum Home-Bildschirm“).

Zwei Reiter:

| Reiter | Inhalt |
| --- | --- |
| **Rezepte** | 50 Rezepte als Boxen mit Kreppband und ehrlicher Gesamtzeit, Suchfeld (Name, Zutat, Gericht), Filter (Hähnchen, Rind, Pute, Reis, Nudeln, Kartoffel & Co., Bulgur & Co., unter 1½ Std., auf der Liste). Im Rezept: Nährwerte pro Box gegen das Ziel, Zutaten mit Packungsgrößen, **Zubereitung als Mise en place** (siehe unten), „Bildschirm anlassen“, Portionsrechner (Topf leer/voll → Gramm pro Box), Aufbewahren, Tipps, die ganze Nährwertrechnung. **Daumen** hoch, zur Seite oder runter: einer pro Gericht für euch beide, mit Namen, wer zuletzt gedrückt hat; steht auch auf der Box, Filter „Daumen hoch“ |
| **Einkaufsliste** | In Einkaufsreihenfolge: **Frisches** → **Tierisches** (erst Fleisch, dann Milchprodukte) → **Trockenes** (auch Konserven und TK) → **Gewürze** → **Extras** (Haushalt wie Backpapier oder Döschen, nur wenn nötig). Gleiche Zutaten aus mehreren Rezepten stehen in einer Zeile und werden addiert (Reis 280 g + 240 g = 520 g), mit Herkunft und Packungshinweis. Abhaken, eigene Einträge, löschen mit Rückgängig, Erledigtes weg, Frühstück für 7 Tage. **Liste kopieren** gibt alles Offene als Text aus, Bereich für Bereich („Frisches:“, „300 g Zwiebeln (≈ 3 Stück)“ …) – zum Einfügen in eine andere Einkaufsliste |

Jedes Rezept ergibt 8 Boxen. Ziel pro Box: **443 kcal, 33 g Protein, 39 g KH,
15,4 g Fett**; alle Rezepte liegen bei 434–453 kcal. Kein Fisch, kein Schwein,
kein Putenhack.

### Zubereitung

Jedes Rezept läuft in drei Abschnitten, jeder mit seiner Zeit:

1. **Vorbereiten** – alles schneiden, abwiegen und abmessen, bevor der Herd
   angeht. Es landet in nummerierten Schalen („→ Schale 2“); oben steht, welche
   Schalen (klein, mittel, groß) und Töpfe bereitstehen sollen. Fleisch kommt
   zuletzt aufs Brett, danach wird abgewaschen.
2. **Kochen** – nur noch „Schale 2 dazu“. Die Schale erscheint im Schritt als
   Schild mit Nummer und Inhalt. Was in einer langen Wartezeit nebenbei geht
   (Reis, Kartoffeln schälen, während das Gulasch schmort), steht eingerückt
   als „währenddessen“ darunter.
3. **Portionieren** – wiegen, durch 8, Boxen füllen, Döschen kalt stellen.

Ein Schritt ist eine Handlung und eine Zeile zum Abhaken, rechts mit seinen
Minuten. Der nächste offene Schritt ist markiert. **Die Minuten antippen
startet einen Timer** (über die Wartezeit, wenn es eine gibt: „2 Min. + 22
warten“ → 22), mehrere nebeneinander; sie laufen oben unter der Kopfzeile
mit, überleben ein Neuladen und melden sich mit Ton, Vibration und
Benachrichtigung (`js/timer.js`, nur auf dem Handy, das kocht). Unter den
Daumen stehen **Notizen** zum Rezept („nächstes Mal weniger Chili“), für
beide, in `liste.json` unter `notizen`. Die Zeiten sind für ein
ruhiges Tempo zu Hause gerechnet, mit Waschen, Schälen und Abfall wegräumen
(Normen in `NORM`, werkzeug/rezepte.py), und `js/zeiten.js` rechnet daraus
Abschnitte und Gesamtzeit: Wartezeiten (`ruhe`, etwa Marinieren) laufen im
Hintergrund weiter, „währenddessen“ kostet keine zusätzliche Zeit.

### Kosten

Jedes Rezept zeigt, was es ungefähr kostet – auf der Karte pro Box, im
Rezept gesamt und pro Box, auf der Einkaufsliste die Summe aller Einträge.
Grundlage sind **Richtpreise** je Katalogzutat (`werkzeug/preise.py`:
Discounter-Niveau, Stand im Kopf der Datei; Fleisch an Aldi-Preisen
geeicht), gerechnet auf die **verwendete Menge**, nicht auf ganze Packungen,
Gewürze pauschal nach Gramm. `werkzeug/rezepte.py` schreibt sie je Rezept
(`kosten`) und je Zutat (`eur`) nach `daten/rezepte.json`, dazu `preise`
(Euro je Gramm je Schlüssel) für die Liste und für Rezepte aus der
Resteverwertung (`js/kosten.js`; Zutaten ohne Richtpreis → „mindestens“).

### Angebote der Woche

Dritter Reiter (auf dem Handy unten, am Rechner über die Karte bei den
Rezepten). Einen offiziellen, kostenlosen Datenfeed mit den Angeboten von
Aldi, Lidl, Rewe und Kaufland gibt es nicht – die Prospektseiten wollen
nicht automatisch abgegrast werden, und die inoffiziellen Schnittstellen
brauchen Schlüssel aus deren Webseiten. Deshalb kommen die Angebote so rein:
**Prospektseite fotografieren oder Screenshot aus der Supermarkt-App**, die
KI (derselbe Schlüssel wie bei der Resteverwertung) liest Laden, Produkt,
Preis, Packung und Gültigkeit aus (`js/angebote.js`: eigenes Schema,
Katalog-Schlüssel je Angebot) – oder **eine getippte Zeile je Angebot**
(„Aldi Hähnchenbrustfilet 1 kg 7,49“), die liest die App selbst, ohne KI.
Die Angebote liegen in `liste.json` unter `angebote` (für beide, mit Name
und Datum), abgelaufene verschwinden von selbst.

Darunter **„Passt zu euren Rezepten“**: die Rezepte, deren Zutaten im
Angebot sind, mit der Ersparnis pro Box gegen die Richtpreise, antippen
öffnet das Rezept. Und **„Neues Rezept aus den Angeboten“**: die
Resteverwertung im Modus „angebote“ – die KI baut ein Rezept um die
Angebote herum (alles zu kaufen, nichts „vorhanden“), die App rechnet es
auf die Ziele, „Neuer Vorschlag“ bringt das nächste.

### Belohnung

Ist Vorbereiten oder Kochen komplett abgehakt, kommt unten ein Satz („Mise
en place steht – ab jetzt wird's entspannt“), ebenso beim letzten Haken auf
der Einkaufsliste. **Fällt das letzte Häkchen eines Rezepts** (oder „Heute
gekocht“), läuft ein Tier auf den Bildschirm: ein echtes Foto oder ein kurzer
Clip aus freien Quellen ohne Schlüssel (random.dog – auch Videos –, dog.ceo,
thecatapi, cataas, randomfox, bunnies.io, capy.lol), dazu Konfetti,
Vibration, ein kurzes Klingeln und ein Spruch aus rund 55 (`js/lob.js`).
Tier und Spruch wechseln: Was zuletzt dran war, merkt sich das Handy, dasselbe
Rezept wird frühestens nach 8 Stunden wieder belohnt. „Noch ein Tier“ holt
das nächste. Das Tier wird vorgeladen, sobald ein Rezept offen ist; ohne
Netz kommt ein gemaltes. Im Datensparmodus gibt es nur Fotos, keine Clips.

## Resteverwertung

Oben im Reiter Rezepte: aufschreiben oder fotografieren, was im Kühlschrank
und im Vorrat liegt (bis zu 4 Fotos), Portionen wählen (2, 4, 6 oder 8),
sagen, ob dazugekauft werden darf, und Wünsche. Die KI macht daraus **ein**
Rezept im selben Format wie alle anderen – Mise en place mit Schalen, ein
Schritt pro Zeile, Minuten – und mit denselben Regeln: kein Fisch, kein
Schwein, kein Putenhack, kein Hüttenkäse in warmen Saucen, ordentlich
gewürzt. Was ihr mit Daumen hoch oder runter bewertet habt, geht als
Geschmackshinweis mit.

**Damit die Werte wirklich stimmen**, rechnet die App selbst
(`js/ki-rezept.js`): Die KI liefert zu jeder Zutat die Nährwerte pro 100 g und
für Fleisch, Reis, Nudeln, Öl, Käse usw. einen Bereich (min–max, bei
Vorhandenem höchstens, was da ist). Die App verschiebt diese Mengen, bis eine
Box möglichst genau auf 443 kcal / 33 g P / 39 g KH / 15,4 g F kommt
(kleinste gewichtete Abweichung, Fett zählt 1,5-fach), rundet auf schöne
Mengen und setzt sie in die Schritte ein – Claude schreibt Mengen dort als
Platzhalter `{reis}`. Die Leiste über dem Rezept zeigt, was verschoben wurde
(„Basmatireis 250 → 280 g“), und warnt, wenn das Ziel mit dem, was da ist,
nicht erreichbar ist.

Ein Vorschlag steht erst nur auf diesem Handy. **Behalten** legt ihn in
`liste.json` unter `ki` ab, dann sehen ihn beide (Filter „Resteverwertung“,
höchstens 12, das älteste fällt raus). Wer etwas davon auf die Liste setzt,
einen Daumen gibt oder „Heute gekocht“ drückt, behält ihn automatisch. Auf
die Liste kommt nur, was fehlt; Zutaten, die es im Katalog mit derselben
Einheit gibt, teilen sich die Zeile mit den festen Rezepten.

### Rezept anpassen

Im Rezept „Anpassen“: Jede Zutat mit Menge, Schloss und ✕. Nur 200 g Brokkoli
da statt 1 kg? Menge eintippen – was man anfasst, ist fest (🔒). TK-Erbsen
dazu? Aus der Liste wählen, Gramm eintippen. „Auf Ziel rechnen“ schiebt die
freien Zutaten (Fleisch, Reis, Öl, Käse …), bis die Box wieder bei
443 / 33 / 39 / 15,4 liegt; die Werte stehen live darunter. „Speichern, für
beide“ legt das Ergebnis als eigenes Rezept ab („… (angepasst)“, Filter
„Eigene“, Leiste „Angepasst von …“ mit den Änderungen in Worten). Die
Schritte bekommen die neuen Mengen, weggelassene Zutaten sind in ihren
Schritten durchgestrichen, eine neue Zutat bekommt eine eigene Schale und
einen Schritt im Vorbereiten.

Dafür tragen die festen Rezepte je Zutat `pro100`, `g`, `anpassbar`, `min`
und `max` (aus `werkzeug/naehrwerte.py`, Zuordnung `NK`, Gramm je Einheit
`EINHEIT_G`, verschiebbare Zutaten `ANPASSBAR`), die Nährwerttabelle ist
daraus gerechnet (plus `pauschal` für Gewürze und Brühpulver), und
`daten/rezepte.json` hat unter `naehrwerte` die Werte aller Katalogzutaten –
auch von denen, die in keinem Rezept vorkommen (Erbsen, Kichererbsen,
Blumenkohl …). Die Mengen in den Schritten stehen als Platzhalter
(`{brokkoli} Brokkoli in Röschen teilen`), `werkzeug/rezepte.py` setzt sie
beim Erzeugen (`platzhalter()`, nur wenn der Name der Zutat danebensteht),
die App beim Anzeigen (`platzhalter()` in `js/format.js`). `festAlsKi()`
bringt ein festes Rezept ins KI-Format, dann rechnet dieselbe
`mengenAnpassen()` wie für die Resteverwertung.

### Einrichten

Die App ruft die KI direkt vom Handy aus auf (`js/ki.js`), mit einem
API-Schlüssel, den der Anfang des Schlüssels einem Anbieter zuordnet:

| Schlüssel | Anbieter, Modell | Kosten | Antwort |
| --- | --- | --- | --- |
| `AQ.…` (älter: `AIza…`) | Google, `gemini-3.8-flash` über die Interactions-API (`/v1beta/interactions`, `store: false`) | kostenlos, ohne Kreditkarte; dafür darf Google die Anfragen zum Verbessern seiner Produkte nutzen | JSON mit `response_format` und Schema |
| `sk-ant-…` | Anthropic, `claude-sonnet-5-5` (Messages-API) | ein paar Cent pro Rezept, Guthaben nötig | Werkzeug `rezept_ausgeben` |

Der normale Weg ist Google: auf
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) mit dem
Google-Konto anmelden, „Create API key“, den Schlüssel in der App unter
Resteverwertung einfügen. Beide Antworten werden gestreamt, die Leiste zeigt
Modell und Kosten der Anfrage.

Der Schlüssel steht nur im localStorage (`boxenstopp.ki.v1`), nirgends im Code
oder im Repo. Aufs zweite Handy kommt er mit dem Link unter der Einkaufsliste
(`…#zugang=<GitHub>&ki=<KI>`) oder mit „Link fürs zweite Handy kopieren“ im
Einrichten. Fotos werden vorher auf 1280 px verkleinert und gehen nur mit der
einen Anfrage an den Anbieter, gespeichert werden sie nicht.

## Die gemeinsame Liste

GitHub Pages kann Dateien nur ausliefern, nicht speichern. Die Liste liegt
deshalb als `liste.json` im **privaten** Repo
[Finanzdienste/Boxenstopp-Daten](https://github.com/Finanzdienste/Boxenstopp-Daten).
Die App liest und schreibt sie über die GitHub-API mit einem Schlüssel, der
nur dieses eine Repo darf. Ohne Schlüssel läuft die App auch – dann liegt die
Liste nur auf dem einen Handy („Nur lokal“).

### Einmal einrichten

1. Repo **Boxenstopp-Daten** anlegen: privat, mit README.
2. Schlüssel anlegen: GitHub → Settings → Developer settings → Personal access
   tokens → **Fine-grained tokens** → Generate new token.
   - Repository access: *Only select repositories* → nur **Boxenstopp-Daten**
   - Permissions → Repository permissions → **Contents: Read and write**
   - Ablauf so lange wie möglich
3. In der App: Einkaufsliste → **Einrichten** → Name und Schlüssel → Verbinden.
   Was schon lokal auf der Liste stand, kommt mit.
4. Zweites Handy: unter der Liste **„Link fürs zweite Handy kopieren“** (oder
   „Per WhatsApp schicken“). Der Link öffnet die App mit eingetragenem
   Schlüssel, dort fehlt nur noch der Name.
   - iPhone: Eine App auf dem Home-Bildschirm hat dort einen eigenen Speicher.
     Erst zum Home-Bildschirm hinzufügen, die App von dort öffnen und den
     ganzen Link ins Schlüsselfeld einfügen.

Der Schlüssel steht nur im Speicher der beiden Handys, nirgends im Code. Wer
den Link hat, kann die Liste ändern – mehr nicht. Ist er abgelaufen oder
verloren: in GitHub löschen, neuen anlegen, in der App neu eintragen (die
App zeigt dann „Schlüssel prüfen“ und behält, was noch nicht gespeichert ist).

### Wie der Abgleich funktioniert (js/speicher.js)

- Jede Änderung ist ein kleines Objekt aus `js/liste.js` („Teil dazu“,
  „abhaken“, „löschen“ …). Sie wird sofort angezeigt und vorgemerkt – auch
  im localStorage, damit offline nichts verloren geht.
- Nach ~0,7 s geht alles Vorgemerkte als **ein** Commit nach GitHub, mit der
  sha der Datei, auf die es sich bezieht.
- War das andere Handy schneller, antwortet GitHub mit 409. Die App holt den
  neuen Stand und wendet ihre Änderungen darauf noch einmal an. Abhaken nennt
  dabei die Teile, die beim Tippen da waren: Hat das andere Handy inzwischen
  Chili-Reis dazugelegt, bleibt der Reis offen.
- Solange die App offen ist, schaut sie alle 8 s nach (mit ETag, ein 304
  kostet nichts), und sofort, wenn man zurück in die App kommt.
- `rev` zählt jeden Commit hoch. Eine Antwort mit kleinerem `rev` ist eine
  veraltete Kopie von GitHub und wird ignoriert.

### `liste.json`

```json
{
 "version": 1,
 "rev": 12,
 "items": {
  "reis": {
   "name": "Basmati- oder Jasminreis", "cat": "trocken",
   "parts": {
    "butter-chicken": { "q": 280, "u": "g", "h": "", "done": false },
    "teriyaki": { "q": 240, "u": "g", "h": "", "done": true }
   },
   "custom": false, "checked": false, "by": "Amy", "at": "2026-10-26T17:05:00.000Z", "added": "…"
  },
  "c-mh8k2x1abcd": { "name": "Bananen", "cat": "obst", "parts": {}, "custom": true, "checked": false, "by": null, "at": "…", "added": "…" }
 },
 "cooked": { "chili": { "at": "2026-10-26", "by": "Tobi" } },
 "bewertung": { "chili": { "wert": "hoch", "by": "Amy", "at": "2026-10-26T19:10:00.000Z" } },
 "ki": { "ki-mh9x2k1a7f": { "r": { "name": "Hähnchen-Reispfanne mit Feta", "portionen": 8, "zutaten": […], "ablauf": […], "…": "…" }, "by": "Amy", "at": "…" } },
 "notizen": { "chili": [{ "id": "n-mh9x…", "text": "Nächstes Mal weniger Chili", "by": "Amy", "at": "…" }] },
 "angebote": { "stand": "…", "von": "Tobi", "eintraege": [{ "id": "a-mh9x…", "laden": "Aldi", "name": "Hähnchenbrustfilet", "preis": 7.49, "menge": 1, "einheit": "kg", "bis": "2026-11-01", "k": "haehnchenbrust" }] }
}
```

Schlüssel aus dem Katalog (`reis`, `haehnchenbrust` …) sorgen dafür, dass
Rezepte sich eine Zeile teilen. Eigene Einträge heißen `c-…`. Ein Teil hat
entweder eine Menge (`q`, `u`, Packungshinweis `h`) oder einen Text (`t`,
z. B. „2 EL“ bei Vorrat und Gewürzen). Erledigt ist eine Zeile, wenn alle
Teile `done` sind (eigene Einträge: `checked`). `by` ist der Name aus dem
Einrichten. `bewertung` hat pro Gericht einen Daumen (`hoch`, `mittel`,
`runter`) – wer zuletzt drückt, überschreibt ihn für beide. Unter `ki` liegen
die behaltenen Rezepte aus der Resteverwertung im KI-Format (ki-rezept.js);
ihre Zutaten stehen auf der Liste unter dem Katalog-Schlüssel oder als
`ki-<zutat>`. `angebote` sind die Angebote der Woche (höchstens 120), `k`
ist der Katalog-Schlüssel der Zutat, wenn es eine ist. Von Hand bearbeiten
geht, die App bereinigt beim Lesen alles, was nicht passt.

## Rezepte ändern

Die Rezepte stehen in `werkzeug/rezepte.py`, die Werte pro 100 g in
`werkzeug/naehrwerte.py`:

```sh
python3 werkzeug/rezepte.py      # schreibt daten/rezepte.json und zeigt kcal/P/KH/F pro Box
node tests/test-rezepte.mjs      # prüft Grenzen, Katalog und Einheiten
```

Mengen in Supermarkt-Packungen denken (400 g Hähnchen, 500 g Hack, Dosen,
Becher), 8 Portionen, ordentlich gewürzt. Jede Zutat der Einkaufsliste
braucht einen Schlüssel im Katalog `CAT`, und ein Schlüssel hat in allen
Rezepten dieselbe Einheit – sonst lassen sich Mengen nicht addieren. Die
Nährwerte kommen je Zutat aus `naehrwerte.py` (Schlüssel wie im Katalog oder
über `NK`); was nicht in Gramm gekauft wird, bekommt über `EINHEIT_G` Gramm
je Dose, Stück, Zehe. Weicht die verwendete Menge ab (Kartoffeln geschält,
halbe Zitrone), steht `g=` an der Zutat; Gewürze und Brühpulver sind
`pauschal`. Eine neue Zutat braucht also `CAT` und `N`.

Im Vorbereiten steht jede Zutat mit ihrer Menge („3 Zwiebeln (300 g) schälen
und fein würfeln → Schale 1“); beim Kochen wird nichts mehr abgewogen,
abgemessen oder ausgepresst – außer eine Zutat geht als ganze Packung in den
Topf („500 g Rinderhack“). tests/test-rezepte.mjs prüft das, dazu: jede Schale
wird gefüllt, bevor sie gebraucht wird, die Nummern folgen der Reihenfolge
beim Kochen, jedes Gewürz kommt in den Schritten vor, „währenddessen“ passt
in die Zeit daneben, und die Zeiten aus Python und `js/zeiten.js` stimmen
überein. Das Skript selbst bricht ab, wenn eine Schale fehlt oder nie
gebraucht wird. Die App hebt Mengen mit Einheit automatisch hervor. Verbrauchsmaterial (Backpapier,
Döschen, Spieße) kommt mit `H(...)` ins Rezept und steht dann unter
„Extras“. Die Abteilung im Katalog entscheidet den Bereich der Liste:
`obst` → Frisches, `fleisch`/`kuehl` → Tierisches,
`trocken`/`konserven`/`vorrat`/`tk` → Trockenes, `gewuerz` → Gewürze,
`haushalt` → Extras (js/bereiche.js).
`daten/rezepte.json` steht nicht im Offline-Vorrat von `sw.js`: Für ein
neues Rezept muss dort nichts geändert werden.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html`, `css/styles.css` | Gerüst und Aussehen, Schriften in `schrift/` (OFL bzw. Apache 2.0, Lizenzen daneben) |
| `js/app.js` | Start, Speicher wählen, Klicks verteilen, Service Worker |
| `js/kern.js` | gemeinsamer Zustand, Meldung unten, Reiter |
| `js/liste.js` | die Liste als Daten und alle Änderungen – ohne DOM, in Node getestet |
| `js/bereiche.js` | Bereiche in Einkaufsreihenfolge und der Text zum Kopieren |
| `js/speicher.js` | lokal oder GitHub, Abgleich, Konflikte, offline |
| `js/zugang.js` | Schlüssel und Name, Einladungslink |
| `js/ansicht-rezepte.js`, `js/ansicht-liste.js` | die beiden Reiter |
| `js/format.js` | Mengen, Zahlen, Abteilung raten |
| `js/zeiten.js` | Zeiten aus den Schritten: Abschnitte, Gesamtzeit, „währenddessen“ |
| `js/timer.js` | Küchentimer: starten, Leiste oben, Alarm, überlebt Neuladen |
| `js/lob.js` | Belohnung: Sprüche, Tierquellen, Vorladen, Overlay mit Konfetti |
| `js/kosten.js` | Richtpreise auf Mengen: Liste, eigene Rezepte, Euro-Format |
| `js/angebote.js` | Angebote: Zeilen lesen, Schlüssel raten, Treffer und Ersparnis, Anfrage an die KI – ohne DOM |
| `js/ansicht-angebote.js` | Reiter Angebote: Fotos, Eingabe, Liste, passende Rezepte, Rezept daraus |
| `werkzeug/preise.py` | Richtpreise je Katalogschlüssel (Packung, Menge, Einheit) |
| `js/ki.js` | Resteverwertung: Auftrag an die KI, Anfrage für Gemini oder Claude, Antwortstrom lesen, Fehler |
| `js/ki-rezept.js` | Resteverwertung: Antwort prüfen, Mengen auf die Ziele rechnen, als Rezept der App – ohne DOM |
| `js/ansicht-ki.js` | Resteverwertung: Formular, Fotos, Fortschritt, Leiste im Rezept, Behalten |
| `js/ansicht-anpassen.js` | Rezept anpassen: Mengen, Zutaten tauschen, auf Ziel rechnen, als eigenes Rezept speichern |
| `sw.js` | Offline-Betrieb; `VERSION` hochzählen, wenn sich eine Datei aus `SHELL` ändert |

## Tests

```sh
npm ci
npx playwright install chromium
npm test            # alle; npm test -- sync  nur test-sync
npm run lint
```

`test-sync.mjs` spielt zwei Handys gegen eine nachgebaute GitHub-API durch
(Einrichten, Link, Abhaken beim anderen, gleichzeitiges Schreiben, veraltete
Antwort, offline, falscher Schlüssel, Trennen). `test-ki.mjs` prüft die
Resteverwertung erst ohne Browser (Antwort bereinigen, verbotene Zutaten,
Mengen aufs Ziel, Anfragen und Antwortströme beider Anbieter, Fehler) und
dann mit einer nachgebauten Gemini-API und zwei Handys – Beispielantwort in
`tests/daten/ki-antwort.json`. Der Workflow „Prüfung“ lässt
Linter und alle Tests bei jedem Push laufen.
