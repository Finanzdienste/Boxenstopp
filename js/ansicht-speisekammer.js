/*
 * Die Speisekammer in der Ansicht – oben in „Was ist noch da?“ (Reiter
 * Rezepte → Speisekammer, ansicht-ki.js). Was zu Hause ist, mit Menge, was
 * bald weg muss zuerst. Antippen markiert für das nächste Rezept („Unbedingt
 * verwenden“), ☆ heißt „muss bald weg“, ✓ „ist alle“. Dazu: tippen („500 g
 * Hackfleisch, 6 Eier“), fotografieren (die KI liest ab, kammer-ki.js) oder
 * den Strichcode scannen (Open Food Facts & Co., inventar-netz.js).
 * Gefüllt wird sie sonst von selbst – beim Abhaken auf der Einkaufsliste,
 * geleert bei „Heute gekocht“ (speisekammer.js).
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc } from './format.js';
import { zutatImg } from './bilder.js';
import { kammerListe, kammerText, mengeKurz, alterTage, opKammer, opKammerWeg, opKammerMenge, MAX_KAMMER } from './speisekammer.js';
import { postenAusZeilen, rumpfKammer, erkanntAlsPosten, kammerAusProdukt } from './kammer-ki.js';
import { scannen } from './scanner.js';
import { nachschlagen } from './inventar-netz.js';
import { codeLesen } from './ansicht-inventar.js';
import { kiAnfragen, anbieterVon } from './ki.js';
import { ladeKi } from './zugang.js';
import { jsonAus } from './amy-import.js';
import { fotoVorbereiten } from './foto.js';

const WAHL = 'boxenstopp.kammer.wahl.v1';
let gewaehlt = new Set((lese(WAHL, []) || []).filter((k) => typeof k === 'string'));
let neuText = '';
let liest = false; // die KI liest gerade ein Foto
let alleZeigen = false;
let bearbeiten = ''; // Schlüssel, dessen Menge gerade geändert wird
const KURZ = 12; // so viele zeigt die Liste zuerst

const KAMERA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>';

const STRICHCODE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12"/></svg>';

const kammer = () => app.stand?.speisekammer || {};
const wahlMerken = () => schreibe(WAHL, [...gewaehlt]);
const mehr = () => ({ gleich: app.stand?.gleich, abteilungen: app.stand?.abteilungen, gemeint: app.stand?.gemeint, einheiten: app.einheiten, preise: app.preise });

/** Was gerade da ist und angetippt – für die KI (ansicht-ki.js). '' ohne Speisekammer. */
export function kammerFuerKi() {
  const k = kammer();
  // Was nicht mehr da ist, ist auch nicht mehr angetippt
  for (const x of [...gewaehlt]) if (!k[x]) gewaehlt.delete(x);
  return kammerText(k, [...gewaehlt], app.katalog);
}
export const kammerLeer = () => !Object.keys(kammer()).length;

/** Nach dem Rezept: die Markierung hat ihren Zweck erfüllt. */
export function wahlZuruecksetzen() { gewaehlt = new Set(); wahlMerken(); }

function alter(e) {
  if (!e.weg) return '';
  if (e.bald) return 'muss bald weg';
  const t = alterTage(e);
  return `seit ${t} Tagen da`;
}

