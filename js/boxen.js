/*
 * Für wie viele Boxen man kocht – Einstellungen → „Boxen pro Rezept“
 * (liste.json profil.boxen). Die festen Rezepte sind für 8 Boxen gebaut;
 * Marielle kocht meist für 1 oder 2. aufBoxen rechnet ein Rezept um:
 *
 *   - Zutaten: was angezeigt wird („¾ mittlere (75 g)“), was auf die Liste
 *     kommt (q), der Packungshinweis, Gramm für die Nährwerte, Kosten
 *   - Gewürze und die Mengen in den Schritten: „2 gehäufte EL Kreuzkümmel“
 *     → „1½ gehäufte TL“, „3 Zwiebeln“ → „¾ Zwiebel“, „4 Knoblauchzehen“
 *     → „1 Knoblauchzehe“, „8 Boxen“ → „2 Boxen“, „durch 8 teilen“ → „durch
 *     2 teilen“. Was pro Box gilt („je ca. 50 g“, „Je 5 Bällchen in jede
 *     Box“), Zeiten, Temperaturen, Größen („2-cm-Würfel“, „mind. 5 l“) und
 *     Schalen-Nummern bleiben.
 *   - Nährwerttabelle und Kosten fürs ganze Rezept; die Werte pro Box bleiben
 *   - die Zeit: Schnippeln und Portionieren gehen schneller, Garzeiten nicht
 *
 * Stückware bleibt zum Einkaufen sinnvoll: Knoblauchzehen, Eier, Tortillas
 * ganz (mindestens 1), Gemüse und Dosen in Vierteln („¼ Dose“ – gekauft wird
 * eine, liste.js kaufMenge rundet auf). Die Tipps bleiben, wie sie sind, die
 * Mengen dort sind für 8 Boxen (die Anzeige sagt das dazu).
 *
 * Ohne DOM, damit tests/test-boxen.mjs alles direkt in Node prüft.
 */
import { menge, bruch } from './format.js';
import { zeitVon, hatGarzeit } from './zeiten.js';
import { hinweisNeu } from './zielrechner.js';

export const BOXEN_STANDARD = 8;
export const BOXEN_WAHL = [1, 2, 3, 4, 5, 6, 7, 8];
/** Eine Boxenzahl aus beliebigem JSON – 1 bis 8, sonst null. */
export function boxenBereinigen(n) {
  const x = Number(n);
  return Number.isInteger(x) && x >= 1 && x <= 8 ? x : null;
}
/** Für wie viele Boxen eine Liste kocht – ohne Angabe 8. */
export const boxenDerListe = (stand) => boxenBereinigen(stand?.profil?.boxen) || BOXEN_STANDARD;
/** „1 Box“, „2 Boxen“ */
export const boxenText = (n) => (n === 1 ? '1 Box' : `${n} Boxen`);

const klon = (x) => JSON.parse(JSON.stringify(x));
const rund1 = (x) => Math.round(x * 10) / 10;
const rund2 = (x) => Math.round(x * 100) / 100;
const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);

/* -------------------------------------------------------------- Zahlen */

const BRUCH = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
// Tausender mit Punkt („1.275 g“), Dezimalstellen mit Komma („1,5 l“)
const ZAHL = '\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]';

/** „1½“ → 1.5, „1,5“ → 1.5, „½“ → 0.5, „1.275“ → 1275 */
export function zahlLesen(t) {
  const s = String(t).trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  const m = /^(\d+(?:[.,]\d+)?)?([½¼¾⅓⅔⅛])?$/.exec(s);
  if (!m || (!m[1] && !m[2])) return NaN;
  return (m[1] ? Number(m[1].replace(',', '.')) : 0) + (m[2] ? BRUCH[m[2]] : 0);
}

export { bruch };

/** Gramm und Milliliter: ganz bei kleinen Mengen, dann auf 5, ab 200 auf 10. */
export const rundGramm = (x) => (x >= 200 ? Math.round(x / 10) * 10 : x >= 30 ? Math.round(x / 5) * 5 : Math.max(1, Math.round(x)));

