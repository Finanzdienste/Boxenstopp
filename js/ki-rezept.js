/*
 * Resteverwertung, der Rechenteil: was die KI liefert – geprüft, auf die
 * Ziele gerechnet und in die Form gebracht, in der die App jedes Rezept zeigt.
 *
 *   KI-Antwort (Werkzeug „rezept_ausgeben“, siehe SCHEMA)
 *     → kiBereinigen()    alles, was nicht passt, fällt weg, Längen begrenzt;
 *                         Fisch, Schwein und Putenhack lassen das Rezept platzen
 *     → mengenAnpassen()  die Mengen mit `anpassbar` (Fleisch, Reis, Öl, Käse …)
 *                         zwischen min und max so, dass jede Box das Ziel trifft
 *     → alsRezept()       Zutaten, Nährwertrechnung, Schritte mit echten Mengen
 *
 * Die KI schreibt Mengen in den Schritten als Platzhalter („{reis} Reis
 * waschen“), weil die App sie danach noch verschiebt; alsRezept() setzt die
 * endgültigen Mengen ein. Gespeichert wird die bereinigte, angepasste Fassung
 * (liste.json unter `ki`, für beide Handys); alsRezept() läuft beim Anzeigen.
 *
 * Ohne DOM, damit tests/test-ki.mjs alles direkt in Node prüft.
 */
import { menge as mengeText, platzhalter } from './format.js';
import { zeitVon } from './zeiten.js';

export const PHASEN = ['Vorbereiten', 'Kochen', 'Portionieren'];
export const QUELLEN = ['vorhanden', 'kaufen', 'vorrat'];
export const ABTEILUNGEN = ['obst', 'fleisch', 'kuehl', 'tk', 'konserven', 'trocken', 'vorrat', 'gewuerz', 'haushalt'];
export const GROESSEN = ['klein', 'mittel', 'groß'];
export const KI_ID = /^ki-[a-z0-9]{4,16}$/;
export const MAX_GESPEICHERT = 12;

/*
 * Was Tobi und Amy nicht essen. Steht das in einem Namen, gilt das Rezept
 * nicht – die KI kennt die Regel, das hier ist das Netz darunter. „ohne …“
 * zählt nicht („Currypaste ohne Garnelen“).
 */
