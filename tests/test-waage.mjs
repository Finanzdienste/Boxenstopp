/*
 * Die Waage: erst in Node (wiegen.js – welcher Schritt gewogen wird, der
 * Ablauf einer Wiegung, die Nährwerte mit gewogenen Mengen; liste.js –
 * profil.waage), dann im Browser mit der Attrappe statt der Verbindung
 * (localStorage __waage = "attrappe", window.__waage.senden(g)): einrichten,
 * im Kochmodus die Zutat mit Bild und Ziel, Abhaken von selbst, „Nehmen wir
 * so“, Topf leer und voll in den Rechner, Box für Box, danach die gewogenen
 * Mengen im Rezept.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, starteBrowser, handy, bis } from './hilfe.mjs';
import { wiegeplan, Wiegung, toleranz, grammIm, naehrwerteGewogen, boxenNaehrwerte } from '../js/wiegen.js';
import { leer, anwenden, bereinigen, opProfil, profilNachtrag, beschreibung, waageBereinigen } from '../js/liste.js';
import { einzelheiten } from '../js/einzelheiten.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const chili = daten.rezepte.find((r) => r.id === 'chili');
const schritte = chili.ablauf.flatMap((p) => p.schritte.map((s) => ({ s, t: p.t })));
const plan = (i) => wiegeplan(schritte[i].s, chili, { phase: schritte[i].t, boxen: 8 });
const nr = (re) => schritte.findIndex(({ s }) => re.test(s.d));

/* ------------------------------------------------------- Welcher Schritt */

const zw = plan(0);
check(zw?.art === 'zutat' && zw.ziel === 300 && zw.ca && zw.name === 'Zwiebeln' && zw.bild === 'onion' && zw.k === 'zwiebeln' && zw.schale === 1 && zw.von === 210 && zw.bis === 336, 'Zwiebeln ({zwiebeln} schälen → Schale 1): 300 g, „ca.“ (70–112 %), Bild onion');
const tm = plan(nr(/Tomatenmark abwiegen/));
check(tm?.art === 'zutat' && tm.ziel === 70 && !tm.ca && tm.von === 66 && tm.bis === 74 && tm.bild === 'canned-food', 'Tomatenmark abwiegen: 70 g genau (± 4 g), Bild canned-food');
const pap = plan(nr(/Paprika \(450 g\)/));
check(pap?.art === 'zutat' && pap.ziel === 450 && pap.ca && pap.name === 'Paprika' && pap.bild === 'bell-pepper' && pap.k === 'paprika' && pap.schale === 3, '„3 Paprika (450 g) … entkernen“: ohne Platzhalter – 450 g aus dem Text, die Zutat am Namen, Bild bell-pepper');
check(plan(nr(/Knoblauchzehen/)) === null && plan(nr(/In Schale 2 abmessen/)) === null && plan(nr(/Kidneybohnen und 1 Dose Mais/)) === null && plan(nr(/Brühwürfel/)) === null && plan(nr(/Limette auspressen/)) === null, 'nicht gewogen: Knoblauchzehen, Gewürze (EL/TL), Dosen, Milliliter, Limette');
check(plan(nr(/Rinderhack \(20 %\) ohne Öl/)) === null && plan(nr(/Schale 1 dazu/)) === null, 'beim Kochen wird nicht gewogen (auch wenn eine Menge im Text steht)');
check(plan(nr(/leer wiegen/))?.art === 'leer' && plan(nr(/mit dem Essen wiegen/))?.art === 'voll' && plan(nr(/auf die Waage stellen/))?.art === 'boxen' && plan(nr(/auf die Waage stellen/)).n === 8, 'Portionieren: Topf leer, mit Essen, dann Box für Box (8)');
check(wiegeplan({ d: 'Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen' }, chili, { phase: 'Portionieren' })?.art === 'anzeige', '„durch 8 teilen“: nur anzeigen');
check(wiegeplan({ d: '150 g Feta würfeln → Schale 4, 60 g schwarze Oliven halbieren → Schale 4' }, chili, { phase: 'Vorbereiten' }) === null && wiegeplan({ d: '{rinderhack} und {rinderhack-mager} mischen → Schale 1' }, chili, { phase: 'Vorbereiten' }) === null, 'zwei Mengen in einem Schritt: nicht gewogen');
const dv = wiegeplan({ d: '{ingwer} Ingwer schälen, davon 10 g fein reiben → Schale 2' }, { items: [{ k: 'ingwer', n: 'Ingwer', q: 30, u: 'g' }] }, { phase: 'Vorbereiten' });
check(dv?.ziel === 10 && !dv.ca && dv.bild === 'ginger-root', '„davon 10 g“: in die Schale kommen die 10 g, genau');
check(JSON.stringify(grammIm('1.275 g Hack, 1,5 kg Reis und 35.0 g Mehl in 400 ml')) === '[1275,1500,35]', 'Gramm lesen: 1.275 g ist Tausend, 1,5 kg sind 1500, 35.0 g sind 35, ml zählt nicht');
check(JSON.stringify(toleranz(70, false)) === '[66,74]' && JSON.stringify(toleranz(1000, false)) === '[980,1020]' && JSON.stringify(toleranz(450, true)) === '[315,504]', 'Toleranz: ± 4 g, ab 200 g ± 2 %, beim Schälen 70–112 %');

