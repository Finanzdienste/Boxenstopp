# Boxenstopp

Meal-Prep-Rezepte für je 8 Boxen und eine gemeinsame Einkaufsliste – als App
fürs Handy, für Tobi und seine Freundin.

**Adresse:** <https://finanzdienste.github.io/Boxenstopp/>
(in Chrome öffnen, dann Menü ⋮ → „App installieren“; auf dem iPhone in
Safari: Teilen → „Zum Home-Bildschirm“).

Fünf Reiter (welche davon unten stehen und in welcher Reihenfolge, wählt jedes Gerät in den Einstellungen):

| Reiter | Inhalt |
| --- | --- |
| **Rezepte** | 50 Rezepte als Boxen mit Kreppband und ehrlicher Gesamtzeit, Suchfeld (Name, Zutat, Gericht), Filter (Hähnchen, Rind, Pute, Reis, Nudeln, Kartoffel & Co., Bulgur & Co., unter 1½ Std., auf der Liste), dazu **Preis** („Bis 2 €“ pro Box, mit der Zahl der Rezepte) und **Sortieren** (Empfohlen, Günstigste, Schnellste) – beides lässt sich mit jedem Filter kombinieren und bleibt auf dem Handy gemerkt. Im Rezept: Nährwerte pro Box gegen das Ziel, Zutaten mit Packungsgrößen, **Zubereitung als Mise en place** (siehe unten), **Kochmodus** fürs iPad (ein Schritt groß, Bildschirm bleibt an), „Bildschirm anlassen“, Portionsrechner (Topf leer/voll → Gramm pro Box), Aufbewahren, Tipps, die ganze Nährwertrechnung. **Daumen** hoch, zur Seite oder runter: einer pro Gericht für euch beide, mit Namen, wer zuletzt gedrückt hat; steht auch auf der Box, Filter „Daumen hoch“ |
| **Einkaufsliste** | In Einkaufsreihenfolge: **Frisches** → **Tierisches** (erst Fleisch, dann Milchprodukte) → **Trockenes** (auch Konserven und TK) → **Gewürze** → **Extras** (Haushalt wie Backpapier oder Döschen, nur wenn nötig). Gleiche Zutaten aus mehreren Rezepten stehen in einer Zeile und werden addiert (Reis 280 g + 240 g = 520 g), mit Herkunft und Packungshinweis. Abhaken, eigene Einträge, löschen mit Rückgängig, Erledigtes weg, Frühstück für 7 Tage. **Eine Zeile antippen:** in eine andere Abteilung verschieben („Nuggets“ gehört zu Fleisch) oder mit einer anderen Zeile zusammenlegen („leckere Dino nuggies“ ist dasselbe wie „Dino nuggets“) – beides gemerkt, für beide und fürs nächste Mal; zwei Zeilen, die dasselbe sein könnten, schlägt die App über der Liste selbst vor (siehe unten). Im Laden: **„Bei Aldi nicht bekommen“** (bleibt für den nächsten Einkauf), **was es gekostet hat** (dann rechnen die Kosten mit euren Preisen) und ein **Preisalarm**. **„Ich kaufe bei Aldi“** über der Liste: Dann merkt sich das Handy, in welcher Reihenfolge abgehakt wird, und beim nächsten Einkauf dort steht die Liste nach Abteilungen in der Reihenfolge eures Wegs durch den Markt (siehe unten). **Liste kopieren** gibt alles Offene als Text aus, Bereich für Bereich („Frisches:“, „300 g Zwiebeln (≈ 3 Stück)“ …) – zum Einfügen in eine andere Einkaufsliste |
| **Amys Rezepte** | Amys eigene Rezepte, rosa und verspielt, mit ihren eigenen Tags zum Filtern und Sortieren (siehe unten). **Rezept übernehmen** aus einem Foto, einem Link oder Text – die KI füllt den Editor. Ihre Zutaten kommen auf dieselbe gemeinsame Liste. „Auch auf dem iPad“ erklärt, wie die App auf ihr Tablet kommt |
| **Angebote** | Die Angebote dieser und der nächsten Woche, die Empfehlung, wo es sich lohnt, welche Rezepte davon profitieren, **Preisalarm** (die Glocke am Angebot) und **Preisverlauf** („Tiefstpreis seit 8 Wochen“) (siehe unten) |
| **Einstellungen** | Gemeinsame Liste (Einrichten, Link fürs zweite Handy, Aufs iPad, Trennen), Push-Nachrichten, KI-Schlüssel, hell oder dunkel, welche Reiter unten stehen und in welcher Reihenfolge, was die App gelernt hat (Tempo, Wege durch die Läden, Preisalarme, Preise vom Bon – mit Vergessen und Löschen), Fassung und „Nach Updates suchen“ (siehe unten) |

Dazu **Push-Nachrichten** aufs Handy und iPad: wenn der andere etwas auf die
Liste setzt, alles eingekauft ist, Amy ein neues Rezept hat oder ein
Preisalarm zuschlägt (siehe unten).

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

Ein Schritt ist eine Handlung und eine Zeile zum Abhaken, die Minuten
stehen klein dahinter. Der nächste offene Schritt ist markiert. **Timer gibt
es nur, wo man einen braucht** (`timerPlan` in `js/zeiten.js`): wenn danach
etwas eine feste Zeit läuft und man am Ende etwas tun muss – köcheln, backen,
braten, garen, marinieren, ruhen lassen. Dann steht rechts ein kleiner Knopf
mit der Uhr („15 Min.“), bei „8–10 Min.“ mit der kürzeren Zeit. Kein Timer
fürs Schneiden und Abwiegen, für Ofen vorheizen und Wasser aufsetzen (das
merkt man selbst), für weniger als 3 Minuten und für Verweise auf einen
anderen Timer („sobald die 10–12 Min. um sind“) – im Schnitt 5 Timer je
Rezept statt einem an jedem der 28 Schritte. Zwei Zeiten hintereinander
werden zwei Stufen: „12 Min. garen und 10 Min. ruhen lassen“ meldet sich
nach 12 Min. mit „Jetzt: 10 Min. ruhen lassen“ und läuft weiter, genauso
„35 Min. backen, nach 20 Min. wenden“ und „je Seite 5 Min.“. Mehrere Timer
laufen nebeneinander oben unter der Kopfzeile mit (antippen springt zum
Schritt), überleben ein Neuladen und melden sich mit Ton, Vibration und
Benachrichtigung (`js/timer.js`, über den Service Worker – auf Android geht
es nur so; antippen springt zum Schritt) – auf jedem Gerät der Person, die
kocht (siehe Kochstand).

