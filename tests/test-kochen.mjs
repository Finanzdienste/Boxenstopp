/*
 * Kochmodus und Kochstand pro Person: erst in Node (liste.js kochen,
 * bescheidNoetig), dann im Browser – Amy kocht auf dem iPad im Kochmodus,
 * ihr iPhone hat dieselben Haken und den Timer; Tobi bleibt bei seinem Stand.
 */
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL } from './hilfe.mjs';
import { leer, anwenden, bereinigen, opKochen, opTeil, opHaken, kochenBereinigen, bescheidNoetig, opAmy, opNotiz } from '../js/liste.js';

const { check, ende } = pruefer();

// --- Der Kochstand im Stand
const stand = (at, schritte) => ({ schritte, tempo: { offen: {}, proben: [['chili:abc', 'vor', 3, 4]], gesamt: { chili: [[95, '2026-10-20']] } }, timer: [{ id: 't1', rid: 'chili', schritt: 5, label: 'Chili: köcheln', minuten: 20, start: 1, ende: 2e12, fertig: false, dann: '', folge: [], stufe: 1, stufen: 1 }] });
let s = anwenden(leer(), opKochen('Amy', stand('2026-10-29T18:00:00.000Z', { chili: [0, 1] }), '2026-10-29T18:00:00.000Z'));
check(JSON.stringify(s.kochen.amy.schritte) === JSON.stringify({ chili: [0, 1] }) && s.kochen.amy.timer.length === 1 && s.kochen.amy.tempo.proben.length === 1, 'opKochen: Haken, Tempo und Timer – unter dem Namen klein geschrieben');
s = anwenden(s, opKochen('Amy', stand('x', { chili: [0] }), '2026-10-29T17:00:00.000Z'));
check(JSON.stringify(s.kochen.amy.schritte) === JSON.stringify({ chili: [0, 1] }), 'eine ältere Fassung kommt nicht drüber (das andere Gerät war hinterher)');
s = anwenden(s, opKochen('amy', stand('x', { chili: [0, 1, 2] }), '2026-10-29T18:05:00.000Z'));
check(JSON.stringify(s.kochen.amy.schritte) === JSON.stringify({ chili: [0, 1, 2] }), 'die neuere gewinnt');
s = anwenden(s, opKochen('Tobi', stand('x', { gulasch: [3] }), '2026-10-29T12:00:00.000Z'));
check(s.kochen.tobi.schritte.gulasch[0] === 3 && s.kochen.amy.schritte.chili.length === 3, 'Tobi hat seinen eigenen Stand');
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).kochen) === JSON.stringify(s.kochen), 'übersteht Speichern und Bereinigen');
check(kochenBereinigen({ at: 'x', schritte: { 'a b': [1], ok: [1, 1, -2, 'x', 3] }, tempo: { proben: [['k', 'vor', 1, 1], ['kaputt']] }, timer: [{ id: 'a' }, { id: 'b', ende: 5, label: '<x>'.repeat(30) }] }).schritte.ok.join() === '1,3' && kochenBereinigen({ at: 'x', timer: [{ id: 'b', ende: 5, label: 'y'.repeat(99) }] }).timer[0].label.length === 60 && !kochenBereinigen({ schritte: {} }), 'Unsinn fällt weg');
check(opKochen('Amy', {}, 'x').ersetzt === 'kochen:amy', 'eine noch nicht gesendete Fassung ersetzt die vorige (speicher.js)');

