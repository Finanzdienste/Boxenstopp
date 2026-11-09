/*
 * Der Essensplan – ohne DOM, damit die Tests es in Node prüfen. In
 * liste.json unter `essensplan`, für alle, die die Liste teilen:
 *
 *   { tage: { '2026-11-10': { mittag: [E, …], abend: [E, …], kochen: [K, …] } } }
 *
 *   E  wer isst was   { id: 'ep-…', rid?, text?, wer, box?, by, at }
 *                     rid: ein Rezept (fest, Katalog, Resteverwertung oder
 *                     Amys), text: was es sonst gibt („Pizza bestellen“),
 *                     wer: 'beide' oder ein Name, box: die Box stammt von
 *                     diesem Kochtag
 *   K  ein Kochtag    { id: 'ek-…', rid, boxen, by, at } – „Chili kochen, 8 Boxen“
 *
 * Eine Mahlzeit hat mehrere Einträge, damit Tobi seine Box isst und Amy
 * etwas anderes. Boxen verteilen (boxenVerteilen) füllt die Tage nach dem
 * Kochtag mit Boxen dieses Rezepts – für beide zwei je Mahlzeit, sonst eine.
 * Was über drei Wochen her ist, fällt beim Bereinigen raus, ebenso, was
 * mehr als ein halbes Jahr voraus liegt.
 */

export const MAHLZEITEN = ['mittag', 'abend'];
export const MAHLZEIT_NAME = { mittag: 'Mittag', abend: 'Abend', kochen: 'Kochen' };
export const EINTRAG_ID = /^ep-[a-z0-9]{4,24}$/;
export const KOCH_ID = /^ek-[a-z0-9]{4,24}$/;
const SCHLUESSEL = /^[A-Za-z0-9_.~:@+-]{1,120}$/;
const PERSON = /^[\p{L}\p{N} ._-]{1,40}$/u;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_JE_MAHLZEIT = 6;
export const MAX_KOCHEN_JE_TAG = 3;
export const ZURUECK_TAGE = 21;
export const VORAUS_TAGE = 183;
export const MAX_BOXEN = 16;
const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const kurz = (v, max) => (typeof v === 'string' ? v.replace(/[\n\r\t]+/g, ' ').trim().slice(0, max) : '');
const jetzt = () => new Date().toISOString();

