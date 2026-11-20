/*
 * Sachen – Amys Sachen als eigene App (https://finanzdienste.github.io/Boxenstopp/sachen/).
 *
 * Bis v82 waren die Sachen ein Teil von Amys Bereich in Boxenstopp; seit v83
 * hat sie dafür eine eigene App auf dem Home-Bildschirm. Der Code ist
 * derselbe: Rechnen und Zeichnen kommen aus ../js/ (inventar.js,
 * ansicht-inventar.js, inventar-ki.js, inventar-netz.js, scanner.js …) – hier
 * steht nur, was die App drumherum braucht: Zugang, Abgleich, Umzug, Service
 * Worker.
 *
 * Daten: sachen.json im privaten Repo Boxenstopp-Daten, neben liste.json
 * (sachen.js). Abgeglichen mit derselben Maschine wie liste.json
 * (speicher.js github() mit ART_SACHEN): Änderungen sofort sichtbar, ein
 * Commit nach ~0,7 s, 409 → neu holen, rev + 1. Die Commits sagen nur „Amy:
 * Sachen, 2 Änderungen“ – nie, was es ist. Die Fotos liegen wie bisher unter
 * sachen/ im Daten-Repo.
 *
 * Zugang: derselbe Schlüssel wie in Boxenstopp (zugang.js,
 * boxenstopp.zugang.v1). Chrome auf Android teilt den Speicher mit
 * Boxenstopp – dort ist die App gleich verbunden. Die App vom Home-Bildschirm
 * auf dem iPhone hat einen eigenen Speicher: Sie bekommt den Link aus
 * Boxenstopp (Amys Bereich → „Sachen ist jetzt eine eigene App – öffnen“,
 * …/sachen/#zugang=…&fuer=…&ki=… wie zugang.js einladungsLink) oder
 * „Einfügen“ aus der Zwischenablage.
 *
 * Eine eigene Liste (ein Gast wie Marielle, zugang.daten) bleibt in
 * Boxenstopp: Ihre Sachen stehen dort in ihrer liste.json. Hier gibt es dann
 * keinen Abgleich, nur den Weg dorthin.
 *
 * Umzug: Nach dem ersten Abgleich je Start holt die App, was in liste.json
 * noch unter inventar steht, nach sachen.json (sachen.js umzugAusListe –
 * liste.json liest sie nur; dort heraus nimmt es Boxenstopp). Schlägt das
 * fehl, beim nächsten Abgleich noch einmal (frühestens nach einer Minute).
 * Das geht beliebig oft ohne Schaden.
 *
 * Für die Tests lassen sich über den localStorage verstellen: __api (statt
 * https://api.github.com), __takt (Abgleich in ms) und __umzugPause (die
 * Pause nach einem fehlgeschlagenen Umzug in ms, sonst 60 s – wie Boxenstopp).
 */
// Als erstes: Fehler mitschreiben (in Boxenstopp unter Einstellungen → Über die App, derselbe Speicher)
import { sicher, fehlerMerken } from '../js/fehler.js';
import { bildBasis, bildPfad } from '../js/bilder.js';
import { kostenMeldenAn, KOSTEN_MELDEN, kiErsatzAn } from '../js/ki.js';
import { app, $, lese, melde } from '../js/kern.js';
import { esc } from '../js/format.js';
import { github, githubVergessen, pruefeSchluessel, privatLesen, API, DATEN } from '../js/speicher.js';
import { ART_SACHEN, SACHEN_ORT, umzugAusListe } from '../js/sachen.js';
import { hatInventar } from '../js/inventar.js';
import { ladeZugang, speichereZugang, linkAusAdresse, kiAusAdresse, speichereKi, ladeKi, schluesselAus, linkExtras, kiAus, eigeneListe, einladungsLink, KI_DATEI, geteiltenKiUebernehmen, geteiltenErsatzUebernehmen, ladeKiErsatz } from '../js/zugang.js';
import { person, wessen } from '../js/profil.js';
import { inventarHTML, inventarAktualisieren, klickInventar, eingabeInventar, aenderungInventar, tasteInventar, absendenInventar } from '../js/ansicht-inventar.js';

