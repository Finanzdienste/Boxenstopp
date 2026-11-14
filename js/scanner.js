/*
 * Der Scanner für Strichcodes: die Kamera in der App statt der Kamera-App –
 * mit Live-Bild, Rahmen und, wo das Handy sie hergibt, der Taschenlampe
 * (MediaStreamTrack mit der Fähigkeit torch: Chrome auf Android; Safari nur,
 * wenn es sie anbietet – der Knopf erscheint nur dann).
 *
 * Kann das Gerät Strichcodes selbst lesen (BarcodeDetector, Chrome auf
 * Android), sucht es im Live-Bild und schließt, sobald es einen hat – ohne
 * Foto. Sonst (Safari auf iPhone und iPad) „Auslösen“: Das Bild im Rahmen
 * geht als Foto zurück, die KI liest es (ansicht-inventar.js). Geht die
 * Kamera nicht (keine Erlaubnis, kein Gerät) oder ist es zu dunkel, bleibt
 * „Mit der Kamera-App“ – dort gibt es den Blitz.
 *
 * scannen() gibt { code } (im Live-Bild gelesen), { datei } (ein Foto) oder
 * null (abgebrochen) zurück. Die Kamera geht aus, sobald der Scanner zu ist
 * oder die App in den Hintergrund kommt (und wieder an, wenn sie zurückkommt).
 */
import { $ } from './kern.js';
import { esc } from './format.js';
import { codeBereinigen, eanOk } from './inventar.js';

const LAMPE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l-1.5 5h-5z"/><path d="M9.5 8h5v11.5a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M12 12v2.5"/></svg>';
const AUSLOESER = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>';
const FORMATE = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
const TAKT = 250;

/** Der laufende Scanner: { ok, stream, track, timer, licht, leser, dateiWahl } oder null. */
let lauf = null;

const text = (l, t) => { if (lauf === l) { const el = $('#scan-text'); if (el) el.textContent = t; } };

function scannerHTML(titel) {
  return `<div class="scan-kopf"><h2 id="scan-titel">${esc(titel)}</h2><button type="button" class="scan-zu" data-scan="zu" aria-label="Schließen">×</button></div>
<div class="scan-bild"><video id="scan-video" playsinline muted autoplay></video><div class="scan-rahmen" aria-hidden="true"></div></div>
<p class="scan-text" id="scan-text" role="status">Kamera startet …</p>
<div class="scan-knoepfe"><button type="button" class="scan-knopf scan-licht" data-scan="licht" aria-pressed="false" hidden>${LAMPE}<span>Taschenlampe</span></button><button type="button" class="scan-knopf" data-scan="ausloesen" disabled>${AUSLOESER}<span>Auslösen</span></button></div>
<p class="scan-fein"><label class="scan-app" for="scan-datei">Mit der Kamera-App</label><span id="scan-app-text"></span><input class="vh" id="scan-datei" type="file" accept="image/*" capture="environment"></p>`;
}

/** Den Hinweis zur Kamera-App: ohne Taschenlampe mit dem Tipp zum Blitz. */
function appHinweis(l) {
  const el = $('#scan-app-text');
  if (el && lauf === l) el.textContent = $('[data-scan="licht"]')?.hidden === false ? '' : ' – zu dunkel? Dort gibt es den Blitz.';
}

function kameraAus(l) {
  clearTimeout(l.timer);
  l.timer = null;
  if (l.licht && l.track) { try { l.track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {}); } catch { /* egal */ } }
  l.licht = false;
  for (const t of l.stream?.getTracks() || []) { try { t.stop(); } catch { /* schon aus */ } }
  l.stream = null;
  l.track = null;
  const video = $('#scan-video');
  if (video) video.srcObject = null;
  const licht = $('[data-scan="licht"]');
  if (licht) { licht.setAttribute('aria-pressed', 'false'); licht.querySelector('span').textContent = 'Taschenlampe'; }
}

function schliessen(ergebnis) {
  const l = lauf;
  if (!l) return;
  kameraAus(l);
  lauf = null;
  const dlg = $('#scan-dlg');
  if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  l.ok(ergebnis);
}

/** Ohne Kamera: sagen, warum, und auf die Kamera-App zeigen. */
function ohneKamera(l, warum) {
  text(l, `${warum} Nimm „Mit der Kamera-App“.`);
  const knopf = $('[data-scan="ausloesen"]');
  if (knopf) knopf.hidden = true;
  $('.scan-app')?.classList.add('gross');
  appHinweis(l);
}

/** Die Taschenlampe zeigen, wenn die Kamera sie hat – manche Handys melden sie erst, wenn das Bild läuft. */
function lichtPruefen(l) {
  const zeigen = () => {
    if (lauf !== l || !l.track) return;
    let kann = false;
    try { kann = l.track.getCapabilities?.().torch === true; } catch { /* kann nicht */ }
    const b = $('[data-scan="licht"]');
    if (b) b.hidden = !kann;
    appHinweis(l);
  };
  zeigen();
  setTimeout(zeigen, 700);
}

async function lichtUmschalten() {
  const l = lauf;
  if (!l?.track) return;
  const an = !l.licht;
  const b = $('[data-scan="licht"]');
  try {
    await l.track.applyConstraints({ advanced: [{ torch: an }] });
    if (lauf !== l) return;
    l.licht = an;
    if (b) { b.setAttribute('aria-pressed', String(an)); b.querySelector('span').textContent = an ? 'Licht aus' : 'Taschenlampe'; }
  } catch {
    if (b) b.hidden = true;
    appHinweis(l);
    text(l, 'Die Taschenlampe geht hier nicht – „Mit der Kamera-App“ gibt es den Blitz.');
  }
}

