/*
 * Die Listenlogik ohne Browser: js/liste.js und js/format.js direkt in Node.
 *
 * Hier steckt, was beim Einkaufen zählt – dass Mengen aus zwei Rezepten
 * zusammenkommen, dass Abhaken nur die Teile trifft, die beim Tippen da
 * waren, und dass Änderungen auf einem neueren Stand noch Sinn ergeben.
 */
import { pruefer } from './hilfe.mjs';
import {
  leer, anwenden, bereinigen, erledigt, summen, rezeptStand, rezepteAufListe, offeneAnzahl, opNotiz, opNotizWeg, opTeil, opTeilWeg, opHaken, opLoeschen, opSetzen, opEigener, opErledigteWeg, opLeeren, opGekocht, opZusammen, opBewerten, opAnpinnen, MAX_GEPINNT, opKiWeg,
} from '../js/liste.js';
import { menge, ungefaehr, abteilung, esc, abweichung, tagKurz, heute } from '../js/format.js';
import { nachBereichen, alsText } from '../js/bereiche.js';

const { check, ende } = pruefer();
const KAT = { haehnchenbrust: { n: 'Hähnchenbrustfilet', c: 'fleisch' }, reis: { n: 'Basmati- oder Jasminreis', c: 'trocken' }, oel: { n: 'Öl, neutral', c: 'vorrat' } };

// --- Mengen aus zwei Rezepten
let s = leer();
s = anwenden(s, [
  opTeil('haehnchenbrust', 'butter-chicken', { q: 800, u: 'g', h: '2 × 400 g' }, KAT.haehnchenbrust),
  opTeil('reis', 'butter-chicken', { q: 280, u: 'g', h: '' }, KAT.reis),
]);
s = anwenden(s, [opTeil('reis', 'teriyaki', { q: 240, u: 'g', h: '' }, KAT.reis)]);
check(Object.keys(s.items).length === 2, 'zwei Rezepte, gemeinsamer Reis: zwei Zeilen');
check(summen(s.items.reis).g === 520, `Reis zusammengerechnet: 520 g (${summen(s.items.reis).g})`);
check(s.items.reis.name === 'Basmati- oder Jasminreis' && s.items.reis.cat === 'trocken', 'Name und Abteilung kommen aus dem Katalog');
check(JSON.stringify(rezepteAufListe(s)) === JSON.stringify(['butter-chicken', 'teriyaki']), 'beide Rezepte stehen als „Für“ auf der Liste');
check(offeneAnzahl(s) === 2, 'zwei offene Einträge');

// --- Abhaken trifft nur die Teile von eben
const haken = opHaken(s, 'reis', true, 'Amy');
const spaeter = anwenden(s, opTeil('reis', 'chili', { q: 150, u: 'g', h: '' }, KAT.reis));
const zusammen = anwenden(spaeter, haken);
check(!erledigt(zusammen.items.reis), 'Reis abgehakt, während das andere Handy Chili-Reis dazulegt: bleibt offen');
check(summen(zusammen.items.reis).g === 150, `offen sind dann nur noch die 150 g vom Chili (${summen(zusammen.items.reis).g})`);
const ohne = anwenden(s, haken);
check(erledigt(ohne.items.reis) && ohne.items.reis.by === 'Amy', 'ohne Neues: abgehakt, von Amy');
check(summen(ohne.items.reis).g === 520, 'erledigt zeigt die volle Menge');
check(!erledigt(anwenden(ohne, opHaken(ohne, 'reis', false, 'Tobi')).items.reis), 'wieder öffnen geht');

// --- Wegnehmen
let w = anwenden(s, opTeilWeg('reis', 'teriyaki'));
check(summen(w.items.reis).g === 280, 'Teriyaki weg: 280 g Reis bleiben');
w = anwenden(w, opTeilWeg('reis', 'butter-chicken'));
check(!w.items.reis, 'letztes Teil weg: Zeile weg');
check(rezeptStand(w, { id: 'teriyaki', items: [{ k: 'reis', q: 240, u: 'g' }] }).drauf === false, 'Teriyaki steht nicht mehr drauf');

