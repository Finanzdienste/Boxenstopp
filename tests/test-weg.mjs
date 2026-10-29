/*
 * Der Weg durch den Laden: erst in Node (js/weg.js, die Änderungen in
 * liste.js), dann im Browser – im Laden abhaken, und beim nächsten Einkauf
 * steht die Liste in dieser Reihenfolge.
 */
import { pruefer, starteBrowser, handy, bis } from './hilfe.mjs';
import { wegStellen, wegWerte, nachWeg, wegSchluessel, REIHE, MIN_HAKEN } from '../js/weg.js';
import { leer, anwenden, bereinigen, opWeg, opWegVergessen, opZusammen, opTeil, opEigener } from '../js/liste.js';

const { check, ende } = pruefer();

// --- Stellen aus den Haken eines Einkaufs
check(wegStellen([['a', 'obst', 1], ['b', 'kuehl', 2]]).length === 0 && MIN_HAKEN === 3, 'weniger als drei Haken: kein Einkauf');
const st = wegStellen([['kidney', 'konserven', 10], ['zwiebeln', 'obst', 30], ['rinderhack', 'fleisch', 20], ['zwiebeln', 'obst', 31], ['n:bananen', 'obst', 40]]);
check(JSON.stringify(st.map((x) => [x.k, x.p])) === JSON.stringify([['kidney', 0], ['rinderhack', 0.33], ['zwiebeln', 0.67], ['n:bananen', 1]]), `nach der Zeit sortiert, doppelte einmal, 0 bis 1 (${JSON.stringify(st.map((x) => [x.k, x.p]))})`);
check(wegSchluessel('c-abc123', { name: 'Bananen', custom: true }) === 'n:bananen' && wegSchluessel('zwiebeln', { name: 'Zwiebeln' }) === 'zwiebeln', 'eigene Einträge erkennt der Weg am Namen');

// --- Werte: gemessen und die übliche Reihenfolge, gemischt
const ohne = wegWerte(null);
check(ohne.abteilung('obst') === 0 && ohne.abteilung('sonstiges') === 1 && ohne.abteilung('fleisch') < ohne.abteilung('trocken'), 'ohne Messung: die übliche Reihenfolge');
const w = wegWerte({ n: 1, k: { kidney: { c: 'konserven', p: [0] }, rinderhack: { c: 'fleisch', p: [0.5] }, zwiebeln: { c: 'obst', p: [1] } } });
check(w.abteilung('konserven') < w.abteilung('fleisch') && w.abteilung('fleisch') < w.abteilung('obst'), `ein Einkauf: Konserven vor Fleisch vor Obst (${['konserven', 'fleisch', 'obst'].map((c) => w.abteilung(c).toFixed(2)).join(' < ')})`);
check(w.zutat('kidney', 'konserven') < w.zutat('mais', 'konserven') || w.zutat('kidney', 'konserven') <= w.abteilung('konserven'), 'eine gemessene Zutat steht vor den ungemessenen ihrer Abteilung');

