/*
 * Reiter „Rezepte“, Teil Resteverwertung: Was ist noch da? → die KI macht ein
 * Rezept → die App rechnet es auf eure Ziele → behalten, einkaufen, kochen.
 *
 *   1. #reste zeigt das Formular: Text, Fotos, Portionen, Dazukaufen,
 *      Wünsche. Ohne KI-Schlüssel zuerst das Einrichten.
 *   2. „Rezept machen“ schickt alles an Gemini oder Claude (ki.js) und zeigt, wie weit
 *      die Antwort ist. Abbrechen geht jederzeit.
 *   3. Die Antwort wird geprüft und gerechnet (ki-rezept.js) und als
 *      Vorschlag in der normalen Rezeptansicht geöffnet, mit einer Leiste
 *      obendrauf: Behalten, Neuer Vorschlag, Verwerfen.
 *   4. Behalten legt das Rezept in liste.json unter `ki` ab – für beide. Wer
 *      etwas davon auf die Liste setzt, einen Daumen gibt oder „Heute
 *      gekocht“ drückt, behält es damit automatisch; sonst stünde auf dem
 *      anderen Handy etwas auf der Liste, das es nicht kennt.
 *
 * Formular und Vorschlag überleben ein Neuladen (localStorage), die Fotos
 * nicht – sie sind nur für die eine Anfrage da und gehen nur an den KI-Anbieter.
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc, tagKurz, heute, nfi } from './format.js';
import { kiBereinigen, mengenAnpassen, alsRezept, MAX_GESPEICHERT } from './ki-rezept.js';
import { rumpfFuer, kiAnfragen, kostenCent, anbieterVon, ANBIETER, KI_FEHLER } from './ki.js';
import { ladeKi, speichereKi, loescheKi, kiAus, einladungsLink } from './zugang.js';
import { opKiBehalten, opKiWeg, opTeil, opTeilWeg } from './liste.js';
import { oeffneRezept, schliesseRezept, offenesRezept, rasterZeichnen, ic } from './ansicht-rezepte.js';

const EINGABE = 'boxenstopp.ki.eingabe.v1';
const ENTWURF = 'boxenstopp.ki.entwurf.v1';
const PORTIONEN = [2, 4, 6, 8];
const MAX_FOTOS = 4;
const KANTE = 1280;

const KAMERA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg>';
const BILD = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17"/><circle cx="15.5" cy="9.5" r="1.4"/></svg>';
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';

const gemerkt = lese(EINGABE, {}) || {};
const eingabe = {
  text: typeof gemerkt.text === 'string' ? gemerkt.text.slice(0, 2000) : '',
  wuensche: typeof gemerkt.wuensche === 'string' ? gemerkt.wuensche.slice(0, 200) : '',
  portionen: PORTIONEN.includes(gemerkt.portionen) ? gemerkt.portionen : 8,
  dazukaufen: gemerkt.dazukaufen !== false,
  vermeiden: Array.isArray(gemerkt.vermeiden) ? gemerkt.vermeiden.filter((x) => typeof x === 'string').slice(-5) : [],
  // 'reste' (was da ist) oder 'angebote' (aus den Angeboten der Woche, ansicht-angebote.js)
  modus: gemerkt.modus === 'angebote' ? 'angebote' : 'reste',
};
const eingabeMerken = () => schreibe(EINGABE, eingabe);

let entwurf = (() => {
  const e = lese(ENTWURF, null);
  if (!e || typeof e.id !== 'string' || !/^ki-[a-z0-9]{4,16}$/.test(e.id)) return null;
  const { r } = kiBereinigen(e.r);
  return r ? { id: e.id, r, von: e.von && typeof e.von === 'object' ? e.von : {} } : null;
})();
const entwurfMerken = () => schreibe(ENTWURF, entwurf);

let fotos = []; // { url, b64 }
let lauf = null; // { controller, start, zeichen, schritte, timer }
let fehler = null; // Text
let einrichten = false;

/* ------------------------------------------------ Rezepte für die App */

