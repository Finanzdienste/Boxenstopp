/*
 * Timer und Tempo ohne Browser: js/zeiten.js (welcher Schritt einen Timer
 * braucht) und js/tempo.js (wie lange ihr wirklich braucht) direkt in Node.
 *
 * Das Tempo lernt aus den Haken: Hier wird ein Kochabend nachgespielt, mit
 * einer Uhr, die der Test vorstellt.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT } from './hilfe.mjs';
import { timerPlan, timerDauer, hatGarzeit, zeitVon } from '../js/zeiten.js';
import { tempoHaken, tempoZurueck, tempoGelernt, tempoZeit, tempoLoeschen, tempoWiederherstellen, probenAus, gesamtAus, gruppe, schrittHash } from '../js/tempo.js';

const { check, ende } = pruefer();
const plan = (d, ruhe) => timerPlan({ d, ruhe });
const dauerVon = (d, ruhe) => timerDauer(plan(d, ruhe));

// --- Welche Schritte einen Timer brauchen
check(dauerVon('Halb zugedeckt 15 Min. köcheln') === '15 Min.', 'köcheln: 15 Min.');
check(dauerVon('Schale 1 darin 8–10 Min. goldbraun braten') === '8 Min.', 'bei 8–10 Min. die kürzere Zeit – dann nachsehen');
check(dauerVon('Offen abkühlen lassen, höchstens 1–2 Std., dann Deckel drauf') === '1 Std.', 'Stunden: 1–2 Std. → 1 Std.');
check(plan('Schale 3 dazu und 2 Min. mitbraten') === null, 'unter 3 Minuten: kein Timer');
check(plan('2 große Zwiebeln schälen und fein würfeln') === null, 'Arbeit ohne Garzeit: kein Timer');
check(plan('Ofen auf 200 °C Umluft vorheizen', 12) === null && plan('Den großen Topf mit Salzwasser aufsetzen', 12) === null, 'Ofen vorheizen und Wasser aufsetzen: kein Timer, das merkt man selbst');
check(dauerVon('Schale 1 abgedeckt kalt stellen, mind. 30 Min.', 30) === '30 Min.', 'marinieren: 30 Min.');
check(dauerVon('Schale 2 ins kochende Wasser, Timer auf 2 Min. weniger als auf der Packung', 9) === '9 Min.', '„2 Min. weniger als auf der Packung“ ist keine Zeit – es gilt die Wartezeit');
check(dauerVon('Timer auf 1 Min. weniger als auf der Packung (meist 8 Min.)') === '7 Min.', '„1 Min. weniger … (meist 8 Min.)“ → 7 Min.');
check(plan('Blech herausnehmen, sobald die 10–12 Min. um sind, Ofen aus') === null, 'Verweis auf einen anderen Timer: kein eigener');
check(plan('4 Min. bevor der Timer klingelt: Schale 3 zu den Nudeln') === null, '„4 Min. bevor der Timer klingelt“: kein eigener');
check(dauerVon('Zugedeckt 90 Min. bei kleiner Hitze schmoren, alle 20 Min. umrühren') === '1 Std. 30 Min.', '„alle 20 Min. umrühren“ ändert die 90 Min. nicht');
const reis = plan('Reistopf aufkochen, dann zugedeckt 12 Min. auf kleinster Hitze garen und 10 Min. ruhen lassen', 22);
check(timerDauer(reis) === '12 + 10 Min.' && reis.stufen[0].dann === '10 Min. ruhen lassen' && reis.min === 22, `zwei Stufen: 12 Min. garen, dann „10 Min. ruhen lassen“ (${JSON.stringify(reis?.stufen)})`);
const biryani = plan('Deckel fest drauf, 20 Min. auf kleinster Hitze dämpfen, dann Herd aus und 10 Min. ziehen lassen', 30);
check(biryani.stufen[0].dann === 'Herd aus und 10 Min. ziehen lassen', `„dann Herd aus und …“ wird zum Hinweis nach Stufe 1 (${biryani.stufen[0].dann})`);
const wenden = plan('Schale 1 auf beide Bleche verteilen, 35 Min. backen, nach 20 Min. wenden, bis sie goldbraun sind');
check(timerDauer(wenden) === '20 + 15 Min.' && wenden.stufen[0].dann === 'wenden', '„35 Min. backen, nach 20 Min. wenden“ → 20, wenden, 15');
const seite = plan('8 Frikadellen darin je Seite 5 Min. braten');
check(timerDauer(seite) === '5 + 5 Min.' && seite.stufen[0].dann === 'umdrehen', '„je Seite 5 Min.“ → 5, umdrehen, 5');
check(timerDauer(plan('1 Min. rösten, dann zugedeckt 10 Min. köcheln')) === '10 Min.', 'kurze erste Zeit zählt man im Kopf – Timer nur für die 10 Min.');
check(dauerVon('Kartoffeln 25 Minuten kochen') === '25 Min.' && dauerVon('ca. 10-15 min köcheln') === '10 Min.' && dauerVon('Alles 1,5 Std. schmoren') === '1 Std. 30 Min.', 'so, wie man es selbst schreibt: „25 Minuten“, „10-15 min“, „1,5 Std.“');
check(hatGarzeit({ d: 'Halb zugedeckt 15 Min. köcheln', min: 15 }) && hatGarzeit({ d: 'Schale 3 dazu und 2 Min. mitbraten', min: 2 }) && !hatGarzeit({ d: 'Zwiebeln würfeln', min: 9 }) && !hatGarzeit({ d: 'Abgedeckt kalt stellen, mind. 30 Min.', min: 7, ruhe: 30 }), 'Garzeit: köcheln und mitbraten ja, würfeln nein, marinieren ist Arbeit plus Warten');

// Alle festen Rezepte: höchstens 8 Timer je Rezept, keiner unter 3 Min.
const { rezepte } = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const je = rezepte.map((r) => r.ablauf.flatMap((p) => p.schritte).map((s) => timerPlan(s)).filter(Boolean));
const alleSchritte = rezepte.reduce((n, r) => n + r.ablauf.reduce((m, p) => m + p.schritte.length, 0), 0);
const anzahl = je.reduce((n, x) => n + x.length, 0);
check(je.every((x) => x.length >= 2 && x.length <= 8) && je.flat().every((p) => p.stufen[0].min >= 3), `Timer nur, wo man einen braucht: ${anzahl} von ${alleSchritte} Schritten, 2–8 je Rezept`);

// --- Tempo: ein Kochabend, 1,5× so langsam wie Standard
const R = {
  id: 'test-curry',
  ablauf: [
    { t: 'Vorbereiten', schritte: [
      { d: 'Zwiebeln schälen und würfeln', min: 6 },
      { d: 'Knoblauch hacken', min: 4 },
      { d: 'Paprika in Streifen schneiden', min: 6 },
      { d: 'Ofen auf 200 °C vorheizen', min: 1, ruhe: 12 },
      { d: 'Hähnchen würfeln', min: 8 },
      { d: 'Gewürze abmessen', min: 4 },
    ] },
    { t: 'Kochen', schritte: [
      { d: 'Zwiebeln 5 Min. anbraten', min: 5 },
      { d: 'Reis aufsetzen', min: 2, neben: true },
      { d: 'Halb zugedeckt 15 Min. köcheln', min: 15 },
      { d: 'Mit Salz abschmecken', min: 2 },
    ] },
    { t: 'Portionieren', schritte: [
      { d: 'Reis auf die Boxen verteilen', min: 4 },
      { d: '8 Boxen befüllen', min: 8 },
    ] },
  ],
};
const std = zeitVon(R);
let uhr = Date.UTC(2026, 9, 20, 16, 0, 0);
const flach = R.ablauf.flatMap((p) => p.schritte);
// Beim Kochen: jeden Schritt am Ende abhaken; Arbeit dauert 1,5×, Garzeiten bleiben
flach.forEach((s, i) => {
  uhr += (hatGarzeit(s) ? s.min : s.min * 1.5) * 60000;
  tempoHaken(R, i, true, uhr);
});
const g = tempoGelernt();
check(g.faktor.vor === 1.5, `Vorbereiten: 1,5× so lange gelernt (${g.faktor.vor})`);
check(g.faktor.alle === 1.5 && g.faktor.port === undefined && tempoZeit(R).schritte[11].art === 'gemessen', `insgesamt 1,5×; fürs Portionieren reicht ein Abend noch nicht für einen eigenen Faktor (${g.faktor.alle}, ${g.faktor.port})`);
check(g.proben === 6, `sauber gemessen: 6 Schritte – Garzeiten, „währenddessen“ und was nach Wartezeit kommt, nicht (${g.proben})`);
const z = tempoZeit(R);
const gemessen = Math.round((uhr - Date.UTC(2026, 9, 20, 16, 0, 0)) / 60000);
check(z.quelle === 'gemessen' && z.letztes.min === gemessen && z.gesamt === Math.round(gemessen / 5) * 5, `einmal ganz durch: Das Rezept dauert jetzt ${z.gesamt} Min. statt ${std.gesamt} (gemessen ${gemessen})`);
check(z.phasen.reduce((a, b) => a + b, 0) === z.gesamt, `die Abschnitte passen zur Gesamtzeit (${z.phasen.join(' + ')})`);
check(z.schritte[1].art === 'gemessen' && z.schritte[1].min === 6 && z.schritte[8].art === '' && z.schritte[8].min === 15, `Knoblauch: gemessen 6 statt 4 Min.; 15 Min. köcheln bleibt (${z.schritte[1].min}, ${z.schritte[8].min})`);
// Ein anderes Rezept, nie gekocht: bekommt das Tempo über den Faktor
const R2 = { id: 'test-chili', ablauf: [{ t: 'Vorbereiten', schritte: [{ d: 'Zwiebeln würfeln', min: 10 }, { d: 'Möhren schälen', min: 6 }] }, { t: 'Kochen', schritte: [{ d: '30 Min. köcheln', min: 30 }] }] };
const z2 = tempoZeit(R2);
check(z2.quelle === 'tempo' && z2.schritte[0].min === 15 && z2.schritte[0].art === 'tempo' && z2.schritte[2].min === 30, `neues Rezept: Arbeit 1,5×, Garzeit nicht (${z2.schritte.map((x) => x.min).join(', ')})`);
check(z2.gesamt === 55 && zeitVon(R2).gesamt === 45, `… 55 statt 45 Min. (${z2.gesamt})`);

// Bündel: drei Haken innerhalb von 20 s zählen zusammen und nur für den Faktor
const lauf = { start: 0, n: 5, std: 30, h: [[0, 0, 4, 0, 0, 'a', 'vor'], [1, 300, 4, 0, 0, 'b', 'vor'], [2, 900, 4, 0, 0, 'c', 'vor'], [3, 905, 4, 0, 0, 'd', 'vor'], [4, 912, 4, 0, 0, 'e', 'vor']] };
const p = probenAus(lauf, 'x');
check(p.length === 2 && p[0][0] === 'x:b' && p[0][3] === 5 && p[1][0] === '' && p[1][2] === 12 && p[1][3] === 10.2, `Einzelschritt mit Schlüssel, Bündel ohne (${JSON.stringify(p)})`);
// Ausreißer: eine lange Pause misst nichts, und das ganze Rezept zählt nicht
const pause = { start: 0, n: 3, std: 20, h: [[0, 0, 5, 0, 0, 'a', 'vor'], [1, 300, 5, 0, 0, 'b', 'vor'], [2, 300 + 7200, 5, 0, 0, 'c', 'vor']] };
check(probenAus(pause, 'y').length === 1 && gesamtAus(pause) === null, 'zwei Stunden Pause: kein Messwert, keine Gesamtzeit');
check(gesamtAus({ start: 0, n: 10, std: 60, h: [[0, 0, 5, 0, 0, 'a', 'vor'], [1, 600, 5, 0, 0, 'b', 'vor']] }) === null, 'nur 2 von 10 Schritten: keine Gesamtzeit');
check(gruppe('Vorbereiten') === 'vor' && gruppe('Kochen') === 'koch' && gruppe('Portionieren') === 'port' && gruppe('Zubereitung') === 'koch' && gruppe('Soße') === 'sonst', 'Abschnitte erkannt, auch eigene Namen');

// Wieder geöffnet: der Haken zählt nicht; zurückgesetzt: der Lauf ist zu
const R3 = { id: 'test-bowl', ablauf: [{ t: 'Vorbereiten', schritte: [{ d: 'A', min: 5 }, { d: 'B', min: 5 }, { d: 'C', min: 5 }] }] };
let t3 = Date.UTC(2026, 9, 21, 12);
tempoHaken(R3, 0, true, t3);
tempoHaken(R3, 1, true, t3 += 5 * 60000);
tempoHaken(R3, 1, false, t3 += 1000);
tempoHaken(R3, 1, true, t3 += 3 * 60000);
tempoZurueck('test-bowl');
const g3 = tempoGelernt();
check(JSON.stringify(g3.schritt.get(`test-bowl:${schrittHash({ d: 'B' })}`)) === '[8]' && g3.proben === 7, `wieder geöffnet und neu abgehakt: zählt einmal, mit der neuen Zeit (${JSON.stringify(g3.schritt.get(`test-bowl:${schrittHash({ d: 'B' })}`))}, ${g3.proben} Messwerte)`);
check(!g3.gesamt['test-bowl'], 'zurückgesetzt nach 2 von 3 Schritten: keine Gesamtzeit');

// Vergessen und Rückgängig
const alt = tempoLoeschen();
check(tempoZeit(R).quelle === 'standard' && tempoZeit(R).gesamt === std.gesamt, 'Tempo vergessen: wieder die Standardzeit');
tempoWiederherstellen(alt);
check(tempoZeit(R).quelle === 'gemessen', 'Rückgängig: das Gelernte ist wieder da');

ende();
