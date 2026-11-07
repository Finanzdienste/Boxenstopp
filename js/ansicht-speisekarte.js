/*
 * „Speisekarte“ (Kachel bei den Rezepten): Fotos, ein PDF, Text oder ein
 * Link einer Karte – welches Gericht kommt dem Ziel pro Box am nächsten?
 * Lesen und Schätzen macht die KI, Rechnen und Sortieren speisekarte.js;
 * hier Eingabe, Lauf und Ergebnis.
 *
 * Das letzte Ergebnis merkt sich das Gerät (GEMERKT): Im Restaurant mit
 * schlechtem Netz ist es noch da, und ändert man sein Ziel, sortiert die App
 * neu, ohne die KI noch einmal zu fragen. Nichts davon geht in die Liste.
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc, nfi } from './format.js';
import { rumpfKarte, karteBereinigen, sortieren, ART_NAME, ENTHAELT_NAME } from './speisekarte.js';
import { kiAnfragen, anbieterVon } from './ki.js';
import { jsonAus, linkAus } from './amy-import.js';
import { ladeKi } from './zugang.js';
import { fotoVorbereiten, blobZuB64, oeffneEinrichten } from './ansicht-ki.js';
import { offenesRezept, schliesseRezept, rasterZeichnen, ic } from './ansicht-rezepte.js';
import { fuerWen, istEigen } from './profil.js';
import { zielText } from './zielrechner.js';

const GEMERKT = 'boxenstopp.speisekarte.v1';
const MAX_FOTOS = 6;
const MAX_PDF = 15 * 1024 * 1024;
const KANTE = 2000;
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
const KAMERA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13" r="3.4"/></svg>';
const BILD = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/></svg>';
const PDF = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/></svg>';

let fotos = []; // { url, b64 }
let pdf = null; // { name, b64 }
let text = '';
let lauf = null; // { controller, start, gerichte, timer }
let fehler = '';
let ergebnis = gemerkt();

function gemerkt() {
  const g = lese(GEMERKT, null);
  if (!g || typeof g !== 'object') return null;
  const b = karteBereinigen(g);
  return b.gerichte ? { ...b, at: typeof g.at === 'string' ? g.at : '' } : null;
}

export const speisekarteOffen = () => !!$('#speisekarte') && !$('#speisekarte').hidden;

export function oeffneSpeisekarte() {
  if (offenesRezept()) schliesseRezept();
  for (const id of ['#browse', '#detail', '#reste']) { const el = $(id); if (el) el.hidden = true; }
  const el = $('#speisekarte');
  el.hidden = false;
  zeichnen();
  window.scrollTo(0, 0);
}

export function schliesseSpeisekarte() {
  const el = $('#speisekarte');
  if (el) el.hidden = true;
  $('#browse').hidden = false;
  rasterZeichnen();
}

/* ------------------------------------------------------------ Zeichnen */

const wessenZiel = () => (istEigen() ? 'deinem' : app.name() ? 'deinem' : 'eurem');
/* Geschätzt ist geschätzt: ganze Zahlen, keine Kommastellen, die es nicht gibt */
const zahl = (k, x) => nfi(x);
const mitZeichen = (k, x) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${zahl(k, Math.abs(x))}`;

function werteHTML(w, abw) {
  const zeile = [['kcal', 'kcal', ''], ['p', 'P', ' g'], ['kh', 'KH', ' g'], ['f', 'F', ' g']];
  return `<div class="sk-werte" role="group" aria-label="Geschätzte Nährwerte">${zeile.map(([k, name, e]) => {
    const d = abw[k];
    const grenze = k === 'kcal' ? 60 : k === 'f' ? 4 : 6;
    const ton = Math.abs(d) <= grenze / 2 ? 'gut' : Math.abs(d) <= grenze ? 'mittel' : 'weit';
    return `<div class="c-${k}"><span class="k">${name}</span><b>${zahl(k, w[k])}<small>${e}</small></b><span class="sk-d sk-${ton}">${mitZeichen(k, d)}</span></div>`;
  }).join('')}</div>`;
}

const SICHER_TEXT = { gut: 'gut zu schätzen', mittel: 'Schätzung', grob: 'grobe Schätzung' };

function gerichtKarte({ g, b }, gross = false) {
  const tipp = b.tipp && g.tipp ? `<p class="sk-bestellen"><b>So bestellen:</b> ${esc(g.tipp)}</p>` : '';
  const meta = [ART_NAME[g.art], g.preis, g.portion, SICHER_TEXT[g.sicher]].filter(Boolean).map(esc).join(' · ');
  return `<article class="sk-gericht${gross ? ' sk-erste' : ''}">
