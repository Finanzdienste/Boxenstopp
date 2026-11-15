/*
 * Gäste mit eigener Liste und der Überblick des Gastgebers: der Rechenteil
 * (js/gaeste.js, direkt in Node) und im Browser die ganze Geschichte –
 * Tobi lädt Marielle ein (falscher Schlüssel, Schlüssel für zu viel, dann
 * richtig), Marielle öffnet den Link (gleich verbunden, lila, Willkommen,
 * ihre Makros), ihre Liste bleibt ihre, Tobi sieht im Dashboard, wer was
 * gemacht hat und was in ihrer Liste steht (Sachen mit Foto, Einkaufsliste,
 * Essensplan, Rezepte, Notiztitel) – und Amys Bereich. Amys Sachen sind seit
 * v83 eine eigene App mit eigener Datei (sachen.json neben liste.json): Das
 * Dashboard liest die Commits beider Dateien als eine Liste, die Einzelheiten
 * aus der Datei des Commits, den Umzug als Automatik (einmal – sein Commit an
 * liste.json hat kein „Name:“) und Amys Sachen aus sachen.json samt dem, was
 * noch in liste.json steht; liefert GitHub kurz eine ältere Fassung von
 * sachen.json (oder 404), verschwindet nichts. Wem das Dashboard
 * etwas zeigt, erfährt es einmal (Amy danach auch, dass Sachen eine eigene
 * App ist). Und: Marielles zweites Gerät über das Schlüsselfeld.
 */
