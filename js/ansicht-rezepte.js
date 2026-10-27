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
import { opNotiz, opNotizWeg } from './liste.js';
import { hatTeil, rezeptStand, einkaufsZutaten, opTeil, opTeilWeg, opGekocht, opBewerten, DAUMEN } from './liste.js';

const SCHRITTE = 'boxenstopp.schritte.v2';
const TOPF = 'boxenstopp.topf.v1';

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
  const b = app.stand.bewertung?.[r.id];
  const daumen = b ? `<span class="pill p-${b.wert}">${daumenIc(b.wert)}${DAUMEN_TEXT[b.wert]}</span>` : '';
  const ki = r.ki ? `<span class="pill pill-ki">${r.ki.herkunft ? 'Angepasst' : 'Resteverwertung'}${boxen(r) !== 8 ? ` · ${boxen(r)} Boxen` : ''}</span>` : '';
  return `<button type="button" class="box" data-open="${esc(r.id)}">
<span class="tape">${esc(r.short)}</span><span class="box-time">${dauer(gesamtZeit(r))}</span>
<span class="box-desc">${esc(r.desc)}</span>
<span class="box-meta">${esc(r.protein)} · ${esc(r.base)} · ${esc(r.method)}</span>
<span class="box-macros"><span><b>${r.m.kcal}</b> kcal</span><span class="m-p">P ${nf1(r.m.p)}</span><span class="m-kh">KH ${nf1(r.m.kh)}</span><span class="m-f">F ${nf1(r.m.f)}</span></span>
<span class="box-foot">${ki}${daumen}${st.drauf ? `<span class="pill pill-list">${ic('list')}Auf der Liste</span>` : ''}${tag ? `<span class="pill">Zuletzt gekocht ${esc(tag)}</span>` : ''}</span>
</button>`;
}

export function rasterZeichnen() {
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

function zutatZeile(z, i) {
  return `<li class="ing"><div><span class="ing-name">${esc(z.n)}</span>${z.h ? `<span class="ing-hint">${esc(z.h)}</span>` : ''}</div><span class="ing-amt">${esc(z.a)}</span><button type="button" class="tog" data-tog="${i}" aria-pressed="false" aria-label="${esc(z.n)} auf die Einkaufsliste setzen">${ic('plus', 'i-plus')}${ic('check', 'i-check')}</button></li>`;
}

function detailHTML(r) {
  zeilen = zeilenVon(r);
  const gruppe = (art, titel) => {
    const idx = zeilen.map((z, i) => [z, i]).filter(([z]) => z.art === art);
    return idx.length ? `<h3 class="sub-h">${titel}</h3><ul class="ings">${idx.map(([z, i]) => zutatZeile(z, i)).join('')}</ul>` : '';
  };
  const fakten = [`ca. ${dauer(gesamtZeit(r))}`, esc(r.method), `Kühlschrank ${esc(r.fridge)}`, `Tiefkühler ${esc(r.freeze)}`];
  const t = r.total;
  return `<button type="button" class="back" data-act="zurueck">${ic('back')}Alle Rezepte</button>
<div class="d-head">
  <span class="tape">${esc(r.short)} · ${boxen(r)}×</span>
  <h1 id="d-title">${esc(r.name)}</h1>
  <p class="d-desc">${esc(r.desc)}</p>
  <div class="facts">${fakten.map((f) => `<span class="pill">${f}</span>`).join('')}</div>
</div>
<span class="label-k">Pro Box, eine von ${zahlwort(boxen(r))}</span>
${etikett(r)}
${r.ki ? '<div class="ki-leiste" id="d-ki"></div>' : ''}
<div class="actions" id="d-actions"></div>
<section class="anpassen" id="d-anpassen" aria-label="Rezept anpassen" hidden></section>
<div class="bewertung" id="d-bewertung" role="group" aria-label="Wie war's?"></div>
<section class="notizen" aria-labelledby="h-notizen">
  <h3 id="h-notizen" class="sub-h">Notizen <small>für euch beide</small></h3>
  <ul class="notiz-liste" id="d-notizen"></ul>
  <form class="notiz-form" id="notiz-form" autocomplete="off">
    <label class="sr" for="notiz-feld">Notiz</label>
    <input id="notiz-feld" type="text" maxlength="300" placeholder="z. B. nächstes Mal weniger Chili" enterkeyhint="done">
    <button type="submit" class="btn" id="notiz-btn" aria-label="Notiz speichern">${ic('plus')}</button>
  </form>
</section>

<section class="sec" aria-labelledby="h-ing">
  <h2 id="h-ing">Zutaten <small>für ${boxen(r)} Boxen</small></h2>
  <p class="sec-lead">Mit + setzt du einzelne Zutaten auf die Liste, mit ✓ nimmst du sie wieder runter.</p>
  ${gruppe('einkauf', 'Einkaufen')}
  ${gruppe('vorhanden', 'Ist schon da')}
  ${gruppe('vorrat', 'Aus dem Vorrat')}
  ${gruppe('optional', 'Optional')}
  ${gruppe('gewuerz', 'Gewürze')}
  ${gruppe('haushalt', 'Extras')}
</section>

${zubereitungHTML(r)}

<section class="sec" aria-labelledby="h-calc">
  <h2 id="h-calc">Portionieren</h2>
  <p class="sec-lead">Topf oder Schüssel leer wiegen, dann mit dem fertigen Essen. Die Differenz geht durch ${boxen(r)}.</p>
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
  return `<section class="sec" aria-labelledby="h-steps">
  <h2 id="h-steps">Zubereitung <small>ca. ${dauer(zeit.gesamt)}</small></h2>
  <div class="zeiten">${r.ablauf.map((p, pi) => `<div><span class="k">${esc(p.t)}</span><b>${dauer(zeit.phasen[pi])}</b></div>`).join('')}</div>
  <p class="sec-lead">Zeiten für normales Tempo zu Hause, mit Waschen, Schälen und Abfall wegräumen.</p>
  ${schalen ? `<div class="mise"><h3 class="sub-h">Stell dir bereit</h3><ul class="schalen">${schalen}</ul>${r.geraete?.length ? `<p class="geraete"><b>Außerdem:</b> ${r.geraete.map(esc).join(', ')}, Waage</p>` : ''}</div>` : ''}
  <div class="steps-tools">
    <button type="button" class="switch" id="wake" role="switch" aria-checked="false" data-act="wach" hidden><span class="sw" aria-hidden="true"></span>Bildschirm anlassen</button>
    <button type="button" class="linkbtn" id="reset-steps" data-act="schritte-zurueck" hidden>Haken zurücksetzen</button>
  </div>
  ${phasen}
</section>`;
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
  if (r.ki || r.items.some((it) => it.pro100)) html += '<button type="button" class="btn" data-act="anpassen">Anpassen</button>';
  if (c && !heuteGekocht && tagKurz(c.at)) html += `<span class="cooked-note">Zuletzt gekocht am ${esc(tagKurz(c.at))}${c.by ? ` von ${esc(c.by)}` : ''}</span>`;
  $('#d-actions').innerHTML = html;
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
    const s = new Set(schritte[aktuell] || []);
    if (s.has(i)) s.delete(i); else s.add(i);
    schritte[aktuell] = [...s];
    schreibe(SCHRITTE, schritte);
    schritteZeichnen();
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
      melde('Eingetragen: heute gekocht');
      return true;
    case 'schritte-zurueck': schritte[aktuell] = []; schreibe(SCHRITTE, schritte); schritteZeichnen(); return true;
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
