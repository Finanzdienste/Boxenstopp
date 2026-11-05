/*
 * Reiter „Haushalt“: der Putzplan und die Haushaltssachen.
 *
 * Putzplan – je Raum oder Putztag eine Liste zum Abhaken, an festen
 * Wochentagen (jede, jede 2./3./4. Woche) oder ohne festen Tag. Oben steht,
 * was heute dran ist, darunter, was noch offen ist und was demnächst kommt.
 * Antippen öffnet den Putztag im eigenen Fenster: Material, Aufgaben,
 * Bearbeiten (siehe unten). Abhaken gilt für den Tag, der gerade dran ist;
 * ein neuer Tag fängt frisch an. Wer das letzte Häkchen setzt, bekommt ein
 * Tier (lob.js). Die Erinnerung „Heute ist Küche dran“ kommt als
 * Push-Nachricht vom Lauf im Daten-Repo (werkzeug/push.mjs --haushalt),
 * Microsoft To Do gleicht werkzeug/todo.mjs ab (Einstellungen → Microsoft
 * To Do).
 *
 * Haushaltssachen – was ihr so braucht, nach Bereichen, mit Vorschlägen.
 * Antippen setzt es auf die Einkaufsliste (Abteilung Haushalt), nochmal
 * antippen nimmt es wieder runter.
 *
 * Gezeichnet wird in Teilen: Der Editor und das Eingabefeld bleiben stehen,
 * wenn vom anderen Handy etwas kommt – sonst wäre beim Tippen der Text weg.
 * Die Rechnung (welcher Tag dran ist) steht in haushalt.js.
 */
import { app, $, $$, ansicht, melde, lese, schreibe, zeigeReiter } from './kern.js';
import { istEigen } from './profil.js';
import { esc } from './format.js';
import { opSache, opPlan, opPutzHaken, opPutzFertig, opLoeschen, opTodoWunsch, teileVon } from './liste.js';
import { RAEUME, RAUM, VORLAGEN, MATERIAL, JEDES, SACH_BEREICHE, bereichRaten, ERINNERN, ERINNERN_UHR, WOCHENTAGE, tagVon, plusTage, wochentag, termin, wdhText, tagText, zustaendig, naechsterTermin, aufgabenAm, wiederAm } from './haushalt.js';
import { bildPfad, zutatImg } from './bilder.js';
import { aufListe, aufDieListe } from './ansicht-liste.js';
import { lobGross } from './lob.js';
import { ic } from './ansicht-rezepte.js';

const SPEICHER = 'boxenstopp.haushalt.v1';
const gemerkt = lese(SPEICHER, {}) || {};
let teil = gemerkt.teil === 'sachen' ? 'sachen' : 'putzplan';
let sachenBearbeiten = false;
let gerippe = false;
let veraltet = true;

const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
const merken = () => schreibe(SPEICHER, { teil });
const heute = () => tagVon(new Date());
const ich = () => app.name() || '';
const haus = () => app.stand.haushalt || { sachen: {}, plaene: {}, stand: {}, todoApp: '', todoWunsch: {}, todoAn: {} };
const neueId = (vor) => `${vor}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const raumBild = (raum, gr = 36) => `<img class="h-raum-bild" src="${bildPfad(RAUM[raum]?.bild || 'sparkles')}" alt="" width="${gr}" height="${gr}" loading="lazy" decoding="async">`;
const und = (namen) => (namen.length <= 1 ? namen.join('') : `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`);
const DATUM_LANG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const langTag = (tag) => { const [j, m, t] = tag.split('-').map(Number); return DATUM_LANG.format(new Date(j, m - 1, t, 12)); };

/** Wer im Haushalt vorkommt – für „Wer“ im Editor. Groß- und Kleinschreibung wie zuerst gesehen. */
export function namen(stand = app.stand) {
  const je = new Map();
  const dazu = (n) => { const x = String(n || '').trim(); if (x && x.length <= 40 && !je.has(x.toLowerCase())) je.set(x.toLowerCase(), x); };
  dazu(ich());
  for (const n of Object.values(stand.leute || {})) dazu(n);
  const h = stand.haushalt || {};
  for (const p of Object.values(h.plaene || {})) { dazu(p.wer); dazu(p.by); }
  for (const x of Object.values(h.sachen || {})) dazu(x.by);
  for (const st of Object.values(h.stand || {})) { dazu(st.fertig?.by); for (const v of st.verlauf || []) dazu(v[1]); }
  for (const w of Object.values(h.todoWunsch || {})) dazu(w.name);
  for (const d of Object.values(stand.items || {})) { dazu(d.by); for (const [, t] of teileVon(d)) dazu(t.by); }
  for (const r of Object.values(stand.amy || {})) dazu(r.by);
  return [...je.values()].slice(0, 4);
}

/** Alle Putztage mit ihrem Stand für heute, sortiert. */
function tage(h = haus(), tag = heute()) {
  return Object.entries(h.plaene)
    .map(([id, p]) => ({ id, p, t: termin(p, h.stand[id], tag) }))
    .sort((a, b) => (a.t.datum || '9').localeCompare(b.t.datum || '9') || a.p.name.localeCompare(b.p.name, 'de'));
}

/** Für die Zahl unten: was bei mir heute dran oder noch offen ist. */
export function haushaltOffen(stand = app.stand, name = ich(), tag = heute()) {
  const h = stand.haushalt;
  if (!h) return 0;
  return Object.entries(h.plaene || {}).filter(([id, p]) => zustaendig(p, name) && ['heute', 'offen'].includes(termin(p, h.stand?.[id], tag).art)).length;
}

export function haushaltZahl() {
  const n = haushaltOffen();
  // Am Reiter unten und an der Kachel bei den Rezepten
  for (const b of [$('#h-badge'), $('#h-abk')]) if (b) { b.hidden = n === 0; b.textContent = String(n); }
}

/* --------------------------------------------------------------- Zeichnen */

function titel(h, tag) {
  if (teil === 'sachen') return 'Was braucht ihr im Haushalt?';
  const alle = tage(h, tag);
  if (!alle.length) return 'Euer Putzplan';
  const jetzt = alle.filter((x) => x.t.art === 'heute').map((x) => x.p.name);
  if (jetzt.length === 1) return `Heute ist ${jetzt[0]} dran`;
  if (jetzt.length > 1 && jetzt.length <= 3) return `Heute sind ${und(jetzt)} dran`;
  if (jetzt.length > 3) return `Heute sind ${jetzt.length} Putztage dran`;
  if (alle.some((x) => x.t.art === 'erledigt' && x.t.datum === tag && !x.t.frei)) return 'Für heute ist alles geputzt';
  const offen = alle.filter((x) => x.t.art === 'offen').map((x) => x.p.name);
  if (offen.length) return `Noch offen: ${und(offen.slice(0, 3))}`;
  return 'Heute ist nichts dran';
}

/** Unter dem Titel, wenn heute nichts (mehr) dran ist: was als Nächstes kommt. */
function naechstesText(h, tag) {
  if (teil !== 'putzplan') return '';
  const alle = tage(h, tag);
  if (alle.some((x) => x.t.art === 'heute')) return '';
  const kommt = alle.map((x) => ({ name: x.p.name, tag: vorabTag(x.t, tag) })).filter((x) => x.tag).sort((a, b) => a.tag.localeCompare(b.tag));
  if (!kommt.length) return '';
  const erster = kommt[0].tag;
  const namenAm = kommt.filter((x) => x.tag === erster).map((x) => x.name);
  const wann = tagText(erster, tag);
  return `Als Nächstes: ${und(namenAm)} ${wann === 'morgen' ? 'morgen' : `am ${wann}`}`;
}

function kopfHTML(h, tag) {
  const drauf = sachenAufListe(h).length;
  const naechstes = naechstesText(h, tag);
  return `<span class="eyebrow">Haushalt · ${esc(langTag(tag))}</span>
