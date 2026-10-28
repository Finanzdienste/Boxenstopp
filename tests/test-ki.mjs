/*
 * Die Resteverwertung: erst ohne Browser (Antwort prüfen, Mengen auf die
 * Ziele rechnen, Anfrage bauen, Strom lesen), dann im Browser gegen eine
 * nachgebaute Anthropic-API – mit zwei Handys und der GitHub-Attrappe, damit
 * ein behaltenes Rezept auch beim anderen ankommt.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL } from './hilfe.mjs';
import { kiBereinigen, mengenAnpassen, alsRezept, proBox, abstand, schoen, KI_ID, festAlsKi, aenderungenText, alsVorlage, aenderungUebernehmen } from '../js/ki-rezept.js';
import { anfrageBauen, anfrageBauenGemini, rumpfFuer, kiAnfragen, kostenCent, anbieterVon, ANBIETER, MODELL } from '../js/ki.js';
import { kiAus } from '../js/zugang.js';
import { bereinigen, anwenden, leer, opKiBehalten, opKiWeg, opZusammen } from '../js/liste.js';
import { zeitVon } from '../js/zeiten.js';
import { euro, kostenMenge, kostenRezept, kostenListe } from '../js/kosten.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const ANTWORT = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'ki-antwort.json'), 'utf8'));
const ZIEL = daten.ziel;
const einheiten = {};
for (const r of daten.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') einheiten[it.k] = it.u;
const klon = (x) => JSON.parse(JSON.stringify(x));

/* ================================================================ ohne Browser */


// --- bereinigen
const { r: k0, fehler: f0 } = kiBereinigen({ ...ANTWORT, portionen: 8 });
check(k0 && !f0, `die Beispielantwort ist ein gültiges Rezept${f0 ? ` (${f0})` : ''}`);
check(k0.portionen === 8 && k0.zutaten.length === 9 && k0.schalen.length === 4 && k0.ablauf.map((p) => p.t).join() === 'Vorbereiten,Kochen,Portionieren', 'Portionen, Zutaten, Schalen und drei Abschnitte übernommen');
check(k0.ablauf[1].schritte[0].ruhe === 22 && k0.ablauf[0].schritte.some((s) => s.liste?.length === 5), 'Wartezeit und Liste im Schritt bleiben erhalten');
check(kiBereinigen(null).r === null && kiBereinigen({ name: 'X' }).r === null && kiBereinigen({ ...ANTWORT, kochen: [] }).r === null, 'Unsinn, keine Zutaten oder keine Kochschritte: kein Rezept');
const riesig = kiBereinigen({ ...ANTWORT, name: 'A'.repeat(500), zutaten: [{ ...ANTWORT.zutaten[0], menge: 99999, pro100: { kcal: 5000, p: -3, kh: 'x', f: 50 } }, ANTWORT.zutaten[1]] }).r;
check(riesig.name.length === 70 && riesig.zutaten[0].menge === 5000 && riesig.zutaten[0].pro100.kcal === 900 && riesig.zutaten[0].pro100.p === 0 && riesig.zutaten[0].pro100.kh === 0, 'zu lange Texte und unmögliche Zahlen werden begrenzt');
const doppelt = kiBereinigen({ ...ANTWORT, zutaten: [ANTWORT.zutaten[0], { ...ANTWORT.zutaten[0], name: 'Noch mehr Hähnchen' }] }).r;
check(doppelt.zutaten[0].id !== doppelt.zutaten[1].id, `doppelte ids werden eindeutig (${doppelt.zutaten.map((z) => z.id).join(', ')})`);
const mitSpeck = kiBereinigen({ ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'speck', name: 'Speckwürfel' }] });
check(mitSpeck.r === null && mitSpeck.art === 'verboten' && /Speck/.test(mitSpeck.fehler), 'Speck in den Zutaten: kein Rezept („das esst ihr nicht“)');
const mitFisch = kiBereinigen({ ...ANTWORT, gewuerze: [...ANTWORT.gewuerze, { name: 'Fischsauce', menge: '1 EL' }] });
check(mitFisch.art === 'verboten', 'Fischsauce bei den Gewürzen: kein Rezept');
check(kiBereinigen({ ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'paste', name: 'Rote Currypaste ohne Garnelen' }] }).r !== null, '„ohne Garnelen“ ist erlaubt');
check(kiBereinigen({ ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'hack', name: 'Putenhackfleisch' }] }).art === 'verboten', 'Putenhack: kein Rezept');

// --- auf die Ziele rechnen
const vorher = proBox(k0);
const k1 = mengenAnpassen(k0, ZIEL);
const box = proBox(k1);
check(abstand(box, ZIEL) < abstand(vorher, ZIEL) / 4, `die Mengen rücken die Box viel näher ans Ziel (Abstand ${abstand(vorher, ZIEL).toFixed(1)} → ${abstand(box, ZIEL).toFixed(1)})`);
check(Math.abs(box.kcal - ZIEL.kcal) <= 10 && Math.abs(box.p - ZIEL.p) <= 1.5 && Math.abs(box.kh - ZIEL.kh) <= 2 && Math.abs(box.f - ZIEL.f) <= 1.2,
  `eine Box trifft das Ziel: ${box.kcal.toFixed(0)} kcal, ${box.p.toFixed(1)} P, ${box.kh.toFixed(1)} KH, ${box.f.toFixed(1)} F`);
check(k1.zutaten.every((z, i) => z.menge >= z.min && z.menge <= z.max && (z.anpassbar || z.menge === k0.zutaten[i].menge)), 'nur anpassbare Mengen bewegen sich, und alle bleiben zwischen min und max');
check(k1.zutaten.filter((z) => z.anpassbar).every((z) => z.menge % (z.menge >= 200 ? 10 : z.menge >= 30 ? 5 : 1) === 0), `runde Mengen (${k1.zutaten.filter((z) => z.anpassbar).map((z) => `${z.id} ${z.menge}`).join(', ')})`);
check(k1.zutaten.every((z, i) => z.vorschlag === k0.zutaten[i].menge), 'der Vorschlag der KI bleibt zum Vergleich gespeichert');
check(schoen(213, 0, 217) === 210 && schoen(47, 46, 49) === 47 && schoen(18.4) === 18, 'Runden: in 10ern, 5ern oder ganzen Gramm, nie aus dem Bereich');
const ohneFrei = mengenAnpassen({ ...k0, zutaten: k0.zutaten.map((z) => ({ ...z, anpassbar: false })) }, ZIEL);
check(JSON.stringify(ohneFrei.zutaten.map((z) => z.menge)) === JSON.stringify(k0.zutaten.map((z) => z.menge)), 'ohne anpassbare Zutaten bleibt alles, wie die KI es wollte');

// --- als Rezept der App
const R = alsRezept(k1, { id: 'ki-test1234', katalog: daten.katalog, einheiten, von: { by: 'Amy', at: '2026-10-27T17:00:00.000Z' } });
const texte = R.ablauf.flatMap((p) => p.schritte.flatMap((s) => [s.d, ...(s.liste || [])])).join(' ');
check(!/[{}]/.test(texte) && texte.includes(`${k1.zutaten.find((z) => z.id === 'reis').menge} g Reis`), 'Platzhalter in den Schritten werden zu den endgültigen Mengen');
const schluessel = Object.fromEntries(R.items.map((it) => [it.n, it.k]));
check(schluessel['Hähnchenbrustfilet'] === 'haehnchenbrust' && schluessel.Zwiebeln === 'zwiebeln' && schluessel.Feta === 'feta', 'Zutaten aus dem Katalog teilen sich die Zeile mit den festen Rezepten');
check(schluessel.Zucchini === 'ki-zucchini' && schluessel.Paprika === 'ki-paprika' && schluessel['Kichererbsen, abgetropft'] === 'ki-kichererbsen', 'andere Einheit als im Katalog (Paprika in Stück) oder nicht im Katalog: eigener Schlüssel ki-…');
check(R.items.find((it) => it.k === 'ki-kichererbsen').kat?.c === 'konserven', 'eigene Zutaten bringen Namen und Abteilung mit');
check(R.items.filter((it) => it.da).length === 4 && R.items.filter((it) => it.pantry).length === 1, 'vier Zutaten sind schon da, eine kommt aus dem Vorrat');
check(R.spices.find((s) => s.n === 'Paprika edelsüß').k === 'paprika-edelsuess' && R.spices.find((s) => s.n === 'Sumach').k === 'ki-g-sumach', 'Gewürze: aus dem Katalog, wenn es sie dort gibt');
check(R.m.kcal === Math.round(R.total[0] / 8) && JSON.stringify(R.zeit) === JSON.stringify(zeitVon(R)) && R.time === R.zeit.gesamt, `Nährwerte pro Box und Zeiten gerechnet (${R.m.kcal} kcal, ${R.zeit.gesamt} Min.)`);
check(R.ki.aenderungen.length >= 1 && R.ki.aenderungen.every((a) => a.vorher !== a.nachher), `die App zeigt, welche Mengen sie verschoben hat (${R.ki.aenderungen.map((a) => `${a.name} ${a.vorher}→${a.nachher}`).join(', ')})`);

