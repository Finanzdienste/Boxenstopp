# Hinweise für Claude

Antworte auf Deutsch, kurz und direkt. Was die App kann und wie sie gebaut
ist, steht in der README.md – vor größeren Änderungen dort nachlesen.

## Ultracode-Empfehlung
Bevor du mit einer Aufgabe anfängst: Wenn sie sich für einen Workflow eignet
(dieselbe Arbeit über viele Dateien, eine Prüfung über das ganze Projekt oder
eine Aufgabe, die zu groß für einen einzelnen Agenten ist), schlag mir in einem
Satz vor, sie mit „ultracode“ laufen zu lassen, und warte auf meine Antwort.
Bei normalen Aufgaben erwähnst du Ultracode nicht.

## Modell und Aufwand – immer konkret
Tobi, 16.11.2026: „Sowas sollst du immer konkret mit angeben“ – und: „So eine
nachricht gibst du mir irgendwie nur in diesen chat, nicht in den anderen.“
Was gerade läuft, zeigt `get_session` (`model`, `effort_level`,
`flag_settings.ultracode`).
- **Nur melden, wenn etwas zu ändern ist** (Tobi, 26.11.2026: „Dass Opus okay
  ist brauch ich nicht zu wissen, ich brauch nur zu wissen wenn was geändert
  werden muss“): Kein Schlusssatz mehr wie „passt – nichts umstellen“. Sollte
  etwas umgestellt werden (Modell, Aufwand, neuer Chat), am Ende ein Satz mit
  Grund und dem genauen Befehl.
- **Neuer Chat** (Tobi, 26.11.2026: „in allen Chats bescheid geben wenn ein
  neuer Chat nötig ist“): von selbst in einem Satz sagen, sobald einer nötig
  ist – wenn `get_session` mehr als etwa 80 % von `context_usage.max_tokens`
  belegt zeigt, wenn du merkst, dass du mit veraltetem oder widersprüchlichem
  Stand arbeitest, oder bei einem anderen Projekt. Ein neues Thema im selben
  Projekt und ein schon zusammengefasster Verlauf allein sind kein Grund
  (Tobi, 26.11.2026: „dass hier Infos zusammengefasst wurden ist schlechter
  als bei nem neuen chat komplett von 0 zu beginnen?“ – nein). Vorher alles Offene in die Dateien schreiben und einen kurzen
  Starttext zum Einfügen mitgeben.
- Rätst du von etwas ab (Ultracode, ein anderes Modell), sag, was stattdessen
  gilt.
- **Mehr** – vorschlagen und auf meine Antwort warten: `/model fable` mit
  `/effort high`, wenn eine Ursache nach dem ersten Durchgang unklar bleibt
  oder ein Fehler nach einer Korrektur wiederkommt. Fable kostet kein Nutzungsguthaben (Tobi, 26.11.2026; Guthaben kostet nur
  die Claude-API). Ist der Aufwand gerade gesenkt, zuerst zurück auf
  `/effort max`.
- **Weniger** – erledigen und am Ende sagen: Für reine Texte, README und
  Daten reicht `/effort high` (oder `medium`); für eine einzelne schwere Frage
  genügt dann „ultrathink“ in meiner Nachricht.
- Lieber den Aufwand senken als das Modell wechseln, und nicht hin und her:
  Nach einem Modellwechsel wird der ganze Verlauf ohne Zwischenspeicher neu
  gelesen.
- `/fast` (dasselbe Modell schneller, kostet Guthaben extra) nur, wenn ich auf
  etwas warte, das eilt.

## Offline zuerst
Tobi, 22.11.2026: „Generell sollen all meine Apps auch so weit wie möglich
offline funktionieren.“ Das gilt für jede Änderung und jede neue Funktion:
- Was ohne Netz gehen kann, geht ohne Netz: App-Hülle und zuletzt geladene
  Daten liegen im Vorrat von `sw.js`, ebenso Bilder und Kartenkacheln, die
  man schon gesehen hat.
- Änderungen ohne Netz werden lokal gemerkt und von selbst nachgeschickt –
  beim Ereignis `online`, beim nächsten Abgleich und beim nächsten Start.
  Nichts geht verloren, nichts kommt doppelt an, und was sich inzwischen
  anderswo geändert hat, wird zusammengeführt statt überschrieben.