// --- Die Liste nach dem Weg
let s = leer();
s = anwenden(s, [
  opTeil('zwiebeln', 'chili', { q: 300, u: 'g', h: '' }, { n: 'Zwiebeln', c: 'obst' }),
  opTeil('rinderhack', 'chili', { q: 500, u: 'g', h: '' }, { n: 'Rinderhackfleisch', c: 'fleisch' }),
  opTeil('kidney', 'chili', { q: 2, u: 'Dose', h: '' }, { n: 'Kidneybohnen', c: 'konserven' }),
  opTeil('mais', 'chili', { q: 1, u: 'Dose', h: '' }, { n: 'Mais', c: 'konserven' }),
  opEigener('c-x1', 'Bananen', 'obst'),
]);
const kat = { zwiebeln: { n: 'Zwiebeln', c: 'obst' }, rinderhack: { n: 'Rinderhackfleisch', c: 'fleisch' }, kidney: { n: 'Kidneybohnen', c: 'konserven' }, mais: { n: 'Mais', c: 'konserven' } };
s = anwenden(s, opWeg('Aldi', [{ k: 'kidney', c: 'konserven', p: 0 }, { k: 'rinderhack', c: 'fleisch', p: 0.5 }, { k: 'n:bananen', c: 'obst', p: 0.8 }, { k: 'zwiebeln', c: 'obst', p: 1 }], 'Tobi'));
const g = nachWeg(s, kat, s.wege.Aldi);
check(JSON.stringify(g.map((x) => x.bereich.id)) === JSON.stringify(['konserven', 'fleisch', 'obst']) && JSON.stringify(g[0].eintraege.map(([k]) => k)) === JSON.stringify(['kidney', 'mais']) && JSON.stringify(g[2].eintraege.map(([k]) => k)) === JSON.stringify(['c-x1', 'zwiebeln']), `sortiert nach dem Weg: ${g.map((x) => `${x.bereich.name}: ${x.eintraege.map(([, d]) => d.name).join(', ')}`).join(' | ')}`);
check(g[0].bereich.name === 'Konserven' && REIHE.includes('tk'), 'mit den Namen der Abteilungen');

// --- Im Stand: dazulegen, höchstens fünf Messungen, vergessen, bereinigen
for (let i = 0; i < 6; i++) s = anwenden(s, opWeg('Aldi', [{ k: 'kidney', c: 'konserven', p: 0.1 * i }, { k: 'mais', c: 'konserven', p: 0.2 }, { k: 'zwiebeln', c: 'obst', p: 0.9 }], 'Amy'));
check(s.wege.Aldi.n === 7 && s.wege.Aldi.k.kidney.p.length === 5 && s.wege.Aldi.k.kidney.p.at(-1) === 0.5, `sieben Einkäufe, je Zutat die letzten fünf (${JSON.stringify(s.wege.Aldi.k.kidney.p)})`);
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).wege) === JSON.stringify(s.wege), 'übersteht Speichern und Bereinigen');
check(!bereinigen({ wege: { '<script>': { n: 1, k: {} }, Lidl: { n: 1, k: { 'a b': { c: 'x', p: [0.2] }, ok: { c: 'obst', p: [2, 0.3] } } } } }).wege['<script>'] && JSON.stringify(bereinigen({ wege: { Lidl: { n: 1, k: { 'a b': { c: 'x', p: [0.2] }, ok: { c: 'obst', p: [2, 0.3] } } } } }).wege.Lidl.k) === JSON.stringify({ ok: { c: 'obst', p: [0.3] } }), 'Unsinn fällt weg');
const wieder = anwenden(anwenden(s, opWegVergessen('Aldi')), opZusammen({}, {}, { wege: { Aldi: s.wege.Aldi } }));
check(JSON.stringify(wieder.wege.Aldi) === JSON.stringify(s.wege.Aldi) && !anwenden(s, opWegVergessen('Aldi')).wege.Aldi, 'vergessen – und mit zusammen wieder da (Rückgängig)');

