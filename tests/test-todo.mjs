/*
 * Microsoft To Do für den Putzplan: werkzeug/todo.mjs gegen eine Attrappe
 * von Microsoft (tests/microsoft-attrappe.mjs) – so, wie haushalt.yml es im
 * Daten-Repo laufen lässt: Code holen, warten, abgleichen, nachtragen. Mit
 * Amys Woche: die Küche montags und donnerstags (beide), das Bad samstags
 * (Amy), der Flur montags (Tobi), ein Großputz ohne festen Tag.
 *
 * Danach die Karte „Microsoft To Do“ in den Einstellungen: App-ID, verbinden
 * (der Wunsch steht in liste.json, mit „· To Do“), der Code aus todo.json,
 * verbunden, trennen.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, ROOT, APP_URL, SCHLUESSEL } from './hilfe.mjs';
import { microsoftAttrappe } from './microsoft-attrappe.mjs';
import { leer, anwenden, bereinigen, opPlan, opPutzHaken, opTodoApp, opTodoWunsch, opTodoZiel, todoNoetig } from '../js/liste.js';

const { check, ende } = pruefer();
const TODO = path.join(ROOT, 'werkzeug', 'todo.mjs');
const APP_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ms = await microsoftAttrappe({ app: APP_ID });
const tmp = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-todo-'));
const daten = path.join(tmp, 'daten');
mkdirSync(daten, { recursive: true });
const ausgabe = path.join(tmp, 'github-output');
let protokoll = '';

const MO = '2026-11-02T08:00:00Z';
const DO = '2026-11-05T08:00:00Z';
const MO2 = '2026-11-09T08:00:00Z';

/* ------------------------------------------------------- liste.json wie die App */

const lies = (f) => JSON.parse(readFileSync(path.join(daten, f), 'utf8'));
const liste = () => bereinigen(lies('liste.json'));
/** Was die App tut: Ops auf liste.json, rev + 1 – und ob sie „· To Do“ schreiben würde. */
function appSchreibt(...ops) {
  const vor = existsSync(path.join(daten, 'liste.json')) ? liste() : leer();
  let s = vor;
  for (const op of ops) s = anwenden(s, op);
  s.rev = (vor.rev || 0) + 1;
  writeFileSync(path.join(daten, 'liste.json'), `${JSON.stringify(s, null, 1)}\n`);
  return todoNoetig(vor, s);
}
const KUECHE = { name: 'Küche', raum: 'kueche', aufgaben: [{ id: 'a-1', t: 'Arbeitsflächen abwischen' }, { id: 'a-2', t: 'Herd putzen' }, { id: 'a-3', t: 'Boden wischen' }], wdh: { tage: [1, 4], wochen: 1, ab: '2026-10-01' }, wer: '', erinnern: 'morgens' };
appSchreibt(
  opPlan('pp-kueche', KUECHE, 'Tobi'),
  opPlan('pp-bad', { name: 'Bad', raum: 'bad', aufgaben: [{ id: 'a-1', t: 'Spiegel' }], wdh: { tage: [6], wochen: 1, ab: '2026-10-01' }, wer: 'Amy', erinnern: 'morgens' }, 'Tobi'),
  opPlan('pp-flur', { name: 'Flur', raum: 'flur', aufgaben: [{ id: 'a-1', t: 'Saugen' }], wdh: { tage: [1], wochen: 1, ab: '2026-10-01' }, wer: 'Tobi', erinnern: 'abends' }, 'Tobi'),
  opPlan('pp-gross', { name: 'Großputz', raum: 'wohnung', aufgaben: [{ id: 'a-1', t: 'Fenster' }], wdh: { tage: [], wochen: 1, ab: '' }, wer: '', erinnern: '' }, 'Tobi'),
);

/* ------------------------------------------------------------ Läufe */

function node(args, env = {}) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [TODO, ...args], { env: { ...process.env, TODO_ANMELDUNG: ms.anmeldung, TODO_GRAPH: ms.graph, TODO_SCHLUESSEL: 'test-geheimer-vapid-schluessel', TODO_TAKT_MS: '15', GITHUB_OUTPUT: ausgabe, ...env } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => { protokoll += out; ok({ code, out }); });
  });
}
/** Ein Lauf von haushalt.yml: frisches Arbeitsverzeichnis, Code holen, (Code zeigen,) warten, abgleichen, einchecken. */
async function workflow(jetzt, env = {}, { nachCode = null } = {}) {
  const arbeit = mkdtempSync(path.join(tmp, 'lauf-'));
  writeFileSync(ausgabe, '');
  const a = await node(['--daten', daten, '--arbeit', arbeit, '--anmelden', '--jetzt', jetzt], env);
  const warten = /warten=ja/.test(readFileSync(ausgabe, 'utf8'));
  if (warten) {
    await node(['--daten', daten, '--arbeit', arbeit, '--nachtragen'], env);
    if (nachCode) await nachCode();
    await node(['--daten', daten, '--arbeit', arbeit, '--warten', '--jetzt', jetzt], env);
  }
  const b = await node(['--daten', daten, '--arbeit', arbeit, '--abgleichen', '--jetzt', jetzt], env);
  const c = await node(['--daten', daten, '--arbeit', arbeit, '--nachtragen'], env);
  return { warten, codes: [a.code, b.code, c.code], out: a.out + b.out + c.out, arbeit };
}
const todo = () => (existsSync(path.join(daten, 'todo.json')) ? lies('todo.json') : null);
// Die Küche in Amys To Do (das Bad vom Samstag steht auch drin – noch offen)
const amy = () => ms.aufgaben('amy').filter((x) => x.title.startsWith('Küche'));
const offene = (n) => ms.aufgaben(n).filter((a) => a.status !== 'completed' && (n !== 'amy' || a.title.startsWith('Küche')));
const schritt = (a, t) => a.schritte.find((x) => x.displayName === t);

