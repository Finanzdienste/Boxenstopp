/*
 * Zwei auf einmal – gerechnet in doppel.js:
 *
 *   im Rezept (#d-doppel)  bis zu drei Rezepte, die gut dazu passen: wie lange
 *                          beide zusammen dauern statt nacheinander, und warum.
 *   #doppel                der Plan für zwei: die Zeit, je volle oder je halbe
 *                          Boxen, beide auf die Liste, Kochmodus für beide, was
 *                          beide schneiden, der Ofen, Schalen und Geräte, der
 *                          Ablauf in Blöcken, andere Partner. Ohne Paar (Kachel
 *                          „Zwei auf einmal“): die besten Paare überhaupt.
 *   Kochmodus für beide    die Schritte beider Rezepte in der Reihenfolge des
 *                          Plans. Abgehakt wird im Rezept selbst (Kochstand,
 *                          auch auf dem anderen Gerät), die Timer sind die des
 *                          Rezepts. Das Tempo lernt das Handy dabei nicht –
 *                          zwischen zwei Haken lag ja das andere Rezept.
 *
 * Gerechnet wird im eigenen Tempo (zeitFuer), ohne Rezepte mit Daumen runter,
 * gemerkt, bis sich Rezepte oder Tempo ändern – auf dem Handy dauert das
 * Rechnen aller Partner einen Moment, darum erst nach dem Zeichnen.
 */
import { app, $, melde, zeigeReiter, istSchmal, ansicht } from './kern.js';
import { esc, platzhalter } from './format.js';
import { dauer } from './zeiten.js';
import { tempoGelernt } from './tempo.js';
import { aufBoxen, boxenText } from './boxen.js';
import { doppelPaar, doppelPartner, besteDoppel, schalenPlan, schalenUmbenennen, geraeteZusammen, gemeinsamSchneiden, beideReis, ofenGeteilt, MIN_SPART } from './doppel.js';
import { oeffneRezept, offenesRezept, schliesseRezept, rasterZeichnen, zeitFuer, schrittText, timerKnopf, timerUmschalten, schrittUmschalten, planVon, ic } from './ansicht-rezepte.js';
import { kochmodusOeffnen, KOCHMODUS_IC } from './kochmodus.js';
import { schritteVon } from './kochstand.js';
import { lobGross } from './lob.js';
import { hatTeil, einkaufsZutaten, opTeil, rezeptStand } from './liste.js';

