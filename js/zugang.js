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
  const roh = m ? decodeURIComponent(m[1]) : t;
  return /^[A-Za-z0-9_]{20,255}$/.test(roh) ? roh : '';
}

/** Steht ein Schlüssel in der Adresse? Dann herausnehmen und zurückgeben. */
export function schluesselAusAdresse() {
  if (!/[#&]zugang=/.test(location.hash)) return '';
  const s = schluesselAus(location.hash);
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ }
  return s;
}

export const einladungsLink = (token) => `${location.origin}${location.pathname.replace(/index\.html$/, '')}#zugang=${encodeURIComponent(token)}`;
