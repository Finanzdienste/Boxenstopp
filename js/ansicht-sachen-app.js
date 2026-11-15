/*
 * „Sachen ist jetzt eine eigene App“ (seit v83): Amys Sachen – Listen und
 * Sachen mit Foto, Marke, Tags, Notiz und Strichcode – stehen nicht mehr in
 * Amys Bereich, sondern in einer eigenen App unter sachen/
 * (https://finanzdienste.github.io/Boxenstopp/sachen/, eigenes Manifest,
 * eigenes Symbol, eigener Service Worker). Ihre Daten liegen in sachen.json
 * im Daten-Repo (sachen.js); den Umzug aus liste.json macht app.js.
 *
 * Hier, in der gemeinsamen Liste: der Knopf dorthin – oben in Amys Bereich
 * unter dem Schalter (ansicht-amy.js kopfHTML) – mit dem Tipp, wie die App
 * auf den Home-Bildschirm kommt, und einmal je Gerät ein Hinweis für Amy
 * (#sachen-hinweis-dlg), sobald die Liste abgeglichen ist und die Sachen
 * umgezogen sind. In der eigenen Liste eines Gasts (Marielle) bleibt „Sachen“
 * in Boxenstopp, wie es war – dort gibt es beides nicht.
 *
 * Android: Boxenstopp und die Sachen-App teilen sich den Speicher (gleicher
 * Ursprung), die Sachen-App nimmt Zugang und KI-Schlüssel von hier. iPhone
 * und iPad: Eine App vom Home-Bildschirm hat ihren eigenen Speicher – darum
 * öffnet der Knopf die Sachen-App mit dem Link (#zugang=…&fuer=…&ki=…, wie
 * zugang.js einladungsLink) und legt denselben Link in die Zwischenablage;
 * in der Sachen-App vom Home-Bildschirm reicht dann „Einfügen“.
 */
import { app, $, lese, schreibe } from './kern.js';
import { istEigen, linkFuerGeraet } from './profil.js';
import { bildPfad } from './bilder.js';
import { umzugNoetig } from './sachen.js';

/** true: Amy hat den Hinweis auf diesem Gerät gesehen. */
export const SACHEN_HINWEIS = 'boxenstopp.sachen.hinweis.v1';

const istIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const istAmy = (n) => /^amy\b/i.test(String(n || '').trim());

const OEFFNEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></svg>';
const KREUZ = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

/**
 * Die Adresse der Sachen-App – neben Boxenstopp unter sachen/, ohne den Teil
 * hinter #. Auf iPhone und iPad mit dem Link fürs Gerät (Zugang, Name, KI),
 * damit sie dort gleich verbunden ist.
 */
export function sachenAdresse() {
  const basis = new URL('sachen/', location.href).href.split('#')[0];
  if (!istIos() || !app.zugang?.token) return basis;
  const link = linkFuerGeraet(app.name());
  const i = link.indexOf('#');
  return i < 0 ? basis : `${basis}${link.slice(i)}`;
}

const tippText = () => (istIos()
  ? 'In Safari: Teilen → „Zum Home-Bildschirm“, die App dort öffnen und „Einfügen“ tippen – der Link ist schon kopiert.'
  : 'Im Browser: Menü ⋮ → „App installieren“ (oder „Zum Startbildschirm hinzufügen“) – dann hat Sachen ein eigenes Symbol. Kommt ein kleines Fenster: dort ⋮ → „In Chrome öffnen“.');

/** Der Knopf oben in Amys Bereich (gemeinsame Liste) – mit dem Tipp zum Home-Bildschirm. */
export function sachenAppHTML() {
  return `<div class="sachen-app">
<button type="button" class="amy-btn" data-act="sachen-app">${OEFFNEN}Sachen ist jetzt eine eigene App – öffnen</button>
<p class="fine">${tippText()}</p>
</div>`;
}

function hinweisZu() {
  const dlg = $('#sachen-hinweis-dlg');
  if (!dlg?.open) return;
  if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
}