/* ------------------------------------------------------------- Ablauf */

// Werte wie von der Waage: alle 200 ms, mit etwas Zittern
const lauf = (w) => { let t = 0; let st = w.stand; return (g, n = 1) => { for (let i = 0; i < n; i++) { st = w.lesen({ g: g + (i % 2) * 0.4, at: t }); t += 200; } return st; }; };
let w = new Wiegung(zw);
let s = lauf(w);
let st = s(0, 8);
check(st.tara && st.ist === 0 && st.fehlt === 300 && !st.fertig, 'leere Waage steht: Nullpunkt gesetzt, 300 g fehlen');
st = s(312, 8);
check(st.ist === 312 && st.frage && !st.fertig, 'eine Schale (312 g) kommt erst jetzt drauf: „Schale draufgestellt?“ – noch nicht fertig');
w.tara();
st = s(312, 4);
check(st.ist === 0 && !st.frage, 'Tara: wieder null');
for (let g = 352; g <= 600; g += 40) st = s(g, 3);
st = s(600, 36);
check(st.fertig && st.angenommen === 288 && st.anteil > 0.9, 'nach und nach 288 g dazu (innerhalb 210–336, steht 1,5 s): fertig, 288 g angenommen');
w = new Wiegung(zw);
s = lauf(w);
s(0, 8);
st = s(800, 8);
check(st.ist === 0 && /Schale erkannt/.test(st.hinweis) && !st.frage, 'eine schwere Schale (800 g, weit über dem Ziel): von selbst erkannt und tariert');
w = new Wiegung(tm);
s = lauf(w);
st = s(300, 8);
check(st.tara && st.ist === 0, 'Schale schon drauf (300 g): sie ist der Nullpunkt');
st = s(370, 16);
check(st.fertig && st.angenommen === 70 && !st.frage, '70 g Tomatenmark auf einmal (genau, keine Schale): fertig');
w = new Wiegung(tm);
s = lauf(w);
s(0, 8);
st = s(81, 12);
check(!st.fertig && st.zuViel === 11 && st.ist === 81, '81 g statt 70: „zu viel“ (+11 g), nicht fertig');
check(w.so() === 81 && w.stand.fertig && w.stand.angenommen === 81, '„Nehmen wir so“: 81 g angenommen, fertig');
let lw = new Wiegung({ art: 'leer' });
s = lauf(lw);
st = s(40, 8);
check(!st.bereit && st.ist === 40, 'Topf leer: 40 g sind noch kein Topf');
st = s(2140, 8);
check(st.bereit && st.ist === 2140, 'Topf leer: 2.140 g stehen – übernehmen');
let pb = new Wiegung({ art: 'boxen', n: 3 }, { proBox: 400, leer: 2000 });
s = lauf(pb);
st = s(3200, 8);
check(st.modus === 'topf' && st.box === 1 && st.proBox === 400 && st.warten === null, 'Portionieren: der Topf steht auf der Waage – es zählt herunter, Box 1');
st = s(2800, 14);
check(st.box === 2 && st.boxen[0] === 400 && st.ist === 0, '400 g raus, steht: Box 1 fertig (400 g), Box 2');
st = s(2600, 8);
check(st.ist === 200 && st.fehlt === 200 && !st.zuViel, 'Box 2: 200 g drin, 200 fehlen');
st = s(2380, 8);
check(st.zuViel === 20 && st.box === 2, 'Box 2: 420 g – 20 g zu viel');
check(pb.so() === 420 && pb.stand.box === 3 && pb.stand.boxen[1] === 420, '„Nehmen wir so“: 420 g, Box 3');
st = s(2003, 14);
check(st.fertig && st.boxen.length === 3 && st.boxen[2] === 377, 'die letzte Box bekommt den Rest: Topf leer (Leergewicht aus dem Rechner) – fertig');
pb = new Wiegung({ art: 'boxen', n: 2 }, { proBox: 400 });
s = lauf(pb);
st = s(0, 8);
check(st.modus === 'box' && st.warten === 'box', 'Portionieren mit leerer Waage: die Boxen kommen auf die Waage');
st = s(45, 8);
check(st.warten === null && st.ist === 0, 'eine leere Box (45 g) steht: Nullpunkt');
st = s(447, 14);
check(st.boxen[0] === 402 && st.warten === 'weg' && st.box === 2, '402 g drin, steht: Box 1 fertig – erst runter damit');
s(0, 3);
s(46, 8);
st = s(445, 14);
check(st.fertig && st.boxen[1] === 399, 'Box 2 genauso: fertig');

