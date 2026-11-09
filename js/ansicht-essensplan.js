/*
 * Reiter „Essensplan“: die nächsten Tage und Wochen für alle, die die Liste
 * teilen (Daten und Rechnen: essensplan.js). Je Woche Montag bis Sonntag,
 * je Tag Mittag und Abend – mehrere Einträge, je mit „wer“ (beide, Tobi,
 * Amy) – und Kochtage: „Chili kochen, 8 Boxen“ mit „Verteilen“ auf die Tage
 * danach (für beide zwei Boxen je Mahlzeit). Oben „Woche auf die
 * Einkaufsliste“: die Rezepte der Kochtage und was frisch gekocht wird.
 *
 * Eintragen: ein Suchfeld mit Vorschlägen – Boxen von Kochtagen, Rezepte
 * (feste, neue, Amys), Ideen aus Amys Notizen – oder einfach Text („Pizza
 * bestellen“). Isst Amy mit und verträgt etwas nicht, steht es dabei.
 */
import { app, $, melde, lese, schreibe, zeigeReiter, ansicht, istSchmal } from './kern.js';
import { esc } from './format.js';
import { person, istEigen } from './profil.js';
import { hatTeil, einkaufsZutaten, opTeil } from './liste.js';
import { opEssensplan, neueId, heuteTag, tagPlus, montagVon, wocheVon, tagName, tagKurzName, tagDatum, tageZwischen, MAHLZEITEN, MAHLZEIT_NAME, kochtagVon, kochtage, verplant, boxenVerteilen, boxenVon, einkaufDerWoche, geplanteMahlzeiten, MAX_BOXEN } from './essensplan.js';
import { ideenAus } from './notizbuch.js';
import { amyEinkauf, zutatenVon } from './amy.js';
import { bildPfad } from './bilder.js';
import { pruefeFest, pruefeZutaten } from './ansicht-vertraeglich.js';
import { normal } from './vertraeglich.js';
import { oeffneRezept } from './ansicht-rezepte.js';
import { amyOeffnen } from './ansicht-amy.js';

const ANSICHT = 'boxenstopp.plan.ansicht.v1'; // { montag } – welche Woche, nur auf diesem Gerät
const ZURUECK_WOCHEN = 2;
const VORAUS_WOCHEN = 25;

const TOPF = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 10.5h15v7.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M3 8.2C3 7.5 3.6 7 4.3 7h15.4c.7 0 1.3.5 1.3 1.2v.6c0 .4-.3.7-.7.7H3.7a.7.7 0 0 1-.7-.7z"/><path d="M9.5 4.5c0-1 .8-1.5 1.5-1.5h2c.7 0 1.5.5 1.5 1.5V7"/></svg>';
const LISTE_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.6l1.3 1.3L7.6 5.4M3.8 12.1l1.3 1.3 2.5-2.5M3.8 17.6l1.3 1.3 2.5-2.5"/></svg>';
const LINKS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const RECHTS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const IDEE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>';

let montag = (() => {
  const z = lese(ANSICHT, null);
  const jetzt = montagVon(heuteTag());
  const m = typeof z?.montag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(z.montag) ? montagVon(z.montag) : '';
  return m && m >= jetzt ? m : jetzt;
})();
let offen = null; // { tag, mz: 'mittag' | 'abend' | 'kochen', id?, verteilen? } – was gerade bearbeitet wird
let suche = '';
let werNeu = 'beide';
let verteilen = { wer: 'beide', mahlzeit: 'mittag', werktage: true, abHeute: false };

const plan = () => app.stand.essensplan || { tage: {} };
const merken = () => schreibe(ANSICHT, { montag });
const istHeute = (tag) => tag === heuteTag();

/** Wer die Liste teilt – in einer eigenen Liste nur die eine Person. */
function leute() {
  if (istEigen()) return [person()];
  const l = Object.values(app.stand.leute || {}).filter(Boolean);
  const alle = l.length ? l : [app.name() || 'Tobi', person()];
  return [...new Set(alle.map(String))].slice(0, 4);
}
const mehrere = () => leute().length > 1;
const werStandard = () => (mehrere() ? 'beide' : leute()[0]);
const werText = (w) => (w === 'beide' ? 'beide' : w === app.name() ? 'du' : w);
/** „für euch beide“ / „für dich“ / „für Tobi“ */
const werFuer = (w) => (w === 'beide' ? 'euch beide' : w === app.name() ? 'dich' : w);
const werKlasse = (w) => (w === 'beide' ? 'beide' : normal(w).replace(/ /g, '-'));
const amyIsstMit = (w) => w === 'beide' || String(w).toLowerCase() === person().toLowerCase();
const daten = () => ({ katalog: app.katalog, naehrwerte: app.naehrwerte, preise: app.preise, einheiten: app.einheiten, gleich: app.stand.gleich, abteilungen: app.stand.abteilungen, gemeint: app.stand.gemeint });