const alsAppRezept = (id, k, von) => alsRezept(k, { id, katalog: app.katalog, einheiten: app.einheiten, von });

/**
 * app.kiRezepte und app.nachId nach dem Stand neu aufbauen: die behaltenen
 * Rezepte aus liste.json und – solange er nicht behalten ist – der Vorschlag.
 */
export function kiAbgleichen() {
  const ki = app.stand.ki || {};
  if (entwurf && ki[entwurf.id]) { entwurf = null; entwurfMerken(); }
  const neu = Object.entries(ki).map(([id, e]) => alsAppRezept(id, e.r, { by: e.by, at: e.at, gespeichert: true }));
  if (entwurf) neu.push(alsAppRezept(entwurf.id, entwurf.r, { ...entwurf.von, gespeichert: false }));
  neu.sort((a, b) => String(b.ki.von?.at || '').localeCompare(String(a.ki.von?.at || '')));
  for (const r of app.kiRezepte) delete app.nachId[r.id];
  app.kiRezepte = neu;
  for (const r of neu) app.nachId[r.id] = r;
  karteZeichnen();
}

const istEntwurf = (rid) => !!entwurf && entwurf.id === rid;

/** Das KI-Format eines Rezepts (gespeichert oder der Vorschlag) – für „Anpassen“. */
export function kiQuelle(rid) {
  if (app.stand.ki?.[rid]?.r) return app.stand.ki[rid].r;
  return istEntwurf(rid) ? entwurf.r : null;
}

function behalten(rid, { still = false } = {}) {
  if (!istEntwurf(rid)) return;
  const e = entwurf;
  app.aendern(opKiBehalten(e.id, e.r, app.name()));
  if (!still) melde(Object.keys(app.stand.ki || {}).length >= MAX_GESPEICHERT ? `Behalten. Es bleiben höchstens ${MAX_GESPEICHERT}, das älteste fällt raus.` : 'Behalten – das andere Handy sieht es jetzt auch.');
}

function verwerfen() {
  if (!entwurf) return;
  if (entwurf.r?.name && !eingabe.vermeiden.includes(entwurf.r.name)) eingabe.vermeiden = [...eingabe.vermeiden, entwurf.r.name].slice(-5);
  eingabeMerken();
  entwurf = null;
  entwurfMerken();
  kiAbgleichen();
}

function loeschen(rid) {
  const e = app.stand.ki?.[rid];
  if (!e) return;
  // Was von dem Rezept auf der Liste steht, geht mit – sonst stünde dort ein Rezept, das es nicht mehr gibt.
  const teile = Object.entries(app.stand.items).filter(([, d]) => d.parts?.[rid]).map(([k, d]) => [k, d.parts[rid], { n: d.name, c: d.cat }]);
  schliesseRezept();
  app.aendern([...teile.map(([k]) => opTeilWeg(k, rid)), opKiWeg(rid)]);
  melde(`„${e.r.kurz}“ gelöscht`, {
    knopf: 'Rückgängig',
    beiKnopf: () => app.aendern([opKiBehalten(rid, e.r, e.by), ...teile.map(([k, p, kat]) => opTeil(k, rid, p, kat))]),
  });
}

/* --------------------------------------------- Leiste im Rezept */

const kostenText = (c) => (c === 0 ? 'kostenlos' : c < 1 ? 'unter 1 Cent' : `ca. ${Math.round(c)} Cent`);

