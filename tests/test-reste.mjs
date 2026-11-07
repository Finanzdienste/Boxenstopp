/*
 * Was von den Packungen übrig bleibt: die Rechnung (js/reste.js, direkt in
 * Node) – Packungen, was schnell verdirbt, welche Rezepte die Reste
 * aufbrauchen – und im Browser: im Rezept bei den Zutaten, auf der Liste,
 * „Beide auf die Liste“, ein KI-Rezept aus den Resten.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, handy, githubAttrappe, starteBrowser, bis } from './hilfe.mjs';
import { leer, anwenden, opTeil, opEigener } from '../js/liste.js';
import { aufBoxen } from '../js/boxen.js';
import { packungFuer, restVon, resteVon, restWert, restePlan, postenVon, postenDerListe, verdirbt } from '../js/reste.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const d = { preise: daten.preise, naehrwerte: daten.naehrwerte, katalog: daten.katalog };
const fuer = (n) => daten.rezepte.map((r) => aufBoxen(r, n, { katalog: daten.katalog }));
const zwei = fuer(2);
const nach = (liste, id) => liste.find((r) => r.id === id);
const rest = (liste, k) => liste.find((x) => x.k === k);

/* ------------------------------------------------------------ Packungen */

check(packungFuer('rinderhack', 'g', ['1 × 500 g'], d) === 500 && packungFuer('haehnchenbrust', 'g', ['2 × 400 g', '1 × 500 g'], d) === 400 && packungFuer('skyr', 'g', [], d) === 500, 'Packung: aus dem Hinweis (die kleinste), sonst der Richtpreis (Skyr 500 g)');
check(packungFuer('staudensellerie', 'Stange', [], d) === 8 && packungFuer('paprika', 'Stk', [], d) === 1 && packungFuer('kidney', 'Dose', [], d) === 1 && packungFuer('tomaten', 'g', [], d) === null, 'Packung: Staudensellerie im Bund (8 Stangen), Paprika einzeln, eine Dose – lose Tomaten haben keine');
check(verdirbt('rinderhack', d.katalog) && verdirbt('schlagsahne', d.katalog) && verdirbt('kidney', d.katalog) && verdirbt('spinat', d.katalog) && !verdirbt('zwiebeln', d.katalog) && !verdirbt('parmesan', d.katalog) && !verdirbt('milch', d.katalog) && !verdirbt('currypaste', d.katalog), 'Verdirbt: Fleisch, Sahne, offene Dosen, Spinat – nicht Zwiebeln, Parmesan, Milch, Currypaste');
const sahne = (q) => resteVon([{ k: 'schlagsahne', q, u: 'g', h: '' }], d);
check(sahne(190).length === 0 && rest(sahne(150), 'schlagsahne')?.rest === 50 && rest(restVon([{ k: 'schlagsahne', q: 190, u: 'g' }], d), 'schlagsahne').rest === 10, 'Ein Krümel zählt nicht: 10 g Sahne von 200 g nicht, 50 g schon');
check(rest(restVon([{ k: 'rinderhack', q: 125, u: 'g', h: '1 × 500 g' }, { k: 'rinderhack', q: 125, u: 'g', h: '1 × 500 g' }], d), 'rinderhack').rest === 250 && rest(restVon([{ k: 'rinderhack', q: 600, u: 'g', h: '2 × 500 g' }], d), 'rinderhack').packs === 2, 'Gleiche Zutat zusammen: 2 × 125 g von 500 g lassen 250 g, 600 g brauchen zwei Packungen');

/* --------------------------------------------------------- im Rezept */

const chili2 = nach(zwei, 'chili');
const r2 = resteVon(postenVon(chili2), d);
check(rest(r2, 'rinderhack')?.rest === 375 && rest(r2, 'rinderhack').pack === 500 && rest(r2, 'rinderhack-mager')?.rest === 300 && rest(r2, 'kidney')?.rest === 0.5, `Chili für 2: 375 g Rinderhack von 500 g, 300 g mageres, ½ Dose Kidneybohnen bleiben (≈ ${restWert(postenVon(chili2), d).toFixed(2)} €)`);
check(!rest(r2, 'zwiebeln') && !rest(r2, 'knoblauch') && !rest(r2, 'paprika') && r2.every((x, i) => i === 0 || r2[i - 1].wert >= x.wert), 'Keine Zwiebeln, kein Knoblauch, keine Paprika (die ist ganz) – das Teuerste zuerst');
check(resteVon(postenVon(nach(daten.rezepte, 'chili')), d).length === 0, 'Chili für 8: nichts bleibt übrig – das Rezept ist auf Packungen gebaut');
const koett8 = resteVon(postenVon(nach(daten.rezepte, 'koettbullar')), d);
check(rest(koett8, 'rinderhack-mager')?.rest === 300, 'Köttbullar für 8: 300 g mageres Hack bleiben (2 × 400 g für 500 g)');

