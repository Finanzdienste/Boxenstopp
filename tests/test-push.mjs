/*
 * Push-Nachrichten: erst werkzeug/push.mjs auf einem Daten-Repo zum Probieren
 * (was rausginge, an wen, nie doppelt, nie an den, der es war; Preisalarm;
 * Probe; Nachtragen auf eine frischere push.json; Senden über eine
 * web-push-Attrappe), dann im Browser: die Markierung „· Bescheid“ in den
 * Commits, das Einrichten mit dem Schlüsselpaar, An/Aus/Was/Probe und die
 * Mitteilung aus dem Service Worker.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { leer, anwenden, opTeil, opHaken, opAmy, opNotiz, opEigener, opPreisalarm, offeneAnzahl } from '../js/liste.js';

const { check, ende } = pruefer();
const D = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const K = D.katalog;
const PUSH = path.join(ROOT, 'werkzeug', 'push.mjs');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'boxenstopp-push-'));
const repo = path.join(tmp, 'daten');
execFileSync('git', ['init', '-q', repo]);
const git = (args, env = {}) => execFileSync('git', args, { cwd: repo, env: { ...process.env, ...env } }).toString().trim();
git(['config', 'user.email', 'test@example.com']);
git(['config', 'user.name', 'Test']);
const pushLesen = () => JSON.parse(readFileSync(path.join(repo, 'push.json'), 'utf8'));
const pushSchreiben = (p) => writeFileSync(path.join(repo, 'push.json'), `${JSON.stringify(p, null, 1)}\n`);
let stand = leer();
const einchecken = (ops, nachricht, { vorStunden = 0 } = {}) => {
  stand = anwenden(stand, ops);
  writeFileSync(path.join(repo, 'liste.json'), `${JSON.stringify(stand, null, 1)}\n`);
  const wann = new Date(Date.now() - vorStunden * 3600e3).toISOString();
  git(['add', '-A']);
  git(['commit', '-qm', nachricht], { GIT_AUTHOR_DATE: wann, GIT_COMMITTER_DATE: wann });
};
const ohneSchluessel = { ...process.env };
delete ohneSchluessel.VAPID_PUBLIC_KEY;
delete ohneSchluessel.VAPID_PRIVATE_KEY;
const lauf = (args, env = ohneSchluessel) => {
  const r = spawnSync(process.execPath, [PUSH, '--daten', repo, ...args], { encoding: 'utf8', env });
  const out = `${r.stdout}${r.stderr}`;
  return { out, code: r.status, an: out.split('\n').filter((z) => z.startsWith('→ ')) };
};

const abo = (id, geraet, was) => ({ endpoint: `https://push.example/${id}`, keys: { p256dh: `P${id}`.padEnd(87, 'x'), auth: `A${id}`.padEnd(22, 'y') }, geraet, was, at: '2026-10-29T10:00:00Z' });
const OEFFENTLICH = 'B'.padEnd(87, 'k');
pushSchreiben({ schluessel: OEFFENTLICH, abos: { tobi: [abo('tobi-android', 'Android', ['liste', 'rezepte', 'preise']), abo('tobi-browser', 'Browser', ['preise'])], amy: [abo('amy-iphone', 'iPhone', ['liste', 'rezepte'])] } });

// --- Liste: was ist eine Nachricht wert, an wen
einchecken(opEigener('c-milch', 'Milch', 'kuehl'), 'Amy: Einkaufsliste, 1 Änderung · Bescheid', { vorStunden: 3 });
einchecken([opTeil('zwiebeln', 'chili', { q: 300, u: 'g', h: '' }, K.zwiebeln), opTeil('reis', 'chili', { q: 280, u: 'g', h: '' }, K.reis)], 'Amy: Einkaufsliste, 2 Änderungen · Bescheid');
einchecken(opTeil('knoblauch', 'chili', { q: 20, u: 'g', h: '' }, K.knoblauch), 'Tobi: Einkaufsliste, 1 Änderung');
let r = lauf(['--liste', '--trocken']);
check(r.code === 0 && r.an.length === 1 && r.an[0] === `→ tobi (Android): Einkaufsliste – Amy hat 2 Sachen auf die Liste gesetzt: ${K.zwiebeln.n}, ${K.reis.n}`, `Amy setzt zwei Sachen drauf: nur an Tobis Handy (${r.an.join(' / ')})`);
check(!/Milch|Knoblauch|→ amy|Browser/.test(r.out), 'nichts von vor drei Stunden (erster Lauf), nichts ohne „· Bescheid“, nichts an Amy selbst, nichts an Tobis Gerät nur für Preise');
check(!/push\.example|Ptobi|Atobi/.test(r.out), 'keine Abo-Adressen oder Schlüssel in der Ausgabe');
check(pushLesen().zuletzt?.sha === git(['rev-parse', 'HEAD']), 'push.json merkt sich, bis wohin gemeldet ist');
r = lauf(['--liste', '--trocken']);
check(r.an.length === 0 && r.out.includes('0 gesendet'), 'noch einmal: nichts doppelt');
einchecken(['zwiebeln', 'reis', 'knoblauch', 'c-milch'].map((k) => opHaken(stand, k, true, 'Tobi')), 'Tobi: Einkaufsliste, 4 Änderungen · Bescheid');
r = lauf(['--liste', '--trocken']);
check(offeneAnzahl(stand) === 0 && r.an.length === 1 && r.an[0] === '→ amy (iPhone): Einkauf erledigt – Tobi hat alles eingekauft ✓', `alles eingekauft: an Amy (${r.an.join(' / ')})`);
const chili = D.rezepte.find((x) => x.id === 'chili');
einchecken([opAmy({ id: 'amy-avocado-1', name: 'Avocado-Toast', zutaten: ['1 Avocado'], schritte: ['Toasten'] }, 'Amy'), opNotiz('chili', 'n-1', 'Mehr Kreuzkümmel', 'Amy')], 'Amy: Einkaufsliste, 2 Änderungen · Bescheid');
r = lauf(['--liste', '--trocken']);
check(r.an.length === 2 && r.an[0] === '→ tobi (Android): Amys Rezepte – Neues Rezept von Amy: Avocado-Toast ♡' && r.an[1] === `→ tobi (Android): Notiz – Amy zu ${chili.short || chili.name}: Mehr Kreuzkümmel`, `neues Rezept und Notiz: an Tobi (${r.an.join(' / ')})`);

// --- Preisalarm
const tag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
einchecken([opPreisalarm('haehnchenbrust', { max: 9, u: 'kg', name: K.haehnchenbrust.n }, 'Tobi'), opPreisalarm('n:dino-nuggets', { max: 12, u: 'kg', name: 'Dino Nuggets' }, 'Tobi')], 'Tobi: Einkaufsliste, 2 Änderungen');
const oeffentlicheAngebote = path.join(tmp, 'angebote.json');
writeFileSync(oeffentlicheAngebote, JSON.stringify({ angebote: [
  { id: 'p-aldi1', laden: 'Aldi', name: 'Hähnchenbrustfilet', preis: 5.19, menge: 600, einheit: 'g', k: 'haehnchenbrust', von: tag(-1), bis: tag(3) },
  { id: 'p-alt', laden: 'Lidl', name: 'Hähnchenbrust', preis: 4.99, menge: 1, einheit: 'kg', k: 'haehnchenbrust', bis: tag(-1) },
  { id: 'p-teuer', laden: 'Penny', name: 'Hähnchenbrust', preis: 9.99, menge: 1, einheit: 'kg', k: 'haehnchenbrust', bis: tag(3) },
] }));
writeFileSync(path.join(repo, 'angebote-privat.json'), JSON.stringify({ angebote: [{ id: 'k-rewe1', laden: 'Rewe', name: 'Gutfried Dino Nuggets', preis: 2.49, menge: 250, einheit: 'g', von: tag(2), bis: tag(5) }] }));
r = lauf(['--preise', '--trocken', '--angebote', oeffentlicheAngebote]);
const ab = `(ab ${tag(2).slice(8, 10)}.${tag(2).slice(5, 7)}.)`;
check(r.an.length === 2 && r.an.every((z) => z.includes('Preisalarm: 2 Angebote – ') && z.includes(`${K.haehnchenbrust.n} 8,65 €/kg bei Aldi`) && z.includes(`Dino Nuggets 9,96 €/kg bei Rewe ${ab}`)), `zwei Treffer in einer Nachricht (${r.an[0]})`);
check(r.an.some((z) => z.startsWith('→ tobi (Android)')) && r.an.some((z) => z.startsWith('→ tobi (Browser)')) && !r.out.includes('→ amy'), 'an alle Geräte mit „Preisalarm“ – Amy hat ihn abgewählt');
check(!/4,99|9,99/.test(r.out), 'abgelaufen oder über dem Wunschpreis: nicht dabei');
check(['p-aldi1|haehnchenbrust', 'k-rewe1|n:dino-nuggets'].every((x) => pushLesen().gemeldet?.includes(x)), 'gemeldet: Angebot und Alarm');
r = lauf(['--preise', '--trocken', '--angebote', oeffentlicheAngebote]);
check(r.an.length === 0, 'noch einmal: dieselben Angebote nicht doppelt');

// --- Probe
let p = pushLesen();
pushSchreiben({ ...p, test: { an: 'Amy', at: 'T1' } });
r = lauf(['--test', '--trocken', '--delta', path.join(tmp, 'delta.json')]);
check(r.an.length === 1 && r.an[0] === '→ amy (iPhone): Boxenstopp – Probe angekommen – Push klappt ✓' && !pushLesen().test, 'Probe: an Amys Geräte (auch ohne Häkchen), danach erledigt');
const delta = JSON.parse(readFileSync(path.join(tmp, 'delta.json'), 'utf8'));
check(delta.testAt === 'T1' && delta.zuletzt === null && Array.isArray(delta.gemeldet), '--delta: was dieser Lauf geändert hat');
// Inzwischen hat die App push.json geändert (iPad angemeldet) – das Eigene kommt nur darauf
p = pushLesen();
const frischer = { ...p, abos: { ...p.abos, amy: [...p.abos.amy, abo('amy-ipad', 'iPad', ['liste'])] }, test: { an: 'Amy', at: 'T1' } };
pushSchreiben(frischer);
r = lauf(['--nachtragen', path.join(tmp, 'delta.json')]);
check(!pushLesen().test && pushLesen().abos.amy.length === 2 && r.an.length === 0, '--nachtragen auf die frischere Fassung: das iPad bleibt, die Probe ist erledigt, nichts gesendet');
pushSchreiben({ ...pushLesen(), test: { an: 'Amy', at: 'T2' } });
lauf(['--nachtragen', path.join(tmp, 'delta.json')]);
check(pushLesen().test?.at === 'T2', 'eine neu bestellte Probe bleibt stehen');
pushSchreiben({ ...pushLesen(), test: undefined });

// --- Senden über eine web-push-Attrappe
const stub = path.join(tmp, 'webpush-attrappe.cjs');
const log = path.join(tmp, 'gesendet.jsonl');
writeFileSync(stub, `const fs = require('fs');
module.exports = {
  setVapidDetails(sub, pub, priv) { fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify({ vapid: [sub, pub.length, priv.length] }) + '\\n'); },
  async sendNotification(abo, body, opt) {
    fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify({ endpoint: abo.endpoint, keys: Object.keys(abo.keys || {}), body: JSON.parse(body), opt }) + '\\n');
    if (abo.endpoint.includes('weg')) { const e = new Error('Gone'); e.statusCode = 410; throw e; }
    if (abo.endpoint.includes('kaputt')) { const e = new Error('Boom'); e.statusCode = 500; throw e; }
    return { statusCode: 201 };
  },
};
`);
p = pushLesen();
pushSchreiben({ ...p, abos: { ...p.abos, tobi: [...p.abos.tobi, abo('weg-1', 'Android', ['liste']), abo('kaputt-1', 'Android', ['liste'])] } });
einchecken(opEigener('c-hafer', 'Haferdrink', 'trocken'), 'Amy: Einkaufsliste, 1 Änderung · Bescheid');
const PRIVAT = 'p'.repeat(43);
const mitSchluessel = { ...ohneSchluessel, VAPID_PUBLIC_KEY: OEFFENTLICH, VAPID_PRIVATE_KEY: PRIVAT, WEBPUSH: stub, ATTRAPPE_LOG: log };
r = lauf(['--liste', '--delta', path.join(tmp, 'delta2.json')], mitSchluessel);
const gesendet = readFileSync(log, 'utf8').trim().split('\n').map((z) => JSON.parse(z));
const an = gesendet.filter((g) => g.endpoint);
check(JSON.stringify(gesendet[0].vapid) === JSON.stringify(['https://finanzdienste.github.io/Boxenstopp/', 87, 43]), 'web-push: Absender ist die App-Adresse (keine E-Mail), Schlüssel aus den Secrets');
check(an.length === 3 && an.every((g) => g.opt.TTL === 21600 && g.opt.topic === 'liste' && g.body.titel === 'Einkaufsliste' && g.body.text === 'Amy hat „Haferdrink“ auf die Liste gesetzt' && g.body.ziel === 'einkauf' && g.keys.join() === 'p256dh,auth'), `an Tobis drei Geräte für die Liste: TTL 6 h, Thema „liste“ (${an.map((g) => g.endpoint.split('/').pop()).join(', ')})`);
check(r.out.includes('Push: 1 gesendet, 1 abgelaufen, 1 nicht zugestellt.') && r.out.includes('an tobi ging nicht (HTTP 500)'), `Ausgabe nur mit Zahlen (${r.out.trim().split('\n').join(' / ')})`);
check(!r.out.includes('push.example') && !r.out.includes(PRIVAT) && !r.out.includes(OEFFENTLICH), 'keine Adressen, keine Schlüssel in der Ausgabe');
check(!pushLesen().abos.tobi.some((x) => x.endpoint.includes('weg')) && pushLesen().abos.tobi.some((x) => x.endpoint.includes('kaputt')), 'abgelaufenes Abo (410) fällt weg, ein Fehler 500 nicht');
check(JSON.parse(readFileSync(path.join(tmp, 'delta2.json'), 'utf8')).weg.join() === 'https://push.example/weg-1', '--delta: das abgelaufene Abo zum Nachtragen');
r = lauf(['--liste'], { ...mitSchluessel, VAPID_PUBLIC_KEY: 'C'.padEnd(87, 'k') });
check(r.out.includes('passt nicht zum Secret'), 'anderer öffentlicher Schlüssel im Secret: Warnung');
einchecken(opEigener('c-tofu', 'Tofu', 'kuehl'), 'Amy: Einkaufsliste, 1 Änderung · Bescheid');
r = lauf(['--liste']);
check(r.code === 0 && r.out.includes('keine Schlüssel') && r.out.includes('0 gesendet'), 'ohne Secrets: nichts gesendet, kein Fehler');
const ohnePush = path.join(tmp, 'leer');
execFileSync('git', ['init', '-q', ohnePush]);
const leerLauf = spawnSync(process.execPath, [PUSH, '--daten', ohnePush, '--liste', '--preise'], { encoding: 'utf8', env: ohneSchluessel });
check(leerLauf.status === 0 && leerLauf.stdout.includes('keine push.json'), 'ohne push.json: niemand angemeldet, kein Fehler');
rmSync(tmp, { recursive: true, force: true });

// --- Im Browser
const gh = githubAttrappe();
const browser = await starteBrowser({ voll: true });
const mitLink = `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}`;
const verbinden = async (seite, name) => { await seite.fill('#z-name', name); await seite.click('#z-los'); return bis(async () => (await seite.locator('#sync-text').innerText()) === 'Geteilt'); };
const ursprung = new URL(APP_URL).origin;

// Welche Commits „· Bescheid“ tragen
const tobi = await handy(browser, { attrappe: gh, adresse: mitLink });
const t = tobi.page;
check(await verbinden(t, 'Tobi'), 'Tobi: eingerichtet');
await t.click('.tab[data-tab="rezepte"]');
await t.click('[data-open="chili"]');
await t.click('#detail [data-act="alle-dazu"]');
check(await bis(() => gh.zustand.nachrichten.some((m) => m.startsWith('Tobi: Einkaufsliste') && m.endsWith('· Bescheid')), 8000), `Zutaten auf die Liste: „… · Bescheid“ (${gh.zustand.nachrichten.slice(-1)[0]})`);
await t.click('.tab[data-tab="einkauf"]');
let n = gh.zustand.nachrichten.length;
const erste = await t.locator('#list-body .grp:not(.grp-done) [data-check]').first().getAttribute('data-check');
await t.click(`#list-body [data-check="${erste}"]`);
check(await bis(() => gh.zustand.nachrichten.length > n, 8000) && !gh.zustand.nachrichten.slice(n).some((m) => m.includes('· Bescheid')), `abhaken, es bleibt noch was: ohne (${gh.zustand.nachrichten.slice(-1)[0]})`);
n = gh.zustand.nachrichten.length;
for (const k of await t.$$eval('#list-body .grp:not(.grp-done) [data-check]', (xs) => xs.map((x) => x.dataset.check))) await t.click(`#list-body [data-check="${k}"]`);
check(await bis(() => gh.liste() && offeneAnzahl(gh.liste()) === 0 && gh.zustand.nachrichten.length > n, 10000) && gh.zustand.nachrichten.slice(-1)[0].endsWith('· Bescheid'), `das Letzte im Wagen: wieder mit (${gh.zustand.nachrichten.slice(-1)[0]})`);

// Einrichten und An/Aus – mit einem nachgebauten Push-Dienst (Headless-Chromium hat keinen)
const fakePush = () => {
  let abo = null;
  let nr = 0;
  window.PushManager.prototype.getSubscription = async function getSubscription() { return abo; };
  window.PushManager.prototype.subscribe = async function subscribe(o) {
    const k = o.applicationServerKey;
    nr += 1;
    abo = {
      endpoint: `https://push.example/test-${nr}`,
      options: { applicationServerKey: new Uint8Array(k).buffer },
      toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BP'.padEnd(87, 'x'), auth: 'au'.padEnd(22, 'y') } }; },
      async unsubscribe() { abo = null; return true; },
    };
    return abo;
  };
};
const pg = await handy(browser, { attrappe: gh, adresse: mitLink, ohneWorker: false, skript: fakePush, rechte: ['notifications', 'clipboard-read', 'clipboard-write'] });
const s = pg.page;
check(await verbinden(s, 'Tobi'), 'zweites Gerät (mit Service Worker): eingerichtet');
await s.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await s.locator('#push-bereich [data-act="push-paar"]').count()) === 1, 8000), 'Push: „noch nicht eingerichtet“ mit „Einrichten“');
await s.click('#push-bereich [data-act="push-paar"]');
check(await bis(async () => (await s.locator('#push-bereich .push-schritte li').count()) === 4), 'Einrichten: vier Schritte mit dem Link zu den Secrets');
check((await s.locator('#push-bereich .push-schritte a').getAttribute('href')) === 'https://github.com/Finanzdienste/Boxenstopp-Daten/settings/secrets/actions/new', 'der Link führt zu den Secrets des Daten-Repos');
await s.click('#push-bereich [data-act="push-kopieren"][data-was="oeffentlich"]');
const oeffentlich = await bis(async () => { const x = await s.evaluate(() => navigator.clipboard.readText()); return /^B[A-Za-z0-9_-]{86}$/.test(x) ? x : null; });
check(!!oeffentlich && (await s.locator('#toast').innerText()).includes('VAPID_PUBLIC_KEY'), 'öffentlicher Schlüssel kopiert (87 Zeichen)');
await s.click('#push-bereich [data-act="push-kopieren"][data-was="privat"]');
const privat = await bis(async () => { const x = await s.evaluate(() => navigator.clipboard.readText()); return /^[A-Za-z0-9_-]{43}$/.test(x) ? x : null; });
check(!!privat && (await s.locator('#toast').innerText()).includes('VAPID_PRIVATE_KEY'), 'privater Schlüssel kopiert (43 Zeichen)');
// Zum Kopieren zu GitHub gewechselt, Android hat die App geschlossen: Die Schritte sind noch da, mit demselben Paar
await s.reload({ waitUntil: 'load' });
await s.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
await s.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await s.locator('#push-bereich .push-schritte li').count()) === 4, 8000), 'nach dem Neuladen: die Schritte stehen noch da');
await s.click('#push-bereich [data-act="push-kopieren"][data-was="oeffentlich"]');
check(await bis(async () => (await s.evaluate(() => navigator.clipboard.readText())) === oeffentlich), 'und es ist dasselbe Schlüsselpaar');
await s.click('#push-bereich [data-act="push-ablegen"]');
check(await bis(async () => (await s.locator('#push-bereich .push-an').count()) === 1, 10000), `eingeschaltet: „${await s.locator('#push-bereich .push-an').innerText().catch(() => '')}“`);
const pj = () => JSON.parse(gh.zustand.dateien['push.json'] || 'null');
check(pj()?.schluessel === oeffentlich && pj()?.abos?.tobi?.[0]?.endpoint === 'https://push.example/test-1' && pj().abos.tobi[0].was.join() === 'liste,rezepte,preise', 'push.json: der öffentliche Schlüssel und Tobis Gerät mit allem');
check(!gh.zustand.dateien['push.json'].includes(privat) && !gh.zustand.nachrichten.some((m) => m.includes(privat)), 'der private Schlüssel geht nicht nach GitHub');
check(!(await s.evaluate(() => JSON.stringify({ ...localStorage }))).includes(privat), 'nach „Fertig“ ist der private Schlüssel auch auf dem Gerät weg');
check(gh.zustand.nachrichten.includes('Push: neuer Schlüssel') && gh.zustand.nachrichten.some((m) => /^Push: Tobi meldet \w+ an$/.test(m)), 'Commits: „Push: neuer Schlüssel“, „Push: Tobi meldet … an“');
await s.click('#push-bereich [data-push-was="preise"]');
check(await bis(() => pj()?.abos?.tobi?.[0]?.was.join() === 'liste,rezepte', 8000), 'Häkchen „Preisalarm“ weg: kommt in push.json an');
await s.click('#push-bereich [data-act="push-test"]');
check(await bis(() => pj()?.test?.an === 'tobi', 8000) && gh.zustand.nachrichten.slice(-1)[0].endsWith('· Test') && (await s.locator('#push-bereich .push-meldung').innerText()).includes('unterwegs'), 'Probe: push.json bestellt sie, Commit mit „· Test“');

// Die Mitteilung aus dem Service Worker (Push über die DevTools zugestellt)
const cdp = await pg.ctx.newCDPSession(s);
const regs = [];
cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations));
await cdp.send('ServiceWorker.enable');
const reg = await bis(() => regs.find((x) => x.scopeURL.startsWith(ursprung) && !x.isDeleted), 8000);
if (reg) {
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: ursprung, registrationId: reg.registrationId, data: JSON.stringify({ titel: 'Einkaufsliste', text: 'Amy hat „Milch“ auf die Liste gesetzt', tag: 'liste', ziel: 'einkauf' }) });
  const mitteilung = await bis(() => s.evaluate(async () => { const r = await navigator.serviceWorker.ready; const ns = await r.getNotifications(); return ns.length ? ns.map((x) => [x.title, x.body, x.tag, x.data?.ziel]) : null; }), 8000);
  check(JSON.stringify(mitteilung?.[0]) === JSON.stringify(['Einkaufsliste', 'Amy hat „Milch“ auf die Liste gesetzt', 'liste', 'einkauf']), `Service Worker zeigt die Mitteilung (${JSON.stringify(mitteilung)})`);
} else check(false, 'Service Worker angemeldet');
await cdp.detach();

await s.click('#push-bereich [data-act="push-aus"]');
check(await bis(() => !pj()?.abos?.tobi, 8000) && await bis(async () => (await s.locator('#push-bereich [data-act="push-an"]').count()) === 1), 'ausgeschaltet: aus push.json raus, der Knopf „einschalten“ ist da');
await s.click('#push-bereich [data-act="push-an"]');
check(await bis(() => pj()?.abos?.tobi?.[0]?.endpoint === 'https://push.example/test-2', 8000) && await bis(async () => (await s.locator('#push-bereich .push-an').count()) === 1), 'wieder eingeschaltet: neues Abo');

// Ein Timer läuft ab: die Mitteilung kommt über den Service Worker (auf Android geht nur das), antippen führt zum Schritt
await s.evaluate(() => localStorage.setItem('boxenstopp.timer.v1', JSON.stringify([{ id: 't-probe', rid: 'chili', schritt: 5, label: 'Chili: köcheln', minuten: 1, start: Date.now(), ende: Date.now() + 2500, fertig: false, dann: '', folge: [], stufe: 1, stufen: 1 }])));
await s.reload({ waitUntil: 'load' });
await s.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
const timerMitteilung = await bis(() => s.evaluate(async () => { const r = await navigator.serviceWorker.ready; const ns = await r.getNotifications({ tag: 't-probe' }); return ns.length ? [ns[0].title, ns[0].body, ns[0].data?.ziel] : null; }), 10000);
check(JSON.stringify(timerMitteilung) === JSON.stringify(['Timer fertig', 'Chili: köcheln', 'chili#5']), `Timer fertig: Mitteilung über den Service Worker (${JSON.stringify(timerMitteilung)})`);

// Echtes Headless-Chromium: Der Push-Dienst fehlt – eine Meldung, kein Hängen
const echt = await handy(browser, { attrappe: gh, adresse: mitLink, ohneWorker: false, rechte: ['notifications'] });
const e = echt.page;
check(await verbinden(e, 'Amy'), 'Amy: eingerichtet');
await e.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await e.locator('#push-bereich [data-act="push-an"]').count()) === 1, 8000), 'Amy: Push ist eingerichtet, hier noch aus');
await e.click('#push-bereich [data-act="push-an"]');
const ausgang = await bis(async () => {
  if (await e.locator('#push-bereich .push-an').count()) return 'an';
  const m = await e.locator('#push-bereich .push-meldung').innerText().catch(() => '');
  return m && !(await e.locator('#push-bereich button[disabled]').count()) ? m : null;
}, 30000);
check(ausgang === 'an' || /Push-Dienst|eingerichtet/.test(ausgang || ''), `ohne Push-Dienst: ${ausgang}`);

// Android, Mitteilungen für Boxenstopp verboten: Einrichten geht trotzdem, dazu, wie man sie erlaubt
const gh2 = githubAttrappe();
const shell = await starteBrowser(); // Headless-Shell: Mitteilungen sind dort immer verboten
const android = await handy(shell, { attrappe: gh2, adresse: mitLink, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', rechte: ['clipboard-read', 'clipboard-write'] });
const a = android.page;
check(await verbinden(a, 'Tobi'), 'Android: eingerichtet');
check(await a.evaluate(() => Notification.permission) === 'denied', 'Mitteilungen sind auf diesem Gerät verboten');
await a.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await a.locator('#push-bereich [data-act="push-paar"]').count()) === 1, 8000), 'trotzdem: „Einrichten“');
await a.click('#push-bereich [data-act="push-paar"]');
check(await bis(async () => (await a.locator('#push-bereich [data-act="push-ablegen"]').innerText().catch(() => '')) === 'Fertig'), 'der letzte Knopf heißt nur „Fertig“ (einschalten geht hier noch nicht)');
await a.click('#push-bereich [data-act="push-ablegen"]');
check(await bis(() => JSON.parse(gh2.zustand.dateien['push.json'] || 'null')?.schluessel?.length === 87, 8000), 'der öffentliche Schlüssel liegt in push.json');
check(await bis(async () => (await a.locator('#push-bereich .push-aus').count()) === 1) && (await a.locator('#push-bereich .push-hilfe').innerText()).includes('Benachrichtigungen') && (await a.locator('#push-bereich .push-meldung').innerText()).includes('Eingerichtet'), `danach: „Eingerichtet ✓“ und wie man Mitteilungen erlaubt (${await a.locator('#push-bereich .push-hilfe').innerText().catch(() => '')})`);
check(await a.locator('#push-bereich [data-act="push-pruefen"]').count() === 1, '„Erlaubt – nochmal prüfen“');
await shell.close();

// iPhone im Browser (nicht vom Home-Bildschirm): der Hinweis
const ios = await handy(browser, { attrappe: gh, adresse: mitLink, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', skript: () => { delete window.PushManager; } });
check(await verbinden(ios.page, 'Amy'), 'iPhone: eingerichtet');
await ios.page.click('.tab[data-tab="einstellungen"]');
check(await bis(async () => (await ios.page.locator('#push-bereich').innerText()).includes('nur in der App vom Home-Bildschirm')), 'iPhone im Browser: „nur in der App vom Home-Bildschirm“');

// Chromium meldet beim echten Anmelden im Test-Profil (wie privates Surfen) selbst einen Fehler – der gehört dazu
const alleFehler = [...tobi.fehler, ...pg.fehler, ...echt.fehler, ...ios.fehler, ...android.fehler].filter((f) => !/Push API in incognito/.test(f));
check(alleFehler.length === 0, `keine Fehler in der Konsole${alleFehler.length ? `: ${alleFehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
