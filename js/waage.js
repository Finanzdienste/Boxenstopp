/*
 * Die Waage: ein ESP32 mit Wägezelle (werkzeug/waage), der seine Gramm an
 * Supabase Realtime schickt (Broadcast auf einem Kanal). Die App hört dort
 * zu – Safari lässt eine HTTPS-Seite nicht direkt mit einem Gerät im Heimnetz
 * reden, darum der Umweg über die Wolke. Hier steht nur die Verbindung; was
 * die Werte bedeuten, steht in wiegen.js, wie sie im Kochmodus aussehen in
 * kochmodus.js.
 *
 *   Einrichtung   Einstellungen → Waage: Supabase-Adresse, anon-Schlüssel
 *                 und Kanal – in liste.json unter profil.waage, für alle
 *                 Geräte der Liste (opProfil). Dasselbe steht in der Firmware.
 *   Verbinden     nur, solange jemand zuhört (offenes Rezept, Kochmodus, der
 *                 Test in den Einstellungen): waageAnfordern() und
 *                 waageFreigeben() zählen mit; ohne Bedarf ist die Verbindung zu.
 *   Werte         waageBeobachten(fn): fn(waageStand()) bei jedem Wert und
 *                 wenn sich die Verbindung ändert. Die Waage schickt
 *                 { g } (Gramm, kalibriert, ohne Tara); im Leerlauf nur alle
 *                 paar Sekunden – länger als STILL_MS nichts: Waage aus.
 *   Protokoll     das Phoenix-Protokoll von Realtime, von Hand: Kanal
 *                 beitreten (phx_join), Herzschlag alle 25 s, Nachrichten
 *                 mit event „broadcast“. Kein supabase-js – die App hat keine
 *                 Abhängigkeiten.
 *   Attrappe      für die Tests: localStorage __waage = "attrappe" – dann gibt
 *                 es keine Verbindung, sondern window.__waage.senden(g).
 */
import { app, lese } from './kern.js';
import { STILL_MS } from './wiegen.js';

const HERZSCHLAG_MS = 25000;
const WACHE_MS = 5000;

let sock = null;
let bedarf = 0;
let verbunden = false; // dem Kanal beigetreten
let fehler = '';
let zuletzt = { g: null, at: 0 };
let ref = 0;
let joinRef = '';
let herz = null;
let wache = null;
let wieder = null;
let versuche = 0;
let aktiv = null; // { url, key, kanal } der laufenden Verbindung
const beobachter = new Set();

const attrappe = () => lese('__waage', null) === 'attrappe';

/** Die Einrichtung der Liste: { url, key, kanal } oder null. */
export function waageKonfig() {
  const w = app.stand?.profil?.waage;
  if (!w || typeof w !== 'object' || !w.url || !w.key) return null;
  return { url: String(w.url), key: String(w.key), kanal: String(w.kanal || 'waage') };
}

/** Steht die Waage still oder ist sie weg: der letzte Wert ist älter als STILL_MS. */
const da = () => zuletzt.g !== null && Date.now() - zuletzt.at <= STILL_MS;

/** Wie es steht: eingerichtet, verbunden (mit der Wolke), da (die Waage meldet sich), der letzte Wert. */
export function waageStand() {
  return { eingerichtet: !!waageKonfig() || attrappe(), verbunden, da: da(), g: zuletzt.g, at: zuletzt.at, fehler, hoert: bedarf > 0 };
}

function melden() {
  const s = waageStand();
  for (const fn of beobachter) { try { fn(s); } catch { /* ein Beobachter weniger */ } }
}

export function waageBeobachten(fn) {
  beobachter.add(fn);
  return () => beobachter.delete(fn);
}

function empfangen(g, at = Date.now()) {
  const wert = Number(g);
  if (!Number.isFinite(wert)) return;
  zuletzt = { g: wert, at };
  melden();
}

/* ------------------------------------------------------------- Verbindung */

const adresse = (k) => {
  const u = new URL(k.url);
  return `wss://${u.host}/realtime/v1/websocket?apikey=${encodeURIComponent(k.key)}&vsn=1.0.0`;
};