export const VERBOTEN = /schwein|speck|schinken|bacon|salami|chorizo|pancetta|guanciale|mortadella|leberkäse|leberwurst|mett\b|bratwurst|wiener würstchen|kassler|kasseler|gelatine|gemischtes hack|hackfleisch,? gemischt|halb und halb|fisch|lachs|thunfisch|forelle|kabeljau|seelachs|garnele|shrimp|krabbe|sardelle|anchovi|muschel|tintenfisch|calamar|puten.?hack|hack\w* (?:von|aus) der pute|hüttenkäse/i;
const ohneOhne = (s) => String(s).replace(/ohne [\wäöüß-]+(?: (?:und|oder) [\wäöüß-]+)?/gi, '');

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const klon = (x) => JSON.parse(JSON.stringify(x));
const txt = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const zahl = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const ganz = (v, lo, hi, d) => Math.round(zahl(v, lo, hi, d));
const rund1 = (x) => Math.round(x * 10) / 10;
export const slug = (s) => String(s || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

/* -------------------------------------------------------------- Schema */

const SCHRITT = {
  type: 'object',
  properties: {
    text: { type: 'string', description: 'Genau eine Handlung, höchstens 140 Zeichen, du-Form. Mengen der Zutaten als Platzhalter {id}.' },
    min: { type: 'integer', minimum: 1, maximum: 180, description: 'Minuten, die man in diesem Schritt beschäftigt ist (Hobbykoch, ruhiges Tempo)' },
    ruhe: { type: 'integer', minimum: 0, maximum: 120, description: 'Wartezeit, die danach im Hintergrund weiterläuft (Marinieren, Ofen vorheizen, Wasser aufkochen, Reis quellen)' },
    nebenbei: { type: 'boolean', description: 'true, wenn der Schritt in der Wartezeit des Schritts davor passiert' },
    liste: { type: 'array', items: { type: 'string' }, description: 'Optional: was in eine Schale abgemessen wird, je Punkt eine Zutat mit Menge' },
  },
  required: ['text', 'min'],
};

/** Eingabe des Werkzeugs „rezept_ausgeben“ (Anthropic tool use). */
export const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Name des Gerichts, höchstens 60 Zeichen' },
    kurz: { type: 'string', description: 'Kurzname fürs Kreppband, höchstens 22 Zeichen' },
    beschreibung: { type: 'string', description: 'Ein Satz, was es ist und warum es schmeckt, höchstens 160 Zeichen' },
    protein: { type: 'string', description: 'Hauptprotein, z. B. Hähnchen, Rind, Pute, Eier, Linsen' },
    basis: { type: 'string', description: 'Sättigungsbeilage: Reis, Nudeln, Kartoffeln, Süßkartoffel, Gnocchi, Brot …' },
    methode: { type: 'string', description: 'z. B. Pfanne, Topf, Ofen, Pfanne + Topf' },
    kuehlschrank: { type: 'string', description: 'Wie lange es im Kühlschrank hält, z. B. „3 Tage“' },
    tiefkuehler: { type: 'string', description: 'z. B. „2 Monate“ oder „nicht geeignet“' },
    zutaten: {
      type: 'array',
      description: 'Alle Zutaten mit Nährwerten – ohne Gewürze in Löffelmengen',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'kurzer eindeutiger Schlüssel aus Kleinbuchstaben, z. B. reis, haehnchen, zucchini' },
          name: { type: 'string', description: 'Name wie im Supermarkt, z. B. „Hähnchenbrustfilet“' },
          menge: { type: 'number', description: 'Menge für alle Boxen zusammen, roh gewogen (Reis und Nudeln trocken), in g bzw. ml' },
          einheit: { type: 'string', enum: ['g', 'ml'] },
          stueck: { type: 'string', description: 'Optional bei Stückware, z. B. „2 Stück“, „1 Dose“' },
          min: { type: 'number', description: 'kleinste sinnvolle Menge' },
          max: { type: 'number', description: 'größte sinnvolle Menge; bei vorhanden höchstens das, was da ist' },
          anpassbar: { type: 'boolean', description: 'true: Die App darf die Menge zwischen min und max verschieben, um die Nährwerte zu treffen' },
          pro100: {
            type: 'object',
            description: 'Nährwerte pro 100 g bzw. 100 ml, roh, wie auf dem Etikett',
            properties: { kcal: { type: 'number' }, p: { type: 'number' }, kh: { type: 'number' }, f: { type: 'number' } },
            required: ['kcal', 'p', 'kh', 'f'],
          },
          quelle: { type: 'string', enum: QUELLEN, description: 'vorhanden: ist laut Text oder Foto da; kaufen: fehlt; vorrat: hat man meist (Öl, Mehl, Brühe, Zucker, Senf)' },
          katalog: { type: 'string', description: 'Schlüssel aus dem Katalog, wenn die Zutat dort steht, sonst leer' },
          abteilung: { type: 'string', enum: ABTEILUNGEN, description: 'obst = Obst & Gemüse, fleisch, kuehl = Milchprodukte & Kühlregal, tk, konserven, trocken = Nudeln & Reis, vorrat = Öl & Saucen, gewuerz, haushalt' },
          packung: { type: 'string', description: 'Bei kaufen: Packungsgröße im Supermarkt, z. B. „400 g“ oder „1 Dose“' },
        },
        required: ['id', 'name', 'menge', 'einheit', 'min', 'max', 'anpassbar', 'pro100', 'quelle', 'abteilung'],
      },
    },
    gewuerze: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, menge: { type: 'string', description: 'z. B. „2 TL“, „1 Prise“' } }, required: ['name', 'menge'] },
    },
    schalen: {
      type: 'array',
      description: 'Die nummerierten Schalen in der Reihenfolge, in der sie beim Kochen gebraucht werden (Schale 1 zuerst), höchstens 6',
      items: { type: 'object', properties: { name: { type: 'string', description: 'kurz, z. B. „Zwiebeln & Knoblauch“' }, groesse: { type: 'string', enum: GROESSEN } }, required: ['name', 'groesse'] },
    },
    geraete: { type: 'array', items: { type: 'string' }, description: 'Töpfe, Pfannen, Bleche, Messbecher …' },
    vorbereiten: { type: 'array', items: SCHRITT, description: 'Mise en place: alles schneiden, abwiegen, abmessen → Schale N' },
    kochen: { type: 'array', items: SCHRITT, description: 'Nur noch „Schale N dazu“, nichts mehr abwiegen' },
    portionieren: { type: 'array', items: SCHRITT },
    tipps: { type: 'array', items: { type: 'string' } },
    hinweis: { type: 'string', description: 'Optional: was fehlt oder warum die Ziele mit dem, was da ist, nicht ganz zu erreichen sind' },
  },
  required: ['name', 'kurz', 'beschreibung', 'protein', 'basis', 'methode', 'kuehlschrank', 'tiefkuehler', 'zutaten', 'gewuerze', 'schalen', 'geraete', 'vorbereiten', 'kochen', 'portionieren'],
};

