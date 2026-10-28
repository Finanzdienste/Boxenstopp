/*
 * Reiter „Rezepte“: die Boxen im Raster und ein Rezept im Detail.
 *
 * Das Detail wird beim Öffnen einmal gebaut. Wenn sich die Liste ändert
 * (auch vom anderen Handy), zeichnet detailAktualisieren() nur Knöpfe und
 * Haken neu – der Portionsrechner und die Kochschritte behalten, was man
 * gerade eingetippt oder abgehakt hat.
 *
 * Die Zubereitung ist eine Mise en place (werkzeug/rezepte.py): erst alles
 * in nummerierte Schalen vorbereiten, dann kochen, dann portionieren. Ein
 * Schritt ist eine Zeile zum Abhaken; „Schale 2“ im Text wird zum Schild mit
 * Nummer und Inhalt, Mengen werden fett.
 */
import { app, $, $$, ansicht, ansichtMerken, melde, zeigeReiter, istSchmal, lese, schreibe } from './kern.js';
import { esc, nf1, nfi, heute, tagKurz, abweichung, platzhalter } from './format.js';
import { zeitVon, dauer } from './zeiten.js';
import { zahlwort } from './ki-rezept.js';
import { timerFuer, timerStarten, timerStoppen, timerText } from './timer.js';
import { lobPruefen, lobGross, tierVorladen } from './lob.js';
import { euro, kostenRezept } from './kosten.js';
import { zutatImg, rezeptBildchen, bildPfad } from './bilder.js';
import { opNotiz, opNotizWeg } from './liste.js';
import { hatTeil, rezeptStand, einkaufsZutaten, opTeil, opTeilWeg, opGekocht, opBewerten, opAnpinnen, DAUMEN } from './liste.js';

const SCHRITTE = 'boxenstopp.schritte.v2';
const TOPF = 'boxenstopp.topf.v1';
const ZUGEKLAPPT = 'boxenstopp.zugeklappt.v1';

/** Darunter gilt ein Rezept als schnell – mit ehrlichen Zeiten ist keins unter einer Stunde. */
const SCHNELL = 90;
const gesamtZeit = (r) => (r.zeit || (r.zeit = zeitVon(r))).gesamt;

export const FILTER = [
  ['alle', 'Alle', () => true],
  ['top', 'Daumen hoch', (r) => app.stand.bewertung?.[r.id]?.wert === 'hoch'],
  ['haehnchen', 'Hähnchen', (r) => r.protein.includes('Hähnchen')],
  ['rind', 'Rind', (r) => r.protein.includes('Rind')],
  ['pute', 'Pute', (r) => r.protein.includes('Pute')],
  ['reis', 'Reis', (r) => r.base === 'Reis'],
  ['nudeln', 'Nudeln', (r) => r.base === 'Nudeln'],
  ['kartoffel', 'Kartoffel & Co.', (r) => ['Kartoffeln', 'Süßkartoffel', 'Gnocchi'].includes(r.base)],
  ['bulgur', 'Bulgur & Co.', (r) => ['Bulgur', 'Couscous', 'Tortillas'].includes(r.base)],
  ['schnell', 'Unter 1½ Std.', (r) => gesamtZeit(r) < SCHNELL],
  ['liste', 'Auf der Liste', (r) => rezeptStand(app.stand, r).drauf],
  ['reste', 'Eigene', (r) => !!r.ki],
];
const alleRezepte = () => [...app.rezepte, ...app.kiRezepte.filter((r) => r.ki?.von?.gespeichert)];
/* Suche: Name, Beschreibung, Zutaten – „curry“, „kichererbsen“, „ofen“. Wird nicht gemerkt. */
let suche = '';
const normal = (t) => String(t || '').toLowerCase().replace(/ß/g, 'ss').replace(/[äöü]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[c]);
export function suchtext(r) {
  return normal([r.name, r.short, r.desc, r.protein, r.base, r.method, ...(r.items || []).map((it) => it.n)].join(' '));
}
const passtSuche = (r) => !suche || suche.split(/\s+/).every((w) => suchtext(r).includes(w));
const boxen = (r) => r.portionen || 8;

const PFADE = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  list: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.6l1.3 1.3L7.6 5.4M3.8 12.1l1.3 1.3 2.5-2.5M3.8 17.6l1.3 1.3 2.5-2.5"/>',
  pin: '<path d="M7 3.5h10a1 1 0 0 1 1 1v16l-6-4-6 4v-16a1 1 0 0 1 1-1z"/>',
  runter: '<path d="M12 4.5v14M6.5 13l5.5 5.5 5.5-5.5"/>',
  weiter: '<path d="M9 5l7 7-7 7"/>',
  ki: '<path d="M11 3.5l1.9 5.1 5.1 1.9-5.1 1.9L11 17.5l-1.9-5.1-5.1-1.9 5.1-1.9z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
};
/*
 * Daumen: ein gemeinsamer pro Gericht (liste.js). Hoch und runter sind
 * dasselbe Bild, gedreht; zur Seite hat ein eigenes (gedreht sah es aus wie
 * ein Fäustling): Faust über dem Handgelenk, Daumen nach links.
 */
export const DAUMEN_TEXT = { hoch: 'Daumen hoch', mittel: 'Geht so', runter: 'Daumen runter' };
const HOCH = '<rect x="2.5" y="10" width="4.5" height="10.5" rx="1.2"/><path d="M7 11.2l3.6-7.1c1.6-.2 2.9 1.2 2.6 2.8L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6.4a2.2 2.2 0 0 1-2.2 1.8H7"/>';
const DAUMEN_SVG = {
  hoch: HOCH,
  mittel: '<rect x="9.5" y="17" width="10.5" height="4.5" rx="1.2"/><path d="M10.5 17v-5.5a3 3 0 0 1 3-3h3.5a3 3 0 0 1 3 3V17"/><path d="M13 8.5H4.6a1.9 1.9 0 0 0 0 3.8h6"/>',
  runter: `<g transform="rotate(180 12 12)">${HOCH}</g>`,
};
export const daumenIc = (wert) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DAUMEN_SVG[wert] || ''}</svg>`;

export const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PFADE[name]}</svg>`;

