/*
 * Speisekarte: Fotos, ein PDF, Text oder ein Link einer Karte – die KI liest
 * die Gerichte und schätzt ihre Nährwerte, die App rechnet aus, welches dem
 * eigenen Ziel pro Box am nächsten kommt (ansicht-speisekarte.js zeigt es).
 *
 * Geteilte Arbeit wie bei den Rezepten: Die KI liest und schätzt (Portionen,
 * Fett aus der Restaurantküche), gerechnet und sortiert wird hier – mit
 * derselben Abweichung wie beim Anpassen (ki-rezept.js abstand: Fett 1,5-fach,
 * kcal durch 8). So kommt bei derselben Antwort immer dieselbe Reihenfolge
 * heraus, und ändert man sein Ziel, sortiert die App neu, ohne die KI.
 *
 * Fisch, Schwein, Putenhack und Hüttenkäse markiert die KI (enthaelt); diese
 * Gerichte stehen nicht oben, sondern für sich (wie alle Rezepte der App
 * ohne sie).
 *
 * Ohne DOM, damit tests/test-speisekarte.mjs alles direkt in Node prüft.
 */
import { ANBIETER } from './ki.js';
import { abstand } from './ki-rezept.js';
import { linkAus } from './amy-import.js';

export const WERKZEUG_KARTE = 'karte_ausgeben';
export const ARTEN = ['hauptgang', 'salat', 'suppe', 'vorspeise', 'snack', 'beilage', 'dessert'];
export const ART_NAME = { hauptgang: 'Hauptgang', salat: 'Salat', suppe: 'Suppe', vorspeise: 'Vorspeise', snack: 'Snack', beilage: 'Beilage', dessert: 'Dessert' };
export const SICHER = ['grob', 'mittel', 'gut'];
export const ENTHAELT = ['fisch', 'schwein', 'putenhack', 'huettenkaese'];
export const ENTHAELT_NAME = { fisch: 'Fisch', schwein: 'Schwein', putenhack: 'Putenhack', huettenkaese: 'Hüttenkäse' };
/** Was als Mahlzeit oben stehen kann – Desserts und Beilagen nicht. */
const MAHLZEIT = new Set(['hauptgang', 'salat', 'suppe', 'vorspeise', 'snack']);
const MAX_GERICHTE = 80;

const WERTE = {
  type: 'object',
  properties: { kcal: { type: 'number' }, p: { type: 'number' }, kh: { type: 'number' }, f: { type: 'number' } },
  required: ['kcal', 'p', 'kh', 'f'],
};

export const KARTE_SCHEMA = {
  type: 'object',
  properties: {
    restaurant: { type: 'string', description: 'Name des Restaurants, wenn er auf der Karte steht – sonst leer' },
    gerichte: {
      type: 'array',
      description: 'Jedes Gericht der Karte, das man essen kann – keine Getränke',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name wie auf der Karte, kurz, auf Deutsch; bei Salaten mit Topping beides („Brauhaussalat mit Backhendl“)' },
          art: { type: 'string', enum: ARTEN },
          preis: { type: 'string', description: 'Preis wie auf der Karte, z. B. „17,00 €“ – sonst leer' },
          was: { type: 'string', description: 'Was dazugehört, in wenigen Worten: Beilage, Sauce, Dressing' },
          portion: { type: 'string', description: 'geschätzte Portion, z. B. „ca. 450 g“' },
          kcal: { type: 'number', description: 'Schätzung für die ganze Portion, wie sie kommt' },
          p: { type: 'number', description: 'Protein in g' },
          kh: { type: 'number', description: 'Kohlenhydrate in g' },
          f: { type: 'number', description: 'Fett in g' },
          sicher: { type: 'string', enum: SICHER, description: 'Wie gut sich das schätzen lässt' },
          enthaelt: { type: 'array', items: { type: 'string', enum: ENTHAELT }, description: 'Was davon drin ist oder sehr wahrscheinlich drin ist' },
          tipp: { type: 'string', description: 'Eine konkrete Bestellung, die es näher ans Ziel bringt – oder leer' },
          mit_tipp: { ...WERTE, description: 'Die Werte mit dem Tipp – nur wenn es einen Tipp gibt' },
        },
        required: ['name', 'art', 'was', 'kcal', 'p', 'kh', 'f', 'sicher', 'enthaelt'],
      },
    },
    hinweis: { type: 'string', description: 'Nur wenn nötig: was sich nicht lesen ließ oder warum das keine Speisekarte ist' },
  },
  required: ['gerichte'],
};

const zahl1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

