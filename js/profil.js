/*
 * Wessen Liste das ist und wie sie aussieht (liste.json unter profil, siehe
 * liste.js profilBereinigen):
 *
 *   Tobi und Amy   die gemeinsame Liste in Boxenstopp-Daten – der rosa Reiter
 *                  heißt „Amys Rezepte“, die App ist blau.
 *   eigene Liste   ein Gast (Marielle) mit eigenem Repo – der Reiter heißt
 *                  nach ihr, Push und To Do gibt es dort nicht (die laufen
 *                  über die Abläufe in Boxenstopp-Daten), die Farbe sucht sie
 *                  sich aus (lila).
 *
 * Die Farbe merkt sich das Gerät zusätzlich (FARBE), damit sie schon beim
 * nächsten Start vor dem ersten Bild stimmt (Kopf von index.html) – auch das
 * Symbol für den Home-Bildschirm und das Manifest wechseln mit.
 */
import { app, $, $$, schreibe, leisteFaerben } from './kern.js';
import { eigeneListe, einladungsLink, ladeKi } from './zugang.js';

const FARBE = 'boxenstopp.farbe.v1';
const SYMBOLE = {
  '': { svg: 'icon.svg', touch: 'icon-192.png', manifest: 'manifest.webmanifest' },
  lila: { svg: 'icon-lila.svg', touch: 'icon-lila-192.png', manifest: 'manifest-lila.webmanifest' },
};

/** Eine eigene Liste (Gast) statt der von Tobi und Amy? */
export const istEigen = () => eigeneListe(app.zugang);

/** Wessen eigene Rezepte der Reiter zeigt: bei Tobi und Amy Amy, sonst der Gast. */
export function person() {
  if (!istEigen()) return 'Amy';
  return app.stand.profil?.person || app.zugang?.name || 'Ich';
}

/** „Amys“, „Marielles“, aber „Klaus’“. */
export const wessen = (name) => (/[sßxz]$/i.test(name) ? `${name}’` : `${name}s`);

/** Wer kocht – für die KI: „Tobi und Amy“ oder „Marielle“. */
export const fuerWen = () => (istEigen() ? person() : 'Tobi und Amy');

/** Die Farbe der Liste ('' blau, 'lila'); bis die Liste da ist, was das Gerät sich gemerkt hat. */
export function farbe() {
  if (app.listeDa) return app.stand.profil?.farbe || '';
  return document.documentElement.dataset.farbe || '';
}

/** Farbe anwenden und für den nächsten Start merken – samt Symbol und Manifest. */
export function farbeSetzen(f) {
  const w = SYMBOLE[f] ? f : '';
  const html = document.documentElement;
  if (w) html.dataset.farbe = w; else delete html.dataset.farbe;
  schreibe(FARBE, w);
  const s = SYMBOLE[w];
  const setze = (sel, href) => { const el = $(sel); if (el && el.getAttribute('href') !== href) el.setAttribute('href', href); };
  setze('link[rel="icon"]', s.svg);
  setze('link[rel="apple-touch-icon"]', s.touch);
  setze('link[rel="manifest"]', s.manifest);
  leisteFaerben();
}

/**
 * Der Link fürs zweite Gerät derselben Liste (Einstellungen, iPad-Popup,
 * Willkommen): mit KI-Schlüssel und – bei einer eigenen Liste – Ort, Name
 * und Farbe, damit das zweite Gerät gleich richtig aussieht.
 */
export function linkFuerGeraet() {
  if (!app.zugang) return '';
  const eigen = istEigen();
  return einladungsLink(app.zugang.token, ladeKi(), eigen ? { daten: app.zugang.daten || '', fuer: app.zugang.name || '', farbe: farbe() || 'blau' } : {});
}

let zuletzt = '';
/**
 * Nach jedem neuen Stand (app.js beiAenderung): Namen am Reiter, Farbe,
 * was es in einer eigenen Liste nicht gibt. Zeichnet nur, wenn sich etwas
 * geändert hat.
 */
export function profilAnwenden() {
  const eigen = istEigen();
  const wer = person();
  const f = farbe();
  const schluessel = JSON.stringify([eigen, wer, f]);
  if (schluessel === zuletzt) return false;
  zuletzt = schluessel;
  const html = document.documentElement;
  if (eigen) html.dataset.liste = 'eigen'; else delete html.dataset.liste;
  const titel = `${wessen(wer)} Rezepte`;
  for (const el of $$('.tab-amy .tab-l, .abk-amy .abk-t')) el.textContent = titel;
  for (const el of $$('.tab-amy .tab-k')) el.textContent = wer;
  $('.tab-amy')?.setAttribute('aria-label', titel);
  $('#view-amy')?.setAttribute('aria-label', titel);
  $('.brand-tag')?.setAttribute('data-fuer', `für ${wer} ♡`);
  const intro = $('#r-intro');
  if (intro) intro.textContent = `Jedes Rezept ist auf 8 gleiche Boxen gerechnet, mit Packungsgrößen aus dem Supermarkt. Rezept öffnen, Zutaten auf ${eigen ? 'deine' : 'die gemeinsame'} Liste setzen, einkaufen, kochen.`;
  if (app.listeDa) farbeSetzen(f);
  return true;
}