const daten = () => ({ preise: app.preise, naehrwerte: app.naehrwerte, katalog: app.katalog });
const kurz = (r) => r?.short || r?.name || '';
const flach = (r) => (r?.ablauf || []).flatMap((p) => p.schritte || []);
/** 95 → „1:35“ – Minuten ab Start */
const uhr = (m) => { const t = Math.round(m); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
/** Später rechnen, aber jede Sache nur einmal auf einmal. */
const spaeter = new Set();
function nachher(was, fn) {
  if (spaeter.has(was)) return;
  spaeter.add(was);
  setTimeout(() => { spaeter.delete(was); fn(); }, 30);
}
const und = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} und ${xs[xs.length - 1]}` : xs[0] || '');

/** Was abgelehnt ist (Daumen runter), schlägt die App nicht vor. */
const runter = () => Object.entries(app.stand.bewertung || {}).filter(([, b]) => b?.wert === 'runter').map(([rid]) => rid).sort();
/** Wer als Partner in Frage kommt: die Rezepte der Liste und behaltene KI-Rezepte. */
function kandidaten() {
  const weg = new Set(runter());
  return [...app.rezepte, ...app.kiRezepte.filter((r) => r.ki?.von?.gespeichert)].filter((r) => !weg.has(r.id));
}

/* ---------------------------------------------------------- Rechnen */

/** Die Minuten eines Schritts im eigenen Tempo – dieselbe Funktion, bis das Handy etwas Neues gelernt hat (doppel.js merkt sich danach). */
let tempo = { g: null, fn: null };
function minuten() {
  const g = tempoGelernt();
  if (tempo.g !== g) tempo = { g, fn: (r, i, s) => (planVon(s) ? s.min : zeitFuer(r).schritte[i]?.min ?? s.min) };
  return tempo.fn;
}
const anzeige = (r) => zeitFuer(r).gesamt;
const optionen = () => ({ minuten: minuten(), anzeige, daten: daten() });
/** Woran man sieht, ob etwas neu gerechnet werden muss: Rezepte, Tempo, Daumen. */
const stand = () => [app.rezepte, app.kiRezepte, tempoGelernt(), runter().join()];
const gleich = (a, b) => !!a && a.length === b.length && a.every((x, i) => x === b[i]);

const partnerMemo = new Map();
/** Die Partner eines Rezepts – null, solange nicht gerechnet (rechnen: jetzt rechnen). */
function partnerVon(r, { rechnen = false } = {}) {
  const s = [r, ...stand()];
  const m = partnerMemo.get(r.id);
  if (m && gleich(m.s, s)) return m.p;
  if (!rechnen) return null;
  const p = doppelPartner(r, kandidaten(), { ...optionen(), max: 3 });
  partnerMemo.set(r.id, { s, p });
  if (partnerMemo.size > 30) partnerMemo.delete(partnerMemo.keys().next().value);
  return p;
}

let besteMemo = null;
function beste({ rechnen = false } = {}) {
  const s = stand();
  if (besteMemo && gleich(besteMemo.s, s)) return besteMemo.p;
  if (!rechnen) return null;
  besteMemo = { s, p: besteDoppel(kandidaten(), { ...optionen(), max: 8 }) };
  return besteMemo.p;
}

/** Je halbe Boxen: so viele Boxen hat jedes Rezept dann. */
const halbeBoxen = () => Math.max(1, Math.round((app.boxen || 8) / 2));
const halbGeht = () => (app.boxen || 8) >= 4;

let paarMemo = null;
/** Das offene Paar ganz gerechnet: doppelPaar mit Schalen – mit halben Boxen auf Kopien der Rezepte. */
function paarFuer(z) {
  const a0 = app.nachId[z.a];
  const b0 = app.nachId[z.b];
  if (!a0?.ablauf?.length || !b0?.ablauf?.length) return null;
  const halb = z.halb && halbGeht();
  const s = [a0, b0, halb, ...stand()];
  if (paarMemo && gleich(paarMemo.s, s)) return paarMemo.p;
  const a = halb ? aufBoxen(a0, halbeBoxen(), { katalog: app.katalog }) : a0;
  const b = halb ? aufBoxen(b0, halbeBoxen(), { katalog: app.katalog }) : b0;
  const p = doppelPaar(a, b, optionen());
  p.schalen = schalenPlan(p.plan, p.reihe);
  paarMemo = { s, p };
  return p;
}

/* ------------------------------------------------------- im Rezept */

const zeitText = (p) => `<b>${esc(dauer(p.zusammen))}</b> statt ${esc(dauer(p.getrennt))}`;

function zeileHTML(p, { mit = null } = {}) {
  const andere = mit ? (p.a.id === mit.id ? p.b : p.a) : null;
  const titel = andere ? `+ ${esc(kurz(andere))}` : `${esc(kurz(p.reihe[0]))} + ${esc(kurz(p.reihe[1]))}`;
  return `<li><button type="button" class="doppel-z" data-doppel="${esc(`${p.a.id} ${p.b.id}`)}">
<span class="doppel-n">${titel}</span><span class="doppel-t">${zeitText(p)}</span>${p.warum ? `<span class="doppel-w">${esc(p.warum)}</span>` : ''}
</button></li>`;
}

/** Im Rezept: die besten Partner – gleich, wenn schon gerechnet, sonst nach dem Zeichnen. */
export function doppelKarteZeichnen(r) {
  const el = $('#d-doppel');
  if (!el || !r?.ablauf?.length) return;
  const p = partnerVon(r);
  if (!p) {
    if (!el.querySelector('.doppel-l')) el.innerHTML = '<p class="sec-lead">Rechnet, was gut dazu passt …</p>';
    nachher(`karte:${r.id}`, () => {
      if (offenesRezept() !== r.id || !$('#d-doppel')) return;
      partnerVon(app.nachId[r.id] || r, { rechnen: true });
      doppelKarteZeichnen(app.nachId[r.id] || r);
    });
    return;
  }
  el.innerHTML = p.length
    ? `<p class="sec-lead">Kochst du ein zweites Rezept dazu, nutzt du die Zeit, in der eins köchelt oder im Ofen ist.</p>