import { readFileSync } from 'node:fs';
import { pruefer, handy, githubAttrappe, githubMehrere, starteBrowser, bis, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { nachrichtLesen, bereichVon, zusammenfassen, verlaufMischen, repoVorschlag, gaesteBereinigen, gaesteFuerLink, gaesteAusLink, BEREICHE } from '../js/gaeste.js';
import { leer, anwenden, bereinigen, opPerson, opZusammen, opEinePerson, opTeil, opEigener, opHaken, opAmy, opAmyTags, beschreibung } from '../js/liste.js';
import { inhaltVon } from '../js/dashboard.js';
import { opInvListe, opDing } from '../js/inventar.js';
import { opBlatt } from '../js/notizbuch.js';
import { opEssensplan } from '../js/essensplan.js';
import { opWunsch, opWunschErledigt } from '../js/wuensche.js';
import { opVertraeglich } from '../js/vertraeglich.js';
import { leerSachen, sachenAnwenden, sachenBereinigen, sachenNachricht } from '../js/sachen.js';

const { check, ende } = pruefer();
const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const ALLES_KEY = 'github_pat_11ALLESALLES00000000000_abcdefghijklmnopqrstuvwxyz';
const GKEY = 'AQ.Ab8RN6TESTTESTTESTTESTTESTTESTTEST';
/** So heißt der Commit des Umzugs an liste.json (speicher.js UMZUG_NACHRICHT) – ohne „Name:“. */
const UMZUG_LISTE = 'Umzug der Sachen nach sachen.json';

/* ----------------------------------------------------------- Rechnung */

check(JSON.stringify(nachrichtLesen('Amy: Einkaufsliste, 3 Änderungen – Chili auf die Liste; 2 abgehakt · Bescheid')) === JSON.stringify({ wer: 'Amy', auto: false, anzahl: 3, was: ['Chili auf die Liste', '2 abgehakt'] }), 'Nachricht lesen: wer, wie viel, was – ohne „· Bescheid“');
check(nachrichtLesen('Tobi: Einkaufsliste, 1 Änderung').was.length === 0 && nachrichtLesen('Tobi: Einkaufsliste, 1 Änderung').anzahl === 1, 'Ältere Nachricht ohne „was“');
check(nachrichtLesen('Push: gesendet').auto && nachrichtLesen('Haushalt: erinnert und abgeglichen').auto && nachrichtLesen('Angebote (privat): Rewe 73').auto, 'Die Abläufe im Daten-Repo zählen als automatisch');
check(nachrichtLesen('liste.json geändert').wer === '' && nachrichtLesen('Tobi: Einladung für Marielle').was[0] === 'Einladung für Marielle', 'Von Hand ohne Namen: niemand; die Einladung');
check(bereichVon('Chili auf die Liste') === 'Einkauf' && bereichVon('Chili gekocht') === 'Kochen' && bereichVon('Rezept „Kokos-Curry“') === 'Rezepte' && bereichVon('Putzplan abgehakt') === 'Haushalt' && bereichVon('Ziel pro Box geändert') === 'Ziel', 'Bereiche');
check(bereichVon('Sachen') === 'Sachen' && bereichVon('Sachen; 2 abgehakt') === 'Sachen' && BEREICHE.join() === 'Einkauf,Kochen,Rezepte,Sachen,Haushalt,Ziel,Sonstiges', 'Bereich „Sachen“ – nach Rezepte');
// Amys Sachen-App schreibt sachen.json: „Amy: Sachen, 2 Änderungen“ – mit der Zahl, nie was es ist; der Umzug ist ein Ablauf
check(JSON.stringify(nachrichtLesen('Amy: Sachen, 2 Änderungen')) === JSON.stringify({ wer: 'Amy', auto: false, anzahl: 2, was: ['Sachen'] }) && bereichVon(nachrichtLesen('Amy: Sachen, 1 Änderung').was[0]) === 'Sachen', 'Nachricht der Sachen-App: Amy, 2 Änderungen, im Bereich Sachen');
check(nachrichtLesen('Umzug: Sachen aus der Liste – 1 Liste, 3 Sachen').auto && nachrichtLesen('Umzug: Sachen – 1 Löschung von vorher').auto, 'Der Umzug der Sachen (Commits an sachen.json) zählt als automatisch');
// Der Commit an liste.json hat kein „Name:“ – niemand, kein Ablauf: Jedes Dashboard übergeht ihn (auch das von v82)
check(JSON.stringify(nachrichtLesen(UMZUG_LISTE)) === JSON.stringify({ wer: '', auto: false, anzahl: 1, was: [] }), `Der Umzug-Commit an liste.json: niemandes (${JSON.stringify(nachrichtLesen(UMZUG_LISTE))})`);
check(repoVorschlag('Marielle') === 'Boxenstopp-Marielle' && repoVorschlag('Jörg Müller') === 'Boxenstopp-Joerg-Mueller' && repoVorschlag('') === '', 'Repo-Vorschlag aus dem Namen');
check(gaesteBereinigen([{ name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY, farbe: 'lila' }, { name: 'X', daten: 'kaputt', token: M_KEY }, { name: 'Doppelt', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY }]).length === 1, 'Gäste bereinigen: kaputte und doppelte fallen weg');
// Aufs neue Handy: die Gäste in den Link und zurück
const umzugGaeste = [
  { name: 'Jörg', daten: 'Finanzdienste/Boxenstopp-Joerg', token: M_KEY, farbe: '', at: '2026-11-01T10:00:00.000Z', ki: true },
  { name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY, farbe: 'lila', at: '', ki: false },
];
const umzugTeil = gaesteFuerLink(umzugGaeste);
check(/^[A-Za-z0-9_-]+$/.test(umzugTeil) && JSON.stringify(gaesteAusLink(`https://finanzdienste.github.io/Boxenstopp/#gaeste=${umzugTeil}`)) === JSON.stringify(umzugGaeste) && JSON.stringify(gaesteAusLink(` ${umzugTeil} `)) === JSON.stringify(umzugGaeste), 'Umzug: Gäste in den Link und zurück – ganzer Link oder nur der Teil, mit Umlaut');
check(gaesteAusLink(`#gaeste=${umzugTeil}`, 'Finanzdienste/Boxenstopp-Marielle').map((g) => g.name).join() === 'Jörg', 'Umzug: eure eigene Liste kommt nie als Gast');
check(gaesteAusLink('#gaeste=kaputt').length === 0 && gaesteAusLink('').length === 0 && gaesteAusLink('#zugang=github_pat_abc').length === 0 && gaesteAusLink(`#gaeste=${btoa('[{"name":"X"}]')}`).length === 0, 'Umzug: Kaputtes und Fremdes ergibt keine Gäste');

const jetzt = new Date('2026-11-05T19:00:00');
const um = (tag, uhr) => new Date(`2026-11-${tag}T${uhr}:00`).toISOString();
const listen = [
  { id: 'haupt', name: 'Eure Liste', eintraege: [
    { sha: 'a5', at: um('05', '18:58'), nachricht: 'Amy: Einkaufsliste, 1 Änderung – 1 abgehakt' },
    { sha: 'a4', at: um('05', '18:48'), nachricht: 'Amy: Einkaufsliste, 2 Änderungen – 2 abgehakt' },
    { sha: 'a3', at: um('05', '13:12'), nachricht: 'Amy: Einkaufsliste, 1 Änderung · Bescheid' },
    { sha: 'p1', at: um('05', '12:12'), nachricht: 'Push: gesendet' },
    { sha: 'a2', at: um('03', '20:00'), nachricht: 'Tobi: Einkaufsliste, 4 Änderungen – Chili auf die Liste · Bescheid' },
    { sha: 'alt', at: um('01', '20:00'), nachricht: 'Tobi: Einkaufsliste, 1 Änderung' },
  ] },
  { id: 'Finanzdienste/Boxenstopp-Marielle', name: 'Marielle', farbe: 'lila', eintraege: [
    { sha: 'm2', at: um('05', '17:30'), nachricht: 'Marielle: Einkaufsliste, 1 Änderung – Ziel pro Box geändert' },
    { sha: 'm1', at: um('05', '17:00'), nachricht: 'Tobi: Einladung für Marielle' },
  ] },
];
const z = zusammenfassen(listen, { tage: 7, jetzt });
const amy = z.personen.find((p) => p.name === 'Amy');
check(z.tage.length === 7 && z.tage.at(-1) === '2026-11-05', 'Sieben Tage, heute zuletzt');
check(amy && amy.anzahl === 4 && amy.jeTag.at(-1) === 4 && amy.bereiche.Einkauf === 2 && amy.zuletzt === um('05', '18:58'), 'Amy: 4 Änderungen heute, zweimal Einkauf, zuletzt 18:58');
check(!z.personen.some((p) => p.name === 'Push') && z.automatik.haupt?.Push === 1, 'Push zählt nicht als Person, steht unter automatisch');
check(!z.personen.some((p) => p.name === 'Tobi' && p.liste !== 'haupt'), 'Die Einladung zählt nicht als Tobis Arbeit in Marielles Liste');
check(z.personen.find((p) => p.name === 'Tobi')?.anzahl === 5, 'Tobi: 4 + 1 – auch Ältere ohne „was“ zählen mit');
const heute = z.verlauf[0];
check(heute.tag === '2026-11-05' && heute.sitzungen[0].wer === 'Amy' && heute.sitzungen[0].von === um('05', '18:48') && heute.sitzungen[0].anzahl === 3, 'Verlauf: Amys zwei Commits um 18:48 und 18:58 sind eine Sitzung mit 3 Änderungen');
check(heute.sitzungen.some((s) => s.wer === 'Tobi' && s.was[0] === 'Einladung für Marielle'), 'Verlauf: die Einladung steht drin');
// Eure Liste sind zwei Dateien: die Commits an sachen.json (Sachen-App, Umzug) gemischt mit denen an liste.json
const zweiDateien = zusammenfassen([{ id: 'haupt', name: 'Eure Liste', gast: '', eintraege: [
  { sha: 's2', at: um('05', '18:30'), nachricht: 'Amy: Sachen, 2 Änderungen' },
  { sha: 'k2', at: um('05', '18:20'), nachricht: 'Amy: Einkaufsliste, 1 Änderung – Äpfel auf die Liste' },
  { sha: 'k1', at: um('05', '12:00'), nachricht: UMZUG_LISTE },
  { sha: 's1', at: um('05', '11:59'), nachricht: 'Umzug: Sachen aus der Liste – 1 Liste, 3 Sachen' },
] }], { tage: 7, jetzt });
const amyS = zweiDateien.personen.find((p) => p.name === 'Amy');
check(zweiDateien.personen.length === 1 && amyS?.anzahl === 3 && amyS.bereiche.Sachen === 1 && amyS.bereiche.Einkauf === 1, `Sachen-App: Amy einmal, 1 + 2 Änderungen, Bereiche Einkauf und Sachen (${JSON.stringify(amyS)})`);
const sitzS = zweiDateien.verlauf[0]?.sitzungen || [];
check(sitzS.length === 1 && sitzS[0].was.join() === 'Äpfel auf die Liste,Sachen' && sitzS[0].anzahl === 3 && sitzS[0].shas.join() === 'k2,s2', `Sachen-App: eine Sitzung mit den Commits beider Dateien (${JSON.stringify(sitzS)})`);
check(JSON.stringify(zweiDateien.automatik) === JSON.stringify({ haupt: { Umzug: 1 } }), `Der Umzug (ein Commit an jeder Datei) zählt einmal – über den an sachen.json (${JSON.stringify(zweiDateien.automatik)})`);
check(!zweiDateien.verlauf.flatMap((t) => t.sitzungen).some((x) => x.shas.includes('k1') || x.shas.includes('s1')), 'Der Umzug steht bei niemandem im Verlauf');
const gemischt = verlaufMischen([{ sha: 'x', at: um('01', '10:00'), nachricht: 'alt' }], [{ sha: 'y', at: um('05', '10:00'), nachricht: 'neu' }, { sha: 'x', at: um('01', '10:00'), nachricht: 'alt' }, { sha: 'kaputt', at: 'gestern' }], { jetzt });
check(gemischt.length === 2 && gemischt[0].sha === 'y', 'Verlauf mischen: neu vorn, doppelt und kaputt fallen weg');

// Marielle auf einem zweiten Gerät, auf dem sie „Marielli“ eingetippt hat: im Überblick eine Person, einmal „zum ersten Mal dabei“
const zwei = zusammenfassen([
  { id: 'haupt', name: 'Eure Liste', gast: '', eintraege: [
    { sha: 'h2', at: um('05', '18:10'), nachricht: 'Amy: Einkaufsliste, 1 Änderung – zum ersten Mal dabei' },
    { sha: 'h1', at: um('05', '18:00'), nachricht: 'Tobi: Einkaufsliste, 1 Änderung – zum ersten Mal dabei' },
  ] },
  { id: 'Finanzdienste/Boxenstopp-Marielle', name: 'Marielle', farbe: 'lila', gast: 'Marielle', eintraege: [
    { sha: 'm5', at: um('05', '18:40'), nachricht: 'Marielli: Einkaufsliste, 1 Änderung – Chili auf die Liste' },
    { sha: 'm4', at: um('05', '18:20'), nachricht: 'Marielli: Einkaufsliste, 1 Änderung – zum ersten Mal dabei' },
    { sha: 'm3', at: um('05', '18:14'), nachricht: 'Marielle: Einkaufsliste, 1 Änderung – Ziel pro Box geändert' },
    { sha: 'm2', at: um('05', '18:13'), nachricht: 'Marielle: Einkaufsliste, 1 Änderung – zum ersten Mal dabei' },
    { sha: 'm1', at: um('05', '17:00'), nachricht: 'Tobi: Einladung für Marielle' },
  ] },
], { tage: 7, jetzt });
const inIhrer = zwei.personen.filter((p) => p.liste === 'Finanzdienste/Boxenstopp-Marielle');
check(inIhrer.length === 1 && inIhrer[0].name === 'Marielle' && inIhrer[0].anzahl === 4, 'Ihre Liste: eine Person „Marielle“ mit allen 4 Änderungen – auch denen als „Marielli“');
const ihreSitzungen = zwei.verlauf.flatMap((t) => t.sitzungen).filter((s) => s.liste === 'Finanzdienste/Boxenstopp-Marielle');
const ihrWas = ihreSitzungen.flatMap((s) => s.was);
check(!ihreSitzungen.some((s) => s.wer === 'Marielli') && ihrWas.filter((w) => w === 'zum ersten Mal dabei').length === 1 && ihrWas.includes('auf einem weiteren Gerät dabei'), 'Verlauf: einmal „zum ersten Mal dabei“, dann „auf einem weiteren Gerät dabei“ – kein „Marielli“');
check(ihreSitzungen.some((s) => s.wer === 'Tobi' && s.was[0] === 'Einladung für Marielle') && !zwei.personen.some((p) => p.name === 'Tobi' && p.liste !== 'haupt'), 'Die Einladung bleibt bei Tobi, zählt aber nicht als seine Arbeit dort');
check(zwei.personen.filter((p) => p.liste === 'haupt').map((p) => p.name).sort().join() === 'Amy,Tobi' && zwei.verlauf.flatMap((t) => t.sitzungen).filter((s) => s.liste === 'haupt').every((s) => s.was.includes('zum ersten Mal dabei')), 'Eure Liste: Amy und Tobi bleiben zwei, jeder einmal „zum ersten Mal dabei“');
// Und in ihrer liste.json kommt „Marielli“ gar nicht erst dazu
const ihre = anwenden(anwenden(anwenden(leer(), opZusammen({}, {}, { profil: { person: 'Marielle' } })), opPerson('Marielle')), opPerson('Marielli'));
const eure = anwenden(anwenden(leer(), opPerson('Tobi')), opPerson('Amy'));
check(JSON.stringify(ihre.leute) === JSON.stringify({ marielle: 'Marielle' }) && Object.keys(eure.leute).join() === 'tobi,amy', 'Eine eigene Liste hat eine Person, eure Liste beide');
// Zusammenführen, so wie es bei der echten Marielle stand: zwei Namen (eine ältere Fassung kannte die Regel noch nicht)
const SAHNE = { n: 'Schlagsahne 30 %', c: 'kuehl' };
const zf = anwenden(ihre, [opTeil('schlagsahne', 'x-marielli', { q: 200, u: 'g', h: '' }, SAHNE), opTeil('schlagsahne', 'x-marielle', { q: 100, u: 'g', h: '' }, SAHNE)]);
zf.leute.marielli = 'Marielli';
zf.items.schlagsahne.by = 'Marielli';
zf.profil.ziel = { kcal: 400, p: 30, kh: 40, f: 14, by: 'Marielli', at: '2026-11-05T20:58:27.632Z' };
zf.kochen = { marielli: { at: '2026-11-05T21:00:00.000Z', schritte: { chili: [0, 1] } } };
const zfNeu = anwenden(zf, opEinePerson('Marielle'));
check(JSON.stringify(zfNeu.leute) === JSON.stringify({ marielle: 'Marielle' }) && zfNeu.profil.ziel.by === 'Marielle' && zfNeu.items.schlagsahne.by === 'Marielle', 'Zusammenführen: „Marielli“ ist raus, was sie so gemacht hat, steht bei Marielle');
check(zfNeu.kochen.marielle?.schritte?.chili?.length === 2 && !zfNeu.kochen.marielli && zfNeu.items.schlagsahne.parts['x-marielle'].q === 300 && !zfNeu.items.schlagsahne.parts['x-marielli'], 'Zusammenführen: Kochstand und „Mehr davon“ (200 g + 100 g) auch');
check(beschreibung(zf, zfNeu) === 'Marielli heißt jetzt Marielle', 'Commit: „Marielli heißt jetzt Marielle“ – nicht „Ziel pro Box geändert“');
check(JSON.stringify(anwenden(eure, opEinePerson('Tobi')).leute) === JSON.stringify(eure.leute) && JSON.stringify(anwenden(zf, opEinePerson('Marielli')).leute) === JSON.stringify(zf.leute), 'Nur in einer eigenen Liste und nur auf den Namen aus dem Profil');

/* ------------------------------------------ Dashboard: was drinsteht */

const tagIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tagIn = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return tagIso(d); };
const FOTO = 'sachen/sd-kleid001-abc123.jpg';
/** Was Marielle in ihrer Liste hat – so, wie es ihre App schreibt (erfunden). */
const ihreSachen = () => [
  opInvListe({ id: 'sl-kleid01', name: 'Kleidung', bild: 'womans-clothes', reihe: 2 }, 'Marielle'),
  opInvListe({ id: 'sl-schmuck1', name: 'Schmuck', bild: 'ring', reihe: 1 }, 'Marielle'),
  opDing({ id: 'sd-kleid001', liste: 'sl-kleid01', name: 'Sommerkleid', marke: 'Zara', tags: ['Sommer'], notiz: 'Für die Hochzeit', foto: { pfad: FOTO, sha: 'f1' }, code: '4006381333931', reihe: 1 }, 'Marielle'),
  opDing({ id: 'sd-ring0001', liste: 'sl-schmuck1', name: 'Silberring', reihe: 1 }, 'Marielle'),
  opDing({ id: 'sd-ohne0001', liste: null, name: '', marke: 'Mango', reihe: 1 }, 'Marielle'),
  opBlatt({ id: 'nb-geschenk1', titel: 'Geschenkideen', text: 'NOTIZ-TEXT-GEHEIM', farbe: 'rosa', tags: ['Familie'] }, 'Marielle'),
  opAmy({ id: 'amy-bowl-ab12', name: 'Marielles Bowl', zutaten: ['200 g Reis'], schritte: ['Reis kochen'] }, 'Marielle'),
  opAmyTags('amy-bowl-ab12', ['schnell']),
  opEssensplan({ setzen: [
    { tag: tagIn(0), mahlzeit: 'mittag', e: { id: 'ep-heute01', text: 'Linsensuppe', wer: 'beide' } },
    { tag: tagIn(1), mahlzeit: 'abend', e: { id: 'ep-morgen1', rid: 'chili', wer: 'beide' } },
    { tag: tagIn(10), mahlzeit: 'mittag', e: { id: 'ep-spaet01', text: 'Viel später', wer: 'beide' } },
  ] }, 'Marielle'),
  opVertraeglich('Marielle', { zwiebeln: { name: 'Zwiebeln', stufe: 'nicht', notiz: 'VERTRAEGLICH-GEHEIM' } }, 'Marielle'),
];
let dash = anwenden(leer(), [opEigener('c-aepfel', 'Äpfel', 'obst'), opEigener('c-milch', 'Milch', 'kuehl'), opTeil('rinderhack', 'chili', { q: 500, u: 'g', h: '' }, { n: 'Rinderhackfleisch', c: 'fleisch' }), ...ihreSachen(), opWunsch('w-eins0001', 'WUNSCH-TEXT', 'Amy'), opWunsch('w-zwei0001', 'Weniger Reis', 'Amy')]);
dash = anwenden(dash, [opHaken(dash, 'c-milch', true, 'Marielle'), opWunschErledigt('w-zwei0001', true, 'Tobi')]);
const ih = inhaltVon(bereinigen(JSON.parse(JSON.stringify(dash))), { hilfe: { zutatName: (k) => (k === 'rinderhack' ? 'Rinderhackfleisch' : ''), rezeptName: (rid) => (rid === 'chili' ? 'Chili' : '') } });
const ihText = JSON.stringify(ih);
check(ih.sachen.anzahl === 3 && ih.sachen.listen.map((l) => `${l.name}:${l.dinge.length}`).join() === 'Schmuck:1,Kleidung:1,Ohne Liste:1', `Dashboard: Sachen in ihren Listen, in ihrer Reihenfolge, „Ohne Liste“ zuletzt (${ih.sachen.listen.map((l) => l.name).join()})`);
const kleid = ih.sachen.listen[1].dinge[0];
check(kleid.name === 'Sommerkleid' && kleid.marke === 'Zara' && kleid.foto === FOTO && kleid.tags.join() === 'Sommer' && kleid.notiz === 'Für die Hochzeit' && kleid.code === '4006381333931', 'Dashboard: eine Sache mit Marke, Foto, Tags, Notiz, Strichcode');
check(ih.sachen.listen[2].dinge[0].name === 'Mango' && ih.sachen.listen[2].dinge[0].marke === '', 'Dashboard: ohne Namen heißt die Sache nach der Marke');
check(ih.einkauf.offen.join() === 'Äpfel,Rinderhackfleisch' && ih.einkauf.erledigt === 1, `Dashboard: Einkaufsliste offen nach Namen, eins abgehakt (${ih.einkauf.offen.join()})`);
check(ih.rezepte.length === 1 && ih.rezepte[0].name === 'Marielles Bowl' && ih.rezepte[0].tags.join() === 'schnell', 'Dashboard: eigene Rezepte mit Tags');
check(ih.notizen.length === 1 && ih.notizen[0].titel === 'Geschenkideen' && ih.notizen[0].tags.join() === 'Familie' && !ihText.includes('NOTIZ-TEXT'), 'Dashboard: Notizen nur mit Titel und Tags – nicht, was drinsteht');
check(ih.plan.map((t) => `${t.tag}:${t.mittag.join('+')}/${t.abend.join('+')}`).join() === `${tagIn(0)}:Linsensuppe/,${tagIn(1)}:/Chili`, `Dashboard: Essensplan ab heute, sieben Tage, Rezepte mit Namen (${ih.plan.map((t) => t.tag).join()})`);
check(ih.wuensche.offen === 1 && ih.wuensche.erledigt === 1 && !ihText.includes('WUNSCH-TEXT'), 'Dashboard: Vorschläge nur gezählt');
check(!ihText.includes('VERTRAEGLICH') && !ihText.includes('Zwiebeln'), 'Dashboard: was jemand verträgt, steht nicht drin');
check(JSON.stringify(inhaltVon(null)) === JSON.stringify(inhaltVon(leer())) && inhaltVon(null).sachen.anzahl === 0, 'Dashboard: ohne Stand alles leer');