/** Stückware: ganz (Zehen, Eier) – mindestens 1; teilbar (Zwiebeln, Dosen) – unter 1 in Vierteln (ganz wenig: ⅛), bis 4 in Halben. */
export function rundStueck(x, art = 'teilbar') {
  if (art === 'ganz') return Math.max(1, Math.round(x));
  if (x < 0.1875) return 0.125;
  if (x < 1) return Math.round(x * 4) / 4;
  if (x < 4) return Math.round(x * 2) / 2;
  return Math.round(x);
}

/* ------------------------------------------------------------- Wörter */

// [Einzahl, Mehrzahl, Art, weitere Formen der Mehrzahl (Dativ)]
const WOERTER = [
  ['Zwiebel', 'Zwiebeln', 'teilbar'], ['Schalotte', 'Schalotten', 'teilbar'], ['Frühlingszwiebel', 'Frühlingszwiebeln', 'teilbar'],
  ['Paprika', 'Paprika', 'teilbar'], ['Paprikaschote', 'Paprikaschoten', 'teilbar'], ['Möhre', 'Möhren', 'teilbar'],
  ['Karotte', 'Karotten', 'teilbar'], ['Zucchini', 'Zucchini', 'teilbar'], ['Limette', 'Limetten', 'teilbar'],
  ['Bio-Limette', 'Bio-Limetten', 'teilbar'], ['Zitrone', 'Zitronen', 'teilbar'], ['Bio-Zitrone', 'Bio-Zitronen', 'teilbar'],
  ['Tomate', 'Tomaten', 'teilbar'], ['Salatgurke', 'Salatgurken', 'teilbar'], ['Gurke', 'Gurken', 'teilbar'],
  ['Aubergine', 'Auberginen', 'teilbar'], ['Süßkartoffel', 'Süßkartoffeln', 'teilbar'], ['Kartoffel', 'Kartoffeln', 'teilbar'],
  ['Avocado', 'Avocados', 'teilbar'], ['Apfel', 'Äpfel', 'teilbar'], ['Kohlrabi', 'Kohlrabi', 'teilbar'],
  ['Mango', 'Mangos', 'teilbar'], ['Chili', 'Chilis', 'teilbar'], ['Chilischote', 'Chilischoten', 'teilbar'],
  ['Peperoni', 'Peperoni', 'teilbar'], ['Banane', 'Bananen', 'teilbar'], ['Orange', 'Orangen', 'teilbar'],
  ['Kopf', 'Köpfe', 'teilbar'], ['Knolle', 'Knollen', 'teilbar'], ['Lauchstange', 'Lauchstangen', 'teilbar'],
  ['Dose', 'Dosen', 'teilbar'], ['Packung', 'Packungen', 'teilbar'], ['Becher', 'Becher', 'teilbar'],
  ['Glas', 'Gläser', 'teilbar'], ['Beutel', 'Beutel', 'teilbar'], ['Tüte', 'Tüten', 'teilbar'], ['Flasche', 'Flaschen', 'teilbar'],
  ['Bund', 'Bund', 'teilbar'], ['Stange', 'Stangen', 'teilbar'], ['Kugel', 'Kugeln', 'teilbar'], ['Tube', 'Tuben', 'teilbar'],
  ['Brühwürfel', 'Brühwürfel', 'teilbar'], ['Würfel', 'Würfel', 'teilbar'], ['Topf', 'Töpfe', 'teilbar'],
  ['Knoblauchzehe', 'Knoblauchzehen', 'ganz'], ['Zehe', 'Zehen', 'ganz'],
  ['Lorbeerblatt', 'Lorbeerblätter', 'ganz', 'Lorbeerblättern'], ['Ei', 'Eier', 'ganz', 'Eiern'], ['Eigelb', 'Eigelb', 'ganz'],
  ['Tortilla', 'Tortillas', 'ganz'], ['Wrap', 'Wraps', 'ganz'], ['Fladenbrot', 'Fladenbrote', 'ganz'],
  ['Bällchen', 'Bällchen', 'ganz'], ['Frikadelle', 'Frikadellen', 'ganz'], ['Stück', 'Stück', 'ganz'],
  ['Scheibe', 'Scheiben', 'ganz'], ['Zweig', 'Zweige', 'ganz', 'Zweigen'], ['Stiel', 'Stiele', 'ganz'],
  ['Nest', 'Nester', 'ganz'], ['Spieß', 'Spieße', 'ganz'], ['Nelke', 'Nelken', 'ganz'], ['Gewürznelke', 'Gewürznelken', 'ganz'],
  ['Kardamomkapsel', 'Kardamomkapseln', 'ganz'], ['Zimtstange', 'Zimtstangen', 'ganz'], ['Sternanis', 'Sternanis', 'ganz'],
];
const WORT = new Map();
for (const [ein, mehr, art, ...andere] of WOERTER) {
  WORT.set(ein, { ein, mehr, art });
  WORT.set(mehr, { ein, mehr, art });
  for (const a of andere) WORT.set(a, { ein, mehr: a, art });
}
const BOXWORT = { Box: ['Box', 'Boxen'], Boxen: ['Box', 'Boxen'], Döschen: ['Döschen', 'Döschen'] };
const LOEFFEL = { EL: 3, TL: 1, Esslöffel: 3, Teelöffel: 1 };
const MASSE = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], cl: ['ml', 10] };
const ADJEKTIV = '(?:gehäufte[r]?|gestrichene[r]?|knappe[r]?|gute[r]?|kräftige|große[r]?|kleine[r]?|mittlere[r]?|mittelgroße[r]?|rote|gelbe|grüne|weiße|frische|reife|getrocknete|dünne|dicke)';
const NACH = new RegExp(`^(\\s*)((?:${ADJEKTIV}\\s+)*)([A-Za-zÄÖÜäöüß][\\wÄÖÜäöüß-]*)(\\.?)`);