/** Die Sachen-App öffnen – auf iPhone und iPad vorher den Link mit Zugang in die Zwischenablage. */
function oeffnen() {
  const adresse = sachenAdresse();
  // Nicht abwarten: Safari öffnet ein neues Fenster nur gleich beim Tippen
  if (istIos() && adresse.includes('#')) {
    try { Promise.resolve(navigator.clipboard?.writeText(adresse)).catch(() => {}); } catch { /* still – der Link steckt auch in der Adresse */ }
  }
  window.open(adresse, '_blank', 'noopener');
}

/** true, wenn der Klick hierher gehörte (der Knopf in Amys Bereich und die im Hinweis). */
export function klickSachenApp(el) {
  const act = el?.dataset?.act;
  if (act === 'sachen-app') { hinweisZu(); oeffnen(); return true; }
  if (act === 'sachen-hinweis-zu') { hinweisZu(); return true; }
  return false;
}

/* ------------------------------------------------------- Der Hinweis */

let geprueft = false;
/** Wem der Hinweis gilt: Amy, in eurer gemeinsamen Liste, solange sie ihn auf diesem Gerät nicht gesehen hat. */
const fuerAmy = () => !!app.zugang && app.listeDa && !istEigen() && istAmy(app.name()) && !lese(SACHEN_HINWEIS, false);

function hinweisHTML() {
  return `<button type="button" class="tablet-zu" data-act="sachen-hinweis-zu" aria-label="Schließen">${KREUZ}</button>
<p class="push-dlg-ic sachen-dlg-ic" aria-hidden="true"><img src="${bildPfad('womans-clothes')}" alt="" width="36" height="36"></p>
<h2 class="push-dlg-titel" id="sachen-hinweis-titel">Sachen ist jetzt eine eigene App</h2>
<p class="tablet-lead">Deine Sachen – Kleidung, Make-up, was du willst – haben jetzt eine eigene App, mit eigenem Symbol auf dem Home-Bildschirm. Was schon da war, ist mit umgezogen, mit Fotos und Strichcodes.</p>
<p class="tablet-fein">Hier in Boxenstopp stehen sie nicht mehr – oben in deinem Bereich ist der Knopf dorthin.</p>
<p class="tablet-fein">${tippText()}</p>
<div class="tablet-knoepfe"><button type="button" class="btn btn-primary" data-act="sachen-app">Sachen öffnen</button><button type="button" class="btn btn-quiet" data-act="sachen-hinweis-zu">Später</button></div>`;
}

function hinweisZeigen(n = 0) {
  const dlg = $('#sachen-hinweis-dlg');
  if (!dlg || dlg.open || !fuerAmy()) return;
  // Erst, wenn kein anderes Fenster offen ist (Willkommen, Push, Dashboard) und die Sachen umgezogen sind – sonst etwas später
  if (document.querySelector('dialog[open]') || umzugNoetig(app.stand)) { if (n < 30) setTimeout(() => hinweisZeigen(n + 1), 4000); return; }
  dlg.innerHTML = hinweisHTML();
  schreibe(SACHEN_HINWEIS, true);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  dlg.querySelector('.btn-primary')?.focus();
}

/**
 * Einmal je App-Start (app.js, sobald die Liste abgeglichen ist – wie
 * ansicht-gaeste.js dashboardHinweisPruefen). Stehen in liste.json noch
 * Sachen, die umziehen müssen, wartet er bis zum nächsten Abgleich – „was
 * schon da war, ist mit umgezogen“ soll stimmen.
 */
export function sachenHinweisPruefen() {
  if (geprueft || !app.zugang || !app.listeDa) return;
  if (!fuerAmy()) { geprueft = true; return; }
  if (umzugNoetig(app.stand)) return;
  geprueft = true;
  setTimeout(hinweisZeigen, Number(lese('__hinweis', 5000)) || 5000);
}
