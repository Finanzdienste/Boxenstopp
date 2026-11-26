/*
 * Für Tobis „Meine Apps“: wer in Boxenstopp an welchem Tag etwas geändert hat
 * (js/aktiv-melden.js, v100).
 *
 * Tobi, 26.11.2026: „Boxenstopp soll natürlich auch marielle und Amy melden“.
 * Geprüft:
 *   - In Node: aus dem Verlauf (zusammenfassen) werden Zeilen je Person und
 *     Tag – nur Zahlen, nie was; nur aus den Listen, deren Verlauf kam.
 *   - Im Browser: Tobis Gerät schickt Amy (eure Liste) und Marielle (ihre
 *     Liste) an boxenstopp_aktiv_melden; nicht noch einmal innerhalb einer
 *     Stunde; Amys Gerät und Marielles Gerät schicken nichts; kommt Marielles
 *     Verlauf nicht, fehlt ihre Liste (statt ihre Tage zu leeren); ohne Netz
 *     nichts gemerkt, mit „online“ geht es.
 */
import { pruefer, handy, githubAttrappe, githubMehrere, starteBrowser, bis, SCHLUESSEL } from './hilfe.mjs';
import { zusammenfassen, listeVon, zeilenFuerUebersicht } from '../js/gaeste.js';

const { check, ende } = pruefer();
const M_KEY = 'github_pat_11MARIELLE000000000000_abcdefghijklmnopqrstuvwxyz';
const tagVon = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vor = (tage, stunde = 10) => { const d = new Date(); d.setDate(d.getDate() - tage); d.setHours(stunde, 15, 0, 0); return d; };

// --- In Node
const ls = [{ id: 'haupt', name: 'Eure Liste' }, { id: 'Finanzdienste/Boxenstopp-Marielle', name: 'Marielle' }];
const z = zusammenfassen([
  { id: 'haupt', name: 'Eure Liste', gast: '', eintraege: [
    { sha: 'a1', at: vor(0, 9).toISOString(), nachricht: 'Amy: Einkaufsliste, 2 Änderungen – Chili auf die Liste; Spinat abgehakt' },
    { sha: 'a2', at: vor(0, 18).toISOString(), nachricht: 'Amy: Notiz „Geheim“' },
    { sha: 't1', at: vor(1).toISOString(), nachricht: 'Tobi: Rezept bewertet' },
    { sha: 'p1', at: vor(0).toISOString(), nachricht: 'Push: Erinnerung' },
  ] },
  { id: 'Finanzdienste/Boxenstopp-Marielle', name: 'Marielle', gast: 'Marielle', eintraege: [
    { sha: 'm1', at: vor(2).toISOString(), nachricht: 'Marielli: Bananen auf die Liste' },
    { sha: 'm0', at: vor(40).toISOString(), nachricht: 'Marielle: zum ersten Mal dabei' },
  ] },
], { tage: 31 });
const zeilen = zeilenFuerUebersicht(z, ls);
const zeile = (wer) => zeilen.filter((x) => x.wer === wer);
check(zeile('Amy').length === 1 && zeile('Amy')[0].tag === tagVon(vor(0)) && zeile('Amy')[0].anzahl === 3 && zeile('Amy')[0].liste === 'haupt', `Amy: heute 3 Änderungen in eurer Liste (${JSON.stringify(zeile('Amy'))})`);
check(zeile('Tobi')[0]?.tag === tagVon(vor(1)) && zeile('Tobi')[0].anzahl === 1, 'Tobi: gestern eine');
check(zeile('Marielle').length === 1 && zeile('Marielle')[0].liste === 'gast:Marielle' && zeile('Marielle')[0].tag === tagVon(vor(2)), 'Marielle: in ihrer Liste immer Marielle (auch als „Marielli“), vor 40 Tagen nicht mehr im Zeitraum');
check(!zeilen.some((x) => x.wer === 'Push'), 'Automatik zählt nicht');
check(!/Chili|Spinat|Geheim|Bananen|Rezept/.test(JSON.stringify(zeilen)), 'nur Zahlen – nie, was geändert wurde');
check(zeilenFuerUebersicht(z, [ls[0]]).every((x) => x.liste === 'haupt'), 'nur aus den Listen, deren Verlauf kam');
check(listeVon(ls[0]) === 'haupt' && listeVon(ls[1]) === 'gast:Marielle', 'Listen: „haupt“ und „gast:<Name>“');

// --- Im Browser
const browser = await starteBrowser();
const aktivAttrappe = () => {
  const z2 = { anfragen: [], netz: true };
  return {
    zustand: z2,
    route: (r) => {
      if (!z2.netz) return r.abort('internetdisconnected');
      z2.anfragen.push({ body: JSON.parse(r.request().postData() || '{}'), kopf: r.request().headers() });
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '3' });
    },
  };
};
const mitVerlauf = () => {
  const haupt = githubAttrappe();
  const mar = githubAttrappe({ schluessel: M_KEY, repo: 'Boxenstopp-Marielle' });
  haupt.zustand.commits.push(
    { sha: 'h1', message: 'Amy: Einkaufsliste, 2 Änderungen – Chili auf die Liste', date: vor(0, 9).toISOString(), pfad: 'liste.json' },
    { sha: 'h2', message: 'Tobi: Rezept bewertet', date: vor(1).toISOString(), pfad: 'liste.json' },
  );
  mar.zustand.commits.push({ sha: 'mm1', message: 'Marielle: Bananen auf die Liste', date: vor(2).toISOString(), pfad: 'liste.json' });
  return { haupt, mar, beide: githubMehrere(haupt, mar) };
};
const gast = [{ name: 'Marielle', daten: 'Finanzdienste/Boxenstopp-Marielle', token: M_KEY, farbe: 'lila' }];
async function geraet(name, { gaeste = [], aktiv, attrappe, mitTobi = true } = {}) {
  const h = await handy(browser, { attrappe, aktiv });
  await h.page.evaluate(([k, n, g]) => {
    localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: n }));
    if (g.length) localStorage.setItem('boxenstopp.gaeste.v1', JSON.stringify(g));
    localStorage.setItem('__aktivPause', '200');
  }, [SCHLUESSEL, name, gaeste]);
  if (mitTobi) await h.page.reload();
  await h.page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
  return h;
}

