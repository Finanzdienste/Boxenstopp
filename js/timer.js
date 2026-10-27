/*
 * Küchentimer: In jedem Schritt steht rechts die Zeit – antippen startet
 * einen Timer dafür, mehrere nebeneinander (Reis und Sauce). Sie laufen oben
 * unter der Kopfzeile mit, überleben ein Neuladen (Endzeit im localStorage)
 * und melden sich am Ende mit Ton, Vibration und – wenn erlaubt –
 * einer Benachrichtigung.
 *
 * Nur auf diesem Handy: Wer kocht, hat das Handy in der Hand; das andere
 * braucht die Timer nicht.
 *
 * Grenzen: Die Uhr läuft im Browser. Mit ausgeschaltetem Bildschirm kann
 * Android die Seite einschlafen lassen, dann kommt der Alarm erst beim
 * nächsten Aufwecken – „Bildschirm anlassen“ im Rezept hilft.
 */
import { lese, schreibe, melde } from './kern.js';
import { esc } from './format.js';

const SPEICHER = 'boxenstopp.timer.v1';
let timer = (lese(SPEICHER, []) || []).filter((t) => t && typeof t.ende === 'number' && typeof t.id === 'string');
let takt = null;
let zeichnen = () => {};
let audio = null;

const merken = () => schreibe(SPEICHER, timer);
const neueId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const alleTimer = () => timer;
export const timerFuer = (rid, schritt) => timer.find((t) => t.rid === rid && t.schritt === schritt);
export const laufend = () => timer.filter((t) => !t.fertig);

/** „12:05“ bzw. „1:02:05“ */
export function restText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sek = s % 60;
  return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(sek).padStart(2, '0')}`;
}

export function timerStarten({ rid, schritt, minuten, label }) {
  const min = Math.max(1, Math.round(Number(minuten) || 1));
  const t = { id: neueId(), rid, schritt, label: String(label || '').slice(0, 60), minuten: min, start: Date.now(), ende: Date.now() + min * 60000, fertig: false };
  timer = [...timer.filter((x) => !(x.rid === rid && x.schritt === schritt)), t];
  merken();
  erlaubnisHolen();
  tonVorbereiten();
  tick();
  return t;
}

export function timerStoppen(id) {
  timer = timer.filter((t) => t.id !== id);
  merken();
  tick();
}

export function timerVerlaengern(id, minuten = 1) {
  const t = timer.find((x) => x.id === id);
  if (!t) return;
  t.ende = Math.max(Date.now(), t.ende) + minuten * 60000;
  t.fertig = false;
  merken();
  tick();
}

/* ---------------------------------------------------------------- Alarm */

function erlaubnisHolen() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch { /* egal */ }
}

/** Der Ton braucht eine Nutzeraktion zum Anlegen – das Antippen des Timers ist eine. */
function tonVorbereiten() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) audio = new AC();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { audio = null; }
}

function piepen() {
  try {
    if (!audio) return;
    const jetzt = audio.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = i % 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, jetzt + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.5, jetzt + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, jetzt + i * 0.35 + 0.28);
      o.connect(g).connect(audio.destination);
      o.start(jetzt + i * 0.35);
      o.stop(jetzt + i * 0.35 + 0.3);
    }
  } catch { /* dann eben ohne Ton */ }
}

function alarm(t) {
  piepen();
  try { navigator.vibrate?.([400, 150, 400, 150, 600]); } catch { /* egal */ }
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('Timer fertig', { body: t.label || `${t.minuten} Min. sind um`, tag: t.id, renotify: true });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch { /* egal */ }
  melde(`Fertig: ${t.label || `${t.minuten} Min.`}`, { knopf: 'Aus', beiKnopf: () => timerStoppen(t.id) });
}

/* ----------------------------------------------------------------- Takt */

function tick() {
  const jetzt = Date.now();
  let geaendert = false;
  for (const t of timer) {
    if (!t.fertig && t.ende <= jetzt) { t.fertig = true; geaendert = true; alarm(t); }
  }
  if (geaendert) merken();
  zeichnen();
  if (laufend().length) { if (!takt) takt = setInterval(tick, 500); } else if (takt) { clearInterval(takt); takt = null; }
}

/** HTML eines Timers für die Leiste oben und für den Knopf im Schritt. */
export function timerText(t) {
  return t.fertig ? 'fertig' : restText(t.ende - Date.now());
}

export function leisteHTML() {
  if (!timer.length) return '';
  return timer.map((t) => `<div class="tm${t.fertig ? ' tm-fertig' : ''}" data-timer-zu="${esc(t.rid)}" data-timer-schritt="${t.schritt}">
<span class="tm-rest">${timerText(t)}</span><span class="tm-label">${esc(t.label || `${t.minuten} Min.`)}</span>
${t.fertig ? `<button type="button" class="tm-btn" data-timer-plus="${t.id}" aria-label="1 Minute dazu">+1</button>` : ''}
<button type="button" class="tm-btn tm-x" data-timer-stopp="${t.id}" aria-label="Timer beenden">×</button>
</div>`).join('');
}

/** Von app.js: wie die Leiste und die Knöpfe gezeichnet werden. */
export function timerAnmelden(fn) {
  zeichnen = fn;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  tick();
}

/** true, wenn der Klick hierher gehörte. */
export function klickTimer(el) {
  const d = el.dataset;
  if (d.timerStopp) { timerStoppen(d.timerStopp); return true; }
  if (d.timerPlus) { timerVerlaengern(d.timerPlus, 1); return true; }
  return false;
}