export function karteSystem({ ziel, wer = 'Tobi', anbieter = 'gemini', link = false } = {}) {
  return `Du liest eine Speisekarte und schätzt für jedes Gericht die Nährwerte, damit ${wer} das Gericht findet, das am besten zum Ziel passt. ${link ? 'Die Karte steht auf der Webseite unter dem Link – lies nur die Speisekarte, keine Werbung.' : 'Die Karte kommt als Foto, als PDF oder als kopierter Text.'}

Ziel für diese Mahlzeit: ${Math.round(ziel.kcal)} kcal, ${zahl1(ziel.p)} g Protein, ${zahl1(ziel.kh)} g Kohlenhydrate, ${zahl1(ziel.f)} g Fett. Die App rechnet selbst aus, welches Gericht am nächsten liegt – du schätzt nur ehrlich.

So geht es:
- Jedes Gericht, das man essen kann: Hauptgänge, Salate, Suppen, Vorspeisen, Snacks, Beilagen, Desserts. Keine Getränke. Gibt es ein Gericht mit wählbaren Toppings (Salat mit Hähnchen oder mit Falafel), wird jede Variante ein eigener Eintrag.
- Die Werte gelten für die ganze Portion, so wie sie im Restaurant auf den Tisch kommt – mit allem, was laut Karte dazugehört (Beilage, Sauce, Dressing, Brot). Restaurants kochen mit mehr Fett als zu Hause: Butter im Püree und in den Spätzle, Öl in der Pfanne, Paniertes und Frittiertes saugt Fett. Lieber realistisch als schöngerechnet.
- Kann man die Beilage wählen, nimm die, die am besten zum Ziel passt, und sag es im tipp.
- sicher: gut, wenn die Karte Mengen nennt oder es ein Standardgericht ist; mittel normalerweise; grob, wenn man wenig weiß.
- enthaelt: fisch (auch Meeresfrüchte, Hering, Sardellen, Fischsauce), schwein (auch Speck, Schinken, Wurst, Brät, Maultaschen mit Fleisch, Gelatine), putenhack, huettenkaese – wenn es drin ist oder sehr wahrscheinlich drin ist. Das Gericht bleibt trotzdem in der Liste.
- tipp: eine konkrete Bestellung, die es näher ans Ziel bringt (Sauce extra, halbe Portion Beilage, Salat statt Pommes, Dressing weglassen) – und mit_tipp die Werte dann. Kein Tipp, wenn es schon gut passt.
- Ist das keine Speisekarte, bleibt gerichte leer und hinweis sagt, warum.

${anbieter === 'gemini' ? 'Antworte nur mit dem JSON, ohne Text davor oder danach.' : `Antworte nur mit dem Werkzeug ${WERKZEUG_KARTE}.`} Alles auf Deutsch.`;
}

/**
 * Der Rumpf der Anfrage für Gemini (Interactions-API) oder Claude
 * (Messages-API). e = { anbieter, ziel, wer, text, fotos: [b64 JPEG], pdf: b64 }.
 * Links liest nur Gemini (url_context, dann ohne festes Schema).
 */
export function rumpfKarte(e) {
  const link = e.anbieter === 'gemini' && !e.pdf && !(e.fotos || []).length ? linkAus(e.text) : '';
  const fotos = e.fotos || [];
  const text = link
    ? `Die Speisekarte steht hier: ${link}`
    : String(e.text || '').trim()
      ? `Die Speisekarte:\n${String(e.text).trim().slice(0, 30000)}`
      : e.pdf ? 'Die Speisekarte ist das PDF.' : fotos.length > 1 ? `Die Speisekarte steht auf den ${fotos.length} Fotos.` : 'Die Speisekarte steht auf dem Foto.';
  if (e.anbieter === 'gemini') {
    const input = [
      ...(e.pdf ? [{ type: 'document', data: e.pdf, mime_type: 'application/pdf' }] : []),
      ...fotos.map((b64) => ({ type: 'image', data: b64, mime_type: 'image/jpeg' })),
      { type: 'text', text },
    ];
    return {
      model: ANBIETER.gemini.modell,
      system_instruction: karteSystem({ ziel: e.ziel, wer: e.wer, anbieter: 'gemini', link: !!link }),
      input,
      ...(link ? { tools: [{ type: 'url_context' }] } : { response_format: { type: 'text', mime_type: 'application/json', schema: KARTE_SCHEMA } }),
      generation_config: { max_output_tokens: 16000 },
      store: false,
      stream: true,
    };
  }
  const inhalt = [
    ...(e.pdf ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: e.pdf } }] : []),
    ...fotos.map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })),
    { type: 'text', text },
  ];
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 16000,
    system: karteSystem({ ziel: e.ziel, wer: e.wer, anbieter: 'anthropic' }),
    tools: [{ name: WERKZEUG_KARTE, description: 'Gibt die Gerichte der Karte mit geschätzten Nährwerten an die App.', input_schema: KARTE_SCHEMA }],
    tool_choice: { type: 'tool', name: WERKZEUG_KARTE },
    messages: [{ role: 'user', content: inhalt }],
  };
}

