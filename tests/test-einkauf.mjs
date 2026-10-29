/*
 * Im Laden: „nicht bekommen“, was es gekostet hat (Bon), Preisalarm und
 * Preisverlauf – erst in Node (liste.js, kosten.js, angebote.js,
 * preisverlauf.js, werkzeug/preisverlauf.mjs), dann im Browser auf der Liste
 * und bei den Angeboten.
 */
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, ROOT } from './hilfe.mjs';
import { leer, anwenden, bereinigen, erledigt, opTeil, opHaken, opLoeschen, opEigener, opErledigteWeg, opLeeren, opGleich, opFehlt, opFehltWeg, opBon, opBonWeg, opPreisalarm } from '../js/liste.js';
import { preiseMitBons, kostenListe, kostenMenge } from '../js/kosten.js';
import { einheitsPreis, passtZumAlarm, preisalarmTreffer, preisJe } from '../js/angebote.js';
import { wochenSchluessel, wochenAbstand, wocheVon, verlaufDazu, verlaufKuerzen, verlaufHinweis, verlaufText } from '../js/preisverlauf.js';

const { check, ende } = pruefer();
const D = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const K = D.katalog;

// --- Nicht bekommen
let s = anwenden(leer(), [
  opTeil('haehnchenbrust', 'butter-chicken', { q: 800, u: 'g', h: '' }, K.haehnchenbrust),
  opTeil('reis', 'butter-chicken', { q: 280, u: 'g', h: '' }, K.reis),
  opEigener('c-k1', 'Kackbürste', 'haushalt'),
]);
s = anwenden(s, opFehlt('haehnchenbrust', 'Aldi', 'Amy'));
check(s.fehlt.haehnchenbrust.laden === 'Aldi' && s.fehlt.haehnchenbrust.by === 'Amy' && !erledigt(s.items.haehnchenbrust), 'nicht bekommen: bleibt offen, mit Laden');
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).fehlt) === JSON.stringify(s.fehlt), 'übersteht Speichern und Bereinigen');
check(!anwenden(s, opFehltWeg('haehnchenbrust')).fehlt.haehnchenbrust, 'Markierung weg');
check(!anwenden(s, opHaken(s, 'haehnchenbrust', true, 'Tobi')).fehlt.haehnchenbrust, 'doch bekommen (Haken): die Markierung ist weg');
check(!anwenden(s, opLoeschen('haehnchenbrust')).fehlt.haehnchenbrust && !Object.keys(anwenden(s, opLeeren()).fehlt).length, 'gelöscht oder Liste leer: auch weg');
const mitReis = anwenden(s, opHaken(s, 'reis', true, 'Tobi'));
check(anwenden(mitReis, opErledigteWeg()).fehlt.haehnchenbrust && anwenden(mitReis, opErledigteWeg()).items.haehnchenbrust, '„Erledigte entfernen“: was fehlte, bleibt');
const zus = anwenden(anwenden(s, opTeil('amyz-haehnchen', 'amy-x', { q: 1, u: 'Stk', h: '' }, { n: 'Hähnchen' })), opGleich('haehnchenbrust', 'amyz-haehnchen'));
check(zus.fehlt['amyz-haehnchen']?.laden === 'Aldi' && !zus.fehlt.haehnchenbrust, 'zusammengelegt: die Markierung wandert mit');
check(!bereinigen({ items: {}, fehlt: { weg: { laden: 'Aldi' } } }).fehlt.weg, 'ohne Zeile keine Markierung');