<h1 class="e-titel" id="h-titel">${esc(titel(h, tag))}</h1>${naechstes ? `<p class="h-naechstes">${esc(naechstes)}</p>` : ''}
<div class="h-teile" role="group" aria-label="Was zeigen">
  <button type="button" class="h-teil" data-act="h-teil" data-teil="putzplan" aria-pressed="${teil === 'putzplan'}">Putzplan</button>
  <button type="button" class="h-teil" data-act="h-teil" data-teil="sachen" aria-pressed="${teil === 'sachen'}">Haushaltssachen${drauf ? ` <span class="btn-n" title="auf der Einkaufsliste">${drauf}</span>` : ''}</button>
</div>`;
}

const WAGEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L21 8H6.1"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>';
const HOCH = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const RUNTER = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

/** Eine Aufgabe zum Abhaken – für den Tag datum. nicht: diesmal nicht dran (mit „wieder am …“). */
function aufgabeHTML(id, a, datum, an, nicht = '') {
  return `<li><button type="button" class="h-aufgabe" role="checkbox" aria-checked="${an}" data-act="h-haken" data-plan="${esc(id)}" data-aufgabe="${esc(a.id)}" data-datum="${esc(datum)}"><span class="cb" aria-hidden="true">${ic('check')}</span><span class="h-aufgabe-t">${esc(a.t)}${nicht ? `<small>${esc(nicht)}</small>` : (a.jedes > 1 ? `<small>${esc(JEDES[a.jedes - 1][1])}</small>` : '')}</span></button></li>`;
}

function werText(p) {
  if (!p.wer) return '';
  return p.wer.toLowerCase() === ich().toLowerCase() ? 'du' : p.wer;
}
const fuer = (n) => (String(n).toLowerCase() === ich().toLowerCase() ? 'dir' : n);

/** Für welchen Tag man bei „demnächst“ schon vorher abhakt – oder ''. */
function vorabTag(t, tag) {
  if (t.frei) return '';
  if (t.art === 'bald') return t.datum || '';
  if (t.art === 'erledigt' && t.datum !== tag) return t.naechster || '';
  return '';
}
const hakenAm = (id, datum) => { const st = haus().stand[id]; return st && st.datum === datum ? st.haken || [] : []; };

/**
 * Um welchen Tag es beim Putztag geht und wie es da steht: { datum, vorab,
 * haken, fertig, dran, nicht } – dran: die Aufgaben, die an dem Tag dran
 * sind; nicht: „jedes 2. Mal“ und diesmal nicht.
 */
function sitzung(id, p, t, tag) {
  const vorab = vorabTag(t, tag);
  const datum = vorab || t.datum || tag;
  const st = haus().stand[id];
  const haken = vorab ? hakenAm(id, vorab) : t.haken;
  const fertig = vorab ? (st?.datum === vorab && st.fertig ? st.fertig : null) : (t.art === 'erledigt' ? t.fertig : null);
  const dran = aufgabenAm(p, datum);
  const nicht = p.aufgaben.filter((a) => !dran.includes(a));
  return { datum, vorab, haken, fertig, dran, nicht };
}

/** Ein Putztag als Karte – antippen öffnet ihn im eigenen Fenster. */
function planHTML(x, tag) {
  const { id, p, t } = x;
  const s = sitzung(id, p, t, tag);
  const n = s.dran.length;
  const k = s.dran.filter((a) => s.haken.includes(a.id)).length;
  const wer = werText(p);
  let rechts = '';
  let unter = [t.frei ? 'ohne festen Tag' : wdhText(p.wdh), wer].filter(Boolean).join(' · ');
  if (t.art === 'erledigt' && !s.vorab) rechts = `<span class="h-ok" title="erledigt">${ic('check')}</span>`;
  else if (s.vorab) rechts = `<span class="h-wann">${esc(tagText(s.vorab, tag))}</span>`;
  else if (n) rechts = `<span class="h-zahl">${k}/${n}</span>`;
  if (t.art === 'offen') unter = `seit ${tagText(t.datum, tag)} offen · ${unter}`;
  if (t.art === 'erledigt') unter = `${t.frei || t.datum === tag ? 'erledigt' : `${tagText(t.datum, tag)} erledigt`}${t.fertig?.by ? ` von ${fuer(t.fertig.by)}` : ''} · ${t.frei ? 'ohne festen Tag' : wdhText(p.wdh)}`;
  if (s.vorab && k) unter = `${k} von ${n} schon vorab · ${unter}`;
  const pct = n ? Math.round((100 * k) / n) : 0;
  const balken = n && (['heute', 'offen', 'frei'].includes(t.art) || (s.vorab && k)) ? `<span class="h-balken" aria-hidden="true"><span style="width:${pct}%"></span></span>` : '';
  return `<button type="button" class="h-plan h-${t.art}" data-act="h-oeffnen" data-plan="${esc(id)}"><span class="h-plan-kopf">${raumBild(p.raum)}<span class="h-plan-name"><b>${esc(p.name)}</b><small>${esc(unter)}</small></span>${rechts}${ic('weiter', 'h-pfeil')}</span>${balken}</button>`;
}

function verlaufText(id, tag) {
  const v = (haus().stand[id]?.verlauf || []).filter((e) => e[0] < tag).slice(-1)[0];
  if (!v) return '';
  const wer = v[1] ? ` von ${v[1].toLowerCase() === ich().toLowerCase() ? 'dir' : v[1]}` : '';
  return `<p class="h-zuletzt">Zuletzt ${esc(tagText(v[0], tag))}${esc(wer)}</p>`;
}

function leerHTML() {
  const start = ['kueche', 'bad', 'wohnzimmer', 'schlafzimmer', 'waesche', 'flur'];
  return `<div class="empty-state h-leer">
  <p class="es-t">Noch kein Putzplan</p>
  <p>Leg je Raum fest, was zu tun ist und an welchen Tagen – zum Abhaken${istEigen() ? '' : ', auf Wunsch mit Push-Nachricht „Heute ist Küche dran“ und in Microsoft To Do'}.</p>
  <div class="h-start">${start.map((r) => `<button type="button" class="h-raum-chip" data-act="h-neu" data-raum="${r}">${raumBild(r, 24)}${esc(RAUM[r].name)}</button>`).join('')}<button type="button" class="h-raum-chip" data-act="h-neu" data-raum="sonstiges">${ic('plus')}Eigener</button></div>
  <div><button type="button" class="btn" data-act="h-vorschlag">Mit einem Vorschlag anfangen</button></div>
  <p class="fine">Der Vorschlag: Küche montags und donnerstags, Wohnzimmer mittwochs, Bad samstags, Schlafzimmer alle 2 Wochen sonntags, die ganze Wohnung alle 4 Wochen samstags – alles lässt sich ändern.</p>
