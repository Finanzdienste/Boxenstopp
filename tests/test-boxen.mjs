/*
 * Boxen pro Rezept: die Rechnung (js/boxen.js, direkt in Node) – Zutaten,
 * Gewürze, Mengen in den Schritten, Nährwerte, Kosten, Zeiten – und im
 * Browser: einstellen, Rezepte und Liste ziehen mit, der Hinweis bei einer
 * eigenen Liste.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, handy, githubAttrappe, starteBrowser, bis } from './hilfe.mjs';
import { leer, beschreibung, anwenden, opProfil, bereinigen, profilNachtrag } from '../js/liste.js';
import { aufBoxen, textSkalieren, zahlLesen, bruch, rundStueck, rundGramm, kaufMenge, boxenBereinigen } from '../js/boxen.js';
import { aufZiel } from '../js/zielrechner.js';
import { platzhalter } from '../js/format.js';
import { zeitVon } from '../js/zeiten.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const nach = (id) => daten.rezepte.find((r) => r.id === id);
const s2 = (t, n = 2, art = 'schritt') => textSkalieren(t, n / 8, { P: 8, n, art });
const tipp = (t, n = 2) => textSkalieren(t, n / 8, { P: 8, n, art: 'tipp' });

/* ------------------------------------------------------------ Zahlen */

check(zahlLesen('1½') === 1.5 && zahlLesen('1,5') === 1.5 && zahlLesen('½') === 0.5 && zahlLesen('1.275') === 1275 && Number.isNaN(zahlLesen('x')), 'Zahlen lesen: 1½, 1,5, ½, 1.275 (Tausender)');
check(bruch(0.25) === '¼' && bruch(1.5) === '1½' && bruch(2) === '2' && bruch(0.125) === '⅛' && bruch(1.2) === '1,2', 'Brüche: ¼, 1½, 2, ⅛ – sonst mit Komma');
check(rundStueck(0.75, 'ganz') === 1 && rundStueck(0.1) === 0.125 && rundStueck(0.6) === 0.5 && rundStueck(1.3) === 1.5 && rundStueck(5.4) === 5, 'Stück runden: ganz mindestens 1, teilbar in Vierteln und Halben');
check(rundStueck(0.75, 'frisch') === 1 && rundStueck(1.5, 'frisch') === 2 && rundStueck(0.7, 'frisch') === 0.75 && rundStueck(0.6, 'frisch') === 0.5 && rundStueck(0.25, 'frisch') === 0.25, 'Gemüse runden: ganz, wenn sonst nur ein kleiner Rest bliebe (¾ → 1, 1½ → 2), sonst wie teilbar');
check(rundGramm(62.5) === 65 && rundGramm(212) === 210 && rundGramm(0.4) === 1 && rundGramm(17.5) === 18, 'Gramm runden: auf 5, ab 200 auf 10, mindestens 1');
check(kaufMenge(0.5, 'Dose') === 1 && kaufMenge(2.25, 'Stk') === 3 && kaufMenge(62.5, 'g') === 62.5 && kaufMenge(2, 'Dose') === 2, 'Zum Kaufen: ½ Dose ist eine Dose, Gramm bleiben');
check(boxenBereinigen(2) === 2 && boxenBereinigen('8') === 8 && boxenBereinigen(0) === null && boxenBereinigen(9) === null && boxenBereinigen(2.5) === null, 'Boxen: 1 bis 8, ganze Zahl');

/* ------------------------------------------------------- Texte, einzeln */

