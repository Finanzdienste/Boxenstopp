/*
 * Essensplan: erst die Rechnung in Node (js/essensplan.js – Tage, Bereinigen,
 * Setzen und Wegnehmen, Boxen verteilen, was einzukaufen ist), dann im
 * Browser: ein Kochtag, Boxen verteilen, etwas eintragen (Rezept, Text, Idee
 * aus Amys Notizen), wer isst mit, was Amy nicht verträgt, die Woche auf die
 * Einkaufsliste, Austragen mit Rückgängig, Wochen blättern – und Tobi sieht
 * alles.
 */
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL } from './hilfe.mjs';
import { leer, anwenden, bereinigen, beschreibung } from '../js/liste.js';
import {
  essensplanBereinigen, opEssensplan, boxenVerteilen, verplant, einkaufDerWoche, boxenVon, kochtage,
  montagVon, wocheVon, tagPlus, wochentag, heuteTag, tagName, tagDatum,
} from '../js/essensplan.js';
import { opBlatt } from '../js/notizbuch.js';
import { opVertraeglich } from '../js/vertraeglich.js';

const { check, ende } = pruefer();

// --- Tage
check(wochentag('2026-11-09') === 0 && wochentag('2026-11-15') === 6, 'Montag ist 0, Sonntag 6');
check(montagVon('2026-11-12') === '2026-11-09' && montagVon('2026-11-09') === '2026-11-09', 'der Montag einer Woche');
check(JSON.stringify(wocheVon('2026-11-09')) === JSON.stringify(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']), 'eine Woche: sieben Tage');
check(tagPlus('2026-10-24', 2) === '2026-10-26' && tagPlus('2026-03-28', 2) === '2026-03-30', 'über die Zeitumstellung hinweg');
check(tagName('2026-11-11') === 'Mittwoch' && tagDatum('2026-11-11') === '11.11.', 'Name und Datum');

// --- Bereinigen und Ändern
const HEUTE = '2026-11-09';
const roh = {
  tage: {
    '2026-10-01': { mittag: [{ id: 'ep-alt1', text: 'Alt', wer: 'beide' }] },
    '2026-11-10': {
      mittag: [{ id: 'ep-aaaa1', rid: 'chili', wer: 'Tobi', box: 'ek-kkkk1' }, { id: 'kaputt', text: 'x' }, { id: 'ep-leer1', wer: 'Amy' }],
      abend: [{ id: 'ep-bbbb1', text: 'Pizza bestellen\n', wer: '<b>' }],
      kochen: [{ id: 'ek-kkkk1', rid: 'chili', boxen: 99 }],
    },
    'kein-tag': { mittag: [] },
    '2028-01-01': { mittag: [{ id: 'ep-weit1', text: 'zu weit', wer: 'beide' }] },
  },
};
const b = essensplanBereinigen(roh, HEUTE);
check(Object.keys(b.tage).join() === '2026-11-10', `nur gültige Tage im Fenster (drei Wochen zurück, ein halbes Jahr voraus): ${Object.keys(b.tage)}`);
check(b.tage['2026-11-10'].mittag.length === 1 && b.tage['2026-11-10'].mittag[0].box === 'ek-kkkk1', 'Einträge ohne gültige id oder ohne Inhalt fallen raus');
check(b.tage['2026-11-10'].abend[0].text === 'Pizza bestellen' && b.tage['2026-11-10'].abend[0].wer === 'beide', 'Text ohne Zeilenumbruch, unbekanntes „wer“ wird „beide“');
check(b.tage['2026-11-10'].kochen[0].boxen === 8, 'unmögliche Boxen: 8');

let s = leer();
const E = (id, x) => ({ id, ...x });
s = anwenden(s, opEssensplan({ setzen: [{ tag: '2026-11-08', mahlzeit: 'kochen', e: E('ek-chili1', { rid: 'chili', boxen: 8 }) }] }, 'Tobi'));
check(kochtage(s.essensplan).length === 1 && s.essensplan.tage['2026-11-08'].kochen[0].by === 'Tobi', 'Kochtag gesetzt, mit „by“');
let v = boxenVerteilen(s.essensplan, { tag: '2026-11-08', k: s.essensplan.tage['2026-11-08'].kochen[0], wer: 'beide', mahlzeit: 'mittag', werktage: true });
check(v.mahlzeiten === 4 && v.rest === 0 && v.setzen.map((x) => x.tag).join() === '2026-11-09,2026-11-10,2026-11-11,2026-11-12', `8 Boxen für beide: Mo–Do Mittag (${v.setzen.map((x) => x.tag)})`);
v = boxenVerteilen(s.essensplan, { tag: '2026-11-08', k: s.essensplan.tage['2026-11-08'].kochen[0], wer: 'Tobi', mahlzeit: 'mittag', werktage: true });
check(v.mahlzeiten === 8 && v.setzen[4].tag === '2026-11-16' && !v.setzen.some((x) => ['2026-11-14', '2026-11-15'].includes(x.tag)), 'für einen: acht Werktage, das Wochenende frei');
// Amy hat Dienstag Mittag schon etwas: für beide bleibt der Tag frei, für Tobi allein nicht
s = anwenden(s, opEssensplan({ setzen: [{ tag: '2026-11-10', mahlzeit: 'mittag', e: E('ep-amy01', { text: 'Salat', wer: 'Amy' }) }] }, 'Amy'));
v = boxenVerteilen(s.essensplan, { tag: '2026-11-08', k: s.essensplan.tage['2026-11-08'].kochen[0], wer: 'beide', mahlzeit: 'mittag', werktage: false, abHeute: false });
check(!v.setzen.some((x) => x.tag === '2026-11-10') && v.setzen.length === 4, 'belegt (Amy isst Salat): für beide wird der Tag übersprungen');
v = boxenVerteilen(s.essensplan, { tag: '2026-11-08', k: s.essensplan.tage['2026-11-08'].kochen[0], wer: 'Tobi', mahlzeit: 'mittag', werktage: true });
check(v.setzen[1].tag === '2026-11-10', '… für Tobi allein nicht – Amys Salat ist ihrer');
s = anwenden(s, opEssensplan({ setzen: v.setzen.slice(0, 3) }, 'Tobi'));
check(verplant(s.essensplan, 'ek-chili1') === 3 && boxenVon(s.essensplan, 'ek-chili1').length === 3, 'drei Boxen verplant');
v = boxenVerteilen(s.essensplan, { tag: '2026-11-08', k: s.essensplan.tage['2026-11-08'].kochen[0], wer: 'beide', mahlzeit: 'abend', werktage: false });
check(v.mahlzeiten === 2 && v.rest === 1, 'der Rest (5): zwei Abende für beide, eine Box bleibt');
// Wegnehmen und Ersetzen
const id0 = s.essensplan.tage['2026-11-09'].mittag[0].id;
s = anwenden(s, opEssensplan({ setzen: [{ tag: '2026-11-09', mahlzeit: 'mittag', e: { ...s.essensplan.tage['2026-11-09'].mittag[0], wer: 'beide' } }] }, 'Amy'));
check(s.essensplan.tage['2026-11-09'].mittag.length === 1 && s.essensplan.tage['2026-11-09'].mittag[0].wer === 'beide' && verplant(s.essensplan, 'ek-chili1') === 4, 'gleiche id ersetzt (jetzt für beide: zwei Boxen)');
s = anwenden(s, opEssensplan({ weg: [{ tag: '2026-11-09', mahlzeit: 'mittag', id: id0 }] }, 'Amy'));
check(!s.essensplan.tage['2026-11-09'], 'weg – ein leerer Tag verschwindet');
// Einkaufen
s = anwenden(s, opEssensplan({ setzen: [{ tag: '2026-11-12', mahlzeit: 'abend', e: E('ep-amyr01', { rid: 'amy-lasagne-1', wer: 'beide' }) }, { tag: '2026-11-13', mahlzeit: 'abend', e: E('ep-text01', { text: 'Pizza', wer: 'beide' }) }] }, 'Amy'));
const ek = einkaufDerWoche(s.essensplan, '2026-11-02');
check(ek.length === 1 && ek[0].rid === 'chili' && ek[0].boxen === 8, 'Woche mit dem Kochtag (So 8.11.): Chili, 8 Boxen');
const ek2 = einkaufDerWoche(s.essensplan, '2026-11-09');
check(ek2.map((x) => x.rid).join() === 'amy-lasagne-1', 'Woche danach: nur, was frisch gekocht wird – keine Boxen, kein Text');
// Bereinigen nach dem Ändern (wie beim Lesen aus GitHub) und Beschreibung im Commit
check(JSON.stringify(bereinigen(JSON.parse(JSON.stringify(s))).essensplan) === JSON.stringify(s.essensplan), 'bereinigt bleibt der Plan, wie er ist');
check(beschreibung(leer(), s).includes('Essensplan'), `Commit: „Essensplan“ (${beschreibung(leer(), s)})`);

// --- Im Browser
const browser = await starteBrowser();
const gh = githubAttrappe();
const heute = heuteTag();
const montag = montagVon(heute);
// Ein Plan, den Amy und Tobi teilen; Amy verträgt keine Zwiebeln; in ihren Notizen stehen Ideen
const start = [
  opBlatt({ id: 'nb-ideen1', titel: 'Ideen', text: '- Kürbis-Bowl\n- Linsensuppe mit Kokos', farbe: 'rosa', tags: [] }, 'Amy'),
  opVertraeglich('Amy', { zwiebeln: { name: 'Zwiebeln', stufe: 'nicht' } }, 'Amy'),
];
gh.zustand.datei = JSON.stringify({ ...anwenden(leer(), start), rev: 1, leute: { amy: 'Amy', tobi: 'Tobi' } });
gh.zustand.sha = 'sha0';
const verbunden = async (wer) => {
  const h = await handy(browser, { attrappe: gh });
  await h.page.evaluate(([k, n]) => localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: n })), [SCHLUESSEL, wer]);
  await h.page.reload({ waitUntil: 'load' });
  await h.page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
  await bis(async () => (await h.page.locator('#sync-text').innerText()) === 'Geteilt');
  return h;
};
const A = await verbunden('Amy');
const a = A.page;
check(await a.locator('.tab[data-tab="plan"]').isVisible() && (await a.locator('.tab[data-tab="plan"] .tab-l').innerText()) === 'Essensplan', 'unten ein Reiter „Essensplan“');
await a.click('.tab[data-tab="plan"]');
check(await bis(async () => (await a.locator('#plan-titel').innerText()) === 'Essensplan'), 'Reiter offen');
check(await a.locator('.plan-tag').count() === 7 && await a.locator(`#pt-${heute}.is-heute`).count() === 1, 'sieben Tage, heute markiert');
check((await a.locator('.plan-woche-t b').innerText()) === 'Diese Woche', '„Diese Woche“');

