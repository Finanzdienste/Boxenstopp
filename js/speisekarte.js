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
 * Fisch, Putenhack und Hüttenkäse markiert die KI (enthaelt); diese
 * Gerichte stehen nicht oben, sondern für sich (wie alle Rezepte der App
 * ohne sie).
 *
 * Veranstaltung: Statt einer Karte sagt man, wohin man geht (ein Basar, ein
 * Weihnachtsmarkt, ein Fest). Claude sucht sie im Netz (Websuche, Seiten
 * lesen) – Stände, Speisen, Preise – und schätzt, was nicht dasteht, als
 * „typisch“ für so eine Veranstaltung. Was als „auf der Seite“ zählt, muss
 * eine Adresse aus den Such- oder Leseergebnissen haben – sonst wäre sie
 * ausgedacht und es wird „typisch“. Gemini sucht nicht (Google-Suche ist für
 * die App tabu, siehe CLAUDE.md), dann ist alles geschätzt. Bilder: je
 * Gericht das Bild des Wikipedia-Artikels dazu (freie Lizenz, wikiAdresse),
 * sonst ein Bildchen der App (symbolFuer).
 *
 * Ohne DOM, damit tests/test-speisekarte.mjs alles direkt in Node prüft.
 */
import { ANBIETER, ausgabeFuerClaude } from './ki.js';
import { abstand } from './ki-rezept.js';
import { linkAus, WEBSUCHE, SEITE_LESEN } from './amy-import.js';

export const ARTEN = ['hauptgang', 'salat', 'suppe', 'vorspeise', 'snack', 'beilage', 'dessert'];
export const ART_NAME = { hauptgang: 'Hauptgang', salat: 'Salat', suppe: 'Suppe', vorspeise: 'Vorspeise', snack: 'Snack', beilage: 'Beilage', dessert: 'Dessert' };
export const SICHER = ['grob', 'mittel', 'gut'];
export const ENTHAELT = ['fisch', 'putenhack', 'huettenkaese'];
export const ENTHAELT_NAME = { fisch: 'Fisch', putenhack: 'Putenhack', huettenkaese: 'Hüttenkäse' };
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
const REGEL_ENTHAELT = '- enthaelt: fisch (auch Meeresfrüchte, Hering, Sardellen, Fischsauce), putenhack, huettenkaese – wenn es drin ist oder sehr wahrscheinlich drin ist. Schwein ist kein Problem. Das Gericht bleibt trotzdem in der Liste.';
const REGEL_TIPP = '- tipp: eine konkrete Bestellung, die es näher ans Ziel bringt (Sauce extra, halbe Portion Beilage, Salat statt Pommes, Dressing weglassen) – und mit_tipp die Werte dann. Kein Tipp, wenn es schon gut passt.';
const zielSatz = (ziel) => `${Math.round(ziel.kcal)} kcal, ${zahl1(ziel.p)} g Protein, ${zahl1(ziel.kh)} g Kohlenhydrate, ${zahl1(ziel.f)} g Fett`;

export function karteSystem({ ziel, wer = 'Tobi', link = false } = {}) {
  return `Du liest eine Speisekarte und schätzt für jedes Gericht die Nährwerte, damit ${wer} das Gericht findet, das am besten zum Ziel passt. ${link ? 'Die Karte steht auf der Webseite unter dem Link – lies nur die Speisekarte, keine Werbung.' : 'Die Karte kommt als Foto, als PDF oder als kopierter Text.'}

Ziel für diese Mahlzeit: ${zielSatz(ziel)}. Die App rechnet selbst aus, welches Gericht am nächsten liegt – du schätzt nur ehrlich.

So geht es:
- Jedes Gericht, das man essen kann: Hauptgänge, Salate, Suppen, Vorspeisen, Snacks, Beilagen, Desserts. Keine Getränke. Gibt es ein Gericht mit wählbaren Toppings (Salat mit Hähnchen oder mit Falafel), wird jede Variante ein eigener Eintrag.
- Die Werte gelten für die ganze Portion, so wie sie im Restaurant auf den Tisch kommt – mit allem, was laut Karte dazugehört (Beilage, Sauce, Dressing, Brot). Restaurants kochen mit mehr Fett als zu Hause: Butter im Püree und in den Spätzle, Öl in der Pfanne, Paniertes und Frittiertes saugt Fett. Lieber realistisch als schöngerechnet.
- Kann man die Beilage wählen, nimm die, die am besten zum Ziel passt, und sag es im tipp.
- sicher: gut, wenn die Karte Mengen nennt oder es ein Standardgericht ist; mittel normalerweise; grob, wenn man wenig weiß.
${REGEL_ENTHAELT}
${REGEL_TIPP}
- Ist das keine Speisekarte, bleibt gerichte leer und hinweis sagt, warum.

Antworte nur mit dem JSON, ohne Text davor oder danach. Alles auf Deutsch.`;
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
      system_instruction: karteSystem({ ziel: e.ziel, wer: e.wer, link: !!link }),
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
    system: karteSystem({ ziel: e.ziel, wer: e.wer }),
    ...ausgabeFuerClaude(KARTE_SCHEMA),
    messages: [{ role: 'user', content: inhalt }],
  };
}