</div>`;
}

function todoZeile(h) {
  const an = Object.keys(h.todoAn || {});
  const meins = an.includes(ich().toLowerCase());
  const wartet = h.todoWunsch?.[ich().toLowerCase()]?.art === 'abgleichen';
  const jetzt = meins ? `<button type="button" class="linkbtn" data-act="h-todo-jetzt"${wartet ? ' disabled' : ''}>${wartet ? 'Gleicht ab …' : 'Jetzt abgleichen'}</button>` : '';
  if (an.length) {
    // Eine gemeinsame Liste: dort steht alles, für beide
    const gemeinsam = an.map((n) => h.todoZiel?.[n]).find((z) => z?.geteilt);
    if (gemeinsam) return `<p class="h-todo">${ic('list')}<span>In Microsoft To Do: eure gemeinsame Liste „${esc(gemeinsam.name)}“.</span>${jetzt}</p>`;
    const wer = an.map((n) => `${n === ich().toLowerCase() ? 'dir' : (namen().find((x) => x.toLowerCase() === n) || n)}${h.todoZiel?.[n] ? ` („${h.todoZiel[n].name}“)` : ''}`).join(' und ');
    return `<p class="h-todo">${ic('list')}<span>In Microsoft To Do bei ${esc(wer)}.</span>${jetzt}</p>`;
  }
  return `<p class="h-todo">${ic('list')}<span>Auch in Microsoft To Do?</span><button type="button" class="linkbtn" data-act="h-todo-einst">In den Einstellungen verbinden</button></p>`;
}

function plaeneHTML(h, tag) {
  const alle = tage(h, tag);
  if (!alle.length) return leerHTML();
  const gruppe = (titelText, liste, klasse = '') => (liste.length ? `<section class="h-gruppe ${klasse}"><h2 class="h-gruppe-t">${esc(titelText)}</h2>${liste.map((x) => planHTML(x, tag)).join('')}</section>` : '');
  const jetzt = alle.filter((x) => x.t.art === 'heute' || (x.t.art === 'erledigt' && x.t.datum === tag && !x.t.frei));
  const offen = alle.filter((x) => x.t.art === 'offen');
  const frei = alle.filter((x) => x.t.frei);
  const bald = alle.filter((x) => !x.t.frei && (x.t.art === 'bald' || (x.t.art === 'erledigt' && x.t.datum !== tag)))
    .sort((a, b) => (vorabTag(a.t, tag) || '9').localeCompare(vorabTag(b.t, tag) || '9') || a.p.name.localeCompare(b.p.name, 'de'));
  return `${gruppe(`Heute · ${WOCHENTAGE[wochentag(tag) - 1][2]}`, jetzt, 'h-jetzt')}
${gruppe('Noch offen', offen, 'h-offen-g')}
${gruppe('Demnächst', bald)}
${gruppe('Zwischendurch', frei)}
<div class="h-neu-zeile"><button type="button" class="btn" data-act="h-neu">${ic('plus')}Putztag anlegen</button></div>
${istEigen() ? '' : todoZeile(h)}`;
}

/* -------------------------------------------------------- Haushaltssachen */

const gleichName = (a) => String(a || '').toLowerCase().replace(/\s+/g, ' ').trim();
function sachenAufListe(h = haus()) {
  const namenSachen = [...Object.values(h.sachen).map((x) => x.name), ...SACH_BEREICHE.flatMap(([, , , v]) => v)];
  return [...new Set(namenSachen.map(gleichName))].filter((n) => aufListe(n));
}

function sachenHTML(h) {
  const eigen = Object.entries(h.sachen);
  const hatEigen = new Set(eigen.map(([, x]) => gleichName(x.name)));
  const chip = ({ id = '', name, bereich, vorschlag = false }) => {
    const drauf = !!aufListe(name);
    const bild = zutatImg('', { name, cat: 'haushalt', klasse: 'h-sache-bild', groesse: 22 });
    if (sachenBearbeiten) return vorschlag ? '' : `<button type="button" class="h-sache h-weg" data-act="h-sache-weg" data-sache="${esc(id)}" aria-label="${esc(name)} vergessen">${bild}<span>${esc(name)}</span>${X}</button>`;
    return `<button type="button" class="h-sache${vorschlag ? ' h-vorschlag' : ''}" data-act="h-sache" ${id ? `data-sache="${esc(id)}"` : `data-name="${esc(name)}" data-bereich="${esc(bereich)}"`} aria-pressed="${drauf}">${bild}<span>${esc(name)}</span>${drauf ? ic('check', 'h-sache-ok') : ''}</button>`;
  };
  const bereiche = SACH_BEREICHE.map(([k, name, bild, vorschlaege]) => {
    const meine = eigen.filter(([, x]) => x.bereich === k).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'de'));
    const vor = vorschlaege.filter((v) => !hatEigen.has(gleichName(v)));
    const chips = [...meine.map(([id, x]) => chip({ id, name: x.name, bereich: k })), ...vor.map((v) => chip({ name: v, bereich: k, vorschlag: true }))].filter(Boolean);
    if (!chips.length) return '';
    return `<section class="h-bereich"><h2 class="h-gruppe-t"><img src="${bildPfad(bild)}" alt="" width="18" height="18">${esc(name)}</h2><div class="h-sachen">${chips.join('')}</div></section>`;
  }).join('');
  const drauf = sachenAufListe(h).length;
  return `${drauf ? `<p class="h-drauf">${ic('list')}<span>${drauf === 1 ? 'Eine Haushaltssache steht' : `${drauf} Haushaltssachen stehen`} auf der Einkaufsliste.</span><button type="button" class="linkbtn" data-tab="einkauf">Zur Liste</button></p>` : ''}