function kiLeiste(r) {
  const v = r.ki?.von || {};
  const gespeichert = !!v.gespeichert;
  const wer = v.by ? ` von ${v.by === app.name() ? 'dir' : esc(v.by)}` : '';
  const wann = v.at && !Number.isNaN(Date.parse(v.at)) ? `, ${esc(tagKurz(heute(new Date(v.at))))}` : '';
  const z = app.ziel;
  const daneben = Math.abs(r.m.kcal - z.kcal) > 15 || Math.abs(r.m.p - z.p) > 2 || Math.abs(r.m.kh - z.kh) > 3 || Math.abs(r.m.f - z.f) > 2;
  const anp = r.ki.geaendert?.length
    ? `<p class="ki-anp"><b>Geändert:</b> ${r.ki.geaendert.map(esc).join(' · ')}</p>`
    : r.ki.aenderungen?.length
      ? `<p class="ki-anp"><b>Auf eure Ziele gerechnet:</b> ${r.ki.aenderungen.map((a) => `${esc(a.name)} ${nfi(a.vorher)} → ${nfi(a.nachher)} ${esc(a.einheit)}`).join(' · ')}</p>` : '';
  const warn = daneben ? `<p class="ki-warn">Mit diesen Zutaten trifft die Box das Ziel nicht ganz, siehe die Nährwerte oben.${r.ki.hinweis ? ` ${esc(r.ki.hinweis)}` : ''}</p>` : '';
  const hinweis = !daneben && r.ki.hinweis ? `<p class="ki-hinweis">${esc(r.ki.hinweis)}</p>` : '';
  const kosten = !gespeichert && typeof v.kosten === 'number' ? ` · ${esc(v.modell || 'KI')}, ${kostenText(v.kosten)}` : '';
  const basis = r.ki.herkunft ? app.nachId[r.ki.herkunft] : null;
  const quelle = v.modus === 'angebote' ? 'Aus den Angeboten' : 'Resteverwertung';
  const knoepfe = gespeichert
    ? `${r.ki.herkunft ? '' : '<button type="button" class="btn" data-act="ki-neu">Neuer Vorschlag</button>'}<button type="button" class="btn btn-quiet" data-act="ki-loeschen">Löschen</button>`
    : `<button type="button" class="btn btn-primary" data-act="ki-behalten"${app.listeDa ? '' : ' disabled'}>Behalten</button><button type="button" class="btn" data-act="ki-neu">Neuer Vorschlag</button><button type="button" class="btn btn-quiet" data-act="ki-verwerfen">Verwerfen</button>`;
  const titel = r.ki.herkunft
    ? `<b>Angepasst</b>${basis ? ` von <button type="button" class="linkbtn ki-basis" data-open="${esc(basis.id)}">${esc(basis.short)}</button>` : ''}`
    : `<b>${quelle}</b>`;
  return `<p class="ki-k">${titel}${wer}${wann} · ${gespeichert ? 'für euch beide gespeichert' : 'noch nicht gespeichert'}${kosten}</p>${anp}${warn}${hinweis}<div class="ki-btns">${knoepfe}</div>`;
}

/* ------------------------------------------------------ Ansicht */

export const resteOffen = () => !!$('#reste') && !$('#reste').hidden;

export function oeffneReste() {
  if (offenesRezept()) schliesseRezept();
  $('#browse').hidden = true;
  $('#detail').hidden = true;
  const el = $('#reste');
  el.hidden = false;
  resteZeichnen();
  window.scrollTo(0, 0);
}

export function schliesseReste() {
  $('#reste').hidden = true;
  $('#browse').hidden = false;
  rasterZeichnen();
}

function karteZeichnen() {
  const el = $('#reste-letzter');
  if (!el) return;
  el.textContent = entwurf ? `Letzter Vorschlag: ${entwurf.r.kurz}` : '';
  el.hidden = !entwurf;
}