// --- eigene Einträge, Löschen, Rückgängig
let e = anwenden(s, opEigener('c-1', 'Bananen', 'obst'));
check(e.items['c-1'].custom && !erledigt(e.items['c-1']), 'eigener Eintrag: offen');
e = anwenden(e, opHaken(e, 'c-1', true, 'Tobi'));
check(erledigt(e.items['c-1']), 'eigener Eintrag: abgehakt');
const vorher = e.items.haehnchenbrust;
e = anwenden(e, opLoeschen('haehnchenbrust'));
check(!e.items.haehnchenbrust, 'löschen');
e = anwenden(e, opSetzen('haehnchenbrust', vorher));
check(summen(e.items.haehnchenbrust).g === 800, 'rückgängig: wieder da, mit Menge');

// --- Erledigte entfernen
let r = anwenden(s, opHaken(s, 'haehnchenbrust', true, 'Tobi'));
r = anwenden(r, opEigener('c-2', 'Milch', 'kuehl'));
r = anwenden(r, opHaken(r, 'c-2', true, 'Tobi'));
r = anwenden(r, opTeil('oel', 'butter-chicken', { t: '10 g' }, KAT.oel));
r = anwenden(r, opErledigteWeg());
check(!r.items.haehnchenbrust && !r.items['c-2'], 'erledigte Einträge sind weg');
check(r.items.reis && r.items.oel, 'offene bleiben');
let teilweise = anwenden(s, opHaken(s, 'reis', true, 'Tobi'));
teilweise = anwenden(teilweise, opTeil('reis', 'chili', { q: 150, u: 'g', h: '' }, KAT.reis));
teilweise = anwenden(teilweise, opErledigteWeg());
check(Object.keys(teilweise.items.reis.parts).join() === 'chili', 'halb gekauft: nur die gekauften Teile gehen');
check(Object.keys(anwenden(s, opLeeren()).items).length === 0, 'leeren');

// --- Zusammenführen (lokale Liste in die gemeinsame)
const lokal = anwenden(leer(), [opEigener('c-9', 'Kaffee', 'vorrat'), opTeil('reis', 'gulasch', { q: 100, u: 'g', h: '' }, KAT.reis)]);
const gemeinsam = anwenden(s, opZusammen(lokal.items));
check(gemeinsam.items['c-9'] && summen(gemeinsam.items.reis).g === 620, 'Zusammenführen: Neues dazu, vorhandene Zeile bekommt das fehlende Teil');
check(summen(anwenden(gemeinsam, opZusammen(lokal.items)).items.reis).g === 620, 'zweimal zusammenführen ändert nichts');

// --- gekocht
const g = anwenden(s, opGekocht('chili', '2026-10-26', 'Tobi'));
check(g.cooked.chili.at === '2026-10-26' && g.cooked.chili.by === 'Tobi', 'gekocht: Tag und wer');
check(!anwenden(s, opGekocht('chili', 'gestern', 'Tobi')).cooked.chili, 'gekocht nur mit echtem Datum');

// --- Daumen: einer pro Gericht, gilt für beide
let bw = anwenden(leer(), opBewerten('chili', 'hoch', 'Tobi'));
check(bw.bewertung.chili.wert === 'hoch' && bw.bewertung.chili.by === 'Tobi', 'Daumen hoch fürs Chili, von Tobi');
bw = anwenden(bw, opBewerten('chili', 'mittel', 'Amy'));
check(bw.bewertung.chili.wert === 'mittel' && bw.bewertung.chili.by === 'Amy', 'Amy stellt auf „geht so“ – ein Daumen für beide, zuletzt von Amy');
bw = anwenden(bw, opBewerten('gyros', 'runter', 'Tobi'));
bw = anwenden(bw, opBewerten('chili', null, 'Amy'));
check(!bw.bewertung.chili && bw.bewertung.gyros.wert === 'runter', 'Daumen wieder weg, die anderen bleiben');
const bwRoh = bereinigen({ bewertung: { chili: { wert: 'super' }, gyros: { wert: 'runter', by: 'Tobi', at: '2026-10-26T18:00:00Z' }, 'x/../y': { wert: 'hoch' } } });
check(!bwRoh.bewertung.chili && bwRoh.bewertung.gyros.wert === 'runter' && Object.keys(bwRoh.bewertung).length === 1, 'bereinigen: nur hoch, mittel, runter und gültige Rezepte');
check(JSON.stringify(bereinigen({ rev: 4, items: {} }).bewertung) === '{}', 'ältere Listen ohne Daumen: leere Bewertung');

