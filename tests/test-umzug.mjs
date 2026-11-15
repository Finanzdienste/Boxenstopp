/*
 * Der Umzug von Amys Sachen aus liste.json nach sachen.json (seit v83 eine
 * eigene App unter sachen/): js/sachen.js umzugZusammen, js/inventar.js
 * opUmgezogen, js/app.js sachenUmzug, js/speicher.js listeNachtrag mit
 * ohneInventar und die Commit-Nachricht, dazu, was Boxenstopp in Amys
 * Bereich zeigt (js/ansicht-sachen-app.js).
 *
 * In Node: ein ganzer Durchgang, dann schreibt eine ältere App-Fassung (bis v82)
 * die Sachen zurück – eine inzwischen geändert, eine in sachen.json gelöscht –,
 * und der zweite Durchgang räumt wieder auf, beliebig oft. Eine Sache, deren
 * Liste in sachen.json nach ihrer Fassung gelöscht wurde, kommt nicht zurück;
 * Rückgängig (opZusammen mit at) nimmt einen späteren Grabstein nicht zurück.
 * Der Nachtrag der gemeinsamen Liste legt fehlendes inventar nie wieder dazu
 * (es geht an den Umzug), der einer eigenen Liste schon. Der Commit des Umzugs
 * an liste.json heißt „Umzug der Sachen nach sachen.json“ – ohne „Name:“,
 * jedes Dashboard übergeht ihn; gezählt wird der Umzug über den Commit an
 * sachen.json. Fällt er mit eigenen Änderungen zusammen, zählt die Nachricht
 * nur die eigenen.
 *
 * Im Browser (Boxenstopp, nachgebautes GitHub, nur erfundene Daten): Tobis
 * Gerät zieht um (erst sachen.json, dann liste.json), eine eigene Änderung
 * im selben Augenblick geht als eigener Commit, eine ältere Fassung schreibt
 * zurück, ein Gerät kennt inventar noch aus dem Zwischenspeicher, eine Fassung
 * vor v70 lässt inventar weg, bevor die Sachen umgezogen sind, eine Löschung
 * aus einer älteren Fassung wartet noch auf dem Gerät, Trennen vergisst auch die Sachen-App,
 * sachen.json geht kurz nicht, Marielles eigene Liste bleibt, wie sie ist,
 * Sachen nur auf dem Gerät kommen beim Verbinden nach sachen.json – auch, wenn
 * die Sachen-App auf Android verbunden hat (Zugang da, lokale Liste noch
 * voll) –, Amys Bereich mit dem Knopf zur Sachen-App (auch auf dem iPhone)
 * und der einmalige Hinweis.
 */
import { pruefer, starteBrowser, handy, bis, githubAttrappe, githubMehrere, SCHLUESSEL, APP_URL } from './hilfe.mjs';
import { leer, anwenden, bereinigen, opZusammen } from '../js/liste.js';
import { opUmgezogen, opDing, opDingWeg, opInvListeWeg, hatInventar, inventarBereinigen, MAX_DINGE } from '../js/inventar.js';
import { umzugZusammen, umzugNoetig, sachenAnwenden, sachenBereinigen, leerSachen } from '../js/sachen.js';
import { ART_LISTE, UMZUG_NACHRICHT } from '../js/speicher.js';
import { nachrichtLesen, zusammenfassen } from '../js/gaeste.js';

const { check, ende } = pruefer();
const klon = (x) => JSON.parse(JSON.stringify(x));
const anzahl = (inv) => `${Object.keys(inv?.listen || {}).length}/${Object.keys(inv?.dinge || {}).length}`;

/* ------------------------------------------------------- erfundene Daten */

const T0 = '2026-11-10T10:00:00.000Z';
const T_WEG = '2026-11-12T09:00:00.000Z';
const T2 = '2026-11-13T08:00:00.000Z';
const T3 = '2026-11-14T08:00:00.000Z';
const T4 = '2026-11-14T12:00:00.000Z';
const INVENTAR = {
  listen: {
    'sl-kleid0001': { id: 'sl-kleid0001', name: 'Kleidung', bild: 'womans-clothes', reihe: 1, at: T0, geaendert: T0, by: 'Amy' },
    'sl-makeup001': { id: 'sl-makeup001', name: 'Make-up', bild: 'lipstick', reihe: 2, at: T0, geaendert: T0, by: 'Amy' },
  },
  dinge: {
    'sd-rock00001': { id: 'sd-rock00001', liste: 'sl-kleid0001', name: 'Blauer Rock', marke: 'Erfunden', notiz: 'M', tags: ['Sommer'], code: '', foto: null, quelle: null, reihe: 1, at: T0, geaendert: T0, by: 'Amy' },
    'sd-jacke0001': { id: 'sd-jacke0001', liste: 'sl-kleid0001', name: 'Testjacke', marke: '', notiz: '', tags: [], code: '4006381333931', foto: null, quelle: null, reihe: 2, at: T0, geaendert: T0, by: 'Amy' },
    'sd-stift0001': { id: 'sd-stift0001', liste: 'sl-makeup001', name: 'Probestift', marke: 'Beispiel', notiz: '', tags: [], code: '', foto: null, quelle: null, reihe: 1, at: T0, geaendert: T0, by: 'Amy' },
  },
};
const BANANEN = { 'c-bananen01': { name: 'Bananen', cat: 'obst', parts: {}, custom: true, checked: false, by: null, at: T0, added: T0 } };
const LISTE0 = { version: 1, rev: 5, items: BANANEN, leute: { amy: 'Amy', tobi: 'Tobi' }, inventar: INVENTAR };

/* ------------------------------------------------------------------ Node */

// 1. Ein ganzer Durchgang
let liste = bereinigen(klon(LISTE0));
check(umzugNoetig(liste) && anzahl(liste.inventar) === '2/3', 'liste.json mit 2 Listen und 3 Sachen: der Umzug ist nötig');
const sachen0 = leerSachen();
const r1 = umzugZusammen(sachen0, liste.inventar);
check(JSON.stringify(sachen0) === JSON.stringify(leerSachen()), 'umzugZusammen lässt den alten Stand von sachen.json, wie er war');
check(anzahl(r1.stand.inventar) === '2/3' && r1.neu.listen === 2 && r1.neu.dinge === 3 && r1.stand.rev === 0, `erster Durchgang: 2 Listen, 3 Sachen neu in sachen.json (${anzahl(r1.stand.inventar)}, neu ${r1.neu.listen}/${r1.neu.dinge})`);
check(JSON.stringify(r1.stand.inventar) === JSON.stringify(inventarBereinigen(INVENTAR)), 'in sachen.json genau die Sachen aus der Liste (Name, Marke, Tags, Code, Liste)');
check(JSON.stringify(Object.keys(r1.umgezogen.dinge).sort()) === JSON.stringify(Object.keys(INVENTAR.dinge).sort()) && r1.umgezogen.dinge['sd-rock00001'] === T0 && r1.umgezogen.listen['sl-kleid0001'] === T0, 'umgezogen: jede Liste und Sache mit ihrem geaendert');
let sachen = { ...r1.stand, rev: 1 };
const vorUmzug = liste;
liste = anwenden(liste, opUmgezogen(r1.umgezogen));
check(!hatInventar(liste.inventar) && !umzugNoetig(liste), 'opUmgezogen: liste.json danach ohne Sachen');
check(JSON.stringify(liste.items) === JSON.stringify(vorUmzug.items) && JSON.stringify(liste.leute) === JSON.stringify(vorUmzug.leute), 'der Rest der Liste bleibt (Bananen, leute)');
check(JSON.stringify(anwenden(liste, opUmgezogen(r1.umgezogen))) === JSON.stringify(liste), 'opUmgezogen zweimal: nichts passiert');

// In der Sachen-App: Amy löscht den Probestift
sachen = sachenAnwenden(sachen, opDingWeg('sd-stift0001', T_WEG));
check(!sachen.inventar.dinge['sd-stift0001'] && sachen.weg['sd-stift0001'] === T_WEG, 'in sachen.json gelöscht: der Probestift steht unter weg');

// Eine ältere App-Fassung (bis v82) bringt die Sachen zurück – der Rock inzwischen geändert, der Probestift noch alt
const zurueck = klon(inventarBereinigen(INVENTAR));
zurueck.dinge['sd-rock00001'] = { ...zurueck.dinge['sd-rock00001'], notiz: 'M, kurz', geaendert: T2 };
liste = anwenden(liste, opZusammen({}, {}, { inventar: zurueck }));
check(anzahl(liste.inventar) === '2/3' && liste.inventar.dinge['sd-rock00001'].notiz === 'M, kurz', 'opZusammen mit inventar (wie bis v82): die Sachen stehen wieder in liste.json');
const sachenVor2 = klon(sachen);
const r2 = umzugZusammen(sachen, liste.inventar);
check(JSON.stringify(sachen) === JSON.stringify(sachenVor2), 'zweiter Durchgang: der alte Stand bleibt, wie er war');
check(r2.stand.inventar.dinge['sd-rock00001']?.notiz === 'M, kurz' && r2.stand.inventar.dinge['sd-rock00001'].geaendert === T2, 'zweiter Durchgang: der geänderte Rock gewinnt (neueres geaendert)');
check(!r2.stand.inventar.dinge['sd-stift0001'] && r2.stand.weg['sd-stift0001'] === T_WEG && r2.umgezogen.dinge['sd-stift0001'] === T0, 'der gelöschte Probestift bleibt weg – und darf trotzdem aus liste.json');
check(anzahl(r2.stand.inventar) === '2/2' && r2.stand.inventar.dinge['sd-jacke0001']?.name === 'Testjacke' && r2.neu.dinge === 1 && r2.neu.listen === 0, `nichts geht verloren: 2 Listen, Rock und Jacke; neu nur der Rock (${anzahl(r2.stand.inventar)}, neu ${r2.neu.listen}/${r2.neu.dinge})`);
liste = anwenden(liste, opUmgezogen(r2.umgezogen));
check(!hatInventar(liste.inventar) && JSON.stringify(liste.items) === JSON.stringify(vorUmzug.items), 'liste.json wieder leer, die Bananen bleiben');