/* ------------------------------------------------------- ohne To Do: nichts */

let w = await workflow(MO);
check(w.codes.every((c) => c === 0) && !w.warten, 'ohne Wunsch: läuft durch, wartet nicht');
check(ms.z.aufrufe.length === 0 && ms.z.anmeldungen.length === 0, 'ohne Wunsch: kein einziger Aufruf bei Microsoft');
check(!existsSync(path.join(daten, 'todo.json')), 'ohne Wunsch: keine todo.json');

/* ----------------------------------------------------------- verbinden */

check(appSchreibt(opTodoApp(APP_ID)) === false, 'App-ID eintragen: noch kein „· To Do“ (niemand will verbinden)');
check(appSchreibt(opTodoWunsch('Amy', 'verbinden')) === true, '„Verbinden“: die App schreibt „· To Do“');
const wunschAt = liste().haushalt.todoWunsch.amy.at;
ms.z.naechste.push({ konto: 'amy', warten: 2 });
let codeImRepo = null;
w = await workflow(MO, {}, { nachCode: async () => { codeImRepo = todo(); } });
check(w.warten && w.codes.every((c) => c === 0), 'Code geholt, gewartet, abgeglichen – ohne Fehler');
check(codeImRepo?.personen?.amy?.status === 'code' && /^C\d{3}-XYZ$/.test(codeImRepo.personen.amy.code) && codeImRepo.personen.amy.url === 'https://www.microsoft.com/link' && Date.parse(codeImRepo.personen.amy.bis) > Date.now(), 'mittendrin steht der Code mit Adresse in todo.json (die App zeigt ihn)');
check(!JSON.stringify(codeImRepo).includes('dev'), 'der Gerätecode steht nicht im Repo');
const anm = ms.z.anmeldungen.filter((x) => x.endpunkt === 'devicecode');
check(anm.length === 1 && anm[0].client === APP_ID && /Tasks\.ReadWrite/.test(anm[0].scope) && /offline_access/.test(anm[0].scope), 'Gerätecode mit der App-ID und Tasks.ReadWrite offline_access');
let t = todo();
check(t.personen.amy.status === 'verbunden' && t.personen.amy.name === 'Amy' && t.personen.amy.wunsch === wunschAt, 'danach: Amy verbunden, der Wunsch erledigt');
check(/^v1\.[A-Za-z0-9_-]+$/.test(t.personen.amy.token) && !ms.z.ausgegeben.some((x) => JSON.stringify(t).includes(x)), 'der Erneuerungs-Token steht nur verschlüsselt drin – kein Token, kein Code im Klartext');
check(!ms.z.ausgegeben.some((x) => protokoll.includes(x)), 'im Protokoll kein Token und kein Code');
check(liste().haushalt.todoAn.amy && liste().rev >= 4, 'in liste.json: Amy ist verbunden (todoAn), rev hoch');
check(t.personen.amy.wahl === true && t.personen.amy.listen.map((l) => l.name).join() === 'Aufgaben' && !ms.haushalt('amy'), 'erst die Wahl: Amys Listen stehen in todo.json (ihre Standardliste), angelegt ist noch nichts');
check(appSchreibt(opTodoZiel('Amy', 'neu', 'Haushalt', false)) === true, 'Amy wählt „Neue Liste Haushalt“: „· To Do“');
w = await workflow(MO);
t = todo();
check(t.personen.amy.wahl === false && t.personen.amy.listeName === 'Haushalt' && t.personen.amy.geteilt === false, 'übernommen: die Liste „Haushalt“, nicht geteilt');
let a = amy();
const alle = ms.aufgaben('amy');
check(ms.haushalt('amy') && a.length === 1 && a[0].status === 'notStarted' && alle.map((x) => x.title).sort().join() === 'Bad,Küche', 'in Amys To Do: Liste „Haushalt“ mit der Küche (heute) und dem Bad (seit Samstag offen) – nicht Flur (Tobi), nicht Großputz (ohne Tag)');
check(alle.find((x) => x.title === 'Bad')?.dueDateTime?.dateTime.startsWith('2026-10-31'), 'das Bad: fällig Samstag – in To Do also überfällig');
check(a[0].dueDateTime?.dateTime === '2026-11-02T00:00:00.0000000' && a[0].dueDateTime.timeZone === 'UTC', 'fällig am Montag, Mitternacht UTC (To Do zeigt den Tag ohne Umrechnung)');
check(a[0].schritte.map((x) => x.displayName).join('|') === 'Arbeitsflächen abwischen|Herd putzen|Boden wischen' && a[0].schritte.every((x) => !x.isChecked), 'die Aufgaben als Schritte, nichts abgehakt');
check(/Boxenstopp/.test(a[0].body?.content || ''), 'in der Notiz: aus dem Putzplan in Boxenstopp');

