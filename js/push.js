/*
 * Push-Nachrichten: „Amy hat 4 Sachen auf die Liste gesetzt“, „Neues Rezept
 * von Amy“, „Tobi hat alles eingekauft“, „Preisalarm: Hähnchenbrust 5,99 €/kg
 * bei Aldi“. Verschickt werden sie nicht vom Handy, sondern von GitHub
 * Actions im privaten Daten-Repo (.github/workflows/benachrichtigen.yml,
 * werkzeug/push.mjs) – dafür meldet sich jedes Gerät hier an:
 *
 *   push.json im Daten-Repo
 *   { schluessel: <öffentlicher VAPID-Schlüssel>,
 *     abos: { tobi: [{ endpoint, keys: { p256dh, auth }, geraet, was: ['liste', 'rezepte', 'preise'], at }] },
 *     zuletzt: { sha }, gemeldet: [...], test: { an, at } }
 *
 * Das Schlüsselpaar entsteht einmal auf einem Gerät (WebCrypto, P-256): Der
 * öffentliche kommt nach push.json, der private nur als Secret
 * VAPID_PRIVATE_KEY ins Daten-Repo – die App zeigt ihn genau einmal zum
 * Kopieren und behält ihn nirgends.
 *
 * Auf iPhone und iPad gehen Push-Nachrichten nur in der App vom
 * Home-Bildschirm (ab iOS 16.4); um Erlaubnis fragen darf sie nur nach einem
 * Tipp – darum fragt sie zuerst und holt dann den Rest.
 */
import { app, lese } from './kern.js';
import { privatLesen, privatSchreiben, API } from './speicher.js';

export const PUSH_DATEI = 'push.json';
export const ARTEN = [['liste', 'Einkaufsliste'], ['rezepte', 'Amys Rezepte'], ['preise', 'Preisalarm']];
const api = () => lese('__api', null) || API;

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function ausB64url(s) {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const wer = () => String(app.name?.() || '').trim().toLowerCase().slice(0, 40);
export const pushMoeglich = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const istApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const vomHomeBildschirm = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
/** Woran man das Gerät in push.json erkennt. */
const geraet = () => (/iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Browser');

/** Ein Versprechen mit Frist – danach ein Fehler mit dem Satz für die Anzeige (frist). */
function mitFrist(p, ms, text = '') {
  let t;
  const frist = new Promise((_, nein) => { t = setTimeout(() => nein(Object.assign(new Error(text || 'Zeit abgelaufen'), { frist: text })), ms); });
  return Promise.race([p, frist]).finally(() => clearTimeout(t));
}

/** Ein neues Schlüsselpaar: { oeffentlich, privat } – beide base64url, wie web-push sie will. */
export async function schluesselErzeugen() {
  const paar = await window.crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const oeffentlich = b64url(await window.crypto.subtle.exportKey('raw', paar.publicKey));
  const jwk = await window.crypto.subtle.exportKey('jwk', paar.privateKey);
  return { oeffentlich, privat: jwk.d };
}

/** push.json lesen (oder null). */
export const pushLesen = () => privatLesen(PUSH_DATEI, { token: app.zugang?.token, api: api() });
/** push.json ändern: aendern(alt) → neu; bei einem Wettlauf noch einmal. */
export const pushAendern = (aendern, nachricht) => privatSchreiben(PUSH_DATEI, aendern, { token: app.zugang?.token, api: api(), nachricht });

/** Der öffentliche Schlüssel nach push.json – nach dem Anlegen der Secrets. */
export function schluesselAblegen(oeffentlich) {
  return pushAendern((alt) => ({ ...(alt || {}), schluessel: oeffentlich, abos: alt?.schluessel === oeffentlich ? alt?.abos || {} : {} }), 'Push: neuer Schlüssel');
}

/** Was dieses Gerät kann, ohne Netz: geht-nicht, home, verboten – oder '' (dann kommt es aufs Abo an). */
export function geraetArt() {
  if (!pushMoeglich()) return istApple() && !vomHomeBildschirm() ? 'home' : 'geht-nicht';
  if (Notification.permission === 'denied') return 'verboten';
  return '';
}

/**
 * Wie es steht: { art, eingerichtet, abo, push }. eingerichtet: Es gibt das
 * Schlüsselpaar (für alle Geräte). art – dieses Gerät: geht-nicht, home,
 * verboten, kein-schluessel, aus, an. push: schon gelesene push.json (sonst
 * wird sie geholt).
 */
export async function pushStand(push) {
  if (!app.zugang) return { art: 'geht-nicht', eingerichtet: false };
  const p = push === undefined ? await pushLesen() : push;
  const eingerichtet = !!p?.schluessel;
  const art = geraetArt();
  if (art) return { art, eingerichtet, push: p };
  if (!eingerichtet) return { art: 'kein-schluessel', eingerichtet, push: p };
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription().catch(() => null);
  const meins = abo && (p.abos?.[wer()] || []).find((x) => x.endpoint === abo.endpoint);
  return { art: meins ? 'an' : 'aus', eingerichtet, abo: meins || null, push: p };
}

/**
 * Einschalten – direkt aus dem Tipp heraus aufrufen (Erlaubnis zuerst).
 * Gibt den neuen Stand zurück oder wirft mit einem Satz für die Anzeige.
 * schluessel: gerade erst abgelegt – GitHub liefert ihn beim Lesen evtl.
 * noch nicht, darum nicht erst nachsehen.
 */
export async function pushEinschalten(was = ['liste', 'rezepte', 'preise'], { schluessel = '' } = {}) {
  if (!pushMoeglich()) throw new Error('Auf diesem Gerät gehen keine Push-Nachrichten.');
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== 'granted') throw new Error('Ohne Erlaubnis geht es nicht – in den Einstellungen des Geräts Mitteilungen für Boxenstopp erlauben.');
  const push = schluessel ? { schluessel } : await pushLesen();
  if (!push?.schluessel) throw new Error('Push ist noch nicht eingerichtet.');
  const reg = await mitFrist(navigator.serviceWorker.ready, 10000, 'Die App ist auf diesem Gerät noch nicht fertig eingerichtet – einmal neu öffnen, dann noch einmal einschalten.');
  let abo = await reg.pushManager.getSubscription();
  // Ein altes Abo mit einem anderen Schlüssel geht nicht mehr
  const passt = abo && b64url(abo.options?.applicationServerKey || new ArrayBuffer(0)) === push.schluessel;
  if (abo && !passt) { await abo.unsubscribe().catch(() => {}); abo = null; }
  if (!abo) {
    try {
      abo = await mitFrist(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ausB64url(push.schluessel) }), 20000);
    } catch (e) {
      throw new Error(e?.frist || 'Das Gerät kommt gerade nicht an seinen Push-Dienst – später noch einmal einschalten.');
    }
  }
  const j = abo.toJSON();
  const eintrag = { endpoint: j.endpoint, keys: { p256dh: j.keys?.p256dh, auth: j.keys?.auth }, geraet: geraet(), was, at: new Date().toISOString() };
  const ich = wer();
  const neu = await pushAendern((alt) => {
    const abos = { ...(alt?.abos || {}) };
    abos[ich] = [...(abos[ich] || []).filter((x) => x.endpoint !== eintrag.endpoint), eintrag].slice(-5);
    return { ...(alt || {}), abos };
  }, `Push: ${app.name() || ich} meldet ${eintrag.geraet} an`);
  // Den Stand aus dem Geschriebenen – frisch gelesen wäre er bei GitHub evtl. noch der alte
  return { art: 'an', eingerichtet: true, abo: eintrag, push: neu };
}

