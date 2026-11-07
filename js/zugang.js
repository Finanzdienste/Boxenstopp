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
 *
 * Eine eigene Liste (ein Gast wie Marielle, ansicht-gaeste.js) liegt in einem
 * eigenen privaten Repo; der Link sagt dann, welches, und für wen er ist:
 * …#zugang=<Schlüssel>&daten=Finanzdienste/Boxenstopp-Marielle&fuer=Marielle&farbe=lila
 * Der Schlüssel darf nur dieses Repo – an Tobis und Amys Liste kommt er nicht.
 */
import { DATEN } from './speicher.js';

const SPEICHER = 'boxenstopp.zugang.v1';
const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const NAME = /^[\p{L}\p{N} ._-]{1,30}$/u;
const FARBE = /^(?:lila|blau)$/;
/** Die Liste von Tobi und Amy – „owner/repo“. */
export const HAUPTLISTE = `${DATEN.owner}/${DATEN.repo}`;

export function ladeZugang() {
  try {
    const z = JSON.parse(localStorage.getItem(SPEICHER) || 'null');
    if (z && typeof z.token === 'string' && z.token) {
      const daten = typeof z.daten === 'string' && REPO.test(z.daten) && z.daten !== HAUPTLISTE ? z.daten : '';
      return { token: z.token, name: typeof z.name === 'string' ? z.name : '', ...(daten ? { daten } : {}) };
    }
  } catch { /* kein Zugang */ }
  return null;
}

export function speichereZugang(z) {
  const daten = typeof z.daten === 'string' && REPO.test(z.daten) && z.daten !== HAUPTLISTE ? z.daten : '';
  try { localStorage.setItem(SPEICHER, JSON.stringify({ token: z.token, name: z.name || '', ...(daten ? { daten } : {}) })); return true; } catch { return false; }
}

/** Wo die Liste liegt: { owner, repo, pfad } – die eigene eines Gasts oder die von Tobi und Amy. */
export function ortVon(z) {
  if (z?.daten && REPO.test(z.daten) && z.daten !== HAUPTLISTE) {
    const [owner, repo] = z.daten.split('/');
    return { owner, repo, pfad: DATEN.pfad };
  }
  return DATEN;
}
/** Eine eigene Liste (Gast), nicht die von Tobi und Amy? */
export const eigeneListe = (z) => ortVon(z) !== DATEN;