**Die Zeiten lernen euer Tempo** (`js/tempo.js`, je Person – jeder kocht
in seinem Tempo, auf iPad und iPhone dasselbe): Die Zeit zwischen zwei Haken ist, was ein
Schritt gedauert hat. Gemessen wird nur, wo man selbst arbeitet; feste
Garzeiten („15 Min. köcheln“) bleiben, wie sie sind, und unsaubere Messungen
fallen weg (nach einer Wartezeit, „währenddessen“, über 45 Min., weniger als
ein Drittel oder mehr als das Vierfache der Standardzeit). Was in 20 Sekunden
zusammen abgehakt wird, zählt zusammen. Daraus: je Schritt die eigene Zeit
(die ersten Male mit der Standardzeit gemischt), je Abschnitt ein Faktor
(gewichteter Median; „Vorbereiten 1,5×“), der für alle Rezepte gilt – und
war man einmal ganz durch, die ganze Zeit des Rezepts (Median der letzten
drei Male). Auf der Karte ist die Zeit dann farbig, im Rezept steht „dein
Tempo“, die Minuten der Schritte und „Unter 1½ Std.“ rechnen damit. „Tempo
vergessen“ (mit Rückgängig) setzt alles zurück. Unter den
Daumen stehen **Notizen** zum Rezept („nächstes Mal weniger Chili“), für
beide, in `liste.json` unter `notizen`. Die Zeiten sind für ein
ruhiges Tempo zu Hause gerechnet, mit Waschen, Schälen und Abfall wegräumen
(Normen in `NORM`, werkzeug/rezepte.py), und `js/zeiten.js` rechnet daraus
Abschnitte und Gesamtzeit: Wartezeiten (`ruhe`, etwa Marinieren) laufen im
Hintergrund weiter, „währenddessen“ kostet keine zusätzliche Zeit.

### Im Rezept

Oben neben „Alle Rezepte“ springt **Zum Rezept** direkt zur Zubereitung (und
klappt sie auf, falls sie zu war). Jeder Bereich – Notizen, Zutaten,
Zubereitung, Portionieren, Aufbewahren, Tipps – klappt mit einem Tipp auf die
Überschrift zu und wieder auf; was zu ist, bleibt auf diesem Handy zu, auch
im nächsten Rezept (localStorage). **Anpinnen** (bei „Heute gekocht“) markiert
ein Rezept als „läuft gerade“: Es steht dann bei euch beiden ganz oben bei den
Rezepten, mit Foto und dem Fortschritt beim Kochen („5 von 26 Schritten“ – die
eigenen Haken), auf seiner Karte steht „Läuft gerade“. Höchstens vier,
für beide in `liste.json` unter `gepinnt`.

### Kochmodus

Im Rezept neben „Bildschirm anlassen“ (und in Amys Rezepten über den
Schritten): **Kochmodus** zeigt einen Schritt nach dem anderen, groß genug
fürs iPad neben dem Herd (`js/kochmodus.js`). „Erledigt ✓“ hakt ab und
springt zum nächsten offenen Schritt, „‹ Zurück“ und „Weiter ›“ blättern,
Wischen geht auch (nach links weiter, nach rechts zurück), mit Tastatur
Pfeile, Leertaste und Esc. Unten die Punkte aller Schritte (antippen springt
hin), bei einem Schritt mit Zeit ein großer Timer-Knopf; laufende Timer
stehen oben. Der Bildschirm bleibt an, solange der Kochmodus offen ist (Wake
Lock – auf iPhone und iPad ab iOS/iPadOS 18.4 auch in der App vom
Home-Bildschirm; geht es nicht, steht das oben). Die Haken sind dieselben wie
im Rezept, Tempo und Belohnung laufen mit; der letzte Haken schließt ihn.

### Kochstand pro Person

Haken, Tempo und laufende Timer gehören der Person, nicht dem Gerät
(`js/kochstand.js`): Amy fängt auf dem iPad an und kocht auf dem iPhone
weiter – dort sind dieselben Schritte abgehakt und der Timer läuft mit. Jedes
Gerät arbeitet mit seiner Kopie im localStorage und schickt Änderungen
gebündelt (nach 1,5 s, ohne eigene Push-Nachricht) nach `liste.json` unter
`kochen.<name>`; die neueste Fassung gewinnt, das andere Gerät übernimmt sie
beim nächsten Abgleich. Tobi und Amy haben je ihren eigenen Stand. Ohne
gemeinsame Liste bleibt alles auf dem Gerät.

### Der Weg durch den Laden

Öffentliche Marktpläne gibt es nicht – also lernt die Liste den Weg selbst
(`js/weg.js`). Über der Liste wählt man, wo man einkauft (dieselbe Wahl wie
bei den Angeboten). Jeder Haken in dem Laden wird mit der Uhrzeit gemerkt;
der Einkauf ist vorbei, wenn alles im Wagen ist, ein anderer Laden gewählt
wird oder 45 Minuten kein Haken mehr kam. Ab drei Haken bekommt jede Zutat
ihre Stelle auf dem Weg (0 am Anfang, 1 am Ende), höchstens die letzten
fünf je Zutat, in `liste.json` unter `wege` – für beide Handys, „unser
Aldi“. Beim nächsten Einkauf dort steht die Liste nach Abteilungen (Obst &
Gemüse, Fleisch, Kühlregal, Konserven …) in der Reihenfolge des Wegs, darin
nach den Zutaten; was noch nie gekauft wurde, steht bei seiner Abteilung,
und eine Abteilung ohne Messung da, wo sie üblicherweise steht. Jede
Messung zählt, die übliche Reihenfolge wie eine – nach zwei, drei Einkäufen
passt es. „Reihenfolge vergessen“ (mit Rückgängig, über der Liste oder je Laden in den Einstellungen) fängt neu an. Eigene
Einträge erkennt der Weg am Namen („Bananen“).

### Abteilung, Zusammenlegen, im Laden

Eine Zeile antippen klappt sie auf:

- **Bei Aldi nicht bekommen** (der Laden, der über der Liste gewählt ist):
  Die Zeile bleibt offen und steht bei Aldi unten unter „Bei Aldi nicht
  bekommen – bleibt für den nächsten Einkauf“; der Einkauf zählt trotzdem als
  fertig, wenn alles andere im Wagen ist. In jedem anderen Laden steht sie
  wieder an ihrem Platz, mit „bei Aldi nicht bekommen“. Abhaken, Löschen oder
  „Markierung weg“ nimmt sie weg (`fehlt` in `liste.json`).
- **Was hat's gekostet?** Preis vom Bon und Menge (vorbelegt mit der Menge
  von der Liste): Ab dann rechnen die Kosten – Liste, Rezepte, Ersparnis –
  mit eurem Preis statt mit dem Richtpreis, aus den letzten fünf Bons je
  Zutat der Median je Gramm (Stückware über das Stückgewicht; `bons` in
  `liste.json`, `preiseMitBons` in `js/kosten.js`). „Letzten löschen“ nimmt
  einen falschen wieder raus.
- **Preisalarm:** ein Wunschpreis je kg, l oder Stück. Darunter der Verlauf
  der letzten Wochen („KW 40 8,99 · KW 42 9,49 €/kg“) und, wenn gerade ein
  Angebot darunter liegt, „Gerade: 8,65 €/kg bei Aldi“. Siehe Angebote.

- **Gehört zu:** die zehn Abteilungen (Obst & Gemüse, Fleisch, Kühlregal,
  Nudeln/Reis, Konserven, Öl/Saucen/Vorrat, Tiefkühl, Gewürze, Haushalt,
  Sonstiges). Die Wahl steht in `liste.json` unter `abteilungen`, je
  Schlüssel und je Name (`n:kackbuerste`) – sie gilt vor dem Katalog und dem
  Geratenen, für beide Handys, für neu eingetippte Einträge mit dem Namen und
  für Amys Rezepte. Was die App gar nicht zuordnen kann, steht bei
  „Sonstiges – antippen zum Einsortieren“. Beim Eintippen rät sie außerdem
  mehr als früher (Bürsten und Reiniger → Haushalt, Nuggets und Frikadellen
  → Fleisch, Croutons → Trockenes, Dressing → Vorrat).
