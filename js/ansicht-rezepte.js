/*
 * Reiter „Rezepte“: die Boxen im Raster und ein Rezept im Detail.
 *
 * Das Detail wird beim Öffnen einmal gebaut. Wenn sich die Liste ändert
 * (auch vom anderen Handy), zeichnet detailAktualisieren() nur Knöpfe und
 * Haken neu – der Portionsrechner und die Kochschritte behalten, was man
 * gerade eingetippt oder abgehakt hat.
 */
import { app, $, $$, ansicht, ansichtMerken, melde, zeigeReiter, istSchmal, lese, schreibe } from './kern.js';
import { esc, nf1, nfi, heute, tagKurz, abweichung } from './format.js';
import { hatTeil, rezeptStand, einkaufsZutaten, opTeil, opTeilWeg, opGekocht } from './liste.js';

const SCHRITTE = 'boxenstopp.schritte.v1';
const TOPF = 'boxenstopp.topf.v1';

export const FILTER = [
  ['alle', 'Alle', () => true],
  ['haehnchen', 'Hähnchen', (r) => r.protein.includes('Hähnchen')],
  ['rind', 'Rind', (r) => r.protein.includes('Rind')],
  ['pute', 'Pute', (r) => r.protein.includes('Pute')],
  ['veggie', 'Veggie', (r) => r.protein === 'Vegetarisch'],
  ['reis', 'Reis', (r) => r.base === 'Reis'],
  ['nudeln', 'Nudeln', (r) => r.base === 'Nudeln'],
  ['kartoffel', 'Kartoffel & Co.', (r) => ['Kartoffeln', 'Süßkartoffel', 'Gnocchi'].includes(r.base)],
  ['schnell', 'Bis 45 Min.', (r) => r.time <= 45],
  ['liste', 'Auf der Liste', (r) => rezeptStand(app.stand, r).drauf],
];

const PFADE = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  list: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.8 6.6l1.3 1.3L7.6 5.4M3.8 12.1l1.3 1.3 2.5-2.5M3.8 17.6l1.3 1.3 2.5-2.5"/>',
};
export const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PFADE[name]}</svg>`;

let aktuell = null;
let zeilen = [];
let rasterScroll = 0;
const schritte = lese(SCHRITTE, {}) || {};

export const offenesRezept = () => aktuell;

/* ----------------------------------------------------------------- Raster */

export function filterZeichnen() {
  $('#chips').innerHTML = FILTER.map(([id, label]) => `<button type="button" class="chip" data-filter="${id}" aria-pressed="false">${esc(label)}<span class="n"></span></button>`).join('');
}

function karte(r) {
  const st = rezeptStand(app.stand, r);
  const c = app.stand.cooked[r.id];
  const tag = c ? tagKurz(c.at) : '';
  return `<button type="button" class="box" data-open="${esc(r.id)}">