function senden(obj) {
  if (sock?.readyState === 1) sock.send(JSON.stringify(obj));
}

function beitreten(kanal) {
  joinRef = String(++ref);
  senden({ topic: `realtime:${kanal}`, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } }, ref: joinRef, join_ref: joinRef });
}

function oeffnen() {
  const k = waageKonfig();
  if (!k || sock || typeof WebSocket === 'undefined') return;
  let adr;
  try { adr = adresse(k); } catch { fehler = 'Die Supabase-Adresse stimmt nicht.'; melden(); return; }
  aktiv = k;
  fehler = '';
  let s;
  try { s = new WebSocket(adr); } catch { fehler = 'Keine Verbindung zur Waage.'; melden(); wiederVersuchen(); return; }
  sock = s;
  s.onopen = () => { if (sock !== s) return; versuche = 0; beitreten(k.kanal); };
  s.onmessage = (ev) => {
    if (sock !== s) return;
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.event === 'phx_reply' && m.ref === joinRef) {
      verbunden = m.payload?.status === 'ok';
      fehler = verbunden ? '' : 'Supabase lässt den Kanal nicht zu – Schlüssel und Kanal prüfen.';
      melden();
      return;
    }
    if (m.event === 'broadcast' && m.payload?.event === 'g') { empfangen(m.payload.payload?.g); return; }
    if (m.event === 'phx_error' || m.event === 'phx_close') { verbunden = false; fehler = 'Verbindung unterbrochen.'; melden(); s.close(); }
  };
  s.onerror = () => { if (sock === s) fehler = 'Keine Verbindung zur Waage – Adresse und Schlüssel prüfen.'; };
  s.onclose = () => {
    if (sock !== s) return;
    sock = null;
    verbunden = false;
    melden();
    if (bedarf > 0) wiederVersuchen();
  };
  clearInterval(herz);
  herz = setInterval(() => senden({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), HERZSCHLAG_MS);
}

function wiederVersuchen() {
  clearTimeout(wieder);
  const warte = Math.min(30000, 1000 * 2 ** Math.min(5, versuche++));
  wieder = setTimeout(() => { wieder = null; if (bedarf > 0 && !sock) oeffnen(); }, warte);
}

function schliessen() {
  clearTimeout(wieder);
  wieder = null;
  clearInterval(herz);
  herz = null;
  clearInterval(wache);
  wache = null;
  const s = sock;
  sock = null;
  aktiv = null;
  verbunden = false;
  versuche = 0;
  if (s) { try { s.close(); } catch { /* schon zu */ } }
}

/** Jemand will Werte sehen: verbinden (zählt mit). */
export function waageAnfordern() {
  bedarf++;
  if (attrappe()) {
    verbunden = true;
    if (!window.__waage) window.__waage = { senden: (g) => empfangen(g), stand: waageStand };
  } else if (!sock) oeffnen();
  if (!wache) wache = setInterval(() => { if (zuletzt.g !== null && !da()) melden(); }, WACHE_MS);
  melden();
}

/** Nicht mehr gebraucht: Ohne Bedarf geht die Verbindung zu. */
export function waageFreigeben() {
  bedarf = Math.max(0, bedarf - 1);
  if (bedarf === 0) { schliessen(); if (attrappe()) verbunden = false; melden(); }
}

/** Die Einrichtung hat sich geändert (Einstellungen, anderer Stand der Liste): neu verbinden, wenn jemand zuhört. */
export function waageNeu() {
  const k = waageKonfig();
  if (bedarf === 0 || attrappe()) return;
  if (!k) { schliessen(); melden(); return; }
  if (aktiv && aktiv.url === k.url && aktiv.key === k.key && aktiv.kanal === k.kanal) return;
  schliessen();
  oeffnen();
  if (!wache) wache = setInterval(() => { if (zuletzt.g !== null && !da()) melden(); }, WACHE_MS);
}

/** Beim Start: kommt die App zurück, steht die Verbindung oft nicht mehr – dann neu. */
export function waageStart() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || bedarf === 0 || attrappe()) return;
    if (!sock) oeffnen();
    else if (sock.readyState > 1) { schliessen(); oeffnen(); }
  });
}