- **Ist dasselbe wie:** eine andere Zeile wählen, die ähnlichsten zuerst.
  Zusammengelegt wird in die Zeile, die mehr weiß (Katalog vor
  Resteverwertung vor Amys Zutaten vor eigenen Einträgen), mit allen Teilen;
  der alte Schlüssel und Name zeigen danach unter `gleich` auf sie
  (`"amyz-leckere-dino-nuggies": "amyz-dino-nuggets"`). Was später unter dem
  alten Schlüssel kommt – das Rezept wieder auf der Liste –, landet gleich in
  dieser Zeile; Amys Editor zeigt „leckere Dino nuggies = Dino nuggets“.
  Rückgängig nimmt beides zurück.
- **Vorschläge** (`js/gleich.js`): Die App vergleicht die Namen Wort für
  Wort, ohne Füllwörter („lecker“, „groß“, „Bio“), mit Einzahl und Mehrzahl,
  Koseformen und kleinen Tippfehlern („Nuggies“ – „Nuggets“, „Mozarella“ –
  „Mozzarella“), aber Milch bleibt kein Milchreis. Über der Liste fragt sie
  „Dasselbe?“ mit **Zusammenlegen** oder **Nein, verschieden** – das Nein
  steht unter `ungleich` und kommt nicht wieder. Zwei Zutaten aus dem Katalog
  schlägt sie nie vor (Paprika und Paprikapulver sind mit Absicht zwei).

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
Wer beim Einkaufen eintippt, was es gekostet hat, ersetzt den Richtpreis
dieser Zutat durch den eigenen (siehe oben) – auch als Maßstab dafür, ob ein
Angebot günstig ist.

### Amys Rezepte

Der Reiter, in dem Amy ihre eigenen Rezepte schreibt (am Rechner über die
Karte bei den Rezepten, direkt mit `#amy` in der Adresse). Alles ist rosa
und rund: das Thema hängt an `html[data-tab="amy"]` und färbt auch Kopf,
Reiter und Liste um, Überschriften in Pacifico, Text in Fredoka (beide OFL),
Pünktchen im Hintergrund, Herzchen und Glitzer aus den Fluent Emoji; dunkel
in Pflaume und Rosa.

- **Schreiben:** Name, ein Bildchen (16 zur Wahl), Portionen, Dauer (wenn
  sie es weiß), Zutaten mit einer Zeile je Zutat und Menge vorne („500 g
  Hähnchenbrust“, „2–3 Zwiebeln, gewürfelt“, „1 Dose Kokosmilch (400 ml)“,
  „1½ EL Sojasauce“, „Salz, Pfeffer“), Schritte mit einer Zeile je Schritt
  (eine kurze Zeile mit Doppelpunkt, „Soße:“, beginnt einen Abschnitt),
  Notiz. Schon beim Tippen zeigt der Editor, was die App aus jeder
  Zutat liest: erkannt (✓ mit dem Katalognamen), neu, Gewürz, nicht
  einkaufen. Was gerade im Editor steht, bleibt als Entwurf, auch wenn die
  App zugeht.
- **Lesen** (`js/amy.js`, ohne DOM): Menge, Einheit (g, kg, ml, l, EL, TL,
  Dose, Bund, Zehe, Stück …), Name und Zusatz; über den Namen der
  Katalog-Schlüssel (`schluesselRaten`). Erkannte Zutaten teilen sich auf der
  Einkaufsliste eine Zeile mit den festen Rezepten – in deren Einheit („2
  Zwiebeln“ → 200 g zu den 300 g vom Chili, „300 g Paprika“ → 2 Stück) –, und
  die App kennt Nährwerte und Richtpreis. Unbekanntes bekommt `amyz-…` und
  eine geratene Abteilung. Gewürze, Wasser, Salz und Pfeffer kommen nicht mit
  „Alles auf die Einkaufsliste“, lassen sich aber einzeln mit + setzen.
- **Im Rezept:** Portionen, Zeit, ≈ Kosten pro Portion, ≈ kcal/P/KH/F pro
  Portion (ohne die Zutaten, die die App nicht kennt – die stehen dabei),
  Zutaten mit +, Schritte zum Abhaken mit Timern wie bei den festen Rezepten
  (Zeiten im Text), das Tempo lernt mit, zum Schluss das Tier. Bearbeiten,
  Löschen (mit Rückfrage und Rückgängig – ihre Zutaten gehen mit von der
  Liste). Auf der Liste steht als Herkunft „♡ Kokos-Curry“, antippen öffnet es.
- **Tags:** Im Editor vergibt sie eigene Tags („bauchfreundlich“,
  „gesund“ …) – antippen aus Vorschlägen (ihre schon benutzten zuerst) oder
  eintippen, Enter oder Komma macht den Tag fertig, × nimmt ihn weg,
  höchstens acht. Jeder Tag hat immer dieselbe von sechs Pastellfarben. Über
  ihren Rezepten filtert sie danach (mehrere Tags: Rezepte mit allen) und
  sortiert: neueste, Name, schnellste, günstigste oder **nach Tags** (ein
  Abschnitt je Tag). Ein Tag im Rezept antippen zeigt alle Rezepte damit.
  Filter und Sortierung merkt sich das Handy.
- **Rezept übernehmen** (oben im Editor, bei einem neuen Rezept gleich
  offen): ein Foto einer Kochbuchseite (bis zu drei), ein Link (Chefkoch &
  Co.) oder kopierter Text – die KI (derselbe Schlüssel wie bei der
  Resteverwertung) überträgt es in ihr Format: eine Zutat je Zeile mit der
  Menge vorn, ein Schritt je Zeile mit „20 Min.“, Abschnitte mit
  Doppelpunkt, Portionen, Dauer, Notiz, bis zu drei Tags (`js/amy-import.js`).
  Gespeichert ist erst, was sie sich angeschaut hat; „Rückgängig“ in der
  Meldung holt den Editor zurück. Links liest nur Gemini selbst (Werkzeug
  `url_context`); mit einem Claude-Schlüssel gehen Fotos und Text.
- **Gespeichert** in `liste.json` unter `amy` (für beide, höchstens 60), so
  wie sie es getippt hat, die Tags daneben unter `amyTags`. Schreibt eine
  ältere App-Fassung die Liste ohne diese Teile, legt das Handy, das sie
  kennt, sie wieder dazu (`js/speicher.js`).
- **Zeilen lesen** versteht auch, wie sie wirklich schreibt: „1 kleine
  Flasche Ceasar Salad Dressing“ (Flasche erkannt, „klein“ als Zusatz), „1
  großen (Dürüm)Wrap“ (Wrap, Zusatz „Dürüm, groß“).
