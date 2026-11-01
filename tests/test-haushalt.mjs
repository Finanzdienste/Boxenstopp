/*
 * Reiter „Haushalt“: der Putzplan und die Haushaltssachen.
 *
 * Erst die Rechnung ohne Browser (js/haushalt.js: welcher Tag dran ist,
 * jede 2. Woche, ohne festen Tag; liste.js: abhaken, erledigt, ein neuer Tag,
 * bereinigen, zusammenlegen; wann „· To Do“), dann die Erinnerung
 * „Heute ist Küche dran“ (werkzeug/push.mjs --haushalt, trocken), dann der
 * Reiter im Browser: leer, der Vorschlag, der Editor, abhaken bis zum Lob,
 * rückgängig, ohne festen Tag, Haushaltssachen auf die Einkaufsliste, breit,
 * ausgeblendet – und zu zweit: Tobi trägt Amy ein, die Zahl unten hat Amy.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, ROOT, APP_URL, SCHLUESSEL } from './hilfe.mjs';
import { faellig, termin, wdhText, tagText, naechsterTermin, letzterTermin, bereichRaten, tagVon, plusTage, wochentag } from '../js/haushalt.js';
import { leer, anwenden, bereinigen, opPlan, opPutzHaken, opPutzFertig, opSache, opZusammen, opTodoApp, opTodoWunsch, opTodoAn, todoNoetig, bescheidNoetig } from '../js/liste.js';

const { check, ende } = pruefer();

/* ---------------------------------------------------------------- Rechnung */

const woche = { wdh: { tage: [1, 4], wochen: 1, ab: '2026-10-01' }, aufgaben: [{ id: 'a-1', t: 'A' }, { id: 'a-2', t: 'B' }] };
check(faellig(woche, '2026-11-02') && faellig(woche, '2026-11-05') && !faellig(woche, '2026-11-03'), 'jeden Mo und Do: Mo und Do dran, Di nicht');
check(!faellig({ wdh: { tage: [1], wochen: 1, ab: '2026-11-03' } }, '2026-11-02'), 'vor dem ersten Mal nichts');
const zwei = { wdh: { tage: [6], wochen: 2, ab: '2026-10-31' } };
check(['2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21'].map((t) => faellig(zwei, t)).join() === 'true,false,true,false', 'alle 2 Wochen samstags: ab dem ersten Mal jede zweite Woche');
check(letzterTermin(zwei, '2026-11-10') === '2026-10-31' && naechsterTermin(zwei, '2026-11-10') === '2026-11-14' && naechsterTermin(zwei, '2026-10-01') === '2026-10-31', 'letzter und nächster Tag bei jeder 2. Woche');
check(wdhText({ tage: [1] }) === 'jeden Montag' && wdhText({ tage: [4, 1] }) === 'jeden Mo und Do' && wdhText({ tage: [6], wochen: 2 }) === 'alle 2 Wochen samstags' && wdhText({ tage: [1, 2, 3, 4, 5, 6, 7] }) === 'täglich' && wdhText({ tage: [] }) === 'ohne festen Tag', 'Wiederholung in Worten');
check(tagText('2026-11-02', '2026-11-02') === 'heute' && tagText('2026-11-03', '2026-11-02') === 'morgen' && tagText('2026-11-01', '2026-11-02') === 'gestern' && tagText('2026-11-05', '2026-11-02') === 'Do' && tagText('2026-11-14', '2026-11-02') === 'Sa 14.11.', 'Tage kurz: heute, morgen, gestern, Do, Sa 14.11.');
check(wochentag('2026-11-02') === 1 && wochentag('2026-11-08') === 7 && plusTage('2026-10-31', 1) === '2026-11-01' && plusTage('2026-03-29', 1) === '2026-03-30', 'Wochentage nach ISO, Tage plus (auch über die Zeitumstellung)');
check(termin(woche, null, '2026-11-02').art === 'heute' && termin(woche, null, '2026-11-03').art === 'offen' && termin(woche, null, '2026-11-03').datum === '2026-11-02', 'heute dran; am Tag danach „offen seit Mo“');
check(termin({ ...woche, wdh: { ...woche.wdh, ab: '2026-11-04' } }, null, '2026-11-03').art === 'bald', 'noch nicht angefangen: bald');
check(['heute', 'offen'].includes(termin(woche, { datum: '2026-10-29', haken: ['a-1', 'a-2'], fertig: { at: 'x', by: 'Amy' }, verlauf: [['2026-10-29', 'Amy']] }, '2026-11-02').art), 'erledigt am Do – am Mo ist er wieder dran');
check(termin(woche, { datum: '2026-11-05', haken: ['a-1'], fertig: null, verlauf: [['2026-11-02', 'Amy']] }, '2026-11-03').art === 'erledigt', 'Mo erledigt, Do schon vorab angefangen: am Di zählt der Mo (aus dem Verlauf) – erledigt');
const frei = { wdh: { tage: [], wochen: 1, ab: '' }, aufgaben: [{ id: 'a-1', t: 'Fenster' }] };
check(termin(frei, null, '2026-11-02').art === 'frei' && termin(frei, { datum: '2026-10-20', haken: ['a-1'], fertig: { at: 'x', by: 'Tobi' }, verlauf: [] }, '2026-11-02').art === 'erledigt', 'ohne festen Tag: frei – erledigt bleibt erledigt, bis jemand neu anfängt');
check(bereichRaten('Spülmittel') === 'kueche' && bereichRaten('Kackbürste') === 'putzen' && bereichRaten('Weichspüler') === 'waesche' && bereichRaten('Zahnseide') === 'bad' && bereichRaten('Glühbirnen') === 'sonstiges', 'Bereich geraten: Spülmittel Küche, Kackbürste Putzen, Weichspüler Wäsche, Zahnseide Bad');

