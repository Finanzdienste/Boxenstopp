/*
 * Resteverwertung, der Gesprächsteil: die Anfrage an die KI und das Lesen der
 * Antwort – direkt vom Handy aus, mit dem eigenen Schlüssel (zugang.js, nur
 * im localStorage). Zwei Anbieter, der Schlüssel entscheidet:
 *
 *   AQ.… oder AIza…  Google, Gemini-API (gemini-3.8-flash) über die
 *             Interactions-API. Kostenlos ohne Kreditkarte; dafür darf Google
 *             die Anfragen zum Verbessern seiner Produkte nutzen. Das ist der
 *             normale Weg. AI Studio gibt seit Mai 2026 nur noch Schlüssel
 *             mit „AQ.“ aus (Auth Keys); die älteren „AIza“ gehen weiter.
 *   sk-ant-…  Anthropic, Messages-API (claude-fable-5-1, das stärkste Modell),
 *             etwa 30 Cent pro Rezept vom Guthaben der Console – bei einem
 *             Claude-Abo Max oder Ultra aus dessen Monatsguthaben (100 bzw. 200 $
 *             im Monat), sonst
 *             gekauft. Der Kopf „anthropic-dangerous-direct-browser-access“
 *             erlaubt den Aufruf aus dem Browser, wenn – wie hier – jeder
 *             seinen eigenen Schlüssel mitbringt.
 *
 * Beide liefern das Rezept als JSON nach SCHEMA (ki-rezept.js): Gemini als
 * JSON-Antwort mit response_format, Claude als JSON nach Schema über
 * output_config (Structured Outputs; das Schema geht durch schemaFuerClaude,
 * weil Anthropic ein paar Schlüsselwörter nicht kennt). Beides Stück für Stück
 * gestreamt – so sieht man, dass etwas passiert, und eine lange Antwort reißt
 * nicht ab. Fotos gehen als JPEG mit, vorher auf höchstens 1280 px verkleinert
 * (ansicht-ki.js).
 *
 * Vier Aufträge (modus): reste (was da ist), angebote (aus den Angeboten),
 * aendern (ein Rezept nach Wunsch ändern) und wunsch (ein neues Rezept für den
 * gemeinsamen Katalog, katalog.js – ein Wort wie „Kürbissuppe“ reicht).
 *
 * Dazu Claude mit Werkzeugen (kiMitWerkzeugen): im Internet suchen und
 * Seiten lesen – für Amys „Im Internet suchen“ und Links beim Übernehmen
 * (amy-import.js). Das macht claude-sonnet-5-5: Rezepte finden und abschreiben
 * braucht nicht das stärkste Modell, und die gelesenen Seiten kosten sonst
 * fünfmal so viel.
 *
 * anfrageBauen() und rumpfFuer() sind ohne Netz und ohne DOM, tests/test-ki.mjs
 * prüft daran, dass alle Regeln mitgehen.
 */
import { SCHEMA } from './ki-rezept.js';

export const ANBIETER = {
  gemini: {
    name: 'Google',
    modell: 'gemini-3.8-flash',
    api: 'https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse',
    preis: null, // kostenlos
  },
  anthropic: {
    name: 'Anthropic',
    modell: 'claude-fable-5-1',
    // Suchen und Seiten lesen (kiMitWerkzeugen) – kennt der Schlüssel es nicht, nimmt die App das Modell oben
    suchModell: 'claude-sonnet-5-5',
    api: 'https://api.anthropic.com/v1/messages',
    preis: { ein: 10, aus: 50 }, // US-Dollar pro Million Tokens (Fable 5.1)
  },
};
/** Welcher Anbieter zu einem Schlüssel gehört – oder '' für keinen. */
export const anbieterVon = (schluessel) => (/^(?:AQ\.|AIza)/.test(String(schluessel || '')) ? 'gemini' : /^sk-ant-/.test(String(schluessel || '')) ? 'anthropic' : '');
export const KI_API = ANBIETER.anthropic.api;
export const MODELL = ANBIETER.anthropic.modell;

/*
 * Das Schema so, wie Anthropics Structured Outputs es nehmen: jedes Objekt mit
 * additionalProperties: false; Zahlengrenzen (minimum, maximum), Längen und
 * title kennt es nicht – die Grenzen wandern als Text in die description,
 * damit das Modell sie trotzdem einhält. minItems nur 0 oder 1.
 */
