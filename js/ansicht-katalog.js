/*
 * Der gemeinsame Katalog in der App – gerechnet wird in katalog.js:
 *
 *   - Jedes Gerät liest katalog.json aus dem Daten-Repo seiner Liste: beim
 *     Start, wenn die App wieder nach vorn kommt, und solange sie offen ist
 *     jede Minute (mit ETag – unverändert ist das nur ein kurzes Nachfragen).
 *     Den letzten Stand merkt es sich (MERK), dann sind die Rezepte beim
 *     nächsten Start gleich da, auch ohne Netz.
 *   - Ein neues Rezept (ansicht-ki.js über app.katalogDazu), ein geändertes
 *     („Anpassen“, auch „Mit KI ändern“ – ansicht-anpassen.js über
 *     app.katalogAendern: dieselbe id, an seiner Stelle, für alle) und „Aus
 *     dem Katalog nehmen“ schreiben dort hinein (speicher.js privatSchreiben).
 *   - Das Handy, das Gäste eingeladen hat, kennt ihre Schlüssel
 *     (boxenstopp.gaeste.v1) und gleicht ab: alle katalog.json lesen, mischen,
 *     zurückschreiben, wo etwas fehlt. So kommt Tobis Kürbissuppe zu Marielle
 *     und ihr Rezept zu Tobi und Amy – sobald Tobis Handy die App offen hat.
 *   - Im Rezept die Leiste: wer es sich gewünscht hat, „Neuer Vorschlag“,
 *     „Aus dem Katalog nehmen“.
 */
import { app, melde, lese, schreibe } from './kern.js';
import { esc, tagKurz, heute } from './format.js';
import { API, privatSchreiben } from './speicher.js';
import { ortVon, ladeKi } from './zugang.js';
import { gaesteBereinigen } from './gaeste.js';
import { opTeil, opTeilWeg } from './liste.js';
import { offenesRezept, schliesseRezept } from './ansicht-rezepte.js';
import { katalogBereinigen, katalogMischen, gleicherKatalog, katalogDazu, katalogRaus, katalogId, katalogUnterschied, leererKatalog, KATALOG_DATEI, MAX_KATALOG } from './katalog.js';

const MERK = 'boxenstopp.katalog.v1'; // { ort: 'Finanzdienste/Boxenstopp-Daten', stand }
const GAESTE = 'boxenstopp.gaeste.v1';
const ABGLEICH_MS = 5 * 60 * 1000;
const api = () => lese('__api', null) || API;
const takt = () => Number(lese('__katalogtakt', 0)) || 60 * 1000;
const ortName = (o) => `${o.owner}/${o.repo}`;

let etag = '';
let letzterAbgleich = 0;
let gleichtAb = false;

/** Den Katalog übernehmen – und, wenn er anders ist, die Rezepte neu rechnen (app.js app.rezepteNeu). */
function uebernehmen(stand) {
  const neu = katalogBereinigen(stand);
  if (gleicherKatalog(app.katalogStand, neu)) return false;
  app.katalogStand = neu;
  if (app.zugang) schreibe(MERK, { ort: ortName(ortVon(app.zugang)), stand: neu });
  app.rezepteNeu();
  return true;
}

/** Beim Start, vor dem ersten Zeichnen: was das Gerät von dieser Liste zuletzt kannte. */
export function katalogVorab() {
  const m = lese(MERK, null);
  app.katalogStand = app.zugang && m && m.ort === ortName(ortVon(app.zugang)) ? katalogBereinigen(m.stand) : leererKatalog();
  etag = '';
}

