/*
 * Das Willkommen für einen Gast mit eigener Liste (Marielle): kommt einmal
 * von selbst, wenn die eigene Liste das erste Mal da ist – und später über
 * Einstellungen → „Einführung zeigen“. Ein paar Seiten:
 *
 *   Hallo        was die App kann – in ihrer Farbe
 *   Makros       das eigene Ziel pro Box (ansicht-ziel.js), gleich für alle Rezepte
 *   Aufs Handy   auf den Home-Bildschirm; auf dem iPhone mit dem Hinweis, dass
 *                die App dort den Link einmal braucht (eigener Speicher)
 *   Gut zu wissen  wem die Liste gehört und wer was sieht – ehrlich
 *
 * Auf dem iPhone in Safari kommt „Aufs Handy“ gleich nach dem Hallo: Die
 * Makros trägt man dann in der App vom Home-Bildschirm ein.
 */
import { app, $, lese, schreibe, melde, zeigeReiter } from './kern.js';
import { esc } from './format.js';
import { bildPfad } from './bilder.js';
import { ladeKi } from './zugang.js';
import { istEigen, person, wessen, linkFuerGeraet } from './profil.js';
import { zielAusFeldern, zielSpeichern, eigenesZiel } from './ansicht-ziel.js';
import { zielText, MAKROS } from './zielrechner.js';
import { boxenBereinigen } from './boxen.js';
import { boxenChips } from './ansicht-boxen.js';

const GESEHEN = 'boxenstopp.willkommen.v1';
const KREUZ = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const TEILEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Teilen-Symbol" role="img"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

const istIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const vomHomeBildschirm = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

let seiten = [];
let seite = 0;
let makros = null; // { werte, tag, mahlzeiten, fehler }
let installieren = null; // beforeinstallprompt (Android/Chrome)
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installieren = ev; });

/** Der Link für dieses Gerät – auf dem iPhone braucht ihn die App vom Home-Bildschirm einmal. */
const meinLink = () => linkFuerGeraet();

function seitenFuer() {
  const s = ['hallo'];
  const aufsHandy = !vomHomeBildschirm();
  if (aufsHandy && istIos()) s.push('handy');
  if (!eigenesZiel()) s.push('makros');
  if (aufsHandy && !istIos()) s.push('handy');
  s.push('gut');
  return s;
}

const deko = (name) => `<img class="amy-deko" src="${bildPfad(name)}" alt="" width="20" height="20">`;

function halloHTML() {
  const name = person();
  const ki = !!ladeKi();
  const punkte = [
    ['Rezepte', '50 Meal-Prep-Rezepte, Schritt für Schritt mit Schalen und Timern – auf deine Makros gerechnet und auf so viele Boxen, wie du kochst.'],
    ['Einkaufsliste', 'Mit einem Tipp landen die Zutaten drauf, sortiert nach Abteilungen; die Angebote der Woche stehen daneben.'],
    [`${wessen(name)} Rezepte`, 'Deine eigenen Lieblingsrezepte – Zeile für Zeile tippen oder von einer Webseite übernehmen.'],
    ...(ki ? [['Resteverwertung & Speisekarte', 'Was im Kühlschrank ist, wird ein Rezept; im Restaurant sagt dir die App, welches Gericht am besten zu deinen Makros passt.']] : []),
  ];
  return `<p class="amy-eyebrow">${deko('sparkles')} schön, dass du da bist ${deko('sparkles')}</p>
<h2 class="tablet-titel" id="wk-titel">Hallo ${esc(name)} ♡</h2>
<p class="tablet-lead">Tobi hat dir Boxenstopp eingerichtet – mit deiner eigenen Liste. Kurz, was drin ist:</p>
<ul class="tablet-schritte wk-punkte">${punkte.map(([t, d]) => `<li><b>${esc(t)}</b><small>${esc(d)}</small></li>`).join('')}</ul>`;
}