- Was nur mit Netz geht, wird ohne Netz vorgemerkt und läuft von selbst,
  sobald Netz da ist – Tobi, 22.11.2026: „sowas wie mails senden könnte er sich
  doch vormerken und dann machen sobald er internet hat“. Also Mails senden,
  KI-Aufträge und Ähnliches: sichtbar „wartet auf Netz“ (mit „Nicht senden“),
  vor dem Ausführen gegen den neuesten Stand geprüft, nie doppelt. Braucht es
  eine Anmeldung, die nur nach einem Tipp aufgeht (Google), reicht dann ein Tipp.
  Nur was sich nicht vormerken lässt (neue Angebote, eine Suche, Push), sagt
  ohne Netz in einem Satz, dass es Netz braucht; der Rest bleibt benutzbar.
- Neue Funktionen bekommen einen Test ohne Netz (Server aus oder Anfragen
  abbrechen – Playwrights `setOffline()` schneidet die Anfragen des Service
  Workers nicht ab).

## Die Repos
- **Finanzdienste/Boxenstopp** (dieses, öffentlich): die App – Vanilla-JS-PWA
  ohne Bauschritt, live über GitHub Pages. Alles hier ist für jeden lesbar.
- **Finanzdienste/Boxenstopp-Daten** (privat): die gemeinsame Liste
  (`liste.json`), Amys Sachen (`sachen.json`, die Sachen-App unter `sachen/`, Fotos
  unter `sachen/`), der Katalog (`katalog.json`) und was die Actions schreiben.
- **Finanzdienste/Boxenstopp-Marielle**: Marielles Liste – nie hineinschreiben.
  Den Katalog gleicht die App selbst ab (Tobis Handy, alle 5 Minuten).
- **Finanzdienste/Bildschirmzeit** (öffentlich): Tobis Widget-App (Android)
  und die Quelle von `js/bildschirmzeit.js` (`web/bildschirmzeit.js`) – nur
  dort ändern, dann byte-gleich hierher, nach Freizeit, Workout und
  Bewerbungszentrale kopieren.
  Ohne Verbinden-Link (`#bildschirmzeit=…`) tut das Modul nichts.
- **Finanzdienste/Amy**: Amys App „Frag mal“ und die Supabase-Funktionen, die
  Boxenstopp nutzt (`api-kosten`, `produkt-bild`). Änderungen über einen PR;
  ist die Prüfung grün und gibt es keine Konflikte, merged Claude ihn selbst.
  Funktionen spielt Claude nach den Tests selbst in Supabase ein.

## Geheimnisse
- Tokens, API-Schlüssel und Passwörter nie in Chat, Code, Commits oder Logs –
  auch nicht abgekürzt. GitHub-Token und KI-Schlüssel liegen nur im
  localStorage der Handys.
- GitHub-Secrets (GEMINI_KEY, CF_ACCOUNT_ID, CF_API_TOKEN, VAPID_PRIVATE_KEY, DATEN_TOKEN)
  hat Tobi selbst angelegt: nicht anfassen, nicht erzeugen, nicht ausgeben.
  Ebenso keine Push-Endpunkte ausgeben.
- To-Do-Refresh-Tokens nur verschlüsselt (AES-256-GCM, Schlüssel per HKDF aus
  VAPID_PRIVATE_KEY, nur innerhalb der Actions); Tokens und Gerätecodes nie
  loggen. Die Microsoft-App-ID ist nicht geheim.
- Gast-Zugänge legt nur Tobi an.
- In `ki.json` (Daten-Repo) steht der geteilte KI-Schlüssel: höchstens
  Anbieter, von wem und Stand ausgeben, nie den Schlüssel.
- Kein Login-Automatisieren gegen nicht öffentliche APIs (z. B. dm), keine
  Passwörter speichern.

## Daten
- Echte Listendaten nie in diesem Repo, in Tests oder Beispielen – Tests
  arbeiten mit erfundenen Daten. Ausnahme (Tobi, 19.11.2026): die KI-Fotos
  gewünschter, KI- und Amys Rezepte unter `bilder/eigene/` mit
  `daten/fotos.json` (nur ids und Pfade) – die Action schreibt sie selbst.
  Wer echte Daten ansieht: nur lokal, und nur Namen, IDs und Zahlen ausgeben.