const txt = (v, n) => (typeof v === 'string' ? v.replace(/[\p{Cc}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const GRENZE = { kcal: 3000, p: 250, kh: 400, f: 250 };
function werteAus(x) {
  if (!x || typeof x !== 'object') return null;
  const w = {};
  for (const k of ['kcal', 'p', 'kh', 'f']) {
    const n = Number(x[k]);
    if (!Number.isFinite(n) || n < 0 || n > GRENZE[k]) return null;
    w[k] = k === 'kcal' ? Math.round(n) : Math.round(n * 10) / 10;
  }
  return w.kcal > 0 ? w : null;
}

/**
 * Was die KI geschickt hat, in sauber: { restaurant, gerichte, hinweis } –
 * oder { fehler }, wenn kein Gericht zu erkennen ist. Auch für das, was das
 * Gerät sich gemerkt hat.
 */
export function karteBereinigen(roh) {
  if (!roh || typeof roh !== 'object') return { fehler: 'Die Antwort war keine Speisekarte.' };
  const gerichte = [];
  const namen = new Set();
  for (const g of Array.isArray(roh.gerichte) ? roh.gerichte : []) {
    if (!g || typeof g !== 'object') continue;
    const name = txt(g.name, 90);
    const werte = werteAus(g.werte || g);
    if (!name || !werte || namen.has(name.toLowerCase())) continue;
    namen.add(name.toLowerCase());
    const tipp = txt(g.tipp, 160);
    const mit = tipp ? werteAus(g.mit_tipp || g.mitTipp) : null;
    gerichte.push({
      id: `g${gerichte.length + 1}`,
      name,
      art: ARTEN.includes(g.art) ? g.art : 'hauptgang',
      preis: txt(g.preis, 20),
      was: txt(g.was, 140),
      portion: txt(g.portion, 40),
      sicher: SICHER.includes(g.sicher) ? g.sicher : 'mittel',
      enthaelt: [...new Set((Array.isArray(g.enthaelt) ? g.enthaelt : []).filter((x) => ENTHAELT.includes(x)))],
      werte,
      ...(tipp ? { tipp } : {}),
      ...(mit ? { mitTipp: mit } : {}),
    });
    if (gerichte.length >= MAX_GERICHTE) break;
  }
  const hinweis = txt(roh.hinweis, 240);
  if (!gerichte.length) return { fehler: hinweis || 'Auf der Karte war kein Gericht zu erkennen.' };
  return { restaurant: txt(roh.restaurant, 60), gerichte, ...(hinweis ? { hinweis } : {}) };
}

/** Wie nah ein Gericht dem Ziel kommt: so oder mit dem Tipp – was näher ist. */
export function bewerten(g, ziel) {
  const so = abstand(g.werte, ziel);
  const mit = g.mitTipp ? abstand(g.mitTipp, ziel) : Infinity;
  const tipp = mit < so;
  const werte = tipp ? g.mitTipp : g.werte;
  return {
    abstand: Math.min(so, mit),
    tipp,
    werte,
    abweichung: { kcal: Math.round(werte.kcal - ziel.kcal), p: Math.round((werte.p - ziel.p) * 10) / 10, kh: Math.round((werte.kh - ziel.kh) * 10) / 10, f: Math.round((werte.f - ziel.f) * 10) / 10 },
  };
}

/**
 * Sortiert: oben, was als Mahlzeit am nächsten am Ziel liegt; Desserts und
 * Beilagen danach; was Fisch, Schwein & Co. enthält, für sich.
 * → { oben: [...], rest: [...], ohne: [...] } – je Eintrag { g, b }.
 */
export function sortieren(gerichte, ziel) {
  const alle = gerichte.map((g) => ({ g, b: bewerten(g, ziel) })).sort((x, y) => x.b.abstand - y.b.abstand || x.g.id.localeCompare(y.g.id));
  const ohne = alle.filter((x) => x.g.enthaelt.length);
  const essbar = alle.filter((x) => !x.g.enthaelt.length);
  const mahlzeit = essbar.filter((x) => MAHLZEIT.has(x.g.art));
  return { oben: mahlzeit.slice(0, 3), rest: [...mahlzeit.slice(3), ...essbar.filter((x) => !MAHLZEIT.has(x.g.art))], ohne };
}
