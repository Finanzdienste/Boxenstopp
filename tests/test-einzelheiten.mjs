/*
 * Die Einzelheiten im Überblick ohne Browser: js/einzelheiten.js direkt in
 * Node. Aus zwei Ständen von liste.json – vor und nach einem Commit – kommt
 * heraus, was genau passiert ist: welche Sachen auf die Liste kamen und mit
 * welcher Menge, was abgehakt wurde, welcher Schritt beim Kochen, welche
 * Aufgabe im Putzplan, welches Ziel, welche Sachen – auch aus Amys sachen.json
 * (seit v83 eine eigene Datei, js/sachen.js). Gebaut wird jeder Stand mit denselben
 * Änderungen, die die App macht (liste.js), und dann bereinigt – so, wie der
 * Überblick ihn aus GitHub holt.
 */
import { pruefer } from './hilfe.mjs';
import {
  leer, anwenden, bereinigen, opTeil, opHaken, opLoeschen, opEigener, opErledigteWeg, opLeeren, opGekocht, opBewerten, opAnpinnen, opNotiz,
  opAmy, opAmyWeg, opAmyTags, opKochen, opPlan, opPutzHaken, opSache, opProfil, opPerson, opZusammen, opEinePerson, opAbteilung, opFehlt, opBon, opPreisalarm,
} from '../js/liste.js';
import { einzelheiten, zusammenlegen } from '../js/einzelheiten.js';
import { opInvListe, opInvListeWeg, opDing, opDingWeg, opUmgezogen, hatInventar } from '../js/inventar.js';
import { leerSachen, sachenAnwenden, sachenBereinigen, umzugZusammen } from '../js/sachen.js';

const { check, ende } = pruefer();
const KAT = { rinderhack: { n: 'Rinderhackfleisch', c: 'fleisch' }, zwiebeln: { n: 'Zwiebeln', c: 'obst' }, reis: { n: 'Basmatireis', c: 'trocken' }, sahne: { n: 'Schlagsahne', c: 'kuehl' } };
const CHILI = {
  id: 'chili',
  short: 'Chili',
  items: [{ k: 'zwiebeln', q: 200, u: 'g' }, { k: 'rinderhack', q: 500, u: 'g' }],
  ablauf: [
    { t: 'Vorbereiten', schritte: [{ d: '{zwiebeln} Zwiebeln schälen und fein würfeln → Schale 1' }, { d: 'In Schale 2 abmessen:', liste: ['2 EL Kreuzkümmel', '1 TL Salz'] }] },
    { t: 'Kochen', schritte: [{ d: '{rinderhack} Rinderhack krümelig braten' }, { d: '20 Min. köcheln lassen' }] },
  ],
};
const hilfe = { rezeptName: (rid) => (rid === 'chili' ? 'Chili' : ''), rezept: (rid) => (rid === 'chili' ? CHILI : null), zutatName: (k) => KAT[k]?.n || '' };
const nach = (s, ops) => bereinigen(JSON.parse(JSON.stringify(anwenden(s, ops))));
const zeile = (e, a) => e.find((x) => x.a === a);
const text = (e) => e.map((x) => `${x.b}|${x.a}${x.x.length ? `: ${x.x.join(', ')}` : ''}`).join('\n');

/* ---------------------------------------------------------- Einkauf */

const s0 = bereinigen(leer());
const s1 = nach(s0, [opTeil('rinderhack', 'chili', { q: 500, u: 'g', h: '1 × 500 g' }, KAT.rinderhack), opTeil('zwiebeln', 'chili', { q: 200, u: 'g', h: '' }, KAT.zwiebeln), opEigener('c-bananen', 'Bananen', 'obst')]);
let e = einzelheiten(s0, s1, hilfe);
check(JSON.stringify(zeile(e, 'Für Chili auf die Liste')?.x) === JSON.stringify(['500 g Rinderhackfleisch', '200 g Zwiebeln']), `Für Chili auf die Liste – mit Mengen wie auf dem Einkaufszettel (${text(e)})`);
check(JSON.stringify(zeile(e, 'Auf die Liste')?.x) === JSON.stringify(['Bananen']) && e.every((x) => x.b === 'Einkauf'), 'Ein eigener Eintrag: „Auf die Liste: Bananen“');