// liste.js
let s = leer();
const plan = { name: 'Küche', raum: 'kueche', aufgaben: [{ id: 'a-1', t: 'Arbeitsflächen' }, { id: 'a-2', t: 'Herd' }], wdh: { tage: [1, 4], wochen: 1, ab: '2026-10-26' }, wer: 'Amy', erinnern: 'morgens' };
s = anwenden(s, opPlan('pp-kueche', plan, 'Tobi'));
check(s.haushalt.plaene['pp-kueche'].name === 'Küche' && s.haushalt.plaene['pp-kueche'].by === 'Tobi', 'Putztag anlegen');
s = anwenden(s, opPutzHaken('pp-kueche', '2026-11-02', 'a-1', true, 'Amy'));
check(s.haushalt.stand['pp-kueche'].haken.join() === 'a-1' && !s.haushalt.stand['pp-kueche'].fertig, 'abhaken');
s = anwenden(s, opPutzHaken('pp-kueche', '2026-11-02', 'a-2', true, 'Amy'));
check(s.haushalt.stand['pp-kueche'].fertig?.by === 'Amy' && s.haushalt.stand['pp-kueche'].verlauf.at(-1).join() === '2026-11-02,Amy', 'alles abgehakt: erledigt, von Amy, im Verlauf');
s = anwenden(s, opPutzHaken('pp-kueche', '2026-10-29', 'a-1', false, 'Amy'));
check(s.haushalt.stand['pp-kueche'].datum === '2026-11-02' && s.haushalt.stand['pp-kueche'].fertig, 'ein älterer Tag ändert nichts mehr');
s = anwenden(s, opPutzHaken('pp-kueche', '2026-11-02', 'a-2', false, 'Tobi'));
check(!s.haushalt.stand['pp-kueche'].fertig && !s.haushalt.stand['pp-kueche'].verlauf.some((v) => v[0] === '2026-11-02'), 'einen Haken zurück: nicht mehr erledigt');
s = anwenden(s, opPutzHaken('pp-kueche', '2026-11-05', 'a-1', true, 'Tobi'));
check(s.haushalt.stand['pp-kueche'].datum === '2026-11-05' && s.haushalt.stand['pp-kueche'].haken.join() === 'a-1', 'ein neuer Tag fängt frisch an');
s = anwenden(s, opPutzFertig('pp-kueche', '2026-11-05', true, 'Tobi'));
check(s.haushalt.stand['pp-kueche'].haken.length === 2 && s.haushalt.stand['pp-kueche'].fertig?.by === 'Tobi', '„Alles erledigt“: alle Haken');
s = anwenden(s, opPlan('pp-kueche', { ...plan, aufgaben: [{ id: 'a-1', t: 'Arbeitsflächen' }, { id: 'a-3', t: 'Boden' }] }, 'Tobi'));
check(s.haushalt.stand['pp-kueche'].haken.join() === 'a-1' && !s.haushalt.stand['pp-kueche'].fertig, 'Aufgabe ersetzt: ihr Haken fällt weg, nicht mehr erledigt');
const vorBescheid = s;
s = anwenden(s, opSache('hs-spuelmittel', { name: 'Spülmittel', bereich: 'kueche' }, 'Amy'));
check(!bescheidNoetig(vorBescheid, s), 'Putzplan und Haushaltssachen sind kein „Bescheid“ (keine Push-Nachricht wie bei der Liste)');
check(!todoNoetig(vorBescheid, s) && !todoNoetig(s, anwenden(s, opTodoApp('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'))), 'ohne Verbundene: kein „· To Do“');
const mitTodo = anwenden(anwenden(s, opTodoApp('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')), opTodoAn('amy', true));
check(todoNoetig(mitTodo, anwenden(mitTodo, opPutzHaken('pp-kueche', '2026-11-05', 'a-3', true, 'Amy'))) && todoNoetig(mitTodo, anwenden(mitTodo, opTodoWunsch('Tobi', 'verbinden'))), 'mit Verbundenen: abhaken und Wünsche gehen mit „· To Do“');
check(!todoNoetig(mitTodo, anwenden(mitTodo, opSache('hs-x', { name: 'Kerzen', bereich: 'sonstiges' }, 'Amy'))), 'Haushaltssachen gehen To Do nichts an');
s = anwenden(s, opPlan('pp-kueche', null));
check(!s.haushalt.plaene['pp-kueche'] && !s.haushalt.stand['pp-kueche'], 'Putztag löschen: sein Stand geht mit');
const kaputt = bereinigen({ haushalt: { sachen: { 'hs-a': { name: '<b>Spül</b>mittel', bereich: 'quatsch' }, 'böse': { name: 'x' } }, plaene: { 'pp-a': { name: 'Bad', raum: 'keller', aufgaben: Array.from({ length: 40 }, (_, i) => ({ id: `a-${i}`, t: `T${i}` })).concat([{ id: 'a-1', t: 'doppelt' }]), wdh: { tage: [9, 1, 1, 'x'], wochen: 7 }, wer: '<script>', erinnern: 'nachts' } }, stand: { 'pp-weg': { datum: '2026-11-02', haken: [] } }, todoApp: 'nicht-guid', todoWunsch: { Amy: { art: 'verbinden', at: 'x' }, tobi: { art: 'hacken', at: 'x' } } } });
const kp = kaputt.haushalt.plaene['pp-a'];
check(kaputt.haushalt.sachen['hs-a']?.name === 'bSpül/bmittel' && kaputt.haushalt.sachen['hs-a'].bereich === 'sonstiges' && !kaputt.haushalt.sachen['böse'], 'bereinigen: Sachen ohne Spitzklammern, unbekannter Bereich → Sonstiges, falsche Kennung weg');
check(kp.raum === 'sonstiges' && kp.aufgaben.length === 30 && kp.wdh.tage.join() === '1' && kp.wdh.wochen === 1 && kp.wer === 'script' && kp.erinnern === 'morgens', 'bereinigen: Putztag – höchstens 30 Aufgaben, nur echte Wochentage, ohne Spitzklammern, Unsinn auf Standard');
check(!kaputt.haushalt.stand['pp-weg'] && kaputt.haushalt.todoApp === '' && !Object.keys(kaputt.haushalt.todoWunsch).length, 'bereinigen: Stand ohne Putztag weg, App-ID nur als GUID, Wünsche nur bekannte');
let z = leer();
z = anwenden(z, opPlan('pp-bad', { ...plan, name: 'Bad' }, 'Amy'));
z = anwenden(z, opZusammen({}, {}, { haushalt: { plaene: { 'pp-bad': { ...plan, name: 'Anderes Bad' }, 'pp-flur': { ...plan, name: 'Flur' } }, sachen: { 'hs-a': { name: 'Kerzen', bereich: 'sonstiges' } } } }));
check(z.haushalt.plaene['pp-bad'].name === 'Bad' && z.haushalt.plaene['pp-flur'].name === 'Flur' && z.haushalt.sachen['hs-a'], 'zusammenlegen: Vorhandenes bleibt, Neues kommt dazu');