${gross ? `<span class="sk-eyebrow">Am nächsten an ${wessenZiel()} Ziel</span>` : ''}
<h${gross ? 2 : 3} class="sk-name">${esc(g.name)}</h${gross ? 2 : 3}>
${g.was ? `<p class="sk-was">${esc(g.was)}</p>` : ''}
${tipp}
${werteHTML(b.werte, b.abweichung)}
<p class="sk-meta">${meta}</p>
</article>`;
}

function zeileHTML({ g, b }) {
  const chips = g.enthaelt.map((x) => `<span class="sk-chip">${esc(ENTHAELT_NAME[x] || x)}</span>`).join('');
  return `<li class="sk-zeile"><div class="sk-zeile-t"><b>${esc(g.name)}</b>${chips}<small>${esc([ART_NAME[g.art], g.preis].filter(Boolean).join(' · '))}${b.tipp ? ' · mit Tipp' : ''}</small></div><span class="sk-zeile-w">${nfi(b.werte.kcal)} kcal · P ${nfi(b.werte.p)} · KH ${nfi(b.werte.kh)} · F ${nfi(b.werte.f)}</span></li>`;
}

function ergebnisHTML() {
  const { oben, rest, ohne } = sortieren(ergebnis.gerichte, app.ziel);
  const wann = ergebnis.at && !Number.isNaN(Date.parse(ergebnis.at)) ? new Date(ergebnis.at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const kopf = `<p class="sk-k">${esc(ergebnis.restaurant || 'Die Karte')} · ${ergebnis.gerichte.length} ${ergebnis.gerichte.length === 1 ? 'Gericht' : 'Gerichte'}${wann ? ` · gelesen ${esc(wann)}` : ''}</p>`;
  const hinweis = ergebnis.hinweis ? `<p class="fine">${esc(ergebnis.hinweis)}</p>` : '';
  const erste = oben[0] ? gerichtKarte(oben[0], true) : '<p class="sk-leer">Auf der Karte ist nichts, was als Mahlzeit passt.</p>';
  const auch = oben.length > 1 ? `<h3 class="sub-h">Danach am nächsten</h3><div class="sk-auch">${oben.slice(1).map((x) => gerichtKarte(x)).join('')}</div>` : '';
  const alle = rest.length ? `<details class="sk-alle"><summary>Alle weiteren Gerichte (${rest.length}), nächstes zuerst</summary><ul class="sk-liste">${rest.map(zeileHTML).join('')}</ul></details>` : '';
  const nicht = ohne.length ? `<details class="sk-alle sk-ohne"><summary>${istEigen() ? 'Mit Fisch, Schwein & Co.' : 'Esst ihr nicht'} (${ohne.length})</summary><ul class="sk-liste">${ohne.map(zeileHTML).join('')}</ul></details>` : '';
  return `<section class="sk-ergebnis" aria-label="Ergebnis">${kopf}${erste}${auch}${alle}${nicht}${hinweis}
<p class="fine">Die Nährwerte schätzt die KI aus der Karte – Restaurantportionen schwanken, rechne mit ±20 %. Was am nächsten an ${esc(zielText(app.ziel))} liegt, rechnet die App aus; Fett zählt dabei 1,5-fach.</p>
<div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="sk-neu">Andere Karte</button></div></section>`;
}

function vorschauHTML() {
  const bilder = fotos.map((f, i) => `<div class="k-foto"><img src="${esc(f.url)}" alt="Foto ${i + 1}"><button type="button" class="k-foto-x" data-sk-foto-weg="${i}" aria-label="Foto ${i + 1} entfernen">${X}</button></div>`).join('');
  const datei = pdf ? `<div class="sk-pdf">${PDF}<span>${esc(pdf.name)}</span><button type="button" class="k-foto-x" data-act="sk-pdf-weg" aria-label="PDF entfernen">${X}</button></div>` : '';
  return datei + bilder;
}

function formularHTML() {
  const voll = fotos.length >= MAX_FOTOS;
  const gemini = anbieterVon(ladeKi()) === 'gemini';
  return `<form class="ki-form" id="sk-form" novalidate>