// Mehrfach ohne Schaden: dieselben Sachen noch dreimal – nichts Neues, derselbe Stand
let s3 = r2.stand;
let gleich = true;
for (let i = 0; i < 3; i++) {
  const r = umzugZusammen(s3, zurueck);
  gleich = gleich && r.neu.listen === 0 && r.neu.dinge === 0 && JSON.stringify(r.stand) === JSON.stringify(s3) && Object.keys(r.umgezogen.dinge).length === 3;
  s3 = r.stand;
}
check(gleich, 'dreimal dieselben Sachen: nichts Neues, sachen.json bleibt, wie sie ist');

// Neuer in sachen.json als das, was die ältere Fassung zurückbringt: sachen.json gewinnt, aus liste.json darf es trotzdem
const mitJacke = sachenAnwenden(s3, opDing({ ...s3.inventar.dinge['sd-jacke0001'], notiz: 'neu in der Sachen-App' }, 'Amy', T3));
const r4 = umzugZusammen(mitJacke, zurueck);
check(r4.stand.inventar.dinge['sd-jacke0001'].notiz === 'neu in der Sachen-App' && r4.umgezogen.dinge['sd-jacke0001'] === T0 && r4.neu.dinge === 0, 'eine ältere Fassung bringt die Jacke von vorher: die neuere aus sachen.json bleibt');

// Hat die ältere Fassung währenddessen in liste.json noch einmal geändert, bleibt das für den nächsten Umzug
let liste5 = bereinigen(klon(LISTE0));
const r5 = umzugZusammen(r1.stand, liste5.inventar);
liste5.inventar.dinge['sd-rock00001'] = { ...liste5.inventar.dinge['sd-rock00001'], notiz: 'noch einmal anders', geaendert: T4 };
liste5 = anwenden(liste5, opUmgezogen(r5.umgezogen));
check(anzahl(liste5.inventar) === '0/1' && liste5.inventar.dinge['sd-rock00001'].notiz === 'noch einmal anders', 'inzwischen in liste.json geändert: genau das bleibt dort (für den nächsten Umzug)');
const r6 = umzugZusammen(r5.stand, liste5.inventar);
check(r6.stand.inventar.dinge['sd-rock00001'].notiz === 'noch einmal anders' && r6.neu.dinge === 1, '… und der nächste Umzug nimmt es mit');
check(sachenBereinigen(JSON.parse(JSON.stringify(r6.stand))).inventar.dinge['sd-rock00001'].geaendert === T4, 'sachen.json übersteht JSON hin und zurück');

// Ihre Liste ist in sachen.json nach ihrer Fassung gelöscht (Grabstein der Liste): Die Sache kommt nicht als „Ohne Liste“ zurück.
// So ist es, wenn die Sachen-App „Make-up“ löscht, während der Probestift nur noch in liste.json stand (eine ältere Fassung)
const nurMakeup = umzugZusammen(leerSachen(), { listen: { 'sl-makeup001': INVENTAR.listen['sl-makeup001'] }, dinge: {} }).stand;
const ohneMakeup = sachenAnwenden({ ...nurMakeup, rev: 1 }, opInvListeWeg('sl-makeup001', T_WEG));
check(!ohneMakeup.inventar.listen['sl-makeup001'] && ohneMakeup.weg['sl-makeup001'] === T_WEG && !ohneMakeup.weg['sd-stift0001'], 'in sachen.json: „Make-up“ gelöscht (Grabstein der Liste), der Probestift stand dort nie');
const r7 = umzugZusammen(ohneMakeup, INVENTAR);
check(!r7.stand.inventar.dinge['sd-stift0001'] && !r7.stand.inventar.listen['sl-makeup001'] && !r7.stand.weg['sd-stift0001'], `der Probestift (seine Liste nach seiner Fassung gelöscht) kommt nicht zurück – auch nicht als „Ohne Liste“ (${anzahl(r7.stand.inventar)})`);
check(r7.umgezogen.dinge['sd-stift0001'] === T0 && r7.umgezogen.listen['sl-makeup001'] === T0, '… zählt aber als umgezogen: Er darf aus liste.json');
check(anzahl(r7.stand.inventar) === '1/2' && r7.neu.listen === 1 && r7.neu.dinge === 2 && r7.stand.weg['sl-makeup001'] === T_WEG, `Kleidung, Rock und Jacke ziehen um, der Grabstein bleibt (${anzahl(r7.stand.inventar)}, neu ${r7.neu.listen}/${r7.neu.dinge})`);
const r7b = umzugZusammen(ohneMakeup, { listen: {}, dinge: { 'sd-stift0001': { ...INVENTAR.dinge['sd-stift0001'], notiz: 'nachgekauft', geaendert: T2 } } });
check(r7b.stand.inventar.dinge['sd-stift0001']?.notiz === 'nachgekauft' && r7b.neu.dinge === 1, 'nach dem Löschen der Liste noch geändert (neuer als der Grabstein): der Probestift kommt mit (wie inventar.js invListeWeg)');

// Rückgängig (ansicht-inventar.js): opZusammen mit inventar und at = die Zeit der Löschung, die es zurücknimmt
const basis = r1.stand;
const jacke = basis.inventar.dinge['sd-jacke0001'];
const jackeWeg = opDingWeg('sd-jacke0001', T2);
const zurueckJacke = (at) => ({ ...opZusammen({}, {}, { inventar: { listen: {}, dinge: { 'sd-jacke0001': jacke } } }), ...(at ? { at } : {}) });
const sJ = sachenAnwenden(basis, jackeWeg);
check(!sJ.inventar.dinge['sd-jacke0001'] && sJ.weg['sd-jacke0001'] === T2 && !('at' in zurueckJacke('')), 'Amy löscht die Jacke (Grabstein T2); opZusammen selbst hat kein at');
const sJ1 = sachenAnwenden(sJ, zurueckJacke(jackeWeg.at));
check(sJ1.inventar.dinge['sd-jacke0001']?.name === 'Testjacke' && !sJ1.weg['sd-jacke0001'], 'Rückgängig mit at der Löschung, nichts dazwischen: die Jacke ist wieder da, ohne Grabstein');
// Ein anderes Gerät (war offline) hat sie danach noch einmal gelöscht: Grabstein T3, neuer als das at des Rückgängig
const sJ2 = sachenAnwenden(sJ, opDingWeg('sd-jacke0001', T3));
check(sJ2.weg['sd-jacke0001'] === T3, 'eine spätere Löschung von einem anderen Gerät: Grabstein T3');
const sJ3 = sachenAnwenden(sJ2, zurueckJacke(jackeWeg.at));
check(!sJ3.inventar.dinge['sd-jacke0001'] && sJ3.weg['sd-jacke0001'] === T3, 'Rückgängig mit at älter als der spätere Grabstein: die Jacke bleibt gelöscht, der Grabstein bleibt');
const sJ4 = sachenAnwenden(sJ2, zurueckJacke(''));
check(sJ4.inventar.dinge['sd-jacke0001']?.name === 'Testjacke' && !sJ4.weg['sd-jacke0001'], 'ohne at (eine Warteschlange von vorher): wie bisher – die Jacke kommt zurück');
const sJ5 = sachenAnwenden(sJ2, zurueckJacke(T4));
check(sJ5.inventar.dinge['sd-jacke0001']?.name === 'Testjacke' && !sJ5.weg['sd-jacke0001'], 'at neuer als der Grabstein: die Jacke kommt zurück');
// Eine ganze Liste: Kleidung gelöscht (T2), danach anderswo der Rock (T3) – Rückgängig der Liste bringt Kleidung und Jacke, der Rock bleibt weg
const sK = sachenAnwenden(sachenAnwenden(basis, opInvListeWeg('sl-kleid0001', T2)), opDingWeg('sd-rock00001', T3));
const kleidZurueck = { ...opZusammen({}, {}, { inventar: { listen: { 'sl-kleid0001': basis.inventar.listen['sl-kleid0001'] }, dinge: { 'sd-rock00001': basis.inventar.dinge['sd-rock00001'], 'sd-jacke0001': jacke } } }), at: T2 };
const sK1 = sachenAnwenden(sK, kleidZurueck);
check(sK.weg['sl-kleid0001'] === T2 && sK.weg['sd-rock00001'] === T3 && sK1.inventar.listen['sl-kleid0001'] && sK1.inventar.dinge['sd-jacke0001'] && !sK1.inventar.dinge['sd-rock00001'] && sK1.weg['sd-rock00001'] === T3 && !sK1.weg['sl-kleid0001'] && !sK1.weg['sd-jacke0001'], `Rückgängig einer Liste: Kleidung und Jacke wieder da, der später gelöschte Rock bleibt weg (${anzahl(sK1.inventar)}, weg ${Object.keys(sK1.weg).join(',')})`);

