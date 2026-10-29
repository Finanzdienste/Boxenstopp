/*
 * Amys Rezepte – ohne DOM, damit die Tests alles hier direkt in Node prüfen.
 *
 * Amy schreibt ihre Rezepte selbst: eine Zutat je Zeile („500 g
 * Hähnchenbrust“, „2 Zwiebeln“, „1 Dose Kokosmilch“, „Salz“), ein Schritt je
 * Zeile („Zwiebeln würfeln“, „20 Min. backen“). Gespeichert wird genau das,
 * was sie getippt hat – in liste.json unter `amy`, für beide Handys –, und
 * die App liest es bei jedem Zeichnen neu:
 *
 *   Zutaten   Menge, Einheit, Name. Über den Namen der Katalog-Schlüssel
 *             (angebote.js schluesselRaten): Dann teilt sich die Zutat auf
 *             der Einkaufsliste eine Zeile mit den festen Rezepten, und die
 *             App kennt Nährwerte und Richtpreis. Unbekanntes bekommt einen
 *             eigenen Schlüssel (amyz-…) und eine geratene Abteilung.
 *   Schritte  Zeiten im Text werden zum Timer (zeiten.js timerPlan); eine
 *             kurze Zeile mit Doppelpunkt am Ende („Soße:“) beginnt einen
 *             neuen Abschnitt.
 *   Zeit      was sie angibt – sonst geschätzt (Garzeiten plus ein paar
 *             Minuten je Arbeitsschritt). Hat sie es einmal gekocht und dabei
 *             abgehakt, gilt die gemessene Zeit (tempo.js).
 *
 * Ein Rezept im Stand:
 *
 *   { id: 'amy-pancakes-x7k2', name, bild, portionen, zeit, zutaten: [Zeile],
 *     schritte: [Zeile], notiz, by, at, geaendert }
 */
import { schluesselRaten } from './angebote.js';
import { abteilung } from './format.js';
import { kostenMenge } from './kosten.js';
import { textMinuten } from './zeiten.js';
import { AMY_BILDER } from './bilder.js';

export const AMY_ID = /^amy-[a-z0-9-]{1,60}$/;
export const MAX_AMY = 60;
const MAX_ZEILEN = 40;

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const zeilen = (v, max) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [])
  .map((z) => text(z, max)).filter(Boolean).slice(0, MAX_ZEILEN);

/** „Omas Pfannkuchen!“ → „omas-pfannkuchen“ */
export function slug(t) {
  return String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'rezept';
}
export const neueAmyId = (name) => `amy-${slug(name).slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`;

/** Ein Rezept aus beliebigem JSON – oder null. */
export function amyBereinigen(roh) {
  if (!istObj(roh) || !AMY_ID.test(String(roh.id || ''))) return null;
  const name = text(roh.name, 80);
  if (!name) return null;
  const portionen = Math.round(Number(roh.portionen));
  const zeit = Math.round(Number(roh.zeit));
  return {
    id: roh.id,
    name,
    bild: AMY_BILDER.includes(roh.bild) ? roh.bild : AMY_BILDER[0],
    portionen: portionen >= 1 && portionen <= 30 ? portionen : 4,
    zeit: zeit > 0 && zeit <= 1440 ? zeit : 0,
    zutaten: zeilen(roh.zutaten, 120),
    schritte: zeilen(roh.schritte, 300),
    notiz: typeof roh.notiz === 'string' ? roh.notiz.trim().slice(0, 600) : '',
    by: text(roh.by, 40) || null,
    at: text(roh.at, 40),
    geaendert: text(roh.geaendert, 40),
  };
}

/* --------------------------------------------------------------- Zutaten */

