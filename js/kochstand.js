/*
 * Der Kochstand einer Person, über ihre Geräte hinweg: welche Schritte sie
 * abgehakt hat (feste Rezepte und Amys), was das Handy über ihr Tempo gelernt
 * hat (tempo.js) und welche Timer laufen (timer.js). So fängt Amy auf dem
 * iPad an und kocht am iPhone weiter – der Timer läuft dort mit.
 *
 * Auf jedem Gerät liegt eine Arbeitskopie im localStorage, wie bisher. In
 * liste.json steht unter `kochen.<name>` die neueste Fassung (opKochen): Wer
 * zuletzt etwas geändert hat, gewinnt. Ist sie neuer als die eigene, übernimmt
 * das Gerät sie (kochstandAbgleichen); eigene Änderungen gehen gebündelt
 * hinterher (kochstandGeaendert). Beim allerersten Abgleich eines Geräts, das
 * schon etwas gelernt hat, wird zusammengelegt statt überschrieben.
 *
 * Getrennt nach Person (Name aus dem Einrichten, klein geschrieben): Tobi und
 * Amy kochen jeder in seinem Tempo. Ohne gemeinsame Liste bleibt alles auf
 * dem Gerät.
 */
import { app, lese, schreibe } from './kern.js';
import { tempoRoh, tempoUebernehmen, tempoBeobachten } from './tempo.js';
import { timerRoh, timerUebernehmen, timerBeobachten } from './timer.js';
import { opKochen } from './liste.js';

const SCHRITTE = 'boxenstopp.schritte.v2'; // { <rezept-id>: [0, 2, 3] } – feste Rezepte und Amys
const ALT_AMY = 'boxenstopp.amy.schritte.v1';
const STAND = 'boxenstopp.kochstand.v1'; // { at, wer } – welche Fassung dieses Gerät zuletzt hatte
const BUENDELN_MS = 1500;

/** Alle abgehakten Schritte dieses Geräts – dasselbe Objekt für alle Ansichten. */
export const schritte = (() => {
  const s = lese(SCHRITTE, {}) || {};
  // Einmal: Amys Haken lagen früher getrennt
  const amy = lese(ALT_AMY, null);
  if (amy && typeof amy === 'object') {
    for (const [rid, xs] of Object.entries(amy)) if (!s[rid]) s[rid] = xs;
    schreibe(SCHRITTE, s);
    try { localStorage.removeItem(ALT_AMY); } catch { /* egal */ }
  }
  return s;
})();

let uebernimmt = false;
let geplant = null;

const wer = () => String(app.name?.() || '').trim().toLowerCase().slice(0, 40);
const kopie = (x) => JSON.parse(JSON.stringify(x));
const hatEtwas = () => Object.values(schritte).some((xs) => xs?.length) || (tempoRoh().proben || []).length > 0 || Object.keys(tempoRoh().gesamt || {}).length > 0 || timerRoh().length > 0;

/** Die Haken eines Rezepts als Menge. */
export const schritteVon = (rid) => new Set(schritte[rid] || []);

/** Haken eines Rezepts setzen (Menge oder Liste) – gemerkt und für die anderen Geräte vorgemerkt. */
export function schritteSetzen(rid, menge) {
  const xs = [...menge].filter((i) => Number.isInteger(i));
  if (xs.length) schritte[rid] = xs; else delete schritte[rid];
  schreibe(SCHRITTE, schritte);
  kochstandGeaendert();
}

/** Etwas hat sich auf diesem Gerät geändert: bald (gebündelt) in die gemeinsame Liste. */
export function kochstandGeaendert() {
  if (uebernimmt || !app.zugang || !wer()) return;
  clearTimeout(geplant);
  geplant = setTimeout(senden, BUENDELN_MS);
}

/** Gleich senden, was noch aussteht – etwa wenn die App in den Hintergrund geht. */
export function kochstandJetzt() {
  if (!geplant) return;
  clearTimeout(geplant);
  senden();
}

function senden() {
  geplant = null;
  if (!app.zugang || !wer() || !app.aendern) return;
  const at = new Date().toISOString();
  schreibe(STAND, { at, wer: wer() });
  app.aendern(opKochen(wer(), { schritte: kopie(schritte), tempo: tempoRoh(), timer: timerRoh() }, at));
}

/** Beim ersten Abgleich: was beide Geräte gelernt haben, zusammen. */
function tempoZusammen(a = {}, b = {}) {
  const gesehen = new Set();
  const proben = [...(a.proben || []), ...(b.proben || [])].filter((p) => { const k = JSON.stringify(p); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  const gesamt = { ...(a.gesamt || {}) };
  for (const [rid, l] of Object.entries(b.gesamt || {})) {
    const alle = [...(gesamt[rid] || []), ...l];
    gesamt[rid] = alle.filter((x, i) => alle.findIndex((y) => JSON.stringify(y) === JSON.stringify(x)) === i).slice(-5);
  }
  return { offen: { ...(a.offen || {}), ...(b.offen || {}) }, proben: proben.slice(-300), gesamt };
}

/**
 * Nach jeder Änderung an der Liste (app.js beiAenderung): Liegt in
 * liste.json eine neuere Fassung dieser Person, übernimmt das Gerät sie.
 * Gibt true zurück, wenn sich hier etwas geändert hat.
 */
export function kochstandAbgleichen(stand) {
  if (!app.zugang || !wer()) return false;
  const fern = stand?.kochen?.[wer()];
  const lokal = lese(STAND, null);
  const meins = lokal?.wer === wer() ? lokal : null;
  if (!fern) {
    // Noch nichts in der gemeinsamen Liste: was dieses Gerät schon weiß, kommt hin
    if (!meins?.at && hatEtwas() && !geplant) kochstandGeaendert();
    return false;
  }
  if (meins?.at && String(fern.at) <= String(meins.at)) return false;
  const erstesMal = !meins?.at && hatEtwas();
  uebernimmt = true;
  try {
    const neu = erstesMal ? { ...kopie(schritte), ...(fern.schritte || {}) } : (fern.schritte || {});
    for (const k of Object.keys(schritte)) delete schritte[k];
    Object.assign(schritte, kopie(neu));
    schreibe(SCHRITTE, schritte);
    tempoUebernehmen(erstesMal ? tempoZusammen(tempoRoh(), fern.tempo) : fern.tempo);
    const timer = erstesMal ? [...timerRoh(), ...(fern.timer || []).filter((t) => !timerRoh().some((x) => x.id === t.id))] : (fern.timer || []);
    timerUebernehmen(timer);
    schreibe(STAND, { at: fern.at, wer: wer() });
  } finally {
    uebernimmt = false;
  }
  if (erstesMal) kochstandGeaendert();
  return true;
}

/** Einmal beim Start: Tempo und Timer melden ihre Änderungen hierher. */
export function kochstandStart() {
  tempoBeobachten(kochstandGeaendert);
  timerBeobachten(kochstandGeaendert);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kochstandJetzt(); });
  window.addEventListener('pagehide', kochstandJetzt);
}
