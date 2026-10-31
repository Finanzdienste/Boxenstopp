/*
 * Kochmodus: ein Schritt nach dem anderen, groß – für das Tablet oder Handy
 * neben dem Herd. Der Bildschirm bleibt an (Wake Lock, auf dem iPad ab
 * iPadOS 18.4 auch in der App vom Home-Bildschirm), die Timer laufen oben mit.
 *
 *   „Erledigt ✓“  hakt den Schritt ab (wie in der Liste: Tempo und Lob
 *                 laufen mit) und springt zum nächsten offenen
 *   „‹ Zurück“    blättert zurück, „Weiter ›“ vor
 *   Wischen       nach links wie „Erledigt“/„Weiter“, nach rechts zurück
 *   Tasten        → Leertaste Enter vor, ← zurück, Esc beendet
 *
 * Für feste Rezepte und Amys gleich: Wer ihn öffnet, gibt Text, Minuten und
 * das Abhaken mit (ansicht-rezepte.js, ansicht-amy.js). Die Haken sind
 * dieselben wie in der Liste (kochstand.js) – auch auf dem anderen Gerät.
 */
import { $ } from './kern.js';
import { esc } from './format.js';
import { schritteVon } from './kochstand.js';
import { alleTimer, timerText, timerStoppen } from './timer.js';

let km = null; // { x, i, text, minuten, umschalten, timerKnopf, timerUmschalten, beimSchliessen, sperre, wischX }

const ZU = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const LINKS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const RECHTS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const HAKEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
export const KOCHMODUS_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/></svg>';

const alle = (x) => (x?.ablauf || []).flatMap((p, pi) => p.schritte.map((s) => ({ s, pi, t: p.t })));
export const kochmodusOffen = () => !!km;

/** Wach bleiben, solange der Kochmodus offen ist – geht es nicht, sagt es der Kopf. */
async function wachHalten() {
  if (!km || document.visibilityState !== 'visible') return;
  try {
    if (!km.sperre && navigator.wakeLock?.request) {
      km.sperre = await navigator.wakeLock.request('screen');
      km.sperre.addEventListener?.('release', () => { if (km) { km.sperre = null; wachZeichnen(); } });
    }
  } catch { if (km) km.sperre = null; }
  wachZeichnen();
}
function wachZeichnen() {
  const el = $('#km-wach');
  if (!el || !km) return;
  el.textContent = km.sperre ? 'Bildschirm bleibt an' : 'wakeLock' in navigator ? 'Bildschirm geht vielleicht aus' : 'Bildschirm geht hier aus – in den Einstellungen die Sperre länger stellen';
  el.classList.toggle('an', !!km.sperre);
}
const beimZurueckkommen = () => { if (km && document.visibilityState === 'visible') wachHalten(); };

/** Die Timer oben im Kochmodus: die dieses Rezepts zum Antippen (springt zum Schritt). */
function timerHTML() {
  const t = alleTimer();
  if (!t.length) return '';
  return t.map((x) => {
    const hier = x.rid === km.x.id;
    return `<span class="km-tm${x.fertig ? ' fertig' : ''}">${hier ? `<button type="button" class="km-tm-zu" data-km-zu="${x.schritt}">` : '<span class="km-tm-zu">'}<b>${timerText(x)}</b> ${esc(x.label || `${x.minuten} Min.`)}${hier ? '</button>' : '</span>'}<button type="button" class="km-tm-x" data-km-stopp="${esc(x.id)}" aria-label="Timer beenden">${ZU}</button></span>`;
  }).join('');
}