// Die Bildchen liegen eine Ebene höher (../bilder/zutaten/) – vor allem anderen, sonst zeigen sie ins Leere
bildBasis('../');
// Kosten an „Frag mal“ melden – nur in der echten App, nicht in den Tests
if (location.hostname === 'finanzdienste.github.io') kostenMeldenAn(KOSTEN_MELDEN);
// Kein Guthaben bei Anthropic: der Gemini-Ersatz aus ki.json springt ein (wie in Boxenstopp)
kiErsatzAn(ladeKiErsatz, { beiWechsel: () => melde('Claude-Guthaben leer – Gemini springt ein (eine Stunde lang).') });

const apiBasis = () => lese('__api', null) || API;
const takt = () => Number(lese('__takt', 0)) || 8000;
/** Nach einem fehlgeschlagenen Umzug so lange bis zum nächsten Versuch (wie js/app.js umzugPause). */
const umzugPause = () => Number(lese('__umzugPause', 0)) || 60 * 1000;

/** iPhone oder iPad (das iPad gibt sich als Mac aus, hat aber Touch) – wie ansicht-iphone.js. */
const istIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const vomHomeBildschirm = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
/** Die App vom Home-Bildschirm auf iPhone/iPad: Den Link bekommt sie nur über die Zwischenablage. */
const kannEinfuegen = () => istIos() && vomHomeBildschirm() && !!navigator.clipboard?.readText;
/** Wann dieses Gerät in Boxenstopp getrennt wurde, unter welchem Namen (ansicht-liste.js GETRENNT – derselbe Speicher). */
const GETRENNT = 'boxenstopp.getrennt.v1';
/** Hier war schon jemand anderes verbunden als der, für den der Link ist? Dann dessen Name (wie ansicht-liste.js anderesGeraet). */
function anderesGeraet(fuer) {
  const vorher = String(lese(GETRENNT, null)?.name || '').trim();
  return fuer && vorher && vorher.toLowerCase() !== String(fuer).trim().toLowerCase() ? vorher : '';
}
const geteilt = () => !!app.zugang && !eigeneListe(app.zugang);
const uhr = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const deko = (name) => `<img class="amy-deko" src="${bildPfad(name)}" alt="" width="22" height="22" decoding="async">`;

const HANDY = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>';
const TEILEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Teilen"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 21h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 11h-1"/></svg>';
const KREUZ = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

const WOHER = 'in Boxenstopp unter Amys Bereich → „Sachen ist jetzt eine eigene App – öffnen“';
const GAST = 'Das ist der Link einer eigenen Liste. Sachen ist für die gemeinsame Liste von Tobi und Amy – deine Sachen stehen in Boxenstopp in deinem Bereich unter „Sachen“.';

/*
 * Was über den Sachen steht (null: nichts):
 *   { art: 'verbinden', token, name, fehler, laeuft, anders, abgelehnt }  das Formular
 *   { art: 'gast', link }  eine eigene Liste – die Sachen sind in Boxenstopp
 */
let karte = null;
/*
 * Der Umzug je Zugang: einmal geschafft (fertig), gerade unterwegs (laeuft),
 * zuletzt versucht (at, für die Pause nach einem Fehlschlag).
 */
let umzug = { fertig: false, laeuft: false, at: 0 };
/*
 * Steht noch nichts da (erster Start auf diesem Gerät, oder sachen.json ist
 * noch leer), wartet die Ansicht auf den ersten Abgleich und den Umzug –
 * sonst stünden kurz die leeren Vorschläge da, und ein Tipp auf „Kleidung“
 * legte die Liste ein zweites Mal an, während ihre Sachen noch umziehen.
 * Ohne Netz und ohne gemerkten Stand (ohneNetz) wartet sie weiter – mit einem
 * Satz dazu statt „Wird geladen…“.
 */
let warten = false;
let ohneNetz = false;
const OHNE_NETZ = 'Ohne Netz – deine Sachen kommen, sobald das Handy wieder online ist.';
let istBereit = false;
const bereit = () => {
  if (istBereit) return;
  istBereit = true;
  document.documentElement.dataset.bereit = '1';
};
/** Was ohne besonderen Anlass dasteht: ohne Zugang das Formular, bei einem Gast der Weg zu Boxenstopp. */
const grundKarte = () => (!app.zugang ? { art: 'verbinden' } : eigeneListe(app.zugang) ? { art: 'gast', link: '../' } : null);

/* ---------------------------------------------------------------- Oben */

const STATUS_TEXT = { lokal: 'Nicht verbunden', ok: 'Geteilt', sendet: 'Speichert…', offline: 'Offline', zugang: 'Schlüssel prüfen' };