/* ------------------------------------------------- Erinnerung (push.mjs) */

const tmp = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-haushalt-'));
let st = leer();
st = anwenden(st, opPlan('pp-kueche', { name: 'Küche', raum: 'kueche', aufgaben: [{ id: 'a-1', t: 'Arbeitsflächen' }, { id: 'a-2', t: 'Herd' }, { id: 'a-3', t: 'Spüle' }, { id: 'a-4', t: 'Boden' }], wdh: { tage: [1, 4], wochen: 1, ab: '2026-10-01' }, wer: 'Amy', erinnern: 'morgens' }, 'Tobi'));
st = anwenden(st, opPlan('pp-bad', { name: 'Bad', raum: 'bad', aufgaben: [{ id: 'a-1', t: 'Spiegel' }], wdh: { tage: [1], wochen: 1, ab: '2026-10-01' }, wer: '', erinnern: 'morgens' }, 'Tobi'));
st = anwenden(st, opPlan('pp-flur', { name: 'Flur', raum: 'flur', aufgaben: [], wdh: { tage: [1], wochen: 1, ab: '2026-10-01' }, wer: '', erinnern: 'abends' }, 'Tobi'));
st = anwenden(st, opPlan('pp-still', { name: 'Balkon', raum: 'balkon', aufgaben: [], wdh: { tage: [1], wochen: 1, ab: '2026-10-01' }, wer: '', erinnern: '' }, 'Tobi'));
st = anwenden(st, opPutzHaken('pp-kueche', '2026-11-02', 'a-2', true, 'Amy'));
writeFileSync(path.join(tmp, 'liste.json'), JSON.stringify(st));
writeFileSync(path.join(tmp, 'push.json'), JSON.stringify({ schluessel: 'x', abos: {
  amy: [{ endpoint: 'https://push.test/amy', keys: {}, geraet: 'iPhone', was: ['liste', 'rezepte', 'preise', 'haushalt'], kennt: ['liste', 'rezepte', 'preise', 'haushalt'] }],
  tobi: [{ endpoint: 'https://push.test/tobi', keys: {}, geraet: 'Android', was: ['liste', 'rezepte', 'preise'] }],
  gast: [{ endpoint: 'https://push.test/gast', keys: {}, geraet: 'Browser', was: ['liste'], kennt: ['liste', 'rezepte', 'preise', 'haushalt'] }],
} }));
const push = (jetzt) => spawnSync(process.execPath, [path.join(ROOT, 'werkzeug', 'push.mjs'), '--daten', tmp, '--haushalt', '--trocken', '--jetzt', jetzt], { encoding: 'utf8' }).stdout;
let out = push('2026-11-02T05:23:00Z');
check(!out.includes('→') && out.includes('6 Uhr'), 'Montag 6:23 (Winterzeit): zu früh – nichts');
out = push('2026-11-02T06:23:00Z');
check(out.includes('→ amy (iPhone): Heute sind Küche und Bad dran') && out.includes('Küche (3) · Bad (1)'), 'Montag 7:23: an Amy „Heute sind Küche und Bad dran“, mit dem, was noch offen ist');
check(out.includes('→ tobi (Android): Heute ist Bad dran – 1 Aufgabe: Spiegel') && !/tobi.*Küche/.test(out), 'an Tobi nur das Bad (die Küche macht Amy) – sein Abo von vor dem Putzplan bekommt ihn trotzdem');
check(!out.includes('gast'), 'wer den Putzplan abgewählt hat, bekommt nichts');
check(!out.includes('Balkon') && !out.includes('Flur'), 'ohne Erinnerung nichts; „abends“ erst abends');
out = push('2026-11-02T07:23:00Z');
check(!out.includes('→'), 'der zweite Lauf am Morgen: schon gemeldet – nichts doppelt');
const pj = JSON.parse(readFileSync(path.join(tmp, 'push.json'), 'utf8'));
check(pj.gemeldet.includes('putz|pp-kueche|2026-11-02') && pj.gemeldet.includes('putz|pp-bad|2026-11-02'), 'gemerkt in push.json (gemeldet)');
out = push('2026-11-02T16:37:00Z');
check(out.includes('Heute ist Flur dran – Zum Abhaken in Boxenstopp.'), 'abends: der Flur');
st = anwenden(st, opPutzFertig('pp-kueche', '2026-11-05', true, 'Amy'));
writeFileSync(path.join(tmp, 'liste.json'), JSON.stringify(st));
out = push('2026-11-05T06:30:00Z');
check(!out.includes('Küche'), 'Donnerstag, schon vorab erledigt: keine Erinnerung');
st = anwenden(st, opPutzHaken('pp-kueche', '2026-11-09', 'a-1', true, 'Amy'));
writeFileSync(path.join(tmp, 'liste.json'), JSON.stringify(st));
out = push('2026-11-09T06:30:00Z');
check(out.includes('Heute sind Küche und Bad dran') || out.includes('Heute ist Küche dran'), 'nächster Montag: wieder dran');
check(out.includes('Küche (3)'), '… mit dem, was vorab schon abgehakt ist');
rmSync(tmp, { recursive: true, force: true });