/* --------------------------------------------------------- hin und her */

schritt(amy()[0], 'Arbeitsflächen abwischen').isChecked = true;
w = await workflow(MO);
let st = liste().haushalt.stand['pp-kueche'];
check(st?.datum === '2026-11-02' && st.haken.join() === 'a-1', 'in To Do abgehakt → in der App abgehakt (Montag)');
check(amy().length === 1 && schritt(amy()[0], 'Arbeitsflächen abwischen').isChecked, 'in To Do bleibt es abgehakt, keine zweite Aufgabe');

check(appSchreibt(opPutzHaken('pp-kueche', '2026-11-02', 'a-2', true, 'Tobi')) === true, 'Tobi hakt in der App ab: „· To Do“ (Amy ist verbunden)');
w = await workflow(MO);
check(schritt(amy()[0], 'Herd putzen').isChecked, 'in der App abgehakt → in To Do abgehakt');

// Gleichzeitig: Amy hakt in To Do „Boden“ ab, Tobi nimmt in der App „Arbeitsflächen“ zurück
schritt(amy()[0], 'Boden wischen').isChecked = true;
appSchreibt(opPutzHaken('pp-kueche', '2026-11-02', 'a-1', false, 'Tobi'));
w = await workflow(MO);
st = liste().haushalt.stand['pp-kueche'];
check(st.haken.slice().sort().join() === 'a-2,a-3' && !st.fertig, 'beides kommt an: in der App Herd und Boden');
check(!schritt(amy()[0], 'Arbeitsflächen abwischen').isChecked && schritt(amy()[0], 'Boden wischen').isChecked, '… und in To Do auch');

// Amy hakt die ganze Aufgabe in To Do ab
amy()[0].status = 'completed';
ms.haushalt('amy').aufgaben[amy()[0].id].status = 'completed';
w = await workflow(MO);
st = liste().haushalt.stand['pp-kueche'];
check(st.fertig?.by === 'Amy' && st.haken.length === 3 && st.verlauf.some((v) => v[0] === '2026-11-02' && v[1] === 'Amy'), 'in To Do erledigt → in der App erledigt, von Amy');
check(amy().length === 1 && amy()[0].status === 'completed', 'in To Do bleibt sie erledigt');

/* ------------------------------------------------------ der nächste Tag */

w = await workflow(DO);
check(amy().length === 2 && offene('amy').length === 1 && offene('amy')[0].dueDateTime.dateTime.startsWith('2026-11-05') && offene('amy')[0].schritte.every((x) => !x.isChecked), 'Donnerstag: eine neue Aufgabe, frisch – die vom Montag bleibt erledigt');
const donnerstag = offene('amy')[0].id;
appSchreibt(opPutzHaken('pp-kueche', '2026-11-05', 'a-1', true, 'Tobi'));
w = await workflow(DO);
check(schritt(offene('amy')[0], 'Arbeitsflächen abwischen').isChecked, 'Donnerstag: Tobi hakt ab, steht in To Do');
// Donnerstag nicht fertig geworden – am nächsten Montag rückt dieselbe Aufgabe weiter
w = await workflow(MO2);
check(amy().length === 2 && offene('amy').length === 1 && offene('amy')[0].id === donnerstag && offene('amy')[0].dueDateTime.dateTime.startsWith('2026-11-09'), 'verpasst: dieselbe Aufgabe rückt auf Montag – keine zweite');
check(offene('amy')[0].schritte.every((x) => !x.isChecked), '… und fängt frisch an (keine Haken vom Donnerstag)');

/* --------------------------------------------------- in To Do gelöscht */

