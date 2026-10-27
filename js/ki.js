/*
 * Resteverwertung, der Gesprächsteil: die Anfrage an Claude und das Lesen der
 * Antwort.
 *
 * Die App ruft die Messages-API von Anthropic direkt vom Handy aus auf, mit
 * dem eigenen API-Schlüssel (zugang.js, nur im localStorage). Dafür gibt es
 * den Kopf „anthropic-dangerous-direct-browser-access“: Er erlaubt Aufrufe aus
 * dem Browser, wenn – wie hier – jeder seinen eigenen Schlüssel mitbringt.
 *
 * Claude muss das Werkzeug „rezept_ausgeben“ benutzen (tool_choice). Dessen
 * Eingabe ist das Rezept als JSON nach SCHEMA (ki-rezept.js), Stück für Stück
 * gestreamt – so sieht man, dass etwas passiert, und eine lange Antwort reißt
 * nicht ab. Fotos gehen als JPEG mit, vorher auf höchstens 1280 px verkleinert
 * (ansicht-ki.js).
 *
 * anfrageBauen() ist ohne Netz und ohne DOM, tests/test-ki.mjs prüft daran,
 * dass alle Regeln mitgehen.
 */
import { SCHEMA } from './ki-rezept.js';

export const KI_API = 'https://api.anthropic.com/v1/messages';
export const MODELL = 'claude-sonnet-5-5';
/** Preise in US-Dollar pro Million Tokens (Sonnet 5.5) – für die Kosten-Anzeige. */
const PREIS = { ein: 2, aus: 10 };
const WERKZEUG = 'rezept_ausgeben';

export function systemText({ portionen, ziel, dazukaufen, katalog }) {
  const kat = Object.entries(katalog || {})
    .filter(([, v]) => v.c !== 'haushalt')
    .map(([k, v]) => `${k}=${v.n}`)
    .join('; ');
  return `Du bist der Meal-Prep-Koch von Tobi und Amy. Aus dem, was bei ihnen noch im Kühlschrank und im Vorrat ist, machst du EIN richtig gutes Rezept für ${portionen} gleiche Boxen und gibst es mit dem Werkzeug ${WERKZEUG} aus.

Ziel pro Box: ${ziel.kcal} kcal, ${ziel.p} g Protein, ${ziel.kh} g Kohlenhydrate, ${ziel.f} g Fett. Die App rechnet die Nährwerte selbst aus deinen Werten pro 100 g nach und verschiebt die Mengen der Zutaten mit anpassbar: true zwischen min und max, bis jede Box das Ziel trifft. Plane das Gericht so, dass das mit sinnvollen Mengen aufgeht: genug mageres Protein, eine Sättigungsbeilage, Fett vor allem aus Öl, Käse oder Sahne.

Feste Regeln:
- Kein Fisch und keine Meeresfrüchte, auch nichts, was sie enthält (Fischsauce, Garnelenpaste, Sardellen, Worcestersauce). Bei Currypaste „vegan“ dazuschreiben.
- Kein Schweinefleisch in jeder Form (Speck, Schinken, Salami, Chorizo, Wurst, gemischtes Hack, Gelatine) und kein Putenhack. Hähnchen, Putenbrust, Rind, Eier, Hülsenfrüchte und Milchprodukte sind gut.
- Kein Hüttenkäse und kein Quark oder Skyr in warmen Saucen – die werden körnig. Quark und Skyr nur kalt (Dip, Marinade).
- Richtig lecker und ordentlich gewürzt, so dass man es gern vier Tage hintereinander isst. Lieber ein bewährtes Gericht gut gemacht als ein wildes Experiment.
- Was da ist, zuerst verbrauchen, vor allem Frisches. ${dazukaufen
    ? 'Was fehlt, darf dazugekauft werden – so wenig wie nötig und in Supermarkt-Packungen.'
    : 'Es wird nichts dazugekauft: nur, was da ist, plus Öl, Salz, Pfeffer, Gewürze, Brühe, Mehl, Zucker und Senf aus dem Vorrat. Geht das Ziel damit nicht auf, sag es in hinweis.'}
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

Antworte nur mit dem Werkzeug, alles auf Deutsch.`;
}

export function nutzerText({ text, wuensche, fotos = 0, portionen, dazukaufen, mag = [], magNicht = [], vermeiden = [] }) {
  const zeilen = [
    'Das ist noch da:',
    String(text || '').trim() || '(steht nur auf den Fotos)',
  ];
  if (fotos) zeilen.push('', `${fotos === 1 ? 'Auf dem Foto ist' : `Auf den ${fotos} Fotos ist`}, was im Kühlschrank und im Vorrat liegt.`);
  zeilen.push('', `Portionen: ${portionen}`, `Dazukaufen: ${dazukaufen ? 'ja, wenn nötig' : 'nein'}`, `Wünsche: ${String(wuensche || '').trim() || 'keine'}`);
  if (mag.length) zeilen.push(`Das mögen sie (Daumen hoch): ${mag.join(', ')}`);
  if (magNicht.length) zeilen.push(`Das mögen sie nicht (Daumen runter): ${magNicht.join(', ')}`);
  if (vermeiden.length) zeilen.push(`Bitte nicht noch einmal: ${vermeiden.join(', ')}`);
  return zeilen.join('\n');
}

/** Der Rumpf der Anfrage an /v1/messages (ohne stream – das setzt kiAnfragen). */
export function anfrageBauen(e) {
  const inhalt = (e.fotos || []).map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }));
  inhalt.push({ type: 'text', text: nutzerText({ ...e, fotos: (e.fotos || []).length }) });
  return {
    model: MODELL,
    max_tokens: 16000,
    system: systemText(e),
    tools: [{ name: WERKZEUG, description: 'Gibt das fertige Rezept an die App.', input_schema: SCHEMA }],
    tool_choice: { type: 'tool', name: WERKZEUG },
    messages: [{ role: 'user', content: inhalt }],
  };
}