/* ---------------------------------------------------------- bereinigen */

function schrittBereinigen(s) {
  if (!istObj(s)) return null;
  const d = txt(s.d ?? s.text, 220);
  if (!d) return null;
  const o = { d, min: ganz(s.min, 1, 180, 1) };
  const ruhe = ganz(s.ruhe, 0, 120, 0);
  if (ruhe) o.ruhe = ruhe;
  if (s.neben === true || s.nebenbei === true) o.neben = true;
  if (s.neu === true) o.neu = true;
  const liste = Array.isArray(s.liste) ? s.liste.map((x) => txt(x, 80)).filter(Boolean).slice(0, 14) : [];
  if (liste.length) o.liste = liste;
  return o;
}

/**
 * Aus der Antwort der KI (oder einem gespeicherten Rezept) ein sauberes
 * Rezept im KI-Format. { r, fehler, art } – r ist null, wenn es nicht taugt.
 */
export function kiBereinigen(roh) {
  const fehl = (fehler, art = 'antwort') => ({ r: null, fehler, art });
  if (!istObj(roh)) return fehl('Die Antwort war kein Rezept.');
  const name = txt(roh.name, 70);
  if (!name) return fehl('Das Rezept hat keinen Namen.');

  const ids = new Set();
  const zutaten = [];
  for (const z of Array.isArray(roh.zutaten) ? roh.zutaten.slice(0, 30) : []) {
    if (!istObj(z)) continue;
    const zname = txt(z.name, 60);
    const m = zahl(z.menge, 0, 5000, NaN);
    if (!zname || !(m > 0)) continue;
    const basis = slug(z.id) || slug(zname) || 'zutat';
    let id = basis;
    for (let n = 2; ids.has(id); n++) id = `${basis.slice(0, 26)}-${n}`;
    ids.add(id);
    const p = istObj(z.pro100) ? z.pro100 : {};
    const lo = Math.min(zahl(z.min, 0, 5000, m), m);
    const hi = Math.max(zahl(z.max, 0, 5000, m), m);
    const zut = {
      id,
      name: zname,
      menge: m,
      einheit: z.einheit === 'ml' ? 'ml' : 'g',
      stueck: txt(z.stueck, 40),
      min: lo,
      max: hi,
      anpassbar: z.anpassbar === true,
      pro100: { kcal: zahl(p.kcal, 0, 900, 0), p: zahl(p.p, 0, 100, 0), kh: zahl(p.kh, 0, 100, 0), f: zahl(p.f, 0, 100, 0) },
      quelle: QUELLEN.includes(z.quelle) ? z.quelle : 'kaufen',
      katalog: /^[a-z0-9-]{1,40}$/.test(String(z.katalog || '')) ? z.katalog : '',
      abteilung: ABTEILUNGEN.includes(z.abteilung) ? z.abteilung : 'sonstiges',
      packung: txt(z.packung, 40),
      vorschlag: zahl(z.vorschlag, 0, 5000, m),
    };
    // Aus einem festen Rezept: wie es gekauft wird (2 Dosen, 3 Stück), solange die Menge unverändert ist.
    if (istObj(z.kauf) && typeof z.kauf.q === 'number' && typeof z.kauf.u === 'string') zut.kauf = { q: zahl(z.kauf.q, 0, 5000, 0), u: z.kauf.u.slice(0, 12), h: txt(z.kauf.h, 80) };
    if (z.neu === true) zut.neu = true;
    if (z.pauschal === true) zut.pauschal = true;
    zutaten.push(zut);
  }
  if (zutaten.length < 2) return fehl('Im Rezept stehen zu wenige Zutaten.');

  const gewuerze = (Array.isArray(roh.gewuerze) ? roh.gewuerze : []).slice(0, 20)
    .map((g) => (istObj(g) ? { name: txt(g.name, 40), menge: txt(g.menge, 30) } : null))
    .filter((g) => g && g.name);
  const schalen = (Array.isArray(roh.schalen) ? roh.schalen : []).slice(0, 8).map((s) => {
    const gr = istObj(s) ? (s.groesse ?? s.gr) : '';
    return { name: txt(istObj(s) ? s.name : s, 26) || 'Schale', gr: GROESSEN.includes(gr) ? gr : 'mittel' };
  });
  const geraete = (Array.isArray(roh.geraete) ? roh.geraete : []).map((g) => txt(g, 60)).filter(Boolean).slice(0, 10);

  const phasenRoh = Array.isArray(roh.ablauf) ? PHASEN.map((t, i) => roh.ablauf[i]?.schritte) : [roh.vorbereiten, roh.kochen, roh.portionieren];
  const ablauf = PHASEN.map((t, i) => ({ t, schritte: (Array.isArray(phasenRoh[i]) ? phasenRoh[i] : []).slice(0, 40).map(schrittBereinigen).filter(Boolean) }));
  if (!ablauf[0].schritte.length || !ablauf[1].schritte.length) return fehl('Im Rezept fehlen Schritte.');
  // „währenddessen“ braucht einen Schritt davor.
  for (const p of ablauf) if (p.schritte[0]) delete p.schritte[0].neben;

  const r = {
    v: 1,
    name,
    kurz: txt(roh.kurz, 22) || name.slice(0, 22),
    beschreibung: txt(roh.beschreibung, 200),
    protein: txt(roh.protein, 30),
    basis: txt(roh.basis, 30),
    methode: txt(roh.methode, 30),
    kuehlschrank: txt(roh.kuehlschrank, 30) || '3 Tage',
    tiefkuehler: txt(roh.tiefkuehler, 40) || 'nicht geeignet',
    portionen: ganz(roh.portionen, 1, 8, 8),
    zutaten,
    gewuerze,
    schalen,
    geraete,
    ablauf,
    tipps: (Array.isArray(roh.tipps) ? roh.tipps : []).map((t) => txt(t, 240)).filter(Boolean).slice(0, 6),
    hinweis: txt(roh.hinweis, 300),
  };
  // Angepasste Rezepte: woher (die id des Ausgangsrezepts), und welche Zutaten weggelassen wurden.
  if (/^[a-z0-9-]{1,60}$/.test(String(roh.herkunft || ''))) r.herkunft = roh.herkunft;
  if (Array.isArray(roh.geaendert)) {
    const g = roh.geaendert.map((x) => txt(x, 80)).filter(Boolean).slice(0, 12);
    if (g.length) r.geaendert = g;
  }
  if (istObj(roh.weg)) {
    const weg = Object.fromEntries(Object.entries(roh.weg).filter(([k, v]) => /^[A-Za-z0-9_.-]{1,60}$/.test(k) && typeof v === 'string' && v.trim()).map(([k, v]) => [k, txt(v, 60)]).slice(0, 20));
    if (Object.keys(weg).length) r.weg = weg;
  }

  const boese = [name, ...zutaten.map((z) => z.name), ...gewuerze.map((g) => g.name)].find((n) => VERBOTEN.test(ohneOhne(n)));
  if (boese) return fehl(`„${boese}“ steht drin – das esst ihr nicht.`, 'verboten');
  return { r, fehler: null, art: null };
}