/* ============================================================ Browser */

/**
 * Ein Commit der Sachen-App an sachen.json in der Attrappe – so, wie sie schreibt: die ganze Datei (JSON mit
 * 1 Leerzeichen, Zeilenumbruch am Ende), mit neuer sha, als Fassung für ?ref= (die Einzelheiten).
 */
function sachenCommit(att, stand, nachricht) {
  const z = att.zustand;
  const sha = `sa${z.commits.length + 1}-amy`;
  const text = `${JSON.stringify(stand, null, 1)}\n`;
  z.dateien['sachen.json'] = text;
  z.shas['sachen.json'] = `w-${sha}`;
  z.fassungen[sha] = text;
  z.commits.unshift({ sha, message: nachricht, date: new Date().toISOString(), pfad: 'sachen.json' });
  return sha;
}

const browser = await starteBrowser();
const haupt = githubAttrappe();
const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
mar.zustand.leer = true;
const beide = githubMehrere(haupt, mar);
const tobi = await handy(browser, { attrappe: beide });
const t = tobi.page;
await t.evaluate(([k, g]) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })); localStorage.setItem('boxenstopp.ki.v1', JSON.stringify({ schluessel: g })); }, [SCHLUESSEL, GKEY]);
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: verbunden');
await t.click('.tabbar .tab[data-tab="einstellungen"]');
check(await t.locator('#e-gaeste-karte').isVisible() && await t.locator('[data-act="g-einladen"]').isEnabled(), 'Einstellungen: „Gäste & Überblick“ mit „Jemanden einladen“');
await t.click('[data-act="g-einladen"]');
await t.fill('#g-name', 'Marielle');
const repoHref = new URL(await t.getAttribute('#g-repo-link', 'href'));
const tokenHref = new URL(await t.getAttribute('#g-token-link', 'href'));
check(repoHref.searchParams.get('name') === 'Boxenstopp-Marielle' && repoHref.searchParams.get('visibility') === 'private' && repoHref.searchParams.get('owner') === 'Finanzdienste', 'Link „Repo anlegen“: Name, privat, Besitzer vorausgefüllt');
check(tokenHref.pathname === '/settings/personal-access-tokens/new' && tokenHref.searchParams.get('contents') === 'write' && tokenHref.searchParams.get('target_name') === 'Finanzdienste' && tokenHref.searchParams.get('name') === 'Boxenstopp Marielle', 'Link „Schlüssel anlegen“: Fine-grained, Contents: write, Besitzer, Name');
check(await t.locator('#g-form input[value="lila"]').isChecked(), 'Farbe: Lila ist vorgewählt');
// Euer eigener Schlüssel: nein
await t.fill('#g-token', SCHLUESSEL);
await t.click('#g-los');
check(await bis(async () => (await t.locator('#g-fehler').innerText()).includes('euer Schlüssel')), 'Euer Schlüssel wird nicht genommen');
// Ein Schlüssel, der auch an eure Liste kommt: nein
const alles = githubAttrappe({ schluessel: ALLES_KEY });
await tobi.ctx.unroute('https://api.github.com/**');
await tobi.ctx.route('https://api.github.com/**', (r) => (r.request().headers().authorization === `Bearer ${ALLES_KEY}` ? alles.route(r) : beide.route(r)));
await t.fill('#g-token', ALLES_KEY);
await t.click('#g-los');
check(await bis(async () => (await t.locator('#g-fehler').innerText()).includes('auch an eure Liste')), 'Ein Schlüssel für alle Repos wird abgelehnt – er käme an eure Liste');
await tobi.ctx.unroute('https://api.github.com/**');
await tobi.ctx.route('https://api.github.com/**', beide.route);
// Repo gibt es nicht
mar.zustand.gibtEs = false;
await t.fill('#g-token', M_KEY);
await t.click('#g-los');
check(await bis(async () => (await t.locator('#g-fehler').innerText()).includes('Gibt es das private Repo Boxenstopp-Marielle')), 'Repo fehlt: Hinweis aufs Repo und die Rechte');
mar.zustand.gibtEs = true;
await t.fill('#g-token', M_KEY);
await t.click('#g-los');
check(await bis(() => t.locator('#g-linkfeld').count(), 6000), 'Richtiger Schlüssel: der Link ist da');
const link = await t.inputValue('#g-linkfeld');
const u = new URL(link);
const teile = new URLSearchParams(u.hash.slice(1));
check(teile.get('zugang') === M_KEY && teile.get('daten') === 'Finanzdienste/Boxenstopp-Marielle' && teile.get('fuer') === 'Marielle' && teile.get('farbe') === 'lila' && teile.get('ki') === GKEY, 'Im Link: ihr Schlüssel, ihr Repo, ihr Name, Lila, der KI-Schlüssel');
check(mar.liste()?.profil?.person === 'Marielle' && mar.liste().profil.farbe === 'lila' && mar.zustand.nachrichten.includes('Tobi: Einladung für Marielle'), 'Ihre Liste ist angelegt: Profil mit Name und Farbe, Commit „Tobi: Einladung für Marielle“');
check(!haupt.liste()?.profil?.person, 'Eure Liste bleibt, wie sie ist');
const gemerkt = await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.gaeste.v1')));
check(gemerkt.length === 1 && gemerkt[0].daten === 'Finanzdienste/Boxenstopp-Marielle', 'Tobis Gerät merkt sich den Gast');
await t.click('[data-act="g-fertig-zu"]');
check((await t.locator('#e-gaeste .g-liste').innerText()).includes('Marielle'), 'In der Liste der Gäste: Marielle');