${bereiche || '<p class="empty">Noch nichts gemerkt.</p>'}
<div class="h-sachen-fuss"><button type="button" class="linkbtn" data-act="h-sachen-bearbeiten">${sachenBearbeiten ? 'Fertig' : 'Eigene bearbeiten'}</button></div>
<p class="fine">Antippen setzt es auf die Einkaufsliste, nochmal antippen nimmt es wieder runter. Gestrichelt: Vorschläge – einmal angetippt, gehören sie zu euren.</p>`;
}

/* ------------------------------------------------- Der Putztag im Fenster */

/*
 * Ein Putztag geht im eigenen Fenster auf (dialog #putzmodus, wie der
 * Kochmodus): oben, was man braucht (Material – antippen: liegt bereit; der
 * Wagen: fehlt, auf die Einkaufsliste), darunter die Aufgaben, die an dem
 * Tag dran sind, und eingeklappt, was „jedes 2. Mal“ diesmal nicht dran ist.
 * „Bearbeiten“ zeigt im selben Fenster den Editor: Raum, Name, Material,
 * Aufgaben (dazu, weg, umstellen, wie oft), Tage, Wer, Erinnerung.
 */
let pm = null; // { id (null: neu), modus: 'putzen' | 'bearbeiten', raum, nichtAuf }
const BEREIT = 'boxenstopp.putz.bereit.v1';
const bereitVon = (id, datum) => { const b = lese(BEREIT, {}) || {}; return Array.isArray(b[`${id}|${datum}`]) ? b[`${id}|${datum}`] : []; };
function bereitSetzen(id, datum, name) {
  const b = lese(BEREIT, {}) || {};
  const k = `${id}|${datum}`;
  const jetzt = new Set(Array.isArray(b[k]) ? b[k] : []);
  if (jetzt.has(name)) jetzt.delete(name); else jetzt.add(name);
  delete b[k];
  b[k] = [...jetzt];
  // Nur die letzten 30 Putztage merken
  const keys = Object.keys(b);
  for (const x of keys.slice(0, Math.max(0, keys.length - 30))) delete b[x];
  schreibe(BEREIT, b);
}

const dlg = () => $('#putzmodus');
const istOffen = () => !!pm && !!dlg()?.open;

function putzKopf(p, unter) {
  return `<header class="pm-kopf">${p ? raumBild(p.raum, 44) : ''}<div class="pm-titel"><b id="pm-titel">${esc(p ? p.name : 'Neuer Putztag')}</b>${unter ? `<span>${esc(unter)}</span>` : ''}</div><button type="button" class="pm-zu" data-act="h-pm-zu" aria-label="Schließen">${X}</button></header>`;
}

function materialHTML(id, p, datum) {
  const mat = p.material || [];
  if (!mat.length) {
    const vor = MATERIAL[p.raum] || [];
    return `<p class="fine">Noch kein Material eingetragen.</p>${vor.length ? `<div><button type="button" class="btn btn-klein" data-act="h-pm-material-vorschlag">${ic('plus')}Vorschlag für ${esc(RAUM[p.raum].name)} übernehmen</button></div><p class="fine">${esc(vor.join(', '))}</p>` : ''}`;
  }
  const bereit = new Set(bereitVon(id, datum));
  return `<ul class="pm-material">${mat.map((m) => {
    const drauf = !!aufListe(m);
    const da = bereit.has(m);
    return `<li class="pm-mat${da ? ' bereit' : ''}"><button type="button" class="pm-mat-b" data-act="h-pm-bereit" data-name="${esc(m)}" aria-pressed="${da}"><span class="cb" aria-hidden="true">${ic('check')}</span>${zutatImg('', { name: m, cat: 'haushalt', klasse: 'pm-mat-bild', groesse: 24 })}<span class="pm-mat-t">${esc(m)}</span></button><button type="button" class="pm-wagen${drauf ? ' drauf' : ''}" data-act="h-pm-wagen" data-name="${esc(m)}" aria-pressed="${drauf}" aria-label="${esc(m)}: ${drauf ? 'steht auf der Einkaufsliste – wieder runter' : 'fehlt – auf die Einkaufsliste'}">${WAGEN}${drauf ? '<span>drauf</span>' : ''}</button></li>`;
  }).join('')}</ul><p class="fine">Antippen: liegt bereit. Der Wagen: fehlt – kommt auf die Einkaufsliste.</p>`;
}

function putzHTML() {
  const h = haus();
  const id = pm.id;
  const p = h.plaene[id];
  const tag = heute();
  const t = termin(p, h.stand[id], tag);
  const s = sitzung(id, p, t, tag);
  const haken = new Set(s.haken);
  const n = s.dran.length;
  const k = s.dran.filter((a) => haken.has(a.id)).length;
  let wann;
  if (t.frei) wann = 'ohne festen Tag';
  else if (s.vorab) wann = `dran ${tagText(s.vorab, tag) === 'morgen' ? 'morgen' : `am ${tagText(s.vorab, tag)}`}`;
  else if (t.art === 'offen') wann = `seit ${tagText(t.datum, tag)} offen`;
  else wann = tagText(s.datum, tag);
  const unter = [wann.replace(/^./, (c) => c.toUpperCase()), t.frei ? '' : wdhText(p.wdh), werText(p) || 'ihr beide'].filter(Boolean).join(' · ');
  const pct = n ? Math.round((100 * k) / n) : (s.fertig ? 100 : 0);
  let stand;
  if (s.fertig) stand = `<p class="pm-stand pm-ok">${ic('check')}Erledigt${s.fertig.by ? ` von ${esc(fuer(s.fertig.by))}` : ''}</p>`;
  else if (s.vorab) stand = `<p class="pm-stand">${t.art === 'erledigt' ? `${esc(tagText(t.datum, tag))} erledigt${t.fertig?.by ? ` von ${esc(fuer(t.fertig.by))}` : ''}. ` : ''}Abhaken geht schon vorher – es zählt für ${esc(tagText(s.vorab, tag))}.${n ? ` ${k} von ${n}.` : ''}</p>`;
  else stand = `<p class="pm-stand">${n ? `${k} von ${n} erledigt` : 'Keine einzelnen Aufgaben – „Erledigt“ reicht.'}</p>`;
  const aufgaben = n ? `<ul class="h-aufgaben pm-aufgaben">${s.dran.map((a) => aufgabeHTML(id, a, s.datum, haken.has(a.id))).join('')}</ul>` : '';
  const nicht = s.nicht.length ? `<details class="pm-nicht"${pm.nichtAuf ? ' open' : ''}><summary>Diesmal nicht dran (${s.nicht.length})</summary><ul class="h-aufgaben">${s.nicht.map((a) => {
    const wieder = wiederAm(a, p, s.datum);
    return aufgabeHTML(id, a, s.datum, haken.has(a.id), `${JEDES[(a.jedes || 1) - 1][1]}${wieder ? ` – wieder ${tagText(wieder, tag) === 'morgen' ? 'morgen' : `am ${tagText(wieder, tag)}`}` : ''}`);
  }).join('')}</ul></details>` : '';
  const knopf = s.fertig
    ? `<button type="button" class="btn btn-quiet" data-act="h-nochmal" data-plan="${esc(id)}" data-datum="${esc(s.datum)}">${t.frei ? 'Neu anfangen' : 'Doch nicht erledigt'}</button>`
    : `<button type="button" class="btn btn-primary" data-act="h-fertig" data-plan="${esc(id)}" data-datum="${esc(s.datum)}">${ic('check')}${n ? 'Alles erledigt' : 'Erledigt'}</button>`;
  return `${putzKopf(p, unter)}