/** Ein Rezept aus dem Plan: fest (Katalog, Resteverwertung) oder Amys. */
function rezeptVon(rid) {
  const r = app.nachId[rid] || app.extras?.[rid];
  if (r) return { art: 'fest', r, name: r.name, kurz: r.short || r.name, bild: r.bild && /^bilder\/rezepte\/[a-z0-9-]+\.webp(\?v=[0-9a-f]+)?$/.test(r.bild) ? r.bild : '' };
  const a = app.stand.amy?.[rid];
  if (a) return { art: 'amy', r: a, name: a.name, kurz: a.name, bild: bildPfad(a.bild), amy: true };
  return null;
}

/** Was Amy daran nicht verträgt: { nicht, wenig } (leer, wenn nichts eingetragen ist). */
function vtVon(x) {
  if (!x) return { nicht: [], wenig: [] };
  if (x.art === 'fest') return pruefeFest(x.r);
  return pruefeZutaten(zutatenVon(x.r, app.katalog, daten()).map((z) => ({ k: String(z.k || '').startsWith('amyz-') ? '' : z.k, name: z.name })));
}
function vtMarke(x, w) {
  if (!amyIsstMit(w)) return '';
  const v = vtVon(x);
  const fuer = person() === app.name() ? 'dich' : person();
  if (v.nicht.length) return `<span class="vt-zeichen vt-nicht" title="Geht nicht für ${esc(fuer)}">✗</span>`;
  if (v.wenig.length) return `<span class="vt-zeichen vt-wenig" title="Nur wenig für ${esc(fuer)}">~</span>`;
  return '';
}

const bildHTML = (x) => (x?.bild ? `<img src="${esc(x.bild)}" alt="" width="28" height="28" decoding="async" loading="lazy">` : `<span class="plan-ic">${x ? TOPF : IDEE}</span>`);

/* ------------------------------------------------------------- Einkauf */

/** Was für die Woche noch fehlt: Änderungen für die Liste und wie viele Zutaten. */
function einkaufFuer(m) {
  const ops = [];
  const rezepte = [];
  for (const x of einkaufDerWoche(plan(), m)) {
    const f = app.nachId[x.rid] || app.extras?.[x.rid];
    if (f) {
      rezepte.push(f.short || f.name);
      for (const it of einkaufsZutaten(f).filter((z) => !hatTeil(app.stand, z.k, f.id))) ops.push(opTeil(it.k, f.id, { q: it.q, u: it.u, h: it.h || '' }, it.kat || app.katalog[it.k]));
      continue;
    }
    const a = app.stand.amy?.[x.rid];
    if (a) {
      rezepte.push(a.name);
      for (const z of amyEinkauf(a, daten()).filter((y) => !hatTeil(app.stand, y.k, a.id))) ops.push(opTeil(z.k, a.id, z.teil, z.kat));
    }
  }
  return { ops, rezepte };
}

function einkaufHTML() {
  const e = einkaufFuer(montag);
  if (!e.rezepte.length) return '<p class="plan-einkauf-leer">Für diese Woche ist noch nichts zum Einkaufen geplant – ein Kochtag oder ein Rezept, und es geht mit einem Tipp auf die Liste.</p>';
  if (!e.ops.length) return `<p class="onlist plan-einkauf-fertig">${LISTE_IC}Alles für diese Woche steht auf der Liste</p>`;
  return `<button type="button" class="btn btn-primary plan-einkauf" data-act="plan-liste"${app.listeDa ? '' : ' disabled'}>${LISTE_IC}Woche auf die Einkaufsliste<span class="btn-n">${e.ops.length}</span></button><small class="plan-einkauf-was">${esc(e.rezepte.slice(0, 4).join(', '))}${e.rezepte.length > 4 ? ' …' : ''}</small>`;
}

/* ------------------------------------------------------------- Zeichnen */

function wocheText() {
  const jetzt = montagVon(heuteTag());
  const n = Math.round(tageZwischen(jetzt, montag) / 7);
  if (n === 0) return 'Diese Woche';
  if (n === 1) return 'Nächste Woche';
  if (n === -1) return 'Letzte Woche';
  return n > 0 ? `In ${n} Wochen` : `Vor ${-n} Wochen`;
}

