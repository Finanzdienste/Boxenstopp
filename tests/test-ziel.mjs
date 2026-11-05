/*
 * Ziel pro Box: die Rechnung (js/zielrechner.js, direkt in Node), das Profil
 * der Liste (liste.js) und im Browser – Ziel eintragen, Rezepte, Liste und
 * das zweite Handy ziehen mit, zurück zum Standard.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, ROOT, handy, githubAttrappe, starteBrowser, bis, SCHLUESSEL } from './hilfe.mjs';
import { aufZiel, alleAufZiel, mengenFuerZiel, mengenVon, zielBereinigen, gleichesZiel, kcalAus, vergleich, trefferZaehlen, hinweisNeu, mengenTextNeu, stueckTextNeu, packung, STANDARD } from '../js/zielrechner.js';
import { zielAusFeldern } from '../js/ansicht-ziel.js';
import { leer, anwenden, bereinigen, opProfil, opZusammen, opTeil, beschreibung, opHaken, opGekocht, opPerson } from '../js/liste.js';
import { platzhalter } from '../js/format.js';

const { check, ende } = pruefer();
const daten = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const preise = { preise: daten.preise, naehrwerte: daten.naehrwerte };
const rund1 = (x) => Math.round(x * 10) / 10;

/* ---------------------------------------------------------- Rechnung */

check(gleichesZiel(daten.ziel, STANDARD), 'Das Standard-Ziel im Code ist das aus daten/rezepte.json');
check(aufZiel(daten.rezepte[0], STANDARD, preise) === daten.rezepte[0], 'Beim Standard-Ziel bleibt jedes Rezept, wie es ist (dasselbe Objekt)');
check(zielBereinigen({ kcal: '380', p: '30', kh: 35, f: 12.04 })?.f === 12 && zielBereinigen({ kcal: 380, p: 30, kh: 35, f: 12 }).kcal === 380, 'Ziel bereinigen: Zahlen, kcal ganz, eine Stelle');
check(zielBereinigen({ kcal: 50, p: 30, kh: 35, f: 12 }) === null && zielBereinigen({ kcal: 380, p: 30, kh: 35 }) === null && zielBereinigen(null) === null, 'Ziel bereinigen: unsinnige oder fehlende Werte → null');
check(kcalAus(30, 35, 12) === 368, 'kcal aus P/KH/F: 4/4/9');

