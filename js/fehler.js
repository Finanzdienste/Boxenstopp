/*
 * Fehler merken – nur auf diesem Gerät. Was beim Start oder später
 * schiefgeht, landet mit Zeit und Stelle im Code in boxenstopp.fehler.v1
 * (die letzten fünf; derselbe Fehler gleich danach zählt nur mit) und steht
 * unter Einstellungen → Über die App, zum Kopieren und Weiterschicken. So
 * lässt sich auf iPhone und iPad sehen, was hakt – dort gibt es keine
 * Konsole. Schlüssel (GitHub, KI) werden vorher unkenntlich gemacht; nichts
 * davon verlässt das Gerät von selbst.
 */
import { lese, schreibe } from './kern.js';

export const FEHLER = 'boxenstopp.fehler.v1';
const MAX = 5;
const SCHLUESSEL = /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|AIza[0-9A-Za-z_-]{16,}|sk-ant-[A-Za-z0-9_-]{8,}/g;
const sauber = (s, n = 240) => String(s ?? '').replace(SCHLUESSEL, '…').replace(/\s+/g, ' ').trim().slice(0, n);

/** Die gemerkten Fehler, der neueste zuerst: { at, wo, text, stelle, mal? } */
export function letzteFehler() {
  const l = lese(FEHLER, []);
  return Array.isArray(l) ? l.filter((f) => f && typeof f.text === 'string' && typeof f.at === 'string') : [];
}

/** wo: welcher Teil (beim Start der Name des Schritts), e: der Fehler oder ein Text. */
export function fehlerMerken(wo, e) {
  try {
    const text = sauber(e?.message ?? e);
    if (!text) return;
    // Die Stelle: die erste unserer Dateien im Stack (Safari „fn@…/js/x.js:12:3“, Chrome „at fn (…/js/x.js:12:3)“)
    const stelle = sauber((String(e?.stack || '').match(/js\/[\w-]+\.js:\d+(?::\d+)?/) || [''])[0], 80);
    const liste = letzteFehler();
    const jetzt = new Date().toISOString();
    const erster = liste[0];
    if (erster && erster.text === text && erster.stelle === stelle && erster.wo === sauber(wo, 40)) liste[0] = { ...erster, at: jetzt, mal: (erster.mal || 1) + 1 };
    else liste.unshift({ at: jetzt, wo: sauber(wo, 40), text, stelle });
    schreibe(FEHLER, liste.slice(0, MAX));
  } catch { /* Beim Merken selbst ein Fehler: dann eben nicht */ }
}

export const fehlerVergessen = () => schreibe(FEHLER, []);

// Alles Unerwartete mitschreiben – auch was beim Laden der anderen Teile
// schiefgeht: app.js holt dieses Modul als erstes.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('error', (ev) => { if (ev.error || ev.message) fehlerMerken('', ev.error || ev.message); });
  window.addEventListener('unhandledrejection', (ev) => fehlerMerken('', ev.reason));
}

/** Ein Schritt, der nicht alles andere mitreißen darf: Fehler merken, weitermachen. */
export function sicher(wo, fn, sonst) {
  try { return fn(); } catch (e) { fehlerMerken(wo, e); return sonst; }
}