function statusZeichnen() {
  const chip = $('#sync');
  if (!chip) return;
  const gast = !!app.zugang && !geteilt();
  const z = geteilt() ? app.status.zustand : 'lokal';
  chip.dataset.state = z;
  $('#sync-text').textContent = gast ? 'In Boxenstopp' : STATUS_TEXT[z] || '';
}

/** Der rosa Kopf wie in Amys Bereich: wessen Sachen, ein Satz dazu. */
function kopfZeichnen() {
  const el = $('#s-kopf');
  if (!el) return;
  const ich = geteilt() && /^amy$/i.test(String(app.zugang.name || '').trim());
  const wer = wessen(person());
  // Ohne Zugang die Sachen von Amy; ein Gast (eigene Liste) hat seine in Boxenstopp
  const eyebrow = ich ? 'nur für dich' : geteilt() ? `${wer} Listen` : app.zugang ? 'in Boxenstopp' : 'Amys Listen';
  const lead = ich
    ? 'Deine Sachen in eigenen Listen – Kleidung, Make-up, was du willst –, mit Foto, Strichcode und Notizen.'
    : geteilt() ? `${wer} Sachen in eigenen Listen – Kleidung, Make-up und mehr –, mit Foto, Strichcode und Notizen.`
      : 'Listen für alles, was du hast – mit Foto, Strichcode und Notizen.';
  el.innerHTML = `<p class="amy-eyebrow">${deko('sparkles')} ${esc(eyebrow)} ${deko('sparkles')}</p>
<h1 class="amy-titel" id="s-titel">${esc(wer)} Sachen</h1>
<p class="amy-lead">${esc(lead)}</p>`;
}

/* --------------------------------------------------------------- Karte */

function karteHTML() {
  if (!karte) return '';
  if (karte.art === 'gast') {
    // Mit einem Gast-Zugang auf diesem Gerät – oder dem Link einer eigenen Liste in der Adresse (der gehört nach Boxenstopp)
    const titel = karte.ausLink ? 'Der Link gehört zu Boxenstopp' : 'Deine Sachen sind in Boxenstopp';
    const text = karte.ausLink
      ? 'Er ist für eine eigene Liste – deren Sachen stehen in Boxenstopp im eigenen Bereich unter „Sachen“. Sachen ist die App für die gemeinsame Liste von Tobi und Amy.'
      : 'Sachen ist die App für die gemeinsame Liste von Tobi und Amy. Du hast in Boxenstopp eine eigene Liste – deine Sachen stehen dort in deinem Bereich unter „Sachen“, mit allem, was du eingetragen hast.';
    return `<section class="s-karte" aria-labelledby="s-k-titel">
<h2 class="s-k-titel" id="s-k-titel">${titel}</h2>
<p class="s-k-text">${text}</p>
<div class="amy-knoepfe"><a class="amy-btn" href="${esc(karte.link || '../')}">${karte.ausLink ? 'In Boxenstopp öffnen' : 'Boxenstopp öffnen'}</a></div>
</section>`;
  }
  const k = karte;
  const titel = k.anders ? 'Mit dem neuen Schlüssel verbinden?' : k.abgelehnt ? 'Der Schlüssel geht nicht mehr' : 'Mit eurer Liste verbinden';
  const text = k.anders
    ? 'Auf diesem Gerät ist schon ein anderer Schlüssel eingetragen. Der aus dem Link gilt erst, wenn du auf „Verbinden“ tippst – dann auch für Boxenstopp im selben Browser.'
    : k.abgelehnt
      ? `GitHub nimmt den Schlüssel dieses Geräts nicht mehr an. Hol dir den Link neu – ${WOHER} – und füg ihn hier ein.`
      : `Sachen nimmt denselben Schlüssel wie Boxenstopp. Den Link dafür gibt es ${WOHER}${istIos() ? ' – auf dem iPhone kopiert der Knopf ihn.' : '.'}`;
  const einfuegen = kannEinfuegen() && !k.anders;
  return `<section class="s-karte" aria-labelledby="s-k-titel">
<h2 class="s-k-titel" id="s-k-titel">${esc(titel)}</h2>
<p class="s-k-text">${esc(text)}</p>
${einfuegen ? `<div class="amy-knoepfe"><button type="button" class="amy-btn" data-act="s-einfuegen"${k.laeuft ? ' disabled' : ''}>Einfügen</button></div>
<p class="fine s-k-fein">Den Link vorher kopieren – etwa in WhatsApp lange auf den Link drücken → „Kopieren“. Oder hier einsetzen:</p>` : ''}
<form class="s-form" id="s-form" autocomplete="off" novalidate>
<label class="amy-feld"><span>Link oder Schlüssel</span><input id="s-token" type="text" value="${esc(k.token || '')}" placeholder="Link aus Boxenstopp oder github_pat_…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next"></label>
<label class="amy-feld"><span>Dein Name</span><input id="s-name" type="text" maxlength="30" value="${esc(k.name || '')}" placeholder="z. B. Amy" autocomplete="off" enterkeyhint="go"></label>
${k.fehler ? `<p class="zugang-fehler" id="s-fehler" role="alert">${esc(k.fehler)}</p>` : ''}
<div class="amy-knoepfe"><button type="submit" class="amy-btn" id="s-los"${k.laeuft ? ' disabled' : ''}>${k.laeuft ? 'Prüfe…' : 'Verbinden'}</button>${k.anders ? '<button type="button" class="btn btn-quiet" data-act="s-abbrechen">Nicht jetzt</button>' : ''}</div>
</form>
<p class="fine s-k-fein">Der Schlüssel bleibt nur auf diesem Gerät.</p>
</section>`;
}

