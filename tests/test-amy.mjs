/*
 * Amys Rezepte: erst die Logik in Node (js/amy.js – Zeilen lesen,
 * Einkaufsliste, Nährwerte, Kosten, Schritte – und der Stand in liste.js),
 * dann der Reiter im Browser auf zwei Handys mit der GitHub-Attrappe.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { zutatLesen, listenMenge, amyEinkauf, amyNaehrwerte, amyKosten, amyAblauf, alsRezept, amyBereinigen, slug, neueAmyId, schrittMinuten, AMY_ID } from '../js/amy.js';
import { leer, anwenden, bereinigen, opAmy, opAmyWeg, opZusammen, opTeil } from '../js/liste.js';
import { timerPlan } from '../js/zeiten.js';

const { check, ende } = pruefer();
const D = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const einheiten = {};
for (const r of D.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') einheiten[it.k] = it.u;
const daten = { katalog: D.katalog, naehrwerte: D.naehrwerte, preise: D.preise, einheiten };
const lies = (z) => zutatLesen(z, D.katalog);

// --- Zeilen lesen
let z = lies('500 g Hähnchenbrust, gewürfelt');
check(z.q === 500 && z.u === 'g' && z.name === 'Hähnchenbrust' && z.h === 'gewürfelt' && z.k === 'haehnchenbrust' && z.kat.n === 'Hähnchenbrustfilet' && z.a === '500 g', `„500 g Hähnchenbrust, gewürfelt“ (${JSON.stringify(z)})`);
z = lies('1 kg Kartoffeln');
check(z.q === 1000 && z.u === 'g' && z.k === 'kartoffeln', '1 kg → 1000 g Kartoffeln');
z = lies('1½ EL Sojasauce');
check(z.q === 1.5 && z.u === 'EL' && z.k === 'sojasauce' && z.a === '1½ EL', `1½ EL Sojasauce (${z.q} ${z.u})`);
z = lies('1/2 TL Zimt');
check(z.q === 0.5 && z.u === 'TL' && z.gewuerz, `½ TL Zimt ist ein Gewürz (${z.kat.c})`);
z = lies('2–3 Zwiebeln');
check(z.q === 3 && z.u === 'Stk' && z.k === 'zwiebeln', '2–3 Zwiebeln: für den Einkauf 3 Stück');
z = lies('2 Knoblauchzehen');
check(z.q === 2 && z.u === 'Zehe' && z.k === 'knoblauch', '2 Knoblauchzehen → 2 Zehen Knoblauch');
z = lies('1 Dose Kokosmilch (400 ml)');
check(z.q === 1 && z.u === 'Dose' && z.k === 'kokosmilch' && z.h === '400 ml', '1 Dose Kokosmilch (400 ml)');
z = lies('Salz, Pfeffer');
check(z.q === null && !z.kaufen, 'Salz, Pfeffer: nicht einkaufen');
z = lies('200 ml Wasser');
check(!z.kaufen, 'Wasser kauft man nicht');
z = lies('1 Prise Salz');
check(!z.kaufen && z.gewuerz, '1 Prise Salz');
z = lies('Vanillezucker');
check(z.k === 'amyz-vanillezucker' && z.kat.n === 'Vanillezucker' && z.kat.c === 'gewuerz', `Unbekanntes bekommt einen eigenen Schlüssel und eine geratene Abteilung (${z.k}, ${z.kat.c})`);
z = lies('- 250g Spaghetti');
check(z.q === 250 && z.u === 'g' && z.k === 'spaghetti', 'Spiegelstrich und „250g“ ohne Leerzeichen');
z = lies('ca. 100 g Feta');
check(z.q === 100 && z.k === 'feta', '„ca. 100 g Feta“');
z = lies('1 Bund Koriander');
check(z.q === 1 && z.u === 'Bund' && z.kat.c === 'obst', '1 Bund Koriander kommt zu Obst & Gemüse');
check(lies('3 Eier').k === 'eier' && lies('3 Eier').u === 'Stk', '3 Eier');
check(lies('2 TL Paprikapulver').k !== 'paprika', 'Paprikapulver ist keine Paprika');

// --- Mengen passend zur Zeile auf der Liste
check(JSON.stringify(listenMenge(lies('2 Zwiebeln'), daten)) === JSON.stringify({ q: 200, u: 'g' }), `2 Zwiebeln → 200 g, wie bei den festen Rezepten (${JSON.stringify(listenMenge(lies('2 Zwiebeln'), daten))})`);
check(JSON.stringify(listenMenge(lies('300 g Paprika'), daten)) === JSON.stringify({ q: 2, u: 'Stk' }), `300 g Paprika → 2 Stück (${JSON.stringify(listenMenge(lies('300 g Paprika'), daten))})`);
check(JSON.stringify(listenMenge(lies('400 ml Kokosmilch'), daten)) === JSON.stringify({ q: 1, u: 'Dose' }), '400 ml Kokosmilch → 1 Dose');
check(JSON.stringify(listenMenge(lies('2 EL Sojasauce'), daten)) === JSON.stringify({ q: 2, u: 'EL' }), `2 EL Sojasauce bleibt 2 EL (${JSON.stringify(listenMenge(lies('2 EL Sojasauce'), daten))})`);

// --- Ein ganzes Rezept
const R = amyBereinigen({
  id: 'amy-kokos-curry-ab12',
  name: 'Kokos-Curry mit Hähnchen',
  bild: 'curry-rice',
  portionen: 4,
  zutaten: '500 g Hähnchenbrust\n2 Zwiebeln\n1 Zwiebel\n2 Knoblauchzehen\n1 Dose Kokosmilch\n2 EL Currypaste\n250 g Basmatireis\n1 TL Kurkuma\nSalz, Pfeffer\n1 Bund Koriander\nVanillezucker',
  schritte: 'Reis waschen und 12 Min. kochen\nZwiebeln würfeln\nHähnchen 5 Min. scharf anbraten\nKokosmilch dazu und 15 Min. köcheln\nTopping:\nKoriander hacken und drüber',
});
check(R && R.zutaten.length === 11 && R.schritte.length === 6 && AMY_ID.test(R.id), 'bereinigt: Zeilen als Liste');
const e = amyEinkauf(R, daten);
const je = Object.fromEntries(e.map((x) => [x.k, x]));
check(!je.kurkuma && !je['amyz-salz-pfeffer'] && je.haehnchenbrust.teil.q === 500 && je.zwiebeln.teil.q === 300 && je.zwiebeln.teil.u === 'g', `Einkauf: ohne Gewürze, Zwiebeln zusammen 300 g (${e.map((x) => `${x.k} ${x.teil.q ?? x.teil.t}${x.teil.u || ''}`).join(', ')})`);
check(je['amyz-koriander']?.kat.c === 'obst' && !je['amyz-vanillezucker'], 'Koriander kommt mit, Vanillezucker (Gewürz) nicht');
const nw = amyNaehrwerte(R, daten);
check(nw.kcal > 350 && nw.kcal < 800 && nw.p > 25 && nw.bekannt >= 6 && nw.unbekannt.includes('Koriander'), `Nährwerte pro Portion ≈ ${nw.kcal} kcal, ${nw.p} g P (ohne: ${nw.unbekannt.join(', ')})`);
const ko = amyKosten(R, daten);
check(ko.gesamt > 4 && ko.gesamt < 20 && Math.abs(ko.portion - ko.gesamt / 4) < 1e-9 && ko.luecken >= 1, `Kosten ≈ ${ko.gesamt.toFixed(2)} € (${ko.portion.toFixed(2)} € pro Portion, ${ko.luecken} ohne Preis)`);
const ab = amyAblauf(R);
check(ab.length === 2 && ab[0].t === 'Zubereitung' && ab[1].t === 'Topping' && ab[0].schritte.length === 4 && ab[0].schritte[0].min === 12 && ab[0].schritte[1].min === 2, `Schritte in Abschnitten; „Topping:“ beginnt einen neuen (${ab.map((p) => `${p.t} ${p.schritte.map((s) => s.min).join('/')}`).join(' | ')})`);
check(timerPlan(ab[0].schritte[2])?.min === 5 && timerPlan(ab[0].schritte[1]) === null, 'Timer bei „5 Min. anbraten“, nicht bei „Zwiebeln würfeln“');
check(schrittMinuten('Zwiebeln würfeln') === 2 && schrittMinuten('15 Min. köcheln') === 15, 'Minuten je Schritt: aus dem Text, sonst grob');
const x = alsRezept(R, daten);
check(x.id === R.id && x.ablauf.length === 2 && x.items.some((it) => it.k === 'haehnchenbrust' && it.kat.n === 'Hähnchenbrustfilet'), 'als Rezept für Timer, Tempo und Liste');
check(slug('Omas Pfannkuchen!') === 'omas-pfannkuchen' && AMY_ID.test(neueAmyId('Süßes Ü-Ei')), 'ids aus dem Namen');

// --- Im Stand (liste.js)
let s = anwenden(leer(), opAmy(R, 'Amy'));
check(s.amy[R.id].by === 'Amy' && s.amy[R.id].name === R.name && s.amy[R.id].geaendert, 'opAmy legt an, mit Amy als Autorin');
const erst = s.amy[R.id].at;
s = anwenden(s, opAmy({ ...R, name: 'Kokos-Curry deluxe' }, 'Tobi'));
check(s.amy[R.id].name === 'Kokos-Curry deluxe' && s.amy[R.id].by === 'Amy' && s.amy[R.id].at === erst, 'ändern: der Name ist neu, Autorin und Anlegedatum bleiben');
s = anwenden(s, opTeil('haehnchenbrust', R.id, { q: 500, u: 'g', h: '' }, D.katalog.haehnchenbrust));
check(s.items.haehnchenbrust.parts[R.id].q === 500, 'ihre Zutaten liegen als Teil mit ihrer id auf der Liste');
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).amy) === JSON.stringify(s.amy), 'übersteht Speichern und Bereinigen');
check(!bereinigen({ amy: { 'quatsch id': { name: 'x' }, 'amy-ok-1': { name: '' } } }).amy['amy-ok-1'], 'kaputte Einträge fallen weg');
const viele = {};
for (let i = 0; i < 70; i++) viele[`amy-r${i}`] = { name: `R ${i}`, geaendert: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:00:${String(i % 60).padStart(2, '0')}Z` };
check(Object.keys(bereinigen({ amy: viele }).amy).length === 60, 'höchstens 60 Rezepte');
s = anwenden(s, opAmyWeg(R.id));
check(!s.amy[R.id], 'opAmyWeg löscht');
const z2 = anwenden(anwenden(leer(), opAmy({ ...R, id: 'amy-a-1', name: 'A' })), opZusammen({}, {}, { 'amy-a-1': { ...R, id: 'amy-a-1', name: 'B' }, 'amy-b-2': { ...R, id: 'amy-b-2', name: 'C' } }));
check(z2.amy['amy-a-1'].name === 'A' && z2.amy['amy-b-2'].name === 'C', 'zusammen: Vorhandenes bleibt, Neues kommt dazu');

// --- Im Browser: zwei Handys, eine GitHub-Attrappe
const browser = await starteBrowser();
const gh = githubAttrappe();
const tobi = await handy(browser, { attrappe: gh });
const t = tobi.page;
await t.click('.tab[data-tab="einkauf"]');
await t.click('[data-act="z-oeffnen"]');
await t.fill('#z-name', 'Tobi');
await t.fill('#z-token', SCHLUESSEL);
await t.click('#z-los');
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: eingerichtet');
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const a = amy.page;
await a.fill('#z-name', 'Amy');
await a.click('#z-los');
check(await bis(async () => (await a.locator('#sync-text').innerText()) === 'Geteilt'), 'Amy: eingerichtet');

// Der Reiter: rosa, mit Schreibschrift
await a.click('.tab[data-tab="amy"]');
check(await a.evaluate(() => document.documentElement.dataset.tab) === 'amy' && (await a.locator('#amy-titel').innerText()) === 'Amys Rezepte', 'der vierte Reiter: „Amys Rezepte“');
const farben = await a.evaluate(() => ({ akzent: window.getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), titel: window.getComputedStyle(document.querySelector('#amy-titel')).fontFamily, bg: window.getComputedStyle(document.body).backgroundColor, leiste: document.querySelector('meta[name="theme-color"]').content }));
check(farben.akzent === '#E0457F' && /Pacifico/.test(farben.titel) && farben.bg === 'rgb(255, 241, 247)' && farben.leiste === '#FFEAF3', `alles rosa: Akzent ${farben.akzent}, Hintergrund ${farben.bg}, Titel in ${farben.titel.split(',')[0]}`);
await a.click('.tab[data-tab="rezepte"]');
check(await a.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) === '#2445C9', 'bei den anderen Reitern wieder blau');
await a.click('.tab[data-tab="amy"]');
check((await a.locator('.amy-leer').innerText()).includes('Noch keine Rezepte'), 'leer: „Noch keine Rezepte hier“');

// Neues Rezept
await a.click('[data-act="amy-neu"]');
await a.fill('#amy-name', 'Kokos-Curry');
await a.locator('.amy-bild', { has: a.locator('input[value="curry-rice"]') }).click();
await a.fill('#amy-portionen', '4');
await a.fill('#amy-zutaten', '500 g Hähnchenbrust\n2 Zwiebeln\n1 Dose Kokosmilch\n1 TL Kurkuma\nSalz, Pfeffer\n1 Bund Koriander');
const chips = await a.locator('#amy-erkannt li').allInnerTexts();
check(chips.length === 6 && chips[0].includes('Hähnchenbrustfilet') && (await a.locator('#amy-erkannt .ak-katalog').count()) === 3 && chips[3].includes('Gewürz') && chips[4].includes('nicht einkaufen') && chips[5].includes('neu'), `beim Tippen: was die App erkennt (${chips.map((c) => c.replace(/\s+/g, ' ')).join(' | ')})`);
await a.fill('#amy-schritte', 'Zwiebeln würfeln\nHähnchen 5 Min. scharf anbraten\nKokosmilch dazu und 15 Min. köcheln\nKoriander drüber');
// Ein Neuladen mitten im Tippen: der Entwurf ist noch da
await a.reload({ waitUntil: 'load' });
check(await bis(async () => (await a.locator('#amy-name').count()) === 1) && (await a.inputValue('#amy-name')) === 'Kokos-Curry' && (await a.inputValue('#amy-schritte')).includes('15 Min. köcheln') && await a.locator('input[value="curry-rice"]').isChecked(), 'nach dem Neuladen steht der Entwurf noch da');
await a.click('#amy-speichern');
check(await bis(async () => (await a.locator('#amy-d-titel').count()) === 1) && (await a.locator('#amy-d-titel').innerText()) === 'Kokos-Curry', 'gespeichert: das Rezept ist offen');
check(/≈ \d+,\d\d € pro Portion/.test(await a.locator('.amy-d-fakten').innerText()) && /\d+ kcal/.test(await a.locator('.amy-etikett').innerText()), `mit Kosten und Nährwerten pro Portion (${(await a.locator('.amy-d-fakten').innerText())} | ${(await a.locator('.amy-etikett').innerText()).replace(/\s+/g, ' ')})`);
check(await a.locator('#view-amy .step-li').count() === 4 && await a.locator('#view-amy .step-timer').count() === 2, 'vier Schritte, Timer nur bei 5 und 15 Min.');
check(await bis(() => Object.values(gh.liste()?.amy || {}).some((r) => r.name === 'Kokos-Curry' && r.by === 'Amy')), 'liegt in GitHub (liste.json, amy), mit Amy als Autorin');

// Tobi sieht es auch
await t.click('.tab[data-tab="amy"]');
check(await bis(async () => (await t.locator('.amy-karte').count()) === 1), 'Tobi sieht Amys Rezept');
check((await t.locator('.amy-karte').innerText()).includes('Kokos-Curry'), '… mit Namen');

// Auf die gemeinsame Einkaufsliste – und zusammen mit einem festen Rezept
await a.click('[data-act="amy-alle-dazu"]');
check(await bis(() => gh.liste()?.items?.haehnchenbrust?.parts && Object.keys(gh.liste().items.haehnchenbrust.parts).some((k) => k.startsWith('amy-'))), 'Alles auf die Einkaufsliste: das Hähnchen liegt in GitHub');
const amyId = Object.keys(gh.liste().amy)[0];
const liste = gh.liste();
check(liste.items.zwiebeln.parts[amyId].q === 200 && liste.items.zwiebeln.parts[amyId].u === 'g' && liste.items.kokosmilch.parts[amyId].u === 'Dose' && !liste.items.kurkuma && liste.items['amyz-koriander'].name === 'Koriander', 'Zwiebeln in Gramm wie bei den anderen, Kurkuma nicht, Koriander als eigene Zeile');
await t.click('.tab[data-tab="rezepte"]');
await t.click('[data-open="butter-chicken"]');
await t.click('[data-act="alle-dazu"]');
await t.click('.tab[data-tab="einkauf"]');
const huhn = t.locator('#list-body .item', { has: t.locator('.item-name', { hasText: /^Hähnchenbrustfilet$/ }) });
check(await bis(async () => (await huhn.locator('.item-qty').innerText()).startsWith('1,3 kg')), `Hähnchen aus beiden Rezepten in einer Zeile: 800 g + 500 g = 1,3 kg (${await huhn.locator('.item-qty').innerText().catch(() => '–')})`);
check((await huhn.locator('.item-sub').innerText()).includes('♡ Kokos-Curry 500 g'), `darunter steht, für welches Rezept (${await huhn.locator('.item-sub').innerText()})`);
const chip = t.locator(`#forrow [data-amy-open="${amyId}"]`);
check(await chip.count() === 1 && (await chip.innerText()) === '♡ Kokos-Curry', 'oben bei „Für“: ♡ Kokos-Curry');
await chip.click();
check(await bis(async () => (await t.locator('#amy-d-titel').innerText().catch(() => '')) === 'Kokos-Curry') && await t.evaluate(() => document.documentElement.dataset.tab) === 'amy', 'antippen öffnet ihr Rezept in ihrem Reiter');

// Kochen: abhaken (Tempo misst mit), Timer
await a.click('[data-amy-step="0"]');
await a.click('[data-amy-step="1"]');
check(await a.locator('[data-amy-step="1"][aria-pressed="true"]').count() === 1 && await a.locator('[data-amy-step="2"].jetzt').count() === 1, 'Schritte abhaken, der nächste ist markiert');
check(await a.evaluate((id) => JSON.parse(localStorage.getItem('boxenstopp.tempo.v1') || '{}').offen?.[id]?.h?.length, amyId) === 2, 'das Tempo misst auch bei ihren Rezepten');
await a.click('#view-amy .step-li[data-li="2"] .step-timer');
check(await bis(async () => (await a.locator('#timerleiste .tm').count()) === 1) && (await a.locator('#timerleiste .tm-label').innerText()).startsWith('Kokos-Curry:'), 'Timer läuft, oben in der Leiste');
await a.click('.tab[data-tab="rezepte"]');
await a.click('#timerleiste .tm');
check(await bis(async () => (await a.locator('#amy-d-titel').isVisible())) && await a.evaluate(() => document.documentElement.dataset.tab) === 'amy', 'Tipp auf den Timer: zurück zu ihrem Rezept');
await a.click('#timerleiste [data-timer-stopp]');

// Bearbeiten, löschen, rückgängig
await a.click('[data-act="amy-bearbeiten"]');
await a.fill('#amy-name', 'Kokos-Curry deluxe');
await a.click('#amy-speichern');
check(await bis(async () => (await a.locator('#amy-d-titel').innerText()) === 'Kokos-Curry deluxe') && await bis(() => gh.liste()?.amy?.[amyId]?.name === 'Kokos-Curry deluxe'), 'bearbeitet: neuer Name, auch in GitHub');
check(await bis(async () => (await t.locator('#amy-d-titel').innerText().catch(() => '')) === 'Kokos-Curry deluxe'), 'Tobi sieht die Änderung');
await a.click('[data-act="amy-loeschen"]');
check((await a.locator('.amy-actions .confirm').innerText()).includes('Wirklich löschen?'), 'Löschen fragt nach');
await a.click('[data-act="amy-loeschen-ja"]');
check(await bis(() => !gh.liste()?.amy?.[amyId] && !Object.keys(gh.liste()?.items?.haehnchenbrust?.parts || {}).includes(amyId)), 'gelöscht – mitsamt den Zutaten auf der Liste');
check(await bis(async () => (await t.locator('#amy-d-titel').count()) === 0 && (await t.locator('.amy-leer').count()) === 1), 'bei Tobi auch weg');
await a.click('#toast button');
check(await bis(() => gh.liste()?.amy?.[amyId]?.name === 'Kokos-Curry deluxe'), 'Rückgängig: wieder da');

// Amy kauft bei Aldi ein: der Weg durch den Laden liegt danach auch in GitHub
await a.click('.tab[data-tab="einkauf"]');
await a.selectOption('#l-laden-wahl', 'Aldi');
for (const k of await a.$$eval('#list-body .grp:not(.grp-done) [data-check]', (xs) => xs.slice(0, 3).map((x) => x.dataset.check))) await a.click(`[data-check="${k}"]`);
await a.selectOption('#l-laden-wahl', '');
check(await bis(() => gh.liste()?.wege?.Aldi?.n === 1), 'drei Haken bei Aldi, dann ein anderer Laden: der Weg liegt in GitHub');

// Eine ältere App-Fassung schreibt liste.json ohne `amy` und `wege`: Amys Handy legt beides wieder dazu
const roh = gh.liste();
delete roh.amy;
delete roh.wege;
roh.rev += 1;
gh.zustand.datei = `${JSON.stringify(roh, null, 1)}\n`;
gh.zustand.version += 1;
gh.zustand.sha = `sha${gh.zustand.version}`;
check(await bis(() => gh.liste()?.amy?.[amyId]?.name === 'Kokos-Curry deluxe' && gh.liste()?.wege?.Aldi?.n === 1, 8000), 'ältere Fassung ließ `amy` und `wege` weg – Amys Handy schreibt beides zurück');

check(tobi.fehler.length === 0 && amy.fehler.length === 0, `keine Fehler in der Konsole${[...tobi.fehler, ...amy.fehler].length ? `: ${[...tobi.fehler, ...amy.fehler].slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
