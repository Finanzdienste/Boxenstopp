# Boxenstopp

Meal-Prep-Rezepte für je 8 Boxen und eine gemeinsame Einkaufsliste – als App
fürs Handy, für Tobi und seine Freundin.

**Adresse:** <https://finanzdienste.github.io/Boxenstopp/>
(in Chrome öffnen, dann Menü ⋮ → „App installieren“; auf dem iPhone in
Safari: Teilen → „Zum Home-Bildschirm“).

Zwei Reiter:

| Reiter | Inhalt |
| --- | --- |
| **Rezepte** | 16 Rezepte als Boxen mit Kreppband, Filter (Hähnchen, Rind, Pute, Veggie, Reis, Nudeln, Kartoffel & Co., bis 45 Min., auf der Liste). Im Rezept: Nährwerte pro Box gegen das Ziel, Zutaten mit Packungsgrößen, Schritte zum Abhaken – jede Menge steht direkt im Schritt und ist hervorgehoben („800 g Hähnchenbrust in Würfel schneiden“), damit man nicht nach oben scrollen muss –, „Bildschirm anlassen“, Portionsrechner (Topf leer/voll → Gramm pro Box), Aufbewahren, Tipps, die ganze Nährwertrechnung. **Daumen** hoch, zur Seite oder runter: einer pro Gericht für euch beide, mit Namen, wer zuletzt gedrückt hat; steht auch auf der Box, Filter „Daumen hoch“ |
| **Einkaufsliste** | In Einkaufsreihenfolge: **Frisches** → **Tierisches** (erst Fleisch, dann Milchprodukte) → **Trockenes** (auch Konserven und TK) → **Gewürze** → **Extras** (Haushalt wie Backpapier oder Döschen, nur wenn nötig). Gleiche Zutaten aus mehreren Rezepten stehen in einer Zeile und werden addiert (Reis 280 g + 240 g = 520 g), mit Herkunft und Packungshinweis. Abhaken, eigene Einträge, löschen mit Rückgängig, Erledigtes weg, Frühstück für 7 Tage. **Liste kopieren** gibt alles Offene als Text aus, Bereich für Bereich („Frisches:“, „300 g Zwiebeln (≈ 3 Stück)“ …) – zum Einfügen in eine andere Einkaufsliste |

Jedes Rezept ergibt 8 Boxen. Ziel pro Box: **443 kcal, 33 g Protein, 39 g KH,
15,4 g Fett**; alle Rezepte liegen bei 434–453 kcal.

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
 "bewertung": { "chili": { "wert": "hoch", "by": "Amy", "at": "2026-10-26T19:10:00.000Z" } }
}
```

Schlüssel aus dem Katalog (`reis`, `haehnchenbrust` …) sorgen dafür, dass
Rezepte sich eine Zeile teilen. Eigene Einträge heißen `c-…`. Ein Teil hat
entweder eine Menge (`q`, `u`, Packungshinweis `h`) oder einen Text (`t`,
z. B. „2 EL“ bei Vorrat und Gewürzen). Erledigt ist eine Zeile, wenn alle
Teile `done` sind (eigene Einträge: `checked`). `by` ist der Name aus dem
Einrichten. `bewertung` hat pro Gericht einen Daumen (`hoch`, `mittel`,
`runter`) – wer zuletzt drückt, überschreibt ihn für beide. Von Hand bearbeiten geht, die App bereinigt beim Lesen alles, was
nicht passt.

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
Rezepten dieselbe Einheit – sonst lassen sich Mengen nicht addieren.

In den Schritten steht jede Zutat mit ihrer Menge („500 g Putenhack dazugeben“,
„die Zwiebeln (300 g)“); der Test prüft das für alle Grammangaben. Die App
hebt Mengen mit Einheit automatisch hervor. Verbrauchsmaterial (Backpapier,
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
Antwort, offline, falscher Schlüssel, Trennen). Der Workflow „Prüfung“ lässt
Linter und alle Tests bei jedem Push laufen.