function werChips(aktuell, attr) {
  if (!mehrere()) return '';
  return `<div class="plan-chips" role="radiogroup" aria-label="Wer isst mit">${['beide', ...leute()].map((w) => `<button type="button" class="chip plan-wer-chip w-${werKlasse(w)}" role="radio" ${attr}="${esc(w)}" aria-checked="${w === aktuell}">${esc(w === 'beide' ? 'Beide' : w === app.name() ? `${w} (du)` : w)}</button>`).join('')}</div>`;
}

/** Vorschläge im Suchfeld: Boxen, Rezepte, Ideen aus den Notizen – passend zum Getippten. */
function vorschlaegeHTML() {
  if (!offen) return '';
  const kochen = offen.mz === 'kochen';
  const s = normal(suche);
  const passt = (t) => !s || normal(t).includes(s);
  const teile = [];
  if (!kochen && suche.trim()) teile.push(`<button type="button" class="plan-v plan-v-text" data-plan-wahl="text"><span class="plan-ic">✎</span><span><b>„${esc(suche.trim())}“</b><small>so eintragen</small></span></button>`);
  // Boxen von Kochtagen bis zu zwei Wochen vorher, solange welche übrig sind
  if (!kochen) {
    for (const { tag, k } of kochtage(plan())) {
      const d = tageZwischen(tag, offen.tag);
      if (d < 0 || d > 14) continue;
      const rest = k.boxen - verplant(plan(), k.id);
      const x = rezeptVon(k.rid);
      if (rest <= 0 || !x || !passt(x.name)) continue;
      teile.push(`<button type="button" class="plan-v" data-plan-wahl="box:${esc(k.id)}">${bildHTML(x)}<span><b>Box: ${esc(x.kurz)}</b><small>gekocht ${esc(tagKurzName(tag))} ${esc(tagDatum(tag))} · noch ${rest}</small></span>${vtMarke(x, werNeu)}</button>`);
    }
  }
  // Rezepte: ohne Suche die, die gerade laufen oder auf der Liste stehen, und Amys neueste
  const fest = [...(app.rezepte || []), ...(app.kiRezepte || []).filter((r) => r.ki?.von?.gespeichert)];
  const amy = kochen ? [] : Object.values(app.stand.amy || {}).sort((a, b) => String(b.geaendert || b.at).localeCompare(String(a.geaendert || a.at)));
  let kandidaten;
  if (s) kandidaten = [...fest.filter((r) => passt(r.name) || passt(r.short || '') || passt(r.protein || '')), ...amy.filter((a) => passt(a.name))];
  else {
    const laufen = fest.filter((r) => app.stand.gepinnt?.[r.id] || Object.values(app.stand.items || {}).some((d) => d.parts?.[r.id]));
    kandidaten = [...laufen, ...amy.slice(0, 4), ...(kochen ? fest.filter((r) => !laufen.includes(r)).slice(0, 6) : [])];
  }
  const gesehen = new Set();
  for (const r of kandidaten) {
    if (gesehen.has(r.id) || gesehen.size >= 8) continue;
    gesehen.add(r.id);
    const x = rezeptVon(r.id);
    if (!x) continue;
    const hinweis = x.amy ? '♡ Amys Rezept' : kochen ? `${app.boxen || 8} Boxen` : app.stand.gepinnt?.[r.id] ? 'läuft gerade' : (r.protein ? esc(r.protein) : '');
    teile.push(`<button type="button" class="plan-v" data-plan-wahl="rid:${esc(r.id)}">${bildHTML(x)}<span><b>${esc(x.kurz)}</b><small>${hinweis}</small></span>${vtMarke(x, kochen ? 'beide' : werNeu)}</button>`);
  }
  // Ideen aus Amys Notizen (Inspiration) – als Text
  if (!kochen) {
    const ideen = ideenAus(app.stand.notizbuch, 10).filter((i) => passt(i.text)).slice(0, 6);
    if (ideen.length) teile.push(`<p class="plan-v-k">${IDEE}Aus ${person() === app.name() ? 'deinen' : `${esc(person())}s`} Notizen</p><div class="plan-ideen">${ideen.map((i) => `<button type="button" class="chip plan-idee" data-plan-idee="${esc(i.text)}">${esc(i.text)}</button>`).join('')}</div>`);
  }
  if (!teile.length) return `<p class="plan-v-leer">${kochen ? 'Kein Rezept gefunden.' : 'Nichts gefunden – tipp einfach ein, was es gibt.'}</p>`;
  return teile.join('');
}