- **Aufs iPad:** Die Anleitung kommt bei ihr auf dem iPhone einmal von
  selbst, danach über „Auch auf dem iPad ♡“ in ihrem Reiter (und „Aufs iPad
  oder Tablet“ in den Einstellungen): Link kopieren (mit derselben Apple-ID gleich
  auf dem iPad einsetzen), auf dem iPad in Safari öffnen, über Teilen „Zum
  Home-Bildschirm“ mit „Als Web-App öffnen“, dort einmal einrichten – Name
  und den Link ins Feld „Schlüssel“. Dann zeigen beide dasselbe – auch die
  Haken beim Kochen und laufende Timer (Kochstand pro Person); nur ein
  ungespeicherter Entwurf bleibt auf dem Gerät (`js/ansicht-tablet.js`).

### Angebote der Woche

Vierter Reiter (auf dem Handy unten, am Rechner über die Karte bei den
Rezepten). Ganz oben **Diese Woche / Nächste Woche** (KW und wie viele
Rezeptzutaten im Angebot sind): Angebote gelten Montag bis Samstag; „diese
Woche“ heißt ab dem nächsten Einkaufstag (sonntags schon die neue Woche),
und was Donnerstag bis Mittwoch läuft, steht in beiden (`woche`, `inWoche`
in `js/angebote.js`; „ab Do.“ am Angebot, wenn es später beginnt). Fehlen
die Angebote der nächsten Woche noch, sagt der Reiter, wann sie kommen. Die
Einkaufsliste und die Zahl am Reiter rechnen immer mit dieser Woche. Dann
die **Empfehlung**, wo sich der Einkauf lohnt (siehe unten). Darunter „Wo gehst du hin?“: Mit einem Laden gewählt (die
Läden aus dem Abruf – und jeder, für den eigene Angebote eingetragen
sind) zeigt der Reiter nur dessen Angebote, und auch „Passt zu euren
Rezepten“, das neue Rezept der KI und die Hinweise auf der Einkaufsliste
rechnen nur mit denen; die Wahl bleibt auf dem jeweiligen Handy
(localStorage). Dann die Liste: **Hähnchen** (ein Tipp, und die App springt
direkt zu den Hähnchen-Angeboten), Rezeptzutaten oder alle Lebensmittel,
Suche, sortiert **nach Laden** oder **„Beste zuerst“**. **Die App holt die Angebote selbst:** montags und donnerstags
früh und sonntags vormittags (dann sind die Angebote der nächsten Woche
überall online) läuft bei GitHub `werkzeug/angebote.mjs` (`.github/workflows/angebote.yml`)
und schreibt `daten/angebote.json` – diese und nächste Woche zusammen, jedes
Angebot mit `von` und `bis` –, die App lädt die Datei beim Start und
merkt sie sich fürs Offline-Lesen. Quellen – nur öffentliche Seiten, mit
ehrlicher Kennung, dreimal die Woche:

| Laden | Woher | Wie |
|---|---|---|
| Aldi (Nord) | `aldi-nord.de/angebote.html`, `…/angebote-vorschau.html` | alle Artikel der Woche als eingebettetes JSON: Preis, Packung, Grundpreis, gültig von/bis; die Vorschau auf die nächste Woche ist ab Donnerstag da |
| Kaufland | `filiale.kaufland.de/angebote/uebersicht.html` (und `?kloffer-week=next`) | Artikelkacheln im HTML, nach Warengruppen, Gültigkeit je Gruppe (bundesweit); die nächste Woche ist anfangs nur Vorwerbung, die Lebensmittel kommen zum Wochenende |
| Penny | `penny.de/.rest/offers/by-category/<Jahr>-<KW>/<Gruppe>` | JSON je Warengruppe, diese und nächste Kalenderwoche (die nächste antwortet ab dem Wochenende) |
| Lidl | Aktionsprospekt (`lidl.de/l/prospekte`, Seitenbilder) | Gemini (`generateContent`) liest die Lebensmittel-Seiten (die mit Rezept-Links oder ohne Links; Werkzeug, Kleidung, Wein bleiben weg), sechs je Anfrage. Im Gratis-Kontingent hängt mal das eine, mal das andere Modell: Nach 60 s ohne Antwort, bei Überlastung oder am Kontingent geht es reihum weiter (3.8-flash → 3.7 → 3.6 → 3.5-flash → 3.5-flash-lite), das Modell, das geantwortet hat, steht in `daten/angebote.json` und kommt beim nächsten Lauf zuerst dran; hängende Stapel bekommen einen zweiten Durchgang. Dafür braucht der Lauf den Schlüssel als Secret `GEMINI_KEY` (Settings → Secrets and variables → Actions); ohne ihn fällt Lidl aus. Probelauf: Actions → Angebote → Run workflow mit `quellen` = `lidl` und `lidl_seiten` = `8` |
| Rewe, Edeka | kaufDA, **privat** (siehe unten) | Die eigenen Seiten sperren automatische Abrufe (rewe.de: Cloudflare-Abfrage auf allen Seiten, Edeka: 403 mit Scherzantwort). Ihre Angebote kommen über kaufDA und landen nur im privaten Daten-Repo |

**Rewe und Edeka über kaufDA – nur privat.** kaufDA (Bonial, der
Prospektdienst der Händler) zeigt deren Angebote auf öffentlichen Seiten je
Stichwort und Stadt (`kaufda.de/<Stadt>/Angebote/<Stichwort>`), mit Produkt,
Marke, Preis, Packung und Gültigkeit als Daten in der Seite; die robots.txt
erlaubt diese Seiten (Crawl-Delay 2 s, der Lauf wartet 4 s). Je Seite sind
höchstens 16 Angebote zu sehen, darum fragt der Lauf gezielt 38 Stichwörter
der Rezeptzutaten ab (`KAUFDA_WORTE`) – also nicht das ganze Prospekt, das
steht auch in der App. Dasselbe Angebot aus den Prospektvarianten zählt
einmal; was kaufDA nicht unter Lebensmittel führt, fliegt raus. Antwortet
kaufDA zwischendurch nicht (503), wartet der Lauf und macht weiter, nach
dreimal hintereinander hört er auf und behält, was er hat.

kaufDA erlaubt die Nutzung nur privat, **nicht das Veröffentlichen** (AGB
§ 3 e). Darum ist das ein eigener Lauf, `KAUFDA_STADT=… node
werkzeug/angebote.mjs --privat --ziel <pfad>/angebote-privat.json`, dessen
Datei nur im privaten Daten-Repo neben `liste.json` liegt; die Stadt steht
nicht im Code. Die App liest sie mit dem Schlüssel aus `zugang.js`
(`privatLesen` in `js/speicher.js`) und legt sie mit `daten/angebote.json`
zusammen; ohne Schlüssel oder ohne die Datei bleibt es bei Aldi, Lidl,
Kaufland und Penny, und Rewe und Edeka stehen als „gesperrt“ da. Beim
Trennen vergisst das Handy die privaten Angebote.