check(s2('3 Zwiebeln ({zwiebeln}) schälen → Schale 1') === '1 Zwiebel ({zwiebeln}) schälen → Schale 1', 'Schritt: 3 Zwiebeln → 1 Zwiebel (lieber ganz als ¾), Platzhalter und Schale bleiben');
check(s2('2 gehäufte EL Kreuzkümmel') === '1½ gehäufte TL Kreuzkümmel' && s2('2 EL') === '1½ TL' && s2('3 EL', 4) === '1½ EL' && s2('1 EL', 4) === '1½ TL', 'Löffel: EL wird TL, wenn es weniger als ein EL ist');
check(s2('½ TL Zimt') === '⅛ TL Zimt' && s2('½ TL Zimt', 1) === '1 Prise Zimt' && s2('1–2 TL Chiliflocken') === '¼–½ TL Chiliflocken' && s2('¼–½ TL', 1) === '1 Prise', 'Löffel: ⅛ TL, darunter 1 Prise; Spannen bleiben Spannen');
check(s2('1 EL + 1 TL') === '1 TL' && s2('2 TL + 1 Prise') === '½ TL + 1 Prise' && s2('1 TL + zum Abschmecken') === '¼ TL + zum Abschmecken', 'Löffel: „1 EL + 1 TL“ ist eine Menge, Prise bleibt Prise');
check(s2('2 Brühwürfel in 400 ml heißem Wasser auflösen') === '½ Brühwürfel in 100 ml heißem Wasser auflösen' && s2('davon 1,2 kg abwiegen') === 'davon 300 g abwiegen' && s2('davon 1.275 g abwiegen') === 'davon 320 g abwiegen' && s2('mit 1,5 l Wasser') === 'mit 380 ml Wasser', 'Gramm und Milliliter: kg und l werden kleiner, 1.275 g ist Tausend');
check(s2('Zugedeckt 25 Min. leise köcheln') === 'Zugedeckt 25 Min. leise köcheln' && s2('Ofen auf 200 °C') === 'Ofen auf 200 °C' && s2('in 2-cm-Stücke schneiden') === 'in 2-cm-Stücke schneiden' && s2('Messbecher (1 l)') === 'Messbecher (1 l)', 'Zeiten, Grad, Größen und der Messbecher bleiben');
check(s2('Die Salsa (Schale 5) in 8 Döschen füllen, je ca. 50 g') === 'Die Salsa (Schale 5) in 2 Döschen füllen, je ca. 50 g' && s2('Je 5 Bällchen in jede Box') === 'Je 5 Bällchen in jede Box' && s2('knapp 19 g pro Box') === 'knapp 19 g pro Box' && s2('40 kleine Bällchen formen (je ca. 25 g)') === '10 kleine Bällchen formen (je ca. 25 g)', 'Was pro Box oder Stück gilt, bleibt – die Zahl der Döschen und Bällchen nicht');
check(s2('8 Boxen nacheinander auf die Waage stellen') === '2 Boxen nacheinander auf die Waage stellen' && s2('das Gewicht durch 8 teilen') === 'das Gewicht durch 2 teilen' && s2('In 8 gleiche Stücke schneiden', 3) === 'In 3 gleiche Stücke schneiden' && s2('In 2 × 4 gleich große Stücke schneiden') === 'In 2 gleich große Stücke schneiden', 'So viele wie Boxen: 8 Boxen, durch 8 teilen, 8 gleiche Stücke, 2 × 4 Stücke');
check(s2('4 Knoblauchzehen') === '1 Knoblauchzehe' && s2('3 Eier aufschlagen') === '1 Ei aufschlagen' && s2('und 2 Lorbeerblättern aufsetzen') === 'und 1 Lorbeerblatt aufsetzen' && s2('Die restlichen 4 Tortillas darauf', 2) === 'Die restliche Tortilla darauf', 'Ganze Stück: Zehen, Eier, Lorbeer mindestens 1 – und die Wörter passen');
check(s2('3 rote Paprika (480 g)') === '1 rote Paprika (160 g)' && s2('1 Zucchini (300 g) würfeln', 3) === '½ Zucchini (150 g) würfeln' && s2('1 große Zwiebel', 1) === '⅛ große Zwiebel' && s2('2–3 Zwiebeln, 100 g davon') === '½–1 Zwiebel, 25 g davon', 'Gemüse: eine ganze Paprika statt ¾, ½ Zucchini statt ⅜ – die Gramm in der Klammer ziehen mit; ganz wenig: ⅛');
check(s2('3 Dosen Kidneybohnen') === '¾ Dose Kidneybohnen' && s2('1 Packung Feta', 4) === '½ Packung Feta', 'Dosen und Packungen: in Vierteln, gekauft wird eine ganze');
check(s2('3 mittlere (300 g)', 2, 'zutat') === '¾ mittlere (75 g)' && s2('600 g (1 große oder 2 mittlere)', 2, 'zutat') === '150 g (¼ große oder ½ mittlere)' && s2('2 Dosen à 400 g (510 g abgetropft)', 2, 'zutat') === '½ Dose à 400 g (130 g abgetropft)', 'Zutat: „3 mittlere“, „oder 2 mittlere“, à 400 g bleibt die Dose');
check(s2('1 Packung (8 Stück, 320 g)', 2, 'zutat') === '¼ Packung (2 Stück, 80 g)' && s2('1 Knolle (8 Zehen)', 2, 'zutat') === '¼ Knolle (2 Zehen)' && s2('400 g (ca. ½ Kopf)', 2, 'zutat') === '100 g (ca. ⅛ Kopf)', 'Zutat: Packungen, Knollen, Köpfe');