/* ------------------------------------------------------------ Mengen */

/**
 * Eine Löffelmenge in Teelöffeln (t) als Text: „1½ TL“, „1 EL“, „¼ TL“ –
 * ab 1 EL (war es vorher EL) bzw. 2 EL in EL, unter ⅛ TL „1 Prise“.
 */
function loeffelText(t, warEL) {
  if (t < 0.09) return { z: '1', e: 'Prise' };
  if ((warEL && t >= 3 - 1e-9) || t >= 6 - 1e-9) return { z: bruch(Math.max(1, Math.round((t / 3) * 2) / 2)), e: 'EL' };
  if (t >= 0.875) return { z: bruch(Math.round(t * 2) / 2), e: 'TL' };
  const w = t < 0.19 ? 1 / 8 : t < 0.375 ? 1 / 4 : t < 0.625 ? 1 / 2 : 3 / 4;
  return { z: bruch(w), e: 'TL' };
}
/** „1–1 TL“ → „1 TL“ */
const spanneText = (a, b) => (b === null || a === b ? a : `${a}–${b}`);
const einzahlAdjektiv = (adj, z) => (z === '1' ? adj.replace(/\b(gehäuft|gestrichen|knapp|gut)e\s/g, '$1er ') : adj.replace(/\b(gehäuft|gestrichen|knapp|gut)er\s/g, '$1e '));

/**
 * Alle Mengen in einem Text mal f. art: 'schritt' (Schritte, Gewürze) oder
 * 'zutat' (die Mengenangabe einer Zutat – eine Zahl ohne Einheit vorn ist
 * dort die Zutat selbst: „3 mittlere (300 g)“). P: Boxen vorher, n: nachher.
 */
