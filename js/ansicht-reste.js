/*
 * Was von den Packungen übrig bleibt (gerechnet in reste.js) – damit möglichst
 * nichts im Müll landet:
 *
 *   - im Rezept bei den Zutaten (#d-reste): „Bleibt übrig: 375 g Rinderhack
 *     von 500 g“ – mit dem, was schon auf der Liste steht
 *   - auf der Einkaufsliste unten (#l-reste): alles zusammen, über alle Rezepte
 *
 * Darunter die Rezepte, die die Reste am meisten aufbrauchen (bis zu drei,
 * eins nach dem anderen gerechnet), mit „Auf die Liste“; beim Fleisch der
 * Tipp mit der Theke und dem Einfrieren; mit KI-Schlüssel ein Rezept aus den
 * Resten (ansicht-ki.js, über app.kiAusResten).
 */
import { app, $, melde, zeigeReiter } from './kern.js';
import { esc, bruch, menge } from './format.js';
import { euro } from './kosten.js';
import { restePlan, postenDerListe, postenVon } from './reste.js';
import { rezepteAufListe, hatTeil, einkaufsZutaten, opTeil } from './liste.js';
import { ladeKi } from './zugang.js';

const daten = () => ({ preise: app.preise, naehrwerte: app.naehrwerte, katalog: app.katalog });
/** „Mais, Dose à 425 ml“ → „Mais“ */
const kurz = (n) => String(n || '').split(',')[0].trim();
/** Zahl und Einheit bleiben zusammen: „¼ Dose“ bricht nicht um */
const fest = (t) => String(t).replace(/([\d½¼¾⅛⅓⅔]) (?=\S)/g, '$1\u00a0');
/** „375 g Rinderhackfleisch“, „¾ Zucchini“, „¾ Dose Mais“ */
const mengeText = (q, u, n) => `${fest(u === 'Stk' ? bruch(q) : menge(q, u))} ${kurz(n)}`;
/** Was abgelehnt ist (Daumen runter), schlägt die App nicht vor. */
const runter = () => Object.entries(app.stand.bewertung || {}).filter(([, b]) => b?.wert === 'runter').map(([rid]) => rid);

function restZeile(x) {
  const von = x.u === 'g' || x.u === 'ml' ? ` <small>von ${x.packs > 1 ? `${x.packs}\u00a0×\u00a0` : ''}${esc(fest(menge(x.pack, x.u)))}</small>` : '';
  return `<li><b>${esc(fest(x.u === 'Stk' ? bruch(x.rest) : menge(x.rest, x.u)))}</b> ${esc(kurz(x.n))}${von}</li>`;
}

function planHTML(p, { mitRezept = '' } = {}) {
  if (!p.plan.length) return '';
  const knopf = mitRezept ? 'Beide auf die Liste' : 'Auf die Liste';
  const zeilen = p.plan.map((e) => `<li class="reste-r"><span class="reste-r-t"><button type="button" class="linkbtn reste-r-n" data-open="${esc(e.id)}">${esc(e.short)}</button><small>braucht ${esc(e.nutzt.map((x) => mengeText(x.q, x.u, x.n)).join(', '))}</small></span><button type="button" class="btn reste-dazu" data-reste-dazu="${esc([mitRezept, e.id].filter(Boolean).join(' '))}"${app.listeDa ? '' : ' disabled'}>${knopf}</button></li>`).join('');
  const mit = p.plan.length === 1 ? 'Damit' : p.plan.length === 2 ? 'Mit beiden' : 'Mit allen dreien';
  const danach = p.danach < 0.3 ? `${mit} bleibt fast nichts übrig.` : `${mit} bleiben noch Reste für ≈ ${euro(p.danach)}.`;
  const alle = p.plan.length > 1 ? ` <button type="button" class="linkbtn" data-reste-dazu="${esc([mitRezept, ...p.plan.map((e) => e.id)].filter(Boolean).join(' '))}"${app.listeDa ? '' : ' disabled'}>Alle ${p.plan.length + (mitRezept ? 1 : 0)} auf die Liste</button>` : '';
  return `<p class="reste-k">Aufbrauchen mit</p><ul class="reste-plan">${zeilen}</ul>
<p class="fine">${danach}${alle}</p>`;
}

/** Fleisch: an der Theke genau die Menge – sonst einfrieren. */
function fleischHTML(p, gebraucht) {
  const fleisch = p.reste.filter((x) => x.art === 'fleisch');
  if (!fleisch.length) return '';
  const genau = gebraucht ? fleisch.map((x) => mengeText(x.q, x.u, x.n)).join(' und ') : '';
  return `<p class="fine reste-fleisch">${genau ? `An der Fleischtheke bekommst du genau ${esc(genau)}.` : 'An der Fleischtheke bekommst du genau die Menge.'} Sonst den Rest gleich roh einfrieren – portionsweise und flach im Beutel, dann taut er schnell.</p>`;
}

function kiHTML(p, wo) {
  if (!ladeKi() || !app.kiAusResten || !p.reste.length) return '';
  return `<button type="button" class="btn reste-ki" data-act="reste-ki" data-wo="${wo}">Aus den Resten ein Rezept (KI)</button>`;
}

