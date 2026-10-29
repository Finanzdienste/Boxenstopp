/*
 * Dasselbe Produkt, zwei Namen – und Zeilen in eine andere Abteilung: erst
 * in Node (js/gleich.js, die Änderungen in liste.js), dann im Browser auf
 * zwei Handys mit der GitHub-Attrappe. „leckere Dino nuggies“ und „Dino
 * nuggets“ werden eine Zeile, „Kackbürste“ kommt zum Haushalt – und beides
 * gilt beim nächsten Mal wieder.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL, ROOT } from './hilfe.mjs';
import { woerter, wortWert, aehnlich, vorschlaege, richtung, rang, merkName, VORSCHLAG_AB } from '../js/gleich.js';
import { leer, anwenden, bereinigen, aufloesen, hatTeil, erledigt, opTeil, opTeilWeg, opHaken, opEigener, opErledigteWeg, opGleich, opGleichWeg, opUngleich, opAbteilung, opZusammen, opSetzen, paar } from '../js/liste.js';
import { abteilungVon, nachBereichen } from '../js/bereiche.js';
import { umleiten, nameSchluessel, abteilung } from '../js/format.js';

const { check, ende } = pruefer();
const D = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8'));
const K = D.katalog;

// --- Namen vergleichen
check(JSON.stringify(woerter('Leckere Dino Nuggies (TK)')) === JSON.stringify(['dino', 'nuggies', 'tk']), `Füllwörter fallen weg (${woerter('Leckere Dino Nuggies (TK)').join(' ')})`);
check(JSON.stringify(woerter('Milch 1,5 %')) === JSON.stringify(['milch', '1_5']), '„1,5 %“ bleibt eine Zahl');
check(wortWert('tomate', 'tomaten') === 1 && wortWert('ei', 'eier') === 1 && wortWert('nuggies', 'nuggets') === 0.85 && wortWert('mozarella', 'mozzarella') === 0.9 && wortWert('ceasar', 'caesar') === 0.9, 'Wörter: Mehrzahl, Koseform, Tippfehler, vertauschte Buchstaben');
check(wortWert('milch', 'milchreis') === 0 && wortWert('lachs', 'lauch') === 0 && wortWert('himbeeren', 'brombeeren') === 0, '… aber Milch ist kein Milchreis und Lachs kein Lauch');
const gleich = [['leckere Dino nuggies', 'Dino nuggets'], ['Dinonuggets', 'Dino Nuggets'], ['Spaghetti', 'Spagetti'], ['Nuggets', 'Dino Nuggets'], ['Große Zwiebel', 'Zwiebeln']];
const verschieden = [['Milch', 'Kokosmilch'], ['Paprika', 'Paprikapulver'], ['Tomaten', 'Kirschtomaten'], ['Milch 3,5%', 'Milch 1,5%'], ['Tomaten passiert', 'Tomaten gehackt'], ['Butter', 'Butterkäse'], ['Kartoffeln', 'Süßkartoffeln']];
check(gleich.every(([a, b]) => aehnlich(a, b) >= VORSCHLAG_AB), `ähnlich genug: ${gleich.map(([a, b]) => `${a} – ${b} ${aehnlich(a, b)}`).join(' · ')}`);
check(verschieden.every(([a, b]) => aehnlich(a, b) < VORSCHLAG_AB), `verschieden: ${verschieden.map(([a, b]) => `${a} – ${b} ${aehnlich(a, b)}`).join(' · ')}`);
check(aehnlich('Dino Nuggies', 'Dino nuggets') > aehnlich('Nuggets', 'Dino Nuggets'), 'zwei passende Wörter zählen mehr als eins');

// --- Wer wohin
check(rang('haehnchenbrust', K) === 3 && rang('ki-abc', K) === 2 && rang('amyz-x', K) === 1 && rang('c-123', K) === 0, 'Rang: Katalog, Resteverwertung, Amys Zutaten, eigene Einträge');
const zeile = (name, parts = {}, extra = {}) => ({ name, cat: 'sonstiges', parts, custom: !Object.keys(parts).length, checked: false, by: null, at: 't', added: 't', ...extra });
check(JSON.stringify(richtung(['c-1', zeile('Hähnchen')], ['haehnchenbrust', zeile('Hähnchenbrustfilet', { a: { q: 1, u: 'g' } })], K)) === JSON.stringify(['c-1', 'haehnchenbrust']), 'in die Katalog-Zeile, egal wer anfängt');
check(JSON.stringify(richtung(['amyz-a', zeile('Dino Nuggies', { x: { q: 5, u: 'Stk' } })], ['amyz-b', zeile('Dino nuggets', { y: { q: 1, u: 'Pck' } })], K, 'amyz-a')) === JSON.stringify(['amyz-b', 'amyz-a']), 'bei Gleichstand: die ausdrücklich gewählte');

// --- Vorschläge
let s = anwenden(leer(), [
  opTeil('amyz-dino-nuggies', 'amy-wrap-1', { q: 5, u: 'Stk', h: '' }, { n: 'Dino Nuggies', c: 'sonstiges' }),
  opTeil('amyz-dino-nuggets', 'amy-teller-2', { q: 1, u: 'Pck', h: '' }, { n: 'Dino nuggets', c: 'sonstiges' }),
  opTeil('paprika', 'chili', { q: 2, u: 'Stk', h: '' }, K.paprika),
  opTeil('paprikapulver', 'chili', { q: 1, u: 'TL', h: '' }, K.paprikapulver || { n: 'Paprikapulver', c: 'gewuerz' }),
  opEigener('c-milch', 'Milch', 'kuehl'),
  opEigener('c-milch2', 'Milch 1,5 %', 'kuehl'),
]);
let v = vorschlaege(s, K);
check(v.length === 2 && v[0].wert > 0.9 && [v[0].von, v[0].nach].sort().join() === 'amyz-dino-nuggets,amyz-dino-nuggies', `Vorschläge: die Nuggets zuerst, dann die Milch (${v.map((x) => `${x.von}→${x.nach} ${x.wert}`).join(' · ')})`);
check(!v.some((x) => x.von.startsWith('paprika')), 'zwei Katalog-Zutaten schlägt die App nie vor');
s = anwenden(s, opUngleich(merkName('c-milch', s.items['c-milch']), merkName('c-milch2', s.items['c-milch2'])));
check(vorschlaege(s, K).length === 1 && s.ungleich.includes(paar('n:milch', 'n:milch-1-5')), '„Nein, verschieden“: das Paar kommt nicht wieder – auch nicht als neuer eigener Eintrag mit dem Namen');
s = anwenden(s, [opLoeschenAlle('c-milch2'), opEigener('c-milch3', 'Milch 1,5 %', 'kuehl')]);
check(vorschlaege(s, K).length === 1, '… gemerkt am Namen, nicht an der zufälligen id');
function opLoeschenAlle(k) { return { typ: 'loeschen', k }; }

// --- Zusammenlegen im Stand
const { von, nach } = vorschlaege(s, K)[0];
s = anwenden(s, opGleich(von, nach, [nameSchluessel(s.items[von].name)], { name: s.items[nach].name, cat: s.items[nach].cat }));
const n = s.items[nach];
check(!s.items[von] && Object.keys(n.parts).length === 2 && s.gleich[von] === nach && aufloesen(s, von) === nach, `eine Zeile mit beiden Teilen; ${von} zeigt auf ${nach}`);
check(vorschlaege(s, K).length === 0, 'danach kein Vorschlag mehr');
// Später: das Rezept kommt wieder auf die Liste – unter dem alten Schlüssel
const altRid = von === 'amyz-dino-nuggies' ? 'amy-wrap-1' : 'amy-teller-2';
s = anwenden(s, opTeilWeg(von, altRid));
check(!n.parts[altRid] || !s.items[nach].parts[altRid], 'vom Rezept genommen: das Teil ist aus der gemeinsamen Zeile weg');
s = anwenden(s, opTeil(von, altRid, { q: 5, u: 'Stk', h: '' }, { n: 'Dino Nuggies', c: 'sonstiges' }));
check(!s.items[von] && s.items[nach].parts[altRid] && hatTeil(s, von, altRid), 'wieder drauf: landet gleich in der gemeinsamen Zeile (gemerkt)');
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).gleich) === JSON.stringify(s.gleich) && JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).ungleich) === JSON.stringify(s.ungleich), 'übersteht Speichern und Bereinigen');
check(!Object.keys(bereinigen({ gleich: { a: 'a', 'b c': 'x', ok: 'ziel' }, ungleich: ['a|b', 'kaputt', 'x y|z'] }).gleich).includes('a') && bereinigen({ gleich: { ok: 'ziel' } }).gleich.ok === 'ziel' && JSON.stringify(bereinigen({ ungleich: ['a|b', 'kaputt', 'x y|z'] }).ungleich) === JSON.stringify(['a|b']), 'Unsinn fällt weg');
check(umleiten({ a: 'b', b: 'a' }, 'a') !== undefined && umleiten({ a: 'b', b: 'c' }, 'a') === 'c', 'Ketten werden verfolgt, Kreise hängen nicht');
// Rückgängig: Umleitung weg, Zeilen wie vorher
const vorher = anwenden(leer(), [opTeil('amyz-a', 'r1', { q: 1, u: 'Stk', h: '' }, { n: 'A', c: 'obst' }), opTeil('amyz-b', 'r2', { q: 2, u: 'Stk', h: '' }, { n: 'B', c: 'obst' })]);
const zus = anwenden(vorher, opGleich('amyz-a', 'amyz-b', ['n:a']));
const zurueck = anwenden(zus, [opGleichWeg(['amyz-a', 'n:a']), opSetzen('amyz-a', vorher.items['amyz-a']), opSetzen('amyz-b', vorher.items['amyz-b'])]);
check(['amyz-a', 'amyz-b'].every((k) => JSON.stringify(zurueck.items[k]) === JSON.stringify(vorher.items[k])) && Object.keys(zurueck.items).length === 2 && !Object.keys(zurueck.gleich).length, 'Rückgängig: alles wie vorher');
// Dasselbe Rezept in beiden Zeilen: gleiche Einheiten zählen zusammen
const doppelt = anwenden(leer(), [opTeil('amyz-a', 'r1', { q: 2, u: 'Stk', h: '' }, { n: 'A' }), opTeil('amyz-b', 'r1', { q: 3, u: 'Stk', h: '' }, { n: 'B' }), opGleich('amyz-a', 'amyz-b')]);
check(doppelt.items['amyz-b'].parts.r1.q === 5, 'dasselbe Rezept zweimal: 2 + 3 Stück = 5');
// Das andere Handy hat die Zielzeile schon gelöscht: sie entsteht mit ihrem Namen neu
const weg = anwenden(leer(), [opTeil('amyz-a', 'r1', { q: 2, u: 'Stk', h: '' }, { n: 'A' }), opGleich('amyz-a', 'amyz-b', [], { name: 'Dino nuggets', cat: 'fleisch' })]);
check(weg.items['amyz-b']?.name === 'Dino nuggets' && weg.items['amyz-b'].parts.r1 && !weg.items['amyz-a'], 'Zielzeile fehlt: sie entsteht neu, mit ihrem Namen');
// Zwei eigene Einträge: offen, solange einer offen ist
const zwei = anwenden(leer(), [opEigener('c-1', 'Milch', 'kuehl'), opEigener('c-2', 'Milch', 'kuehl'), { typ: 'haken', k: 'c-2', rids: [], done: true, by: 'Tobi', at: 't' }, opGleich('c-1', 'c-2')]);
check(!erledigt(zwei.items['c-2']) && !zwei.items['c-1'] && !Object.keys(zwei.gleich).length, 'zwei eigene „Milch“: eine Zeile, noch offen – eigene ids merkt sich die App nicht');
// Eigener Eintrag unter dem Schlüssel einer Zeile, dann kommt ein Rezept dazu: Abhaken geht über alles
let e = anwenden(leer(), opSetzen('amyz-dino', zeile('Dino nuggets')));
e = anwenden(e, opTeil('amyz-dino', 'r1', { q: 1, u: 'Pck', h: '' }, { n: 'Dino nuggets' }));
e = anwenden(e, opHaken(e, 'amyz-dino', true, 'Amy'));
check(erledigt(e.items['amyz-dino']) && e.items['amyz-dino'].checked === true, 'eigener Eintrag mit Teil: abhaken hakt beides ab');
e = anwenden(e, opErledigteWeg());
check(!e.items['amyz-dino'], '„Erledigte entfernen“ nimmt ihn mit');
// zusammen (zweites Handy richtet sich ein) kennt die Umleitungen auch
const z = anwenden(leer(), [opTeil('amyz-b', 'r2', { q: 1, u: 'Stk', h: '' }, { n: 'B' }), opZusammen({ 'amyz-a': zeile('A', { r1: { q: 1, u: 'Stk', h: '' } }) }, {}, { gleich: { 'amyz-a': 'amyz-b' } })]);
check(!z.items['amyz-a'] && z.items['amyz-b'].parts.r1, 'zusammen: was unter dem alten Schlüssel kommt, landet in der neuen Zeile');

// --- Abteilungen
let a = anwenden(leer(), [opEigener('c-k', 'Kackbürste', abteilung('Kackbürste', K)), opTeil('amyz-dino-nuggies', 'r1', { q: 5, u: 'Stk', h: '' }, { n: 'Dino Nuggies', c: 'sonstiges' })]);
check(abteilung('Kackbürste', K) === 'haushalt' && abteilung('Dino Nuggies', K) === 'fleisch' && abteilung('Croutons', K) === 'trocken', 'beim Eintippen geraten: Bürste zum Haushalt, Nuggets zum Fleisch, Croutons zu Trockenem');
a = anwenden(a, opAbteilung({ 'amyz-dino-nuggies': 'tk', 'n:dino-nuggies': 'tk' }));
check(abteilungVon('amyz-dino-nuggies', a.items['amyz-dino-nuggies'], K, a.abteilungen) === 'tk' && nachBereichen(a, K).find((g) => g.eintraege.some(([k]) => k === 'amyz-dino-nuggies')).bereich.id === 'trocken', 'verschoben: Tiefkühl (bei „Trockenes, auch TK“)');
check(abteilungVon('c-neu', { name: 'Dino Nuggies', custom: true }, K, a.abteilungen) === 'tk', 'ein neuer eigener Eintrag mit dem Namen landet auch dort');
a = anwenden(a, opAbteilung({ 'amyz-dino-nuggies': null, 'n:dino-nuggies': null }));
check(!Object.keys(a.abteilungen).length, 'null vergisst es wieder (Rückgängig)');
check(!Object.keys(bereinigen({ abteilungen: { ok: 'quatsch', 'a b': 'obst' } }).abteilungen).length && bereinigen({ abteilungen: { ok: 'obst' } }).abteilungen.ok === 'obst', 'nur bekannte Abteilungen');

// --- Im Browser: zwei Handys
const t0 = '2026-10-29T10:00:00Z';
const amyRezept = (id, name, zutaten) => ({ id, name, bild: 'cooking', portionen: 2, zeit: 15, zutaten, schritte: ['10 Min. backen'], notiz: '', by: 'Amy', at: t0, geaendert: t0 });
const gh = githubAttrappe();
gh.zustand.datei = JSON.stringify({
  version: 1,
  rev: 1,
  items: {
    'c-k1': { name: 'Kackbürste', cat: 'sonstiges', parts: {}, custom: true, checked: false, by: null, at: t0, added: t0 },
  },
  amy: {
    'amy-wrap-ab12': amyRezept('amy-wrap-ab12', 'Chicken Wrap', ['1 großen (Dürüm)Wrap', 'leckere Dino nuggies']),
    'amy-teller-cd34': amyRezept('amy-teller-cd34', 'Dino-Teller', ['1 Pck Dino nuggets', '300 g Kartoffeln']),
  },
});
gh.zustand.version = 1;
gh.zustand.sha = 'sha1';
const browser = await starteBrowser();
const tobi = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const t = tobi.page;
await t.fill('#z-name', 'Tobi');
await t.click('#z-los');
check(await bis(async () => (await t.locator('#sync-text').innerText()) === 'Geteilt'), 'Tobi: eingerichtet');
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const p = amy.page;
await p.fill('#z-name', 'Amy');
await p.click('#z-los');
check(await bis(async () => (await p.locator('#sync-text').innerText()) === 'Geteilt'), 'Amy: eingerichtet');

// Die Kackbürste steht bei Sonstiges – antippen, Haushalt
const gruppeVon = (pg, name) => pg.locator('#list-body .grp', { has: pg.locator('.item-name', { hasText: new RegExp(`^${name}$`) }) }).getAttribute('data-bereich');
await p.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await gruppeVon(p, 'Kackbürste')) === 'sonstiges') && (await p.locator('.grp[data-bereich="sonstiges"] h3').innerText()).toLowerCase().includes('antippen zum einsortieren'), 'Sonstiges: „antippen zum Einsortieren“');
await p.click('#list-body [data-mehr="c-k1"]');
check(await p.locator('#l-mehr').isVisible() && (await p.getAttribute('[data-mehr="c-k1"]', 'aria-expanded')) === 'true' && (await p.getAttribute('#l-mehr [data-abt="sonstiges"]', 'aria-pressed')) === 'true', 'aufgeklappt: „Gehört zu“, gerade Sonstiges');
await p.click('#l-mehr [data-abt="haushalt"]');
check(await bis(async () => (await gruppeVon(p, 'Kackbürste')) === 'extras') && (await p.locator('#toast').innerText()).includes('Haushalt'), 'Haushalt gewählt: jetzt bei Extras (Haushalt)');
check(await bis(() => gh.liste()?.abteilungen?.['n:kackbuerste'] === 'haushalt'), 'gemerkt in GitHub, am Namen');
check(await bis(async () => (await gruppeVon(t, 'Kackbürste')) === 'extras').catch(() => false) || await (async () => { await t.click('.tab[data-tab="einkauf"]'); return bis(async () => (await gruppeVon(t, 'Kackbürste')) === 'extras'); })(), 'bei Tobi auch');
await p.click('[data-del="c-k1"]');
await p.fill('#add-input', 'Kackbürste');
await p.press('#add-input', 'Enter');
check(await bis(async () => (await gruppeVon(p, 'Kackbürste')) === 'extras'), 'neu eingetippt: gleich bei Haushalt – gemerkt');

// Beide Rezepte auf die Liste: „leckere Dino nuggies“ und „Dino nuggets“
await p.click('.tab[data-tab="amy"]');
for (const id of ['amy-wrap-ab12', 'amy-teller-cd34']) {
  await p.click(`#view-amy .amy-karte[data-amy-open="${id}"]`);
  await p.click('[data-act="amy-alle-dazu"]');
  await p.click('[data-act="amy-liste"]');
}
await p.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await p.locator('#l-gleich').isVisible())), 'über der Liste: „Dasselbe?“');
const frage = await p.locator('#l-gleich').innerText();
check(frage.includes('Leckere Dino nuggies') && frage.includes('Dino nuggets') && frage.includes('♡ Chicken Wrap') && frage.includes('♡ Dino-Teller'), `mit beiden Namen und woher sie kommen (${frage.replace(/\s+/g, ' ')})`);
await p.click('#l-gleich [data-gleich-ja]');
check(await bis(async () => (await p.locator('#list-body .item-name', { hasText: /nugg/i }).count()) === 1) && !(await p.locator('#l-gleich').isVisible()), 'zusammengelegt: eine Zeile, keine Frage mehr');
const eine = gh.liste;
check(await bis(() => eine()?.gleich?.['amyz-leckere-dino-nuggies'] === 'amyz-dino-nuggets' && eine()?.items?.['amyz-dino-nuggets'] && Object.keys(eine().items['amyz-dino-nuggets'].parts).length === 2), 'in GitHub: „Dino nuggets“ mit beiden Rezepten, die Umleitung gemerkt');
check(await bis(async () => (await t.locator('#list-body .item-name', { hasText: /nugg/i }).count()) === 1), 'bei Tobi auch eine Zeile');
await p.click('#toast button');
check(await bis(async () => (await p.locator('#list-body .item-name', { hasText: /nugg/i }).count()) === 2) && await bis(() => !gh.liste()?.gleich?.['amyz-leckere-dino-nuggies']), 'Rückgängig: wieder zwei Zeilen, Umleitung vergessen');
// Diesmal von Hand über „Ist dasselbe wie“
await p.click('#list-body [data-mehr="amyz-leckere-dino-nuggies"]');
await p.selectOption('#l-mehr select[data-gleich-mit]', 'amyz-dino-nuggets');
check(await bis(async () => (await p.locator('#list-body .item-name', { hasText: /nugg/i }).count()) === 1) && await bis(() => gh.liste()?.gleich?.['amyz-leckere-dino-nuggies'] === 'amyz-dino-nuggets'), 'von Hand: „Ist dasselbe wie … Dino nuggets“');
// Das Wrap von der Liste und wieder drauf: landet gleich in der gemeinsamen Zeile
await p.click('#forrow [data-rmrec="amy-wrap-ab12"]');
check(await bis(() => !gh.liste()?.items?.['amyz-dino-nuggets']?.parts?.['amy-wrap-ab12']), 'Wrap von der Liste genommen');
await p.click('.tab[data-tab="amy"]');
await p.click('#view-amy .amy-karte[data-amy-open="amy-wrap-ab12"]');
const erkannt = await p.locator('#view-amy .ing-name').allInnerTexts();
check(erkannt.includes('Leckere Dino nuggies'), 'im Rezept steht weiter, was Amy geschrieben hat');
await p.click('[data-act="amy-alle-dazu"]');
check(await bis(() => gh.liste()?.items?.['amyz-dino-nuggets']?.parts?.['amy-wrap-ab12'] && !gh.liste()?.items?.['amyz-leckere-dino-nuggies']), 'wieder drauf: gleich in der Zeile „Dino nuggets“ – gemerkt');
await p.click('[data-act="amy-bearbeiten"]');
check((await p.locator('#amy-erkannt').innerText()).includes('= Dino nuggets'), 'im Editor: „leckere Dino nuggies = Dino nuggets“');
await p.click('[data-act="amy-abbrechen"]');
// Nuggets stehen beim Fleisch (geraten) – bei euch liegen sie aber im Tiefkühler
await p.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await gruppeVon(p, 'Dino nuggets')) === 'tierisch'), 'Dino nuggets: geraten beim Fleisch (Tierisches)');
await p.click('#list-body [data-mehr="amyz-dino-nuggets"]');
check((await p.getAttribute('#l-mehr [data-abt="fleisch"]', 'aria-pressed')) === 'true', '… so steht es auch beim Aufklappen');
await p.click('#l-mehr [data-abt="tk"]');
check(await bis(async () => (await gruppeVon(p, 'Dino nuggets')) === 'trocken') && await bis(() => gh.liste()?.abteilungen?.['amyz-dino-nuggets'] === 'tk'), 'zu Tiefkühl verschoben: jetzt bei „Trockenes, auch TK“, gemerkt');
await p.click('#toast button');
check(await bis(async () => (await gruppeVon(p, 'Dino nuggets')) === 'tierisch') && await bis(() => !gh.liste()?.abteilungen?.['amyz-dino-nuggets']), 'Rückgängig: zurück beim Fleisch, vergessen');
// „Nein, verschieden“
await p.fill('#add-input', 'Hafermilch');
await p.press('#add-input', 'Enter');
await p.fill('#add-input', 'Hafermilch Barista');
await p.press('#add-input', 'Enter');
check(await bis(async () => (await p.locator('#l-gleich').innerText().catch(() => '')).includes('Hafermilch Barista')), 'zwei ähnliche eigene Einträge: die App fragt');
await p.click('#l-gleich [data-gleich-nein]');
check(await bis(async () => !(await p.locator('#l-gleich').isVisible())) && await bis(() => gh.liste()?.ungleich?.includes('n:hafermilch|n:hafermilch-barista')), '„Nein, verschieden“: weg, und gemerkt');
await p.reload({ waitUntil: 'load' });
await p.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await p.locator('#list-body .item-name', { hasText: 'Hafermilch Barista' }).count()) === 1) && !(await p.locator('#l-gleich').isVisible()), 'nach dem Neuladen fragt sie nicht wieder');
check(tobi.fehler.length === 0 && amy.fehler.length === 0, `keine Fehler in der Konsole${[...tobi.fehler, ...amy.fehler].length ? `: ${[...tobi.fehler, ...amy.fehler].slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