// --- Was eine Nachricht wert ist (Push)
const a = anwenden(leer(), opTeil('zwiebeln', 'chili', { q: 300, u: 'g', h: '' }, { n: 'Zwiebeln', c: 'obst' }));
check(bescheidNoetig(leer(), a), 'Neues auf der Liste: Bescheid');
const b = anwenden(a, opHaken(a, 'zwiebeln', true, 'Tobi'));
check(bescheidNoetig(a, b), 'alles eingekauft: Bescheid');
const c = anwenden(a, opTeil('reis', 'chili', { q: 200, u: 'g', h: '' }, { n: 'Reis', c: 'trocken' }));
const d = anwenden(c, opHaken(c, 'zwiebeln', true, 'Tobi'));
check(!bescheidNoetig(c, d), 'abhaken (es bleibt noch was): kein Bescheid');
check(!bescheidNoetig(a, anwenden(a, opKochen('Amy', stand('x', { chili: [1] }), 'y'))), 'kochen: kein Bescheid');
check(bescheidNoetig(a, anwenden(a, opAmy({ id: 'amy-x-1', name: 'X', zutaten: [], schritte: [] }, 'Amy'))) && bescheidNoetig(a, anwenden(a, opNotiz('chili', 'n-1', 'Mehr Kreuzkümmel', 'Amy'))), 'neues Rezept von Amy, neue Notiz: Bescheid');

// --- Im Browser: Amy auf iPhone und iPad, Tobi
const t0 = '2026-10-29T10:00:00Z';
const gh = githubAttrappe();
gh.zustand.datei = JSON.stringify({ version: 1, rev: 1, items: {}, amy: { 'amy-toast-ab12': { id: 'amy-toast-ab12', name: 'Avocado-Toast', bild: 'avocado', portionen: 1, zeit: 5, zutaten: ['1 Avocado', '2 Scheiben Brot'], schritte: ['Brot toasten', 'Avocado drauf'], notiz: '', by: 'Amy', at: t0, geaendert: t0 } } });
gh.zustand.version = 1;
gh.zustand.sha = 'sha1';
const browser = await starteBrowser();
const verbinden = async (p, name) => { await p.fill('#z-name', name); await p.click('#z-los'); return bis(async () => (await p.locator('#sync-text').innerText()) === 'Geteilt'); };
const mitLink = `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}`;
const ipad = await handy(browser, { attrappe: gh, adresse: mitLink, viewport: { width: 1180, height: 820 } });
const i = ipad.page;
check(await verbinden(i, 'Amy'), 'iPad: eingerichtet');
const iphone = await handy(browser, { attrappe: gh, adresse: mitLink });
const p = iphone.page;
check(await verbinden(p, 'Amy'), 'iPhone: eingerichtet');
const tobi = await handy(browser, { attrappe: gh, adresse: mitLink });
const t = tobi.page;
check(await verbinden(t, 'Tobi'), 'Tobi: eingerichtet');

// Kochmodus auf dem iPad
await i.click('[data-open="chili"]');
await i.click('#detail [data-act="kochmodus"]');
check(await i.locator('#kochmodus[open]').count() === 1 && /Schritt 1 von \d+/.test(await i.locator('.km-titel span').innerText()), 'Kochmodus: groß, Schritt 1');
const n = Number((await i.locator('.km-titel span').innerText()).match(/von (\d+)/)[1]);
check((await i.locator('.km-text').innerText()).length > 10 && await i.locator('.km-punkte button').count() === n, `der Schritt groß, unten ${n} Punkte`);
await i.click('#kochmodus [data-km="erledigt"]');
await i.click('#kochmodus [data-km="erledigt"]');
check((await i.locator('.km-titel span').innerText()).includes('Schritt 3 von'), 'zweimal „Erledigt“: Schritt 3');
await i.click('#kochmodus [data-km="zurueck"]');
check((await i.locator('.km-titel span').innerText()).includes('Schritt 2 von') && await i.locator('#kochmodus .km-ok').count() === 1 && await i.locator('#kochmodus [data-km="weiter"]').count() === 1, 'zurück: Schritt 2 ist abgehakt, der Knopf heißt „Weiter“');
await i.keyboard.press('ArrowRight');
check((await i.locator('.km-titel span').innerText()).includes('Schritt 3 von'), 'Pfeil nach rechts: weiter');
// Zu einem Schritt mit Timer und ihn starten
const mitTimer = await i.evaluate(() => {
  for (const b of document.querySelectorAll('#detail .step-li')) if (b.querySelector('.step-timer')) return Number(b.dataset.li);
  return -1;
});
await i.click(`#kochmodus .km-punkte [data-km-zu="${mitTimer}"]`);
await i.click('#kochmodus [data-km-timer]');
check(await bis(async () => (await i.locator('#km-timer .km-tm').count()) === 1), 'Timer im Kochmodus gestartet – oben läuft er mit');
check(await i.evaluate(() => document.querySelector('#kochmodus #toast') !== null), 'die Meldungen liegen im Kochmodus mit (sonst wären sie verdeckt)');
await i.keyboard.press('Escape');
check(await bis(async () => (await i.locator('#kochmodus[open]').count()) === 0) && await i.evaluate(() => document.querySelector('#app #toast') !== null), 'Escape beendet ihn – die Meldung ist wieder an ihrem Platz');
check(await i.locator('#detail .step[aria-pressed="true"]').count() === 2, 'im Rezept: dieselben zwei Haken');