/* ----------------------------------------------------------- der Plan */

const plan = restePlan(postenVon(chili2), zwei, d, { ohne: ['chili'] });
check(plan.plan.length >= 1 && plan.plan.every((e) => e.id !== 'chili' && e.spart >= 0.3 && e.nutzt.length > 0) && plan.danach < plan.wert, `Plan: ${plan.plan.map((e) => e.short).join(', ')} – von ${plan.wert.toFixed(2)} € auf ${plan.danach.toFixed(2)} €`);
const zusammen = [...postenVon(chili2), ...plan.plan.flatMap((e) => postenVon(nach(zwei, e.id)))];
check(Math.abs(restWert(zusammen, d) - plan.danach) < 0.01 && plan.plan[0].nutzt.some((x) => rest(plan.reste, x.k)), 'Was danach bleibt, ist nachgerechnet – und das erste Rezept braucht wirklich etwas davon');
const ohneErstes = restePlan(postenVon(chili2), zwei, d, { ohne: ['chili', plan.plan[0].id] });
check(!ohneErstes.plan.some((e) => e.id === plan.plan[0].id), 'Was ausgenommen ist (auf der Liste, Daumen runter), wird nicht vorgeschlagen');
check(restePlan([], zwei, d).plan.length === 0 && restePlan(postenVon(nach(daten.rezepte, 'chili')), daten.rezepte, d).plan.length === 0, 'Ohne Reste kein Plan');

/* ---------------------------------------------------------- die Liste */

let stand = leer();
for (const it of postenVon(chili2)) stand = anwenden(stand, opTeil(it.k, 'chili', { q: it.q, u: it.u, h: it.h }, daten.katalog[it.k]));
stand = anwenden(stand, opTeil('rinderhack', 'x-amy', { q: 250, u: 'g', h: '' }, daten.katalog.rinderhack));
stand = anwenden(stand, opEigener('c-bananen', 'Bananen', 'obst'));
const lp = postenDerListe(stand);
check(lp.filter((x) => x.k === 'rinderhack').reduce((s, x) => s + x.q, 0) === 375 && !lp.some((x) => x.k === 'c-bananen') && rest(resteVon(lp, d), 'rinderhack').rest === 125, 'Liste: was jemand dazu will, zählt mit (125 + 250 g → 125 g übrig), eigene Einträge nicht');
check(!postenDerListe(stand, ['chili']).some((x) => x.k === 'kidney'), 'Liste ohne ein Rezept: dessen Teile fallen weg');

/* ------------------------------------------------------------ Browser */