const BRUCH = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
// [Muster, Einheit auf der Liste, Faktor dorthin]
const EINHEITEN = [
  [/^(kg|kilo|kilogramm)$/, 'g', 1000], [/^(g|gr|gramm)$/, 'g', 1],
  [/^(l|liter|ltr)$/, 'ml', 1000], [/^(ml|milliliter)$/, 'ml', 1], [/^cl$/, 'ml', 10],
  [/^(el|essl(ö|oe)ffel)$/, 'EL', 1], [/^(tl|teel(ö|oe)ffel)$/, 'TL', 1],
  [/^(dosen?|ds)$/, 'Dose', 1], [/^(gl(ä|a)s(er)?)$/, 'Glas', 1], [/^(pck|pkg|p(ä|a)ckchen|packung(en)?|pack|pkt)$/, 'Pck', 1],
  [/^(bund|bd)$/, 'Bund', 1], [/^(zehen?)$/, 'Zehe', 1], [/^(st(ü|u)ck|stk|st)$/, 'Stk', 1],
  [/^becher$/, 'Becher', 1], [/^(prisen?)$/, 'Prise', 1], [/^(scheiben?)$/, 'Scheibe', 1], [/^(tassen?)$/, 'Tasse', 1],
  [/^handvoll$/, 'Handvoll', 1], [/^msp$/, 'Msp', 1], [/^(stangen?)$/, 'Stange', 1], [/^(knollen?)$/, 'Knolle', 1], [/^(k(ö|o)pfe?|kopf)$/, 'Kopf', 1],
  [/^(beutel|btl)$/, 'Beutel', 1], [/^(flaschen?|fl)$/, 'Flasche', 1], [/^(netz)$/, 'Netz', 1],
];
/* Was ein Stück ungefähr wiegt – für Nährwerte und damit „2 Zwiebeln“ zu den 300 g eines anderen Rezepts passt. */
const STUECK_G = { zwiebeln: 100, 'rote-zwiebeln': 100, moehren: 100, tomaten: 100, aepfel: 150, kartoffeln: 150, suesskartoffel: 300, zucchini: 300, gurke: 400, aubergine: 300, champignons: 20, brokkoli: 400, blumenkohl: 600, eier: 60 };
/* Löffel in Gramm, ungefähr – für Nährwerte und Kosten. */
const LOEFFEL_G = { EL: 12, TL: 4 };
/** Was man nicht einkauft: Wasser, Salz, Pfeffer. */
const NIE_KAUFEN = /^(?:(?:kaltes |warmes |heißes )?wasser|leitungswasser|eiswasser|salz|pfeffer|salz (?:und|&) pfeffer|salz, pfeffer|meersalz|jodsalz)$/i;

const zahlAus = (t) => Number(String(t).replace(',', '.'));
const gross = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Eine Zeile lesen: „1½ EL Sojasauce“, „2–3 Zwiebeln, gewürfelt“, „1 Dose Kokosmilch (400 ml)“, „Salz“.
 * → { roh, name, q, u, a, h, k, kat, gewuerz, kaufen }
 *   q/u  Menge und Einheit, wie sie auf die Liste kommen (q null, wenn keine dasteht)
 *   a    die Menge, wie sie im Rezept steht („1½ EL“), h ein Zusatz („gewürfelt“)
 *   k    Katalog-Schlüssel oder amyz-…; kat { n, c } für die Liste
 */
export function zutatLesen(zeile, katalog = {}) {
  const roh = text(zeile, 120);
  let t = roh.replace(/^[-•*·]\s*/, '').replace(/^(?:ca\.|circa|etwa)\s+/i, '');
  let q = null;
  let menge = '';
  const m = t.match(/^(\d+(?:[.,]\d+)?)?(?:\s*\/\s*(\d+))?\s?([½¼¾⅓⅔⅛])?(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?(?=\s|[a-zA-ZäöüÄÖÜ]|$)/);
  if (m && (m[1] || m[3])) {
    let x = m[1] ? zahlAus(m[1]) : 0;
    if (m[2] && m[1]) x /= Number(m[2]) || 1;
    if (m[3]) x += BRUCH[m[3]];
    if (m[4]) x = Math.max(x, zahlAus(m[4])); // „2–3 Zwiebeln“: für den Einkauf die größere Zahl
    if (x > 0 && x < 100000) { q = x; menge = m[0].trim(); t = t.slice(m[0].length).trim(); }
  }
  let u = '';
  let faktor = 1;
  if (q !== null) {
    const w = t.match(/^([A-Za-zÄÖÜäöüß]+)\.?(?=\s|$)/);
    const e = w && EINHEITEN.find(([re]) => re.test(w[1].toLowerCase()));
    if (e) { u = e[1]; faktor = e[2]; menge = `${menge} ${w[0]}`; t = t.slice(w[0].length).trim(); }
  }
  t = t.replace(/^(?:x|×)\s+/, '');
  // Zusatz: „(400 ml)“ und alles nach dem ersten Komma
  let h = '';
  const klammer = t.match(/\s*\(([^)]*)\)\s*$/);
  if (klammer) { h = klammer[1].trim(); t = t.slice(0, klammer.index).trim(); }
  const komma = t.indexOf(',');
  if (komma > 0 && !NIE_KAUFEN.test(t)) { h = [t.slice(komma + 1).trim(), h].filter(Boolean).join(', '); t = t.slice(0, komma).trim(); }
  const name = gross(t || roh);
  const k0 = schluesselRaten(name, katalog);
  const k = k0 || `amyz-${slug(name)}`;
  const kat = k0 ? { n: katalog[k0].n, c: katalog[k0].c } : { n: name, c: abteilung(name, katalog) };
  if (q !== null && !u) u = k0 === 'knoblauch' && /zehe/i.test(name) ? 'Zehe' : 'Stk';
  const gewuerz = kat.c === 'gewuerz' || /^(salz|pfeffer)\b/i.test(name);
  return { roh, name, q: q === null ? null : Math.round(q * faktor * 100) / 100, u, a: menge, h, k, kat, gewuerz, kaufen: !NIE_KAUFEN.test(name) && !NIE_KAUFEN.test(roh) };
}