let zaehler = 0;
export const neueId = (art) => `${art}-${Date.now().toString(36)}${(zaehler++ % 1296).toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;

/* ------------------------------------------------------------ Tage */

const alsDatum = (tag) => { const [j, m, t] = tag.split('-').map(Number); return new Date(j, m - 1, t, 12); };
const alsTag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const heuteTag = (jetztD = new Date()) => alsTag(jetztD);
export function tagPlus(tag, n) { const d = alsDatum(tag); d.setDate(d.getDate() + n); return alsTag(d); }
/** 0 = Montag … 6 = Sonntag */
export const wochentag = (tag) => (alsDatum(tag).getDay() + 6) % 7;
export const montagVon = (tag) => tagPlus(tag, -wochentag(tag));
export const wocheVon = (montag) => Array.from({ length: 7 }, (_, i) => tagPlus(montag, i));
export const istWochenende = (tag) => wochentag(tag) >= 5;
export const tageZwischen = (a, b) => Math.round((alsDatum(b) - alsDatum(a)) / 864e5);
const KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const tagKurzName = (tag) => KURZ[wochentag(tag)];
export const tagName = (tag) => LANG[wochentag(tag)];
/** „10.11.“ */
export const tagDatum = (tag) => { const [, m, t] = tag.split('-').map(Number); return `${t}.${m}.`; };

/* -------------------------------------------------------- Bereinigen */

export function eintragBereinigen(e) {
  if (!istObj(e) || !EINTRAG_ID.test(String(e.id))) return null;
  const rid = SCHLUESSEL.test(String(e.rid || '')) ? e.rid : '';
  const t = kurz(e.text, 80);
  if (!rid && !t) return null;
  const wer = e.wer === 'beide' || PERSON.test(String(e.wer || '')) ? String(e.wer).trim() : 'beide';
  const box = KOCH_ID.test(String(e.box || '')) ? e.box : '';
  return { id: e.id, ...(rid ? { rid } : {}), ...(t ? { text: t } : {}), wer, ...(box ? { box } : {}), by: kurz(e.by, 40) || null, at: kurz(e.at, 40) };
}

export function kochBereinigen(k) {
  if (!istObj(k) || !KOCH_ID.test(String(k.id)) || !SCHLUESSEL.test(String(k.rid || ''))) return null;
  const boxen = Number.isInteger(k.boxen) && k.boxen >= 1 && k.boxen <= MAX_BOXEN ? k.boxen : 8;
  return { id: k.id, rid: k.rid, boxen, by: kurz(k.by, 40) || null, at: kurz(k.at, 40) };
}

function tagBereinigen(t) {
  if (!istObj(t)) return null;
  const out = {};
  for (const m of MAHLZEITEN) {
    const l = Array.isArray(t[m]) ? t[m].map(eintragBereinigen).filter(Boolean).slice(0, MAX_JE_MAHLZEIT) : [];
    if (l.length) out[m] = l;
  }
  const k = Array.isArray(t.kochen) ? t.kochen.map(kochBereinigen).filter(Boolean).slice(0, MAX_KOCHEN_JE_TAG) : [];
  if (k.length) out.kochen = k;
  return Object.keys(out).length ? out : null;
}

/** heute: zum Wegräumen alter Tage (Tests geben es vor). */
export function essensplanBereinigen(x, heute = heuteTag()) {
  const plan = { tage: {} };
  if (!istObj(x) || !istObj(x.tage)) return plan;
  const von = tagPlus(heute, -ZURUECK_TAGE);
  const bis = tagPlus(heute, VORAUS_TAGE);
  for (const [tag, t] of Object.entries(x.tage)) {
    if (!TAG.test(tag) || tag < von || tag > bis) continue;
    const b = tagBereinigen(t);
    if (b) plan.tage[tag] = b;
  }
  return plan;
}

/* ------------------------------------------------------------ Ändern */

/**
 * Einträge setzen (neu oder ersetzen, nach id) und wegnehmen – in einem:
 * setzen [{ tag, mahlzeit: 'mittag' | 'abend' | 'kochen', e }], weg [{ tag, mahlzeit, id }].
 */
export const opEssensplan = ({ setzen = [], weg = [] } = {}, by, at = jetzt()) => ({ typ: 'essensplan', setzen: JSON.parse(JSON.stringify(setzen)), weg: JSON.parse(JSON.stringify(weg)), by: by || null, at });

const fach = (m) => (m === 'kochen' || MAHLZEITEN.includes(m) ? m : '');

export function essensplanAnwenden(s, op) {
  if (!istObj(s.essensplan) || !istObj(s.essensplan.tage)) s.essensplan = { tage: {} };
  const tage = s.essensplan.tage;
  for (const w of Array.isArray(op.weg) ? op.weg : []) {
    const m = fach(w?.mahlzeit);
    if (!m || !TAG.test(String(w.tag)) || !Array.isArray(tage[w.tag]?.[m])) continue;
    tage[w.tag][m] = tage[w.tag][m].filter((e) => e.id !== w.id);
    if (!tage[w.tag][m].length) delete tage[w.tag][m];
    if (!Object.keys(tage[w.tag]).length) delete tage[w.tag];
  }
  for (const x of Array.isArray(op.setzen) ? op.setzen : []) {
    const m = fach(x?.mahlzeit);
    if (!m || !TAG.test(String(x.tag))) continue;
    const b = m === 'kochen' ? kochBereinigen({ ...x.e, by: op.by, at: op.at }) : eintragBereinigen({ ...x.e, by: op.by, at: op.at });
    if (!b) continue;
    const t = tage[x.tag] || {};
    const l = Array.isArray(t[m]) ? t[m] : [];
    const i = l.findIndex((e) => e.id === b.id);
    if (i >= 0) l[i] = b;
    else if (l.length < (m === 'kochen' ? MAX_KOCHEN_JE_TAG : MAX_JE_MAHLZEIT)) l.push(b);
    else continue;
    t[m] = l;
    tage[x.tag] = t;
  }
}

export function essensplanZusammen(s, x) {
  const neu = essensplanBereinigen(x);
  if (!Object.keys(neu.tage).length) return;
  if (!istObj(s.essensplan) || !istObj(s.essensplan.tage)) s.essensplan = { tage: {} };
  for (const [tag, t] of Object.entries(neu.tage)) {
    const da = s.essensplan.tage[tag] || {};
    for (const [m, l] of Object.entries(t)) {
      const liste = Array.isArray(da[m]) ? da[m] : [];
      for (const e of l) if (!liste.some((x) => x.id === e.id) && liste.length < (m === 'kochen' ? MAX_KOCHEN_JE_TAG : MAX_JE_MAHLZEIT)) liste.push(e);
      da[m] = liste;
    }
    s.essensplan.tage[tag] = da;
  }
}

/* ------------------------------------------------------------- Lesen */

/** Alle Kochtage: [{ tag, k }] nach Datum. */
export function kochtage(plan) {
  const out = [];
  for (const [tag, t] of Object.entries(plan?.tage || {})) for (const k of t.kochen || []) out.push({ tag, k });
  return out.sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Ein Kochtag nach id: { tag, k } oder null. */
export const kochtagVon = (plan, id) => kochtage(plan).find((x) => x.k.id === id) || null;

/** Wie viele Boxen eines Kochtags schon verplant sind (für beide zählen zwei). */
export function verplant(plan, kochId) {
  let n = 0;
  for (const t of Object.values(plan?.tage || {})) for (const m of MAHLZEITEN) for (const e of t[m] || []) if (e.box === kochId) n += e.wer === 'beide' ? 2 : 1;
  return n;
}

/** Hat diese Person (oder wer: 'beide' – irgendwer) in der Mahlzeit schon etwas? */
export function belegt(liste, wer) {
  return (liste || []).some((e) => wer === 'beide' || e.wer === 'beide' || e.wer === wer);
}

/**
 * Die Boxen eines Kochtags auf die Tage danach verteilen: für wer, zu einer
 * Mahlzeit, ab dem Tag danach (oder demselben, abHeute), nur Werktage oder
 * jeden Tag; was schon belegt ist, bleibt. → { setzen, mahlzeiten, rest }
 */
export function boxenVerteilen(plan, { tag, k, wer = 'beide', mahlzeit = 'mittag', werktage = false, abHeute = false }) {
  const pro = wer === 'beide' ? 2 : 1;
  let frei = k.boxen - verplant(plan, k.id);
  const setzen = [];
  let d = abHeute ? tag : tagPlus(tag, 1);
  for (let i = 0; i < 28 && frei >= pro; i++, d = tagPlus(d, 1)) {
    if (werktage && istWochenende(d)) continue;
    if (belegt(plan?.tage?.[d]?.[mahlzeit], wer)) continue;
    setzen.push({ tag: d, mahlzeit, e: { id: neueId('ep'), rid: k.rid, wer, box: k.id } });
    frei -= pro;
  }
  return { setzen, mahlzeiten: setzen.length, rest: frei };
}

/** Einträge einer Mahlzeit, die zu einem Kochtag gehören – zum Mitlöschen. */
export function boxenVon(plan, kochId) {
  const out = [];
  for (const [tag, t] of Object.entries(plan?.tage || {})) for (const m of MAHLZEITEN) for (const e of t[m] || []) if (e.box === kochId) out.push({ tag, mahlzeit: m, id: e.id });
  return out;
}

/**
 * Was für eine Woche einzukaufen ist: die Rezepte der Kochtage (mit Boxen)
 * und die, die frisch zu einer Mahlzeit gekocht werden (ein Rezept ohne Box).
 * → [{ rid, boxen?, tage: [...] }] je Rezept einmal.
 */
export function einkaufDerWoche(plan, montag) {
  const tage = new Set(wocheVon(montag));
  const je = new Map();
  for (const [tag, t] of Object.entries(plan?.tage || {})) {
    if (!tage.has(tag)) continue;
    for (const k of t.kochen || []) {
      const x = je.get(k.rid) || { rid: k.rid, boxen: 0, tage: [] };
      x.boxen += k.boxen;
      x.tage.push(tag);
      je.set(k.rid, x);
    }
    for (const m of MAHLZEITEN) {
      for (const e of t[m] || []) {
        if (!e.rid || e.box) continue;
        const x = je.get(e.rid) || { rid: e.rid, tage: [] };
        if (!x.tage.includes(tag)) x.tage.push(tag);
        je.set(e.rid, x);
      }
    }
  }
  return [...je.values()].sort((a, b) => a.tage[0].localeCompare(b.tage[0]));
}

/** Wie viel in einer Woche geplant ist (für die Zahl am Reiter): Mahlzeiten mit etwas drin. */
export function geplanteMahlzeiten(plan, tage) {
  let n = 0;
  for (const tag of tage) for (const m of MAHLZEITEN) if ((plan?.tage?.[tag]?.[m] || []).length) n++;
  return n;
}