// --- Notizen
const mitNotiz = anwenden(leer(), [opNotiz('chili', 'n-1', '  Weniger   Chili ', 'Amy'), opNotiz('chili', 'n-2', 'Kakao!', 'Tobi')]);
check(mitNotiz.notizen.chili.length === 2 && mitNotiz.notizen.chili[0].text === 'Weniger   Chili' && mitNotiz.notizen.chili[0].by === 'Amy', 'Notizen hängen am Rezept, mit Namen');
check(anwenden(mitNotiz, opNotiz('chili', 'n-1', 'Weniger Chili, wirklich', 'Amy')).notizen.chili.find((n) => n.id === 'n-1').text === 'Weniger Chili, wirklich', 'dieselbe id ersetzt den Text');
check(!anwenden(mitNotiz, [opNotizWeg('chili', 'n-1'), opNotizWeg('chili', 'n-2')]).notizen.chili, 'ohne Notizen verschwindet das Rezept aus notizen');
const viele = anwenden(leer(), Array.from({ length: 25 }, (_, i) => opNotiz('chili', `n-${i}`, `Notiz ${i}`, null, `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00.000Z`)));
check(viele.notizen.chili.length === 20 && viele.notizen.chili.at(-1).text === 'Notiz 24', 'höchstens 20 Notizen, die ältesten fallen raus');
const nRoh = bereinigen({ notizen: { chili: [{ id: 'n-1', text: ' ok ', by: 'Amy' }, { id: 'kaputt id', text: 'x' }, { id: 'n-3', text: '' }, 'quatsch'], 'x/../y': [{ id: 'n', text: 'x' }] } });
check(nRoh.notizen.chili.length === 1 && nRoh.notizen.chili[0].text === 'ok' && Object.keys(nRoh.notizen).length === 1, 'bereinigen: nur gültige Notizen und Rezepte');

// --- Angepinnt („läuft gerade“), für beide
const pin = anwenden(leer(), [opAnpinnen('chili', true, 'Tobi'), opAnpinnen('gyros', true, 'Amy')]);
check(pin.gepinnt.chili.by === 'Tobi' && pin.gepinnt.gyros.by === 'Amy' && !!pin.gepinnt.chili.at, 'Anpinnen: mit Namen und Zeit');
check(!anwenden(pin, opAnpinnen('chili', false, 'Amy')).gepinnt.chili && !!anwenden(pin, opAnpinnen('chili', false, 'Amy')).gepinnt.gyros, 'Lösen nimmt nur dieses Rezept weg');
const vielePins = anwenden(leer(), ['a', 'b', 'c', 'd', 'e'].map((rid, i) => ({ ...opAnpinnen(rid, true, 'Tobi'), at: `2026-10-2${i}T10:00:00.000Z` })));
check(Object.keys(vielePins.gepinnt).length === MAX_GEPINNT && !vielePins.gepinnt.a && !!vielePins.gepinnt.e, `höchstens ${MAX_GEPINNT} angepinnt, das älteste fällt raus`);
check(!anwenden(anwenden(leer(), opAnpinnen('ki-abc123', true, 'Tobi')), opKiWeg('ki-abc123')).gepinnt['ki-abc123'], 'ein gelöschtes KI-Rezept ist auch nicht mehr angepinnt');
const pRoh = bereinigen({ gepinnt: { chili: { by: 'Tobi', at: '2026-10-28T10:00:00.000Z' }, 'x/../y': { by: 'x' }, gyros: 'quatsch' } });
check(Object.keys(pRoh.gepinnt).join() === 'chili' && pRoh.gepinnt.chili.by === 'Tobi' && JSON.stringify(bereinigen({ rev: 1, items: {} }).gepinnt) === '{}', 'bereinigen: nur gültige Rezepte; ältere Listen ohne gepinnt');

