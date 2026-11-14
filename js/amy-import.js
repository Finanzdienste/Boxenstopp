/*
 * Rezept-Import für Amy – ohne DOM, damit die Tests Anfrage und Antwort
 * direkt prüfen. Ein Foto einer Kochbuchseite, ein kopierter Rezepttext oder
 * ein Link (Chefkoch & Co.): Die KI überträgt es in Amys Format – eine Zutat
 * je Zeile mit der Menge vorn, ein Schritt je Zeile, Abschnitte als kurze
 * Zeile mit Doppelpunkt – und die App füllt damit den Editor. Gespeichert
 * wird erst, wenn Amy es sich angeschaut hat.
 *
 * Links liest Gemini selbst (Werkzeug url_context der Interactions-API, dann
 * ohne festes Schema – die Antwort ist trotzdem nur JSON), Claude mit dem
 * Werkzeug web_fetch (kiMitWerkzeugen in ki.js).
 *
 * „Im Internet suchen“: Amy sagt, worauf sie Lust hat – Claude sucht mit der
 * Websuche bis zu drei passende Rezepte, liest ihre Seiten und schreibt sie
 * in dasselbe Format (rumpfSuche, sucheBereinigen); Amy nimmt eins davon in
 * den Editor. Nährwerte spielen dabei keine Rolle. Nur mit Claude: Googles
 * Bedingungen für die Suche erlauben nicht, Treffer zu ändern und dauerhaft
 * aufzuheben – genau das ist ein Rezept in Amys Sammlung.
 */
import { ANBIETER, ausgabeFuerClaude } from './ki.js';
import { TAG_VORSCHLAEGE, tagsBereinigen } from './amy.js';

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

