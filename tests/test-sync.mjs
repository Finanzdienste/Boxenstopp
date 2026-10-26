/*
 * Die gemeinsame Liste: zwei Handys, eine nachgebaute GitHub-API.
 *
 * Tobi richtet ein (und seine lokale Liste wandert mit), Amy kommt über den
 * Link dazu, beide sehen dieselbe Liste und wer was abgehakt hat. Dann die
 * unschönen Fälle: beide schreiben gleichzeitig (Konflikt), GitHub liefert
 * kurz eine veraltete Fassung, das Netz ist weg, der Schlüssel ist falsch.
 */
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL } from './hilfe.mjs';

const { check, ende } = pruefer();
const browser = await starteBrowser();
const gh = githubAttrappe();

const zeile = (page, name) => page.locator('#list-body .item', { has: page.locator('.item-name', { hasText: new RegExp(`^${name}$`) }) });
const status = (page) => page.locator('#sync-text').innerText();
const namen = (liste) => Object.values(liste?.items || {}).map((d) => d.name);

// --- Tobi: erst lokal, dann einrichten
const tobi = await handy(browser, { attrappe: gh });
const t = tobi.page;
await t.click('.tab[data-tab="einkauf"]');
check((await status(t)) === 'Nur lokal', 'vor dem Einrichten: „Nur lokal“');
check(await t.locator('.zugang-banner').count() === 1, 'Hinweis „Nur auf diesem Handy“ mit Einrichten-Knopf');
await t.fill('#add-input', 'Kaffee');
await t.press('#add-input', 'Enter');
await t.click('[data-act="z-oeffnen"]');
await t.fill('#z-name', 'Tobi');
await t.fill('#z-token', 'quatsch');
await t.click('#z-los');
check((await t.locator('#z-fehler').innerText()).includes('github_pat_'), 'ungültiger Schlüssel: Hinweis, wie er aussieht');
check((await t.inputValue('#z-name')) === 'Tobi', 'nach dem Fehler steht der Name noch im Feld');
await t.fill('#z-token', SCHLUESSEL);
await t.click('#z-los');
check(await bis(async () => (await status(t)) === 'Geteilt'), `eingerichtet: „Geteilt“ (${await status(t)})`);
check(await bis(() => namen(gh.liste()).includes('Kaffee')), 'die lokale Liste ist mit in GitHub gelandet');
check(gh.liste()?.rev === 1, `erster Commit: rev 1 (${gh.liste()?.rev})`);

await t.click('.tab[data-tab="rezepte"]');
await t.click('[data-open="chili"]');
await t.click('[data-act="alle-dazu"]');
check(await bis(() => gh.liste()?.items?.rinderhack?.parts?.chili?.q === 500), 'Chili auf der Liste: Rinderhack 500 g steht in GitHub');
check(gh.zustand.nachrichten.every((m) => m.startsWith('Tobi: Einkaufsliste')), `Commit-Nachrichten nennen Tobi (${gh.zustand.nachrichten.at(-1)})`);