const ZIELE = [
  { kcal: 380, p: 30, kh: 35, f: 12 },
  { kcal: 550, p: 40, kh: 55, f: 18 },
  { kcal: 650, p: 45, kh: 70, f: 20 },
  { kcal: 450, p: 40, kh: 25, f: 20 },
];
const MINDESTENS = [45, 45, 45, 42];
for (const [i, z] of ZIELE.entries()) {
  const { rezepte, mengen } = alleAufZiel(daten.rezepte, z, preise);
  const t = trefferZaehlen(rezepte);
  check(t.gesamt === daten.rezepte.length && t.treffen >= MINDESTENS[i], `${z.kcal}/${z.p}/${z.kh}/${z.f}: ${t.treffen} von ${t.gesamt} Rezepten treffen das Ziel (mindestens ${MINDESTENS[i]})`);
  let tabelle = true; let proBox = true; let stueck = true; let schritte = true; let negativ = false; let kosten = true; let original = true;
  for (const r of rezepte) {
    const alt = daten.rezepte.find((x) => x.id === r.id);
    const summe = [2, 3, 4, 5].map((j) => rund1(r.nut.reduce((s, x) => s + x[j], 0)));
    if (summe.some((x, j) => Math.abs(x - r.total[j]) > 0.11)) tabelle = false;
    if (Math.abs(r.m.kcal - r.total[0] / 8) > 0.6 || Math.abs(r.m.p - r.total[1] / 8) > 0.06) proBox = false;
    // Nährwerte aus den Zutaten nachgerechnet = Tabelle
    const ausZutaten = r.items.filter((it) => it.k && !it.haus && !it.opt && it.pro100 && it.g).reduce((s, it) => s + (it.pro100.p * it.g) / 100, 0) + (r.pauschal || []).reduce((s, pz) => s + (pz.pro100.p * pz.g) / 100, 0);
    if (Math.abs(ausZutaten - r.total[1]) > 0.6) tabelle = false;
    for (const it of r.items) {
      if (it.g < 0 || it.q < 0) negativ = true;
      if (it.u && !['g', 'ml'].includes(it.u) && typeof it.q === 'number' && !Number.isInteger(it.q)) stueck = false;
    }
    for (const ph of r.ablauf) for (const s of ph.schritte) if (/\{[A-Za-z0-9_.-]+\}/.test(platzhalter(s.d, r.items, r.weg))) schritte = false;
    if (!(r.kosten.box > 0) || Math.abs(r.kosten.box - r.kosten.gesamt / 8) > 0.011) kosten = false;
    if (alt.items[0].g !== daten.rezepte.find((x) => x.id === r.id).items[0].g) original = false;
  }
  check(tabelle && proBox, `${z.kcal}: Nährwerttabelle, Summe und Werte pro Box passen zueinander und zu den Zutaten`);
  check(stueck && !negativ, `${z.kcal}: Dosen, Eier, Packungen bleiben ganz, nichts negativ`);
  check(schritte && kosten && original, `${z.kcal}: alle Platzhalter in den Schritten gefüllt, Kosten pro Box = gesamt ÷ 8, das Original bleibt unverändert`);
  const nochmal = alleAufZiel(daten.rezepte, z, preise, mengen).rezepte;
  check(JSON.stringify(nochmal) === JSON.stringify(rezepte), `${z.kcal}: mit gemerkten Mengen kommt genau dasselbe heraus`);
}

// Ein Rezept genauer: Chili auf 380 kcal
const chili = daten.rezepte.find((r) => r.id === 'chili');
const c380 = aufZiel(chili, ZIELE[0], preise);
check(c380.angepasst.aenderungen.length > 0 && c380.angepasst.aenderungen.every((a) => a.vorher !== a.nachher), 'Chili auf 380: geänderte Mengen stehen in angepasst.aenderungen');
const hack = c380.items.find((it) => it.k === 'rinderhack');
check(hack.q === hack.g && hack.a === `${hack.g} g` && platzhalter(chili.ablauf.flatMap((p) => p.schritte).find((s) => s.d.includes('{rinderhack}')).d, c380.items).includes(`${hack.g} g`), `Chili: Hack ${hack.g} g – in der Zutat und im Schritt`);
check(Math.abs(c380.m.kcal - 380) <= 30 && c380.m.kcal < chili.m.kcal, `Chili: ${c380.m.kcal} kcal pro Box statt ${chili.m.kcal}`);
const k650 = mengenVon(mengenFuerZiel(daten.rezepte.find((r) => r.id === 'kichererbsen-curry'), ZIELE[2]));
check(Object.values(k650).every((g) => g > 0), 'Großes Ziel: Der Spielraum wächst mit, nichts fällt auf 0');