<span class="tape">${esc(r.short)}</span><span class="box-time">${r.time} Min.</span>
<span class="box-desc">${esc(r.desc)}</span>
<span class="box-meta">${esc(r.protein)} · ${esc(r.base)} · ${esc(r.method)}</span>
<span class="box-macros"><span><b>${r.m.kcal}</b> kcal</span><span class="m-p">P ${nf1(r.m.p)}</span><span class="m-kh">KH ${nf1(r.m.kh)}</span><span class="m-f">F ${nf1(r.m.f)}</span></span>
<span class="box-foot">${st.drauf ? `<span class="pill pill-list">${ic('list')}Auf der Liste</span>` : ''}${tag ? `<span class="pill">Zuletzt gekocht ${esc(tag)}</span>` : ''}</span>
</button>`;
}

export function rasterZeichnen() {
  if (!FILTER.some((f) => f[0] === ansicht.filter)) ansicht.filter = 'alle';
  const f = FILTER.find((x) => x[0] === ansicht.filter);
  const liste = app.rezepte.filter(f[2]);
  $('#grid').innerHTML = liste.length ? liste.map(karte).join('') : '<p class="empty">Gerade steht kein Rezept auf der Einkaufsliste.</p>';
  for (const b of $$('[data-filter]')) {
    const fx = FILTER.find((x) => x[0] === b.dataset.filter);
    b.setAttribute('aria-pressed', String(b.dataset.filter === ansicht.filter));
    const n = b.querySelector('.n');
    if (n && fx) n.textContent = String(app.rezepte.filter(fx[2]).length);
  }
}

/* ----------------------------------------------------------------- Detail */

function zeilenVon(r) {
  const z = [];
  const art = (it) => {
    if (it.haus) return 'haushalt';
    if (typeof it.q === 'number' && !it.pantry && !it.opt) return 'einkauf';
    return it.opt ? 'optional' : 'vorrat';
  };
  for (const it of r.items) z.push({ ...it, art: art(it) });
  for (const s of r.spices) z.push({ n: s.n, a: s.a, k: s.k, h: '', art: 'gewuerz' });
  return z;
}
/*
 * Mengen in den Kochschritten hervorheben („800 g“, „2 EL“, „4 Knoblauchzehen“,
 * „3 Paprika“), damit man beim Kochen nicht nach oben zu den Zutaten muss.
 * Läuft auf bereits entschärftem Text, fügt nur <b> ein.
 */
const MENGE = new RegExp(String.raw`(?<![\w.,])(?:\d+(?:[.,]\d+)?[½¼¾]?|[½¼¾])(?:\s?[–-]\s?\d+(?:[.,]\d+)?[½¼¾]?)?\s(?:gehäufte\s|große\s|rote\s|gelbe\s)?(?:kg|g|ml|l|EL|TL|Prise|Zehen?|Knoblauchzehen?|Dosen?|Glas|Bund|Stangen?|Stück|Lorbeerblätter|Brühwürfeln|Blatt|Blätter|Zwiebeln?|Paprika|Möhren|Tomaten|Zucchini|Limetten?|Zitronen?|Salatgurke)(?![\wäöüß])`, 'g');
export const mengenHervor = (html) => html.replace(MENGE, (m) => `<b class="mg">${m}</b>`);

const teilFuer = (z) => (z.art === 'einkauf' ? { q: z.q, u: z.u, h: z.h || '' } : { t: z.a });

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

function zutatZeile(z, i) {
  return `<li class="ing"><div><span class="ing-name">${esc(z.n)}</span>${z.h ? `<span class="ing-hint">${esc(z.h)}</span>` : ''}</div><span class="ing-amt">${esc(z.a)}</span><button type="button" class="tog" data-tog="${i}" aria-pressed="false" aria-label="${esc(z.n)} auf die Einkaufsliste setzen">${ic('plus', 'i-plus')}${ic('check', 'i-check')}</button></li>`;
}

function detailHTML(r) {
  zeilen = zeilenVon(r);
  const gruppe = (art, titel) => {
    const idx = zeilen.map((z, i) => [z, i]).filter(([z]) => z.art === art);
    return idx.length ? `<h3 class="sub-h">${titel}</h3><ul class="ings">${idx.map(([z, i]) => zutatZeile(z, i)).join('')}</ul>` : '';
  };
  const fakten = [`${r.time} Min.${r.timeNote ? ` (${esc(r.timeNote)})` : ''}`, esc(r.method), `Kühlschrank ${esc(r.fridge)}`, `Tiefkühler ${esc(r.freeze)}`];
  const t = r.total;
  return `<button type="button" class="back" data-act="zurueck">${ic('back')}Alle Rezepte</button>
<div class="d-head">
  <span class="tape">${esc(r.short)} · 8×</span>
  <h1 id="d-title">${esc(r.name)}</h1>
  <p class="d-desc">${esc(r.desc)}</p>
  <div class="facts">${fakten.map((f) => `<span class="pill">${f}</span>`).join('')}</div>
</div>
<span class="label-k">Pro Box, eine von acht</span>
${etikett(r)}
<div class="actions" id="d-actions"></div>

<section class="sec" aria-labelledby="h-ing">
  <h2 id="h-ing">Zutaten <small>für 8 Boxen</small></h2>
  <p class="sec-lead">Mit + setzt du einzelne Zutaten auf die Liste, mit ✓ nimmst du sie wieder runter.</p>
  ${gruppe('einkauf', 'Einkaufen')}
  ${gruppe('vorrat', 'Aus dem Vorrat')}
  ${gruppe('optional', 'Optional')}
  ${gruppe('gewuerz', 'Gewürze')}
  ${gruppe('haushalt', 'Extras')}
</section>