/* -------------------------------------------------------------- Browser */

const browser = await starteBrowser();
const heute = tagVon(new Date());
const h = await handy(browser, { viewport: { width: 390, height: 844 } });
const p = h.page;
const titel = () => p.locator('#h-titel').innerText();
const badge = () => p.evaluate(() => { const b = document.querySelector('#h-badge'); return b.hidden ? 0 : Number(b.textContent); });
check(JSON.stringify(await p.$$eval('.tabbar .tab:not([hidden])', (xs) => xs.map((x) => x.dataset.tab))) === JSON.stringify(['rezepte', 'amy', 'einkauf', 'angebote', 'haushalt', 'einstellungen']), 'unten sechs Reiter: Haushalt vor den Einstellungen');
check(await p.$$eval('.tabbar .tab:not([hidden]) span:not(.badge)', (xs) => xs.filter((s) => s.offsetWidth && s.scrollWidth > s.clientWidth + 1).length) === 0, '390 px: keine Beschriftung abgeschnitten');
await p.click('.tab[data-tab="haushalt"]');
check(await p.locator('#view-haushalt').isVisible() && await p.locator('#view-recipes').isHidden() && await p.locator('#view-list').isHidden(), 'Haushalt: nur dieser Reiter');
check((await titel()) === 'Euer Putzplan' && await p.locator('.h-leer').isVisible(), 'leer: „Euer Putzplan“, Vorschläge zum Anfangen');
await p.click('[data-act="h-vorschlag"]');
check(await bis(async () => (await p.locator('.h-plan').count()) === 5), 'der Vorschlag: fünf Putztage');
check((await titel()) === 'Heute ist nichts dran' && /Als Nächstes: .+ (morgen|am )/.test(await p.locator('.h-naechstes').innerText()), 'ab morgen: heute nichts, „Als Nächstes …“');
check(await badge() === 0, 'keine Zahl unten');