function karteZeichnen() {
  const el = $('#s-karte');
  if (!el) return;
  const html = karteHTML();
  el.innerHTML = html;
  el.hidden = !html;
}

/* ------------------------------------------------------------- Zeichnen */

/** Die Sachen selbst – wie Amys Bereich in Boxenstopp den Teil „Sachen“: Eine offene Sache, in der getippt wird, bleibt stehen. */
function zeichnen() {
  const el = $('#sachen');
  if (!el) return;
  if (!geteilt()) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  if (ohneNetz && !app.listeDa) { el.innerHTML = `<section class="inv" id="inv" aria-label="Sachen"><p class="loading" id="s-ohne-netz">${esc(OHNE_NETZ)}</p></section>`; return; }
  if (!inventarAktualisieren(el)) el.innerHTML = inventarHTML();
}
// ansicht-inventar.js zeichnet darüber neu (der Name stammt aus Amys Bereich)
app.amyNeuZeichnen = () => zeichnen();

/* -------------------------------------------------------------- Abgleich */

/** Ab jetzt die Sachen zeigen (bis dahin „Wird geladen…“). */
function freigeben() {
  warten = false;
  ohneNetz = false;
  app.listeDa = true;
  try { zeichnen(); } finally { bereit(); }
}

function beiAenderung(stand) {
  app.stand = stand;
  // Noch keine Sachen: auf den Abgleich und den Umzug warten (s. o.)
  if (warten && !hatInventar(stand?.inventar)) return;
  freigeben();
}

/** Hat dieses Gerät sachen.json schon einmal gelesen (speicher.js merkt sich den Stand)? */
function standGemerkt() {
  const g = lese(ART_SACHEN.speicher.github, null);
  return !!g && typeof g === 'object' && !!g.stand;
}

function beiStatus(s) {
  app.status = s;
  sicher('Status', statusZeichnen);
  // GitHub nimmt den Schlüssel nicht (mehr): das Formular – ein offenes bleibt, wie es ist
  if (s.zustand === 'zugang' && karte?.art !== 'verbinden') { karte = { art: 'verbinden', abgelehnt: true, name: app.zugang?.name || '' }; karteZeichnen(); }
  if (s.zustand === 'ok' && s.zuletzt) {
    if (karte?.abgelehnt) { karte = null; karteZeichnen(); }
    // Nach dem ersten echten Abgleich: was noch in liste.json steht, nach sachen.json – ging das schief, beim nächsten noch einmal (nach der Pause)
    if (!umzug.fertig && !umzug.laeuft && Date.now() - umzug.at >= umzugPause()) umzugAnstossen();
  }
  // Ohne Zugang wird es nicht besser: zeigen, was da ist
  if (warten && s.zustand === 'zugang') freigeben();
  if (warten && s.zustand === 'offline') {
    // Ohne Netz: zeigen, was dieses Gerät kennt – kennt es noch nichts, nicht die leeren Vorschläge (ein Tipp auf
    // „Kleidung“ legte eine zweite Liste an, die es in sachen.json oder liste.json schon gibt), sondern einen Satz dazu
    if (standGemerkt()) freigeben();
    else if (!ohneNetz) { ohneNetz = true; sicher('Ohne Netz', zeichnen); bereit(); }
  } else if (ohneNetz && s.zustand !== 'offline') {
    // Wieder Netz: bis die Sachen da sind, wieder „Wird geladen…“
    ohneNetz = false;
    sicher('Anzeigen', zeichnen);
  }
}