<ul class="doppel-l">${p.map((x) => zeileHTML(x, { mit: r })).join('')}</ul>`
    : '<p class="sec-lead">Hier lohnt sich ein zweites Rezept kaum – es gibt wenig Wartezeit, in der du am anderen weitermachen könntest.</p>';
}

/* ---------------------------------------------------------- Ansicht */

let offen = null; // { a, b, halb, von } – oder { a: '', b: '' } für die Übersicht

export const doppelOffen = () => !!$('#doppel') && !$('#doppel').hidden;

export function oeffneDoppel(a = '', b = '', { von = '' } = {}) {
  const herkunft = von;
  if (offenesRezept()) schliesseRezept();
  for (const id of ['#browse', '#detail', '#reste', '#speisekarte']) { const x = $(id); if (x) x.hidden = true; }
  offen = { a, b, halb: offen && offen.a === a && offen.b === b ? offen.halb : false, von: herkunft };
  const el = $('#doppel');
  el.hidden = false;
  zeichnen();
  if (ansicht.tab !== 'rezepte') zeigeReiter('rezepte', true);
  window.scrollTo(0, 0);
}

export function schliesseDoppel() {
  const von = offen?.von;
  offen = null;
  const el = $('#doppel');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  if (von && app.nachId[von]) { oeffneRezept(von); return; }
  $('#browse').hidden = false;
  rasterZeichnen();
}

/** Von app.js: Liste oder Kochstand haben sich geändert – neu zeichnen, wenn offen. */
export function doppelNeu() { if (doppelOffen()) zeichnen(); }

function kopfHTML(titel, unter) {
  const zurueck = offen?.von && app.nachId[offen.von] ? kurz(app.nachId[offen.von]) : 'Alle Rezepte';
  return `<button type="button" class="back" data-act="doppel-zu">${ic('back')}${esc(zurueck)}</button>
<div class="d-head"><span class="tape">Zwei auf einmal</span><h1 id="dp-titel">${titel}</h1>${unter}</div>`;
}

function uebersichtHTML() {
  const p = beste();
  if (!p) nachher('beste', () => { if (doppelOffen() && !offen?.a) { beste({ rechnen: true }); zeichnen(); } });
  const liste = !p ? '<p class="sec-lead">Rechnet, welche Rezepte gut zusammen gehen …</p>'
    : p.length ? `<ul class="doppel-l">${p.map((x) => zeileHTML(x)).join('')}</ul>`
    : '<p class="sec-lead">Gerade passt kein Paar gut zusammen.</p>';
  return `${kopfHTML('Zwei Rezepte, ein Nachmittag', '<p class="d-desc">Während das eine köchelt, schmort oder im Ofen ist, schnippelst und brätst du das andere. Die App plant, wer wann dran ist, und sagt, was gut zusammen geht.</p>')}
<section class="sec doppel-sec"><h2>Gute Paare</h2>${liste}
<p class="fine">Oder öffne ein Rezept – unter „Zwei auf einmal“ stehen die besten Partner dafür.</p></section>`;
}

/** Was gut zu wissen ist, bevor es losgeht. */
function hinweiseHTML(p) {
  const [a, b] = p.reihe;
  const h = [];
  const schneiden = gemeinsamSchneiden(a, b, app.katalog);
  if (schneiden.length) h.push(`Beide brauchen ${esc(und(schneiden))} – in einem Rutsch schälen und schneiden spart Zeit und Abwasch.`);
  if (beideReis(a, b)) h.push('Beide mit Reis: Ist der Topf groß genug, kochst du ihn zusammen – Reis und Wasser aus beiden Rezepten, die Zeit bleibt.');
  const ofen = ofenGeteilt(a, b);
  if (ofen) h.push(`Beide bei ${esc(ofen)} im Ofen – einmal vorheizen reicht.`);
  else if (p.ofen) h.push('Beide brauchen den Ofen bei verschiedener Temperatur – darum nacheinander, der Plan wartet darauf.');
  if (p.toepfe) h.push('Du brauchst zwei große Töpfe (oder Topf und Bräter).');
  if (p.reste.nutzt.length) h.push(`Weniger Reste: ${esc(und(p.reste.nutzt.map((x) => String(x.n).split(',')[0].trim())))} von der Packung brauchen beide.`);
  return h.length ? `<ul class="tips doppel-tips">${h.map((x) => `<li>${x}</li>`).join('')}</ul>` : '';
}

/** Die Schalen: welche Nummer was hat – und welche das zweite Rezept wieder nimmt. */
function bereitHTML(p) {
  const sp = p.schalen;
  const je = new Map();
  p.reihe.forEach((r, k) => (sp.schalen[k] || []).forEach((s) => {
    const x = je.get(s.n) || [];
    x.push({ k, name: s.name, gr: s.gr });
    je.set(s.n, x);
  }));
  const zeilen = [...je].sort((x, y) => x[0] - y[0]).map(([n, xs]) => `<li><span class="schale doppel-s"><b>${n}</b>${xs.map((x) => `<span class="dp-k${x.k}">${esc(x.name)}</span>`).join('<small> dann </small>')}</span><span class="schale-gr">${esc(xs[0].gr || '')}</span></li>`).join('');
  const weniger = sp.getrennt > sp.zahl ? ` <small>statt ${sp.getrennt} – was ${esc(kurz(p.reihe[0]))} schon geleert hat, nimmt ${esc(kurz(p.reihe[1]))} wieder (kurz ausspülen)</small>` : '';
  return `<div class="mise"><h3 class="sub-h">Stell dir bereit: ${sp.zahl} Schalen${weniger}</h3><ul class="schalen">${zeilen}</ul>