<div class="pm-fortschritt" aria-hidden="true"><i style="width:${pct}%"></i></div>
${stand}
<section class="pm-teil"><h3>Das brauchst du</h3>${materialHTML(id, p, s.datum)}</section>
<section class="pm-teil"><h3>Aufgaben</h3>${aufgaben}${nicht}</section>
${verlaufText(id, tag)}
<div class="pm-fuss">${knopf}<button type="button" class="btn btn-quiet" data-act="h-pm-bearbeiten">Bearbeiten</button></div>`;
}

/** Woran sich ein Knopf nach dem Neuzeichnen wiederfinden lässt (der Fokus bleibt, wo er war). */
function fokusWahl(el) {
  if (!el?.dataset?.act) return '';
  const e = (v) => window.CSS?.escape?.(v) ?? String(v).replace(/["\\]/g, '\\$&');
  return `[data-act="${e(el.dataset.act)}"]${el.dataset.aufgabe ? `[data-aufgabe="${e(el.dataset.aufgabe)}"]` : ''}${el.dataset.name ? `[data-name="${e(el.dataset.name)}"]` : ''}`;
}

/** Das Fenster zeichnen – den Editor nur beim Wechsel (sonst wäre Getipptes weg). */
function putzZeichnen({ editor = false } = {}) {
  const inhalt = $('#pm-inhalt');
  if (!pm || !inhalt) return;
  if (pm.modus === 'putzen') {
    if (!haus().plaene[pm.id]) { putzZu(); return; }
    const y = inhalt.scrollTop;
    const fokus = inhalt.contains(document.activeElement) ? fokusWahl(document.activeElement) : '';
    inhalt.innerHTML = putzHTML();
    inhalt.scrollTop = y;
    try { if (fokus) inhalt.querySelector(fokus)?.focus({ preventScroll: true }); } catch { /* dann eben nicht */ }
  } else if (editor) {
    inhalt.innerHTML = `${putzKopf(pm.id ? haus().plaene[pm.id] : null, pm.id ? 'Bearbeiten' : '')}${editorHTML()}`;
    inhalt.scrollTop = 0;
  }
}

/** Von außen (das andere Handy): neu zeichnen, wenn offen. */
function putzNeu() {
  if (!istOffen()) return;
  if (pm.id && !haus().plaene[pm.id]) { putzZu(); melde('Den Putztag gibt es nicht mehr.'); return; }
  if (pm.modus === 'putzen') putzZeichnen();
}

function putzAuf(neu) {
  pm = neu;
  const d = dlg();
  if (!d) return;
  if (d.open) { putzZeichnen({ editor: true }); return; }
  d.innerHTML = '<div class="pm-rahmen" id="pm-inhalt"></div>';
  // Die Meldung unten muss mit ins Fenster (es liegt über allem)
  const toast = $('#toast');
  if (toast) d.append(toast);
  putzZeichnen({ editor: true });
  document.documentElement.classList.add('pm-offen');
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}

/** Einen Putztag öffnen – zum Putzen. */
function putzOeffnen(id) { if (haus().plaene[id]) putzAuf({ id, modus: 'putzen' }); }
/** Bearbeiten (id) oder einen neuen anlegen (raum). */
function bearbeiten(id, { raum = '' } = {}) {
  teil = 'putzplan';
  merken();
  putzAuf({ id: id || null, modus: 'bearbeiten', raum });
}

function aufraeumen() {
  pm = null;
  document.documentElement.classList.remove('pm-offen');
  const toast = $('#putzmodus #toast');
  if (toast) $('#app')?.append(toast);
}
function putzZu() {
  const d = dlg();
  if (d?.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  aufraeumen();
  haushaltZeichnen();
}

/* ----------------------------------------------------------------- Editor */

function editorHTML() {
  const h = haus();
  const p = pm.id ? h.plaene[pm.id] : null;
  const raum = pm.raum || p?.raum || 'kueche';
  const name = p?.name ?? (raum === 'sonstiges' ? '' : RAUM[raum].name);
  const aufgaben = p ? p.aufgaben : (VORLAGEN[raum] || []).map((t) => ({ id: neueId('a'), t }));
  const material = p ? p.material || [] : MATERIAL[raum] || [];
  const tageAn = new Set(p ? p.wdh.tage : [wochentag(heute())]);
  const wochen = p?.wdh.wochen || 1;
  const ab = p?.wdh.ab || '';
  const wer = p ? p.wer : '';
  const erinnern = p ? p.erinnern : 'morgens';
  const leute = namen();
  const wochenWahl = [[1, 'jede Woche'], [2, 'alle 2 Wochen'], [3, 'alle 3 Wochen'], [4, 'alle 4 Wochen']];
  return `<form class="h-editor" id="h-edit-form" data-vorlage="${p ? '' : raum}" data-mat-vorlage="${p ? '' : raum}" novalidate>
  <fieldset class="h-feld"><legend>Raum</legend><div class="h-raeume">${RAEUME.map(([k, rn]) => `<label class="h-raum-chip"><input type="radio" name="raum" value="${k}"${k === raum ? ' checked' : ''}>${raumBild(k, 22)}${esc(rn)}</label>`).join('')}</div></fieldset>
  <label class="h-feld"><span class="h-feld-t">Name</span><input class="h-input" name="name" maxlength="40" value="${esc(name)}" placeholder="z. B. Großputz" autocomplete="off" enterkeyhint="next"></label>
  <fieldset class="h-feld"><legend>Das brauchst du</legend>
    <ul class="h-mat-edit" id="h-mat-edit">${material.map(matZeile).join('')}</ul>
    <div class="h-mat-neu"><input class="h-input" id="h-mat-input" maxlength="60" placeholder="Material dazu, z. B. Kalkreiniger" aria-label="Material dazu" autocomplete="off" enterkeyhint="done"><button type="button" class="btn btn-klein" data-act="h-mat-neu">${ic('plus')}Dazu</button></div>
    <div class="h-vorschlaege" id="h-mat-vorschlaege">${matVorschlaegeHTML(raum, material)}</div>
  </fieldset>
  <fieldset class="h-feld"><legend>Aufgaben</legend>
    <ol class="h-aufg-edit" id="h-aufg-edit">${aufgaben.map((a) => aufgabeZeile(a)).join('')}</ol>
    <div class="h-aufg-mehr"><button type="button" class="btn btn-klein" data-act="h-aufg-neu">${ic('plus')}Aufgabe</button></div>
    <div class="h-vorschlaege" id="h-vorschlaege">${vorschlaegeHTML(raum, aufgaben)}</div>
    <p class="fine">„jedes 2. Mal“: Die Aufgabe ist nur bei jedem zweiten Putztag dran – etwa die Armaturen.</p>
  </fieldset>
  <fieldset class="h-feld"><legend>Wann</legend>
    <div class="h-tage">${WOCHENTAGE.map(([n, kurz, lang]) => `<label class="h-tag" title="${lang}"><input type="checkbox" name="tag" value="${n}"${tageAn.has(n) ? ' checked' : ''}><span>${kurz}</span></label>`).join('')}</div>
    <div class="h-wochen"><select name="wochen" class="h-input" aria-label="Wie oft">${wochenWahl.map(([w, t]) => `<option value="${w}"${w === wochen ? ' selected' : ''}>${t}</option>`).join('')}</select>
    <label class="h-ab"${wochen > 1 ? '' : ' hidden'}><span>das erste Mal</span><input type="date" name="ab" class="h-input" value="${esc(ab)}"></label></div>
    <p class="fine" id="h-wdh-text">${esc(wdhVorschau(tageAn, wochen))}</p>
  </fieldset>
  ${leute.length > 1 || wer ? `<fieldset class="h-feld"><legend>Wer</legend><div class="h-wahl">${[['', 'Ihr beide'], ...leute.map((n) => [n, n])].map(([w, t]) => `<label class="h-raum-chip"><input type="radio" name="wer" value="${esc(w)}"${(w || '').toLowerCase() === (wer || '').toLowerCase() ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div></fieldset>` : ''}
  <fieldset class="h-feld"${istEigen() ? ' hidden' : ''}><legend>Erinnerung per Push</legend><div class="h-wahl">${ERINNERN.map(([w, t]) => `<label class="h-raum-chip"><input type="radio" name="erinnern" value="${w}"${w === erinnern ? ' checked' : ''}>${esc(t)}${ERINNERN_UHR[w] ? ` <small>${esc(ERINNERN_UHR[w].replace('gegen ', ''))}</small>` : ''}</label>`).join('')}</div>
  <p class="fine">„Heute ist ${esc(name || 'Küche')} dran“ – an dem Tag, an ${wer ? esc(wer) : 'euch beide'}. Push-Nachrichten schaltet jedes Handy in den Einstellungen ein („Putzplan“).</p></fieldset>
  <div class="h-edit-btns"><button type="submit" class="btn btn-primary">Speichern</button><button type="button" class="btn btn-quiet" data-act="h-edit-zu">Abbrechen</button>${p ? `<button type="button" class="btn btn-quiet h-loeschen" data-act="h-plan-weg" data-plan="${esc(pm.id)}">Löschen</button>` : ''}</div>
</form>`;
}

const matZeile = (m) => `<li class="h-mat" data-material="${esc(m)}">${zutatImg('', { name: m, cat: 'haushalt', klasse: 'h-sache-bild', groesse: 20 })}<span>${esc(m)}</span><button type="button" class="h-mat-x" data-act="h-mat-weg" aria-label="${esc(m)} weg">${X}</button></li>`;

function matVorschlaegeHTML(raum, material) {
  const da = new Set(material.map(gleichName));
  const frei = (MATERIAL[raum] || []).filter((m) => !da.has(gleichName(m)));
  if (!frei.length) return '';
  return `<span class="h-vorschlaege-t">Vorschläge:</span>${frei.map((m) => `<button type="button" class="h-vorschlag-btn" data-act="h-mat-vorschlag" data-t="${esc(m)}">${ic('plus')}${esc(m)}</button>`).join('')}`;
}

const aufgabeZeile = (a) => `<li><div class="h-aufg-zeile"><input class="h-input" data-aufgabe-id="${esc(a.id)}" value="${esc(a.t)}" maxlength="120" aria-label="Aufgabe" autocomplete="off" enterkeyhint="next"><button type="button" class="x" data-act="h-aufg-weg" aria-label="Aufgabe weg">${X}</button></div>
<div class="h-aufg-wie"><select class="h-jedes" aria-label="Wie oft diese Aufgabe">${JEDES.map(([n, t]) => `<option value="${n}"${n === (a.jedes || 1) ? ' selected' : ''}>${t}</option>`).join('')}</select><button type="button" class="e-pfeil" data-act="h-aufg-hoch" aria-label="Weiter nach oben">${HOCH}</button><button type="button" class="e-pfeil" data-act="h-aufg-runter" aria-label="Weiter nach unten">${RUNTER}</button></div></li>`;

function vorschlaegeHTML(raum, aufgaben) {
  const da = new Set(aufgaben.map((a) => gleichName(a.t)));
  const frei = (VORLAGEN[raum] || []).filter((t) => !da.has(gleichName(t)));
  if (!frei.length) return '';
  return `<span class="h-vorschlaege-t">Vorschläge:</span>${frei.map((t) => `<button type="button" class="h-vorschlag-btn" data-act="h-aufg-vorschlag" data-t="${esc(t)}">${ic('plus')}${esc(t)}</button>`).join('')}`;
}

function wdhVorschau(tageAn, wochen) {
  const tage = [...tageAn].map(Number).filter((t) => t >= 1 && t <= 7);
  if (!tage.length) return 'Ohne Tag: steht unter „Zwischendurch“, zum Abhaken, wann es passt – ohne Erinnerung.';
  return `Also ${wdhText({ tage, wochen })}.`;
}

/** Was im Editor steht, als Putztag. */
function editorLesen() {
  const f = $('#h-edit-form');
  if (!f) return null;
  const d = new window.FormData(f);
  const raum = String(d.get('raum') || 'sonstiges');
  const name = String(d.get('name') || '').replace(/\s+/g, ' ').trim().slice(0, 40) || RAUM[raum]?.name || 'Putztag';
  const ids = new Set();
  const aufgaben = $$('#h-aufg-edit > li', f).map((li) => {
    const el = li.querySelector('input');
    const t = el.value.replace(/\s+/g, ' ').trim().slice(0, 120);
    let id = el.dataset.aufgabeId || neueId('a');
    if (ids.has(id)) id = neueId('a');
    ids.add(id);
    const jedes = Number(li.querySelector('.h-jedes')?.value) || 1;
    return jedes > 1 ? { id, t, jedes } : { id, t };
  }).filter((a) => a.t).slice(0, 30);
  const material = $$('#h-mat-edit [data-material]', f).map((li) => li.dataset.material);
  // Was noch im Feld steht, gehört dazu
  const offen = $('#h-mat-input')?.value.replace(/\s+/g, ' ').trim();
  if (offen && !material.some((m) => gleichName(m) === gleichName(offen))) material.push(offen.slice(0, 60));
  const tageAn = d.getAll('tag').map(Number).filter((t) => t >= 1 && t <= 7);
  const wochen = Math.max(1, Math.min(4, Number(d.get('wochen')) || 1));
  let ab = String(d.get('ab') || '');
  const alt = pm?.id ? haus().plaene[pm.id] : null;
  if (wochen === 1) ab = alt?.wdh.ab && alt.wdh.wochen === 1 ? alt.wdh.ab : heute();
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(ab)) ab = naechsterTermin({ wdh: { tage: tageAn, wochen: 1, ab: heute() } }, plusTage(heute(), -1)) || heute();
  return { name, raum, aufgaben, material: material.slice(0, 20), wdh: { tage: tageAn, wochen, ab }, wer: String(d.get('wer') || ''), erinnern: String(d.get('erinnern') ?? 'morgens') };
}