/** Ausschalten: Abo beenden und aus push.json nehmen. */
export async function pushAusschalten() {
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription().catch(() => null);
  const endpoint = abo?.endpoint;
  await abo?.unsubscribe().catch(() => {});
  if (!endpoint) return pushStand();
  const ich = wer();
  const neu = await pushAendern((alt) => {
    const abos = { ...(alt?.abos || {}) };
    abos[ich] = (abos[ich] || []).filter((x) => x.endpoint !== endpoint);
    if (!abos[ich].length) delete abos[ich];
    return { ...(alt || {}), abos };
  }, `Push: ${app.name() || ich} meldet ${geraet()} ab`);
  return { art: 'aus', eingerichtet: !!neu?.schluessel, abo: null, push: neu };
}

/** Was dieses Gerät bekommt (Einkaufsliste, Amys Rezepte, Preisalarm). */
export async function pushWas(was) {
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription().catch(() => null);
  if (!abo) return pushStand();
  const ich = wer();
  const neu = await pushAendern((alt) => {
    const abos = { ...(alt?.abos || {}) };
    abos[ich] = (abos[ich] || []).map((x) => (x.endpoint === abo.endpoint ? { ...x, was } : x));
    return { ...(alt || {}), abos };
  }, `Push: ${app.name() || ich} ändert, was ankommt`);
  const meins = (neu?.abos?.[ich] || []).find((x) => x.endpoint === abo.endpoint);
  return meins ? { art: 'an', eingerichtet: true, abo: meins, push: neu } : pushStand();
}

/** Eine Probe an dieses Gerät (und die anderen derselben Person) – der Lauf im Daten-Repo schickt sie. */
export function pushTest() {
  const ich = wer();
  return pushAendern((alt) => ({ ...(alt || {}), test: { an: ich, at: new Date().toISOString() } }), `Push: Probe an ${app.name() || ich} · Test`);
}
