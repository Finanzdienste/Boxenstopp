#!/usr/bin/env node
/*
 * Der Putzplan in Microsoft To Do: Ist ein Putztag dran (heute oder noch
 * offen), steht er dort als Aufgabe, fällig an seinem Tag, mit den Aufgaben
 * als Schritten. Abhaken geht in beide Richtungen: Was in der App abgehakt
 * ist, hakt sich in To Do ab; was in To Do abgehakt ist, kommt in die App.
 *
 * Wohin, wählt jede Person nach dem Verbinden (liste.json haushalt.todoZiel):
 * eine eigene neue Liste „Haushalt“ – dann ihre Putztage – oder eine
 * vorhandene. Ist die geteilt (isShared), stehen dort alle Putztage, und wer
 * eingetragen ist, steht im Titel („Bad · Amy“): Zuweisen kann eine App in
 * To Do nicht, Graph kennt kein „zugewiesen an“. Dann reicht eine Person –
 * die andere sieht die gemeinsame Liste ohnehin.
 *
 * Läuft im privaten Daten-Repo (.github/workflows/haushalt.yml) – dreimal am
 * Tag und gleich, wenn die App in der Commit-Nachricht „· To Do“ schreibt
 * (speicher.js: jemand will verbinden oder trennen, oder am Putzplan hat sich
 * etwas getan und jemand ist verbunden). Der Code kommt aus dem öffentlichen
 * App-Repo; was er sich merkt, steht in todo.json im Daten-Repo.
 *
 *   node app/werkzeug/todo.mjs --daten daten --arbeit DIR --anmelden
 *       Wer verbinden will: bei Microsoft einen Code holen. Code und Adresse
 *       kommen nach todo.json (die App zeigt sie), der Gerätecode nur nach
 *       DIR (nie ins Repo). Mit Codes: „warten=ja“ in $GITHUB_OUTPUT.
 *   node app/werkzeug/todo.mjs --daten daten --arbeit DIR --warten
 *       Bis die Anmeldung durch ist (höchstens so lange, wie der Code gilt).
 *   node app/werkzeug/todo.mjs --daten daten --arbeit DIR --abgleichen
 *       Trennen, wer trennen will; dann je verbundener Person abgleichen.
 *   node app/werkzeug/todo.mjs --daten . --arbeit DIR --nachtragen
 *       Nach dem Holen des neuesten Stands: todo.json aus DIR übernehmen,
 *       was aus To Do kam, auf liste.json legen (wie die App: rev + 1).
 *
 * Anmeldung mit Gerätecode, ohne Weiterleitung, nur persönliche Konten
 * („consumers“), mit der App-ID aus liste.json (haushalt.todoApp – Tobis
 * Registrierung bei Microsoft, kein Geheimnis). Den Erneuerungs-Token gibt
 * Microsoft bei jedem Gebrauch neu aus; er steht nur verschlüsselt in
 * todo.json (AES-256-GCM, der Schlüssel abgeleitet vom Secret
 * VAPID_PRIVATE_KEY, das nur Actions kennt – Umgebung TODO_SCHLUESSEL).
 *
 * Gibt nie Tokens, Codes oder Inhalte von Microsoft aus. Der Zugang geht nur
 * an Microsofts Anmeldung und an Graph.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { bereinigen, anwenden, opPutzHaken, opPutzFertig, opTodoAn } from '../js/liste.js';
import { termin, zustaendig } from '../js/haushalt.js';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const hat = (name) => process.argv.includes(name);
const DATEN = path.resolve(arg('--daten') || '.');
if (!arg('--arbeit')) { console.error('todo.mjs: --arbeit fehlt'); process.exit(2); }
const ARBEIT = path.resolve(arg('--arbeit'));
mkdirSync(ARBEIT, { recursive: true });

// Die einzigen Adressen: Microsofts Anmeldung und Graph (für die Tests umstellbar)
const ANMELDUNG = process.env.TODO_ANMELDUNG || 'https://login.microsoftonline.com/consumers/oauth2/v2.0/';
const GRAPH = process.env.TODO_GRAPH || 'https://graph.microsoft.com/v1.0/';
const RECHTE = 'Tasks.ReadWrite offline_access';
const LISTE = 'Haushalt';
const APP_LINK = 'https://finanzdienste.github.io/Boxenstopp/#haushalt';
// Damit sagt Microsoft: Dieser Zugang gilt nicht mehr (abgelaufen, entzogen, Passwort geändert)
const ABGEWIESEN = ['invalid_grant', 'interaction_required', 'consent_required', 'invalid_client', 'unauthorized_client'];
const VERIFIZIEREN = /^https:\/\/(www\.)?(microsoft\.com|login\.microsoftonline\.com|login\.live\.com|aka\.ms)\//;
const TAKT_MS = Number(process.env.TODO_TAKT_MS) || 0; // nur für die Tests: so schnell nachfragen
const GROSS = (n) => String(n || '').replace(/^./, (c) => c.toUpperCase());

const lies = (datei, sonst) => { try { return JSON.parse(readFileSync(datei, 'utf8')); } catch { return sonst; } };
const schreib = (datei, x) => writeFileSync(datei, `${JSON.stringify(x, null, 1)}\n`);
const DATEI = { todo: path.join(ARBEIT, 'todo.json'), geraete: path.join(ARBEIT, 'geraete.json'), ops: path.join(ARBEIT, 'liste-ops.json') };
const warte = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Berliner Datum (die Putztage rechnen in Berliner Tagen). */
function heuteBerlin() {
  const t = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(arg('--jetzt') ? new Date(arg('--jetzt')) : new Date()).map((x) => [x.type, x.value]));
  return `${t.year}-${t.month}-${t.day}`;
}