/* ------------------------------------------------------------- Tipps */

check(tipp('Mit Reis statt Süßkartoffel: 150 g Basmati (roh) separat kochen.') === 'Mit Reis statt Süßkartoffel: 40 g Basmati (roh) separat kochen.' && tipp('Ist deine sehr dick, 2–3 EL Wasser mit einrühren.') === 'Ist deine sehr dick, 1½–2½ TL Wasser mit einrühren.', 'Tipps: Mengen fürs ganze Rezept rechnen sich um');
check(tipp('Die Sauce dickt nach. Beim Aufwärmen 1–2 EL Wasser dazu.') === 'Die Sauce dickt nach. Beim Aufwärmen 1–2 EL Wasser dazu.' && tipp('Der Salat zieht nach: Zu trocken? 1 EL Wasser unterrühren.') === 'Der Salat zieht nach: Zu trocken? 1 EL Wasser unterrühren.', 'Tipps: Was beim Aufwärmen oder in die trockene Box kommt, gilt pro Box – bleibt');
check(tipp('Oberkeule bleibt beim Aufwärmen saftiger. Mit 1 kg Brust fehlen dir pro Portion ca. 6 g Fett, dann 2 EL Öl mehr nehmen.') === 'Oberkeule bleibt beim Aufwärmen saftiger. Mit 250 g Brust fehlen dir pro Portion ca. 6 g Fett, dann 1½ TL Öl mehr nehmen.' && tipp('Doppelrahmstufe bringt pro Portion rund 3,5 g Fett mehr.') === 'Doppelrahmstufe bringt pro Portion rund 3,5 g Fett mehr.', 'Tipps: Satz für Satz – „pro Portion ca. 6 g Fett“ bleibt, 1 kg und 2 EL nicht');
check(tipp('Noch mehr Burger: 1 TL Sesam pro Box drüber.') === 'Noch mehr Burger: 1 TL Sesam pro Box drüber.' && tipp('Mit einem Klecks pro Box – 1 TL sind nur rund 15 kcal.') === 'Mit einem Klecks pro Box – 1 TL sind nur rund 15 kcal.' && tipp('Mit 3 Dosen Kichererbsen – dann fehlen pro Box etwa 10 g Eiweiß.') === 'Mit ¾ Dose Kichererbsen – dann fehlen pro Box etwa 10 g Eiweiß.', 'Tipps: „1 TL Sesam pro Box“ und „1 TL sind 15 kcal“ bleiben, 3 Dosen nicht');
check(tipp('Ersatz: je 1 TL Paprika, Oregano und ½ TL Cayenne.') === 'Ersatz: je ¼ TL Paprika, Oregano und ⅛ TL Cayenne.' && tipp('Klassisch: 1 EL Kapern und ein Glas Spargelstücke dazu.') === 'Klassisch: ¾ TL Kapern und ¼ Glas Spargelstücke dazu.', 'Tipps: „Ersatz: je 1 TL …“ ist fürs Rezept, „ein Glas“ ist eine Menge');

/* --------------------------------------------------------- Rezepte, ganz */

