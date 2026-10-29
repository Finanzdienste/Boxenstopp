/*
 * Gemeinsames für die Tests (tests/test-*.mjs).
 *
 * Heißt nicht test-…, damit tests/lauf.mjs die Datei nicht selbst startet.
 * Stellt bereit:
 *
 *   - die Adresse der App auf dem Testserver (tests/server.mjs),
 *   - pruefer(): check() mit der Ausgabe, die tests/lauf.mjs zählt,
 *   - handy(): ein Browserfenster in Handygröße mit eigenem Speicher – zwei
 *     davon sind zwei Handys,
 *   - githubAttrappe(): eine nachgebaute GitHub-API für das Daten-Repo, die
 *     sich alle Handys eines Tests teilen. Sie prüft den Schlüssel, liefert
 *     ETag/304, lehnt Schreiben mit veralteter sha ab (409) und lässt sich
 *     „vom Netz nehmen“.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wurzel des Repositorys – eine Ebene über dieser Datei. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_URL = process.env.BOXENSTOPP_URL || 'http://127.0.0.1:8099/index.html';
export const SCHLUESSEL = 'github_pat_11TESTTESTTEST0000000000_abcdefghijklmnopqrstuvwxyz';

export function pruefer() {
  let oks = 0;
  let fails = 0;
  const check = (c, m) => {
    console.log(`${c ? 'OK  ' : 'FAIL'} ${m}`);
    if (c) oks++; else { fails++; process.exitCode = 1; }
  };
  const ende = () => process.exit(fails || !oks ? 1 : 0);
  return { check, ende };
}

/** Wartet, bis bedingung() wahr ist (oder die Zeit um ist); gibt das Ergebnis zurück. */
export async function bis(bedingung, ms = 6000) {
  const ende = Date.now() + ms;
  for (;;) {
    const wert = await bedingung();
    if (wert || Date.now() > ende) return wert;
    await new Promise((f) => { setTimeout(f, 100); });
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, accept, content-type, if-none-match',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-expose-headers': 'etag, x-ratelimit-remaining',
};

export function githubAttrappe({ schluessel = SCHLUESSEL, owner = 'Finanzdienste', repo = 'Boxenstopp-Daten', pfad = 'liste.json' } = {}) {
  // dateien: weitere Dateien im Repo, die die App nur liest (z. B. angebote-privat.json) – Pfad → Inhalt (Text)
  const zustand = { datei: null, sha: null, version: 0, puts: 0, gets: 0, konflikte: 0, nachrichten: [], netzWeg: false, staleEinmal: false, dateien: {}, lesen: {} };
  const basis = `https://api.github.com/repos/${owner}/${repo}`;
  let alt = null; // für staleEinmal: die Fassung vor dem letzten Schreiben

  async function route(r) {
    const req = r.request();
    const url = req.url().split('?')[0];
    const antwort = (status, body, extra = {}) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...extra }, body: body === null ? '' : JSON.stringify(body) });
    if (zustand.netzWeg) return r.abort('internetdisconnected');
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (req.headers().authorization !== `Bearer ${schluessel}`) return antwort(401, { message: 'Bad credentials' });
    if (url === basis && req.method() === 'GET') return antwort(200, { full_name: `${owner}/${repo}`, private: true });
    const weitere = url.startsWith(`${basis}/contents/`) ? decodeURIComponent(url.slice(`${basis}/contents/`.length)) : '';
    if (weitere && weitere !== pfad && req.method() === 'GET') {
      zustand.lesen[weitere] = (zustand.lesen[weitere] || 0) + 1;
      const inhalt = zustand.dateien[weitere];
      if (inhalt === undefined) return antwort(404, { message: 'Not Found' });
      if (/raw/.test(req.headers().accept || '')) return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/vnd.github.raw+json; charset=utf-8' }, body: inhalt });
      return antwort(200, { sha: 'weitere', encoding: 'base64', content: Buffer.from(inhalt).toString('base64') });
    }
    if (url === `${basis}/contents/${pfad}`) {
      if (req.method() === 'GET') {
        zustand.gets++;
        if (zustand.staleEinmal && alt) {
          // GitHub hat die Änderung noch nicht überall: einmal die alte Fassung.
          zustand.staleEinmal = false;
          return antwort(200, { sha: alt.sha, encoding: 'base64', content: Buffer.from(alt.datei).toString('base64') }, { etag: `"${alt.sha}"` });
        }
        if (!zustand.datei) return antwort(404, { message: 'Not Found' });
        const etag = `"${zustand.sha}"`;
        if (req.headers()['if-none-match'] === etag) return r.fulfill({ status: 304, headers: { ...CORS, etag } });
        return antwort(200, { sha: zustand.sha, encoding: 'base64', content: Buffer.from(zustand.datei).toString('base64').replace(/(.{60})/g, '$1\n') }, { etag });
      }
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData() || '{}');
        zustand.puts++;
        if ((zustand.datei && body.sha !== zustand.sha) || (!zustand.datei && body.sha)) {
          zustand.konflikte++;
          return antwort(409, { message: `${pfad} does not match ${body.sha}` });
        }
        if (zustand.datei && !body.sha) return antwort(422, { message: '"sha" wasn\'t supplied.' });
        alt = zustand.datei ? { datei: zustand.datei, sha: zustand.sha } : null;
        zustand.datei = Buffer.from(body.content, 'base64').toString('utf8');
        zustand.version++;
        zustand.sha = `sha${zustand.version}`;
        zustand.nachrichten.push(body.message);
        return antwort(zustand.version === 1 ? 201 : 200, { content: { sha: zustand.sha, path: pfad } });
      }
    }
    return antwort(404, { message: 'Not Found' });
  }

  return {
    zustand,
    route,
    liste: () => (zustand.datei ? JSON.parse(zustand.datei) : null),
  };
}