const txt = (v, n) => (typeof v === 'string' ? v.replace(/[\p{Cc}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** Nur http(s), ohne Zugangsdaten in der Adresse. */
export function sichereUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return /^https?:$/.test(x.protocol) && !x.username && !x.password && x.href.length <= 500 ? x.href : '';
  } catch { return ''; }
}
export const hostVon = (u) => { try { return new URL(u).hostname.replace(/^(?:www|m)\./, '').toLowerCase(); } catch { return ''; } };
/** Ein Bild aus Wikipedia: das Bild selbst von upload.wikimedia.org, der Artikel auf de.wikipedia.org. */
function bildAus(b) {
  if (!istObj(b)) return null;
  const src = sichereUrl(b.src);
  const seite = sichereUrl(b.seite);
  return src.startsWith('https://upload.wikimedia.org/') && (!seite || seite.startsWith('https://de.wikipedia.org/wiki/')) ? { src, seite } : null;
}
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
    const stand = txt(g.stand, 60);
    const schluessel = `${stand.toLowerCase()}|${name.toLowerCase()}`;
    if (!name || !werte || namen.has(schluessel)) continue;
    namen.add(schluessel);
    const tipp = txt(g.tipp, 160);
    const url = sichereUrl(g.url);
    const wiki = txt(g.wiki, 80);
    const bild = bildAus(g.bild);
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
      ...(stand ? { stand } : {}),
      ...(QUELLEN.includes(g.quelle) ? { quelle: g.quelle } : {}),
      ...(url ? { url } : {}),
      ...(wiki ? { wiki } : {}),
      ...(bild ? { bild } : {}),
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
 * Beilagen danach; was Fisch & Co. enthält, für sich.
 * → { oben: [...], rest: [...], ohne: [...] } – je Eintrag { g, b }.
 */
export function sortieren(gerichte, ziel) {
  const alle = gerichte.map((g) => ({ g, b: bewerten(g, ziel) })).sort((x, y) => x.b.abstand - y.b.abstand || x.g.id.localeCompare(y.g.id));
  const ohne = alle.filter((x) => x.g.enthaelt.length);
  const essbar = alle.filter((x) => !x.g.enthaelt.length);
  const mahlzeit = essbar.filter((x) => MAHLZEIT.has(x.g.art));
  return { oben: mahlzeit.slice(0, 3), rest: [...mahlzeit.slice(3), ...essbar.filter((x) => !MAHLZEIT.has(x.g.art))], ohne };
}

/* ------------------------------------------------------ Veranstaltung */

/** Woher ein Gericht oder Stand kommt: von einer Seite im Netz – oder typisch für so eine Veranstaltung (geschätzt). */
export const QUELLEN = ['seite', 'typisch'];
export const SUCHE_VERANSTALTUNG = { ...WEBSUCHE, max_uses: 6 };
export const LESEN_VERANSTALTUNG = SEITE_LESEN(4);
const MAX_STAENDE = 30;

/** „2026-11-15“ → „Sonntag, 15. November 2026“ – für die KI (und die Anzeige). */
export function tagText(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const GERICHT_VA = {
  type: 'object',
  properties: {
    ...KARTE_SCHEMA.properties.gerichte.items.properties,
    stand: { type: 'string', description: 'An welchem Stand – genau so geschrieben wie in staende' },
    quelle: { type: 'string', enum: QUELLEN, description: 'seite: steht auf einer Seite im Netz; typisch: gibt es auf so einer Veranstaltung meistens (geschätzt)' },
    url: { type: 'string', description: 'Bei quelle seite: die Adresse der Seite – sonst leer' },
    wiki: { type: 'string', description: 'Titel des deutschen Wikipedia-Artikels über dieses Gericht allgemein (für ein Bild), etwa „Köttbullar“ – sonst leer' },
  },
  required: [...KARTE_SCHEMA.properties.gerichte.items.required, 'stand', 'quelle'],
};
export const VERANSTALTUNG_SCHEMA = {
  type: 'object',
  properties: {
    gefunden: { type: 'boolean', description: 'Ob die Veranstaltung selbst im Netz zu finden war' },
    veranstaltung: {
      type: 'object',
      properties: { name: { type: 'string' }, ort: { type: 'string' }, wann: { type: 'string' }, url: { type: 'string' }, seite: { type: 'string' } },
      required: ['name'],
    },
    staende: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, was: { type: 'string' }, quelle: { type: 'string', enum: QUELLEN }, url: { type: 'string' } }, required: ['name', 'was', 'quelle'] },
    },
    gerichte: { type: 'array', items: GERICHT_VA },
    hinweis: { type: 'string' },
  },
  required: ['veranstaltung', 'staende', 'gerichte'],
};