export function textSkalieren(text, f, { art = 'schritt', P = BOXEN_STANDARD, n = BOXEN_STANDARD, stueck = '' } = {}) {
  let t = String(text ?? '');
  if (!t || Math.abs(f - 1) < 1e-9) return t;
  // „In 2 × 4 gleich große Stücke“ – ein Raster aus so vielen Stücken wie Boxen
  t = t.replace(/(\d+)\s*×\s*(\d+)(\s+gleich große Stücke)/g, (m, a, b, rest) => (Number(a) * Number(b) === P ? `${n}${rest}` : m));
  // „1 EL + 1 TL“ ist eine Menge
  t = t.replace(new RegExp(`(${ZAHL})\\s*EL\\s*\\+\\s*(${ZAHL})\\s*TL\\b`, 'g'), (m, a, b) => {
    const tl = zahlLesen(a) * 3 + zahlLesen(b);
    return Number.isFinite(tl) ? `${bruch(tl)} TL` : m;
  });
  const re = new RegExp(`(${ZAHL})(?:\\s*[–-]\\s*(${ZAHL}))?`, 'g');
  let aus = '';
  let ab = 0;
  let tiefe = 0;
  let geschweift = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    // In {platzhaltern} nichts anfassen
    for (let i = ab; i < m.index; i++) { if (t[i] === '{') geschweift++; else if (t[i] === '}') geschweift = Math.max(0, geschweift - 1); }
    tiefe = geschweift;
    const ersatz = tiefe ? null : mengeErsetzen(t, m, f, { art, P, n, stueck });
    if (ersatz) {
      aus += t.slice(ab, m.index) + ersatz.text;
      ab = m.index + ersatz.laenge;
      re.lastIndex = ab;
    } else {
      aus += t.slice(ab, re.lastIndex);
      ab = re.lastIndex;
    }
  }
  aus += t.slice(ab);
  // „Die restlichen 4 Tortillas“ für eine: „Die restliche Tortilla“
  return aus.replace(/\b([Dd]ie) restlichen 1 /g, '$1 restliche ');
}

