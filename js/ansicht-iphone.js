/*
 * iPhone und iPad: Ein Link öffnet dort immer Safari – die App vom
 * Home-Bildschirm hat aber ihren eigenen Speicher, und Apple lässt keinen Link
 * hinein. Ganz von selbst geht es darum nicht, aber fast:
 *
 *   In Safari   Der Link verbindet Safari gleich (app.js, ein Link mit Namen).
 *               Danach dieses Popup: „Jetzt noch deine App“ – ein Tipp kopiert
 *               den Link mit deinem Namen, dann die App öffnen.
 *   In der App  vom Home-Bildschirm, noch nicht verbunden: Beim Öffnen fragt
 *               sie gleich nach dem Link – „Einfügen“, und sie ist verbunden.
 *
 * Android braucht das nicht: Chrome und die installierte App teilen sich den
 * Speicher, dort reicht der Tipp auf den Link.
 */
import { app, $, lese, schreibe } from './kern.js';
import { esc } from './format.js';
import { linkFuerGeraet, istEigen } from './profil.js';
import { einfuegenAusZwischenablage } from './ansicht-liste.js';
import { TEILEN } from './ansicht-tablet.js';

/** Wann „Später“ getippt wurde – einen Tag lang fragt die App dann nicht noch einmal. */
const SPAETER = 'boxenstopp.einfuegen-spaeter.v1';
const TAG = 24 * 60 * 60 * 1000;

const istIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const vomHomeBildschirm = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

const KREUZ = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const HANDY = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>';
const KLAMMER = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="4.5" width="13" height="17" rx="2.5"/><path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7"/><path d="M9 11.5h6M9 15.5h4"/></svg>';

let vorgemerkt = false;
let art = ''; // 'safari' oder 'einfuegen' – was das Popup gerade zeigt

function oeffnen(html) {
  const dlg = $('#ios-dlg');
  if (!dlg) return null;
  // In Amys Farbe, wenn sie es ist – noch ohne Liste neutral
  dlg.classList.toggle('amy-thema', /^amy$/i.test(String(app.name() || '').trim()));
  dlg.innerHTML = html;
  if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  return dlg;
}

function zu() {
  const dlg = $('#ios-dlg');
  if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  art = '';
}

/* ---------------------------------------------- In Safari, nach dem Link */

/**
 * Beim Start: Ein Link wurde in Safari auf dem iPhone oder iPad geöffnet.
 * Dann wartet das iPad-Popup (tabletPruefen) – hier kommt gleich, was die
 * App auf dem Home-Bildschirm noch braucht. true, wenn vorgemerkt.
 */
export function safariVormerken() {
  vorgemerkt = istIos() && !vomHomeBildschirm();
  app.safariHinweis = vorgemerkt;
  return vorgemerkt;
}

function safariHTML() {
  return `<button type="button" class="tablet-zu" data-act="ios-zu" aria-label="Schließen">${KREUZ}</button>
<p class="push-dlg-ic" aria-hidden="true">${HANDY}</p>
<h2 class="push-dlg-titel" id="ios-titel">Jetzt noch deine App</h2>
<p class="tablet-lead">Hier in Safari bist du verbunden ✓ Die App auf deinem Home-Bildschirm hat aber ihren eigenen Speicher – Apple lässt keinen Link hinein. Darum bekommt sie ihn einmal so:</p>
<ol class="tablet-schritte">
<li><b>Link kopieren</b><span><button type="button" class="btn btn-primary tablet-kopieren" data-act="ios-link">Link kopieren</button></span>
<input class="z-linkfeld" id="ios-linkfeld" type="text" readonly aria-label="Dein Link" hidden></li>
<li><b>Boxenstopp vom Home-Bildschirm öffnen</b><small>Noch nicht da? Hier auf ${TEILEN} <i>Teilen</i> → „Zum Home-Bildschirm“ → „Hinzufügen“.</small></li>
<li><b>Dort auf „Einfügen“ tippen</b><small>Die App fragt beim Öffnen von selbst danach – dann ist sie verbunden, ohne Namen tippen ♡</small></li>
</ol>
<div class="tablet-knoepfe"><button type="button" class="btn btn-quiet" data-act="ios-zu">Schließen</button></div>`;
}

