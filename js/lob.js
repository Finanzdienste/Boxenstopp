/*
 * Belohnung: Wer das letzte Häkchen setzt (oder „Heute gekocht“ drückt),
 * bekommt ein Tier auf den Bildschirm – ein echtes Foto oder ein kurzer Clip
 * aus freien Quellen im Netz – das von der Seite hereinläuft, dazu Konfetti,
 * ein Spruch, eine kurze Vibration und ein Klingeln. Jedes Mal ein anderes
 * Tier, ein anderer Spruch: Was zuletzt dran war, merkt sich das Handy.
 *
 * Kleinere Momente (Mise en place steht, Kochen fertig, Einkauf komplett)
 * bekommen nur einen Satz in der Meldung unten.
 *
 * Die Tierquellen brauchen keinen Schlüssel und kosten nichts. Fällt eine
 * aus, kommt die nächste dran; ohne Netz kommt ein gemaltes Tier.
 *
 * Das Tier wird vorgeladen, sobald ein Rezept offen ist – dann ist es da,
 * wenn das Häkchen fällt.
 */
import { lese, schreibe, melde } from './kern.js';
import { esc } from './format.js';

const SPEICHER = 'boxenstopp.lob.v1';
const WIEDER_NACH = 8 * 3600 * 1000; // dasselbe Rezept belohnt erst nach 8 Std. wieder
const MERKE_SPRUECHE = 20;
const MERKE_TIERE = 3;
const ZEIT_ANTWORT = 4500;
const ZEIT_LADEN = 7000;
const MAX_BYTES = 7 * 1024 * 1024; // Clips bis 7 MB, mehr lohnt sich auf dem Handy nicht

const gemerkt = () => {
  const g = lese(SPEICHER, {}) || {};
  return { rezepte: g.rezepte || {}, phasen: g.phasen || {}, sprueche: g.sprueche || [], tiere: g.tiere || [], klein: g.klein || [] };
};
const merken = (g) => schreibe(SPEICHER, g);

/* --------------------------------------------------------------- Sprüche */