function zeileHTML(e) {
  const an = gewaehlt.has(e.k);
  const menge = mengeKurz(e);
  const zusatz = alter(e);
  const mengeTeil = bearbeiten === e.k
    ? `<form class="kammer-menge-form" data-kammer-form="${esc(e.k)}"><input id="kammer-menge" type="text" inputmode="decimal" value="${esc(menge)}" placeholder="z. B. 200 g" aria-label="Wie viel ist noch da?" autocomplete="off" enterkeyhint="done"><button type="submit" class="btn">OK</button></form>`
    : `<button type="button" class="kammer-q linkbtn" data-kammer-menge="${esc(e.k)}" aria-label="Menge von ${esc(e.name)} ändern">${esc(menge || 'Menge?')}</button>`;
  return `<li class="kammer-z${an ? ' an' : ''}${e.weg ? ' weg' : ''}">
<button type="button" class="kammer-wahl" data-kammer-wahl="${esc(e.k)}" aria-pressed="${an}">${zutatImg(e.k, { name: e.name, cat: e.cat, katalog: app.katalog })}<span class="kammer-t"><b>${esc(e.name)}</b>${zusatz ? `<small>${esc(zusatz)}</small>` : ''}</span></button>
${mengeTeil}
<button type="button" class="kammer-bald${e.bald ? ' an' : ''}" data-kammer-bald="${esc(e.k)}" aria-pressed="${e.bald}" aria-label="${esc(e.name)}: muss bald weg">${e.bald ? '★' : '☆'}</button>
<button type="button" class="kammer-alle" data-kammer-weg="${esc(e.k)}" aria-label="${esc(e.name)} ist alle">✓</button>
</li>`;
}

/** Der Teil „Speisekammer“ über dem Formular der Resteverwertung. */
export function kammerHTML() {
  if (!app.listeDa) return '';
  const liste = kammerListe(kammer(), app.katalog);
  const zeigen = alleZeigen || liste.length <= KURZ + 3 ? liste : liste.slice(0, KURZ);
  const n = liste.length;
  const markiert = liste.filter((e) => gewaehlt.has(e.k)).length;
  const kopf = `<div class="kammer-kopf"><h2 id="kammer-titel">Deine Speisekammer</h2><span class="kammer-n">${n === 1 ? '1 Sache' : `${n} Sachen`}</span></div>`;
  const erkl = n
    ? `<p class="kammer-hilfe">Tipp an, was ins nächste Rezept soll${markiert ? ` – ${markiert === 1 ? '1 angetippt' : `${markiert} angetippt`}` : ''}. ☆ muss bald weg, ✓ ist alle. Was du auf der Einkaufsliste abhakst, kommt von selbst dazu; „Heute gekocht“ nimmt es wieder raus.</p>`
    : '<p class="kammer-hilfe">Noch leer. Schreib oder fotografier einmal, was da ist – danach füllt sie sich beim Einkaufen von selbst (was du auf der Liste abhakst), und „Heute gekocht“ nimmt raus, was das Rezept braucht.</p>';
  const dazu = `<form class="kammer-dazu" id="kammer-dazu-form" novalidate><input id="kammer-neu" type="text" maxlength="400" value="${esc(neuText)}" placeholder="Dazu: z. B. 500 g Hackfleisch, 6 Eier, Feta" aria-label="Was ist noch da?" autocomplete="off" enterkeyhint="done"><button type="submit" class="btn">Dazu</button>
<button type="button" class="btn" data-act="kammer-scannen"${liest ? ' disabled' : ''}>${STRICHCODE}Scannen</button><label class="btn${liest ? ' is-aus' : ''}" for="kammer-foto">${KAMERA}${liest ? 'Liest …' : 'Foto'}</label><input class="vh" id="kammer-foto" type="file" accept="image/*" multiple${liest ? ' disabled' : ''}></form>`;
  const zeilen = n ? `<ul class="kammer-liste" aria-labelledby="kammer-titel">${zeigen.map(zeileHTML).join('')}</ul>${zeigen.length < n ? `<button type="button" class="linkbtn kammer-mehr" data-act="kammer-alle-zeigen">Alle ${n} zeigen</button>` : ''}` : '';
  const los = n ? `<div class="kammer-los"><button type="button" class="btn btn-primary" data-act="kammer-los">${markiert ? 'Rezept mit dem Angetippten' : 'Mach mir einfach was'}</button>${markiert ? '<button type="button" class="btn btn-quiet" data-act="kammer-wahl-weg">Nichts antippen</button>' : ''}</div>` : '';
  return `<section class="kammer" id="kammer" aria-labelledby="kammer-titel">${kopf}${erkl}${zeilen}${dazu}${los}</section>`;
}