const s2 = nach(s1, [opHaken(s1, 'rinderhack', true, 'Amy'), opHaken(s1, 'c-bananen', true, 'Amy')]);
e = einzelheiten(s1, s2, hilfe);
check(JSON.stringify(zeile(e, 'Abgehakt')?.x) === JSON.stringify(['Rinderhackfleisch', 'Bananen']) && e.length === 1, `Abgehakt: welche Sachen genau (${text(e)})`);

const s3 = nach(s2, [opHaken(s2, 'zwiebeln', true, 'Amy')]);
e = einzelheiten(s2, s3, hilfe);
check(zeile(e, 'Abgehakt')?.x.join() === 'Zwiebeln' && !!zeile(e, 'Alles eingekauft'), `Das Letzte abgehakt: „Alles eingekauft“ (${text(e)})`);

const s4 = nach(s3, [opHaken(s3, 'c-bananen', false, 'Amy'), opTeil('rinderhack', 'chili', { q: 750, u: 'g', h: '' }, KAT.rinderhack)]);
e = einzelheiten(s3, s4, hilfe);
check(zeile(e, 'Wieder offen')?.x.join() === 'Bananen', `Wieder offen (${text(e)})`);
check(zeile(e, 'Menge geändert')?.x.join() === 'Rinderhackfleisch: 500 g → 750 g', 'Menge geändert: 500 g → 750 g');

const s5 = nach(s4, [opTeil('sahne', 'x-amy', { q: 200, u: 'g', h: '' }, KAT.sahne), opTeil('zwiebeln', 'x-amy', { q: 100, u: 'g', h: '' }, KAT.zwiebeln)]);
e = einzelheiten(s4, s5, hilfe);
check(zeile(e, 'Auf die Liste')?.x.join() === '200 g Schlagsahne' && zeile(e, 'Mehr davon')?.x.join() === '100 g Zwiebeln', `„Mehr davon“: neue Zeile und mehr bei einer, die schon da ist (${text(e)})`);

const s6 = nach(s5, [opLoeschen('c-bananen')]);
e = einzelheiten(s5, s6, hilfe);
check(zeile(e, 'Von der Liste')?.x.join() === 'Bananen', 'Von der Liste: Bananen');
const s6b = nach(s6, [opHaken(s6, 'rinderhack', true, 'Tobi')]);
const s7 = nach(s6b, [opErledigteWeg()]);
e = einzelheiten(s6b, s7, hilfe);
check(zeile(e, 'Erledigtes weggeräumt')?.x.join(', ') === 'Zwiebeln, Rinderhackfleisch' && e.length === 1, `Erledigtes weggeräumt – ganze Zeilen und das Erledigte aus einer, die noch offen ist (${text(e)})`);
e = einzelheiten(s6, nach(s6, [opLeeren()]), hilfe);
check(zeile(e, 'Liste geleert')?.x.length === 3, `Liste geleert – mit allen Namen (${text(e)})`);

// Abteilung, Laden, Bon, Preisalarm
const s8 = nach(s5, [opAbteilung({ 'n:bananen': 'haushalt' }), opFehlt('rinderhack', 'Aldi', 'Amy'), opBon('rinderhack', { eur: 5.49, q: 500, u: 'g', laden: 'Aldi' }, 'Amy'), opPreisalarm('rinderhack', { max: 9.5, u: 'kg', name: 'Rinderhack' }, 'Tobi')]);
e = einzelheiten(s5, s8, hilfe);
check(zeile(e, 'In eine andere Abteilung')?.x.join() === 'Bananen → Haushalt', `Verschoben: mit dem Namen der Zeile (${text(e)})`);
check(zeile(e, 'Gab es nicht')?.x.join() === 'Rinderhackfleisch (Aldi)' && zeile(e, 'Bon')?.x.join() === 'Rinderhackfleisch: 5,49 € für 500 g bei Aldi' && zeile(e, 'Preisalarm')?.x.join() === 'Rinderhack: bis 9,50 €/kg', 'Nicht bekommen, Bon und Preisalarm im Detail');