function neuEditorHTML(tag, mz) {
  const kochen = mz === 'kochen';
  return `<div class="plan-editor" id="plan-editor">
<p class="plan-editor-k">${esc(tagName(tag))} · ${kochen ? 'Kochtag' : MAHLZEIT_NAME[mz]}</p>
${kochen ? '' : werChips(werNeu, 'data-plan-wer')}
<input class="plan-suche" id="plan-suche" type="search" value="${esc(suche)}" placeholder="${kochen ? 'Welches Rezept wird gekocht?' : 'Rezept suchen – oder eintippen, was es gibt'}" autocomplete="off" enterkeyhint="done" aria-label="${kochen ? 'Rezept für den Kochtag' : 'Was es gibt'}">
<div class="plan-vorschlaege" id="plan-vorschlaege">${vorschlaegeHTML()}</div>
<div class="plan-editor-btns"><button type="button" class="btn btn-quiet" data-act="plan-zu">Abbrechen</button></div>
</div>`;
}

function eintragEditorHTML(tag, mz, e) {
  const x = rezeptVon(e.rid);
  const v = x && amyIsstMit(e.wer) ? vtVon(x) : { nicht: [], wenig: [] };
  const fuer = person() === app.name() ? 'dich' : person();
  const vt = v.nicht.length ? `<p class="vt-hinweis vt-ist-nicht"><b>✗ Für ${esc(fuer)}:</b> ${esc(v.nicht.map((t) => t.zutat.name).slice(0, 4).join(', '))} geht nicht</p>` : v.wenig.length ? `<p class="vt-hinweis vt-ist-wenig"><b>~ Für ${esc(fuer)}:</b> ${esc(v.wenig.map((t) => t.zutat.name).slice(0, 4).join(', '))} nur wenig</p>` : '';
  const k = e.box ? kochtagVon(plan(), e.box) : null;
  return `<div class="plan-editor" id="plan-editor">
<p class="plan-editor-k">${esc(tagName(tag))} · ${MAHLZEIT_NAME[mz]}: <b>${esc(x ? x.name : e.text)}</b>${k ? ` <small>(Box vom ${esc(tagKurzName(k.tag))} ${esc(tagDatum(k.tag))})</small>` : ''}</p>
${vt}${werChips(e.wer, 'data-plan-wer-e')}
<div class="plan-editor-btns">${x ? '<button type="button" class="btn" data-act="plan-oeffnen">Rezept öffnen</button>' : ''}<button type="button" class="btn btn-quiet" data-act="plan-e-weg">Austragen</button><button type="button" class="btn btn-quiet" data-act="plan-zu">Fertig</button></div>
</div>`;
}

function kochEditorHTML(tag, k) {
  const x = rezeptVon(k.rid);
  const n = verplant(plan(), k.id);
  return `<div class="plan-editor" id="plan-editor">
<p class="plan-editor-k">${esc(tagName(tag))}: <b>${esc(x ? x.name : 'Rezept')}</b> kochen</p>
<div class="plan-boxen"><span>Boxen</span><button type="button" class="btn plan-pm" data-plan-boxen="-1" aria-label="Eine Box weniger"${k.boxen <= Math.max(1, n) ? ' disabled' : ''}>−</button><b>${k.boxen}</b><button type="button" class="btn plan-pm" data-plan-boxen="1" aria-label="Eine Box mehr"${k.boxen >= MAX_BOXEN ? ' disabled' : ''}>+</button><small>${n ? `${n} verplant` : 'noch keine verplant'}</small></div>
<div class="plan-editor-btns">${k.boxen - n > 0 ? '<button type="button" class="btn btn-primary" data-act="plan-verteilen">Boxen verteilen</button>' : ''}${x ? '<button type="button" class="btn" data-act="plan-oeffnen">Rezept öffnen</button>' : ''}<button type="button" class="btn btn-quiet" data-act="plan-koch-weg">${n ? 'Kochtag und Boxen austragen' : 'Kochtag austragen'}</button><button type="button" class="btn btn-quiet" data-act="plan-zu">Fertig</button></div>
</div>`;
}

