/*
 * Ein Foto groß ansehen und hineinzoomen (Tobi: „Man soll auch ranzoomen
 * können“) – für die Sachen (ansicht-inventar.js): in der Sachen-App und in
 * der eigenen Liste eines Gasts. Das Foto steht ganz da (nicht beschnitten
 * wie im Quadrat der Sache), auf schwarzem Grund über den ganzen Bildschirm.
 *
 *   Zwei Finger   zoomen um die Stelle zwischen den Fingern (bis 6-fach)
 *   ein Finger    verschieben, sobald gezoomt ist
 *   doppelt tippen  2,5-fach an dieser Stelle – noch einmal: zurück
 *   Mausrad, + und −  dasselbe am Rechner; Esc oder × schließt
 *
 * Gezeichnet wird mit transform (translate, dann scale, Ursprung oben links)
 * auf dem Bild, das die ganze Fläche einnimmt (object-fit: contain). Ein Punkt
 * p des Bildes liegt dann bei p · s + t. Verschoben wird nie weiter, als das
 * Foto selbst reicht (nicht in den schwarzen Rand daneben); ist es kleiner
 * als der Bildschirm, steht es in der Mitte. Der Dialog entsteht beim ersten Mal (#zoom-dlg) – beide Apps
 * brauchen dafür nichts in ihrer index.html. Am Dialog steht die Stufe als
 * data-zoom (für die Tests).
 */

const MAX = 6;
const DOPPEL = 2.5;
const DOPPEL_MS = 320;

const KREUZ = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

let dlg = null;
let flaeche = null;
let bild = null;
let z = { s: 1, x: 0, y: 0 };
const finger = new Map(); // pointerId → { x, y }
let pinch = null; // { d, s, x, y, mx, my } beim Ansetzen von zwei Fingern
let letzterTipp = { t: 0, x: 0, y: 0 };
let bewegt = false;

const grenze = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Nicht weiter schieben, als das Foto reicht: Mit object-fit: contain liegt es
 * mittig in der Fläche (Rand o bei 1-fach, Größe c). Gezoomt reicht es von
 * o · s + t bis (o + c) · s + t – ist das breiter als die Fläche, darf es bis an
 * ihre Ränder, sonst steht es in der Mitte. Bei 1 genau an seinem Platz.
 */
function achse(t, s, gesamt, natur, grund) {
  const c = natur * grund;
  const o = (gesamt - c) / 2;
  if (c * s <= gesamt) return (gesamt - c * s) / 2 - o * s;
  return grenze(t, gesamt - (o + c) * s, -o * s);
}
function begrenzen(n) {
  const r = flaeche.getBoundingClientRect();
  const s = grenze(n.s, 1, MAX);
  const nw = bild.naturalWidth || r.width;
  const nh = bild.naturalHeight || r.height;
  const grund = Math.min(r.width / nw, r.height / nh) || 1;
  return { s, x: achse(n.x, s, r.width, nw, grund), y: achse(n.y, s, r.height, nh, grund) };
}

function setzen(n) {
  z = begrenzen(n);
  bild.style.transform = `translate(${z.x}px, ${z.y}px) scale(${z.s})`;
  dlg.dataset.zoom = String(Math.round(z.s * 100) / 100);
  flaeche.classList.toggle('gezoomt', z.s > 1.01);
}

/** Auf die Stufe s zoomen – die Stelle (fx, fy) der Fläche bleibt, wo sie ist. */
function zoomUm(s, fx, fy) {
  const neu = grenze(s, 1, MAX);
  const q = neu / z.s;
  setzen({ s: neu, x: fx - (fx - z.x) * q, y: fy - (fy - z.y) * q });
}