/* ----------------------------------------------------------- Kochen */

const k0 = nach(s0, [opKochen('Amy', { schritte: {}, tempo: {}, timer: [] }, '2026-11-06T09:00:00.000Z')]);
const k1 = nach(k0, [opKochen('Amy', { schritte: { chili: [0, 1] }, tempo: {}, timer: [{ id: 't-1', rid: 'chili', schritt: 3, label: 'Chili: köcheln', minuten: 20, ende: 1793304000000 }] }, '2026-11-06T09:10:00.000Z')]);
e = einzelheiten(k0, k1, hilfe);
const kocht = zeile(e, 'Kocht Chili (4 Schritte)');
check(kocht && kocht.x[0] === '1. 200 g Zwiebeln schälen und fein würfeln' && kocht.x[1] === '2. In Schale 2 abmessen: 2 EL Kreuzkümmel, 1 TL Salz', `Kochen: die Schritte, wie sie im Rezept stehen – Mengen eingesetzt, ohne „→ Schale“ (${text(e)})`);
check(zeile(e, 'Timer gestellt')?.x.join() === 'Chili: köcheln (20 Min.)', 'Timer gestellt: mit Minuten');
const k2 = nach(k1, [opKochen('Amy', { schritte: { chili: [0] }, tempo: {}, timer: [] }, '2026-11-06T09:20:00.000Z'), opGekocht('chili', '2026-11-06', 'Amy')]);
e = einzelheiten(k1, k2, hilfe);
check(zeile(e, 'Chili: wieder offen')?.x.join() === '2. In Schale 2 abmessen: 2 EL Kreuzkümmel, 1 TL Salz' && zeile(e, 'Gekocht')?.x.join() === 'Chili', `Haken wieder weg, gekocht (${text(e)})`);
e = einzelheiten(k2, nach(k2, [opKochen('Amy', { schritte: {}, tempo: {}, timer: [] }, '2026-11-06T09:30:00.000Z')]), hilfe);
check(zeile(e, 'Haken zurückgesetzt')?.x.join() === 'Chili', 'Alle Haken weg: „Haken zurückgesetzt“');

// Amys eigenes Rezept: die Schritte stehen im Stand selbst
const KUCHEN = { id: 'amy-bueno-kuchen-nvgn', name: 'Bueno Kuchen', bild: 'shortcake', portionen: 4, zeit: 0, zutaten: ['2 Eier', '165g Mehl'], schritte: ['Teig:', 'Ofen vorheizen', 'Eier aufschlagen → Schale 1'], notiz: '' };
const a1 = nach(s0, [opAmy(KUCHEN, 'Amy'), opAmyTags(KUCHEN.id, ['Backen', 'süß'])]);
e = einzelheiten(s0, a1, hilfe);
check(zeile(e, 'Neues Rezept')?.x.join() === '„Bueno Kuchen“ – 2 Zutaten, 2 Schritte' && zeile(e, 'Tags für Bueno Kuchen')?.x.join(', ') === 'Backen, süß', `Neues Rezept mit Zutaten, Schritten (ohne Überschrift) und Tags (${text(e)})`);
const a2 = nach(a1, [opKochen('Amy', { schritte: { [KUCHEN.id]: [1] }, tempo: {}, timer: [] }, '2026-11-06T10:00:00.000Z')]);
e = einzelheiten(a1, a2, hilfe);
check(zeile(e, 'Kocht Bueno Kuchen (2 Schritte)')?.x.join() === '2. Eier aufschlagen', `Amys Schritt aus ihrem Rezept (${text(e)})`);
const a3 = nach(a2, [opAmy({ ...KUCHEN, zutaten: [...KUCHEN.zutaten, '150g Sahne'], notiz: 'Halbe Menge' }, 'Amy')]);
e = einzelheiten(a2, a3, hilfe);
check(zeile(e, '„Bueno Kuchen“ geändert')?.x.join(' | ') === '+ 150g Sahne | Notiz: „Halbe Menge“', `Rezept geändert: was genau (${text(e)})`);
e = einzelheiten(a3, nach(a3, [opAmyWeg(KUCHEN.id)]), hilfe);
check(zeile(e, 'Rezept gelöscht')?.x.join() === '„Bueno Kuchen“', 'Rezept gelöscht');

