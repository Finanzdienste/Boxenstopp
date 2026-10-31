/*
 * Die App aufs iPad (js/ansicht-tablet.js): Bei Amy auf dem iPhone kommt die
 * Anleitung einmal von selbst, danach über „Auch auf dem iPad“. Der Link aus
 * dem Popup richtet das iPad ein – und dann zeigen beide dasselbe.
 */
import { pruefer, starteBrowser, handy, bis, githubAttrappe, SCHLUESSEL, APP_URL } from './hilfe.mjs';

const { check, ende } = pruefer();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
// Ein iPad gibt sich als Mac aus – erkennbar nur an den Fingern auf dem Bildschirm
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const IPAD_FINGER = () => {
  Object.defineProperty(window.Navigator.prototype, 'maxTouchPoints', { get: () => 5 });
  Object.defineProperty(window.Navigator.prototype, 'platform', { get: () => 'MacIntel' });
};
const t0 = '2026-10-29T10:00:00Z';

const gh = githubAttrappe();
gh.zustand.datei = JSON.stringify({ version: 1, rev: 1, items: {}, amy: { 'amy-porridge-ab12': { id: 'amy-porridge-ab12', name: 'Bananen-Porridge', bild: 'steaming-bowl', portionen: 2, zeit: 10, zutaten: ['2 Bananen'], schritte: ['5 Min. köcheln'], notiz: '', by: 'Amy', at: t0, geaendert: t0 } }, amyTags: { 'amy-porridge-ab12': ['schnell'] } });
gh.zustand.version = 1;
gh.zustand.sha = 'sha1';
const browser = await starteBrowser();
const verbinden = async (page, name) => {
  await page.fill('#z-name', name);
  await page.click('#z-los');
  return bis(async () => (await page.locator('#sync-text').innerText()) === 'Geteilt');
};
const offen = (page) => page.locator('#tablet-dlg[open]').count();

// Tobi auf seinem iPhone: kein Popup von selbst
const tobi = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}`, userAgent: IPHONE });
check(await verbinden(tobi.page, 'Tobi'), 'Tobi: eingerichtet');
await tobi.page.waitForTimeout(2000);
check(await offen(tobi.page) === 0, 'bei Tobi kommt das Popup nicht von selbst');

// Amy auf ihrem iPhone: einmal von selbst
const amy = await handy(browser, { attrappe: gh, adresse: `${APP_URL}#zugang=${encodeURIComponent(SCHLUESSEL)}`, userAgent: IPHONE });
const a = amy.page;
await amy.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(APP_URL).origin });
check(await verbinden(a, 'Amy'), 'Amy: eingerichtet');
check(await bis(async () => (await offen(a)) === 1, 5000), 'bei Amy auf dem iPhone: das Popup kommt von selbst');
const text = await a.locator('#tablet-dlg').innerText();
check(text.includes('Boxenstopp auch auf deinem iPad') && (await a.locator('.tablet-schritte li').count()) === 4, 'Titel und vier Schritte');
check(text.includes('Zum Home-Bildschirm') && text.includes('Als Web-App öffnen') && text.includes('Einstellungen') && text.includes('Amy') && text.includes('127.0.0.1:8099'), 'mit Home-Bildschirm, Einstellungen, ihrem Namen und der Adresse');
check(await a.evaluate(() => document.activeElement?.dataset.act) === 'tablet-link', 'der Fokus steht auf „Link kopieren“');
await a.click('[data-act="tablet-link"]');
const link = await bis(async () => { const x = await a.evaluate(() => navigator.clipboard.readText()); return x.includes('#zugang=') ? x : ''; });
check(link.includes(`#zugang=${encodeURIComponent(SCHLUESSEL)}`) && (await a.locator('[data-act="tablet-link"]').innerText()).startsWith('Kopiert'), 'Link kopiert – der Knopf sagt es');
const farbe = await a.evaluate(() => window.getComputedStyle(document.querySelector('.tablet-titel')).color);
check(farbe === 'rgb(224, 69, 127)', `in Amys Rosa, auch über der Einkaufsliste (${farbe})`);
await a.keyboard.press('Escape');
check(await bis(async () => (await offen(a)) === 0), 'Escape schließt');
await a.reload({ waitUntil: 'load' });
await a.waitForTimeout(2500);
check(await offen(a) === 0, 'nach dem Neuladen nicht noch einmal');
await a.click('.tab[data-tab="amy"]');
await a.click('#view-amy [data-act="tablet-zeigen"]');
check(await bis(async () => (await offen(a)) === 1), 'in ihrem Reiter: „Auch auf dem iPad“ öffnet es wieder');
await a.click('#tablet-dlg .tablet-knoepfe [data-act="tablet-zu"]');
check(await bis(async () => (await offen(a)) === 0), '„Alles klar“ schließt');
await a.click('.tab[data-tab="einstellungen"]');
await a.click('#teilen [data-act="tablet-zeigen"]');
check(await bis(async () => (await offen(a)) === 1), 'in den Einstellungen: „Aufs iPad oder Tablet“');
await a.click('#tablet-dlg .tablet-zu');

// Das iPad: mit dem kopierten Link einrichten (so wie in der App vom Home-Bildschirm)
const ipad = await handy(browser, { attrappe: gh, userAgent: IPAD, skript: IPAD_FINGER, viewport: { width: 820, height: 1180 } });
const i = ipad.page;
await i.click('.tab[data-tab="einkauf"]');
await i.click('[data-act="z-oeffnen"]');
await i.fill('#z-name', 'Amy');
await i.fill('#z-token', link);
await i.click('#z-los');
check(await bis(async () => (await i.locator('#sync-text').innerText()) === 'Geteilt'), 'iPad: der Link im Feld „Schlüssel“ richtet es ein');
await i.click('.tab[data-tab="amy"]');
check(await bis(async () => (await i.locator('#view-amy .amy-karte').innerText().catch(() => '')).includes('Bananen-Porridge')) && (await i.locator('#view-amy .amy-karte .amy-tag').innerText()) === 'schnell', 'auf dem iPad: ihre Rezepte, mit Tags');
check(await i.locator('#view-amy [data-act="tablet-zeigen"]').count() === 0 && await offen(i) === 0, 'auf dem iPad selbst: kein Popup, kein „Auch auf dem iPad“');
// Hin und her: auf dem iPad abgehakt, auf dem iPhone auch
await i.click('#view-amy .amy-karte[data-amy-open="amy-porridge-ab12"]');
await i.click('[data-act="amy-alle-dazu"]');
await a.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await a.locator('#list-body .item-name', { hasText: 'Bananen' }).count()) === 1, 8000), 'auf dem iPad auf die Liste – auf dem iPhone steht es drauf');
await a.click('#list-body .item:has(.item-name:text-is("Bananen")) [data-check]');
await i.click('.tab[data-tab="einkauf"]');
check(await bis(async () => (await i.locator('.grp-done .item-name', { hasText: 'Bananen' }).count()) === 1, 8000), 'auf dem iPhone abgehakt – auf dem iPad im Wagen');
check(await i.evaluate(() => window.innerWidth > 800) && await i.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'auf dem iPad: breit, ohne seitliches Scrollen');
check([...tobi.fehler, ...amy.fehler, ...ipad.fehler].length === 0, `keine Fehler in der Konsole${[...tobi.fehler, ...amy.fehler, ...ipad.fehler].slice(0, 3).join(' | ')}`);
await browser.close();
ende();