function einrichtenHTML(schluessel) {
  const link = schluessel ? einladungsLink(app.zugang?.token || '', schluessel) : '';
  const da = anbieterVon(schluessel);
  return `<form class="ki-box" id="k-schluessel-form" novalidate>
<h2>Resteverwertung einrichten</h2>
<p>Die App fragt Googles Gemini direkt vom Handy aus. Das ist kostenlos, ohne Kreditkarte – du brauchst nur einmal einen API-Schlüssel von Google:</p>
<ol class="ki-anleitung">
<li>Auf <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> mit deinem Google-Konto anmelden.</li>
<li><b>Create API key</b> (bei der Frage nach dem Projekt: ein neues anlegen lassen).</li>
<li>Den Schlüssel (beginnt mit AQ.) hier einfügen.</li>
</ol>
<label for="k-schluessel">API-Schlüssel</label>
<input id="k-schluessel" type="password" autocomplete="off" spellcheck="false" placeholder="AQ.… oder der Link vom anderen Handy">
<p class="zugang-fehler" id="k-schluessel-fehler"${fehler && einrichten ? '' : ' hidden'}>${esc(einrichten ? fehler || '' : '')}</p>
<div class="zugang-btns"><button type="submit" class="btn btn-primary">Speichern</button>${schluessel ? '<button type="button" class="btn btn-quiet" data-act="k-einrichten-zu">Abbrechen</button><button type="button" class="btn btn-quiet" data-act="k-schluessel-weg">Schlüssel entfernen</button>' : ''}</div>
${da ? `<p class="fine">Eingetragen ist ein Schlüssel von ${esc(ANBIETER[da].name)} (${esc(ANBIETER[da].modell)}).</p>` : ''}
<p class="fine">Gratis heißt bei Google: Was ihr schickt (Fotos, Zutaten), darf Google zum Verbessern seiner Produkte nutzen. Schick also nichts Privates mit aufs Foto. Der Schlüssel bleibt nur auf diesem Handy. Aufs zweite Handy kommt er mit dem Link unter der Einkaufsliste${schluessel ? ' oder mit diesem: <button type="button" class="linkbtn" data-act="k-link">Link fürs zweite Handy kopieren</button>' : ''}.</p>
<p class="fine">Wer lieber Claude nimmt: Ein Anthropic-Schlüssel (sk-ant-…, console.anthropic.com, kostet ein paar Cent pro Rezept) geht hier genauso.</p>
${link ? `<input class="z-linkfeld" id="k-linkfeld" type="text" readonly value="${esc(link)}" aria-label="Link fürs zweite Handy" hidden>` : ''}
</form>`;
}

function fotosHTML() {
  return fotos.map((f, i) => `<div class="k-foto"><img src="${esc(f.url)}" alt="Foto ${i + 1}"><button type="button" class="k-foto-x" data-foto-weg="${i}" aria-label="Foto ${i + 1} entfernen">${X}</button></div>`).join('');
}

function formularHTML() {
  const voll = fotos.length >= MAX_FOTOS;
  return `<form class="ki-form" id="k-form" novalidate>
<label for="k-text">${eingabe.modus === 'angebote' ? 'Im Angebot' : 'Im Kühlschrank und Vorrat'}</label>
<textarea id="k-text" rows="5" maxlength="2000" placeholder="${eingabe.modus === 'angebote' ? 'z. B. Aldi: Hähnchenbrustfilet 1 kg 7,49 €; Paprika 500 g 1,29 €' : 'z. B. 500 g Hähnchenbrust, 1 Zucchini, halbe Packung Basmati, Feta, 3 Eier, Frühlingszwiebeln, Kokosmilch'}">${esc(eingabe.text)}</textarea>
<div class="k-fotos">
<label class="btn${voll ? ' is-aus' : ''}" for="k-kamera">${KAMERA}Foto machen</label><input class="vh" id="k-kamera" type="file" accept="image/*" capture="environment"${voll ? ' disabled' : ''}>
<label class="btn${voll ? ' is-aus' : ''}" for="k-bilder">${BILD}Bild wählen</label><input class="vh" id="k-bilder" type="file" accept="image/*" multiple${voll ? ' disabled' : ''}>
</div>
<div class="k-vorschau" id="k-vorschau">${fotosHTML()}</div>
<div class="k-zeile"><span class="k-k" id="k-port-k">Portionen</span><div class="k-portionen" role="group" aria-labelledby="k-port-k">${PORTIONEN.map((n) => `<button type="button" class="chip" data-portionen="${n}" aria-pressed="${eingabe.portionen === n}">${n}</button>`).join('')}</div></div>
<label class="k-check"><input type="checkbox" id="k-kaufen"${eingabe.dazukaufen ? ' checked' : ''}><span>Fehlendes darf dazugekauft werden</span></label>
<label for="k-wunsch">Wünsche <small>optional</small></label>
<input id="k-wunsch" type="text" maxlength="200" placeholder="z. B. was Asiatisches, ohne Ofen, mit Reis" value="${esc(eingabe.wuensche)}">
<p class="zugang-fehler" id="k-fehler"${fehler ? '' : ' hidden'}>${esc(fehler || '')}</p>
<button type="submit" class="btn btn-primary k-los" id="k-los">Rezept machen</button>
<p class="fine">Dauert etwa eine Minute${anbieterVon(ladeKi()) === 'gemini' ? ' und ist kostenlos. Fotos und Text gehen nur an Google' : ' und kostet ein paar Cent. Fotos und Text gehen nur an Anthropic'}. <button type="button" class="linkbtn" data-act="k-einrichten">KI-Schlüssel ändern</button></p>
</form>`;
}