function makrosHTML() {
  const f = makros || { werte: Object.fromEntries(MAKROS.map((k) => [k, String(app.ziel[k]).replace('.', ',')])), tag: false, mahlzeiten: 3, fehler: '' };
  makros = f;
  const feld = (k, name, einheit) => `<label class="e-ziel-f"><span>${name}</span><span class="e-ziel-inp"><input name="${k}" type="text" inputmode="decimal" autocomplete="off" value="${esc(f.werte[k] ?? '')}"${k === 'kcal' ? ' placeholder="auto"' : ''}><small>${einheit}</small></span></label>`;
  const vorschau = zielAusFeldern(f.werte, f);
  return `<p class="amy-eyebrow">${deko('sparkles')} deine Makros ${deko('sparkles')}</p>
<h2 class="tablet-titel" id="wk-titel">Was soll eine Box haben?</h2>
<p class="tablet-lead">Trag deine Werte ein – alle Rezepte rechnen sich darauf um. Die Mengen werden genau ausgerechnet, nicht geschätzt.</p>
<form class="e-ziel-form wk-makros" id="wk-makros" novalidate>
<div class="e-design e-ziel-wahl" role="radiogroup" aria-label="Werte pro Box oder pro Tag"><label class="e-wahl${f.tag ? '' : ' an'}"><input type="radio" name="wk-art" value="box"${f.tag ? '' : ' checked'}><span>pro Box</span></label><label class="e-wahl${f.tag ? ' an' : ''}"><input type="radio" name="wk-art" value="tag"${f.tag ? ' checked' : ''}><span>pro Tag</span></label></div>
<div class="e-ziel-felder">${feld('kcal', 'kcal', '')}${feld('p', 'Protein', 'g')}${feld('kh', 'KH', 'g')}${feld('f', 'Fett', 'g')}</div>
${f.tag ? `<label class="e-ziel-tag">Mahlzeiten am Tag <select name="mahlzeiten">${[2, 3, 4, 5].map((n) => `<option value="${n}"${Number(f.mahlzeiten) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
<p class="fine" id="wk-vorschau">${vorschau.ziel ? `Pro Box: <b>${esc(zielText(vorschau.ziel))}</b>` : esc(vorschau.fehler || '')}</p>
${f.fehler ? `<p class="zugang-fehler" role="alert">${esc(f.fehler)}</p>` : ''}
</form>
<div class="wk-boxen"><p class="wk-boxen-k" id="wk-boxen-k">Für wie viele Boxen kochst du meistens?</p><div class="e-boxen-wahl" role="group" aria-labelledby="wk-boxen-k">${boxenChips(boxenBereinigen(app.stand.profil?.boxen))}</div></div>
<p class="tablet-fein">Kein Plan? Dann lass die Werte so – das sind 443 kcal mit viel Protein, gebaut für 8 Boxen. Ändern kannst du beides jederzeit unter Einstellungen.</p>`;
}

function handyHTML() {
  if (istIos()) {
    return `<p class="amy-eyebrow">${deko('sparkles')} als App aufs Handy ${deko('sparkles')}</p>
<h2 class="tablet-titel" id="wk-titel">Auf den Home-Bildschirm</h2>
<ol class="tablet-schritte">
<li><b>Erst den Link kopieren</b><span><button type="button" class="amy-btn tablet-kopieren" data-act="wk-link">Link kopieren</button></span><small>Die App vom Home-Bildschirm hat auf dem iPhone ihren eigenen Speicher – dort braucht sie ihn einmal.</small></li>
<li><b>Teilen ${TEILEN} → „Zum Home-Bildschirm“</b><small>unten in Safari; dann „Hinzufügen“.</small></li>
<li><b>Die App vom Home-Bildschirm öffnen</b><small>und dort auf „Einfügen“ tippen – fertig. Deine Makros trägst du dann dort ein.</small></li>
</ol>
<input class="z-linkfeld" id="wk-linkfeld" type="text" readonly value="${esc(meinLink())}" aria-label="Dein Link" hidden>`;
  }
  return `<p class="amy-eyebrow">${deko('sparkles')} als App aufs Handy ${deko('sparkles')}</p>
<h2 class="tablet-titel" id="wk-titel">Auf den Home-Bildschirm</h2>
<p class="tablet-lead">Dann startet Boxenstopp wie eine App und geht auch ohne Netz.</p>
${installieren ? '<div class="tablet-knoepfe"><button type="button" class="amy-btn" data-act="wk-installieren">App installieren</button></div>' : '<ol class="tablet-schritte"><li><b>Menü ⋮ oben rechts</b><small>→ „App installieren“ oder „Zum Startbildschirm hinzufügen“.</small></li></ol>'}`;
}

function gutHTML() {
  return `<p class="amy-eyebrow">${deko('sparkles')} gut zu wissen ${deko('sparkles')}</p>
<h2 class="tablet-titel" id="wk-titel">Deine Liste ist deine</h2>
<ul class="tablet-schritte wk-punkte">
<li><b>Getrennt von Tobi und Amy</b><small>Deine Einkaufsliste, deine Rezepte, deine Makros – die beiden sehen davon in ihrer App nichts.</small></li>
<li><b>Wo sie liegt</b><small>In einem privaten Speicher bei GitHub, den Tobi für dich angelegt hat. Er sieht in seinem Überblick, wann du was änderst – sonst niemand.</small></li>
<li><b>Auf mehreren Geräten</b><small>Unter Einstellungen gibt es den Link fürs iPad oder ein zweites Handy.</small></li>
</ul>`;
}

const INHALT = { hallo: halloHTML, makros: makrosHTML, handy: handyHTML, gut: gutHTML };

function zeichnen() {
  const dlg = $('#willkommen-dlg');
  if (!dlg) return;
  const art = seiten[seite];
  const letzte = seite === seiten.length - 1;
  const weiter = art === 'makros' ? 'Übernehmen' : letzte ? 'Los geht’s' : 'Weiter';
  dlg.innerHTML = `<button type="button" class="tablet-zu" data-act="wk-zu" aria-label="Schließen">${KREUZ}</button>
${INHALT[art]()}
<div class="wk-punkte-nav" aria-hidden="true">${seiten.map((_, i) => `<span class="${i === seite ? 'an' : ''}"></span>`).join('')}</div>
<div class="tablet-knoepfe wk-knoepfe">${seite ? '<button type="button" class="btn btn-quiet" data-act="wk-zurueck">Zurück</button>' : ''}${art === 'makros' ? '<button type="button" class="btn btn-quiet" data-act="wk-ueberspringen">So lassen</button>' : ''}<button type="button" class="amy-btn" data-act="wk-weiter">${weiter}</button></div>`;
  dlg.querySelector('[data-act="wk-weiter"]')?.focus({ preventScroll: true });
}

/** Das Willkommen zeigen (von selbst oder aus den Einstellungen). */
export function willkommenZeigen() {
  const dlg = $('#willkommen-dlg');
  if (!dlg || !app.zugang) return;
  seiten = seitenFuer();
  seite = 0;
  makros = null;
  zeichnen();
  // Mit Escape oder dem Kreuz zu: gilt auch als gesehen
  dlg.onclose = () => schreibe(GESEHEN, true);
  if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
}

let geprueft = false;
/** Einmal von selbst: in einer eigenen Liste, sobald sie da ist (app.js beiAenderung). */
export function willkommenPruefen() {
  if (geprueft || !app.listeDa || !app.zugang || !istEigen()) return;
  geprueft = true;
  if (lese(GESEHEN, false)) return;
  setTimeout(() => { if (!document.querySelector('dialog[open]')) willkommenZeigen(); }, 600);
}

function zu() {
  schreibe(GESEHEN, true);
  const dlg = $('#willkommen-dlg');
  if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
}

function makrosLesen() {
  const f = $('#wk-makros');
  if (!f) return;
  makros.werte = Object.fromEntries(MAKROS.map((k) => [k, f.elements[k]?.value ?? '']));
  makros.tag = f.querySelector('input[name="wk-art"]:checked')?.value === 'tag';
  makros.mahlzeiten = Number(f.elements.mahlzeiten?.value || makros.mahlzeiten || 3);
}

export function klickWillkommen(el) {
  switch (el.dataset.act) {
    case 'wk-zu': zu(); return true;
    case 'wk-zurueck': if (seiten[seite] === 'makros') makrosLesen(); seite = Math.max(0, seite - 1); zeichnen(); return true;
    case 'wk-ueberspringen': seite++; zeichnen(); return true;
    case 'wk-weiter': {
      if (seiten[seite] === 'makros') {
        makrosLesen();
        const e = zielAusFeldern(makros.werte, makros);
        if (!e.ziel) { makros.fehler = e.fehler; zeichnen(); return true; }
        if (!app.listeDa) { makros.fehler = 'Einen Moment – deine Liste lädt noch.'; zeichnen(); return true; }
        makros.fehler = '';
        zielSpeichern(e.ziel, { still: true });
      }
      if (seite >= seiten.length - 1) { zu(); zeigeReiter('rezepte'); melde(`Viel Spaß, ${person()}! ♡`); return true; }
      seite++;
      zeichnen();
      return true;
    }
    case 'wk-link': {
      const link = meinLink();
      const feld = $('#wk-linkfeld');
      const zeigen = () => { if (feld) { feld.hidden = false; feld.select(); } el.textContent = 'Kopieren klappt hier nicht – der Link steht darunter'; };
      try { navigator.clipboard.writeText(link).then(() => { el.textContent = 'Kopiert ✓'; }, zeigen); } catch { zeigen(); }
      return true;
    }
    case 'wk-installieren':
      if (installieren) { installieren.prompt(); installieren.userChoice?.finally?.(() => { installieren = null; zeichnen(); }); }
      return true;
    case 'wk-einfuehrung': willkommenZeigen(); return true;
    default: return false;
  }
}

/** pro Box / pro Tag im Willkommen (change) – und das Tippen dort (input). */
export function aenderungWillkommen(ziel) {
  if (!ziel.closest?.('#wk-makros')) return false;
  const vorher = makros?.tag;
  makrosLesen();
  if (ziel.name === 'wk-art' && vorher !== makros.tag) {
    const n = Number(makros.mahlzeiten) || 3;
    for (const k of MAKROS) {
      const x = Number(String(makros.werte[k]).replace(',', '.'));
      if (!String(makros.werte[k]).trim() || !Number.isFinite(x)) continue;
      const y = makros.tag ? x * n : x / n;
      makros.werte[k] = String(k === 'kcal' ? Math.round(y) : Math.round(y * 10) / 10).replace('.', ',');
    }
    zeichnen();
    return true;
  }
  if (ziel.name === 'mahlzeiten') { zeichnen(); return true; }
  return true;
}
export function eingabeWillkommen(ziel) {
  if (!ziel.closest?.('#wk-makros')) return false;
  if (ziel.type === 'radio' || ziel.tagName === 'SELECT') return true;
  makrosLesen();
  const e = zielAusFeldern(makros.werte, makros);
  const v = $('#wk-vorschau');
  if (v) v.innerHTML = e.ziel ? `Pro Box: <b>${esc(zielText(e.ziel))}</b>` : esc(e.fehler || '');
  return true;
}

/** Enter im Makro-Formular des Willkommens: wie „Übernehmen“. */
export function absendenWillkommen(ev) {
  if (ev.target.id !== 'wk-makros') return false;
  ev.preventDefault();
  $('#willkommen-dlg [data-act="wk-weiter"]')?.click();
  return true;
}