/** Gramm einer Zutat – null, wenn die App es nicht weiß. */
export function gramm(z, { naehrwerte = {} } = {}) {
  if (z.q === null) return null;
  if (z.u === 'g' || z.u === 'ml') return z.q;
  if (LOEFFEL_G[z.u]) return z.q * LOEFFEL_G[z.u];
  if (z.u === 'Prise' || z.u === 'Msp') return 0;
  const n = naehrwerte[z.k];
  if (n && n.u === z.u && n.je) return z.q * n.je;
  if (z.u === 'Stk' && STUECK_G[z.k]) return z.q * STUECK_G[z.k];
  return null;
}

/**
 * Die Menge so, wie sie zur Zeile auf der Liste passt: „300 g Paprika“ bei
 * Paprika in Stück → 2 Stk.; „2 Zwiebeln“ bei Zwiebeln in Gramm → 200 g.
 */
export function listenMenge(z, { naehrwerte = {}, einheiten = {} } = {}) {
  if (z.q === null) return null;
  // Löffel und Prisen bleiben, wie sie dastehen – „2 EL“ versteht jeder
  if (LOEFFEL_G[z.u] || z.u === 'Prise' || z.u === 'Msp') return { q: z.q, u: z.u };
  const ziel = einheiten[z.k] || naehrwerte[z.k]?.u;
  if (!ziel || ziel === z.u) return { q: z.q, u: z.u };
  const g = gramm(z, { naehrwerte });
  if (g === null) return { q: z.q, u: z.u };
  if (ziel === 'g' || ziel === 'ml') return { q: Math.round(g), u: ziel };
  const je = naehrwerte[z.k]?.u === ziel ? naehrwerte[z.k].je : 0;
  return je ? { q: Math.max(1, Math.ceil(g / je - 0.15)), u: ziel } : { q: z.q, u: z.u };
}

/** Alle Zutaten eines Rezepts gelesen. */
export const zutatenVon = (r, katalog = {}) => (r?.zutaten || []).map((z) => zutatLesen(z, katalog));

/**
 * Was „Alles auf die Einkaufsliste“ einträgt: alles außer Gewürzen, Wasser,
 * Salz und Pfeffer. Dieselbe Zutat zweimal im Rezept wird eine Zeile.
 * → [{ k, teil, kat }]
 */
export function amyEinkauf(r, daten = {}) {
  const je = new Map();
  for (const z of zutatenVon(r, daten.katalog || {})) {
    if (!z.kaufen || z.gewuerz) continue;
    const lm = listenMenge(z, daten);
    const da = je.get(z.k);
    if (!da) { je.set(z.k, { k: z.k, kat: z.kat, q: lm?.q ?? null, u: lm?.u || '', h: z.h, texte: [z.a || ''] }); continue; }
    if (lm && da.q !== null && da.u === lm.u) da.q = Math.round((da.q + lm.q) * 100) / 100;
    else da.q = null;
    da.texte.push(z.a || '');
  }
  return [...je.values()].map((x) => ({
    k: x.k,
    kat: x.kat,
    teil: x.q !== null ? { q: x.q, u: x.u, h: x.h ? x.h.slice(0, 80) : '' } : { t: x.texte.filter(Boolean).join(' + ').slice(0, 80) },
  }));
}

