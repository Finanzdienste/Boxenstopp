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
 *
 * Mit der Waage (waage.js, wiegen.js): Wer ihn öffnet, kann wiegen(i) mitgeben
 * – welcher Schritt gewogen wird. Dann steht unter dem Text die Zutat mit
 * Bild, Ist und Ziel in Gramm, ein Balken, „Tara“ und „Nehmen wir so“; passt
 * die Menge, hakt sich der Schritt von selbst ab (mit einem Piep) und es geht
 * weiter. Beim Portionieren: Topf leer und voll übernehmen, dann Box für Box.
 * Ist die Waage aus, steht das klein da, und der Schritt bleibt wie immer von
 * Hand abhakbar.
 */
import { $ } from './kern.js';
import { esc, nfi } from './format.js';
import { schritteVon } from './kochstand.js';
import { alleTimer, timerText, timerStoppen } from './timer.js';
import { waageStand, waageBeobachten } from './waage.js';
import { Wiegung } from './wiegen.js';
import { bildPfad } from './bilder.js';

let km = null; // { x, i, text, minuten, umschalten, timerKnopf, timerUmschalten, beimSchliessen, sperre, wischX, wiegen, topf, gewogen, w, wSchritt, abmelden, audio }

const ZU = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const LINKS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const RECHTS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const HAKEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
export const KOCHMODUS_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/></svg>';

const alle = (x) => (x?.ablauf || []).flatMap((p, pi) => p.schritte.map((s) => ({ s, pi, t: p.t })));
export const kochmodusOffen = () => !!km;
/** Was abgehakt ist – beim Kochmodus für zwei Rezepte sagt das, wer ihn geöffnet hat (fertig). */
const fertigVon = () => (km?.fertig ? km.fertig() : schritteVon(km.x.id));

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
    // Zwei Rezepte auf einmal: timerZu sagt, welcher Schritt hier zu einem Timer gehört
    const zu = km.timerZu ? km.timerZu(x) : x.rid === km.x.id ? x.schritt : -1;
    const hier = zu >= 0;
    return `<span class="km-tm${x.fertig ? ' fertig' : ''}">${hier ? `<button type="button" class="km-tm-zu" data-km-zu="${zu}">` : '<span class="km-tm-zu">'}<b>${timerText(x)}</b> ${esc(x.label || `${x.minuten} Min.`)}${hier ? '</button>' : '</span>'}<button type="button" class="km-tm-x" data-km-stopp="${esc(x.id)}" aria-label="Timer beenden">${ZU}</button></span>`;
  }).join('');
}

/* ----------------------------------------------------------------- Waage */

const WAAGE_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16M6 20V9.5a2.5 2.5 0 0 1 2.5-2.5h7A2.5 2.5 0 0 1 18 9.5V20"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7M9 13.5h6"/></svg>';
const gramm = (x) => `${nfi(x)} g`;

/** Der Plan des aktuellen Schritts – null, wenn die Waage hier nichts zu tun hat oder nicht eingerichtet ist. */
function wiegePlan() {
  if (!km?.wiegen || !waageStand().eingerichtet) return null;
  try { return km.wiegen(km.i) || null; } catch { return null; }
}

/** Zu jedem Schritt eine frische Wiegung; dieselbe, solange man auf dem Schritt bleibt. */
function wiegungFuer(plan) {
  if (!plan) { km.w = null; km.wSchritt = -1; return null; }
  if (km.w && km.wSchritt === km.i) return km.w;
  const t = km.topf?.() || {};
  const n = plan.n || t.n || 8;
  const proBox = Number.isFinite(t.leer) && Number.isFinite(t.voll) && t.voll > t.leer ? (t.voll - t.leer) / n : null;
  km.w = new Wiegung(plan, { proBox, leer: t.leer, n });
  km.wSchritt = km.i;
  km.wFertig = false;
  km.wBoxen = 0;
  const s = waageStand();
  if (s.g !== null && s.da) km.w.lesen({ g: s.g, at: s.at });
  return km.w;
}