/* ------------------------------------------------------ Nährwerte, Ziel */

export function naehrwerte(r) {
  const t = { kcal: 0, p: 0, kh: 0, f: 0 };
  for (const z of r.zutaten) for (const k of Object.keys(t)) t[k] += (z.pro100[k] * z.menge) / 100;
  return t;
}

export function proBox(r) {
  const t = naehrwerte(r);
  return { kcal: t.kcal / r.portionen, p: t.p / r.portionen, kh: t.kh / r.portionen, f: t.f / r.portionen };
}

const GEWICHT = [1 / 64, 1, 1, 1.5]; // wie werkzeug/naehrwerte.py: kcal durch 8, Fett 1,5-fach
const ZIELWERTE = (ziel) => [ziel.kcal, ziel.p, ziel.kh, ziel.f];

/** Wie weit eine Box vom Ziel weg ist – dieselbe Rechnung wie err() in naehrwerte.py. */
export function abstand(box, ziel) {
  const b = [box.kcal, box.p, box.kh, box.f];
  return ZIELWERTE(ziel).reduce((s, t, k) => s + GEWICHT[k] * (b[k] - t) ** 2, 0);
}

/** Auf „schöne“ Mengen runden: ab 200 g in 10ern, ab 30 g in 5ern, sonst ganze Gramm. */
export function schoen(x, min = 0, max = Infinity) {
  const s = x >= 200 ? 10 : x >= 30 ? 5 : 1;
  let r = Math.round(x / s) * s;
  if (r > max) r = Math.floor(max / s) * s;
  if (r < min) r = Math.ceil(min / s) * s;
  // Kein runder Wert zwischen min und max: dann eben genau, aber in ganzen Gramm.
  if (r > max || r < min) r = Math.min(max, Math.max(min, Math.round(x)));
  return r > 0 ? r : x;
}