delete ms.haushalt('amy').aufgaben[donnerstag];
w = await workflow(MO2);
check(offene('amy').length === 0 && todo().personen.amy.aufgaben['pp-kueche'].weg === true, 'in To Do gelöscht: heute nicht wieder angelegt');
w = await workflow('2026-11-12T08:00:00Z');
check(offene('amy').length === 1 && offene('amy')[0].dueDateTime.dateTime.startsWith('2026-11-12'), 'am nächsten Putztag wieder da');
// Die ganze Liste gelöscht
const alteListe = ms.haushalt('amy').id;
delete ms.konto('amy').listen[alteListe];
w = await workflow('2026-11-12T09:00:00Z');
check(ms.haushalt('amy') && ms.haushalt('amy').id !== alteListe && offene('amy').length === 1 && offene('amy')[0].title === 'Küche', 'Liste „Haushalt“ gelöscht: neu angelegt, die Küche darin');

/* -------------------------------------------- der Putztag ändert sich */

appSchreibt(opPlan('pp-kueche', { ...KUECHE, name: 'Küchenputz', aufgaben: [...KUECHE.aufgaben.filter((x) => x.id !== 'a-2'), { id: 'a-4', t: 'Kühlschrank' }] }, 'Tobi'));
w = await workflow('2026-11-12T10:00:00Z');
a = offene('amy')[0];
check(a.title === 'Küchenputz' && a.schritte.map((x) => x.displayName).join('|') === 'Arbeitsflächen abwischen|Boden wischen|Kühlschrank', 'umbenannt, „Herd“ raus, „Kühlschrank“ dazu – in To Do genauso');
// Material in die Notiz; „jedes 2. Mal“ nur als Schritt, wenn es dran ist. Ab dem 2.10. ist der 12.11. der
// zwölfte Putztag (gezählt ab 0: 11 – ungerade), ab dem 1.10. der dreizehnte (12 – gerade)
const MIT = { ...KUECHE, name: 'Küchenputz', aufgaben: [...KUECHE.aufgaben.filter((x) => x.id !== 'a-2'), { id: 'a-4', t: 'Kühlschrank', jedes: 2 }], material: ['Spülmittel', 'Schwamm'] };
appSchreibt(opPlan('pp-kueche', { ...MIT, wdh: { ...KUECHE.wdh, ab: '2026-10-02' } }, 'Tobi'));
w = await workflow('2026-11-12T10:20:00Z');
a = offene('amy')[0];
check(/^Das brauchst du: Spülmittel, Schwamm\n\nAus dem Putzplan in Boxenstopp/.test(a.body?.content || ''), 'Material dazu: steht oben in der Notiz der Aufgabe');
check(a.schritte.map((x) => x.displayName).join('|') === 'Arbeitsflächen abwischen|Boden wischen', '„Kühlschrank jedes 2. Mal“, heute nicht dran: kein Schritt');
appSchreibt(opPlan('pp-kueche', MIT, 'Tobi'));
w = await workflow('2026-11-12T10:40:00Z');
a = offene('amy')[0];
check(a.schritte.map((x) => x.displayName).join('|') === 'Arbeitsflächen abwischen|Boden wischen|Kühlschrank' && /Spülmittel, Schwamm/.test(a.body?.content || ''), '… an einem Tag, an dem er dran ist: wieder ein Schritt');
const patches = ms.z.aufrufe.filter((x) => x.methode === 'PATCH' && /tasks\/[^/]+$/.test(x.pfad)).length;
w = await workflow('2026-11-12T10:50:00Z');
check(ms.z.aufrufe.filter((x) => x.methode === 'PATCH' && /tasks\/[^/]+$/.test(x.pfad)).length === patches, 'nichts geändert: die Notiz bleibt, wie sie ist (kein Schreiben)');
appSchreibt(opPlan('pp-kueche', { ...KUECHE, wer: 'Tobi' }, 'Tobi'));
w = await workflow('2026-11-12T11:00:00Z');
check(offene('amy').length === 0 && !todo().personen.amy.aufgaben['pp-kueche'], 'macht jetzt Tobi: aus Amys To Do weg');
appSchreibt(opPlan('pp-kueche', KUECHE, 'Tobi'));

/* -------------------------------------------- Microsoft hakt, Token läuft ab */

ms.z.bremse = 50;
w = await workflow('2026-11-12T12:00:00Z');
t = todo();
check(w.codes.every((c) => c === 0) && t.personen.amy.status === 'verbunden' && /nicht erreichbar/.test(t.personen.amy.fehler || ''), 'Microsoft bremst (429): verbunden bleibt, „der nächste Abgleich holt es nach“');
ms.z.bremse = 0;
w = await workflow('2026-11-12T13:00:00Z');
check(todo().personen.amy.fehler === null && offene('amy').length === 1, 'danach geht es weiter');
const zugang = ms.z.anmeldungen.filter((x) => x.grant === 'refresh_token').length;
check(zugang >= 10 && w.codes.every((c) => c === 0), `jeder Lauf mit dem neuesten Erneuerungs-Token (${zugang} Erneuerungen, jeder gilt nur einmal)`);