/* ------------------------------------------------------------- Fehler */

export const KI_FEHLER = {
  schluessel: 'Anthropic lehnt den Schlüssel ab. Prüf ihn unter console.anthropic.com → API Keys und trag ihn neu ein.',
  guthaben: 'Auf dem Anthropic-Konto ist kein Guthaben. In der Console unter Billing aufladen, dann nochmal.',
  grenze: 'Gerade zu viele Anfragen. In einer Minute nochmal versuchen.',
  ueberlastet: 'Claude ist gerade überlastet. Gleich nochmal versuchen.',
  netz: 'Keine Verbindung zu Anthropic. Prüf das Internet und versuch es nochmal.',
  zulang: 'Die Antwort wurde zu lang und ist abgebrochen. Nochmal versuchen, vielleicht mit weniger Zutaten.',
  zugross: 'Die Fotos sind zu groß. Nimm weniger Fotos.',
  modell: 'Das KI-Modell ist gerade nicht verfügbar.',
  antwort: 'Die Antwort war kein brauchbares Rezept. Nochmal versuchen.',
  abbruch: 'Abgebrochen.',
};

export function kiFehler(art, detail = '') {
  const e = new Error(KI_FEHLER[art] || KI_FEHLER.antwort);
  e.art = art;
  e.detail = String(detail || '').slice(0, 300);
  return e;
}

function artVonStatus(status, info) {
  const text = `${info?.error?.type || ''} ${info?.error?.message || ''}`;
  if (status === 401 || status === 403) return 'schluessel';
  if (/credit|balance|billing|guthaben/i.test(text)) return 'guthaben';
  if (status === 413) return 'zugross';
  if (status === 404 || (status === 400 && /model/i.test(text))) return 'modell';
  if (status === 429) return 'grenze';
  if (status >= 500 || /overloaded/i.test(text)) return 'ueberlastet';
  return 'antwort';
}

/** Ungefähre Kosten einer Anfrage in Cent (US-Dollar ≈ Euro). */
export const kostenCent = (usage) => ((usage.ein || 0) * PREIS.ein + (usage.aus || 0) * PREIS.aus) / 1e4;

/*
 * Die Anfrage abschicken und den Strom lesen (server-sent events). Gibt
 * { eingabe, usage } zurück: eingabe ist das JSON aus dem Werkzeug.
 * beiFortschritt({ zeichen, schritte }) meldet, wie weit die Antwort ist.
 */
export async function kiAnfragen(rumpf, { schluessel, api = KI_API, signal, beiFortschritt = () => {} }) {
  let res;
  try {
    res = await fetch(api, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': schluessel,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ ...rumpf, stream: true }),
      signal,
    });
  } catch (e) {
    throw kiFehler(e?.name === 'AbortError' ? 'abbruch' : 'netz', e?.message);
  }
  if (!res.ok) {
    let info = null;
    try { info = await res.json(); } catch { /* kein JSON */ }
    throw kiFehler(artVonStatus(res.status, info), info?.error?.message || `HTTP ${res.status}`);
  }
  if (!res.body?.getReader) throw kiFehler('antwort', 'kein Datenstrom');

  const leser = res.body.getReader();
  const dekoder = new TextDecoder();
  const usage = { ein: 0, aus: 0 };
  let puffer = '';
  let json = '';
  let werkzeug = false;
  let stopp = null;
  const verarbeite = (block) => {
    const daten = block.split('\n').filter((z) => z.startsWith('data:')).map((z) => z.slice(5).trimStart()).join('\n');
    if (!daten) return;
    let ev;
    try { ev = JSON.parse(daten); } catch { return; }
    switch (ev.type) {
      case 'message_start':
        usage.ein = Number(ev.message?.usage?.input_tokens) || 0;
        return;
      case 'content_block_start':
        if (ev.content_block?.type === 'tool_use' && ev.content_block.name === WERKZEUG) werkzeug = true;
        return;
      case 'content_block_delta':
        if (ev.delta?.type === 'input_json_delta') {
          json += ev.delta.partial_json || '';
          beiFortschritt({ zeichen: json.length, schritte: (json.match(/"min"\s*:/g) || []).length });
        }
        return;
      case 'message_delta':
        stopp = ev.delta?.stop_reason || stopp;
        usage.aus = Number(ev.usage?.output_tokens) || usage.aus;
        return;
      case 'error':
        throw kiFehler(/overloaded/i.test(ev.error?.type || '') ? 'ueberlastet' : 'antwort', ev.error?.message);
      default:
    }
  };
  for (;;) {
    let stueck;
    try { stueck = await leser.read(); } catch (e) { throw kiFehler(e?.name === 'AbortError' ? 'abbruch' : 'netz', e?.message); }
    if (stueck.done) break;
    puffer += dekoder.decode(stueck.value, { stream: true }).replace(/\r\n/g, '\n');
    for (let i = puffer.indexOf('\n\n'); i >= 0; i = puffer.indexOf('\n\n')) {
      verarbeite(puffer.slice(0, i));
      puffer = puffer.slice(i + 2);
    }
  }
  if (puffer.trim()) verarbeite(puffer);
  if (stopp === 'max_tokens') throw kiFehler('zulang');
  if (!werkzeug || !json) throw kiFehler('antwort', 'kein Werkzeug in der Antwort');
  try {
    return { eingabe: JSON.parse(json), usage };
  } catch {
    throw kiFehler('antwort', 'JSON kaputt');
  }
}