/** Nach dem Verbinden über einen Link in Safari (gemeinsame Liste): das Popup. Eine eigene Liste erklärt das Willkommen. */
export function safariHinweis() {
  if (!vorgemerkt || !app.zugang || istEigen()) return;
  vorgemerkt = false;
  const andere = document.querySelector('dialog[open]:not(#ios-dlg)');
  if (andere) return;
  art = 'safari';
  oeffnen(safariHTML())?.querySelector('[data-act="ios-link"]')?.focus();
}

/* ------------------------------- In der App vom Home-Bildschirm, ohne Liste */

function einfuegenHTML(meldung = '') {
  return `<button type="button" class="tablet-zu" data-act="ios-spaeter" aria-label="Später">${KREUZ}</button>
<p class="push-dlg-ic" aria-hidden="true">${KLAMMER}</p>
<h2 class="push-dlg-titel" id="ios-titel">Mit der Liste verbinden</h2>
<p class="tablet-lead">Die App auf dem Home-Bildschirm hat ihren eigenen Speicher und braucht den Link einmal: kopieren – etwa in WhatsApp lange auf den Link drücken → „Kopieren“ – und hier auf „Einfügen“ tippen.</p>
${meldung ? `<p class="zugang-fehler" role="alert">${esc(meldung)}</p>` : ''}
<div class="tablet-knoepfe"><button type="button" class="btn btn-primary" data-act="ios-einfuegen">Einfügen</button><button type="button" class="btn btn-quiet" data-act="ios-spaeter">Später</button></div>
<p class="tablet-fein">Ohne Link: unter Einstellungen → Gemeinsame Liste einrichten.</p>`;
}

/** Beim Start: App vom Home-Bildschirm auf iPhone/iPad, noch nicht verbunden – gleich nach dem Link fragen. */
export function einfuegenPruefen() {
  if (app.zugang || !istIos() || !vomHomeBildschirm() || !navigator.clipboard?.readText) return;
  const spaeter = Number(lese(SPAETER, 0)) || 0;
  if (Date.now() - spaeter < TAG) return;
  setTimeout(() => {
    if (app.zugang || document.querySelector('dialog[open]')) return;
    art = 'einfuegen';
    oeffnen(einfuegenHTML())?.querySelector('[data-act="ios-einfuegen"]')?.focus();
  }, 700);
}

async function einfuegen() {
  const r = await einfuegenAusZwischenablage({ still: true, gefunden: zu });
  if (r === 'kein-link' && art === 'einfuegen') {
    oeffnen(einfuegenHTML(`In der Zwischenablage ist kein Link. Kopier ihn zuerst (in WhatsApp lange auf den Link drücken → „Kopieren“) und tipp dann nochmal auf „Einfügen“.`));
  }
}

/* -------------------------------------------------------------- Klicks */

/** true, wenn der Klick hierher gehörte. */
export function klickIphone(el) {
  switch (el.dataset.act) {
    case 'ios-zu': zu(); return true;
    case 'ios-spaeter': schreibe(SPAETER, Date.now()); zu(); return true;
    case 'ios-einfuegen': einfuegen(); return true;
    case 'ios-link': {
      if (!app.zugang) return true;
      // Für die App auf diesem Gerät: mit deinem Namen, dann reicht dort „Einfügen“
      const link = linkFuerGeraet(app.zugang.name || app.name());
      const feld = $('#ios-linkfeld');
      const zeigen = () => { if (feld) { feld.value = link; feld.hidden = false; feld.select(); } el.textContent = 'Kopieren klappt hier nicht – der Link steht darunter'; };
      try {
        // Das Popup liegt über der Meldung unten – darum sagt es der Knopf selbst
        navigator.clipboard.writeText(link).then(() => { el.textContent = `Kopiert ✓ – jetzt die App öffnen`; }, zeigen);
      } catch { zeigen(); }
      return true;
    }
    default: return false;
  }
}