// Texte
check(packung('2 × 500 g')?.X === 500 && packung('Theke oder 2 × 400 g')?.X === 400 && packung('2 Becher à 150 g')?.X === 150 && packung('Beutel 1,5 kg')?.X === 1500 && packung('aus 500-g-Packung')?.art === 'aus' && packung('1 × 500 g + 1 × 400 g') === null, 'Packungsgröße aus dem Hinweis');
check(hinweisNeu('Theke oder 2 × 400 g', 800, 1150) === 'Theke oder 3 × 400 g' && hinweisNeu('2 Becher à 150 g', 300, 420) === '3 Becher à 150 g' && hinweisNeu('aus 500-g-Packung', 300, 450) === 'aus 500-g-Packung' && hinweisNeu('aus 500-g-Packung', 300, 700) === '2 × 500 g', 'Packungshinweis für die neue Menge');
check(hinweisNeu('1 Becher', 500, 650) === '' && hinweisNeu('1 Becher', 500, 540) === '1 Becher', 'Hinweis ohne Größe: bleibt bei kleinen Änderungen, sonst weg');
check(mengenTextNeu('50 g (2½ EL)', 50, 80, 'g') === '80 g (4 EL)' && mengenTextNeu('1 TL (5 g)', 5, 12, 'g') === '2½ TL (12 g)' && mengenTextNeu('1,275 kg geschält', 1275, 1500, 'g') === '1,5 kg geschält' && mengenTextNeu('600 g (1 große oder 2 mittlere)', 600, 750, 'g') === '750 g', 'Mengentext: Löffel rechnen mit, „geschält“ bleibt, anderes in Klammern fällt weg');
check(stueckTextNeu('2 Dosen à 400 g (480 g abgetropft)', 2, 3) === '3 Dosen à 400 g (720 g abgetropft)' && stueckTextNeu('1 Dose à 400 ml', 1, 2) === '2 Dosen à 400 ml' && stueckTextNeu('3 Stück', 3, 4) === '4 Stück', 'Stückware: Zahl, Wort und Klammer');

// Eingaben
const e1 = zielAusFeldern({ kcal: '', p: '30', kh: '35', f: '12' });
check(e1.ziel?.kcal === 368 && e1.ziel.p === 30, 'Formular: ohne kcal rechnet die App 4/4/9');
const e2 = zielAusFeldern({ kcal: '1800', p: '135', kh: '180', f: '55' }, { tag: true, mahlzeiten: 3 });
check(e2.ziel?.kcal === 600 && e2.ziel.p === 45 && e2.ziel.f === 18.3, 'Formular: pro Tag ÷ Mahlzeiten');
check(!!zielAusFeldern({ kcal: '400', p: '', kh: '30', f: '10' }).fehler && !!zielAusFeldern({ kcal: '4000', p: '30', kh: '30', f: '10' }).fehler && !!zielAusFeldern({ kcal: '400', p: 'viel', kh: '30', f: '10' }).fehler, 'Formular: fehlende, zu große oder keine Zahlen → Satz statt Ziel');
check(!!zielAusFeldern({ kcal: '900', p: '30', kh: '35', f: '12' }).hinweis, 'Formular: kcal passen nicht zu den Makros → Hinweis');
check(vergleich({ kcal: 382, p: 30.4, kh: 36, f: 12.5 }, ZIELE[0]).trifft && !vergleich({ kcal: 382, p: 30.4, kh: 36, f: 15.5 }, ZIELE[0]).trifft, 'Vergleich: trifft / trifft nicht');

/* --------------------------------------------------- Profil der Liste */

let st = anwenden(leer(), opProfil({ ziel: ZIELE[0] }, 'Marielle'));
check(st.profil.ziel.kcal === 380 && st.profil.ziel.by === 'Marielle' && !!st.profil.ziel.at, 'opProfil: Ziel mit by/at');
st = anwenden(st, opProfil({ farbe: 'lila', person: 'Marielle' }));
check(st.profil.farbe === 'lila' && st.profil.person === 'Marielle' && st.profil.ziel.kcal === 380, 'opProfil: Farbe und Person dazu, das Ziel bleibt');
check(!anwenden(st, opProfil({ ziel: null })).profil.ziel && !anwenden(st, opProfil({ farbe: '' })).profil.farbe, 'opProfil: null bzw. leer nimmt es weg');
check(!anwenden(st, opProfil({ farbe: 'pink' })).profil.farbe && !anwenden(leer(), opProfil({ ziel: { kcal: 9999, p: 1, kh: 1, f: 1 } })).profil.ziel, 'opProfil: unbekannte Farbe und unsinniges Ziel fallen weg');
const roh = JSON.parse(JSON.stringify(st));
roh.profil.person = '<script>';
check(!bereinigen(roh).profil.person && bereinigen(roh).profil.farbe === 'lila', 'Bereinigen: ein kaputter Name fällt weg, der Rest bleibt');
const zus = anwenden(anwenden(leer(), opProfil({ farbe: 'lila' })), opZusammen({}, {}, { profil: st.profil }));
check(zus.profil.farbe === 'lila' && zus.profil.ziel.kcal === 380, 'Zusammenlegen (Netz unter einer alten Fassung): was fehlt, kommt dazu, was da ist, bleibt');
check('profil' in leer(), 'leer() hat ein Profil – die alte Fassung erkennt man daran');