function waageHTML(plan, w) {
  const s = waageStand();
  const st = w?.stand;
  if (!s.da) return `<div class="km-waage is-aus">${WAAGE_IC}<span>${s.verbunden ? 'Waage aus – oder nicht im WLAN. Von Hand abhaken geht wie immer.' : s.fehler || 'Waage: verbinde …'}</span></div>`;
  if (!st) return '';
  const bild = (name) => `<img class="km-wg-bild" src="${bildPfad(name)}" alt="" width="96" height="96" decoding="async">`;
  if (plan.art === 'zutat') {
    const klasse = st.fertig ? ' is-fertig' : st.zuViel ? ' is-viel' : st.ist >= st.von && st.ist <= st.bis ? ' is-ok' : '';
    let hinweis;
    if (st.fertig) hinweis = `${HAKEN}${gramm(st.angenommen ?? st.ist)} – passt`;
    else if (st.frage) hinweis = 'Gerade die Schale draufgestellt? Dann „Tara“';
    else if (st.hinweis) hinweis = st.hinweis;
    else if (st.zuViel) hinweis = `+${gramm(st.zuViel)} zu viel – etwas raus, oder „Nehmen wir so“`;
    else if (st.ist >= st.von) hinweis = 'passt – einen Moment still halten';
    else if (!st.tara) hinweis = 'Waage pendelt sich ein …';
    else hinweis = `noch ${gramm(st.fehlt)}`;
    return `<div class="km-waage${klasse}" data-art="zutat">${bild(plan.bild)}
<div class="km-wg-mitte"><span class="km-wg-name">${esc(plan.name)}${plan.schale ? ` <small>→ Schale ${plan.schale}</small>` : ''}</span>
<span class="km-wg-g"><b>${nfi(st.ist)}</b> / ${plan.ca ? 'ca. ' : ''}${gramm(plan.ziel)}</span>
<div class="km-wg-balken" role="progressbar" aria-valuemin="0" aria-valuemax="${plan.ziel}" aria-valuenow="${st.ist}"><i style="width:${(st.anteil * 100).toFixed(1)}%"></i></div>
<span class="km-wg-hinweis">${hinweis}</span></div>
<div class="km-wg-knoepfe"><button type="button" class="km-wg-btn" data-km="tara">Tara</button>${!st.fertig && st.ist > 0 ? '<button type="button" class="km-wg-btn km-wg-so" data-km="so">Nehmen wir so</button>' : ''}</div></div>`;
  }
  if (plan.art === 'leer' || plan.art === 'voll') {
    const was = plan.art === 'leer' ? 'Den leeren Topf auf die Waage' : 'Den Topf mit dem Essen auf die Waage';
    return `<div class="km-waage${st.bereit ? ' is-ok' : ''}" data-art="${plan.art}">${bild('pot-of-food')}
<div class="km-wg-mitte"><span class="km-wg-name">${plan.art === 'leer' ? 'Gefäß leer' : 'Mit Essen'}</span>
<span class="km-wg-g"><b>${nfi(st.ist)}</b> g</span>
<span class="km-wg-hinweis">${st.bereit ? 'steht – übernehmen?' : was}</span></div>
<div class="km-wg-knoepfe"><button type="button" class="km-wg-btn km-wg-so" data-km="uebernehmen"${st.bereit ? '' : ' disabled'}>Übernehmen</button></div></div>`;
  }
  if (plan.art === 'boxen') {
    if (!st.proBox) return `<div class="km-waage is-aus">${WAAGE_IC}<span>Erst den Topf leer und mit dem Essen wiegen (die Schritte davor) – dann zählt die Waage Box für Box.</span></div>`;
    const laeuft = st.modus !== null && st.warten === null && !st.fertig;
    const klasse = st.fertig ? ' is-fertig' : st.zuViel ? ' is-viel' : laeuft && st.ist >= st.von && st.ist <= st.bis ? ' is-ok' : '';
    let hinweis;
    if (st.fertig) hinweis = `${HAKEN}alle ${st.n} Boxen voll`;
    else if (st.modus === null) hinweis = 'Den Topf auf die Waage (die Boxen daneben füllen) – oder eine leere Box drauf';
    else if (st.warten === 'box') hinweis = 'Die nächste leere Box auf die Waage';
    else if (st.warten === 'weg') hinweis = 'Box runter – dann die nächste drauf';
    else if (st.zuViel) hinweis = `+${gramm(st.zuViel)} zu viel – etwas zurück, oder „Nehmen wir so“`;
    else if (st.ist >= st.von) hinweis = 'passt – einen Moment still halten';
    else hinweis = `noch ${gramm(st.fehlt)}${st.box === st.n && st.modus === 'topf' ? ' – die letzte Box bekommt den Rest' : ''}`;
    const liste = st.boxen.length ? `<span class="km-wg-boxen">${st.boxen.map((x, k) => `<span>${k + 1}: ${gramm(x)}</span>`).join('')}</span>` : '';
    return `<div class="km-waage${klasse}" data-art="boxen">${bild('bento-box')}
<div class="km-wg-mitte"><span class="km-wg-name">Box ${st.box} von ${st.n}${st.modus ? ` <small>${st.modus === 'topf' ? 'Topf auf der Waage' : 'Box auf der Waage'}</small>` : ''}</span>
<span class="km-wg-g"><b>${nfi(laeuft || st.fertig ? st.ist : 0)}</b> / ${gramm(st.proBox)}</span>
<div class="km-wg-balken" role="progressbar" aria-valuemin="0" aria-valuemax="${st.proBox}" aria-valuenow="${st.ist}"><i style="width:${(st.anteil * 100).toFixed(1)}%"></i></div>
<span class="km-wg-hinweis">${hinweis}</span>${liste}</div>
<div class="km-wg-knoepfe">${laeuft && st.ist > 0 ? '<button type="button" class="km-wg-btn km-wg-so" data-km="so">Nehmen wir so</button>' : ''}</div></div>`;
  }
  return `<div class="km-waage" data-art="anzeige">${WAAGE_IC}
<div class="km-wg-mitte"><span class="km-wg-g"><b>${nfi(st.ist)}</b> g${plan.n > 1 ? ` <small>÷ ${plan.n} = ${gramm(st.proBox)} pro Box</small>` : ''}</span></div></div>`;
}