<p class="geraete"><b>Außerdem:</b> ${geraeteZusammen(p.reihe).map(esc).join(', ')}, Waage</p></div>`;
}

/** Die Schritte des Plans zu Blöcken: hintereinander dasselbe Rezept. */
function bloecke(p) {
  const aus = [];
  for (const [idx, s] of p.plan.schritte.entries()) {
    const b = aus[aus.length - 1];
    if (b && b.k === s.k) { b.schritte.push(idx); b.bis = Math.max(b.bis, s.bis); b.letzter = s; if (!b.phasen.includes(s.t)) b.phasen.push(s.t); continue; }
    aus.push({ k: s.k, von: s.start, bis: s.bis, schritte: [idx], phasen: [s.t], letzter: s });
  }
  return aus;
}

const VON_SELBST = [
  [/vorheizen/i, (n, d) => `Der Ofen heizt jetzt ${d} vor.`],
  [/schmoren|schmort/i, (n, d) => `${n} schmort jetzt ${d} von selbst.`],
  [/backen|im Ofen|in den Ofen/i, (n, d) => `${n} ist jetzt ${d} im Ofen.`],
  [/köcheln|kochen/i, (n, d) => `${n} köchelt jetzt ${d} von selbst.`],
  [/marinieren|kalt stellen/i, (n, d) => `${n} zieht jetzt ${d} durch.`],
  [/quellen/i, (n, d) => `${n} quillt jetzt ${d}`],
  [/ruhen/i, (n, d) => `${n} ruht jetzt ${d}`],
];
/** „Rindergulasch schmort jetzt 1 Std. 25 Min. von selbst.“ – oder '' bei kurzem Warten. */
function wartetText(r, s) {
  const lang = Math.max(s.warten, s.ruhe);
  if (lang < 8) return '';
  const d = flach(r)[s.i]?.d || '';
  const satz = VON_SELBST.find(([re]) => re.test(d))?.[1] || ((n, x) => `${n} gart jetzt ${x} von selbst.`);
  return satz(kurz(r), dauer(Math.round(lang)));
}

/** Der erste Schritt eines Blocks, kurz: mit den Mengen statt {…}, ohne „→ Schale 2“ – mit „…“, wenn mehr kommt. */
function kurzText(d, r, mehr) {
  const t = platzhalter(String(d || ''), r.items, r.weg).replace(/\s*→.*$/, '').replace(/\s+/g, ' ').trim();
  if (t.length > 64) return `${t.slice(0, 62).replace(/\s+\S*$/, '')} …`;
  return mehr ? `${t} …` : t;
}

/** Ein Rezept, wie die Texte im Plan es brauchen: mit den Schalen-Nummern des Plans. */
const mitSchalen = (p, k) => ({ ...p.reihe[k], schalen: p.schalen.schalen[k] });
const textVon = (p, k, d) => schrittText(schalenUmbenennen(d, p.schalen.nr[k]), mitSchalen(p, k));

function ablaufHTML(p) {
  const bs = bloecke(p);
  const zeilen = [];
  bs.forEach((b, j) => {
    const r = p.reihe[b.k];
    const fl = flach(r);
    const vorher = bs[j - 1];
    if (vorher && b.von - vorher.bis >= 4) zeilen.push(`<li class="ab-pause"><span class="ab-t">${uhr(vorher.bis)}</span><div class="ab-b">Pause, ${Math.round(b.von - vorher.bis)} Min. – alles läuft von selbst</div></li>`);
    const schritte = b.schritte.map((idx) => {
      const s = p.plan.schritte[idx];
      const x = fl[s.i];
      const liste = x.liste?.length ? `<span class="ab-li">${x.liste.map((l) => textVon(p, b.k, l)).join(' · ')}</span>` : '';
      return `<li>${s.drin ? '<span class="step-k">währenddessen</span>' : ''}${textVon(p, b.k, x.d)}${liste}</li>`;
    }).join('');
    const warten = wartetText(r, b.letzter);
    const zahl = b.schritte.length;
    zeilen.push(`<li class="ab-blk dp-k${b.k}"><span class="ab-t">${uhr(b.von)}</span><div class="ab-b">