export function importSystem({ tags = [], link = false } = {}) {
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

Antworte nur mit dem JSON, ohne Text davor oder danach. Alles auf Deutsch.`;
}

/**
 * Der Rumpf der Anfrage: für Gemini (Interactions-API) oder Claude
 * (Messages-API, JSON nach Schema). e = { anbieter, text, fotos: [b64], tags }.
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
      system_instruction: importSystem({ tags: e.tags, link: !!link }),
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
    system: importSystem({ tags: e.tags }),
    ...ausgabeFuerClaude(IMPORT_SCHEMA),
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

/* --------------------------------------------------- Claude liest Links */

/** Die Werkzeuge des Servers: Websuche (mit Standort Deutschland) und Seiten lesen. */
export const WEBSUCHE = { type: 'web_search_20250305', name: 'web_search', max_uses: 4, user_location: { type: 'approximate', country: 'DE', timezone: 'Europe/Berlin' } };
export const SEITE_LESEN = (n = 3) => ({ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: n, max_content_tokens: 16000 });

/** Einen Link mit Claude übernehmen: Die Seite liest web_fetch, die Antwort ist JSON wie beim Import. */
export function rumpfLinkClaude({ link, tags = [] }) {
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 8000,
    system: importSystem({ tags, link: true }),
    tools: [SEITE_LESEN(2)],
    messages: [{ role: 'user', content: [{ type: 'text', text: `Das Rezept steht hier: ${link}` }] }],
  };
}

/* ------------------------------------------------- Im Internet suchen */

export const MAX_TREFFER = 3;

export function sucheSystem({ tags = [] } = {}) {
  const vorschlaege = [...new Set([...tags, ...TAG_VORSCHLAEGE])].slice(0, 14).join(', ');
  return `Du suchst im Internet Rezepte für Amys Rezepte-App. Such mit der Websuche nach Rezepten, die zu ihrem Wunsch passen – am liebsten auf deutschsprachigen Rezeptseiten und guten Foodblogs (etwa Chefkoch, Lecker, Essen & Trinken, Kitchen Stories, EatSmarter, Springlane, Emmikochteinfach). Nimm bis zu ${MAX_TREFFER} verschiedene, die wirklich passen – keine drei Varianten desselben Gerichts, nur echte Rezepte mit Zutaten und Zubereitung, keine Übersichtsseiten.

Lies jedes Rezept auf seiner Seite (mit dem Werkzeug zum Lesen von Seiten, wenn die Suche nicht alles zeigt) und schreib es in Amys Format:
- name: der Name des Gerichts, kurz und auf Deutsch.
- quelle: die Seite, kurz, etwa „chefkoch.de“.
- url: die Adresse des Rezepts, genau so, wie sie in den Suchergebnissen stand.
- kurz: ein Satz, was es ist und warum es passt.
- portionen: für wie viele Portionen die Mengen sind (steht keine Zahl da: 4).
- zeit: die Gesamtzeit in Minuten, wenn sie angegeben ist, sonst 0.
- zutaten: eine Zutat je Eintrag, die Menge vorn, deutsche Einheiten: „500 g Hähnchenbrust“, „2 Zwiebeln“, „1 Dose Kokosmilch (400 ml)“, „1 EL Sojasauce“, „Pfeffer“.
- schritte: ein Arbeitsschritt je Eintrag, du-Form, kurz. Zeiten als Zahl mit „Min.“: „20 Min. backen“. Abschnitte als kurzer Eintrag mit Doppelpunkt: „Soße:“.
- notiz: ein Tipp oder eine Variante von der Seite – sonst leer.
- tags: bis zu drei passende aus dieser Liste (oder nichts): ${vorschlaege}.

Übernimm Mengen und Schritte so, wie sie auf der Seite stehen, und erfinde nichts dazu. Nährwerte brauchst du nicht. Englisches übersetzt du, amerikanische Maße (cups, oz) rechnest du in g oder ml um. Steht bei Amys Wunsch, was nicht hinein darf, nimm nur Rezepte ohne das.

Antworte zum Schluss nur mit diesem JSON, ohne Text davor oder danach:
{"rezepte": [{"name": "", "quelle": "", "url": "", "kurz": "", "portionen": 4, "zeit": 0, "zutaten": [], "schritte": [], "notiz": "", "tags": []}], "fehler": ""}
Findest du nichts Passendes, bleibt rezepte leer, und in fehler steht kurz, warum. Alles auf Deutsch.`;
}

/**
 * Was Amy sucht: wunsch (frei getippt), ohne/wenig – Zutaten, die sie nicht
 * oder nur wenig verträgt (nur wenn sie es so will, nur die Namen).
 */
export function sucheText({ wunsch, ohne = [], wenig = [] }) {
  const zeilen = [`Amys Wunsch: ${String(wunsch || '').trim().slice(0, 300)}`];
  if (ohne.length) zeilen.push(`Bitte ohne: ${ohne.slice(0, 20).join(', ')} (verträgt sie nicht).`);
  if (wenig.length) zeilen.push(`Davon nur wenig: ${wenig.slice(0, 20).join(', ')}.`);
  return zeilen.join('\n');
}

export function rumpfSuche({ wunsch, ohne = [], wenig = [], tags = [] }) {
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 12000,
    system: sucheSystem({ tags }),
    tools: [WEBSUCHE, SEITE_LESEN(3)],
    messages: [{ role: 'user', content: [{ type: 'text', text: sucheText({ wunsch, ohne, wenig }) }] }],
  };
}

/** Eine Adresse, die man öffnen darf (nur http/https) – sonst ''. */
export function sichereUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return /^https?:$/.test(x.protocol) ? x.href : '';
  } catch { return ''; }
}

const seiteVon = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
/** Zum Vergleichen: Seite ohne www., Pfad ohne / am Ende, ohne ?… und #… */
export const urlSchluessel = (u) => { try { const x = new URL(u); return `${x.hostname.replace(/^(?:www|m)\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase(); } catch { return ''; } };

/**
 * Die Treffer der Suche: { rezepte: [{ name, quelle, url, kurz, …Entwurf }], fehler }.
 * Jedes Rezept geht durch importBereinigen. Ein Rezept, dessen Adresse in
 * keinem Such- oder Leseergebnis vorkam (quellen aus kiMitWerkzeugen), bleibt
 * weg – das wäre nicht aus dem Internet, sondern ausgedacht.
 */
export function sucheBereinigen(roh, quellen = null) {
  if (!roh || typeof roh !== 'object') return { rezepte: [], fehler: 'Die Antwort war keine Liste mit Rezepten.' };
  const bekannt = Array.isArray(quellen) && quellen.length ? new Set(quellen.map((q) => urlSchluessel(sichereUrl(q.url))).filter(Boolean)) : null;
  const rezepte = [];
  for (const r of Array.isArray(roh.rezepte) ? roh.rezepte : []) {
    const neu = importBereinigen(r);
    if (neu.fehler) continue;
    const url = sichereUrl(r.url);
    if (bekannt && (!url || !bekannt.has(urlSchluessel(url)))) continue;
    rezepte.push({ ...neu, quelle: zeile(r.quelle, 40) || seiteVon(url), url, kurz: zeile(r.kurz, 200) });
    if (rezepte.length >= MAX_TREFFER) break;
  }
  return { rezepte, fehler: rezepte.length ? '' : zeile(roh.fehler, 200) || 'Dazu hat die Suche kein passendes Rezept gefunden.' };
}

/** Die Notiz eines übernommenen Treffers: was auf der Seite stand – und woher es ist. */
export function notizMitQuelle(t) {
  const quelle = t.url ? `Von ${t.quelle || seiteVon(t.url)}: ${t.url}` : t.quelle ? `Von ${t.quelle}` : '';
  return [String(t.notiz || '').trim(), quelle].filter(Boolean).join('\n').slice(0, 600);
}