/**
 * Der Ton fürs Passen: Safari auf dem iPad lässt Audio nur zu, was mit einem
 * Tipp angefangen hat – darum entsteht der AudioContext beim Öffnen des
 * Kochmodus (ein Klick) und spielt gleich einen stummen Moment.
 */
function audioAn() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || km.audio) return;
    const ac = new AC();
    km.audio = ac;
    const o = ac.createOscillator();
    const v = ac.createGain();
    v.gain.value = 0.0001;
    o.connect(v).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.05);
  } catch { km.audio = null; }
}

/** Ein kurzer Piep, wenn es passt (zwei beim Portionieren). */
function piep(doppelt = false) {
  try {
    if (!km.audio) audioAn();
    const ac = km.audio;
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    const ton = (ab, f) => {
      const o = ac.createOscillator();
      const v = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      v.gain.setValueAtTime(0.0001, ac.currentTime + ab);
      v.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + ab + 0.01);
      v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ab + 0.16);
      o.connect(v).connect(ac.destination);
      o.start(ac.currentTime + ab);
      o.stop(ac.currentTime + ab + 0.18);
    };
    ton(0, 880);
    if (doppelt) ton(0.2, 1175);
  } catch { /* dann eben still */ }
  try { navigator.vibrate?.(doppelt ? [60, 60, 60] : 60); } catch { /* egal */ }
}

/** Nur das Waagen-Stück neu zeichnen – bei jedem Wert der Waage. */
function waageZeichnen() {
  if (!km) return;
  const el = $('#km-waage');
  if (!el) return;
  const plan = wiegePlan();
  const h = plan ? waageHTML(plan, wiegungFuer(plan)) : '';
  if (el.innerHTML !== h) el.innerHTML = h;
}