/* ---------------------------------------------------------- Rezepte */

const r1 = nach(s0, [opBewerten('chili', 'hoch', 'Tobi'), opAnpinnen('chili', true, 'Tobi'), opNotiz('chili', 'n-1', 'Nächstes Mal weniger Salz', 'Amy')]);
e = einzelheiten(s0, r1, hilfe);
check(zeile(e, 'Bewertet')?.x.join() === 'Chili: Daumen hoch' && zeile(e, 'Angepinnt')?.x.join() === 'Chili' && zeile(e, 'Notiz zu Chili')?.x.join() === '„Nächstes Mal weniger Salz“', `Bewertet, angepinnt, Notiz mit Text (${text(e)})`);
e = einzelheiten(r1, nach(r1, [opBewerten('chili', null, 'Tobi'), opAnpinnen('chili', false, 'Tobi')]), hilfe);
check(!!zeile(e, 'Bewertung zurückgenommen') && !!zeile(e, 'Nicht mehr angepinnt'), 'Zurückgenommen und losgelöst');

/* --------------------------------------------------------- Haushalt */

const PLAN = { name: 'Küche', raum: 'kueche', aufgaben: [{ id: 'a-1', t: 'Arbeitsflächen abwischen' }, { id: 'a-2', t: 'Backofen putzen', jedes: 2 }], material: ['Spülmittel'], wdh: { tage: [1, 4], wochen: 1, ab: '2026-11-02' }, wer: '', erinnern: 'morgens' };
const h1 = nach(s0, [opPlan('pp-kueche', PLAN, 'Amy'), opSache('hs-spuel', { name: 'Spülmittel', bereich: 'kueche' }, 'Amy')]);
e = einzelheiten(s0, h1, hilfe);
check(zeile(e, 'Putzplan angelegt')?.x.join() === 'Küche – jeden Mo und Do, 2 Aufgaben' && zeile(e, 'Haushaltssache dazu')?.x.join() === 'Spülmittel', `Putzplan angelegt, Haushaltssache (${text(e)})`);
const h2 = nach(h1, [opPutzHaken('pp-kueche', '2026-11-05', 'a-1', true, 'Amy')]);
e = einzelheiten(h1, h2, hilfe);
check(zeile(e, 'Putzplan Küche')?.x.join(' | ') === '✓ Arbeitsflächen abwischen | alles erledigt', `Putzplan: welche Aufgabe – und fertig, weil der Backofen am Donnerstag nicht dran ist (${text(e)})`);
const h3 = nach(h2, [opPlan('pp-kueche', { ...PLAN, aufgaben: [...PLAN.aufgaben, { id: 'a-3', t: 'Kühlschrank auswischen' }], wdh: { tage: [6], wochen: 1, ab: '2026-11-02' }, wer: 'Amy' }, 'Amy')]);
e = einzelheiten(h2, h3, hilfe);
check(zeile(e, 'Putzplan Küche geändert')?.x.join(' | ') === '+ Kühlschrank auswischen | jetzt jeden Samstag | macht Amy', `Putzplan geändert: was genau (${text(e)})`);

/* ------------------------------------------------- Ziel, Sonstiges */