/**
 * Die Mengen mit `anpassbar` so verschieben, dass eine Box möglichst genau
 * das Ziel trifft – kleinste gewichtete Abweichung (Fett zählt 1,5-fach,
 * kcal durch 8), jede Menge zwischen min und max. Ein kleiner Zug zurück zum
 * Vorschlag der KI sorgt dafür, dass das Gericht so bleibt, wie es gedacht
 * war, wenn mehrere Lösungen gleich gut sind. Koordinatenabstieg: Die
 * Abweichung ist in jeder einzelnen Menge eine Parabel, also lässt sich jede
 * Menge für sich genau ausrechnen; das reihum, bis sich nichts mehr bewegt.
 */
export function mengenAnpassen(r0, ziel) {
  const r = klon(r0);
  const P = r.portionen;
  const frei = r.zutaten.filter((z) => z.anpassbar && z.max > z.min);
  if (!frei.length) return r;
  const T = ZIELWERTE(ziel);
  const wert = (z) => [z.pro100.kcal, z.pro100.p, z.pro100.kh, z.pro100.f].map((v) => v / 100 / P);
  const ZUG = 0.5;
  for (const z of frei) z.menge = Math.min(z.max, Math.max(z.min, z.vorschlag || z.menge));
  for (let runde = 0; runde < 400; runde++) {
    let bewegt = 0;
    for (const z of frei) {
      const a = wert(z);
      const box = proBox(r);
      const ohne = [box.kcal, box.p, box.kh, box.f].map((v, k) => v - a[k] * z.menge);
      const s0 = Math.max(z.vorschlag || z.menge, 1);
      let zaehler = (ZUG * (z.vorschlag || z.menge)) / (s0 * s0);
      let nenner = ZUG / (s0 * s0);
      for (let k = 0; k < 4; k++) { zaehler += GEWICHT[k] * (T[k] - ohne[k]) * a[k]; nenner += GEWICHT[k] * a[k] * a[k]; }
      const neu = Math.min(z.max, Math.max(z.min, zaehler / nenner));
      bewegt = Math.max(bewegt, Math.abs(neu - z.menge));
      z.menge = neu;
    }
    if (bewegt < 0.01) break;
  }
  for (const z of frei) z.menge = schoen(z.menge, z.min, z.max);
  return r;
}

