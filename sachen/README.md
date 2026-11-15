# Sachen

Amys Sachen als eigene App: Listen für alles, was sie hat – Kleidung, Schuhe,
Make-up, Pflege, Schmuck, Taschen, Bücher –, je Sache mit Foto, Name, Marke,
Tags, Notiz und Strichcode. Sortieren, Suchen, „Hab ich das schon?“, Scannen
mit Nachschlagen (Open Beauty Facts & Co., Claude im Internet, das Bild der
Shopseite über die Supabase-Funktion `produkt-bild`), Scanner mit
Taschenlampe und Kamera-Suche, das Foto an die KI. Bis v82 war das der Teil
„Sachen“ in Amys Bereich von Boxenstopp (Daten in `liste.json` unter
`inventar`); seit v83 ist es diese App, weil Amy die Sachen als eigene App
wollte. Was die Sachen können, steht im README von Boxenstopp unter „Amys
Bereich“ → **Sachen**, der Umzug unter „Der Umzug der Sachen“.

**Adresse:** <https://finanzdienste.github.io/Boxenstopp/sachen/> – ein Ordner
in Boxenstopp, eine eigene App auf dem Home-Bildschirm (eigenes Manifest mit
`id` `/Boxenstopp/sachen/`, eigenes Symbol in Amys Rosa, eigener Service
Worker). Ohne Reiter unten, in Amys Thema (`<html data-tab="amy">`).

## Installieren

- **Android (Chrome):** die Adresse öffnen – Chrome teilt den Speicher mit
  Boxenstopp, die App ist also gleich verbunden. Dann ⋮ → „App installieren“
  (oder „Zum Startbildschirm hinzufügen“). Kommt ein kleines Fenster: dort
  ⋮ → „In Chrome öffnen“ (so sagt es auch der Knopf in Boxenstopp).
- **iPhone/iPad:** In Boxenstopp → Amys Bereich → „Sachen ist jetzt eine
  eigene App – öffnen“: Der Knopf öffnet Safari mit dem Link
  (`…/sachen/#zugang=…&fuer=Amy&ki=…`) und legt ihn in die Zwischenablage.
  In Safari Teilen → „Zum Home-Bildschirm“. Die App vom Home-Bildschirm hat
  einen eigenen Speicher: öffnen und **Einfügen** tippen – mit dem Namen im
  Link verbindet sie ohne Tippen. Safari sagt das nach dem Link selbst
  („Jetzt noch auf den Home-Bildschirm“, mit „Link kopieren“).
- Ohne Link: die Karte „Mit eurer Liste verbinden“ nimmt den Link oder den
  Schlüssel (`github_pat_…`) und den Namen. Nimmt GitHub den Schlüssel nicht
  mehr, steht sie wieder da („Der Schlüssel geht nicht mehr“). War auf dem
  Gerät vorher eine eigene Liste (ein Gast) verbunden, vergisst „Verbinden“
  erst, was von ihr noch offen ist (`githubVergessen`, wie Boxenstopp) –
  sonst schickte Boxenstopp im selben Browser es in eure `liste.json`.

Der Zugang ist derselbe wie in Boxenstopp (`boxenstopp.zugang.v1`), der
KI-Schlüssel auch (`boxenstopp.ki.v1`; ist einer für alle Handys freigegeben,
holt die App ihn aus `ki.json`). Ist auf dem Gerät schon ein anderer
Schlüssel, gilt der aus einem Link erst nach „Verbinden“. Ein Gast mit
eigener Liste (Marielle) hat seine Sachen weiter in Boxenstopp – die App
zeigt dann nur den Weg dorthin („Deine Sachen sind in Boxenstopp“, beim
Link einer eigenen Liste „Der Link gehört zu Boxenstopp“) und fragt GitHub
nichts.

## Daten

- **`sachen.json`** im privaten Repo Boxenstopp-Daten, neben `liste.json`:
  `{ version, rev, inventar: { listen, dinge }, weg }` (`js/sachen.js`). `rev`
  zählt jedes Schreiben um 1 hoch, JSON mit 1 Leerzeichen Einrückung, `weg`
  merkt sich Gelöschtes, damit eine alte Fassung es nicht zurückbringt.
- Abgeglichen wie `liste.json` (`js/speicher.js` `github()` mit `ART_SACHEN`):
  sofort sichtbar, ein Commit nach ~0,7 s, 409 → neu holen, alle 8 s
  nachsehen. Commits: „Amy: Sachen, 2 Änderungen“ – nie, was es ist, ohne
  „· Bescheid“ und „· To Do“ (keine Push-Nachricht).