function verteilenHTML(tag, k) {
  const x = rezeptVon(k.rid);
  const r = boxenVerteilen(plan(), { tag, k, ...verteilen });
  const tage = r.setzen.map((s) => `${tagKurzName(s.tag)} ${tagDatum(s.tag)}`);
  const vorschau = r.mahlzeiten
    ? `→ ${esc(tage.join(', '))} · ${MAHLZEIT_NAME[verteilen.mahlzeit]} für ${esc(werFuer(verteilen.wer))}${r.rest ? ` · ${r.rest} ${r.rest === 1 ? 'Box bleibt' : 'Boxen bleiben'} übrig` : ''}`
    : 'Da ist alles schon belegt – oder es sind keine Boxen mehr übrig.';
  const chip = (attr, wert, aktuell, text) => `<button type="button" class="chip" role="radio" ${attr}="${wert}" aria-checked="${wert === aktuell}">${text}</button>`;
  return `<div class="plan-editor plan-verteilen" id="plan-editor">
<p class="plan-editor-k"><b>${esc(x ? x.kurz : 'Boxen')}</b> · ${k.boxen - verplant(plan(), k.id)} ${k.boxen - verplant(plan(), k.id) === 1 ? 'Box' : 'Boxen'} verteilen</p>
${mehrere() ? `<div class="plan-chips" role="radiogroup" aria-label="Für wen">${['beide', ...leute()].map((w) => chip('data-plan-v-wer', esc(w), verteilen.wer, esc(w === 'beide' ? 'Beide' : werText(w)))).join('')}</div>` : ''}
<div class="plan-chips" role="radiogroup" aria-label="Mahlzeit">${MAHLZEITEN.map((m) => chip('data-plan-v-mz', m, verteilen.mahlzeit, MAHLZEIT_NAME[m])).join('')}</div>
<div class="plan-chips" role="radiogroup" aria-label="Welche Tage">${chip('data-plan-v-tage', 'werktage', verteilen.werktage ? 'werktage' : 'alle', 'Nur Werktage')}${chip('data-plan-v-tage', 'alle', verteilen.werktage ? 'werktage' : 'alle', 'Jeden Tag')}</div>
<div class="plan-chips" role="radiogroup" aria-label="Ab wann">${chip('data-plan-v-ab', 'morgen', verteilen.abHeute ? 'heute' : 'morgen', 'Ab dem Tag danach')}${chip('data-plan-v-ab', 'heute', verteilen.abHeute ? 'heute' : 'morgen', 'Schon am selben Tag')}</div>
<p class="plan-vorschau">${vorschau}</p>
<div class="plan-editor-btns"><button type="button" class="btn btn-primary" data-act="plan-verteilen-los"${r.mahlzeiten ? '' : ' disabled'}>Verteilen</button><button type="button" class="btn btn-quiet" data-act="plan-zu">Nicht jetzt</button></div>
</div>`;
}

function eintragHTML(tag, mz, e) {
  const x = rezeptVon(e.rid);
  const name = x ? x.kurz : e.text || '…';
  const auf = offen?.id === e.id;
  return `<button type="button" class="plan-e${auf ? ' is-auf' : ''}${e.box ? ' ist-box' : ''}" data-plan-e="${tag}|${mz}|${esc(e.id)}" aria-expanded="${auf}">${bildHTML(x || null)}<span class="plan-e-n">${esc(name)}${e.box ? '<small>Box</small>' : ''}</span>${vtMarke(x, e.wer)}${mehrere() ? `<span class="plan-wer w-${werKlasse(e.wer)}">${esc(werText(e.wer))}</span>` : ''}</button>`;
}

function kochHTML(tag, k) {
  const x = rezeptVon(k.rid);
  const n = verplant(plan(), k.id);
  const auf = offen?.id === k.id;
  return `<div class="plan-koch${auf ? ' is-auf' : ''}"><button type="button" class="plan-koch-b" data-plan-e="${tag}|kochen|${esc(k.id)}" aria-expanded="${auf}">${bildHTML(x)}<span><b>${esc(x ? x.kurz : 'Rezept')} kochen</b><small>${k.boxen} Boxen${n ? ` · ${n} verplant` : ''}</small></span>${vtMarke(x, 'beide')}</button>${k.boxen - n > 0 && !auf ? `<button type="button" class="btn plan-verteilen-b" data-plan-verteilen="${tag}|${esc(k.id)}">Verteilen</button>` : ''}</div>`;
}

function editorFuer(tag, mz) {
  if (!offen || offen.tag !== tag || offen.mz !== mz) return '';
  if (!offen.id) return neuEditorHTML(tag, mz);
  const t = plan().tage[tag] || {};
  if (mz === 'kochen') {
    const k = (t.kochen || []).find((x) => x.id === offen.id);
    if (!k) return '';
    return offen.verteilen ? verteilenHTML(tag, k) : kochEditorHTML(tag, k);
  }
  const e = (t[mz] || []).find((x) => x.id === offen.id);
  return e ? eintragEditorHTML(tag, mz, e) : '';
}