- Amys Gesundheitsdaten (Verträglichkeiten, Notizen) stehen nur in der privaten
  `liste.json`, nie im öffentlichen Code. Die KI-Suche schickt höchstens
  Zutatennamen, nie Notizen.
- Wer `liste.json` schreibt, zählt `rev` um genau 1 hoch – die Geräte nehmen
  einen Stand nur, wenn `rev` mindestens so groß ist wie der bekannte.
- Daten am besten mit den Funktionen der App ändern (z. B. `js/katalog.js`,
  `js/liste.js` aus einem Node-Skript), Format wie vorhanden (JSON mit
  1 Leerzeichen Einrückung, Zeilenumbruch am Ende).
- Ein neu erzeugtes `daten/angebote.json` nie committen.

## Was die App ins Netz darf
- Ehrlicher User-Agent, robots.txt beachten, keine Bot-Sperren umgehen.
- Nicht: REWE-App-API, Rossmann scrapen, kaufDA-Prospektviewer, Schlüssel von
  marktguru abgreifen.
- Gemini mit Google-Suche wird nicht benutzt (die Bedingungen verbieten,
  Ergebnisse zu speichern) – die Internetsuche läuft nur über Claude.
- Was jemand der KI schreibt (Wünsche, Prompts), steht in der App nirgends
  sichtbar – nur, von wem und wann, und was sich geändert hat.

## Ändern, prüfen, ausliefern
1. Ändern, dann `npm run lint` und die Tests: `node tests/lauf.mjs` (alle) oder
   `node tests/lauf.mjs katalog ki` (einzelne). Der Testserver braucht Port 8099.
   Neue Funktionen bekommen Tests, die README wird mitgezogen.
2. In `sw.js` die `VERSION` um eins hochzählen (z. B. `'v66'` → `'v67'`); neue JS-Dateien in
   `SHELL` eintragen. Die Sachen-App (`sachen/`, eigener Worker) lädt viele Dateien aus
   `js/` und `css/styles.css` mit: Ändert sich eine davon, auch `VERSION` in `sachen/sw.js`
   hochzählen und `tests/daten/sachen-fassung.json` nachziehen (`test-sachen.mjs` sagt die
   neuen Werte); ein neuer Import gehört auch in ihre `SHELL`.
3. Committen und vor dem Push `git pull --rebase origin main`; gepusht wird
   auf `main`. Keine History umschreiben (kein amend, kein force).
4. Erst die App pushen, dann Daten, die alte App-Versionen kaputt machen
   könnten. Commit-Nachrichten im Daten-Repo im Stil „Tobi: Katalog – „…“
   dazu“, ohne „· Bescheid“ oder „· To Do“ (die lösen Benachrichtigungen aus).
5. Nach dem Push prüfen, ob die Action „Prüfung“ und das Pages-Deployment grün
   sind.

## Rezepte
- 8 Boxen, ordentlich gewürzt, Mengen in handelsüblichen Packungsgrößen.
- Ziel pro Box (Standard): 443 kcal, 33 g Eiweiß, 39 g KH, 15,4 g Fett –
  eine Liste kann ein eigenes Ziel haben (`profil.ziel`).
- Kein Fisch, kein Putenhack. Schwein und Hüttenkäse gehen – Hüttenkäse in
  warmen Saucen nur glatt püriert (sonst wird er körnig).
- Nicht zu fleischig – ein Richtwert, keine Pflicht: etwa 90 g rohes Fleisch
  pro Box (beim Standardziel; mit mehr Eiweiß anteilig mehr). Wo es passt,
  bringen Skyr, Hüttenkäse, Quark, Eier oder Hülsenfrüchte den Rest an
  Eiweiß, dazu reichlich Sauce und Gemüse. Geschmack geht vor (Tobi: „nicht
  so dogmatisch … kein Rezept ekelhaft machen“): Ein Fleischgericht darf eins
  bleiben, nichts auf Krampf ersetzen – lieber etwas weniger Fleisch und mehr
  vom Rest als ein fremder Ersatz. Feste Rezepte erst ändern, wenn Tobi den
  Vorschlag gesehen hat.