<section class="sec" aria-labelledby="h-steps">
  <h2 id="h-steps">Zubereitung <small>${r.steps.length} Schritte</small></h2>
  <div class="steps-tools">
    <button type="button" class="switch" id="wake" role="switch" aria-checked="false" data-act="wach" hidden><span class="sw" aria-hidden="true"></span>Bildschirm anlassen</button>
    <button type="button" class="linkbtn" id="reset-steps" data-act="schritte-zurueck" hidden>Haken zurücksetzen</button>
  </div>
  <ol class="steps">${r.steps.map((s, i) => `<li><button type="button" class="step" data-step="${i}" aria-pressed="false"><span class="step-n"><span class="sn">${i + 1}</span>${ic('check')}</span><span><span class="step-t">${esc(s.t)}</span><span class="step-d">${mengenHervor(esc(s.d))}</span></span></button></li>`).join('')}</ol>
</section>

<section class="sec" aria-labelledby="h-calc">
  <h2 id="h-calc">Portionieren</h2>
  <p class="sec-lead">Topf oder Schüssel leer wiegen, dann mit dem fertigen Essen. Die Differenz geht durch 8.</p>
  <div class="calc">
    <div class="field"><label for="pot-empty">Gefäß leer</label><div class="inp"><input id="pot-empty" type="number" inputmode="numeric" min="0" step="1" placeholder="2150"><span>g</span></div></div>
    <div class="field"><label for="pot-full">Mit Essen</label><div class="inp"><input id="pot-full" type="number" inputmode="numeric" min="0" step="1" placeholder="5450"><span>g</span></div></div>
    <div class="calc-out"><span>Pro Box</span><output id="per-box" for="pot-empty pot-full"></output></div>
  </div>
</section>

<section class="sec" aria-labelledby="h-keep">
  <h2 id="h-keep">Aufbewahren</h2>
  <div class="keep"><div><span class="k">Kühlschrank</span><b>${esc(r.fridge)}</b></div><div><span class="k">Tiefkühler</span><b>${esc(r.freeze)}</b></div></div>
  <ul class="tips">
    <li>Boxen offen höchstens 1–2 Stunden abkühlen lassen, dann in den Kühlschrank oder Tiefkühler.</li>
    <li>Gefrorene Boxen am besten über Nacht im Kühlschrank auftauen.</li>
    <li>Abgedeckt in der Mikrowelle erhitzen und zwischendurch umrühren, bis alles durch und durch heiß ist.</li>
  </ul>
</section>
${r.tips && r.tips.length ? `<section class="sec" aria-labelledby="h-tips"><h2 id="h-tips">Tipps</h2><ul class="tips">${r.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}

<details class="nut">
  <summary>Nährwertrechnung für alle 8 Boxen</summary>
  <div class="table-wrap"><table>
    <thead><tr><th>Zutat</th><th>Menge</th><th>kcal</th><th>P</th><th>KH</th><th>F</th></tr></thead>
    <tbody>${r.nut.map((n) => `<tr><td>${esc(n[0])}</td><td>${esc(n[1])}</td><td>${nfi(n[2])}</td><td>${nf1(n[3])}</td><td>${nf1(n[4])}</td><td>${nf1(n[5])}</td></tr>`).join('')}</tbody>
    <tfoot>
      <tr><td>Gesamt</td><td></td><td>${nfi(t[0])}</td><td>${nf1(t[1])}</td><td>${nf1(t[2])}</td><td>${nf1(t[3])}</td></tr>
      <tr><td>Pro Box (÷ 8)</td><td></td><td>${r.m.kcal}</td><td>${nf1(r.m.p)}</td><td>${nf1(r.m.kh)}</td><td>${nf1(r.m.f)}</td></tr>
    </tfoot>
  </table></div>
  <p class="fine">Gerechnet mit typischen Packungswerten pro 100 g. Gewürze, Brühe und Zitrussaft sind pauschal enthalten oder vernachlässigbar.</p>
</details>`;
}