const z1 = nach(s0, [opProfil({ ziel: { kcal: 400, p: 30, kh: 40, f: 14 } }, 'Marielle')]);
const z2 = nach(z1, [opProfil({ ziel: { kcal: 420, p: 33, kh: 40, f: 14 } }, 'Marielle')]);
e = einzelheiten(z1, z2, hilfe);
check(zeile(e, 'Ziel pro Box')?.x.join() === '400 kcal · 30 g P · 40 g KH · 14 g F → 420 kcal · 33 g P · 40 g KH · 14 g F' && e[0].b === 'Ziel', `Ziel pro Box: vorher → nachher (${text(e)})`);
e = einzelheiten(s0, nach(s0, [opPerson('Amy')]), hilfe);
check(zeile(e, 'Zum ersten Mal dabei')?.x.join() === 'Amy', 'Zum ersten Mal dabei: Amy');
// Eine eigene Liste, auf einem Gerät „Marielli“: zusammengeführt – das ist die Umbenennung, nicht lauter Änderungen
const ihre = nach(s0, [opZusammen({}, {}, { profil: { person: 'Marielle' } }), opPerson('Marielle')]);
const zwei = JSON.parse(JSON.stringify(ihre));
zwei.leute.marielli = 'Marielli';
const mitMarielli = nach(bereinigen(zwei), [opTeil('reis', 'x-marielli', { q: 250, u: 'g', h: '' }, KAT.reis)]);
e = einzelheiten(mitMarielli, nach(mitMarielli, [opEinePerson('Marielle')]), hilfe);
check(zeile(e, 'Umbenannt')?.x.join() === 'Marielli → Marielle' && !zeile(e, 'Mehr davon'), `Zusammengeführt: „Marielli → Marielle“, kein Rauschen (${text(e)})`);

/* ----------------------------------------------------------- Sachen */

const KLEID = { id: 'sl-kleid01', name: 'Kleidung', bild: 'womans-clothes', reihe: 1 };
const SCHUH = { id: 'sl-schuh01', name: 'Schuhe', bild: 'high-heeled-shoe', reihe: 2 };
const ROCK = { id: 'sd-rock0001', liste: KLEID.id, name: 'Rock', marke: 'Zara', notiz: '', tags: ['Sommer'], reihe: 1 };
const i1 = nach(s0, [opInvListe(KLEID, 'Marielle'), opDing(ROCK, 'Marielle')]);
e = einzelheiten(s0, i1, hilfe);
check(zeile(e, 'Liste angelegt')?.x.join() === 'Kleidung' && zeile(e, 'Dazu')?.x.join() === 'Rock (Zara) – Kleidung' && e.every((x) => x.b === 'Sachen'), `Sachen: Liste angelegt, „Rock (Zara) – Kleidung“ dazu (${text(e)})`);
const i2 = nach(i1, [opDing({ ...ROCK, notiz: 'Größe 38, zurückgelegt', tags: ['Sommer', 'Lieblingsstück'] }, 'Marielle')]);
e = einzelheiten(i1, i2, hilfe);
check(zeile(e, 'Geändert')?.x.join() === 'Rock (Zara): Notiz, Tags' && !text(e).includes('Größe 38'), `Sache geändert: welche Felder – nicht, was in der Notiz steht (${text(e)})`);
const i3 = nach(i2, [opInvListe(SCHUH, 'Marielle'), opDing({ ...ROCK, liste: SCHUH.id, notiz: 'Größe 38, zurückgelegt', tags: ['Sommer', 'Lieblingsstück'] }, 'Marielle')]);
e = einzelheiten(i2, i3, hilfe);
check(zeile(e, 'Liste angelegt')?.x.join() === 'Schuhe' && zeile(e, 'Geändert')?.x.join() === 'Rock (Zara): nach Schuhe', `Sache in eine andere Liste: „nach Schuhe“ (${text(e)})`);
const i4 = nach(i3, [opInvListe({ ...KLEID, name: 'Klamotten' }, 'Marielle'), opDingWeg(ROCK.id)]);
e = einzelheiten(i3, i4, hilfe);
check(zeile(e, 'Liste umbenannt')?.x.join() === 'Kleidung → Klamotten' && zeile(e, 'Gelöscht')?.x.join() === 'Rock (Zara)', `Liste umbenannt, Sache gelöscht (${text(e)})`);
e = einzelheiten(i4, nach(i4, [opInvListeWeg(SCHUH.id)]), hilfe);
check(zeile(e, 'Liste gelöscht')?.x.join() === 'Schuhe' && e.length === 1, `Liste gelöscht (${text(e)})`);
const spaeter = new Date(Date.now() + 1000).toISOString();
const i5 = nach(i4, [opDing({ id: 'sd-hose0001', liste: KLEID.id, name: 'Hose', reihe: 1 }, 'Marielle'), opDing({ id: 'sd-mantel01', liste: KLEID.id, name: '', marke: 'Mango', reihe: 2 }, 'Marielle', spaeter)]);
e = einzelheiten(i4, i5, hilfe);
check(Object.keys(i5.inventar.dinge)[0] === 'sd-mantel01' && zeile(e, 'Dazu')?.x.join() === 'Hose – Klamotten,Mango – Klamotten', `Ohne Namen heißt die Sache nach der Marke; in der Reihenfolge, in der sie dazukamen – auch wenn die Datei die neueste vorn hat (${text(e)})`);
e = einzelheiten(i5, nach(i5, [opDing({ id: 'sd-hose0001', liste: KLEID.id, name: 'Hose', reihe: 3 }, 'Marielle', new Date(Date.now() + 2000).toISOString())]), hilfe);
check(text(e) === 'Sachen|Reihenfolge geändert', `Nur umsortiert: „Reihenfolge geändert“ (${text(e)})`);