export function schemaFuerClaude(schema) {
  const FORMATE = new Set(['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid']);
  const um = (k) => {
    if (Array.isArray(k)) return k.map(um);
    if (!k || typeof k !== 'object') return k;
    const n = {};
    const grenzen = [];
    for (const [key, wert] of Object.entries(k)) {
      if (key === 'minimum') { grenzen.push(`mindestens ${wert}`); continue; }
      if (key === 'maximum') { grenzen.push(`höchstens ${wert}`); continue; }
      if (['exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'maxItems', 'title', 'uniqueItems'].includes(key)) continue;
      if (key === 'minItems') { if (wert === 0 || wert === 1) n[key] = wert; continue; }
      if (key === 'format') { if (FORMATE.has(wert)) n[key] = wert; continue; }
      if (key === 'properties' || key === '$defs' || key === 'definitions') { n[key] = Object.fromEntries(Object.entries(wert || {}).map(([pk, pv]) => [pk, um(pv)])); continue; }
      if (['items', 'anyOf', 'allOf', 'oneOf', 'not'].includes(key)) { n[key] = um(wert); continue; }
      n[key] = wert;
    }
    if (grenzen.length) n.description = `${n.description ? `${n.description} ` : ''}(${grenzen.join(', ')})`;
    if (n.type === 'object' || n.properties) n.additionalProperties = false;
    return n;
  };
  return um(schema);
}

/** Der Teil der Anfrage an Claude, der die Antwort als JSON nach dem Schema verlangt. */
export const ausgabeFuerClaude = (schema) => ({ output_config: { format: { type: 'json_schema', schema: schemaFuerClaude(schema) } } });

export function systemText({ portionen, ziel, dazukaufen, katalog, modus = 'reste', wer = 'Tobi und Amy' }) {
  const kat = Object.entries(katalog || {})
    .filter(([, v]) => v.c !== 'haushalt')
    .map(([k, v]) => `${k}=${v.n}`)
    .join('; ');
  const ausgabe = 'als JSON genau nach dem vorgegebenen Schema'; // beide Anbieter: JSON nach Schema
  const angebote = modus === 'angebote';
  const aendern = modus === 'aendern';
  const wunsch = modus === 'wunsch';
  const auftrag = wunsch
    ? `Du schreibst EIN richtig gutes Meal-Prep-Rezept für ${portionen} gleiche Boxen nach dem Wunsch von ${wer.replace(' und ', ' oder ')} und gibst es ${ausgabe} aus. Steht im Wunsch nur ein Gericht („Kürbissuppe“), machst du die bewährte Fassung davon – als ganze Mahlzeit für die Box: Fehlen dem Gericht für das Ziel mageres Protein oder eine Sättigungsbeilage, kommen sie passend dazu (in eine Suppe etwa Hähnchen oder rote Linsen, dazu Brot, Kartoffeln oder Reis). Steht mehr im Wunsch, hältst du dich an alles, was dort steht. Das Rezept kommt in den Katalog der App, den alle nutzen – also ein Gericht, das man gern wieder kocht.`
    : aendern
    ? `Du änderst ein bestehendes Rezept so, wie ${wer.replace(' und ', ' oder ')} es sich wünschen, und gibst das ganze geänderte Rezept für ${portionen} gleiche Boxen ${ausgabe} aus. Ändere nur, was der Wunsch verlangt, und was dafür nötig ist: Zutaten, Schritte, Schalen, Zeiten, Name und Beschreibung, wenn sie nicht mehr stimmen. Alles andere bleibt genau so – dieselben Zutaten mit derselben id, Menge, min, max, anpassbar und pro100, dieselben Schritte im selben Wortlaut. Neue Zutaten bekommen eine neue id, weggefallene verschwinden auch aus den Schritten. Lässt sich der Wunsch nicht erfüllen, ohne gegen die Regeln unten zu verstoßen, änderst du so wenig wie möglich und sagst es in hinweis.`
    : angebote
    ? `Aus den Angeboten der Woche bei ihren Supermärkten machst du EIN richtig gutes Rezept für ${portionen} gleiche Boxen und gibst es ${ausgabe} aus. Die Hauptzutaten (Protein, Sättigungsbeilage, Gemüse) sollen möglichst aus den Angeboten kommen; sie sind alle zu kaufen (quelle: kaufen), nichts davon ist schon da. Was fehlt, kommt normal dazu.`
    : `Aus dem, was bei ihnen noch im Kühlschrank und im Vorrat ist, machst du EIN richtig gutes Rezept für ${portionen} gleiche Boxen und gibst es ${ausgabe} aus.`;
  return `Du bist der Meal-Prep-Koch von ${wer}. ${auftrag}

Ziel pro Box: ${ziel.kcal} kcal, ${ziel.p} g Protein, ${ziel.kh} g Kohlenhydrate, ${ziel.f} g Fett. Die App rechnet die Nährwerte selbst aus deinen Werten pro 100 g nach und verschiebt die Mengen der Zutaten mit anpassbar: true zwischen min und max, bis jede Box das Ziel trifft. Plane das Gericht so, dass das mit sinnvollen Mengen aufgeht: genug mageres Protein, eine Sättigungsbeilage, Fett vor allem aus Öl, Käse oder Sahne.

Feste Regeln:
- Kein Fisch und keine Meeresfrüchte, auch nichts, was sie enthält (Fischsauce, Garnelenpaste, Sardellen, Worcestersauce). Bei Currypaste „vegan“ dazuschreiben.
- Kein Schweinefleisch in jeder Form (Speck, Schinken, Salami, Chorizo, Wurst, gemischtes Hack, Gelatine) und kein Putenhack. Hähnchen, Putenbrust, Rind, Eier, Hülsenfrüchte und Milchprodukte sind gut.
- Kein Hüttenkäse und kein Quark oder Skyr in warmen Saucen – die werden körnig. Quark und Skyr nur kalt (Dip, Marinade).
- Richtig lecker und ordentlich gewürzt, so dass man es gern vier Tage hintereinander isst. Lieber ein bewährtes Gericht gut gemacht als ein wildes Experiment.
- ${wunsch
    ? 'Alles wird eingekauft (quelle: kaufen, Packungsgröße in packung), nichts ist schon da; Öl, Mehl, Brühe, Zucker, Senf und Sojasauce sind vorrat. Möglichst ganze Supermarkt-Packungen (500 g Hackfleisch, 1 Dose Kokosmilch, 1 Hokkaido-Kürbis), damit nichts übrig bleibt. Bei anpassbar min und max großzügig (etwa halb bis doppelt so viel), damit die App das Rezept auch auf andere Ziele rechnen kann. Hast du dem Gericht etwas fürs Ziel dazugegeben, sagst du es in hinweis in einem Satz.'
    : aendern
    ? 'Was der Wunsch neu braucht, wird gekauft (quelle: kaufen, Packungsgröße in packung) – so wenig wie nötig und in Supermarkt-Packungen. Ersetzt eine fertige Zutat mehrere (fertige Sauce statt selbst gemacht), fallen die alten mit ihren Schritten weg. In hinweis sagst du in einem Satz, was du geändert hast.'
    : angebote
    ? 'Nutze so viele Angebote wie sinnvoll, aber kein Gericht erzwingen: lieber drei Angebote in einem stimmigen Rezept als sechs in einem seltsamen. In hinweis sagst du kurz, welche Angebote drin sind.'
    : `Was da ist, zuerst verbrauchen, vor allem Frisches. ${dazukaufen
      ? 'Was fehlt, darf dazugekauft werden – so wenig wie nötig und in Supermarkt-Packungen.'
      : 'Es wird nichts dazugekauft: nur, was da ist, plus Öl, Salz, Pfeffer, Gewürze, Brühe, Mehl, Zucker und Senf aus dem Vorrat. Geht das Ziel damit nicht auf, sag es in hinweis.'}`}
- Meal-Prep-tauglich: hält 3–4 Tage im Kühlschrank und lässt sich aufwärmen. Frisches, Dips und Toppings kommen in Döschen.

Zutaten:
- menge für alle ${portionen} Boxen zusammen, roh gewogen (Reis und Nudeln trocken), in g, Flüssigkeiten in ml; bei Stückware zusätzlich stueck, z. B. „2 Stück“.
- pro100: realistische Werte pro 100 g bzw. 100 ml wie auf Etiketten im deutschen Supermarkt.
- quelle: vorhanden (steht im Text oder ist auf einem Foto), kaufen (fehlt) oder vorrat (Öl, Mehl, Brühe, Zucker, Senf, Sojasauce – hat man meist).
- Bei vorhanden ist max höchstens die Menge, die da ist (vom Foto geschätzt). Bei kaufen steht die Packungsgröße in packung, und die Menge ist möglichst eine ganze Packung oder ein sinnvoller Teil davon.
- anpassbar: true für die Mengen, die die Nährwerte bestimmen: Fleisch und andere Proteine, Reis, Nudeln, Kartoffeln, Öl, Käse, Sahne. Gemüse und Stückware: false.
- katalog: der passende Schlüssel aus dieser Liste, wenn es die Zutat dort gibt, sonst leer: ${kat}
- Gewürze in Löffelmengen (TL, EL, Prise) gehören in gewuerze, nicht in zutaten.

Zubereitung, genau so, wie die App sie zeigt:
- Drei Abschnitte: vorbereiten, kochen, portionieren.
- vorbereiten ist Mise en place: Alles wird geschnitten, abgewogen und abgemessen, bevor der Herd angeht, und kommt in nummerierte Schalen: „→ Schale 2“. Öl, Salz, Gewürze, Säfte und Flüssigkeiten gehören dazu (in eine Schale, eine Tasse oder den Messbecher). Gewürze für Fleisch zuerst in die Schale abmessen, dann das Fleisch schneiden und untermischen. Fleisch kommt zuletzt aufs Brett, danach: „Brett und Messer heiß abwaschen, Hände waschen“. Einmal: „Den großen Topf leer wiegen und unten im Rechner bei „Gefäß leer“ eintragen“ (oder Pfanne, Bräter, Form).
- Schalen nummerierst du in der Reihenfolge, in der sie beim Kochen gebraucht werden, höchstens 6, Name kurz (z. B. „Zwiebeln & Knoblauch“), Größe klein, mittel oder groß.
- Beim Kochen wird nichts mehr abgewogen, abgemessen oder ausgepresst, nur noch „Schale 2 dazu“ – außer eine Zutat geht als ganze Packung direkt in den Topf. Abschmecken ohne Mengen.
- Ein Schritt ist genau eine Handlung, höchstens 140 Zeichen, du-Form. Mehrere kleine Dinge für eine Schale: text „In Schale 3 abmessen:“ und die Dinge in liste.
- Mengen der Zutaten schreibst du immer als Platzhalter {id}: „{reis} Reis im Sieb waschen“, „{zwiebeln} Zwiebeln schälen und fein würfeln → Schale 1“ – nie als Zahl, die App passt die Mengen noch an. Gewürzmengen (TL, EL) schreibst du direkt.
- min: Minuten für einen Hobbykoch in ruhigem Tempo, mit Waschen und Schälen: Zwiebel fein würfeln 3 pro Stück, in Streifen 2; Knoblauch 1 pro Zehe; Paprika 2–3 pro Stück; Zucchini 2–3 pro Stück; Möhre 1,5–3 pro Stück; Brokkoli 1 pro 100 g; Champignons 1,5 pro 100 g; Kartoffeln schälen 1 pro 100 g, würfeln 0,7 pro 100 g; Fleisch schneiden 1 pro 100 g; Käse reiben 2 pro 100 g; ein Gewürz abmessen ½. Kochzeiten wie im Text.
- ruhe: Wartezeit, die danach im Hintergrund weiterläuft (Marinieren, Ofen vorheizen, Wasser aufkochen etwa 12, Reis quellen). nebenbei: true für einen Schritt, der in der Wartezeit des Schritts davor passiert (Reis aufsetzen, während die Sauce köchelt).
- portionieren: Topf mit dem Essen wiegen und im Rechner bei „Mit Essen“ eintragen, die Boxen füllen, Döschen gleich mit Deckel kalt stellen, zum Schluss „Offen abkühlen lassen, höchstens 1–2 Std., dann Deckel drauf und kalt stellen“.

Antworte nur mit dem JSON, ohne Text davor oder danach, alles auf Deutsch.`;
}

export function nutzerText({ text, wuensche, fotos = 0, portionen, dazukaufen, mag = [], magNicht = [], vermeiden = [], modus = 'reste', rezept = null, wunsch = '' }) {
  // Ändern: das Rezept, wie es jetzt ist, im Format der Antwort – und was anders sein soll
  if (modus === 'aendern') return ['Das Rezept, wie es jetzt ist (JSON im Format deiner Antwort):', JSON.stringify(rezept), '', `Was anders sein soll: ${String(wunsch || '').trim()}`].join('\n');
  // Ein neues Rezept nach Wunsch: ein Wort oder ein ganzer Text
  if (modus === 'wunsch') {
    const z = ['Der Wunsch:', String(text || '').trim(), '', `Portionen: ${portionen}`];
    if (mag.length) z.push(`Das mögen sie (Daumen hoch): ${mag.join(', ')}`);
    if (magNicht.length) z.push(`Das mögen sie nicht (Daumen runter): ${magNicht.join(', ')}`);
    if (vermeiden.length) z.push(`Diesmal anders als: ${vermeiden.join(', ')}`);
    return z.join('\n');
  }
  const zeilen = [
    modus === 'angebote' ? 'Das ist diese Woche im Angebot:' : 'Das ist noch da:',
    String(text || '').trim() || '(steht nur auf den Fotos)',
  ];
  if (fotos) zeilen.push('', `${fotos === 1 ? 'Auf dem Foto ist' : `Auf den ${fotos} Fotos ist`}, was im Kühlschrank und im Vorrat liegt.`);
  zeilen.push('', `Portionen: ${portionen}`, `Dazukaufen: ${dazukaufen ? 'ja, wenn nötig' : 'nein'}`, `Wünsche: ${String(wuensche || '').trim() || 'keine'}`);
  if (mag.length) zeilen.push(`Das mögen sie (Daumen hoch): ${mag.join(', ')}`);
  if (magNicht.length) zeilen.push(`Das mögen sie nicht (Daumen runter): ${magNicht.join(', ')}`);
  if (vermeiden.length) zeilen.push(`Bitte nicht noch einmal: ${vermeiden.join(', ')}`);
  return zeilen.join('\n');
}

/** Der Rumpf der Anfrage an Anthropics /v1/messages (ohne stream – das setzt kiAnfragen). */
export function anfrageBauen(e) {
  const inhalt = (e.fotos || []).map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }));
  inhalt.push({ type: 'text', text: nutzerText({ ...e, fotos: (e.fotos || []).length }) });
  return {
    model: MODELL,
    max_tokens: 16000,
    system: systemText({ ...e, anbieter: 'anthropic' }),
    ...ausgabeFuerClaude(SCHEMA),
    messages: [{ role: 'user', content: inhalt }],
  };
}