// Ein neuer Putztag für heute
await p.click('[data-act="h-neu"]');
check(await p.locator('#h-edit-form').isVisible() && await p.locator('#h-plaene .h-plan').count() === 0, 'Editor auf, die Liste weg');
check(await p.inputValue('#h-edit-form input[name="name"]') === 'Küche' && await p.locator('#h-aufg-edit input').count() === 7, 'Küche mit sieben Aufgaben aus der Vorlage');
await p.click('#h-edit-form .h-raum-chip:has(input[value="bad"])');
check(await p.inputValue('#h-edit-form input[name="name"]') === 'Bad' && (await p.locator('#h-aufg-edit input').first().inputValue()) === 'Waschbecken und Armaturen putzen', 'Raum Bad: Name und Aufgaben vom Bad');
await p.fill('#h-edit-form input[name="name"]', 'Badezimmer');
await p.click('#h-edit-form .h-raum-chip:has(input[value="flur"])');
check(await p.inputValue('#h-edit-form input[name="name"]') === 'Badezimmer' && (await p.locator('#h-aufg-edit input').first().inputValue()) === 'Schuhe wegräumen', 'eigener Name bleibt beim Raumwechsel; die unveränderte Vorlage wechselt mit');
await p.click('#h-edit-form .h-raum-chip:has(input[value="bad"])');
await p.fill('#h-aufg-edit input >> nth=0', 'Waschbecken putzen');
await p.click('#h-edit-form .h-raum-chip:has(input[value="kueche"])');
check((await p.locator('#h-aufg-edit input').first().inputValue()) === 'Waschbecken putzen', 'geänderte Aufgaben bleiben beim Raumwechsel');
await p.click('#h-edit-form .h-raum-chip:has(input[value="bad"])');
// Aufgaben: drei weg, eine dazu (Enter springt in die nächste Zeile, speichert nicht)
for (let i = 0; i < 4; i++) await p.click('#h-aufg-edit li:last-child [data-act="h-aufg-weg"]');
const n0 = await p.locator('#h-aufg-edit input').count();
await p.locator('#h-aufg-edit input').last().press('Enter');
check(await p.locator('#h-aufg-edit input').count() === n0 + 1 && await p.locator('#h-edit-form').isVisible(), 'Enter in einer Aufgabe: neue Zeile, nicht gespeichert');
await p.keyboard.type('Duschvorhang waschen');
check(await p.locator('#h-vorschlaege [data-act="h-aufg-vorschlag"]').count() >= 3, 'weggenommene Aufgaben stehen als Vorschläge da');
await p.click('#h-vorschlaege [data-act="h-aufg-vorschlag"] >> nth=0');
check(await p.locator('#h-edit-form input[name="tag"]:checked').count() === 1 && Number(await p.locator('#h-edit-form input[name="tag"]:checked').getAttribute('value')) === wochentag(heute), 'heute ist schon angehakt');
await p.selectOption('#h-edit-form select[name="wochen"]', '2');
check(await p.locator('#h-edit-form .h-ab').isVisible() && (await p.inputValue('#h-edit-form input[name="ab"]')) === heute && /alle 2 Wochen/.test(await p.locator('#h-wdh-text').innerText()), 'alle 2 Wochen: „das erste Mal“ (heute), „Also alle 2 Wochen …“');
await p.selectOption('#h-edit-form select[name="wochen"]', '1');
check(await p.locator('#h-edit-form .h-ab').isHidden() && /jeden/.test(await p.locator('#h-wdh-text').innerText()), 'jede Woche: ohne „das erste Mal“');
check(await p.locator('#h-edit-form fieldset:has(input[name="wer"])').count() === 0, 'allein (nur lokal): keine Frage „Wer“');
await p.click('#h-edit-form button[type="submit"]');
check(await bis(async () => (await titel()) === 'Heute ist Badezimmer dran'), 'gespeichert: „Heute ist Badezimmer dran“');
check(await badge() === 1, 'unten die 1');
const bad = p.locator('.h-jetzt .h-plan').first();
const anzahl = await bad.locator('.h-aufgabe').count();
check(anzahl === n0 + 2 && (await bad.innerText()).includes('Duschvorhang waschen'), `der Putztag hat ${anzahl} Aufgaben, auch die neue`);
// Abhaken bis zum Lob
for (let i = 0; i < anzahl - 1; i++) await bad.locator('.h-aufgabe').nth(i).click();
check((await bad.locator('.h-zahl').innerText()) === `${anzahl - 1}/${anzahl}` && await bad.locator('.h-aufgabe[aria-checked="true"]').count() === anzahl - 1, `abgehakt: ${anzahl - 1}/${anzahl}`);
await bad.locator('.h-aufgabe').nth(anzahl - 1).click();
check(await bis(async () => !(await p.locator('#lob').isHidden())), 'das letzte Häkchen: das Lob');
check((await p.locator('#lob .lob-eyebrow').textContent()).includes('Alles geputzt · Badezimmer'), '„Alles geputzt · Badezimmer“');
await p.click('[data-lob="zu"]');
check(await bis(async () => (await titel()) === 'Für heute ist alles geputzt') && await badge() === 0, 'danach: „Für heute ist alles geputzt“, keine Zahl');
await p.click('.h-jetzt .h-plan-kopf');
await p.click('.h-jetzt [data-act="h-nochmal"]');
check(await bis(async () => (await titel()) === 'Heute ist Badezimmer dran') && await badge() === 1, '„Doch nicht erledigt“: wieder dran');
await p.click('.h-jetzt .h-aufgabe >> nth=0');
await p.click('.h-jetzt [data-act="h-fertig"]');
check(await bis(async () => (await titel()) === 'Für heute ist alles geputzt'), '„Alles erledigt“');
await p.locator('#lob [data-lob="zu"]').click({ timeout: 3000 }).catch(() => {});
await p.click('#toast button');
check(await bis(async () => (await titel()) === 'Heute ist Badezimmer dran') && await p.locator('.h-jetzt .h-aufgabe[aria-checked="true"]').count() === 1, 'Rückgängig: wieder offen, der eine Haken von vorher bleibt');