function karteHTML(p, { wo, titel, unter, mitRezept = '', gebraucht = true }) {
  const wert = p.wert >= 0.1 ? ` · ≈ ${euro(p.wert)} wert` : '';
  return `<h3 class="sub-h">${titel} <small>${esc(unter)}${wert}</small></h3>
<ul class="reste-l">${p.reste.map(restZeile).join('')}</ul>
${planHTML(p, { mitRezept })}
${fleischHTML(p, gebraucht)}
${kiHTML(p, wo)}`;
}

// Was zuletzt gezeigt wurde – das bekommt die KI
const zuletzt = { rezept: [], liste: [] };

// Abhaken ändert nichts an den Resten: dieselben Posten, dieselben Rezepte – dasselbe Ergebnis
const gemerkt = {};
function planFuer(wo, posten, ohne) {
  // Die Preise rechnet app.js bei jeder Änderung neu – gleich bleiben sie mit denselben Bons
  const schluessel = JSON.stringify([posten, ohne, app.stand.bons || {}]);
  const g = gemerkt[wo];
  if (g && g.rezepte === app.rezepte && g.schluessel === schluessel) return g.p;
  const p = restePlan(posten, app.rezepte, daten(), { ohne });
  gemerkt[wo] = { rezepte: app.rezepte, schluessel, p };
  return p;
}

/** Im Rezept: was übrig bleibt – mit dem, was schon auf der Liste steht. */
export function resteRezeptZeichnen(rid) {
  const el = $('#d-reste');
  if (!el) return;
  const r = app.nachId[rid];
  const eigene = r ? postenVon(r) : [];
  if (!eigene.length) { el.hidden = true; el.innerHTML = ''; return; }
  const ks = new Set(eigene.map((x) => `${x.k}|${x.u}`));
  const andere = app.listeDa ? postenDerListe(app.stand, [rid]) : [];
  const auchAndere = andere.some((x) => ks.has(`${x.k}|${x.u}`));
  const aufListe = app.listeDa ? rezepteAufListe(app.stand) : [];
  const plan = planFuer('rezept', [...andere.filter((x) => ks.has(`${x.k}|${x.u}`)), ...eigene], [rid, ...aufListe, ...runter()]);
  if (!plan.reste.length) { el.hidden = true; el.innerHTML = ''; return; }
  // Gebraucht wird, was dieses Rezept braucht (die Theke): die Menge daraus
  const p = { ...plan, reste: plan.reste.map((x) => ({ ...x, q: eigene.filter((z) => z.k === x.k && z.u === x.u).reduce((s, z) => s + z.q, 0) })) };
  zuletzt.rezept = p.reste;
  const drauf = aufListe.includes(rid);
  el.hidden = false;
  el.innerHTML = karteHTML(p, { wo: 'rezept', titel: 'Bleibt übrig', unter: auchAndere ? 'mit dem, was schon auf der Liste steht' : 'von den Packungen', mitRezept: drauf ? '' : rid, gebraucht: !auchAndere });
}

/** Auf der Einkaufsliste: alles zusammen. */
export function resteListeZeichnen() {
  const el = $('#l-reste');
  if (!el) return;
  const posten = app.listeDa ? postenDerListe(app.stand) : [];
  const p = posten.length ? planFuer('liste', posten, [...rezepteAufListe(app.stand), ...runter()]) : { reste: [] };
  if (!p.reste.length) { el.hidden = true; el.innerHTML = ''; return; }
  zuletzt.liste = p.reste;
  el.hidden = false;
  el.innerHTML = karteHTML(p, { wo: 'liste', titel: 'Bleibt übrig', unter: 'von den Packungen', gebraucht: false });
}

/** Rezepte auf die Liste – mehrere auf einmal, eine Meldung. */
function aufDieListe(rids) {
  const ops = [];
  const namen = [];
  let n = 0;
  for (const rid of rids) {
    const r = app.nachId[rid];
    if (!r) continue;
    app.kiVorAktion?.(rid);
    const fehlen = einkaufsZutaten(r).filter((it) => !hatTeil(app.stand, it.k, rid));
    if (!fehlen.length) continue;
    ops.push(...fehlen.map((it) => opTeil(it.k, rid, { q: it.q, u: it.u, h: it.h || '' }, it.kat || app.katalog[it.k])));
    namen.push(r.short || r.name);
    n += fehlen.length;
  }
  if (!ops.length) return;
  app.aendern(ops);
  melde(`${namen.length > 1 ? `${namen.slice(0, -1).join(', ')} und ${namen.at(-1)}` : namen[0]}: ${n} ${n === 1 ? 'Zutat' : 'Zutaten'} auf der Liste`);
}

/** „375 g Rinderhackfleisch, ¾ Dose Mais“ – für die KI */
const kiText = (reste) => `Reste von den Packungen: ${reste.map((x) => mengeText(x.rest, x.u, x.n)).join(', ')}`;

export function klickReste(el) {
  if (el.dataset.resteDazu) { aufDieListe(el.dataset.resteDazu.split(' ').filter(Boolean)); return true; }
  if (el.dataset.act === 'reste-ki') {
    const reste = zuletzt[el.dataset.wo === 'liste' ? 'liste' : 'rezept'];
    if (!reste?.length || !app.kiAusResten) return true;
    zeigeReiter('rezepte');
    app.kiAusResten(kiText(reste));
    return true;
  }
  return false;
}