function neuZeichnen() {
  const el = $('#kammer');
  if (!el) return;
  const fokus = document.activeElement?.id;
  el.outerHTML = kammerHTML();
  if (fokus === 'kammer-neu' || fokus === 'kammer-menge') $(`#${fokus}`)?.focus({ preventScroll: true });
}
export const kammerZeichnen = neuZeichnen;

function dazuTippen() {
  const posten = postenAusZeilen(neuText, app.katalog, mehr());
  if (!posten.length) { melde(neuText.trim() ? 'Das habe ich nicht verstanden – z. B. „500 g Hackfleisch“.' : 'Schreib, was da ist – z. B. „500 g Hackfleisch, 6 Eier“.'); return; }
  if (Object.keys(kammer()).length + posten.length > MAX_KAMMER) { melde(`Mehr als ${MAX_KAMMER} Sachen passen nicht in die Speisekammer.`); return; }
  app.aendern(opKammerMenge(posten, 1, app.name()));
  neuText = '';
  melde(posten.length === 1 ? `${posten[0].name} ist in der Speisekammer.` : `${posten.length} Sachen sind in der Speisekammer.`);
  neuZeichnen();
  $('#kammer-neu')?.focus({ preventScroll: true });
}

async function fotoLesen(dateien) {
  const schluessel = ladeKi();
  if (!schluessel) { melde('Fürs Foto braucht es einen KI-Schlüssel (Einstellungen → KI-Schlüssel). Tippen geht auch ohne.'); return; }
  const bilder = [...dateien].filter((d) => /^image\//.test(d.type) || !d.type).slice(0, 4);
  if (!bilder.length || liest) return;
  liest = true;
  neuZeichnen();
  try {
    const fotos = [];
    for (const d of bilder) fotos.push((await fotoVorbereiten(d)).b64);
    const antwort = await kiAnfragen(rumpfKammer({ anbieter: anbieterVon(schluessel), fotos }), { schluessel, roh: true, berater: false });
    const posten = erkanntAlsPosten(jsonAus(antwort.text), app.katalog, mehr());
    if (!posten.length) { melde('Auf dem Foto habe ich nichts Essbares erkannt.'); return; }
    app.aendern(opKammerMenge(posten, 1, app.name()));
    melde(`Erkannt und eingeräumt: ${posten.slice(0, 4).map((p) => p.name).join(', ')}${posten.length > 4 ? ` und ${posten.length - 4} mehr` : ''}. Stimmt eine Menge nicht, tipp sie an.`);
  } catch (e) {
    melde(e?.message ? `Das Foto ging nicht: ${e.message}` : 'Das Foto ging gerade nicht.');
  } finally {
    liest = false;
    neuZeichnen();
  }
}

/** Strichcode scannen: nachschlagen (Open Food Facts & Co.) und hinein – mit der Packungsgröße. */
async function scannenUndDazu() {
  const quelle = await scannen({ titel: 'In die Speisekammer scannen' });
  if (!quelle) return;
  liest = true;
  neuZeichnen();
  try {
    const code = quelle.code ? String(quelle.code).replace(/\D/g, '') : await codeLesen(quelle.datei);
    if (!code) { melde('Kein Strichcode erkannt – näher ran und gerade halten, oder tipp ein, was es ist.'); return; }
    let treffer = null;
    try { treffer = await nachschlagen(code); } catch { melde('Nachschlagen ging gerade nicht – ohne Netz? Tipp ein, was es ist.'); return; }
    const p = treffer ? kammerAusProdukt(treffer, app.katalog, mehr()) : null;
    if (!p) { melde(`${code}: kennt keine Datenbank – tipp ein, was es ist.`); $('#kammer-neu')?.focus(); return; }
    app.aendern(opKammerMenge([p], 1, app.name()));
    melde(`${p.name}${mengeKurz(p) ? ` (${mengeKurz(p)})` : ''} ist in der Speisekammer.`);
  } finally {
    liest = false;
    neuZeichnen();
  }
}

const EINHEIT_AUS = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], stk: ['Stk', 1], 'stück': ['Stk', 1], dose: ['Dose', 1], dosen: ['Dose', 1], pck: ['Pck', 1], packung: ['Pck', 1], packungen: ['Pck', 1] };