// --- Kosten: Richtpreise auf Mengen, eigene Rezepte, die Liste
const preisDaten = { preise: daten.preise, naehrwerte: daten.naehrwerte };
check(euro(2.3) === '2,30 €' && euro(18.4) === '18 €' && euro(NaN) === '', 'euro(): unter 10 € mit Cent, darüber gerundet');
check(Math.abs(kostenMenge('reis', 500, 'g', preisDaten) - 2.29 / 2) < 0.001 && Math.abs(kostenMenge('paprika', 3, 'Stk', preisDaten) - 2.49) < 0.001 && kostenMenge('ki-zucchini', 1, 'Stk', preisDaten) === null, 'kostenMenge: Gramm, Stückware über die Einheit, unbekannt → null');
const kiKosten = kostenRezept(R, preisDaten);
check(kiKosten.gesamt > 5 && kiKosten.luecken >= 1 && Math.abs(kiKosten.box - kiKosten.gesamt / 8) < 0.001, `Resteverwertung: Kosten aus den Katalogzutaten, Lücken gezählt (≈ ${euro(kiKosten.gesamt)}, ${kiKosten.luecken} ohne Preis)`);
check(kostenRezept(teriyakiFest(), preisDaten).box === daten.rezepte.find((r) => r.id === 'teriyaki').kosten.box, 'feste Rezepte bringen ihre Kosten mit');
const standKosten = { items: { reis: { name: 'Reis', parts: { a: { q: 500, u: 'g' }, b: { q: 500, u: 'g', done: true } } }, 'c-1': { name: 'Eigenes', custom: true, checked: false } } };
const lk = kostenListe(standKosten, preisDaten);
check(Math.abs(lk.gesamt - 2.29) < 0.001 && Math.abs(lk.offen - 2.29 / 2) < 0.001, 'Liste: Summe aller Einträge und der offenen, eigene Einträge ohne Preis');
function teriyakiFest() { return daten.rezepte.find((r) => r.id === 'teriyaki'); }

// --- feste Rezepte anpassen: ins KI-Format, Zutat tauschen, nachrechnen, zurück ins App-Format
const teriyaki = daten.rezepte.find((r) => r.id === 'teriyaki');
const fk = kiBereinigen(festAlsKi(teriyaki, daten.katalog)).r;
check(fk && fk.zutaten.length >= 12 && fk.zutaten.find((z) => z.id === 'haehnchenkeule')?.anpassbar && !fk.zutaten.find((z) => z.id === 'brokkoli').anpassbar && fk.zutaten.find((z) => z.id === 'knoblauch')?.kauf?.u === 'Zehe', 'festAlsKi: Zutaten mit Werten, Bereich, Kaufeinheit; Fleisch verschiebbar, Gemüse nicht');
const boxFest = proBox(fk);
check(Math.abs(boxFest.kcal - teriyaki.m.kcal) < 2 && Math.abs(boxFest.f - teriyaki.m.f) < 0.2, `im KI-Format kommt dieselbe Box heraus (${boxFest.kcal.toFixed(0)} kcal)`);
const unver = alsRezept(fk, { id: 'ki-unver1', katalog: daten.katalog, einheiten });
check(unver.items.find((it) => it.k === 'knoblauch')?.q === 4 && unver.items.find((it) => it.k === 'knoblauch').u === 'Zehe' && unver.items.find((it) => it.k === 'kidney') === undefined && !unver.items.some((it) => /pauschal/i.test(it.n)), 'unverändert zurück: Knoblauch bleibt „4 Zehen“, Pauschalen sind keine Zutaten');
const var1 = JSON.parse(JSON.stringify(fk));
const brok = var1.zutaten.find((z) => z.id === 'brokkoli');
brok.menge = 200; brok.anpassbar = false; brok.min = 200;
var1.zutaten.push({ id: 'erbsen', name: 'TK-Erbsen', menge: 400, einheit: 'g', min: 400, max: 400, anpassbar: false, pro100: daten.naehrwerte.erbsen.pro100, quelle: 'kaufen', katalog: 'erbsen', abteilung: 'tk', packung: '', vorschlag: 400, neu: true });
var1.ablauf[0].schritte.push({ d: '{erbsen} TK-Erbsen abwiegen', min: 1 });
var1.weg = { sesam: 'Sesam' };
var1.zutaten = var1.zutaten.filter((z) => z.id !== 'sesam');
const var2 = mengenAnpassen(kiBereinigen(var1).r, ZIEL);
const boxVar = proBox(var2);
check(Math.abs(boxVar.kcal - ZIEL.kcal) <= 8 && Math.abs(boxVar.p - ZIEL.p) <= 1 && Math.abs(boxVar.kh - ZIEL.kh) <= 1.5 && Math.abs(boxVar.f - ZIEL.f) <= 1, `200 g Brokkoli statt 1 kg, 400 g Erbsen dazu, Sesam weg – die Box trifft trotzdem: ${boxVar.kcal.toFixed(0)} / ${boxVar.p.toFixed(1)} / ${boxVar.kh.toFixed(1)} / ${boxVar.f.toFixed(1)}`);
check(var2.zutaten.find((z) => z.id === 'brokkoli').menge === 200 && var2.zutaten.find((z) => z.id === 'erbsen').menge === 400, 'was man selbst gesetzt hat, bleibt');
const aend = aenderungenText(var2, fk);
check(aend.some((a) => a.startsWith('Brokkoli 1 kg → 200 g')) && aend.some((a) => a === 'TK-Erbsen 400 g neu') && aend.includes('Sesam weggelassen') && aend.some((a) => /Hähnchen-Oberkeulenfilet 1 kg → /.test(a)), `die Änderungen in Worten: ${aend.join(' · ')}`);
const appVar = alsRezept(var2, { id: 'ki-var1', katalog: daten.katalog, einheiten, von: { by: 'Tobi' } });
const sesamSchritt = appVar.ablauf.flatMap((p) => p.schritte).find((x) => /Sesam/.test(x.d));
check(sesamSchritt?.entfaellt === true && /\(ohne Sesam\)/.test(sesamSchritt.d), 'der Sesam-Schritt entfällt und sagt das');
check(appVar.ablauf[0].schritte.some((x) => x.d === '400 g TK-Erbsen abwiegen') && appVar.items.find((it) => it.k === 'brokkoli').q === 200 && appVar.items.find((it) => it.k === 'erbsen').kat === undefined && appVar.ki.weg.sesam === 'Sesam', 'Mengen in den Schritten, Erbsen über den Katalog auf die Liste, weg ist gemerkt');
check(kiBereinigen({ ...var1, herkunft: 'teriyaki' }).r.herkunft === 'teriyaki' && kiBereinigen({ ...var1, herkunft: 'x y' }).r.herkunft === undefined && kiBereinigen({ ...var1, herkunft: 'teriyaki' }).r.basis === 'Reis', 'herkunft bleibt nur, wenn sie wie eine Rezept-id aussieht – die Beilage (basis) bleibt getrennt');

// --- Anfrage
const rumpf = anfrageBauen({ text: '1 Zucchini, Feta', wuensche: 'was Griechisches', fotos: ['AAAA', 'BBBB'], portionen: 4, dazukaufen: false, ziel: ZIEL, katalog: daten.katalog, mag: ['Butter Chicken mit Reis'], magNicht: ['Spaghetti Bolognese'], vermeiden: ['Feta-Reispfanne'] });
check(rumpf.model === MODELL && rumpf.tool_choice?.name === 'rezept_ausgeben' && rumpf.tools[0].input_schema.required.includes('zutaten'), `Claude muss das Werkzeug rezept_ausgeben benutzen (${MODELL})`);
const inhalt = rumpf.messages[0].content;
check(inhalt.length === 3 && inhalt[0].type === 'image' && inhalt[0].source.media_type === 'image/jpeg' && inhalt[2].type === 'text', 'erst die Fotos, dann der Text');
check(/Portionen: 4/.test(inhalt[2].text) && /Dazukaufen: nein/.test(inhalt[2].text) && /was Griechisches/.test(inhalt[2].text) && /Daumen hoch\): Butter Chicken/.test(inhalt[2].text) && /nicht noch einmal: Feta-Reispfanne/.test(inhalt[2].text), 'im Text: Portionen, Dazukaufen, Wünsche, was ihr mögt und was nicht');
const sys = rumpf.system;
check(/Kein Fisch/.test(sys) && /Kein Schweinefleisch/.test(sys) && /kein Putenhack/.test(sys) && /Hüttenkäse/.test(sys), 'die Regeln gehen mit: kein Fisch, kein Schwein, kein Putenhack, kein Hüttenkäse');
check(sys.includes('443 kcal') && sys.includes('33 g Protein') && /Mise en place/.test(sys) && /Schale 2/.test(sys) && /\{id\}/.test(sys) && /nichts dazugekauft/.test(sys), 'Ziel, Mise en place, Schalen, Platzhalter und „nichts dazukaufen“ stehen im Auftrag');
check(sys.includes('haehnchenbrust=Hähnchenbrustfilet') && !sys.includes('backpapier='), 'der Katalog geht mit (ohne Haushalt)');