function tagHTML(tag) {
  const t = plan().tage[tag] || {};
  const vorbei = tag < heuteTag();
  const kochen = (t.kochen || []).map((k) => kochHTML(tag, k)).join('');
  const mahlzeiten = MAHLZEITEN.map((m) => `<div class="plan-mz"><span class="plan-mz-k">${MAHLZEIT_NAME[m]}</span><div class="plan-es">${(t[m] || []).map((e) => eintragHTML(tag, m, e)).join('')}<button type="button" class="plan-plus" data-plan-neu="${tag}|${m}" aria-label="${esc(tagName(tag))}, ${MAHLZEIT_NAME[m]}: eintragen">+</button></div></div>${editorFuer(tag, m)}`).join('');
  return `<li class="plan-tag${istHeute(tag) ? ' is-heute' : ''}${vorbei ? ' is-vorbei' : ''}" id="pt-${tag}">
<h2 class="plan-tag-k"><span class="plan-tag-n">${esc(tagName(tag))}</span><span class="plan-tag-d">${esc(tagDatum(tag))}</span>${istHeute(tag) ? '<span class="pill pill-heute">Heute</span>' : ''}</h2>
${kochen}${editorFuer(tag, 'kochen')}
${mahlzeiten}
${!offen || offen.tag !== tag || offen.mz !== 'kochen' || offen.id ? `<button type="button" class="linkbtn plan-koch-neu" data-plan-neu="${tag}|kochen">${TOPF}Kochtag eintragen</button>` : ''}
</li>`;
}

function planHTML() {
  const tage = wocheVon(montag);
  const jetzt = montagVon(heuteTag());
  const geplant = geplanteMahlzeiten(plan(), tage);
  const koch = tage.reduce((n, tag) => n + (plan().tage[tag]?.kochen || []).length, 0);
  return `<button type="button" class="back nur-breit" data-act="plan-zu-rezepten">${LINKS}Alle Rezepte</button>
<header class="plan-kopf">
<h1 class="plan-titel" id="plan-titel">Essensplan</h1>
<p class="plan-lead">Wer wann was isst, wann gekocht wird – für ${istEigen() ? 'dich' : 'euch beide'}. Mit einem Tipp kommt die Woche auf die Einkaufsliste.</p>
</header>
<div class="plan-woche" role="group" aria-label="Woche">
<button type="button" class="btn plan-pfeil" data-plan-woche="-1" aria-label="Woche davor"${montag <= tagPlus(jetzt, -7 * ZURUECK_WOCHEN) ? ' disabled' : ''}>${LINKS}</button>
<div class="plan-woche-t"><b>${wocheText()}</b><small>${esc(tagDatum(tage[0]))} – ${esc(tagDatum(tage[6]))}${geplant || koch ? ` · ${geplant} von 14 Mahlzeiten${koch ? `, ${koch} ${koch === 1 ? 'Kochtag' : 'Kochtage'}` : ''}` : ''}</small></div>
<button type="button" class="btn plan-pfeil" data-plan-woche="1" aria-label="Nächste Woche"${montag >= tagPlus(jetzt, 7 * VORAUS_WOCHEN) ? ' disabled' : ''}>${RECHTS}</button>
${montag !== jetzt ? '<button type="button" class="linkbtn plan-heute" data-plan-woche="0">Zu heute</button>' : ''}
</div>
<div class="plan-einkauf-zeile" id="plan-einkauf">${app.listeDa ? einkaufHTML() : ''}</div>
${app.listeDa ? `<ol class="plan-tage">${tage.map(tagHTML).join('')}</ol>` : '<p class="loading">Wird geladen…</p>'}`;
}

/** Den Reiter zeichnen – nicht, solange im Suchfeld getippt wird (dann nur die Vorschläge). */
export function planZeichnen() {
  const el = $('#view-plan');
  if (!el) return;
  const fokus = document.activeElement;
  if (fokus?.id === 'plan-suche' && el.contains(fokus)) {
    const v = $('#plan-vorschlaege');
    if (v) v.innerHTML = vorschlaegeHTML();
    return;
  }
  el.innerHTML = planHTML();
}

/** Beim Wechsel in den Reiter: eine vergangene Woche zurück auf diese. */
export function planGezeigt() {
  const jetzt = montagVon(heuteTag());
  if (montag < tagPlus(jetzt, -7 * ZURUECK_WOCHEN)) { montag = jetzt; merken(); }
  planZeichnen();
}

/* --------------------------------------------------------------- Ändern */

function setzen(tag, mz, e) {
  app.aendern(opEssensplan({ setzen: [{ tag, mahlzeit: mz, e }] }, app.name()));
}