/* ------------------------------------------------------------ Schlüssel */

const SCHLUESSEL = process.env.TODO_SCHLUESSEL ? Buffer.from(hkdfSync('sha256', Buffer.from(process.env.TODO_SCHLUESSEL, 'utf8'), Buffer.from('boxenstopp-todo'), Buffer.from('erneuerungs-token v1'), 32)) : null;
function verschluesseln(text, name) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', SCHLUESSEL, iv);
  c.setAAD(Buffer.from(`todo:${name}`));
  const inhalt = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1.${Buffer.concat([iv, c.getAuthTag(), inhalt]).toString('base64url')}`;
}
function entschluesseln(s, name) {
  if (!SCHLUESSEL || typeof s !== 'string' || !s.startsWith('v1.')) return null;
  try {
    const b = Buffer.from(s.slice(3), 'base64url');
    const d = createDecipheriv('aes-256-gcm', SCHLUESSEL, b.subarray(0, 12));
    d.setAAD(Buffer.from(`todo:${name}`));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- Zustand */

/** todo.json: aus diesem Lauf (DIR), sonst aus dem Repo. */
function todoLesen() {
  const t = lies(DATEI.todo, null) || lies(path.join(DATEN, 'todo.json'), null) || {};
  if (!t.personen || typeof t.personen !== 'object') t.personen = {};
  return t;
}
const todoSchreiben = (t) => schreib(DATEI.todo, t);
const opsDazu = (ops) => { if (ops.length) schreib(DATEI.ops, [...lies(DATEI.ops, []), ...ops]); };
function listeLesen() {
  const roh = lies(path.join(DATEN, 'liste.json'), {});
  return bereinigen(roh);
}

/* ------------------------------------------------------------- Netz */

/** Ein Aufruf: { code, json } – ohne Netz code 0. */
async function holen(url, { methode = 'GET', zugang = '', json = null, form = null } = {}) {
  const headers = { Accept: 'application/json' };
  let body;
  if (zugang) headers.Authorization = `Bearer ${zugang}`;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  const ac = new AbortController();
  const frist = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { method: methode, headers, body, signal: ac.signal });
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch { j = null; }
    return { code: r.status, json: j };
  } catch {
    return { code: 0, json: null };
  } finally {
    clearTimeout(frist);
  }
}
const anmelden = (endpunkt, form) => holen(`${ANMELDUNG}${endpunkt}`, { methode: 'POST', form });

/** Später noch einmal (Microsoft bremst, hakt, kein Netz). */
class Spaeter extends Error {}
/** Die Anmeldung gilt nicht mehr. */
class Weg extends Error {}

/**
 * Graph für eine Person: holt den Zugang über den Erneuerungs-Token (den
 * neuen merkt sie sich verschlüsselt), bei 401 einmal neu. 429, 5xx, kein
 * Netz: Spaeter. Der Zugang geht nur an Graph.
 */
function graphFuer(person, n, app) {
  let zugang = '';
  async function neu() {
    const erneuern = entschluesseln(person.token, n);
    if (!erneuern) throw new Weg('schluessel');
    const a = await anmelden('token', { grant_type: 'refresh_token', client_id: app, refresh_token: erneuern, scope: RECHTE });
    if (a.code === 200 && typeof a.json?.access_token === 'string') {
      zugang = a.json.access_token;
      if (typeof a.json.refresh_token === 'string' && a.json.refresh_token) person.token = verschluesseln(a.json.refresh_token, n);
      return;
    }
    const grund = typeof a.json?.error === 'string' ? a.json.error : '';
    if ((a.code === 400 || a.code === 401) && ABGEWIESEN.includes(grund)) throw new Weg(grund);
    throw new Spaeter(`Anmeldung ${a.code || 'ohne Netz'}${grund ? ` ${grund}` : ''}`);
  }
  return async (methode, pfad, json = null) => {
    const absolut = /^https?:/i.test(pfad);
    if (absolut && !pfad.startsWith(GRAPH)) throw new Spaeter('fremde Adresse – nicht aufgerufen');
    const url = absolut ? pfad : `${GRAPH}me/todo/${pfad}`;
    if (!zugang) await neu();
    let r = await holen(url, { methode, zugang, json });
    if (r.code === 401) { await neu(); r = await holen(url, { methode, zugang, json }); }
    if (r.code === 0 || r.code === 429 || r.code >= 500) throw new Spaeter(`${methode} ${r.code || 'ohne Netz'}`);
    return r;
  };
}

/* ------------------------------------------------------------ Anmelden */

async function anmeldenLauf() {
  const stand = listeLesen();
  const h = stand.haushalt;
  const t = todoLesen();
  const geraete = lies(DATEI.geraete, {});
  let wartet = false;
  for (const [n, w] of Object.entries(h.todoWunsch || {})) {
    if (w.art !== 'verbinden') continue;
    const p = t.personen[n] || {};
    if (p.wunsch && p.wunsch >= w.at) continue;
    t.personen[n] = p;
    p.name = w.name || p.name || GROSS(n);
    p.wunsch = w.at;
    // Schon verbunden (zweimal getippt)? Dann bleibt es dabei – ein anderes Konto: erst trennen
    if (p.status === 'verbunden' && p.token) continue;
    if (!h.todoApp) { Object.assign(p, { status: 'fehler', fehler: 'Erst die App-ID von Microsoft eintragen (Einstellungen → Microsoft To Do).' }); continue; }
    if (!SCHLUESSEL) { Object.assign(p, { status: 'fehler', fehler: 'Im Daten-Repo fehlt das Secret VAPID_PRIVATE_KEY (kommt mit „Push einrichten“) – damit wird der Zugang verschlüsselt.' }); continue; }
    const a = await anmelden('devicecode', { client_id: h.todoApp, scope: RECHTE });
    const j = a.json || {};
    if (a.code !== 200 || typeof j.user_code !== 'string' || typeof j.device_code !== 'string') {
      const grund = typeof j.error === 'string' ? j.error : String(a.code || 'kein Netz');
      Object.assign(p, { status: 'fehler', fehler: /client|application/i.test(grund) ? 'Microsoft nimmt die App-ID nicht an – stimmt sie (Einstellungen → Microsoft To Do), und ist die App bei Microsoft für persönliche Konten registriert?' : `Microsoft gab keinen Code (${grund}) – gleich noch einmal verbinden.` });
      console.log(`To Do: ${n} – kein Code (${grund}).`);
      continue;
    }
    const gilt = Math.max(60, Math.min(900, Number(j.expires_in) || 900));
    const url = VERIFIZIEREN.test(String(j.verification_uri || '')) ? j.verification_uri : 'https://www.microsoft.com/link';
    const bis = new Date(Date.now() + gilt * 1000).toISOString();
    Object.assign(p, { status: 'code', code: j.user_code.slice(0, 20), url, bis, fehler: null });
    geraete[n] = { geraet: j.device_code, takt: Math.max(1, Math.min(30, Number(j.interval) || 5)), bis, app: h.todoApp };
    wartet = true;
    console.log(`To Do: Code für ${n} geholt – gilt ${Math.round(gilt / 60)} Minuten.`);
  }
  todoSchreiben(t);
  schreib(DATEI.geraete, geraete);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `warten=${wartet ? 'ja' : 'nein'}\n`);
}

async function wartenLauf() {
  const t = todoLesen();
  const geraete = lies(DATEI.geraete, {});
  const offen = new Set(Object.keys(geraete));
  const naechstes = Object.fromEntries([...offen].map((n) => [n, 0]));
  const ops = [];
  while (offen.size) {
    for (const n of [...offen]) {
      const g = geraete[n];
      const p = t.personen[n] || (t.personen[n] = { name: GROSS(n) });
      if (Date.now() > Date.parse(g.bis)) {
        Object.assign(p, { status: 'fehler', fehler: 'Der Code ist abgelaufen, bevor die Anmeldung fertig war – noch einmal verbinden.', code: null, url: null, bis: null });
        offen.delete(n);
        console.log(`To Do: ${n} – Code abgelaufen.`);
        continue;
      }
      if (Date.now() < naechstes[n]) continue;
      const a = await anmelden('token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: g.app, device_code: g.geraet });
      const j = a.json || {};
      const fehler = typeof j.error === 'string' ? j.error : '';
      if (fehler === 'slow_down') g.takt = Math.min(30, g.takt + 5);
      const nochNicht = fehler === 'authorization_pending' || fehler === 'slow_down' || a.code === 0 || a.code === 429 || a.code >= 500;
      if (nochNicht) { naechstes[n] = Date.now() + (TAKT_MS || g.takt * 1000); continue; }
      offen.delete(n);
      if (a.code === 200 && typeof j.refresh_token === 'string' && j.refresh_token) {
        const seit = new Date().toISOString();
        t.personen[n] = { name: p.name || GROSS(n), status: 'verbunden', token: verschluesseln(j.refresh_token, n), seit, zuletzt: null, fehler: null, wunsch: p.wunsch || null, liste: null, aufgaben: {} };
        ops.push(opTodoAn(n, true));
        console.log(`To Do: ${n} verbunden.`);
        continue;
      }
      const satz = fehler === 'authorization_declined' ? 'Die Anmeldung bei Microsoft wurde abgelehnt – noch einmal verbinden, wenn du willst.'
        : fehler === 'expired_token' || fehler === 'code_expired' ? 'Der Code ist abgelaufen, bevor die Anmeldung fertig war – noch einmal verbinden.'
          // Ohne „Öffentliche Clientflows“ will Microsoft ein App-Geheimnis (AADSTS7000218) – das gibt es hier mit Absicht nicht
          : fehler === 'invalid_client' ? 'Bei Microsoft ist die Anmeldung mit Code noch aus: in der App-Registrierung unter „Authentifizierung“ „Öffentliche Clientflows zulassen“ auf Ja stellen – dann noch einmal verbinden.'
            : `Microsoft hat die Anmeldung nicht angenommen (${fehler || a.code}) – noch einmal verbinden.`;
      Object.assign(p, { status: 'fehler', fehler: satz, code: null, url: null, bis: null });
      console.log(`To Do: ${n} – Anmeldung nicht durch (${fehler || a.code}).`);
    }
    if (offen.size) await warte(TAKT_MS || 1000);
  }
  todoSchreiben(t);
  schreib(DATEI.geraete, {});
  opsDazu(ops);
}

/* ------------------------------------------------------------ Abgleichen */

const enc = encodeURIComponent;
const aufgabePfad = (l, id) => `lists/${enc(l)}/tasks/${enc(id)}`;
const faelligAm = (tag) => ({ dateTime: `${tag}T00:00:00.0000000`, timeZone: 'UTC' });
const text = () => ({ content: `Aus dem Putzplan in Boxenstopp – abhaken geht hier und in der App: ${APP_LINK}`, contentType: 'text' });

/** Alle Listen der Person (ohne „Gekennzeichnete E-Mail“): [{ id, name, geteilt, eigen, art }] – für die Wahl in der App. */
async function alleListen(graph) {
  const listen = [];
  let pfad = 'lists';
  for (let seite = 0; pfad && seite < 10; seite++) {
    const r = await graph('GET', pfad);
    if (r.code !== 200 || !Array.isArray(r.json?.value)) throw new Spaeter(`Listen ${r.code}`);
    for (const l of r.json.value) {
      if (typeof l?.id !== 'string' || l.wellknownListName === 'flaggedEmails') continue;
      listen.push({ id: l.id, name: String(l.displayName || '').slice(0, 120), geteilt: l.isShared === true, eigen: l.isOwner !== false, art: l.wellknownListName === 'defaultList' ? 'standard' : '' });
    }
    pfad = typeof r.json['@odata.nextLink'] === 'string' ? r.json['@odata.nextLink'] : null;
  }
  return listen.slice(0, 40);
}

/** Die Liste „Haushalt“: die gemerkte; sonst eine eigene dieses Namens; sonst eine neue. */
async function listeVon(graph, p) {
  // Eine gewählte vorhandene Liste: die, sonst keine (nicht einfach eine neue anlegen)
  if (p.zielId && p.zielId !== 'neu') {
    if (p.liste === p.zielId) return p.liste;
    throw new Spaeter('gewählte Liste fehlt');
  }
  if (p.liste) {
    const r = await graph('GET', `lists/${enc(p.liste)}`);
    if (r.code === 200) return p.liste;
    if (r.code !== 404) throw new Spaeter(`Liste ${r.code}`);
    // In To Do gelöscht: mit ihr die Aufgaben – alles neu
    p.liste = null;
    p.aufgaben = {};
  }
  let pfad = 'lists';
  for (let seite = 0; pfad && seite < 10; seite++) {
    const r = await graph('GET', pfad);
    if (r.code !== 200 || !Array.isArray(r.json?.value)) throw new Spaeter(`Listen ${r.code}`);
    const da = r.json.value.find((l) => l?.displayName === LISTE && typeof l.id === 'string' && (l.wellknownListName || 'none') === 'none');
    if (da) { p.liste = da.id; return da.id; }
    pfad = typeof r.json['@odata.nextLink'] === 'string' ? r.json['@odata.nextLink'] : null;
  }
  const r = await graph('POST', 'lists', { displayName: LISTE });
  if (!(r.code === 200 || r.code === 201) || typeof r.json?.id !== 'string') throw new Spaeter(`Liste anlegen ${r.code}`);
  p.liste = r.json.id;
  p.aufgaben = {};
  return p.liste;
}

/** Die Schritte einer Aufgabe: Map id → { isChecked, displayName }. */
async function schritteHolen(graph, l, id) {
  const r = await graph('GET', `${aufgabePfad(l, id)}/checklistItems`);
  if (r.code === 404) return null;
  if (r.code !== 200 || !Array.isArray(r.json?.value)) throw new Spaeter(`Schritte ${r.code}`);
  return new Map(r.json.value.filter((x) => typeof x?.id === 'string').map((x) => [x.id, { isChecked: x.isChecked === true, displayName: String(x.displayName || '') }]));
}

/** Der Titel in To Do: in einer gemeinsamen Liste mit dem Namen, wer dran ist („Bad · Amy“). */
const titelVon = (plan, p) => (p.geteilt && plan.wer ? `${plan.name} · ${plan.wer}` : plan.name);

/** Eine Aufgabe neu anlegen – mit Schritten. */
async function anlegen(graph, p, plan, soll, z) {
  const titel = titelVon(plan, p);
  let l = await listeVon(graph, p);
  let r = await graph('POST', `lists/${enc(l)}/tasks`, { title: titel, body: text(), dueDateTime: faelligAm(soll.datum) });
  if (r.code === 404 && (!p.zielId || p.zielId === 'neu')) { p.liste = null; l = await listeVon(graph, p); r = await graph('POST', `lists/${enc(l)}/tasks`, { title: titel, body: text(), dueDateTime: faelligAm(soll.datum) }); }
  if (!(r.code === 200 || r.code === 201) || typeof r.json?.id !== 'string') throw new Spaeter(`Aufgabe anlegen ${r.code}`);
  const a = { id: r.json.id, datum: soll.datum, erledigt: false, weg: false, titel, punkte: {}, haken: [] };
  z.neu++;
  await schritteAngleichen(graph, l, a, plan, soll, new Map(), z);
  return a;
}

/** Die Schritte so, wie die App sie hat (Text und Häkchen); was es nicht mehr gibt, kommt weg. */
async function schritteAngleichen(graph, l, a, plan, soll, schritte, z) {
  const punkte = { ...(a.punkte || {}) };
  for (const auf of plan.aufgaben) {
    const will = soll.haken.includes(auf.id);
    const sid = punkte[auf.id];
    const s = sid ? schritte.get(sid) : null;
    if (!s) {
      const r = await graph('POST', `${aufgabePfad(l, a.id)}/checklistItems`, { displayName: auf.t, isChecked: will });
      if ((r.code === 200 || r.code === 201) && typeof r.json?.id === 'string') { punkte[auf.id] = r.json.id; z.geaendert++; } else if (r.code === 404) return false;
      continue;
    }
    const aenderung = {};
    if (s.isChecked !== will) aenderung.isChecked = will;
    if (s.displayName !== auf.t) aenderung.displayName = auf.t;
    if (Object.keys(aenderung).length) {
      const r = await graph('PATCH', `${aufgabePfad(l, a.id)}/checklistItems/${enc(sid)}`, aenderung);
      if (r.code === 404) delete punkte[auf.id]; else z.geaendert++;
    }
  }
  for (const [aid, sid] of Object.entries(punkte)) {
    if (plan.aufgaben.some((x) => x.id === aid)) continue;
    if (schritte.has(sid)) { await graph('DELETE', `${aufgabePfad(l, a.id)}/checklistItems/${enc(sid)}`); z.geaendert++; }
    delete punkte[aid];
  }
  a.punkte = punkte;
  a.haken = plan.aufgaben.map((x) => x.id).filter((id) => soll.haken.includes(id) && punkte[id]);
  return true;
}

/**
 * Eine gemerkte Aufgabe auf den Stand der App bringen: Tag (rückt sie weiter,
 * fängt sie frisch an), Titel, erledigt oder offen, Schritte. false: in To Do
 * nicht mehr da.
 */
async function angleichen(graph, l, a, plan, soll, z, { weiter = false, titel = plan.name } = {}) {
  const aenderung = {};
  if (weiter) aenderung.dueDateTime = faelligAm(soll.datum);
  if (a.titel !== titel) aenderung.title = titel;
  const fertigDort = a.dort ? a.dort.fertig : a.erledigt;
  if (soll.offen && fertigDort) aenderung.status = 'notStarted';
  if (!soll.offen && !fertigDort) aenderung.status = 'completed';
  if (Object.keys(aenderung).length) {
    const r = await graph('PATCH', aufgabePfad(l, a.id), aenderung);
    if (r.code === 404) return false;
    if (r.code >= 400) throw new Spaeter(`Aufgabe ändern ${r.code}`);
    z.geaendert++;
  }
  a.datum = soll.datum;
  a.titel = titel;
  a.erledigt = !soll.offen;
  if (!soll.offen) return true;
  const schritte = a.dort?.schritte || await schritteHolen(graph, l, a.id);
  if (!schritte) return false;
  return schritteAngleichen(graph, l, a, plan, soll, schritte, z);
}

/** Was die App für einen Putztag will: { datum, offen, haken } – oder null (gerade nichts dran). */
function sollVon(plan, st, heute) {
  if (!plan.wdh.tage.length) return null;
  const t = termin(plan, st, heute);
  if (t.art === 'heute' || t.art === 'offen') return { datum: t.datum, offen: true, haken: t.haken };
  if (t.art === 'erledigt') return { datum: t.datum, offen: false, haken: plan.aufgaben.map((x) => x.id) };
  return null;
}

/** 1. Was in To Do passiert ist, kommt in die App (für alle zuerst – dann sieht der zweite schon, was der erste abgehakt hat). */
async function lesen(n, p, ctx, z) {
  const graph = graphFuer(p, n, ctx.app);
  const name = p.name || GROSS(n);
  p.aufgaben = p.aufgaben && typeof p.aufgaben === 'object' ? p.aufgaben : {};
  p.listen = await alleListen(graph);
  // Wohin? Erst, wenn gewählt – vorher nur die Listen zum Wählen
  const ziel = ctx.stand.haushalt.todoZiel?.[n];
  if (!ziel) { p.wahl = true; p.fehler = null; return null; }
  if (ziel.at !== p.zielAt) {
    // Neu gewählt: was offen in der alten Liste steht, kommt weg – dann alles in die neue
    for (const a of Object.values(p.aufgaben)) {
      if (p.liste && a.id && !a.erledigt && !a.weg) { await graph('DELETE', aufgabePfad(p.liste, a.id)); z.geaendert++; }
    }
    p.aufgaben = {};
    p.liste = ziel.id === 'neu' ? null : ziel.id;
    p.zielAt = ziel.at;
  }
  p.zielId = ziel.id;
  if (ziel.id !== 'neu' && !p.listen.some((x) => x.id === ziel.id)) {
    p.wahl = true;
    p.fehler = `Die Liste „${ziel.name}“ gibt es in To Do nicht mehr – in den Einstellungen eine andere wählen.`;
    return null;
  }
  p.wahl = false;
  const l = await listeVon(graph, p);
  const info = p.listen.find((x) => x.id === l);
  p.listeName = info?.name || ziel.name || LISTE;
  p.geteilt = info?.geteilt === true;
  // Wer es war: in der eigenen Liste die Person; in der gemeinsamen weiß Graph es nicht – dann, wer eingetragen ist
  const wer = (planId) => (p.geteilt ? ctx.stand.haushalt.plaene[planId]?.wer || '' : name);
  for (const [planId, a] of Object.entries(p.aufgaben)) {
    delete a.dort;
    if (!a.id || a.erledigt || a.weg) continue;
    const r = await graph('GET', aufgabePfad(l, a.id));
    if (r.code === 404) { a.weg = true; continue; }
    if (r.code !== 200) throw new Spaeter(`Aufgabe ${r.code}`);
    const schritte = await schritteHolen(graph, l, a.id);
    if (!schritte) { a.weg = true; continue; }
    a.dort = { fertig: r.json?.status === 'completed', schritte };
    if (!ctx.stand.haushalt.plaene[planId]) continue;
    const ops = [];
    if (a.dort.fertig) ops.push(opPutzFertig(planId, a.datum, true, wer(planId)));
    else {
      for (const [aid, sid] of Object.entries(a.punkte || {})) {
        const sch = schritte.get(sid);
        if (sch && sch.isChecked !== (a.haken || []).includes(aid)) ops.push(opPutzHaken(planId, a.datum, aid, sch.isChecked, wer(planId)));
      }
    }
    for (const op of ops) { ctx.stand = anwenden(ctx.stand, op); ctx.ops.push(op); z.geholt++; }
    if (a.dort.fertig) a.erledigt = true;
    else a.haken = Object.entries(a.punkte || {}).filter(([, sid]) => schritte.get(sid)?.isChecked).map(([aid]) => aid);
  }
  return { graph, l };
}

/** 2. Die App in To Do: je Putztag, der gerade dran ist, eine Aufgabe – in der eigenen Liste die der Person, in einer gemeinsamen alle. */
async function schreiben(n, p, ctx, z, { graph, l }) {
  const h = ctx.stand.haushalt;
  const meine = Object.entries(h.plaene).filter(([, plan]) => (p.geteilt || zustaendig(plan, n)) && plan.wdh.tage.length);
  for (const [planId, plan] of meine) {
    const soll = sollVon(plan, h.stand[planId], ctx.heute);
    const a = p.aufgaben[planId];
    const titel = titelVon(plan, p);
    if (!soll) {
      if (a?.id && !a.erledigt && !a.weg) { await graph('DELETE', aufgabePfad(l, a.id)); z.geaendert++; }
      delete p.aufgaben[planId];
      continue;
    }
    if (a && a.datum === soll.datum) {
      // Derselbe Tag: in To Do gelöscht bleibt gelöscht; sonst angleichen
      if (a.weg || !a.id || (a.erledigt && !soll.offen)) continue;
      if (await angleichen(graph, l, a, plan, soll, z, { titel })) continue;
      a.weg = true;
      continue;
    }
    // Ein neuer Tag: die offene Aufgabe rückt weiter (frisch, ohne Häkchen) –
    // war sie erledigt oder gelöscht, kommt eine neue
    if (a?.id && !a.erledigt && !a.weg && await angleichen(graph, l, a, plan, soll, z, { weiter: true, titel })) continue;
    p.aufgaben[planId] = soll.offen ? await anlegen(graph, p, plan, soll, z) : { id: null, datum: soll.datum, erledigt: true };
  }
  // 3. Putztage, die es nicht mehr gibt oder die jetzt jemand anderes macht
  const ids = new Set(meine.map(([id]) => id));
  for (const [planId, a] of Object.entries(p.aufgaben)) {
    if (ids.has(planId)) continue;
    if (a.id && !a.erledigt && !a.weg) { await graph('DELETE', aufgabePfad(l, a.id)); z.geaendert++; }
    delete p.aufgaben[planId];
  }
}

/** Trennen: offene Aufgaben weg (erledigte bleiben, die Liste auch), den Zugang vergessen. */
async function trennen(n, p, ctx) {
  if (p.token && ctx.app) {
    try {
      const graph = graphFuer(p, n, ctx.app);
      const l = p.liste;
      for (const a of Object.values(p.aufgaben || {})) if (l && a.id && !a.erledigt && !a.weg) await graph('DELETE', aufgabePfad(l, a.id));
    } catch (e) {
      console.log(`To Do: ${n} – beim Trennen nicht alles weggeräumt (${e instanceof Weg ? 'Anmeldung gilt nicht mehr' : e.message}).`);
    }
  }
  return { name: p.name || GROSS(n), status: 'getrennt', wunsch: p.wunsch || null, zuletzt: new Date().toISOString() };
}

async function abgleichenLauf() {
  const stand = listeLesen();
  const h = stand.haushalt;
  const t = todoLesen();
  const ctx = { stand, app: h.todoApp, heute: heuteBerlin(), ops: [] };
  // Wünsche: trennen; abgleichen (passiert ohnehin) nur abhaken
  for (const [n, w] of Object.entries(h.todoWunsch || {})) {
    const p = t.personen[n];
    if (!p || (p.wunsch && p.wunsch >= w.at)) continue;
    if (w.art === 'trennen') {
      t.personen[n] = await trennen(n, p, ctx);
      t.personen[n].wunsch = w.at;
      ctx.ops.push(opTodoAn(n, false));
      console.log(`To Do: ${n} getrennt.`);
    } else if (w.art === 'abgleichen') p.wunsch = w.at;
  }
  // Ging etwas schief: je nach Art merken (die Anmeldung gilt nicht mehr – oder später noch einmal)
  const schief = (n, p, e) => {
    if (e instanceof Weg) {
      t.personen[n] = { name: p.name || GROSS(n), status: 'abgelaufen', wunsch: p.wunsch || null, fehler: 'Die Anmeldung bei Microsoft gilt nicht mehr – noch einmal verbinden.', zuletzt: new Date().toISOString() };
      ctx.ops.push(opTodoAn(n, false));
      console.log(`To Do: ${n} – Anmeldung gilt nicht mehr (${e.message}).`);
    } else if (e instanceof Spaeter) {
      p.fehler = 'Microsoft war gerade nicht erreichbar – der nächste Abgleich holt es nach.';
      console.log(`To Do: ${n} – später (${e.message}).`);
    } else {
      p.fehler = 'Beim Abgleich ging etwas schief – der nächste versucht es wieder.';
      console.log(`To Do: ${n} – Fehler (${e?.name || 'unbekannt'}).`);
    }
  };
  const dabei = [];
  for (const [n, p] of Object.entries(t.personen)) {
    if (p.status !== 'verbunden' || !p.token) continue;
    if (!ctx.app) { p.fehler = 'Die App-ID fehlt in den Einstellungen.'; continue; }
    // Wer verbunden ist, steht auch in liste.json (die App zeigt es und schickt „· To Do“)
    if (!h.todoAn?.[n]) ctx.ops.push(opTodoAn(n, true));
    const z = { neu: 0, geaendert: 0, geholt: 0 };
    try {
      const g = await lesen(n, p, ctx, z);
      if (g) dabei.push({ n, p, z, g });
      else {
        p.zuletzt = new Date().toISOString();
        console.log(`To Do: ${n} – ${p.listen.length} Listen gelesen, wartet auf die Wahl der Liste.`);
      }
    } catch (e) {
      schief(n, p, e);
    }
  }
  for (const { n, p, z, g } of dabei) {
    try {
      await schreiben(n, p, ctx, z, g);
      p.zuletzt = new Date().toISOString();
      p.fehler = null;
      console.log(`To Do: ${n} – ${z.geholt} aus To Do übernommen, ${z.neu} neu, ${z.geaendert} angeglichen.`);
    } catch (e) {
      schief(n, p, e);
    }
  }
  for (const p of Object.values(t.personen)) for (const a of Object.values(p.aufgaben || {})) delete a.dort;
  todoSchreiben(t);
  opsDazu(ctx.ops);
}

/* ------------------------------------------------------------ Nachtragen */

/** Auf den neuesten Stand legen: todo.json aus diesem Lauf, die Änderungen aus To Do auf liste.json. */
function nachtragen() {
  const neu = lies(DATEI.todo, null);
  const ziel = path.join(DATEN, 'todo.json');
  // Solange niemand To Do will, braucht es keine Datei
  const leer = !neu || !Object.keys(neu.personen || {}).length;
  if (neu && !(leer && !existsSync(ziel)) && JSON.stringify(neu) !== JSON.stringify(lies(ziel, null))) schreib(ziel, neu);
  const ops = lies(DATEI.ops, []);
  const listeDatei = path.join(DATEN, 'liste.json');
  if (!ops.length || !existsSync(listeDatei)) return;
  const roh = lies(listeDatei, null);
  if (!roh) return;
  const vorher = bereinigen(roh);
  let s = vorher;
  for (const op of ops) s = anwenden(s, op);
  const ohneRev = (x) => JSON.stringify({ ...x, rev: 0 });
  if (ohneRev(s) === ohneRev(vorher)) return;
  s.rev = (Number(roh.rev) || 0) + 1;
  writeFileSync(listeDatei, `${JSON.stringify(s, null, 1)}\n`);
}

if (hat('--anmelden')) await anmeldenLauf();
if (hat('--warten')) await wartenLauf();
if (hat('--abgleichen')) await abgleichenLauf();
if (hat('--nachtragen')) nachtragen();