// --- Gemini: Schlüssel, Rumpf, Schema
const GKEY = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
check(anbieterVon(GKEY) === 'gemini' && anbieterVon('AIzaSyD-TEST0000000000000000000000000000') === 'gemini' && anbieterVon('sk-ant-api03-x_y') === 'anthropic' && anbieterVon('quatsch') === '', 'der Anfang des Schlüssels sagt, wer dran ist: AQ. oder AIza → Google, sk-ant- → Anthropic');
check(kiAus(GKEY) && kiAus('AIzaSyD-TEST0000000000000000000000000000') && kiAus('sk-ant-api03-TESTTESTTESTTESTTESTTEST_abc') && !kiAus('AQ.kurz') && !kiAus('AIza-kurz') && kiAus(`https://x.y/#zugang=abc&ki=${encodeURIComponent(GKEY)}`) === GKEY, 'alle Schlüsselformen werden erkannt, auch aus dem Link');
const rg = anfrageBauenGemini({ text: 'Feta', wuensche: '', fotos: ['AAAA'], portionen: 6, dazukaufen: true, ziel: ZIEL, katalog: daten.katalog });
check(rg.model === 'gemini-3.8-flash' && rg.response_format?.mime_type === 'application/json' && rg.response_format.schema?.required?.includes('zutaten') && rg.stream === true && rg.store === false, 'Gemini-Anfrage (Interactions-API): Modell, JSON nach Schema, gestreamt, nicht gespeichert');
check(rg.input[0].type === 'image' && rg.input[0].mime_type === 'image/jpeg' && rg.input[0].data === 'AAAA' && rg.input[1].type === 'text' && /Portionen: 6/.test(rg.input[1].text), 'Foto als Bild-Teil, Text dahinter');
check(/als JSON genau nach dem vorgegebenen Schema/.test(rg.system_instruction) && !/rezept_ausgeben/.test(rg.system_instruction) && /Kein Fisch/.test(rg.system_instruction), 'Gemini bekommt dieselben Regeln, nur ohne Werkzeug');
check(rumpfFuer('gemini', { ziel: ZIEL, katalog: {} }).response_format && rumpfFuer('anthropic', { ziel: ZIEL, katalog: {} }).tool_choice, 'rumpfFuer wählt nach Anbieter');
check(kostenCent({ ein: 5000, aus: 5000 }, 'gemini') === 0 && kostenCent({ ein: 5000, aus: 5000 }, 'anthropic') > 0 && ANBIETER.gemini.modell === 'gemini-3.8-flash' && ANBIETER.gemini.preis === null, 'Gemini (3.8 Flash) kostet nichts, Claude ein paar Cent');

// --- Rezept mit der KI ändern: Vorlage, Anfrage, ans Original anschließen, wieder aufs Ziel
const terK = kiBereinigen(festAlsKi(daten.rezepte.find((r) => r.id === 'teriyaki'), daten.katalog)).r;
const terOhne = terK.zutaten.filter((z) => !z.pauschal);
const vorlage = alsVorlage(terK);
const rund = kiBereinigen({ ...vorlage, portionen: 8 }).r;
check(rund && rund.zutaten.length === terOhne.length && rund.zutaten.every((z, i) => z.id === terOhne[i].id && Math.abs(z.menge - terOhne[i].menge) < 0.1 && z.anpassbar === terOhne[i].anpassbar) && rund.ablauf.every((p, i) => p.schritte.map((x) => x.d).join('|') === terK.ablauf[i].schritte.map((x) => x.d).join('|')), 'Vorlage zum Ändern: im Format der Antwort, ohne Verlust (Zutaten, Mengen, Schritte)');
check(!JSON.stringify(vorlage).includes('"kauf"') && !JSON.stringify(vorlage).includes('pauschal') && vorlage.vorbereiten.some((x) => x.text.includes('{reis}')), 'ohne Interna (kauf, pauschal), die Platzhalter bleiben');
const WUNSCH = 'fertige Teriyaki-Sauce statt selbst gemacht';
const ra = anfrageBauenGemini({ modus: 'aendern', rezept: vorlage, wunsch: WUNSCH, portionen: 8, ziel: ZIEL, katalog: daten.katalog });
const raText = ra.input.at(-1).text;
check(/änderst ein bestehendes Rezept/.test(ra.system_instruction) && /Kein Fisch/.test(ra.system_instruction) && /Kein Schweinefleisch/.test(ra.system_instruction) && /443 kcal/.test(ra.system_instruction) && /Platzhalter/.test(ra.system_instruction), 'Ändern: der Auftrag, mit allen Regeln und dem Ziel');
check(raText.endsWith(`Was anders sein soll: ${WUNSCH}`) && JSON.parse(raText.split('\n')[1]).zutaten.length === vorlage.zutaten.length && raText.includes('"id":"sojasauce"') && ra.input.length === 1, 'Ändern: das Rezept als JSON und der Wunsch, kein Foto');
const rc = anfrageBauen({ modus: 'aendern', rezept: vorlage, wunsch: WUNSCH, portionen: 8, ziel: ZIEL, katalog: daten.katalog });
check(/änderst ein bestehendes Rezept/.test(rc.system) && rc.tool_choice.name === 'rezept_ausgeben' && rc.messages[0].content.at(-1).text.includes(WUNSCH), 'Ändern geht auch mit Claude');
// So antwortet die KI im Test: fertige Sauce statt Soja, Honig, Stärke und Sesamöl
const TERIYAKI_FERTIGSAUCE = (() => {
  const v = klon(vorlage);
  v.zutaten = v.zutaten.filter((z) => !['sojasauce', 'honig', 'staerke', 'sesamoel'].includes(z.id));
  v.zutaten.push({ id: 'teriyaki-sauce', name: 'Teriyaki-Sauce (fertig)', menge: 250, einheit: 'ml', stueck: '1 Flasche', min: 250, max: 250, anpassbar: false, pro100: { kcal: 117, p: 3.5, kh: 24, f: 0.3 }, quelle: 'kaufen', katalog: '', abteilung: 'vorrat', packung: '250-ml-Flasche' });
  v.vorbereiten = v.vorbereiten.map((x) => (x.text.startsWith('In Schale 3 dazu') ? { text: '{teriyaki-sauce} Teriyaki-Sauce und ½–1 TL Chiliflocken in Schale 3 geben', min: 1 } : x));
  v.hinweis = 'Fertige Teriyaki-Sauce statt selbst gemacht – Soja, Honig, Stärke und Sesamöl fallen weg.';
  return v;
})();
const neuK = kiBereinigen({ ...TERIYAKI_FERTIGSAUCE, portionen: 8 }).r;
const angeschlossen = aenderungUebernehmen(neuK, terK);
check(angeschlossen.zutaten.find((z) => z.id === 'teriyaki-sauce')?.neu === true && Object.keys(angeschlossen.weg).sort().join() === 'honig,sesamoel,sojasauce,staerke' && angeschlossen.zutaten.some((z) => z.pauschal) && angeschlossen.zutaten.find((z) => z.id === 'fruehlingszwiebeln').kauf?.u === 'Bund', 'ans Original angeschlossen: Sauce neu, vier weggelassen, Gewürze pauschal und „1 Bund“ bleiben');
const aufZiel = mengenAnpassen(angeschlossen, ZIEL);
const boxZiel = proBox(aufZiel);
check(Math.abs(boxZiel.kcal - ZIEL.kcal) <= 5 && Math.abs(boxZiel.p - ZIEL.p) <= 0.5 && Math.abs(boxZiel.kh - ZIEL.kh) <= 0.5 && Math.abs(boxZiel.f - ZIEL.f) <= 0.5, `und wieder auf Ziel: ${Math.round(boxZiel.kcal)} kcal, ${boxZiel.p.toFixed(1)} P, ${boxZiel.kh.toFixed(1)} KH, ${boxZiel.f.toFixed(1)} F`);
check(aenderungenText(aufZiel, terK).includes('Teriyaki-Sauce (fertig) 250 ml neu') && aenderungenText(aufZiel, terK).includes('Sojasauce weggelassen'), 'die Änderungen in Worten');
const alsApp = alsRezept(aufZiel, { id: 'ki-test1234', katalog: daten.katalog, einheiten });
check(alsApp.ablauf[0].schritte.some((x) => x.d === '250 ml Teriyaki-Sauce und ½–1 TL Chiliflocken in Schale 3 geben') && !alsApp.ablauf.some((p) => p.schritte.some((x) => x.entfaellt)), 'die Schritte mit echten Mengen, nichts „entfällt“');