// Ändern und löschen
await p.click('.h-jetzt [data-act="h-edit"]');
check((await p.locator('#h-edit-form h2').innerText()) === 'Putztag ändern' && await p.inputValue('#h-edit-form input[name="name"]') === 'Badezimmer', 'Ändern: der Editor mit dem Putztag');
await p.click('[data-act="h-plan-weg"]');
check(await bis(async () => (await p.locator('.h-plan').count()) === 5) && (await titel()) === 'Heute ist nichts dran', 'gelöscht');
await p.click('#toast button');
check(await bis(async () => (await titel()) === 'Heute ist Badezimmer dran') && await p.locator('.h-jetzt .h-aufgabe[aria-checked="true"]').count() === 1, 'Rückgängig: wieder da, samt Haken');

// Ohne festen Tag
await p.click('[data-act="h-neu"]');
await p.click('#h-edit-form .h-raum-chip:has(input[value="wohnung"])');
await p.fill('#h-edit-form input[name="name"]', 'Großputz');
while (await p.locator('#h-edit-form .h-tag:has(input:checked)').count()) await p.locator('#h-edit-form .h-tag:has(input:checked)').first().click();
check(/Ohne Tag/.test(await p.locator('#h-wdh-text').innerText()), 'kein Tag angehakt: „Ohne Tag … Zwischendurch“');
await p.click('#h-edit-form button[type="submit"]');
const gross = p.locator('.h-gruppe:has(h2:text("Zwischendurch")) .h-plan');
check(await bis(async () => (await gross.count()) === 1) && (await gross.innerText()).includes('ohne festen Tag'), 'unter „Zwischendurch“');
const ng = await gross.locator('.h-aufgabe').count();
for (let i = 0; i < ng; i++) await gross.locator('.h-aufgabe').nth(i).click();
await bis(async () => !(await p.locator('#lob').isHidden()));
await p.click('[data-lob="zu"]');
check(await bis(async () => (await gross.locator('[data-act="h-nochmal"]').count()) === 1 || (await gross.locator('.h-ok').count()) === 1), 'alles abgehakt: erledigt – bleibt so');
if (await gross.locator('[data-act="h-nochmal"]').count() === 0) await gross.locator('.h-plan-kopf').click();
await gross.locator('[data-act="h-nochmal"]').click();
check(await bis(async () => (await gross.locator('.h-aufgabe[aria-checked="true"]').count()) === 0 && (await gross.locator('.h-aufgabe').count()) === ng), '„Neu anfangen“: alles wieder offen');
// Demnächst schon vorab
const bald = p.locator('.h-gruppe:has(h2:text("Demnächst")) .h-plan').first();
await bald.locator('.h-plan-kopf').click();
check((await bald.innerText()).includes('abhaken geht schon vorher'), 'demnächst aufgeklappt: abhaken geht schon vorher');
await bald.locator('.h-aufgabe').first().click();
check(await bis(async () => (await bald.innerText()).includes('1 von') && (await bald.locator('.h-aufgabe[aria-checked="true"]').count()) === 1), 'vorab abgehakt: „1 von … schon vorab“');

