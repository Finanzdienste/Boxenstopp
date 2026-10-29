/*
 * Rezept-Import für Amy – ohne DOM, damit die Tests Anfrage und Antwort
 * direkt prüfen. Ein Foto einer Kochbuchseite, ein kopierter Rezepttext oder
 * ein Link (Chefkoch & Co.): Die KI überträgt es in Amys Format – eine Zutat
 * je Zeile mit der Menge vorn, ein Schritt je Zeile, Abschnitte als kurze
 * Zeile mit Doppelpunkt – und die App füllt damit den Editor. Gespeichert
 * wird erst, wenn Amy es sich angeschaut hat.
 *
 * Links liest Gemini selbst (Werkzeug url_context der Interactions-API, dann
 * ohne festes Schema – die Antwort ist trotzdem nur JSON). Mit einem
 * Claude-Schlüssel gehen Fotos und Text, für Links den Text kopieren.
 */
import { ANBIETER } from './ki.js';
import { TAG_VORSCHLAEGE, tagsBereinigen } from './amy.js';

export const WERKZEUG_IMPORT = 'rezept_ausgeben';
export const IMPORT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name des Rezepts, kurz' },
    portionen: { type: 'integer', description: 'für wie viele Portionen die Mengen sind' },
    zeit: { type: 'integer', description: 'Minuten insgesamt, 0 wenn unbekannt' },
    zutaten: { type: 'array', items: { type: 'string' }, description: 'eine Zutat je Eintrag, Menge vorn' },
    schritte: { type: 'array', items: { type: 'string' }, description: 'ein Schritt je Eintrag; Abschnitt als kurzer Eintrag mit Doppelpunkt am Ende' },
    notiz: { type: 'string', description: 'Tipps, Varianten, Quelle – oder leer' },
    tags: { type: 'array', items: { type: 'string' }, description: 'bis zu drei passende Tags' },
    fehler: { type: 'string', description: 'nur wenn kein Rezept zu erkennen ist: warum' },
  },
  required: ['name', 'zutaten', 'schritte'],
};