// Auf dem iPhone: dieselben Haken, derselbe Timer
check(await bis(() => JSON.stringify(gh.liste()?.kochen?.amy?.schritte?.chili) === '[0,1]' && gh.liste()?.kochen?.amy?.timer?.length === 1, 8000), 'in GitHub: kochen.amy mit Haken und Timer');
await p.click('.tab[data-tab="rezepte"]');
await p.click('[data-open="chili"]');
check(await bis(async () => (await p.locator('#detail .step[aria-pressed="true"]').count()) === 2, 8000), 'iPhone: dieselben Haken wie auf dem iPad');
check(await bis(async () => (await p.locator('#timerleiste .tm').count()) === 1, 8000), 'iPhone: der Timer läuft hier mit');
// Auf dem iPhone weiterkochen – das iPad sieht es
await p.click('#detail [data-step="2"]');
check(await bis(async () => (await i.locator('#detail .step[aria-pressed="true"]').count()) === 3, 10000), 'iPhone hakt Schritt 3 ab – das iPad hat ihn auch');
// Tobi: sein eigener Stand
await t.click('.tab[data-tab="rezepte"]');
await t.click('[data-open="chili"]');
check(await t.locator('#detail .step[aria-pressed="true"]').count() === 0 && await t.locator('#timerleiste .tm').count() === 0 && !gh.liste()?.kochen?.tobi, 'Tobi: keine Haken, kein Timer – Amys Kochen ist ihrs');
check(!gh.zustand.nachrichten.some((m) => /· Bescheid/.test(m)), 'Kochen schickt keine Nachrichten (kein „· Bescheid“)');

// Amys Rezept im Kochmodus – bis zum Schluss
await p.click('#timerleiste [data-timer-stopp]');
await p.click('.tab[data-tab="amy"]');
await p.click('#view-amy .amy-karte[data-amy-open="amy-toast-ab12"]');
await p.click('#view-amy [data-act="amy-kochmodus"]');
check(await p.locator('#kochmodus[open]').count() === 1 && await p.evaluate(() => window.getComputedStyle(document.querySelector('.km-los')).backgroundImage.includes('gradient')), 'auch für Amys Rezepte – in Rosa');
await p.click('#kochmodus [data-km="erledigt"]');
await p.click('#kochmodus [data-km="erledigt"]');
check(await bis(async () => (await p.locator('#kochmodus[open]').count()) === 0) && await bis(async () => !(await p.locator('#lob').isHidden())), 'der letzte Haken: Kochmodus zu, das Lob kommt');
check(await p.locator('#view-amy .step[aria-pressed="true"]').count() === 2, 'in ihrem Rezept: beide Schritte abgehakt');
check([...ipad.fehler, ...iphone.fehler, ...tobi.fehler].length === 0, `keine Fehler in der Konsole${[...ipad.fehler, ...iphone.fehler, ...tobi.fehler].slice(0, 3).join(' | ')}`);
await browser.close();
ende();