const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const KI_SCHLUESSEL = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const browser = await starteBrowser();
const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
mar.zustand.datei = JSON.stringify({ ...leer(), rev: 1, profil: { person: 'Marielle', farbe: 'lila', boxen: 2 }, leute: { marielle: 'Marielle' } });
mar.zustand.version = 1;
mar.zustand.sha = 'sha1';
const marielle = await handy(browser, { attrappe: mar });
const m = marielle.page;
const anfragen = [];
await marielle.ctx.route('https://generativelanguage.googleapis.com/**', async (r) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  anfragen.push(r.request().postData() || '');
  return r.fulfill({ status: 503, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } }) });
});
await m.evaluate((k) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle' })); localStorage.setItem('boxenstopp.willkommen.v1', 'true'); }, M_KEY);
await m.reload();
await m.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await m.locator('#sync-text').innerText()) === 'Gespeichert'), 'Marielle: an ihrer Liste, für 2 Boxen');
await m.click('[data-open="chili"]');
const karte = m.locator('#d-reste');
check(await bis(() => karte.isVisible()), 'Chili: „Bleibt übrig“ bei den Zutaten');
const lesen = async (el) => (await el.innerText()).replace(/\u00a0/g, ' ');
let text = await lesen(karte);
check(text.includes('375 g') && text.includes('Rinderhackfleisch') && text.includes('von 500 g') && text.includes('½ Dose') && text.includes('Kidneybohnen') && !text.includes('Zwiebel'), 'Darin: 375 g Rinderhackfleisch von 500 g, ½ Dose Kidneybohnen – keine Zwiebeln');
check(text.includes('Aufbrauchen mit') && text.includes('Beide auf die Liste') && text.includes('An der Fleischtheke bekommst du genau 125 g Rinderhackfleisch'), 'Ein Rezept, das es aufbraucht („Beide auf die Liste“), und der Tipp mit der Theke: genau 125 g');
check(!text.includes('Aus den Resten ein Rezept'), 'Ohne KI-Schlüssel kein KI-Knopf');
const vorschlag = await karte.locator('[data-reste-dazu]').first().getAttribute('data-reste-dazu');
const [, zweites] = vorschlag.split(' ');
check(vorschlag.startsWith('chili ') && !!zweites, `„Beide“: Chili und ${zweites}`);
await karte.locator('[data-reste-dazu]').first().click();
const liste = () => mar.liste()?.items || {};
check(await bis(() => liste().rinderhack?.parts?.chili?.q === 125 && Object.values(liste()).some((x) => x.parts?.[zweites])), 'Beide stehen auf der Liste');
const toast = await m.locator('#toast').innerText();
check(/^Chili[^:]* und [^:]+: \d+ Zutaten auf der Liste/.test(toast), `Meldung: „${toast}“`);
check(await bis(async () => (await lesen(karte)).includes('mit dem, was schon auf der Liste steht')), 'Danach rechnet die Karte mit der Liste');
// Auf der Liste: alles zusammen
await m.click('.tabbar .tab[data-tab="einkauf"]');
const lkarte = m.locator('#l-reste');
check(await bis(() => lkarte.isVisible()), 'Auf der Liste unten: „Bleibt übrig“');
const wert = async () => Number(((await lesen(lkarte)).match(/≈ (\d+,\d+) €/) || [])[1]?.replace(',', '.'));
const vorher = await wert();
text = await lesen(lkarte);
check(vorher > 0 && text.includes('Rinderhackfleisch') && text.includes('An der Fleischtheke bekommst du genau die Menge'), `Darin die Reste aller Rezepte (≈ ${vorher} €) und der Tipp mit der Theke`);
if (await lkarte.locator('[data-reste-dazu]').count()) {
  await lkarte.locator('[data-reste-dazu]').first().click();
  check(await bis(async () => (await wert()) < vorher || !(await lkarte.isVisible())), 'Noch ein Rezept dazu: es bleibt weniger übrig');
} else check(true, 'Kein weiteres Rezept spart noch etwas');
// Mit KI-Schlüssel: ein Rezept aus den Resten
await m.evaluate((k) => localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: k })), KI_SCHLUESSEL);
await m.reload();
await m.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await m.click('.tabbar .tab[data-tab="einkauf"]');
check(await bis(() => lkarte.locator('[data-act="reste-ki"]').isVisible()), 'Mit KI-Schlüssel: „Aus den Resten ein Rezept (KI)“');
await lkarte.locator('[data-act="reste-ki"]').click();
check(await bis(() => m.locator('#reste').isVisible()) && (await m.locator('#k-text').inputValue()).startsWith('Reste von den Packungen: '), 'Die Resteverwertung öffnet, die Reste stehen drin');
check(await bis(() => anfragen.length === 1) && anfragen[0].includes('Reste von den Packungen') && anfragen[0].includes('Rinderhackfleisch'), 'Und die KI bekommt sie');
check(marielle.fehler.length === 0, `Keine Fehler im Browser (${marielle.fehler.join(' | ')})`);
await marielle.ctx.close();
// Tobi und Amy, 8 Boxen: beim Chili bleibt nichts, bei Köttbullar Hack
const tobi = await handy(browser);
await tobi.page.click('[data-open="chili"]');
check(await tobi.page.locator('#d-reste').isHidden(), 'Für 8 Boxen: beim Chili keine Karte');
await tobi.page.click('#detail [data-act="zurueck"]');
await tobi.page.click('[data-open="koettbullar"]');
check(await bis(() => tobi.page.locator('#d-reste').isVisible()) && (await lesen(tobi.page.locator('#d-reste'))).includes('300 g Rinderhackfleisch mager'), 'Köttbullar für 8: 300 g mageres Hack bleiben übrig');
check(tobi.fehler.length === 0, `Tobi: keine Fehler im Browser (${tobi.fehler.join(' | ')})`);
await tobi.ctx.close();
await browser.close();

ende();
