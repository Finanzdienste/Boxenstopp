/*
 * „Boxenstopp auch auf deinem iPad“: eine Anleitung im Popup, wie die App
 * auf ein zweites Gerät derselben Person kommt – etwa Amys iPad neben ihrem
 * iPhone. Beide hängen dann an derselben Liste in GitHub: Rezepte, Tags und
 * Einkaufsliste sind auf beiden, man kann jederzeit wechseln.
 *
 * Auf dem iPhone und iPad hat die App vom Home-Bildschirm ihren eigenen
 * Speicher, getrennt von Safari – darum wird sie dort einmal eingerichtet,
 * mit dem Link vom ersten Gerät im Feld „Schlüssel“ (zugang.js schluesselAus
 * nimmt den ganzen Link).
 *
 * Von selbst kommt das Popup einmal: bei Amy auf dem iPhone, wenn die
 * gemeinsame Liste eingerichtet ist. Danach über „Auch aufs iPad“ in ihrem
 * Reiter und unter der Einkaufsliste.
 */
import { app, $, lese, schreibe } from './kern.js';
import { esc } from './format.js';
import { einladungsLink, ladeKi } from './zugang.js';
import { bildPfad } from './bilder.js';

const GEZEIGT = 'boxenstopp.tablet.v1';
let geprueft = false;

export const istIpad = () => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const istIphone = () => /iPhone|iPod/.test(navigator.userAgent);
/** „finanzdienste.github.io/Boxenstopp“ – so, wie man es ins Adressfeld tippt. */
const adresse = () => `${location.host}${location.pathname.replace(/\/?(?:index\.html)?$/, '')}`;

const TEILEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Teilen-Symbol" role="img"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const KREUZ = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
export const TABLET_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>';

function inhalt() {
  const name = app.zugang?.name || app.name() || '';
  return `<button type="button" class="tablet-zu" data-act="tablet-zu" aria-label="Schließen">${KREUZ}</button>
<p class="amy-eyebrow"><img class="amy-deko" src="${bildPfad('sparkles')}" alt="" width="20" height="20"> zwei Geräte, eine Liste <img class="amy-deko" src="${bildPfad('sparkles')}" alt="" width="20" height="20"></p>
<h2 class="tablet-titel" id="tablet-titel">Boxenstopp auch auf deinem iPad</h2>
<p class="tablet-lead">Dann hast du deine Rezepte und eure Einkaufsliste auf beiden – und kannst jederzeit wechseln. Was du auf dem einen speicherst, ist gleich auch auf dem anderen.</p>
<ol class="tablet-schritte">
<li><b>Hier deinen Link kopieren</b>
<span><button type="button" class="amy-btn tablet-kopieren" data-act="tablet-link">Link kopieren</button></span>
<input class="z-linkfeld" id="tablet-linkfeld" type="text" readonly aria-label="Dein Link" hidden>
<small>Mit derselben Apple-ID setzt du ihn auf dem iPad einfach ein. Sonst schick ihn dir per AirDrop oder Nachricht.</small></li>
<li><b>Auf dem iPad in Safari öffnen</b><span class="tablet-adresse">${esc(adresse())}</span></li>
<li><b>Zum Home-Bildschirm legen</b><span>Tipp auf ${TEILEN} <i>Teilen</i> (oben rechts, manchmal hinter „…“) → „Zum Home-Bildschirm“ → „Als Web-App öffnen“ an lassen → „Hinzufügen“.</span></li>
<li><b>Dort einmal einrichten</b><span>Boxenstopp vom Home-Bildschirm öffnen → <i>Einkaufsliste</i> → „Einrichten“. Name: <b>${esc(name || 'dein Name')}</b>, beim Schlüssel den Link einsetzen → „Verbinden“. Fertig ♡</span></li>
</ol>
<p class="tablet-fein">Gut zu wissen: Die Haken beim Kochen, laufende Timer und ein Rezept, das du gerade schreibst und noch nicht gespeichert hast, bleiben auf dem Gerät, auf dem du gerade bist. Ein Android-Tablet geht genauso – dort in Chrome über ⋮ → „Zum Startbildschirm hinzufügen“.</p>
<div class="tablet-knoepfe"><button type="button" class="amy-btn" data-act="tablet-zu">Alles klar ♡</button></div>`;
}

/** Das Popup öffnen (auch über „Auch aufs iPad“). */
export function tabletZeigen() {
  const dlg = $('#tablet-dlg');
  if (!dlg || !app.zugang) return;
  dlg.innerHTML = inhalt();
  schreibe(GEZEIGT, true);
  if (!dlg.open) {
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  dlg.querySelector('.tablet-kopieren')?.focus();
}

/** Einmal von selbst: bei Amy auf dem iPhone, sobald die gemeinsame Liste da ist. */
export function tabletPruefen() {
  if (geprueft || !app.listeDa || !app.zugang) return;
  geprueft = true;
  if (!/^amy$/i.test(String(app.zugang.name || '').trim()) || !istIphone() || lese(GEZEIGT, false)) return;
  setTimeout(() => { if (!document.querySelector('dialog[open]')) tabletZeigen(); }, 1200);
}

/** Klicks im Popup. true, wenn es hierher gehörte. */
export function klickTablet(el) {
  switch (el.dataset.act) {
    case 'tablet-zeigen': tabletZeigen(); return true;
    case 'tablet-zu': {
      const dlg = $('#tablet-dlg');
      if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
      return true;
    }
    case 'tablet-link': {
      if (!app.zugang) return true;
      const link = einladungsLink(app.zugang.token, ladeKi());
      const feld = $('#tablet-linkfeld');
      const zeigen = () => { if (feld) { feld.value = link; feld.hidden = false; feld.select(); } el.textContent = 'Kopieren klappt hier nicht – der Link steht darunter'; };
      try {
        // Das Popup liegt über allem, auch über der Meldung unten – darum sagt es der Knopf selbst
        navigator.clipboard.writeText(link).then(() => { el.textContent = 'Kopiert ✓ – jetzt auf dem iPad einsetzen'; }, zeigen);
      } catch { zeigen(); }
      return true;
    }
    default: return false;
  }
}