// --- Bons und Kosten
s = anwenden(s, [opBon('haehnchenbrust', { eur: 5.49, q: 1000, u: 'g', laden: 'Aldi', at: 'a1' }, 'Amy'), opBon('haehnchenbrust', { eur: 6.99, q: 1000, u: 'g', at: 'a2' }), opBon('haehnchenbrust', { eur: 2.9, q: 600, u: 'g', at: 'a3' })]);
check(s.bons.haehnchenbrust.length === 3 && s.bons.haehnchenbrust[0].laden === 'Aldi', 'Bons: je Zutat dazugelegt');
for (let n = 4; n <= 7; n++) s = anwenden(s, opBon('haehnchenbrust', { eur: 6, q: 1000, u: 'g', at: `a${n}` }));
check(s.bons.haehnchenbrust.length === 5 && s.bons.haehnchenbrust[0].at === 'a3', 'höchstens die letzten fünf');
check(anwenden(s, opBonWeg('haehnchenbrust', 'a7')).bons.haehnchenbrust.length === 4 && !bereinigen({ bons: { x: [{ eur: -1, q: 1, u: 'g' }, { eur: 1, q: 1, u: 'Kiste' }] } }).bons.x, 'löschen, Unsinn fällt weg');
const p = preiseMitBons(D.preise, { haehnchenbrust: [{ eur: 5.49, q: 1000, u: 'g' }, { eur: 6.99, q: 1000, u: 'g' }, { eur: 2.9, q: 600, u: 'g' }] }, D.naehrwerte);
check(Math.abs(p.haehnchenbrust.je_g - 0.00549) < 1e-9 && p.haehnchenbrust.bon === 3 && p.reis === D.preise.reis, `mit Bons: der Median je Gramm (${(p.haehnchenbrust.je_g * 1000).toFixed(2)} €/kg), der Rest bleibt Richtpreis`);
const stk = preiseMitBons(D.preise, { zwiebeln: [{ eur: 0.3, q: 1, u: 'Stk' }] }, D.naehrwerte);
check(stk.zwiebeln.je_g > 0 && Math.abs(kostenMenge('zwiebeln', 300, 'g', { preise: stk, naehrwerte: D.naehrwerte }) - 300 * stk.zwiebeln.je_g) < 1e-9, 'Stückware über das Stückgewicht');
const ohneBon = kostenListe(s, { preise: D.preise, naehrwerte: D.naehrwerte }).gesamt;
const mitBon = kostenListe(s, { preise: p, naehrwerte: D.naehrwerte }).gesamt;
check(Math.abs(mitBon - ohneBon - 800 * (0.00549 - D.preise.haehnchenbrust.je_g)) < 1e-6, `die Liste rechnet mit dem Bon (${ohneBon.toFixed(2)} → ${mitBon.toFixed(2)} €)`);

// --- Preisalarm
s = anwenden(s, opPreisalarm('haehnchenbrust', { max: 7.5, u: 'kg', name: 'Hähnchenbrustfilet' }, 'Tobi'));
check(s.preisalarm.haehnchenbrust.max === 7.5 && s.preisalarm.haehnchenbrust.u === 'kg' && !anwenden(s, opPreisalarm('haehnchenbrust', null)).preisalarm.haehnchenbrust, 'Wunschpreis setzen und löschen');
check(!bereinigen({ preisalarm: { a: { max: 3, u: 'Kiste' }, b: { max: -1, u: 'kg' } } }).preisalarm.a && JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).preisalarm) === JSON.stringify(s.preisalarm), 'Unsinn fällt weg, übersteht Speichern');
const ep = einheitsPreis({ preis: 5.19, menge: 600, einheit: 'g' });
check(Math.abs(ep.wert - 8.65) < 1e-9 && ep.u === 'kg' && einheitsPreis({ preis: 1.29, menge: 1, einheit: 'l' }).u === 'l' && Math.abs(einheitsPreis({ preis: 0.99, menge: 3, einheit: 'Stk' }).wert - 0.33) < 1e-9 && einheitsPreis({ preis: 1, menge: 1, einheit: 'Bund' }) === null, 'Preis je kg, l oder Stück');
check(passtZumAlarm({ k: 'haehnchenbrust' }, 'haehnchenbrust', {}, K) && !passtZumAlarm({ k: 'putenbrust', name: 'Hähnchen' }, 'haehnchenbrust', {}, K), 'Katalog-Zutaten über den Schlüssel');
check(passtZumAlarm({ name: 'Gutfried Hähnchen Dino Nuggets 250 g' }, 'n:dino-nuggets', { name: 'Dino Nuggets' }, K) && !passtZumAlarm({ name: 'Chicken Nuggets' }, 'n:dino-nuggets', { name: 'Dino Nuggets' }, K), 'Eigenes über den Namen');
const angebote = [
  { id: 'a1', laden: 'Aldi', name: 'Hähnchenbrustfilet', preis: 5.19, menge: 600, einheit: 'g', k: 'haehnchenbrust' },
  { id: 'a2', laden: 'Lidl', name: 'Hähnchenbrust', preis: 6.99, menge: 1, einheit: 'kg', k: 'haehnchenbrust' },
  { id: 'a3', laden: 'Penny', name: 'Hähnchenbrust XXL', preis: 7.29, menge: 1, einheit: 'kg', k: 'haehnchenbrust' },
];
let tr = preisalarmTreffer(s.preisalarm, angebote, K);
check(tr.length === 1 && tr[0].a.id === 'a2' && preisJe(tr[0].preis, 'kg') === '6,99 €/kg', `Treffer: das günstigste unter dem Wunschpreis (${tr.map((x) => `${x.a.laden} ${x.preis}`).join(', ')})`);
tr = preisalarmTreffer({ haehnchenbrust: { max: 6, u: 'kg' } }, angebote, K);
check(!tr.length, 'nichts unter 6 €/kg: kein Treffer');