export function detailAktualisieren() {
  if (!aktuell) return;
  const r = app.nachId[aktuell];
  const st = rezeptStand(app.stand, r);
  const gesperrt = app.listeDa ? '' : ' disabled';
  let html = '';
  if (!st.drauf) html += `<button type="button" class="btn btn-primary" data-act="alle-dazu"${gesperrt}>${ic('list')}Alles auf die Einkaufsliste<span class="btn-n">${st.gesamt}</span></button>`;
  else if (!st.komplett) html += `<button type="button" class="btn btn-primary" data-act="alle-dazu"${gesperrt}>Fehlende ergänzen<span class="btn-n">${st.gesamt - st.n}</span></button><button type="button" class="btn" data-act="alle-weg"${gesperrt}>Von der Liste nehmen</button>`;
  else html += `<span class="onlist">${ic('check')}Alle ${st.gesamt} Zutaten stehen auf der Liste</span><button type="button" class="btn" data-act="alle-weg"${gesperrt}>Von der Liste nehmen</button>`;
  const c = app.stand.cooked[aktuell];
  const heuteGekocht = c && c.at === heute();
  html += heuteGekocht
    ? `<button type="button" class="btn btn-quiet" disabled>${ic('check')}Heute gekocht</button>`
    : `<button type="button" class="btn" data-act="gekocht"${gesperrt}>Heute gekocht</button>`;
  if (c && !heuteGekocht && tagKurz(c.at)) html += `<span class="cooked-note">Zuletzt gekocht am ${esc(tagKurz(c.at))}${c.by ? ` von ${esc(c.by)}` : ''}</span>`;
  $('#d-actions').innerHTML = html;
  for (const b of $$('#detail .tog')) {
    const z = zeilen[Number(b.dataset.tog)];
    if (!z) continue;
    const drauf = hatTeil(app.stand, z.k, aktuell);
    b.setAttribute('aria-pressed', String(drauf));
    b.setAttribute('aria-label', `${z.n} ${drauf ? 'von der Einkaufsliste nehmen' : 'auf die Einkaufsliste setzen'}`);
    b.disabled = !app.listeDa;
  }
}

function schritteZeichnen() {
  const s = new Set(schritte[aktuell] || []);
  for (const b of $$('#detail .step')) b.setAttribute('aria-pressed', String(s.has(Number(b.dataset.step))));
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
    out.innerHTML = `<b>${nfi(essen / 8)} g</b><small>${nfi(essen)} g gesamt</small>`;
  } else {
    out.innerHTML = '<b>– g</b><small>beide Gewichte eintragen</small>';
  }
}

export function oeffneRezept(rid, { still = false } = {}) {
  const r = app.nachId[rid];
  if (!r) return;
  if (!aktuell) rasterScroll = window.scrollY;
  aktuell = rid;
  ansicht.rezept = rid;
  ansichtMerken();
  $('#browse').hidden = true;
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
}

export function schliesseRezept() {
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
  app.aendern(fehlen.map((it) => opTeil(it.k, rid, { q: it.q, u: it.u, h: it.h || '' }, app.katalog[it.k])));
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
    beiKnopf: () => app.aendern(vorher.map(([k, p]) => opTeil(k, rid, p, app.katalog[k]))),
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
    if (hatTeil(app.stand, z.k, aktuell)) app.aendern(opTeilWeg(z.k, aktuell));
    else app.aendern(opTeil(z.k, aktuell, teilFuer(z), app.katalog[z.k]));
    return true;
  }
  if ('step' in d) {
    const i = Number(d.step);
    const s = new Set(schritte[aktuell] || []);
    if (s.has(i)) s.delete(i); else s.add(i);
    schritte[aktuell] = [...s];
    schreibe(SCHRITTE, schritte);
    schritteZeichnen();
    return true;
  }
  switch (d.act) {
    case 'zurueck': schliesseRezept(); return true;
    case 'alle-dazu': rezeptAufListe(aktuell); return true;
    case 'alle-weg': rezeptVonListe(aktuell); return true;
    case 'gekocht':
      app.aendern(opGekocht(aktuell, heute(), app.name()));
      melde('Eingetragen: heute gekocht');
      return true;
    case 'schritte-zurueck': schritte[aktuell] = []; schreibe(SCHRITTE, schritte); schritteZeichnen(); return true;
    case 'wach': setzeWach(!wachSperre); return true;
    default: return false;
  }
}

export function eingabeRezepte(ziel) {
  if (ziel.id === 'pot-empty') schreibe(TOPF, ziel.value);
  if (ziel.id === 'pot-empty' || ziel.id === 'pot-full') rechnerZeichnen();
}