function zeichnen() {
  const dlg = $('#km-inhalt');
  if (!dlg || !km) return;
  // Der Fokus bleibt beim Knopf, den man zuletzt benutzt hat (sonst fiele er nach dem Neuzeichnen heraus)
  const hatte = dlg.contains(document.activeElement) ? document.activeElement.dataset?.km : null;
  const liste = alle(km.x);
  const n = liste.length;
  km.i = Math.max(0, Math.min(n - 1, km.i));
  const { s, t } = liste[km.i] || {};
  const fertig = schritteVon(km.x.id);
  const istFertig = fertig.has(km.i);
  const min = km.minuten?.(km.i);
  const timer = s ? km.timerKnopf(km.x.id, s, km.i) : '';
  const offenNoch = liste.filter((_, k) => !fertig.has(k)).length;
  dlg.innerHTML = `<div class="km" data-km-flaeche>
<header class="km-kopf">
<div class="km-titel"><b>${esc(km.x.name)}</b><span>${liste.length > 1 && km.x.ablauf.length > 1 ? `${esc(t || '')} · ` : ''}Schritt ${km.i + 1} von ${n}</span></div>
<span class="km-wach" id="km-wach"></span>
<button type="button" class="km-zu" data-km="zu" aria-label="Kochmodus beenden">${ZU}</button>
</header>
<div class="km-fortschritt" role="progressbar" aria-label="Abgehakt" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${n - offenNoch}"><i style="width:${n ? ((n - offenNoch) / n) * 100 : 0}%"></i></div>
<div class="km-timer" id="km-timer">${timerHTML()}</div>
<section class="km-schritt${istFertig ? ' is-fertig' : ''}" aria-live="polite">
${s?.neben ? '<span class="km-k">währenddessen</span>' : ''}${s?.entfaellt ? '<span class="km-k">entfällt – Zutat weggelassen</span>' : ''}
<p class="km-text">${s ? km.text(s, km.i) : ''}</p>
${s?.liste?.length ? `<ul class="km-liste">${s.liste.map((z) => `<li>${km.text({ d: z }, km.i)}</li>`).join('')}</ul>` : ''}
<div class="km-unten">${min ? `<span class="km-min">ca. ${min} Min.</span>` : ''}${timer ? `<span class="km-timerknopf" id="km-timerknopf">${timer.replace('data-timer=', 'data-km-timer=')}</span>` : ''}${istFertig ? `<span class="km-ok">${HAKEN}abgehakt</span>` : ''}</div>
</section>
<nav class="km-nav">
<button type="button" class="km-zurueck" data-km="zurueck"${km.i === 0 ? ' disabled' : ''}>${LINKS}Zurück</button>
${istFertig
    ? `<button type="button" class="km-los" data-km="weiter"${km.i >= n - 1 ? ' disabled' : ''}>Weiter${RECHTS}</button>`
    : `<button type="button" class="km-los" data-km="erledigt">${HAKEN}Erledigt</button>`}
</nav>
<ol class="km-punkte" aria-label="Alle Schritte">${liste.map((_, k) => `<li><button type="button" class="${fertig.has(k) ? 'f' : ''}${k === km.i ? ' jetzt' : ''}" data-km-zu="${k}" aria-label="Schritt ${k + 1}${fertig.has(k) ? ', abgehakt' : ''}"${k === km.i ? ' aria-current="step"' : ''}></button></li>`).join('')}</ol>
</div>`;
  wachZeichnen();
  const ziel = (hatte && dlg.querySelector(`[data-km="${hatte}"]:not([disabled])`)) || dlg.querySelector('.km-los:not([disabled])') || dlg.querySelector('.km-zu');
  ziel?.focus({ preventScroll: true });
}

/** Jede halbe Sekunde (timer.js über app.js): nur die Timer nachzeichnen. */
export function kochmodusTimerZeichnen() {
  if (!km) return;
  const el = $('#km-timer');
  if (el) { const h = timerHTML(); if (el.innerHTML !== h) el.innerHTML = h; }
  const k = $('#km-timerknopf');
  const s = alle(km.x)[km.i]?.s;
  if (k && s) { const h = km.timerKnopf(km.x.id, s, km.i).replace('data-timer=', 'data-km-timer='); if (k.innerHTML !== h) k.innerHTML = h; }
}

/**
 * Öffnen. o = { rezept, text(s, i) → HTML, minuten(i) → Zahl, umschalten(i, an),
 * timerKnopf, timerUmschalten (ansicht-rezepte.js), beimSchliessen }.
 * Ohne start beginnt er beim ersten offenen Schritt.
 */
export function kochmodusOeffnen(o) {
  const dlg = $('#kochmodus');
  if (!dlg || !o?.rezept?.ablauf?.length) return;
  const liste = alle(o.rezept);
  const fertig = schritteVon(o.rezept.id);
  const erster = liste.findIndex((_, k) => !fertig.has(k));
  km = { ...o, x: o.rezept, i: Number.isInteger(o.start) ? o.start : Math.max(0, erster), sperre: null, wischX: null };
  dlg.innerHTML = '<div class="km-rahmen" id="km-inhalt"></div>';
  // Die Meldung unten muss mit in den Kochmodus (er liegt über allem)
  const toast = $('#toast');
  if (toast) dlg.append(toast);
  zeichnen();
  document.documentElement.classList.add('km-offen');
  if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  dlg.querySelector('.km-los')?.focus();
  wachHalten();
  document.addEventListener('visibilitychange', beimZurueckkommen);
}

