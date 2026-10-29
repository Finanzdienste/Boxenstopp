/*
 * Tempo: Wie lange braucht ihr wirklich? Beim Kochen hakt man die Schritte
 * ab – die Zeit zwischen zwei Haken ist, was der Schritt gedauert hat.
 * Daraus lernt das Handy drei Dinge:
 *
 *   pro Schritt    wie lange genau dieser Schritt in diesem Rezept gedauert
 *                  hat; die ersten Male vorsichtig mit der Standardzeit
 *                  gemischt, damit ein Ausreißer nicht gleich alles kippt
 *   pro Abschnitt  ein Faktor fürs Vorbereiten, Kochen, Portionieren (der
 *                  gewichtete Median über alle sauber gemessenen Schritte) –
 *                  er gilt für alle Schritte, die noch nie gemessen wurden
 *   pro Rezept     die ganze Zeit vom ersten bis zum letzten Haken; war man
 *                  einmal ganz durch, gilt für das Rezept diese Zeit (bei
 *                  mehreren Malen der Median der letzten drei)
 *
 * Feste Garzeiten („15 Min. köcheln“) und Wartezeiten bleiben, wie sie sind
 * (zeiten.js hatGarzeit) – die Sauce köchelt bei jedem gleich lang. Gemessen
 * und umgerechnet wird, wo man selbst schneidet, abwiegt und rührt.
 *
 * Sauber gemessen heißt: Der Haken davor gehört zu einem Schritt ohne
 * Garzeit im selben Abschnitt, keiner der beiden läuft „währenddessen“, und
 * die Zeit ist plausibel (ein Drittel bis das Vierfache der Standardzeit,
 * höchstens 45 Minuten). Was innerhalb von 20 Sekunden abgehakt wird, hat
 * man zusammen gemacht – solche Bündel zählen nur für den Faktor.
 *
 * Jeder kocht in seinem Tempo: Die Arbeitskopie liegt im localStorage, mit
 * der gemeinsamen Liste geht sie je Person auf ihre anderen Geräte
 * (kochstand.js – tempoRoh, tempoUebernehmen, tempoBeobachten). Ohne DOM,
 * damit die Tests es direkt prüfen; die Uhr kommt als Zahl herein.
 */
import { lese, schreibe } from './kern.js';
import { phasenMinuten, runden5, zeitVon, hatGarzeit } from './zeiten.js';

const SPEICHER = 'boxenstopp.tempo.v1';
const BUENDEL_S = 20;
const MAX_PROBEN = 300;
const MAX_LAEUFE = 5;
const ALT_MS = 8 * 3600 * 1000;
const FEST = 1;
const NEBEN = 2;
const RUHE = 4;

let daten = null;
let gelernt = null;
let beobachter = () => {};

/* -------------------------------------------------------------- Speicher */

function laden() {
  if (daten) return daten;
  const roh = lese(SPEICHER, null);
  daten = {
    offen: roh && typeof roh.offen === 'object' && !Array.isArray(roh.offen) ? roh.offen : {},
    proben: Array.isArray(roh?.proben) ? roh.proben.filter((p) => Array.isArray(p) && p.length >= 4) : [],
    gesamt: roh && typeof roh.gesamt === 'object' && !Array.isArray(roh.gesamt) ? roh.gesamt : {},
  };
  return daten;
}
function merken() {
  gelernt = null;
  schreibe(SPEICHER, daten);
  beobachter();
}

/** Für kochstand.js: wer von jeder Änderung hören will, … */
export const tempoBeobachten = (fn) => { beobachter = typeof fn === 'function' ? fn : () => {}; };
/** … der ganze Stand als Kopie … */
export const tempoRoh = () => JSON.parse(JSON.stringify(laden()));
/** … und ein Stand von einem anderen Gerät, ohne dass es als eigene Änderung zählt. */
export function tempoUebernehmen(roh) {
  schreibe(SPEICHER, roh && typeof roh === 'object' ? roh : { offen: {}, proben: [], gesamt: {} });
  daten = null;
  gelernt = null;
}

/* ----------------------------------------------------------------- Hilfe */

