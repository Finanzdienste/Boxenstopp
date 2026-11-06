/*
 * Gäste mit eigener Liste und der Überblick des Gastgebers: der Rechenteil
 * (js/gaeste.js, direkt in Node) und im Browser die ganze Geschichte –
 * Tobi lädt Marielle ein (falscher Schlüssel, Schlüssel für zu viel, dann
 * richtig), Marielle öffnet den Link (gleich verbunden, lila, Willkommen,
 * ihre Makros), ihre Liste bleibt ihre, Tobi sieht im Überblick, wer was
 * gemacht hat. Und: Marielles zweites Gerät über das Schlüsselfeld.
 */
import { pruefer, handy, githubAttrappe, githubMehrere, starteBrowser, bis, SCHLUESSEL, APP_URL } from './hilfe.mjs';
import { nachrichtLesen, bereichVon, zusammenfassen, verlaufMischen, repoVorschlag, gaesteBereinigen } from '../js/gaeste.js';
import { leer, anwenden, opPerson, opZusammen, opEinePerson, opTeil, beschreibung } from '../js/liste.js';

const { check, ende } = pruefer();
const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const ALLES_KEY = 'github_pat_11ALLESALLES00000000000_abcdefghijklmnopqrstuvwxyz';
const GKEY = 'AQ.Ab8RN6TESTTESTTESTTESTTESTTESTTEST';

/* ----------------------------------------------------------- Rechnung */

check(JSON.stringify(nachrichtLesen('Amy: Einkaufsliste, 3 Änderungen – Chili auf die Liste; 2 abgehakt · Bescheid')) === JSON.stringify({ wer: 'Amy', auto: false, anzahl: 3, was: ['Chili auf die Liste', '2 abgehakt'] }), 'Nachricht lesen: wer, wie viel, was – ohne „· Bescheid“');
check(nachrichtLesen('Tobi: Einkaufsliste, 1 Änderung').was.length === 0 && nachrichtLesen('Tobi: Einkaufsliste, 1 Änderung').anzahl === 1, 'Ältere Nachricht ohne „was“');
check(nachrichtLesen('Push: gesendet').auto && nachrichtLesen('Haushalt: erinnert und abgeglichen').auto && nachrichtLesen('Angebote (privat): Rewe 73').auto, 'Die Abläufe im Daten-Repo zählen als automatisch');
check(nachrichtLesen('liste.json geändert').wer === '' && nachrichtLesen('Tobi: Einladung für Marielle').was[0] === 'Einladung für Marielle', 'Von Hand ohne Namen: niemand; die Einladung');
check(bereichVon('Chili auf die Liste') === 'Einkauf' && bereichVon('Chili gekocht') === 'Kochen' && bereichVon('Rezept „Kokos-Curry“') === 'Rezepte' && bereichVon('Putzplan abgehakt') === 'Haushalt' && bereichVon('Ziel pro Box geändert') === 'Ziel', 'Bereiche');
check(repoVorschlag('Marielle') === 'Boxenstopp-Marielle' && repoVorschlag('Jörg Müller') === 'Boxenstopp-Joerg-Mueller' && repoVorschlag('') === '', 'Repo-Vorschlag aus dem Namen');
check(gaesteBereinigen([{ name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY, farbe: 'lila' }, { name: 'X', daten: 'kaputt', token: M_KEY }, { name: 'Doppelt', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY }]).length === 1, 'Gäste bereinigen: kaputte und doppelte fallen weg');

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

/* ============================================================ Browser */

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
const marielle = await handy(browser, { attrappe: beide, adresse: `${APP_URL}${u.hash}` });
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
for (let i = 0; i < 4 && await m.evaluate(() => document.querySelector('#willkommen-dlg')?.open); i++) await m.click('[data-act="wk-weiter"]');
check(!(await m.evaluate(() => document.querySelector('#willkommen-dlg')?.open)) && await m.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.willkommen.v1')) === true), 'Willkommen durch, gemerkt');
check((await m.locator('.tab-amy .tab-l').innerText()) === 'Marielles Rezepte' && (await m.locator('.tab-amy .tab-k').innerText()) === 'Marielle', 'Der Reiter heißt „Marielles Rezepte“');
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
const karten = await t.locator('#ueberblick-dlg .ub-person .ub-wer b').allInnerTexts();
check(karten.length === 2 && karten.includes('Marielle') && !karten.includes('Marielli') && ub.includes('Äpfel') && ub.includes('Marielli heißt jetzt Marielle'), `Überblick: Marielle einmal, mit „Marielli heißt jetzt Marielle“ (${karten.join(', ')})`);
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
check(tobi.fehler.length === 0, `Tobi: keine Fehler im Browser (${tobi.fehler.join(' | ')})`);
// Gast entfernen (nur von Tobis Gerät)
await t.click('[data-act="ub-zu"]');
await t.click('[data-g-weg="Finanzdienste/Boxenstopp-Marielle"]');
check(!(await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.gaeste.v1')))).length && !!mar.liste(), 'Entfernen: weg von Tobis Gerät, ihre Liste bleibt');

await browser.close();
ende();