const VA_JSON = '{"gefunden": true, "veranstaltung": {"name": "", "ort": "", "wann": "", "url": "", "seite": ""}, "staende": [{"name": "", "was": "", "quelle": "seite", "url": ""}], "gerichte": [{"name": "", "stand": "", "art": "hauptgang", "preis": "", "was": "", "portion": "", "kcal": 0, "p": 0, "kh": 0, "f": 0, "sicher": "mittel", "enthaelt": [], "tipp": "", "mit_tipp": {"kcal": 0, "p": 0, "kh": 0, "f": 0}, "quelle": "typisch", "url": "", "wiki": ""}], "hinweis": ""}';

export function veranstaltungSystem({ ziel, wer = 'Tobi', suchen = true, tag = '' } = {}) {
  return `${wer} geht ${tag ? `am ${tag}` : 'heute'} zu einer Veranstaltung (ein Basar, ein Markt, ein Fest …) und will vorher wissen, welche Stände es dort gibt, was man dort essen kann und was davon am besten zum Ziel passt.

${suchen
    ? 'Such mit der Websuche nach genau dieser Veranstaltung, möglichst nach der diesjährigen: die offizielle Seite, das Programm, die Liste der Stände oder Aussteller, Speisen und Getränke, Preise, Beiträge oder Berichte vom letzten Mal. Lies die besten Seiten mit dem Werkzeug zum Lesen von Seiten. Was nirgends steht, schätzt du: Stände und Gerichte, die es auf so einer Veranstaltung meistens gibt.'
    : 'Du kannst nicht im Netz nachsehen. Schätz aus dem, was du über so eine Veranstaltung weißt, welche Stände und Gerichte es dort meistens gibt.'}

Ziel für diese Mahlzeit: ${zielSatz(ziel)}. Die App rechnet selbst aus, welches Gericht am nächsten liegt – du schätzt nur ehrlich.

So soll die Antwort aussehen:
- gefunden: ob du die Veranstaltung selbst gefunden hast.
- veranstaltung: name, ort, wann (mit Uhrzeit, wenn sie dasteht), url – die beste Seite zur Veranstaltung, genau so, wie sie in den Such- oder Leseergebnissen stand –, seite kurz („seemannskirche.de“).
- staende: die Stände mit Essen oder Getränken – name und was es dort gibt, in wenigen Worten. quelle „seite“ nur, wenn auf einer Seite steht, dass es diesen Stand gibt (url dazu); sonst „typisch“.
- gerichte: was man an den Ständen essen kann, keine Getränke – wie bei einer Speisekarte: name, art, preis (wenn er dasteht), was, portion, kcal, p, kh, f für die Portion, wie sie am Stand über den Tresen geht. Dazu stand (genau wie in staende), quelle „seite“ mit url, wenn es auf einer Seite steht, sonst „typisch“, und wiki: der Titel des deutschen Wikipedia-Artikels über das Gericht allgemein („Köttbullar“, „Waffel“, „Bratwurst“) – sonst leer.
- Nichts als „seite“ ausgeben, was nicht auf einer Seite stand. Findest du die Veranstaltung nicht, ist gefunden false; schätz trotzdem, was es dort wahrscheinlich gibt (alles „typisch“), und sag es im hinweis.
- Ehrlich rechnen: Portionen am Stand, Frittiertes, Saucen, Brötchen, Sahne – lieber realistisch als schöngerechnet.
- sicher: gut, wenn Mengen dastehen oder es ein Standardgericht ist; mittel normalerweise; grob, wenn man wenig weiß.
${REGEL_ENTHAELT}
${REGEL_TIPP}

Antworte zum Schluss nur mit diesem JSON, ohne Text davor oder danach:
${VA_JSON}
Alles auf Deutsch.`;
}