// Was in der Commit-Nachricht steht
const K = daten.katalog;
let a = leer();
let b = anwenden(a, [opTeil('zwiebeln', 'chili', { q: 300, u: 'g', h: '' }, K.zwiebeln), opTeil('reis', 'chili', { q: 280, u: 'g', h: '' }, K.reis)]);
check(beschreibung(a, b, (rid) => (rid === 'chili' ? 'Chili' : '')) === 'Chili auf die Liste', `Beschreibung: „Chili auf die Liste“ (${beschreibung(a, b, () => 'Chili')})`);
a = b;
b = anwenden(a, opHaken(a, 'zwiebeln', true, 'Amy'));
check(beschreibung(a, b) === '1 abgehakt', 'Beschreibung: „1 abgehakt“');
a = b;
b = anwenden(a, opHaken(a, 'reis', true, 'Amy'));
check(beschreibung(a, b) === 'alles eingekauft', 'Beschreibung: das Letzte → „alles eingekauft“');
check(beschreibung(b, anwenden(b, opGekocht('chili', '2026-11-05', 'Amy')), () => 'Chili') === 'Chili gekocht', 'Beschreibung: gekocht');
check(beschreibung(b, anwenden(b, opProfil({ ziel: ZIELE[0] }))) === 'Ziel pro Box geändert' && beschreibung(b, anwenden(b, opPerson('Amy'))) === 'zum ersten Mal dabei', 'Beschreibung: Ziel, neue Person');

/* ============================================================ Browser */