- **Fotos** wie bisher unter `sachen/` im Daten-Repo („Amy: Foto für die
  Sachen“), auf dem Gerät im Vorrat `boxenstopp-sachen-v1` – den teilen sich
  Boxenstopp und diese App.
- **Umzug:** Nach dem ersten Abgleich je Start liest die App `liste.json`
  (nur lesen) und führt, was dort noch unter `inventar` steht, nach
  `sachen.json` zusammen – nach id, die neuere Fassung gewinnt, Gelöschtes
  bleibt gelöscht (`umzugAusListe`, Commit „Umzug: Sachen aus der Liste – 2
  Listen, 5 Sachen“, nur wenn etwas Neues dabei ist); kam etwas Neues, holt
  sie `sachen.json` gleich frisch. Geht der Umzug schief (`liste.json` nicht
  zu lesen, GitHub schreibt nicht), versucht sie es beim nächsten Abgleich
  noch einmal – frühestens nach einer Minute (wie Boxenstopp), nicht erst
  beim nächsten Start. Steht beim ersten Start noch nichts da, wartet die
  Ansicht auf Abgleich und Umzug (sonst legte ein Tipp auf einen Vorschlag
  eine Liste doppelt an). Ohne Netz zeigt sie, was das Gerät zuletzt kannte;
  kennt es noch nichts, steht statt der leeren Vorschläge „Ohne Netz – deine
  Sachen kommen, sobald das Handy wieder online ist.“ (kommt das Netz, wieder
  „Wird geladen…“, bis Abgleich und Umzug fertig sind). Aus `liste.json`
  heraus nimmt es nur Boxenstopp (erst `sachen.json`, dann „Umzug der Sachen
  nach sachen.json“). Beides geht beliebig oft ohne Schaden.
- Tobis Dashboard zeigt Amys Sachen aus `sachen.json` (dazu, was in
  `liste.json` noch nicht umgezogen ist), die Aktivität ihre Commits dort –
  zusammen mit denen an `liste.json` als eine Liste.

## Code

Kein eigener Code für die Sachen – die App lädt die Module von Boxenstopp
(`../js/`): `inventar.js` (rechnen), `ansicht-inventar.js` (zeichnen),
`inventar-ki.js`, `inventar-netz.js`, `scanner.js`, `foto.js`, `ki.js`,
`sachen.js`, `speicher.js`, `zugang.js`, `kern.js`, `bilder.js` (mit
`bildBasis('../')` gleich nach den Importen) und was diese wieder laden. Dazu
`../css/styles.css`. Hier liegen nur:

- `index.html` – Gerüst: Kopf mit Status, Amys Kopf, Karte, die Sachen, Fuß,
  Meldung (`#toast`), Scanner (`#scan-dlg`), iPhone-Popup (`#s-ios-dlg`);
  vor dem Modul das Skript für den ersten Besuch unter einem fremden Worker
  (siehe Service Worker).
- `app.js` – Zugang (Link, Formular, „Einfügen“), Abgleich, Umzug, geteilter
  KI-Schlüssel, Klicks an `ansicht-inventar.js`, Service Worker anmelden.
  Nach dem ersten Zeichnen `html[data-bereit="1"]` (darauf warten die
  Tests). Für die Tests: `__api`, `__takt` und `__umzugPause` im
  localStorage.
- `sachen.css` – nur, was die App zusätzlich braucht (Seite, Karte, Fuß).
- `sw.js`, `manifest.webmanifest`, `icon.svg` und die PNGs.

## Service Worker

`sw.js`, Bereich `/Boxenstopp/sachen/`, Vorrat `sachen-<VERSION>`. Die
Vorräte heißen „sachen-…“, weil Boxenstopps Worker beim Aktivieren alles mit
„boxenstopp-“ wegräumt, was nicht seins ist; dieser räumt nur alte
„sachen-…“ weg und fasst `boxenstopp-sachen-v1` (die Fotos) nie an.

**Eine Fassung ist immer ganz.** Die `SHELL` (die App, `../js/`, `../css/`,
`../schrift/`) und die eigene Seite (`./`, `./index.html` – egal, was hinter
`#` oder `?` steht) kommen nur aus dem Vorrat, solange sie dort liegen; fehlt
eine doch, aus dem Netz, und dann abgelegt. Erneuert wird im Hintergrund
nichts davon – früher („aus dem Vorrat, parallel erneuern“) stand nach einem
Deploy, solange der alte Worker lief, ein gemischter Stand im Vorrat, etwa
eine neue `../js/bilder.js` neben einer alten `app.js`. Andere Adressen unter
`sachen/`: erst Netz (höchstens 4 s), sonst der Vorrat, als Ersatz immer
`./index.html` dieser App; abgelegt ohne den Teil hinter `#` (darin steht der
Zugang). Die Bildchen (`BILDCHEN`, nicht in `SHELL`) kommen aus dem Vorrat
und werden parallel erneuert. GitHub, Datenbanken und Supabase gehen am
Worker vorbei.