<div class="k-fotos">
<label class="btn${voll ? ' is-aus' : ''}" for="sk-kamera">${KAMERA}Foto machen</label><input class="vh" id="sk-kamera" type="file" accept="image/*" capture="environment"${voll ? ' disabled' : ''}>
<label class="btn${voll ? ' is-aus' : ''}" for="sk-bilder">${BILD}Bilder wählen</label><input class="vh" id="sk-bilder" type="file" accept="image/*" multiple${voll ? ' disabled' : ''}>
<label class="btn" for="sk-pdf">${PDF}PDF wählen</label><input class="vh" id="sk-pdf" type="file" accept="application/pdf,.pdf">
</div>
<div class="k-vorschau" id="sk-vorschau">${vorschauHTML()}</div>
<label for="sk-text">Oder Text oder Link <small>optional</small></label>
<textarea id="sk-text" rows="3" maxlength="30000" placeholder="Die Karte als Text einfügen${gemini ? ' – oder den Link zur Karte auf der Webseite' : ''}">${esc(text)}</textarea>
<p class="zugang-fehler" id="sk-fehler"${fehler ? '' : ' hidden'}>${esc(fehler)}</p>
<button type="submit" class="btn btn-primary k-los" id="sk-los">Passendes Gericht finden</button>
<p class="fine">Dauert etwa eine halbe Minute; gemerkt wird das Ergebnis nur auf diesem Gerät.</p>
${ergebnis ? '<div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="sk-letzte">Letztes Ergebnis zeigen</button></div>' : ''}
</form>`;
}

function laufHTML() {
  const s = Math.round((Date.now() - lauf.start) / 1000);
  return `<div class="ki-lauf" role="status" aria-live="polite">
<div class="ki-topf" aria-hidden="true"><span></span><span></span><span></span></div>
<p class="ki-lauf-t">${anbieterVon(ladeKi()) === 'gemini' ? 'Gemini' : 'Claude'} liest die Karte …</p>
<p class="ki-lauf-d" id="sk-lauf-d">${lauf.gerichte ? `${lauf.gerichte} Gerichte geschätzt` : 'Liest'} · ${s} s</p>
<button type="button" class="btn btn-quiet" data-act="sk-abbrechen">Abbrechen</button>
</div>`;
}

let neuEingeben = false;
export function zeichnen() {
  const el = $('#speisekarte');
  if (!el || el.hidden) return;
  const kopf = `<button type="button" class="back" data-act="sk-zu">${ic('back')}Alle Rezepte</button>
