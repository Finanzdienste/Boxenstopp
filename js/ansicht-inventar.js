/*
 * Ihr Bereich → Sachen: eigene Listen für alles, was sie hat – Kleidung,
 * Make-up, Schmuck, Bücher … (inventar.js rechnet, hier wird gezeichnet).
 * Bei Tobi und Amy sind es Amys Sachen (in der gemeinsamen Liste, Tobi sieht
 * sie auch), in einer eigenen Liste die des Gasts (Marielle).
 *
 * Drei Ansichten: alle Listen (mit Suche und „Hab ich das schon?“), eine
 * Liste (sortiert, nach Tags gefiltert, in eigener Reihenfolge) und eine
 * Sache: Foto, Name, Marke, Liste, Tags, Notiz und die Nummer unter dem
 * Strichcode. Gespeichert wird beim Tippen wie bei den Notizen; eine neue,
 * leere Sache verschwindet wieder, wenn man sie verlässt.
 *
 * Fotos kommen auf 1200 px verkleinert als eigene Datei ins Daten-Repo der
 * Liste (sachen/sd-…-….jpg, speicher.js dateiHochladen) – in liste.json steht
 * nur der Pfad. Geholt werden sie mit dem Schlüssel und liegen dann im Vorrat
 * FOTOS des Geräts, auch ohne Netz. Ein Foto, das keine Sache mehr braucht
 * (gelöscht, ersetzt), räumt die App weg, wenn die Zeit für „Rückgängig“ um
 * ist (WEG).
 *
 * Strichcode: Chrome auf Android liest ihn selbst (BarcodeDetector), sonst –
 * Safari auf iPhone und iPad kann das nicht – liest ihn die KI vom Foto
 * (inventar-ki.js), oder man tippt die Ziffern ab. Mit dem Code sagt die App,
 * ob es die Sache schon gibt („Hab ich das schon?“). Ein Foto füllt mit der KI
 * auch Name, Marke, Liste und Tags aus – nur, was noch leer ist.
 *
 * Nachschlagen (inventar-netz.js): „Scannen“ in einer Liste liest den Code,
 * schlägt ihn in Open Beauty Facts und den verwandten Datenbanken nach und
 * legt die Sache gleich an – mit Name, Marke und deren Bild als Foto. Kennen
 * sie ihn nicht, sucht mit einem Schlüssel von Anthropic Claude im Internet
 * (ohne Bild). Ebenso nach dem Scannen in einer Sache, der noch etwas fehlt
 * (Claude nur, wenn sie noch keinen Namen hat), mit „Im Netz nachschlagen“
 * und bei „Eintragen“ nach „Hab ich das schon?“. Eingetragen wird nur, was
 * noch leer ist; die Sache zeigt, wo es herkommt.
 */
import { app, $, $$, melde, lese, schreibe } from './kern.js';
import { esc } from './format.js';
import { istEigen } from './profil.js';
import { opZusammen } from './liste.js';
import { bildPfad, INVENTAR_BILDER } from './bilder.js';
import { tagsBereinigen, tagFarbe, MAX_TAGS } from './amy.js';
import { dateiHochladen, dateiHolen, dateiLoeschen } from './speicher.js';
import { ortVon, ladeKi } from './zugang.js';
import { kiAnfragen, kiMitWerkzeugen, anbieterVon } from './ki.js';
import { fotoVorbereiten } from './ansicht-ki.js';
import { jsonAus } from './amy-import.js';
import { rumpfErkennen, erkanntBereinigen } from './inventar-ki.js';
import { nachschlagen, rumpfNachschlagen, gesuchtBereinigen } from './inventar-netz.js';
import {
  FOTO_PFAD, LISTEN_VORSCHLAEGE, SORTEN, MAX_NAME, MAX_MARKE, MAX_NOTIZ, MAX_LISTEN, MAX_DINGE,
  neueListeId, neueDingId, fotoPfad, codeBereinigen, opInvListe, opInvListeWeg, opDing, opDingWeg,
  listenVon, dingeIn, naechsteReihe, sortiert, tagsVon, mitTag, suchen, mitCode, dingLeer, dingName, verschieben,
} from './inventar.js';

const ANSICHT = 'boxenstopp.inventar.ansicht.v1'; // { liste, ding, tag, sort: { <sl-…>: 'name' } } – nur auf diesem Gerät
const WEG = 'boxenstopp.inventar.weg.v1'; // Fotos zum Wegräumen: [{ pfad, sha, at }]
const FOTOS = 'boxenstopp-sachen-v1'; // der Vorrat der Fotos (sw.js lässt ihn bei Updates stehen)
const OHNE = 'ohne'; // „Ohne Liste“: Sachen, deren Liste es nicht mehr gibt
const SPEICHERN_NACH = 700;
const KANTE = 1200; // Fotos der Sachen
const KANTE_CODE = 1600; // Fotos vom Strichcode – größer, damit die KI die Ziffern lesen kann
const RUECKGAENGIG = 9000; // so lange wartet ein Foto, bevor es wegkommt (die Meldung mit „Rückgängig“ steht 6 s)
const TAG_VORSCHLAEGE = ['Lieblingsstück', 'Sommer', 'Winter', 'Arbeit', 'Ausgehen', 'schwarz', 'weiß', 'neu'];

const PLUS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ZURUECK = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const KAMERA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>';
const STRICHCODE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/></svg>';
const FUNKEN = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>';

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const gleich = (a, b) => String(a).toLocaleLowerCase('de') === String(b).toLocaleLowerCase('de');

let zustand = (() => {
  const z = lese(ANSICHT, null) || {};
  return {
    liste: typeof z.liste === 'string' ? z.liste : null,
    ding: typeof z.ding === 'string' ? z.ding : null,
    tag: typeof z.tag === 'string' ? z.tag : '',
    sort: istObj(z.sort) ? z.sort : {},
    suche: '',
    ordnen: false,
    neu: false,
    bearbeiten: false,
  };
})();
let timer = null;
let formBild = 'womans-clothes';
const merken = () => schreibe(ANSICHT, { liste: zustand.liste, ding: zustand.ding, tag: zustand.tag, sort: zustand.sort });
const inv = () => app.stand.inventar || { listen: {}, dinge: {} };
const liste = (id) => (id && inv().listen[id]) || null;
const ding = (id) => (id && inv().dinge[id]) || null;
const listenName = (l) => (l ? String(l.name || '').trim() || 'Ohne Namen' : 'Ohne Liste');
const neuZeichnen = () => app.amyNeuZeichnen?.();
const ort = () => ortVon(app.zugang);

/** Wie viele Sachen es gibt (für den Schalter oben). */
export const inventarZahl = () => Object.keys(app.stand.inventar?.dinge || {}).length;

/* ------------------------------------------------------------------ Fotos */

const urls = new Map(); // pfad → Objekt-URL des Fotos
const laedt = new Set();
const vorschau = new Map(); // ding-id → Objekt-URL des Fotos, das gerade hochlädt
const letztes = new Map(); // ding-id → das zuletzt aufgenommene Foto als base64 (für die KI, ohne es neu zu holen)
const laeuft = new Map(); // ding-id → 'foto' | 'ki' | 'code' | 'netz' | 'suche'
const fotoSchluessel = (pfad) => new URL(`__sachen/${pfad}`, location.href).href;

async function ausVorrat(pfad) {
  try {
    const r = await (await caches.open(FOTOS)).match(fotoSchluessel(pfad));
    return r ? await r.blob() : null;
  } catch { return null; }
}
async function inVorrat(pfad, blob) {
  try { await (await caches.open(FOTOS)).put(fotoSchluessel(pfad), new Response(blob, { headers: { 'content-type': 'image/jpeg' } })); } catch { /* ohne Vorrat geht es auch */ }
}
async function ausDemVorratWeg(pfad) {
  try { await (await caches.open(FOTOS)).delete(fotoSchluessel(pfad)); } catch { /* egal */ }
  const u = urls.get(pfad);
  if (u) { URL.revokeObjectURL(u); urls.delete(pfad); }
}