**Wie günstig ist ein Angebot?** Jede Rezeptzutat hat einen Richtpreis (siehe
Kosten), den üblichen Discounter-Preis. Daran misst die App jedes Angebot
(`angebotRabatt` in `js/angebote.js`): bei gleicher Einheit je Einheit, sonst
je Gramm über das Kaufgewicht (Zucchini 300 g das Stück, Zitrone 110 g statt
der 30 g Saft aus den Nährwerten, Dosen mit der Füllmenge von 400 g statt
abgetropft). Glas gegen Gramm oder ein Karton Milch lassen sich nicht ehrlich
vergleichen und bekommen keinen Wert. Ab 5 % günstiger steht die Plakette
„−24 %“ am Angebot, bei Packungen in Gramm oder Litern dazu der Preis je kg
oder l. „Beste zuerst“ ist eine Liste über alle Läden, danach sortiert
(Unvergleichbares unten); „Nach Laden“ sortiert innerhalb jedes Ladens
danach; die Wahl merkt sich das Handy. „Hähnchen“ heißt: Brust und Keule aus
dem Katalog und anderes rohes Hähnchen (Schenkel, Flügel, Minutenschnitzel),
nichts Paniertes oder Fertiges (`istHaehnchen`).

**Empfehlung:** Für die offenen Einträge der Einkaufsliste rechnet die App je
Laden, was dessen Angebote sparen – Rabatt mal Richtpreis der gebrauchten
Menge (`ladenWahl`) – und nennt den Laden mit der größten Ersparnis, die
Zutaten dazu und die nächsten zwei Läden; „Zu Aldi“ wählt ihn. Darunter
**„Nur in einen Laden?“**: je Laden das beste Rezept, wenn man nur dort
einkauft – das mit den meisten Zutaten dort im Angebot, bei Gleichstand das,
was am meisten spart (`besteJeLaden`). Antippen (oder einen Laden bei „Wo
gehst du hin?“ wählen) macht daraus „Nur Aldi – das beste Rezept diese
Woche“: das Rezept mit seinen Zutaten im Angebot und der Ersparnis pro Box,
„Auf die Liste“, zwei weitere und was eure Liste dort spart. Ohne Liste:
der Laden, der für eure Rezepte im Schnitt am meisten spart. Gerechnet ist
nur mit den Angeboten; ist es Rewe, Edeka oder Kaufland, steht dabei, dass
der Rest beim Discounter meist weniger kostet. Oben im Reiter springt
**„Passt zu euren Rezepten“** (mit der Zahl der Rezepte) direkt dorthin.

**Auf der Einkaufsliste** steht oben, in welchem Laden die offenen Einträge
mit den Angeboten am günstigsten sind (dieselbe Rechnung, mit den nächsten
zwei Läden). Unter jedem offenen Eintrag, der gerade irgendwo im Angebot ist
(`angeboteJeZutat`): wo er am günstigsten ist („−24 % am günstigsten bei
Aldi: 600 g 5,19 € · 8,65 €/kg“ – „am günstigsten“ nur, wenn es wirklich
günstiger ist als der übliche Discounter-Preis, sonst „im Angebot bei …,
teurer als sonst“), beim gewählten Laden, wenn der ihn auch im Angebot hat
(„Bei Lidl: 400 g 3,79 € · 9,48 €/kg −16 %“), und wo sonst noch („Auch:
Edeka 9,90 €/kg · Rewe 9,99 €/kg“). Eigene Einträge erkennt die App am
Namen („Hähnchenbrust“). „Passt zu euren Rezepten“ rechnet mit demselben
Vergleich.

**Preisalarm:** Die Glocke an einem Angebot setzt einen Wunschpreis – den
Preis dieses Angebots je kg, l oder Stück; in der aufgeklappten Zeile der
Einkaufsliste lässt er sich eintippen. Rezeptzutaten erkennt der Alarm am
Katalog-Schlüssel, Eigenes am Namen („Dino Nuggets“). Oben im Reiter stehen
die Angebote dieser und der nächsten Woche, die darunter liegen, je Alarm
das günstigste („Hähnchenbrustfilet 8,65 €/kg bei Aldi · Wunsch höchstens
9,00 €/kg“); kommen neue, gibt es eine Push-Nachricht (siehe unten).
Gespeichert für beide unter `preisalarm` (höchstens 60, `preisalarmTreffer`
in `js/angebote.js`).

**Preisverlauf:** Bei jedem Angebots-Lauf schreibt
`werkzeug/preisverlauf.mjs` aus der Git-Historie von `daten/angebote.json`
nach `daten/preisverlauf.json`, wie günstig jede Rezeptzutat in jeder
Kalenderwoche im Angebot war (je kg, l oder Stück, das günstigste, die
letzten 26 Wochen – nur die öffentlichen Angebote, nichts von kaufDA). Daraus
steht am Angebot und auf der Liste „Tiefstpreis seit 8 Wochen“ oder „so
günstig wie seit 5 Wochen nicht“ (`js/preisverlauf.js`; ab drei Wochen, und
nicht, wenn es teurer ist als das, was ihr sonst zahlt). Der Verlauf
wächst mit jeder Woche – am Anfang steht dort noch nichts.

Getränke, Süßes, Drogerie,
Schwein und Fisch fliegen raus; jedes Angebot bekommt, wenn es eine
Rezeptzutat ist, den Katalog-Schlüssel (`schluesselRaten` in
`js/angebote.js`, mit Sperre für Verarbeitetes wie Saucen und Chips). Die
Ansicht zeigt erst die Rezeptzutaten, auf Wunsch nur Hähnchen oder alle
Lebensmittel, mit Suche; abgelaufene verschwinden von selbst. Fällt eine Quelle aus, bleiben
ihre alten Angebote, solange sie gelten.

Dazu **eigene Angebote**: Prospektseite fotografieren oder Screenshot aus
der Supermarkt-App, die KI (derselbe Schlüssel wie bei der Resteverwertung)
liest sie aus – oder eine getippte Zeile je Angebot („Aldi Hähnchenbrustfilet
1 kg 7,49“), die liest die App selbst. Die liegen in `liste.json` unter
`angebote` (für beide, mit Name und Datum).

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

### Bilder

**Rezepte** haben ein Foto – von einer KI gemacht, nicht fotografiert (im
Rezept steht „KI-Bild“ dran): Cloudflare Workers AI mit FLUX.1 [schnell] im
Gratis-Kontingent (10 000 „Neurons“ am Tag, ein Foto braucht gut 75).
`werkzeug/bilder.mjs` beschreibt je Rezept auf Englisch, was in der Box ist
(`MOTIVE`; immer eine Glasbox von oben auf hellem Holz, kein Text, keine
Hände), und legt das Foto 800 × 600 als WebP nach `bilder/rezepte/<id>.webp`
(30–50 KB); `werkzeug/rezepte.py` trägt es mit Prüfsumme als `bild` ein
(`bilder/rezepte/chili.webp?v=…`). Das läuft als GitHub Action
„Rezeptfotos“ (`.github/workflows/bilder.yml`), sobald sich
`daten/rezepte.json` ändert – ein neues Rezept bekommt sein Foto also von
selbst, bis dahin zeigt die Karte Bildchen seiner Hauptzutaten. Gefällt
eins nicht: Actions → Rezeptfotos → Run workflow mit der Rezept-id, dann
kommt ein neues. Der Lauf braucht die Secrets `CF_ACCOUNT_ID` und
`CF_API_TOKEN` (API-Token mit dem Recht „Workers AI“). Rezepte aus der
Resteverwertung haben kein Foto, sondern die Bildchen.