// --- Strom lesen (mit nachgebautem fetch)
const STROM = (json, { stopp = 'tool_use', stueck = 150 } = {}) => {
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  let s = ev({ type: 'message_start', message: { usage: { input_tokens: 3000, output_tokens: 1 } } });
  s += ev({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't1', name: 'rezept_ausgeben', input: {} } });
  for (let i = 0; i < json.length; i += stueck) s += ev({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + stueck) } });
  s += ev({ type: 'content_block_stop', index: 0 });
  s += ev({ type: 'message_delta', delta: { stop_reason: stopp }, usage: { output_tokens: 4000 } });
  s += ev({ type: 'message_stop' });
  return s;
};
const echtFetch = globalThis.fetch;
const mitFetch = async (antwort, f) => {
  globalThis.fetch = async (url, opt) => { mitFetch.letzte = { url, opt }; return antwort(); };
  try { return await f(); } finally { globalThis.fetch = echtFetch; }
};
let fortschritt = 0;
const gelesen = await mitFetch(() => new Response(STROM(JSON.stringify(ANTWORT)), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  () => kiAnfragen(rumpf, { schluessel: 'sk-ant-test', beiFortschritt: (p) => { fortschritt = p.zeichen; } }));
check(gelesen.eingabe.name === ANTWORT.name && gelesen.usage.ein === 3000 && gelesen.usage.aus === 4000 && fortschritt > 1000, 'der Strom wird gelesen: Rezept, Tokens, Fortschritt');
const kopf = mitFetch.letzte.opt.headers;
check(kopf['x-api-key'] === 'sk-ant-test' && kopf['anthropic-dangerous-direct-browser-access'] === 'true' && kopf['anthropic-version'] && JSON.parse(mitFetch.letzte.opt.body).stream === true, 'Anfrage mit Schlüssel, Browser-Freigabe, Version und stream');
check(Math.abs(kostenCent(gelesen.usage) - 4.6) < 0.01, `Kosten: ca. ${kostenCent(gelesen.usage).toFixed(1)} Cent`);
const fehlerArt = async (antwort) => { try { await mitFetch(antwort, () => kiAnfragen(rumpf, { schluessel: 'x' })); return 'kein Fehler'; } catch (e) { return e.art; } };
check(await fehlerArt(() => new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 })) === 'schluessel', '401: Schlüssel prüfen');
check(await fehlerArt(() => new Response(JSON.stringify({ error: { type: 'invalid_request_error', message: 'Your credit balance is too low' } }), { status: 400 })) === 'guthaben', 'kein Guthaben wird erkannt');
check(await fehlerArt(() => new Response(JSON.stringify({ error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 })) === 'ueberlastet', '529: überlastet');
check(await fehlerArt(() => new Response(STROM(JSON.stringify(ANTWORT).slice(0, 500), { stopp: 'max_tokens' }), { status: 200 })) === 'zulang', 'abgeschnittene Antwort: zu lang');
check(await fehlerArt(() => { throw new TypeError('Failed to fetch'); }) === 'netz', 'ohne Netz: Verbindung prüfen');

// --- Gemini-Strom lesen (Interactions-API: step.delta, interaction.completed)
const GEMINI_STROM = (json, { status = 'completed', stueck = 400 } = {}) => {
  const ev = (o) => `event: ${o.event_type}\r\ndata: ${JSON.stringify(o)}\r\n\r\n`;
  let s = ev({ event_type: 'interaction.created', interaction: { id: 'ia_1', status: 'in_progress' } });
  for (let i = 0; i < json.length; i += stueck) s += ev({ event_type: 'step.delta', index: 0, delta: { type: 'text', text: json.slice(i, i + stueck) } });
  s += ev({ event_type: 'interaction.completed', interaction: { id: 'ia_1', status, usage: { total_input_tokens: 2500, total_output_tokens: 3800, total_thought_tokens: 600, total_tokens: 6900 }, ...(status === 'failed' ? { error: { message: 'Blocked by safety filters' } } : {}) } });
  return s;
};
let gFortschritt = 0;
const gGelesen = await mitFetch(() => new Response(GEMINI_STROM(JSON.stringify(ANTWORT)), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  () => kiAnfragen(rg, { schluessel: GKEY, beiFortschritt: (p) => { gFortschritt = p.zeichen; } }));
check(gGelesen.eingabe.name === ANTWORT.name && gGelesen.anbieter === 'gemini' && gGelesen.usage.ein === 2500 && gGelesen.usage.aus === 4400 && gFortschritt > 1000, 'Gemini-Strom: Rezept, Tokens (mit Denken), Fortschritt');
const gKopf = mitFetch.letzte.opt.headers;
check(gKopf['x-goog-api-key'] === GKEY && !('x-api-key' in gKopf) && /\/v1beta\/interactions\?alt=sse$/.test(mitFetch.letzte.url) && JSON.parse(mitFetch.letzte.opt.body).stream === true, 'Gemini-Anfrage: eigener Kopf, Interactions-Adresse mit SSE');
const gFehler = async (antwort) => { try { await mitFetch(antwort, () => kiAnfragen(rg, { schluessel: GKEY })); return 'kein Fehler'; } catch (e) { return `${e.art}|${e.message}`; } };
check((await gFehler(() => new Response(JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }), { status: 400 }))).startsWith('schluessel|Google lehnt'), 'Gemini 400 „API key not valid“: Google lehnt den Schlüssel ab');
check((await gFehler(() => new Response(JSON.stringify([{ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }]), { status: 429 }))).startsWith('grenze|Das Gratis-Kontingent'), 'Gemini 429 (auch als Liste): Gratis-Kontingent');
check((await gFehler(() => new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded', status: 'UNAVAILABLE' } }), { status: 503 }))).startsWith('ueberlastet|Gemini'), 'Gemini 503: überlastet');
check((await gFehler(() => new Response(GEMINI_STROM(JSON.stringify(ANTWORT).slice(0, 300), { status: 'incomplete' }), { status: 200 }))).startsWith('zulang'), 'Gemini „incomplete“: zu lang');
check((await gFehler(() => new Response(GEMINI_STROM('', { status: 'failed' }), { status: 200 }))).startsWith('sicherheit'), 'Gemini „failed“ wegen Sicherheitsfilter: verständlicher Hinweis');
const ohneStrom = `event: interaction.completed\r\ndata: ${JSON.stringify({ event_type: 'interaction.completed', interaction: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(ANTWORT) }] }], usage: { total_input_tokens: 1, total_output_tokens: 2 } } })}\r\n\r\n`;
check((await mitFetch(() => new Response(ohneStrom, { status: 200 }), () => kiAnfragen(rg, { schluessel: GKEY }))).eingabe.name === ANTWORT.name, 'kommt der Text erst am Ende in steps, wird er auch gelesen');
const umzaeunt = await mitFetch(() => new Response(GEMINI_STROM(`\`\`\`json\n${JSON.stringify(ANTWORT)}\n\`\`\``), { status: 200 }), () => kiAnfragen(rg, { schluessel: GKEY }));
check(umzaeunt.eingabe.name === ANTWORT.name, 'JSON in ```-Zaun wird trotzdem gelesen');

// --- in liste.json, für beide
const behalten = anwenden(leer(), opKiBehalten('ki-abcd1234', k1, 'Amy'));
check(behalten.ki['ki-abcd1234']?.r.name === ANTWORT.name && behalten.ki['ki-abcd1234'].by === 'Amy', 'Behalten legt das Rezept unter ki ab');
const roh = klon(behalten);
roh.ki['kaputt id'] = { r: k1 };
roh.ki['ki-leer1234'] = { r: { name: 'nix' } };
for (let i = 0; i < 14; i++) roh.ki[`ki-alt${String(i).padStart(4, '0')}`] = { r: k1, by: 'Tobi', at: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00.000Z` };
const sauber = bereinigen(roh);
check(!sauber.ki['kaputt id'] && !sauber.ki['ki-leer1234'] && Object.keys(sauber.ki).length === 12 && sauber.ki['ki-abcd1234'] && !sauber.ki['ki-alt0000'], 'Bereinigen: kaputte Einträge fallen weg, höchstens 12, die ältesten zuerst');
check(Object.keys(sauber.ki).every((id) => KI_ID.test(id)), 'nur gültige ki-ids');
check(!anwenden(behalten, opKiWeg('ki-abcd1234')).ki['ki-abcd1234'], 'Löschen nimmt es wieder raus');
const zus = anwenden(anwenden(leer(), opKiBehalten('ki-bbbb1234', k1, 'Tobi')), opZusammen({}, behalten.ki));
check(Object.keys(zus.ki).length === 2, 'Einrichten der gemeinsamen Liste nimmt behaltene Rezepte mit');

/* ================================================================ im Browser */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4UaEBRwzEcQBTUhaBGaoOzwAAAABJRU5ErkJggg==', 'base64');
const KI_SCHLUESSEL = GKEY;

/** Nachgebaute Gemini-API (streamGenerateContent) – der normale Weg in der App. */
function geminiAttrappe() {
  const z = { anfragen: [], art: 'ok', verzoegerung: 0, antwort: ANTWORT, angebote: JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'ki-angebote.json'), 'utf8')) };
  async function route(r) {
    const req = r.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    z.anfragen.push({ url: req.url(), kopf: req.headers(), rumpf: JSON.parse(req.postData() || '{}') });
    if (z.verzoegerung) await new Promise((f) => { setTimeout(f, z.verzoegerung); });
    if (z.art === 'schluessel') return r.fulfill({ status: 400, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }) });
    if (z.art === 'ueberlastet') return r.fulfill({ status: 503, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } }) });
    const rumpf = z.anfragen.at(-1).rumpf;
    const antwort = rumpf.response_format?.schema?.title === 'angebote' ? z.angebote : z.antwort;
    return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: GEMINI_STROM(JSON.stringify(antwort)) });
  }
  return { z, route };
}

const browser = await starteBrowser();
const gh = githubAttrappe();
const ki = geminiAttrappe();
const tobi = await handy(browser, { attrappe: gh });
await tobi.ctx.route('https://generativelanguage.googleapis.com/**', ki.route);
const t = tobi.page;

// gemeinsame Liste einrichten
await t.click('.tab[data-tab="einkauf"]');
await t.click('[data-act="z-oeffnen"]');
await t.fill('#z-name', 'Tobi');
await t.fill('#z-token', SCHLUESSEL);
await t.click('#z-los');
await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt');
await t.click('.tab[data-tab="rezepte"]');

// --- einrichten
await t.click('.reste-karte');
check(!(await t.locator('#reste').isHidden()) && await t.locator('#k-schluessel').count() === 1, 'Resteverwertung öffnet – ohne Schlüssel zuerst das Einrichten');
await t.fill('#k-schluessel', 'falsch');
await t.click('#k-schluessel-form button[type="submit"]');
check((await t.locator('#k-schluessel-fehler').innerText()).includes('AQ.'), 'falscher Schlüssel: Hinweis, wie er aussieht');
await t.fill('#k-schluessel', KI_SCHLUESSEL);
await t.click('#k-schluessel-form button[type="submit"]');
check(await t.locator('#k-form').count() === 1, 'mit Schlüssel: das Formular');
check(await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).schluessel.startsWith('AQ.')), 'der KI-Schlüssel liegt im Speicher dieses Handys');
check((await t.locator('#k-form .fine').first().innerText()).includes('kostenlos'), 'mit Google-Schlüssel: „kostenlos“');

// --- ohne Eingabe geht nichts
await t.click('#k-los');
check((await t.locator('#k-fehler').innerText()).includes('Schreib auf'), 'ohne Text und Foto: Hinweis statt Anfrage');
check(ki.z.anfragen.length === 0, 'und keine Anfrage an Google');

// --- Text, Foto, Portionen
await t.fill('#k-text', '500 g Hähnchen, 1 Zucchini, Feta, Reis');
await t.setInputFiles('#k-bilder', { name: 'kuehlschrank.png', mimeType: 'image/png', buffer: PNG });
check(await bis(async () => (await t.locator('.k-foto img').count()) === 1), 'das Foto erscheint als Vorschau');
await t.click('[data-portionen="8"]');
await t.fill('#k-wunsch', 'was Mediterranes');
await t.click('#k-los');
check(await bis(async () => (await t.locator('#d-title').count()) === 1 && (await t.locator('#d-title').innerText()) === ANTWORT.name, 10000), 'Claudes Rezept öffnet als Vorschlag');

const anfrage = ki.z.anfragen[0];
check(anfrage?.kopf['x-goog-api-key'] === KI_SCHLUESSEL && /\/v1beta\/interactions\?alt=sse/.test(anfrage.url) && anfrage.rumpf.model === 'gemini-3.8-flash', 'die Anfrage geht mit dem Schlüssel an Gemini 3.8 Flash (Interactions-API)');
const teile = anfrage.rumpf.input;
check(teile[0].type === 'image' && teile[0].mime_type === 'image/jpeg' && teile[0].data.length > 50 && /Portionen: 8/.test(teile.at(-1).text) && /Mediterranes/.test(teile.at(-1).text), 'mit Foto (als JPEG), Portionen und Wunsch');
check(anfrage.rumpf.response_format?.schema?.type === 'object', 'und dem Schema für die Antwort');
check((await t.locator('.ki-leiste').innerText()).includes('noch nicht gespeichert') && (await t.locator('.ki-leiste').innerText()).includes('gemini-3.8-flash, kostenlos'), 'Leiste: noch nicht gespeichert, Gemini, kostenlos');
check((await t.locator('.ki-anp').innerText()).includes('Auf eure Ziele gerechnet'), 'Leiste: welche Mengen die App angepasst hat');
const kcal = Number((await t.locator('.label .c-kcal .v').innerText()).replace(/\D/g, ''));
check(Math.abs(kcal - 443) <= 10, `das Etikett zeigt eine Box nahe am Ziel (${kcal} kcal)`);
const gruppen = await t.$$eval('#detail .sub-h', (hs) => hs.map((h) => h.textContent));
check(gruppen.includes('Einkaufen') && gruppen.includes('Ist schon da') && gruppen.includes('Aus dem Vorrat'), `Zutaten nach Einkaufen, Ist schon da, Vorrat (${gruppen.join(', ')})`);
check(!(await t.locator('#detail .steps').allInnerTexts()).join(' ').includes('{'), 'in den Schritten stehen Mengen, keine Platzhalter');
check(await t.locator('#detail .step .schale').count() >= 4, 'Schalen als Schilder in den Schritten');
check(await t.locator('[data-open^="ki-"]').count() === 0, 'ein Vorschlag steht noch nicht im Raster');

// --- neu laden: der Vorschlag ist noch da
await t.reload({ waitUntil: 'load' });
await t.waitForFunction(() => document.querySelector('#d-title'));
check((await t.locator('#d-title').innerText()) === ANTWORT.name, 'nach dem Neuladen ist der Vorschlag noch offen');

// --- auf die Liste: das behält das Rezept automatisch, und nur, was fehlt
await t.click('[data-act="alle-dazu"]');
check(await bis(() => Object.keys(gh.liste()?.ki || {}).length === 1), 'auf die Liste setzen behält das Rezept für beide');
check(await bis(async () => (await t.locator('.ki-leiste').innerText()).includes('für euch beide gespeichert')), 'Leiste: für euch beide gespeichert');
const items = gh.liste().items;
const rid = Object.keys(gh.liste().ki)[0];
const vonKi = Object.entries(items).filter(([, d]) => d.parts?.[rid]).map(([k]) => k).sort();
check(vonKi.join(',') === 'haehnchenbrust,ki-kichererbsen,ki-paprika,passata', `nur was fehlt kommt auf die Liste (${vonKi.join(', ')})`);
check(items['ki-kichererbsen'].name === 'Kichererbsen, abgetropft' && items['ki-kichererbsen'].cat === 'konserven', 'eigene Zutaten mit Namen und Abteilung');
await t.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await t.locator('#list-body .item-sub', { hasText: 'Feta-Reispfanne' }).count()) >= 4), 'auf der Liste steht, für welches Rezept');
await t.click('.tab[data-tab="rezepte"]');

// --- das zweite Handy sieht es
const einladung = `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}&ki=${encodeURIComponent(KI_SCHLUESSEL)}`;
await t.click('.tab[data-tab="einkauf"]');
const linkFeld = await t.evaluate(() => document.querySelector('#z-linkfeld')?.value || '');
check(linkFeld.includes('&ki=AQ.'), 'der Link fürs zweite Handy enthält jetzt auch den KI-Schlüssel');
await t.click('.tab[data-tab="rezepte"]');
const amy = await handy(browser, { attrappe: gh, adresse: einladung });
const a = amy.page;
check(await a.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.ki.v1') || '{}').schluessel?.startsWith('AQ.')), 'Amy: der KI-Schlüssel kommt über den Link');
await a.fill('#z-name', 'Amy');
await a.click('#z-los');
await bis(async () => (await a.locator('#sync-text').innerText()) === 'Geteilt');
await a.click('.tab[data-tab="rezepte"]');
check(await bis(async () => (await a.locator('[data-filter="reste"]').isVisible()) && (await a.locator('[data-filter="reste"] .n').innerText()) === '1'), 'Amy: Filter „Resteverwertung“ mit 1 Rezept');
await a.click('[data-filter="reste"]');
check(await a.locator('#grid .box').count() === 1 && (await a.locator('#grid .box .pill-ki').count()) === 1, 'Amy sieht Tobis Rezept im Raster');
await a.click('#grid .box');
check((await a.locator('.ki-leiste').innerText()).includes('von Tobi'), 'mit „von Tobi“');

// --- Fehler
ki.z.art = 'ueberlastet';
await t.click('[data-act="ki-neu"]');
check(await bis(async () => (await t.locator('#k-fehler').count()) === 1 && (await t.locator('#k-fehler').innerText()).includes('überlastet')), 'Gemini überlastet: Hinweis, nochmal versuchen');
check(ki.z.anfragen.at(-1).rumpf.input.at(-1).text.includes('Bitte nicht noch einmal'), 'ein neuer Vorschlag soll ein anderes Gericht sein');
ki.z.art = 'schluessel';
await t.click('#k-los');
check(await bis(async () => (await t.locator('#k-schluessel-fehler').count()) === 1 && (await t.locator('#k-schluessel-fehler').innerText()).includes('lehnt den Schlüssel ab')), 'Schlüssel abgelehnt: zurück zum Einrichten');
await t.click('[data-act="k-einrichten-zu"]');
ki.z.art = 'ok';
ki.z.verzoegerung = 4000;
await t.click('#k-los');
check(await bis(async () => (await t.locator('.ki-lauf').count()) === 1), 'während Claude kocht: Fortschritt mit Abbrechen');
await t.click('[data-act="k-abbrechen"]');
check(await bis(async () => (await t.locator('#k-form').count()) === 1) && (await t.locator('#k-fehler').isHidden()), 'Abbrechen: zurück zum Formular, ohne Fehler');
ki.z.verzoegerung = 0;
ki.z.antwort = { ...ANTWORT, zutaten: [...ANTWORT.zutaten, { ...ANTWORT.zutaten[0], id: 'speck', name: 'Speckwürfel' }] };
await t.click('#k-los');
check(await bis(async () => (await t.locator('#k-fehler').innerText().catch(() => '')).includes('das esst ihr nicht')), 'Speck im Rezept: Hinweis statt Rezept');
ki.z.antwort = ANTWORT;

// --- Anpassen im Browser: Teriyaki mit 200 g Brokkoli und Erbsen
await t.click('[data-act="reste-zu"]');
await t.click('[data-filter="alle"]');
await t.click('[data-open="teriyaki"]');
await t.click('[data-act="anpassen"]');
check(!(await t.locator('#d-anpassen').isHidden()) && (await t.locator('#d-anpassen .anp').count()) >= 12, 'Anpassen öffnet mit allen Zutaten');
await t.fill('[data-anp-menge="brokkoli"]', '200');
await t.dispatchEvent('[data-anp-menge="brokkoli"]', 'input');
check((await t.getAttribute('[data-anp-lock="brokkoli"]', 'aria-pressed')) === 'true', 'angefasst = fest (Schloss zu)');
await t.fill('#anp-such', 'TK-Erbsen');
await t.fill('#anp-neu-menge', '400');
await t.click('#anp-form button[type="submit"]');
check(await t.locator('.anp[data-zid="erbsen"]').count() === 1 && (await t.locator('.anp[data-zid="erbsen"] .anp-neu-k').count()) === 1, 'TK-Erbsen stehen als neue Zutat drin');
const werteVorher = await t.locator('#d-anpassen .anp-werte').innerText();
await t.click('[data-act="anp-rechnen"]');
const werteNachher = (await t.locator('#d-anpassen .anp-werte').innerText()).replace(/\s+/g, ' ');
const kcalEd = Number(werteNachher.match(/KCAL (\d+)/)?.[1]);
check(werteVorher !== werteNachher && Math.abs(kcalEd - 443) <= 8, `„Auf Ziel rechnen“ bringt die Box aufs Ziel (${werteNachher})`);
check((await t.locator('#d-anpassen .ki-anp').innerText()).includes('Brokkoli 1 kg → 200 g') && (await t.locator('#d-anpassen .ki-anp').innerText()).includes('TK-Erbsen 400 g neu'), 'die Änderungen stehen in Worten da');
await t.click('[data-act="anp-speichern"]');
check(await bis(async () => (await t.locator('#d-title').innerText()) === 'Chicken Teriyaki Bowl (angepasst)'), 'Speichern öffnet das angepasste Rezept');
check(await bis(() => Object.values(gh.liste()?.ki || {}).some((e) => e.r.herkunft === 'teriyaki')), 'und es liegt mit herkunft = teriyaki in GitHub, für beide');
check((await t.locator('.ki-leiste').innerText()).includes('Angepasst von Teriyaki Bowl'), 'Leiste: „Angepasst von Teriyaki Bowl“');
check((await t.$$eval('.step-d', (xs) => xs.map((x) => x.textContent))).some((x) => x.startsWith('200 g Brokkoli')) && (await t.locator('.step-li .step-k', { hasText: 'neu dazu' }).count()) === 1, 'Schritte mit den neuen Mengen und dem neuen Schritt für die Erbsen');
await t.click('[data-act="zurueck"]');
check(await t.locator('[data-filter="reste"] .n').innerText() === '2' && (await t.locator('.pill-ki', { hasText: 'Angepasst' }).count()) === 1, 'im Raster: 2 eigene Rezepte, eins davon „Angepasst“');
const ersatz = await t.$$eval('[data-open^="ki-"] .box-foto-ersatz', (es) => es.map((e) => [...e.querySelectorAll('img')].map((i) => i.getAttribute('src').split('/').pop())));
check(ersatz.length === 2 && ersatz.every((l) => l.length >= 1 && l.length <= 3 && new Set(l).size === l.length && l.every((n) => n.endsWith('.svg'))), `KI-Rezepte ohne Foto: Ersatzbild aus bis zu drei Zutaten-Bildchen (${ersatz.map((l) => l.join('+')).join(' | ')})`);

// --- Mit KI ändern: Teriyaki mit fertiger Sauce – die App rechnet danach wieder aufs Ziel
await t.click('[data-open="teriyaki"]');
await t.click('[data-act="anpassen-ki"]');
check(!(await t.locator('#d-anpassen').isHidden()) && await bis(async () => t.evaluate(() => document.activeElement?.id === 'anp-ki-text')), '„Mit KI ändern“ öffnet das Anpassen, der Cursor steht im Wunschfeld');
const vorKi = ki.z.anfragen.length;
await t.click('#anp-ki-los');
check((await t.locator('#anp-ki-fehler').innerText()).includes('Schreib, was anders sein soll') && ki.z.anfragen.length === vorKi, 'ohne Wunsch: Hinweis, keine Anfrage');
ki.z.antwort = { ...TERIYAKI_FERTIGSAUCE, zutaten: [...TERIYAKI_FERTIGSAUCE.zutaten, { ...TERIYAKI_FERTIGSAUCE.zutaten[0], id: 'fischsauce', name: 'Fischsauce' }] };
await t.fill('#anp-ki-text', 'mit Fischsauce');
await t.click('#anp-ki-los');
check(await bis(async () => (await t.locator('#anp-ki-fehler').isVisible()) && (await t.locator('#anp-ki-fehler').innerText()).includes('Fischsauce')) && (await t.locator('#d-anpassen .ki-anp').count()) === 0, 'verbotene Zutat von der KI: Fehler, nichts übernommen');
ki.z.antwort = TERIYAKI_FERTIGSAUCE;
await t.fill('#anp-ki-text', WUNSCH);
await t.click('#anp-ki-los');
check(await bis(async () => (await t.locator('#d-anpassen .ki-anp').count()) === 1 && (await t.locator('#d-anpassen .ki-anp').innerText()).includes('Teriyaki-Sauce (fertig) 250 ml neu')), 'die KI hat geändert: fertige Sauce neu');
const kiAnfrage = ki.z.anfragen.at(-1).rumpf;
check(ki.z.anfragen.length === vorKi + 2 && /änderst ein bestehendes Rezept/.test(kiAnfrage.system_instruction) && kiAnfrage.input.at(-1).text.endsWith(`Was anders sein soll: ${WUNSCH}`) && kiAnfrage.input.at(-1).text.includes('"id":"sojasauce"'), 'die Anfrage: das Rezept, wie es steht, und der Wunsch');
const anpText = await t.locator('#d-anpassen .ki-anp').innerText();
check(['Sojasauce weggelassen', 'Honig weggelassen', 'Speisestärke weggelassen', 'Sesamöl weggelassen'].every((x) => anpText.includes(x)), `weggelassen, was die Sauce ersetzt (${anpText.replace(/\s+/g, ' ').slice(0, 170)})`);
const kiWerte = (await t.locator('#d-anpassen .anp-werte').innerText()).replace(/\s+/g, ' ');
check(Math.abs(Number(kiWerte.match(/KCAL (\d+)/)?.[1]) - 443) <= 5, `und wieder auf Ziel gerechnet (${kiWerte})`);
check((await t.locator('.anp-ki-hinweis').innerText()).includes('Fertige Teriyaki-Sauce statt selbst gemacht'), 'der Hinweis der KI steht da');
await t.click('[data-act="anp-speichern"]');
check(await bis(async () => (await t.locator('#d-title').innerText()) === 'Chicken Teriyaki Bowl (angepasst)' && (await t.$$eval('.step-d', (xs) => xs.map((x) => x.textContent))).some((x) => x.startsWith('250 ml Teriyaki-Sauce und ½–1 TL Chiliflocken in Schale 3'))), 'gespeichert: die Schritte mit der fertigen Sauce');
check(await bis(() => Object.values(gh.liste()?.ki || {}).some((e) => e.r.herkunft === 'teriyaki' && e.r.zutaten.some((z) => z.id === 'teriyaki-sauce'))), 'und in GitHub, für beide');
ki.z.antwort = ANTWORT;
await t.click('[data-act="zurueck"]');

// --- Angebote der Woche: tippen, fotografieren, Treffer, Rezept daraus, das andere Handy
await t.click('.tab[data-tab="angebote"]');
// die automatisch geholten Angebote (tests/daten/angebote.json über die Attrappe)
check(await bis(async () => (await t.locator('#a-auto .a-item').count()) === 7), `automatisch geholt: 7 Rezeptzutaten von Aldi, Kaufland, Penny, abgelaufene nicht (${await t.locator('#a-auto .a-item').count()})`);
check((await t.locator('#a-auto .a-stand').innerText()).includes('KW 44') && (await t.locator('.a-quelle', { hasText: 'Aldi 4' }).count()) === 1 && (await t.locator('.a-quelle-aus', { hasText: 'Lidl' }).count()) === 1 && (await t.locator('.a-quelle-aus', { hasText: 'Rewe' }).count()) === 1, 'Stand und Quellen: KW, Aldi 4, Lidl fehlt, Rewe gesperrt');
check((await t.locator('#a-auto .a-lidl').innerText()).includes('GEMINI_KEY'), 'ohne Lidl steht dran, welches Secret fehlt');
check((await t.locator('#a-badge').innerText()) === '7' && (await t.locator('[data-a-filter="zutaten"] .n').innerText()) === '7' && (await t.locator('[data-a-filter="alle"] .n').innerText()) === '8', 'Zahl am Reiter: die Rezeptzutaten; Chips: 7 Zutaten, 8 Lebensmittel');
await t.click('[data-a-filter="alle"]');
check(await t.locator('#a-auto .a-item').count() === 8 && (await t.locator('#a-auto .a-ohne').count()) === 1, '„Alle Lebensmittel“: auch die Gyoza, ohne Rezeptzutat');
await t.fill('#a-suche', 'hack');
check(await bis(async () => (await t.locator('#a-auto .a-item').count()) === 1) && (await t.locator('#a-auto .a-item .item-name').innerText()).includes('Rinderhack'), 'Suche in den Angeboten');
await t.fill('#a-suche', '');
await t.click('[data-a-filter="zutaten"]');
check(await t.locator('#a-auto .a-item .x').count() === 0, 'automatische Angebote lassen sich nicht löschen – die kommen wieder');
// Produktfotos: das Aldi-Hähnchen hat eins (lädt im Test nicht → Bildchen der Zutat), die anderen gleich das Bildchen
const hBild = t.locator('#a-auto .a-item', { hasText: 'Hähnchenbrustfilet-Teilstücke' }).locator('.a-bild img');
check(await bis(async () => (await hBild.getAttribute('src')) === 'bilder/zutaten/poultry-leg.svg') && (await hBild.getAttribute('referrerpolicy')) === 'no-referrer' && (await t.locator('#a-auto .a-item', { hasText: 'Hähnchenbrustfilet-Teilstücke' }).locator('.a-bild-zb').count()) === 1, 'Produktfoto lädt nicht → das Bildchen der Zutat springt ein');
const aBilder = await t.$$eval('#a-auto .a-item .a-bild img', (is) => is.map((i) => i.getAttribute('src')));
check(aBilder.length === 7 && aBilder.every((src) => src.startsWith('bilder/zutaten/')) && aBilder.includes('bilder/zutaten/bell-pepper.svg'), `jedes Angebot hat ein Bild (${aBilder.map((x) => x.split('/').pop()).join(', ')})`);
check((await t.locator('#a-passt-liste li').count()) >= 5 && (await t.locator('#a-passt-liste li').first().innerText()).includes('im Angebot'), 'und „Passt zu euren Rezepten“ nutzt sie');
check((await t.locator('.a-oben [data-act="a-zu-passt"] .btn-n').innerText()) === String(await t.locator('#a-passt-liste li').count()), 'oben der Knopf „Passt zu euren Rezepten“, mit der Zahl der Rezepte');
await t.evaluate(() => window.scrollTo(0, 0));
await t.click('[data-act="a-zu-passt"]');
check(await bis(async () => Math.abs(await t.evaluate(() => document.querySelector('#a-passt').getBoundingClientRect().top)) < 120), 'der Knopf springt direkt dorthin');
check(await t.locator('#a-form').count() === 1 && (await t.locator('#a-liste .a-item').count()) === 0 && !(await t.locator('#a-text').isVisible()), 'eigene Angebote: Formular zugeklappt, noch keine');
await t.click('.a-eigene summary');
check(await t.locator('#a-text').isVisible(), 'aufklappen');
await t.fill('#a-text', 'Aldi Hähnchenbrustfilet 1 kg 7,49\nAldi Paprika 500 g 1,29\nLidl: Gummibärchen 200 g 0,99\nQuatsch ohne Preis');
await t.click('#a-los');
check(await bis(async () => (await t.locator('#a-liste .a-item').count()) === 3), 'drei getippte Zeilen eingetragen, die vierte nicht');
check((await t.locator('#a-badge').innerText()) === '10' && (await t.locator('#a-count').innerText()) === '10 für euch', 'Zahl am Reiter und oben: 7 automatische Zutaten + 3 eigene');
check((await t.locator('#a-liste .a-grp[data-laden="Aldi"] .item-sub').first().innerText()).includes('→ Hähnchenbrustfilet') && (await t.locator('#a-liste .a-grp[data-laden="Lidl"] .a-ohne').count()) === 1, 'Aldi-Hähnchen ist eine Rezeptzutat, Gummibärchen nicht');
check(await bis(() => (gh.liste()?.angebote?.eintraege || []).length === 3), 'die Angebote stehen in GitHub');
check((await t.locator('#a-passt-liste li').count()) >= 5 && /spart ≈ \d,\d\d €\/Box/.test(await t.locator('#a-passt-liste li').first().innerText()), `„Passt zu euren Rezepten“ mit Ersparnis (${(await t.locator('#a-passt-liste li').first().innerText()).replace(/\s+/g, ' ').slice(0, 70)})`);
await t.click('#a-passt-liste li:first-child button');
check(await bis(async () => (await t.locator('#detail').isVisible()) && (await t.evaluate(() => document.querySelector('#app').dataset.tab)) === 'rezepte'), 'antippen öffnet das Rezept im Reiter Rezepte');
await t.click('[data-act="zurueck"]');
await t.click('.tab[data-tab="angebote"]');
// Fotos: die KI liest sie aus
await t.setInputFiles('#a-bilder', { name: 'prospekt.png', mimeType: 'image/png', buffer: PNG });
check(await bis(async () => (await t.locator('#a-vorschau img').count()) === 1) && (await t.locator('#a-los').innerText()) === 'Angebote auslesen', 'mit Bild heißt der Knopf „Angebote auslesen“');
const anfragenVorher = ki.z.anfragen.length;
await t.click('#a-los');
check(await bis(async () => (await t.locator('#a-liste .a-item').count()) === 6), 'die KI liest drei neue Angebote aus dem Bild (Doppeltes und ohne Preis fallen weg)');
const aAnfrage = ki.z.anfragen.at(-1).rumpf;
check(ki.z.anfragen.length === anfragenVorher + 1 && aAnfrage.response_format.schema.title === 'angebote' && aAnfrage.input[0].type === 'image' && /Prospekt/.test(aAnfrage.system_instruction), 'eine Anfrage mit Bild und dem Angebote-Schema');
check((await t.locator('.a-grp[data-laden="Lidl"] .item').count()) === 4 && (await t.locator('.a-grp[data-laden="Lidl"] h3').innerText()).includes('bis'), 'Lidl: vier Angebote mit Gültigkeit');
check(await t.locator('#a-vorschau img').count() === 0 && (await t.inputValue('#a-text')) === '', 'danach sind Bild und Text weg');
// das andere Handy
await a.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await a.locator('#a-liste .a-item').count()) === 6), 'Amy sieht dieselben sechs eigenen Angebote');
check((await a.locator('#a-liste .a-foot .fine').innerText()).includes('von Tobi'), 'mit „von Tobi“');
// eins weg und zurück
await t.click('.a-grp[data-laden="Lidl"] [data-a-weg]');
check(await bis(async () => (await t.locator('#a-liste .a-item').count()) === 5), 'ein Angebot entfernt');
await t.click('#toast button');
check(await bis(async () => (await t.locator('#a-liste .a-item').count()) === 6), 'Rückgängig bringt es zurück');
// ein Rezept aus den Angeboten
const anfragenVorVorschlag = ki.z.anfragen.length;
await t.click('[data-act="a-vorschlag"]');
check(await bis(() => ki.z.anfragen.length > anfragenVorVorschlag), 'der Knopf wechselt zur KI im Modus „Angebote“ und schickt die Anfrage los');
const rezeptAnfrage = ki.z.anfragen.at(-1).rumpf;
check(/Angeboten der Woche/.test(rezeptAnfrage.system_instruction) && rezeptAnfrage.input.at(-1).text.includes('Das ist diese Woche im Angebot:') && rezeptAnfrage.input.at(-1).text.includes('Aldi: Hähnchenbrustfilet 1 kg 7,49 €') && rezeptAnfrage.input.at(-1).text.includes('Rinder-Gulasch'), 'die Anfrage enthält die eigenen und die automatischen Angebote je Laden');
check(await bis(async () => (await t.locator('.ki-leiste').count()) === 1 && (await t.locator('.ki-leiste').innerText()).includes('Aus den Angeboten')), 'der Vorschlag öffnet sich mit „Aus den Angeboten“');
await t.click('[data-act="ki-verwerfen"]');
check(await bis(async () => (await t.locator('#k-titel').innerText()) === 'Rezept aus den Angeboten') && (await t.inputValue('#k-text')).includes('Lidl:'), 'Verwerfen: zurück ins Formular, die Angebote stehen noch drin');
await t.click('[data-act="k-modus-reste"]');
check((await t.locator('#k-titel').innerText()) === 'Was ist noch da?' && (await t.inputValue('#k-text')) === '', '„Lieber Resteverwertung“: zurück zum normalen Formular');
// alle löschen mit Rückfrage
await t.click('.tab[data-tab="angebote"]');
await t.click('[data-act="a-leeren"]');
await t.click('[data-act="a-leeren-ja"]');
check(await bis(async () => (await t.locator('#a-liste .a-item').count()) === 0) && (await t.locator('#a-badge').innerText()) === '7', 'Alle eigenen löschen: leer, am Reiter bleiben die 7 automatischen');
await t.click('#toast button');
check(await bis(async () => (await t.locator('#a-liste .a-item').count()) === 6), 'Rückgängig: alle wieder da');
// --- der Laden, zu dem man geht
check((await t.locator('.a-laeden-chips .chip').count()) === 5 && (await t.locator('[data-a-laden=""][aria-pressed="true"] .n').innerText()) === '13' && (await t.locator('[data-a-laden="Aldi"] .n').innerText()) === '5' && (await t.locator('[data-a-laden="Lidl"] .n').innerText()) === '4', 'oben die Läden: Alle 13, Aldi 5 (3 Zutaten + 2 eigene), Lidl 4 (eigene), Kaufland, Penny');
await t.click('[data-a-laden="Aldi"]');
check((await t.locator('#a-title').innerText()) === 'Angebote bei Aldi' && (await t.locator('#a-count').innerText()) === '5 für euch' && (await t.locator('#a-auto .a-grp').count()) === 1 && (await t.locator('#a-auto .a-grp').getAttribute('data-laden')) === 'Aldi' && (await t.locator('#a-auto .a-item').count()) === 3 && (await t.locator('#a-liste .a-item').count()) === 2, 'Aldi gewählt: nur Aldi – 3 automatische Zutaten, 2 eigene');
const passtAldi = (await t.locator('#a-passt-liste li small').allInnerTexts()).join(' | ');
check((await t.locator('.a-passt .sub-h').innerText()).includes('mit den Angeboten von Aldi') && (await t.locator('#a-passt-liste li').count()) >= 1 && /Hähnchenbrust|Rinderhack|Zucchini|Paprika/.test(passtAldi) && !/Gulasch|Kartoffeln|Cashew|Gnocchi/.test(passtAldi), `„Passt zu euren Rezepten“ rechnet nur mit Aldi – kein Gulasch von Penny, keine Kartoffeln von Kaufland (${passtAldi.slice(0, 80)})`);
const anfragenVorAldi = ki.z.anfragen.length;
await t.click('[data-act="a-vorschlag"]');
check(await bis(() => ki.z.anfragen.length > anfragenVorAldi), 'Rezept aus den Angeboten – mit Laden gewählt');
const aldiText = ki.z.anfragen.at(-1).rumpf.input.at(-1).text;
check(aldiText.includes('Aldi: Hähnchenbrustfilet 1 kg 7,49 €') && !aldiText.includes('Rinder-Gulasch') && !aldiText.includes('Kaufland') && !aldiText.includes('Lidl'), 'die KI bekommt nur die Aldi-Angebote');
await t.click('[data-act="ki-verwerfen"]');
await t.click('[data-act="k-modus-reste"]');
await t.click('.tab[data-tab="angebote"]');
await t.click('[data-a-laden="Lidl"]');
check((await t.locator('#a-auto .a-leer').innerText()).includes('Von Lidl ist diese Woche nichts da – der Abruf hat nicht geklappt') && (await t.locator('#a-liste .a-item').count()) === 4 && (await t.locator('.a-passt').count()) === 1, 'Lidl gewählt: automatisch nichts (Abruf fehlgeschlagen), die 4 eigenen Lidl-Angebote, passende Rezepte dazu');
await t.reload({ waitUntil: 'load' });
await t.waitForFunction(() => document.querySelector('.tab[data-tab="angebote"]'));
await t.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await t.locator('[data-a-laden="Lidl"][aria-pressed="true"]').count()) === 1) && (await t.locator('#a-title').innerText()) === 'Angebote bei Lidl', 'die Wahl bleibt auf diesem Handy (nach Neuladen noch Lidl)');
check(await bis(async () => (await a.locator('[data-a-laden=""][aria-pressed="true"]').count()) === 1), 'Amys Handy hat seine eigene Wahl (Alle)');
await t.click('[data-a-laden=""]');
check((await t.locator('#a-title').innerText()) === 'Angebote der Woche' && (await t.locator('#a-auto .a-grp').count()) === 3 && (await t.locator('#a-liste .a-item').count()) === 6, '„Alle“: wieder alle Läden');

// --- Rewe & Co. aus dem privaten Daten-Repo (angebote-privat.json, kaufDA erlaubt nur private Nutzung)
const KAUFDA_HINWEIS = 'über kaufDA, gezielt nach 40 Stichwörtern für Rezeptzutaten gesucht – nicht das ganze Prospekt';
gh.zustand.dateien['angebote-privat.json'] = JSON.stringify({
  stand: '2026-10-28T05:47:00.000Z', woche: '2026-44', gesperrt: [],
  quellen: [{ laden: 'Rewe', ok: true, anzahl: 2, hinweis: KAUFDA_HINWEIS, stand: '2026-10-28T05:47:00.000Z' }, { laden: 'Edeka', ok: true, anzahl: 1, hinweis: KAUFDA_HINWEIS, stand: '2026-10-28T05:47:00.000Z' }],
  angebote: [
    { id: 'a-rewe001', laden: 'Rewe', name: 'Hähnchen-Brustfilet', preis: 8.99, menge: 1000, einheit: 'g', von: '2026-10-26', bis: '2099-12-31', k: 'haehnchenbrust' },
    { id: 'a-rewe002', laden: 'Rewe', name: 'Rispentomaten', preis: 1.79, menge: 1, einheit: 'kg', von: '2026-10-26', bis: '2099-12-31', k: 'tomaten' },
    { id: 'a-edek001', laden: 'Edeka', name: 'Rinder-Hackfleisch', preis: 1.19, menge: 100, einheit: 'g', von: '2026-10-26', bis: '2099-12-31', k: 'rinderhack' },
  ],
});
await t.reload({ waitUntil: 'load' });
await t.waitForFunction(() => document.querySelector('.tab[data-tab="angebote"]'));
await t.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await t.locator('[data-a-laden="Rewe"]').count()) === 1) && gh.zustand.lesen['angebote-privat.json'] >= 1, 'mit dem Schlüssel holt die App angebote-privat.json aus dem Daten-Repo: Rewe steht zur Wahl');
const chipsPrivat = (await t.locator('.a-laeden-chips .chip').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
check(chipsPrivat.join(' | ') === 'Alle 16 | Aldi 5 | Lidl 4 | Rewe 2 | Kaufland 2 | Penny 2 | Edeka 1', `Läden: Rewe und Edeka dazu, in fester Reihenfolge (${chipsPrivat.join(' | ')})`);
const standPrivat = await t.locator('#a-auto .a-stand').innerText();
check(standPrivat.includes('Rewe 2') && !standPrivat.includes('sperren') && (await t.locator('.a-kaufda').innerText()).includes('Rewe, Edeka: über kaufDA gezielt nach euren Rezeptzutaten gesucht'), 'Quellen: Rewe und Edeka nicht mehr „gesperrt“; Hinweis, dass kaufDA nur die Rezeptzutaten liefert');
check((await t.locator('.a-lead').innerText()).includes('Aldi, Lidl, Rewe, Kaufland, Penny und Edeka'), 'der Text oben nennt die Läden aus beiden Abrufen');
await t.click('[data-a-laden="Rewe"]');
check((await t.locator('#a-title').innerText()) === 'Angebote bei Rewe' && (await t.locator('#a-auto .a-item').count()) === 2 && (await t.locator('#a-passt-liste li').count()) >= 1, 'Rewe gewählt: die zwei Rewe-Angebote und passende Rezepte');
await t.click('[data-a-laden=""]');

// --- Hähnchen auf einen Tipp, und die besten Angebote zuerst (Rabatt gegen den Richtpreis)
check((await t.locator('.a-chips .chip').first().getAttribute('data-a-filter')) === 'haehnchen' && (await t.locator('[data-a-filter="haehnchen"] .n').innerText()) === '2', 'vorn der Knopf „Hähnchen“: zwei – Aldi und Rewe');
await t.click('[data-a-filter="haehnchen"]');
const huehner = await t.$$eval('#a-auto .a-item .item-name', (xs) => xs.map((x) => x.textContent));
check(huehner.length === 2 && huehner.every((n) => /Hähnchen/.test(n)), `„Hähnchen“ zeigt nur Hähnchen (${huehner.join(', ')})`);
const teilstuecke = t.locator('#a-auto .a-item', { hasText: 'Teilstücke' });
check((await teilstuecke.locator('.a-rabatt').innerText()) === '−24 %' && (await teilstuecke.locator('.item-sub').innerText()).includes('8,65 €/kg'), 'Aldi-Hähnchen: −24 % gegen den üblichen Preis, 8,65 €/kg');
await t.click('[data-a-sort="rabatt"]');
const besteH = await t.$$eval('#a-auto .a-beste .a-item', (xs) => xs.map((x) => `${x.querySelector('.a-ladenname')?.textContent}|${x.querySelector('.a-rabatt')?.textContent || ''}`));
check(besteH.join(' / ') === 'Aldi|−24 % / Rewe|−21 %' && (await t.locator('#a-auto .a-grp').count()) === 0, `„Beste zuerst“: eine Liste über alle Läden, der Laden steht in der Zeile (${besteH.join(' / ')})`);
await t.click('[data-a-filter="zutaten"]');
const besteZ = await t.$$eval('#a-auto .a-beste .a-item .item-name', (xs) => xs.map((x) => x.textContent));
check(besteZ.join(' | ') === 'Zucchini | Rispentomaten | Rinderhackfleisch XXL | Hähnchenbrustfilet-Teilstücke | Hähnchen-Brustfilet | K-classic Cashewkerne | Rinder-Hackfleisch | Bürger XXL Gnocchi | Span. Bio-Paprika, rot und gelb | Mühlenhof Frisches Rinder-Gulasch', `alle Rezeptzutaten, die besten zuerst, teurere unten (${besteZ.join(' | ')})`);
check((await t.locator('#a-auto .a-beste .a-rabatt').count()) === 6, 'die Plakette nur, wo es günstiger ist als sonst (6 von 10)');
await t.reload({ waitUntil: 'load' });
await t.waitForFunction(() => document.querySelector('.tab[data-tab="angebote"]'));
await t.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await t.locator('[data-a-sort="rabatt"][aria-pressed="true"]').count()) === 1 && (await t.locator('#a-auto .a-beste').count()) === 1), 'die Sortierung bleibt auf diesem Handy');
await t.click('[data-a-sort="laden"]');
const aldiReihe = await t.$$eval('#a-auto .a-grp[data-laden="Aldi"] .item-name', (xs) => xs.map((x) => x.textContent));
check(aldiReihe.join(' | ') === 'Zucchini | Rinderhackfleisch XXL | Hähnchenbrustfilet-Teilstücke', `nach Laden: je Laden die besten zuerst (${aldiReihe.join(' | ')})`);
await t.click('.tab[data-tab="rezepte"]');

// --- löschen und rückgängig
await t.click('[data-filter="reste"]');
await t.click('[data-open="' + rid + '"]');
await t.click('[data-act="ki-loeschen"]');
check(await bis(() => !gh.liste()?.ki?.[rid] && !Object.values(gh.liste().items).some((d) => d.parts?.[rid])), 'Löschen nimmt das Rezept und seine Zeilen auf der Liste weg');
await t.click('#toast button');
check(await bis(() => !!gh.liste()?.ki?.[rid] && Object.values(gh.liste().items).filter((d) => d.parts?.[rid]).length === 4), 'Rückgängig bringt beides zurück');

// --- Amy sieht Rewe auch; nach dem Trennen sind die privaten Angebote von ihrem Handy weg
await a.reload({ waitUntil: 'load' });
await a.waitForFunction(() => document.querySelector('.tab[data-tab="angebote"]'));
await a.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await a.locator('[data-a-laden="Rewe"]').count()) === 1), 'Amy sieht Rewe auch (mit ihrem Schlüssel)');
await a.click('.tab[data-tab="einkauf"]');
await a.click('[data-act="z-trennen"]');
await a.click('[data-act="z-trennen-ja"]');
await a.click('.tab[data-tab="angebote"]');
check(await bis(async () => (await a.locator('[data-a-laden="Rewe"]').count()) === 0) && await a.evaluate(() => localStorage.getItem('boxenstopp.angebote.privat.v1') === null) && (await a.locator('.a-quelle-aus', { hasText: 'sperren' }).innerText()).startsWith('Rewe, Edeka:'), 'nach dem Trennen sind Rewe & Co. weg – auch aus dem Speicher –, und Rewe steht wieder als gesperrt da');

check(await t.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'kein seitliches Scrollen');
for (const h of [tobi, amy]) check(h.fehler.length === 0, `keine Fehler in der Konsole${h.fehler.length ? `: ${h.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