export function kochmodusZu() {
  const dlg = $('#kochmodus');
  if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  aufraeumen();
}

function aufraeumen() {
  if (!km) return;
  const x = km;
  km = null;
  x.sperre?.release?.().catch(() => {});
  document.removeEventListener('visibilitychange', beimZurueckkommen);
  document.documentElement.classList.remove('km-offen');
  const toast = $('#kochmodus #toast');
  if (toast) $('#app')?.append(toast);
  x.beimSchliessen?.();
}

/** Den aktuellen Schritt abhaken und zum nächsten offenen. */
function erledigt() {
  const liste = alle(km.x);
  const fertig = schritteVon(km.x.id);
  const i = km.i;
  const letzter = liste.every((_, k) => k === i || fertig.has(k));
  const umschalten = km.umschalten;
  // Der letzte Haken: erst zu, dann gibt es das Tier (das Lob liegt sonst hinter dem Kochmodus)
  if (letzter) { kochmodusZu(); umschalten(i, true); return; }
  umschalten(i, true);
  const naechster = liste.findIndex((_, k) => k > i && !schritteVon(km.x.id).has(k));
  km.i = naechster >= 0 ? naechster : Math.min(liste.length - 1, i + 1);
  zeichnen();
}

/** Klicks im Kochmodus. true, wenn es hierher gehörte. */
export function klickKochmodus(el) {
  if (!km || !el.closest('#kochmodus')) return false;
  const d = el.dataset;
  if (d.kmZu !== undefined) { km.i = Number(d.kmZu); zeichnen(); return true; }
  if (d.kmStopp) { timerStoppen(d.kmStopp); kochmodusTimerZeichnen(); return true; }
  if (d.kmTimer !== undefined) {
    const s = alle(km.x)[km.i]?.s;
    if (s) { km.timerUmschalten(km.x, s, km.i); kochmodusTimerZeichnen(); }
    return true;
  }
  switch (d.km) {
    case 'zu': kochmodusZu(); return true;
    case 'zurueck': km.i -= 1; zeichnen(); return true;
    case 'weiter': km.i += 1; zeichnen(); return true;
    case 'erledigt': erledigt(); return true;
    default: return true;
  }
}

/** Tasten: → Leertaste Enter vor, ← zurück. true, wenn es hierher gehörte. */
export function tasteKochmodus(ev) {
  // Solange er offen ist, gehört die Tastatur ihm (er liegt über allem)
  if (!km) return false;
  if (ev.key === 'ArrowLeft') { if (km.i > 0) { km.i -= 1; zeichnen(); } return true; }
  if (ev.key === 'ArrowRight' || ((ev.key === ' ' || ev.key === 'Enter') && !ev.target?.matches?.('button'))) {
    if (schritteVon(km.x.id).has(km.i)) { if (km.i < alle(km.x).length - 1) { km.i += 1; zeichnen(); } } else erledigt();
    return true;
  }
  return false;
}

/** Wischen: von app.js (touchstart/touchend). */
export function wischStart(ev) {
  if (!km || !ev.target?.closest?.('#kochmodus [data-km-flaeche]')) return;
  const t = ev.changedTouches?.[0];
  km.wischX = t ? { x: t.clientX, y: t.clientY } : null;
}
export function wischEnde(ev) {
  if (!km?.wischX) return;
  const t = ev.changedTouches?.[0];
  const start = km.wischX;
  km.wischX = null;
  if (!t) return;
  const dx = t.clientX - start.x;
  const dy = t.clientY - start.y;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (dx > 0) { if (km.i > 0) { km.i -= 1; zeichnen(); } return; }
  if (schritteVon(km.x.id).has(km.i)) { if (km.i < alle(km.x).length - 1) { km.i += 1; zeichnen(); } } else erledigt();
}

/** Von außen (Haken auf dem anderen Gerät, Liste neu): neu zeichnen, wenn offen. */
export function kochmodusNeu() { if (km) zeichnen(); }

/**
 * Esc und das Schließen über den Browser: aufräumen. „cancel“ kommt bei Esc
 * sofort, „close“ erst einen Moment später – das Erste räumt auf.
 */
export function kochmodusAnmelden() {
  const dlg = $('#kochmodus');
  dlg?.addEventListener('cancel', aufraeumen);
  dlg?.addEventListener('close', aufraeumen);
}
