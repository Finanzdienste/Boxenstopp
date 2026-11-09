/*
 * Was alle Teile der App teilen: der Zustand, die Meldung unten, die beiden
 * Reiter und das, was sich das Handy über die Ansicht merkt.
 */
import { leer } from './liste.js';

/** Liegt auf diesem Gerät ein Schlüssel für die Liste? (derselbe Eintrag wie ladeZugang in zugang.js) */
function mitSchluessel() {
  try { const z = JSON.parse(localStorage.getItem('boxenstopp.zugang.v1') || 'null'); return !!(z && typeof z.token === 'string' && z.token); } catch { return false; }
}

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
  /** Die Rezepte aus daten/rezepte.json, wie sie dort stehen – app.rezepte sind sie auf das Ziel gerechnet (ansicht-ziel.js). */
  rezepteBasis: [],
  /** Ziel pro Box: aus daten/rezepte.json oder das eigene der Liste (Einstellungen → Ziel pro Box). */
  ziel: { kcal: 443, p: 33, kh: 39, f: 15.4 },
  zielStandard: { kcal: 443, p: 33, kh: 39, f: 15.4 },
  /** Für wie viele Boxen die Liste kocht (profil.boxen, ansicht-boxen.js) – die Rezepte sind für 8 gebaut. */
  boxen: 8,
  stand: leer(),
  listeDa: false,
  speicher: null,
  zugang: null,
  kiGeteilt: null, // ki.json der Liste: { schluessel, von, stand } – der für alle Handys freigegebene KI-Schlüssel (zugang.js)
  // Mit Schlüssel auf diesem Gerät gilt bis zum ersten Abgleich „Geteilt“ – wie github() beim Start, und wie
  // index.html den Punkt oben schon vor dem ersten Bild zeigt. Sonst stand dort beim Öffnen „Nur lokal“, bis die
  // Rezepte geladen waren (Amy: „springt zwischen geteilt und lokal hin und her“).
  status: { zustand: mitSchluessel() ? 'ok' : 'lokal', offen: 0, zuletzt: null },
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
  /** Ein KI-Rezept aus den Resten der Packungen (ansicht-reste.js → ansicht-ki.js); null, solange die KI nicht geladen ist. */
  kiAusResten: null,
  /** Der gemeinsame Katalog (katalog.js): der Stand aus katalog.json, die Kurznamen herausgenommener Rezepte. */
  katalogStand: null,
  katalogNamen: {},
  /** Ein Rezept in den Katalog (ansicht-katalog.js) – gibt die id zurück; null, solange nicht geladen. */
  katalogDazu: null,
  /** Die Leiste im Rezept eines Katalogrezepts (ansicht-katalog.js). */
  katalogLeiste: () => '',
  /** Im Rezept: die Rezepte, die gut zusammen damit gehen (ansicht-doppel.js). */
  doppelKarte: () => {},
  /** Die Rezepte neu rechnen und zeichnen, wenn der Katalog sich geändert hat (setzt app.js). */
  rezepteNeu: () => {},
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
export const lese = (k, d) => {
  try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; }
};
export const schreibe = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Gedächtnis weiter */ }
};

/*
 * Breit oder schmal. Breit (html[data-breit]) steht die Einkaufsliste rechts
 * neben allem anderen, und die Reiter unten fehlen. Das gibt es ab 980 px –
 * aber nicht auf dem iPad und anderen Geräten nur zum Tippen: Dort ist die
 * Liste ein eigener Reiter unten wie auf dem Handy (Amy fand sie rechts
 * unnötig). Einstellbar je Gerät unter Einstellungen → Darstellung.
 * index.html setzt das Merkmal schon vor dem ersten Bild; hier kommt es nach
 * jedem Drehen, jeder Fenstergröße und jeder Wahl neu.
 */