/** Ein Wert von der Waage: in die Wiegung des Schritts, fertig → abhaken und weiter. */
function waageWert(s) {
  if (!km) return;
  const plan = wiegePlan();
  const w = plan ? wiegungFuer(plan) : null;
  if (w && s.da && s.g !== null) {
    const st = w.lesen({ g: s.g, at: s.at });
    if (st.fertig && !km.wFertig) {
      km.wFertig = true;
      if (plan.art === 'zutat') km.gewogen?.(km.i, plan, { k: plan.k, name: plan.name, g: st.angenommen ?? st.ist, ziel: plan.ziel });
      if (plan.art === 'boxen') km.gewogen?.(km.i, plan, { boxen: st.boxen });
      piep(plan.art === 'boxen');
      waageZeichnen();
      if (!fertigVon().has(km.i)) setTimeout(() => { if (km && km.wSchritt === km.i) erledigt(); }, 700);
      return;
    }
    if (plan.art === 'boxen' && st.boxen.length > (km.wBoxen || 0)) { km.wBoxen = st.boxen.length; if (!st.fertig) piep(); }
  }
  waageZeichnen();
}

/** Tara, „Nehmen wir so“, Übernehmen – die Knöpfe im Waagen-Stück. */
function waageKlick(was) {
  const plan = wiegePlan();
  const w = plan ? wiegungFuer(plan) : null;
  if (!w) return;
  if (was === 'tara') { w.tara(); waageZeichnen(); return; }
  if (was === 'so') {
    const g0 = w.so();
    const st = w.stand;
    if (plan.art === 'zutat') { km.wFertig = true; km.gewogen?.(km.i, plan, { k: plan.k, name: plan.name, g: g0, ziel: plan.ziel }); waageZeichnen(); if (!fertigVon().has(km.i)) erledigt(); return; }
    if (plan.art === 'boxen') {
      km.wBoxen = st.boxen.length;
      if (st.fertig) { km.wFertig = true; km.gewogen?.(km.i, plan, { boxen: st.boxen }); piep(true); waageZeichnen(); if (!fertigVon().has(km.i)) erledigt(); } else waageZeichnen();
    }
    return;
  }
  if (was === 'uebernehmen' && (plan.art === 'leer' || plan.art === 'voll') && w.stand.bereit) {
    km.wFertig = true;
    km.gewogen?.(km.i, plan, { [plan.art]: w.stand.ist });
    piep();
    if (!fertigVon().has(km.i)) erledigt(); else waageZeichnen();
  }
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
  const fertig = fertigVon();
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
${km.marke ? `<p class="km-marke">${km.marke(km.i)}</p>` : ''}${s?.neben ? '<span class="km-k">währenddessen</span>' : ''}${s?.entfaellt ? '<span class="km-k">entfällt – Zutat weggelassen</span>' : ''}
<p class="km-text">${s ? km.text(s, km.i) : ''}</p>
${s?.liste?.length ? `<ul class="km-liste">${s.liste.map((z) => `<li>${km.text({ d: z }, km.i)}</li>`).join('')}</ul>` : ''}
${(() => { const h = km.hinweis?.(km.i); return h ? `<p class="km-hinweis">${h}</p>` : ''; })()}
<div class="km-waage-platz" id="km-waage">${(() => { const plan = wiegePlan(); return plan ? waageHTML(plan, wiegungFuer(plan)) : ''; })()}</div>
<div class="km-unten">${min ? `<span class="km-min">ca. ${min} Min.</span>` : ''}${timer ? `<span class="km-timerknopf" id="km-timerknopf">${timer.replace('data-timer=', 'data-km-timer=')}</span>` : ''}${istFertig ? `<span class="km-ok">${HAKEN}abgehakt</span>` : ''}</div>
</section>
<nav class="km-nav">
<button type="button" class="km-zurueck" data-km="zurueck"${km.i === 0 ? ' disabled' : ''}>${LINKS}Zurück</button>
${istFertig
    ? `<button type="button" class="km-los" data-km="weiter"${km.i >= n - 1 ? ' disabled' : ''}>Weiter${RECHTS}</button>`
    : `<button type="button" class="km-los" data-km="erledigt">${HAKEN}Erledigt</button>`}
</nav>
<ol class="km-punkte" aria-label="Alle Schritte">${liste.map((_, k) => `<li><button type="button" class="${fertig.has(k) ? 'f' : ''}${k === km.i ? ' jetzt' : ''}${km.punkt ? ` ${km.punkt(k)}` : ''}" data-km-zu="${k}" aria-label="Schritt ${k + 1}${fertig.has(k) ? ', abgehakt' : ''}"${k === km.i ? ' aria-current="step"' : ''}></button></li>`).join('')}</ol>
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
 * timerKnopf, timerUmschalten (ansicht-rezepte.js), beimSchliessen,
 * wiegen(i) → Plan aus wiegen.js oder null (nur mit Waage), topf() → { leer,
 * voll, n } aus dem Portionsrechner, gewogen(i, plan, ergebnis) – was die
 * Waage gemessen hat }. Ohne start beginnt er beim ersten offenen Schritt.
 * Für zwei Rezepte auf einmal (ansicht-doppel.js) außerdem: fertig() → Set
 * der abgehakten Schritte, marke(i) → HTML über dem Text (welches Rezept),
 * hinweis(i) → HTML darunter, timerZu(timer) → Schritt oder -1, punkt(i) →
 * Klasse für den Punkt des Schritts unten (die Farbe des Rezepts).
 */