**Zutaten** haben auf der Einkaufsliste und im Rezept ein Bildchen: Fluent
Emoji von Microsoft (MIT-Lizenz, `bilder/zutaten/LIZENZ.txt`), als SVG aus
dem npm-Paket `@iconify-json/fluent-emoji`. Welche Zutat welches bekommt,
steht in `js/bilder.js` – erst der Katalog-Schlüssel, dann Stichwörter im
Namen (für eigene Einträge wie „Bananen“ oder „Zahnpasta“), sonst die
Abteilung. Ein neues Bildchen: dort eintragen, dann `npm install && node
werkzeug/zutaten-bilder.mjs`.

**Angebote** zeigen das Produktfoto, das in den Daten des Ladens steht
(Aldi, Kaufland, Penny, kaufDA; bei Lidl liest die KI nur Text aus den
Seitenbildern). Die App holt es direkt vom Bildserver des Ladens, ohne
Referrer; fehlt es oder lädt es nicht, steht das Bildchen der Zutat da.

Offline (`sw.js`): Die Bildchen kommen schon beim Installieren mit (Liste in
`bilder/zutaten/alle.json`), damit die Liste auch im Laden ohne Netz
vollständig ist. Rezeptfotos landen beim ersten Ansehen in einem eigenen
Vorrat, der Updates der App übersteht; ein neues Foto hat eine neue
Adresse, das alte fliegt raus.

### Einstellungen

Der fünfte Reiter, ganz rechts (breit: das Regler-Symbol oben; der Punkt
„Geteilt“ / „Nur lokal“ oben führt auch hin) – alles, was man einmal
einstellt, an einem Ort (`js/ansicht-einstellungen.js`):

- **Gemeinsame Liste:** nicht eingerichtet gleich das Formular (Name,
  Schlüssel), sonst wer du bist, der Stand, „Link fürs zweite Handy
  kopieren“, „Per WhatsApp schicken“, „Aufs iPad oder Tablet“, „Trennen“.
  Über der Einkaufsliste steht nur noch ein Hinweis, solange sie nicht
  eingerichtet ist oder der Schlüssel klemmt – sein „Einrichten“ führt
  hierher. Ein Link mit Schlüssel öffnet die Einstellungen, nach dem
  Verbinden geht es zur Liste.
- **Push-Nachrichten:** siehe unten; GitHub wird erst gefragt, wenn man die
  Einstellungen öffnet.
- **KI-Schlüssel:** welcher eingetragen ist (Google oder Anthropic, Modell),
  ändern, entfernen (mit Rückgängig).
- **Darstellung:** wie das Gerät, hell oder dunkel – je Gerät
  (`boxenstopp.design.v1`, ein kleines Skript im Kopf von `index.html` setzt
  `html[data-design]` schon vor dem ersten Bild, damit nichts flackert; jeder
  dunkle Farbsatz in `css/styles.css` gilt für „wie das Gerät“ und „dunkel“).
- **Reiter unten:** Rezepte, Amys Rezepte, Einkaufsliste und Angebote lassen
  sich ausblenden (einer bleibt) und mit ↑ ↓ umsortieren – oben in der
  Liste heißt links in der Leiste; die Einstellungen sind immer da, ganz
  rechts. Je Gerät (`boxenstopp.reiter.v1`: `aus`, `reihe`; ein Skript
  gleich hinter der Leiste in `index.html` ordnet sie vor dem ersten Bild). Ist „Amys Rezepte“ aus, steht ihre Karte auch
  auf dem Handy bei den Rezepten. Passen die Beschriftungen nicht
  nebeneinander, zeigt die Leiste die Kurzform („Amy“, „Liste“).
- **Gelernt und gemerkt:** dein Tempo („Tempo vergessen“), die Wege durch
  die Läden (je Laden „Vergessen“), die Preisalarme und eure Preise vom Bon
  (je löschen) – alles mit Rückgängig.
- **Über die App:** die laufende Fassung (aus dem Vorrat des Service Workers)
  und „Nach Updates suchen“.

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

**Mit KI ändern** (im Rezept neben „Anpassen“, oben im Anpassen): hinschreiben,
was anders sein soll – „fertige Teriyaki-Sauce statt selbst gemacht“, „ohne
Ofen“, „mit Reis statt Nudeln“. Die KI (derselbe Schlüssel wie bei der
Resteverwertung) bekommt das Rezept, wie es gerade steht, im Format ihrer
Antwort (`alsVorlage()` in `js/ki-rezept.js`; Auftrag im Modus `aendern` in
`js/ki.js`): Sie ändert nur, was verlangt ist, und lässt alles andere mit
denselben ids, Mengen und Schritten stehen. Die App prüft die Antwort wie jedes
KI-Rezept (kein Fisch, kein Schwein, kein Putenhack, kein Hüttenkäse),
schließt sie ans Original an (`aenderungUebernehmen()`: neue Zutaten „neu“,
verschwundene „weggelassen“, mit „zurück“ wiederzuholen) und rechnet die
Mengen wieder auf die Ziele – im Beispiel 441 kcal / 33,0 P / 39,2 KH /
15,5 F mit 40 g mehr Hähnchen und 4 g mehr Öl. Genauer geht es nicht, weil
die vier Werte nicht alle zugleich aufs Gramm passen und die Mengen auf
5 g oder 10 g gerundet werden. Danach steht alles im Editor wie jede andere
Änderung: ansehen, nachbessern, noch einen Wunsch hinterher, „Speichern, für
beide“.

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
Einstellungen → KI-Schlüssel (oder gleich in der Resteverwertung) einfügen. Beide Antworten werden gestreamt, die Leiste zeigt
Modell und Kosten der Anfrage.

Der Schlüssel steht nur im localStorage (`boxenstopp.ki.v1`), nirgends im Code
oder im Repo. Aufs zweite Handy kommt er mit dem Link fürs zweite Handy in den
Einstellungen (`…#zugang=<GitHub>&ki=<KI>`) oder mit „Link fürs zweite Handy kopieren“ im
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
3. In der App: Einstellungen → **Gemeinsame Liste** (oder über der Liste
   „Einrichten“) → Name und Schlüssel → Verbinden. Was schon lokal auf der
   Liste stand, kommt mit; danach zeigt die App die Liste.
4. Zweites Handy: in den Einstellungen **„Link fürs zweite Handy kopieren“**
   (oder „Per WhatsApp schicken“). Der Link öffnet die App in den
   Einstellungen mit eingetragenem Schlüssel, dort fehlt nur noch der Name.
   - iPhone: Eine App auf dem Home-Bildschirm hat dort einen eigenen Speicher,
     getrennt von Safari, und Links öffnen immer Safari. Also erst zum
     Home-Bildschirm hinzufügen, die App von dort öffnen und den ganzen Link
     ins Schlüsselfeld einfügen. Die App sagt das auf dem iPhone auch selbst
     (im Hinweis „Nur auf diesem Handy“ und unter dem Link in Safari).

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

### Push-Nachrichten

Bescheid aufs Handy oder iPad, auch wenn die App zu ist: „Amy hat 6 Sachen
auf die Liste gesetzt: …“, „Tobi hat alles eingekauft ✓“, „Neues Rezept von
Amy: Kokos-Curry ♡“, eine neue Notiz zu einem Rezept, „Preisalarm:
Hähnchenbrustfilet 8,65 €/kg bei Aldi“ – nie an den, der es war. Antippen
öffnet den passenden Reiter.