/**
 * Die Anfrage: bei Claude mit Websuche und Seiten-Lesen (kiMitWerkzeugen),
 * bei Gemini ohne Suche (nur geschätzt), mit festem Schema. Mit geht nur,
 * was jemand getippt hat (was) und der Tag.
 */
export function rumpfVeranstaltung({ anbieter, ziel, wer, was, tag = '' }) {
  const frage = `Die Veranstaltung: ${txt(was, 300)}\nWann: ${tag || 'heute'}`;
  if (anbieter === 'gemini') {
    return {
      model: ANBIETER.gemini.modell,
      system_instruction: veranstaltungSystem({ ziel, wer, suchen: false, tag }),
      input: [{ type: 'text', text: frage }],
      response_format: { type: 'text', mime_type: 'application/json', schema: VERANSTALTUNG_SCHEMA },
      generation_config: { max_output_tokens: 16000 },
      store: false,
      stream: true,
    };
  }
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 16000,
    system: veranstaltungSystem({ ziel, wer, suchen: true, tag }),
    tools: [SUCHE_VERANSTALTUNG, LESEN_VERANSTALTUNG],
    messages: [{ role: 'user', content: [{ type: 'text', text: frage }] }],
  };
}

/**
 * Was die KI über die Veranstaltung geschickt hat, in sauber:
 * { art: 'veranstaltung', gefunden, veranstaltung: { name, ort, wann, url, seite },
 *   staende: [{ name, was, quelle, url? }], gerichte (wie bei der Karte, dazu
 *   stand, quelle, url, wiki, bild), hinweis } – oder { fehler }.
 * quellen: die Adressen aus den Such- und Leseergebnissen (kiMitWerkzeugen) –
 * eine Adresse, deren Website darin nicht vorkam, ist ausgedacht: dann
 * „typisch“ ohne Adresse. Ohne quellen (was das Gerät gemerkt hat) bleibt es,
 * wie es war.
 */
export function veranstaltungBereinigen(roh, { quellen = null } = {}) {
  const r = istObj(roh) ? roh : {};
  const belegte = Array.isArray(quellen) ? quellen.map((q) => sichereUrl(q?.url)).filter(Boolean) : null;
  const belegt = (u) => {
    const x = sichereUrl(u);
    if (!x || !belegte) return x;
    return belegte.some((q) => q === x || hostVon(q) === hostVon(x)) ? x : '';
  };
  const v = istObj(r.veranstaltung) ? r.veranstaltung : {};
  const vUrl = belegt(v.url);
  const karte = karteBereinigen({ gerichte: r.gerichte, hinweis: r.hinweis });
  if (!karte.gerichte) return { fehler: karte.fehler === 'Auf der Karte war kein Gericht zu erkennen.' ? 'Zu der Veranstaltung kam kein Gericht heraus.' : karte.fehler };
  for (const g of karte.gerichte) {
    const u = g.quelle === 'seite' ? belegt(g.url) : '';
    g.quelle = u ? 'seite' : 'typisch';
    if (u) g.url = u; else delete g.url;
  }
  const staende = [];
  const namen = new Set();
  for (const st of Array.isArray(r.staende) ? r.staende : []) {
    if (!istObj(st)) continue;
    const name = txt(st.name, 60);
    if (!name || namen.has(name.toLowerCase())) continue;
    namen.add(name.toLowerCase());
    const u = st.quelle === 'seite' ? belegt(st.url) : '';
    staende.push({ name, was: txt(st.was, 140), quelle: u ? 'seite' : 'typisch', ...(u ? { url: u } : {}) });
    if (staende.length >= MAX_STAENDE) break;
  }
  // Ein Stand, der nur an einem Gericht steht, kommt dazu
  for (const g of karte.gerichte) {
    if (!g.stand || namen.has(g.stand.toLowerCase()) || staende.length >= MAX_STAENDE) continue;
    namen.add(g.stand.toLowerCase());
    staende.push({ name: g.stand, was: '', quelle: g.quelle });
  }
  return {
    art: 'veranstaltung',
    gefunden: r.gefunden !== false && !!vUrl,
    veranstaltung: { name: txt(v.name, 90), ort: txt(v.ort, 80), wann: txt(v.wann, 60), url: vUrl, seite: vUrl ? (txt(v.seite, 40) || hostVon(vUrl)) : '' },
    staende,
    gerichte: karte.gerichte,
    ...(karte.hinweis ? { hinweis: karte.hinweis } : {}),
  };
}