**Updates** kommen nur mit einer neuen `VERSION`: Der Browser schaut bei
Seitenaufrufen nach `sw.js`, die App beim Start (`registration.update()`,
wenn schon der eigene Worker die Seite hielt) und wenn sie nach einer halben
Stunde wieder nach vorn kommt („aktualisieren“). Der neue Worker lädt die ganze `SHELL` frisch in seinen
eigenen Vorrat – fehlt dabei eine Datei, gilt das Update nicht, die alte
Fassung bleibt –, übernimmt gleich (`skipWaiting`, `claim`), räumt die alte
weg, und `app.js` lädt die Seite einmal neu (`controllerchange`, Sperre
`sachen.neugeladen` im sessionStorage).

**Erster Besuch.** Bis dieser Worker da ist, hält Boxenstopps die Seite (sein
Bereich `/Boxenstopp/` schließt `sachen/` ein). Er fasst unter `sachen/`
nichts an – ohne Netz bekommt die Seite nie Boxenstopps `index.html` –, gibt
aber `../js/` aus seinem eigenen Vorrat. Ist der älter als die Sachen-App
(ein Gerät mit Boxenstopp v79: `bilder.js` ohne `bildBasis`), passt der
Modulgraph nicht, und die App bliebe bei „wird geladen“ stehen. Darum steht
in `index.html` vor dem Modul ein kleines Skript: Hält ein fremder Worker die
Seite, meldet es gleich `sw.js` an und lädt einmal neu, sobald der eigene
übernimmt (Sperre `sachen.ersterBesuch` im sessionStorage) – mit dem Link
(`#zugang=…`), wie er kam, falls `app.js` ihn schon aus der Adresse genommen
hatte und das Verbinden noch unterwegs war. Ganz ohne Worker tut es nichts:
Dann kommt alles aus dem Netz und passt.

**`VERSION` in `sachen/sw.js` hochzählen, sobald sich eine Datei aus `SHELL`
ändert – auch eine geteilte unter `../js/` oder `../css/styles.css`** (dann
zählen `sw.js` von Boxenstopp und dieser hoch). `SHELL` nennt jedes Modul, das
`app.js` über seine Importe lädt; bekommt eins davon einen neuen Import,
gehört der auch hinein. Beides prüft `tests/test-sachen.mjs`: Es liest die
Importe aus dem Quelltext und bildet einen Abdruck (SHA-256) über alle
Dateien aus `SHELL` und die Bildchen. Der gemerkte Stand steht in
`tests/daten/sachen-fassung.json` (`{ "version", "abdruck" }`); ändert sich
eine Datei, ohne dass `VERSION` hochzählt, schlägt der Test fehl und nennt
die neuen Werte zum Eintragen. `VERSION` zählt nur hoch (`vN` als Zahl):
Ist sie kleiner als die gemerkte oder gleich groß (`v01` statt `v1`),
schlägt er fehl und schlägt nie vor, die gemerkte zurückzusetzen – eine
Fassung, die die Handys schon haben, bekämen sie nicht noch einmal.

## Test

`tests/test-sachen.mjs` (läuft mit den anderen: `node tests/lauf.mjs sachen`)
spielt die App gegen die nachgebaute GitHub-API durch – unter
`http://127.0.0.1:8099/sachen/index.html`, nur mit erfundenen Daten. Für
„ohne Netz“ startet er einen eigenen Server auf Port 8137 und schaltet ihn
ab (Playwrights Offline-Schalter trifft den Service Worker nicht) – mit
beiden Workern, auch über ein Update von Boxenstopp; dazu ein Deploy,
während der Worker läuft (ohne neue `VERSION` bleibt die alte Fassung ganz,
mit neuer kommt die neue ganz und die Seite lädt einmal neu), der erste
Besuch unter Boxenstopps Worker von v79 (`git archive 382449e`, in einem
flachen Checkout erst geholt) und unter dem heutigen mit einem Link, dessen
Verbinden beim Neuladen noch unterwegs war. Im Browser außerdem: ein Umzug,
der erst beim dritten Versuch klappt, der erste Start ohne Netz und
„Verbinden“ nach einem Gast. Die Seite öffnet dort
`handy(browser, { adresse: SACHEN_URL })` aus `tests/hilfe.mjs` (wartet auf
`html[data-bereit]`). Den Umzug von Boxenstopps Seite aus – ältere
Fassungen, Fehlschlag, Gast, Sachen nur auf dem Gerät, Knopf und Hinweis in
Amys Bereich – prüft `tests/test-umzug.mjs`.