const browser = await starteBrowser();
const gh = githubAttrappe();
const tobi = await handy(browser, { attrappe: gh });
const t = tobi.page;
await t.evaluate((k) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi' })), SCHLUESSEL);
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: verbunden');
check((await t.locator('#r-ziel').innerText()).replace(/\s+/g, ' ').includes('443 kcal 33 g P 39 g KH 15,4 g F'), 'Oben das Standard-Ziel');

// Chili auf die Liste, dann ein neues Ziel
await t.click('#grid .box[data-open="chili"]');
await t.click('[data-act="alle-dazu"]');
check(await bis(() => gh.liste()?.items?.rinderhack?.parts?.chili?.q === 500), 'Chili steht mit 500 g Hack auf der Liste');
await t.click('.tabbar .tab[data-tab="einstellungen"]');
await t.fill('#e-ziel-form input[name="kcal"]', '380');
await t.fill('#e-ziel-form input[name="p"]', '30');
await t.fill('#e-ziel-form input[name="kh"]', '35');
await t.fill('#e-ziel-form input[name="f"]', '12');
await t.click('#e-ziel-form button[type="submit"]');
check(await bis(() => gh.liste()?.profil?.ziel?.kcal === 380 && gh.liste().profil.ziel.f === 12), 'Gespeichert in liste.json: profil.ziel (alle vier Felder, auch nach dem Weitertippen)');
check(gh.zustand.nachrichten.some((m) => /^Tobi: Einkaufsliste, \d+ Änderung(en)? – Ziel pro Box geändert/.test(m)), 'Commit nennt, was passiert ist');
check((await t.locator('#e-ziel').innerText()).includes('treffen es genau'), 'Einstellungen: wie viele Rezepte das Ziel treffen');
const hackNeu = c380.items.find((it) => it.k === 'rinderhack').q;
check(await bis(() => gh.liste()?.items?.rinderhack?.parts?.chili?.q === hackNeu), `Die Liste zieht mit: Hack jetzt ${hackNeu} g`);
// Eine ältere App-Fassung (kennt kein Profil) schreibt die Datei: das Ziel kommt wieder dazu
const ohneProfil = gh.liste();
delete ohneProfil.profil;
ohneProfil.rev += 1;
gh.zustand.datei = JSON.stringify(ohneProfil);
gh.zustand.version++;
gh.zustand.sha = `sha${gh.zustand.version}`;
check(await bis(() => gh.liste()?.profil?.ziel?.kcal === 380, 8000), 'Schreibt eine ältere Fassung ohne Profil, kommt das Ziel von selbst wieder dazu');
await t.click('.tabbar .tab[data-tab="rezepte"]');
await t.click('[data-act="zurueck"]');
const kopf = (await t.locator('#r-ziel').innerText()).replace(/\s+/g, ' ');
check(kopf.includes('380 kcal 30 g P 35 g KH 12 g F') && kopf.includes('EUER ZIEL'), `Oben euer Ziel (${kopf})`);
check((await t.locator('#grid .box[data-open="chili"] .box-macros').innerText()).includes(String(c380.m.kcal)), `Karte: Chili mit ${c380.m.kcal} kcal`);
await t.click('#grid .box[data-open="chili"]');
check((await t.locator('.d-ziel').innerText()).includes('Auf euer Ziel gerechnet'), 'Im Rezept: worauf gerechnet ist');
check((await t.locator('#detail').innerText()).includes(`${hackNeu} g`), 'Im Rezept: die neue Menge in Zutaten und Schritten');

// Amy sieht es auch
const amy = await handy(browser, { attrappe: gh });
const am = amy.page;
await am.evaluate((k) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Amy' })), SCHLUESSEL);
await am.reload();
await am.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check(await bis(async () => (await am.locator('#grid .box[data-open="chili"] .box-macros').innerText()).includes(String(c380.m.kcal))), 'Amys Handy rechnet mit demselben Ziel');
await amy.ctx.close();

// Neu laden: sofort richtig (gemerkte Mengen), ohne Springen
await t.reload();
await t.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
check((await t.locator('#grid .box[data-open="chili"] .box-macros').innerText()).includes(String(c380.m.kcal)), 'Nach dem Neuladen gleich das eigene Ziel (noch vor dem Abgleich)');

// Zurück zum Standard
await t.click('.tabbar .tab[data-tab="einstellungen"]');
await t.click('[data-act="e-ziel-standard"]');
check(await bis(() => !gh.liste()?.profil?.ziel && gh.liste()?.items?.rinderhack?.parts?.chili?.q === 500), 'Zurück zum Standard: Ziel weg, die Liste wieder mit 500 g');
await t.click('.tabbar .tab[data-tab="rezepte"]');
if (await t.locator('[data-act="zurueck"]').isVisible()) await t.click('[data-act="zurueck"]');
check((await t.locator('#grid .box[data-open="chili"] .box-macros').innerText()).includes(String(chili.m.kcal)), 'Karten wieder mit den Werten aus daten/rezepte.json');

// pro Tag
await t.click('.tabbar .tab[data-tab="einstellungen"]');
await t.check('#e-ziel-form input[value="tag"]');
await t.fill('#e-ziel-form input[name="p"]', '120');
await t.dispatchEvent('#e-ziel-form input[name="p"]', 'input');
check((await t.locator('#e-ziel-vorschau').innerText()).includes('Pro Box'), 'pro Tag: darunter, was pro Box herauskommt');
check(tobi.fehler.length === 0, `keine Fehler im Browser (${tobi.fehler.join(' | ')})`);

await browser.close();
ende();