export const SPRUECHE = [
  'Acht Boxen. Null Stress. Du bist ein Profi.',
  'Das war Chefkoch-Niveau, {name}.',
  'Die Woche ist gerettet – und zwar von dir.',
  'Boom. Alles abgehakt, alles im Kasten.',
  'Mise en place, gekocht, portioniert. Lehrbuch.',
  'Dein zukünftiges Ich sagt schon mal Danke.',
  'So sieht Disziplin aus, wenn sie gut riecht.',
  'Acht Mahlzeiten in einem Rutsch. Respekt, {name}.',
  'Feierabend verdient. Richtig verdient.',
  'Die Küche hat gewonnen – nein, du hast gewonnen.',
  'Das lief wie am Schnürchen.',
  'Sauber durchgezogen, {name}.',
  'Kochen kann jeder. Acht Boxen exakt auf den Punkt – das kannst du.',
  'Wer so kocht, braucht keinen Lieferdienst.',
  'Meal-Prep-Champion. Den Gürtel gibt es an der Theke.',
  'Die Boxen stehen stramm. Großartig.',
  'Noch ein Rezept geschafft. Du wirst besser, merkst du das?',
  'Das war Konzentration pur. Jetzt Füße hoch.',
  'Alles abgehakt – und zwar ohne Chaos. Stark.',
  'Zehn von zehn Punkten, inklusive Abwasch.',
  'Die Woche kann kommen. Du bist bereit.',
  'Topf leer, Boxen voll, Laune gut.',
  'Perfekt getimt. Die Timer waren fast arbeitslos.',
  'Routine schlägt Motivation – und du hast beides.',
  'Du hast gerade acht gute Entscheidungen auf einmal getroffen.',
  'Nicht nur gekocht. Durchgezogen.',
  'Die Makros stimmen, die Laune auch.',
  'Keine Ausreden, nur Boxen. So geht das.',
  'Der Kühlschrank ist jetzt stolz auf dich.',
  'Schön gleichmäßig portioniert – die Waage hat gestaunt.',
  'Einmal kochen, achtmal entspannt essen. Clever.',
  'Du hast das Rezept nicht nur gelesen, du hast es gelebt.',
  'Heute kein Hungerloch. Dank dir.',
  'Klarer Plan, saubere Küche, volle Boxen.',
  'So, das war’s. Mehr geht an einem Abend nicht.',
  'Das Essen hat Glück, von dir gekocht worden zu sein.',
  'Konsequent. Ruhig. Lecker. Du eben.',
  'Noch nie war ein Montag so gut vorbereitet.',
  'Standing Ovations aus dem Gewürzregal.',
  'Das Schwierigste war der Anfang. Den hast du längst hinter dir.',
  'Acht Boxen, ein Lächeln. Gute Bilanz.',
  'Wenn das kein Grund für ein Tier ist, {name}.',
  'Die Küche glänzt, die Boxen auch. Du auch.',
  'Du hast heute Zukunfts-Hunger besiegt.',
  'Das war kein Kochen, das war Choreografie.',
  'Alles auf den Punkt. Wie immer, nur noch ein bisschen besser.',
  'Die Nachbarn riechen es. Die Nachbarn sind neidisch.',
  'Ehrenrunde durch die Küche – du hast sie dir verdient.',
  'Jedes Häkchen ein kleiner Sieg. Das hier war der große.',
  'Du könntest das beruflich machen. Mach es lieber für euch.',
  'Fertig, und es ist noch nicht mal spät. Wahnsinn.',
  'Sieht aus wie geplant. War auch so geplant. Von dir.',
  'Das Rezept hatte Respekt vor dir. Zu Recht.',
  'Boxen zu, Herz auf. Bist ein Schatz, {name}.',
  'Die Woche hat jetzt acht Lichtblicke mehr.',
  'Großes Kino. Abspann läuft.',
];

const KLEIN = {
  Vorbereiten: [
    'Mise en place steht – ab jetzt wird’s entspannt.',
    'Alles in Schalen. Der Rest ist Fahrplan.',
    'Vorbereitet wie ein Profi. Jetzt Herd an.',
    'Alles geschnippelt, nichts vergessen. Weiter so.',
    'Die halbe Miete ist durch.',
    'Schalen voll, Kopf frei. Los geht’s.',
    'Sauber vorbereitet. Beim Kochen wird jetzt nichts mehr gesucht.',
  ],
  Kochen: [
    'Riecht bestimmt großartig. Jetzt nur noch verteilen.',
    'Gekocht! Die Boxen warten schon.',
    'Das Schwierigste ist geschafft.',
    'Herd aus, Waage an. Gleich fertig.',
    'Läuft bei dir. Noch portionieren, dann Feierabend.',
    'Topf voll, Plan erfüllt. Endspurt.',
  ],
  einkauf: [
    'Einkauf komplett. Nichts vergessen – stark.',
    'Alles im Korb. Die Küche kann kommen.',
    'Liste leer, Kühlschrank voll. So soll das.',
    'Komplett abgehakt. Jetzt hast du alles für die Woche.',
  ],
};

/** Ein Spruch, der zuletzt nicht dran war; {name} wird eingesetzt oder weggelassen. */
export function spruch(name, g = gemerkt()) {
  const frei = SPRUECHE.map((_, i) => i).filter((i) => !g.sprueche.includes(i));
  const pool = frei.length ? frei : SPRUECHE.map((_, i) => i);
  const i = pool[Math.floor(Math.random() * pool.length)];
  g.sprueche = [...g.sprueche.filter((x) => x !== i), i].slice(-MERKE_SPRUECHE);
  return mitName(SPRUECHE[i], name);
}

function mitName(text, name) {
  if (name) return text.replace('{name}', name);
  return text.replace(/,? \{name\}/, '').replace('{name}', 'du');
}

/* ------------------------------------------------------------------ Tiere */