/*
 * Der Umzug (sachen.js umzugAusListe): liste.json lesen, was dort noch unter
 * inventar steht, nach sachen.json zusammenführen. Kam etwas Neues, gleich
 * frisch holen. Fehler still – wirft er oder kommt null (liste.json nicht zu
 * lesen), versucht beiStatus es beim nächsten Abgleich noch einmal.
 */
async function umzugAnstossen() {
  const z = app.zugang;
  if (!z || !geteilt()) return;
  const u = umzug;
  u.laeuft = true;
  u.at = Date.now();
  let r = null;
  try { r = await umzugAusListe({ token: z.token, api: apiBasis() }); } catch { r = null; }
  u.laeuft = false;
  u.fertig = !!r;
  if (app.zugang !== z) return;
  const neu = !!r && (r.neu.listen + r.neu.dinge) > 0;
  if (!neu) { if (warten) freigeben(); return; }
  // Die umgezogenen Sachen gleich holen – die Ansicht wartet darauf (beiAenderung), höchstens ein paar Sekunden
  app.speicher?.jetzt();
  setTimeout(() => { if (warten && app.zugang === z) freigeben(); }, 5000);
}

/** Der für alle Handys der Liste freigegebene KI-Schlüssel (ki.json, wie app.js geteiltenKiHolen) – so hat ihn auch das iPhone. */
async function geteiltenKiHolen() {
  const z = app.zugang;
  if (!z?.token || !geteilt()) return;
  const k = await privatLesen(KI_DATEI, { token: z.token, api: apiBasis(), ort: DATEN });
  if (app.zugang !== z) return;
  app.kiGeteilt = k && typeof k === 'object' && !Array.isArray(k) ? k : null;
  if (app.kiGeteilt) geteiltenErsatzUebernehmen(app.kiGeteilt);
  if (!app.kiGeteilt || !geteiltenKiUebernehmen(app.kiGeteilt)) return;
  const von = typeof app.kiGeteilt.von === 'string' && app.kiGeteilt.von.trim() ? ` von ${app.kiGeteilt.von.trim().slice(0, 30)}` : '';
  melde(`KI-Schlüssel${von} übernommen – die KI liest jetzt Fotos und Strichcodes.`);
  zeichnen();
}

/** Den Zugang nehmen (oder keinen): den Abgleich dazu starten – bei einem Gast keinen. */
function zugangSetzen(z) {
  app.speicher?.stop();
  app.speicher = null;
  app.zugang = z;
  app.listeDa = false;
  umzug = { fertig: false, laeuft: false, at: 0 };
  warten = !!z && !eigeneListe(z);
  ohneNetz = false;
  app.status = { zustand: z && !eigeneListe(z) ? 'ok' : 'lokal', offen: 0, zuletzt: null };
  sicher('Kopf', kopfZeichnen);
  statusZeichnen();
  zeichnen();
  if (!geteilt()) return;
  app.speicher = github({ token: z.token, name: z.name, api: apiBasis(), takt: takt(), ort: SACHEN_ORT, art: ART_SACHEN });
  app.speicher.start((stand) => sicher('Anzeigen', () => beiAenderung(stand)), beiStatus);
  geteiltenKiHolen().catch(() => null);
}

/** Schlüssel prüfen und verbinden – 'ok' | 'falsch' | 'netz' (speicher.js pruefeSchluessel). */
async function verbinden(token, name, ki = '') {
  const e = await pruefeSchluessel(token, { api: apiBasis(), ort: DATEN });
  if (e !== 'ok') return e;
  // War hier eine andere Liste verbunden (ein Gast, zugang.daten): Was von ihr noch vorgemerkt ist, gehört nicht in die
  // gemeinsame – sonst schickte Boxenstopp (derselbe Speicher) es in eure liste.json (wie js/app.js app.verbinden)
  const vorher = ladeZugang();
  if (vorher && eigeneListe(vorher)) githubVergessen();
  speichereZugang({ token, name });
  if (ki) speichereKi(ki);
  try { localStorage.removeItem(GETRENNT); } catch { /* egal */ }
  karte = null;
  karteZeichnen();
  zugangSetzen(ladeZugang());
  melde(`Verbunden ♡ ${/^amy$/i.test(name) ? 'Deine Sachen sind da.' : 'Die Sachen sind da.'}`);
  return 'ok';
}

