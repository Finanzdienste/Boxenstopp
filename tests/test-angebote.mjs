/*
 * Angebote der Woche ohne Browser: getippte Zeilen lesen, Einheiten und
 * Katalog-Schlüssel raten, bereinigen, Treffer in den Rezepten und die
 * Ersparnis gegen die Richtpreise, der Text für die KI, die Anfragen.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT } from './hilfe.mjs';
import { zeileLesen, einheitNorm, schluesselRaten, ladenName, angebotBereinigen, angeboteBereinigen, angebotJeG, rezeptTreffer, topRezepte, aktuelle, angebotMenge, angeboteText, rumpfAngebote, systemTextAngebote, ANGEBOTE_SCHEMA, MAX_ANGEBOTE } from '../js/angebote.js';
import { leer, anwenden, bereinigen, opAngebote, opAngeboteDazu, opAngebotWeg } from '../js/liste.js';
import { systemText, nutzerText } from '../js/ki.js';
import { aldiLesen, kauflandLesen, pennyLesen, lidlProspekte, kalenderwoche } from '../werkzeug/angebote.mjs';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const { katalog } = daten;

// --- Zeilen lesen
const z1 = zeileLesen('Aldi Hähnchenbrustfilet 1 kg 7,49', katalog);
check(z1 && z1.laden === 'Aldi' && z1.name === 'Hähnchenbrustfilet' && z1.preis === 7.49 && z1.menge === 1 && z1.einheit === 'kg' && z1.k === 'haehnchenbrust', `„Aldi Hähnchenbrustfilet 1 kg 7,49“ → ${JSON.stringify(z1)}`);
const z2 = zeileLesen('Lidl: Paprika rot 500g 1.29 €', katalog);
check(z2 && z2.laden === 'Lidl' && z2.name === 'Paprika rot' && z2.preis === 1.29 && z2.menge === 500 && z2.einheit === 'g' && z2.k === 'paprika', 'Doppelpunkt, 500g ohne Leerzeichen, Punkt statt Komma, Euro-Zeichen');
const z3 = zeileLesen('REWE Center Skyr 500 g 0,99 EUR', katalog);
check(z3 && z3.laden === 'Rewe' && z3.k === 'skyr' && z3.preis === 0.99, 'REWE Center → Rewe, EUR hinten');
const z4 = zeileLesen('Kokosmilch 3 Dosen 2,49', katalog);
check(z4 && z4.laden === 'Sonstige' && z4.menge === 3 && z4.einheit === 'Dose' && z4.k === 'kokosmilch', 'ohne Laden: Sonstige; „3 Dosen“ → 3 Dose');
check(zeileLesen('Aldi Hähnchen', katalog) === null && zeileLesen('', katalog) === null && zeileLesen('7,49', katalog) === null, 'ohne Preis oder ohne Produkt: nichts');
const z5 = zeileLesen('Kaufland Rinderhackfleisch 5 % Fett 400 g 4,49', katalog);
check(z5 && z5.k === 'rinderhack-mager' && z5.name === 'Rinderhackfleisch 5 % Fett', 'Hack mit 5 % → mageres Hack');
check(zeileLesen('Penny Gummibärchen 200 g 0,99', katalog).k === '', 'Süßkram: kein Katalog-Schlüssel');
check(einheitNorm('Stück') === 'Stk' && einheitNorm('Packung') === 'Pck' && einheitNorm('Liter') === 'l' && einheitNorm('kg') === 'kg' && einheitNorm('Quatsch') === '', 'Einheiten normiert');
check(schluesselRaten('Basmati Reis', katalog) === 'reis' && schluesselRaten('Tomatenmark', katalog) === 'tomatenmark' && schluesselRaten('Stückige Tomaten', katalog) === 'tomaten-dose' && schluesselRaten('Rote Zwiebeln', katalog) === 'rote-zwiebeln' && schluesselRaten('Zwiebeln', katalog) === 'zwiebeln', 'Schlüssel raten: Reis, Tomatenmark vor Tomaten, rote Zwiebeln vor Zwiebeln');
check(ladenName('ALDI Nord') === 'Aldi' && ladenName('Edeka Meyer') === 'Edeka' && ladenName('Bio Company') === 'Bio Company', 'Ladennamen: bekannte Ketten vereinheitlicht');

// --- bereinigen
const roh = JSON.parse(readFileSync(path.join(ROOT, 'tests', 'daten', 'ki-angebote.json'), 'utf8')).angebote;
const sauber = angeboteBereinigen(roh, katalog);
check(sauber.length === 4 && sauber.filter((a) => a.name === 'Brokkoli').length === 1 && !sauber.find((a) => a.name === 'Ohne Preis'), `KI-Antwort bereinigt: doppelter Brokkoli einmal, ohne Preis raus (${sauber.length})`);
check(sauber.every((a) => /^a-[a-z0-9]{4,16}$/.test(a.id)) && sauber[0].k === 'haehnchenkeule' && sauber[3].k === '', 'jedes bekommt eine id, Katalog-Schlüssel geprüft');
check(angebotBereinigen({ name: 'X', preis: 1, k: 'gibtsnicht' }, katalog).k === '' && angebotBereinigen({ name: 'X', preis: 1, k: 'gibtsnicht' }).k === 'gibtsnicht', 'mit Katalog wird der Schlüssel geprüft, ohne (liste.js) nur die Form');
check(angeboteBereinigen(Array.from({ length: 200 }, (_, i) => ({ name: `A${i}`, preis: 1 + i }))).length === MAX_ANGEBOTE, `höchstens ${MAX_ANGEBOTE}`);
check(aktuelle([{ bis: '2000-01-01', name: 'alt' }, { bis: '', name: 'ohne' }, { bis: '2099-01-01', name: 'neu' }]).map((a) => a.name).join() === 'ohne,neu', 'abgelaufene fallen weg, ohne Datum bleibt');

// --- Preise und Treffer
const preisDaten = { preise: daten.preise, naehrwerte: daten.naehrwerte };
check(Math.abs(angebotJeG(z1, daten.naehrwerte) - 0.00749) < 1e-6 && Math.abs(angebotJeG(z4, daten.naehrwerte) - 2.49 / 1200) < 1e-6 && angebotJeG({ preis: 1, menge: null, einheit: '' }, daten.naehrwerte) === null, 'Euro je Gramm: kg, Dosen über die Nährwert-Einheit, ohne Menge null');
const thai = daten.rezepte.find((r) => r.id === 'thai-curry');
const tr = rezeptTreffer(thai, [z1, z2], preisDaten);
const huhn = thai.items.find((it) => it.k === 'haehnchenbrust');
const erwartet = ((daten.preise.haehnchenbrust.je_g - 0.00749) * huhn.g + (daten.preise.paprika.je_g - 1.29 / 500) * thai.items.find((it) => it.k === 'paprika').g) / 8;
check(tr.treffer.length === 2 && Math.abs(tr.ersparnisBox - erwartet) < 0.001 && tr.ersparnisBox > 0.3, `Thai-Curry: Hähnchen und Paprika im Angebot, spart ≈ ${tr.ersparnisBox.toFixed(2)} €/Box`);
check(rezeptTreffer(thai, [{ ...z2, preis: 9 }], preisDaten).ersparnisBox === 0, 'teurer als der Richtpreis: Treffer, aber keine Ersparnis');
const top = topRezepte(daten.rezepte, [z1, z2, z5], preisDaten);
check(top.length === 12 && top[0].treffer.length >= 2 && top.every((x, i) => !i || x.treffer.length <= top[i - 1].treffer.length), 'Top-Rezepte: nach Treffern sortiert, höchstens 12');
check(topRezepte(daten.rezepte, [], preisDaten).length === 0, 'ohne Angebote keine Treffer');
check(angebotMenge(z1) === '1 kg 7,49 €' && angebotMenge({ preis: 0.99, menge: null }) === '0,99 €', 'Mengentext');
check(angeboteText([z1, z2, z5]) === 'Aldi: Hähnchenbrustfilet 1 kg 7,49 €\nLidl: Paprika rot 500 g 1,29 €\nKaufland: Rinderhackfleisch 5 % Fett 400 g 4,49 €', 'Text für die KI: eine Zeile je Laden');

// --- Stand (liste.json)
let st = anwenden(leer(), opAngeboteDazu([z1, z2], 'Tobi', '2026-10-27T20:00:00.000Z'));
check(st.angebote.eintraege.length === 2 && st.angebote.von === 'Tobi' && st.angebote.stand === '2026-10-27T20:00:00.000Z', 'dazulegen: zwei Angebote, von Tobi');
st = anwenden(st, opAngeboteDazu([z2, z5], 'Amy'));
check(st.angebote.eintraege.length === 3 && st.angebote.von === 'Amy', 'nochmal dazulegen: doppelte Paprika nur einmal');
st = anwenden(st, opAngebotWeg(z1.id));
check(st.angebote.eintraege.length === 2 && !st.angebote.eintraege.find((a) => a.id === z1.id), 'eins weg');
st = anwenden(st, opAngebote([], 'Amy'));
check(st.angebote.eintraege.length === 0, 'alle weg');
const kaputt = bereinigen({ angebote: { stand: 5, von: 'x', eintraege: [{ name: 'Gut', preis: '2,50', laden: 'lidl' }, 'müll', { name: '', preis: 3 }] } });
check(kaputt.angebote.eintraege.length === 1 && kaputt.angebote.eintraege[0].preis === 2.5 && kaputt.angebote.eintraege[0].laden === 'Lidl' && kaputt.angebote.stand === '', 'bereinigen: Preis als Text geht, Müll fällt weg');
check(JSON.stringify(bereinigen({}).angebote) === JSON.stringify({ stand: '', von: null, eintraege: [] }), 'alter Stand ohne Angebote: leer');

// --- Anfragen
const rg = rumpfAngebote('gemini', { fotos: ['abc'], text: 'Aldi', katalog, modell: { gemini: 'g', anthropic: 'a' } });
check(rg.model === 'g' && rg.response_format.schema === ANGEBOTE_SCHEMA && rg.input.length === 2 && rg.input[0].type === 'image' && /Prospekt/.test(rg.system_instruction) && /haehnchenbrust=/.test(rg.system_instruction), 'Gemini-Anfrage: Bild, Text, Schema, Katalog im Auftrag');
const ra = rumpfAngebote('anthropic', { fotos: [], text: 'Aldi Hähnchen 1 kg 7,49', katalog, modell: { gemini: 'g', anthropic: 'a' } });
check(ra.model === 'a' && ra.tools[0].name === 'angebote_ausgeben' && ra.tool_choice.name === 'angebote_ausgeben' && ra.messages[0].content.length === 1, 'Claude-Anfrage: Werkzeug angebote_ausgeben');
check(/kein Schwein, kein Fisch/.test(systemTextAngebote({ katalog })) && !/salz=/.test(systemTextAngebote({ katalog })), 'Auftrag: kein Schwein, kein Fisch; Gewürze nicht im Katalog');
const sys = systemText({ portionen: 8, ziel: daten.ziel, dazukaufen: true, katalog, anbieter: 'gemini', modus: 'angebote' });
check(/Angeboten der Woche/.test(sys) && /quelle: kaufen/.test(sys) && !/Kühlschrank und im Vorrat ist, machst/.test(sys), 'Rezept aus Angeboten: eigener Auftrag, alles zu kaufen');
check(nutzerText({ text: 'Aldi: X', portionen: 8, dazukaufen: true, modus: 'angebote' }).startsWith('Das ist diese Woche im Angebot:'), 'und der Nutzertext sagt, dass es Angebote sind');

// --- das Werkzeug, das die Angebote holt (werkzeug/angebote.mjs) – an kleinen Ausschnitten der echten Seiten
const fix = (f) => readFileSync(path.join(ROOT, 'tests', 'daten', 'angebote', f), 'utf8');
const bezug = new Date('2026-10-28T06:00:00Z');
const aldiA = aldiLesen(fix('aldi.html'), bezug);
const aldiNamen = aldiA.map((a) => a.name);
check(aldiNamen.includes('Hähnchenbrustfilet-Teilstücke') && aldiNamen.includes('Zucchini') && aldiNamen.includes('Rinderhackfleisch XXL') && !aldiNamen.includes('Retropants'), `Aldi: Lebensmittel aus dem eingebetteten JSON, Non-Food nicht (${aldiNamen.join(', ')})`);
const aldiHuhn = aldiA.find((a) => a.name === 'Hähnchenbrustfilet-Teilstücke');
check(aldiHuhn && aldiHuhn.laden === 'Aldi' && aldiHuhn.preis === 5.19 && aldiHuhn.menge === 600 && aldiHuhn.einheit === 'g' && aldiHuhn.k === 'haehnchenbrust' && /^\d{4}-\d{2}-\d{2}$/.test(aldiHuhn.bis) && /^a-[a-z0-9]{4,16}$/.test(aldiHuhn.id), `Aldi: Preis, Packung, Schlüssel, Gültigkeit, feste id (${JSON.stringify(aldiHuhn)})`);
const aldiZuc = aldiA.find((a) => a.name === 'Zucchini');
check(aldiZuc && aldiZuc.menge === 1 && aldiZuc.einheit === 'kg', '„kg-Preis“ → 1 kg');
const mentos = aldiA.find((a) => /Mentos/.test(a.name));
check(!mentos, 'Süßes fliegt raus');
check(aldiA.find((a) => a.name === 'Speisekartoffeln')?.menge === 5, 'Aldi: „5-kg-Netz“ → 5 kg');

const kl = kauflandLesen(fix('kaufland.html'), bezug);
check(kl.length >= 3 && kl.every((a) => a.laden === 'Kaufland' && a.preis > 0) && kl.some((a) => a.k === 'aepfel'), `Kaufland: ${kl.length} Kacheln aus Fleisch und Obst/Gemüse (${kl.map((a) => a.name).join(' · ')})`);
check(!kl.some((a) => /fisch|lachs|bier|pils/i.test(a.name)), 'Kaufland: Fisch- und Getränkegruppen bleiben draußen');
check(kl.some((a) => a.bis === '2026-10-31') || kl.some((a) => a.bis === '2026-10-28'), `Kaufland: Gültigkeit aus der Gruppenzeile (${[...new Set(kl.map((a) => a.bis))].join(', ')})`);
check(kl.some((a) => a.menge && a.einheit), 'Kaufland: Packung aus „je 250-g-Packg.“');

const pe = pennyLesen([['fleisch-und-wurst', JSON.parse(fix('penny-fleisch-und-wurst.json'))], ['obst-und-gemuese', JSON.parse(fix('penny-obst-und-gemuese.json'))]], bezug);
const peNamen = pe.map((a) => a.name);
check(peNamen.includes('Zitronen') && !peNamen.some((n) => /Schweine|Kaffee|Coca|Pringles/i.test(n)), `Penny: Zitronen ja, Schwein, Kaffee, Cola, Chips nein (${peNamen.join(' · ')})`);
check(pe.find((a) => a.name === 'Zitronen')?.k === 'zitrone' && pe.every((a) => a.bis === '2026-10-31'), 'Penny: Schlüssel, Gültigkeit bis Samstag der Woche');
check(kalenderwoche(bezug) === '2026-44' && kalenderwoche(new Date('2027-01-01T12:00:00Z')) === '2026-53' && kalenderwoche(new Date('2026-01-01T12:00:00Z')) === '2026-01', 'Kalenderwoche nach ISO');

const lp = lidlProspekte(fix('lidl-prospekte.html'));
check(lp.length === 2 && lp[0].von === '2026-10-26' && lp[0].bis === '2026-10-31' && lp[1].von === '2026-11-02' && lp[0].id.startsWith('aktionsprospekt-26-10-2026'), `Lidl: Prospekte mit Datum aus der Übersicht, doppelte einmal (${lp.map((p) => p.id).join(', ')})`);

ende();