// --- Marielle öffnet den Link
const marielle = await handy(browser, { attrappe: beide, adresse: `${APP_URL}${u.hash}`, hinweise: true });
const m = marielle.page;
check(await bis(() => m.evaluate(() => document.querySelector('#willkommen-dlg')?.open), 8000), 'Marielle: gleich verbunden, das Willkommen ist da');
check(await m.evaluate(() => document.documentElement.dataset.farbe === 'lila' && document.documentElement.dataset.liste === 'eigen'), 'Lila, eigene Liste');
check(await m.evaluate(() => !location.hash.includes('zugang')), 'Der Schlüssel ist aus der Adresse');
check(await m.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href') === 'icon-lila-192.png' && document.querySelector('link[rel="manifest"]').getAttribute('href') === 'manifest-lila.webmanifest'), 'Symbol und Manifest in Lila');
check((await m.locator('#willkommen-dlg').innerText()).includes('Hallo Marielle'), 'Willkommen: „Hallo Marielle“');
await m.click('[data-act="wk-weiter"]');
check((await m.locator('#willkommen-dlg').innerText()).includes('Was soll eine Box haben?'), 'Willkommen, Seite 2: die Makros');
await m.fill('#wk-makros input[name="kcal"]', '');
await m.fill('#wk-makros input[name="p"]', '30');
await m.fill('#wk-makros input[name="kh"]', '35');
await m.fill('#wk-makros input[name="f"]', '12');
check(await bis(async () => (await m.locator('#wk-vorschau').innerText()).includes('368 kcal')), 'Willkommen: ohne kcal rechnet die App 368');
await m.click('[data-act="wk-weiter"]');
check(await bis(() => mar.liste()?.profil?.ziel?.p === 30), 'Ihr Ziel steht in ihrer liste.json');
check(!haupt.liste()?.profil?.ziel, '… nicht in eurer');
const wkTexte = [];
for (let i = 0; i < 4 && await m.evaluate(() => document.querySelector('#willkommen-dlg')?.open); i++) { wkTexte.push(await m.locator('#willkommen-dlg').innerText()); await m.click('[data-act="wk-weiter"]'); }
check(!(await m.evaluate(() => document.querySelector('#willkommen-dlg')?.open)) && await m.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.willkommen.v1')) === true), 'Willkommen durch, gemerkt');
check(wkTexte.some((x) => x.includes('Tobi sieht in seinem Dashboard, was drinsteht') && x.includes('nur zum Ansehen')) && !wkTexte.some((x) => x.includes('sehen davon in ihrer App nichts')), 'Willkommen: ehrlich – Tobi sieht im Dashboard, was in ihrer Liste steht');
check(await m.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.dashboard.hinweis.v1')) === true && !document.querySelector('#dash-hinweis-dlg').open), 'Der Hinweis aufs Dashboard kommt nicht noch extra – das Willkommen hat es gesagt');
check((await m.locator('.tab-amy .tab-l').innerText()) === 'Marielles Bereich' && (await m.locator('.tab-amy .tab-k').innerText()) === 'Marielle', 'Der Reiter heißt „Marielles Bereich“');
check((await m.locator('#r-ziel').innerText()).replace(/\s+/g, ' ').includes('368 kcal 30 g P 35 g KH 12 g F'), 'Oben ihr Ziel');
check((await m.locator('#sync-text').innerText()) === 'Gespeichert', 'Oben „Gespeichert“ statt „Geteilt“');
// Etwas auf ihre Liste
await m.click('#grid .box[data-open="chili"]');
await m.click('[data-act="alle-dazu"]');
check(await bis(() => !!mar.liste()?.items?.rinderhack?.parts?.chili), 'Chili steht auf ihrer Liste');
check(!haupt.liste()?.items?.rinderhack, '… nicht auf eurer');
check(mar.zustand.nachrichten.some((n) => /^Marielle: Einkaufsliste, \d+ Änderungen? – .*Chili/.test(n)), 'Ihr Commit sagt, was passiert ist');
await m.click('.tabbar .tab[data-tab="einstellungen"]');
check(await m.evaluate(() => document.querySelector('#e-push-karte').hidden && document.querySelector('#e-todo').hidden && document.querySelector('#e-gaeste-karte').hidden), 'In ihrer Liste: kein Push, kein To Do, keine Gäste');
check((await m.locator('#e-liste-t').innerText()) === 'Deine Liste', 'Die Karte heißt „Deine Liste“');
await m.click('[data-act="z-link"]').catch(() => {});
const zweit = await m.inputValue('#z-linkfeld');
const zt = new URLSearchParams(new URL(zweit).hash.slice(1));
check(zt.get('daten') === 'Finanzdienste/Boxenstopp-Marielle' && zt.get('fuer') === 'Marielle' && zt.get('zugang') === M_KEY, 'Link fürs zweite Gerät: mit ihrem Repo und Namen');
await m.click('.tabbar .tab[data-tab="haushalt"]');
check(!(await m.locator('#view-haushalt').innerText()).includes('Microsoft To Do'), 'Haushalt ohne To Do');
check(marielle.fehler.length === 0, `Marielle: keine Fehler im Browser (${marielle.fehler.join(' | ')})`);

// --- Tobi gibt seinen KI-Schlüssel frei: in eurer Liste und in Marielles – ihr Handy holt ihn beim nächsten Öffnen
const AKEY = 'sk-ant-api03-TESTTESTTESTTESTTESTTESTTESTTEST_abc';
check(await m.evaluate((g) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1')).schluessel === g, GKEY), 'Marielle hat Tobis Google-Schlüssel aus dem Link');
await t.click('[data-act="e-ki-aendern"]');
await t.fill('#e-ki-feld', AKEY);
await t.press('#e-ki-feld', 'Enter');
check(await bis(async () => (await t.locator('#e-ki').innerText()).includes('Anthropic')) && (await t.locator('#e-ki [data-act="e-ki-teilen"]').innerText()).includes('und für Marielle (eigene Liste)'), 'Tobi: neuer Anthropic-Schlüssel, Freigeben „und für Marielle (eigene Liste)“');
await t.click('#e-ki [data-act="e-ki-teilen"]');
const kiVon = (att) => { try { return JSON.parse(att.zustand.dateien['ki.json']); } catch { return null; } };
check(await bis(() => kiVon(haupt)?.schluessel === AKEY && kiVon(mar)?.schluessel === AKEY, 8000) && kiVon(mar).von === 'Tobi' && mar.zustand.nachrichten.includes('Tobi: KI-Schlüssel für alle Handys') && await bis(async () => (await t.locator('#toast').innerText()).includes('auch bei Marielle')), 'ki.json liegt in eurer und in ihrer Liste, Commit „Tobi: KI-Schlüssel für alle Handys“, Hinweis „auch bei Marielle“');
check(await bis(async () => (await t.locator('#e-ki .e-ki-teilen').innerText()).includes('Freigegeben für alle Handys dieser Liste und für Marielle (eigene Liste)')), 'Bei Tobi: „Freigegeben … und für Marielle“');
await m.reload({ waitUntil: 'load' });
await m.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(() => m.evaluate((k) => JSON.parse(localStorage.getItem('boxenstopp.ki.v1') || '{}').schluessel === k, AKEY), 8000) && await bis(async () => (await m.locator('#toast').innerText()).includes('KI-Schlüssel von Tobi übernommen')), 'Marielle öffnet die App: Tobis neuer Schlüssel ist da, mit Hinweis');

// --- Ihr zweites Gerät: ohne Link in der Adresse, den Link ins Schlüsselfeld
const ipad = await handy(browser, { attrappe: beide });
const ip = ipad.page;
await ip.click('.tabbar .tab[data-tab="einstellungen"]');
await ip.fill('#z-token', zweit);
await ip.dispatchEvent('#z-token', 'input');
check((await ip.inputValue('#z-name')) === 'Marielle', 'Zweites Gerät: Link ins Schlüsselfeld – der Name kommt mit');
await ip.click('#z-los');
check(await bis(async () => (await ip.locator('#sync-text').innerText()) === 'Gespeichert' && await ip.evaluate(() => document.documentElement.dataset.farbe === 'lila')), 'Zweites Gerät: an ihrer Liste, in Lila');
check(await bis(async () => (await ip.locator('#grid .box[data-open="chili"] .pill-list').count()) === 1), 'Zweites Gerät: ihre Liste (Chili steht drauf)');
await ipad.ctx.close();

// --- So stand es bei der echten Marielle: Ein Gerät mit älterer Fassung hat sie als Zweite „Marielli“ eingetragen
const vorMerge = mar.liste();
vorMerge.leute = { ...vorMerge.leute, marielli: 'Marielli' };
vorMerge.profil.ziel.by = 'Marielli';
vorMerge.rev += 1;
mar.zustand.datei = JSON.stringify(vorMerge);
mar.zustand.version++;
mar.zustand.sha = `sha${mar.zustand.version}`;
// Noch ein Gerät (etwa die App vom Home-Bildschirm), auf dem sie „Marielli“ eintippt: dieselbe Person, es heißt wie ihre Liste
const drittes = await handy(browser, { attrappe: beide });
const d3 = drittes.page;
await d3.evaluate(() => localStorage.setItem('boxenstopp.willkommen.v1', 'true'));
await d3.click('.tabbar .tab[data-tab="einstellungen"]');
await d3.fill('#z-name', 'Marielli');
await d3.fill('#z-token', zweit);
await d3.dispatchEvent('#z-token', 'input');
check((await d3.inputValue('#z-name')) === 'Marielli', 'Drittes Gerät: ihr selbst getippter Name bleibt');
await d3.click('#z-los');
check(await bis(async () => (await d3.locator('#sync-text').innerText()) === 'Gespeichert'), 'Drittes Gerät als „Marielli“: an ihrer Liste');
check(await bis(() => JSON.stringify(mar.liste()?.leute) === JSON.stringify({ marielle: 'Marielle' }) && mar.liste()?.profil?.ziel?.by === 'Marielle'), 'Zusammengeführt: „Marielli“ ist aus der Liste raus, ihr Ziel steht bei Marielle');
check(mar.zustand.nachrichten.some((n) => /^Marielle: Einkaufsliste, 1 Änderung – Marielli heißt jetzt Marielle$/.test(n)), 'Commit: „Marielle: … – Marielli heißt jetzt Marielle“');
check(await d3.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.zugang.v1')).name) === 'Marielle', 'Das Gerät heißt jetzt wie ihre Liste: Marielle');
await d3.click('.tabbar .tab[data-tab="einkauf"]');
await d3.fill('#add-input', 'Äpfel');
await d3.press('#add-input', 'Enter');
check(await bis(() => mar.zustand.nachrichten.some((n) => /^Marielle: .*Äpfel/.test(n))), 'Äpfel auf der Liste – als Marielle');
check(JSON.stringify(mar.liste().leute) === JSON.stringify({ marielle: 'Marielle' }) && !mar.zustand.nachrichten.some((n) => /^Marielli:/.test(n)), 'Eine eigene Liste hat eine Person: kein Commit als „Marielli“, kein zweites „zum ersten Mal dabei“');
await d3.click('.tabbar .tab[data-tab="einstellungen"]');
const zielText3 = await bis(async () => { const x = await d3.locator('#e-ziel').innerText(); return x.includes('von dir') ? x : null; });
check(zielText3, `Ihr Ziel: „von dir“ (${zielText3 ? '' : (await d3.locator('#e-ziel').innerText()).slice(0, 160)})`);
await d3.click('.tabbar .tab[data-tab="haushalt"]');
check((await d3.locator('#view-haushalt').innerText()).includes('Dein Putzplan'), 'Haushalt in ihrer Liste: „Dein Putzplan“');
await d3.click('#view-haushalt [data-act="h-neu"][data-raum="kueche"]');
check(await bis(() => d3.locator('#h-edit-form').count()) && !(await d3.locator('#h-edit-form').innerText()).includes('Ihr beide'), 'Neuer Putztag in ihrer Liste: kein „Wer“ mit „Ihr beide“');
check(drittes.fehler.length === 0, `Drittes Gerät: keine Fehler im Browser (${drittes.fehler.join(' | ')})`);
await drittes.ctx.close();

// --- Tobi: der Überblick
await t.click('[data-act="ub-oeffnen"]');
check(await bis(async () => (await t.locator('#ueberblick-dlg .ub-person').count()) >= 2), 'Überblick: die Personen');
const ub = await t.locator('#ueberblick-dlg').innerText();
check(ub.includes('Marielle') && ub.includes('Marielles Liste') && ub.includes('Tobi') && ub.includes('eure Liste'), 'Überblick: Marielle in ihrer Liste, Tobi in eurer');
check(ub.includes('Chili') && ub.includes('Ziel pro Box geändert') && ub.includes('Einladung für Marielle'), 'Überblick: was passiert ist, im Verlauf');
check(!(await t.locator('#ueberblick-dlg .zugang-fehler').count()) && !ub.includes('Amys Sachen'), 'Noch keine sachen.json (nichts umgezogen): kein Fehler, keine Karte dafür');
const karten = await t.locator('#ueberblick-dlg .ub-person .ub-wer b').allInnerTexts();
check(karten.length === 2 && karten.includes('Marielle') && !karten.includes('Marielli') && ub.includes('Äpfel') && ub.includes('Marielli heißt jetzt Marielle'), `Überblick: Marielle einmal, mit „Marielli heißt jetzt Marielle“ (${karten.join(', ')})`);
// Die Einzelheiten: was genau – aus liste.json vor und nach jedem Commit (?ref=), nicht aus der Nachricht
// (Lange Sachen stehen untereinander – zum Vergleichen alles in einer Zeile)
const verlaufText = async () => (await t.locator('#ueberblick-dlg .ub-verlauf').innerText()).replace(/\s+/g, ' ');
const det = await bis(async () => { const x = await verlaufText(); return /Für Chili[^:]* auf die Liste: \d/.test(x) && x.includes('Auf die Liste: Äpfel') && x.includes('Ziel pro Box: 368 kcal · 30 g P · 35 g KH · 12 g F') ? x : null; }, 12000);
check(det, `Einzelheiten: Chili mit Mengen, die Äpfel, ihr Ziel (${det ? '' : (await verlaufText()).slice(0, 400)})`);
check(/Für Chili[^:]* auf die Liste: \d+ g Rinderhack/.test(det || ''), 'Einzelheiten: wie auf dem Einkaufszettel („… g Rinderhack…“)');
check(mar.zustand.fassungAbrufe > 0 && await t.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('boxenstopp.einzelheiten.v1')).d).length > 0), 'Die Stände kommen mit ?ref= von GitHub, die Einzelheiten sind gemerkt');
// Nur eine Person
await t.click('#ueberblick-dlg .ub-filter [data-ub-wer="marielle"]');
const nurSie = await t.locator('#ueberblick-dlg .ub-liste .ub-name').allInnerTexts();
check(nurSie.length > 0 && nurSie.every((x) => x === 'Marielle') && await t.locator('#ueberblick-dlg .ub-filter [data-ub-wer="marielle"]').getAttribute('aria-pressed') === 'true', `Nur Marielle: nur ihre Einträge (${[...new Set(nurSie)].join(', ')})`);
await t.click('#ueberblick-dlg .ub-filter [data-ub-wer=""]');
check((await t.locator('#ueberblick-dlg .ub-liste .ub-name').allInnerTexts()).includes('Tobi'), 'Alle: Tobi steht wieder mit drin');
const abrufeVorher = mar.zustand.fassungAbrufe;
await t.click('#ueberblick-dlg [data-ub-tage="30"]');
check(await t.locator('#ueberblick-dlg .ub-balken.dicht').count() >= 1, 'Überblick: 30 Tage');
const holtVorher = mar.zustand.commits.length;
await t.click('[data-act="ub-zu"]');
// Marielle macht noch etwas – beim nächsten Öffnen kommt nur das Neue dazu
await m.click('.tabbar .tab[data-tab="einkauf"]');
await m.fill('#add-input', 'Bananen');
await m.press('#add-input', 'Enter');
check(await bis(() => mar.zustand.commits.length > holtVorher), 'Marielle setzt Bananen auf die Liste');
await t.click('[data-act="ub-oeffnen"]');
check(await bis(async () => (await t.locator('#ueberblick-dlg').innerText()).includes('Bananen')), 'Überblick neu geöffnet: das Neue ist da');
// Bananen kommen zur Sitzung von eben dazu: „Auf die Liste: Äpfel, Bananen“
check(await bis(async () => /Auf die Liste: (?:[^:]*, )?Bananen/.test(await verlaufText())), `Einzelheiten zum Neuen: Bananen auf die Liste (${(await verlaufText()).slice(0, 300)})`);
check(mar.zustand.fassungAbrufe - abrufeVorher <= 3, `Gemerkte Einzelheiten werden nicht neu geholt – nur der neue Commit (${mar.zustand.fassungAbrufe - abrufeVorher} Abrufe)`);
// Lange Zeilen: die ersten zwölf Sachen, der Rest auf Tipp (dafür eine gemerkte Zeile mit 15 Sachen, dann neu laden)
await t.evaluate(() => {
  const x = JSON.parse(localStorage.getItem('boxenstopp.einzelheiten.v1'));
  const sha = Object.keys(x.d)[0];
  x.d[sha] = [...x.d[sha], { b: 'Einkauf', a: 'Testzeile', x: Array.from({ length: 15 }, (_, i) => `Sache ${i + 1}`) }];
  localStorage.setItem('boxenstopp.einzelheiten.v1', JSON.stringify(x));
});
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await t.click('.tabbar .tab[data-tab="einstellungen"]');
await t.click('[data-act="ub-oeffnen"]');
const lang = t.locator('#ueberblick-dlg .ub-det-z', { hasText: 'Testzeile' });
check(await bis(() => lang.count()) && (await lang.innerText()).includes('Sache 12') && !(await lang.innerText()).includes('Sache 13') && (await lang.innerText()).includes('+ 3 weitere'), `Lange Zeile: zwölf Sachen und „+ 3 weitere“ (${await lang.innerText().catch(() => '')})`);
await lang.locator('.ub-det-mehr').click();
check((await lang.innerText()).includes('Sache 15') && !(await lang.locator('.ub-det-mehr').count()), '„+ 3 weitere“ zeigt die ganze Zeile');
await t.click('[data-act="ub-zu"]');

// --- Das Dashboard: je Person ein Reiter, mit dem, was gerade in der Liste steht
// Marielle hat Sachen (eine mit Foto), eine Notiz, ein Rezept, den Essensplan und was sie verträgt – wie ihre App es schreibt
const ihrStand = mar.liste();
const mitSachen = anwenden(bereinigen(ihrStand), ihreSachen());
mitSachen.rev = ihrStand.rev + 1;
mar.zustand.datei = JSON.stringify(mitSachen);
mar.zustand.version++;
mar.zustand.sha = `sha${mar.zustand.version}`;
mar.zustand.dateien[FOTO] = 'foto';
mar.zustand.roh[FOTO] = readFileSync(`${ROOT}/icon-192.png`);
// Amy hat in eurer Liste eine Notiz und einen offenen Vorschlag, ihre Sachen in sachen.json (die Sachen-App, mit Commit) –
// und eine ältere App-Fassung hat ihr eine Sache noch in liste.json gelegt (Tobis Gerät zieht sie gleich um)
const lippe = sachenAnwenden(leerSachen(), opDing({ id: 'sd-lippe001', name: 'Lippenstift', marke: 'Catrice', tags: ['Rot'], reihe: 1 }, 'Amy'));
lippe.rev = 1;
sachenCommit(haupt, lippe, 'Amy: Sachen, 1 Änderung');
const euer = haupt.liste();
const mitAmy = anwenden(bereinigen(euer), [opDing({ id: 'sd-buerst01', name: 'Haarbürste', marke: 'Tangle', reihe: 2 }, 'Amy'), opBlatt({ id: 'nb-urlaub01', titel: 'Urlaub', text: 'AMY-NOTIZ-TEXT', farbe: 'rosa' }, 'Amy'), opWunsch('w-amy00001', 'AMY-WUNSCH', 'Amy')]);
mitAmy.rev = euer.rev + 1;
haupt.zustand.datei = JSON.stringify(mitAmy);
haupt.zustand.version++;
haupt.zustand.sha = `sha${haupt.zustand.version}`;
const rohVorher = mar.zustand.rohGets;
await t.click('[data-act="ub-oeffnen"]');
const reiterTexte = await bis(async () => { const x = await t.locator('#ueberblick-dlg [data-ub-reiter] .ub-r-name').allInnerTexts(); return x.length === 3 ? x : null; });
check(reiterTexte && reiterTexte.join() === 'Aktivität,Amy,Marielle' && await t.locator('#ub-titel').innerText() === 'Dashboard' && await t.locator('#ueberblick-dlg [data-ub-reiter="aktivitaet"]').getAttribute('aria-selected') === 'true', `Dashboard: Reiter Aktivität, Amy, Marielle – erst die Aktivität (${reiterTexte?.join(' | ')})`);
check(mar.zustand.rohGets === rohVorher, 'Ihre Liste wird erst geholt, wenn ihr Reiter offen ist');
await t.click('#ueberblick-dlg [data-ub-reiter="gast:Finanzdienste/Boxenstopp-Marielle"]');
const panel = async () => (await t.locator('#ueberblick-dlg .ub-panel').innerText()).replace(/\s+/g, ' ');
const ihrs = await bis(async () => { const x = await panel(); return x.includes('Sommerkleid') ? x : null; }, 8000);
check(ihrs && ihrs.includes('Zara') && ihrs.includes('Kleidung') && ihrs.includes('Schmuck') && ihrs.includes('Silberring') && ihrs.includes('Mango') && ihrs.includes('Für die Hochzeit'), `Marielle: ihre Sachen in ihren Listen, mit Marke und Notiz${ihrs ? '' : ` (${(await panel()).slice(0, 300)})`}`);
check(mar.zustand.rohGets > rohVorher, 'Ihre Liste kommt, wie sie jetzt ist (ohne ?ref=)');
check(ihrs && /Äpfel Bananen/.test(ihrs) && /Einkaufsliste \d+ offen/i.test(ihrs) && await t.locator('#ueberblick-dlg .ub-chips li', { hasText: 'Kidneybohnen' }).count() === 1, `Marielle: ihre Einkaufsliste, je Sache eine Pille${ihrs && /Äpfel Bananen/.test(ihrs) ? '' : ` (${(ihrs || '').slice(0, 600)})`}`);
check(ihrs && ihrs.includes('Heute') && ihrs.includes('Linsensuppe') && ihrs.includes('Morgen') && ihrs.includes('Chili') && !ihrs.includes('Viel später'), 'Marielle: ihr Essensplan, die nächsten sieben Tage');
check(ihrs && ihrs.includes('Marielles Bowl') && ihrs.includes('Geschenkideen') && !ihrs.includes('NOTIZ-TEXT'), 'Marielle: ihre Rezepte und die Titel der Notizen – nicht, was drinsteht');
check(ihrs && !ihrs.includes('VERTRAEGLICH') && /Zuletzt \d+ Tage/i.test(ihrs) && ihrs.includes('nur zum Ansehen'), 'Marielle: nicht, was sie verträgt; die letzten Sitzungen; „nur zum Ansehen“');
check(await bis(() => t.evaluate(() => document.querySelector('#ueberblick-dlg img[data-ub-foto]')?.src.startsWith('blob:'))) && mar.zustand.lesen[FOTO] >= 1 && await t.evaluate(() => document.querySelector('#ueberblick-dlg img[data-ub-foto]').closest('.inv-bild').classList.contains('hat-foto')), 'Marielle: das Foto kommt mit ihrem Schlüssel aus ihrem Repo');
// Amy: ihr Bereich in eurer Liste, die Sachen aus sachen.json – und die aus liste.json, ob schon umgezogen oder nicht
await t.click('#ueberblick-dlg [data-ub-reiter="amy"]');
const amys = await bis(async () => { const x = await panel(); return x.includes('Lippenstift') && x.includes('Haarbürste') ? x : null; }, 8000);
check(amys && amys.includes('Catrice') && amys.includes('Tangle') && amys.includes('Urlaub') && amys.includes('1 Vorschlag offen') && !amys.includes('AMY-NOTIZ-TEXT') && !amys.includes('AMY-WUNSCH') && !amys.includes('Einkaufsliste'), `Amy: ihre Sachen (sachen.json und liste.json), die Titel ihrer Notizen, wie viele Vorschläge offen sind${amys ? '' : ` (${(await panel()).slice(0, 300)})`}`);
check(await t.locator('#ueberblick-dlg .ub-kachel', { hasText: 'Sachen' }).innerText().then((k) => /^2\s/.test(k)), 'Amy: Kachel „2 Sachen“');
check(await t.locator('#ueberblick-dlg [data-ub-reiter="amy"]').getAttribute('aria-selected') === 'true' && await t.evaluate(() => document.activeElement?.dataset?.ubReiter === 'amy'), 'Der gewählte Reiter ist markiert und hat den Fokus');
await t.click('[data-act="ub-zu"]');
// Neu geöffnet: nichts aus ihrer Liste ist geblieben – es kommt neu
const rohZu = mar.zustand.rohGets;
await t.click('[data-act="ub-oeffnen"]');
await t.click('#ueberblick-dlg [data-ub-reiter="gast:Finanzdienste/Boxenstopp-Marielle"]');
check(await bis(async () => (await panel()).includes('Sommerkleid')) && mar.zustand.rohGets > rohZu, 'Neu geöffnet: ihre Liste kommt neu – gemerkt wird sie nicht');
check(tobi.fehler.length === 0, `Tobi: keine Fehler im Browser (${tobi.fehler.join(' | ')})`);
await t.click('[data-act="ub-zu"]');

// --- Tobi zieht um: die Gäste aufs neue Handy
check(!(await t.locator('#e-gaeste details.g-umzug').count()), 'Altes Handy (hat Gäste): kein „Vom alten Handy übernehmen“');
await t.click('[data-act="g-umzug"]');
const umzugLink = await t.inputValue('#g-umzug-link');
check(/#gaeste=[A-Za-z0-9_-]+$/.test(umzugLink) && (await t.locator('#e-gaeste .g-fertig').innerText()).includes('Schlüssel von Marielle'), 'Altes Handy: „Aufs neue Handy“ macht den Link, mit dem Hinweis auf die Schlüssel');
check(gaesteAusLink(umzugLink).map((g) => `${g.name}|${g.daten}|${g.token === M_KEY}|${g.farbe}`).join() === 'Marielle|Finanzdienste/Boxenstopp-Marielle|true|lila', 'Im Link: Marielle mit Repo, Schlüssel und Farbe');
await t.click('[data-act="g-umzug-zu"]');
check(!(await t.locator('#g-umzug-link').count()) && await t.locator('[data-act="g-umzug"]').isVisible(), '„Fertig“ schließt den Link wieder');

// Das neue Handy: schon mit eurer Liste verbunden, öffnet den Link
const neues = await handy(browser, { attrappe: beide });
const n = neues.page;
await n.evaluate((k) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })), SCHLUESSEL);
await n.goto(`${APP_URL.replace(/index\.html$/, '')}icon.svg`);
await n.goto(`${APP_URL}${new URL(umzugLink).hash}`);
await n.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await n.locator('#e-gaeste .g-fertig').innerText().catch(() => '')).includes('Vom alten Handy: Marielle')) && await n.evaluate(() => document.documentElement.dataset.tab) === 'einstellungen', 'Neues Handy: der Link öffnet die Einstellungen und fragt nach Marielle');
check(await n.evaluate(() => !location.hash.includes('gaeste') && !localStorage.getItem('boxenstopp.gaeste.v1')), 'Der Link ist aus der Adresse, übernommen ist noch nichts');
await n.click('[data-act="g-uebernehmen"]');
const uebernommen = await n.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.gaeste.v1')));
check(uebernommen.length === 1 && uebernommen[0].token === M_KEY && uebernommen[0].daten === 'Finanzdienste/Boxenstopp-Marielle' && (await n.locator('#e-gaeste .g-liste').innerText()).includes('Marielle') && (await n.locator('#toast').innerText()).includes('Marielle übernommen'), 'Übernehmen: Marielle steht auf dem neuen Handy, mit ihrem Schlüssel');
await n.click('[data-act="ub-oeffnen"]');
check(await bis(async () => (await n.locator('#ueberblick-dlg').innerText()).includes('Marielles Liste') && (await n.locator('#ueberblick-dlg').innerText()).includes('Bananen'), 8000), 'Neues Handy: der Überblick kennt Marielles Liste, samt Verlauf');
check(neues.fehler.length === 0, `Neues Handy: keine Fehler im Browser (${neues.fehler.join(' | ')})`);
await neues.ctx.close();

