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
 *     „vom Netz nehmen“. Jeder Commit kommt in zustand.commits (für den
 *     Überblick: GET …/commits, auch mit since, per_page, page).
 *   - githubMehrere(a, b): mehrere Repos (die eigene Liste eines Gasts neben
 *     Boxenstopp-Daten) – jede Anfrage geht an die Attrappe ihres Repos.
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
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'etag, x-ratelimit-remaining',
};

export function githubAttrappe({ schluessel = SCHLUESSEL, owner = 'Finanzdienste', repo = 'Boxenstopp-Daten', pfad = 'liste.json' } = {}) {
  // dateien: weitere Dateien im Repo, die die App nur liest (z. B. angebote-privat.json) – Pfad → Inhalt (Text);
  // roh: dieselben als Bytes (Fotos der Sachen), geloescht: was die App wieder gelöscht hat
  // fassungen: die Datei, wie sie nach jedem Commit war (Commit-sha → Text) – für ?ref= (Einzelheiten im Überblick)
  const zustand = { datei: null, sha: null, version: 0, puts: 0, gets: 0, konflikte: 0, nachrichten: [], netzWeg: false, staleEinmal: false, dateien: {}, roh: {}, geloescht: [], shas: {}, lesen: {}, commits: [], leer: false, gibtEs: true, fassungen: {}, fassungAbrufe: 0 };
  const commit = (message, pfadC, sha) => zustand.commits.unshift({ sha: sha || `c${zustand.commits.length + 1}-${Math.random().toString(36).slice(2, 8)}`, message, date: new Date().toISOString(), pfad: pfadC });
  const basis = `https://api.github.com/repos/${owner}/${repo}`;
  let alt = null; // für staleEinmal: die Fassung vor dem letzten Schreiben

  async function route(r) {
    const req = r.request();
    const url = req.url().split('?')[0];
    const antwort = (status, body, extra = {}) => r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...extra }, body: body === null ? '' : JSON.stringify(body) });
    if (zustand.netzWeg) return r.abort('internetdisconnected');
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    if (req.headers().authorization !== `Bearer ${schluessel}`) return antwort(401, { message: 'Bad credentials' });
    if (!zustand.gibtEs) return antwort(404, { message: 'Not Found' });
    if (url === basis && req.method() === 'GET') return antwort(200, { full_name: `${owner}/${repo}`, private: true });
    if (url === `${basis}/commits` && req.method() === 'GET') {
      if (zustand.leer && !zustand.commits.length) return antwort(409, { message: 'Git Repository is empty.' });
      const q = new URL(req.url()).searchParams;
      const per = Number(q.get('per_page') || 30);
      const seite = Number(q.get('page') || 1);
      const seit = q.get('since') || '';
      const pfadQ = q.get('path') || '';
      const alle = zustand.commits.filter((c) => (!pfadQ || c.pfad === pfadQ) && (!seit || c.date >= seit));
      return antwort(200, alle.slice((seite - 1) * per, seite * per).map((c) => ({ sha: c.sha, commit: { message: c.message, author: { date: c.date }, committer: { date: c.date } } })));
    }
    const weitere = url.startsWith(`${basis}/contents/`) ? decodeURIComponent(url.slice(`${basis}/contents/`.length)) : '';
    if (weitere && weitere !== pfad && req.method() === 'GET') {
      zustand.lesen[weitere] = (zustand.lesen[weitere] || 0) + 1;
      const inhalt = zustand.dateien[weitere];
      if (inhalt === undefined) return antwort(404, { message: 'Not Found' });
      // Ein Bild kommt roh als Bytes zurück, wie bei GitHub
      if (/raw/.test(req.headers().accept || '') && zustand.roh[weitere]) return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/octet-stream' }, body: zustand.roh[weitere] });
      if (/raw/.test(req.headers().accept || '')) return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/vnd.github.raw+json; charset=utf-8' }, body: inhalt });
      return antwort(200, { sha: zustand.shas[weitere] || 'weitere', encoding: 'base64', content: Buffer.from(inhalt).toString('base64') });
    }
    // Andere Dateien schreiben (push.json): mit sha wie bei GitHub, 409 bei einer veralteten
    if (weitere && weitere !== pfad && req.method() === 'PUT') {
      const body = JSON.parse(req.postData() || '{}');
      const da = zustand.dateien[weitere] !== undefined;
      const sha = zustand.shas[weitere] || 'weitere';
      if ((da && body.sha !== sha) || (!da && body.sha)) { zustand.konflikte++; return antwort(409, { message: `${weitere} does not match ${body.sha}` }); }
      zustand.dateien[weitere] = Buffer.from(body.content, 'base64').toString('utf8');
      if (/\.(?:jpe?g|png|webp)$/i.test(weitere)) zustand.roh[weitere] = Buffer.from(body.content, 'base64');
      zustand.shas[weitere] = `w${(zustand.wVersion = (zustand.wVersion || 0) + 1)}`;
      zustand.nachrichten.push(body.message);
      commit(body.message, weitere);
      return antwort(da ? 200 : 201, { content: { sha: zustand.shas[weitere], path: weitere } });
    }
    // Andere Dateien löschen (alte Fotos der Sachen): mit der sha wie bei GitHub
    if (weitere && weitere !== pfad && req.method() === 'DELETE') {
      const body = JSON.parse(req.postData() || '{}');
      if (zustand.dateien[weitere] === undefined) return antwort(404, { message: 'Not Found' });
      if (body.sha !== (zustand.shas[weitere] || 'weitere')) { zustand.konflikte++; return antwort(409, { message: `${weitere} does not match ${body.sha}` }); }
      delete zustand.dateien[weitere];
      delete zustand.roh[weitere];
      delete zustand.shas[weitere];
      zustand.geloescht.push(weitere);
      zustand.nachrichten.push(body.message);
      commit(body.message, weitere);
      return antwort(200, { content: null });
    }
    if (url === `${basis}/contents/${pfad}`) {
      const ref = new URL(req.url()).searchParams.get('ref');
      if (req.method() === 'GET' && ref) {
        // Wie bei GitHub: die Datei bei einem Commit, „<sha>~1“ der Stand davor (beim ersten Commit: 404)
        zustand.fassungAbrufe++;
        const davor = /^(.+)~1$/.exec(ref);
        const i = zustand.commits.findIndex((c) => c.sha === (davor ? davor[1] : ref));
        if (i < 0) return antwort(404, { message: `No commit found for the ref ${ref}` });
        const c = davor ? zustand.commits.slice(i + 1).find((x) => x.pfad === pfad) : zustand.commits[i];
        const inhalt = c ? zustand.fassungen[c.sha] : undefined;
        if (inhalt === undefined) return antwort(404, { message: 'Not Found' });
        if (/raw/.test(req.headers().accept || '')) return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/vnd.github.raw+json; charset=utf-8' }, body: inhalt });
        return antwort(200, { sha: `blob-${c.sha}`, encoding: 'base64', content: Buffer.from(inhalt).toString('base64') });
      }
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
        commit(body.message, pfad, `k${zustand.version}`);
        zustand.fassungen[`k${zustand.version}`] = zustand.datei;
        return antwort(zustand.version === 1 ? 201 : 200, { content: { sha: zustand.sha, path: pfad } });
      }
    }
    return antwort(404, { message: 'Not Found' });
  }

  return {
    zustand,
    route,
    basis,
    liste: () => (zustand.datei ? JSON.parse(zustand.datei) : null),
  };
}