/** Eine Zutat einzeln auf die Liste – wie amyEinkauf, nur für eine Zeile. */
export function teilFuer(z, daten = {}) {
  const lm = listenMenge(z, daten);
  return lm ? { q: lm.q, u: lm.u, h: z.h ? z.h.slice(0, 80) : '' } : { t: z.a || '' };
}

/**
 * Nährwerte pro Portion, so weit die App die Zutaten kennt:
 * { kcal, p, kh, f, bekannt, unbekannt: [Namen] } – unbekannt sind Zutaten
 * mit Menge, aber ohne Werte (Gewürze ohne Menge zählen nicht).
 */
export function amyNaehrwerte(r, daten = {}) {
  const s = { kcal: 0, p: 0, kh: 0, f: 0 };
  const unbekannt = [];
  let bekannt = 0;
  for (const z of zutatenVon(r, daten.katalog || {})) {
    const n = daten.naehrwerte?.[z.k];
    const g = gramm(z, daten);
    if (n?.pro100 && g !== null) {
      for (const x of ['kcal', 'p', 'kh', 'f']) s[x] += (n.pro100[x] || 0) * g / 100;
      bekannt++;
    } else if (z.q !== null && !z.gewuerz && z.kaufen) unbekannt.push(z.name);
  }
  const n = r?.portionen || 4;
  return { kcal: Math.round(s.kcal / n), p: Math.round(s.p / n * 10) / 10, kh: Math.round(s.kh / n * 10) / 10, f: Math.round(s.f / n * 10) / 10, bekannt, unbekannt };
}

/** Kosten zum Richtpreis: { gesamt, portion, luecken } – luecken: Zutaten ohne Preis. */
export function amyKosten(r, daten = {}) {
  let gesamt = 0;
  let luecken = 0;
  for (const z of zutatenVon(r, daten.katalog || {})) {
    if (!z.kaufen || z.gewuerz) continue;
    const g = gramm(z, daten);
    const e = g !== null && g > 0 ? kostenMenge(z.k, g, 'g', daten) : z.q !== null ? kostenMenge(z.k, z.q, z.u, daten) : null;
    if (e === null) luecken++; else gesamt += e;
  }
  return { gesamt, portion: gesamt / (r?.portionen || 4), luecken };
}

/* -------------------------------------------------------------- Schritte */

/** „Soße:“ oder „Für den Teig:“ – eine kurze Zeile mit Doppelpunkt am Ende ist eine Überschrift. */
const istUeberschrift = (z) => z.length <= 40 && /:\s*$/.test(z) && !/\d/.test(z);

/** Minuten eines Schritts: die Zeit aus dem Text, sonst grob nach der Länge (2–8 Min.). */
export function schrittMinuten(d) {
  const t = textMinuten(d);
  if (t) return t;
  return Math.min(8, Math.max(2, Math.round(String(d).length / 22)));
}

/** Die Schritte in Abschnitten wie bei den festen Rezepten: [{ t, schritte: [{ d, min }] }] */
export function amyAblauf(r) {
  const ablauf = [];
  let p = null;
  for (const z of r?.schritte || []) {
    if (istUeberschrift(z)) { p = { t: z.replace(/:\s*$/, ''), schritte: [] }; ablauf.push(p); continue; }
    if (!p) { p = { t: 'Zubereitung', schritte: [] }; ablauf.push(p); }
    p.schritte.push({ d: z, min: schrittMinuten(z) });
  }
  return ablauf.filter((x) => x.schritte.length);
}

/**
 * Ein Rezept, wie es Timer, Tempo, Lob und die Einkaufsliste verstehen
 * (id, name, short, ablauf, items mit Schlüssel und Abteilung).
 */
export function alsRezept(r, daten = {}) {
  const ablauf = amyAblauf(r);
  return {
    id: r.id,
    name: r.name,
    short: r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name,
    amy: true,
    portionen: r.portionen,
    ablauf,
    items: zutatenVon(r, daten.katalog || {}).map((z) => ({ k: z.k, n: z.name, kat: z.kat, q: z.q, u: z.u })),
    zeitAngabe: r.zeit || 0,
  };
}

/** Geschätzte Minuten ohne Messung: ihre Angabe, sonst Garzeiten plus Arbeitsschritte. */
export function amySchaetzung(r) {
  if (r?.zeit) return r.zeit;
  return amyAblauf(r).reduce((n, p) => n + p.schritte.reduce((m, s) => m + s.min, 0), 0);
}