function materialDazu(roh) {
  const m = String(roh || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const ul = $('#h-mat-edit');
  if (!m || !ul) return;
  if ($$('[data-material]', ul).some((li) => gleichName(li.dataset.material) === gleichName(m))) { melde(`„${m}“ steht schon drin`); return; }
  ul.insertAdjacentHTML('beforeend', matZeile(m));
  matVorschlaegeNeu();
}
function matVorschlaegeNeu() {
  const f = $('#h-edit-form');
  if (!f) return;
  const raum = new window.FormData(f).get('raum') || 'sonstiges';
  $('#h-mat-vorschlaege').innerHTML = matVorschlaegeHTML(raum, $$('#h-mat-edit [data-material]', f).map((li) => li.dataset.material));
}

/* ------------------------------------------------------------- Vorschlag */

function vorschlagAnlegen() {
  // Los geht es morgen (nichts ist sofort fällig); das erste Mal je Plan: der nächste passende Tag
  const h = plusTage(heute(), 1);
  const ab = (tageAn) => naechsterTermin({ wdh: { tage: tageAn, wochen: 1, ab: h } }, plusTage(h, -1)) || h;
  const plaene = [
    ['kueche', [1, 4], 1], ['wohnzimmer', [3], 1], ['bad', [6], 1], ['schlafzimmer', [7], 2], ['wohnung', [6], 4],
  ].map(([raum, tageAn, wochen]) => ({
    name: RAUM[raum].name, raum, aufgaben: VORLAGEN[raum].map((t) => ({ id: neueId('a'), t })), material: MATERIAL[raum],
    wdh: { tage: tageAn, wochen, ab: wochen === 1 ? h : ab(tageAn) }, wer: '', erinnern: 'morgens',
  }));
  app.aendern(plaene.map((p) => opPlan(neueId('pp'), p, ich())));
  melde('Putzplan angelegt – ab morgen. Antippen öffnet einen Tag, dort lässt er sich bearbeiten.');
}

/* ------------------------------------------------------------------ Gerüst */

/** Einmal: die festen Teile (das Eingabefeld bleibt beim Neuzeichnen stehen). */
function gerippeBauen() {
  const v = $('#view-haushalt');
  if (!v || gerippe) return !!v;
  v.innerHTML = `<button type="button" class="back nur-breit" data-tab="rezepte">${ic('back')}Alle Rezepte</button>
<div class="h-kopf" id="h-kopf"></div>
<div class="h-putz" id="h-putz"><div id="h-plaene"></div></div>
<div class="h-sachen-teil" id="h-sachen-teil" hidden>
  <form class="addform h-sach-form" id="h-sach-form" autocomplete="off"><input id="h-sach-input" type="text" placeholder="Was brauchst du? z. B. Spülmittel" aria-label="Haushaltssache" enterkeyhint="done" maxlength="60" list="h-sach-ideen"><datalist id="h-sach-ideen">${SACH_BEREICHE.flatMap(([, , , v]) => v).map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist><button type="submit" aria-label="Auf die Einkaufsliste">${ic('plus')}</button></form>
  <div id="h-sachen"></div>
</div>`;
  gerippe = true;
  return true;
}

/** Den Reiter zeichnen (und ein offenes Fenster mitziehen). */
export function haushaltZeichnen({ immer = false } = {}) {
  haushaltZahl();
  putzNeu();
  const sichtbar = ansicht.tab === 'haushalt';
  if (!sichtbar && !immer) { veraltet = true; return; }
  if (!gerippeBauen()) return;
  veraltet = false;
  const h = haus();
  const tag = heute();
  $('#h-kopf').innerHTML = kopfHTML(h, tag);
  $('#h-putz').hidden = teil !== 'putzplan';
  $('#h-sachen-teil').hidden = teil !== 'sachen';
  if (teil === 'putzplan') $('#h-plaene').innerHTML = plaeneHTML(h, tag);
  else $('#h-sachen').innerHTML = sachenHTML(h);
}

/** Beim Wechsel in den Reiter: was inzwischen kam, zeichnen. */
export function haushaltGezeigt() { if (veraltet || ansicht.tab === 'haushalt') haushaltZeichnen(); }

/* ------------------------------------------------------------------ Klicks */

function haken(el) {
  const { plan: planId, aufgabe, datum } = el.dataset;
  const h = haus();
  const p = h.plaene[planId];
  if (!p || !datum) return;
  const t = termin(p, h.stand[planId], heute());
  const jetzt = t.datum === datum ? t.haken : hakenAm(planId, datum);
  const an = !jetzt.includes(aufgabe);
  const dran = aufgabenAm(p, datum);
  app.aendern(opPutzHaken(planId, datum, aufgabe, an, ich()));
  // Das letzte, was dran war: Fenster zu, Tier
  const alle = an && dran.some((a) => a.id === aufgabe) && dran.every((a) => a.id === aufgabe || jetzt.includes(a.id));
  if (alle) {
    if (istOffen()) putzZu();
    feiern(planId, p, datum);
  }
}

/** Das Lob für einen fertigen Putztag (je Tag einmal); still: ohne Meldung, wenn es schon da war. */
function feiern(planId, p, datum, { still = false } = {}) {
  lobGross({ rezept: { id: `putz:${planId}:${datum}`, short: p.name, name: p.name }, name: ich(), grund: 'geputzt' })
    .then((da) => { if (!da && !still) melde(`${p.name}: alles erledigt ✓`); });
}

/** Etwas auf die Einkaufsliste – oder wieder runter (Haushaltssachen und Material im Putztag). */
function wagen(name, { sache = '', bereich = '' } = {}) {
  const k = aufListe(name);
  if (k) {
    const d = app.stand.items[k];
    if (teileVon(d).length) { melde(`„${d.name}“ steht für ein Rezept auf der Liste – dort abhaken oder löschen.`); return; }
    app.aendern(opLoeschen(k));
    melde(`„${d.name}“ wieder runter von der Liste`, { knopf: 'Rückgängig', beiKnopf: () => aufDieListe(d.name, { cat: 'haushalt' }) });
    return;
  }
  // Was fehlt, ist eine Haushaltssache – gemerkt wird es (einmal)
  if (!sache && !Object.values(haus().sachen).some((x) => gleichName(x.name) === gleichName(name))) app.aendern(opSache(neueId('hs'), { name, bereich: bereich || bereichRaten(name) }, ich()));
  const r = aufDieListe(name, { cat: 'haushalt' });
  if (r.art === 'neu') melde(`„${r.name}“ steht auf der Einkaufsliste`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opLoeschen(r.k)) });
}