/** Neue Menge aus dem Feld: „200 g“, „2“, „0“ (ist alle), leer (ohne Menge). */
function mengeSetzen(k, text) {
  const e = kammer()[k];
  bearbeiten = '';
  if (!e) { neuZeichnen(); return; }
  const t = String(text || '').trim().toLowerCase();
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*([a-zäöü]+)?\.?$/);
  if (!t) app.aendern(opKammer({ ...e, q: null, u: '' }, app.name()));
  else if (m && Number(m[1].replace(',', '.')) === 0) { app.aendern(opKammerWeg(k)); melde(`${e.name} ist alle.`); } else if (m) {
    const zahl = Number(m[1].replace(',', '.'));
    const [u, f] = m[2] ? EINHEIT_AUS[m[2]] || [null, 1] : [e.u || app.einheiten?.[k] || 'Stk', 1];
    // In der Einheit der Rezepte, wenn es geht (eine Packung Feta → 150 g)
    const p = u ? postenAusZeilen(`${zahl * f} ${u === 'Stk' ? '' : u} ${e.name}`.replace(/\s+/g, ' '), app.katalog, mehr()).find((x) => x.k === k) : null;
    if (u) app.aendern(opKammer({ ...e, q: p?.q ?? zahl * f, u: p?.u || u }, app.name()));
    else melde('Das habe ich nicht verstanden – z. B. „200 g“ oder „2“.');
  } else melde('Das habe ich nicht verstanden – z. B. „200 g“ oder „2“.');
  neuZeichnen();
}

/** true, wenn der Klick hierher gehörte. */
export function klickKammer(el) {
  const d = el.dataset;
  if (d.kammerWahl) {
    if (gewaehlt.has(d.kammerWahl)) gewaehlt.delete(d.kammerWahl); else gewaehlt.add(d.kammerWahl);
    wahlMerken();
    neuZeichnen();
    return true;
  }
  if (d.kammerBald) {
    const e = kammer()[d.kammerBald];
    if (e) app.aendern(opKammer({ ...e, bald: !e.bald }, app.name()));
    neuZeichnen();
    return true;
  }
  if (d.kammerWeg) {
    const e = kammer()[d.kammerWeg];
    if (!e) return true;
    gewaehlt.delete(e.k);
    wahlMerken();
    app.aendern(opKammerWeg(e.k));
    melde(`${e.name} ist alle.`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opKammer(e, e.by)) });
    neuZeichnen();
    return true;
  }
  if (d.kammerMenge) {
    bearbeiten = d.kammerMenge;
    neuZeichnen();
    const f = $('#kammer-menge');
    if (f) { f.focus(); f.select(); }
    return true;
  }
  switch (d.act) {
    case 'kammer-alle-zeigen': alleZeigen = true; neuZeichnen(); return true;
    case 'kammer-wahl-weg': wahlZuruecksetzen(); neuZeichnen(); return true;
    case 'kammer-los': $('#k-form')?.requestSubmit(); return true;
    case 'kammer-scannen': scannenUndDazu(); return true;
    default: return false;
  }
}

export function eingabeKammer(t) {
  if (t.id === 'kammer-neu') { neuText = t.value.slice(0, 400); return true; }
  return false;
}

export function aenderungKammer(t) {
  if (t.id !== 'kammer-foto') return false;
  const dateien = [...(t.files || [])];
  t.value = '';
  fotoLesen(dateien);
  return true;
}

export function absendenKammer(ev) {
  if (ev.target.id === 'kammer-dazu-form') { ev.preventDefault(); dazuTippen(); return true; }
  if (ev.target.dataset?.kammerForm) { ev.preventDefault(); mengeSetzen(ev.target.dataset.kammerForm, $('#kammer-menge')?.value); return true; }
  return false;
}