/** Auf welchen Websites es stand: die Seiten der Veranstaltung, der Stände und Gerichte – je Website einmal. */
export function quellenVon(e) {
  const urls = [e?.veranstaltung?.url, ...(e?.staende || []).map((x) => x.url), ...(e?.gerichte || []).map((g) => g.url)].map(sichereUrl).filter(Boolean);
  return [...new Map(urls.map((u) => [hostVon(u), u])).entries()].slice(0, 6).map(([host, url]) => ({ host, url }));
}

/* ------------------------------------------------- Bilder der Gerichte */

export const WIKI_API = 'https://de.wikipedia.org/w/api.php';

/** Die Wikipedia-Titel, zu denen noch ein Bild fehlt – je Titel einmal, höchstens 50 (so viele nimmt die API). */
export const wikiTitel = (gerichte) => [...new Set((gerichte || []).filter((g) => g.wiki && !g.bild).map((g) => g.wiki))].slice(0, 50);

/** Eine Anfrage an Wikipedia für die Bilder zu diesen Titeln (frei lizenzierte, das ist dort der Standard). */
export function wikiAdresse(titel) {
  const q = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', redirects: '1', prop: 'pageimages|info', inprop: 'url', piprop: 'thumbnail', pithumbsize: '480', titles: titel.join('|') });
  return `${WIKI_API}?${q}`;
}

/** Die Antwort von Wikipedia → Map Titel → { src, seite } – nur Bilder von upload.wikimedia.org. */
export function wikiBilderAus(antwort, titel) {
  const out = new Map();
  const q = istObj(antwort?.query) ? antwort.query : {};
  const weiter = (liste, t) => (Array.isArray(liste) ? liste.find((x) => x?.from === t)?.to : '') || t;
  const seiten = Array.isArray(q.pages) ? q.pages : Object.values(istObj(q.pages) ? q.pages : {});
  for (const t of titel) {
    const ziel = weiter(q.redirects, weiter(q.normalized, t));
    const s = seiten.find((x) => x?.title === ziel);
    const bild = s && !s.missing ? bildAus({ src: s.thumbnail?.source, seite: s.fullurl }) : null;
    if (bild) out.set(t, bild);
  }
  return out;
}

/** Hat ein Gericht kein Bild: ein Bildchen der App, nach dem Namen – sonst nach der Art. */
const SYMBOLE = [
  [/waffel|pfannkuchen|crêpe|crepe|poffert|pancake|eierkuchen/i, 'pancakes'],
  [/pizza/i, 'pizza'],
  [/flammkuchen|fladen|lángos|langos|gözleme/i, 'flatbread'],
  [/burrito|wrap|döner|doner|dürüm/i, 'burrito'],
  [/taco/i, 'taco'],
  [/brezel|breze/i, 'pretzel'],
  [/zimtschnecke|croissant|kanelbulle|franzbrötchen/i, 'croissant'],
  [/keks|plätzchen|cookie|lebkuchen|pepparkak/i, 'cookie'],
  [/kuchen|torte|strudel|muffin/i, 'shortcake'],
  [/schoko|praline/i, 'chocolate-bar'],
  [/suppe|eintopf|chili|gulasch/i, 'pot-of-food'],
  [/curry|reis|risotto|bowl/i, 'curry-rice'],
  [/nudel|pasta|spaghetti|spätzle/i, 'spaghetti'],
  [/maultasche|teigtasche|dumpling|pierogi|gyoza/i, 'dumpling'],
  [/hähnchen|huhn|chicken|geflügel|ente/i, 'poultry-leg'],
  [/wurst|pølse|hot ?dog|brötchen|burger|sandwich|smørrebrød|stulle/i, 'sandwich'],
  [/fleisch|steak|braten|köttbullar|frikadelle|spieß|spiess/i, 'cut-of-meat'],
  [/kartoffel|pommes|reibekuchen|kartoffelpuffer|lefse/i, 'potato'],
  [/salat/i, 'green-salad'],
  [/brot/i, 'bread'],
];
const ART_SYMBOL = { hauptgang: 'fork-and-knife-with-plate', salat: 'green-salad', suppe: 'steaming-bowl', vorspeise: 'bread', snack: 'sandwich', beilage: 'potato', dessert: 'shortcake' };
export function symbolFuer(g) {
  for (const [re, name] of SYMBOLE) if (re.test(String(g?.name || ''))) return name;
  return ART_SYMBOL[g?.art] || 'fork-and-knife-with-plate';
}
