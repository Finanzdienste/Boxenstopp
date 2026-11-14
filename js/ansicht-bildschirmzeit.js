/*
 * Bildschirmzeit: Boxenstopp sagt Tobis Widget auf dem Startbildschirm, wie
 * lange es heute offen war – Android zählt die Web-App sonst nur als „Chrome“.
 * Das Messen und Melden macht js/bildschirmzeit.js, eine wortgleiche Kopie
 * aus dem Repo Finanzdienste/Bildschirmzeit (web/bildschirmzeit.js): dort
 * ändern, dann in Boxenstopp, Freizeit und Workout kopieren – nie hier.
 *
 * Verbunden wird nur über den Link aus der Widget-App
 * (…/Boxenstopp/#bildschirmzeit=<Kennung>). Ohne ihn misst, schickt und
 * zeigt die App nichts: keine Anfrage, kein Eintrag im Speicher, und die
 * Karte in den Einstellungen gibt es dann gar nicht, auch nicht versteckt –
 * für Amy, Marielle und alle anderen bleibt Boxenstopp, wie es war.
 *
 * Verbunden: eine kleine Karte nach der Waage – wie lange heute, wann
 * zuletzt gemeldet, ob es zuletzt hakte, „Trennen“. Die Kennung liegt nur im
 * localStorage dieses Geräts (bildschirmzeit.boxenstopp), nie in der Liste,
 * einem Link oder einem Fehlerbericht.
 */
import { $, ansicht, melde } from './kern.js';
import { esc, uhrzeit, tagKurz } from './format.js';
import { bildschirmzeitStarten, bildschirmzeitStand, bildschirmzeitTrennen, dauerText, tagVon, BZ_EREIGNIS } from './bildschirmzeit.js';

const KARTE = 'e-bz-karte';

/**
 * Einmal beim Start, vor allem, was die Adresse liest (app.js, ganz oben):
 * Ein Link aus der Widget-App verbindet und ist danach aus der Adresse, bevor
 * die App dort nach #zugang=, #ki=, #gaeste=, einem Reiter oder Rezept sucht.
 * Die Hinweise („Bildschirmzeit verbunden …“) kommen frühestens im nächsten
 * Takt – die Meldung unten (#toast) steht da schon im Gerüst, puffern muss
 * hier niemand. Beim Wegschalten schickt das Modul selbst (keepalive).
 */
export function bildschirmzeitStart() {
  bildschirmzeitStarten('boxenstopp', { meldung: (text) => melde(text) });
  window.addEventListener(BZ_EREIGNIS, (ev) => {
    // Offen: neu zeichnen. Getrennt: die Karte gleich weg, auch wenn gerade ein anderer Reiter vorn ist
    if (ansicht.tab === 'einstellungen' || !ev.detail) bildschirmzeitZeichnen(ev.detail);
  });
}

/** „zuletzt gemeldet um 14:05“, an einem anderen Tag „… am 13.11. um 23:50“. */
function zuletztText(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'noch nichts gemeldet';
  const tag = tagVon(d.getTime());
  return `zuletzt gemeldet ${tag === tagVon(Date.now()) ? '' : `am ${tagKurz(tag)} `}um ${uhrzeit(d)}`;
}

function karteHTML(s) {
  return `<h2 id="e-bz-t">Bildschirmzeit</h2><div id="e-bz">
<p class="e-ki-da"><span class="e-ok">✓</span> Verbunden mit deinem Widget. Heute <b>${esc(dauerText(s.heute))}</b> offen, ${esc(zuletztText(s.zuletzt))}.</p>
${s.fehler ? `<p class="fine e-bz-fehler">Zuletzt nicht durchgekommen: ${esc(s.fehler)}.</p>` : ''}
<div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="bz-trennen">Trennen</button></div>
<p class="fine">Gilt für dieses Gerät: Gezählt wird, solange Boxenstopp offen und zu sehen ist.</p></div>`;
}

let zuletztGezeichnet = '';
/** Die Karte nach dem Stand: verbunden zeichnen (oder anlegen), sonst weg. */
export function bildschirmzeitZeichnen(stand = bildschirmzeitStand()) {
  const da = $(`#${KARTE}`);
  if (!stand) { da?.remove(); zuletztGezeichnet = ''; return; }
  const pane = $('#view-einstellungen');
  if (!pane) return;
  let karte = da;
  if (!karte) {
    karte = document.createElement('section');
    karte.className = 'e-karte';
    karte.id = KARTE;
    karte.setAttribute('aria-labelledby', 'e-bz-t');
    // Nach der Waage, vor der Darstellung: bei dem, was die App mit anderem verbindet
    const nach = $('#e-waage-karte');
    if (nach) nach.after(karte); else pane.append(karte);
    zuletztGezeichnet = '';
  }
  const html = karteHTML(stand);
  if (html !== zuletztGezeichnet) { karte.innerHTML = html; zuletztGezeichnet = html; }
}

/** „Trennen“: nichts mehr messen, nichts mehr schicken – die Zahlen beim Widget bleiben. */
export function klickBildschirmzeit(el) {
  if (el.dataset.act !== 'bz-trennen') return false;
  bildschirmzeitTrennen();
  bildschirmzeitZeichnen(null);
  melde('Bildschirmzeit getrennt – Boxenstopp meldet nichts mehr an dein Widget. Verbinden geht wieder in der Widget-App.');
  return true;
}