/** Kurzer Fingerabdruck eines Schritts: So findet das Handy ihn wieder, auch wenn sich die Nummer verschiebt. */
export function schrittHash(s) {
  let h = 5381;
  const t = String(s?.d || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
/** Vorbereiten, Kochen, Portionieren – bei eigenen Rezepten auch andere Namen. */
export function gruppe(name) {
  const n = String(name || '').toLowerCase();
  if (/vorbereit|schnippel|mise/.test(n)) return 'vor';
  if (/portion|abfüll|boxen/.test(n)) return 'port';
  if (/koch|back|brat|zubereit|garen|ofen/.test(n)) return 'koch';
  return 'sonst';
}
export const GRUPPEN_TEXT = { vor: 'Vorbereiten', koch: 'Kochen', port: 'Portionieren', sonst: 'Sonstiges' };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Median mit Gewichten: [[wert, gewicht], …] */
function gewichteterMedian(paare) {
  const s = [...paare].sort((a, b) => a[0] - b[0]);
  const summe = s.reduce((n, p) => n + p[1], 0);
  let laufend = 0;
  for (const [w, g] of s) { laufend += g; if (laufend >= summe / 2) return w; }
  return s.length ? s[s.length - 1][0] : 1;
}

const alleSchritte = (r) => (r?.ablauf || []).flatMap((p, pi) => p.schritte.map((s) => ({ s, pi, grp: gruppe(p.t) })));

/* -------------------------------------------------------------- Abhaken */

/**
 * Ein Schritt wurde abgehakt (an) oder wieder geöffnet. Beim ersten Haken
 * beginnt ein Lauf; sind alle Schritte abgehakt, ist er zu und wird gelernt.
 */
export function tempoHaken(r, i, an, jetzt = Date.now()) {
  const d = laden();
  const liste = alleSchritte(r);
  const x = liste[i];
  if (!r?.id || !x) return;
  let lauf = d.offen[r.id];
  if (lauf && jetzt - (lauf.start + 1000 * Math.max(0, ...lauf.h.map((h) => h[1]))) > ALT_MS) { schliessen(r.id); lauf = null; }
  if (!an) {
    if (lauf) { lauf.h = lauf.h.filter((h) => h[0] !== i); merken(); }
    return;
  }
  if (!lauf) {
    lauf = { start: jetzt, n: liste.length, std: zeitVon(r).gesamt, h: [] };
    d.offen[r.id] = lauf;
  }
  const flags = (hatGarzeit(x.s) ? FEST : 0) | (x.s.neben ? NEBEN : 0) | (Number(x.s.ruhe) ? RUHE : 0);
  lauf.h = lauf.h.filter((h) => h[0] !== i);
  lauf.h.push([i, Math.round((jetzt - lauf.start) / 1000), Number(x.s.min) || 1, flags, x.pi, schrittHash(x.s), x.grp]);
  if (new Set(lauf.h.map((h) => h[0])).size >= lauf.n) schliessen(r.id);
  else merken();
}

/** „Haken zurücksetzen“: Der Lauf ist vorbei, was bis dahin gemessen ist, zählt. */
export function tempoZurueck(rid) {
  if (laden().offen[rid]) schliessen(rid);
}

function schliessen(rid) {
  const d = laden();
  const lauf = d.offen[rid];
  delete d.offen[rid];
  if (lauf) {
    d.proben.push(...probenAus(lauf, rid));
    d.proben = d.proben.slice(-MAX_PROBEN);
    const g = gesamtAus(lauf);
    if (g) d.gesamt[rid] = [...(d.gesamt[rid] || []), [g, new Date(lauf.start).toISOString().slice(0, 10)]].slice(-MAX_LAEUFE);
  }
  merken();
}

/* --------------------------------------------------------------- Lernen */

/** Die sauberen Messungen eines Laufs: [schlüssel, gruppe, soll, ist] – schlüssel leer bei Bündeln. */
export function probenAus(lauf, rid) {
  const h = [...(lauf?.h || [])].sort((a, b) => a[1] - b[1]);
  const buendel = [];
  for (const x of h) {
    const b = buendel[buendel.length - 1];
    if (b && x[1] - b.bis < BUENDEL_S) { b.haken.push(x); b.bis = x[1]; } else buendel.push({ von: x[1], bis: x[1], haken: [x] });
  }
  const proben = [];
  for (let k = 1; k < buendel.length; k++) {
    const vorher = buendel[k - 1];
    const ref = vorher.haken[vorher.haken.length - 1];
    const b = buendel[k];
    if (ref[3] & (FEST | NEBEN) || (ref[3] & RUHE && ref[4] !== 0)) continue;
    if (b.haken.some((x) => x[3] & (FEST | NEBEN) || x[4] !== ref[4])) continue;
    const soll = b.haken.reduce((n, x) => n + x[2], 0);
    const ist = (b.bis - vorher.bis) / 60;
    if (ist > 45 || ist < soll / 3 || ist > soll * 4) continue;
    proben.push([b.haken.length === 1 ? `${rid}:${b.haken[0][5]}` : '', b.haken[0][6] || 'sonst', soll, Math.round(ist * 10) / 10]);
  }
  return proben;
}

/**
 * Ganze Zeit eines Laufs in Minuten – nur, wenn man (fast) ganz durch war
 * und ohne lange Pause. Der erste Schritt hat keinen Haken davor; für ihn
 * zählt seine Standardzeit im Tempo dieses Abends.
 */
export function gesamtAus(lauf) {
  const h = [...(lauf?.h || [])].sort((a, b) => a[1] - b[1]);
  if (!h.length || new Set(h.map((x) => x[0])).size < 0.8 * lauf.n) return null;
  for (let k = 1; k < h.length; k++) if (h[k][1] - h[k - 1][1] > 90 * 60) return null;
  const quoten = probenAus(lauf, '').map((p) => p[3] / p[2]);
  const f = quoten.length >= 2 ? Math.min(2.5, Math.max(0.5, median(quoten))) : 1;
  const min = (h[h.length - 1][1] - h[0][1]) / 60 + h[0][2] * f;
  if (lauf.std && (min < lauf.std * 0.4 || min > lauf.std * 3)) return null;
  return Math.round(min);
}

/** Was das Handy gelernt hat: { faktor: { vor, koch, port, alle }, schritt: Map, gesamt: { rid: [[min, tag]] }, proben } */
export function tempoGelernt() {
  if (gelernt) return gelernt;
  const d = laden();
  const proben = [...d.proben];
  for (const [rid, lauf] of Object.entries(d.offen)) proben.push(...probenAus(lauf, rid));
  const faktor = {};
  const je = {};
  for (const [, grp, soll, ist] of proben) (je[grp] = je[grp] || []).push([ist / soll, soll]);
  const fuer = (paare, minSoll, minN) => {
    if (paare.length < minN || paare.reduce((n, p) => n + p[1], 0) < minSoll) return null;
    return Math.round(Math.min(2.5, Math.max(0.5, gewichteterMedian(paare))) * 20) / 20;
  };
  for (const [grp, paare] of Object.entries(je)) { const f = fuer(paare, 20, 4); if (f) faktor[grp] = f; }
  const alle = fuer(Object.values(je).flat(), 15, 3);
  if (alle) faktor.alle = alle;
  const schritt = new Map();
  for (const [k, , , ist] of proben) if (k) schritt.set(k, [...(schritt.get(k) || []), ist].slice(-5));
  gelernt = { faktor, schritt, gesamt: d.gesamt, proben: proben.length };
  return gelernt;
}

/**
 * Die Zeiten eines Rezepts in eurem Tempo:
 * { phasen, gesamt, standard, quelle: 'standard' | 'tempo' | 'gemessen', letztes, schritte: [{ min, art }] }
 * art je Schritt: '' (Standard oder feste Garzeit), 'tempo' (Faktor), 'gemessen'.
 */
export function tempoZeit(r, g = tempoGelernt()) {
  const standard = (r.zeit && Array.isArray(r.zeit.phasen) ? r.zeit : zeitVon(r));
  const schritte = [];
  let anders = false;
  let i = 0;
  let phasen = (r.ablauf || []).map((p) => {
    const f = g.faktor[gruppe(p.t)] ?? g.faktor.alle ?? 1;
    const neu = p.schritte.map((s) => {
      const idx = i++;
      const std = Number(s.min) || 0;
      if (hatGarzeit(s)) { schritte[idx] = { min: std, art: '' }; return s; }
      const gemessen = g.schritt.get(`${r.id}:${schrittHash(s)}`);
      let min = std * f;
      let art = f !== 1 ? 'tempo' : '';
      if (gemessen?.length) { min = (median(gemessen) * gemessen.length + std * f) / (gemessen.length + 1); art = 'gemessen'; }
      min = Math.max(1, Math.round(min));
      if (min === std && art === 'tempo') art = '';
      if (min !== std) anders = true;
      schritte[idx] = { min, art };
      return { ...s, min };
    });
    return runden5(phasenMinuten(neu));
  });
  let gesamt = phasen.reduce((a, b) => a + b, 0);
  let quelle = anders ? 'tempo' : 'standard';
  const laeufe = g.gesamt[r.id];
  const letztes = laeufe?.length ? { min: laeufe[laeufe.length - 1][0], tag: laeufe[laeufe.length - 1][1], n: laeufe.length } : null;
  if (letztes && phasen.length) {
    const ziel = runden5(median(laeufe.slice(-3).map((x) => x[0])));
    const faktor = ziel / gesamt;
    phasen = phasen.map((p) => runden5(p * faktor));
    const rest = ziel - phasen.reduce((a, b) => a + b, 0);
    const groesste = phasen.indexOf(Math.max(...phasen));
    phasen[groesste] = Math.max(5, phasen[groesste] + rest);
    gesamt = phasen.reduce((a, b) => a + b, 0);
    quelle = 'gemessen';
  }
  return { phasen, gesamt, standard: standard.gesamt, quelle, letztes, schritte };
}

/** Für die Anzeige im Rezept: wie viel gemessen ist und was daraus folgt. */
export function tempoInfo(g = tempoGelernt()) {
  return { proben: g.proben, faktor: { ...g.faktor }, rezepte: Object.keys(g.gesamt).length };
}

/** Alles vergessen – gibt den alten Stand zurück, damit „Rückgängig“ geht. */
export function tempoLoeschen() {
  const alt = JSON.parse(JSON.stringify(laden()));
  daten = { offen: {}, proben: [], gesamt: {} };
  merken();
  return alt;
}
export function tempoWiederherstellen(alt) {
  if (!alt || typeof alt !== 'object') return;
  daten = { offen: alt.offen || {}, proben: alt.proben || [], gesamt: alt.gesamt || {} };
  merken();
}
