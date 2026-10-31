/*
 * Was alle Teile der App teilen: der Zustand, die Meldung unten, die beiden
 * Reiter und das, was sich das Handy über die Ansicht merkt.
 */
import { leer } from './liste.js';

export const app = {
  rezepte: [],
  /** Rezepte aus der Resteverwertung (behaltene und der aktuelle Vorschlag), siehe ansicht-ki.js. */
  kiRezepte: [],
  nachId: Object.create(null),
  /** Einheit je Katalog-Schlüssel, wie die festen Rezepte sie benutzen (g, Stk, Dose …). */
  einheiten: {},
  /** Werte pro 100 g je Katalog-Schlüssel (daten/rezepte.json), fürs Anpassen. */
  naehrwerte: {},
  preise: {},
  preiseStand: '',
  katalog: {},
  extras: {},
  ziel: { kcal: 443, p: 33, kh: 39, f: 15.4 },
  stand: leer(),
  listeDa: false,
  speicher: null,
  zugang: null,
  status: { zustand: 'lokal', offen: 0, zuletzt: null },
  name() { return this.zugang?.name || ''; },
  aendern(op) { if (this.speicher) this.speicher.aendern(op); },
  // Werden in app.js bzw. ansicht-ki.js gesetzt.
  verbinden: async () => 'netz',
  trennen: () => {},
  zeichnen: () => {},
  /** HTML der KI-Leiste im Rezept (Behalten, neuer Vorschlag …). */
  kiLeiste: () => '',
  /** Vor allem, was andere sehen (Liste, Daumen, gekocht): einen KI-Vorschlag erst behalten. */
  kiVorAktion: () => {},
  /** Den Anpassen-Editor schließen (ansicht-anpassen.js), wenn das Rezept wechselt. */
  anpassenZu: () => {},
  /** Die Angebote, die gerade gelten, und der Laden, zu dem man geht ('' für alle) – setzt ansicht-angebote.js, die Liste zeigt sie an. */
  angeboteJetzt: () => [],
  ladenJetzt: () => '',
  /** Den Laden wählen – von der Liste aus; setzt ansicht-angebote.js. */
  ladenSetzen: () => {},
  /** Die Liste neu zeichnen, wenn sich Angebote oder Laden ändern (setzt app.js). */
  listeNeu: () => {},
  /** Das Tempo wurde vergessen oder wiederhergestellt: Zeiten neu zeichnen (setzt app.js). */
  tempoNeu: () => {},
  /** Amys Rezepte, wie Liste und Timer sie verstehen: id → { id, name, short, ablauf, items } (ansicht-amy.js). */
  amyNach: {},
};

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const istSchmal = () => window.matchMedia('(max-width: 979.98px)').matches;

export const lese = (k, d) => {
  try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; }
};
export const schreibe = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Gedächtnis weiter */ }
};

/* ------------------------------------------------------- Ansicht merken */

const ANSICHT = 'boxenstopp.ansicht.v1';
const gemerkt = lese(ANSICHT, {}) || {};
/** Alle Reiter – die Einstellungen sind immer da, die anderen lassen sich unten ausblenden (ansicht-einstellungen.js). */
export const REITER = ['rezepte', 'amy', 'einkauf', 'angebote', 'einstellungen'];
export const ansicht = {
  tab: REITER.includes(gemerkt.tab) ? gemerkt.tab : 'rezepte',
  filter: typeof gemerkt.filter === 'string' ? gemerkt.filter : 'alle',
  rezept: typeof gemerkt.rezept === 'string' ? gemerkt.rezept : null,
  /** Höchstens so viel pro Box (0 = egal) und die Reihenfolge im Raster. */
  preis: [1.75, 2, 2.25, 2.5].includes(gemerkt.preis) ? gemerkt.preis : 0,
  sort: ['preis', 'zeit'].includes(gemerkt.sort) ? gemerkt.sort : 'standard',
};
export const ansichtMerken = () => schreibe(ANSICHT, ansicht);

/* --------------------------------------------------------------- Meldung */

let meldungTimer = null;
let meldungArt = '';
export function melde(text, { knopf, beiKnopf, art = '' } = {}) {
  const el = $('#toast');
  meldungArt = art;
  el.dataset.art = art || '';
  el.textContent = '';
  const span = document.createElement('span');
  span.textContent = text;
  el.append(span);
  if (knopf && typeof beiKnopf === 'function') {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = knopf;
    b.addEventListener('click', () => { meldungWeg(); beiKnopf(); });
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(meldungWeg, knopf ? 6000 : 3200);
}
export function meldungWeg() { $('#toast').classList.remove('show'); meldungArt = ''; }

/* ---------------------------------------------------------------- Reiter */

const scrollPos = { rezepte: 0, einkauf: 0, angebote: 0, amy: 0, einstellungen: 0 };
const beimReiter = [];
/** Wer wissen will, wenn der Reiter wechselt (die Einstellungen zeichnen sich dann neu). */
export const reiterBeobachten = (fn) => { beimReiter.push(fn); };
/* Die Farbe der Leiste oben im Browser: rosa bei Amy (siehe css, html[data-tab="amy"]). */
const LEISTE = { hell: ['#EDF1EF', '#FFEAF3'], dunkel: ['#0E1412', '#2A1120'] };
export function zeigeReiter(t, scrollBehalten = false) {
  if (istSchmal()) scrollPos[ansicht.tab] = window.scrollY;
  ansicht.tab = REITER.includes(t) ? t : 'rezepte';
  $('#app').dataset.tab = ansicht.tab;
  document.documentElement.dataset.tab = ansicht.tab;
  const amy = ansicht.tab === 'amy' ? 1 : 0;
  for (const m of $$('meta[name="theme-color"]')) m.setAttribute('content', /dark/.test(m.media || '') ? LEISTE.dunkel[amy] : LEISTE.hell[amy]);
  if (ansicht.tab === 'einkauf' && meldungArt === 'zur-liste') meldungWeg();
  for (const b of $$('.tab')) {
    if (b.dataset.tab === ansicht.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  ansichtMerken();
  if (istSchmal() && !scrollBehalten) window.requestAnimationFrame(() => window.scrollTo(0, scrollPos[ansicht.tab] || 0));
  // Breit stehen die Einstellungen links wie Angebote und Amy – nach oben, damit man sie sieht
  else if (!istSchmal() && ansicht.tab === 'einstellungen' && !scrollBehalten) window.scrollTo(0, 0);
  beimReiter.forEach((fn) => fn(ansicht.tab));
}