/** Ein Foto holen: aus dem Vorrat des Geräts, sonst mit dem Schlüssel aus dem Daten-Repo. */
async function fotoLaden(pfad) {
  if (urls.has(pfad) || laedt.has(pfad) || !FOTO_PFAD.test(String(pfad))) return;
  laedt.add(pfad);
  try {
    let blob = await ausVorrat(pfad);
    if (!blob && app.zugang) {
      const roh = await dateiHolen(pfad, { token: app.zugang.token, ort: ort() });
      if (roh) { blob = new window.Blob([roh], { type: 'image/jpeg' }); inVorrat(pfad, blob); }
    }
    if (blob) { urls.set(pfad, URL.createObjectURL(blob)); fotosEinsetzen(); }
  } finally {
    laedt.delete(pfad);
  }
}

/** Fotos, die jetzt da sind, in die Seite – die fehlenden holen. */
function fotosEinsetzen(wurzel = document) {
  for (const img of wurzel.querySelectorAll('img[data-inv-foto]')) {
    const u = urls.get(img.dataset.invFoto);
    if (!u) { fotoLaden(img.dataset.invFoto); continue; }
    if (img.getAttribute('src') !== u) img.src = u;
    img.closest('.inv-bild')?.classList.add('hat-foto');
  }
}

/** Das Foto einer Sache als base64 (für die KI) – das eben aufgenommene oder das gespeicherte. */
async function fotoB64(d) {
  if (letztes.has(d.id)) return letztes.get(d.id);
  const pfad = d.foto?.pfad;
  if (!pfad) return '';
  await fotoLaden(pfad);
  const u = urls.get(pfad);
  if (!u) return '';
  const blob = await (await fetch(u)).blob();
  const f = await fotoVorbereiten(blob, KANTE);
  URL.revokeObjectURL(f.url);
  return f.b64;
}

/* -------------------------------------------- Wegräumen, was keiner braucht */

function wegMerken(foto) {
  if (!foto?.pfad) return;
  const w = (lese(WEG, []) || []).filter((x) => x?.pfad !== foto.pfad);
  w.push({ pfad: foto.pfad, sha: foto.sha || '', at: Date.now() });
  schreibe(WEG, w.slice(-200));
}
let raeumtAuf = false;
let aufraeumTimer = null;
const aufraeumenBald = () => { clearTimeout(aufraeumTimer); aufraeumTimer = setTimeout(aufraeumen, RUECKGAENGIG); };

/** Fotos aus WEG löschen, die keine Sache mehr braucht – erst, wenn die Zeit für „Rückgängig“ um ist. */
async function aufraeumen() {
  if (raeumtAuf || !app.zugang || !app.listeDa) return;
  const w = lese(WEG, []) || [];
  if (!w.length) return;
  raeumtAuf = true;
  try {
    const gebraucht = new Set(Object.values(inv().dinge).map((d) => d.foto?.pfad).filter(Boolean));
    const bleibt = [];
    for (const x of w) {
      if (!x?.pfad || gebraucht.has(x.pfad)) continue; // wieder da (Rückgängig) – vergessen
      if (Date.now() - Number(x.at || 0) < RUECKGAENGIG - 1000) { bleibt.push(x); continue; }
      const ok = await dateiLoeschen(x.pfad, x.sha, { token: app.zugang.token, ort: ort(), nachricht: `${app.name()}: altes Foto der Sachen weg` });
      if (ok) await ausDemVorratWeg(x.pfad); else bleibt.push(x);
    }
    schreibe(WEG, bleibt);
    if (bleibt.length) aufraeumenBald();
  } finally {
    raeumtAuf = false;
  }
}

/* --------------------------------------------------------------- Zeichnen */

const tagPille = (t, extra = '') => `<span class="amy-tag tf${tagFarbe(t)}${extra}">${esc(t)}</span>`;
const wann = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `heute ${uhr}`;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
};
const standText = (d) => (d ? `Gespeichert · ${wann(d.geaendert)}${d.by && d.by !== app.name() ? ` · zuletzt von ${d.by}` : ''}` : '');

/** Foto der Sache – oder das Bildchen ihrer Liste. */
function bildHTML(d, gross = false) {
  const pfad = d.foto?.pfad || '';
  const src = vorschau.get(d.id) || (pfad && urls.get(pfad)) || '';
  const foto = src || pfad ? `<img class="inv-foto-img"${pfad && !vorschau.has(d.id) ? ` data-inv-foto="${esc(pfad)}"` : ''}${src ? ` src="${esc(src)}"` : ''} alt="">` : '';
  return `<span class="inv-bild${gross ? ' gross' : ''}${src ? ' hat-foto' : ''}"><img class="inv-ersatz" src="${bildPfad(liste(d.liste)?.bild || 'package')}" alt="" aria-hidden="true">${foto}</span>`;
}

const pfeileHTML = (art, id, i, n) => `<span class="inv-pfeile"><button type="button" class="inv-pfeil" data-inv-hoch="${art}:${esc(id)}" aria-label="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="inv-pfeil" data-inv-runter="${art}:${esc(id)}" aria-label="Nach unten"${i === n - 1 ? ' disabled' : ''}>↓</button></span>`;

function dingKarte(d, { extra = '', mitListe = false } = {}) {
  const unter = [d.name.trim() && d.marke.trim() ? d.marke : '', mitListe ? listenName(liste(d.liste)) : ''].filter(Boolean);
  return `<li class="inv-ding-z"><button type="button" class="inv-ding-k" data-inv-ding="${esc(d.id)}">${bildHTML(d)}<span class="inv-ding-t"><b>${esc(dingName(d))}</b>${unter.length ? `<small>${esc(unter.join(' · '))}</small>` : ''}${(d.tags || []).length ? `<span class="inv-ding-tags">${d.tags.slice(0, 3).map((t) => tagPille(t, ' klein')).join('')}</span>` : ''}</span></button>${extra}</li>`;
}

function listeFormHTML(l) {
  return `<form class="inv-form" id="inv-liste-form" data-id="${l ? esc(l.id) : ''}">
<label class="inv-feld"><span>Name der Liste</span><input id="inv-liste-name" type="text" maxlength="${MAX_NAME}" value="${esc(l?.name || '')}" placeholder="z. B. Kleidung, Make-up, Schmuck" autocomplete="off"></label>
<div class="inv-bilder" role="radiogroup" aria-label="Bildchen der Liste">${INVENTAR_BILDER.map((b) => `<button type="button" class="inv-bild-wahl" role="radio" data-inv-bild="${b}" aria-checked="${b === formBild}"><img src="${bildPfad(b)}" alt="" width="30" height="30"></button>`).join('')}</div>
<div class="inv-form-knoepfe"><button type="submit" class="amy-btn">${l ? 'Speichern' : 'Anlegen'}</button><button type="button" class="btn btn-quiet" data-act="inv-form-zu">Abbrechen</button>${l ? '<button type="button" class="btn btn-quiet inv-weg" data-act="inv-liste-weg">Liste löschen</button>' : ''}</div>
</form>`;
}

const vorschlaegeHTML = (welche) => welche.map(([n, b]) => `<button type="button" class="amy-chip" data-inv-vorschlag="${esc(n)}" data-bild="${b}"><img src="${bildPfad(b)}" alt="" width="18" height="18">${esc(n)}</button>`).join('');