// Landet der Link im Browser statt in der App: auf dem neuen Handy einfügen
const einfuegen = await handy(browser, { attrappe: beide });
const e = einfuegen.page;
await e.evaluate((k) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })), SCHLUESSEL);
await e.reload();
await e.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await e.click('.tabbar .tab[data-tab="einstellungen"]');
await e.click('#e-gaeste details.g-umzug summary');
await e.fill('#g-umzug-feld', 'Hier der Link: kaputt');
await e.click('#g-umzug-form button[type="submit"]');
check(await bis(async () => (await e.locator('#g-umzug-fehler').innerText().catch(() => '')).includes('keine Gäste')) && !(await e.evaluate(() => localStorage.getItem('boxenstopp.gaeste.v1'))), 'Einfügen: Unsinn gibt einen Hinweis, keine Gäste');
await e.fill('#g-umzug-feld', `Hier der Link: ${umzugLink}`);
check(!(await e.locator('#g-umzug-fehler').isVisible()), 'Neu eingefügt: der Hinweis ist weg');
await e.press('#g-umzug-feld', 'Enter');
check(await bis(async () => (await e.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.gaeste.v1') || '[]'))).some((g) => g.token === M_KEY)) && (await e.locator('#e-gaeste .g-liste').innerText()).includes('Marielle') && !(await e.locator('#e-gaeste details.g-umzug').count()), 'Einfügen (mit Text drumherum, Enter): Marielle ist übernommen, das Feld ist weg');
check(einfuegen.fehler.length === 0, `Einfügen: keine Fehler im Browser (${einfuegen.fehler.join(' | ')})`);
await einfuegen.ctx.close();

// Gast entfernen (nur von Tobis Gerät)
await t.click('[data-g-weg="Finanzdienste/Boxenstopp-Marielle"]');
check(!(await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.gaeste.v1')))).length && !!mar.liste(), 'Entfernen: weg von Tobis Gerät, ihre Liste bleibt');

/* ---------------------------------------- Dashboard: Amys Sachen-App */

// Seit v83 sind Amys Sachen eine eigene App (sachen/) mit eigener Datei: sachen.json neben liste.json. In Tobis Dashboard
// sind beide eure Liste – die Commits gemischt (Amy einmal), die Einzelheiten aus der Datei des Commits (?ref=), der
// Umzug als Automatik, Amys Reiter mit den Sachen aus sachen.json und dem, was noch in liste.json steht.
const sg = githubAttrappe();
const sz = sg.zustand;
const vor = (min) => new Date(Date.now() - min * 60000).toISOString();
const alsDatei = (x) => `${JSON.stringify(x, null, 1)}\n`;
/** Ein Commit an liste.json, wie ihn ein anderes Gerät schreibt (rev + 1) – Tobis Gerät holt ihn beim nächsten Abgleich. */
function listeCommit(stand, nachricht) {
  const neu = { ...stand, rev: sg.liste().rev + 1 };
  sz.version++;
  sz.sha = `sha${sz.version}`;
  sz.datei = alsDatei(neu);
  sz.fassungen[`k${sz.version}`] = sz.datei;
  sz.commits.unshift({ sha: `k${sz.version}`, message: nachricht, date: new Date().toISOString(), pfad: 'liste.json' });
}
const KLEIDUNG = { id: 'sl-kleid001', name: 'Kleidung', bild: 'womans-clothes', reihe: 1 };
const ROCK = { id: 'sd-rock0001', liste: KLEIDUNG.id, name: 'Rock', marke: 'Zara', reihe: 1 };
// liste.json: Tobi, dann Amy mit einer älteren App-Fassung – ihre Sachen stehen noch hier
let sl = anwenden(leer(), opPerson('Tobi'));
sl.rev = 1;
sz.fassungen.k1 = alsDatei(sl);
sl = anwenden(sl, [opPerson('Amy'), opInvListe(KLEIDUNG, 'Amy', vor(400)), opDing(ROCK, 'Amy', vor(400))]);
sl.rev = 2;
sz.fassungen.k2 = alsDatei(sl);
sz.datei = sz.fassungen.k2;
sz.version = 2;
sz.sha = 'sha2';
sz.commits.push(
  { sha: 'k2', message: 'Amy: Einkaufsliste, 1 Änderung – zum ersten Mal dabei', date: vor(400), pfad: 'liste.json' },
  { sha: 'k1', message: 'Tobi: Einkaufsliste, 1 Änderung – zum ersten Mal dabei', date: vor(500), pfad: 'liste.json' },
);
// sperre: GitHub nimmt sachen.json gerade nicht (503) – dann bleibt, was noch in liste.json steht, dort
// veraltet: GitHub liefert sachen.json roh in einer älteren Fassung (Text) oder gar nicht (404), wie direkt nach dem Schreiben
const sx = { sperre: false, gesperrt: 0, roh: 0, ref: 0, veraltet: null };
async function sachenRoute(r) {
  const q = r.request();
  if (q.url().split('?')[0] === `${sg.basis}/contents/sachen.json`) {
    if (q.method() === 'PUT' && sx.sperre) {
      sx.gesperrt++;
      return r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"message":"Service Unavailable"}' });
    }
    if (q.method() === 'GET' && new URL(q.url()).searchParams.get('ref')) sx.ref++;
    // Roh, ohne ref: so holt das Dashboard sachen.json, wie sie jetzt ist (der Umzug holt sie als JSON mit sha)
    else if (q.method() === 'GET' && /raw/.test(q.headers().accept || '')) {
      sx.roh++;
      if (sx.veraltet === 404) return r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"message":"Not Found"}' });
      if (sx.veraltet) return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/vnd.github.raw+json; charset=utf-8' }, body: sx.veraltet });
    }
  }
  return sg.route(r);
}
const sTobi = await handy(browser, { attrappe: { route: sachenRoute } });
const st = sTobi.page;
await st.evaluate((k) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })); localStorage.setItem('__umzugPause', '300'); }, SCHLUESSEL);
await st.reload();
await st.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await st.locator('#sync-text').innerText()) === 'Geteilt'), 'Sachen-App: Tobi ist verbunden');
// Tobis Gerät zieht Amys Sachen um – je ein Commit an sachen.json und an liste.json
check(await bis(() => !!sg.datei('sachen.json')?.inventar?.dinge?.[ROCK.id] && !Object.keys(sg.liste()?.inventar?.dinge || {}).length && sz.nachrichten.includes(UMZUG_LISTE), 10000), `Umzug: der Rock steht in sachen.json, nicht mehr in liste.json (${sz.nachrichten.join(' | ')})`);
// Amy, eben: Äpfel auf die Einkaufsliste – und in der Sachen-App ein Sommerkleid dazu, beim Rock Notiz und Tags
listeCommit(anwenden(sg.liste(), opEigener('c-aepfel', 'Äpfel', 'obst')), 'Amy: Einkaufsliste, 1 Änderung – Äpfel auf die Liste');
const sVorher = sachenBereinigen(sg.datei('sachen.json'));
const sPaket = [opDing({ id: 'sd-kleid001', liste: KLEIDUNG.id, name: 'Sommerkleid', marke: 'Zara', tags: ['Sommer'], reihe: 2 }, 'Amy'), opDing({ ...ROCK, notiz: 'Größe 36, zur Reinigung', tags: ['Büro'] }, 'Amy')];
const sNachher = sachenAnwenden(sVorher, sPaket);
sNachher.rev = sVorher.rev + 1;
const sNachricht = sachenNachricht(sPaket, sVorher, sNachher, { name: 'Amy' });
check(sNachricht === 'Amy: Sachen, 2 Änderungen', `So schreibt die Sachen-App: „${sNachricht}“`);
const sSha = sachenCommit(sg, sNachher, sNachricht);