const linkFehler = (e) => (e === 'falsch' ? 'Der Schlüssel aus dem Link geht nicht – hol dir in Boxenstopp einen neuen Link.' : 'Gerade keine Verbindung zu GitHub – der Link ist eingetragen, tipp gleich auf „Verbinden“.');

/** Das Formular abschicken: Link oder Schlüssel, Name. */
async function formAbschicken() {
  const text = String($('#s-token')?.value || '').trim();
  const roh = String($('#s-name')?.value || '');
  const fehler = (f) => { karte = { ...(karte || { art: 'verbinden' }), token: text, name: roh, fehler: f, laeuft: false }; karteZeichnen(); };
  const token = schluesselAus(text);
  const ex = linkExtras(text);
  if (!token) { fehler('Das sieht nicht nach dem Link aus Boxenstopp aus – und nicht nach einem Schlüssel (der beginnt mit github_pat_).'); return; }
  if (ex.daten) { fehler(GAST); return; }
  const name = (roh.trim() || ex.fuer).replace(/\s+/g, ' ').slice(0, 30);
  if (!name) { fehler('Trag noch deinen Namen ein – er steht dann bei deinen Änderungen.'); $('#s-name')?.focus(); return; }
  karte = { ...(karte || { art: 'verbinden' }), token: text, name, fehler: '', laeuft: true };
  karteZeichnen();
  const e = await verbinden(token, name, kiAus(text));
  if (e !== 'ok') fehler(e === 'falsch' ? 'Der Schlüssel geht nicht – hol dir in Boxenstopp einen neuen Link.' : 'Gerade keine Verbindung zu GitHub – gleich nochmal versuchen.');
}

/** iPhone/iPad, App vom Home-Bildschirm: den Link aus der Zwischenablage. */
async function einfuegen() {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { text = ''; }
  const token = schluesselAus(text);
  const ex = linkExtras(text);
  const basis = karte?.art === 'verbinden' ? karte : { art: 'verbinden' };
  if (!token) { karte = { ...basis, fehler: 'In der Zwischenablage ist kein Link. Kopier ihn zuerst (in WhatsApp lange auf den Link drücken → „Kopieren“) und tipp dann nochmal auf „Einfügen“.' }; karteZeichnen(); return; }
  if (ex.daten) { karte = { ...basis, fehler: GAST }; karteZeichnen(); return; }
  karte = { ...basis, token: text.trim(), name: ex.fuer || basis.name || '', fehler: '', laeuft: !!ex.fuer };
  karteZeichnen();
  if (!ex.fuer) { $('#s-name')?.focus(); return; }
  // Mit Namen im Link: gleich verbinden, ohne tippen
  const e = await verbinden(token, ex.fuer, kiAus(text));
  if (e !== 'ok') { karte = { ...karte, laeuft: false, fehler: linkFehler(e) }; karteZeichnen(); }
}

/* ------------------------------------------- iPhone in Safari, nach dem Link */

function safariHTML() {
  return `<button type="button" class="tablet-zu" data-act="s-ios-zu" aria-label="Schließen">${KREUZ}</button>
<p class="push-dlg-ic" aria-hidden="true">${HANDY}</p>
<h2 class="push-dlg-titel" id="s-ios-titel">Jetzt noch auf den Home-Bildschirm</h2>
<p class="tablet-lead">Hier in Safari bist du verbunden ✓ Die App auf dem Home-Bildschirm hat aber einen eigenen Speicher – Apple lässt keinen Link hinein. Darum bekommt sie ihn einmal so:</p>
<ol class="tablet-schritte">
<li><b>Link kopieren</b><span><button type="button" class="btn btn-primary tablet-kopieren" data-act="s-ios-link">Link kopieren</button></span>
<input class="z-linkfeld" id="s-ios-linkfeld" type="text" readonly aria-label="Dein Link" hidden></li>
<li><b>Auf den Home-Bildschirm</b><small>Hier auf ${TEILEN} <i>Teilen</i> → „Zum Home-Bildschirm“ → „Hinzufügen“.</small></li>
<li><b>Die App öffnen und „Einfügen“ tippen</b><small>Dann ist sie verbunden, ohne Namen tippen ♡</small></li>
</ol>
<div class="tablet-knoepfe"><button type="button" class="btn btn-quiet" data-act="s-ios-zu">Schließen</button></div>`;
}