// --- Im Browser
const browser = await starteBrowser();
const { page, fehler } = await handy(browser);
await page.click('[data-open="chili"]');
await page.click('#detail [data-act="alle-dazu"]');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await page.locator('#l-laden').isVisible())) && (await page.locator('#l-laden-info').innerText()).startsWith('Wähl den Laden'), 'über der Liste: „Wähl den Laden, in dem du einkaufst“');
const bereiche = () => page.$$eval('#list-body .grp:not(.grp-done)', (gs) => gs.map((x) => x.dataset.bereich));
check(JSON.stringify(await bereiche()) === JSON.stringify(['frisch', 'tierisch', 'trocken']), 'ohne Weg: die übliche Reihenfolge (Frisches, Tierisches, Trockenes)');
await page.selectOption('#l-laden-wahl', 'Aldi');
check((await page.locator('#l-laden-info').innerText()).startsWith('Hak in der Reihenfolge ab') && (await page.locator('.tab[data-tab="angebote"]').count()) === 1, 'Aldi gewählt: „Hak in der Reihenfolge ab, in der du durch den Laden gehst“');
// Bei Aldi: erst die Konserven, dann das Fleisch, dann Obst und Gemüse
const zeilen = await page.$$eval('#list-body .grp:not(.grp-done) .item', (xs) => xs.map((x) => ({ k: x.querySelector('[data-check]').dataset.check, b: x.closest('.grp').dataset.bereich })));
const weg = [...zeilen.filter((x) => x.b === 'trocken'), ...zeilen.filter((x) => x.b === 'tierisch'), ...zeilen.filter((x) => x.b === 'frisch')];
for (const [i, z] of weg.entries()) {
  await page.click(`[data-check="${z.k}"]`);
  if (i === 1) check((await page.locator('#l-laden-info').innerText()).startsWith('Einkauf bei Aldi läuft'), 'beim Einkaufen: „Einkauf bei Aldi läuft“');
}
check(await bis(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.liste.lokal.v1') || '{}').wege?.Aldi?.n)) === 1), 'alles im Wagen: der Weg durch Aldi ist gelernt');
await page.click('[data-act="erledigte-weg"]');
await page.click('.tab[data-tab="rezepte"]');
await page.click('#detail [data-act="alle-dazu"]');
await page.click('.tab[data-tab="einkauf"]');
check(await bis(async () => JSON.stringify(await bereiche()) === JSON.stringify(['konserven', 'fleisch', 'obst'])), `beim nächsten Einkauf: Konserven, Fleisch, Obst & Gemüse – wie euer Aldi (${(await bereiche()).join(', ')})`);
check((await page.locator('#l-laden-info').innerText()).startsWith('Sortiert wie euer Aldi, gelernt aus einem Einkauf'), '„Sortiert wie euer Aldi, gelernt aus einem Einkauf“');
check((await page.locator('#view-angebote').evaluate(() => localStorage.getItem('boxenstopp.angebote.laden.v1'))) === '"Aldi"', 'die Wahl teilt sich die Liste mit den Angeboten');
await page.selectOption('#l-laden-wahl', '');
check(JSON.stringify(await bereiche()) === JSON.stringify(['frisch', 'tierisch', 'trocken']), 'ohne Laden: wieder die übliche Reihenfolge');
await page.selectOption('#l-laden-wahl', 'Aldi');
await page.click('[data-act="weg-vergessen"]');
check(await bis(async () => JSON.stringify(await bereiche()) === JSON.stringify(['frisch', 'tierisch', 'trocken'])), 'Reihenfolge vergessen');
await page.click('#toast button');
check(await bis(async () => JSON.stringify(await bereiche()) === JSON.stringify(['konserven', 'fleisch', 'obst'])), 'Rückgängig: wieder wie euer Aldi');
// Ein Einkauf, der lange ruht, ist vorbei: drei Haken bei Lidl, dann zwei Stunden nichts
await page.selectOption('#l-laden-wahl', 'Lidl');
const offen = await page.$$eval('#list-body .grp:not(.grp-done) [data-check]', (xs) => xs.slice(0, 3).map((x) => x.dataset.check));
for (const k of offen) await page.click(`[data-check="${k}"]`);
await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('boxenstopp.weg.lauf.v1')); for (const h of l.h) h[2] -= 2 * 3600 * 1000; localStorage.setItem('boxenstopp.weg.lauf.v1', JSON.stringify(l)); });
await page.reload({ waitUntil: 'load' });
check(await bis(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.liste.lokal.v1') || '{}').wege?.Lidl?.n)) === 1) && await page.evaluate(() => localStorage.getItem('boxenstopp.weg.lauf.v1')) === null, 'nach zwei Stunden Pause: der Einkauf bei Lidl zählt, auch ohne alles abzuhaken');
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