await st.click('.tabbar .tab[data-tab="einstellungen"]');
await st.click('[data-act="ub-oeffnen"]');
check(await bis(async () => (await st.locator('#ueberblick-dlg .ub-person').count()) >= 2), 'Sachen-App: die Personen');
const sKarten = await st.locator('#ueberblick-dlg .ub-person .ub-wer b').allInnerTexts();
check(sKarten.length === 2 && sKarten.filter((k) => k === 'Amy').length === 1 && sKarten.includes('Tobi'), `Amy steht einmal da – sachen.json ist keine eigene Liste (${sKarten.join(', ')})`);
const sAmyKarte = (await st.locator('#ueberblick-dlg .ub-person', { hasText: 'Amy' }).innerText()).replace(/\s+/g, ' ');
check(/eure Liste/.test(sAmyKarte) && /\b4 Änderungen/.test(sAmyKarte) && /Sachen 1/.test(sAmyKarte) && /Einkauf 1/.test(sAmyKarte), `Amys Karte: der Commit der Sachen-App zählt mit 2 Änderungen, im Bereich Sachen (${sAmyKarte})`);
const sVerlauf = async () => (await st.locator('#ueberblick-dlg .ub-verlauf').innerText().catch(() => '')).replace(/\s+/g, ' ');
const sDet = await bis(async () => { const v = await sVerlauf(); return v.includes('Dazu: Sommerkleid (Zara) – Kleidung') && v.includes('Auf die Liste: Äpfel') ? v : null; }, 10000);
check(sDet, `Einzelheiten aus beiden Dateien in einer Sitzung (${sDet ? '' : (await sVerlauf()).slice(0, 500)})`);
check(sDet && sDet.includes('Geändert: Rock (Zara): Notiz, Tags') && !sDet.includes('Größe 36'), 'Einzelheiten: „Geändert: Rock (Zara): Notiz, Tags“ – nicht, was in der Notiz steht');
check(sDet && /Äpfel auf die Liste, Sachen \(3\)/.test(sDet), `Die Sitzung: „Äpfel auf die Liste, Sachen (3)“ (${(sDet || '').slice(0, 200)})`);
const sGemerkt = await st.evaluate((sha) => JSON.parse(localStorage.getItem('boxenstopp.einzelheiten.v1')).d[sha], sSha);
check(sx.ref >= 1 && Array.isArray(sGemerkt) && sGemerkt.length > 0 && sGemerkt.every((e) => e.b === 'Sachen'), `Die Einzelheiten zum Commit der Sachen-App: aus sachen.json mit ?ref=, nur Sachen (${sx.ref} Abrufe, ${JSON.stringify(sGemerkt)})`);
const sAlles = (await st.locator('#ueberblick-dlg').innerText()).replace(/\s+/g, ' ');
check(/Eure Liste, automatisch: 1× Sachen umgezogen\./.test(sAlles), `Der Umzug: „1× Sachen umgezogen“ – zwei Commits, einmal gezählt (${(sAlles.match(/automatisch:[^.]*\./) || [''])[0]})`);
check(!(await st.locator('#ueberblick-dlg .zugang-fehler').count()) && !sAlles.includes('Amys Sachen'), 'Kein Fehler, keine eigene Karte für sachen.json');
const sVerlaufGemerkt = await st.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.verlauf.v1')));
// Je Datei ihr eigener Verlauf: in „haupt“ die Commits an liste.json, in „haupt:sachen“ die an sachen.json (Umzug, Sachen-App)
const shasVon = (pfad) => sz.commits.filter((c) => c.pfad === pfad).map((c) => c.sha).sort().join();
const gemerkteShas = (id) => (sVerlaufGemerkt[id] || []).map((e) => e.sha).sort().join();
check(gemerkteShas('haupt') === shasVon('liste.json') && gemerkteShas('haupt:sachen') === shasVon('sachen.json') && sVerlaufGemerkt['haupt:sachen'].length === 2 && sVerlaufGemerkt['haupt:sachen'].some((e) => e.sha === sSha), `Verlauf je Datei gemerkt (liste.json ${sVerlaufGemerkt.haupt?.length}, sachen.json ${sVerlaufGemerkt['haupt:sachen']?.length})`);