/* --------------------------------------------- Sachen aus sachen.json */

// Amys Sachen stehen seit v83 in einer eigenen Datei (sachen.json, js/sachen.js). Der Überblick holt sie zu einem
// Commit an sachen.json wie liste.json und bereinigt sie mit bereinigen aus liste.js (ansicht-gaeste.js fassung):
// übrig bleiben rev und inventar – version und weg fallen weg, verglichen werden nur die Sachen.
const alsFassung = (sa) => bereinigen(JSON.parse(`${JSON.stringify(sa, null, 1)}\n`));
const sa1 = sachenAnwenden(leerSachen(), [opInvListe(KLEID, 'Amy'), opDing(ROCK, 'Amy')]);
sa1.rev = 1;
const sa2 = sachenAnwenden(sa1, [opDing({ id: 'sd-kleid001', liste: KLEID.id, name: 'Sommerkleid', marke: 'Zara', tags: ['Sommer'], reihe: 2 }, 'Amy'), opDing({ ...ROCK, notiz: 'SACHEN-NOTIZ-GEHEIM', tags: ['Sommer', 'Büro'] }, 'Amy')]);
sa2.rev = 2;
check(alsFassung(sa2).rev === 2 && Object.keys(alsFassung(sa2).inventar.dinge).length === 2 && !('weg' in alsFassung(sa2)), 'sachen.json bereinigt wie liste.json: rev und die Sachen, kein weg');
// Der erste Commit an sachen.json (der Umzug): davor gab es die Datei nicht – verglichen wird mit einer leeren Liste
e = einzelheiten(leer(), alsFassung(sa1), hilfe);
check(text(e) === 'Sachen|Liste angelegt: Kleidung\nSachen|Dazu: Rock (Zara) – Kleidung', `sachen.json, erster Commit: nur Sachen-Zeilen (${text(e)})`);
// Ein Commit der Sachen-App („Amy: Sachen, 2 Änderungen“): was dazukam und was sich geändert hat
e = einzelheiten(alsFassung(sa1), alsFassung(sa2), hilfe);
check(e.length > 0 && e.every((x) => x.b === 'Sachen'), `sachen.json: nur Sachen-Zeilen (${text(e)})`);
check(zeile(e, 'Dazu')?.x.join() === 'Sommerkleid (Zara) – Kleidung' && zeile(e, 'Geändert')?.x.join() === 'Rock (Zara): Notiz, Tags' && !text(e).includes('SACHEN-NOTIZ'), `sachen.json: „Dazu: Sommerkleid (Zara) – Kleidung“, „Geändert: Rock (Zara): Notiz, Tags“ – nicht, was in der Notiz steht (${text(e)})`);
// Gelöscht: sachen.json merkt es sich unter weg – im Vergleich nur „Gelöscht“, kein Rauschen
const sa3 = sachenAnwenden(sa2, opDingWeg('sd-kleid001'));
sa3.rev = 3;
e = einzelheiten(alsFassung(sa2), alsFassung(sa3), hilfe);
check(Object.keys(sa3.weg).join() === 'sd-kleid001' && text(e) === 'Sachen|Gelöscht: Sommerkleid (Zara)', `sachen.json: gelöscht – nur „Gelöscht: Sommerkleid (Zara)“ (${text(e)})`);
// Von Hand kaputt oder ohne inventar: bereinigt eine leere Liste, kein Fehler
check(einzelheiten(alsFassung(sa3), bereinigen({ rev: 4, weg: 'kaputt' }), hilfe).every((x) => x.b === 'Sachen') && JSON.stringify(sachenBereinigen({ rev: 4, weg: 'kaputt' }).weg) === '{}', 'sachen.json ohne inventar: nur Sachen-Zeilen, kein Fehler');