<p class="ab-k"><b class="dp-r">${esc(kurz(r))}</b> <span>${esc(b.phasen.join(', '))} · ${zahl} ${zahl === 1 ? 'Schritt' : 'Schritte'}</span></p>
<details class="ab-d"><summary>${esc(kurzText(schalenUmbenennen(fl[p.plan.schritte[b.schritte[0]].i]?.d, p.schalen.nr[b.k]), r, zahl > 1))}</summary><ol class="ab-l">${schritte}</ol></details>
${warten ? `<p class="ab-w">${esc(warten)}</p>` : ''}</div></li>`);
  });
  zeilen.push(`<li class="ab-ende"><span class="ab-t">${uhr(p.plan.ende)}</span><div class="ab-b"><b>Beides fertig</b></div></li>`);
  return `<ol class="ablauf">${zeilen.join('')}</ol>`;
}

function aktionenHTML(p) {
  const st = p.reihe.map((r) => rezeptStand(app.stand, r));
  const fehlen = p.reihe.reduce((n, r) => n + einkaufsZutaten(r).filter((it) => !hatTeil(app.stand, it.k, r.id)).length, 0);
  const gesamt = st.reduce((n, x) => n + x.gesamt, 0);
  const gesperrt = app.listeDa ? '' : ' disabled';
  const liste = !gesamt ? `<span class="onlist">${ic('check')}Alles da – nichts einzukaufen</span>`
    : !fehlen ? `<span class="onlist">${ic('check')}Alles von beiden steht auf der Liste</span>`
    : `<button type="button" class="btn btn-primary" data-act="doppel-liste"${gesperrt}>${ic('list')}${fehlen < gesamt ? 'Fehlendes von beiden auf die Liste' : 'Beide auf die Einkaufsliste'}<span class="btn-n">${fehlen}</span></button>`;
  return `<div class="actions">${liste}<button type="button" class="btn km-start" data-act="doppel-kochmodus">${KOCHMODUS_IC}Kochmodus für beide</button></div>`;
}

function boxenHTML() {
  if (!halbGeht()) return '';
  const n = app.boxen || 8;
  const h = halbeBoxen();
  const chip = (halb, text) => `<button type="button" class="chip" data-doppel-halb="${halb ? 1 : 0}" aria-pressed="${!!offen.halb === halb}">${text}</button>`;
  return `<div class="doppel-boxen" role="group" aria-label="Wie viele Boxen"><span class="k">Boxen</span>${chip(false, `Je ${boxenText(n)} <small>(${2 * n} zusammen)</small>`)}${chip(true, `Je ${boxenText(h)} <small>(${2 * h} zusammen)</small>`)}</div>`;
}

function andereHTML(p) {
  const teile = [];
  for (const r of [p.a, p.b]) {
    const voll = app.nachId[r.id] || r;
    const x = partnerVon(voll);
    if (!x) { nachher(`andere:${r.id}`, () => { if (doppelOffen() && offen?.a) { partnerVon(app.nachId[r.id] || r, { rechnen: true }); zeichnen(); } }); continue; }
    const andere = x.filter((y) => ![p.a.id, p.b.id].every((id) => id === y.a.id || id === y.b.id));
    if (andere.length) teile.push(`<h3 class="sub-h">Mit ${esc(kurz(voll))} geht auch</h3><ul class="doppel-l">${andere.map((y) => zeileHTML(y, { mit: voll })).join('')}</ul>`);
  }
  return teile.length ? `<section class="sec doppel-sec"><h2>Andere Partner</h2>${teile.join('')}</section>` : '';
}

function planHTML() {
  const p = paarFuer(offen);
  if (!p) return `${kopfHTML('Zwei auf einmal', '')}<p class="sec-lead">Eins der Rezepte gibt es hier nicht mehr.</p>`;
  const [a, b] = p.reihe;
  const spart = p.spart >= MIN_SPART ? ` – spart ${esc(dauer(p.spart))}` : ' – zusammen spart das kaum Zeit';
  const unter = `<p class="d-desc">${p.warum ? esc(p.warum) : 'Wer wann dran ist, steht unten im Ablauf.'}</p>