/**
 * Ein „Handy“: eigener Browser-Kontext mit leerem Speicher. `attrappe` hängt
 * die GitHub-Attrappe davor; `takt` ist der Abgleich in ms (in der App sonst 8 s);
 * `userAgent` macht daraus etwa ein iPhone oder iPad, `skript` läuft vor jeder
 * Seite (etwa um navigator.maxTouchPoints wie auf einem iPad zu setzen).
 */
/** Die Tierquellen der Belohnung (js/lob.js) – in den Tests nie das echte Netz. */
export const TIER_HOSTS = /random\.dog|dog\.ceo|thecatapi|cataas|randomfox|bunnies|capy\.lol|bilder\.test/;

/**
 * Eine Attrappe für die Tierquellen: jede Antwort zeigt auf ein Bild unter
 * https://bilder.test/, und das Bild ist das App-Icon. `zaehler` zählt die Abrufe.
 */
export function tierAttrappe() {
  const png = readFileSync(path.join(ROOT, 'icon-512.png'));
  const z = { json: 0, bilder: 0 };
  const antwort = { url: 'https://bilder.test/tier.jpg', message: 'https://bilder.test/tier.jpg', status: 'success', image: 'https://bilder.test/tier.jpg', data: { url: 'https://bilder.test/tier.jpg' }, media: { mp4: 'https://bilder.test/tier.jpg' } };
  return {
    zaehler: z,
    route: (route) => {
      if (/bilder\.test/.test(route.request().url())) { z.bilder++; return route.fulfill({ status: 200, contentType: 'image/png', body: png }); }
      z.json++;
      const url = route.request().url();
      const body = /thecatapi/.test(url) ? [antwort] : antwort;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    },
  };
}

export async function handy(browser, { attrappe = null, tiere = null, takt = 400, adresse = APP_URL, viewport = { width: 390, height: 844 }, ohneWorker = true, userAgent = undefined, skript = null } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', serviceWorkers: ohneWorker ? 'block' : 'allow', ...(userAgent ? { userAgent } : {}) });
  if (skript) await ctx.addInitScript(skript);
  if (attrappe) await ctx.route('https://api.github.com/**', attrappe.route);
  else await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
  await ctx.route(TIER_HOSTS, tiere ? tiere.route : (r) => r.abort('blockedbyclient'));
  // Die Angebote der Woche: in den Tests immer dieselben (tests/daten/angebote.json), nie das echte Feld
  await ctx.route('**/daten/angebote.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(path.join(ROOT, 'tests', 'daten', 'angebote.json'), 'utf8') }));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/.test(m.text())) fehler.push(`CONSOLE: ${m.text()}`);
  });
  // Erst eine Datei aus demselben Ursprung, die nicht die App ist: Dort lässt
  // sich der Speicher leeren, und der Sprung zur App lädt sie danach wirklich
  // neu (auch wenn sich die Adresse nur hinter # unterscheidet).
  const grund = APP_URL.replace(/index\.html$/, '');
  await page.goto(`${grund}icon.svg`, { waitUntil: 'load' });
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('__takt', String(t)); }, takt);
  await page.goto(adresse, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('#grid .box').length > 0);
  return { ctx, page, fehler };
}

export const starteBrowser = () => chromium.launch();