// --- Preisverlauf
check(wochenSchluessel(new Date('2026-10-29T12:00:00')) === '2026-W44' && wochenSchluessel(new Date('2027-01-01T12:00:00')) === '2026-W53', 'Kalenderwochen nach ISO');
check(wochenAbstand('2026-W44', '2026-W46') === 2 && wochenAbstand('2026-W52', '2027-W02') === 3, 'Abstand über den Jahreswechsel');
check(wocheVon({ von: '2026-11-02' }) === '2026-W45' && wocheVon({ bis: '2026-10-31' }) === '2026-W44', 'ein Angebot gehört zur Woche seines Beginns, sonst seines Endes');
const je = verlaufDazu({}, [{ k: 'h', preis: 7.99, menge: 1, einheit: 'kg', bis: '2026-09-19', laden: 'Aldi' }, { k: 'h', preis: 6.49, menge: 1, einheit: 'kg', bis: '2026-09-19', laden: 'Lidl' }, { k: 'h', preis: 3, menge: 1, einheit: 'Stk', bis: '2026-09-26' }]);
check(JSON.stringify(je.h.w) === JSON.stringify({ '2026-W38': [6.49, 'Lidl'] }), 'je Woche das günstigste, nur in der Einheit, in der die Zutat zuerst kam');
const v = { je: { h: { u: 'kg', w: { '2026-W36': [9.49, 'Aldi'], '2026-W38': [9.99, 'Lidl'], '2026-W40': [8.99, 'Kaufland'], '2026-W42': [9.49, 'Penny'] } } } };
check(verlaufHinweis(v, 'h', 8.65, 'kg', '2026-W44')?.text === 'Tiefstpreis seit 8 Wochen' && verlaufHinweis(v, 'h', 8.65, 'kg', '2026-W44').tief, `günstiger als alles davor: ${verlaufHinweis(v, 'h', 8.65, 'kg', '2026-W44')?.text}`);
check(verlaufHinweis(v, 'h', 9.2, 'kg', '2026-W44')?.text === 'so günstig wie seit 3 Wochen nicht' && verlaufHinweis(v, 'h', 9.6, 'kg', '2026-W44') === null, `9,20 €: ${verlaufHinweis(v, 'h', 9.2, 'kg', '2026-W44')?.text}; 9,60 € (vor zwei Wochen günstiger): nichts`);
check(verlaufHinweis(v, 'h', 9.39, 'kg', '2026-W46')?.text === 'so günstig wie seit 5 Wochen nicht', `„so günstig wie seit … Wochen nicht“ (${verlaufHinweis(v, 'h', 9.39, 'kg', '2026-W46')?.text})`);
check(verlaufHinweis({ je: { h: { u: 'kg', w: { '2026-W40': [8, 'A'] } } } }, 'h', 5, 'kg', '2026-W44') === null && verlaufHinweis(v, 'h', 1, 'l', '2026-W44') === null, 'zu wenig Verlauf oder andere Einheit: nichts');
check(verlaufText(v, 'h') === 'KW 36 9,49 · KW 38 9,99 · KW 40 8,99 · KW 42 9,49 €/kg', 'der Verlauf als Text');
check(Object.keys(verlaufKuerzen({ h: { u: 'kg', w: { '2025-W40': [1, 'A'], '2026-W40': [2, 'B'] } } }, '2026-W44').h.w).join() === '2026-W40', 'nur die letzten 26 Wochen');
// werkzeug/preisverlauf.mjs über eine Git-Historie
const repo = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-pv-'));
const git = (...x) => execFileSync('git', x, { cwd: repo, stdio: 'ignore' });
mkdirSync(path.join(repo, 'daten'));
git('init', '-q');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'Test');
for (const [bis, preis] of [['2026-09-19', 9.49], ['2026-10-03', 8.99], ['2026-10-17', 9.29]]) {
  writeFileSync(path.join(repo, 'daten', 'angebote.json'), JSON.stringify({ angebote: [{ id: 'a', laden: 'Aldi', name: 'H', preis, menge: 1, einheit: 'kg', bis, k: 'haehnchenbrust' }] }));
  git('add', '.');
  git('commit', '-qm', `Angebote ${bis}`);
}
writeFileSync(path.join(repo, 'daten', 'angebote.json'), JSON.stringify({ angebote: [{ id: 'b', laden: 'Lidl', name: 'H', preis: 7.99, menge: 1, einheit: 'kg', bis: '2026-10-31', k: 'haehnchenbrust' }] }));
const out = execFileSync(process.execPath, [path.join(ROOT, 'werkzeug', 'preisverlauf.mjs'), '--wurzel', repo]).toString();
const pv = JSON.parse(readFileSync(path.join(repo, 'daten', 'preisverlauf.json'), 'utf8'));
check(JSON.stringify(pv.je.haehnchenbrust?.w) === JSON.stringify({ '2026-W38': [9.49, 'Aldi'], '2026-W40': [8.99, 'Aldi'], '2026-W42': [9.29, 'Aldi'], '2026-W44': [7.99, 'Lidl'] }) && /4 Fassungen/.test(out), `werkzeug/preisverlauf.mjs: alle Fassungen und die frische (${out.trim()})`);
rmSync(repo, { recursive: true, force: true });