// Kochtag: heute Chili, dann verteilen – für beide Mittag
await a.click(`[data-plan-neu="${heute}|kochen"]`);
await a.fill('#plan-suche', 'chili');
check(await a.locator('[data-plan-wahl="rid:chili"]').count() === 1, 'beim Kochtag: Rezepte zum Suchen');
check(await a.locator('[data-plan-wahl="rid:chili"] .vt-zeichen.vt-nicht').count() === 1, 'Chili hat Zwiebeln – ✗ für Amy schon im Vorschlag');
await a.click('[data-plan-wahl="rid:chili"]');
check(await a.locator('.plan-verteilen').count() === 1, 'nach dem Kochtag gleich: Boxen verteilen');
check(await a.locator('[data-plan-v-wer="beide"][aria-checked="true"]').count() === 1, 'vorgewählt: für beide');
const vorschau = await a.locator('.plan-vorschau').innerText();
check(/Mittag für euch beide/.test(vorschau), `Vorschau (${vorschau})`);
await a.click('[data-plan-v-tage="alle"]');
check(/Mittag für euch beide/.test(await a.locator('.plan-vorschau').innerText()), 'umgestellt: jeden Tag');
await a.click('[data-act="plan-verteilen-los"]');
const mittagsBoxen = () => Object.values(gh.liste()?.essensplan?.tage || {}).flatMap((t) => t.mittag || []).filter((e) => e.box);
check(await bis(() => mittagsBoxen().length === 4 && mittagsBoxen().every((e) => e.wer === 'beide' && e.rid === 'chili')), `in GitHub: vier Mittage mit Chili für beide (${mittagsBoxen().length})`);
check(gh.liste().essensplan.tage[heute].kochen[0].boxen === 8 && gh.liste().essensplan.tage[heute].kochen[0].by === 'Amy', 'Kochtag mit 8 Boxen, von Amy');
const morgen = tagPlus(heute, 1);
check(await a.locator(`#pt-${morgen} .plan-e.ist-box`).count() === 1, 'morgen steht die Box im Plan');