/** katalog.json eines Repos: { ok, stand, etag } – ok false ohne Netz oder bei einem anderen Fehler; ohne Datei ein leerer. */
async function lesen(ort, token, tag = '') {
  try {
    const r = await fetch(`${api()}/repos/${ort.owner}/${ort.repo}/contents/${KATALOG_DATEI}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json', ...(tag ? { 'If-None-Match': tag } : {}) },
      cache: 'no-store',
    });
    if (r.status === 304) return { ok: true, gleich: true };
    if (r.status === 404) return { ok: true, stand: leererKatalog(), etag: '' };
    if (!r.ok) return { ok: false };
    return { ok: true, stand: katalogBereinigen(await r.json()), etag: r.headers.get('etag') || '' };
  } catch {
    return { ok: false };
  }
}

/** Den Katalog der eigenen Liste holen – und, wenn es Zeit ist, mit den Gästen abgleichen. */
export async function katalogLaden({ abgleich = false } = {}) {
  if (!app.zugang?.token) return;
  const x = await lesen(ortVon(app.zugang), app.zugang.token, etag);
  if (x.ok && !x.gleich) { etag = x.etag; uebernehmen(x.stand); }
  if (abgleich || Date.now() - letzterAbgleich > ABGLEICH_MS) await katalogAbgleichen();
}

const abgleichText = (u) => [u.neu.length ? `${u.neu.slice(0, 3).join(', ')}${u.neu.length > 3 ? ` und ${u.neu.length - 3} weitere` : ''} dazu` : '', u.raus.length ? `${u.raus.slice(0, 3).join(', ')} raus` : ''].filter(Boolean).join('; ');

/**
 * Zwischen den Listen: nur auf dem Gerät, das Gäste eingeladen hat. Alle
 * katalog.json lesen, mischen, zurückschreiben, wo der Stand ein anderer ist.
 * Was nicht geht (ein Gast hat sein Repo gelöscht, kein Netz), bleibt beim
 * nächsten Mal.
 */
export async function katalogAbgleichen() {
  const gaeste = gaesteBereinigen(lese(GAESTE, []));
  if (!gaeste.length || !app.zugang?.token || gleichtAb) return;
  gleichtAb = true;
  letzterAbgleich = Date.now();
  try {
    const orte = [{ ort: ortVon(app.zugang), token: app.zugang.token }, ...gaeste.map((g) => {
      const [owner, repo] = g.daten.split('/');
      return { ort: { owner, repo }, token: g.token };
    })];
    const gelesen = (await Promise.all(orte.map(async (o) => ({ ...o, ...(await lesen(o.ort, o.token)) })))).filter((o) => o.ok);
    if (!gelesen.length) return;
    const alle = katalogMischen(app.katalogStand, ...gelesen.map((o) => o.stand));
    for (const o of gelesen) {
      if (gleicherKatalog(o.stand, alle)) continue;
      const was = abgleichText(katalogUnterschied(o.stand, alle));
      try {
        await privatSchreiben(KATALOG_DATEI, (alt) => katalogMischen(alt, alle), { token: o.token, ort: o.ort, api: api(), nachricht: `${app.name() || 'Abgleich'}: Katalog abgeglichen${was ? ` – ${was}` : ''}` });
      } catch { /* beim nächsten Mal */ }
    }
    etag = '';
    uebernehmen(alle);
  } finally {
    gleichtAb = false;
  }
}

/**
 * Ein neues Rezept in den Katalog (app.katalogDazu, von ansicht-ki.js): k im
 * KI-Format, für 8 Boxen. ersetzt: die id eines Rezepts, das dafür herausgeht
 * („Neuer Vorschlag“). Gibt die id zurück; wirft mit einem Satz für die Anzeige.
 */
async function neuSpeichern(k, { wunsch = '', ersetzt = '' } = {}) {
  if (!app.zugang?.token) throw new Error('Für den Katalog erst die gemeinsame Liste einrichten.');
  const vorher = app.katalogStand || leererKatalog();
  if (!ersetzt && Object.keys(vorher.rezepte).length >= MAX_KATALOG) throw new Error(`Der Katalog ist voll (${MAX_KATALOG} Rezepte) – nimm erst eins heraus.`);
  const id = katalogId();
  const eintrag = { k, wunsch: String(wunsch || '').trim().slice(0, 500), by: app.name() || '', ziel: { ...app.ziel }, ersetzt: ersetzt || '' };
  const neu = await privatSchreiben(KATALOG_DATEI, (alt) => katalogDazu(katalogMischen(alt, vorher), id, { ...eintrag, at: new Date().toISOString() }), {
    token: app.zugang.token,
    ort: ortVon(app.zugang),
    api: api(),
    nachricht: `${app.name() || 'Jemand'}: Katalog – „${k.kurz}“ dazu${ersetzt ? ' (neuer Vorschlag)' : ''}`,
  });
  etag = '';
  uebernehmen(neu);
  katalogAbgleichen();
  return id;
}

/**
 * Ein Rezept aus dem Katalog ändern („Anpassen“, auch „Mit KI ändern“): an
 * seiner Stelle, für alle – dieselbe id, ein neues Datum (beim Abgleich gilt
 * das neuere), der Wunsch von damals und wer es sich gewünscht hat bleiben. k
 * im KI-Format, gerechnet auf das Ziel und die Boxen dieser Liste – das Ziel
 * kommt mit, jede andere Liste rechnet von dort auf ihres. Wirft mit einem
 * Satz für die Anzeige.
 */
async function aendernSpeichern(rid, k) {
  if (!app.zugang?.token) throw new Error('Für den Katalog erst die gemeinsame Liste einrichten.');
  const vorher = app.katalogStand || leererKatalog();
  if (!vorher.rezepte[rid]) throw new Error('Das Rezept ist nicht mehr im Katalog.');
  const at = new Date().toISOString();
  const neu = await privatSchreiben(KATALOG_DATEI, (alt) => {
    const m = katalogMischen(alt, vorher);
    const e = m.rezepte[rid] || vorher.rezepte[rid];
    return katalogDazu(m, rid, { k, wunsch: e.wunsch, by: e.by, ziel: { ...app.ziel }, at });
  }, {
    token: app.zugang.token,
    ort: ortVon(app.zugang),
    api: api(),
    nachricht: `${app.name() || 'Jemand'}: Katalog – „${k.kurz}“ geändert`,
  });
  etag = '';
  uebernehmen(neu);
  katalogAbgleichen();
}

/** Aus dem Katalog nehmen – für alle; was davon auf der eigenen Liste steht, geht mit (Rückgängig holt beides zurück). */
async function rausNehmen(rid) {
  const e = app.katalogStand?.rezepte?.[rid];
  if (!e || !app.zugang?.token) return;
  const teile = Object.entries(app.stand.items).filter(([, d]) => d.parts?.[rid]).map(([k, d]) => [k, d.parts[rid], { n: d.name, c: d.cat }]);
  const vorher = app.katalogStand;
  try {
    const neu = await privatSchreiben(KATALOG_DATEI, (alt) => katalogRaus(katalogMischen(alt, vorher), rid), { token: app.zugang.token, ort: ortVon(app.zugang), api: api(), nachricht: `${app.name() || 'Jemand'}: Katalog – „${e.k.kurz}“ raus` });
    if (offenesRezept() === rid) schliesseRezept();
    if (teile.length) app.aendern(teile.map(([k]) => opTeilWeg(k, rid)));
    etag = '';
    uebernehmen(neu);
  } catch (err) {
    melde(err?.message || 'Das ging gerade nicht.');
    return;
  }
  katalogAbgleichen();
  melde(`„${e.k.kurz}“ ist aus dem Katalog`, { knopf: 'Rückgängig', beiKnopf: () => wiederRein(rid, e, teile) });
}

async function wiederRein(rid, e, teile) {
  try {
    const neu = await privatSchreiben(KATALOG_DATEI, (alt) => katalogDazu(katalogMischen(alt, app.katalogStand), rid, { ...e, at: new Date().toISOString() }), { token: app.zugang.token, ort: ortVon(app.zugang), api: api(), nachricht: `${app.name() || 'Jemand'}: Katalog – „${e.k.kurz}“ wieder dazu` });
    etag = '';
    uebernehmen(neu);
    if (teile.length) app.aendern(teile.map(([k, p, kat]) => opTeil(k, rid, p, kat)));
    katalogAbgleichen();
  } catch (err) {
    melde(err?.message || 'Das ging gerade nicht.');
  }
}

/** Die Leiste im Rezept (über app.kiLeiste, ansicht-ki.js). */
function leiste(r) {
  const v = r.katalog || {};
  const wer = v.by ? ` von ${v.by === app.name() ? 'dir' : esc(v.by)}` : '';
  const wann = v.at && !Number.isNaN(Date.parse(v.at)) ? `, ${esc(tagKurz(heute(new Date(v.at))))}` : '';
  // Was jemand der KI geschrieben hat, steht nicht da – nur, von wem und wann
  const z = app.ziel;
  const daneben = Math.abs(r.m.kcal - z.kcal) > 15 || Math.abs(r.m.p - z.p) > 2 || Math.abs(r.m.kh - z.kh) > 3 || Math.abs(r.m.f - z.f) > 2;
  const warn = daneben ? '<p class="ki-warn">Mit diesen Zutaten trifft die Box das Ziel nicht ganz, siehe die Nährwerte oben.</p>' : '';
  const hinweis = r.ki?.hinweis ? `<p class="ki-hinweis">${esc(r.ki.hinweis)}</p>` : '';
  // Was beim Anpassen geändert wurde – ohne den Wunsch dafür
  const anp = r.ki?.geaendert?.length ? `<p class="ki-anp"><b>Geändert:</b> ${r.ki.geaendert.map(esc).join(' · ')}</p>` : '';
  const aus = app.listeDa ? '' : ' disabled';
  const knoepfe = `${ladeKi() ? `<button type="button" class="btn" data-act="kat-neu"${aus}>Neuer Vorschlag</button>` : ''}<button type="button" class="btn btn-quiet" data-act="kat-weg"${aus}>Aus dem Katalog nehmen</button>`;
  return `<p class="ki-k"><b>Aus dem Katalog</b> · gewünscht${wer}${wann}</p>${anp}${warn}${hinweis}<div class="ki-btns">${knoepfe}</div>
<p class="fine">Für alle, die die App nutzen – jede Liste bekommt es auf ihr Ziel pro Box und ihre Boxen gerechnet.</p>`;
}

export function klickKatalog(el) {
  if (el.dataset.act === 'kat-weg') { const rid = offenesRezept(); if (rid) rausNehmen(rid); return true; }
  return false;
}

/** Beim Start: die Haken setzen, den gemerkten Stand nehmen, regelmäßig nachsehen. */
export function katalogStart() {
  app.katalogLeiste = leiste;
  app.katalogDazu = neuSpeichern;
  app.katalogAendern = aendernSpeichern;
  katalogVorab();
  setInterval(() => { if (document.visibilityState === 'visible') katalogLaden(); }, takt());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') katalogLaden(); });
}