// Tobis Gerät: Amy und Marielle
let v = mitVerlauf();
let ak = aktivAttrappe();
let t = await geraet('Tobi', { gaeste: gast, aktiv: ak, attrappe: v.beide });
check(await bis(() => ak.zustand.anfragen.length > 0, 10000), 'Tobis Gerät meldet an boxenstopp_aktiv_melden');
const b = ak.zustand.anfragen[0]?.body || {};
check(JSON.stringify(b.p_listen) === JSON.stringify(['haupt', 'gast:Marielle']) && /^\d{4}-\d{2}-\d{2}$/.test(b.p_von), `beide Listen, ab einem Tag (${JSON.stringify(b.p_listen)} ab ${b.p_von})`);
check(b.p_tage?.some((x) => x.wer === 'Amy' && x.liste === 'haupt' && x.tag === tagVon(vor(0)) && x.anzahl === 2)
  && b.p_tage?.some((x) => x.wer === 'Marielle' && x.liste === 'gast:Marielle' && x.tag === tagVon(vor(2)))
  && b.p_tage?.some((x) => x.wer === 'Tobi' && x.tag === tagVon(vor(1))), `Amy heute 2, Marielle vor 2 Tagen, Tobi gestern (${JSON.stringify(b.p_tage)})`);
check(!/Chili|Bananen|Rezept|github_pat/.test(JSON.stringify(b)) && ak.zustand.anfragen[0].kopf.apikey?.startsWith('sb_publishable_') && !ak.zustand.anfragen[0].kopf.authorization, 'nur Zahlen, kein Schlüssel, nur der öffentliche apikey');
await t.page.reload();
await t.page.waitForTimeout(1500);
await t.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new window.Event('visibilitychange')); });
await t.page.waitForTimeout(800);
check(ak.zustand.anfragen.length === 1, 'innerhalb einer Stunde nicht noch einmal');
check(!t.fehler.length, `keine Fehler in der Seite${t.fehler.length ? `: ${t.fehler.join(' | ')}` : ''}`);
await t.ctx.close();

// Kommt Marielles Verlauf nicht: ihre Liste fehlt in p_listen – ihre Tage bleiben in der Übersicht
v = mitVerlauf();
v.mar.zustand.netzWeg = true;
ak = aktivAttrappe();
t = await geraet('Tobi', { gaeste: gast, aktiv: ak, attrappe: v.beide });
check(await bis(() => ak.zustand.anfragen.length > 0, 10000) && JSON.stringify(ak.zustand.anfragen[0].body.p_listen) === '["haupt"]'
  && !ak.zustand.anfragen[0].body.p_tage.some((x) => x.wer === 'Marielle'), 'Marielles Verlauf kam nicht: nur eure Liste');
await t.ctx.close();

// Ohne Netz: nichts gemerkt; mit „online“ geht es
v = mitVerlauf();
ak = aktivAttrappe();
ak.zustand.netz = false;
t = await geraet('Tobi', { gaeste: gast, aktiv: ak, attrappe: v.beide });
await t.page.waitForTimeout(2500);
check(ak.zustand.anfragen.length === 0 && await t.page.evaluate(() => localStorage.getItem('boxenstopp.aktivgemeldet.v1')) === null, 'ohne Netz: nichts gemerkt');
ak.zustand.netz = true;
await t.page.evaluate(() => window.dispatchEvent(new window.Event('online')));
check(await bis(() => ak.zustand.anfragen.length === 1, 8000), 'wieder Netz („online“): es geht von selbst');
await t.ctx.close();

// Amys Gerät und Marielles Gerät schicken nichts
v = mitVerlauf();
ak = aktivAttrappe();
const amy = await geraet('Amy', { aktiv: ak, attrappe: v.beide });
await amy.page.waitForTimeout(3000);
check(ak.zustand.anfragen.length === 0, 'Amys Gerät schickt nichts');
await amy.ctx.close();
const marGeraet = await handy(browser, { attrappe: v.beide, aktiv: ak });
await marGeraet.page.evaluate((k) => {
  localStorage.setItem('boxenstopp.zugang.v1', JSON.stringify({ token: k, name: 'Tobi', daten: 'Finanzdienste/Boxenstopp-Marielle' }));
  localStorage.setItem('__aktivPause', '200');
}, M_KEY);
await marGeraet.page.reload();
await marGeraet.page.waitForTimeout(3000);
check(ak.zustand.anfragen.length === 0, 'eine eigene Liste (Gast) schickt nichts – auch wenn sich das Gerät „Tobi“ nennt');
await marGeraet.ctx.close();

await browser.close();
ende();