// 2. Der Nachtrag (speicher.js listeNachtrag): fehlt inventar in der Datei, kannte das Gerät aber welches
const bekannt = anwenden(leer(), opZusammen({}, {}, { inventar: INVENTAR, amy: {} }));
const roh = { version: 1, rev: 9, items: klon(BANANEN), leute: { tobi: 'Tobi' } };
const stand = bereinigen(klon(roh));
const mitInventar = (ops) => ops.some((o) => o?.typ === 'zusammen' && hatInventar(inventarBereinigen(o.inventar)));
check(!('inventar' in roh) && hatInventar(bekannt.inventar), 'roh ohne den Schlüssel inventar, das Gerät kannte 2 Listen und 3 Sachen');
const n1 = ART_LISTE.nachtrag(roh, stand, bekannt, { ohneInventar: true });
check(!mitInventar(n1), `gemeinsame Liste (ohneInventar): kein Nachtrag mit inventar (${n1.length} Nachträge)`);
const n2 = ART_LISTE.nachtrag(roh, stand, bekannt, {});
check(mitInventar(n2) && anzahl(n2.find((o) => o.typ === 'zusammen').inventar) === '2/3', 'eigene Liste eines Gasts: inventar kommt wie bisher wieder dazu');
check(anzahl(anwenden(stand, n2).inventar) === '2/3' && !hatInventar(anwenden(stand, n1).inventar), 'angewendet: beim Gast wieder 2/3, in der gemeinsamen Liste nichts');
// Die gemeinsame Liste in der App (app.js): ohneInventar ist eine Funktion – sie bekommt, was das Gerät kannte (für den Umzug)
const anDenUmzug = [];
const nF = ART_LISTE.nachtrag(roh, stand, bekannt, { ohneInventar: (inv) => anDenUmzug.push(inv) });
check(!mitInventar(nF) && anDenUmzug.length === 1 && JSON.stringify(anDenUmzug[0]) === JSON.stringify(bekannt.inventar), `ohneInventar als Funktion: kein Nachtrag mit inventar, die bekannten Sachen (${anzahl(anDenUmzug[0])}) gehen an die Funktion`);
const nichtsAnDenUmzug = [];
ART_LISTE.nachtrag({ ...roh, inventar: { listen: {}, dinge: {} } }, stand, bekannt, { ohneInventar: (inv) => nichtsAnDenUmzug.push(inv) });
ART_LISTE.nachtrag(roh, stand, anwenden(leer(), opZusammen({}, {}, { amy: {} })), { ohneInventar: (inv) => nichtsAnDenUmzug.push(inv) });
check(nichtsAnDenUmzug.length === 0, 'steht inventar (leer) in der Datei oder kannte das Gerät keine Sachen: die Funktion bekommt nichts');
// Fehlt mehr als inventar (Amys Rezepte), kommt das Übrige auch in der gemeinsamen Liste wieder – nur ohne Sachen
const AMY_REZEPT = { id: 'amy-testsalat', name: 'Testsalat', portionen: 1, zutaten: ['1 Testgurke'], schritte: ['Schneiden.'], at: T0, by: 'Amy' };
const bekannt2 = anwenden(bekannt, opZusammen({}, {}, { amy: { 'amy-testsalat': AMY_REZEPT } }));
const n3 = ART_LISTE.nachtrag(roh, stand, bekannt2, { ohneInventar: true });
const zus3 = n3.find((o) => o.typ === 'zusammen');
check(Object.keys(bekannt2.amy || {}).length === 1 && zus3 && Object.keys(zus3.amy).length === 1 && !mitInventar(n3), 'fehlen auch Amys Rezepte: die kommen wieder, die Sachen nicht');
check(!mitInventar(ART_LISTE.nachtrag({ ...roh, inventar: { listen: {}, dinge: {} } }, stand, bekannt, {})), 'steht inventar leer in der Datei (gelöscht), kommt auch beim Gast nichts wieder');

// Die Commit-Nachricht eines Pakets
const vorN = bereinigen(klon(LISTE0));
const umzugOp = opUmgezogen(umzugZusammen(leerSachen(), vorN.inventar).umgezogen);
const nachN = anwenden(vorN, umzugOp);
const nur = ART_LISTE.nachricht([umzugOp], vorN, nachN, { name: 'Tobi' });
check(nur === 'Umzug der Sachen nach sachen.json' && nur === UMZUG_NACHRICHT, `nur der Umzug: „Umzug der Sachen nach sachen.json“ (${nur})`);
check(ART_LISTE.nachricht([umzugOp, umzugOp], vorN, nachN, { name: 'Amy' }) === UMZUG_NACHRICHT, 'zwei Umzüge in einem Paket: dieselbe Nachricht');
const ln = nachrichtLesen(nur);
check(ln.wer === '' && ln.auto === false && !nur.includes(':'), `gaeste.js: ohne „Name:“ – niemand, kein Ablauf; jedes Dashboard übergeht ihn, auch das von v82 (${JSON.stringify(ln)})`);
const mischOp = opZusammen({ 'c-tomaten01': { ...BANANEN['c-bananen01'], name: 'Tomaten', cat: 'gemuese' } });
// Ein Paket mit Umzug und eigener Änderung schickt die App nicht mehr (speicher.js senden) – stünde eins noch an, zählt und
// beschreibt die Nachricht nur die eigene Änderung, in beiden Reihenfolgen
const gemischt = ART_LISTE.nachricht([umzugOp, mischOp], vorN, anwenden(nachN, mischOp), { name: 'Tobi' });
const gl = nachrichtLesen(gemischt);
check(gemischt.startsWith('Tobi: Einkaufsliste, 1 Änderung – Tomaten auf die Liste') && !gemischt.includes('Sachen') && gl.wer === 'Tobi' && !gl.auto && gl.anzahl === 1 && gl.was.join() === 'Tomaten auf die Liste', `gemischt: nur die eigene Änderung, gezählt und beschrieben – kein „Sachen“ (${gemischt})`);
const gemischt2 = ART_LISTE.nachricht([mischOp, umzugOp], vorN, anwenden(anwenden(vorN, mischOp), umzugOp), { name: 'Tobi' });
check(gemischt2 === gemischt, `… auch, wenn der Umzug hinten steht (${gemischt2})`);
check(!/Bescheid|To Do/.test(nur), 'der Umzug allein: ohne „· Bescheid“ und „· To Do“');
const heute = new Date();
const zf = zusammenfassen([{ id: 'Finanzdienste/Boxenstopp-Daten', name: 'Tobi und Amy', eintraege: [
  { sha: 'c2', at: heute.toISOString(), nachricht: UMZUG_NACHRICHT },
  { sha: 'c1', at: new Date(heute.getTime() - 1000).toISOString(), nachricht: 'Umzug: Sachen aus der Liste – 2 Listen, 3 Sachen' },
] }], { jetzt: heute });
check(JSON.stringify(zf.automatik) === JSON.stringify({ 'Finanzdienste/Boxenstopp-Daten': { Umzug: 1 } }) && zf.personen.length === 0, `Dashboard: der Umzug zählt einmal, als Automatik – über den Commit an sachen.json (${JSON.stringify(zf.automatik)})`);
const zfNur = zusammenfassen([{ id: 'Finanzdienste/Boxenstopp-Daten', name: 'Tobi und Amy', eintraege: [{ sha: 'c3', at: heute.toISOString(), nachricht: UMZUG_NACHRICHT }] }], { jetzt: heute });
check(zfNur.personen.length === 0 && JSON.stringify(zfNur.automatik) === '{}' && !zfNur.verlauf.flatMap((tg) => tg.sitzungen).length, `Dashboard: der Commit an liste.json allein – keine Person, keine Automatik, nichts im Verlauf (${JSON.stringify(zfNur.automatik)})`);
const lw = nachrichtLesen('Umzug: Sachen – 1 Löschung von vorher');
check(lw.auto && lw.wer === 'Umzug', 'die Löschungen von vorher (sachen.js wegInSachen) sind auch ein Ablauf');

/* --------------------------------------------------------------- Browser */

const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const KI_TEST = 'AQ.Ab8TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST00';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SACHEN_ADRESSE = new URL('sachen/', APP_URL).href;
const browser = await starteBrowser();
const datei = (stand) => `${JSON.stringify(stand, null, 1)}\n`;