// --- bereinigen: was aus GitHub kommt, kann alles sein
const roh = { rev: 3, items: { 'ok-1': { name: '<b>Milch</b>', cat: 'kuehl', parts: { x: { q: 'viel' }, y: { t: '1 l', done: true } } }, 'kaputt/../x': { name: 'weg' }, 'leer-2': 5 }, cooked: { chili: { at: 'morgen' } } };
const b = bereinigen(roh);
check(b.rev === 3 && Object.keys(b.items).join() === 'ok-1', 'bereinigen: nur gültige Schlüssel');
check(Object.keys(b.items['ok-1'].parts).join() === 'y', 'bereinigen: Teile ohne Menge oder Text fallen weg');
check(!b.cooked.chili, 'bereinigen: kaputtes Datum fällt weg');
check(esc(b.items['ok-1'].name) === '&lt;b&gt;Milch&lt;/b&gt;', 'Namen werden beim Anzeigen entschärft');
check(JSON.stringify(bereinigen(null)) === JSON.stringify(leer()), 'bereinigen(null) ist eine leere Liste');
const nachher = anwenden(s, opTeil('reis', 'x', { q: 1, u: 'g' }, KAT.reis));
check(s.items.reis.parts.x === undefined && nachher.items.reis.parts.x, 'anwenden lässt den alten Stand unverändert');

// --- Anzeige
check(menge(1275, 'g') === '1,275 kg' && menge(520, 'g') === '520 g', `Gramm und Kilo (${menge(1275, 'g')})`);
check(menge(2, 'Dose') === '2 Dosen' && menge(1, 'Glas') === '1 Glas' && menge(10, 'Zehe') === '10 Zehen', 'Stückeinheiten');
check(menge(1500, 'ml') === '1,5 l', 'Milliliter und Liter');
check(ungefaehr('knoblauch', { Zehe: 14 }) === '≈ 2 Knollen' && ungefaehr('zwiebeln', { g: 1300 }) === '≈ 13 Stück', 'ungefähre Stückzahl');
check(ungefaehr('reis', { g: 500 }) === '', 'Reis bekommt keine Stückzahl');
const abt = { Bananen: 'obst', Zahnpasta: 'haushalt', Schaschlikspieße: 'haushalt', Backpapier: 'haushalt', Reis: 'trocken', Gnocchi: 'trocken', Eis: 'tk', Eistee: 'vorrat', Olivenöl: 'vorrat', Pfeffer: 'gewuerz', Gemüsebrühe: 'gewuerz', Paprika: 'obst', Kokosmilch: 'konserven', Eier: 'kuehl', Hähnchenschenkel: 'fleisch', Erdnussbutter: 'konserven', Toast: 'trocken', Xylophon: 'sonstiges' };
const falsch = Object.entries(abt).filter(([t, a]) => abteilung(t, {}) !== a).map(([t]) => `${t}→${abteilung(t, {})}`);
check(!falsch.length, `Abteilungen raten${falsch.length ? `: falsch ${falsch.join(', ')}` : ''}`);
check(abteilung('Hähnchenbrustfilet', KAT) === 'fleisch', 'genauer Katalogname geht vor');
check(abweichung(434, 443, true) === '−9' && abweichung(33.8, 33) === '+0,8' && abweichung(15.4, 15.4) === 'genau', 'Abweichung vom Ziel');
check(tagKurz('2026-10-06') === '6.10.' && tagKurz('quatsch') === '', 'kurzes Datum');
check(/^\d{4}-\d{2}-\d{2}$/.test(heute()), 'heute als JJJJ-MM-TT');

