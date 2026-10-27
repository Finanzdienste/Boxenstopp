/*
 * Der Zugang zur gemeinsamen Liste: Schlüssel und Name, nur auf diesem Handy.
 *
 * Der Schlüssel ist ein Fine-grained Token von GitHub, der nur das private
 * Repo Boxenstopp-Daten lesen und schreiben darf (Anleitung im README). Er
 * steht nirgends im Code und nicht im Repo, nur im localStorage dieses
 * Handys.
 *
 * Aufs zweite Handy kommt er über einen Link: …/Boxenstopp/#zugang=<Schlüssel>.
 * Der Teil hinter # geht nicht an den Server; die App liest ihn beim Start,
 * nimmt ihn sofort aus der Adresse und fragt nur noch nach dem Namen. Das
 * Schlüsselfeld nimmt auch den ganzen Link – fürs iPhone, wo die App auf dem
 * Home-Bildschirm einen eigenen Speicher hat und den Link selbst nicht sieht.
 */
const SPEICHER = 'boxenstopp.zugang.v1';

export function ladeZugang() {
  try {
    const z = JSON.parse(localStorage.getItem(SPEICHER) || 'null');
    if (z && typeof z.token === 'string' && z.token) return { token: z.token, name: typeof z.name === 'string' ? z.name : '' };
  } catch { /* kein Zugang */ }
  return null;
}

export function speichereZugang(z) {
  try { localStorage.setItem(SPEICHER, JSON.stringify({ token: z.token, name: z.name || '' })); return true; } catch { return false; }
}

export function loescheZugang() {
  try { localStorage.removeItem(SPEICHER); } catch { /* egal */ }
}

/** Schlüssel aus einem eingefügten Text: der Schlüssel selbst oder ein Einladungslink. */
export function schluesselAus(text) {
  const t = String(text || '').trim();
  const m = /[#&]zugang=([^&\s]+)/.exec(t);
  let roh = t;
  if (m) { try { roh = decodeURIComponent(m[1]); } catch { roh = ''; } }
  return /^[A-Za-z0-9_]{20,255}$/.test(roh) ? roh : '';
}

/** Steht ein Schlüssel in der Adresse? Dann herausnehmen und zurückgeben. */
export function schluesselAusAdresse() {
  if (!/[#&](?:zugang|ki)=/.test(location.hash)) return '';
  const s = /[#&]zugang=/.test(location.hash) ? schluesselAus(location.hash) : '';
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ }
  return s;
}

/*
 * Der Schlüssel für die Resteverwertung: ein API-Schlüssel von Google
 * (AIza…, kostenlos) oder von Anthropic (sk-ant-…), ebenfalls nur hier im
 * localStorage. Er reist im selben Link mit: …/#zugang=<GitHub>&ki=<KI> –
 * oder allein als …/#ki=<KI>. Welcher Anbieter es ist, sieht ki.js am Anfang.
 */
const KI = 'boxenstopp.ki.v1';
const KI_MUSTER = /^(?:sk-ant-[A-Za-z0-9_-]{20,250}|AIza[A-Za-z0-9_-]{30,80})$/;

export function ladeKi() {
  try {
    const k = JSON.parse(localStorage.getItem(KI) || 'null');
    return k && typeof k.schluessel === 'string' && KI_MUSTER.test(k.schluessel) ? k.schluessel : '';
  } catch { return ''; }
}
export function speichereKi(schluessel) {
  try { localStorage.setItem(KI, JSON.stringify({ schluessel })); return true; } catch { return false; }
}
export function loescheKi() {
  try { localStorage.removeItem(KI); } catch { /* egal */ }
}

/** KI-Schlüssel aus einem eingefügten Text: der Schlüssel selbst oder ein Link mit ki=. */
export function kiAus(text) {
  const t = String(text || '').trim();
  const m = /[#&]ki=([^&\s]+)/.exec(t);
  let roh = t;
  if (m) { try { roh = decodeURIComponent(m[1]); } catch { roh = ''; } }
  return KI_MUSTER.test(roh) ? roh : '';
}

/** Steht ein KI-Schlüssel in der Adresse? Zurückgeben – herausgenommen wird er mit schluesselAusAdresse(). */
export const kiAusAdresse = () => kiAus(location.hash);

export function einladungsLink(token, ki = '') {
  const teile = [];
  if (token) teile.push(`zugang=${encodeURIComponent(token)}`);
  if (ki) teile.push(`ki=${encodeURIComponent(ki)}`);
  return `${location.origin}${location.pathname.replace(/index\.html$/, '')}#${teile.join('&')}`;
}