ms.z.gesperrt.add('amy');
w = await workflow('2026-11-12T14:00:00Z');
t = todo();
check(t.personen.amy.status === 'abgelaufen' && !t.personen.amy.token && /gilt nicht mehr/.test(t.personen.amy.fehler), 'Anmeldung gilt nicht mehr: abgelaufen, Token vergessen');
check(!liste().haushalt.todoAn.amy, '… und in liste.json nicht mehr verbunden');
const vorher = ms.z.aufrufe.length + ms.z.anmeldungen.length;
w = await workflow('2026-11-12T15:00:00Z');
check(ms.z.aufrufe.length + ms.z.anmeldungen.length === vorher, 'danach kein Aufruf mehr bei Microsoft – bis jemand neu verbindet');

/* ----------------------------------------- neu verbinden, Tobi auch, trennen */

ms.z.gesperrt.delete('amy');
appSchreibt(opTodoWunsch('Amy', 'verbinden'));
ms.z.naechste.push({ konto: 'amy', warten: 0 });
w = await workflow('2026-11-12T16:00:00Z');
check(todo().personen.amy.status === 'verbunden' && offene('amy').filter((x) => x.title === 'Küche').length === 2, 'wieder verbunden: die Küche von heute (die alte offene von vorher bleibt, wie sie war)');
appSchreibt(opTodoWunsch('Tobi', 'verbinden'));
ms.z.naechste.push({ konto: 'tobi', warten: 1 });
w = await workflow('2026-11-16T08:00:00Z');
check(todo().personen.tobi.wahl === true && !ms.haushalt('tobi'), 'Tobi verbunden: erst die Wahl, noch nichts angelegt');
appSchreibt(opTodoZiel('Tobi', 'neu', 'Haushalt', false));
w = await workflow('2026-11-16T08:00:00Z');
check(todo().personen.tobi.status === 'verbunden' && offene('tobi').map((x) => x.title).sort().join() === 'Flur,Küche', 'Tobi verbunden: bei ihm Küche (beide) und Flur (Tobi) – Montag');
check(offene('amy').filter((x) => x.dueDateTime.dateTime.startsWith('2026-11-16')).length === 1, 'bei Amy die Küche für Montag');
// Tobi hakt in seinem To Do die Küche ab → bei Amy im selben Lauf
const tk = offene('tobi').find((x) => x.title === 'Küche');
ms.haushalt('tobi').aufgaben[tk.id].status = 'completed';
w = await workflow('2026-11-16T09:00:00Z');
check(liste().haushalt.stand['pp-kueche'].fertig?.by === 'Tobi' && !offene('amy').some((x) => x.dueDateTime.dateTime.startsWith('2026-11-16')), 'Tobi erledigt in seinem To Do → in der App und in Amys To Do erledigt (im selben Lauf)');

// Donnerstag: bei Amy wieder die Küche – dann trennt sie
w = await workflow('2026-11-19T08:00:00Z');
const gemerkt = Object.values(todo().personen.amy.aufgaben).filter((x) => x.id && !x.erledigt && !x.weg).map((x) => x.id);
const da = (id) => Object.values(ms.haushalt('amy').aufgaben).some((x) => x.id === id);
check(gemerkt.length >= 1 && gemerkt.every(da), `Donnerstag: Amys offene Aufgaben (${gemerkt.length}) stehen in To Do`);
const erledigtBleibt = Object.values(ms.haushalt('amy').aufgaben).filter((x) => x.status === 'completed').map((x) => x.id);
check(appSchreibt(opTodoWunsch('Amy', 'trennen')) === true, '„Trennen“: „· To Do“');
w = await workflow('2026-11-19T09:00:00Z');
t = todo();
check(t.personen.amy.status === 'getrennt' && !t.personen.amy.token && !t.personen.amy.aufgaben, 'getrennt: kein Token, nichts gemerkt');
check(!gemerkt.some(da) && erledigtBleibt.every(da) && ms.haushalt('amy'), 'beim Trennen: die offenen Aufgaben weg – erledigte und die Liste bleiben');
check(!liste().haushalt.todoAn.amy && liste().haushalt.todoAn.tobi, 'in liste.json: Amy getrennt, Tobi weiter verbunden');

/* --------------------------------------------- was schiefgehen kann */