// Eine ältere App-Fassung legt Amy noch einen Gürtel in liste.json – und GitHub nimmt sachen.json gerade nicht
sx.sperre = true;
listeCommit(anwenden(sg.liste(), opDing({ id: 'sd-guert001', liste: KLEIDUNG.id, name: 'Gürtel', marke: 'Mango', reihe: 3 }, 'Amy')), 'Amy: Einkaufsliste, 1 Änderung – Sachen');
check(await bis(() => sx.gesperrt > 0, 8000) && !!sg.liste().inventar?.dinge?.['sd-guert001'] && !sg.datei('sachen.json').inventar.dinge['sd-guert001'], 'Tobis Gerät will den Gürtel umziehen – geht gerade nicht, er bleibt in liste.json');
const sRoh0 = sx.roh;
await st.click('#ueberblick-dlg [data-ub-reiter="amy"]');
const sTeil = async () => (await st.locator('#ueberblick-dlg .ub-teil', { has: st.locator('h3', { hasText: /^Sachen/ }) }).innerText().catch(() => '')).replace(/\s+/g, ' ');
const sAmys = await bis(async () => { const x = await sTeil(); return x.includes('Sommerkleid') && x.includes('Gürtel') ? x : null; }, 8000);
check(sAmys && sAmys.includes('Rock') && sAmys.includes('Größe 36') && sAmys.includes('Mango') && sAmys.includes('Kleidung') && !sAmys.includes('Holt'), `Amys Reiter: die Sachen aus sachen.json und der Gürtel, der noch in liste.json steht (${(sAmys || await sTeil()).slice(0, 300)})`);
check(await st.locator('#ueberblick-dlg .ub-kachel', { hasText: 'Sachen' }).innerText().then((k) => /^3\s/.test(k)) && sx.roh === sRoh0 + 1, `Kachel „3 Sachen“; sachen.json einmal geholt, wie sie jetzt ist (${sx.roh - sRoh0})`);
check((await st.locator('#ueberblick-dlg .ub-panel').innerText()).includes('die Sachen aus ihrer Sachen-App'), 'Darunter: die Sachen aus ihrer Sachen-App');
// GitHub nimmt sachen.json wieder: Der Gürtel zieht um – im Reiter bleibt er die ganze Zeit
const sGesehen = [];
const sBeob = setInterval(async () => { try { sGesehen.push((await sTeil()).includes('Gürtel')); } catch { /* egal */ } }, 100);
sx.sperre = false;
check(await bis(() => !!sg.datei('sachen.json').inventar.dinge['sd-guert001'] && !sg.liste().inventar?.dinge?.['sd-guert001'], 10000), 'GitHub geht wieder: der Gürtel ist in sachen.json, nicht mehr in liste.json');
// Noch gut eine Sekunde danach: Tobis Gerät hat liste.json ohne den Gürtel, sachen.json ist noch nicht neu geholt
const sBisher = sGesehen.length;
await bis(() => sGesehen.length >= sBisher + 10);
clearInterval(sBeob);
check(sGesehen.length > 0 && sGesehen.every(Boolean), `Der Gürtel bleibt im Reiter, während er umzieht (${sGesehen.filter((g) => !g).length}× weg)`);
// Neu holen: sachen.json kommt neu – jetzt mit dem Gürtel
const sRoh1 = sx.roh;
await st.click('#ueberblick-dlg .ub-panel [data-act="ub-neu"]');
check(await bis(() => sx.roh > sRoh1) && await bis(async () => (await sTeil()).includes('Gürtel') && (await st.locator('#ueberblick-dlg .ub-panel').innerText()).includes('Neu holen')), 'Neu holen: sachen.json kommt neu, der Gürtel steht drin');
// Noch einmal „Neu holen“ – GitHub liefert aber eine ältere Fassung von sachen.json (die vom ersten Umzug, kleineres rev):
// Sie ersetzt den bekannten Stand nicht, nichts verschwindet
const sErster = sz.commits.filter((c) => c.pfad === 'sachen.json').at(-1);
const sAlt = JSON.parse(sz.fassungen[sErster.sha]);
check(sErster.message.startsWith('Umzug: Sachen aus der Liste') && sAlt.rev < sg.datei('sachen.json').rev && !sAlt.inventar.dinge['sd-kleid001'] && !sAlt.inventar.dinge['sd-guert001'], `die ältere Fassung: rev ${sAlt.rev} (jetzt ${sg.datei('sachen.json').rev}), ohne Sommerkleid und Gürtel`);
const sAllesDa = async () => { const x = await sTeil(); return ['Sommerkleid', 'Gürtel', 'Rock', 'Größe 36', 'Mango'].every((w) => x.includes(w)) && /^3\s/.test(await st.locator('#ueberblick-dlg .ub-kachel', { hasText: 'Sachen' }).innerText()); };
const sFertig = async () => (await st.locator('#ueberblick-dlg .ub-panel').innerText()).includes('Neu holen');
for (const [veraltet, wie] of [[sz.fassungen[sErster.sha], 'eine ältere Fassung (kleineres rev)'], [404, 'ein 404 (direkt nach dem Schreiben)']]) {
  sx.veraltet = veraltet;
  const sRohV = sx.roh;
  await st.click('#ueberblick-dlg .ub-panel [data-act="ub-neu"]');
  check(await bis(() => sx.roh > sRohV) && await bis(sFertig), `Neu holen: GitHub liefert ${wie}`);
  await st.waitForTimeout(300);
  check(await sAllesDa() && !(await st.locator('#ueberblick-dlg .zugang-fehler').count()), `… nichts verschwindet: Sommerkleid, Gürtel, der Rock mit Notiz, „3 Sachen“ (${(await sTeil()).slice(0, 300)})`);
}
sx.veraltet = null;
const sRoh4 = sx.roh;
await st.click('#ueberblick-dlg .ub-panel [data-act="ub-neu"]');
check(await bis(() => sx.roh > sRoh4) && await bis(sFertig) && await sAllesDa(), 'Und wieder richtig geholt: alles da');
await st.click('[data-act="ub-zu"]');
// Ohne sachen.json (noch nichts umgezogen): kein Fehler, „Noch keine Sachen.“
const sSicher = sz.dateien['sachen.json'];
delete sz.dateien['sachen.json'];
const sRoh2 = sx.roh;
await st.click('[data-act="ub-oeffnen"]');
await st.click('#ueberblick-dlg [data-ub-reiter="amy"]');
const sLeer = await bis(async () => { const x = await sTeil(); return x.includes('Noch keine Sachen.') ? x : null; }, 8000);
check(sLeer && !sLeer.includes('Sommerkleid') && sx.roh === sRoh2 + 1 && !(await st.locator('#ueberblick-dlg .zugang-fehler').count()), `Ohne sachen.json: „Noch keine Sachen.“, kein Fehler (${(sLeer || await sTeil()).slice(0, 200)})`);
sz.dateien['sachen.json'] = sSicher;
await st.click('[data-act="ub-zu"]');
check(sTobi.fehler.length === 0, `Sachen-App: keine Fehler bei Tobi (${sTobi.fehler.join(' | ')})`);
await sTobi.ctx.close();