export const DANEBEN = 'boxenstopp.liste-daneben.v1'; // true | false – fehlt: nach dem Gerät
const BREIT_AB = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 980px)') : null;
/** iPad (gibt sich als Mac aus, hat aber Touch) oder sonst ein Gerät ohne Maus. */
export const nurZumTippen = () => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || window.matchMedia('(hover: none)').matches;
/** Soll die Liste auf breitem Bildschirm rechts daneben stehen? */
export const listeDaneben = () => { const w = lese(DANEBEN, null); return typeof w === 'boolean' ? w : !nurZumTippen(); };
/** Kann dieses Gerät überhaupt breit (980 px) werden – etwa das iPad quer? Sonst braucht es die Wahl nicht. */
export const kannBreit = () => Math.max(window.screen?.width || 0, window.screen?.height || 0, window.innerWidth || 0) >= 980;
export const istSchmal = () => !document.documentElement.hasAttribute('data-breit');
/** html[data-breit] nach Breite und Wahl setzen; true, wenn es sich geändert hat. */
export function breiteAnwenden() {
  const breit = !!BREIT_AB?.matches && listeDaneben();
  if (breit === !istSchmal()) return false;
  document.documentElement.toggleAttribute('data-breit', breit);
  return true;
}
if (BREIT_AB?.addEventListener) BREIT_AB.addEventListener('change', breiteAnwenden);
else BREIT_AB?.addListener?.(breiteAnwenden);

/* ------------------------------------------------------- Ansicht merken */

const ANSICHT = 'boxenstopp.ansicht.v1';
const gemerkt = lese(ANSICHT, {}) || {};
/** Alle Reiter – die Einstellungen sind immer da, die anderen lassen sich unten ausblenden (ansicht-einstellungen.js). */
export const REITER = ['rezepte', 'amy', 'plan', 'einkauf', 'angebote', 'haushalt', 'einstellungen'];
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

const scrollPos = { rezepte: 0, einkauf: 0, angebote: 0, amy: 0, haushalt: 0, einstellungen: 0 };
const beimReiter = [];
/** Wer wissen will, wenn der Reiter wechselt (die Einstellungen zeichnen sich dann neu). */
export const reiterBeobachten = (fn) => { beimReiter.push(fn); };
/*
 * Die Farbe der Leiste oben im Browser: rosa bei Amy (siehe css,
 * html[data-tab="amy"]), in einer lila Liste lila (html[data-farbe]).
 */
const LEISTE = {
  '': { hell: ['#EDF1EF', '#FFEAF3'], dunkel: ['#0E1412', '#2A1120'] },
  lila: { hell: ['#F1EEF8', '#F7F0FF'], dunkel: ['#110D18', '#1A1027'] },
};
/**
 * Beide theme-color-Angaben setzen: je nach Gerät hell oder dunkel – ist in
 * den Einstellungen hell oder dunkel fest gewählt (html[data-design]), beide
 * in dieser Farbe.
 */
export function leisteFaerben() {
  const amy = ansicht.tab === 'amy' ? 1 : 0;
  const fest = document.documentElement.dataset.design;
  const satz = LEISTE[document.documentElement.dataset.farbe || ''] || LEISTE[''];
  for (const m of $$('meta[name="theme-color"]')) {
    const dunkel = fest ? fest === 'dunkel' : /dark/.test(m.media || '');
    m.setAttribute('content', dunkel ? satz.dunkel[amy] : satz.hell[amy]);
  }
}
export function zeigeReiter(t, scrollBehalten = false) {
  if (istSchmal()) scrollPos[ansicht.tab] = window.scrollY;
  ansicht.tab = REITER.includes(t) ? t : 'rezepte';
  $('#app').dataset.tab = ansicht.tab;
  document.documentElement.dataset.tab = ansicht.tab;
  leisteFaerben();
  if (ansicht.tab === 'einkauf' && meldungArt === 'zur-liste') meldungWeg();
  for (const b of $$('.tab')) {
    if (b.dataset.tab === ansicht.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  ansichtMerken();
  if (istSchmal() && !scrollBehalten) window.requestAnimationFrame(() => window.scrollTo(0, scrollPos[ansicht.tab] || 0));
  // Breit stehen Einstellungen und Haushalt links wie Angebote und Amy – nach oben, damit man sie sieht
  else if (!istSchmal() && ['einstellungen', 'haushalt', 'plan'].includes(ansicht.tab) && !scrollBehalten) window.scrollTo(0, 0);
  beimReiter.forEach((fn) => fn(ansicht.tab));
}