/** Nach einem Link in Safari auf iPhone oder iPad: was die App vom Home-Bildschirm noch braucht. Android braucht das nicht. */
function safariHinweis() {
  if (!istIos() || vomHomeBildschirm() || !geteilt()) return;
  const dlg = $('#s-ios-dlg');
  if (!dlg || dlg.open || document.querySelector('dialog[open]')) return;
  dlg.innerHTML = safariHTML();
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  dlg.querySelector('[data-act="s-ios-link"]')?.focus();
}

function dialogZu() {
  const dlg = $('#s-ios-dlg');
  if (dlg?.open) { if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
}

function linkKopieren(knopf) {
  if (!app.zugang) return;
  // Für die App vom Home-Bildschirm: mit dem Namen, dann reicht dort „Einfügen“ (zugang.js baut ihn mit …/sachen/)
  const link = einladungsLink(app.zugang.token, ladeKi(), { fuer: app.zugang.name || '' });
  const feld = $('#s-ios-linkfeld');
  const zeigen = () => {
    if (feld) { feld.value = link; feld.hidden = false; feld.select(); }
    knopf.textContent = 'Kopieren klappt hier nicht – der Link steht darunter';
  };
  try {
    navigator.clipboard.writeText(link).then(() => { knopf.textContent = 'Kopiert ✓ – jetzt die App öffnen'; }, zeigen);
  } catch { zeigen(); }
}

/* ---------------------------------------------------------------- Klicks */

function statusSagen() {
  if (!app.zugang || karte?.art === 'verbinden') {
    $('#s-karte')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  if (!geteilt()) { melde('Deine Sachen stehen in Boxenstopp in deinem Bereich.'); return; }
  const { zustand, offen, zuletzt } = app.status;
  const t = {
    ok: `Geteilt mit eurer gemeinsamen Liste${zuletzt ? ` – abgeglichen um ${uhr(zuletzt)}` : ''}.`,
    sendet: 'Wird gerade gespeichert …',
    offline: `Gerade keine Verbindung zu GitHub.${offen ? ` ${offen} ${offen === 1 ? 'Änderung wird' : 'Änderungen werden'} gespeichert, sobald das Handy wieder online ist.` : ''}`,
    zugang: 'GitHub nimmt den Schlüssel nicht an – füg oben einen neuen Link aus Boxenstopp ein.',
  }[zustand];
  if (t) melde(t);
}

/** true, wenn der Klick hierher gehörte (alles andere gehört den Sachen). */
function klickSachen(el) {
  switch (el.dataset.act) {
    case 's-status': statusSagen(); return true;
    case 's-einfuegen': einfuegen(); return true;
    case 's-abbrechen': karte = grundKarte(); karteZeichnen(); return true;
    case 's-ios-zu': dialogZu(); return true;
    case 's-ios-link': linkKopieren(el); return true;
    default: return false;
  }
}

/** Tippen im Formular: ein eingefügter Link mit Namen füllt den Namen gleich mit. */
function eingabeSachen(t) {
  if (t.id === 's-token') {
    const n = $('#s-name');
    const fuer = linkExtras(t.value).fuer;
    if (n && fuer && !n.value.trim()) n.value = fuer;
  }
  if (t.id !== 's-token' && t.id !== 's-name') return false;
  $('#s-fehler')?.remove();
  return true;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el || el.disabled) return;
  if (klickSachen(el)) return;
  klickInventar(el);
});
document.addEventListener('input', (ev) => {
  if (!eingabeSachen(ev.target)) eingabeInventar(ev.target);
});
document.addEventListener('change', (ev) => { aenderungInventar(ev.target); });
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || ev.isComposing) return;
  // Im Formular: nach dem Link erst der Name, dann verbinden
  if (ev.target?.id === 's-token' && !String($('#s-name')?.value || '').trim()) { ev.preventDefault(); $('#s-name')?.focus(); return; }
  // Enter im Tag-Feld legt den Tag an, im Namen geht es zur Marke (ansicht-inventar.js)
  if (tasteInventar(ev.target)) ev.preventDefault();
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id === 's-form') { ev.preventDefault(); formAbschicken(); return; }
  absendenInventar(ev);
});

/* ----------------------------------------------------------------- Start */

