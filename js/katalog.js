/*
 * Der gemeinsame Katalog: Rezepte, die sich jemand gewünscht hat – ein Wort
 * („Kürbissuppe“) oder ein ganzer Text. Die KI schreibt sie (ansicht-ki.js,
 * modus 'wunsch'), und sie gehören allen, die die App nutzen: Tobi und Amy,
 * Marielle, weiteren Gästen. Zu den 50 festen Rezepten kommen sie dazu.
 *
 * Gespeichert wird im KI-Format (ki-rezept.js) mit den Mengen, wie die KI sie
 * vorgeschlagen hat, für 8 Boxen. Jede Liste rechnet beim Anzeigen auf ihr
 * eigenes Ziel pro Box (aufZielRechnen, wie bei der Resteverwertung) und ihre
 * Boxen (boxen.js) – so bekommt jeder die Nährwerte, die er will.
 *
 *   katalog.json im Daten-Repo jeder Liste:
 *   { v: 1, rezepte: { 'kat-…': { k, wunsch, by, at, ziel } },
 *           weg: { 'kat-…': { at, kurz } } }
 *
 * Zwischen den Listen gleicht das Handy ab, das die Gäste eingeladen hat
 * (ansicht-katalog.js) – nur dort liegen ihre Schlüssel. katalogMischen führt
 * beliebig viele Stände zusammen: Was neuer ist, gilt; was jemand
 * herausgenommen hat, bleibt mit Datum unter weg, damit es beim nächsten
 * Abgleich nicht aus einer anderen Liste zurückkommt.
 *
 * Ohne DOM, damit tests/test-katalog.mjs alles direkt in Node prüft.
 */
import { kiBereinigen, mengenAnpassen, alsRezept } from './ki-rezept.js';
import { zielBereinigen, STANDARD, MAKROS } from './zielrechner.js';
import { aufBoxen } from './boxen.js';

export const KATALOG_DATEI = 'katalog.json';
export const KAT_ID = /^kat-[a-z0-9]{4,20}$/;
/** So viele Rezepte hat der Katalog höchstens – darüber wird katalog.json zu groß fürs Handy. */
export const MAX_KATALOG = 100;
/** Wie viele Boxen ein Katalogrezept hat, bevor eine Liste es auf ihre rechnet. */
export const KATALOG_BOXEN = 8;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const txt = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const klon = (x) => JSON.parse(JSON.stringify(x));

export const leererKatalog = () => ({ v: 1, rezepte: {}, weg: {} });

/** Ein Eintrag unter weg – früher nur das Datum, jetzt mit dem Kurznamen (für die Liste, wenn das Rezept fehlt). */
function wegBereinigen(w) {
  if (typeof w === 'string') return ISO.test(w) ? { at: w, kurz: '' } : null;
  if (!w || typeof w !== 'object' || !ISO.test(String(w.at || ''))) return null;
  return { at: w.at, kurz: txt(w.kurz, 30) };
}

/**
 * Aus beliebigem JSON ein gültiger Katalog: kaputte oder verbotene Rezepte
 * (Fisch, Schwein – kiBereinigen) fallen weg, Herausgenommenes auch, höchstens
 * MAX_KATALOG (die neuesten). Schlüssel sortiert, damit gleiche Kataloge
 * gleich aussehen (gleicherKatalog).
 */
export function katalogBereinigen(roh) {
  const aus = leererKatalog();
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return aus;
  const weg = {};
  for (const [id, w] of Object.entries(roh.weg && typeof roh.weg === 'object' ? roh.weg : {})) {
    const x = KAT_ID.test(id) ? wegBereinigen(w) : null;
    if (x) weg[id] = x;
  }
  const rezepte = [];
  for (const [id, e] of Object.entries(roh.rezepte && typeof roh.rezepte === 'object' ? roh.rezepte : {})) {
    if (!KAT_ID.test(id) || !e || typeof e !== 'object' || !ISO.test(String(e.at || ''))) continue;
    if (weg[id] && weg[id].at >= e.at) continue;
    const { r } = kiBereinigen({ ...e.k, portionen: e.k?.portionen || KATALOG_BOXEN });
    if (!r) continue;
    rezepte.push([id, { k: r, wunsch: txt(e.wunsch, 500), by: txt(e.by, 40), at: e.at, ziel: zielBereinigen(e.ziel) || { ...STANDARD } }]);
  }
  rezepte.sort((a, b) => b[1].at.localeCompare(a[1].at));
  for (const [id, e] of rezepte.slice(0, MAX_KATALOG).sort((a, b) => a[0].localeCompare(b[0]))) aus.rezepte[id] = e;
  for (const id of Object.keys(weg).sort()) aus.weg[id] = weg[id];
  return aus;
}