function auswaehlen(wert) {
  if (!offen) return;
  const { tag, mz } = offen;
  if (mz === 'kochen') {
    if (!wert.startsWith('rid:')) return;
    const rid = wert.slice(4);
    const id = neueId('ek');
    setzen(tag, 'kochen', { id, rid, boxen: Math.min(MAX_BOXEN, Math.max(1, app.boxen || 8)) });
    // Gleich verteilen: was der Kochtag bringt, steht dann in den Tagen danach
    verteilen = { wer: werStandard(), mahlzeit: 'mittag', werktage: true, abHeute: false };
    offen = { tag, mz: 'kochen', id, verteilen: true };
    suche = '';
    planZeichnen();
    return;
  }
  let e = null;
  if (wert === 'text') e = { id: neueId('ep'), text: suche.trim().slice(0, 80), wer: werNeu };
  else if (wert.startsWith('rid:')) e = { id: neueId('ep'), rid: wert.slice(4), wer: werNeu };
  else if (wert.startsWith('box:')) {
    const k = kochtagVon(plan(), wert.slice(4));
    if (k) e = { id: neueId('ep'), rid: k.k.rid, wer: werNeu, box: k.k.id };
  }
  if (!e || (!e.rid && !e.text)) return;
  setzen(tag, mz, e);
  offen = null;
  suche = '';
  planZeichnen();
}

function aufDieListe() {
  const e = einkaufFuer(montag);
  if (!e.ops.length) return;
  for (const x of einkaufDerWoche(plan(), montag)) if (String(x.rid).startsWith('ki-')) app.kiVorAktion?.(x.rid);
  app.aendern(e.ops);
  melde(`${wocheText()}: ${e.ops.length} ${e.ops.length === 1 ? 'Zutat' : 'Zutaten'} auf der Liste`, istSchmal() ? { knopf: 'Zur Liste', art: 'zur-liste', beiKnopf: () => zeigeReiter('einkauf') } : {});
}

function rezeptOeffnen(rid) {
  const x = rezeptVon(rid);
  if (!x) return;
  if (x.amy) { zeigeReiter('amy'); amyOeffnen(rid); } else { zeigeReiter('rezepte'); oeffneRezept(rid); }
}

/** Das gerade offene Element des Plans: { tag, mz, e } oder null. */
function offenesElement() {
  if (!offen?.id) return null;
  const t = plan().tage[offen.tag] || {};
  const e = (t[offen.mz] || []).find((x) => x.id === offen.id);
  return e ? { tag: offen.tag, mz: offen.mz, e } : null;
}