Verschickt werden sie nicht vom Handy, sondern von GitHub Actions im
privaten Daten-Repo (`werkzeug/push.mjs` aus diesem Repo, Web Push mit
VAPID über das npm-Paket `web-push`):

- **Liste:** Die App hängt an die Commit-Nachricht „· Bescheid“, wenn eine
  Änderung eine Nachricht wert ist (`bescheidNoetig` in `js/liste.js`: etwas
  Neues auf der Liste, ein neues Rezept von Amy, eine Notiz, das Letzte im
  Wagen) – abhaken, kochen, verschieben nicht. Nur dann läuft
  `benachrichtigen.yml` im Daten-Repo; es liest, was diese Commits gebracht
  haben, und merkt sich in `push.json`, bis wohin gemeldet ist (nichts
  doppelt, beim ersten Lauf nur, was höchstens zwei Stunden alt ist).
- **Preisalarm:** nach jedem privaten Angebots-Lauf (`angebote.yml` im
  Daten-Repo) mit den öffentlichen und den privaten Angeboten; was gemeldet
  ist, steht in `push.json` und kommt nicht noch einmal.
- Wer was bekommt, steht in `push.json` im Daten-Repo: der öffentliche
  Schlüssel und je Person ihre Geräte (Adresse beim Push-Dienst von Google
  oder Apple, Gerät, was ankommen soll). Ein Gerät, das sich abgemeldet hat
  (410), fällt beim nächsten Senden raus. Die Läufe geben nie Schlüssel oder
  Adressen aus.

**Einmal einrichten** (einer von euch):

1. In der App: Einstellungen → Push-Nachrichten → **Einrichten**. Das Gerät
   erzeugt ein Schlüsselpaar (WebCrypto, P-256).
   Das geht auf jedem Gerät, auch wenn es selbst gerade keine Mitteilungen
   darf. Bis „Fertig“ oder „Abbrechen“ liegt das Paar im Speicher des
   Geräts (höchstens zwei Stunden) – falls Android die App schließt, während
   man zum Kopieren bei GitHub ist.
2. Auf GitHub: Boxenstopp-Daten → Settings → Secrets and variables → Actions
   → New repository secret: `VAPID_PUBLIC_KEY` mit dem öffentlichen
   Schlüssel („Öffentlichen kopieren“), dann `VAPID_PRIVATE_KEY` mit dem
   privaten („Privaten kopieren“). Der private gehört nur dorthin – nicht in
   einen Chat, nicht ins Repo; die App behält ihn nicht.
3. „Fertig – Push einschalten“: Der öffentliche Schlüssel kommt nach
   `push.json`, dieses Gerät meldet sich an.
4. Jedes weitere Gerät: dort „Push-Nachrichten einschalten“. Auf iPhone und
   iPad geht das nur in der App vom Home-Bildschirm (iOS 16.4 oder neuer).
   Sind Mitteilungen für Boxenstopp verboten, sagt die App, wo man sie
   erlaubt (Android: Symbol lange drücken → App-Info → Benachrichtigungen;
   im Chrome-Tab über die Website-Einstellungen; iPhone/iPad: Einstellungen →
   Mitteilungen → Boxenstopp), und merkt es, sobald man zurückkommt.
   Häkchen wählen, was ankommt (Einkaufsliste, Amys Rezepte, Preisalarm);
   „Probe schicken“ lässt den Lauf eine Probe schicken (ca. eine Minute).

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
 "gepinnt": { "chili": { "by": "Tobi", "at": "2026-10-28T19:20:00.000Z" } },
 "amy": { "amy-kokos-curry-x7k2": { "name": "Kokos-Curry", "bild": "curry-rice", "portionen": 4, "zeit": 0, "zutaten": ["500 g Hähnchenbrust", "2 Zwiebeln"], "schritte": ["Zwiebeln würfeln", "15 Min. köcheln"], "notiz": "", "by": "Amy", "at": "…", "geaendert": "…" } },
 "angebote": { "stand": "…", "von": "Tobi", "eintraege": [{ "id": "a-mh9x…", "laden": "Aldi", "name": "Hähnchenbrustfilet", "preis": 7.49, "menge": 1, "einheit": "kg", "bis": "2026-11-01", "k": "haehnchenbrust" }] },
 "kochen": { "amy": { "at": "2026-10-29T18:05:00.000Z", "schritte": { "chili": [0, 1, 2] }, "tempo": { "offen": {}, "proben": […], "gesamt": {} }, "timer": [{ "id": "t-…", "rid": "chili", "schritt": 5, "label": "Chili: köcheln", "minuten": 20, "ende": 1793304000000, "…": "…" }] } },
 "fehlt": { "haehnchenbrust": { "laden": "Aldi", "by": "Amy", "at": "…" } },
 "bons": { "haehnchenbrust": [{ "eur": 5.49, "q": 1000, "u": "g", "laden": "Aldi", "by": "Amy", "at": "…" }] },
 "preisalarm": { "haehnchenbrust": { "max": 7.5, "u": "kg", "name": "Hähnchenbrustfilet", "by": "Tobi", "at": "…" } }
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
`ki-<zutat>`. `gepinnt` sind die Rezepte, die gerade laufen (höchstens vier,
das älteste fällt raus). `angebote` sind die Angebote der Woche (höchstens 120), `k`
ist der Katalog-Schlüssel der Zutat, wenn es eine ist. `amy` sind Amys Rezepte
(`{ "amy-kokos-curry-x7k2": { "name", "bild", "portionen", "zeit", "zutaten": ["500 g Hähnchenbrust", …], "schritte": […], "notiz", "by", "at", "geaendert" } }`);
ihre Zutaten liegen auf der Liste unter dem Katalog-Schlüssel oder als
`amyz-<zutat>`, mit der amy-id als Teil; ihre Tags stehen unter `amyTags`
(`{ "amy-kokos-curry-x7k2": ["gesund", "bauchfreundlich"] }`). `abteilungen`
sind verschobene Zeilen (`{ "amyz-dino-nuggets": "tk", "n:kackbuerste": "haushalt" }`),
`gleich` zusammengelegte (`{ "amyz-leckere-dino-nuggies": "amyz-dino-nuggets" }`),
`ungleich` die Paare mit „Nein, verschieden“ (`["n:hafermilch|n:hafermilch-barista"]`). `wege` ist je Laden der Weg durch
den Markt: `{ "Aldi": { "n": 3, "at": "…", "k": { "zwiebeln": { "c": "obst", "p": [0.1, 0.05] }, "n:bananen": { "c": "obst", "p": [0.2] } } } }`
– `p` die Stellen (0 vorn, 1 hinten) der letzten Einkäufe, `n` wie viele es waren. `kochen` ist der
Kochstand je Person (Name klein, höchstens sechs; die neueste Fassung `at` gewinnt), `fehlt` was in einem
Laden nicht da war, `bons` die letzten fünf Preise je Zutat (höchstens 200 Zutaten), `preisalarm` die
Wunschpreise (`u`: kg, l oder Stk). Von Hand bearbeiten geht, die App bereinigt beim Lesen alles, was
nicht passt; schreibt eine ältere App-Fassung die Liste ohne die neueren Teile, legt das Handy, das sie
kennt, sie wieder dazu (`js/speicher.js`).