/** Mehrere Stände zusammen: je Rezept der neueste, Herausgenommenes bleibt draußen. */
export function katalogMischen(...staende) {
  const roh = { v: 1, rezepte: {}, weg: {} };
  for (const s of staende) {
    const k = katalogBereinigen(s);
    for (const [id, w] of Object.entries(k.weg)) if (!roh.weg[id] || roh.weg[id].at < w.at) roh.weg[id] = w;
    for (const [id, e] of Object.entries(k.rezepte)) if (!roh.rezepte[id] || roh.rezepte[id].at < e.at) roh.rezepte[id] = e;
  }
  return katalogBereinigen(roh);
}

export const gleicherKatalog = (a, b) => JSON.stringify(katalogBereinigen(a)) === JSON.stringify(katalogBereinigen(b));

/** Eine neue id: kat- und Zeit und Zufall. */
export const katalogId = (jetzt = Date.now()) => `kat-${jetzt.toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Einen Eintrag dazu (oder ersetzen: ersetzt = die id des alten, der dafür herausgeht). */
export function katalogDazu(stand, id, { k, wunsch = '', by = '', ziel = STANDARD, at = new Date().toISOString(), ersetzt = '' }) {
  const neu = klon(katalogBereinigen(stand));
  neu.rezepte[id] = { k, wunsch, by, at, ziel };
  if (ersetzt && ersetzt !== id) {
    neu.weg[ersetzt] = { at, kurz: neu.rezepte[ersetzt]?.k?.kurz || '' };
    delete neu.rezepte[ersetzt];
  }
  return katalogBereinigen(neu);
}

/** Einen Eintrag herausnehmen – er bleibt mit Datum unter weg. */
export function katalogRaus(stand, id, { at = new Date().toISOString() } = {}) {
  const neu = klon(katalogBereinigen(stand));
  neu.weg[id] = { at, kurz: neu.rezepte[id]?.k?.kurz || neu.weg[id]?.kurz || '' };
  delete neu.rezepte[id];
  return katalogBereinigen(neu);
}

/** Was in b dazugekommen ist, verglichen mit a: { neu: [Namen], raus: [Namen] } – für die Commit-Nachricht. */
export function katalogUnterschied(a, b) {
  const x = katalogBereinigen(a);
  const y = katalogBereinigen(b);
  return {
    neu: Object.keys(y.rezepte).filter((id) => !x.rezepte[id] || x.rezepte[id].at !== y.rezepte[id].at).map((id) => y.rezepte[id].k.kurz),
    raus: Object.keys(x.rezepte).filter((id) => !y.rezepte[id]).map((id) => x.rezepte[id].k.kurz),
  };
}

/**
 * Das KI-Rezept auf ein Ziel: die Mengen mit anpassbar zwischen min und max
 * (mengenAnpassen). Ein ganz anderes Ziel als das, für das die KI geschrieben
 * hat, braucht mehr Spielraum – der wächst mit, wie bei den festen Rezepten
 * (zielrechner.js mengenFuerZiel).
 */
export function aufZielRechnen(k, ziel, basis = STANDARD) {
  const kk = klon(k);
  const b = zielBereinigen(basis) || STANDARD;
  const faktor = MAKROS.map((m) => ziel[m] / b[m]);
  const hoch = Math.max(1, ...faktor);
  const tief = Math.max(0.25, Math.min(1, ...faktor));
  for (const z of kk.zutaten) if (z.anpassbar) { z.max *= hoch; z.min *= tief; }
  return mengenAnpassen(kk, ziel);
}

/**
 * Ein Eintrag als Rezept der App, für eine Liste: auf ihr Ziel, dann auf ihre
 * Boxen. r.katalog sagt, woher es kommt (wer es sich gewünscht hat, wann, was).
 */
export function katalogRezept(id, e, { ziel = STANDARD, boxen = KATALOG_BOXEN, katalog = {}, einheiten = {} } = {}) {
  const k = aufZielRechnen(e.k, ziel, e.ziel);
  const r = alsRezept(k, { id, katalog, einheiten, von: { by: e.by || null, at: e.at, gespeichert: true, modus: 'wunsch' } });
  r.protein = e.k.protein || 'Neu';
  r.katalog = { wunsch: e.wunsch, by: e.by, at: e.at };
  return aufBoxen(r, boxen, { katalog });
}

/** Alle Einträge als Rezepte der App – die neuesten zuerst. Eins, das sich nicht rechnen lässt, fehlt eben. */
export function katalogRezepte(stand, opt = {}) {
  const k = katalogBereinigen(stand);
  return Object.entries(k.rezepte)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([id, e]) => { try { return katalogRezept(id, e, opt); } catch { return null; } })
    .filter(Boolean);
}

/** Kurznamen der herausgenommenen Rezepte – damit eine Liste, auf der eins noch steht, es benennen kann. */
export const katalogNamen = (stand) => Object.fromEntries(Object.entries(katalogBereinigen(stand).weg).filter(([, w]) => w.kurz).map(([id, w]) => [id, w.kurz]));