function sacheTippen(el) {
  const h = haus();
  const id = el.dataset.sache || '';
  const x = id ? h.sachen[id] : { name: el.dataset.name, bereich: el.dataset.bereich };
  if (!x?.name) return;
  wagen(x.name, { sache: id, bereich: x.bereich });
}

function sacheEintragen(roh) {
  const name = String(roh || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name) return;
  const h = haus();
  const da = Object.entries(h.sachen).find(([, x]) => gleichName(x.name) === gleichName(name));
  if (!da) app.aendern(opSache(neueId('hs'), { name, bereich: bereichRaten(name) }, ich()));
  const r = aufDieListe(da ? da[1].name : name, { cat: 'haushalt' });
  if (r.art === 'schon') melde(`Steht schon auf der Einkaufsliste: „${r.name}“`);
  else melde(`„${r.name}“ steht auf der Einkaufsliste`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opLoeschen(r.k)) });
}

/** Einen Putztag als erledigt (alles, was dran ist) – mit Rückgängig. */
function fertigMachen(planId, datum) {
  const h = haus();
  const p = h.plaene[planId];
  if (!p || !datum) return;
  const t = termin(p, h.stand[planId], heute());
  const vorher = [...(t.datum === datum ? t.haken : hakenAm(planId, datum))];
  if (istOffen()) putzZu();
  app.aendern(opPutzFertig(planId, datum, true, ich()));
  feiern(planId, p, datum, { still: true });
  melde(`${p.name}: erledigt`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern([opPutzFertig(planId, datum, false, ich()), ...vorher.map((a) => opPutzHaken(planId, datum, a, true, ich()))]) });
}

function nochmal(planId, datum) {
  const h = haus();
  const p = h.plaene[planId];
  if (!p) return;
  const t = termin(p, h.stand[planId], heute());
  // Ohne festen Tag: eine neue Runde ab heute; sonst der Tag wieder offen
  app.aendern(opPutzFertig(planId, t.frei ? heute() : datum || t.datum, false, ich()));
}

function planLoeschen(planId) {
  const h = haus();
  const p = h.plaene[planId];
  if (!p) return;
  const st = h.stand[planId] ? JSON.parse(JSON.stringify(h.stand[planId])) : null;
  if (istOffen()) putzZu();
  app.aendern(opPlan(planId, null));
  melde(`„${p.name}“ gelöscht`, {
    knopf: 'Rückgängig',
    beiKnopf: () => app.aendern([opPlan(planId, p, p.by), ...(st && st.fertig ? [opPutzFertig(planId, st.datum, true, st.fertig.by)] : (st?.haken || []).map((a) => opPutzHaken(planId, st.datum, a, true, ich())))]),
  });
}

/** Eine Zeile im Editor nach oben oder unten. */
function umstellen(el, hoch) {
  const li = el.closest('li');
  if (!li) return;
  const ziel = hoch ? li.previousElementSibling : li.nextElementSibling;
  if (!ziel) return;
  if (hoch) ziel.before(li); else ziel.after(li);
  el.focus();
}

/** Klicks im Reiter und im Fenster. true, wenn es hierher gehörte. */
export function klickHaushalt(el) {
  const act = el.dataset.act || '';
  if (!act.startsWith('h-')) return false;
  switch (act) {
    case 'h-teil':
      teil = el.dataset.teil === 'sachen' ? 'sachen' : 'putzplan';
      merken();
      haushaltZeichnen();
      return true;
    case 'h-oeffnen': putzOeffnen(el.dataset.plan); return true;
    case 'h-pm-zu': putzZu(); return true;
    case 'h-pm-bearbeiten': if (pm?.id) { pm.modus = 'bearbeiten'; putzZeichnen({ editor: true }); } return true;
    case 'h-pm-bereit': {
      if (!pm?.id) return true;
      const p = haus().plaene[pm.id];
      const s = sitzung(pm.id, p, termin(p, haus().stand[pm.id], heute()), heute());
      bereitSetzen(pm.id, s.datum, el.dataset.name);
      putzZeichnen();
      return true;
    }
    case 'h-pm-wagen': wagen(el.dataset.name); return true;
    case 'h-pm-material-vorschlag': {
      const p = pm?.id ? haus().plaene[pm.id] : null;
      if (p) app.aendern(opPlan(pm.id, { ...p, material: MATERIAL[p.raum] || [] }, p.by));
      return true;
    }
    case 'h-haken': haken(el); return true;
    case 'h-fertig': fertigMachen(el.dataset.plan, el.dataset.datum); return true;
    case 'h-nochmal': nochmal(el.dataset.plan, el.dataset.datum); return true;
    case 'h-neu': bearbeiten(null, { raum: el.dataset.raum || '' }); return true;
    case 'h-vorschlag': vorschlagAnlegen(); return true;
    case 'h-edit-zu':
      if (pm?.id && haus().plaene[pm.id]) { pm.modus = 'putzen'; putzZeichnen(); } else putzZu();
      return true;
    case 'h-plan-weg': planLoeschen(el.dataset.plan); return true;
    case 'h-aufg-neu': {
      const ol = $('#h-aufg-edit');
      ol.insertAdjacentHTML('beforeend', aufgabeZeile({ id: neueId('a'), t: '' }));
      ol.lastElementChild.querySelector('input').focus();
      return true;
    }
    case 'h-aufg-weg': el.closest('li')?.remove(); vorschlaegeNeu(); return true;
    case 'h-aufg-hoch': umstellen(el, true); return true;
    case 'h-aufg-runter': umstellen(el, false); return true;
    case 'h-aufg-vorschlag':
      $('#h-aufg-edit').insertAdjacentHTML('beforeend', aufgabeZeile({ id: neueId('a'), t: el.dataset.t }));
      vorschlaegeNeu();
      return true;
    case 'h-mat-neu': { const f = $('#h-mat-input'); materialDazu(f?.value); if (f) { f.value = ''; f.focus(); } return true; }
    case 'h-mat-weg': el.closest('li')?.remove(); matVorschlaegeNeu(); return true;
    case 'h-mat-vorschlag': materialDazu(el.dataset.t); return true;
    case 'h-sache': sacheTippen(el); return true;
    case 'h-sache-weg': {
      const x = haus().sachen[el.dataset.sache];
      if (!x) return true;
      app.aendern(opSache(el.dataset.sache, null));
      melde(`„${x.name}“ vergessen`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opSache(el.dataset.sache, x, x.by)) });
      return true;
    }
    case 'h-sachen-bearbeiten': sachenBearbeiten = !sachenBearbeiten; haushaltZeichnen(); return true;
    case 'h-todo-jetzt':
      app.aendern(opTodoWunsch(ich(), 'abgleichen'));
      melde('Gleich abgeglichen – das dauert etwa eine Minute.');
      return true;
    case 'h-todo-einst':
      zeigeReiter('einstellungen');
      window.requestAnimationFrame(() => $('#e-todo')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }));
      return true;
    default: return false;
  }
}