// --- Wem das Dashboard etwas zeigt, erfährt es einmal: ein Gast, der das Willkommen schon kennt …
const gastAlt = await handy(browser, { attrappe: beide, hinweise: true });
const ga = gastAlt.page;
await ga.evaluate(() => { localStorage.setItem('boxenstopp.willkommen.v1', 'true'); localStorage.setItem('__hinweis', '300'); });
await ga.click('.tabbar .tab[data-tab="einstellungen"]');
await ga.fill('#z-token', zweit);
await ga.dispatchEvent('#z-token', 'input');
await ga.click('#z-los');
check(await bis(() => ga.evaluate(() => document.querySelector('#dash-hinweis-dlg')?.open), 8000), 'Gast mit älterer App: einmal der Hinweis aufs Dashboard');
const gaText = (await ga.locator('#dash-hinweis-dlg').innerText()).replace(/\s+/g, ' ');
check(gaText.includes('Tobi hat jetzt ein Dashboard') && gaText.includes('deine Sachen mit Fotos') && gaText.includes('Nur zum Ansehen') && gaText.includes('Was du der KI schreibst und was du verträgst, zeigt es ihm nicht'), 'Hinweis für den Gast: was Tobi sieht und was nicht');
await ga.click('#dash-hinweis-dlg .btn-primary');
check(!(await ga.evaluate(() => document.querySelector('#dash-hinweis-dlg').open)) && await ga.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.dashboard.hinweis.v1')) === true), '„Alles klar“ schließt, gemerkt');
await ga.click('.tabbar .tab[data-tab="amy"]');
await ga.click('[data-amy-teil="sachen"]');
check(await bis(async () => (await ga.locator('.inv-fein').innerText().catch(() => '')).includes('Tobi sieht deine Sachen in seinem Dashboard')), 'Bei ihren Sachen steht es auch');
await ga.reload();
await ga.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await ga.waitForTimeout(1500);
check(!(await ga.evaluate(() => document.querySelector('#dash-hinweis-dlg').open)), 'Nach dem Neuladen kein zweites Mal');
check(gastAlt.fehler.length === 0, `Gast mit älterer App: keine Fehler (${gastAlt.fehler.join(' | ')})`);
await gastAlt.ctx.close();
// … Amy in eurer Liste – Tobi nicht
const amyH = await handy(browser, { attrappe: beide, hinweise: true });
const ah = amyH.page;
await ah.evaluate((k) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Amy' })); localStorage.setItem('__hinweis', '300'); }, SCHLUESSEL);
await ah.reload();
await ah.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(() => ah.evaluate(() => document.querySelector('#dash-hinweis-dlg')?.open), 8000), 'Amy: einmal der Hinweis aufs Dashboard');
const ahText = (await ah.locator('#dash-hinweis-dlg').innerText()).replace(/\s+/g, ' ');
check(ahText.includes('Sachen, Notizen, Rezepte, Vorschläge') && ahText.includes('Das sieht er in der App ohnehin') && ahText.includes('Einstellungen → Gäste & Überblick → Dashboard') && await ah.evaluate(() => document.querySelector('#dash-hinweis-dlg').classList.contains('amy-thema')), 'Hinweis für Amy, in Rosa');
check(!(await ah.evaluate(() => document.querySelector('#sachen-hinweis-dlg')?.open)), 'Der Hinweis auf die Sachen-App wartet, solange der aufs Dashboard offen ist');
await ah.click('#dash-hinweis-dlg [data-act="dash-hinweis-zu"]');
// Ein paar Sekunden danach der zweite: Sachen ist jetzt eine eigene App (ansicht-sachen-app.js) – nie zwei Fenster zugleich
check(await bis(() => ah.evaluate(() => document.querySelector('#sachen-hinweis-dlg')?.open), 8000) && !(await ah.evaluate(() => document.querySelector('#dash-hinweis-dlg').open)), 'Amy: danach der Hinweis auf die Sachen-App');
check((await ah.locator('#sachen-hinweis-dlg').innerText()).includes('Sachen ist jetzt eine eigene App') && await ah.locator('#sachen-hinweis-dlg [data-act="sachen-app"]').count() === 1, 'Sachen-Hinweis: „Sachen ist jetzt eine eigene App“, mit „Sachen öffnen“');
await ah.click('#sachen-hinweis-dlg .btn-quiet');
check(!(await ah.evaluate(() => document.querySelector('#sachen-hinweis-dlg').open)) && await ah.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.sachen.hinweis.v1')) === true), '„Später“ schließt ihn, gemerkt');
await ah.click('.tabbar .tab[data-tab="einstellungen"]');
await ah.click('[data-act="ub-oeffnen"]');
check(await bis(() => ah.evaluate(() => document.querySelector('#ueberblick-dlg')?.open)) && !(await ah.locator('#ueberblick-dlg [data-ub-reiter]').count()) && (await ah.locator('#ueberblick-dlg').innerText()).includes('Wer wann was gemacht hat'), 'Amys Dashboard: die Aktivität – kein Reiter für sie selbst');
check(amyH.fehler.length === 0, `Amy: keine Fehler (${amyH.fehler.join(' | ')})`);
await amyH.ctx.close();
const tobiH = await handy(browser, { attrappe: beide, hinweise: true });
const th = tobiH.page;
await th.evaluate((k) => { localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })); localStorage.setItem('__hinweis', '300'); }, SCHLUESSEL);
await th.reload();
await th.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await bis(async () => (await th.locator('#sync-text').innerText()) === 'Geteilt');
// Die Hinweise kämen 2,5 s nach dem Abgleich und dann nach __hinweis (300 ms) – so lange warten
await th.waitForTimeout(3500);
check(!(await th.evaluate(() => document.querySelector('#dash-hinweis-dlg').open || localStorage.getItem('boxenstopp.dashboard.hinweis.v1'))), 'Tobi bekommt keinen Hinweis – es ist sein Dashboard');
check(!(await th.evaluate(() => document.querySelector('#sachen-hinweis-dlg').open || localStorage.getItem('boxenstopp.sachen.hinweis.v1'))), 'Tobi bekommt auch den Hinweis auf die Sachen-App nicht – es sind Amys Sachen');
await tobiH.ctx.close();

await browser.close();
ende();