const chili = nach('chili');
check(aufBoxen(chili, 8) === chili && aufBoxen(chili, null) === chili && aufBoxen(chili, 12) === chili, 'Für 8 Boxen (oder Unsinn) bleibt das Rezept, wie es ist – dasselbe Objekt');
const c2 = aufBoxen(chili, 2);
const zut = (r, k) => r.items.find((it) => it.k === k);
check(c2.portionen === 2 && c2.m.kcal > chili.m.kcal && c2.m.kcal - chili.m.kcal <= 12 && Math.abs(c2.m.p - chili.m.p) < 0.5, `Für 2 Boxen: portionen 2, pro Box fast gleich – die ganze Paprika und Zwiebel geben ${c2.m.kcal - chili.m.kcal} kcal dazu`);
check(zut(c2, 'rinderhack').q === 125 && zut(c2, 'rinderhack').a === '125 g' && zut(c2, 'rinderhack').h === '1 × 500 g' && zut(c2, 'rinderhack').g === 125, 'Rinderhack: 125 g, gekauft wird 1 × 500 g');
check(zut(c2, 'kidney').q === 0.5 && zut(c2, 'kidney').a === '½ Dose à 400 g (130 g abgetropft)' && zut(c2, 'knoblauch').q === 1 && zut(c2, 'knoblauch').a === '1 Zehe', 'Kidneybohnen ½ Dose, Knoblauch eine Zehe');
check(zut(c2, 'paprika').q === 1 && zut(c2, 'paprika').a === '1 Stück (ca. 150 g)' && zut(c2, 'paprika').g === 150 && zut(c2, 'paprika').h === '' && zut(c2, 'tomatenmark').h === 'kleine Dose', 'Paprika: 1 Stück (150 g) statt ¾, ohne „3er-Pack“; Tomatenmark bleibt „kleine Dose“');
check(zut(c2, 'zwiebeln').a === '1 mittlere (100 g)' && zut(c2, 'zwiebeln').q === 100 && zut(c2, 'zwiebeln').g === 100, 'Zwiebeln: 1 mittlere (100 g) statt ¾ – Menge zum Kaufen und Gramm ziehen mit');
check(c2.spices.find((s) => s.k === 'kreuzkuemmel').a === '1½ gehäufte TL' && c2.spices.find((s) => s.k === 'lorbeer').a === '1 Stück', 'Gewürze: Kreuzkümmel 1½ gehäufte TL, 1 Lorbeerblatt');
const schritte = c2.ablauf.flatMap((p) => p.schritte);
check(schritte.some((s) => s.d === '1 Zwiebel ({zwiebeln}) schälen und fein würfeln → Schale 1') && schritte.some((s) => s.d.startsWith('2 Boxen nacheinander')) && schritte.some((s) => (s.liste || []).includes('1½ gehäufte TL Kreuzkümmel')), 'Schritte: Zwiebel, 2 Boxen, Gewürze in der Liste');
check(platzhalter('{rinderhack} Rinderhack', c2.items) === '125 g Rinderhack', 'Platzhalter nehmen die neue Menge');
const zeileNut = (r, name) => r.nut.find((z) => z[0] === name);
check(Math.abs(c2.total[0] - c2.m.kcal * 2) < 1.5 && c2.nut[0][1] === '125 g' && zeileNut(c2, 'Paprika')[1] === '150 g' && zeileNut(c2, 'Zwiebeln')[1] === '100 g' && Math.abs(zeileNut(c2, 'Paprika')[2] - zeileNut(chili, 'Paprika')[2] / 3) < 0.2, 'Nährwerttabelle fürs Ganze: ein Viertel – Paprika und Zwiebel ein Drittel, die Summe passt zu pro Box');
check(c2.kosten.gesamt > chili.kosten.gesamt / 4 && c2.kosten.gesamt - chili.kosten.gesamt / 4 < 0.5 && Math.abs(c2.kosten.box - c2.kosten.gesamt / 2) < 0.01, `Kosten: ein Viertel und das bisschen Gemüse mehr (${c2.kosten.gesamt} €, ${c2.kosten.box} € pro Box)`);
check(c2.tips[0].includes('40 g Basmati') && c2.tips[1] === 'Schärfer: ¼ frische Chili fein gehackt mit in Schale 1.' && aufBoxen(chili, 1).tips[0].includes('19 g Basmati (roh) separat kochen und in die Box'), 'Tipps im Rezept: 40 g Basmati, ¼ Chili – für eine Box „in die Box“');
const koch = (r) => r.ablauf.find((p) => /koch/i.test(p.t)).schritte;
check(c2.zeit.gesamt < chili.zeit.gesamt && JSON.stringify(koch(c2).map((s) => s.min)) === JSON.stringify(koch(chili).map((s) => s.min)) && JSON.stringify(c2.zeit) === JSON.stringify(zeitVon(c2)), `Zeit: Schnippeln kürzer (${chili.zeit.gesamt} → ${c2.zeit.gesamt} Min.), Kochen gleich`);
// Für eine Box: keine „Boxen“ mehr
const e1 = aufBoxen(nach('enchilada'), 1);
const e1s = e1.ablauf.flatMap((p) => p.schritte).map((s) => s.d);
check(e1s.includes('Im Ganzen in die Box – die Waage kontrolliert') && e1s.includes('Die restliche Tortilla darauf, der Rest der Füllung, der Rest aus Schale 5') && !e1s.some((s) => /\bBoxen\b/.test(s)), 'Für eine Box: „Im Ganzen in die Box“, „die restliche Tortilla“, keine Boxen');
check(e1.geraete.includes('kleine Auflaufform') && aufBoxen(nach('lasagne'), 2).geraete.includes('kleine Auflaufform, mind. 6 cm hoch'), 'Für wenige Boxen: eine kleine Auflaufform');
const o2 = aufBoxen(nach('ofen-haehnchen'), 2);
const o2s = o2.ablauf.flatMap((p) => p.schritte).map((s) => s.d);
check(o2.geraete.includes('Backblech') && o2s.includes('Ein Blech mit Backpapier belegen') && !o2s.some((s) => /beide Bleche|zwei Bleche/.test(s)) && o2.items.find((it) => it.k === 'backpapier' || /Backpapier/.test(it.n)).a === '1 Blatt fürs Blech', 'Für 4 oder weniger: ein Blech, ein Blatt Backpapier');
check(aufBoxen(nach('ofen-haehnchen'), 6).geraete.includes('2 Backbleche'), 'Für 6 Boxen bleiben es zwei Bleche');
// Alle Rezepte: nichts kaputt, alles in Zahlen
let heil = true;
let fehler = '';
for (const r of daten.rezepte) {
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const x = aufBoxen(r, n, { katalog: daten.katalog });
    const texte = [...x.items.map((it) => it.a), ...x.spices.map((s) => s.a), ...x.ablauf.flatMap((p) => p.schritte.flatMap((s) => [s.d, ...(s.liste || [])])), ...(x.tips || []), ...x.nut.map((z) => z[1])];
    const kaputt = texte.find((t) => /NaN|undefined|null|Infinity/.test(t));
    const mengen = x.items.every((it) => it.q === null || it.q === undefined || (Number.isFinite(it.q) && it.q > 0));
    // Pro Box bleibt es fast, wie es war – aufgerundetes Gemüse gibt höchstens ein paar kcal dazu
    const nah = Math.abs(x.m.kcal - r.m.kcal) <= 20 && Math.abs(x.m.p - r.m.p) <= 1.5 && Math.abs(x.total[0] - x.m.kcal * n) <= n + 1;
    if (kaputt || !mengen || !nah || x.portionen !== n || !Number.isFinite(x.zeit?.gesamt)) { heil = false; fehler = `${r.id} (${n}): ${kaputt || (nah ? 'Mengen' : `pro Box ${r.m.kcal} → ${x.m.kcal} kcal`)}`; break; }
  }
  if (!heil) break;
}
check(heil, `Alle 50 Rezepte für 1 bis 7 Boxen: lesbare Texte (auch Tipps), gültige Mengen, pro Box fast gleich${fehler ? ` – ${fehler}` : ''}`);
// Mit eigenem Ziel: erst aufs Ziel, dann auf die Boxen
const preise = { preise: daten.preise, naehrwerte: daten.naehrwerte };
const zielChili = aufZiel(chili, { kcal: 380, p: 30, kh: 35, f: 12 }, preise);
const zielChili2 = aufBoxen(zielChili, 2);
check(zielChili2.portionen === 2 && Math.abs(zielChili2.m.kcal - zielChili.m.kcal) <= 12 && zielChili2.angepasst?.trifft === true && zielChili2.angepasst.abweichung.kcal === zielChili2.m.kcal - 380 && zut(zielChili2, 'rinderhack').g < zut(zielChili, 'rinderhack').g / 3 && zielChili2.angepasst?.aenderungen?.length === zielChili.angepasst.aenderungen.length, 'Eigenes Ziel und 2 Boxen: pro Box nah am Ziel (die Abweichung neu gerechnet), die Mengen ein Viertel, „angepasst“ mit');