// --- Im Browser (nur dieses Handy)
const browser = await starteBrowser();
const { page, fehler } = await handy(browser);
await page.click('[data-open="butter-chicken"]');
await page.click('#detail [data-act="alle-dazu"]');
await page.click('.tab[data-tab="einkauf"]');
await page.selectOption('#l-laden-wahl', 'Aldi');
const gruppeVon = (name) => page.locator('#list-body .grp', { has: page.locator('.item-name', { hasText: new RegExp(`^${name}$`) }) }).getAttribute('data-bereich');
await page.click('#list-body [data-mehr="haehnchenbrust"]');
check((await page.locator('#l-mehr [data-fehlt]').innerText()) === 'Bei Aldi nicht bekommen', 'aufgeklappt: „Bei Aldi nicht bekommen“');
await page.click('#l-mehr [data-fehlt]');
check(await bis(async () => (await gruppeVon('Hähnchenbrustfilet')) === 'fehlt') && (await page.locator('.grp-fehlt h3').innerText()).toLowerCase().includes('bei aldi nicht bekommen'), 'steht jetzt unten: „Bei Aldi nicht bekommen“');
check((await page.locator('#toast').innerText()).includes('bleibt für den nächsten Einkauf'), 'Meldung: bleibt für den nächsten Einkauf');
// Alles andere in den Wagen: der Einkauf bei Aldi ist vorbei, obwohl das Hähnchen fehlt
for (const k of await page.$$eval('#list-body .grp:not(.grp-done):not(.grp-fehlt) [data-check]', (xs) => xs.map((x) => x.dataset.check))) await page.click(`[data-check="${k}"]`);
check(await bis(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.liste.lokal.v1') || '{}').wege?.Aldi?.n)) === 1), 'der Rest im Wagen: Einkauf vorbei, der Weg ist gelernt');
await page.selectOption('#l-laden-wahl', 'Lidl');
check(await bis(async () => (await gruppeVon('Hähnchenbrustfilet')) === 'tierisch') && (await page.locator('#list-body .item-fehlt').innerText()) === 'bei Aldi nicht bekommen', 'bei Lidl: wieder an seinem Platz, mit „bei Aldi nicht bekommen“');
// Bon
await page.click('#list-body [data-mehr="haehnchenbrust"]');
const vorher = await page.locator('#l-count').innerText();
check((await page.inputValue('#l-mehr form[data-bon] input[name="q"]')) === '800' && (await page.inputValue('#l-mehr form[data-bon] select[name="u"]')) === 'g', 'Bon: die Menge von der Liste ist vorbelegt (800 g)');
await page.fill('#l-mehr form[data-bon] input[name="eur"]', '9,99');
await page.fill('#l-mehr form[data-bon] input[name="q"]', '1');
await page.selectOption('#l-mehr form[data-bon] select[name="u"]', 'kg');
await page.press('#l-mehr form[data-bon] input[name="q"]', 'Enter');
check(await bis(async () => JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.liste.lokal.v1')).bons?.haehnchenbrust?.map((b) => [b.eur, b.q, b.u, b.laden]))) === JSON.stringify([[9.99, 1000, 'g', 'Lidl']])), 'gemerkt: 9,99 € für 1000 g bei Lidl');
check(await bis(async () => (await page.locator('#l-count').innerText()) !== vorher) && (await page.locator('#l-mehr form[data-bon] .l-mehr-fein').innerText()).includes('Zuletzt 9,99 € für 1 kg bei Lidl'), `die Kosten rechnen damit (${vorher} → ${await page.locator('#l-count').innerText()})`);
await page.fill('#l-mehr form[data-bon] input[name="eur"]', 'viel');
await page.press('#l-mehr form[data-bon] input[name="eur"]', 'Enter');
check((await page.locator('#toast').innerText()).includes('als Zahl'), 'Unsinn: „bitte als Zahl“');
// Preisalarm und Verlauf in der Zeile
check((await page.locator('#l-mehr form[data-alarm] .l-mehr-fein').innerText()).includes('KW 36 9,49'), 'Preisalarm: darunter der Verlauf der letzten Wochen');
await page.fill('#l-mehr form[data-alarm] input[name="max"]', '9');
await page.press('#l-mehr form[data-alarm] input[name="max"]', 'Enter');
check(await bis(async () => (await page.locator('#l-mehr .l-alarm-treffer').innerText().catch(() => '')).includes('8,65 €/kg bei Aldi')), 'Wunsch 9 €/kg: „Gerade: 8,65 €/kg bei Aldi“');
check(await page.locator('#list-body .l-tief').count() >= 1 && /Tiefstpreis seit \d+ Wochen/.test(await page.locator('#list-body .l-tief').first().innerText()), 'beim Angebot auf der Liste: „Tiefstpreis seit … Wochen“');
// Zahlt ihr sonst weniger (noch ein Bon: 5,49 €/kg, im Mittel 7,74 €/kg), ist das Angebot kein Grund zum Feiern
await page.fill('#l-mehr form[data-bon] input[name="eur"]', '5,49');
await page.press('#l-mehr form[data-bon] input[name="eur"]', 'Enter');
check(await bis(async () => (await page.locator('#list-body .l-angebot').first().innerText()).includes('teurer als sonst')) && await page.locator('#list-body .l-tief').count() === 0, 'teurer als das, was ihr sonst zahlt: kein „Tiefstpreis“ daneben');
await page.click('#l-mehr [data-bon-weg]');
check(await bis(async () => await page.locator('#list-body .l-tief').count() >= 1), 'den Bon wieder weg: der Hinweis ist zurück');
// Bei den Angeboten: oben der Preisalarm, die Glocke am Angebot
await page.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await page.locator('.a-alarm.hat').innerText().catch(() => '')).includes('8,65 €/kg bei Aldi')), 'Angebote: oben der Preisalarm mit Treffer – auch wenn Lidl gewählt ist');
await page.click('#view-angebote .a-laeden-chips [data-a-laden=""]');
const glocke = page.locator('[data-a-alarm="a-aldi001"]');
check((await glocke.getAttribute('aria-pressed')) === 'true', 'die Glocke am Hähnchen-Angebot ist an');
await glocke.click();
check(await bis(async () => (await page.locator('.a-alarm').count()) === 0), 'Glocke aus: kein Preisalarm mehr');
await page.click('#toast button');
check(await bis(async () => (await page.locator('.a-alarm.hat').count()) === 1), 'Rückgängig: wieder da');
const andere = page.locator('[data-a-alarm]:not([aria-pressed="true"])').first();
const id = await andere.getAttribute('data-a-alarm');
await andere.click();
check(await bis(async () => (await page.locator(`[data-a-alarm="${id}"]`).getAttribute('aria-pressed')) === 'true') && (await page.locator('#toast').innerText()).includes('wieder so günstig'), 'Glocke an einem anderen Angebot: Alarm zu seinem Preis');
check(await page.locator('#view-angebote .l-tief').count() >= 1, 'auch bei den Angeboten: der Hinweis aus dem Verlauf');
check(fehler.length === 0, `keine Fehler in der Konsole${fehler.length ? `: ${fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