// Abend: Text, Idee aus den Notizen, ein Rezept – und wer
await a.click(`[data-plan-neu="${heute}|abend"]`);
check(await a.locator('.plan-wer-chip').count() === 3, 'wer: Beide, Amy, Tobi');
check(await a.locator('.plan-idee:has-text("Kürbis-Bowl")').count() === 1, 'Ideen aus Amys Notizen als Vorschlag');
await a.click('.plan-idee:has-text("Kürbis-Bowl")');
check(await bis(() => (gh.liste()?.essensplan?.tage?.[heute]?.abend || []).some((e) => e.text === 'Kürbis-Bowl' && e.wer === 'beide')), 'Idee eingetragen: „Kürbis-Bowl“ für beide');
await a.click(`[data-plan-neu="${morgen}|abend"]`);
await a.click('[data-plan-wer="Amy"]');
await a.fill('#plan-suche', 'Pizza bestellen');
await a.press('#plan-suche', 'Enter');
check(await bis(() => (gh.liste()?.essensplan?.tage?.[morgen]?.abend || []).some((e) => e.text === 'Pizza bestellen' && e.wer === 'Amy')), 'Text mit Enter: „Pizza bestellen“ nur für Amy');

// Die Box antippen: wer ändern, Rezept öffnen
await a.click(`#pt-${morgen} .plan-e.ist-box`);
check(await a.locator('#plan-editor .vt-hinweis.vt-ist-nicht').count() === 1, 'offen: „✗ Für dich: Zwiebeln geht nicht“');
await a.click('[data-plan-wer-e="Tobi"]');
check(await bis(() => (gh.liste()?.essensplan?.tage?.[morgen]?.mittag || []).some((e) => e.box && e.wer === 'Tobi')), 'nur noch Tobi');
check(await bis(async () => (await a.locator(`#pt-${morgen} .plan-e.ist-box .vt-zeichen`).count()) === 0), 'isst Amy nicht mit, kein ✗ mehr');
await a.click(`#pt-${morgen} .plan-e.ist-box`);
await a.click('[data-act="plan-oeffnen"]');
check(await bis(async () => await a.evaluate(() => document.documentElement.dataset.tab) === 'rezepte' && (await a.locator('#d-title').count()) === 1), 'Rezept öffnen: das Chili');
await a.click('[data-act="zurueck"]');