/*
 * Der Rumpf der Anfrage an Geminis Interactions-API (POST /v1beta/interactions).
 * store: false – Google soll die Anfrage nicht als Gesprächsverlauf aufheben.
 */
export function anfrageBauenGemini(e) {
  const input = (e.fotos || []).map((b64) => ({ type: 'image', data: b64, mime_type: 'image/jpeg' }));
  input.push({ type: 'text', text: nutzerText({ ...e, fotos: (e.fotos || []).length }) });
  return {
    model: ANBIETER.gemini.modell,
    system_instruction: systemText({ ...e, anbieter: 'gemini' }),
    input,
    response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    generation_config: { max_output_tokens: 16000 },
    store: false,
    stream: true,
  };
}

/** Der passende Rumpf für den Anbieter des Schlüssels. */
export const rumpfFuer = (anbieter, e) => (anbieter === 'gemini' ? anfrageBauenGemini(e) : anfrageBauen(e));

/* ------------------------------------------------------------- Fehler */

export const KI_FEHLER = {
  gemini: {
    schluessel: 'Google lehnt den Schlüssel ab. Prüf ihn unter aistudio.google.com → API keys und trag ihn neu ein.',
    grenze: 'Das Gratis-Kontingent bei Google ist für heute aufgebraucht oder gerade zu viele Anfragen. In einer Minute nochmal – spätestens morgen ab 9 Uhr geht es wieder.',
    ueberlastet: 'Gemini ist gerade überlastet. Gleich nochmal versuchen.',
    netz: 'Keine Verbindung zu Google. Prüf das Internet und versuch es nochmal.',
    sicherheit: 'Gemini wollte zu diesem Foto oder Text kein Rezept machen. Versuch es mit einer Liste statt Foto.',
  },
  anthropic: {
    schluessel: 'Anthropic lehnt den Schlüssel ab. Prüf ihn unter platform.claude.com → API Keys und trag ihn neu ein.',
    guthaben: 'Auf dem Anthropic-Konto ist kein Guthaben: Das Monatsguthaben des Abos ist aufgebraucht (kommt mit der nächsten Abo-Zahlung wieder), oder es wurde noch keins verknüpft. Unter platform.claude.com → Billing nachsehen oder aufladen, dann nochmal.',
    workspace: 'Der Anthropic-Schlüssel gehört keinem Workspace. In der Console (platform.claude.com → API Keys) einen neuen Schlüssel anlegen und dabei den Default Workspace wählen, dann den neuen Schlüssel hier eintragen.',
    grenze: 'Gerade zu viele Anfragen. In einer Minute nochmal versuchen.',
    ueberlastet: 'Claude ist gerade überlastet. Gleich nochmal versuchen.',
    netz: 'Keine Verbindung zu Anthropic. Prüf das Internet und versuch es nochmal.',
    sicherheit: 'Claude wollte zu diesem Foto oder Text kein Rezept machen. Versuch es mit einer Liste statt Foto.',
    websuche: 'Bei Anthropic ist die Websuche für euer Konto ausgeschaltet. In der Console (platform.claude.com) unter Settings einschalten – dann geht es.',
  },
  zulang: 'Die Antwort wurde zu lang und ist abgebrochen. Nochmal versuchen, vielleicht mit weniger Zutaten.',
  zugross: 'Die Fotos sind zu groß. Nimm weniger Fotos.',
  modell: 'Das KI-Modell ist gerade nicht verfügbar.',
  antwort: 'Die Antwort war kein brauchbares Rezept. Nochmal versuchen.',
  abbruch: 'Abgebrochen.',
};