let aktuell = null;
let zeilen = [];
/** Die Bereiche im Rezept, die zugeklappt sind (Zutaten, Zubereitung …) – das Handy merkt sie sich für alle Rezepte. */
const zugeklappt = new Set((lese(ZUGEKLAPPT, []) || []).filter((x) => typeof x === 'string'));
let rasterScroll = 0;
const schritte = lese(SCHRITTE, {}) || {};

export const offenesRezept = () => aktuell;

/* ----------------------------------------------------------------- Raster */

export function filterZeichnen() {
  $('#chips').innerHTML = FILTER.map(([id, label]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="false">${esc(label)}<span class="n"></span></button>`).join('');
}

/*
 * Das Bild eines Rezepts: das KI-Foto (r.bild aus daten/rezepte.json), sonst
 * ein Ersatzbild aus den Bildchen der Hauptzutaten (Eiweiß, Beilage, Gemüse).
 */
function rezeptFoto(r, { gross = false } = {}) {
  if (r.bild && /^bilder\/rezepte\/[a-z0-9-]+\.webp(\?v=[0-9a-f]+)?$/.test(r.bild)) {
    return gross
      ? `<figure class="d-foto"><img src="${esc(r.bild)}" alt="${esc(r.name)}" decoding="async" width="800" height="600"><figcaption>KI-Bild</figcaption></figure>`
      : `<span class="box-foto"><img src="${esc(r.bild)}" alt="" loading="lazy" decoding="async" width="800" height="600"></span>`;
  }
  const bildchen = rezeptBildchen(r, app.katalog).map((b, i) => `<img class="e${i}" src="${bildPfad(b)}" alt="" loading="lazy" decoding="async" width="64" height="64">`).join('');
  return gross ? `<div class="d-foto d-foto-ersatz" aria-hidden="true">${bildchen}</div>` : `<span class="box-foto box-foto-ersatz" aria-hidden="true">${bildchen}</span>`;
}

function karte(r) {
  const st = rezeptStand(app.stand, r);
  const c = app.stand.cooked[r.id];
  const tag = c ? tagKurz(c.at) : '';
  const b = app.stand.bewertung?.[r.id];
  const daumen = b ? `<span class="pill p-${b.wert}">${daumenIc(b.wert)}${DAUMEN_TEXT[b.wert]}</span>` : '';
  const ki = r.ki ? `<span class="pill pill-ki">${r.ki.herkunft ? 'Angepasst' : 'Resteverwertung'}${boxen(r) !== 8 ? ` · ${boxen(r)} Boxen` : ''}</span>` : '';
  const ko = kostenRezept(r, app);
  const preis = ko.box > 0 ? `<span class="box-cost">≈ ${esc(euro(ko.box))}/Box</span>` : '';
  return `<button type="button" class="box" data-open="${esc(r.id)}">
${rezeptFoto(r)}<span class="tape">${esc(r.short)}</span><span class="box-time">${dauer(gesamtZeit(r))}</span>
<span class="box-desc">${esc(r.desc)}</span>
<span class="box-meta">${esc(r.protein)} · ${esc(r.base)} · ${esc(r.method)}${preis}</span>
<span class="box-macros"><span><b>${r.m.kcal}</b> kcal</span><span class="m-p">P ${nf1(r.m.p)}</span><span class="m-kh">KH ${nf1(r.m.kh)}</span><span class="m-f">F ${nf1(r.m.f)}</span></span>
<span class="box-foot">${app.stand.gepinnt?.[r.id] ? `<span class="pill pill-pin">${ic('pin')}Läuft gerade</span>` : ''}${ki}${daumen}${st.drauf ? `<span class="pill pill-list">${ic('list')}Auf der Liste</span>` : ''}${tag ? `<span class="pill">Zuletzt gekocht ${esc(tag)}</span>` : ''}</span>
</button>`;
}

/** Oben bei den Rezepten: was gerade läuft (angepinnt, für beide), mit Foto und Fortschritt beim Kochen. */
function gepinntZeichnen() {
  const el = $('#gepinnt');
  if (!el) return;
  const laufen = Object.entries(app.stand.gepinnt || {})
    .filter(([rid]) => app.nachId[rid])
    .sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)));
  el.hidden = !laufen.length;
  el.innerHTML = laufen.length ? `<h2 class="gepinnt-k">${ic('pin')}Läuft gerade</h2><div class="gepinnt-liste">${laufen.map(([rid, e]) => {
    const r = app.nachId[rid];
    const bild = r.bild && /^bilder\/rezepte\/[a-z0-9-]+\.webp(\?v=[0-9a-f]+)?$/.test(r.bild)
      ? `<img src="${esc(r.bild)}" alt="" width="64" height="48" decoding="async">`
      : `<span class="g-ersatz"><img src="${bildPfad(rezeptBildchen(r, app.katalog)[0] || 'pot-of-food')}" alt="" width="30" height="30"></span>`;
    const fertig = (schritte[rid] || []).length;
    const alle = (r.ablauf || []).reduce((n, p) => n + p.schritte.length, 0);
    const seit = e.at && !Number.isNaN(Date.parse(e.at)) ? `seit ${tagKurz(heute(new Date(e.at)))}` : '';
    const wer = e.by ? `von ${e.by === app.name() ? 'dir' : esc(e.by)}` : '';
    const was = [fertig && alle ? `${fertig} von ${alle} Schritten` : '', [wer, seit].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    return `<button type="button" class="gepinnt-b" data-open="${esc(rid)}">${bild}<span><b>${esc(r.name)}</b>${was ? `<small>${was}</small>` : ''}</span>${ic('weiter')}</button>`;
  }).join('')}</div>` : '';
}

export function rasterZeichnen() {
  gepinntZeichnen();
  if (!FILTER.some((f) => f[0] === ansicht.filter)) ansicht.filter = 'alle';
  const f = FILTER.find((x) => x[0] === ansicht.filter);
  const alle = alleRezepte();
  const liste = alle.filter(f[2]).filter(passtSuche);
  $('#grid').innerHTML = liste.length ? liste.map(karte).join('') : `<p class="empty">${suche ? `Nichts gefunden für „${esc(suche)}“.` : ansicht.filter === 'liste' ? 'Gerade steht kein Rezept auf der Einkaufsliste.' : 'Hier ist gerade nichts.'}</p>`;
  for (const b of $$('[data-filter]')) {
    const fx = FILTER.find((x) => x[0] === b.dataset.filter);
    b.setAttribute('aria-pressed', String(b.dataset.filter === ansicht.filter));
    const n = b.querySelector('.n');
    const zahl = fx ? alle.filter(fx[2]).filter(passtSuche).length : 0;
    if (n && fx) n.textContent = String(zahl);
    if (fx?.[0] === 'reste') b.hidden = !zahl && ansicht.filter !== 'reste';
  }
}

/* ----------------------------------------------------------------- Detail */

function zeilenVon(r) {
  const z = [];
  const art = (it) => {
    if (it.haus) return 'haushalt';
    if (it.da) return 'vorhanden';
    if (typeof it.q === 'number' && !it.pantry && !it.opt) return 'einkauf';
    return it.opt ? 'optional' : 'vorrat';
  };
  for (const it of r.items) z.push({ ...it, art: art(it) });
  for (const s of r.spices) z.push({ n: s.n, a: s.a, k: s.k, h: '', kat: s.kat, art: 'gewuerz' });
  return z;
}
/*
 * Mengen in den Kochschritten hervorheben („800 g“, „2 EL“, „4 Knoblauchzehen“,
 * „3 Paprika“), damit man beim Kochen nicht nach oben zu den Zutaten muss.
 * Läuft auf bereits entschärftem Text, fügt nur <b> ein.
 */
const MENGE = new RegExp(String.raw`(?<![\w.,])(?:\d+(?:[.,]\d+)?[½¼¾]?|[½¼¾])(?:\s?[–-]\s?\d+(?:[.,]\d+)?[½¼¾]?)?\s(?:gehäufte\s|große\s|rote\s|gelbe\s)?(?:kg|g|ml|l|EL|TL|Prise|Zehen?|Knoblauchzehen?|Dosen?|Glas|Bund|Stangen?|Stück|Lorbeerblätter|Brühwürfeln?|Blatt|Blätter|Zwiebeln?|Paprika|Möhren|Tomaten|Zucchini|Limetten?|Zitronen?|Salatgurke)(?![\wäöüß])`, 'g');
export const mengenHervor = (html) => html.replace(MENGE, (m) => `<b class="mg">${m}</b>`);

/*
 * „Schale 2“ wird zum Schild mit Nummer und Inhalt: [2 Gewürze]. So sieht
 * man beim Kochen, welche Schale gemeint ist, ohne nach oben zu scrollen.
 */
const SCHALE = /Schale (\d+)/g;
export function schalenHervor(html, schalen = []) {
  return html.replace(SCHALE, (m, n) => {
    const s = schalen.find((x) => x.n === Number(n));
    return s ? schaleSchild(s) : m;
  });
}
const schaleSchild = (s) => `<span class="schale"><span class="vh">Schale </span><b>${s.n}</b>${esc(s.name)}</span>`;
const schrittText = (t, r) => schalenHervor(mengenHervor(esc(platzhalter(t, r.items, r.weg))), r.schalen);

const teilFuer = (z) => ((z.art === 'einkauf' || z.art === 'vorhanden') && typeof z.q === 'number' ? { q: z.q, u: z.u, h: z.h || '' } : { t: z.a });
/** Name und Abteilung für eine neue Zeile auf der Liste: aus dem Katalog oder vom KI-Rezept. */
const katFuer = (z) => z.kat || app.katalog[z.k];

function etikett(r) {
  const ziel = app.ziel;
  const zellen = [
    ['kcal', 'kcal', r.m.kcal, ziel.kcal, ''],
    ['p', 'Protein', r.m.p, ziel.p, ' g'],
    ['kh', 'KH', r.m.kh, ziel.kh, ' g'],
    ['f', 'Fett', r.m.f, ziel.f, ' g'],
  ];
  return `<div class="label" role="group" aria-label="Nährwerte pro Box">${zellen.map(([k, name, v, t, einheit]) => {
    const ganz = k === 'kcal';
    const pct = Math.min(100, (v / t) * 80);
    const zielText = ganz ? nfi(t) : (Number.isInteger(t) ? String(t) : nf1(t));
    return `<div class="c-${k}"><span class="k">${name}</span><span class="v">${ganz ? nfi(v) : nf1(v)}<small>${einheit}</small></span><span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span><span class="t">Ziel ${zielText}</span><span class="t dlt">${abweichung(v, t, ganz)}</span></div>`;
  }).join('')}</div>`;
}

/** Ein Bereich im Rezept, auf- und zuklappbar. Was zu ist, bleibt zu – auch im nächsten Rezept. */
const bereich = (id, kopf, inhalt, klasse = 'sec') => `<details class="${klasse} klapp" id="s-${id}" data-abschnitt="${id}"${zugeklappt.has(id) ? '' : ' open'}><summary>${kopf}</summary>${inhalt}</details>`;

/** Von app.js (toggle, in der Capture-Phase): einen Bereich auf- oder zugeklappt merken. */
export function abschnittGeklappt(el) {
  if (!el?.matches?.('#detail details[data-abschnitt]')) return;
  const id = el.dataset.abschnitt;
  if (el.open === !zugeklappt.has(id)) return;
  if (el.open) zugeklappt.delete(id); else zugeklappt.add(id);
  schreibe(ZUGEKLAPPT, [...zugeklappt]);
}

function zutatZeile(z, i) {
  return `<li class="ing">${zutatImg(z.k, { name: z.n, cat: z.art === 'gewuerz' ? 'gewuerz' : '', katalog: app.katalog, groesse: 24 })}<div><span class="ing-name">${esc(z.n)}</span>${z.h ? `<span class="ing-hint">${esc(z.h)}</span>` : ''}</div><span class="ing-amt">${esc(z.a)}</span><button type="button" class="tog" data-tog="${i}" aria-pressed="false" aria-label="${esc(z.n)} auf die Einkaufsliste setzen">${ic('plus', 'i-plus')}${ic('check', 'i-check')}</button></li>`;
}

function detailHTML(r) {
  zeilen = zeilenVon(r);
  const gruppe = (art, titel) => {
    const idx = zeilen.map((z, i) => [z, i]).filter(([z]) => z.art === art);
    return idx.length ? `<h3 class="sub-h">${titel}</h3><ul class="ings">${idx.map(([z, i]) => zutatZeile(z, i)).join('')}</ul>` : '';
  };
  const fakten = [`ca. ${dauer(gesamtZeit(r))}`, esc(r.method), `Kühlschrank ${esc(r.fridge)}`, `Tiefkühler ${esc(r.freeze)}`];
  const ko = kostenRezept(r, app);
  if (ko.box > 0) fakten.push(`<span class="pill-cost">≈ ${esc(euro(ko.box))} pro Box${ko.luecken ? ' (mind.)' : ''}</span>`);
  const t = r.total;
  return `<div class="d-top"><button type="button" class="back" data-act="zurueck">${ic('back')}Alle Rezepte</button><button type="button" class="btn d-zum" data-act="zum-rezept">${ic('runter')}Zum Rezept</button></div>
${rezeptFoto(r, { gross: true })}
<div class="d-head">
  <span class="tape">${esc(r.short)} · ${boxen(r)}×</span>
  <h1 id="d-title">${esc(r.name)}</h1>
  <p class="d-desc">${esc(r.desc)}</p>
  <div class="facts">${fakten.map((f) => `<span class="pill">${f}</span>`).join('')}</div>
  <p class="d-laeuft" id="d-laeuft" hidden></p>
</div>
<span class="label-k">Pro Box, eine von ${zahlwort(boxen(r))}</span>
${etikett(r)}
${r.ki ? '<div class="ki-leiste" id="d-ki"></div>' : ''}
<div class="actions" id="d-actions"></div>
<section class="anpassen" id="d-anpassen" aria-label="Rezept anpassen" hidden></section>
<div class="bewertung" id="d-bewertung" role="group" aria-label="Wie war's?"></div>
${bereich('notizen', '<h3 id="h-notizen" class="sub-h">Notizen <small>für euch beide</small></h3>', `
  <ul class="notiz-liste" id="d-notizen"></ul>
  <form class="notiz-form" id="notiz-form" autocomplete="off">
    <label class="sr" for="notiz-feld">Notiz</label>
    <input id="notiz-feld" type="text" maxlength="300" placeholder="z. B. nächstes Mal weniger Chili" enterkeyhint="done">
    <button type="submit" class="btn" id="notiz-btn" aria-label="Notiz speichern">${ic('plus')}</button>
  </form>`, 'notizen')}

${bereich('zutaten', `<h2 id="h-ing">Zutaten <small>für ${boxen(r)} Boxen</small></h2>`, `
  <p class="sec-lead">Mit + setzt du einzelne Zutaten auf die Liste, mit ✓ nimmst du sie wieder runter.</p>
  ${ko.gesamt > 0 ? `<p class="kosten" id="d-kosten">Kostet ≈ <b>${esc(euro(ko.gesamt))}</b> für ${boxen(r)} Boxen, also ≈ ${esc(euro(ko.box))} pro Box${ko.luecken ? ` – mindestens, ${ko.luecken} Zutat${ko.luecken > 1 ? 'en' : ''} ohne Richtpreis` : ''}. <small>Richtpreise Discounter, ${esc(app.preiseStand || 'Stand unbekannt')}; verwendete Mengen, nicht ganze Packungen.</small></p>` : ''}
  ${gruppe('einkauf', 'Einkaufen')}
  ${gruppe('vorhanden', 'Ist schon da')}
  ${gruppe('vorrat', 'Aus dem Vorrat')}
  ${gruppe('optional', 'Optional')}
  ${gruppe('gewuerz', 'Gewürze')}
  ${gruppe('haushalt', 'Extras')}`)}

${zubereitungHTML(r)}

${bereich('portionieren', '<h2 id="h-calc">Portionieren</h2>', `
  <p class="sec-lead">Topf oder Schüssel leer wiegen, dann mit dem fertigen Essen. Die Differenz geht durch ${boxen(r)}.</p>
  <div class="calc">
    <div class="field"><label for="pot-empty">Gefäß leer</label><div class="inp"><input id="pot-empty" type="number" inputmode="numeric" min="0" step="1" placeholder="2150"><span>g</span></div></div>
    <div class="field"><label for="pot-full">Mit Essen</label><div class="inp"><input id="pot-full" type="number" inputmode="numeric" min="0" step="1" placeholder="5450"><span>g</span></div></div>
    <div class="calc-out"><span>Pro Box</span><output id="per-box" for="pot-empty pot-full"></output></div>
  </div>`)}

${bereich('aufbewahren', '<h2 id="h-keep">Aufbewahren</h2>', `
  <div class="keep"><div><span class="k">Kühlschrank</span><b>${esc(r.fridge)}</b></div><div><span class="k">Tiefkühler</span><b>${esc(r.freeze)}</b></div></div>
  <ul class="tips">
    <li>Boxen offen höchstens 1–2 Stunden abkühlen lassen, dann in den Kühlschrank oder Tiefkühler.</li>
    <li>Gefrorene Boxen am besten über Nacht im Kühlschrank auftauen.</li>
    <li>Abgedeckt in der Mikrowelle erhitzen und zwischendurch umrühren, bis alles durch und durch heiß ist.</li>
  </ul>`)}
${r.tips && r.tips.length ? bereich('tipps', '<h2 id="h-tips">Tipps</h2>', `<ul class="tips">${r.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`) : ''}

<details class="nut">
  <summary>Nährwertrechnung für alle ${boxen(r)} Boxen</summary>
  <div class="table-wrap"><table>
    <thead><tr><th>Zutat</th><th>Menge</th><th>kcal</th><th>P</th><th>KH</th><th>F</th></tr></thead>
    <tbody>${r.nut.map((n) => `<tr><td>${esc(n[0])}</td><td>${esc(n[1])}</td><td>${nfi(n[2])}</td><td>${nf1(n[3])}</td><td>${nf1(n[4])}</td><td>${nf1(n[5])}</td></tr>`).join('')}</tbody>
    <tfoot>
      <tr><td>Gesamt</td><td></td><td>${nfi(t[0])}</td><td>${nf1(t[1])}</td><td>${nf1(t[2])}</td><td>${nf1(t[3])}</td></tr>
      <tr><td>Pro Box (÷ ${boxen(r)})</td><td></td><td>${r.m.kcal}</td><td>${nf1(r.m.p)}</td><td>${nf1(r.m.kh)}</td><td>${nf1(r.m.f)}</td></tr>
    </tfoot>
  </table></div>
  <p class="fine">${r.ki ? 'Gerechnet mit den Werten pro 100 g, die die KI angegeben hat; die Mengen hat die App auf eure Ziele gerechnet. Gewürze sind vernachlässigt.' : 'Gerechnet mit typischen Packungswerten pro 100 g. Gewürze, Brühe und Zitrussaft sind pauschal enthalten oder vernachlässigbar.'}</p>
</details>`;
}

/*
 * Der Timer eines Schritts läuft über die Wartezeit, wenn es eine gibt
 * („2 Min. + 22 warten“ → 22), sonst über die Minuten des Schritts.
 */
export const timerMinuten = (s) => (s.ruhe ? s.ruhe : s.min);
const timerLabel = (r, s) => `${r.short}: ${s.d.replace(/\s*→.*$/, '').slice(0, 44)}`;

function timerKnopf(r, s, i) {
  const t = timerFuer(r.id, i);
  const ruhe = s.ruhe ? `<small>+${s.ruhe} warten</small>` : '';
  if (t) return `<button type="button" class="step-min laeuft${t.fertig ? ' fertig' : ''}" data-timer="${i}" aria-label="Timer beenden">${timerText(t)}<small>${t.fertig ? 'fertig' : 'Timer'}</small></button>`;
  return `<button type="button" class="step-min" data-timer="${i}" aria-label="Timer ${timerMinuten(s)} Minuten starten">${s.min} Min.${ruhe}</button>`;
}

function schrittHTML(r, s, i) {
  const liste = s.liste?.length ? `<span class="step-l">${s.liste.map((x) => `<span>${schrittText(x, r)}</span>`).join('')}</span>` : '';
  return `<li class="step-li${s.neben ? ' neben' : ''}${s.entfaellt ? ' entfaellt' : ''}" data-li="${i}"><button type="button" class="step${s.neben ? ' neben' : ''}" data-step="${i}" aria-pressed="false">
<span class="step-n"><span class="sn">${i + 1}</span>${ic('check')}</span>
<span class="step-b">${s.neben ? '<span class="step-k">währenddessen</span>' : ''}${s.entfaellt ? '<span class="step-k">entfällt – Zutat weggelassen</span>' : ''}${s.neu ? '<span class="step-k">neu dazu</span>' : ''}<span class="step-d">${schrittText(s.d, r)}</span>${liste}</span>
</button>${timerKnopf(r, s, i)}</li>`;
}

/** Die Timer-Knöpfe im offenen Rezept nachzeichnen (jede Sekunde, von timer.js). */
export function timerZeichnen() {
  if (!aktuell) return;
  const r = app.nachId[aktuell];
  if (!r) return;
  const alle = r.ablauf.flatMap((p) => p.schritte);
  for (const b of $$('#detail .step-min')) {
    const i = Number(b.dataset.timer);
    const neu = timerKnopf(r, alle[i], i);
    if (b.outerHTML !== neu) b.outerHTML = neu;
  }
}

function zubereitungHTML(r) {
  const zeit = r.zeit || (r.zeit = zeitVon(r));
  let i = 0;
  const phasen = r.ablauf.map((p, pi) => `<h3 class="phase"><span class="phase-n">${pi + 1}</span><span class="phase-name">${esc(p.t)}</span><span class="phase-t">ca. ${dauer(zeit.phasen[pi])}</span></h3>
<ol class="steps">${p.schritte.map((s) => schrittHTML(r, s, i++)).join('')}</ol>`).join('');
  const schalen = (r.schalen || []).map((s) => `<li>${schaleSchild(s)}<span class="schale-gr">${esc(s.gr || '')}</span></li>`).join('');
  return bereich('zubereitung', `<h2 id="h-steps">Zubereitung <small>ca. ${dauer(zeit.gesamt)}</small></h2>`, `
  <div class="zeiten">${r.ablauf.map((p, pi) => `<div><span class="k">${esc(p.t)}</span><b>${dauer(zeit.phasen[pi])}</b></div>`).join('')}</div>
  <p class="sec-lead">Zeiten für normales Tempo zu Hause, mit Waschen, Schälen und Abfall wegräumen.</p>
  ${schalen ? `<div class="mise"><h3 class="sub-h">Stell dir bereit</h3><ul class="schalen">${schalen}</ul>${r.geraete?.length ? `<p class="geraete"><b>Außerdem:</b> ${r.geraete.map(esc).join(', ')}, Waage</p>` : ''}</div>` : ''}
  <div class="steps-tools">
    <button type="button" class="switch" id="wake" role="switch" aria-checked="false" data-act="wach" hidden><span class="sw" aria-hidden="true"></span>Bildschirm anlassen</button>
    <button type="button" class="linkbtn" id="reset-steps" data-act="schritte-zurueck" hidden>Haken zurücksetzen</button>
  </div>
  ${phasen}`);
}

export function detailAktualisieren() {
  if (!aktuell) return;
  const r = app.nachId[aktuell];
  const st = rezeptStand(app.stand, r);
  const gesperrt = app.listeDa ? '' : ' disabled';
  let html = '';
  if (!st.gesamt) html += `<span class="onlist">${ic('check')}Alles da – nichts einzukaufen</span>`;
  else if (!st.drauf) html += `<button type="button" class="btn btn-primary" data-act="alle-dazu"${gesperrt}>${ic('list')}Alles auf die Einkaufsliste<span class="btn-n">${st.gesamt}</span></button>`;
  else if (!st.komplett) html += `<button type="button" class="btn btn-primary" data-act="alle-dazu"${gesperrt}>Fehlende ergänzen<span class="btn-n">${st.gesamt - st.n}</span></button><button type="button" class="btn" data-act="alle-weg"${gesperrt}>Von der Liste nehmen</button>`;
  else html += `<span class="onlist">${ic('check')}Alle ${st.gesamt} Zutaten stehen auf der Liste</span><button type="button" class="btn" data-act="alle-weg"${gesperrt}>Von der Liste nehmen</button>`;
  const c = app.stand.cooked[aktuell];
  const heuteGekocht = c && c.at === heute();
  html += heuteGekocht
    ? `<button type="button" class="btn btn-quiet" disabled>${ic('check')}Heute gekocht</button>`
    : `<button type="button" class="btn" data-act="gekocht"${gesperrt}>Heute gekocht</button>`;
  const pin = app.stand.gepinnt?.[aktuell];
  html += `<button type="button" class="btn${pin ? ' is-pin' : ''}" data-act="anpinnen" aria-pressed="${!!pin}"${gesperrt}>${ic('pin')}${pin ? 'Angepinnt' : 'Anpinnen'}</button>`;
  if (r.ki || r.items.some((it) => it.pro100)) html += `<button type="button" class="btn" data-act="anpassen-ki">${ic('ki')}Mit KI ändern</button><button type="button" class="btn" data-act="anpassen">Anpassen</button>`;
  if (c && !heuteGekocht && tagKurz(c.at)) html += `<span class="cooked-note">Zuletzt gekocht am ${esc(tagKurz(c.at))}${c.by ? ` von ${esc(c.by)}` : ''}</span>`;
  $('#d-actions').innerHTML = html;
  const laeuft = $('#d-laeuft');
  if (laeuft) {
    laeuft.hidden = !pin;
    laeuft.innerHTML = pin ? `${ic('pin')}Läuft gerade${pin.by ? ` · angepinnt von ${pin.by === app.name() ? 'dir' : esc(pin.by)}` : ''}` : '';
  }
  $('#d-bewertung').innerHTML = bewertungHTML(aktuell);
  notizenZeichnen();
  if ($('#d-ki')) $('#d-ki').innerHTML = app.kiLeiste(r);
  for (const b of $$('#detail .tog')) {
    const z = zeilen[Number(b.dataset.tog)];
    if (!z) continue;
    const drauf = hatTeil(app.stand, z.k, aktuell);
    b.setAttribute('aria-pressed', String(drauf));
    b.setAttribute('aria-label', `${z.n} ${drauf ? 'von der Einkaufsliste nehmen' : 'auf die Einkaufsliste setzen'}`);
    b.disabled = !app.listeDa;
  }
}

function notizenZeichnen() {
  const el = $('#d-notizen');
  if (!el) return;
  const liste = app.stand.notizen?.[aktuell] || [];
  el.innerHTML = liste.map((n) => {
    const wer = n.by ? (n.by === app.name() ? 'du' : esc(n.by)) : '';
    const wann = n.at && !Number.isNaN(Date.parse(n.at)) ? tagKurz(heute(new Date(n.at))) : '';
    return `<li class="notiz"><span class="notiz-t">${esc(n.text)}</span><span class="notiz-von">${[wer, wann].filter(Boolean).join(', ')}</span><button type="button" class="x" data-notiz-weg="${esc(n.id)}" aria-label="Notiz löschen">${ic('plus', 'i-x')}</button></li>`;
  }).join('');
  el.hidden = !liste.length;
  const btn = $('#notiz-btn');
  if (btn) btn.disabled = !app.listeDa;
}

function bewertungHTML(rid) {
  const b = app.stand.bewertung?.[rid];
  const knopf = (w) => `<button type="button" class="daumen d-${w}" data-bewerten="${w}" aria-pressed="${b?.wert === w}" aria-label="${DAUMEN_TEXT[w]}"${app.listeDa ? '' : ' disabled'}>${daumenIc(w)}</button>`;
  let von = 'Noch nicht bewertet. Gilt für euch beide.';
  if (b) {
    const wer = b.by ? ` von ${b.by === app.name() ? 'dir' : esc(b.by)}` : '';
    const wann = b.at && !Number.isNaN(Date.parse(b.at)) ? ` · ${tagKurz(heute(new Date(b.at)))}` : '';
    von = `${DAUMEN_TEXT[b.wert]}${wer}${wann}`;
  }
  return `<span class="bew-k">Wie war's?</span><div class="bew-btns">${DAUMEN.map(knopf).join('')}</div><span class="bew-von">${von}</span>`;
}

function schritteZeichnen() {
  const s = new Set(schritte[aktuell] || []);
  let jetzt = true;
  for (const b of $$('#detail .step')) {
    const fertig = s.has(Number(b.dataset.step));
    b.setAttribute('aria-pressed', String(fertig));
    // Der erste offene Schritt ist „dran“ – beim Kochen sieht man sofort, wo man ist.
    b.classList.toggle('jetzt', !fertig && jetzt && s.size > 0);
    if (!fertig) jetzt = false;
  }
  const rb = $('#reset-steps');
  if (rb) rb.hidden = !s.size;
}

function rechnerZeichnen() {
  const leerG = parseFloat($('#pot-empty')?.value);
  const vollG = parseFloat($('#pot-full')?.value);
  const out = $('#per-box');
  if (!out) return;
  if (Number.isFinite(leerG) && Number.isFinite(vollG) && vollG > leerG) {
    const essen = vollG - leerG;
    const n = aktuell && app.nachId[aktuell] ? boxen(app.nachId[aktuell]) : 8;
    out.innerHTML = `<b>${nfi(essen / n)} g</b><small>${nfi(essen)} g gesamt</small>`;
  } else {
    out.innerHTML = '<b>– g</b><small>beide Gewichte eintragen</small>';
  }
}

export function oeffneRezept(rid, { still = false } = {}) {
  const r = app.nachId[rid];
  if (!r) return;
  app.anpassenZu();
  if (!aktuell) rasterScroll = window.scrollY;
  aktuell = rid;
  ansicht.rezept = rid;
  ansichtMerken();
  $('#browse').hidden = true;
  if ($('#reste')) $('#reste').hidden = true;
  const el = $('#detail');
  el.innerHTML = detailHTML(r);
  el.hidden = false;
  const wach = $('#wake');
  if (wach && 'wakeLock' in navigator) { wach.hidden = false; wach.setAttribute('aria-checked', String(!!wachSperre)); }
  const leerFeld = $('#pot-empty');
  const topf = lese(TOPF, '');
  if (leerFeld && topf) leerFeld.value = topf;
  detailAktualisieren();
  schritteZeichnen();
  rechnerZeichnen();
  if (!still) { zeigeReiter('rezepte', true); window.scrollTo(0, 0); }
  // Das Tier für den Schluss schon mal holen, dann ist es da, wenn das letzte Häkchen fällt.
  tierVorladen();
}

export function schliesseRezept() {
  app.anpassenZu();
  aktuell = null;
  ansicht.rezept = null;
  ansichtMerken();
  setzeWach(false);
  const el = $('#detail');
  el.hidden = true;
  el.innerHTML = '';
  $('#browse').hidden = false;
  rasterZeichnen();
  window.requestAnimationFrame(() => window.scrollTo(0, rasterScroll));
}

/* ------------------------------------------------- Einkaufsliste ändern */

export function rezeptAufListe(rid) {
  const r = app.nachId[rid] || app.extras[rid];
  if (!r) return;
  const fehlen = einkaufsZutaten(r).filter((it) => !hatTeil(app.stand, it.k, rid));
  if (!fehlen.length) return;
  app.aendern(fehlen.map((it) => opTeil(it.k, rid, { q: it.q, u: it.u, h: it.h || '' }, it.kat || app.katalog[it.k])));
  const kurz = r.short || rid;
  melde(`${kurz}: ${fehlen.length} ${fehlen.length === 1 ? 'Zutat' : 'Zutaten'} auf der Liste`,
    istSchmal() && ansicht.tab !== 'einkauf' ? { knopf: 'Zur Liste', art: 'zur-liste', beiKnopf: () => zeigeReiter('einkauf') } : {});
}

export function rezeptVonListe(rid) {
  const r = app.nachId[rid] || app.extras[rid];
  const vorher = [];
  for (const [k, d] of Object.entries(app.stand.items)) if (d.parts?.[rid]) vorher.push([k, d.parts[rid]]);
  if (!vorher.length) return;
  app.aendern(vorher.map(([k]) => opTeilWeg(k, rid)));
  melde(`${r?.short || rid} von der Liste genommen`, {
    knopf: 'Rückgängig',
    beiKnopf: () => app.aendern(vorher.map(([k, p]) => opTeil(k, rid, p, r?.items?.find((it) => it.k === k)?.kat || app.katalog[k]))),
  });
}

/* ----------------------------------------------------------- Wachbleiben */

let wachSperre = null;
let wachGewuenscht = false;
async function setzeWach(an) {
  wachGewuenscht = !!an;
  if (an) {
    try {
      wachSperre = await navigator.wakeLock.request('screen');
      wachSperre.addEventListener('release', () => { wachSperre = null; wachZeichnen(); });
    } catch {
      wachSperre = null;
      wachGewuenscht = false;
      melde('Dein Handy lässt den Bildschirm hier nicht dauerhaft an.');
    }
  } else if (wachSperre) {
    try { await wachSperre.release(); } catch { /* egal */ }
    wachSperre = null;
  }
  wachZeichnen();
}
function wachZeichnen() { const w = $('#wake'); if (w) w.setAttribute('aria-checked', String(!!wachSperre)); }
document.addEventListener('visibilitychange', () => {
  if (wachGewuenscht && document.visibilityState === 'visible' && !wachSperre) setzeWach(true);
});

/* --------------------------------------------------------------- Klicks */

/** true, wenn der Klick hierher gehörte. */
export function klickRezepte(el) {
  const d = el.dataset;
  if (d.open) { oeffneRezept(d.open); return true; }
  if (d.filter) { ansicht.filter = d.filter; ansichtMerken(); rasterZeichnen(); return true; }
  if ('tog' in d) {
    const z = zeilen[Number(d.tog)];
    if (!z || !aktuell) return true;
    app.kiVorAktion(aktuell);
    if (hatTeil(app.stand, z.k, aktuell)) app.aendern(opTeilWeg(z.k, aktuell));
    else app.aendern(opTeil(z.k, aktuell, teilFuer(z), katFuer(z)));
    return true;
  }
  if (d.bewerten) {
    if (!aktuell) return true;
    app.kiVorAktion(aktuell);
    const vorher = app.stand.bewertung?.[aktuell]?.wert;
    const neu = vorher === d.bewerten ? null : d.bewerten;
    app.aendern(opBewerten(aktuell, neu, app.name()));
    melde(neu ? `Bewertet: ${DAUMEN_TEXT[neu]}` : 'Bewertung entfernt');
    return true;
  }
  if ('step' in d) {
    const i = Number(d.step);
    const vorher = new Set(schritte[aktuell] || []);
    const s = new Set(vorher);
    if (s.has(i)) s.delete(i); else s.add(i);
    schritte[aktuell] = [...s];
    schreibe(SCHRITTE, schritte);
    schritteZeichnen();
    // Phase fertig? Alles fertig? Dann gibt es Lob – und zum Schluss ein Tier.
    lobPruefen(app.nachId[aktuell], s, vorher, { name: app.name() });
    return true;
  }
  if ('timer' in d) {
    const r = app.nachId[aktuell];
    const i = Number(d.timer);
    const s = r?.ablauf.flatMap((p) => p.schritte)[i];
    if (!s) return true;
    const t = timerFuer(aktuell, i);
    if (t) { timerStoppen(t.id); melde('Timer beendet'); } else {
      timerStarten({ rid: aktuell, schritt: i, minuten: timerMinuten(s), label: timerLabel(r, s) });
      melde(`Timer läuft: ${timerMinuten(s)} Min.`);
    }
    timerZeichnen();
    return true;
  }
  if (d.notizWeg) {
    if (!aktuell) return true;
    const n = (app.stand.notizen?.[aktuell] || []).find((x) => x.id === d.notizWeg);
    app.kiVorAktion(aktuell);
    app.aendern(opNotizWeg(aktuell, d.notizWeg));
    if (n) melde('Notiz gelöscht', { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opNotiz(aktuell, n.id, n.text, n.by, n.at)) });
    return true;
  }
  switch (d.act) {
    case 'zurueck': schliesseRezept(); return true;
    case 'alle-dazu': app.kiVorAktion(aktuell); rezeptAufListe(aktuell); return true;
    case 'alle-weg': rezeptVonListe(aktuell); return true;
    case 'gekocht':
      app.kiVorAktion(aktuell);
      app.aendern(opGekocht(aktuell, heute(), app.name()));
      lobGross({ rezept: app.nachId[aktuell], name: app.name(), grund: 'gekocht' }).then((da) => { if (!da) melde('Eingetragen: heute gekocht'); });
      return true;
    case 'schritte-zurueck': schritte[aktuell] = []; schreibe(SCHRITTE, schritte); schritteZeichnen(); return true;
    case 'zum-rezept': {
      // Direkt zur Zubereitung – aufgeklappt, auch wenn sie zu war
      const z = $('#s-zubereitung');
      if (z) { z.open = true; z.scrollIntoView({ block: 'start' }); }
      return true;
    }
    case 'anpinnen': {
      if (!aktuell) return true;
      app.kiVorAktion(aktuell);
      const an = !app.stand.gepinnt?.[aktuell];
      app.aendern(opAnpinnen(aktuell, an, app.name()));
      melde(an ? 'Angepinnt – steht jetzt oben bei den Rezepten, auch beim anderen Handy' : 'Nicht mehr angepinnt');
      return true;
    }
    case 'wach': setzeWach(!wachSperre); return true;
    default: return false;
  }
}

export function eingabeRezepte(ziel) {
  if (ziel.id === 'suche') { suche = normal(ziel.value.trim()); rasterZeichnen(); return; }
  if (ziel.id === 'pot-empty') schreibe(TOPF, ziel.value);
  if (ziel.id === 'pot-empty' || ziel.id === 'pot-full') rechnerZeichnen();
}

/** true, wenn das Formular hierher gehörte. */
export function absendenRezepte(ev) {
  if (ev.target.id !== 'notiz-form') return false;
  ev.preventDefault();
  const feld = $('#notiz-feld');
  const text = feld.value.trim().replace(/\s+/g, ' ').slice(0, 300);
  if (!text || !aktuell) return true;
  feld.value = '';
  app.kiVorAktion(aktuell);
  app.aendern(opNotiz(aktuell, `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text, app.name()));
  return true;
}

/** Vom Timer in der Leiste oben: zum Schritt springen. */
export function zuSchritt(rid, i) {
  if (!app.nachId[rid]) return;
  if (aktuell !== rid) oeffneRezept(rid);
  const li = $(`#detail .step-li[data-li="${i}"]`);
  if (li) window.requestAnimationFrame(() => li.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}