<div class="d-head"><span class="tape">Speisekarte</span><h1 id="sk-titel">Was soll ich hier essen?</h1>
<p class="d-desc">Fotografier die Karte oder nimm das PDF – die App sagt dir, welches Gericht ${wessenZiel()} Ziel pro Box (${esc(zielText(app.ziel))}) am nächsten kommt, und wie du bestellst, damit es noch besser passt.</p></div>`;
  let rumpf;
  if (!ladeKi()) {
    rumpf = `<div class="ki-box"><h2>Erst einen KI-Schlüssel</h2><p>Die Karte liest die KI – dafür braucht die App einmal einen KI-Schlüssel.</p><div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="sk-einrichten">Einrichten</button></div></div>`;
  } else if (lauf) rumpf = laufHTML();
  else if (ergebnis && !neuEingeben) rumpf = ergebnisHTML();
  else rumpf = formularHTML();
  el.innerHTML = kopf + rumpf;
}

/* --------------------------------------------------------- Eingaben */

async function bilderDazu(dateien) {
  const neu = [...dateien].filter((d) => /^image\//.test(d.type) || !d.type).slice(0, MAX_FOTOS - fotos.length);
  let kaputt = 0;
  for (const d of neu) {
    try { fotos.push(await fotoVorbereiten(d, KANTE)); } catch { kaputt++; }
  }
  if (kaputt) melde(kaputt === 1 ? 'Ein Bild ließ sich nicht lesen.' : `${kaputt} Bilder ließen sich nicht lesen.`);
  if (!lauf) zeichnen();
}

async function pdfDazu(datei) {
  if (!datei) return;
  if (!/pdf$/i.test(datei.type) && !/\.pdf$/i.test(datei.name || '')) { melde('Das ist kein PDF.'); return; }
  if (datei.size > MAX_PDF) { melde('Das PDF ist zu groß (höchstens 15 MB). Fotografier lieber die Seiten mit den Gerichten.'); return; }
  try { pdf = { name: String(datei.name || 'Speisekarte.pdf').slice(0, 60), b64: await blobZuB64(datei) }; } catch { melde('Das PDF ließ sich nicht lesen.'); return; }
  if (!lauf) zeichnen();
}

/** Dateien gewählt (change). true, wenn es hierher gehörte. */
export function aenderungSpeisekarte(ziel) {
  if (!['sk-kamera', 'sk-bilder', 'sk-pdf'].includes(ziel.id)) return false;
  text = $('#sk-text')?.value ?? text;
  const dateien = [...(ziel.files || [])];
  ziel.value = '';
  if (ziel.id === 'sk-pdf') pdfDazu(dateien[0]); else bilderDazu(dateien);
  return true;
}

export function eingabeSpeisekarte(ziel) {
  if (ziel.id !== 'sk-text') return false;
  text = ziel.value;
  return true;
}

async function lesen() {
  const schluessel = ladeKi();
  const anbieter = anbieterVon(schluessel);
  text = $('#sk-text')?.value ?? text;
  if (!fotos.length && !pdf && !text.trim()) {
    fehler = 'Erst die Karte: ein Foto, ein PDF oder den Text.';
    zeichnen();
    return;
  }
  if (anbieter !== 'gemini' && linkAus(text) && !fotos.length && !pdf) {
    fehler = 'Links liest nur Gemini. Kopier den Text der Karte oder mach ein Foto.';
    zeichnen();
    return;
  }
  fehler = '';
  const meinLauf = { controller: new AbortController(), start: Date.now(), gerichte: 0 };
  lauf = meinLauf;
  meinLauf.timer = setInterval(() => { const el = $('#sk-lauf-d'); if (el && lauf === meinLauf) el.textContent = `${lauf.gerichte ? `${lauf.gerichte} Gerichte geschätzt` : 'Liest'} · ${Math.round((Date.now() - lauf.start) / 1000)} s`; }, 1000);
  zeichnen();
  try {
    const link = anbieter === 'gemini' && !fotos.length && !pdf && !!linkAus(text);
    const rumpf = rumpfKarte({ anbieter, ziel: app.ziel, wer: istEigen() ? fuerWen() : (app.name() || 'Tobi'), text, fotos: fotos.map((f) => f.b64), pdf: pdf?.b64 || '' });
    const antwort = await kiAnfragen(rumpf, {
      schluessel,
      signal: meinLauf.controller.signal,
      roh: link,
      beiFortschritt: ({ gerichte }) => { meinLauf.gerichte = gerichte; },
    });
    const roh = link ? jsonAus(antwort.text) : antwort.eingabe;
    const b = karteBereinigen(roh);
    if (!b.gerichte) throw Object.assign(new Error(b.fehler), { art: 'leer' });
    ergebnis = { ...b, at: new Date().toISOString() };
    schreibe(GEMERKT, ergebnis);
    for (const f of fotos) URL.revokeObjectURL(f.url);
    fotos = [];
    pdf = null;
    text = '';
    neuEingeben = false;
  } catch (e) {
    fehler = e?.art === 'abbruch' ? '' : e?.message || 'Das hat nicht geklappt. Nochmal versuchen.';
  } finally {
    clearInterval(meinLauf.timer);
    if (lauf === meinLauf) lauf = null;
    zeichnen();
    if (!fehler && ergebnis) window.scrollTo(0, 0);
  }
}

export function absendenSpeisekarte(ev) {
  if (ev.target.id !== 'sk-form') return false;
  ev.preventDefault();
  if (!lauf) lesen();
  return true;
}

export function klickSpeisekarte(el) {
  if (el.dataset.skFotoWeg !== undefined) {
    const f = fotos.splice(Number(el.dataset.skFotoWeg), 1)[0];
    if (f) URL.revokeObjectURL(f.url);
    text = $('#sk-text')?.value ?? text;
    zeichnen();
    return true;
  }
  switch (el.dataset.act) {
    case 'speisekarte': oeffneSpeisekarte(); return true;
    case 'sk-zu': schliesseSpeisekarte(); return true;
    case 'sk-neu': neuEingeben = true; fehler = ''; zeichnen(); $('#sk-form')?.scrollIntoView({ block: 'start' }); return true;
    case 'sk-letzte': neuEingeben = false; text = $('#sk-text')?.value ?? text; zeichnen(); return true;
    case 'sk-pdf-weg': pdf = null; text = $('#sk-text')?.value ?? text; zeichnen(); return true;
    case 'sk-abbrechen': lauf?.controller.abort(); return true;
    case 'sk-einrichten': schliesseSpeisekarte(); oeffneEinrichten(); return true;
    default: return false;
  }
}

/** Ein neues Ziel: das gemerkte Ergebnis neu sortieren (app.js). */
export function speisekarteNeu() { if (speisekarteOffen() && !lauf) zeichnen(); }