<div class="facts"><span class="pill">zusammen ca. ${esc(dauer(p.zusammen))}</span><span class="pill">statt ${esc(dauer(p.getrennt))}${spart}</span></div>`;
  return `${kopfHTML(`<button type="button" class="linkbtn dp-r dp-k0" data-open="${esc(a.id)}">${esc(kurz(a))}</button> + <button type="button" class="linkbtn dp-r dp-k1" data-open="${esc(b.id)}">${esc(kurz(b))}</button>`, unter)}
${boxenHTML()}
${aktionenHTML(p)}
${hinweiseHTML(p)}
<section class="sec doppel-sec"><h2>Ablauf <small>Minuten ab Start</small></h2>
${bereitHTML(p)}
${ablaufHTML(p)}
<p class="fine">Die Zeiten sind geschätzt – aus den Schritten beider Rezepte${tempoGelernt().proben ? ' und deinem Tempo' : ''}. Abgehakt wird im Kochmodus wie im Rezept selbst; dein Tempo lernt das Handy nur, wenn du ein Rezept allein kochst.</p></section>
${andereHTML(p)}`;
}

let gezeichnet = '';
function zeichnen() {
  const el = $('#doppel');
  if (!el || el.hidden || !offen) return;
  // Aufgeklappte Blöcke im Ablauf bleiben auf, wenn sich nur die Liste geändert hat
  const was = `${offen.a}|${offen.b}|${offen.halb}`;
  const auf = was === gezeichnet ? [...el.querySelectorAll('.ab-d')].map((x, i) => (x.open ? i : -1)).filter((i) => i >= 0) : [];
  el.innerHTML = offen.a ? planHTML() : uebersichtHTML();
  gezeichnet = was;
  const ds = el.querySelectorAll('.ab-d');
  for (const i of auf) if (ds[i]) ds[i].open = true;
}

/* --------------------------------------------------------- Aktionen */

/** Beide auf die Liste – mit den Mengen des Plans (je halbe Boxen: die Hälfte), eine Meldung. */
function aufDieListe(p) {
  const ops = [];
  let n = 0;
  for (const r of p.reihe) {
    app.kiVorAktion?.(r.id);
    const fehlen = einkaufsZutaten(r).filter((it) => !hatTeil(app.stand, it.k, r.id));
    ops.push(...fehlen.map((it) => opTeil(it.k, r.id, { q: it.q, u: it.u, h: it.h || '' }, it.kat || app.katalog[it.k])));
    n += fehlen.length;
  }
  if (!ops.length) return;
  app.aendern(ops);
  melde(`${kurz(p.reihe[0])} und ${kurz(p.reihe[1])}: ${n} ${n === 1 ? 'Zutat' : 'Zutaten'} auf der Liste`,
    istSchmal() && ansicht.tab !== 'einkauf' ? { knopf: 'Zur Liste', art: 'zur-liste', beiKnopf: () => zeigeReiter('einkauf') } : {});
}

/** Der Kochmodus für beide: ein Rezept aus den Schritten des Plans, abgehakt wird im jeweiligen Rezept. */
function kochmodusBeide(p) {
  const [a, b] = p.reihe;
  const fl = p.reihe.map(flach);
  const plan = p.plan.schritte;
  const schritte = plan.map((s) => {
    const x = fl[s.k][s.i];
    return { ...x, d: schalenUmbenennen(x.d, p.schalen.nr[s.k]), liste: x.liste?.map((l) => schalenUmbenennen(l, p.schalen.nr[s.k])), neben: s.drin };
  });
  const rezept = { id: `doppel:${a.id}+${b.id}`, name: `${kurz(a)} + ${kurz(b)}`, short: `${kurz(a)} + ${kurz(b)}`, ablauf: [{ t: 'Zwei auf einmal', schritte }] };
  const orig = (j) => ({ s: plan[j], r: p.reihe[plan[j].k], x: fl[plan[j].k][plan[j].i] });
  const fertig = () => new Set(plan.map((s, j) => (schritteVon(s.rid).has(s.i) ? j : -1)).filter((j) => j >= 0));
  const naechsterAnderer = (j) => { const s = plan[j]; for (let q = j + 1; q < plan.length; q++) if (!plan[q].drin) return plan[q].k !== s.k ? p.reihe[plan[q].k] : null; return null; };
  kochmodusOeffnen({
    rezept,
    fertig,
    text: (s, j) => schrittText(s.d, mitSchalen(p, plan[j].k)),
    marke: (j) => `<span class="km-von dp-k${plan[j].k}">${esc(kurz(p.reihe[plan[j].k]))}</span><span class="km-phase">${esc(plan[j].t)}</span>`,
    punkt: (j) => `dp-k${plan[j].k}`,
    hinweis: (j) => {
      const { s, r } = orig(j);
      const w = wartetText(r, s);
      if (!w) return '';
      const weiter = naechsterAnderer(j);
      return `${esc(w)}${weiter ? ` Weiter mit ${esc(kurz(weiter))}.` : ''}`;
    },
    minuten: (j) => { const { x, r, s } = orig(j); return x && !planVon(x) ? zeitFuer(r).schritte[s.i]?.min ?? x.min : null; },
    umschalten: (j, an) => {
      const { s, r } = orig(j);
      const zahl = flach(r).length;
      const vorher = schritteVon(s.rid).size;
      schrittUmschalten(s.rid, s.i, an, { tempo: false, lob: false });
      if (!an || vorher >= zahl || schritteVon(s.rid).size < zahl) return;
      const anderes = p.reihe[1 - s.k];
      if (schritteVon(anderes.id).size >= flach(anderes).length) lobGross({ rezept, name: app.name(), grund: 'fertig' });
      else melde(`${kurz(r)} ist fertig – weiter mit ${kurz(anderes)}.`);
    },
    timerKnopf: (rid, s, j) => { const o = orig(j); return timerKnopf(o.s.rid, o.x, o.s.i); },
    timerUmschalten: (x, s, j) => { const o = orig(j); timerUmschalten(app.nachId[o.s.rid] || o.r, o.x, o.s.i); },
    timerZu: (t) => plan.findIndex((s) => s.rid === t.rid && s.i === t.schritt),
    beimSchliessen: () => doppelNeu(),
  });
}

/** Klicks. true, wenn es hierher gehörte. */
export function klickDoppel(el) {
  const d = el.dataset;
  if (d.doppel) {
    const [a, b] = d.doppel.split(' ');
    // Aus dem Rezept: zurück geht es dorthin; aus dem Plan: dorthin, woher der kam
    oeffneDoppel(a, b, { von: doppelOffen() ? offen?.von || '' : offenesRezept() || '' });
    return true;
  }
  if (d.doppelHalb !== undefined) {
    if (!offen) return true;
    offen.halb = d.doppelHalb === '1';
    zeichnen();
    return true;
  }
  switch (d.act) {
    case 'doppel': oeffneDoppel(); return true;
    case 'doppel-zu': schliesseDoppel(); return true;
    case 'doppel-liste': { const p = offen?.a ? paarFuer(offen) : null; if (p) aufDieListe(p); return true; }
    case 'doppel-kochmodus': { const p = offen?.a ? paarFuer(offen) : null; if (p) kochmodusBeide(p); return true; }
    default: return false;
  }
}

app.doppelKarte = doppelKarteZeichnen;