appSchreibt(opTodoWunsch('Amy', 'verbinden'));
ms.z.naechste.push({ konto: 'amy', warten: 1, art: 'abgelehnt' });
w = await workflow('2026-11-19T11:00:00Z');
check(todo().personen.amy.status === 'fehler' && /abgelehnt/.test(todo().personen.amy.fehler), 'Anmeldung abgelehnt: „abgelehnt“ – noch einmal verbinden');
appSchreibt(opTodoWunsch('Amy', 'verbinden'));
ms.z.oeffentlich = false;
w = await workflow('2026-11-19T11:30:00Z');
check(todo().personen.amy.status === 'fehler' && /Öffentliche Clientflows zulassen/.test(todo().personen.amy.fehler), 'bei Microsoft „Öffentliche Clientflows“ aus: der Fehler sagt, wo man es einschaltet');
ms.z.oeffentlich = true;
appSchreibt(opTodoWunsch('Amy', 'verbinden'));
const anmVorher = ms.z.anmeldungen.length;
w = await workflow('2026-11-19T12:00:00Z', { TODO_SCHLUESSEL: '' });
check(todo().personen.amy.status === 'fehler' && /VAPID_PRIVATE_KEY/.test(todo().personen.amy.fehler) && ms.z.anmeldungen.length === anmVorher + ms.z.anmeldungen.slice(anmVorher).filter((x) => x.grant === 'refresh_token').length, 'ohne Secret: kein Code, ein Satz, was fehlt');
const ohneSchluessel = await workflow('2026-11-19T12:30:00Z', { TODO_SCHLUESSEL: '' });
check(todo().personen.tobi.status === 'abgelaufen' && ohneSchluessel.codes.every((c) => c === 0), 'Secret weg: der gespeicherte Zugang lässt sich nicht lesen – abgelaufen statt Absturz');

// Nichts zu tun: liste.json bleibt, wie sie ist
const revVor = liste().rev;
await workflow('2026-11-19T13:00:00Z');
check(liste().rev === revVor, 'ohne Änderung: liste.json unverändert');
check(!ms.z.ausgegeben.some((x) => protokoll.includes(x)), 'im ganzen Protokoll kein Token und kein Code');

/* ------------------------------------- eine gemeinsame Liste (Tobi allein) */

const wir = ms.teilen('Wir zwei', 'tobi', 'amy');
appSchreibt(opTodoWunsch('Tobi', 'verbinden'));
ms.z.naechste.push({ konto: 'tobi', warten: 0 });
const MO3 = '2026-11-23T08:00:00Z';
w = await workflow(MO3);
t = todo();
const wirInfo = t.personen.tobi.listen.find((l) => l.name === 'Wir zwei');
check(t.personen.tobi.status === 'verbunden' && wirInfo?.geteilt === true && wirInfo.eigen === true && t.personen.tobi.listen.some((l) => l.name === 'Haushalt' && !l.geteilt), 'Tobi verbunden: seine Listen, „Wir zwei“ als gemeinsame');
// Seine Wahl von vorher („Haushalt“) gilt nach dem neuen Verbinden weiter – dort stehen jetzt Küche und Flur
const vorherOffen = Object.values(t.personen.tobi.aufgaben || {}).filter((x) => x.id && !x.erledigt && !x.weg).map((x) => x.id);
const inHaushalt = (id) => ms.aufgaben('tobi').some((x) => x.id === id && x.status !== 'completed');
check(vorherOffen.length === 2 && vorherOffen.every(inHaushalt), 'die frühere Wahl gilt weiter: Küche und Flur in Tobis „Haushalt“');
check(appSchreibt(opTodoZiel('Tobi', wirInfo.id, 'Wir zwei', true)) === true, 'Tobi wählt „Wir zwei“');
w = await workflow(MO3);
t = todo();
check(t.personen.tobi.geteilt === true && t.personen.tobi.listeName === 'Wir zwei', 'übernommen: gemeinsame Liste');
check(ms.aufgabenIn(wir).map((x) => x.title).sort().join() === 'Bad · Amy,Flur · Tobi,Küche', `in „Wir zwei“ alle Putztage, die dran sind – mit Namen, wer dran ist (${ms.aufgabenIn(wir).map((x) => x.title).join(', ')})`);
check(!vorherOffen.some(inHaushalt), 'umgezogen: die offenen aus Tobis „Haushalt“ sind dort weg');
check(Object.values(ms.konto('amy').listen).some((l) => l.id === wir.id) && ms.aufgabenIn(ms.konto('amy').listen[wir.id]).length === 3, 'Amy sieht dieselben Aufgaben in ihrem To Do (geteilte Liste) – ohne selbst verbunden zu sein');
// Amy hakt in der gemeinsamen Liste ab
const badWir = ms.aufgabenIn(wir).find((x) => x.title === 'Bad · Amy');
wir.aufgaben[badWir.id].schritte[badWir.schritte[0].id].isChecked = true;
const kuecheWir = ms.aufgabenIn(wir).find((x) => x.title === 'Küche');
wir.aufgaben[kuecheWir.id].status = 'completed';
w = await workflow('2026-11-23T09:00:00Z');
const hs = liste().haushalt.stand;
check(hs['pp-bad']?.fertig?.by === 'Amy' && hs['pp-bad'].datum === '2026-11-21', 'Amy hakt in der gemeinsamen Liste das Bad ab → in der App erledigt, von Amy (sie ist eingetragen)');
check(hs['pp-kueche']?.fertig && !hs['pp-kueche'].fertig.by && hs['pp-kueche'].datum === '2026-11-23', 'die Küche (beide) erledigt – von wem, sagt Microsoft nicht');
appSchreibt(opPlan('pp-flur', { name: 'Flur', raum: 'flur', aufgaben: [{ id: 'a-1', t: 'Saugen' }], wdh: { tage: [1], wochen: 1, ab: '2026-10-01' }, wer: 'Amy', erinnern: 'abends' }, 'Tobi'));
w = await workflow('2026-11-23T10:00:00Z');
check(ms.aufgabenIn(wir).some((x) => x.title === 'Flur · Amy' && x.status !== 'completed') && !ms.aufgabenIn(wir).some((x) => x.title === 'Flur · Tobi'), 'der Flur jetzt bei Amy: der Titel zieht nach („Flur · Amy“)');
// Die Liste wird nicht mehr geteilt (oder gelöscht): Tobi soll neu wählen
delete ms.konto('tobi').listen[wir.id];
const idsVor = ms.aufgaben('tobi').map((x) => x.id).sort().join();
w = await workflow('2026-11-23T11:00:00Z');
t = todo();
check(t.personen.tobi.wahl === true && /gibt es in To Do nicht mehr/.test(t.personen.tobi.fehler) && ms.aufgaben('tobi').map((x) => x.id).sort().join() === idsVor, `gemeinsame Liste weg: „gibt es nicht mehr – andere wählen“, nichts woanders angelegt (${t.personen.tobi.fehler})`);
ms.konto('tobi').listen[wir.id] = wir;
appSchreibt(opTodoZiel('Tobi', 'neu', 'Haushalt', false));
w = await workflow('2026-11-23T12:00:00Z');
check(!ms.aufgabenIn(wir).some((x) => x.status !== 'completed') && ms.aufgabenIn(wir).some((x) => x.status === 'completed'), 'zurück auf die eigene Liste: offene Aufgaben aus „Wir zwei“ weg, erledigte bleiben');
check(offene('tobi').every((x) => !x.title.includes('·')) && !offene('tobi').some((x) => x.title === 'Bad'), 'in Tobis „Haushalt“ nur seine und die gemeinsamen Putztage, ohne Namen im Titel');