/** Was ein Link (oder eingefügter Text) außer den Schlüsseln mitbringt: { daten, fuer, farbe }. */
export function linkExtras(text) {
  const t = String(text || '');
  const wert = (k) => {
    const m = new RegExp(`[#&]${k}=([^&\\s]+)`).exec(t);
    if (!m) return '';
    try { return decodeURIComponent(m[1]).trim(); } catch { return ''; }
  };
  const daten = wert('daten');
  const fuer = wert('fuer');
  const farbe = wert('farbe');
  return {
    daten: REPO.test(daten) ? daten : '',
    fuer: NAME.test(fuer) ? fuer : '',
    farbe: FARBE.test(farbe) ? farbe : '',
  };
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

/**
 * Steht ein Schlüssel in der Adresse? Dann herausnehmen und zurückgeben –
 * mit dem, was der Link sonst mitbringt (linkExtras): { token, daten, fuer, farbe }.
 */
export function linkAusAdresse() {
  const leer = { token: '', daten: '', fuer: '', farbe: '' };
  if (!/[#&](?:zugang|ki)=/.test(location.hash)) return leer;
  const token = /[#&]zugang=/.test(location.hash) ? schluesselAus(location.hash) : '';
  const extras = linkExtras(location.hash);
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* egal */ }
  return { token, ...extras };
}
/** Nur der Schlüssel aus der Adresse (wie linkAusAdresse). */
export const schluesselAusAdresse = () => linkAusAdresse().token;

/*
 * Der Schlüssel für die Resteverwertung: ein API-Schlüssel von Google
 * (AQ.… oder älter AIza…, kostenlos) oder von Anthropic (sk-ant-…), ebenfalls nur hier im
 * localStorage. Er reist im selben Link mit: …/#zugang=<GitHub>&ki=<KI> –
 * oder allein als …/#ki=<KI>. Welcher Anbieter es ist, sieht ki.js am Anfang.
 *
 * Für alle Handys einer Liste: Wer will, gibt seinen Schlüssel in den
 * Einstellungen frei – er liegt dann als ki.json im Daten-Repo der Liste
 * ({ schluessel, von, stand }, speicher.js privatSchreiben), und jedes Handy
 * mit dem Zugang holt ihn beim Start (app.js) und übernimmt ihn, wenn es
 * keinen eigenen, neueren hat (kiUebernehmen). Dazu merkt sich der Eintrag
 * hier, wann er kam und ob er geteilt war: { schluessel, stand, geteilt }.
 */
const KI = 'boxenstopp.ki.v1';
const KI_MUSTER = /^(?:sk-ant-[A-Za-z0-9_-]{20,250}|AQ\.[A-Za-z0-9_.-]{20,200}|AIza[A-Za-z0-9_-]{30,80})$/;
/** Die Datei mit dem geteilten Schlüssel im Daten-Repo. */
export const KI_DATEI = 'ki.json';

/** Der Eintrag auf diesem Handy: { schluessel, stand, geteilt } – oder null. */
export function ladeKiEintrag() {
  try {
    const k = JSON.parse(localStorage.getItem(KI) || 'null');
    if (!(k && typeof k.schluessel === 'string' && KI_MUSTER.test(k.schluessel))) return null;
    return { schluessel: k.schluessel, stand: typeof k.stand === 'string' ? k.stand : '', geteilt: k.geteilt === true };
  } catch { return null; }
}
export const ladeKi = () => ladeKiEintrag()?.schluessel || '';
/** Speichern – selbst eingetragen (stand: jetzt) oder aus ki.json übernommen (geteilt: true, stand der Datei). */
export function speichereKi(schluessel, { stand = new Date().toISOString(), geteilt = false } = {}) {
  try { localStorage.setItem(KI, JSON.stringify({ schluessel, stand, ...(geteilt ? { geteilt: true } : {}) })); return true; } catch { return false; }
}

/*
 * Ob ein Handy den geteilten Schlüssel (ki.json) nimmt: ja, wenn es keinen
 * hat, wenn seiner selbst aus ki.json kam oder wenn er älter ist als der
 * geteilte (ein Eintrag ohne stand ist alt). Ein selbst eingetragener,
 * neuerer bleibt. Gibt den neuen Eintrag zurück – oder null, wenn alles
 * bleibt (auch bei einer leeren ki.json: Teilen beendet, die Handys behalten,
 * was sie haben).
 */
export function kiUebernehmen(eigen, geteilt) {
  const s = kiAus(geteilt?.schluessel);
  if (!s) return null;
  const stand = typeof geteilt.stand === 'string' ? geteilt.stand : '';
  if (eigen?.schluessel === s) return eigen.geteilt && eigen.stand === stand ? null : { schluessel: s, stand, geteilt: true };
  if (eigen?.schluessel && !eigen.geteilt && eigen.stand && eigen.stand >= stand) return null;
  return { schluessel: s, stand, geteilt: true };
}
/** ki.json übernehmen, wenn kiUebernehmen das sagt; true, wenn der Schlüssel auf diesem Handy jetzt ein anderer ist. */
export function geteiltenKiUebernehmen(geteilt) {
  const eigen = ladeKiEintrag();
  const neu = kiUebernehmen(eigen, geteilt);
  if (!neu) return false;
  speichereKi(neu.schluessel, { stand: neu.stand, geteilt: true });
  return neu.schluessel !== eigen?.schluessel;
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

/**
 * Der Link zum Teilen: Schlüssel, KI-Schlüssel und bei einer eigenen Liste,
 * wo sie liegt (daten); fuer und farbe nur in der Einladung eines Gasts.
 */
export function einladungsLink(token, ki = '', { daten = '', fuer = '', farbe = '' } = {}) {
  const teile = [];
  if (token) teile.push(`zugang=${encodeURIComponent(token)}`);
  if (daten && REPO.test(daten) && daten !== HAUPTLISTE) teile.push(`daten=${encodeURIComponent(daten)}`);
  if (fuer && NAME.test(fuer)) teile.push(`fuer=${encodeURIComponent(fuer)}`);
  if (farbe && FARBE.test(farbe) && farbe !== 'blau') teile.push(`farbe=${encodeURIComponent(farbe)}`);
  if (ki) teile.push(`ki=${encodeURIComponent(ki)}`);
  return `${location.origin}${location.pathname.replace(/index\.html$/, '')}#${teile.join('&')}`;
}