export function kochmodusOeffnen(o) {
  const dlg = $('#kochmodus');
  if (!dlg || !o?.rezept?.ablauf?.length) return;
  const liste = alle(o.rezept);
  const fertig = o.fertig ? o.fertig() : schritteVon(o.rezept.id);
  const erster = liste.findIndex((_, k) => !fertig.has(k));
  km = { ...o, x: o.rezept, i: Number.isInteger(o.start) ? o.start : Math.max(0, erster), sperre: null, wischX: null, w: null, wSchritt: -1, wFertig: false, wBoxen: 0, abmelden: null, audio: null };
  if (o.wiegen) { km.abmelden = waageBeobachten(waageWert); if (waageStand().eingerichtet) audioAn(); }
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
  x.abmelden?.();
  x.audio?.close?.().catch?.(() => {});
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
  const fertig = fertigVon();
  const i = km.i;
  const letzter = liste.every((_, k) => k === i || fertig.has(k));
  const umschalten = km.umschalten;
  // Der letzte Haken: erst zu, dann gibt es das Tier (das Lob liegt sonst hinter dem Kochmodus)
  if (letzter) { kochmodusZu(); umschalten(i, true); return; }
  umschalten(i, true);
  const jetzt = fertigVon();
  const naechster = liste.findIndex((_, k) => k > i && !jetzt.has(k));
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
    case 'tara': case 'so': case 'uebernehmen': waageKlick(d.km); return true;
    default: return true;
  }
}

/** Tasten: → Leertaste Enter vor, ← zurück. true, wenn es hierher gehörte. */
export function tasteKochmodus(ev) {
  // Solange er offen ist, gehört die Tastatur ihm (er liegt über allem)
  if (!km) return false;
  if (ev.key === 'ArrowLeft') { if (km.i > 0) { km.i -= 1; zeichnen(); } return true; }
  if (ev.key === 'ArrowRight' || ((ev.key === ' ' || ev.key === 'Enter') && !ev.target?.matches?.('button'))) {
    if (fertigVon().has(km.i)) { if (km.i < alle(km.x).length - 1) { km.i += 1; zeichnen(); } } else erledigt();
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
  if (fertigVon().has(km.i)) { if (km.i < alle(km.x).length - 1) { km.i += 1; zeichnen(); } } else erledigt();
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