const TIER = {
  hund: { name: 'Hund', artikel: 'Ein Hund', emoji: '🐶' },
  katze: { name: 'Katze', artikel: 'Eine Katze', emoji: '🐱' },
  fuchs: { name: 'Fuchs', artikel: 'Ein Fuchs', emoji: '🦊' },
  ente: { name: 'Ente', artikel: 'Eine Ente', emoji: '🦆' },
  hase: { name: 'Hase', artikel: 'Ein Hase', emoji: '🐰' },
  shiba: { name: 'Shiba', artikel: 'Ein Shiba', emoji: '🐕' },
  vogel: { name: 'Vogel', artikel: 'Ein Vogel', emoji: '🐦' },
  capybara: { name: 'Capybara', artikel: 'Ein Capybara', emoji: '🦫' },
};

const VIDEO = /\.(mp4|webm)(\?|$)/i;

/**
 * Freie Quellen ohne Schlüssel (alle mit CORS geprüft). parse() gibt
 * { src, typ } zurück oder null. Der Hund kommt am liebsten als kurzer Clip.
 */
export const QUELLEN = [
  { tier: 'hund', url: 'https://random.dog/woof.json?include=mp4,webm', parse: (j) => (j?.url && (!j.fileSizeBytes || j.fileSizeBytes <= MAX_BYTES) ? medium(j.url) : null) },
  { tier: 'hund', url: 'https://random.dog/woof.json?include=mp4,webm', parse: (j) => (j?.url && (!j.fileSizeBytes || j.fileSizeBytes <= MAX_BYTES) ? medium(j.url) : null) },
  { tier: 'hund', url: 'https://random.dog/woof.json', parse: (j) => (j?.url && (!j.fileSizeBytes || j.fileSizeBytes <= MAX_BYTES) ? medium(j.url) : null) },
  { tier: 'hund', url: 'https://dog.ceo/api/breeds/image/random', parse: (j) => (j?.status === 'success' ? medium(j.message) : null) },
  { tier: 'katze', url: 'https://api.thecatapi.com/v1/images/search', parse: (j) => medium(j?.[0]?.url) },
  { tier: 'katze', url: 'https://cataas.com/cat?json=true', parse: (j) => medium(j?.url) },
  { tier: 'fuchs', url: 'https://randomfox.ca/floof/', parse: (j) => medium(j?.image) },
  { tier: 'hase', url: 'https://api.bunnies.io/v2/loop/random/?media=mp4,poster', parse: (j) => medium(j?.media?.mp4 || j?.media?.poster) },
  { tier: 'capybara', url: 'https://api.capy.lol/v1/capybara?json=true', parse: (j) => medium(String(j?.data?.url || '').replace(/^http:\/\//, 'https://')) },
];

function medium(src) {
  if (typeof src !== 'string' || !/^https:\/\//.test(src)) return null;
  return { src, typ: VIDEO.test(src) ? 'video' : 'bild' };
}

let bereit = null;      // { tier, src, typ, el } – vorgeladen
let laedt = null;       // Promise, solange geladen wird
let gezeigt = null;     // was gerade auf dem Bildschirm ist

function mitZeit(p, ms) {
  return new Promise((ok, nein) => {
    const t = setTimeout(() => nein(new Error('zeit')), ms);
    p.then((x) => { clearTimeout(t); ok(x); }, (e) => { clearTimeout(t); nein(e); });
  });
}

async function holeVon(q) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ac?.abort(), ZEIT_ANTWORT);
  try {
    const res = await fetch(q.url, { signal: ac?.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    const m = q.parse(await res.json());
    if (!m) throw new Error('leer');
    return m;
  } finally { clearTimeout(t); }
}

/** Bild oder Video so weit laden, dass es ohne Ruckeln erscheint. */
function vorladen(m) {
  return mitZeit(new Promise((ok, nein) => {
    if (m.typ === 'video') {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
      v.src = m.src;
      v.addEventListener('canplay', () => ok(v), { once: true });
      v.addEventListener('error', () => nein(new Error('video')), { once: true });
      v.load();
    } else {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => nein(new Error('bild'));
      img.src = m.src;
    }
  }), ZEIT_LADEN);
}

/** Ein Tier aus einer Quelle, die zuletzt nicht dran war; drei Versuche. */
async function tierHolen() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  const g = gemerkt();
  // Bei Datensparmodus keine Clips, nur Fotos.
  const sparen = !!navigator.connection?.saveData;
  const quellen = QUELLEN.filter((q) => !(sparen && /mp4/.test(q.url)));
  const frei = quellen.filter((q) => !g.tiere.includes(q.tier));
  const pool = (frei.length ? frei : quellen).slice().sort(() => Math.random() - 0.5);
  for (const q of pool.slice(0, 3)) {
    try {
      const m = await holeVon(q);
      const el = await vorladen(m);
      return { tier: q.tier, ...m, el };
    } catch { /* nächste Quelle */ }
  }
  return null;
}

/** Von außen: sobald ein Rezept offen ist, damit das Tier da ist, wenn das Häkchen fällt. */
export function tierVorladen() {
  if (bereit || laedt) return laedt;
  laedt = tierHolen().then((t) => { bereit = t; laedt = null; return t; }, () => { laedt = null; return null; });
  return laedt;
}

/* ------------------------------------------------------------- Ausgabe */

const TIER_SAETZE = [
  '{artikel} ist extra für dich vorbeigekommen.',
  '{artikel} hat zugesehen und findet: stark.',
  '{artikel} wollte das Ergebnis unbedingt sehen.',
  '{artikel} gratuliert – ganz ohne Worte.',
  '{artikel} zum Feierabend. Wie bestellt.',
  '{artikel} sagt: Riecht gut hier.',
];

const konfettiHTML = () => Array.from({ length: 70 }, (_, i) => {
  const links = Math.random() * 100;
  const dauer = 2.6 + Math.random() * 2.2;
  const verz = Math.random() * 1.6;
  const farbe = ['#F4C95D', '#2445C9', '#E0564B', '#35A777', '#F3A1C1', '#F7E9B7'][i % 6];
  const breite = 6 + Math.random() * 7;
  return `<i style="left:${links}%;animation-duration:${dauer}s;animation-delay:${verz}s;background:${farbe};width:${breite}px;height:${breite * 1.6}px;transform:rotate(${Math.random() * 360}deg)"></i>`;
}).join('');

function tierHTML(t) {
  if (!t) {
    const g = gemerkt();
    const arten = Object.keys(TIER).filter((a) => !g.tiere.includes(a));
    const art = arten[Math.floor(Math.random() * arten.length)] || 'hund';
    return { art, html: `<div class="lob-emoji" aria-hidden="true">${TIER[art].emoji}</div>`, el: null, offline: true };
  }
  return { art: t.tier, html: '', el: t.el, offline: false };
}

/**
 * Der große Moment. grund: 'fertig' (alle Schritte) oder 'gekocht'.
 * Gibt true zurück, wenn gezeigt wurde.
 */
export async function lobGross({ rezept, name, grund = 'fertig', erzwingen = false } = {}) {
  const g = gemerkt();
  const rid = rezept?.id || '';
  if (!erzwingen && rid && g.rezepte[rid] && Date.now() - g.rezepte[rid] < WIEDER_NACH) return false;
  if (rid) g.rezepte[rid] = Date.now();
  const text = spruch(name, g);
  merken(g);
  const wrapper = document.getElementById('lob');
  if (!wrapper) return false;
  // Nicht warten, bis das Netz antwortet: wenn nichts vorgeladen ist, kurz versuchen, sonst gemalt.
  let t = bereit;
  bereit = null;
  if (!t) { try { t = await mitZeit(tierVorladen(), 2500); bereit = null; } catch { t = null; } }
  zeigen(wrapper, { t, text, rezept, grund });
  tierVorladen();
  return true;
}

function zeigen(wrapper, { t, text, rezept, grund }) {
  const tier = tierHTML(t);
  const g = gemerkt();
  g.tiere = [...g.tiere.filter((x) => x !== tier.art), tier.art].slice(-MERKE_TIERE);
  merken(g);
  const satz = TIER_SAETZE[Math.floor(Math.random() * TIER_SAETZE.length)].replace('{artikel}', TIER[tier.art].artikel);
  const eyebrow = grund === 'gekocht' ? 'Heute gekocht' : 'Alle Schritte abgehakt';
  wrapper.innerHTML = `<div class="lob-konfetti" aria-hidden="true">${konfettiHTML()}</div>
<div class="lob-karte" role="dialog" aria-modal="true" aria-labelledby="lob-titel">
  <div class="lob-tier${tier.offline ? ' lob-offline' : ''}" data-lob-tier="${tier.art}">${tier.html}<span class="tape">${esc(TIER[tier.art].name)}</span></div>
  <p class="lob-eyebrow">${esc(eyebrow)}${rezept ? ` · ${esc(rezept.short || rezept.name)}` : ''}</p>
  <h2 id="lob-titel">${esc(text)}</h2>
  <p class="lob-satz">${esc(satz)}${tier.offline ? ' <small>(ohne Netz nur gemalt)</small>' : ''}</p>
  <div class="lob-btns">
    <button type="button" class="btn btn-quiet" data-lob="noch">Noch ein Tier</button>
    <button type="button" class="btn" data-lob="zu">Danke!</button>
  </div>
</div>`;
  if (tier.el) {
    const halter = wrapper.querySelector('.lob-tier');
    tier.el.className = 'lob-medium';
    tier.el.setAttribute('alt', '');
    halter.prepend(tier.el);
    if (tier.el.tagName === 'VIDEO') tier.el.play?.().catch(() => {});
  }
  wrapper.hidden = false;
  document.body.classList.add('lob-offen');
  gezeigt = tier.art;
  feiern();
  wrapper.querySelector('[data-lob="zu"]')?.focus?.({ preventScroll: true });
}

export function lobZu() {
  const wrapper = document.getElementById('lob');
  if (!wrapper || wrapper.hidden) return;
  const v = wrapper.querySelector('video');
  if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* egal */ } }
  wrapper.hidden = true;
  wrapper.innerHTML = '';
  document.body.classList.remove('lob-offen');
  gezeigt = null;
}

export const lobOffen = () => gezeigt !== null;

/** Noch ein Tier: nimmt das vorgeladene, sonst wird kurz geladen. */
async function nochEins() {
  const wrapper = document.getElementById('lob');
  if (!wrapper || wrapper.hidden) return;
  const knopf = wrapper.querySelector('[data-lob="noch"]');
  if (knopf) { knopf.disabled = true; knopf.textContent = 'Kommt …'; }
  let t = bereit;
  bereit = null;
  if (!t) { try { t = await mitZeit(tierVorladen(), 6000); bereit = null; } catch { t = null; } }
  if (wrapper.hidden) return;
  const tier = tierHTML(t);
  const g = gemerkt();
  g.tiere = [...g.tiere.filter((x) => x !== tier.art), tier.art].slice(-MERKE_TIERE);
  merken(g);
  const halter = wrapper.querySelector('.lob-tier');
  const alt = halter.querySelector('video');
  if (alt) { try { alt.pause(); } catch { /* egal */ } }
  halter.className = `lob-tier${tier.offline ? ' lob-offline' : ''}`;
  halter.dataset.lobTier = tier.art;
  halter.innerHTML = `${tier.html}<span class="tape">${esc(TIER[tier.art].name)}</span>`;
  if (tier.el) { tier.el.className = 'lob-medium'; tier.el.setAttribute('alt', ''); halter.prepend(tier.el); if (tier.el.tagName === 'VIDEO') tier.el.play?.().catch(() => {}); }
  // Animation neu starten
  halter.style.animation = 'none';
  void halter.offsetWidth;
  halter.style.animation = '';
  const satz = wrapper.querySelector('.lob-satz');
  if (satz) satz.innerHTML = `${esc(TIER_SAETZE[Math.floor(Math.random() * TIER_SAETZE.length)].replace('{artikel}', TIER[tier.art].artikel))}${tier.offline ? ' <small>(ohne Netz nur gemalt)</small>' : ''}`;
  if (knopf) { knopf.disabled = false; knopf.textContent = 'Noch ein Tier'; }
  gezeigt = tier.art;
  tierVorladen();
}

/** Vibration und ein kurzes Klingeln – nur, wenn das Gerät mag. */
function feiern() {
  try { navigator.vibrate?.([120, 60, 120, 60, 240]); } catch { /* egal */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = feiern.ctx || (feiern.ctx = new AC());
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const jetzt = ctx.currentTime;
    [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.38]].forEach(([f, ab]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, jetzt + ab);
      g.gain.exponentialRampToValueAtTime(0.35, jetzt + ab + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, jetzt + ab + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(jetzt + ab);
      o.stop(jetzt + ab + 0.55);
    });
  } catch { /* dann eben ohne Ton */ }
}