/* ------------------------------------------------------- liste.json */

const p2 = anwenden(leer(), opProfil({ boxen: 2 }, 'Marielle'));
check(p2.profil.boxen === 2 && beschreibung(leer(), p2) === '2 Boxen pro Rezept' && beschreibung(p2, anwenden(p2, opProfil({ boxen: 1 }))) === '1 Box pro Rezept', 'profil.boxen: gespeichert, Commit „2 Boxen pro Rezept“');
check(bereinigen({ ...p2, profil: { boxen: 9 } }).profil.boxen === undefined && bereinigen(p2).profil.boxen === 2, 'profil.boxen: 1 bis 8, sonst fällt es weg');
const ohne = { ...p2, profil: { person: 'Marielle' } };
check(profilNachtrag(ohne, bereinigen(ohne), p2)[0]?.teil?.boxen === 2 && !profilNachtrag(p2, p2, p2).length && !profilNachtrag({ ...p2, profil: undefined }, leer(), p2).length, 'Lässt eine ältere Fassung boxen weg, kommt es wieder dazu (fehlt profil ganz, macht das der andere Nachtrag)');

/* ------------------------------------------------------------ Browser */

const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const browser = await starteBrowser();
// Marielle: eine eigene Liste, die Tobi angelegt hat – noch ohne Zahl der Boxen
const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
mar.zustand.datei = JSON.stringify({ ...leer(), rev: 1, profil: { person: 'Marielle', farbe: 'lila' }, leute: { marielle: 'Marielle' } });
mar.zustand.version = 1;
mar.zustand.sha = 'sha1';
const marielle = await handy(browser, { attrappe: mar });
const m = marielle.page;
await m.evaluate((k) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle' })); localStorage.setItem('boxenstopp.willkommen.v1', 'true'); }, M_KEY);
await m.reload();
await m.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await m.locator('#sync-text').innerText()) === 'Gespeichert'), 'Marielle: an ihrer Liste');
check(await bis(() => m.locator('#r-boxen').isVisible()) && (await m.locator('#r-boxen').innerText()).includes('Für wie viele Boxen kochst du meistens?'), 'Oben bei den Rezepten: „Für wie viele Boxen kochst du meistens?“');
check((await m.locator('#r-eyebrow').textContent()) === '50 Rezepte · je 8 Boxen', 'Noch: je 8 Boxen');
await m.click('#r-boxen [data-boxen="2"]');
check(await bis(() => mar.liste()?.profil?.boxen === 2), 'Tipp auf 2: in ihrer Liste steht boxen 2');
check(await bis(() => mar.zustand.nachrichten.some((x) => /^Marielle: Einkaufsliste, 1 Änderung – 2 Boxen pro Rezept/.test(x))), 'Commit: „Marielle: … – 2 Boxen pro Rezept“');
check(await m.locator('#r-boxen').isHidden() && (await m.locator('#r-eyebrow').textContent()) === '50 Rezepte · je 2 Boxen' && (await m.locator('#r-intro').innerText()).startsWith('Jedes Rezept ist auf 2 gleiche Boxen gerechnet'), 'Danach: Hinweis weg, „je 2 Boxen“, die Einleitung sagt es');
check((await m.locator('#toast').innerText()).includes('Jetzt für 2 Boxen'), 'Meldung: Jetzt für 2 Boxen');
// Das Rezept für 2 Boxen
await m.click('[data-open="chili"]');
const detail = await m.locator('#detail').innerText();
check(detail.includes('für 2 Boxen') && detail.includes('125 g') && detail.includes('½ Dose à 400 g (130 g abgetropft)') && detail.includes('1½ gehäufte TL'), 'Chili für 2: 125 g Hack, ½ Dose Bohnen, 1½ gehäufte TL Kreuzkümmel');
check(detail.includes('1 Zwiebel ') && detail.includes('2 Boxen nacheinander') && detail.toLowerCase().includes('eine von zwei') && detail.includes('40 g Basmati') && !detail.includes('Mengen in den Tipps'), 'Schritte und Tipps für 2 (40 g Basmati), „eine von zwei“');
check(!detail.includes('500 g') || !/\b500 g Rinderhack/.test(detail), 'Keine 500 g Rinderhack mehr');
await m.click('#detail [data-act="alle-dazu"]');
const liste = () => mar.liste()?.items || {};
check(await bis(() => liste().rinderhack?.parts?.chili?.q === 125 && liste().kidney?.parts?.chili?.q === 0.5), 'Auf der Liste: 125 g Hack, ½ Dose Kidneybohnen');
await m.click('.tabbar .tab[data-tab="einkauf"]');
const bohnen = m.locator('#list-body li', { has: m.locator('[data-mehr="kidney"]') });
check(await bis(async () => (await bohnen.locator('.item-qty').innerText()).startsWith('1 Dose') && (await bohnen.locator('.item-sub').innerText()).includes('½ Dose')), 'In der Liste: 1 Dose kaufen, darunter „Chili ½ Dose“');
// Auf 4 umstellen: die Liste zieht mit
await m.click('.tabbar .tab[data-tab="einstellungen"]');
check((await m.locator('#e-boxen').innerText()).includes('Gerade für 2 Boxen') && (await m.locator('#e-boxen [data-boxen="2"]').getAttribute('aria-pressed')) === 'true', 'Einstellungen: „Gerade für 2 Boxen“, 2 ist gewählt');
await m.click('#e-boxen [data-boxen="4"]');
check(await bis(() => mar.liste()?.profil?.boxen === 4 && liste().rinderhack?.parts?.chili?.q === 250 && liste().kidney?.parts?.chili?.q === 1), 'Auf 4: in der Liste 250 g Hack und 1 Dose Bohnen');
check((await m.locator('#toast').innerText()).includes('die Liste ist nachgezogen'), 'Meldung: die Liste ist nachgezogen');
// Eine ältere App-Fassung schreibt die Datei ohne boxen: es kommt wieder dazu
const alt = mar.liste();
delete alt.profil.boxen;
alt.rev += 1;
mar.zustand.datei = JSON.stringify(alt);
mar.zustand.version++;
mar.zustand.sha = `sha${mar.zustand.version}`;
check(await bis(() => mar.liste()?.profil?.boxen === 4, 8000), 'Lässt eine ältere Fassung boxen weg, schreibt Marielles Handy es wieder dazu');
// Zurück auf 8: ausdrücklich gespeichert, das Rezept wie gebaut
await m.click('#e-boxen [data-boxen="8"]');
check(await bis(() => mar.liste()?.profil?.boxen === 8 && liste().rinderhack?.parts?.chili?.q === 500), 'Zurück auf 8: boxen 8 steht da, das Hack wieder 500 g');
check(marielle.fehler.length === 0, `Keine Fehler im Browser (${marielle.fehler.join(' | ')})`);
await marielle.ctx.close();
// Auf einer gemeinsamen Liste (nur dieses Handy) fragt die App nicht
const tobi = await handy(browser);
check(await tobi.page.locator('#r-boxen').isHidden() && (await tobi.page.locator('#r-eyebrow').textContent()) === '50 Rezepte · je 8 Boxen', 'Bei Tobi und Amy: kein Hinweis, je 8 Boxen');
await tobi.page.click('.tabbar .tab[data-tab="einstellungen"]');
check(await tobi.page.locator('#e-boxen-karte').isVisible() && (await tobi.page.locator('#e-boxen').innerText()).includes('für 8 Boxen gebaut'), 'Einstellungen: „Boxen pro Rezept“ auch dort');
check(tobi.fehler.length === 0, `Tobi: keine Fehler im Browser (${tobi.fehler.join(' | ')})`);
await tobi.ctx.close();
await browser.close();

ende();