Daneben liegen im Daten-Repo `angebote-privat.json` (Rewe und Edeka über
kaufDA) und `push.json` (Push-Nachrichten: `schluessel`, `abos` je Person,
`zuletzt`, `gemeldet`, eine bestellte Probe `test`).

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
neues Rezept muss dort nichts geändert werden. Dafür braucht es ein Motiv
fürs Foto in `werkzeug/bilder.mjs` (`MOTIVE`, auf Englisch, ohne Schwein und
Fisch – `test-bilder.mjs` prüft das); das Foto selbst macht nach dem Push
die Action „Rezeptfotos“.

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
| `js/ansicht-rezepte.js`, `js/ansicht-liste.js` | Rezepte (mit Preis und Sortierung) und Einkaufsliste |
| `js/amy.js` | Amys Rezepte: Zeilen lesen, Einkaufsliste, Nährwerte, Kosten, Schritte – ohne DOM |
| `js/ansicht-amy.js` | Reiter Amys Rezepte: Liste mit Tags zum Filtern und Sortieren, Rezept, Editor |
| `js/ansicht-tablet.js` | Popup: die App aufs iPad oder Tablet |
| `js/amy-import.js` | Rezept übernehmen: Anfrage aus Foto, Link oder Text, Antwort als Entwurf – ohne DOM |
| `js/kochmodus.js` | Kochmodus: ein Schritt groß, Wischen, Tasten, Timer, Bildschirm an |
| `js/kochstand.js` | Haken, Tempo und Timer je Person über ihre Geräte (`kochen` in liste.json) |
| `js/push.js`, `js/ansicht-push.js` | Push-Nachrichten: Schlüsselpaar, An- und Abmelden in push.json, der Bereich in den Einstellungen |
| `js/ansicht-einstellungen.js` | Reiter Einstellungen: welche Reiter unten stehen, KI-Schlüssel, Gelerntes vergessen, Fassung und Updates |
| `js/preisverlauf.js` | Preisverlauf je Zutat und Woche, „Tiefstpreis seit …“ – ohne DOM |
| `js/gleich.js` | dasselbe Produkt unter zwei Namen: Namen vergleichen, Vorschläge, wohin zusammenlegen – ohne DOM |
| `js/tempo.js` | euer Tempo: aus den Haken lernen, Zeiten umrechnen – ohne DOM |
| `js/weg.js` | der Weg durch den Laden: Stellen aus den Haken, Liste in dieser Reihenfolge – ohne DOM |
| `js/format.js` | Mengen, Zahlen, Abteilung raten |
| `js/zeiten.js` | Zeiten aus den Schritten: Abschnitte, Gesamtzeit, „währenddessen“; welcher Schritt einen Timer braucht |
| `js/timer.js` | Küchentimer: starten, Stufen, Leiste oben, Alarm, überlebt Neuladen |
| `js/lob.js` | Belohnung: Sprüche, Tierquellen, Vorladen, Overlay mit Konfetti |
| `js/kosten.js` | Richtpreise auf Mengen: Liste, eigene Rezepte, Euro-Format |
| `js/angebote.js` | Angebote: Zeilen lesen, Schlüssel raten, Treffer und Ersparnis, Anfrage an die KI – ohne DOM |
| `js/ansicht-angebote.js` | Reiter Angebote: automatischer Abruf, eigene Angebote, passende Rezepte, Rezept daraus |
| `js/bilder.js` | Bildchen je Zutat (Schlüssel, Stichwort, Abteilung) und für Rezepte ohne Foto – ohne DOM |
| `werkzeug/bilder.mjs`, `.github/workflows/bilder.yml` | Rezeptfotos per KI (Cloudflare Workers AI) → bilder/rezepte |
| `werkzeug/zutaten-bilder.mjs` | Bildchen aus Fluent Emoji → bilder/zutaten (mit alle.json für den Offline-Vorrat) |
| `werkzeug/angebote.mjs` | holt die Angebote mit Produktfoto (Aldi, Kaufland, Penny, Lidl per Gemini) → daten/angebote.json |
| `.github/workflows/angebote.yml` | Montag, Donnerstag und Sonntag: Angebote holen, Preisverlauf rechnen, einchecken |
| `werkzeug/preisverlauf.mjs` | aus der Git-Historie von daten/angebote.json → daten/preisverlauf.json |
| `werkzeug/push.mjs` | Push-Nachrichten verschicken (läuft im Daten-Repo: `benachrichtigen.yml`, `angebote.yml`) |
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
`tests/daten/ki-antwort.json`. `test-bilder.mjs` prüft ohne Browser, dass
jede Zutat ein Bildchen hat und jedes Foto zu seinem Rezept passt
(Prüfsumme). `test-tempo.mjs` prüft ohne Browser, welche Schritte einen
Timer bekommen, und spielt einen Kochabend mit vorgestellter Uhr durch.
`test-amy.mjs` liest Amys Zeilen in Node und spielt ihren Reiter dann auf
zwei Handys durch (Editor, Entwurf, Liste zusammen mit einem festen Rezept,
Timer, Tags mit Filter und Sortierung, Löschen, eine ältere App-Fassung ohne
`amy`, `amyTags` und `wege`). `test-gleich.mjs` vergleicht Namen und legt in
Node zusammen, dann im Browser auf zwei Handys (Kackbürste zum Haushalt,
„leckere Dino nuggies“ und „Dino nuggets“ zusammen, Rückgängig, von Hand,
gemerkt fürs nächste Mal, „Nein, verschieden“). `test-tablet.mjs` spielt das
iPad-Popup durch (von selbst nur bei Amy auf dem iPhone, Link kopieren,
damit ein iPad einrichten, hin und her). `test-weg.mjs` lernt
den Weg durch Aldi in Node und im Browser (abhaken, nächster Einkauf
sortiert, vergessen, lange Pause). `test-kochen.mjs` spielt den Kochmodus auf
dem iPad durch und den Kochstand über iPad, iPhone und Tobis Handy.
`test-einkauf.mjs` prüft „nicht bekommen“, Bons, Preisalarm und Preisverlauf
in Node (auch `werkzeug/preisverlauf.mjs` auf einer Git-Historie) und im
Browser. `test-push.mjs` lässt `werkzeug/push.mjs` auf einem Daten-Repo zum
Probieren laufen (an wen, nichts doppelt, Preisalarm, Probe, Nachtragen,
Senden über eine web-push-Attrappe) und spielt dann im ganzen Chromium
(nur dort lassen sich Mitteilungen erlauben) Einrichten, An/Aus und die
Mitteilung aus dem Service Worker durch. `test-import.mjs` prüft den
Rezept-Import mit einer nachgebauten Gemini-API. `test-einstellungen.mjs`
spielt den Reiter Einstellungen durch (Leiste mit Kurzform, Reiter
ausblenden, umsortieren und merken, hell und dunkel, Einrichten über Hinweis und Link, KI-Schlüssel,
Gelerntes vergessen und wiederholen, breit mit dem Zahnrad, die Fassung). Der Workflow „Prüfung“ lässt
Linter und alle Tests bei jedem Push laufen.