/* ------------------------------------- Umzug: ein Commit für sich */

// Nach dem Umzug nimmt Boxenstopp Amys Sachen aus liste.json (inventar.js opUmgezogen) – verglichen sähe das aus wie lauter
// gelöschte Sachen. Darum geht der Umzug immer als eigener Commit (speicher.js senden), den das Dashboard übergeht
// („Umzug der Sachen nach sachen.json“, ohne „Name:“ – tests/test-umzug.mjs); der Commit mit der eigenen Änderung im
// selben Augenblick zeigt nur, was die Person getan hat.
const u0 = nach(s0, [opInvListe(KLEID, 'Amy'), opDing(ROCK, 'Amy'), opEigener('c-bananen', 'Bananen', 'obst')]);
const u1 = nach(u0, [opEigener('c-tomaten', 'Tomaten', 'obst')]);
const umzugOp = opUmgezogen(umzugZusammen(leerSachen(), u1.inventar).umgezogen);
const u2 = nach(u1, [umzugOp]);
e = einzelheiten(u0, u1, hilfe);
check(text(e) === 'Einkauf|Auf die Liste: Tomaten', `der eigene Commit (vor dem Umzug): nur „Auf die Liste: Tomaten“, keine Sachen (${text(e)})`);
e = einzelheiten(u1, u2, hilfe);
check(!hatInventar(u2.inventar) && JSON.stringify(u2.items) === JSON.stringify(u1.items) && e.length > 0 && e.every((x) => x.b === 'Sachen'), `der Umzug für sich: nur Sachen-Zeilen, die Einkaufsliste bleibt (${text(e)})`);
check(/Gelöscht|Liste gelöscht/.test(text(e)), `… und die sähen aus wie gelöschte Sachen – darum ein eigener Commit, den das Dashboard übergeht (${text(e)})`);
// Ein Umzug, bei dem nichts mehr in liste.json stand (schon umgezogen): keine Einzelheiten
check(einzelheiten(u2, nach(u2, [umzugOp]), hilfe).length === 0, 'der Umzug noch einmal: nichts');

// Nichts geändert (nur rev): nichts
check(einzelheiten(s5, nach(s5, []), hilfe).length === 0, 'Nur neu geschrieben: keine Einzelheiten');
// Bereiche in der Reihenfolge des Überblicks
e = einzelheiten(s0, nach(s0, [opProfil({ ziel: { kcal: 400, p: 30, kh: 40, f: 14 } }, 'Tobi'), opGekocht('chili', '2026-11-06', 'Tobi'), opEigener('c-x', 'Milch', 'kuehl'), opDing(ROCK, 'Tobi')]), hilfe);
check(e.map((x) => x.b).join() === 'Einkauf,Kochen,Sachen,Ziel', `Reihenfolge: Einkauf, Kochen, Sachen, Ziel (${e.map((x) => x.b).join()})`);

/* ----------------------------------------------- Sitzung: zusammen */

const sitzung = zusammenlegen([einzelheiten(s1, s2, hilfe), einzelheiten(s2, s3, hilfe), einzelheiten(k0, k1, hilfe)]);
check(zeile(sitzung, 'Abgehakt')?.x.join() === 'Rinderhackfleisch,Bananen,Zwiebeln' && sitzung.filter((x) => x.a === 'Abgehakt').length === 1, 'Eine Sitzung: alles Abgehakte in einer Zeile, in der Reihenfolge');
check(sitzung[0].b === 'Einkauf' && sitzung.at(-1).b === 'Kochen' && !!zeile(sitzung, 'Alles eingekauft'), 'Eine Sitzung: Bereiche in Reihenfolge');
check(zusammenlegen([null, undefined, [{ x: ['kaputt'] }]]).length === 0, 'Kaputtes fällt weg');

ende();