// --- Amy: über den Link
const link = await t.evaluate(() => document.querySelector('#z-linkfeld')?.value || '');
check(/#zugang=github_pat_/.test(link), 'unter der Liste steht der Link fürs zweite Handy');
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}` });
const a = amy.page;
check(!(await a.evaluate(() => location.hash)).includes('zugang'), 'der Schlüssel verschwindet sofort aus der Adresse');
check(await a.evaluate(() => document.querySelector('#app').dataset.tab) === 'einkauf', 'der Link öffnet die Einkaufsliste');
check((await a.inputValue('#z-token')) === SCHLUESSEL, 'Schlüssel aus dem Link ist eingetragen');
await a.fill('#z-name', 'Amy');
await a.click('#z-los');
check(await bis(async () => (await zeile(a, 'Rinderhackfleisch').count()) === 1), 'Amy sieht Tobis Chili-Zutaten');
check(await zeile(a, 'Kaffee').count() === 1, 'und Tobis Kaffee');

// --- abhaken, sichtbar beim anderen
await zeile(a, 'Rinderhackfleisch').locator('.cb').click();
check(await bis(async () => (await t.locator('.grp-done .item-name', { hasText: 'Rinderhackfleisch' }).count()) === 1), 'Amy hakt ab – bei Tobi liegt es „Im Wagen“');
await t.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await t.locator('.grp-done .item-by').first().innerText()) === 'abgehakt von Amy'), 'Tobi sieht „abgehakt von Amy“');
check((await a.locator('.grp-done .item-by').first().innerText()) === 'abgehakt von dir', 'Amy sieht „abgehakt von dir“');

// --- beide gleichzeitig
const konflikteVorher = gh.zustand.konflikte;
await Promise.all([
  (async () => { await t.fill('#add-input', 'Milch'); await t.press('#add-input', 'Enter'); })(),
  (async () => { await a.fill('#add-input', 'Brot'); await a.press('#add-input', 'Enter'); })(),
]);
check(await bis(() => namen(gh.liste()).includes('Milch') && namen(gh.liste()).includes('Brot'), 10000), 'gleichzeitig geschrieben: Milch und Brot sind beide in GitHub');
check(await bis(async () => (await zeile(t, 'Brot').count()) === 1 && (await zeile(a, 'Milch').count()) === 1, 10000), 'und beide Handys zeigen beides');
console.log(`     (${gh.zustand.konflikte - konflikteVorher} Konflikt(e) aufgelöst, ${gh.zustand.puts} Commits, ${gh.zustand.gets} Abrufe)`);

// --- veraltete Antwort von GitHub
gh.zustand.staleEinmal = true;
await t.fill('#add-input', 'Eier');
await t.press('#add-input', 'Enter');
check(await bis(() => namen(gh.liste()).includes('Eier')), 'Eier gespeichert');
await t.waitForTimeout(1200);
check(await zeile(t, 'Eier').count() === 1, 'eine veraltete Antwort lässt die Eier nicht wieder verschwinden');

// --- Netz weg und wieder da
gh.zustand.netzWeg = true;
await a.fill('#add-input', 'Tomaten');
await a.press('#add-input', 'Enter');
check(await bis(async () => (await status(a)) === 'Offline'), `ohne Netz: „Offline“ (${await status(a)})`);
check(await zeile(a, 'Tomaten').count() === 1, 'ohne Netz: der Eintrag steht trotzdem auf Amys Liste');
check((await a.locator('#l-note').innerText()).includes('1 Änderung wird gespeichert'), 'Hinweis: 1 Änderung wartet');
await a.reload({ waitUntil: 'load' });
await a.waitForFunction(() => document.querySelectorAll('#list-body .item').length > 0);
check(await zeile(a, 'Tomaten').count() === 1, 'App zu und wieder auf, immer noch ohne Netz: Tomaten noch da');
gh.zustand.netzWeg = false;
await a.evaluate(() => window.dispatchEvent(new window.Event('online')));
check(await bis(() => namen(gh.liste()).includes('Tomaten')), 'Netz wieder da: Tomaten landen in GitHub');
check(await bis(async () => (await status(a)) === 'Geteilt'), 'und Amy ist wieder „Geteilt“');

// --- gekocht, auch beim anderen
await t.click('.tab[data-tab="rezepte"]');
await t.click('[data-act="gekocht"]');
check(await bis(() => !!gh.liste()?.cooked?.chili), '„Heute gekocht“ steht in GitHub');
await a.click('.tab[data-tab="rezepte"]');
check(await bis(async () => (await a.locator('[data-open="chili"] .pill', { hasText: 'Zuletzt gekocht' }).count()) === 1), 'Amy sieht beim Chili „Zuletzt gekocht“');

// --- falscher Schlüssel
const fremd = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=github_pat_11FALSCHFALSCH000000000_xyz` });
await fremd.page.fill('#z-name', 'Jemand');
await fremd.page.click('#z-los');
check(await bis(async () => (await fremd.page.locator('#z-fehler').innerText()).includes('lehnt den Schlüssel ab')), 'falscher Schlüssel: GitHub lehnt ab, Hinweis auf die Rechte');
check((await status(fremd.page)) === 'Nur lokal', 'und das Handy bleibt lokal');

// --- trennen
await a.click('.tab[data-tab="einkauf"]');
const vorherAnzahl = Object.keys(gh.liste().items).length;
await a.click('[data-act="z-trennen"]');
await a.click('[data-act="z-trennen-ja"]');
check(await bis(async () => (await status(a)) === 'Nur lokal'), 'Amy getrennt: „Nur lokal“');
check(await bis(async () => (await a.locator('.empty-state').count()) === 1), 'getrennt: auf Amys Handy ist die Liste leer');
check(Object.keys(gh.liste().items).length === vorherAnzahl, 'die Liste in GitHub bleibt, wie sie war');
await a.reload({ waitUntil: 'load' });
check((await status(a)) === 'Nur lokal', 'auch nach dem Neuladen getrennt');

// --- Tobi lädt neu: Stand kommt zurück, nichts offen
await t.reload({ waitUntil: 'load' });
await t.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await zeile(t, 'Tomaten').count()) === 1), 'Tobi nach dem Neuladen: Amys Tomaten sind da');
check(await t.evaluate(() => JSON.parse(localStorage.getItem('boxenstopp.offen.v1') || '[]').length) === 0, 'nichts mehr offen');
check(await t.evaluate(() => !JSON.stringify(localStorage).includes('Kaffee') || !!localStorage.getItem('boxenstopp.zugang.v1')), 'der Schlüssel steht nur im Speicher dieses Handys');

for (const h of [tobi, amy, fremd]) check(h.fehler.length === 0, `keine Fehler in der Konsole${h.fehler.length ? `: ${h.fehler.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
ende();