export function kiFehler(art, detail = '', anbieter = 'anthropic') {
  const e = new Error(KI_FEHLER[anbieter]?.[art] || KI_FEHLER[art] || KI_FEHLER.antwort);
  e.art = art;
  e.detail = String(detail || '').slice(0, 500);
  return e;
}

export function artVonStatus(status, info) {
  const text = `${info?.error?.type || ''} ${info?.error?.status || ''} ${info?.error?.message || ''}`;
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(text)) return 'schluessel';
  if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(text)) return 'grenze'; // vor „billing“: Googles Kontingent-Text nennt den Tarif
  if (status === 400 && /workspace/i.test(text)) return 'workspace'; // Schlüssel ohne Workspace: Anthropic will dann den Workspace im Kopf
  if (status === 400 && /web[ _]?(?:search|fetch)/i.test(text) && /not enabled|disabled/i.test(text)) return 'websuche'; // in der Console ausgeschaltet
  if (/credit|balance|billing|guthaben/i.test(text)) return 'guthaben';
  if (status === 413) return 'zugross';
  if (status === 404 || (status === 400 && /model/i.test(text))) return 'modell';
  if (status === 429) return 'grenze';
  if (status >= 500 || /overloaded/i.test(text)) return 'ueberlastet';
  return 'antwort';
}