await ms.stop();

/* ------------------------------------------------- die Karte in den Einstellungen */

const browser = await starteBrowser();
const gh = githubAttrappe();
const h = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const p = h.page;
await p.fill('#z-name', 'Amy');
await p.click('#z-los');
check(await bis(async () => (await p.locator('#sync-text').innerText()) === 'Geteilt', 8000), 'Amy: gemeinsame Liste eingerichtet');
await p.click('.tab[data-tab="einstellungen"]');
const karte = p.locator('#e-todo');
check(await karte.isVisible() && (await karte.innerText()).includes('App-ID'), 'Einstellungen: Karte „Microsoft To Do“ – erst die App-ID');
check(await p.locator('#e-todo details.todo-anleitung').count() === 1 && /Tasks\.ReadWrite[\s\S]*|Nur persönliche Microsoft-Konten/.test(await p.locator('#e-todo details.todo-anleitung').textContent()) && (await p.locator('#e-todo details.todo-anleitung').textContent()).includes('Nur persönliche Microsoft-Konten'), 'mit Anleitung (Tasks.ReadWrite, nur persönliche Konten)');
await p.fill('#todo-app-input', 'keine-id');
await p.click('#todo-app-form button[type="submit"]');
check(await bis(async () => (await p.locator('#toast').innerText()).includes('keine App-ID')), 'keine GUID: „Das ist keine App-ID“');
await p.fill('#todo-app-input', ` ${APP_ID.toUpperCase()} `);
await p.click('#todo-app-form button[type="submit"]');
check(await bis(() => gh.liste()?.haushalt?.todoApp === APP_ID, 8000), 'App-ID gespeichert – in liste.json, klein geschrieben');
check(await bis(async () => (await karte.innerText()).includes('Mit Microsoft To Do verbinden')), 'danach: „Mit Microsoft To Do verbinden“');
await p.click('[data-act="todo-verbinden"]');
check(await bis(async () => (await karte.innerText()).includes('gibt gleich einen Code')), '„Microsoft gibt gleich einen Code …“');
check(await bis(() => gh.liste()?.haushalt?.todoWunsch?.amy?.art === 'verbinden', 8000) && gh.zustand.nachrichten.some((m) => /· To Do/.test(m)), 'der Wunsch steht in liste.json, die Nachricht mit „· To Do“');
const at = gh.liste().haushalt.todoWunsch.amy.at;
gh.zustand.dateien['todo.json'] = JSON.stringify({ personen: { amy: { name: 'Amy', status: 'code', code: 'C042-XYZ', url: 'https://www.microsoft.com/link', bis: new Date(Date.now() + 600000).toISOString(), wunsch: at } } });
check(await bis(async () => (await p.locator('#todo-code').count()) && (await p.locator('#todo-code').innerText()) === 'C042-XYZ', 8000), 'der Code aus todo.json erscheint von selbst');
check(await p.locator('#e-todo a[href="https://www.microsoft.com/link"][target="_blank"]').count() === 1, '„Code bei Microsoft eingeben“ öffnet Microsoft');
gh.zustand.dateien['todo.json'] = JSON.stringify({ personen: { amy: { name: 'Amy', status: 'verbunden', token: 'v1.xyz', zuletzt: new Date().toISOString(), wunsch: at }, tobi: { name: 'Tobi', status: 'verbunden' } } });
check(await bis(async () => (await karte.innerText()).includes('Verbunden'), 8000), 'angemeldet: „✓ Verbunden“');
check((await karte.innerText()).includes('Auch verbunden: Tobi') && (await karte.innerText()).includes('heute'), 'zeigt, wer noch verbunden ist und wann zuletzt abgeglichen');
check(!(await p.content()).includes('v1.xyz'), 'den Token zeigt die App nirgends');
// Neu laden, während die Einstellungen offen sind: Die App geht gleich dort auf – auch dann holt sie todo.json
await p.reload({ waitUntil: 'load' });
await p.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await karte.innerText()).includes('Verbunden'), 8000) && !(await karte.innerText()).includes('Wird geprüft'), 'neu geladen in den Einstellungen: kein ewiges „Wird geprüft …“');
gh.zustand.dateien['todo.json'] = JSON.stringify({ personen: { amy: { name: 'Amy', status: 'verbunden', token: 'v1.xyz', zuletzt: new Date().toISOString(), wunsch: at, wahl: true, listen: [{ id: 'L1', name: 'Aufgaben', geteilt: false, art: 'standard' }, { id: 'L2', name: 'Wir zwei', geteilt: true }] } } });
// (sonst kommt es erst mit dem nächsten Nachsehen in einer Minute – in echt steht beides im selben Lauf)
await p.click('.tab[data-tab="einkauf"]');
await p.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await p.locator('#todo-ziel-form').count()) === 1, 8000), 'nach dem Verbinden: „In welche Liste?“');
check(await p.locator('#todo-ziel-form input[value="L2"]').isChecked() && (await karte.innerText()).includes('gemeinsame Liste – alle Putztage'), 'die gemeinsame Liste ist vorgewählt');
const nVor = gh.zustand.nachrichten.length;
await p.click('#todo-ziel-form button[type="submit"]');
check(await bis(() => gh.liste()?.haushalt?.todoZiel?.amy?.id === 'L2', 8000) && gh.liste().haushalt.todoZiel.amy.geteilt === true && gh.zustand.nachrichten.slice(nVor).some((m) => /· To Do/.test(m)), 'gewählt: steht in liste.json, mit „· To Do“');
check(await bis(async () => (await karte.innerText()).includes('Wird umgestellt')), '„Wird umgestellt …“');
const zielAt = gh.liste().haushalt.todoZiel.amy.at;
gh.zustand.dateien['todo.json'] = JSON.stringify({ personen: { amy: { name: 'Amy', status: 'verbunden', token: 'v1.xyz', zuletzt: new Date().toISOString(), wunsch: at, wahl: false, zielAt, listeName: 'Wir zwei', geteilt: true, listen: [] } } });
check(await bis(async () => (await karte.innerText()).includes('alle Putztage stehen in eurer gemeinsamen Liste „Wir zwei“'), 8000), 'danach: „alle Putztage stehen in eurer gemeinsamen Liste“');
await p.click('[data-act="todo-trennen"]');
check((await karte.innerText()).includes('Offene Putz-Aufgaben verschwinden'), 'Trennen fragt erst');
await p.click('[data-act="todo-trennen-ja"]');
check(await bis(() => gh.liste()?.haushalt?.todoWunsch?.amy?.art === 'trennen', 8000), 'Trennen: der Wunsch steht in liste.json');
check(await bis(async () => (await karte.innerText()).includes('Wird getrennt')), '„Wird getrennt …“');
const trennAt = gh.liste().haushalt.todoWunsch.amy.at;
gh.zustand.dateien['todo.json'] = JSON.stringify({ personen: { amy: { name: 'Amy', status: 'getrennt', wunsch: trennAt }, tobi: { name: 'Tobi', status: 'verbunden', geteilt: true, listeName: 'Wir zwei', zielAt: 'x' } } });
check(await bis(async () => (await karte.innerText()).includes('für dich ist hier nichts zu tun'), 8000) && await p.locator('[data-act="todo-verbinden"]').count() === 0, 'Tobi hat die gemeinsame Liste: bei Amy „für dich ist hier nichts zu tun“, kein Verbinden');
check(h.fehler.length === 0, `keine Fehler im Browser (${h.fehler.join(' | ')})`);
await h.ctx.close();
await browser.close();

rmSync(tmp, { recursive: true, force: true });
ende();