// Die Woche auf die Einkaufsliste (der Kochtag ist heute, also diese Woche)
await a.click('.tab[data-tab="plan"]');
const n = Number(await a.locator('.plan-einkauf .btn-n').innerText());
check(n > 5, `„Woche auf die Einkaufsliste“ mit ${n} Zutaten`);
await a.click('[data-act="plan-liste"]');
check(await bis(() => Object.values(gh.liste()?.items || {}).some((d) => d.parts?.chili)), 'die Zutaten vom Chili stehen auf der Liste');
check(await bis(async () => (await a.locator('.plan-einkauf-fertig').count()) === 1), 'danach: „Alles für diese Woche steht auf der Liste“');

// Austragen mit Rückgängig, den Kochtag samt Boxen
await a.click(`#pt-${morgen} .plan-mz:has(.plan-mz-k:text("Abend")) .plan-e`);
await a.click('[data-act="plan-e-weg"]');
check(await bis(() => !(gh.liste()?.essensplan?.tage?.[morgen]?.abend || []).length), 'ausgetragen');
await a.click('#toast button');
check(await bis(() => (gh.liste()?.essensplan?.tage?.[morgen]?.abend || []).length === 1), 'Rückgängig: wieder da');
await a.click(`#pt-${heute} .plan-koch-b`);
check((await a.locator('[data-act="plan-koch-weg"]').innerText()).includes('und Boxen'), '„Kochtag und Boxen austragen“');
await a.click('[data-act="plan-koch-weg"]');
check(await bis(() => !mittagsBoxen().length && !kochtage(gh.liste()?.essensplan).length), 'Kochtag weg – die Boxen auch');
await a.click('#toast button');
check(await bis(() => mittagsBoxen().length === 4 && kochtage(gh.liste()?.essensplan).length === 1), 'Rückgängig: Kochtag und Boxen zurück');

// Wochen blättern
await a.click('[data-plan-woche="1"]');
check((await a.locator('.plan-woche-t b').innerText()) === 'Nächste Woche' && await a.locator(`#pt-${tagPlus(montag, 7)}`).count() === 1, 'nächste Woche');
await a.click('[data-plan-woche="0"]');
check((await a.locator('.plan-woche-t b').innerText()) === 'Diese Woche', '„Zu heute“');

// Tobi sieht denselben Plan
const T = await verbunden('Tobi');
const t = T.page;
await t.click('.tab[data-tab="plan"]');
check(await bis(async () => (await t.locator(`#pt-${heute} .plan-koch`).count()) === 1 && (await t.locator(`#pt-${morgen} .plan-wer`).allInnerTexts()).includes('du')), 'Tobi sieht Kochtag und Boxen – seine als „du“');

check(A.fehler.length === 0 && T.fehler.length === 0, `keine Fehler im Browser (${[...A.fehler, ...T.fehler].slice(0, 3).join(' | ')})`);
await browser.close();
ende();