/** Ungefähre Kosten einer Anfrage in Cent (US-Dollar ≈ Euro); 0 bei Gemini. */
export function kostenCent(usage, anbieter = 'anthropic') {
  const preis = ANBIETER[anbieter]?.preis;
  if (!preis) return 0;
  return ((usage.ein || 0) * preis.ein + (usage.aus || 0) * preis.aus) / 1e4;
}

/*
 * Die Anfrage abschicken und den Strom lesen (server-sent events). Gibt
 * { eingabe, usage, anbieter } zurück: eingabe ist das Rezept als JSON – mit
 * roh: true stattdessen { text, usage, anbieter }. Bei Claude kommt das JSON
 * als Text (text_delta, Structured Outputs); Werkzeug-Eingaben
 * (input_json_delta) werden zur Sicherheit genauso gelesen.
 * beiFortschritt({ zeichen, schritte }) meldet, wie weit die Antwort ist.
 * Der Anbieter ergibt sich aus dem Schlüssel; `api` übersteuert die Adresse
 * (für die Tests).
 */
export async function kiAnfragen(rumpf, { schluessel, api = '', signal, beiFortschritt = () => {}, roh: alsText = false }) {
  const anbieter = anbieterVon(schluessel) || 'anthropic';
  const gemini = anbieter === 'gemini';
  const fehler = (art, detail) => kiFehler(art, detail, anbieter);
  let res;
  try {
    res = await fetch(api || ANBIETER[anbieter].api, {
      method: 'POST',
      headers: gemini
        ? { 'content-type': 'application/json', 'x-goog-api-key': schluessel }
        : { 'content-type': 'application/json', 'x-api-key': schluessel, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(gemini ? rumpf : { ...rumpf, stream: true }),
      signal,
    });
  } catch (e) {
    throw fehler(e?.name === 'AbortError' ? 'abbruch' : 'netz', e?.message);
  }
  if (!res.ok) {
    let info = null;
    try { info = await res.json(); } catch { /* kein JSON */ }
    if (Array.isArray(info)) info = info[0]; // Gemini schickt Fehler im Strom als Liste
    const text = info?.error?.message || `HTTP ${res.status}`;
    // Kennt das Modell die Denkstufe nicht: einmal ohne sie
    if (gemini && res.status === 400 && /thinking/i.test(text) && rumpf.generation_config?.thinking_level) {
      const ohne = { ...rumpf.generation_config };
      delete ohne.thinking_level;
      return kiAnfragen({ ...rumpf, generation_config: ohne }, { schluessel, api, signal, beiFortschritt, roh: alsText });
    }
    throw fehler(artVonStatus(res.status, info), text);
  }
  if (!res.body?.getReader) throw fehler('antwort', 'kein Datenstrom');

  const leser = res.body.getReader();
  const dekoder = new TextDecoder();
  const usage = { ein: 0, aus: 0 };
  let puffer = '';
  let json = '';
  let werkzeug = gemini;
  let stopp = null;
  let grund = '';
  // schritte: so viele Schritte sind schon geschrieben; gerichte: so viele Gerichte einer Speisekarte (speisekarte.js)
  const fortschritt = () => beiFortschritt({ zeichen: json.length, schritte: (json.match(/"min"\s*:/g) || []).length, gerichte: (json.match(/"kcal"\s*:/g) || []).length });
  // Interactions-API: step.delta mit Text, zum Schluss interaction.completed mit Status und Verbrauch.
  const verarbeiteGemini = (ev) => {
    if (ev.event_type === 'error' || ev.error) throw fehler(artVonStatus(Number(ev.error?.code) || 500, ev), ev.error?.message);
    if (ev.event_type === 'step.delta') {
      if (ev.delta?.type === 'text' && typeof ev.delta.text === 'string') { json += ev.delta.text; fortschritt(); }
      return;
    }
    const ia = ev.interaction || ev;
    if (ia.usage) {
      usage.ein = Number(ia.usage.total_input_tokens) || usage.ein;
      usage.aus = (Number(ia.usage.total_output_tokens) || 0) + (Number(ia.usage.total_thought_tokens) || 0) || usage.aus;
    }
    if (ia.status && !['in_progress', 'completed'].includes(ia.status)) {
      stopp = ia.status === 'incomplete' ? 'MAX_TOKENS' : `${ia.status} ${ia.error?.message || ia.incomplete_details?.reason || ''}`.trim();
      grund = ia.incomplete_details?.reason || ia.error?.message || '';
    }
    // Falls der Text nicht gestreamt, sondern nur am Ende geliefert wurde:
    if (!json && Array.isArray(ia.steps)) {
      for (const st of ia.steps) if (st.type === 'model_output') for (const c of st.content || []) if (c.type === 'text' && typeof c.text === 'string') json += c.text;
    }
  };
  const verarbeite = (block) => {
    const daten = block.split('\n').filter((z) => z.startsWith('data:')).map((z) => z.slice(5).trimStart()).join('\n');
    if (!daten) return;
    let ev;
    try { ev = JSON.parse(daten); } catch { return; }
    if (gemini) { verarbeiteGemini(ev); return; }
    switch (ev.type) {
      case 'message_start':
        usage.ein = Number(ev.message?.usage?.input_tokens) || 0;
        return;
      case 'content_block_start':
        if (ev.content_block?.type === 'tool_use' || ev.content_block?.type === 'text') werkzeug = true;
        return;
      case 'content_block_delta':
        if (ev.delta?.type === 'input_json_delta' || ev.delta?.type === 'text_delta') {
          json += ev.delta?.type === 'text_delta' ? ev.delta.text || '' : ev.delta.partial_json || '';
          fortschritt();
        }
        return;
      case 'message_delta':
        stopp = ev.delta?.stop_reason || stopp;
        usage.aus = Number(ev.usage?.output_tokens) || usage.aus;
        return;
      case 'error':
        throw fehler(/overloaded/i.test(ev.error?.type || '') ? 'ueberlastet' : 'antwort', ev.error?.message);
      default:
    }
  };
  for (;;) {
    let stueck;
    try { stueck = await leser.read(); } catch (e) { throw fehler(e?.name === 'AbortError' ? 'abbruch' : 'netz', e?.message); }
    if (stueck.done) break;
    puffer += dekoder.decode(stueck.value, { stream: true }).replace(/\r\n/g, '\n');
    for (let i = puffer.indexOf('\n\n'); i >= 0; i = puffer.indexOf('\n\n')) {
      verarbeite(puffer.slice(0, i));
      puffer = puffer.slice(i + 2);
    }
  }
  if (puffer.trim()) verarbeite(puffer);
  if (stopp === 'max_tokens' || stopp === 'MAX_TOKENS') throw fehler('zulang', grund || `${json.length} Zeichen`);
  if (stopp === 'refusal') throw fehler('sicherheit', stopp);
  if (gemini && stopp && /safety|prohibited|blocklist|recitation|block/i.test(stopp)) throw fehler('sicherheit', stopp);
  if (gemini && stopp) throw fehler('antwort', stopp);
  if (!werkzeug || !json.trim()) throw fehler('antwort', 'keine Antwort');
  // Ohne festes Schema (etwa mit url_context): den Text zurück, das JSON sucht sich der Aufrufer
  if (alsText) return { text: json, usage, anbieter };
  // Zur Sicherheit: Gemini packt JSON hin und wieder in ```json … ```.
  const roh = json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return { eingabe: JSON.parse(roh), usage, anbieter };
  } catch {
    throw fehler('antwort', 'JSON kaputt');
  }
}