/** Eine Attrappe mit diesem Stand von liste.json – als erster Commit, damit es Fassungen gibt. */
function attrappeMit(stand, optionen = {}) {
  const gh = githubAttrappe(optionen);
  gh.zustand.datei = datei(stand);
  gh.zustand.version = 1;
  gh.zustand.sha = 'sha1';
  gh.zustand.commits.unshift({ sha: 'k1', message: 'Tobi: Einkaufsliste, 1 Änderung', date: new Date(Date.now() - 60000).toISOString(), pfad: optionen.pfad || 'liste.json' });
  gh.zustand.fassungen.k1 = gh.zustand.datei;
  return gh;
}
/** Wie ein anderes Gerät (eine ältere App-Fassung) liste.json schreibt: neue sha, rev wie im Stand, ein Commit. */
function fremdSchreiben(gh, stand, nachricht = 'Amy: Einkaufsliste, 1 Änderung') {
  gh.zustand.datei = datei(stand);
  gh.zustand.version += 1;
  gh.zustand.sha = `sha${gh.zustand.version}`;
  const sha = `k${gh.zustand.version}`;
  gh.zustand.commits.unshift({ sha, message: nachricht, date: new Date().toISOString(), pfad: 'liste.json' });
  gh.zustand.fassungen[sha] = gh.zustand.datei;
  gh.zustand.nachrichten.push(nachricht);
}
/** Wie die Sachen-App sachen.json schreibt (neue sha, ein Commit). */
function sachenSchreiben(gh, stand, nachricht = 'Amy: Sachen, 1 Änderung') {
  const text = datei(stand);
  gh.zustand.dateien['sachen.json'] = text;
  gh.zustand.wVersion = (gh.zustand.wVersion || 0) + 1;
  gh.zustand.shas['sachen.json'] = `w${gh.zustand.wVersion}`;
  const sha = `s${gh.zustand.wVersion}-fremd`;
  gh.zustand.commits.unshift({ sha, message: nachricht, date: new Date().toISOString(), pfad: 'sachen.json' });
  gh.zustand.fassungen[sha] = text;
}
/** Die Commits an einer Datei, ältester zuerst: [{ sha, message, stand }]. */
const commitsAn = (gh, pfad) => gh.zustand.commits.filter((c) => c.pfad === pfad).reverse().map((c) => ({ ...c, stand: gh.zustand.fassungen[c.sha] ? JSON.parse(gh.zustand.fassungen[c.sha]) : null }));
/** sachen.json schlägt fehl (500), solange kaputt.an – vor die Attrappe geschaltet; kaputt.puts zählt die abgelehnten. */
function mitKaputtemSachen(gh) {
  const kaputt = { an: true, puts: 0, erster: 0 };
  const route = (r) => {
    const req = r.request();
    if (kaputt.an && req.method() === 'PUT' && /\/contents\/sachen\.json$/.test(req.url().split('?')[0])) {
      kaputt.puts++;
      if (!kaputt.erster) kaputt.erster = Date.now();
      return r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"message":"Server Error"}' });
    }
    return gh.route(r);
  };
  return { kaputt, attrappe: { route } };
}
/** Die KI-Anbieter (Gemini, Claude): in diesem Test nie das echte Netz – jede Anfrage zählt als Fehler. */
let kiAnfragen = 0;
const kiSperren = (h) => h.ctx.route(/^https:\/\/(?:generativelanguage\.googleapis\.com|api\.anthropic\.com)\//, (r) => { kiAnfragen++; return r.abort('blockedbyclient'); });
/** Mit Zugang (und mehr im Speicher) neu laden und auf die Boxen warten. */
async function verbunden(h, zugang, mehr = {}) {
  await h.page.evaluate(([z, m]) => {
    localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify(z));
    for (const [k, v] of Object.entries(m)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  }, [zugang, mehr]);
  await h.page.reload();
  await h.page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
}
const status = (p) => p.locator('#sync-text').innerText();
const hinweisOffen = (p) => p.locator('#sachen-hinweis-dlg[open]').count().then((n) => n > 0);
const offnenNachbauen = (p) => p.evaluate(() => { window.geoeffnet = []; window.open = (...a) => { window.geoeffnet.push(a); return null; }; });
const SCHNELL = { __umzugPause: '1500', __hinweis: '300', 'boxenstopp.dashboard.hinweis.v1': 'true' };

// --- 3. Tobis Gerät öffnet Boxenstopp: erst sachen.json, dann liste.json
const ghA = attrappeMit(LISTE0);
const tobi = await handy(browser, { attrappe: ghA, hinweise: true });
await kiSperren(tobi);
const t = tobi.page;
await verbunden(tobi, { token: SCHLUESSEL, name: 'Tobi' }, SCHNELL);
const sachenA = () => ghA.datei('sachen.json');
check(await bis(() => sachenA() && !hatInventar(ghA.liste()?.inventar), 10000), 'Tobis Gerät: die Sachen sind umgezogen');
const sa1 = sachenA();
check(sa1.version === 1 && sa1.rev === 1 && anzahl(sa1.inventar) === '2/3' && JSON.stringify(sa1.weg) === '{}', `sachen.json: version 1, rev 1, 2 Listen, 3 Sachen (${sa1.rev}, ${anzahl(sa1.inventar)})`);
check(JSON.stringify(sa1.inventar) === JSON.stringify(inventarBereinigen(INVENTAR)), 'sachen.json: die Sachen genau so, wie sie in der Liste standen');
check(ghA.zustand.dateien['sachen.json'] === datei(sa1), 'sachen.json: JSON mit 1 Leerzeichen Einrückung, Zeilenumbruch am Ende');
const sCommits = commitsAn(ghA, 'sachen.json');
const lCommits = commitsAn(ghA, 'liste.json');
check(sCommits.length === 1 && sCommits[0].message === 'Umzug: Sachen aus der Liste – 2 Listen, 3 Sachen', `sachen.json: ein Commit „Umzug: Sachen aus der Liste – 2 Listen, 3 Sachen“ (${sCommits.map((c) => c.message).join(' | ')})`);
const iU = lCommits.findIndex((c) => c.message === UMZUG_NACHRICHT);
const uCommit = lCommits[iU];
check(iU > 0 && uCommit.stand.rev === lCommits[iU - 1].stand.rev + 1 && hatInventar(lCommits[iU - 1].stand.inventar), `liste.json: „Umzug der Sachen nach sachen.json“ mit rev + 1 (${lCommits.map((c) => `${c.stand?.rev} ${c.message}`).join(' | ')})`);
check(uCommit && !hatInventar(uCommit.stand.inventar) && JSON.stringify(uCommit.stand.items) === JSON.stringify(bereinigen(klon(LISTE0)).items) && uCommit.stand.leute.amy === 'Amy', 'darin kein inventar-Inhalt mehr, Bananen und leute bleiben');
const reihe = ghA.zustand.commits.slice().reverse();
const iS = reihe.findIndex((c) => c.pfad === 'sachen.json');
const iL = reihe.findIndex((c) => c.pfad === 'liste.json' && c.message === UMZUG_NACHRICHT);
check(iS >= 0 && iL > iS, 'Reihenfolge: erst sachen.json, dann liste.json');
check(!ghA.zustand.nachrichten.some((m) => /Bescheid|To Do/.test(m)), `kein „· Bescheid“, kein „· To Do“ (${ghA.zustand.nachrichten.join(' | ')})`);

// --- 4. Eine ältere Fassung schreibt zurück: der Rock geändert, der Probestift in sachen.json inzwischen gelöscht
sachenSchreiben(ghA, { ...sachenAnwenden(sa1, opDingWeg('sd-stift0001', T_WEG)), rev: sa1.rev + 1 });
const sa2 = sachenA();
check(!sa2.inventar.dinge['sd-stift0001'] && sa2.weg['sd-stift0001'] === T_WEG && sa2.rev === 2, 'die Sachen-App löscht den Probestift (sachen.json rev 2, weg)');
const v79 = ghA.liste();
v79.inventar = klon(zurueck);
v79.rev += 1;
fremdSchreiben(ghA, v79, 'Amy: Einkaufsliste, 1 Änderung');
check(await bis(() => sachenA()?.rev === 3 && !hatInventar(ghA.liste()?.inventar), 10000), 'das Gerät mit v83 zieht wieder um: sachen.json rev 3, liste.json wieder leer');
const sa3 = sachenA();
check(sa3.inventar.dinge['sd-rock00001']?.notiz === 'M, kurz' && sa3.inventar.dinge['sd-rock00001'].geaendert === T2, 'der geänderte Rock ist übernommen');
check(!sa3.inventar.dinge['sd-stift0001'] && sa3.weg['sd-stift0001'] === T_WEG && sa3.inventar.dinge['sd-jacke0001']?.name === 'Testjacke' && anzahl(sa3.inventar) === '2/2', `der gelöschte Probestift bleibt weg, die Jacke und beide Listen bleiben (${anzahl(sa3.inventar)})`);
check(commitsAn(ghA, 'sachen.json').at(-1).message === 'Umzug: Sachen aus der Liste – 0 Listen, 1 Sache', `nur das Neue zählt in der Nachricht (${commitsAn(ghA, 'sachen.json').at(-1).message})`);
const lc2 = commitsAn(ghA, 'liste.json');
check(lc2.at(-1).message === UMZUG_NACHRICHT && lc2.at(-1).stand.rev === v79.rev + 1, `liste.json: wieder „Umzug der Sachen nach sachen.json“, rev + 1 (${lc2.at(-1).stand.rev})`);
// Und noch einmal genau dasselbe (gleicher Stand wie beim letzten Versuch – nach der Pause): sachen.json bleibt, liste.json räumt auf
const v79b = ghA.liste();
v79b.inventar = klon(zurueck);
v79b.rev += 1;
fremdSchreiben(ghA, v79b, 'Amy: Einkaufsliste, 1 Änderung');
check(await bis(() => !hatInventar(ghA.liste()?.inventar), 10000), 'dieselben Sachen noch einmal zurück: liste.json räumt wieder auf');
check(commitsAn(ghA, 'sachen.json').length === 3 && sachenA().rev === 3, 'sachen.json bleibt dabei, wie sie ist (nichts Neues, kein Commit)');
check(!commitsAn(ghA, 'liste.json').filter((c) => c.message === UMZUG_NACHRICHT).some((c) => c.stand?.inventar?.dinge?.['sd-stift0001']), 'der Probestift steht in keiner Fassung nach einem Umzug mehr');
check(!(await hinweisOffen(t)) && (await t.evaluate(() => localStorage.getItem('boxenstopp.sachen.hinweis.v1'))) === null, 'Tobis Gerät: nie der Hinweis auf die Sachen-App');
check(tobi.fehler.length === 0, `Tobi: keine Fehler im Browser (${tobi.fehler.join(' | ')})`);
await tobi.ctx.close();

// --- 4b. Ein Gerät kennt inventar noch aus dem Zwischenspeicher, liste.json kommt ganz ohne den Schlüssel
const ohne = ghA.liste();
delete ohne.inventar;
ohne.rev += 1;
fremdSchreiben(ghA, ohne, 'Tobi: Einkaufsliste, 1 Änderung');
const commitsVorher = ghA.zustand.commits.length;
const zwischen = { sha: 'sha-alt', etag: '"sha-alt"', stand: { ...bereinigen(klon(LISTE0)), rev: ohne.rev - 1 }, format: JSON.stringify(leer()), ort: 'Finanzdienste/Boxenstopp-Daten' };
const zweites = await handy(browser, { attrappe: ghA });
await kiSperren(zweites);
const z = zweites.page;
const getsVorher = ghA.zustand.gets;
await verbunden(zweites, { token: SCHLUESSEL, name: 'Tobi' }, { ...SCHNELL, 'boxenstopp.liste.github.v1': zwischen });
check(await bis(() => ghA.zustand.gets > getsVorher + 2 && z.evaluate(() => !JSON.parse(localStorage.getItem('boxenstopp.liste.github.v1')).stand.inventar.dinge['sd-rock00001']), 8000), 'das zweite Gerät hat liste.json gelesen (ohne inventar)');
await z.waitForTimeout(1500);
const neueCommits = ghA.zustand.commits.slice(0, ghA.zustand.commits.length - commitsVorher);
check(!neueCommits.some((c) => c.pfad === 'liste.json' && hatInventar(JSON.parse(ghA.zustand.fassungen[c.sha] || '{}').inventar)) && !hatInventar(ghA.liste().inventar), `es legt nichts zurück: kein Commit mit inventar (${neueCommits.map((c) => `${c.pfad}: ${c.message}`).join(' | ') || 'keiner'})`);
check(!neueCommits.some((c) => c.pfad === 'sachen.json') && sachenA().rev === 3, 'was es aus dem Zwischenspeicher kennt, ist in sachen.json schon (gleich, neuer oder gelöscht): kein Commit, sachen.json bleibt');
check(!sachenA().inventar.dinge['sd-stift0001'] && sachenA().inventar.dinge['sd-rock00001']?.notiz === 'M, kurz', 'der gelöschte Probestift kommt nicht wieder, der Rock bleibt in der neueren Fassung');
check(await bis(() => z.evaluate(() => localStorage.getItem('boxenstopp.sachen.umzug.v1') === null)), 'auf dem Gerät bleibt nichts für den Umzug vorgemerkt');
check(zweites.fehler.length === 0, `zweites Gerät: keine Fehler im Browser (${zweites.fehler.join(' | ')})`);
await zweites.ctx.close();

// --- 4c. Eine eigene Änderung und der Umzug innerhalb von 0,7 s: zwei Commits an liste.json – der Umzug für sich
const ghG = attrappeMit(LISTE0);
// Die Antwort auf das Schreiben von sachen.json hält der Test an, bis Tobi etwas auf die Liste gesetzt hat
const halt = { puts: 0, los: () => {} };
const haltRoute = async (r) => {
  const req = r.request();
  if (req.method() === 'PUT' && /\/contents\/sachen\.json$/.test(req.url().split('?')[0]) && ++halt.puts === 1) await new Promise((weiter) => { halt.los = weiter; });
  return ghG.route(r);
};
const eilig = await handy(browser, { attrappe: { route: haltRoute } });
await kiSperren(eilig);
const ei = eilig.page;
await verbunden(eilig, { token: SCHLUESSEL, name: 'Tobi' }, SCHNELL);
check(await bis(() => halt.puts === 1, 10000), 'Tobis Gerät schreibt sachen.json (die Antwort kommt noch nicht)');
await ei.click('[data-open="chili"]');
await ei.locator('#detail [data-act="alle-dazu"]').waitFor();
const lVorG = commitsAn(ghG, 'liste.json').length;
await ei.click('#detail [data-act="alle-dazu"]');
halt.los();
check(await bis(() => commitsAn(ghG, 'liste.json').length >= lVorG + 2 && !hatInventar(ghG.liste()?.inventar), 10000), 'Chili auf die Liste und gleich danach der Umzug: beides in liste.json');
await ei.waitForTimeout(1500);
const neuG = commitsAn(ghG, 'liste.json').slice(lVorG);
check(neuG.length === 2, `zwei Commits an liste.json, nicht einer (${neuG.map((c) => c.message).join(' | ')})`);
const [eigenG, umzugG] = neuG;
check(eigenG && /^Tobi: Einkaufsliste, \d+ Änderung(?:en)? – Chili[^;·]* auf die Liste/.test(eigenG.message) && !eigenG.message.includes('Sachen') && anzahl(eigenG.stand.inventar) === '2/3', `erst Tobis Änderung für sich: die Sachen stehen darin noch, kein „Sachen“ in der Nachricht (${eigenG?.message})`);
check(umzugG && umzugG.message === UMZUG_NACHRICHT && !hatInventar(umzugG.stand.inventar) && umzugG.stand.rev === eigenG.stand.rev + 1 && JSON.stringify(umzugG.stand.items) === JSON.stringify(eigenG.stand.items), `dann der Umzug allein: „${UMZUG_NACHRICHT}“, rev + 1, die Einkaufsliste wie davor (${umzugG?.message})`);
check(nachrichtLesen(eigenG?.message).wer === 'Tobi' && !nachrichtLesen(eigenG?.message).was.some((w) => /Sachen/.test(w)) && nachrichtLesen(umzugG?.message).wer === '', 'im Dashboard: Tobi mit Chili, der Umzug bei niemandem');
check(anzahl(ghG.datei('sachen.json')?.inventar) === '2/3' && commitsAn(ghG, 'sachen.json').length === 1, 'sachen.json: 2 Listen, 3 Sachen, ein Commit');
check(eilig.fehler.length === 0, `eiliges Gerät: keine Fehler im Browser (${eilig.fehler.join(' | ')})`);
await eilig.ctx.close();

// --- 4d. Eine Fassung vor v70 (kennt inventar gar nicht) schreibt liste.json ohne den Schlüssel, bevor die Sachen umgezogen sind –
// ein Gerät mit v83 kennt sie aus dem Zwischenspeicher: Sie kommen nach sachen.json, nie zurück in liste.json
const ghF = attrappeMit(LISTE0);
const vor70 = klon(LISTE0);
delete vor70.inventar;
vor70.rev = LISTE0.rev + 1;
fremdSchreiben(ghF, vor70, 'Amy: Einkaufsliste, 1 Änderung');
check(!ghF.datei('sachen.json') && !('inventar' in ghF.liste()) && hatInventar(commitsAn(ghF, 'liste.json')[0].stand.inventar), 'vorher: keine sachen.json; liste.json zuletzt ohne den Schlüssel inventar, davor mit den Sachen');
const lVorF = commitsAn(ghF, 'liste.json').length;
const merktSich = { sha: 'sha1', etag: '"sha1"', stand: bereinigen(klon(LISTE0)), format: JSON.stringify(leer()), ort: 'Finanzdienste/Boxenstopp-Daten' };
const neu80 = await handy(browser, { attrappe: ghF });
await kiSperren(neu80);
const n8 = neu80.page;
await verbunden(neu80, { token: SCHLUESSEL, name: 'Tobi' }, { ...SCHNELL, 'boxenstopp.liste.github.v1': merktSich });
check(await bis(() => anzahl(ghF.datei('sachen.json')?.inventar) === '2/3', 10000), `die Sachen, die nur noch das Gerät kannte, sind in sachen.json (${anzahl(ghF.datei('sachen.json')?.inventar)})`);
const sF = ghF.datei('sachen.json');
check(JSON.stringify(sF?.inventar) === JSON.stringify(inventarBereinigen(INVENTAR)) && sF?.rev === 1, 'genau die Sachen aus der Liste, rev 1');
check(commitsAn(ghF, 'sachen.json').map((c) => c.message).join(' | ') === 'Umzug: Sachen aus der Liste – 2 Listen, 3 Sachen', `ein Commit an sachen.json (${commitsAn(ghF, 'sachen.json').map((c) => c.message).join(' | ')})`);
check(await bis(() => n8.evaluate(() => localStorage.getItem('boxenstopp.sachen.umzug.v1') === null)), 'danach auf dem Gerät nichts mehr vorgemerkt');
await n8.waitForTimeout(1500);
const lNachF = commitsAn(ghF, 'liste.json').slice(lVorF);
check(!lNachF.some((c) => hatInventar(c.stand?.inventar)) && !hatInventar(ghF.liste().inventar), `liste.json bekommt keinen Commit mit Sachen (${lNachF.map((c) => c.message).join(' | ') || 'keiner'})`);
check(neu80.fehler.length === 0, `Gerät mit v83: keine Fehler im Browser (${neu80.fehler.join(' | ')})`);
await neu80.ctx.close();

// --- 4e. Eine Löschung, die das Gerät noch mit einer älteren Fassung gemacht und nicht abgeschickt hat (boxenstopp.offen.v1) – die Testjacke
// steht inzwischen in sachen.json: Boxenstopp v83 löscht sie dort auch
const ghH = attrappeMit({ version: 1, rev: 7, items: klon(BANANEN), leute: { tobi: 'Tobi', amy: 'Amy' } });
sachenSchreiben(ghH, { ...leerSachen(), rev: 1, inventar: inventarBereinigen(INVENTAR) }, 'Umzug: Sachen aus der Liste – 2 Listen, 3 Sachen');
const { kaputt: kaputtH, attrappe: kaputtHA } = mitKaputtemSachen(ghH);
kaputtH.an = false;
const offen79 = await handy(browser, { attrappe: kaputtHA });
await kiSperren(offen79);
const o7 = offen79.page;
await verbunden(offen79, { token: SCHLUESSEL, name: 'Amy' }, { ...SCHNELL, 'boxenstopp.offen.v1': [opDingWeg('sd-jacke0001', T3)] });
check(await bis(() => ghH.datei('sachen.json')?.rev === 2, 10000), 'sachen.json bekommt einen Commit (rev 2)');
const sH = ghH.datei('sachen.json');
check(!sH?.inventar.dinge['sd-jacke0001'] && sH.weg['sd-jacke0001'] === T3 && anzahl(sH.inventar) === '2/2', `die Testjacke ist in sachen.json gelöscht, mit Grabstein (${anzahl(sH.inventar)}, weg ${JSON.stringify(sH.weg)})`);
check(commitsAn(ghH, 'sachen.json').at(-1).message === 'Umzug: Sachen – 1 Löschung von vorher', `Commit „Umzug: Sachen – 1 Löschung von vorher“ (${commitsAn(ghH, 'sachen.json').at(-1).message})`);
check(await bis(() => o7.evaluate(() => localStorage.getItem('boxenstopp.sachen.umzug.weg.v1') === null)), 'boxenstopp.sachen.umzug.weg.v1 ist danach leer');
check(await bis(() => o7.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.offen.v1') || '[]').length === 0)), 'die Löschung ging wie bisher auch an liste.json – nichts mehr offen');
await o7.waitForTimeout(1500);
check(commitsAn(ghH, 'sachen.json').length === 2 && !commitsAn(ghH, 'liste.json').some((c) => hatInventar(c.stand?.inventar)), 'kein zweites Mal, liste.json bekam keine Sachen');

// --- 4f. Trennen: auch Amys Sachen auf diesem Gerät vergessen (die Sachen-App teilt den Speicher) – was auf den Umzug wartet, bleibt
kaputtH.an = true; // sachen.json nimmt gerade nichts an – so wartet der Testring sicher auf dem Gerät
const WARTET = {
  listen: { 'sl-uhren0001': { id: 'sl-uhren0001', name: 'Uhren', bild: 'watch', reihe: 1, at: T0, geaendert: T0, by: 'Amy' } },
  dinge: { 'sd-uhr000001': { id: 'sd-uhr000001', liste: 'sl-uhren0001', name: 'Testuhr', marke: '', notiz: '', tags: [], code: '', foto: null, quelle: null, reihe: 1, at: T0, geaendert: T0, by: 'Amy' } },
};
await o7.evaluate(([gh, offen, rest]) => {
  localStorage.setItem('boxenstopp.sachen.github.v1', JSON.stringify(gh));
  localStorage.setItem('boxenstopp.sachen.offen.v1', JSON.stringify(offen));
  localStorage.setItem('boxenstopp.sachen.umzug.v1', JSON.stringify(rest));
}, [{ sha: 'w2', etag: null, stand: sH, format: JSON.stringify(leerSachen()), ort: 'Finanzdienste/Boxenstopp-Daten' }, [opDingWeg('sd-rock00001', T4)], WARTET]);
await o7.click('.tab[data-tab="einstellungen"]');
await o7.click('[data-act="z-trennen"]');
await o7.click('[data-act="z-trennen-ja"]');
check(await bis(async () => (await status(o7)) === 'Nur lokal'), 'Amy getrennt: „Nur lokal“');
const nachTrennen = await o7.evaluate(() => Object.fromEntries(['boxenstopp.sachen.github.v1', 'boxenstopp.sachen.offen.v1', 'boxenstopp.sachen.umzug.v1', 'boxenstopp.liste.github.v1', 'boxenstopp.offen.v1'].map((k) => [k, localStorage.getItem(k)])));
check(nachTrennen['boxenstopp.sachen.github.v1'] === null && nachTrennen['boxenstopp.sachen.offen.v1'] === null, 'Trennen löscht boxenstopp.sachen.github.v1 und boxenstopp.sachen.offen.v1');
check(JSON.parse(nachTrennen['boxenstopp.sachen.umzug.v1'] || 'null')?.dinge?.['sd-uhr000001']?.name === 'Testuhr', 'boxenstopp.sachen.umzug.v1 bleibt (die Testuhr wartet weiter auf den Umzug)');
check(nachTrennen['boxenstopp.liste.github.v1'] === null && nachTrennen['boxenstopp.offen.v1'] === null, 'wie bisher: auch Zwischenstand und Offenes der Liste sind weg');
check(offen79.fehler.length === 0, `Gerät mit der Löschung von vorher: keine Fehler im Browser (${offen79.fehler.join(' | ')})`);
await offen79.ctx.close();

// --- 5 und 9. Amys Gerät: sachen.json geht erst nicht – liste.json bleibt, der Hinweis wartet; dann der Umzug und der Hinweis einmal
const ghB = attrappeMit(LISTE0);
const { kaputt, attrappe: kaputtB } = mitKaputtemSachen(ghB);
const amy = await handy(browser, { attrappe: kaputtB, hinweise: true });
await kiSperren(amy);
const a = amy.page;
await verbunden(amy, { token: SCHLUESSEL, name: 'Amy' }, SCHNELL);
check(await bis(() => kaputt.puts >= 3, 12000), `sachen.json antwortet 500: mehrere Versuche (${kaputt.puts})`);
const dauer = Date.now() - kaputt.erster;
check(kaputt.puts <= Math.floor(dauer / 1500) + 2, `mit demselben Stand höchstens alle 1,5 s (Test-Pause) ein Versuch (${kaputt.puts} in ${dauer} ms)`);
check(anzahl(ghB.liste().inventar) === '2/3' && !ghB.zustand.commits.some((c) => /^Umzug/.test(c.message)) && !ghB.datei('sachen.json'), `liste.json bleibt, wie sie ist (inventar drin, kein Umzug-Commit) (${ghB.zustand.nachrichten.join(' | ') || 'keine Commits'})`);
const fehlerB = await a.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.fehler.v1') || '[]'));
check(fehlerB.some((f) => f.wo === 'Umzug der Sachen'), 'der Fehler steht unter „Über die App“ (Umzug der Sachen)');
check(!(await hinweisOffen(a)) && (await a.evaluate(() => localStorage.getItem('boxenstopp.sachen.hinweis.v1'))) === null, 'solange die Sachen noch in liste.json stehen, wartet der Hinweis');
kaputt.an = false;
check(await bis(() => ghB.datei('sachen.json')?.rev === 1 && !hatInventar(ghB.liste()?.inventar), 10000), 'geht sachen.json wieder: umgezogen (sachen.json rev 1, liste.json leer)');
check(anzahl(ghB.datei('sachen.json').inventar) === '2/3' && commitsAn(ghB, 'liste.json').at(-1).message === UMZUG_NACHRICHT, 'alle 2 Listen und 3 Sachen drüben, liste.json mit „Umzug der Sachen nach sachen.json“');
check(await bis(() => hinweisOffen(a), 10000), 'Amy: danach kommt der Hinweis „Sachen ist jetzt eine eigene App“');
const hinweis = await a.locator('#sachen-hinweis-dlg').innerText();
check(hinweis.includes('Sachen ist jetzt eine eigene App') && hinweis.includes('Fotos und Strichcodes') && hinweis.includes('Sachen öffnen') && hinweis.includes('Später'), 'mit Titel, Text und den Knöpfen „Sachen öffnen“ und „Später“');
check((await a.evaluate(() => localStorage.getItem('boxenstopp.sachen.hinweis.v1'))) === 'true', 'gemerkt: gesehen');
await offnenNachbauen(a);
await a.click('#sachen-hinweis-dlg .btn-primary[data-act="sachen-app"]');
const aufH = await a.evaluate(() => window.geoeffnet);
check(aufH.length === 1 && aufH[0][0] === SACHEN_ADRESSE && aufH[0][1] === '_blank' && !(await hinweisOffen(a)), `„Sachen öffnen“ öffnet die Sachen-App und schließt den Hinweis (${JSON.stringify(aufH)})`);

// --- 8. Amys Bereich in der gemeinsamen Liste: kein Teil „Sachen“, der Knopf zur Sachen-App
await a.click('.tabbar .tab[data-tab="amy"]');
const teile = await a.locator('#view-amy .amy-teil').evaluateAll((xs) => xs.map((x) => x.dataset.amyTeil));
check(teile.length >= 3 && !teile.includes('sachen') && teile.includes('rezepte'), `im Schalter kein Teil „Sachen“ (${teile.join(', ')})`);
const knopf = a.locator('#view-amy .amy-kopf [data-act="sachen-app"]');
check(await knopf.isVisible() && (await knopf.innerText()).includes('Sachen ist jetzt eine eigene App – öffnen'), 'unter dem Schalter: „Sachen ist jetzt eine eigene App – öffnen“');
check((await a.locator('#view-amy .sachen-app .fine').innerText()).includes('App installieren'), 'mit dem Tipp (Android: „App installieren“)');
await offnenNachbauen(a);
await knopf.click();
const aufK = await a.evaluate(() => window.geoeffnet);
check(aufK.length === 1 && aufK[0][0] === SACHEN_ADRESSE && aufK[0][1] === '_blank' && aufK[0][2] === 'noopener', `der Knopf: window.open mit …/sachen/, ohne # (${JSON.stringify(aufK)})`);
// Neu laden mit dem gemerkten Teil „sachen“: die Rezepte – und der Hinweis kommt nicht noch einmal
await a.evaluate(() => localStorage.setItem('boxenstopp.amy.ansicht.v1', JSON.stringify({ art: 'liste', id: null, teil: 'sachen' })));
await a.reload();
await a.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await a.click('.tabbar .tab[data-tab="amy"]');
check(await bis(async () => (await a.locator('#view-amy .amy-teil[aria-selected="true"]').getAttribute('data-amy-teil')) === 'rezepte') && (await a.locator('#view-amy #inv').count()) === 0, 'ein gemerkter Teil „sachen“ zeigt die Rezepte, keine Sachen');
check(await bis(async () => (await status(a)) === 'Geteilt'), 'Amy: wieder abgeglichen');
await a.waitForTimeout(3600);
check(!(await hinweisOffen(a)), 'nach dem Neuladen kommt der Hinweis nicht wieder');
check(amy.fehler.length === 0, `Amy: keine Fehler im Browser (${amy.fehler.join(' | ')})`);
await amy.ctx.close();

// --- 8. Auf dem iPhone: der Link mit Zugang, Name und KI – geöffnet und in der Zwischenablage
const iphone = await handy(browser, { attrappe: ghB, userAgent: IPHONE, rechte: ['clipboard-read', 'clipboard-write'] });
await kiSperren(iphone);
const ip = iphone.page;
await verbunden(iphone, { token: SCHLUESSEL, name: 'Amy' }, { ...SCHNELL, 'boxenstopp.ki.v1': { schluessel: KI_TEST }, 'boxenstopp.tablet.v1': 'true' });
await offnenNachbauen(ip);
await ip.click('.tabbar .tab[data-tab="amy"]');
check((await ip.locator('#view-amy .sachen-app .fine').innerText()).includes('Zum Home-Bildschirm'), 'iPhone: der Tipp mit „Zum Home-Bildschirm“ und „Einfügen“');
await ip.click('#view-amy .amy-kopf [data-act="sachen-app"]');
const aufI = await ip.evaluate(() => window.geoeffnet);
const erwartet = `${SACHEN_ADRESSE}#zugang=${encodeURIComponent(SCHLUESSEL)}&fuer=Amy&ki=${encodeURIComponent(KI_TEST)}`;
const ablage = await bis(async () => { const x = await ip.evaluate(() => navigator.clipboard.readText()); return x === erwartet ? x : ''; }, 3000) || await ip.evaluate(() => navigator.clipboard.readText());
const ohnePat = (x) => String(x).replace(/github_pat_\w+/g, 'PAT').replace(/AQ\.\w+/g, 'KI');
check(aufI.length === 1 && aufI[0][0] === erwartet, `iPhone: window.open mit …/sachen/#zugang=…&fuer=Amy&ki=… (${ohnePat(JSON.stringify(aufI))})`);
check(ablage === erwartet, `derselbe Link in der Zwischenablage (${ohnePat(ablage)})`);
check(iphone.fehler.length === 0, `iPhone: keine Fehler im Browser (${iphone.fehler.join(' | ')})`);
await iphone.ctx.close();

// --- 6. Marielles eigene Liste: ihre Sachen bleiben in ihrer liste.json, keine sachen.json, ihr Teil „Sachen“ ist da
const MAR_INV = {
  listen: { 'sl-taschen01': { id: 'sl-taschen01', name: 'Taschen', bild: 'handbag', reihe: 1, at: T0, geaendert: T0, by: 'Marielle' } },
  dinge: {
    'sd-tasche001': { id: 'sd-tasche001', liste: 'sl-taschen01', name: 'Testtasche', marke: 'Erfunden', notiz: '', tags: [], code: '', foto: null, quelle: null, reihe: 1, at: T0, geaendert: T0, by: 'Marielle' },
    'sd-tasche002': { id: 'sd-tasche002', liste: 'sl-taschen01', name: 'Probebeutel', marke: '', notiz: '', tags: [], code: '', foto: null, quelle: null, reihe: 2, at: T0, geaendert: T0, by: 'Marielle' },
  },
};
const ghC = attrappeMit({ version: 1, rev: 3, items: {}, leute: { tobi: 'Tobi', amy: 'Amy' } }, { schluessel: M_KEY });
const ghM = attrappeMit({ version: 1, rev: 4, items: {}, profil: { person: 'Marielle', farbe: 'lila' }, leute: { marielle: 'Marielle' }, inventar: MAR_INV }, { schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
const marielle = await handy(browser, { attrappe: githubMehrere(ghC, ghM), hinweise: true });
await kiSperren(marielle);
const m = marielle.page;
await verbunden(marielle, { token: M_KEY, name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle' }, { ...SCHNELL, 'boxenstopp.willkommen.v1': 'true' });
check(await bis(async () => (await status(m)) === 'Gespeichert'), 'Marielle: an ihrer Liste');
// Eine Änderung, damit ihr Gerät schreibt
await m.click('[data-open="chili"]');
await m.click('#detail [data-act="alle-dazu"]');
check(await bis(() => ghM.liste()?.rev >= 5 && Object.keys(ghM.liste().items || {}).length > 0), `Marielle setzt das Chili auf die Liste (${ghM.zustand.nachrichten.join(' | ')})`);
check(anzahl(ghM.liste().inventar) === '1/2' && ghM.liste().inventar.dinge['sd-tasche001'].name === 'Testtasche', 'ihr inventar bleibt in ihrer liste.json');
// Eine ältere Fassung lässt inventar weg: bei ihr kommt es wie bisher wieder dazu
const marOhne = ghM.liste();
delete marOhne.inventar;
marOhne.rev += 1;
fremdSchreiben(ghM, marOhne, 'Marielle: Einkaufsliste, 1 Änderung');
check(await bis(() => anzahl(ghM.liste()?.inventar) === '1/2', 8000), 'lässt eine ältere Fassung inventar weg, schreibt ihr Gerät es wieder dazu (eigene Liste)');
await m.click('.tabbar .tab[data-tab="amy"]');
const mTeile = await m.locator('#view-amy .amy-teil').evaluateAll((xs) => xs.map((x) => x.dataset.amyTeil));
check(mTeile.includes('sachen') && (await m.locator('#view-amy [data-act="sachen-app"]').count()) === 0, `ihr Teil „Sachen“ ist da, kein Knopf zur Sachen-App (${mTeile.join(', ')})`);
await m.click('#view-amy .amy-teil[data-amy-teil="sachen"]');
check(await bis(async () => (await m.locator('#view-amy #inv').count()) > 0 && (await m.locator('#view-amy #inv').innerText()).includes('Taschen')), 'darin ihre Liste „Taschen“');
await m.waitForTimeout(3600);
check(!(await hinweisOffen(m)) && (await m.evaluate(() => localStorage.getItem('boxenstopp.sachen.hinweis.v1'))) === null, 'in Marielles Liste nie der Hinweis');
check(!ghM.datei('sachen.json') && !ghM.zustand.schreiben['sachen.json'] && !ghC.datei('sachen.json') && !ghC.zustand.schreiben['sachen.json'], 'keine sachen.json – weder in ihrem Repo noch in Boxenstopp-Daten');
check(!ghM.zustand.commits.some((c) => /^Umzug/.test(c.message)) && !ghC.zustand.commits.some((c) => /^Umzug/.test(c.message)), 'kein Umzug-Commit');
check(marielle.fehler.length === 0, `Marielle: keine Fehler im Browser (${marielle.fehler.join(' | ')})`);
await marielle.ctx.close();

// --- 7. Sachen nur auf dem Gerät, dann Verbinden mit der gemeinsamen Liste: nach sachen.json, nie in liste.json
const LOKAL_INV = {
  listen: { 'sl-schmuck01': { id: 'sl-schmuck01', name: 'Schmuck', bild: 'ring', reihe: 1, at: T0, geaendert: T0, by: 'Amy' } },
  dinge: { 'sd-ring000001': { id: 'sd-ring000001', liste: 'sl-schmuck01', name: 'Testring', marke: '', notiz: '', tags: [], code: '', foto: null, quelle: null, reihe: 1, at: T0, geaendert: T0, by: 'Amy' } },
};
const ghD = attrappeMit({ version: 1, rev: 3, items: {}, leute: { tobi: 'Tobi' } });
const { kaputt: kaputtD, attrappe: kaputtDA } = mitKaputtemSachen(ghD);
const lokal = await handy(browser, { attrappe: kaputtDA });
await kiSperren(lokal);
const l = lokal.page;
await l.goto(APP_URL.replace(/index\.html$/, 'icon.svg'));
await l.evaluate(([inv, items, pause]) => {
  localStorage.setItem('boxenstopp.liste.lokal.v1', JSON.stringify({ version: 1, rev: 0, items, inventar: inv }));
  localStorage.setItem('__umzugPause', pause);
}, [LOKAL_INV, BANANEN, SCHNELL.__umzugPause]);
await l.goto(`${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}&fuer=Amy`);
await l.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await l.locator('#toast').innerText()).includes('noch nicht in der Sachen-App'), 12000), 'geht sachen.json beim Verbinden nicht: eine Meldung');
check(await l.evaluate(() => !!JSON.parse(localStorage.getItem('boxenstopp.sachen.umzug.v1') || 'null')?.dinge?.['sd-ring000001']), 'die Sachen bleiben bis dahin auf dem Gerät gemerkt');
check(await bis(() => ghD.liste()?.items?.['c-bananen01']), 'die Bananen kommen in liste.json');
kaputtD.an = false;
check(await bis(() => ghD.datei('sachen.json')?.inventar?.dinge?.['sd-ring000001']?.name === 'Testring', 10000), 'danach: der Testring steht in sachen.json');
const sD = commitsAn(ghD, 'sachen.json');
check(sD.length === 1 && sD[0].message === 'Umzug: Sachen aus der Liste – 1 Liste, 1 Sache' && sD[0].stand.rev === 1, `ein Commit an sachen.json (${sD.map((c) => c.message).join(' | ')})`);
check(await bis(() => l.evaluate(() => localStorage.getItem('boxenstopp.sachen.umzug.v1') === null)), 'auf dem Gerät danach vergessen');
const lD = commitsAn(ghD, 'liste.json');
check(lD.length >= 2 && !lD.some((c) => hatInventar(c.stand?.inventar)) && !lD.some((c) => c.message === UMZUG_NACHRICHT), `liste.json bekam die Sachen nie, in keiner Fassung (${lD.map((c) => c.message).join(' | ')})`);
check(lokal.fehler.length === 0, `lokales Gerät: keine Fehler im Browser (${lokal.fehler.join(' | ')})`);
await lokal.ctx.close();

// --- 7b. Ist sachen.json voll (MAX_DINGE), bleibt, was nicht hineinpasst, auf dem Gerät gemerkt – bis Platz ist
const VOLL = { listen: { 'sl-vollvoll1': { id: 'sl-vollvoll1', name: 'Viel', bild: 'package', reihe: 1, at: T0, geaendert: T0, by: 'Amy' } }, dinge: {} };
for (let i = 1; i <= MAX_DINGE; i++) {
  const id = `sd-voll${String(i).padStart(4, '0')}`;
  VOLL.dinge[id] = { id, liste: 'sl-vollvoll1', name: `Testsache ${i}`, marke: '', notiz: '', tags: [], code: '', foto: null, quelle: null, reihe: i, at: T0, geaendert: T0, by: 'Amy' };
}
const ghE = attrappeMit({ version: 1, rev: 3, items: {}, leute: { tobi: 'Tobi' } });
sachenSchreiben(ghE, { ...leerSachen(), rev: 4, inventar: VOLL });
const voll = await handy(browser, { attrappe: ghE });
await kiSperren(voll);
const v = voll.page;
await v.goto(APP_URL.replace(/index\.html$/, 'icon.svg'));
await v.evaluate(([inv, pause]) => {
  localStorage.setItem('boxenstopp.liste.lokal.v1', JSON.stringify({ version: 1, rev: 0, items: {}, inventar: inv }));
  localStorage.setItem('__umzugPause', pause);
}, [LOKAL_INV, SCHNELL.__umzugPause]);
await v.goto(`${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}&fuer=Amy`);
await v.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
const restVon = () => v.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.sachen.umzug.v1') || 'null'));
check(await bis(() => ghE.datei('sachen.json')?.inventar?.listen?.['sl-schmuck01'], 10000) && commitsAn(ghE, 'sachen.json').at(-1).message === 'Umzug: Sachen aus der Liste – 1 Liste, 0 Sachen', 'sachen.json voll: die Liste „Schmuck“ zieht um, der Testring passt nicht mehr');
check(await bis(async () => { const r = await restVon(); return !!r?.dinge?.['sd-ring000001'] && !r.listen?.['sl-schmuck01']; }, 4000), `der Testring bleibt auf dem Gerät gemerkt (nur er) (${JSON.stringify(await restVon())})`);
check(Object.keys(ghE.datei('sachen.json').inventar.dinge).length === MAX_DINGE && !hatInventar(ghE.liste()?.inventar), 'sachen.json bleibt bei MAX_DINGE, liste.json bekommt nichts');
// Die Sachen-App löscht eine Sache – jetzt ist Platz
const sE = ghE.datei('sachen.json');
sachenSchreiben(ghE, { ...sachenAnwenden(sE, opDingWeg('sd-voll0001', T3)), rev: sE.rev + 1 });
check(await bis(() => ghE.datei('sachen.json')?.inventar?.dinge?.['sd-ring000001']?.name === 'Testring', 10000), 'ist wieder Platz: der Testring kommt nach (nach der Pause)');
check(await bis(async () => (await restVon()) === null), 'danach auf dem Gerät vergessen');
check(!commitsAn(ghE, 'liste.json').some((c) => hatInventar(c.stand?.inventar)), 'liste.json bekam die Sachen nie');
check(voll.fehler.length === 0, `volles sachen.json: keine Fehler im Browser (${voll.fehler.join(' | ')})`);
await voll.ctx.close();

// --- 7c. Die Sachen-App hat auf Android verbunden (derselbe Speicher wie Boxenstopp): Der Zugang ist da, die lokale Liste aber
// noch voll – Einträge und Sachen. Boxenstopp übernimmt sie beim Start wie beim Verbinden
const ghK = attrappeMit({ version: 1, rev: 3, items: {}, leute: { tobi: 'Tobi' } });
const android = await handy(browser, { attrappe: ghK });
await kiSperren(android);
const an = android.page;
await an.goto(APP_URL.replace(/index\.html$/, 'icon.svg'));
await an.evaluate(([zugang, lokalListe, pause]) => {
  localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify(zugang));
  localStorage.setItem('boxenstopp.liste.lokal.v1', JSON.stringify(lokalListe));
  localStorage.setItem('__umzugPause', pause);
}, [{ token: SCHLUESSEL, name: 'Amy' }, { version: 1, rev: 0, items: BANANEN, inventar: LOKAL_INV }, SCHNELL.__umzugPause]);
await an.goto(APP_URL);
await an.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(() => ghK.liste()?.items?.['c-bananen01']?.name === 'Bananen', 10000), 'Android: die Einträge der lokalen Liste (Bananen) sind in liste.json');
check(await bis(() => ghK.datei('sachen.json')?.inventar?.dinge?.['sd-ring000001']?.name === 'Testring', 10000) && !!ghK.datei('sachen.json').inventar.listen['sl-schmuck01'], 'ihre Sachen (Schmuck, Testring) sind in sachen.json');
check(commitsAn(ghK, 'sachen.json').map((c) => c.message).join(' | ') === 'Umzug: Sachen aus der Liste – 1 Liste, 1 Sache', `ein Commit an sachen.json (${commitsAn(ghK, 'sachen.json').map((c) => c.message).join(' | ')})`);
check(await bis(() => an.evaluate(() => { const l = JSON.parse(localStorage.getItem('boxenstopp.liste.lokal.v1') || 'null'); return !l || (!Object.keys(l.items || {}).length && !Object.keys(l.inventar?.dinge || {}).length && !Object.keys(l.inventar?.listen || {}).length); })), 'die lokale Liste ist danach leer');
check(await bis(() => an.evaluate(() => localStorage.getItem('boxenstopp.sachen.umzug.v1') === null)), 'auf dem Gerät nichts mehr für den Umzug vorgemerkt');
await an.waitForTimeout(1500);
const lK = commitsAn(ghK, 'liste.json');
check(!lK.some((c) => hatInventar(c.stand?.inventar)) && !lK.some((c) => c.message === UMZUG_NACHRICHT), `liste.json bekam die Sachen nie, in keiner Fassung (${lK.map((c) => c.message).join(' | ')})`);
// Noch einmal starten: nichts kommt doppelt
const lKAnzahl = lK.length;
await an.reload();
await an.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await an.waitForTimeout(2000);
check(commitsAn(ghK, 'liste.json').length === lKAnzahl && commitsAn(ghK, 'sachen.json').length === 1 && Object.keys(ghK.liste().items).length === 1, 'neu gestartet: kein weiterer Commit, die Bananen einmal');
check(android.fehler.length === 0, `Android: keine Fehler im Browser (${android.fehler.join(' | ')})`);
await android.ctx.close();

check(kiAnfragen === 0, `keine Anfrage an einen KI-Anbieter (${kiAnfragen})`);
await browser.close();
ende();