/* ---------------------------------------------------------- Kleine Momente */

/** Ein Satz unten in der Meldung – für eine fertige Phase oder den Einkauf. */
export function lobKlein(art, { rezept } = {}) {
  const pool = KLEIN[art];
  if (!pool) return false;
  const g = gemerkt();
  const schluessel = rezept ? `${rezept.id}:${art}` : art;
  if (g.phasen[schluessel] && Date.now() - g.phasen[schluessel] < WIEDER_NACH) return false;
  g.phasen[schluessel] = Date.now();
  const frei = pool.map((_, i) => `${art}${i}`).filter((k) => !g.klein.includes(k));
  const wahl = (frei.length ? frei : pool.map((_, i) => `${art}${i}`));
  const k = wahl[Math.floor(Math.random() * wahl.length)];
  g.klein = [...g.klein, k].slice(-12);
  merken(g);
  melde(pool[Number(k.slice(art.length))], { art: 'lob' });
  try { navigator.vibrate?.(60); } catch { /* egal */ }
  return true;
}

/**
 * Nach jedem Häkchen: Ist eine Phase komplett, kommt ein Satz; sind alle
 * Schritte durch, das Tier. `fertig` ist die Menge der abgehakten Indizes
 * (über alle Phasen durchnummeriert), `vorher` die davor.
 */