function listenHTML() {
  const ls = listenVon(inv());
  const ohne = dingeIn(inv(), null);
  if (!ls.length && !ohne.length) {
    return `<div class="amy-leer inv-leer"><img src="${bildPfad('womans-clothes')}" alt="" width="44" height="44"><p><b>Noch keine Listen.</b></p><p>Leg Listen für deine Sachen an – Kleidung, Make-up, was du willst –, mit Fotos, Notizen und dem Strichcode. Zum Anfangen antippen:</p><div class="inv-vorschlaege">${vorschlaegeHTML(LISTEN_VORSCHLAEGE)}</div></div>`;
  }
  const zeilen = ls.map((l, i) => {
    const n = dingeIn(inv(), l.id).length;
    return `<li class="inv-liste-z"><button type="button" class="inv-liste-k" data-inv-liste="${esc(l.id)}"><img src="${bildPfad(l.bild)}" alt="" width="40" height="40"><b>${esc(listenName(l))}</b><small>${n === 1 ? '1 Sache' : `${n} Sachen`}</small></button>${zustand.ordnen ? pfeileHTML('liste', l.id, i, ls.length) : ''}</li>`;
  });
  if (ohne.length) zeilen.push(`<li class="inv-liste-z"><button type="button" class="inv-liste-k" data-inv-liste=""><img src="${bildPfad('package')}" alt="" width="40" height="40"><b>Ohne Liste</b><small>${ohne.length === 1 ? '1 Sache' : `${ohne.length} Sachen`}</small></button></li>`);
  const fehlend = LISTEN_VORSCHLAEGE.filter(([n]) => !ls.some((l) => gleich(String(l.name).trim(), n)));
  return `<ul class="inv-listen">${zeilen.join('')}</ul>
${ls.length > 1 ? `<button type="button" class="linkbtn inv-ordnen" data-act="inv-ordnen" aria-pressed="${zustand.ordnen}">${zustand.ordnen ? 'Fertig' : 'Reihenfolge ändern'}</button>` : ''}
${fehlend.length && ls.length < MAX_LISTEN ? `<div class="inv-vorschlaege mehr"><span class="fine">Noch eine Liste:</span>${vorschlaegeHTML(fehlend)}</div>` : ''}`;
}

function trefferHTML(q) {
  const t = suchen(inv(), q);
  return t.length ? `<p class="fine inv-zahl">${t.length === 1 ? '1 Sache' : `${t.length} Sachen`}</p><ul class="inv-dinge">${t.map((d) => dingKarte(d, { mitListe: true })).join('')}</ul>` : '<p class="nb-nichts">Nichts gefunden.</p>';
}

function hinweisHTML() {
  const wem = istEigen() ? 'Die Fotos liegen in deinem Daten-Repo bei GitHub, wie deine Liste.' : 'Die Sachen liegen in eurer gemeinsamen Liste – Tobi sieht sie auch. Die Fotos liegen im Daten-Repo bei GitHub.';
  const netz = `Zur Nummer schlägt die App Name, Marke und Bild in Open Beauty Facts und den verwandten offenen Datenbanken nach${anbieterVon(ladeKi()) === 'anthropic' ? ' – kennen die sie nicht, sucht Claude im Internet' : ''}.`;
  return `<p class="fine inv-fein">${wem} Den Strichcode liest ${'BarcodeDetector' in window ? 'dein Handy selbst' : ladeKi() ? 'die KI vom Foto' : 'die KI vom Foto, wenn ein KI-Schlüssel eingetragen ist – sonst tippst du die Ziffern ab'}. ${netz}</p>`;
}

function uebersichtHTML() {
  const da = app.listeDa;
  const voll = Object.keys(inv().dinge).length >= MAX_DINGE;
  return `<div class="inv-werkzeug">
<button type="button" class="amy-btn" data-act="inv-liste-neu"${da && listenVon(inv()).length < MAX_LISTEN ? '' : ' disabled'}>${PLUS}Neue Liste</button>
<label class="amy-btn inv-datei-btn" for="inv-finden">${STRICHCODE}Hab ich das schon?</label><input class="vh" id="inv-finden" type="file" accept="image/*" capture="environment"${da ? '' : ' disabled'}>
</div>
${zustand.neu ? listeFormHTML(null) : ''}
<label class="inv-suche-feld"><span class="vh">In deinen Sachen suchen</span><input type="search" id="inv-suche" value="${esc(zustand.suche)}" placeholder="Suchen – Name, Marke, Tag, Nummer" autocomplete="off" enterkeyhint="search"></label>
<div id="inv-inhalt">${zustand.suche.trim() ? trefferHTML(zustand.suche) : listenHTML()}</div>
${voll ? `<p class="fine">Höchstens ${MAX_DINGE} Sachen – für neue erst alte löschen.</p>` : ''}${hinweisHTML()}`;
}

function nachTagsHTML(xs) {
  const abschnitt = (titel, n, inhalt) => `<section class="inv-abschnitt"><h3>${titel}<span class="n">${n}</span></h3><ul class="inv-dinge">${inhalt.map((d) => dingKarte(d)).join('')}</ul></section>`;
  const ohne = xs.filter((d) => !(d.tags || []).length);
  return tagsVon(xs).map(([t, n]) => abschnitt(tagPille(t), n, mitTag(xs, t))).join('') + (ohne.length ? abschnitt('<span class="amy-tag ohne">ohne Tag</span>', ohne.length, ohne) : '');
}