/** Im Live-Bild suchen, bis das Gerät einen Code hat (EAN und UPC nur mit stimmender Prüfziffer). */
async function lesenImTakt(l) {
  let erkenner;
  try {
    const da = await window.BarcodeDetector.getSupportedFormats?.() || [];
    const formate = FORMATE.filter((x) => !da.length || da.includes(x));
    erkenner = new window.BarcodeDetector(formate.length ? { formats: formate } : undefined);
  } catch { return; }
  const schritt = async () => {
    if (lauf !== l || !l.stream) return;
    const video = $('#scan-video');
    if (video && video.readyState >= 2) {
      try {
        const treffer = await erkenner.detect(video);
        for (const t of treffer || []) {
          const c = codeBereinigen(t?.rawValue);
          const ean = /^\d+$/.test(c) && [8, 12, 13, 14].includes(c.length);
          if (c && (!ean || eanOk(c))) { if (lauf === l) schliessen({ code: c }); return; }
        }
      } catch { /* das nächste Bild */ }
    }
    if (lauf === l && l.stream) l.timer = setTimeout(schritt, TAKT);
  };
  schritt();
}

async function kameraStarten(l) {
  if (!navigator.mediaDevices?.getUserMedia) { ohneKamera(l, 'Hier lässt sich die Kamera nicht öffnen.'); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
  } catch (e) {
    ohneKamera(l, e?.name === 'NotAllowedError' ? 'Die App darf die Kamera nicht benutzen (in den Einstellungen erlauben).' : 'Die Kamera lässt sich gerade nicht öffnen.');
    return;
  }
  if (lauf !== l || l.dateiWahl) { for (const t of stream.getTracks()) t.stop(); return; }
  l.stream = stream;
  l.track = stream.getVideoTracks()[0] || null;
  const video = $('#scan-video');
  if (video) {
    video.srcObject = stream;
    try { await video.play(); } catch { /* spielt von selbst */ }
  }
  if (lauf !== l) return;
  const knopf = $('[data-scan="ausloesen"]');
  if (knopf) { knopf.hidden = false; knopf.disabled = false; }
  text(l, l.leser ? 'Halte den Strichcode in den Rahmen – das Handy liest ihn von selbst.' : 'Strichcode in den Rahmen, dann „Auslösen“ – die KI liest ihn.');
  lichtPruefen(l);
  if (l.leser) lesenImTakt(l);
}

/** Das Bild im Rahmen als Foto (großzügig ausgeschnitten, in voller Auflösung). */
async function ausloesen() {
  const l = lauf;
  const video = $('#scan-video');
  if (!l || !video?.videoWidth) return;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  // Sichtbar ist wegen object-fit: cover nur ein Teil des Bildes – davon der Bereich um den Rahmen
  const s = Math.max((video.clientWidth || vw) / vw, (video.clientHeight || vh) / vh);
  const w = Math.min(vw, ((video.clientWidth || vw) / s) * 0.96);
  const h = Math.min(vh, ((video.clientHeight || vh) / s) * 0.6);
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  c.getContext('2d').drawImage(video, (vw - w) / 2, (vh - h) / 2, w, h, 0, 0, c.width, c.height);
  const blob = await new Promise((fertig) => { c.toBlob(fertig, 'image/jpeg', 0.92); });
  if (!blob || lauf !== l) return;
  schliessen({ datei: new window.File([blob], 'strichcode.jpg', { type: 'image/jpeg' }) });
}

/** Den Scanner öffnen: { code }, { datei } oder null (siehe oben). */
export function scannen({ titel = 'Strichcode scannen' } = {}) {
  const dlg = $('#scan-dlg');
  if (!dlg) return Promise.resolve(null);
  schliessen(null);
  dlg.innerHTML = scannerHTML(titel);
  return new Promise((ok) => {
    const l = { ok, stream: null, track: null, timer: null, licht: false, leser: 'BarcodeDetector' in window, dateiWahl: false };
    lauf = l;
    dlg.querySelector('[data-scan="zu"]').addEventListener('click', () => schliessen(null));
    dlg.querySelector('[data-scan="licht"]').addEventListener('click', lichtUmschalten);
    dlg.querySelector('[data-scan="ausloesen"]').addEventListener('click', ausloesen);
    // Mit der Kamera-App: die eigene Kamera aus, damit die andere sie bekommt
    dlg.querySelector('.scan-app').addEventListener('click', () => { if (lauf === l) { l.dateiWahl = true; kameraAus(l); } });
    const datei = dlg.querySelector('#scan-datei');
    datei.addEventListener('change', () => {
      const f = datei.files?.[0];
      datei.value = '';
      if (f && lauf === l) schliessen({ datei: f });
    });
    dlg.oncancel = (ev) => { ev.preventDefault(); schliessen(null); };
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    kameraStarten(l);
  });
}

// Im Hintergrund die Kamera aus – zurück wieder an. Kommt man aus der Kamera-App ohne Foto zurück, auch.
document.addEventListener('visibilitychange', () => {
  const l = lauf;
  if (!l) return;
  if (document.visibilityState === 'hidden') { kameraAus(l); return; }
  if (!l.dateiWahl) { if (!l.stream) kameraStarten(l); return; }
  setTimeout(() => { if (lauf === l && l.dateiWahl) { l.dateiWahl = false; kameraStarten(l); } }, 1500);
});