function laufHTML() {
  return `<div class="ki-lauf" role="status" aria-live="polite">
<div class="ki-topf" aria-hidden="true"><span></span><span></span><span></span></div>
<p class="ki-lauf-t">${anbieterVon(ladeKi()) === 'gemini' ? 'Gemini' : 'Claude'} kocht …</p>
<p class="ki-lauf-d" id="k-lauf-d">${laufText()}</p>
<button type="button" class="btn btn-quiet" data-act="k-abbrechen">Abbrechen</button>
</div>`;
}

function laufText() {
  if (!lauf) return '';
  const s = Math.round((Date.now() - lauf.start) / 1000);
  if (!lauf.zeichen) return `Schaut, was da ist · ${s} s`;
  return `Schreibt das Rezept${lauf.schritte ? `: ${lauf.schritte} Schritte` : ''} · ${s} s`;
}

function laufZeichnen() {
  const el = $('#k-lauf-d');
  if (el) el.textContent = laufText();
}

function gemerktHTML() {
  const teile = [];
  if (entwurf) teile.push(`<div class="ki-letzter"><span>Letzter Vorschlag: <b>${esc(entwurf.r.name)}</b></span><button type="button" class="btn" data-open="${esc(entwurf.id)}">Öffnen</button></div>`);
  const behalten = app.kiRezepte.filter((r) => r.ki?.von?.gespeichert);
  if (behalten.length) {
    teile.push(`<h3 class="sub-h">Behalten</h3><ul class="ki-liste">${behalten.map((r) => {
      const v = r.ki.von;
      const wer = v.by ? `von ${v.by === app.name() ? 'dir' : esc(v.by)}` : '';
      const wann = v.at && !Number.isNaN(Date.parse(v.at)) ? esc(tagKurz(heute(new Date(v.at)))) : '';
      return `<li><button type="button" class="ki-liste-b" data-open="${esc(r.id)}"><b>${esc(r.name)}</b><small>${[wer, wann].filter(Boolean).join(', ')}</small></button></li>`;
    }).join('')}</ul>`);
  }
  return teile.join('');
}