/** Nur ein Link (oder ein Link mit ein paar Worten drumherum)? Dann die Adresse. */
export function linkAus(text) {
  const t = String(text || '').trim();
  const m = t.match(/https?:\/\/[^\s<>"]+/i);
  if (!m) return '';
  return t.replace(m[0], '').trim().length <= 40 ? m[0].replace(/[).,;]+$/, '') : '';
}

export function importSystem({ tags = [], link = false, anbieter = 'gemini' } = {}) {
  const vorschlaege = [...new Set([...tags, ...TAG_VORSCHLAEGE])].slice(0, 14).join(', ');
  return `Du überträgst ein Rezept in Amys Format für ihre Rezepte-App. ${link ? 'Lies dazu die Webseite unter dem Link – nur das Rezept selbst, keine Werbung, keine Kommentare, keine anderen Rezepte von der Seite.' : 'Es kommt als Foto (etwa eine Kochbuchseite) oder als kopierter Text.'}

So soll es aussehen:
- name: der Name des Gerichts, kurz und auf Deutsch.
- portionen: für wie viele Portionen die Mengen gedacht sind (steht keine Zahl da: 4).
- zeit: die Gesamtzeit in Minuten, wenn sie angegeben ist, sonst 0.
- zutaten: eine Zutat je Eintrag, die Menge vorn, deutsche Einheiten: „500 g Hähnchenbrust“, „2 Zwiebeln“, „1 Dose Kokosmilch (400 ml)“, „1 EL Sojasauce“, „1 Prise Salz“, „Pfeffer“. Zusätze nach einem Komma: „2 Zwiebeln, gewürfelt“. Gibt es Zwischenüberschriften („Für die Soße“), lass sie bei den Zutaten weg.
- schritte: ein Arbeitsschritt je Eintrag, du-Form, kurz. Zeiten als Zahl mit „Min.“: „20 Min. backen“. Hat das Rezept Abschnitte, kommt vor ihre Schritte ein kurzer Eintrag mit Doppelpunkt: „Soße:“.
- notiz: Tipps, Varianten oder woher das Rezept ist – sonst leer.
- tags: bis zu drei passende aus dieser Liste (oder nichts): ${vorschlaege}.

Übernimm die Mengen genau so, wie sie dastehen, und erfinde nichts dazu. Ist etwas auf Englisch, übersetz es; amerikanische Maße (cups, oz) rechnest du in g oder ml um. Ist kein Rezept zu erkennen, schreib den Grund in fehler und lass den Rest leer.

${anbieter === 'gemini' ? 'Antworte nur mit dem JSON, ohne Text davor oder danach.' : `Antworte nur mit dem Werkzeug ${WERKZEUG_IMPORT}.`} Alles auf Deutsch.`;
}

/**
 * Der Rumpf der Anfrage: für Gemini (Interactions-API) oder Claude
 * (Messages-API, Werkzeug). e = { anbieter, text, fotos: [b64], tags }.
 */
export function rumpfImport(e) {
  const link = e.anbieter === 'gemini' ? linkAus(e.text) : '';
  const text = link
    ? `Das Rezept steht hier: ${link}`
    : String(e.text || '').trim() ? `Das Rezept:\n${String(e.text).trim().slice(0, 20000)}` : (e.fotos || []).length > 1 ? `Das Rezept steht auf den ${e.fotos.length} Fotos.` : 'Das Rezept steht auf dem Foto.';
  if (e.anbieter === 'gemini') {
    const input = (e.fotos || []).map((b64) => ({ type: 'image', data: b64, mime_type: 'image/jpeg' }));
    input.push({ type: 'text', text });
    return {
      model: ANBIETER.gemini.modell,
      system_instruction: importSystem({ tags: e.tags, link: !!link, anbieter: 'gemini' }),
      input,
      ...(link ? { tools: [{ type: 'url_context' }] } : { response_format: { type: 'text', mime_type: 'application/json', schema: IMPORT_SCHEMA } }),
      generation_config: { max_output_tokens: 8000 },
      store: false,
      stream: true,
    };
  }
  const inhalt = (e.fotos || []).map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }));
  inhalt.push({ type: 'text', text });
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 8000,
    system: importSystem({ tags: e.tags, anbieter: 'anthropic' }),
    tools: [{ name: WERKZEUG_IMPORT, description: 'Gibt das übertragene Rezept an die App.', input_schema: IMPORT_SCHEMA }],
    tool_choice: { type: 'tool', name: WERKZEUG_IMPORT },
    messages: [{ role: 'user', content: inhalt }],
  };
}

/** JSON aus einer Antwort, auch wenn Text davor oder danach steht. */
export function jsonAus(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* weiter unten */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* kaputt */ } }
  return null;
}

const zeile = (z, n) => (typeof z === 'string' ? z.replace(/\s+/g, ' ').replace(/^[-•*·]\s*/, '').trim().slice(0, n) : '');

/**
 * Was die KI geschickt hat, als Entwurf für den Editor – oder { fehler }.
 * { name, portionen, zeit, zutaten: 'Zeile\nZeile', schritte, notiz, tags }
 */
export function importBereinigen(roh) {
  if (!roh || typeof roh !== 'object') return { fehler: 'Die Antwort war kein Rezept.' };
  const zutaten = (Array.isArray(roh.zutaten) ? roh.zutaten : []).map((z) => zeile(z, 120)).filter(Boolean).slice(0, 40);
  const schritte = (Array.isArray(roh.schritte) ? roh.schritte : []).map((z) => zeile(z, 300)).filter(Boolean).slice(0, 40);
  if (!zutaten.length && !schritte.length) return { fehler: zeile(roh.fehler, 200) || 'Da war kein Rezept zu erkennen.' };
  const portionen = Math.round(Number(roh.portionen));
  const zeit = Math.round(Number(roh.zeit));
  return {
    name: zeile(roh.name, 80) || 'Neues Rezept',
    portionen: portionen >= 1 && portionen <= 30 ? portionen : 4,
    zeit: zeit > 0 && zeit <= 1440 ? zeit : '',
    zutaten: zutaten.join('\n'),
    schritte: schritte.join('\n'),
    notiz: typeof roh.notiz === 'string' ? roh.notiz.trim().slice(0, 600) : '',
    tags: tagsBereinigen(Array.isArray(roh.tags) ? roh.tags.slice(0, 3) : []),
  };
}