// Haushaltssachen
await p.click('[data-teil="sachen"]');
check((await titel()) === 'Was braucht ihr im Haushalt?' && await p.locator('#h-sach-form').isVisible(), 'Haushaltssachen: Feld und Vorschläge');
await p.click('.h-sache.h-vorschlag:has-text("Spülmittel")');
check(await bis(async () => (await p.locator('.h-sache[aria-pressed="true"]:has-text("Spülmittel")').count()) === 1) && (await p.locator('#toast').innerText()).includes('steht auf der Einkaufsliste'), 'Spülmittel angetippt: steht auf der Einkaufsliste');
check(await p.locator('.h-sache.h-vorschlag:has-text("Spülmittel")').count() === 0 && (await p.locator('[data-teil="sachen"] .btn-n').innerText()) === '1', 'jetzt eine eigene Sache (nicht mehr gestrichelt), oben die 1');
await p.fill('#h-sach-input', 'Kackbürste');
await p.press('#h-sach-input', 'Enter');
check(await bis(async () => (await p.locator('.h-bereich:has(h2:text("Putzen")) .h-sache[aria-pressed="true"]:has-text("Kackbürste")').count()) === 1), 'getippt: Kackbürste – unter Putzen, auf der Liste');
await p.fill('#h-sach-input', 'spülmittel');
await p.press('#h-sach-input', 'Enter');
check(await bis(async () => (await p.locator('#toast').innerText()).includes('Steht schon auf der Einkaufsliste')), 'nochmal Spülmittel: „Steht schon auf der Einkaufsliste“');
await p.click('.tab[data-tab="einkauf"]');
const listeText = await p.locator('#view-list').innerText();
check(listeText.includes('Spülmittel') && listeText.includes('Kackbürste') && (listeText.match(/Spülmittel/g) || []).length === 1, 'auf der Einkaufsliste: Spülmittel (einmal) und Kackbürste');
check(await p.locator('.grp:has(.item-name:text("Kackbürste")) h3').innerText().then((t) => /Haushalt/i.test(t)), 'in der Abteilung Haushalt');
await p.fill('#add-input', 'Spülmittel');
await p.press('#add-input', 'Enter');
check(await bis(async () => (await p.locator('#toast').innerText()).includes('Steht schon drauf')), 'unten auf der Liste nochmal „Spülmittel“: „Steht schon drauf“');
await p.click('.tab[data-tab="haushalt"]');
await p.click('.h-sache[aria-pressed="true"]:has-text("Spülmittel")');
check(await bis(async () => (await p.locator('.h-sache[aria-pressed="true"]:has-text("Spülmittel")').count()) === 0) && (await p.locator('#toast').innerText()).includes('wieder runter'), 'nochmal angetippt: wieder runter von der Liste');
await p.click('[data-act="h-sachen-bearbeiten"]');
check(await p.locator('.h-sache.h-vorschlag').count() === 0 && await p.locator('.h-sache.h-weg').count() === 2, 'bearbeiten: nur die eigenen, mit ×');
await p.click('.h-sache.h-weg:has-text("Kackbürste")');
check(await bis(async () => (await p.locator('.h-sache.h-weg').count()) === 1), 'vergessen');
await p.click('[data-act="h-sachen-bearbeiten"]');
await p.click('[data-teil="putzplan"]');

