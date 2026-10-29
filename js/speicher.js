/*
 * Wo die Einkaufsliste liegt.
 *
 *   lokal()   nur auf diesem Handy, im localStorage. So läuft die App, bis
 *             jemand die gemeinsame Liste einrichtet.
 *
 *   github()  als liste.json im privaten Repo Finanzdienste/Boxenstopp-Daten,
 *             gelesen und geschrieben über die GitHub-API mit dem Schlüssel
 *             aus zugang.js.
 *
 * So funktioniert github():
 *
 *   - Jede Änderung (ein Objekt aus liste.js) wird sofort angezeigt und als
 *     „offen“ vorgemerkt – auch im localStorage, damit nichts verloren geht,
 *     wenn das Handy offline ist oder die App zugeht.
 *   - Kurz danach geht alles Offene als ein Commit nach GitHub: der Stand aus
 *     GitHub plus die offenen Änderungen, mit der sha der Datei, auf die sie
 *     sich beziehen.
 *   - War das andere Handy schneller, lehnt GitHub ab (409). Dann holt die App
 *     den neuen Stand und wendet ihre offenen Änderungen darauf noch einmal an.
 *     Deshalb sind Änderungen Objekte und keine fertigen Listen.
 *   - Solange die App sichtbar ist, schaut sie alle paar Sekunden nach, ob
 *     sich etwas getan hat (mit ETag, das kostet kaum etwas), und sofort,
 *     wenn man zurück in die App kommt.
 *   - `rev` zählt jeden Commit hoch. Eine Antwort mit kleinerem `rev` als dem
 *     bekannten ist eine veraltete Kopie (GitHub verteilt Änderungen nicht in
 *     derselben Sekunde überall hin) und wird ignoriert.
 *
 * Beide Speicher haben dieselbe Form:
 *   start(beiAenderung, beiStatus)  beiAenderung(stand), beiStatus({ zustand, offen, zuletzt })
 *   aendern(op | [op, …])
 *   jetzt()   sofort abgleichen
 *   stop()
 */
import { leer, anwenden, bereinigen, opZusammen, bescheidNoetig } from './liste.js';

export const API = 'https://api.github.com';
export const DATEN = { owner: 'Finanzdienste', repo: 'Boxenstopp-Daten', pfad: 'liste.json' };

const LOKAL = 'boxenstopp.liste.lokal.v1';
const GITHUB = 'boxenstopp.liste.github.v1';
const OFFEN = 'boxenstopp.offen.v1';

const lese = (k, d) => {
  try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; }
};
const schreibe = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Gedächtnis weiter */ }
};
const weg = (k) => { try { localStorage.removeItem(k); } catch { /* egal */ } };
const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
const alsListe = (op) => (Array.isArray(op) ? op : [op]);

/**
 * Eine weitere Datei aus dem Daten-Repo lesen (z. B. angebote-privat.json) –
 * nur lesen, mit demselben Schlüssel. Gibt das JSON zurück oder null, wenn es
 * die Datei (noch) nicht gibt, der Schlüssel nicht passt oder kein Netz ist.
 */