export function resteZeichnen() {
  const el = $('#reste');
  if (!el || el.hidden) return;
  const schluessel = ladeKi();
  const ziele = `${app.ziel.kcal} kcal, ${String(app.ziel.p).replace('.', ',')} g P, ${String(app.ziel.kh).replace('.', ',')} g KH und ${String(app.ziel.f).replace('.', ',')} g F pro Box`;
  const kopf = eingabe.modus === 'angebote'
    ? `<button type="button" class="back" data-act="reste-zu">${ic('back')}Alle Rezepte</button>
<div class="d-head"><span class="tape">Angebote</span><h1 id="k-titel">Rezept aus den Angeboten</h1>
<p class="d-desc">Die KI macht aus den Angeboten der Woche ein Rezept für eure Boxen, und die App rechnet die Mengen auf ${ziele}. <button type="button" class="linkbtn" data-act="k-modus-reste">Lieber Resteverwertung</button></p></div>`
    : `<button type="button" class="back" data-act="reste-zu">${ic('back')}Alle Rezepte</button>
<div class="d-head"><span class="tape">Resteverwertung</span><h1 id="k-titel">Was ist noch da?</h1>
<p class="d-desc">Schreib auf oder fotografier, was im Kühlschrank und im Vorrat liegt. Die KI macht daraus ein Rezept für eure Boxen, und die App rechnet die Mengen auf ${ziele}.</p></div>`;
  let rumpf;
  if (!schluessel || einrichten) rumpf = einrichtenHTML(schluessel);
  else if (lauf) rumpf = laufHTML();
  else rumpf = `${formularHTML()}${gemerktHTML()}`;
  el.innerHTML = kopf + rumpf;
}

/* ------------------------------------------------------- Fotos */

const blobZuB64 = (blob) => new Promise((ok, nein) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] || '');
  r.onerror = () => nein(r.error);
  r.readAsDataURL(blob);
});