// Ausblenden: die Karte bei den Rezepten; breit: links der Haushalt, rechts die Liste
await p.click('.tab[data-tab="einstellungen"]');
check((await p.locator('#e-reiter').innerText()).includes('Haushalt'), 'Einstellungen → Reiter unten: Haushalt');
await p.click('#e-reiter input[data-reiter="haushalt"]');
check(await p.locator('.tab[data-tab="haushalt"]').isHidden(), 'ausgeblendet');
await p.click('.tab[data-tab="rezepte"]');
check(await p.locator('.reste-karte.haus-link').isVisible(), 'dafür die Karte „Haushalt“ bei den Rezepten');
await p.click('.reste-karte.haus-link');
check(await p.locator('#view-haushalt').isVisible(), '… sie führt hin');
await p.setViewportSize({ width: 1200, height: 900 });
check(await p.locator('#view-haushalt').isVisible() && await p.locator('#view-list').isVisible() && await p.locator('#view-recipes').isHidden(), 'breit: links der Haushalt, rechts die Liste');
await p.click('.tab[data-tab="rezepte"]', { force: true }).catch(() => {});
await p.evaluate(() => { location.hash = ''; });
check(h.fehler.length === 0, `keine Fehler im Browser (${h.fehler.join(' | ')})`);
await h.ctx.close();

// #haushalt öffnet den Reiter
const h2 = await handy(browser, { adresse: `${APP_URL}#haushalt` });
check(await bis(async () => (await h2.page.evaluate(() => document.querySelector('#app').dataset.tab)) === 'haushalt'), '#haushalt öffnet den Reiter');
await h2.ctx.close();

/* ----------------------------------------------------------- zu zweit */

const gh = githubAttrappe();
const mitLink = `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}`;
const verbinden = async (seite, name) => { await seite.fill('#z-name', name); await seite.click('#z-los'); return bis(async () => (await seite.locator('#sync-text').innerText()) === 'Geteilt', 8000); };
const amy = await handy(browser, { attrappe: gh, adresse: mitLink });
check(await verbinden(amy.page, 'Amy'), 'Amy: eingerichtet');
await amy.page.click('.tab[data-tab="einkauf"]');
await amy.page.fill('#add-input', 'Kerzen');
await amy.page.press('#add-input', 'Enter');
check(await bis(() => Object.values(gh.liste()?.items || {}).some((d) => d.name === 'Kerzen'), 8000), 'Amy setzt etwas auf die Liste (so kennt die App ihren Namen)');
const tobi = await handy(browser, { attrappe: gh, adresse: mitLink });
check(await verbinden(tobi.page, 'Tobi'), 'Tobi: eingerichtet');
const t = tobi.page;
await t.click('.tab[data-tab="haushalt"]');
await t.click('[data-act="h-neu"]');
check(await t.locator('#h-edit-form input[name="wer"]').count() === 3 && (await t.locator('#h-edit-form fieldset:has(input[name="wer"])').innerText()).includes('Amy'), 'Wer: Ihr beide, Tobi, Amy');
await t.click('#h-edit-form .h-raum-chip:has(input[name="wer"][value="Amy"])');
const nachrichtenVor = gh.zustand.nachrichten.length;
await t.click('#h-edit-form button[type="submit"]');
check(await bis(() => Object.values(gh.liste()?.haushalt?.plaene || {}).some((x) => x.wer === 'Amy' && x.name === 'Küche'), 8000), 'der Putztag für Amy steht in liste.json');
const neue = gh.zustand.nachrichten.slice(nachrichtenVor);
check(neue.length > 0 && neue.every((m) => !/Bescheid|To Do/.test(m)), `ohne „· Bescheid“ und ohne „· To Do“ (${neue.join(' | ')})`);
check(await bis(async () => (await t.locator('.h-jetzt .h-plan').innerText()).includes('Amy')) && await t.evaluate(() => document.querySelector('#h-badge').hidden), 'bei Tobi: „Amy“ am Putztag, unten keine Zahl');
await amy.page.click('.tab[data-tab="haushalt"]');
check(await bis(async () => (await amy.page.locator('#h-titel').innerText()) === 'Heute ist Küche dran', 8000) && (await amy.page.locator('.h-jetzt .h-plan').innerText()).includes('du'), 'bei Amy: „Heute ist Küche dran“ – „du“');
check(await amy.page.evaluate(() => Number(document.querySelector('#h-badge').textContent)) === 1, 'Amy hat unten die 1');
await amy.page.click('.h-jetzt .h-aufgabe >> nth=0');
check(await bis(async () => (await t.locator('.h-jetzt .h-aufgabe[aria-checked="true"]').count()) === 1, 8000), 'Amy hakt ab – Tobi sieht es');
check((await t.locator('.h-todo').innerText()).includes('Microsoft To Do'), 'unten: auch in Microsoft To Do? → Einstellungen');
check(amy.fehler.length === 0 && tobi.fehler.length === 0, `keine Fehler im Browser (${[...amy.fehler, ...tobi.fehler].join(' | ')})`);
await amy.ctx.close();
await tobi.ctx.close();
await browser.close();
ende();