export async function privatLesen(pfad, { token, api = API, ort = DATEN } = {}) {
  if (!token) return null;
  try {
    const r = await fetch(`${api}/repos/${ort.owner}/${ort.repo}/contents/${pfad}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Eine weitere JSON-Datei im Daten-Repo ändern (push.json): holen,
 * aendern(alt) → neu, mit der sha zurückschreiben; war jemand schneller,
 * noch einmal. Wirft mit einem Satz für die Anzeige, wenn es nicht geht.
 */
export async function privatSchreiben(pfad, aendern, { token, api = API, ort = DATEN, nachricht = '' } = {}) {
  if (!token) throw new Error('Erst die gemeinsame Liste einrichten.');
  const url = `${api}/repos/${ort.owner}/${ort.repo}/contents/${pfad}`;
  const kopf = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  for (let versuch = 0; versuch < 4; versuch++) {
    let r;
    try { r = await fetch(url, { headers: kopf, cache: 'no-store' }); } catch { throw new Error('Keine Verbindung zu GitHub.'); }
    if (r.status !== 404 && !r.ok) throw new Error('GitHub antwortet gerade nicht.');
    const j = r.status === 404 ? null : await r.json();
    let alt = null;
    try { alt = j?.content ? JSON.parse(ausB64(j.content)) : null; } catch { alt = null; }
    const neu = aendern(alt);
    const body = { message: nachricht || `${pfad} geändert`, content: zuB64(`${JSON.stringify(neu, null, 1)}\n`), ...(j?.sha ? { sha: j.sha } : {}) };
    let w;
    try { w = await fetch(url, { method: 'PUT', headers: { ...kopf, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }); } catch { throw new Error('Keine Verbindung zu GitHub.'); }
    if (w.ok) return neu;
    if (w.status !== 409 && w.status !== 422) throw new Error('GitHub hat das nicht gespeichert.');
    await warte(300 * (versuch + 1));
  }
  throw new Error('GitHub hat das nicht gespeichert – gleich nochmal versuchen.');
}

/** Was nur auf diesem Handy steht – zum Übernehmen in die gemeinsame Liste. */
export const lokalerStand = () => bereinigen(lese(LOKAL, null));
export function lokalLoeschen() { weg(LOKAL); }
/** Beim Trennen: Zwischenstand und Offenes der gemeinsamen Liste vergessen. */
export function githubVergessen() { weg(GITHUB); weg(OFFEN); }
export const offeneAenderungen = () => {
  const o = lese(OFFEN, []);
  return Array.isArray(o) ? o.length : 0;
};

/* ------------------------------------------------------------------ lokal */

export function lokal() {
  let stand = bereinigen(lese(LOKAL, null));
  let melden = () => {};
  return {
    art: 'lokal',
    start(beiAenderung, beiStatus) {
      melden = beiAenderung;
      beiStatus({ zustand: 'lokal', offen: 0, zuletzt: null });
      setTimeout(() => melden(stand), 0);
    },
    aendern(op) {
      stand = anwenden(stand, alsListe(op));
      schreibe(LOKAL, stand);
      melden(stand);
    },
    jetzt() {},
    stop() { melden = () => {}; },
  };
}

/* ----------------------------------------------------------------- GitHub */

const zuB64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const ausB64 = (b64) => {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function github({ token, name = '', api = API, takt = 8000, ort = DATEN }) {
  const basis = `${api}/repos/${ort.owner}/${ort.repo}`;
  const datei = `${basis}/contents/${ort.pfad}`;
  const kopf = (mehr = {}) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...mehr });

  const g = lese(GITHUB, null);
  let remote = { sha: g?.sha || null, etag: g?.etag || null, stand: bereinigen(g?.stand) };
  let offen = (() => { const o = lese(OFFEN, []); return Array.isArray(o) ? o : []; })();
  let imFlug = 0; // so viele Änderungen vorn in `offen` sind gerade unterwegs zu GitHub

  let melden = () => {};
  let meldeStatus = () => {};
  let zustand = 'ok';
  let zuletzt = null;
  let repoOk = false;
  let sendet = false;
  let holt = null;
  let sendeTimer = null;
  let taktTimer = null;
  let aus = false;

  const status = (z) => {
    if (z) zustand = z;
    meldeStatus({ zustand, offen: offen.length, zuletzt });
  };
  const ansicht = () => anwenden(remote.stand, offen);
  const zeige = () => melden(ansicht());
  const merkeRemote = () => schreibe(GITHUB, remote);
  const merkeOffen = () => schreibe(OFFEN, offen);
  // 403 heißt bei GitHub entweder „darf nicht“ oder „zu viele Anfragen“.
  const begrenzt = (r) => r.status === 429 || (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0');
  const keinZugang = (r) => r.status === 401 || r.status === 404 || (r.status === 403 && !begrenzt(r));

  async function holen(frisch = false) {
    if (aus) return;
    if (holt) { await holt; if (!frisch) return; }
    holt = (async () => {
      try {
        if (!repoOk) {
          const r = await fetch(basis, { headers: kopf(), cache: 'no-store' });
          if (keinZugang(r)) { status('zugang'); return; }
          if (!r.ok) { status('offline'); return; }
          repoOk = true;
        }
        const extra = !frisch && remote.etag ? { 'If-None-Match': remote.etag } : {};
        const r = await fetch(datei, { headers: kopf(extra), cache: 'no-store' });
        if (r.status === 304) {
          zuletzt = new Date();
          if (!sendet) status(offen.length ? 'sendet' : 'ok');
          return;
        }
        if (r.status === 404) {
          // Die Datei gibt es noch nicht: Der erste Commit legt sie an.
          if (remote.sha) { remote = { sha: null, etag: null, stand: leer() }; merkeRemote(); zeige(); }
          zuletzt = new Date();
          if (!sendet) status(offen.length ? 'sendet' : 'ok');
          return;
        }
        if (keinZugang(r)) { repoOk = false; status('zugang'); return; }
        if (!r.ok) { status('offline'); return; }
        const j = await r.json();
        let stand;
        let roh = null;
        // Kaputtes JSON (von Hand bearbeitet?) zählt als leere Liste; der
        // nächste Commit schreibt die Datei dann wieder sauber.
        try { roh = JSON.parse(ausB64(j.content || '')); stand = bereinigen(roh); } catch { stand = leer(); }
        const etag = r.headers.get('ETag');
        if (j.sha !== remote.sha) {
          if (!remote.sha || stand.rev >= remote.stand.rev) {
            // Eine ältere App-Fassung kennt die neueren Teile (Amys Rezepte und Tags,
            // Wege, verschobene und zusammengelegte Zeilen) nicht und lässt sie beim
            // Schreiben weg. Dann kommt, was dieses Handy davon kannte, wieder dazu.
            const fehlt = (k) => roh && typeof roh === 'object' && !(k in roh);
            const mehr = {};
            for (const k of ['amy', 'amyTags', 'wege', 'abteilungen', 'gleich', 'kochen', 'fehlt', 'bons', 'preisalarm']) if (fehlt(k) && Object.keys(remote.stand?.[k] || {}).length) mehr[k] = remote.stand[k];
            if (fehlt('ungleich') && remote.stand?.ungleich?.length) mehr.ungleich = remote.stand.ungleich;
            if (Object.keys(mehr).length) {
              stand = anwenden(stand, opZusammen({}, {}, mehr));
              offen.push(opZusammen({}, {}, mehr));
              merkeOffen();
              plane(700);
            }
            remote = { sha: j.sha, etag, stand };
            merkeRemote();
            zeige();
          }
        } else if (etag && etag !== remote.etag) {
          remote.etag = etag;
          merkeRemote();
        }
        zuletzt = new Date();
        if (!sendet) status(offen.length ? 'sendet' : 'ok');
      } catch {
        status('offline');
      } finally {
        holt = null;
      }
    })();
    await holt;
  }

  const plane = (ms) => {
    clearTimeout(sendeTimer);
    sendeTimer = setTimeout(() => { sendeTimer = null; senden(); }, ms);
  };

  /*
   * „Amy: Einkaufsliste, 3 Änderungen“ – mit „· Bescheid“ am Ende, wenn es
   * eine Nachricht an die anderen wert ist (Neues auf der Liste, ein neues
   * Rezept, eine Notiz, alles eingekauft): Daran erkennt der Push im
   * Daten-Repo, dass er laufen soll (.github/workflows/benachrichtigen.yml).
   */
  function nachricht(paket, vorher, nachher) {
    const wer = name ? `${name}: ` : '';
    return `${wer}Einkaufsliste, ${paket.length} ${paket.length === 1 ? 'Änderung' : 'Änderungen'}${bescheidNoetig(vorher, nachher) ? ' · Bescheid' : ''}`;
  }

  async function senden() {
    if (aus || sendet || !offen.length) return;
    if (zustand === 'zugang') return;
    sendet = true;
    status('sendet');
    try {
      for (let versuch = 0; versuch < 6 && offen.length; versuch++) {
        const paket = offen.slice();
        imFlug = paket.length;
        const neu = anwenden(remote.stand, paket);
        neu.rev = (remote.stand.rev || 0) + 1;
        const body = { message: nachricht(paket, remote.stand, neu), content: zuB64(`${JSON.stringify(neu, null, 1)}\n`) };
        if (remote.sha) body.sha = remote.sha;
        let r;
        try {
          r = await fetch(datei, { method: 'PUT', headers: kopf({ 'Content-Type': 'application/json' }), body: JSON.stringify(body), cache: 'no-store' });
        } catch {
          status('offline');
          plane(15000);
          return;
        }
        if (r.ok) {
          const j = await r.json().catch(() => null);
          remote = { sha: j?.content?.sha || null, etag: null, stand: neu };
          offen = offen.slice(paket.length);
          merkeRemote();
          merkeOffen();
          zuletzt = new Date();
          zeige();
          versuch = -1; // Erfolg: Kam inzwischen Neues dazu, geht es gleich mit frischen Versuchen weiter.
          continue;
        }
        if (r.status === 409 || r.status === 422) {
          // Jemand war schneller (oder die sha fehlte): neu holen, nochmal.
          await warte(200 * (versuch + 1) + Math.random() * 300);
          await holen(true);
          if (zustand === 'zugang') return;
          continue;
        }
        if (keinZugang(r)) { repoOk = false; status('zugang'); return; }
        status('offline');
        plane(begrenzt(r) ? 60000 : 15000);
        return;
      }
      if (offen.length) plane(5000);
      else status('ok');
    } finally {
      sendet = false;
      imFlug = 0;
      if (offen.length && !sendeTimer && zustand !== 'zugang' && zustand !== 'offline') plane(400);
      else if (!offen.length && zustand === 'sendet') status('ok');
    }
  }

  const sichtbar = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  const beimZurueckkommen = () => { if (sichtbar()) { holen(); if (offen.length) senden(); } };
  const wiederOnline = () => { if (zustand === 'offline') status('sendet'); holen(); senden(); };

  return {
    art: 'github',
    start(beiAenderung, beiStatus) {
      melden = beiAenderung;
      meldeStatus = beiStatus;
      // Erst der zuletzt bekannte Stand, dann frisch aus GitHub.
      setTimeout(() => { zeige(); status(offen.length ? 'sendet' : 'ok'); }, 0);
      holen().then(() => { if (offen.length) senden(); });
      taktTimer = setInterval(() => { if (sichtbar()) { holen(); if (offen.length && !sendeTimer) senden(); } }, takt);
      document.addEventListener('visibilitychange', beimZurueckkommen);
      window.addEventListener('online', wiederOnline);
    },
    aendern(op) {
      for (const o of alsListe(op)) {
        // Eine neuere Fassung (Kochstand) ersetzt die noch nicht gesendete – was schon unterwegs ist, bleibt
        if (o?.ersetzt) offen = [...offen.slice(0, imFlug), ...offen.slice(imFlug).filter((x) => x?.ersetzt !== o.ersetzt)];
        offen.push(o);
      }
      merkeOffen();
      zeige();
      if (zustand !== 'zugang') status(zustand === 'offline' ? 'offline' : 'sendet');
      plane(700);
    },
    jetzt() { holen(true).then(() => senden()); },
    stop() {
      aus = true;
      clearTimeout(sendeTimer);
      clearInterval(taktTimer);
      document.removeEventListener('visibilitychange', beimZurueckkommen);
      window.removeEventListener('online', wiederOnline);
      melden = () => {};
      meldeStatus = () => {};
    },
  };
}

/**
 * Prüft einen Schlüssel: Kommt man damit an das Daten-Repo heran?
 * 'ok' | 'falsch' (abgelehnt) | 'netz' (keine Verbindung oder GitHub hakt)
 */
export async function pruefeSchluessel(token, { api = API, ort = DATEN } = {}) {
  try {
    const r = await fetch(`${api}/repos/${ort.owner}/${ort.repo}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (r.ok) return 'ok';
    if (r.status === 401 || r.status === 403 || r.status === 404) return 'falsch';
    return 'netz';
  } catch {
    return 'netz';
  }
}