async function bildLaden(datei) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(datei); } catch { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(datei);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Auf höchstens 1280 px verkleinern und als JPEG – das spart Zeit und Geld. */
export async function fotoVorbereiten(datei) {
  const bild = await bildLaden(datei);
  const b = bild.width || bild.naturalWidth;
  const h = bild.height || bild.naturalHeight;
  const s = Math.min(1, KANTE / Math.max(b, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
  if (typeof bild.close === 'function') bild.close();
  const blob = await new Promise((ok) => { c.toBlob(ok, 'image/jpeg', 0.82); });
  if (!blob) throw new Error('kein Bild');
  return { url: URL.createObjectURL(blob), b64: await blobZuB64(blob) };
}

async function fotosDazu(dateien) {
  const neu = [...dateien].filter((d) => /^image\//.test(d.type) || !d.type).slice(0, MAX_FOTOS - fotos.length);
  if (!neu.length) return;
  let kaputt = 0;
  for (const d of neu) {
    try { fotos.push(await fotoVorbereiten(d)); } catch { kaputt++; }
  }
  if (kaputt) melde(kaputt === 1 ? 'Ein Bild ließ sich nicht lesen.' : `${kaputt} Bilder ließen sich nicht lesen.`);
  if (!lauf) resteZeichnen();
}

function fotoWeg(i) {
  const f = fotos[i];
  if (!f) return;
  URL.revokeObjectURL(f.url);
  fotos.splice(i, 1);
  resteZeichnen();
}

/* ------------------------------------------------- Rezept machen */

function namenMitDaumen(wert) {
  return Object.entries(app.stand.bewertung || {})
    .filter(([, b]) => b.wert === wert)
    .map(([rid]) => app.nachId[rid]?.name)
    .filter(Boolean)
    .slice(0, 6);
}

async function rezeptMachen() {
  const schluessel = ladeKi();
  if (!schluessel) { einrichten = true; resteZeichnen(); return; }
  if (lauf) return;
  const text = eingabe.text.trim();
  if (!text && !fotos.length) {
    fehler = eingabe.modus === 'angebote' ? 'Es stehen keine Angebote drin.' : 'Schreib auf, was da ist, oder mach ein Foto.';
    resteZeichnen();
    $('#k-text')?.focus();
    return;
  }
  fehler = null;
  lauf = { controller: new AbortController(), start: Date.now(), zeichen: 0, schritte: 0, timer: null, wach: null };
  lauf.timer = setInterval(laufZeichnen, 1000);
  resteZeichnen();
  const meinLauf = lauf;
  const anbieter = anbieterVon(schluessel) || 'anthropic';
  // Bildschirm an, solange die KI schreibt – ein schlafendes Handy reißt den Strom ab.
  try { meinLauf.wach = await navigator.wakeLock?.request('screen'); } catch { /* dann eben ohne */ }
  const fertig = () => {
    clearInterval(meinLauf.timer);
    meinLauf.wach?.release?.().catch(() => {});
    lauf = null;
  };
  try {
    const rumpf = rumpfFuer(anbieter, {
      text,
      wuensche: eingabe.wuensche,
      fotos: fotos.map((f) => f.b64),
      portionen: eingabe.portionen,
      dazukaufen: eingabe.dazukaufen,
      ziel: app.ziel,
      katalog: app.katalog,
      mag: namenMitDaumen('hoch'),
      magNicht: namenMitDaumen('runter'),
      vermeiden: eingabe.vermeiden,
      modus: eingabe.modus,
    });
    const { eingabe: roh, usage } = await kiAnfragen(rumpf, {
      schluessel,
      api: lese('__kiapi', null) || '',
      signal: meinLauf.controller.signal,
      beiFortschritt: (f) => { meinLauf.zeichen = f.zeichen; meinLauf.schritte = f.schritte; laufZeichnen(); },
    });
    const { r, fehler: f, art } = kiBereinigen({ ...roh, portionen: eingabe.portionen });
    if (!r) throw Object.assign(new Error(f), { art });
    const id = `ki-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    entwurf = { id, r: mengenAnpassen(r, app.ziel), von: { by: app.name() || null, at: new Date().toISOString(), kosten: kostenCent(usage, anbieter), modell: ANBIETER[anbieter].modell, modus: eingabe.modus } };
    entwurfMerken();
    kiAbgleichen();
    fertig();
    oeffneRezept(id);
  } catch (e) {
    fertig();
    if (e?.art !== 'abbruch') {
      fehler = e?.message || KI_FEHLER.antwort;
      if (e?.art === 'schluessel') einrichten = true;
    }
    resteZeichnen();
  }
}

/* ------------------------------------------------------ Klicks */

function linkKopieren() {
  const link = einladungsLink(app.zugang?.token || '', ladeKi());
  const feld = $('#k-linkfeld');
  const zeigen = () => { if (feld) { feld.hidden = false; feld.select(); } melde('Kopieren klappt hier nicht. Der Link steht jetzt im Feld darunter.'); };
  try {
    navigator.clipboard.writeText(link).then(() => melde('Link kopiert. Auf dem zweiten Handy öffnen.'), zeigen);
  } catch { zeigen(); }
}

/** true, wenn der Klick hierher gehörte. */
export function klickKi(el) {
  const d = el.dataset;
  if (d.portionen) {
    eingabe.portionen = Number(d.portionen);
    eingabeMerken();
    for (const b of document.querySelectorAll('[data-portionen]')) b.setAttribute('aria-pressed', String(b.dataset.portionen === d.portionen));
    return true;
  }
  if (d.fotoWeg !== undefined) { fotoWeg(Number(d.fotoWeg)); return true; }
  const rid = offenesRezept();
  switch (d.act) {
    case 'reste': if (eingabe.modus !== 'reste') { eingabe.modus = 'reste'; eingabe.text = ''; eingabeMerken(); } oeffneReste(); return true;
    case 'k-modus-reste': eingabe.modus = 'reste'; eingabe.text = ''; fehler = null; eingabeMerken(); resteZeichnen(); return true;
    case 'reste-zu': schliesseReste(); return true;
    case 'k-abbrechen': lauf?.controller.abort(); return true;
    case 'k-einrichten': einrichten = true; fehler = null; resteZeichnen(); $('#k-schluessel')?.focus(); return true;
    case 'k-einrichten-zu': einrichten = false; fehler = null; resteZeichnen(); return true;
    case 'k-schluessel-weg': loescheKi(); einrichten = false; fehler = null; resteZeichnen(); melde('KI-Schlüssel entfernt.'); return true;
    case 'k-link': linkKopieren(); return true;
    case 'ki-behalten': behalten(rid); return true;
    case 'ki-verwerfen': {
      verwerfen();
      oeffneReste();
      return true;
    }
    case 'ki-neu': {
      if (istEntwurf(rid)) verwerfen();
      else if (app.nachId[rid]?.name && !eingabe.vermeiden.includes(app.nachId[rid].name)) { eingabe.vermeiden = [...eingabe.vermeiden, app.nachId[rid].name].slice(-5); eingabeMerken(); }
      oeffneReste();
      if (eingabe.text.trim() || fotos.length) rezeptMachen();
      return true;
    }
    case 'ki-loeschen': loeschen(rid); return true;
    default: return false;
  }
}

export function eingabeKi(t) {
  if (t.id === 'k-text') { eingabe.text = t.value.slice(0, 2000); eingabeMerken(); if (fehler) { fehler = null; const f = $('#k-fehler'); if (f) f.hidden = true; } return true; }
  if (t.id === 'k-wunsch') { eingabe.wuensche = t.value.slice(0, 200); eingabeMerken(); return true; }
  return false;
}

export function aenderungKi(t) {
  if (t.id === 'k-kaufen') { eingabe.dazukaufen = t.checked; eingabeMerken(); return true; }
  if (t.id === 'k-kamera' || t.id === 'k-bilder') {
    const dateien = [...(t.files || [])];
    t.value = '';
    fotosDazu(dateien);
    return true;
  }
  return false;
}

export function absendenKi(ev) {
  if (ev.target.id === 'k-form') {
    ev.preventDefault();
    rezeptMachen();
    return true;
  }
  if (ev.target.id === 'k-schluessel-form') {
    ev.preventDefault();
    const s = kiAus($('#k-schluessel').value);
    if (!s) {
      fehler = 'Das sieht nicht nach einem Schlüssel aus. Er beginnt mit AQ. oder AIza (Google) oder sk-ant- (Anthropic).';
      const f = $('#k-schluessel-fehler');
      if (f) { f.textContent = fehler; f.hidden = false; }
      return true;
    }
    speichereKi(s);
    einrichten = false;
    fehler = null;
    resteZeichnen();
    melde('Gespeichert. Jetzt aufschreiben oder fotografieren, was da ist.');
    return true;
  }
  return false;
}

/**
 * Von ansicht-angebote.js: ein Rezept aus den Angeboten der Woche. Der Text
 * (eine Zeile je Laden) kommt ins Formular, der Lauf startet sofort; der
 * Vorschlag öffnet sich wie bei der Resteverwertung, mit „Neuer Vorschlag“
 * für den nächsten.
 */
export function resteMitAngeboten(text, { wuensche = '' } = {}) {
  eingabe.modus = 'angebote';
  eingabe.text = String(text || '').slice(0, 2000);
  eingabe.dazukaufen = true;
  eingabe.portionen = 8;
  if (wuensche) eingabe.wuensche = String(wuensche).slice(0, 200);
  eingabeMerken();
  oeffneReste();
  rezeptMachen();
}

/** Von anderswo (Angebote): die Resteverwertung mit dem Einrichten öffnen. */
export function oeffneEinrichten() {
  einrichten = true;
  fehler = null;
  oeffneReste();
  $('#k-schluessel')?.focus();
}

/** Beim Start: Haken setzen, Vorschlag anmelden, #reste öffnen. */
export function kiStart({ oeffnen = false } = {}) {
  app.kiLeiste = kiLeiste;
  app.kiVorAktion = (rid) => { if (istEntwurf(rid)) behalten(rid, { still: true }); };
  kiAbgleichen();
  if (oeffnen) oeffneReste();
}