function mengeErsetzen(t, m, f, opt) {
  const { art, P, n } = opt;
  const i = m.index;
  const vor = t.slice(Math.max(0, i - 24), i);
  const davor = t[i - 1] || '';
  if (/[\wÄÖÜäöüß.,/-]/.test(davor) && !/^\s/.test(davor)) return null; // Teil eines Worts („B12“, „3,5“)
  if (/(?:Schalen?|Stufe|à|Nr\.|Blech|Gang|Seite|Lagen?)\s*$/i.test(vor)) return null;
  if (/(?:^|[\s(])(?:je|Je|pro)(?:\s+ca\.)?\s*$/.test(vor)) return null; // je Box, (je ca. 25 g)
  if (/(?:mind\.|Messbecher\s*\(|×)\s*$/.test(vor)) return null; // Größen: mind. 5 l, Messbecher (1 l), 25 × 30 cm
  const lang = m[0];
  const rest = t.slice(i + lang.length);
  if (/^(?:\s*-\s*[A-Za-z]|-|\s*[°%×x]|\s*(?:cm|mm|Min|Minuten|Std|Stunden|Sek|Sekunden|Tage?|Tagen|Wochen?|Monate?n?|kcal|Uhr|statt|Grad|er-|er\b|sind\b|ist\b))/.test(rest)) return null;
  const a = zahlLesen(m[1]);
  const b = m[2] !== undefined ? zahlLesen(m[2]) : null;
  if (!Number.isFinite(a) || (b !== null && !Number.isFinite(b))) return null;
  const w = NACH.exec(rest);
  const zwischen = w ? w[1] : '';
  const adj = w ? w[2] : '';
  const wort = w ? w[3] : '';
  const punkt = w ? w[4] : '';
  const ende = w ? lang.length + w[0].length : lang.length;
  // „knapp 19 g pro Box“, „1 TL je Portion“: gilt pro Box
  if (/^\s*(?:pro|je)\s+(?:Box|Portion|Döschen|Stück|Person)\b/.test(t.slice(i + ende))) return null;
  const spanne = (fn) => spanneText(fn(a), b === null ? null : fn(b));
  // durch 8 teilen, 8 gleiche Stücke, 8 Boxen, 8 Döschen: so viele wie Boxen
  if (b === null && (/durch\s*$/.test(vor) || wort === 'gleiche') && Math.abs(a - P) < 1e-9) return { text: String(n), laenge: lang.length };
  if (BOXWORT[wort] && !adj) {
    const z = b === null ? Math.max(1, Math.round(a * f)) : null;
    if (z === null) return null;
    const [ein, mehr] = BOXWORT[wort];
    return { text: `${z}${zwischen}${z === 1 ? ein : mehr}${punkt}`, laenge: ende };
  }
  if (LOEFFEL[wort]) {
    // Die obere Menge entscheidet über EL oder TL, die untere kommt in dieselbe Einheit
    const oben = loeffelText((b ?? a) * LOEFFEL[wort] * f, LOEFFEL[wort] === 3);
    if (oben.e === 'Prise') return { text: `1${zwischen}Prise`, laenge: ende - punkt.length };
    const fmt = (x) => {
      const tl = x * LOEFFEL[wort] * f;
      if (oben.e === 'EL') return bruch(Math.max(0.5, Math.round((tl / 3) * 2) / 2));
      const l = loeffelText(tl, false);
      return l.e === 'Prise' ? '⅛' : l.z;
    };
    const z = spanne(fmt);
    return { text: `${z}${zwischen}${einzahlAdjektiv(adj, z)}${oben.e}`, laenge: ende - punkt.length };
  }
  if (MASSE[wort] && !adj) {
    const [einheit, mal] = MASSE[wort];
    const unten = menge(rundGramm(a * mal * f), einheit);
    if (b === null) return { text: `${unten}${punkt}`, laenge: ende };
    // Spanne: „300–400 g“ → „75–100 g“ (die Einheit einmal)
    const obenT = menge(rundGramm(b * mal * f), einheit);
    const e1 = unten.split(' ').pop();
    const e2 = obenT.split(' ').pop();
    return { text: `${e1 === e2 ? spanneText(unten.replace(` ${e1}`, ''), obenT.replace(` ${e2}`, '')) + ` ${e2}` : `${unten}–${obenT}`}${punkt}`, laenge: ende };
  }
  if (/^(?:Prise|Prisen|Msp|Messerspitze|Messerspitzen)$/.test(wort)) {
    const z = Math.max(1, Math.round((b ?? a) * f));
    const sing = { Prise: 'Prise', Prisen: 'Prise', Msp: 'Msp', Messerspitze: 'Messerspitze', Messerspitzen: 'Messerspitze' }[wort];
    const plur = { Prise: 'Prisen', Prisen: 'Prisen', Msp: 'Msp', Messerspitze: 'Messerspitzen', Messerspitzen: 'Messerspitzen' }[wort];
    return { text: `${z}${zwischen}${adj}${z === 1 ? sing : plur}${punkt}`, laenge: ende };
  }
  if (wort === 'genauso' && !adj && b === null) return { text: String(rundStueck(a * f, 'ganz')), laenge: lang.length };
  // „3 Stück (ca. 450 g)“ bei Paprika ist die Paprika selbst – die rundet die Zutat (opt.stueck)
  const x = wort === 'Stück' && opt.stueck ? { ...WORT.get('Stück'), art: opt.stueck } : WORT.get(wort);
  if (x) {
    const fmt = (v) => bruch(rundStueck(v * f, x.art));
    const z = spanne(fmt);
    const oben = rundStueck((b ?? a) * f, x.art);
    return { text: `${z}${zwischen}${adj}${oben <= 1 + 1e-9 ? x.ein : x.mehr}${punkt}`, laenge: ende };
  }
  // In der Mengenangabe einer Zutat: vorn (oder nach „oder“) ist die Zahl die Zutat selbst – „3 mittlere (300 g)“
  if (art === 'zutat' && (i === 0 || /(?:\(|\boder\s|\bca\.\s)$/.test(vor) || /^\s*\(/.test(rest) || adj)) {
    const z = spanne((v) => bruch(rundStueck(v * f, 'teilbar')));
    return { text: z, laenge: lang.length };
  }
  return null;
}

/* ----------------------------------------------------------- Rezepte */

const STUECK_GANZ = new Set(['Zehe']);
const ZUTAT_GANZ = /^(?:eier?|ei-|eigelb)/;

/** Eine Zutat mal f: Anzeige, Menge zum Kaufen, Packung, Gramm, Kosten. */
function zutatSkalieren(it, f, opt) {
  const neu = { ...it };
  const ganz = STUECK_GANZ.has(it.u) || ZUTAT_GANZ.test(String(it.k || ''));
  if (istZahl(it.g)) neu.g = rund1(it.g * f);
  if (istZahl(it.q)) {
    if (!it.u || it.u === 'g' || it.u === 'ml') {
      neu.q = rundGramm(it.q * f);
      neu.h = hinweisNeu(it.h, it.q, neu.q);
    } else {
      neu.q = rundStueck(it.q * f, ganz ? 'ganz' : 'teilbar');
      // „3er-Pack“ passt nicht mehr zu einer Paprika
      if (it.h && Math.abs(neu.q - it.q) > 0.15 * it.q) neu.h = '';
    }
    // Weniger als vorher: „1 Becher“, „kleine Dose“, „ohne Garnelen – Zutaten prüfen“ stimmen weiter – gekauft wird trotzdem einer
    if (!neu.h && it.h && f < 1 && (!/\d/.test(it.h) || /^1\s/.test(it.h))) neu.h = it.h;
  }
  // Haushalt (Backpapier „1 Blatt fürs Blech“) nur, wo „Stück“ dasteht – Döschen gibt es eins je Box
  neu.a = textSkalieren(it.a, f, { ...opt, art: it.haus ? 'schritt' : 'zutat', stueck: it.haus ? '' : ganz ? 'ganz' : 'teilbar' });
  // „30 g (daumengroß)“ – für 8 g passt die Größe nicht mehr
  if (f < 0.75) neu.a = neu.a.replace(/\s*\((?:daumengroß|faustgroß|handtellergroß)\)/g, '');
  if (it.haus && /Blätter? für zwei Bleche|Blatt fürs Blech/.test(it.a) && opt.einBlech) neu.a = '1 Blatt fürs Blech';
  if (istZahl(it.eur)) neu.eur = rund2(it.eur * f);
  if (istZahl(it.min)) neu.min = rund1(it.min * f);
  if (istZahl(it.max)) neu.max = rund1(it.max * f);
  return neu;
}

/** Schnippeln und Portionieren dauern bei weniger Boxen kürzer, Garzeiten nicht. */
function minutenFuer(s, phase, f) {
  const min = Number(s.min) || 0;
  if (!min || hatGarzeit(s)) return min;
  const p = String(phase || '').toLowerCase();
  if (/portion|abfüll|boxen/.test(p)) return Math.max(1, Math.round(min * f));
  if (/vorbereit|schnippel|mise/.test(p)) return Math.max(1, Math.round(min * f + 0.4 * (1 - f)));
  return min;
}

/**
 * Ein Rezept für n Boxen (statt r.portionen, sonst 8). Bei derselben Zahl
 * bleibt es, wie es ist. Danach hat es r.portionen = n und die Mengen
 * überall; die Werte pro Box (r.m) bleiben.
 */
export function aufBoxen(r, n) {
  const P = r?.portionen || BOXEN_STANDARD;
  const z = boxenBereinigen(n);
  if (!r || !Array.isArray(r.items) || !z || z === P) return r;
  const f = z / P;
  // Für die Hälfte oder weniger reicht ein Blech
  const opt = { P, n: z, einBlech: z <= P / 2 };
  const neu = klon(r);
  neu.portionen = z;
  neu.items = r.items.map((it) => zutatSkalieren(it, f, opt));
  neu.spices = (r.spices || []).map((s) => ({ ...s, a: textSkalieren(s.a, f, opt) }));
  neu.ablauf = (r.ablauf || []).map((p) => ({
    ...p,
    schritte: p.schritte.map((s) => {
      const d = einBoxText(opt.einBlech ? einBlechText(textSkalieren(s.d, f, opt)) : textSkalieren(s.d, f, opt), z);
      const x = { ...s, d, min: minutenFuer(s, p.t, f) };
      if (Array.isArray(s.liste)) x.liste = s.liste.map((l) => textSkalieren(l, f, opt));
      return x;
    }),
  }));
  if (Array.isArray(r.geraete)) neu.geraete = r.geraete.map((g) => geraetFuer(g, opt));
  if (Array.isArray(r.pauschal)) neu.pauschal = r.pauschal.map((x) => (istZahl(x.g) ? { ...x, g: rund1(x.g * f) } : x));
  if (Array.isArray(r.nut)) neu.nut = r.nut.map((zeile) => [zeile[0], textSkalieren(zeile[1], f, { ...opt, art: 'zutat' }), ...zeile.slice(2).map((v) => (istZahl(v) ? rund1(v * f) : v))]);
  if (Array.isArray(r.total)) neu.total = r.total.map((v) => (istZahl(v) ? rund1(v * f) : v));
  if (r.kosten && istZahl(r.kosten.gesamt)) neu.kosten = { ...r.kosten, gesamt: rund2(r.kosten.gesamt * f) };
  if (r.angepasst?.aenderungen) {
    neu.angepasst = { ...r.angepasst, aenderungen: r.angepasst.aenderungen.map((x) => ({ ...x, vorher: textSkalieren(x.vorher, f, { ...opt, art: 'zutat' }), nachher: textSkalieren(x.nachher, f, { ...opt, art: 'zutat' }) })) };
  }
  if (r.zeit) neu.zeit = zeitVon(neu);
  if (istZahl(r.time) && neu.zeit) neu.time = neu.zeit.gesamt;
  neu.boxen = { vorher: P, tipps: (r.tips || []).length > 0 };
  return neu;
}

/** Geräte für weniger Boxen: ein Blech, eine kleine Auflaufform, kein Mindestmaß für den Topf. */
function geraetFuer(g, { einBlech }) {
  if (!einBlech) return g;
  return String(g)
    .replace(/^2 Backbleche$/, 'Backblech')
    .replace(/\s*\(mind\.\s*\d+(?:,\d+)?\s*l\)/, '')
    .replace(/(?:große\s+)?Auflaufform\s*(?:\(ca\.\s*\d+\s*×\s*\d+\s*cm\)|ca\.\s*\d+\s*×\s*\d+\s*cm)(?:\s*oder zwei kleine)?/, 'kleine Auflaufform');
}

/** Zwei Bleche für 8 Boxen – für 4 oder weniger reicht eins. */
function einBlechText(d) {
  return d
    .replace(/\s*–\s*zwei Bleche gehen nur mit Umluft/, '')
    .replace(/^2 Bleche mit Backpapier belegen/, 'Ein Blech mit Backpapier belegen')
    .replace(/Schale (\d) auf ein Blech, Schale (\d) auf das andere, beide in den Ofen/, 'Schale $1 und Schale $2 nebeneinander aufs Blech, in den Ofen')
    .replace(/je zur Hälfte auf beide Bleche verteilen/g, 'auf dem Blech verteilen')
    .replace(/je zur Hälfte in die Mitte beider Bleche/g, 'in die Mitte des Blechs')
    .replace(/in die Mitte beider Bleche/g, 'in die Mitte des Blechs')
    .replace(/auf beide Bleche verteilen/g, 'auf dem Blech verteilen')
    .replace(/von den Blechen/g, 'vom Blech')
    .replace(/^Bleche /, 'Blech ');
}

/** Für eine einzige Box: „auf die Boxen verteilen“ → „in die Box“ und was sonst nach mehreren klingt. */
function einBoxText(d, n) {
  if (n !== 1) return d;
  return d
    .replace(/In 1 gleich große Stücke schneiden und in die Boxen heben/, 'Im Ganzen in die Box heben')
    .replace(/In 1 gleiche Stücke schneiden und je 1 Stück in eine Box/, 'Im Ganzen in die Box')
    .replace(/,? ?(?:und )?das Gewicht durch 1 teilen/, '')
    .replace(/in die Schüssel, wiegen, durch 1 teilen, verteilen/, 'in die Box')
    .replace(/\b1 Box nacheinander auf die Waage stellen und je die Menge/, 'Die Box auf die Waage stellen und die Menge')
    .replace(/auf die 1 Box\b/g, 'in die Box')
    .replace(/(^|\s)auf die Boxen\b/g, '$1in die Box')
    .replace(/(^|\s)(in|über) die Boxen\b/g, '$1$2 die Box');
}

/** Stückware zum Einkaufen: ½ Dose fürs Rezept heißt eine Dose kaufen. */
const NACH_GEWICHT = new Set(['g', 'ml', 'kg', 'l']);
export const kaufMenge = (q, u) => (istZahl(q) && u && !NACH_GEWICHT.has(u) && Math.abs(q - Math.round(q)) > 1e-6 ? Math.ceil(q - 1e-6) : q);