// --- Bereiche: Reihenfolge wie beim Einkaufen, Text zum Kopieren
const KAT2 = {
  zwiebeln: { n: 'Zwiebeln', c: 'obst' }, rinderhack: { n: 'Rinderhackfleisch', c: 'fleisch' }, skyr: { n: 'Skyr natur', c: 'kuehl' },
  'tk-kraeuter': { n: 'TK-Kräuter', c: 'tk' }, penne: { n: 'Penne', c: 'trocken' }, 'tomaten-dose': { n: 'Stückige Tomaten', c: 'konserven' },
  salz: { n: 'Salz', c: 'gewuerz' }, backpapier: { n: 'Backpapier', c: 'haushalt' }, limette: { n: 'Limetten', c: 'obst' },
  // früher stand Brühe bei „vorrat“ – der Katalog von heute gewinnt
  'bruehe-rind': { n: 'Rinderbrühe', c: 'gewuerz' },
};
let k2 = leer();
const t = (k, teil) => opTeil(k, 'chili', teil, KAT2[k]);
k2 = anwenden(k2, [
  t('salz', { t: '1 TL' }), t('penne', { q: 500, u: 'g' }), t('skyr', { q: 300, u: 'g' }), t('backpapier', { t: '1 Blatt' }),
  t('tk-kraeuter', { q: 1, u: 'Pck' }), t('rinderhack', { q: 500, u: 'g' }), t('zwiebeln', { q: 300, u: 'g' }),
  t('tomaten-dose', { q: 2, u: 'Dose' }), t('limette', { q: 1, u: 'Stk' }),
  opEigener('c-x', 'Xylophon', 'sonstiges'),
]);
k2 = anwenden(k2, { typ: 'setzen', k: 'bruehe-rind', item: { name: 'Rinderbrühe', cat: 'vorrat', parts: { gulasch: { t: '750 ml', done: false } }, custom: false, checked: false } });
const gr = nachBereichen(k2, KAT2);
check(gr.map((g) => g.bereich.name).join(' > ') === 'Frisches > Tierisches > Trockenes > Gewürze > Extras > Sonstiges', `Bereiche in Einkaufsreihenfolge (${gr.map((g) => g.bereich.name).join(' > ')})`);
check(gr[1].eintraege.map(([k]) => k).join() === 'rinderhack,skyr', 'Tierisches: erst Fleisch, dann Milchprodukte');
check(gr[2].eintraege.map(([k]) => k).join() === 'penne,tomaten-dose,tk-kraeuter', 'Trockenes: Nudeln, Konserven, dann TK');
check(gr[3].eintraege.map(([k]) => k).join() === 'bruehe-rind,salz', 'Brühe steht bei den Gewürzen, auch wenn sie früher anders gespeichert wurde');
const text = alsText(k2, KAT2);
const erwartet = 'Frisches:\n1 Stk. Limetten\n300 g Zwiebeln (≈ 3 Stück)\n\nTierisches:\n500 g Rinderhackfleisch\n300 g Skyr natur\n\nTrockenes:\n500 g Penne\n2 Dosen Stückige Tomaten\n1 Packung TK-Kräuter\n\nGewürze:\nRinderbrühe\nSalz\n\nExtras:\nBackpapier\n\nSonstiges:\nXylophon';
check(text === erwartet, `Text zum Kopieren${text === erwartet ? '' : `:\n${text}`}`);
const fast = anwenden(k2, opHaken(k2, 'penne', true, 'Tobi'));
check(!alsText(fast, KAT2).includes('Penne'), 'abgehakte Einträge kommen nicht mit in den Text');
check(alsText(leer(), KAT2) === '', 'leere Liste: leerer Text');

ende();