/** true, wenn der Klick hierher gehörte. */
export function klickPlan(el) {
  if (!el.closest('#view-plan')) return false;
  const d = el.dataset;
  if (d.planWoche !== undefined) {
    const jetzt = montagVon(heuteTag());
    montag = d.planWoche === '0' ? jetzt : tagPlus(montag, Number(d.planWoche) * 7);
    if (montag < tagPlus(jetzt, -7 * ZURUECK_WOCHEN)) montag = tagPlus(jetzt, -7 * ZURUECK_WOCHEN);
    if (montag > tagPlus(jetzt, 7 * VORAUS_WOCHEN)) montag = tagPlus(jetzt, 7 * VORAUS_WOCHEN);
    offen = null;
    merken();
    planZeichnen();
    return true;
  }
  if (d.planNeu) {
    const [tag, mz] = d.planNeu.split('|');
    offen = { tag, mz };
    suche = '';
    werNeu = werStandard();
    planZeichnen();
    window.requestAnimationFrame(() => { const f = $('#plan-suche'); if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });
    return true;
  }
  if (d.planE) {
    const [tag, mz, id] = d.planE.split('|');
    offen = offen?.id === id ? null : { tag, mz, id };
    planZeichnen();
    return true;
  }
  if (d.planVerteilen) {
    const [tag, id] = d.planVerteilen.split('|');
    verteilen = { wer: werStandard(), mahlzeit: 'mittag', werktage: true, abHeute: false };
    offen = { tag, mz: 'kochen', id, verteilen: true };
    planZeichnen();
    return true;
  }
  if (d.planWahl) { auswaehlen(d.planWahl); return true; }
  if (d.planIdee) { suche = d.planIdee; auswaehlen('text'); return true; }
  if (d.planWer) {
    werNeu = d.planWer;
    for (const b of el.closest('.plan-chips').querySelectorAll('[data-plan-wer]')) b.setAttribute('aria-checked', String(b.dataset.planWer === werNeu));
    const v = $('#plan-vorschlaege');
    if (v) v.innerHTML = vorschlaegeHTML();
    return true;
  }
  if (d.planWerE) {
    const x = offenesElement();
    if (x && x.e.wer !== d.planWerE) setzen(x.tag, x.mz, { ...x.e, wer: d.planWerE });
    planZeichnen();
    return true;
  }
  if (d.planVWer || d.planVMz || d.planVTage || d.planVAb) {
    if (d.planVWer) verteilen.wer = d.planVWer;
    if (d.planVMz) verteilen.mahlzeit = d.planVMz;
    if (d.planVTage) verteilen.werktage = d.planVTage === 'werktage';
    if (d.planVAb) verteilen.abHeute = d.planVAb === 'heute';
    planZeichnen();
    return true;
  }
  if (d.planBoxen) {
    const x = offenesElement();
    if (!x || x.mz !== 'kochen') return true;
    const n = Math.min(MAX_BOXEN, Math.max(Math.max(1, verplant(plan(), x.e.id)), x.e.boxen + Number(d.planBoxen)));
    if (n !== x.e.boxen) setzen(x.tag, 'kochen', { ...x.e, boxen: n });
    planZeichnen();
    return true;
  }
  switch (d.act) {
    case 'plan-zu': offen = null; suche = ''; planZeichnen(); return true;
    case 'plan-liste': aufDieListe(); return true;
    case 'plan-zu-rezepten': zeigeReiter('rezepte'); return true;
    case 'plan-oeffnen': { const x = offenesElement(); if (x) rezeptOeffnen(x.e.rid); return true; }
    case 'plan-verteilen': if (offen) { verteilen = { wer: werStandard(), mahlzeit: 'mittag', werktage: true, abHeute: false }; offen = { ...offen, verteilen: true }; planZeichnen(); } return true;
    case 'plan-verteilen-los': {
      const x = offenesElement();
      if (!x || x.mz !== 'kochen') return true;
      const r = boxenVerteilen(plan(), { tag: x.tag, k: x.e, ...verteilen });
      if (!r.setzen.length) return true;
      app.aendern(opEssensplan({ setzen: r.setzen }, app.name()));
      offen = null;
      planZeichnen();
      melde(`${r.setzen.length} ${r.setzen.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'} mit ${rezeptVon(x.e.rid)?.kurz || 'Boxen'}${r.rest ? ` – ${r.rest} ${r.rest === 1 ? 'Box bleibt' : 'Boxen bleiben'} übrig` : ''}`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opEssensplan({ weg: r.setzen.map((s) => ({ tag: s.tag, mahlzeit: s.mahlzeit, id: s.e.id })) }, app.name())) });
      return true;
    }
    case 'plan-e-weg': {
      const x = offenesElement();
      if (!x) return true;
      app.aendern(opEssensplan({ weg: [{ tag: x.tag, mahlzeit: x.mz, id: x.e.id }] }, app.name()));
      offen = null;
      planZeichnen();
      melde('Ausgetragen', { knopf: 'Rückgängig', beiKnopf: () => setzen(x.tag, x.mz, x.e) });
      return true;
    }
    case 'plan-koch-weg': {
      const x = offenesElement();
      if (!x || x.mz !== 'kochen') return true;
      // Die Boxen dieses Kochtags gehen mit
      const boxen = boxenVon(plan(), x.e.id);
      const alt = boxen.map((b) => ({ ...b, e: (plan().tage[b.tag]?.[b.mahlzeit] || []).find((y) => y.id === b.id) })).filter((b) => b.e);
      app.aendern(opEssensplan({ weg: [{ tag: x.tag, mahlzeit: 'kochen', id: x.e.id }, ...boxen] }, app.name()));
      offen = null;
      planZeichnen();
      melde(boxen.length ? `Kochtag und ${boxen.length} ${boxen.length === 1 ? 'Box' : 'Boxen'} ausgetragen` : 'Kochtag ausgetragen', { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opEssensplan({ setzen: [{ tag: x.tag, mahlzeit: 'kochen', e: x.e }, ...alt.map((b) => ({ tag: b.tag, mahlzeit: b.mahlzeit, e: b.e }))] }, app.name())) });
      return true;
    }
    default: return false;
  }
}

/** Tippen im Suchfeld: die Vorschläge neu. */
export function eingabePlan(ziel) {
  if (ziel.id !== 'plan-suche') return false;
  suche = ziel.value;
  const v = $('#plan-vorschlaege');
  if (v) v.innerHTML = vorschlaegeHTML();
  return true;
}

/** Enter im Suchfeld: der erste Vorschlag (beim Kochtag) oder der Text, wie getippt. */
export function tastePlan(ziel) {
  if (ziel?.id !== 'plan-suche' || !offen) return false;
  suche = ziel.value;
  if (offen.mz === 'kochen') {
    const erster = $('#plan-vorschlaege [data-plan-wahl]');
    if (erster) auswaehlen(erster.dataset.planWahl);
  } else if (suche.trim()) auswaehlen('text');
  return true;
}

/** Für den Reiter: wie viele Mahlzeiten diese Woche geplant sind. */
export const planHeute = () => {
  const t = plan().tage[heuteTag()] || {};
  return MAHLZEITEN.reduce((n, m) => n + (t[m] || []).length, 0);
};

app.planNeu = () => { if (ansicht.tab === 'plan') planZeichnen(); };