/*
 * Claude mit Werkzeugen des Servers (Websuche, Seite lesen): ohne Strom,
 * dafür die ganze Antwort mit allen Blöcken. Eine lange Suche kann der Server
 * unterbrechen (stop_reason pause_turn) – dann geht die bisherige Antwort
 * unverändert zurück, und es geht weiter. Mit Quellenangaben ist der Text auf
 * mehrere Blöcke verteilt: Es zählt alles nach dem letzten Werkzeug.
 *
 * Kennt der Schlüssel das Suchmodell nicht, einmal mit dem normalen Modell;
 * hakt nur das Lesen von Seiten (web_fetch), einmal ohne. Gibt { text,
 * quellen: [{ url, titel }], usage: { ein, aus, suchen } } zurück.
 */
export async function kiMitWerkzeugen(rumpf, { schluessel, api = '', signal, runden = 4 }) {
  const fehler = (art, detail) => kiFehler(art, detail, 'anthropic');
  const usage = { ein: 0, aus: 0, suchen: 0 };
  const quellen = [];
  let bisher = [];
  for (let runde = 0; runde < runden; runde++) {
    const messages = bisher.length ? [...rumpf.messages, { role: 'assistant', content: bisher }] : rumpf.messages;
    let res;
    try {
      res = await fetch(api || ANBIETER.anthropic.api, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': schluessel, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ ...rumpf, messages }),
        signal,
      });
    } catch (e) {
      throw fehler(e?.name === 'AbortError' ? 'abbruch' : 'netz', e?.message);
    }
    let info = null;
    try { info = await res.json(); } catch (e) {
      if (e?.name === 'AbortError') throw fehler('abbruch', e.message);
    }
    if (!res.ok) {
      const text = info?.error?.message || `HTTP ${res.status}`;
      const art = artVonStatus(res.status, info);
      if (!bisher.length && art === 'modell' && rumpf.model !== ANBIETER.anthropic.modell) {
        return kiMitWerkzeugen({ ...rumpf, model: ANBIETER.anthropic.modell }, { schluessel, api, signal, runden });
      }
      // Hakt nur das Lesen von Seiten (unbekannt oder ausgeschaltet): einmal ohne – wenn dann noch ein Werkzeug bleibt
      const ohneLesen = (rumpf.tools || []).filter((t) => !/^web_fetch/.test(t.type || ''));
      if (!bisher.length && res.status === 400 && /web[ _]fetch/i.test(text) && ohneLesen.length && ohneLesen.length < (rumpf.tools || []).length) {
        return kiMitWerkzeugen({ ...rumpf, tools: ohneLesen }, { schluessel, api, signal, runden });
      }
      throw fehler(art, text);
    }
    usage.ein += Number(info?.usage?.input_tokens) || 0;
    usage.aus += Number(info?.usage?.output_tokens) || 0;
    usage.suchen += Number(info?.usage?.server_tool_use?.web_search_requests) || 0;
    const bloecke = Array.isArray(info?.content) ? info.content : [];
    for (const b of bloecke) {
      if (b?.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) if (r?.url) quellen.push({ url: String(r.url), titel: String(r.title || '') });
      }
      if (b?.type === 'web_fetch_tool_result' && b.content?.url) quellen.push({ url: String(b.content.url), titel: String(b.content.content?.title || '') });
    }
    bisher = [...bisher, ...bloecke];
    const stopp = info?.stop_reason || '';
    if (stopp === 'pause_turn') continue;
    if (stopp === 'max_tokens') throw fehler('zulang', `${usage.aus} Tokens`);
    if (stopp === 'refusal') throw fehler('sicherheit', stopp);
    let i = bisher.length;
    while (i > 0 && bisher[i - 1]?.type === 'text') i--;
    const text = bisher.slice(i).map((b) => b.text || '').join('');
    if (!text.trim()) throw fehler('antwort', 'keine Antwort');
    return { text, quellen, usage };
  }
  throw fehler('antwort', 'Die Suche hat zu lange gedauert');
}
