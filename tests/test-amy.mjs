/*
 * Amys Rezepte: erst die Logik in Node (js/amy.js – Zeilen lesen,
 * Einkaufsliste, Nährwerte, Kosten, Schritte, die Schätzung der KI für
 * Unbekanntes – und der Stand in liste.js), dann der Reiter im Browser auf
 * zwei Handys mit der GitHub-Attrappe.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { zutatLesen, listenMenge, amyEinkauf, amyNaehrwerte, amyKosten, offeneZeilen, zeileSchluessel, wertBereinigen, amyWertBereinigen, amyAblauf, alsRezept, amyBereinigen, slug, neueAmyId, schrittMinuten, AMY_ID, tagsBereinigen, tagsAusText, alleTags, hatTags, tagFarbe, MAX_TAGS } from '../js/amy.js';
import { leer, anwenden, bereinigen, opAmy, opAmyWeg, opAmyTags, opAmyWerte, opZusammen, opTeil } from '../js/liste.js';
import { rumpfWerte, werteBereinigen, werteText, zeilenAbdruck, WERTE_SCHEMA } from '../js/amy-werte.js';
import { ANBIETER } from '../js/ki.js';
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
// So schreibt Amy wirklich: Größe vor der Einheit, Klammer mitten im Namen
z = lies('1 kleine Flasche Ceasar Salad Dressing');
check(z.q === 1 && z.u === 'Flasche' && z.name === 'Ceasar Salad Dressing' && z.h === 'klein' && z.a === '1 kleine Flasche' && z.kat.c === 'vorrat', `„1 kleine Flasche Ceasar Salad Dressing“: Flasche erkannt, „klein“ als Zusatz (${z.q} ${z.u} ${z.name} | ${z.h} | ${z.kat.c})`);
z = lies('1 großen (Dürüm)Wrap');
check(z.q === 1 && z.name === 'Wrap' && z.h === 'Dürüm, groß' && z.kat.c === 'trocken', `„1 großen (Dürüm)Wrap“ → Wrap (Dürüm, groß) (${z.name} | ${z.h} | ${z.kat.c})`);
z = lies('5 Dino Nuggies');
check(z.q === 5 && z.u === 'Stk' && z.k === 'amyz-dino-nuggies' && z.kat.c === 'fleisch', `Nuggets gehören zu Fleisch, nicht zu Sonstiges (${z.kat.c})`);
z = lies('2 große Zwiebeln');
check(z.k === 'zwiebeln' && z.q === 2 && z.h === 'groß', '„2 große Zwiebeln“ sind Zwiebeln');
// Auf der Liste zusammengelegt oder verschoben – gilt auch hier
z = zutatLesen('leckere Dino nuggies', D.katalog, { gleich: { 'amyz-leckere-dino-nuggies': 'amyz-dino-nuggets' } });
check(z.k === 'amyz-dino-nuggets' && z.zusammen && z.name === 'Leckere Dino nuggies', `zusammengelegt: „leckere Dino nuggies“ landet bei „Dino nuggets“ (${z.k})`);
z = zutatLesen('Nuggets', D.katalog, { gleich: { 'n:nuggets': 'amyz-dino-nuggies' } });
check(z.k === 'amyz-dino-nuggies' && z.zusammen, 'auch über den Namen („n:nuggets“)');
z = zutatLesen('300 g Hühnchenbrustwürfel', D.katalog, { gleich: { 'amyz-huehnchenbrustwuerfel': 'haehnchenbrust' } });
check(z.k === 'haehnchenbrust' && z.kat.n === 'Hähnchenbrustfilet' && amyNaehrwerte({ zutaten: ['300 g Hühnchenbrustwürfel'], portionen: 1 }, { ...daten, gleich: { 'amyz-huehnchenbrustwuerfel': 'haehnchenbrust' } }).bekannt === 1, `mit einer Katalog-Zutat zusammengelegt: dann auch mit Nährwerten (${z.k})`);
z = zutatLesen('5 Dino Nuggies', D.katalog, { abteilungen: { 'amyz-dino-nuggies': 'tk' } });
check(z.kat.c === 'tk', 'verschoben (Tiefkühl): Amys Zutat steht dann auch dort');
check(amyEinkauf({ zutaten: ['leckere Dino nuggies'] }, { ...daten, gleich: { 'amyz-leckere-dino-nuggies': 'amyz-dino-nuggets' } })[0].k === 'amyz-dino-nuggets', '„Alles auf die Liste“ legt es gleich in die zusammengelegte Zeile');

// --- Tags
check(JSON.stringify(tagsBereinigen(['#gesund', 'Gesund', '  bauch   freundlich ', 'x'.repeat(40), '', 7, '<b>'])) === JSON.stringify(['gesund', 'bauch freundlich', 'x'.repeat(24), 'b']), `Tags: ohne #, doppelt (groß/klein egal), zu lang, Unsinn (${JSON.stringify(tagsBereinigen(['#gesund', 'Gesund', '  bauch   freundlich ', 'x'.repeat(40), '', 7, '<b>']))})`);
check(tagsBereinigen(Array.from({ length: 12 }, (_, i) => `t${i}`)).length === MAX_TAGS && MAX_TAGS === 8, 'höchstens acht Tags');
check(JSON.stringify(tagsAusText('gesund, schnell;süß\n')) === JSON.stringify(['gesund', 'schnell', 'süß']), '„gesund, schnell“ sind zwei Tags');
check(JSON.stringify(alleTags({ 'amy-a': ['gesund', 'schnell'], 'amy-b': ['Gesund'], 'amy-c': ['süß'] })) === JSON.stringify([['gesund', 2], ['schnell', 1], ['süß', 1]]), 'alle Tags, die häufigsten zuerst');
check(JSON.stringify(alleTags({ 'amy-a': ['gesund'], 'amy-b': ['süß'] }, new Set(['amy-b']))) === JSON.stringify([['süß', 1]]), '… oder nur für bestimmte Rezepte');
check(hatTags(['Gesund', 'schnell'], ['gesund']) && hatTags(['a'], []) && !hatTags(['gesund'], ['gesund', 'schnell']) && !hatTags(undefined, ['x']), 'Filter: alle gewählten Tags müssen dran sein');
check(tagFarbe('gesund') === tagFarbe('Gesund') && [...'abcdefghij'].every((c) => tagFarbe(c) >= 0 && tagFarbe(c) < 6), 'derselbe Tag hat immer dieselbe von sechs Farben');
let st = anwenden(leer(), [opAmy({ id: 'amy-t-1', name: 'T', zutaten: [], schritte: [] }, 'Amy'), opAmyTags('amy-t-1', ['gesund', 'Gesund', 'bauchfreundlich'])]);
check(JSON.stringify(st.amyTags['amy-t-1']) === JSON.stringify(['gesund', 'bauchfreundlich']), 'opAmyTags: die Tags eines Rezepts (bereinigt)');
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(st))).amyTags) === JSON.stringify(st.amyTags) && !bereinigen({ amyTags: { quatsch: ['a'], 'amy-x-1': [] } }).amyTags.quatsch, 'übersteht Speichern und Bereinigen, Unsinn fällt weg');
check(!anwenden(st, opAmyTags('amy-t-1', [])).amyTags['amy-t-1'] && !anwenden(st, opAmyWeg('amy-t-1')).amyTags['amy-t-1'], 'leer oder Rezept gelöscht: die Tags sind weg');
st = anwenden(st, opZusammen({}, {}, { amyTags: { 'amy-t-1': ['anders'], 'amy-t-2': ['süß'] } }));
check(st.amyTags['amy-t-1'][0] === 'gesund' && st.amyTags['amy-t-2'][0] === 'süß', 'zusammen: Vorhandenes bleibt, Fehlendes kommt dazu');

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

// --- „150g + 75g“ zusammen; was die App nicht kennt, schätzt die KI (amy-werte.js)
z = lies('150g+ 75g shredded Cheddar');
check(z.q === 225 && z.u === 'g' && z.k === 'cheddar' && z.h === '150 g + 75 g', `„150g+ 75g shredded Cheddar“: 225 g Cheddar, die Aufteilung als Zusatz (${z.q} ${z.u} ${z.k} – ${z.h})`);
z = lies('75 g + 35 g Gouda');
check(z.q === 110 && z.u === 'g' && z.name === 'Gouda', '„75 g + 35 g Gouda“: 110 g');
z = lies('2 + 1 Eier');
check(z.q === 3 && z.name === 'Eier', '„2 + 1 Eier“: 3');
const MAC = { id: 'amy-mac', name: 'Crack and Cheese', portionen: 4, zutaten: ['250 g Makkaroni', '200 g Gouda', '1 Handvoll Parmesan', 'Feta', '1 Packung Dino Nuggies', 'Salz'] };
const nw0 = amyNaehrwerte(MAC, daten);
check(nw0.unbekannt.includes('Gouda') && nw0.unbekannt.includes('Feta') && nw0.unbekannt.includes('Parmesan') && !nw0.unbekannt.includes('Salz') && nw0.geschaetzt === 0, `ohne Schätzung: Gouda, Parmesan (Handvoll), Feta (ohne Menge) und die Nuggies fehlen – Salz zählt nicht (${nw0.unbekannt.join(', ')})`);
const offen = offeneZeilen(MAC, daten);
check(offen.join('|') === '200 g Gouda|1 Handvoll Parmesan|Feta|1 Packung Dino Nuggies', `offene Zeilen für die KI: ${offen.join(' | ')}`);
const W = {
  [zeileSchluessel('200 g Gouda')]: { g: 200, kcal: 356, p: 25, kh: 0, f: 28, eur: 2.2 },
  [zeileSchluessel('1 Handvoll Parmesan')]: { g: 25, kcal: 999, p: 99, kh: 99, f: 99, eur: 99 },
  [zeileSchluessel('Feta')]: { g: 150, kcal: 270, p: 17, kh: 1, f: 22, eur: 1.4 },
  [zeileSchluessel('1 Packung Dino Nuggies')]: { g: 250, kcal: 240, p: 14, kh: 18, f: 12, eur: 3.5 },
};
const mitW = { ...daten, werte: W };
const nw1 = amyNaehrwerte(MAC, mitW);
const gouda = 356 * 2;
const parmesanKatalog = D.naehrwerte.parmesan.pro100.kcal * 0.25;
check(!nw1.unbekannt.length && nw1.geschaetzt === 4 && Math.abs(nw1.kcal - Math.round((D.naehrwerte[lies('250 g Makkaroni').k].pro100.kcal * 2.5 + gouda + parmesanKatalog + 270 * 1.5 + 240 * 2.5) / 4)) <= 1, `mit Schätzung: alles drin – beim Parmesan die Werte aus dem Katalog, nur die Gramm geschätzt (${nw1.kcal} kcal)`);
const ko1 = amyKosten(MAC, mitW);
const ko0 = amyKosten(MAC, daten);
check(ko0.luecken >= 3 && !ko1.luecken && ko1.geschaetzt === 4 && Math.abs(ko1.gesamt - (ko0.gesamt + 2.2 + D.preise.parmesan.je_g * 25 + 1.4 + 3.5)) < 0.01, `Kosten mit Schätzung: Gouda, Feta, Nuggies geschätzt, Parmesan zum Richtpreis mal 25 g (${ko1.gesamt.toFixed(2)} €)`);
check(!offeneZeilen(MAC, mitW).length, 'geschätzt: nichts mehr offen');
check(wertBereinigen({ gramm: 100, kcal: 200, p: 10, kh: 20, f: 5, eur: 1 })?.g === 100 && wertBereinigen({ g: 100, kcal: 2000, p: 1, kh: 1, f: 1, eur: 1 }) === null && wertBereinigen({ g: 100, kcal: 500, p: 60, kh: 60, f: 10, eur: 1 }) === null && wertBereinigen({ g: 100, kcal: 100, p: 1, kh: 1, f: 1 }) === null, 'Schätzungen prüfen: Gramm, kcal bis 950, P+KH+F höchstens 100 g, Preis nötig');
const wb = amyWertBereinigen({ at: 'x', z: { ...W, 'gibt es nicht mehr': W[zeileSchluessel('Feta')] } }, MAC);
check(Object.keys(wb.z).length === 3 && !wb.z['gibt es nicht mehr'] && !wb.z[zeileSchluessel('1 Handvoll Parmesan')], 'in der Liste: nur Zeilen, die das Rezept noch hat, und nur stimmige Werte');
// Die Anfrage an die KI
const rw = rumpfWerte({ anbieter: 'anthropic', r: MAC, zeilen: offen });
const rg = rumpfWerte({ anbieter: 'gemini', r: MAC, zeilen: offen });
check(rw.model === ANBIETER.anthropic.modell && rw.output_config?.format?.type === 'json_schema' && rw.messages[0].content[0].text === werteText(MAC, offen) && werteText(MAC, offen).startsWith('Rezept: Crack and Cheese (für 4 Portionen)\nZutaten:\n- 200 g Gouda') && rg.response_format.schema === WERTE_SCHEMA && rg.stream, 'die Anfrage: Rezept, Portionen und nur die offenen Zeilen; JSON nach Schema bei Claude und Gemini');
const wz = werteBereinigen({ zutaten: [{ zeile: '200 g Gouda', gramm: 200, kcal: 356, p: 25, kh: 0, f: 28, eur: 2.2 }, { zeile: 'nicht gefragt', gramm: 1, kcal: 1, p: 0, kh: 0, f: 0, eur: 0 }, { zeile: 'Feta', gramm: 'viel' }] }, offen);
check(Object.keys(wz).join() === zeileSchluessel('200 g Gouda'), 'die Antwort: nur gefragte Zeilen mit stimmigen Werten');
check(zeilenAbdruck(['a', 'B']) === zeilenAbdruck(['b', 'A']) && zeilenAbdruck(['a']) !== zeilenAbdruck(['a', 'b']), 'Fingerabdruck der offenen Zeilen: Reihenfolge egal');
// Im Stand: opAmyWerte nur für Rezepte, die es gibt; beim Bearbeiten fallen alte Zeilen weg; mit dem Rezept weg
let sw = anwenden(leer(), opAmy(MAC, 'Amy'));
sw = anwenden(sw, opAmyWerte('amy-mac', { [zeileSchluessel('200 g Gouda')]: W[zeileSchluessel('200 g Gouda')] }, 'Amy'));
sw = anwenden(sw, opAmyWerte('amy-mac', { [zeileSchluessel('Feta')]: W[zeileSchluessel('Feta')] }, 'Tobi'));
sw = anwenden(sw, opAmyWerte('amy-gibtsnicht', { x: W[zeileSchluessel('Feta')] }, 'Amy'));
check(Object.keys(sw.amyWerte['amy-mac'].z).length === 2 && !sw.amyWerte['amy-gibtsnicht'], 'opAmyWerte: kommt dazu, nur für vorhandene Rezepte');
check(Object.keys(bereinigen(JSON.parse(JSON.stringify(sw))).amyWerte['amy-mac'].z).length === 2, 'übersteht das Bereinigen beim Laden');
sw = anwenden(sw, opAmy({ ...MAC, zutaten: ['250 g Makkaroni', '200 g Gouda'] }, 'Amy'));
check(Object.keys(sw.amyWerte['amy-mac'].z).join() === zeileSchluessel('200 g Gouda'), 'bearbeitet: die Schätzung für „Feta“ ist weg, Gouda bleibt');
const altFassung = JSON.parse(JSON.stringify(sw));
delete altFassung.amyWerte;
const zurueck = anwenden(bereinigen(altFassung), opZusammen({}, {}, { amyWerte: sw.amyWerte }));
check(Object.keys(zurueck.amyWerte['amy-mac']?.z || {}).length === 1, 'eine ältere Fassung lässt amyWerte weg – opZusammen bringt sie wieder');
sw = anwenden(sw, opAmyWeg('amy-mac'));
check(!sw.amyWerte['amy-mac'], 'Rezept weg: Schätzung weg');

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
const z2 = anwenden(anwenden(leer(), opAmy({ ...R, id: 'amy-a-1', name: 'A' })), opZusammen({}, {}, { amy: { 'amy-a-1': { ...R, id: 'amy-a-1', name: 'B' }, 'amy-b-2': { ...R, id: 'amy-b-2', name: 'C' } } }));
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
check(await a.evaluate(() => document.documentElement.dataset.tab) === 'amy' && (await a.locator('#amy-titel').innerText()) === 'Amys Bereich', 'der zweite Reiter: „Amys Bereich“');
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

// Bearbeiten (mit Tags), löschen, rückgängig
await a.click('[data-act="amy-bearbeiten"]');
await a.fill('#amy-name', 'Kokos-Curry deluxe');
const vorschlag = await a.locator('[data-amy-tag-dazu]').allInnerTexts();
check(['gesund', 'bauchfreundlich', 'schnell'].every((x) => vorschlag.includes(x)), `Tags: die App schlägt welche vor (${vorschlag.join(', ')})`);
await a.click('[data-amy-tag-dazu="gesund"]');
await a.fill('#amy-tag-text', 'bauchfreundlich');
await a.press('#amy-tag-text', 'Enter');
check(await bis(async () => JSON.stringify(await a.locator('.amy-tags-dran li').allInnerTexts()) === JSON.stringify(['gesund', 'bauchfreundlich'])) && await a.locator('#amy-form').count() === 1 && (await a.inputValue('#amy-tag-text')) === '', 'Enter im Tag-Feld legt den Tag an – gespeichert wird noch nicht');
await a.type('#amy-tag-text', 'Schnell,');
check(await bis(async () => (await a.locator('.amy-tags-dran li').count()) === 3) && (await a.inputValue('#amy-tag-text')) === '', 'ein Komma macht den Tag auch fertig');
await a.click('[data-amy-tag-weg="2"]');
check(await a.locator('.amy-tags-dran li').count() === 2 && (await a.locator('[data-amy-tag-dazu]').allInnerTexts()).includes('schnell'), '× nimmt ihn wieder weg');
await a.click('#amy-speichern');
check(await bis(async () => (await a.locator('#amy-d-titel').innerText()) === 'Kokos-Curry deluxe') && await bis(() => gh.liste()?.amy?.[amyId]?.name === 'Kokos-Curry deluxe'), 'bearbeitet: neuer Name, auch in GitHub');
check(await bis(() => JSON.stringify(gh.liste()?.amyTags?.[amyId]) === JSON.stringify(['gesund', 'bauchfreundlich'])) && !('tags' in gh.liste().amy[amyId]), 'die Tags liegen in GitHub unter amyTags, nicht im Rezept');
check(JSON.stringify(await a.locator('.amy-d-tags .amy-tag').allInnerTexts()) === JSON.stringify(['gesund', 'bauchfreundlich']), 'im Rezept stehen die Tags');
check(await bis(async () => (await t.locator('#amy-d-titel').innerText().catch(() => '')) === 'Kokos-Curry deluxe') && await bis(async () => (await t.locator('.amy-d-tags .amy-tag').count()) === 2), 'Tobi sieht die Änderung, mit Tags');
await a.click('[data-act="amy-loeschen"]');
check((await a.locator('.amy-actions .confirm').innerText()).includes('Wirklich löschen?'), 'Löschen fragt nach');
await a.click('[data-act="amy-loeschen-ja"]');
check(await bis(() => !gh.liste()?.amy?.[amyId] && !Object.keys(gh.liste()?.items?.haehnchenbrust?.parts || {}).includes(amyId)), 'gelöscht – mitsamt den Zutaten auf der Liste');
check(await bis(async () => (await t.locator('#amy-d-titel').count()) === 0 && (await t.locator('.amy-leer').count()) === 1), 'bei Tobi auch weg');
await a.click('#toast button');
check(await bis(() => gh.liste()?.amy?.[amyId]?.name === 'Kokos-Curry deluxe' && gh.liste()?.amyTags?.[amyId]?.length === 2), 'Rückgängig: wieder da, mit ihren Tags');

// Ein zweites Rezept – dann filtern und sortieren
await a.click('[data-act="amy-neu"]');
await a.fill('#amy-name', 'Bananen-Porridge');
await a.fill('#amy-zutaten', '2 Bananen\n100 g Haferflocken');
await a.click('[data-amy-tag-dazu="schnell"]');
await a.click('#amy-speichern');
check(await bis(async () => (await a.locator('#amy-d-titel').innerText().catch(() => '')) === 'Bananen-Porridge'), 'zweites Rezept, mit „schnell“');
await a.click('[data-act="amy-liste"]');
const chipsF = async () => (await a.locator('[data-amy-filter]').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
check(JSON.stringify(await chipsF()) === JSON.stringify(['Alle', 'bauchfreundlich 1', 'gesund 1', 'schnell 1']), `über den Karten: die Tags zum Filtern (${(await chipsF()).join(' | ')})`);
const karten = () => a.locator('#view-amy .amy-karte b').allInnerTexts();
await a.click('[data-amy-filter="schnell"]');
check(await bis(async () => JSON.stringify(await karten()) === JSON.stringify(['Bananen-Porridge'])) && (await a.locator('#amy-treffer').innerText()).includes('1 Rezept mit „schnell“'), '„schnell“ gewählt: nur das Porridge');
await a.click('[data-amy-filter="gesund"]');
check(await bis(async () => (await a.locator('#view-amy .amy-leer').innerText().catch(() => '')).includes('Kein Rezept hat alle diese Tags')), 'zwei Tags: nur Rezepte mit beiden – hier keins');
await a.click('#view-amy .amy-leer [data-amy-filter=""]');
check(await bis(async () => (await karten()).length === 2), '„Alle zeigen“');
await a.selectOption('#amy-sort', 'name');
check(JSON.stringify(await karten()) === JSON.stringify(['Bananen-Porridge', 'Kokos-Curry deluxe']), 'sortiert nach Name');
await a.selectOption('#amy-sort', 'tags');
const gruppen = async () => (await a.locator('.amy-gruppe-t .amy-tag').allInnerTexts());
check(JSON.stringify(await gruppen()) === JSON.stringify(['bauchfreundlich', 'gesund', 'schnell']), `„Nach Tags“: ein Abschnitt je Tag (${(await gruppen()).join(', ')})`);
await a.reload({ waitUntil: 'load' });
check(await bis(async () => (await a.locator('#amy-sort').count()) === 1) && (await a.inputValue('#amy-sort')) === 'tags', 'die Sortierung merkt sich das Handy');
await a.click('#view-amy .amy-gruppe [data-amy-open] >> nth=0');
await a.click('.amy-d-tags [data-amy-tag-filter="gesund"]');
check(await bis(async () => JSON.stringify(await karten()) === JSON.stringify(['Kokos-Curry deluxe'])) && (await a.getAttribute('[data-amy-filter="gesund"]', 'aria-pressed')) === 'true', 'Tipp auf einen Tag im Rezept: alle Rezepte damit');
await a.click('[data-amy-filter=""]');
await a.selectOption('#amy-sort', 'neu');

// Amy kauft bei Aldi ein: der Weg durch den Laden liegt danach auch in GitHub
await a.click('.tab[data-tab="einkauf"]');
await a.selectOption('#l-laden-wahl', 'Aldi');
for (const k of await a.$$eval('#list-body .grp:not(.grp-done) [data-check]', (xs) => xs.slice(0, 3).map((x) => x.dataset.check))) await a.click(`[data-check="${k}"]`);
await a.selectOption('#l-laden-wahl', '');
check(await bis(() => gh.liste()?.wege?.Aldi?.n === 1), 'drei Haken bei Aldi, dann ein anderer Laden: der Weg liegt in GitHub');

// Eine ältere App-Fassung schreibt liste.json ohne `amy`, `amyTags` und `wege`: Amys Handy legt alles wieder dazu
const roh = gh.liste();
delete roh.amy;
delete roh.amyTags;
delete roh.wege;
roh.rev += 1;
gh.zustand.datei = `${JSON.stringify(roh, null, 1)}\n`;
gh.zustand.version += 1;
gh.zustand.sha = `sha${gh.zustand.version}`;
check(await bis(() => gh.liste()?.amy?.[amyId]?.name === 'Kokos-Curry deluxe' && gh.liste()?.wege?.Aldi?.n === 1 && gh.liste()?.amyTags?.[amyId]?.length === 2, 8000), 'ältere Fassung ließ `amy`, `amyTags` und `wege` weg – Amys Handy schreibt alles zurück');

// --- Amys Bereich: oben der Schalter – Notizen (Blätter), Verträglich, Vorschläge für Tobi
await a.click('.tab[data-tab="amy"]');
check(JSON.stringify(await a.locator('.amy-teil').evaluateAll((xs) => xs.map((x) => x.dataset.amyTeil))) === JSON.stringify(['rezepte', 'notizen', 'vertraeglich', 'wuensche']), 'oben: Rezepte · Notizen · Verträglich · Vorschläge');
await a.click('[data-amy-teil="notizen"]');
check((await a.locator('.nb-leer').innerText()).includes('Noch keine Blätter'), 'Notizen: noch keine Blätter');
await a.click('[data-act="nb-neu"]');
await a.fill('#nb-titel', 'Herbst-Ideen');
await a.fill('#nb-text', '- Kürbis-Bowl\n- Linsensuppe\nOmas Gulasch');
await a.fill('#nb-tag-text', 'herbst,');
const blaetter = () => Object.values(gh.liste()?.notizbuch || {});
check(await bis(() => blaetter().some((x) => x.titel === 'Herbst-Ideen' && x.text.includes('Gulasch') && x.tags.join() === 'herbst' && x.by === 'Amy'), 8000), 'Blatt gespeichert – Titel, Text, Tag, ohne Speichern-Knopf');
await a.click('#nb-text');
await a.keyboard.press('Control+End');
await a.keyboard.type('\nNoch eine Idee');
check(await bis(() => blaetter().some((x) => x.text.endsWith('Noch eine Idee')), 8000), 'weitergetippt: auch gespeichert');
check((await a.inputValue('#nb-text')).endsWith('Noch eine Idee') && await a.evaluate(() => document.activeElement?.id === 'nb-text'), 'beim Speichern bleibt das Blatt stehen – Text und Cursor');
await a.click('.nb-farbe[data-nb-farbe="blau"]');
check(await bis(() => blaetter().some((x) => x.farbe === 'blau')), 'Farbe: blau');
await a.click('[data-act="nb-zu"]');
check(await a.locator('.nb-tab.f-blau:has-text("Herbst-Ideen")').count() === 1 && (await a.locator('.nb-tab small').innerText()).includes('Kürbis-Bowl'), 'in der Liste: Farbe, Titel, Vorschau');
await a.click('[data-act="nb-neu"]');
await a.click('[data-act="nb-zu"]');
check(await bis(() => blaetter().length === 1), 'ein leeres Blatt verschwindet wieder');
check(await a.locator('[data-nb-tag="herbst"]').count() === 1, 'die Tags zum Filtern stehen über den Blättern');
await t.click('.tab[data-tab="amy"]');
await t.click('[data-amy-teil="notizen"]');
check(await bis(async () => (await t.locator('.nb-tab:has-text("Herbst-Ideen")').count()) === 1), 'Tobi sieht das Blatt auch');
await a.click('.nb-tab:has-text("Herbst-Ideen")');
await a.click('[data-act="nb-weg"]');
check(await bis(() => !blaetter().length), 'Blatt gelöscht');
await a.click('#toast button');
check(await bis(() => blaetter().some((x) => x.titel === 'Herbst-Ideen' && x.text.endsWith('Noch eine Idee'))), 'Rückgängig: wieder da, ganz');

// Verträglich: „Zwiebel – geht nicht“ trifft Zwiebeln im Chili
await a.click('[data-amy-teil="vertraeglich"]');
await a.fill('#vt-name', 'Zwiebel');
await a.click('[data-vt-stufe="nicht"]');
await a.click('#vt-form button[type="submit"]');
check(await bis(() => gh.liste()?.vertraeglich?.amy?.['n:zwiebel']?.stufe === 'nicht'), 'Zwiebel: geht nicht – unter Amy in der Liste');
check(await a.locator('.vt-gruppe.vt-nicht .vt-e:has-text("Zwiebel")').count() === 1, 'steht unter „Geht nicht“');
await a.click('.tab[data-tab="rezepte"]');
check(await bis(async () => (await a.locator('[data-open="chili"] .pill-vt.vt-nicht').count()) === 1), 'Chili hat Zwiebeln: an der Karte ✗');
check((await a.locator('[data-open="chili"] .pill-vt').innerText()).includes('für dich'), 'für Amy heißt es „für dich“');
check((await a.locator('[data-filter="vertraeglich"]').innerText()).startsWith('Passt für mich'), 'Filter „Passt für mich“');
await a.click('[data-filter="vertraeglich"]');
check(await a.locator('[data-open="chili"]').count() === 0 && await a.locator('#grid .box').count() > 0, 'gefiltert: ohne Chili, aber nicht leer');
await a.click('[data-filter="alle"]');
await a.click('[data-open="chili"]');
check((await a.locator('#detail .vt-hinweis').innerText()).includes('Zwiebel') && await a.locator('#detail .ing-name .vt-zeichen.vt-nicht').count() >= 1, 'im Rezept: der Hinweis oben und ✗ an der Zutat');
await a.click('[data-act="zurueck"]');
await t.click('.tab[data-tab="rezepte"]');
// Bei Tobi ist das Butter Chicken von vorhin noch offen – zurück zu den Karten
if (await t.locator('#detail:not([hidden])').count()) await t.click('#detail [data-act="zurueck"]');
check(await bis(async () => (await t.locator('[data-open="chili"] .pill-vt').count()) === 1 && (await t.locator('[data-open="chili"] .pill-vt').innerText()).includes('für Amy')), 'bei Tobi: „nicht für Amy“');

// Vorschläge: Amy schreibt, Tobi antwortet und hakt ab
await a.click('.tab[data-tab="amy"]');
await a.click('[data-amy-teil="wuensche"]');
await a.fill('#ws-text', 'Die Liste soll nach Läden sortieren');
await a.click('#ws-form button[type="submit"]');
const vorschlaege = () => Object.values(gh.liste()?.wuensche || {});
check(await bis(() => vorschlaege().some((w) => w.text.includes('Läden') && w.by === 'Amy')), 'Vorschlag in der Liste');
check(gh.zustand.nachrichten.some((m) => m.startsWith('Amy:') && m.includes('ein neuer Vorschlag') && m.includes('· Bescheid')), 'Commit „ein neuer Vorschlag · Bescheid“ – Tobi bekommt eine Push-Nachricht');
await t.click('.tab[data-tab="amy"]');
await t.click('[data-amy-teil="wuensche"]');
check(await bis(async () => (await t.locator('.ws-e').count()) === 1), 'Tobi sieht ihn');
await t.click('[data-ws-antworten]');
await t.fill('form[data-ws-antwort] input', 'Kommt ♡');
await t.click('form[data-ws-antwort] button[type="submit"]');
await t.click('.ws-e [data-ws-fertig]');
check(await bis(() => vorschlaege().some((w) => w.erledigt && w.antwort === 'Kommt ♡' && w.erledigtVon === 'Tobi' && w.antwortVon === 'Tobi')), 'Tobi antwortet und hakt ab');
check(await bis(async () => (await a.locator('.ws-fertig-auf').innerText().catch(() => '')).includes('Erledigt (1)')), 'bei Amy: „Erledigt (1)“');
await a.click('.ws-fertig-auf');
check((await a.locator('.ws-erledigt .ws-antwort').innerText()).includes('Kommt ♡'), 'mit Tobis Antwort');
await a.click('[data-amy-teil="rezepte"]');

// So ging am 29.10. Amys Chicken Ceasar Wrap verloren: Tobis Handy hatte die Liste gelesen, als seine App-Fassung
// Amys Rezepte noch nicht kannte – zwischengespeichert ohne sie, mit derselben Datei-Kennung. Nach dem Update
// setzte er etwas auf die Liste und schrieb dabei auf dem alten Stand weiter. (Das Format bleibt hier gleich – so
// wäre es bei neuen Feldern innerhalb von Einträgen, die der Format-Abgleich nicht bemerkt.) Amys Handy ist
// dabei zu, wie an dem Abend – es soll nicht dazwischenschreiben.
await amy.ctx.close();
let zuletztSha = gh.zustand.sha;
await bis(async () => { await new Promise((ok) => { setTimeout(ok, 1500); }); const ruhig = gh.zustand.sha === zuletztSha; zuletztSha = gh.zustand.sha; return ruhig; }, 20000);
const tobiKennt = () => t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.liste.github.v1') || 'null')?.sha);
check(await bis(async () => (await tobiKennt()) === gh.zustand.sha && gh.liste()?.amy?.[amyId], 10000), 'Tobis Handy kennt den neuesten Stand');
await t.evaluate(() => {
  const k = 'boxenstopp.liste.github.v1';
  const g = JSON.parse(localStorage.getItem(k));
  g.stand.amy = {};
  g.stand.amyTags = {};
  localStorage.setItem(k, JSON.stringify(g));
});
await t.reload({ waitUntil: 'load' });
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await t.click('.tab[data-tab="einkauf"]');
await t.fill('#add-input', 'Kaminholz');
await t.press('#add-input', 'Enter');
check(await bis(() => Object.values(gh.liste()?.items || {}).some((d) => d.name === 'Kaminholz'), 8000), 'Tobi setzt nach dem „Update“ etwas auf die Liste');
check(gh.liste().amy?.[amyId]?.name === 'Kokos-Curry deluxe' && gh.liste().amyTags?.[amyId]?.length === 2, 'Amys Rezept und seine Tags sind noch da – der Start liest die Datei erst frisch, bevor er schreibt');
check(await t.evaluate((id) => !!JSON.parse(localStorage.getItem('boxenstopp.liste.github.v1'))?.stand?.amy?.[id], amyId), 'und Tobis Handy hat es wieder');

check(tobi.fehler.length === 0 && amy.fehler.length === 0, `keine Fehler in der Konsole${[...tobi.fehler, ...amy.fehler].length ? `: ${[...tobi.fehler, ...amy.fehler].slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