/* ------------------------------------------------------ Gewogene Mengen */

const nw = naehrwerteGewogen(chili, { zwiebeln: 200, tomatenmark: 80 });
const dz = -100 / 100 * 35 + 10 / 100 * 90; // Zwiebeln 35 kcal/100 g, Tomatenmark 90 kcal/100 g
check(Math.abs(nw.kcal - (chili.total[0] + dz)) < 0.01 && Math.abs(nw.p - (chili.total[1] - 1.2 + 0.45)) < 0.01, 'Nährwerte mit gewogenen Mengen: 100 g Zwiebeln weniger, 10 g Tomatenmark mehr');
const je = boxenNaehrwerte({ kcal: 3200, p: 240, kh: 320, f: 120 }, [400, 400, 800]);
check(je.length === 3 && je[0].kcal === 800 && je[2].kcal === 1600 && je[2].p === 120 && je[1].g === 400, 'je Box ihr Anteil am Ganzen');
check(naehrwerteGewogen(chili, {}).kcal === chili.total[0] && boxenNaehrwerte({ kcal: 1 }, []).length === 0, 'ohne Gewogenes: wie das Rezept');

/* --------------------------------------------------------- liste.json */

const konfig = { url: 'https://abc.supabase.co/', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.test', kanal: 'waage' };
check(JSON.stringify(waageBereinigen(konfig)) === JSON.stringify({ url: 'https://abc.supabase.co', key: konfig.key, kanal: 'waage' }) && waageBereinigen({ url: 'http://abc', key: konfig.key }) === null && waageBereinigen({ url: konfig.url, key: 'kurz' }) === null && waageBereinigen({ url: konfig.url, key: konfig.key, kanal: 'nicht ok!' }) === null && waageBereinigen({ url: konfig.url, key: konfig.key }).kanal === 'waage', 'waageBereinigen: https, langer Schlüssel, Kanal nur Buchstaben – ohne Kanal „waage“');
let st2 = anwenden(leer(), opProfil({ waage: konfig }, 'Tobi'));
check(st2.profil.waage.url === 'https://abc.supabase.co' && st2.profil.waage.by === 'Tobi' && st2.profil.waage.at, 'opProfil({ waage }): in liste.json unter profil.waage, mit by und at');
check(bereinigen(JSON.parse(JSON.stringify(st2))).profil.waage.key === konfig.key, 'übersteht Speichern und Bereinigen');
check(/Waage eingerichtet/.test(beschreibung(leer(), st2)) && /Waage entfernt/.test(beschreibung(st2, anwenden(st2, opProfil({ waage: null })))), 'Commit-Nachricht: „Waage eingerichtet“, „Waage entfernt“');
check(!anwenden(st2, opProfil({ waage: null })).profil.waage, 'opProfil({ waage: null }): weg');
const ez = einzelheiten(leer(), st2);
check(ez.some((e) => e.b === 'Sonstiges' && e.a === 'Waage' && e.x[0] === 'abc.supabase.co, Kanal „waage“') && einzelheiten(st2, anwenden(st2, opProfil({ waage: null }))).some((e) => e.a === 'Waage' && e.x[0] === 'entfernt'), 'Überblick: „Waage: abc.supabase.co, Kanal „waage““, später „entfernt“');
const roh = { profil: { boxen: 8 } };
const nt = profilNachtrag(roh, { profil: {} }, st2);
check(nt.length === 1 && nt[0].teil.waage.url === 'https://abc.supabase.co' && profilNachtrag({ profil: { waage: konfig } }, { profil: {} }, st2).length === 0, 'eine ältere App-Fassung lässt profil.waage weg: kommt wieder dazu');

/* ------------------------------------------------------------- Browser */

const browser = await starteBrowser();
const ipad = await handy(browser, { viewport: { width: 1180, height: 820 }, skript: () => { localStorage.setItem('__waage', JSON.stringify('attrappe')); } });
const p = ipad.page;
/** Werte schicken wie die Waage: alle 120 ms, so lange, bis die Zeit um ist. */
const senden = async (g, ms) => {
  const ende = Date.now() + ms;
  let i = 0;
  while (Date.now() < ende) {
    await p.evaluate(([x, k]) => window.__waage.senden(x + (k % 2) * 0.3), [g, i++]);
    await new Promise((f) => { setTimeout(f, 120); });
  }
};
const titel = async () => p.locator('.km-titel span').innerText();

// Einrichten
await p.click('.kopf-einst');
check((await p.locator('#e-waage').innerText()).includes('Waage einrichten'), 'Einstellungen: die Karte „Waage“ – noch nicht eingerichtet');
await p.click('#e-waage [data-act="e-waage-aendern"]');
await p.fill('#e-waage-url', 'https://abc.supabase.co');
await p.fill('#e-waage-key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.test');
await p.click('#e-waage-form button[type="submit"]');
check(await bis(async () => (await p.locator('#e-waage').innerText()).includes('Eingerichtet: abc.supabase.co')), 'eingerichtet: abc.supabase.co, Kanal „waage“');
await p.click('#e-waage [data-act="e-waage-test"]');
await senden(123, 500);
check(await bis(async () => /Waage da: 123 g/.test(await p.locator('#e-waage-stand').innerText())), '„Verbindung testen“: Waage da, 123 g');

// Der Kochmodus mit Waage
await p.click('#view-einstellungen .back');
await p.click('[data-open="chili"]');
await p.click('#detail [data-act="kochmodus"]');
check(await p.locator('#kochmodus[open]').count() === 1 && (await titel()).includes('Schritt 1 von'), 'Kochmodus: Schritt 1 (Zwiebeln)');
await senden(0, 1700);
const wg = p.locator('#km-waage .km-waage');
check(await bis(async () => (await wg.count()) === 1 && (await wg.innerText()).includes('Zwiebeln') && (await wg.innerText()).includes('noch 300 g')), 'unter dem Text: Zwiebeln, 0 / ca. 300 g, „noch 300 g“');
check((await p.locator('#km-waage img').getAttribute('src')).includes('onion.svg') && (await wg.innerText()).includes('→ Schale 1'), 'mit dem Bildchen der Zwiebel und „→ Schale 1“');
await senden(90, 1700);
await senden(180, 1700);
check(await bis(async () => /noch 120 g/.test(await wg.innerText())), 'nach und nach 180 g drin: „noch 120 g“');
await senden(290, 3200);
check(await bis(async () => (await titel()).includes('Schritt 2 von') && (await p.locator('.km-punkte button.f').count()) === 1, 4000), '290 g stehen 1,5 s: Schritt 1 hakt sich ab, es geht zu Schritt 2');
check(await p.locator('#km-waage .km-waage').count() === 0, 'Schritt 2 (Knoblauchzehen): nichts zu wiegen');
await p.click('#detail .step[data-step="0"]', { force: true }).catch(() => {});

// Tomatenmark genau, „Nehmen wir so“
const iTm = nr(/Tomatenmark abwiegen/);
await p.click(`#kochmodus .km-punkte [data-km-zu="${iTm}"]`);
await senden(300, 1700);
check(await bis(async () => (await wg.innerText()).includes('Tomatenmark') && (await wg.innerText()).includes('/ 70 g')), 'Tomatenmark: 0 / 70 g (die Schale war schon drauf – Nullpunkt)');
await senden(381, 1700);
check(await bis(async () => /\+11 g zu viel/.test(await wg.innerText()) && (await p.locator('#km-waage [data-km="so"]').count()) === 1), '81 g: „+11 g zu viel“ und „Nehmen wir so“');
await p.click('#km-waage [data-km="so"]');
check(await bis(async () => (await p.locator('.km-punkte button.f').count()) === 2 && !(await titel()).includes(`Schritt ${iTm + 1} von`)), '„Nehmen wir so“: abgehakt, weiter');
check(await p.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.gewogen.v1'))?.chili?.zutaten?.tomatenmark === 81), 'gemerkt: 81 g Tomatenmark');

// Topf leer, mit Essen, Box für Box
await p.click(`#kochmodus .km-punkte [data-km-zu="${nr(/leer wiegen/)}"]`);
await senden(2140, 1700);
check(await bis(async () => /Gefäß leer/.test(await wg.innerText()) && !(await p.locator('#km-waage [data-km="uebernehmen"]').isDisabled())), 'Topf leer: 2.140 g stehen – „Übernehmen“');
await p.click('#km-waage [data-km="uebernehmen"]');
check(await bis(async () => (await p.locator('#pot-empty').inputValue()) === '2140'), 'im Rechner: Gefäß leer 2140');
await p.click(`#kochmodus .km-punkte [data-km-zu="${nr(/mit dem Essen wiegen/)}"]`);
await senden(5340, 1700);
check(await bis(async () => !(await p.locator('#km-waage [data-km="uebernehmen"]').isDisabled())), 'mit Essen: 5.340 g stehen');
await p.click('#km-waage [data-km="uebernehmen"]');
check(await bis(async () => (await p.locator('#pot-full').inputValue()) === '5340' && (await p.locator('#per-box').innerText()).includes('400 g')), 'im Rechner: Mit Essen 5340, pro Box 400 g');
check(await bis(async () => (await titel()).includes(`Schritt ${nr(/auf die Waage stellen/) + 1} von`)), 'weiter zum Portionieren');
await senden(5340, 1700);
check(await bis(async () => /Box 1 von 8/.test(await wg.innerText()) && /Topf auf der Waage/.test(await wg.innerText())), 'Box 1 von 8 – der Topf steht auf der Waage, es zählt herunter');
await senden(4940, 3000);
check(await bis(async () => /Box 2 von 8/.test(await wg.innerText()) && /1: 400 g/.test(await wg.innerText())), '400 g raus: Box 1 fertig, Box 2');
await senden(4520, 1500);
check(await bis(async () => /\+20 g zu viel/.test(await wg.innerText())), 'Box 2: 420 g – 20 g zu viel');
await p.click('#km-waage [data-km="so"]');
check(await bis(async () => /Box 3 von 8/.test(await wg.innerText())), '„Nehmen wir so“: Box 3');
await p.keyboard.press('Escape');
check(await bis(async () => (await p.locator('#kochmodus[open]').count()) === 0), 'Kochmodus zu');
check(await bis(async () => (await p.locator('#d-gewogen').innerText()).includes('Tomatenmark 81 g') && (await p.locator('#d-gewogen').innerText()).includes('Zwiebeln 290 g')), 'im Rezept unter dem Rechner: Gewogen – Zwiebeln 290 g, Tomatenmark 81 g');
await senden(1234, 400);
check(await bis(async () => /Waage: 1\.234 g/.test(await p.locator('#calc-waage').innerText())), 'unter dem Rechner: was die Waage gerade zeigt');
await p.click('#calc-waage [data-act="waage-voll"]');
check((await p.locator('#pot-full').inputValue()) === '1234', '„Als Mit Essen“: übernommen');
await p.click('#detail [data-act="gewogen-weg"]');
check(await bis(() => p.locator('#d-gewogen').isHidden()), '„Vergessen“: weg');
await p.click('#detail [data-act="zurueck"]');
check(await p.evaluate(() => !window.__waage.stand().hoert), 'Rezept zu: die App hört nicht mehr zu');
check(ipad.fehler.length === 0, `keine Fehler in der Konsole ${ipad.fehler.slice(0, 3).join(' | ')}`);
await browser.close();
ende();