export function lobPruefen(rezept, fertig, vorher, { name } = {}) {
  if (!rezept?.ablauf || fertig.size <= vorher.size) return null;
  let i = 0;
  const phasenFertig = [];
  for (const p of rezept.ablauf) {
    const idx = p.schritte.map((_, k) => i + k);
    i += p.schritte.length;
    phasenFertig.push({ t: p.t, jetzt: idx.every((k) => fertig.has(k)), vorher: idx.every((k) => vorher.has(k)) });
  }
  if (i && phasenFertig.every((p) => p.jetzt)) {
    lobGross({ rezept, name, grund: 'fertig' });
    return 'fertig';
  }
  const neu = phasenFertig.find((p) => p.jetzt && !p.vorher && KLEIN[p.t]);
  if (neu) { lobKlein(neu.t, { rezept }); return neu.t; }
  return null;
}

/** true, wenn der Klick hierher gehörte. */
export function klickLob(el) {
  const d = el.dataset;
  if (d.lob === 'zu') { lobZu(); return true; }
  if (d.lob === 'noch') { nochEins(); return true; }
  return false;
}

/** Tipp auf den dunklen Hintergrund oder Escape: zu. */
export function lobStart() {
  const wrapper = document.getElementById('lob');
  if (!wrapper) return;
  wrapper.addEventListener('click', (ev) => { if (ev.target === wrapper) lobZu(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') lobZu(); });
}