function listeHTML(l) {
  const schluessel = l ? l.id : OHNE;
  const alle = dingeIn(inv(), l ? l.id : null);
  const sort = SORTEN.some(([k]) => k === zustand.sort[schluessel]) ? zustand.sort[schluessel] : 'eigen';
  const tags = tagsVon(alle);
  const tag = tags.some(([t]) => gleich(t, zustand.tag)) ? zustand.tag : '';
  const zeigen = sortiert(mitTag(alle, tag), sort);
  const ordnen = zustand.ordnen && sort === 'eigen' && !tag;
  const ki = ladeKi();
  const voll = Object.keys(inv().dinge).length >= MAX_DINGE;
  let inhalt;
  if (!alle.length) inhalt = `<div class="amy-leer inv-leer"><p><b>Noch nichts in dieser Liste.</b></p><p>„Scannen“ liest den Strichcode und schlägt die Sache nach – mit Bild, wenn es eins gibt. „Mit Foto“ fotografiert sie${ki ? ' – die KI trägt Name, Marke und Tags gleich ein' : ''}. Oder „Neue Sache“ und von Hand.</p></div>`;
  else if (!zeigen.length) inhalt = '<p class="nb-nichts">Nichts mit diesem Tag.</p>';
  else if (sort === 'tags') inhalt = nachTagsHTML(zeigen);
  else inhalt = `<ul class="inv-dinge">${zeigen.map((d, i) => dingKarte(d, { extra: ordnen ? pfeileHTML('ding', d.id, i, zeigen.length) : '' })).join('')}</ul>`;
  return `<button type="button" class="back" data-act="inv-zu">${ZURUECK}Alle Listen</button>
<header class="inv-kopf"><img src="${bildPfad(l?.bild || 'package')}" alt="" width="44" height="44"><h2 id="inv-titel">${esc(listenName(l))}</h2>${l ? '<button type="button" class="linkbtn" data-act="inv-liste-bearbeiten">Bearbeiten</button>' : ''}</header>
${zustand.bearbeiten && l ? listeFormHTML(l) : ''}
${l ? `<div class="inv-werkzeug"><button type="button" class="amy-btn" data-act="inv-ding-neu"${voll ? ' disabled' : ''}>${PLUS}Neue Sache</button><label class="amy-btn inv-datei-btn${voll ? ' aus' : ''}" for="inv-neu-code">${STRICHCODE}Scannen</label><input class="vh" id="inv-neu-code" type="file" accept="image/*" capture="environment"${voll ? ' disabled' : ''}><label class="amy-btn inv-datei-btn${voll ? ' aus' : ''}" for="inv-neu-foto">${KAMERA}Mit Foto</label><input class="vh" id="inv-neu-foto" type="file" accept="image/*"${voll ? ' disabled' : ''}></div>` : ''}
${alle.length > 1 ? `<div class="inv-leiste"><label class="inv-sort"><span>Sortieren</span><select id="inv-sort">${SORTEN.map(([k, n]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${n}</option>`).join('')}</select></label>${sort === 'eigen' && !tag ? `<button type="button" class="linkbtn inv-ordnen" data-act="inv-ordnen" aria-pressed="${zustand.ordnen}">${zustand.ordnen ? 'Fertig' : 'Reihenfolge ändern'}</button>` : ''}</div>` : ''}
${tags.length ? `<div class="amy-filter" role="group" aria-label="Nach Tags filtern"><button type="button" class="amy-chip" data-inv-tag="" aria-pressed="${!tag}">Alle</button>${tags.map(([t, n]) => `<button type="button" class="amy-chip tf${tagFarbe(t)}" data-inv-tag="${esc(t)}" aria-pressed="${gleich(t, tag)}">${esc(t)}<span class="n">${n}</span></button>`).join('')}</div>` : ''}
${inhalt}`;
}

function tagsHTML(d) {
  const da = d.tags || [];
  const bekannt = tagsVon(Object.values(inv().dinge)).map(([t]) => t);
  const vorschlaege = [...new Set([...bekannt, ...TAG_VORSCHLAEGE])].filter((t) => !da.some((x) => gleich(x, t))).slice(0, 6);
  return `<div class="nb-tags" role="group" aria-label="Tags dieser Sache">${da.map((t, i) => `<span class="amy-tag tf${tagFarbe(t)} mit-x">${esc(t)}<button type="button" data-inv-tag-weg="${i}" aria-label="Tag „${esc(t)}“ entfernen">×</button></span>`).join('')}${da.length < MAX_TAGS ? `<input class="nb-tag-feld" id="inv-tag-text" type="text" maxlength="24" placeholder="${da.length ? 'Tag dazu' : 'Tags, z. B. Sommer'}" enterkeyhint="done" autocomplete="off" aria-label="Tag dazu">` : ''}</div>
${da.length < MAX_TAGS && vorschlaege.length ? `<div class="nb-tag-vorschlaege">${vorschlaege.map((t) => `<button type="button" class="amy-tag tf${tagFarbe(t)} vorschlag" data-inv-tag-dazu="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}`;
}

function fotoTeilHTML(d) {
  const lauf = laeuft.get(d.id);
  const hat = !!(d.foto || vorschau.has(d.id));
  const text = { foto: 'Foto wird gespeichert …', ki: 'Die KI schaut es sich an …', code: 'Liest den Strichcode …', netz: 'Schlägt im Netz nach …', suche: 'Claude sucht im Internet …' }[lauf] || '';
  return `<div class="inv-gross">${bildHTML(d, true)}${text ? `<span class="inv-lauf" role="status">${text}</span>` : ''}</div>
<div class="inv-foto-knoepfe"><label class="amy-btn inv-datei-btn" for="inv-foto-datei">${KAMERA}${hat ? 'Anderes Foto' : 'Foto'}</label><input class="vh" id="inv-foto-datei" type="file" accept="image/*"${lauf === 'foto' ? ' disabled' : ''}>${d.foto && ladeKi() ? `<button type="button" class="btn btn-quiet" data-act="inv-ki"${lauf ? ' disabled' : ''}>${FUNKEN}Mit KI ausfüllen</button>` : ''}${d.foto ? `<button type="button" class="btn btn-quiet" data-act="inv-foto-weg"${lauf ? ' disabled' : ''}>Foto weg</button>` : ''}</div>
${d.quelle ? `<p class="fine inv-quelle">Gefunden bei <a href="${esc(d.quelle.url)}" target="_blank" rel="noopener">${esc(d.quelle.name)}</a></p>` : ''}`;
}

/** Eine Nummer, die sich nachschlagen lässt (8 bis 14 Ziffern). */
const nachschlagbar = (d) => /^\d{8,14}$/.test(String(d?.code || ''));
const fehltWas = (d) => !String(d.name || '').trim() || !String(d.marke || '').trim() || !d.foto;

/** Unter dem Strichcode: welche Sachen ihn schon tragen – sonst, wenn noch etwas fehlt, „Im Netz nachschlagen“. */
function gleichHTML(d) {
  const andere = d.code ? mitCode(inv(), d.code).filter((x) => x.id !== d.id) : [];
  if (andere.length) return `<p class="inv-gleich">Gibt es schon: ${andere.map((x) => `<button type="button" class="linkbtn" data-inv-ding="${esc(x.id)}">${esc(dingName(x))} (${esc(listenName(liste(x.liste)))})</button>`).join(', ')}</p>`;
  return nachschlagbar(d) && fehltWas(d) ? '<button type="button" class="linkbtn inv-nachschlagen" data-act="inv-nachschlagen">Im Netz nachschlagen</button>' : '';
}

const listenOptionen = (d) => listenVon(inv()).map((x) => `<option value="${esc(x.id)}"${x.id === d.liste ? ' selected' : ''}>${esc(listenName(x))}</option>`).join('') + (liste(d.liste) ? '' : '<option value="" selected>Ohne Liste</option>');

function dingHTML(d) {
  return `<div class="inv-ding" id="inv-ding" data-id="${esc(d.id)}">
<button type="button" class="back" data-act="inv-ding-zu">${ZURUECK}${esc(listenName(liste(d.liste)))}</button>
<div class="inv-foto-teil" id="inv-foto-teil">${fotoTeilHTML(d)}</div>
<label class="inv-feld"><span>Name</span><input id="inv-name" type="text" maxlength="${MAX_NAME}" value="${esc(d.name)}" placeholder="z. B. Schwarze Lederjacke" autocomplete="off"></label>
<label class="inv-feld"><span>Marke</span><input id="inv-marke" type="text" maxlength="${MAX_MARKE}" value="${esc(d.marke)}" placeholder="z. B. Zara" autocomplete="off"></label>
<label class="inv-feld"><span>Liste</span><select id="inv-liste">${listenOptionen(d)}</select></label>
<div class="inv-feld"><span>Tags</span><div class="nb-tag-teil" id="inv-tag-teil">${tagsHTML(d)}</div></div>
<label class="inv-feld"><span>Notiz</span><textarea id="inv-notiz" maxlength="${MAX_NOTIZ}" placeholder="Größe, wozu es passt, wann gekauft, was es gekostet hat …">${esc(d.notiz)}</textarea></label>
<div class="inv-feld"><span>Strichcode</span><div class="inv-code"><input id="inv-code" type="text" inputmode="numeric" maxlength="40" value="${esc(d.code)}" placeholder="Nummer unter dem Strichcode" autocomplete="off" aria-label="Nummer unter dem Strichcode"><label class="amy-btn inv-datei-btn" for="inv-code-foto">${STRICHCODE}Scannen</label><input class="vh" id="inv-code-foto" type="file" accept="image/*" capture="environment"></div><div id="inv-gleich">${gleichHTML(d)}</div></div>
<div class="nb-fuss"><span class="nb-stand" id="inv-stand" role="status">${esc(standText(d))}</span><button type="button" class="btn btn-quiet" data-act="inv-ding-weg">Sache löschen</button></div>
</div>`;
}

/** Was nicht mehr da ist (auf dem anderen Gerät gelöscht), ist auch hier nicht mehr offen. */
function pruefen() {
  if (zustand.ding && !ding(zustand.ding)) zustand.ding = null;
  if (zustand.liste && zustand.liste !== OHNE && !liste(zustand.liste)) { zustand.liste = null; zustand.bearbeiten = false; }
  if (zustand.liste === OHNE && !dingeIn(inv(), null).length && !zustand.ding) zustand.liste = null;
}

/** Der Teil „Sachen“ im Bereich. */
export function inventarHTML() {
  if (!app.listeDa) return '<section class="inv" id="inv" aria-label="Sachen"><p class="loading">Wird geladen…</p></section>';
  pruefen();
  const d = ding(zustand.ding);
  const inhalt = d ? dingHTML(d) : zustand.liste ? listeHTML(zustand.liste === OHNE ? null : liste(zustand.liste)) : uebersichtHTML();
  setTimeout(() => { fotosEinsetzen(); aufraeumen(); }, 0);
  return `<section class="inv" id="inv" aria-label="Sachen">${inhalt}</section>`;
}

/**
 * Nach einer Änderung der Liste: Ist die Sache offen, die gerade bearbeitet
 * wird, bleibt das Formular stehen – nur, was sich woanders geändert hat,
 * zieht nach. Ebenso bleiben ein Suchfeld und ein Formular, in denen gerade
 * getippt wird. true, wenn so aktualisiert wurde (sonst baut ansicht-amy.js neu).
 */
export function inventarAktualisieren(el) {
  const offen = el.querySelector('#inv-ding');
  const d = ding(zustand.ding);
  if (offen && d && offen.dataset.id === d.id) {
    if (!timer) {
      for (const [sel, k] of [['#inv-name', 'name'], ['#inv-marke', 'marke'], ['#inv-notiz', 'notiz'], ['#inv-code', 'code']]) {
        const f = el.querySelector(sel);
        if (f && document.activeElement !== f && f.value !== d[k]) f.value = d[k];
      }
      const st = el.querySelector('#inv-stand');
      if (st) st.textContent = standText(d);
    }
    const wahl = el.querySelector('#inv-liste');
    if (wahl && document.activeElement !== wahl) wahl.innerHTML = listenOptionen(d);
    const zurueck = el.querySelector('#inv-ding > .back');
    if (zurueck) zurueck.innerHTML = `${ZURUECK}${esc(listenName(liste(d.liste)))}`;
    const tags = el.querySelector('#inv-tag-teil');
    if (tags) {
      const fokus = document.activeElement?.id === 'inv-tag-text';
      tags.innerHTML = tagsHTML(d);
      if (fokus) tags.querySelector('#inv-tag-text')?.focus({ preventScroll: true });
    }
    fotoTeilNeu(d.id);
    const g = el.querySelector('#inv-gleich');
    if (g) g.innerHTML = gleichHTML(d);
    return true;
  }
  const suche = el.querySelector('#inv-suche');
  if (suche && document.activeElement === suche && !zustand.ding) {
    const i = el.querySelector('#inv-inhalt');
    if (i) { i.innerHTML = zustand.suche.trim() ? trefferHTML(zustand.suche) : listenHTML(); fotosEinsetzen(i); }
    return true;
  }
  const form = el.querySelector('#inv-liste-form');
  return !!(form && form.contains(document.activeElement));
}

function fotoTeilNeu(id) {
  const t = $('#inv-foto-teil');
  const d = ding(id);
  if (!t || !d || $('#inv-ding')?.dataset.id !== id) return;
  const neu = fotoTeilHTML(d);
  if (t.dataset.html !== neu) { t.innerHTML = neu; t.dataset.html = neu; fotosEinsetzen(t); }
}

/* -------------------------------------------------------------- Speichern */

/** Was im offenen Formular steht, als Sache – oder null. */
function ausFormular() {
  const el = $('#inv-ding');
  const alt = ding(el?.dataset.id);
  if (!el || !alt) return null;
  const wahl = $('#inv-liste')?.value;
  return {
    ...alt,
    name: $('#inv-name')?.value ?? alt.name,
    marke: $('#inv-marke')?.value ?? alt.marke,
    notiz: $('#inv-notiz')?.value ?? alt.notiz,
    code: codeBereinigen($('#inv-code')?.value ?? alt.code),
    liste: wahl === undefined ? alt.liste : wahl || null,
  };
}

/** Die Sache, wie sie gerade ist – mit dem, was im Formular getippt ist. */
const aktuell = (id) => (($('#inv-ding')?.dataset.id === id && ausFormular()) || ding(id));

function speichern(d) {
  if (!d) return;
  const alt = ding(d.id);
  // In eine andere Liste: dort ans Ende
  const neu = alt && d.liste !== alt.liste ? { ...d, reihe: naechsteReihe(dingeIn(inv(), d.liste)) } : d;
  if (alt && ['name', 'marke', 'notiz', 'code', 'liste', 'reihe'].every((k) => (alt[k] ?? '') === (neu[k] ?? '')) && JSON.stringify(alt.tags) === JSON.stringify(tagsBereinigen(neu.tags)) && JSON.stringify(alt.foto) === JSON.stringify(neu.foto || null) && JSON.stringify(alt.quelle || null) === JSON.stringify(neu.quelle || null)) return;
  app.aendern(opDing(neu, app.name()));
}

/** Gleich speichern, was getippt ist (vor dem Wechseln, beim Weggehen). */
export function inventarJetztSpeichern() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  speichern(ausFormular());
}

function spaeterSpeichern() {
  clearTimeout(timer);
  const st = $('#inv-stand');
  if (st) st.textContent = 'Speichert …';
  timer = setTimeout(() => { timer = null; speichern(ausFormular()); }, SPEICHERN_NACH);
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') inventarJetztSpeichern(); });
window.addEventListener('pagehide', inventarJetztSpeichern);

/** Eine leere Sache, die man verlässt, verschwindet wieder – außer ihr Foto lädt gerade hoch. */
function verlassen() {
  inventarJetztSpeichern();
  const d = ding(zustand.ding);
  if (d && dingLeer(d) && !laeuft.has(d.id)) app.aendern(opDingWeg(d.id));
}

/* ----------------------------------------------------- Listen und Sachen */

function listeAnlegen(name, bild) {
  const n = String(name || '').trim();
  if (!n || !app.listeDa) return;
  if (listenVon(inv()).length >= MAX_LISTEN) { melde(`Höchstens ${MAX_LISTEN} Listen.`); return; }
  const da = listenVon(inv()).find((l) => gleich(String(l.name).trim(), n));
  if (da) { zustand = { ...zustand, liste: da.id, ding: null, neu: false, tag: '' }; merken(); neuZeichnen(); return; }
  const id = neueListeId();
  app.aendern(opInvListe({ id, name: n, bild: INVENTAR_BILDER.includes(bild) ? bild : 'package', reihe: naechsteReihe(listenVon(inv())) }, app.name()));
  zustand = { ...zustand, liste: id, ding: null, neu: false, tag: '', ordnen: false };
  merken();
  neuZeichnen();
  window.scrollTo(0, 0);
}

function listeLoeschen() {
  const l = liste(zustand.liste);
  if (!l) return;
  const drin = dingeIn(inv(), l.id);
  app.aendern(opInvListeWeg(l.id));
  for (const d of drin) wegMerken(d.foto);
  if (drin.some((d) => d.foto)) aufraeumenBald();
  zustand = { ...zustand, liste: null, ding: null, bearbeiten: false, tag: '' };
  merken();
  neuZeichnen();
  melde(drin.length ? `„${listenName(l)}“ mit ${drin.length === 1 ? 'einer Sache' : `${drin.length} Sachen`} gelöscht` : `„${listenName(l)}“ gelöscht`, {
    knopf: 'Rückgängig',
    beiKnopf: () => { app.aendern(opZusammen({}, {}, { inventar: { listen: { [l.id]: l }, dinge: Object.fromEntries(drin.map((d) => [d.id, d])) } })); zustand = { ...zustand, liste: l.id }; merken(); neuZeichnen(); },
  });
}

/** Eine neue Sache in der offenen Liste – gleich offen. */
function dingNeu(mehr = {}) {
  if (!app.listeDa) return null;
  if (Object.keys(inv().dinge).length >= MAX_DINGE) { melde(`Höchstens ${MAX_DINGE} Sachen – für neue erst alte löschen.`); return null; }
  verlassen();
  const listeId = 'liste' in mehr ? mehr.liste : liste(zustand.liste) ? zustand.liste : null;
  const id = neueDingId();
  app.aendern(opDing({ id, liste: listeId, name: '', marke: '', notiz: '', tags: zustand.tag ? [zustand.tag] : [], code: '', foto: null, reihe: naechsteReihe(dingeIn(inv(), listeId)), ...mehr }, app.name()));
  zustand = { ...zustand, ding: id, liste: listeId || OHNE, ordnen: false };
  merken();
  neuZeichnen();
  window.scrollTo(0, 0);
  return id;
}

function dingLoeschen() {
  inventarJetztSpeichern();
  const d = ding(zustand.ding);
  if (!d) return;
  app.aendern(opDingWeg(d.id));
  if (d.foto) { wegMerken(d.foto); aufraeumenBald(); }
  zustand = { ...zustand, ding: null };
  merken();
  neuZeichnen();
  if (!dingLeer(d)) {
    melde(`„${dingName(d)}“ gelöscht`, { knopf: 'Rückgängig', beiKnopf: () => { app.aendern(opZusammen({}, {}, { inventar: { listen: {}, dinge: { [d.id]: d } } })); zustand = { ...zustand, ding: d.id }; merken(); neuZeichnen(); } });
  }
}

/** Eins nach oben oder unten – Listen oder Sachen in der eigenen Reihenfolge. */
function schieben(was, richtung) {
  const [art, id] = String(was).split(':');
  if (art === 'liste') {
    const neu = verschieben(listenVon(inv()), id, richtung);
    if (neu?.length) app.aendern(neu.map((l) => opInvListe(l, app.name())));
  } else {
    const l = liste(zustand.liste);
    const neu = verschieben(dingeIn(inv(), l ? l.id : null), id, richtung);
    if (neu?.length) app.aendern(neu.map((d) => opDing(d, app.name())));
  }
  window.requestAnimationFrame(() => $(`[data-inv-${richtung < 0 ? 'hoch' : 'runter'}="${window.CSS.escape(was)}"]`)?.focus({ preventScroll: true }));
}

function tagDazu(roh) {
  const d = ausFormular();
  if (!d) return;
  clearTimeout(timer);
  timer = null;
  speichern({ ...d, tags: tagsBereinigen([...(d.tags || []), ...String(roh).split(/[,;]/)]) });
  const f = $('#inv-tag-text');
  if (f) { f.value = ''; f.focus({ preventScroll: true }); }
}

/* ------------------------------------------------------- Foto und KI */

/** Ein Foto für eine Sache: verkleinern, gleich zeigen, ins Daten-Repo legen, dann in die Sache. */
async function fotoSetzen(id, datei, { ki = false } = {}) {
  if (!app.zugang) { melde('Fotos gehen erst, wenn die Liste eingerichtet ist.'); return; }
  let f;
  try { f = await fotoVorbereiten(datei, KANTE); } catch { melde('Das Bild ließ sich nicht lesen.'); return; }
  vorschau.set(id, f.url);
  letztes.set(id, f.b64);
  laeuft.set(id, 'foto');
  fotoTeilNeu(id);
  const pfad = fotoPfad(id);
  let fertig = false;
  try {
    const { sha } = await dateiHochladen(pfad, f.b64, { token: app.zugang.token, ort: ort(), nachricht: `${app.name()}: Foto für die Sachen` });
    inVorrat(pfad, await (await fetch(f.url)).blob());
    urls.set(pfad, f.url);
    const d = aktuell(id);
    if (!d) { wegMerken({ pfad, sha }); aufraeumenBald(); return; } // inzwischen gelöscht
    clearTimeout(timer);
    timer = null;
    if (d.foto?.pfad && d.foto.pfad !== pfad) { wegMerken(d.foto); aufraeumenBald(); }
    app.aendern(opDing({ ...d, foto: { pfad, sha } }, app.name()));
    fertig = true;
  } catch (e) {
    letztes.delete(id);
    URL.revokeObjectURL(f.url);
    melde(e?.message || 'Das Foto ist nicht gespeichert – nochmal versuchen.');
  } finally {
    vorschau.delete(id);
    laeuft.delete(id);
    fotoTeilNeu(id);
  }
  if (fertig && ki && ladeKi()) kiAusfuellen(id);
}

function fotoWeg() {
  const d = aktuell(zustand.ding);
  if (!d?.foto) return;
  clearTimeout(timer);
  timer = null;
  app.aendern(opDing({ ...d, foto: null }, app.name()));
  letztes.delete(d.id);
  wegMerken(d.foto);
  aufraeumenBald();
  melde('Foto weg', { knopf: 'Rückgängig', beiKnopf: () => { const x = aktuell(d.id); if (x) app.aendern(opDing({ ...x, foto: d.foto }, app.name())); } });
}

/** Die KI schaut sich das Foto an und füllt aus, was noch leer ist. */
async function kiAusfuellen(id) {
  const schluessel = ladeKi();
  const d0 = ding(id);
  if (!d0) return;
  if (!schluessel) { melde('Dafür braucht es einen KI-Schlüssel (Einstellungen → KI-Schlüssel).'); return; }
  laeuft.set(id, 'ki');
  fotoTeilNeu(id);
  try {
    const b64 = await fotoB64(d0);
    if (!b64) throw new Error('Das Foto ist gerade nicht da – ohne Netz?');
    const listen = listenVon(inv()).map((l) => ({ id: l.id, name: listenName(l) }));
    const antwort = await kiAnfragen(rumpfErkennen({ anbieter: anbieterVon(schluessel), b64, listen: listen.map((l) => l.name) }), { schluessel, roh: true });
    const e = erkanntBereinigen(jsonAus(antwort.text), listen);
    const d = aktuell(id);
    if (!d) return;
    // Nur, was noch leer ist – was schon dasteht, bleibt
    const neu = { ...d, name: d.name.trim() ? d.name : e.name, marke: d.marke.trim() ? d.marke : e.marke, tags: (d.tags || []).length ? d.tags : e.tags, code: d.code || e.code, liste: liste(d.liste) ? d.liste : e.liste || d.liste };
    clearTimeout(timer);
    timer = null;
    speichern(neu);
    if ($('#inv-ding')?.dataset.id === id) {
      for (const [sel, k] of [['#inv-name', 'name'], ['#inv-marke', 'marke'], ['#inv-code', 'code']]) { const f = $(sel); if (f) f.value = neu[k]; }
    }
    melde(e.name ? `Erkannt: ${e.name}${e.marke ? ` (${e.marke})` : ''}` : 'Die KI hat nichts Eindeutiges erkannt.');
  } catch (err) {
    melde(err?.message || 'Die KI hat nicht geantwortet.');
  } finally {
    laeuft.delete(id);
    fotoTeilNeu(id);
  }
}

/** Den Strichcode von einem Foto lesen: erst das Gerät (BarcodeDetector), sonst die KI. '' ohne Erfolg. */
async function codeLesen(datei) {
  if ('BarcodeDetector' in window) {
    try {
      const da = await window.BarcodeDetector.getSupportedFormats?.() || [];
      const formate = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'].filter((x) => !da.length || da.includes(x));
      const bild = await createImageBitmap(datei);
      const treffer = await new window.BarcodeDetector(formate.length ? { formats: formate } : undefined).detect(bild);
      bild.close?.();
      const c = codeBereinigen(treffer?.[0]?.rawValue);
      if (c) return c;
    } catch { /* weiter mit der KI */ }
  }
  const schluessel = ladeKi();
  if (!schluessel) return '';
  try {
    const f = await fotoVorbereiten(datei, KANTE_CODE);
    URL.revokeObjectURL(f.url);
    const antwort = await kiAnfragen(rumpfErkennen({ anbieter: anbieterVon(schluessel), b64: f.b64, nurCode: true }), { schluessel, roh: true });
    return erkanntBereinigen(jsonAus(antwort.text)).code;
  } catch { return ''; }
}

const keinCode = () => melde(ladeKi() || 'BarcodeDetector' in window ? 'Kein Strichcode erkannt – näher ran und gerade halten, oder die Ziffern darunter abtippen.' : 'Ohne KI-Schlüssel kann dieses Handy keinen Strichcode lesen – tipp die Ziffern darunter ab.');

/** Das Bild aus der Datenbank: groß – im Datensparmodus das kleine, und das kleine, wenn das große nicht kommt. null ohne Bild. */
async function bildHolen(t) {
  const sparen = !!navigator.connection?.saveData;
  for (const u of [...new Set([sparen ? t.klein : t.bild, t.klein].filter(Boolean))]) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const b = await res.blob();
      if (b.size && (!b.type || /^image\//.test(b.type))) return b;
    } catch { /* das nächste */ }
  }
  return null;
}

const gefundenText = (t) => `Gefunden: ${t.name || t.marke}${t.name && t.marke ? ` (${t.marke})` : ''}`;

/**
 * Zur Nummer einer Sache nachschlagen (inventar-netz.js) und eintragen, was
 * noch leer ist: Name, Marke, Liste, Tags, die Quelle – und als Foto das Bild
 * der Datenbank, wenn sie noch keins hat. vorher: der Treffer, den „Hab ich
 * das schon?“ schon hat; gefragt: die Datenbanken kennen die Nummer nicht
 * (nicht noch einmal fragen). suchen: Kennen sie sie nicht, sucht Claude im
 * Internet (nur mit Schlüssel von Anthropic; kostet ein paar Cent). still:
 * ohne Meldung, wenn nichts gefunden ist.
 */
async function nachschlagenFuer(id, { vorher = null, gefragt = false, suchen = true, still = false } = {}) {
  const code = aktuell(id)?.code;
  if (!code || laeuft.has(id)) return;
  laeuft.set(id, 'netz');
  fotoTeilNeu(id);
  let t = vorher;
  let fehler = '';
  try {
    if (!t && !gefragt) {
      try { t = await nachschlagen(code); } catch { fehler = 'Nachschlagen ging gerade nicht – ohne Netz?'; }
    }
    const schluessel = ladeKi();
    if (!t && suchen && anbieterVon(schluessel) === 'anthropic') {
      laeuft.set(id, 'suche');
      fotoTeilNeu(id);
      const listen = listenVon(inv()).map((l) => ({ id: l.id, name: listenName(l) }));
      try {
        const a = await kiMitWerkzeugen(rumpfNachschlagen({ code, listen: listen.map((l) => l.name) }), { schluessel, berater: false });
        t = gesuchtBereinigen(jsonAus(a.text), { quellen: a.quellen, listen });
        fehler = '';
      } catch (e) {
        fehler = e?.message || 'Die Suche im Internet hat nicht geklappt.';
      }
    }
  } finally {
    laeuft.delete(id);
    fotoTeilNeu(id);
  }
  const d = aktuell(id);
  if (!d) return;
  if (!t) {
    if (!still) melde(fehler || `Zu ${code} nichts gefunden – ${d.foto ? 'trag es von Hand ein' : `mach ein Foto${ladeKi() ? ', die KI erkennt es' : ''}`}.`);
    return;
  }
  // Nur, was noch leer ist – was schon dasteht, bleibt
  const neu = { ...d, name: d.name.trim() ? d.name : t.name, marke: d.marke.trim() ? d.marke : t.marke, tags: (d.tags || []).length ? d.tags : t.tags, liste: liste(d.liste) ? d.liste : t.liste || d.liste, quelle: d.quelle || t.quelle };
  clearTimeout(timer);
  timer = null;
  speichern(neu);
  if (liste(neu.liste) && neu.liste !== d.liste && zustand.ding === id) { zustand.liste = neu.liste; merken(); }
  if ($('#inv-ding')?.dataset.id === id) {
    for (const [sel, k] of [['#inv-name', 'name'], ['#inv-marke', 'marke']]) { const f = $(sel); if (f) f.value = neu[k]; }
  }
  melde(gefundenText(t));
  if (d.foto || vorschau.has(id) || !(t.bild || t.klein)) return;
  const blob = await bildHolen(t);
  if (blob && aktuell(id) && !aktuell(id).foto && !vorschau.has(id)) await fotoSetzen(id, blob);
}

/** Scannen in einer Sache: der Code kommt ins Feld – und fehlt der Sache noch etwas, schlägt die App nach. */
async function codeFuerDing(id, datei) {
  laeuft.set(id, 'code');
  fotoTeilNeu(id);
  let code = '';
  try { code = await codeLesen(datei); } finally { laeuft.delete(id); fotoTeilNeu(id); }
  if (!code) { keinCode(); $('#inv-code')?.focus(); return; }
  const d = aktuell(id);
  if (!d) return;
  clearTimeout(timer);
  timer = null;
  speichern({ ...d, code });
  const f = $('#inv-code');
  if (f) f.value = code;
  const andere = mitCode(inv(), code).filter((x) => x.id !== id);
  melde(andere.length ? `${code} – das gibt es schon: ${dingName(andere[0])}` : `Strichcode ${code}`);
  // Claude sucht nur, wenn noch kein Name da ist – das kostet
  if (!andere.length && fehltWas(d)) nachschlagenFuer(id, { suchen: !d.name.trim(), still: !!d.name.trim() });
}

/** Eine Sache öffnen (aus „Hab ich das schon?“ oder dem Scannen in einer Liste). */
function oeffnen(d) {
  verlassen();
  zustand = { ...zustand, ding: d.id, liste: liste(d.liste) ? d.liste : OHNE, suche: '', ordnen: false };
  merken();
  neuZeichnen();
  window.scrollTo(0, 0);
}

/** „Scannen“ in einer Liste: Gibt es die Sache schon, ist sie gleich offen – sonst legt die App sie an und schlägt nach. */
async function scannenUndAnlegen(datei) {
  const listeId = liste(zustand.liste) ? zustand.liste : null;
  melde('Liest den Strichcode …');
  const code = await codeLesen(datei);
  if (!code) { keinCode(); return; }
  const da = mitCode(inv(), code);
  if (da.length) {
    oeffnen(da[0]);
    melde(`Hast du schon: ${dingName(da[0])} (${listenName(liste(da[0].liste))})`);
    return;
  }
  const id = dingNeu({ code, liste: listeId });
  if (!id) return;
  melde(`Strichcode ${code} – schlägt nach …`);
  nachschlagenFuer(id);
}

/** „Hab ich das schon?“ – scannen und nachsehen; was es nicht gibt, schlägt die App gleich nach (nur in den Datenbanken). */
async function finden(datei) {
  melde('Liest den Strichcode …');
  const code = await codeLesen(datei);
  if (!code) { keinCode(); return; }
  const da = mitCode(inv(), code);
  if (da.length === 1) {
    const d = da[0];
    oeffnen(d);
    melde(`Hast du schon: ${dingName(d)} (${listenName(liste(d.liste))})`);
    return;
  }
  if (da.length > 1) {
    zustand = { ...zustand, suche: code };
    neuZeichnen();
    melde(`Hast du schon – ${da.length}-mal`);
    return;
  }
  let t = null;
  let gefragt = false;
  if (/^\d{8,14}$/.test(code)) {
    melde(`${code}: noch nicht in deinen Listen – schlägt nach …`);
    try { t = await nachschlagen(code); gefragt = true; } catch { /* ohne Netz: nur die Nummer */ }
  }
  const was = t ? `${t.name || t.marke}${t.name && t.marke ? ` (${t.marke})` : ''}` : code;
  melde(`${was}: noch nicht in deinen Listen`, {
    knopf: 'Eintragen',
    beiKnopf: () => {
      const id = dingNeu({ code, liste: liste(zustand.liste) ? zustand.liste : null });
      if (id) nachschlagenFuer(id, { vorher: t, gefragt });
    },
  });
}

/* ------------------------------------------------------------------ Klicks */

/** true, wenn der Klick hierher gehörte. */
export function klickInventar(el) {
  const d = el.dataset;
  if ('invListe' in d) {
    inventarJetztSpeichern();
    zustand = { ...zustand, liste: d.invListe || OHNE, ding: null, tag: '', ordnen: false, bearbeiten: false, neu: false };
    merken();
    neuZeichnen();
    window.scrollTo(0, 0);
    return true;
  }
  if ('invDing' in d) {
    if (d.invDing === zustand.ding) return true;
    verlassen();
    const x = ding(d.invDing);
    if (!x) return true;
    zustand = { ...zustand, ding: x.id, liste: liste(x.liste) ? x.liste : OHNE, ordnen: false };
    merken();
    neuZeichnen();
    window.scrollTo(0, 0);
    return true;
  }
  if ('invVorschlag' in d) { listeAnlegen(d.invVorschlag, d.bild); return true; }
  if ('invBild' in d) {
    formBild = d.invBild;
    for (const b of $$('#inv-liste-form [data-inv-bild]')) b.setAttribute('aria-checked', String(b.dataset.invBild === formBild));
    return true;
  }
  if ('invTag' in d) { zustand.tag = d.invTag; merken(); neuZeichnen(); return true; }
  if ('invHoch' in d) { schieben(d.invHoch, -1); return true; }
  if ('invRunter' in d) { schieben(d.invRunter, 1); return true; }
  if ('invTagWeg' in d) {
    const x = ausFormular();
    if (x) { clearTimeout(timer); timer = null; speichern({ ...x, tags: (x.tags || []).filter((_, i) => i !== Number(d.invTagWeg)) }); $('#inv-tag-text')?.focus({ preventScroll: true }); }
    return true;
  }
  if ('invTagDazu' in d) { tagDazu(d.invTagDazu); return true; }
  switch (d.act) {
    case 'inv-liste-neu':
      zustand.neu = !zustand.neu;
      formBild = 'womans-clothes';
      neuZeichnen();
      if (zustand.neu) window.requestAnimationFrame(() => $('#inv-liste-name')?.focus());
      return true;
    case 'inv-form-zu': zustand.neu = false; zustand.bearbeiten = false; neuZeichnen(); return true;
    case 'inv-liste-bearbeiten':
      zustand.bearbeiten = !zustand.bearbeiten;
      formBild = liste(zustand.liste)?.bild || 'package';
      neuZeichnen();
      return true;
    case 'inv-liste-weg': listeLoeschen(); return true;
    case 'inv-ordnen': zustand.ordnen = !zustand.ordnen; neuZeichnen(); return true;
    case 'inv-zu': zustand = { ...zustand, liste: null, ding: null, tag: '', ordnen: false, bearbeiten: false }; merken(); neuZeichnen(); return true;
    case 'inv-ding-neu': dingNeu(); window.requestAnimationFrame(() => $('#inv-name')?.focus()); return true;
    case 'inv-ding-zu': verlassen(); zustand = { ...zustand, ding: null }; merken(); neuZeichnen(); return true;
    case 'inv-ding-weg': dingLoeschen(); return true;
    case 'inv-foto-weg': fotoWeg(); return true;
    case 'inv-ki': inventarJetztSpeichern(); kiAusfuellen(zustand.ding); return true;
    case 'inv-nachschlagen': inventarJetztSpeichern(); nachschlagenFuer(zustand.ding); return true;
    default: return false;
  }
}

/** Tippen: in der Sache später speichern, im Tag-Feld macht ein Komma den Tag fertig, die Suche sucht. */
export function eingabeInventar(ziel) {
  if (['inv-name', 'inv-marke', 'inv-notiz', 'inv-code'].includes(ziel.id)) {
    spaeterSpeichern();
    if (ziel.id === 'inv-code') { const g = $('#inv-gleich'); const x = ausFormular(); if (g && x) g.innerHTML = gleichHTML(x); }
    return true;
  }
  if (ziel.id === 'inv-tag-text') {
    if (/[,;]/.test(ziel.value)) {
      const teile = ziel.value.split(/[,;]/);
      const rest = teile.pop();
      tagDazu(teile.join(','));
      const f = $('#inv-tag-text');
      if (f) f.value = rest.trimStart();
    }
    return true;
  }
  if (ziel.id === 'inv-suche') {
    zustand.suche = ziel.value;
    const i = $('#inv-inhalt');
    if (i) { i.innerHTML = zustand.suche.trim() ? trefferHTML(zustand.suche) : listenHTML(); fotosEinsetzen(i); }
    return true;
  }
  return ziel.id === 'inv-liste-name';
}

/** Fotos, Liste und Sortieren (change). true, wenn es hierher gehörte. */
export function aenderungInventar(ziel) {
  const datei = ziel.files?.[0];
  if (ziel.id === 'inv-foto-datei') { if (datei && zustand.ding) fotoSetzen(zustand.ding, datei); ziel.value = ''; return true; }
  if (ziel.id === 'inv-neu-foto') {
    ziel.value = '';
    if (!datei) return true;
    const id = dingNeu();
    if (id) fotoSetzen(id, datei, { ki: true });
    return true;
  }
  if (ziel.id === 'inv-code-foto') { if (datei && zustand.ding) codeFuerDing(zustand.ding, datei); ziel.value = ''; return true; }
  if (ziel.id === 'inv-neu-code') { ziel.value = ''; if (datei) scannenUndAnlegen(datei); return true; }
  if (ziel.id === 'inv-finden') { if (datei) finden(datei); ziel.value = ''; return true; }
  if (ziel.id === 'inv-liste') {
    clearTimeout(timer);
    timer = null;
    const x = ausFormular();
    speichern(x);
    if (x) { zustand.liste = liste(x.liste) ? x.liste : OHNE; merken(); }
    return true;
  }
  if (ziel.id === 'inv-sort') {
    const l = liste(zustand.liste);
    zustand.sort = { ...zustand.sort, [l ? l.id : OHNE]: SORTEN.some(([k]) => k === ziel.value) ? ziel.value : 'eigen' };
    zustand.ordnen = false;
    merken();
    neuZeichnen();
    $('#inv-sort')?.focus({ preventScroll: true });
    return true;
  }
  return false;
}

/** Enter: im Tag-Feld den Tag anlegen, im Namen weiter zur Marke. true, wenn es hierher gehörte. */
export function tasteInventar(ziel) {
  if (ziel?.id === 'inv-tag-text') { if (ziel.value.trim()) tagDazu(ziel.value); return true; }
  if (ziel?.id === 'inv-name') { $('#inv-marke')?.focus(); return true; }
  if (ziel?.id === 'inv-marke') { ziel.blur(); return true; }
  if (ziel?.id === 'inv-code') { ziel.blur(); inventarJetztSpeichern(); return true; }
  return false;
}

/** Eine Liste anlegen oder ändern (das Formular). true, wenn es hierher gehörte. */
export function absendenInventar(ev) {
  if (ev.target.id !== 'inv-liste-form') return false;
  ev.preventDefault();
  const name = String($('#inv-liste-name')?.value || '').trim();
  if (!name) { $('#inv-liste-name')?.focus(); return true; }
  const l = liste(ev.target.dataset.id);
  if (!l) { listeAnlegen(name, formBild); return true; }
  app.aendern(opInvListe({ ...l, name, bild: formBild }, app.name()));
  zustand.bearbeiten = false;
  neuZeichnen();
  return true;
}