/** Mehrere Repos hinter einer Route: jede Anfrage an die Attrappe ihres Repos, sonst 404. */
export function githubMehrere(...attrappen) {
  return {
    route: (r) => {
      const url = r.request().url().split('?')[0];
      const a = attrappen.find((x) => url === x.basis || url.startsWith(`${x.basis}/`));
      if (a) return a.route(r);
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
      return r.fulfill({ status: 404, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Not Found' }) });
    },
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

export async function handy(browser, { attrappe = null, tiere = null, takt = 400, adresse = APP_URL, viewport = { width: 390, height: 844 }, ohneWorker = true, userAgent = undefined, skript = null, rechte = null } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'de-DE', serviceWorkers: ohneWorker ? 'block' : 'allow', ...(userAgent ? { userAgent } : {}) });
  if (skript) await ctx.addInitScript(skript);
  // z. B. ['notifications', 'clipboard-read', 'clipboard-write'] – Headless-Chromium verweigert Mitteilungen sonst
  if (rechte) await ctx.grantPermissions(rechte, { origin: new URL(APP_URL).origin });
  if (attrappe) await ctx.route('https://api.github.com/**', attrappe.route);
  else await ctx.route('https://api.github.com/**', (r) => r.abort('blockedbyclient'));
  await ctx.route(TIER_HOSTS, tiere ? tiere.route : (r) => r.abort('blockedbyclient'));
  // Die Angebote der Woche: in den Tests immer dieselben (tests/daten/angebote.json), nie das echte Feld
  await ctx.route('**/daten/angebote.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(path.join(ROOT, 'tests', 'daten', 'angebote.json'), 'utf8') }));
  await ctx.route('**/daten/preisverlauf.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(path.join(ROOT, 'tests', 'daten', 'preisverlauf.json'), 'utf8') }));
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

/** voll: das ganze Chromium statt der Headless-Shell – nur dort lassen sich Mitteilungen erlauben (Push). */
export const starteBrowser = ({ voll = false } = {}) => chromium.launch(voll ? { channel: 'chromium' } : {});