function vorschlaegeNeu() {
  const f = $('#h-edit-form');
  if (!f) return;
  const raum = new window.FormData(f).get('raum') || 'sonstiges';
  const aufgaben = $$('#h-aufg-edit input', f).map((el) => ({ t: el.value }));
  $('#h-vorschlaege').innerHTML = vorschlaegeHTML(raum, aufgaben);
}

/** Änderungen im Editor (Raum, Tage, wie oft). true, wenn es hierher gehörte. */
export function aenderungHaushalt(el) {
  const f = el.closest?.('#h-edit-form');
  if (!f) return false;
  if (el.name === 'raum') {
    const name = f.querySelector('input[name="name"]');
    // Steht im Namen nur ein Raum (oder nichts)? Dann der neue
    if (!name.value.trim() || RAEUME.some(([, rn]) => rn === name.value.trim())) name.value = el.value === 'sonstiges' ? '' : RAUM[el.value].name;
    // Noch keine Aufgaben – oder genau die Vorlage des vorigen Raums? Dann die des neuen (beim Material genauso)
    const jetzt = $$('#h-aufg-edit input', f).map((x) => x.value.trim()).filter(Boolean);
    const vorlage = VORLAGEN[f.dataset.vorlage] || null;
    if (!jetzt.length || (vorlage && jetzt.join('|') === vorlage.join('|'))) {
      $('#h-aufg-edit').innerHTML = (VORLAGEN[el.value] || []).map((t) => aufgabeZeile({ id: neueId('a'), t })).join('');
      f.dataset.vorlage = el.value;
    }
    const mat = $$('#h-mat-edit [data-material]', f).map((li) => li.dataset.material);
    const matVorlage = MATERIAL[f.dataset.matVorlage] || null;
    if (!mat.length || (matVorlage && mat.join('|') === matVorlage.join('|'))) {
      $('#h-mat-edit').innerHTML = (MATERIAL[el.value] || []).map(matZeile).join('');
      f.dataset.matVorlage = el.value;
    }
    vorschlaegeNeu();
    matVorschlaegeNeu();
    return true;
  }
  if (el.name === 'tag' || el.name === 'wochen') {
    const d = new window.FormData(f);
    const wochen = Number(d.get('wochen')) || 1;
    const abFeld = f.querySelector('.h-ab');
    abFeld.hidden = wochen === 1;
    const abInput = f.querySelector('input[name="ab"]');
    const tageAn = d.getAll('tag').map(Number);
    if (wochen > 1 && !abInput.value && tageAn.length) abInput.value = naechsterTermin({ wdh: { tage: tageAn, wochen: 1, ab: heute() } }, plusTage(heute(), -1)) || '';
    $('#h-wdh-text').textContent = wdhVorschau(new Set(tageAn), wochen);
    return true;
  }
  return true;
}

/** Enter in einer Aufgabe: die nächste Zeile statt Speichern; im Material-Feld: dazu. */
export function tasteHaushalt(el) {
  if (el?.matches?.('#h-mat-input')) { materialDazu(el.value); el.value = ''; return true; }
  if (!el?.matches?.('#h-aufg-edit input')) return false;
  const li = el.closest('li');
  if (!el.value.trim()) return true;
  if (li.nextElementSibling) li.nextElementSibling.querySelector('input')?.focus();
  else { li.insertAdjacentHTML('afterend', aufgabeZeile({ id: neueId('a'), t: '' })); li.nextElementSibling.querySelector('input').focus(); }
  return true;
}

/** Formulare: eine Haushaltssache eintragen, den Editor speichern. */
export function absendenHaushalt(ev) {
  if (ev.target.id === 'h-sach-form') {
    ev.preventDefault();
    const feld = $('#h-sach-input');
    sacheEintragen(feld.value);
    feld.value = '';
    return true;
  }
  if (ev.target.id === 'h-edit-form') {
    ev.preventDefault();
    const plan = editorLesen();
    if (!plan || !pm) return true;
    const neu = !pm.id;
    const id = pm.id || neueId('pp');
    const alt = pm.id ? haus().plaene[pm.id] : null;
    app.aendern(opPlan(id, plan, alt?.by || ich()));
    const t = termin(plan, haus().stand[id], heute());
    if (neu) putzZu();
    else { pm.modus = 'putzen'; putzZeichnen(); }
    melde(t.frei ? `„${plan.name}“ gespeichert – unter „Zwischendurch“` : t.art === 'heute' ? `„${plan.name}“ gespeichert – heute dran` : `„${plan.name}“ gespeichert – ${t.datum ? `als Nächstes ${tagText(t.datum, heute())}` : 'ohne Termin'}`);
    return true;
  }
  return false;
}

/** Beim Start: um Mitternacht (und wenn die App wieder vorne ist) neu – dann ist ein anderer Tag dran. Und das Fenster. */
export function haushaltStart() {
  let tag = heute();
  const pruefen = () => { if (heute() !== tag) { tag = heute(); haushaltZeichnen({ immer: ansicht.tab === 'haushalt' }); } };
  setInterval(pruefen, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pruefen(); });
  // Esc oder „zurück“: beim Bearbeiten erst zurück zum Putztag, sonst zu
  dlg()?.addEventListener('cancel', (ev) => {
    if (ev.cancelable && pm?.modus === 'bearbeiten' && pm.id && haus().plaene[pm.id]) { ev.preventDefault(); pm.modus = 'putzen'; putzZeichnen(); return; }
    aufraeumen();
    haushaltZeichnen();
  });
  dlg()?.addEventListener('close', () => { if (pm) { aufraeumen(); haushaltZeichnen(); } });
  // „Diesmal nicht dran“ bleibt offen, wenn neu gezeichnet wird („toggle“ steigt nicht auf)
  dlg()?.addEventListener('toggle', (ev) => { if (pm && ev.target?.matches?.('.pm-nicht')) pm.nichtAuf = ev.target.open; }, true);
  haushaltZahl();
}