const punkt = (e) => { const r = flaeche.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const mitte = () => { const [a, b] = [...finger.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; };

function runter(e) {
  try { flaeche.setPointerCapture(e.pointerId); } catch { /* ohne Fangen geht es auch */ }
  finger.set(e.pointerId, punkt(e));
  bewegt = false;
  if (finger.size === 2) {
    const m = mitte();
    pinch = { d: m.d, s: z.s, x: z.x, y: z.y, mx: m.x, my: m.y };
  }
}

function bewegen(e) {
  if (!finger.has(e.pointerId)) return;
  const alt = finger.get(e.pointerId);
  const p = punkt(e);
  finger.set(e.pointerId, p);
  if (Math.hypot(p.x - alt.x, p.y - alt.y) > 2) bewegt = true;
  if (finger.size >= 2 && pinch) {
    // Die Stelle des Bildes, die beim Ansetzen zwischen den Fingern lag, bleibt zwischen ihnen
    const m = mitte();
    const s = grenze(pinch.s * (m.d / pinch.d), 1, MAX);
    const qx = (pinch.mx - pinch.x) / pinch.s;
    const qy = (pinch.my - pinch.y) / pinch.s;
    setzen({ s, x: m.x - qx * s, y: m.y - qy * s });
  } else if (finger.size === 1 && z.s > 1) {
    setzen({ s: z.s, x: z.x + (p.x - alt.x), y: z.y + (p.y - alt.y) });
  }
}

function hoch(e) {
  if (!finger.has(e.pointerId)) return;
  const p = punkt(e);
  const warAllein = finger.size === 1 && !pinch;
  finger.delete(e.pointerId);
  if (finger.size < 2) pinch = null;
  if (!warAllein || bewegt) return;
  // Doppelt tippen: hinein an dieser Stelle – ist schon gezoomt, zurück
  const jetzt = Date.now();
  if (jetzt - letzterTipp.t < DOPPEL_MS && Math.hypot(p.x - letzterTipp.x, p.y - letzterTipp.y) < 30) {
    if (z.s > 1.01) setzen({ s: 1, x: 0, y: 0 }); else zoomUm(DOPPEL, p.x, p.y);
    letzterTipp = { t: 0, x: 0, y: 0 };
  } else letzterTipp = { t: jetzt, x: p.x, y: p.y };
}

function abbrechen(e) {
  finger.delete(e.pointerId);
  if (finger.size < 2) pinch = null;
}

function rad(e) {
  e.preventDefault();
  const p = punkt(e);
  zoomUm(z.s * Math.exp(-e.deltaY * 0.0025), p.x, p.y);
}

/** + und −: um die Mitte. */
function stufe(faktor) {
  const r = flaeche.getBoundingClientRect();
  zoomUm(z.s * faktor, r.width / 2, r.height / 2);
}

function zu() {
  if (!dlg?.open) return;
  if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
}

function anlegen() {
  dlg = document.createElement('dialog');
  dlg.className = 'zoom-dlg';
  dlg.id = 'zoom-dlg';
  dlg.setAttribute('aria-label', 'Foto groß');
  dlg.innerHTML = `<div class="zoom-flaeche"><img class="zoom-bild" alt="" draggable="false"></div>
<div class="zoom-leiste"><button type="button" class="zoom-knopf" data-zoom-stufe="aus" aria-label="Herauszoomen">−</button><button type="button" class="zoom-knopf" data-zoom-stufe="ein" aria-label="Hineinzoomen">+</button><button type="button" class="zoom-knopf zoom-zu" aria-label="Schließen">${KREUZ}</button></div>
<p class="zoom-tipp">Mit zwei Fingern zoomen · doppelt tippen</p>`;
  document.body.append(dlg);
  flaeche = dlg.querySelector('.zoom-flaeche');
  bild = dlg.querySelector('.zoom-bild');
  flaeche.addEventListener('pointerdown', runter);
  flaeche.addEventListener('pointermove', bewegen);
  flaeche.addEventListener('pointerup', hoch);
  flaeche.addEventListener('pointercancel', abbrechen);
  flaeche.addEventListener('lostpointercapture', abbrechen);
  flaeche.addEventListener('wheel', rad, { passive: false });
  // Safari zoomt sonst die ganze Seite mit
  flaeche.addEventListener('gesturestart', (e) => e.preventDefault());
  // Eigene Klicks – nicht über die Verteilung der App (die kennt diesen Dialog nicht)
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    if (b.classList.contains('zoom-zu')) zu();
    else if (b.dataset.zoomStufe === 'ein') stufe(1.6);
    else if (b.dataset.zoomStufe === 'aus') stufe(1 / 1.6);
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stufe(1.6); }
    if (e.key === '-') { e.preventDefault(); stufe(1 / 1.6); }
  });
  dlg.addEventListener('close', () => { finger.clear(); pinch = null; bild.removeAttribute('src'); });
  // Erst mit dem geladenen Foto kennt die Fläche seine Größe – dann noch einmal begrenzen
  bild.addEventListener('load', () => setzen(z));
}

/** Das Foto (src: Adresse, auch blob:) groß zeigen – zum Zoomen. */
export function bildZoomen(src, { alt = '' } = {}) {
  if (!src) return;
  if (!dlg) anlegen();
  bild.alt = alt;
  bild.src = src;
  finger.clear();
  pinch = null;
  if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  setzen({ s: 1, x: 0, y: 0 });
  dlg.querySelector('.zoom-zu')?.focus({ preventScroll: true });
}