function start() {
  // Ein Link (…#zugang=…&fuer=…&ki=…): erst der KI-Schlüssel, dann der Rest – danach ist die Adresse sauber
  const roh = location.hash;
  const kiLink = sicher('KI-Link', kiAusAdresse, '');
  if (kiLink) sicher('KI-Link', () => speichereKi(kiLink));
  const link = sicher('Link', linkAusAdresse, null) || { token: '', daten: '', fuer: '', farbe: '' };
  const z = ladeZugang();
  let jetztVerbinden = false;

  if (link.token && link.daten) {
    // Der Link einer eigenen Liste (Gast): Der gehört nach Boxenstopp – dort verbindet er
    karte = { art: 'gast', ausLink: true, link: `../${roh}` };
  } else if (link.token && z && z.token !== link.token) {
    // Ein anderer Schlüssel als bisher: erst auf Knopfdruck
    karte = { art: 'verbinden', anders: true, token: link.token, name: link.fuer || z.name || '' };
  } else if (link.token && !z) {
    const vorher = anderesGeraet(link.fuer);
    jetztVerbinden = !!link.fuer && !vorher;
    karte = {
      art: 'verbinden',
      token: link.token,
      name: vorher || link.fuer || '',
      laeuft: jetztVerbinden,
      fehler: vorher ? `Der Link ist für ${link.fuer} – hier war bis jetzt ${vorher} verbunden. Stimmt dein Name? Dann auf „Verbinden“.` : '',
    };
  }
  zugangSetzen(z);
  if (!karte) karte = grundKarte();
  karteZeichnen();
  // Ohne Abgleich ist jetzt schon alles gezeichnet; mit Abgleich nach dem ersten Stand (beiAenderung)
  if (!geteilt()) bereit();
  if (karte?.art === 'verbinden' && link.token && !jetztVerbinden) window.requestAnimationFrame(() => $('#s-name')?.focus());

  if (jetztVerbinden) {
    verbinden(link.token, link.fuer).then((e) => {
      if (e === 'ok') { safariHinweis(); return; }
      karte = { ...karte, laeuft: false, fehler: linkFehler(e) };
      karteZeichnen();
    });
  } else if (link.token && geteilt() && app.zugang.token === link.token) {
    // Safari war mit diesem Link schon verbunden – die App vom Home-Bildschirm vielleicht noch nicht
    setTimeout(safariHinweis, 900);
  }
  if (kiLink && !link.token) melde('KI-Schlüssel übernommen – die KI liest jetzt Fotos und Strichcodes.');
}

try { start(); } catch (e) {
  // Hakt der Start, steht wenigstens die Seite – und der Fehler unter Boxenstopp → Einstellungen → Über die App
  fehlerMerken('Start', e);
  bereit();
}

/*
 * Service Worker (./sw.js, Bereich /Boxenstopp/sachen/): macht die App
 * offline benutzbar. Er gibt die App nur aus seinem Vorrat – eine neue
 * Fassung kommt mit einer neuen VERSION in sw.js: Danach schaut die App beim
 * Start (registration.update()) und wenn sie nach einer Weile wieder nach
 * vorn kommt („aktualisieren“). Übernimmt die neue, lädt die Seite einmal neu
 * – aber nur, wenn vorher schon dieser Worker da war: Beim ersten Besuch
 * kontrolliert vielleicht Boxenstopps Worker die Seite (sein Bereich
 * /Boxenstopp/ schließt diesen ein); dann lädt das Skript in index.html
 * einmal neu, sobald der eigene übernimmt.
 */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const eigenerWorker = new URL('./sw.js', location.href).href;
  const hatteWorker = navigator.serviceWorker.controller?.scriptURL === eigenerWorker;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteWorker) return;
    try {
      if (sessionStorage.getItem('sachen.neugeladen')) return;
      sessionStorage.setItem('sachen.neugeladen', '1');
    } catch { return; }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      // Beim Start nach einer neuen Fassung schauen – der Worker selbst erneuert nichts (sw.js)
      .then((r) => { if (hatteWorker) r.update().catch(() => { /* dann beim nächsten Mal */ }); })
      .catch(() => { /* dann ohne Offline-Betrieb */ });
  });
  // Kommt die App nach einer halben Stunde oder mehr wieder nach vorn: nach einer neuen Fassung schauen
  let aufgefrischt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - aufgefrischt < 30 * 60 * 1000 || !navigator.onLine) return;
    aufgefrischt = Date.now();
    navigator.serviceWorker.controller?.postMessage({ boxenstopp: 'aktualisieren' });
  });
}