/* -------------------------------------------------- als Rezept der App */

const ZAHLWORT = ['null', 'einer', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht'];
export const zahlwort = (n) => ZAHLWORT[n] || String(n);

const normGewuerz = (s) => String(s).toLowerCase().replace(/pulver/g, '').replace(/,.*$/, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

/**
 * Das KI-Rezept in der Form der Rezepte aus daten/rezepte.json, damit die
 * Detailansicht, die Einkaufsliste und der Rechner es genauso behandeln.
 * Zutaten aus dem Katalog bekommen dessen Schlüssel (dann teilen sie sich auf
 * der Liste eine Zeile mit den festen Rezepten) – aber nur, wenn die Einheit
 * passt; sonst `ki-<id>` mit eigenem Namen und eigener Abteilung (`kat`).
 */
export function alsRezept(k, { id, katalog = {}, einheiten = {}, von = null } = {}) {
  const P = k.portionen;
  const weg = k.weg || {};
  const fuellen = (t) => platzhalter(t, k.zutaten, weg);
  const items = k.zutaten.filter((z) => !z.pauschal).map((z) => {
    // Wie gekauft wird (2 Dosen, 3 Stück) gilt, solange die Menge nicht verändert wurde.
    const kauf = z.kauf && Math.abs(z.menge - z.vorschlag) < 0.5 ? z.kauf : null;
    const q = kauf ? kauf.q : z.menge;
    const u = kauf ? kauf.u : z.einheit;
    const ausKatalog = z.katalog && katalog[z.katalog] && (!einheiten[z.katalog] || einheiten[z.katalog] === u);
    const key = ausKatalog ? z.katalog : `ki-${z.id}`;
    return {
      n: z.name,
      a: kauf ? `${mengeText(kauf.q, kauf.u)}${z.stueck ? ` (${z.stueck})` : ''}` : `${mengeText(z.menge, z.einheit)}${z.stueck && Math.abs(z.menge - z.vorschlag) < 0.5 ? ` (${z.stueck})` : ''}`,
      k: key,
      q,
      u,
      h: z.quelle === 'kaufen' ? (kauf ? kauf.h : z.packung) : '',
      pantry: z.quelle === 'vorrat',
      opt: false,
      haus: false,
      da: z.quelle === 'vorhanden',
      ...(ausKatalog ? {} : { kat: { n: z.name, c: z.abteilung } }),
      g: z.menge,
      pro100: z.pro100,
      anpassbar: z.anpassbar,
      min: z.min,
      max: z.max,
    };
  });
  const gewuerzKatalog = {};
  for (const [key, v] of Object.entries(katalog)) if (v.c === 'gewuerz') gewuerzKatalog[normGewuerz(v.n)] = key;
  const spices = k.gewuerze.map((g) => {
    const key = gewuerzKatalog[normGewuerz(g.name)] || `ki-g-${slug(g.name) || 'gewuerz'}`;
    return { n: g.name, a: g.menge, k: key, ...(key.startsWith('ki-') ? { kat: { n: g.name, c: 'gewuerz' } } : {}) };
  });
  const nut = k.zutaten.map((z) => [z.name, mengeText(z.menge, z.einheit), ...['kcal', 'p', 'kh', 'f'].map((x) => rund1((z.pro100[x] * z.menge) / 100))]);
  const total = [2, 3, 4, 5].map((i) => rund1(nut.reduce((s, row) => s + row[i], 0)));
  const wegIds = Object.keys(weg);
  const entfaellt = (s) => wegIds.some((id) => new RegExp(`\\{${id}\\}`).test(`${s.d} ${(s.liste || []).join(' ')}`));
  const ablauf = k.ablauf.map((p) => ({ t: p.t, schritte: p.schritte.map((s) => ({ ...s, ...(entfaellt(s) ? { entfaellt: true } : {}), d: fuellen(s.d), ...(s.liste ? { liste: s.liste.map(fuellen) } : {}) })) }));
  const zeit = zeitVon({ ablauf });
  const aenderungen = k.zutaten
    .filter((z) => z.anpassbar && Math.abs(z.menge - z.vorschlag) >= 1)
    .map((z) => ({ name: z.name, vorher: z.vorschlag, nachher: z.menge, einheit: z.einheit }));
  return {
    id,
    name: k.name,
    short: k.kurz,
    desc: k.beschreibung,
    protein: k.protein || 'Resteverwertung',
    base: k.basis,
    method: k.methode,
    fridge: k.kuehlschrank,
    freeze: k.tiefkuehler,
    items,
    spices,
    schalen: k.schalen.map((s, i) => ({ n: i + 1, name: s.name, gr: s.gr })),
    geraete: k.geraete,
    ablauf,
    zeit,
    time: zeit.gesamt,
    tips: k.tipps,
    nut,
    total,
    m: { kcal: Math.round(total[0] / P), p: rund1(total[1] / P), kh: rund1(total[2] / P), f: rund1(total[3] / P) },
    portionen: P,
    ki: { von, hinweis: k.hinweis, aenderungen, herkunft: k.herkunft || null, weg, geaendert: k.geaendert || [] },
  };
}

/* -------------------------------------------- feste Rezepte anpassen */

/**
 * Ein festes Rezept aus daten/rezepte.json im KI-Format – damit „Anpassen“
 * für beide Arten von Rezepten dieselbe Rechnung nimmt. Die Zutat-id ist der
 * Katalog-Schlüssel, so passen die Platzhalter in den Schritten.
 */
export function festAlsKi(r, katalog = {}) {
  const zutaten = [];
  for (const it of r.items) {
    if (!it.k || it.haus || it.opt || !it.pro100 || !it.g) continue;
    const einheit = it.gu === 'ml' ? 'ml' : 'g';
    const z = {
      id: it.k,
      name: it.n.replace(/\s*\(.*?\)\s*/g, ' ').trim(),
      menge: it.g,
      einheit,
      stueck: it.u && !['g', 'ml'].includes(it.u) ? it.a.replace(/\s*\(.*?\)\s*/g, ' ').trim() : '',
      min: it.min,
      max: it.max,
      anpassbar: !!it.anpassbar,
      pro100: it.pro100,
      quelle: it.pantry ? 'vorrat' : 'kaufen',
      katalog: katalog[it.k] ? it.k : '',
      abteilung: katalog[it.k]?.c || 'sonstiges',
      packung: '', // der Packungshinweis gilt nur für die Menge, wie sie war – siehe kauf
    };
    if (typeof it.q === 'number' && it.u) z.kauf = { q: it.q, u: it.u, h: it.h || '' };
    zutaten.push(z);
  }
  for (const pz of r.pauschal || []) {
    zutaten.push({ id: `pauschal-${slug(pz.n) || 'gewuerze'}`, name: pz.n, menge: pz.g, einheit: 'g', stueck: '', min: pz.g, max: pz.g, anpassbar: false, pro100: pz.pro100, quelle: 'vorrat', katalog: '', abteilung: 'gewuerz', packung: '', pauschal: true });
  }
  return {
    name: r.name,
    kurz: r.short,
    beschreibung: r.desc,
    protein: r.protein,
    basis: r.base,
    methode: r.method,
    kuehlschrank: r.fridge,
    tiefkuehler: r.freeze,
    portionen: r.portionen || 8,
    zutaten,
    gewuerze: r.spices.map((sp) => ({ name: sp.n, menge: sp.a })),
    schalen: (r.schalen || []).map((sc) => ({ name: sc.name, groesse: sc.gr })),
    geraete: r.geraete || [],
    ablauf: r.ablauf,
    tipps: r.tips || [],
    hinweis: '',
  };
}

/* ------------------------------------------- mit der KI ändern */

/**
 * Ein Rezept im KI-Format so, wie die KI es zum Ändern bekommt: genau im
 * Format ihrer Antwort (SCHEMA), ohne das, was nur die App braucht (kauf,
 * vorschlag, die pauschalen Gewürze). Die Schritte behalten ihre Platzhalter.
 */
export function alsVorlage(k) {
  const schritt = (s) => ({ text: s.d, min: s.min, ...(s.ruhe ? { ruhe: s.ruhe } : {}), ...(s.neben ? { nebenbei: true } : {}), ...(s.liste?.length ? { liste: s.liste } : {}) });
  return {
    name: k.name,
    kurz: k.kurz,
    beschreibung: k.beschreibung,
    protein: k.protein,
    basis: k.basis,
    methode: k.methode,
    kuehlschrank: k.kuehlschrank,
    tiefkuehler: k.tiefkuehler,
    zutaten: k.zutaten.filter((z) => !z.pauschal).map((z) => ({
      id: z.id,
      name: z.name,
      menge: Math.round(z.menge * 10) / 10,
      einheit: z.einheit,
      ...(z.stueck ? { stueck: z.stueck } : {}),
      min: z.min,
      max: z.max,
      anpassbar: z.anpassbar,
      pro100: z.pro100,
      quelle: z.quelle,
      katalog: z.katalog || '',
      abteilung: ABTEILUNGEN.includes(z.abteilung) ? z.abteilung : 'vorrat',
      ...(z.packung ? { packung: z.packung } : {}),
    })),
    gewuerze: k.gewuerze,
    schalen: k.schalen.map((s) => ({ name: s.name, groesse: s.gr || s.groesse || 'mittel' })),
    geraete: k.geraete,
    vorbereiten: (k.ablauf[0]?.schritte || []).map(schritt),
    kochen: (k.ablauf[1]?.schritte || []).map(schritt),
    portionieren: (k.ablauf[2]?.schritte || []).map(schritt),
    tipps: k.tipps,
  };
}

/**
 * Was die KI geändert zurückgibt (bereinigt), an das Ausgangsrezept
 * anschließen – immer gegen das Original gerechnet, auch nach mehreren
 * Änderungen: Zutaten, die es dort nicht gab, sind neu; die es dort gab und
 * jetzt nicht mehr, stehen in weg; was unverändert ist, wird gekauft wie
 * vorher (kauf: 2 Dosen statt 800 g). Die pauschalen Gewürze bleiben, die
 * Portionen auch. Danach rechnet mengenAnpassen() auf die Ziele.
 */
export function aenderungUebernehmen(neu, basis) {
  const k = klon(neu);
  const alt = Object.fromEntries(basis.zutaten.map((z) => [z.id, z]));
  for (const z of k.zutaten) {
    const a = alt[z.id];
    z.vorschlag = z.menge;
    delete z.neu;
    delete z.kauf;
    if (!a) { z.neu = true; continue; }
    if (a.kauf && Math.abs(a.menge - z.menge) < 0.5) z.kauf = klon(a.kauf);
  }
  const da = new Set(k.zutaten.map((z) => z.id));
  for (const z of basis.zutaten) if (z.pauschal && !da.has(z.id)) k.zutaten.push(klon(z));
  const weg = Object.fromEntries(basis.zutaten.filter((z) => !z.pauschal && !da.has(z.id)).map((z) => [z.id, z.name]));
  if (Object.keys(weg).length) k.weg = weg; else delete k.weg;
  k.portionen = basis.portionen;
  return k;
}

/**
 * Was sich beim Anpassen gegenüber dem Ausgangsrezept geändert hat, als
 * kurze Zeilen für die Leiste: „Brokkoli 1 kg → 200 g“, „TK-Erbsen 300 g neu“,
 * „Mais weggelassen“.
 */
export function aenderungenText(k, basis) {
  const zeilen = [];
  const vorher = Object.fromEntries((basis?.zutaten || []).map((z) => [z.id, z]));
  for (const z of k.zutaten) {
    const alt = vorher[z.id];
    if (!alt) { if (!z.pauschal) zeilen.push(`${z.name} ${mengeText(z.menge, z.einheit)} neu`); continue; }
    if (Math.abs(alt.menge - z.menge) >= 1) zeilen.push(`${z.name} ${mengeText(alt.menge, alt.einheit)} → ${mengeText(z.menge, z.einheit)}`);
  }
  for (const [id, name] of Object.entries(k.weg || {})) if (!k.zutaten.some((z) => z.id === id)) zeilen.push(`${name} weggelassen`);
  return zeilen;
}
