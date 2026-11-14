/*
 * Sachen nachschlagen: Zur Nummer unter dem Strichcode holt die App Name,
 * Marke und Bild aus dem Netz – so legt ein Scan die Sache gleich an. Ohne
 * DOM; tests/test-inventar.mjs prüft es (mit nachgebautem Netz).
 *
 * Zuerst die offenen Datenbanken von Open Food Facts (DATENBANKEN): Open
 * Beauty Facts – Kosmetik, Make-up, Pflege, bei den Sachen das Meiste –, Open
 * Food Facts, Open Products Facts und Open Pet Food Facts. Frei, ohne
 * Schlüssel, mit CORS: Das Handy fragt selbst, eine Nummer auf einmal und
 * nur, wenn jemand scannt. So sieht Open Food Facts das für Apps vor (die
 * Grenze von 15 Abfragen in der Minute gilt dann je Nutzer); robots.txt
 * sperrt /api für Crawler, und ein Crawler ist die App nicht. Sie nennt sich
 * im Kopf X-User-Agent (KENNUNG) – den echten User-Agent darf ein Browser
 * nicht setzen. Eine Nummer steht nur in einer der Datenbanken; fragt man
 * eine andere, sagt sie, in welcher (product_found_with_a_different_
 * product_type). Daten unter ODbL, Bilder unter CC BY-SA: Die Sache merkt
 * sich die Quelle (quelle) und zeigt sie mit Link an.
 *
 * Kennt keine die Nummer, sucht – nur mit einem Schlüssel von Anthropic, die
 * Internetsuche läuft nur über Claude – Claude im Internet
 * (rumpfNachschlagen). Ein Treffer zählt nur, wenn seine Seite in den
 * Suchergebnissen stand (gesuchtBereinigen). Ein Bild gibt es dabei nicht:
 * Bilder von Shops kann der Browser nicht holen (CORS), und sie gehören den
 * Shops.
 */
import { ANBIETER } from './ki.js';
import { WEBSUCHE, sichereUrl, urlSchluessel } from './amy-import.js';
import { tagsBereinigen } from './amy.js';
import { codeBereinigen, quelleBereinigen, MAX_NAME, MAX_MARKE } from './inventar.js';

export const DATENBANKEN = {
  beauty: { name: 'Open Beauty Facts', web: 'https://world.openbeautyfacts.org' },
  food: { name: 'Open Food Facts', web: 'https://world.openfoodfacts.org' },
  product: { name: 'Open Products Facts', web: 'https://world.openproductsfacts.org' },
  petfood: { name: 'Open Pet Food Facts', web: 'https://world.openpetfoodfacts.org' },
};
/** Wo die App zuerst fragt – bei den Sachen ist es meist Kosmetik. */
export const ZUERST = 'beauty';
/** So nennt sich die App den Datenbanken (Open Food Facts bittet darum). */
export const KENNUNG = 'Boxenstopp (https://github.com/Finanzdienste/Boxenstopp)';
const FELDER = ['code', 'product_name', 'product_name_de', 'brands', 'image_front_url', 'product_type'];
const BILD_HOST = /^images\.open(?:beauty|food|products|petfood)facts\.org$/;
const WARTEN = 9000;

const zeile = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const klein = (s) => s === s.toLocaleLowerCase('de');
/** Ganz klein geschrieben („lippenstift rot“)? Dann vorn groß. */
const vornGross = (s) => (s && klein(s) ? s.charAt(0).toLocaleUpperCase('de') + s.slice(1) : s);
/** Marken stehen oft klein und mit Komma da („nivea,beiersdorf“): die erste, ganz klein geschrieben dann jedes Wort vorn groß. */
function markeVon(s) {
  const m = zeile(String(s || '').split(',')[0], MAX_MARKE);
  return m && klein(m) ? m.replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('de')) : m;
}
const seiteVon = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Die Adresse der Schnittstelle (API v3) für eine Nummer in einer der Datenbanken. */
export const nachschlagenAdresse = (code, art = ZUERST) => `${DATENBANKEN[art].web}/api/v3/product/${encodeURIComponent(codeBereinigen(code))}?fields=${FELDER.join(',')}&lc=de`;
/** Die Seite des Produkts zum Anschauen (die Quelle in der Sache). */
export const produktSeite = (code, art = ZUERST) => `${DATENBANKEN[art].web}/product/${encodeURIComponent(codeBereinigen(code))}`;

/**
 * Das Bild einer Datenbank: in voller Größe (die App verkleinert selbst auf
 * 1200 px) – mit sparen das kleine (400 px). Nur JPEGs von den Bildern der
 * Datenbanken, sonst ''.
 */
export function bildAdresse(url, { sparen = false } = {}) {
  let u;
  try { u = new URL(String(url || '')); } catch { return ''; }
  if (u.protocol !== 'https:' || !BILD_HOST.test(u.hostname) || !/\.jpg$/i.test(u.pathname)) return '';
  if (!sparen) u.pathname = u.pathname.replace(/\.(?:100|200|400)\.jpg$/i, '.full.jpg');
  return u.href;
}

/**
 * Die Antwort einer Datenbank als Treffer: { name, marke, liste: '', tags: [],
 * bild, klein, quelle } – bild in voller Größe, klein mit 400 px (beide ''
 * ohne Bild). null, wenn nichts Brauchbares darin steht.
 */
export function produktAus(json, code, art = ZUERST) {
  const p = json && json.status === 'success' ? json.product : null;
  if (!p || typeof p !== 'object') return null;
  const name = vornGross(zeile(p.product_name_de, MAX_NAME) || zeile(p.product_name, MAX_NAME));
  const marke = markeVon(p.brands);
  if (!name && !marke) return null;
  const typ = DATENBANKEN[p.product_type] ? p.product_type : art;
  return {
    name,
    marke,
    liste: '',
    tags: [],
    bild: bildAdresse(p.image_front_url),
    klein: bildAdresse(p.image_front_url, { sparen: true }),
    quelle: quelleBereinigen({ name: DATENBANKEN[typ].name, url: produktSeite(code, typ) }),
  };
}

/** Steht die Nummer in einer anderen der Datenbanken? Dann in welcher – sonst ''. */
export function andereDatenbank(json) {
  const f = (Array.isArray(json?.errors) ? json.errors : []).find((e) => e?.message?.id === 'product_found_with_a_different_product_type');
  const art = String(f?.field?.value || '');
  return DATENBANKEN[art] ? art : '';
}

const zeitlimit = () => (typeof globalThis.AbortSignal?.timeout === 'function' ? globalThis.AbortSignal.timeout(WARTEN) : undefined);

/**
 * Eine Nummer nachschlagen: erst in Open Beauty Facts – steht sie in einer
 * anderen der Datenbanken, dann dort. Gibt den Treffer zurück (produktAus)
 * oder null, wenn keine sie kennt. Ohne Netz, oder wenn eine nicht richtig
 * antwortet, ein Fehler. holen ist fetch (die Tests geben ihr eigenes).
 */
export async function nachschlagen(code, { holen = (...a) => fetch(...a), signal } = {}) {
  const c = codeBereinigen(code);
  if (!/^\d{8,14}$/.test(c)) return null;
  const frage = async (art) => {
    const res = await holen(nachschlagenAdresse(c, art), { headers: { 'X-User-Agent': KENNUNG }, signal: signal || zeitlimit() });
    // „Nicht gefunden“ kommt als 404 mit JSON
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    return res.json().catch(() => null);
  };
  let art = ZUERST;
  let json = await frage(art);
  const dort = andereDatenbank(json);
  if (dort && dort !== art) {
    art = dort;
    json = await frage(art);
  }
  return produktAus(json, c, art);
}

/* ------------------------------------------- Kennt sie keine: Claude sucht */

/** Die Websuche für den Strichcode: höchstens drei Suchen; Rossmann nicht (die App liest dort nichts). */
export const SUCHE_STRICHCODE = { ...WEBSUCHE, max_uses: 3, blocked_domains: ['rossmann.de'] };

export function nachschlagenSystem({ listen = [] } = {}) {
  const namen = listen.filter(Boolean).slice(0, 30);
  return `Du schlägst für eine App mit eigenen Listen (Kleidung, Make-up, Schmuck und so weiter) nach, welches Produkt zu einer Nummer unter einem Strichcode gehört (EAN, GTIN oder UPC). Such mit der Websuche nach genau dieser Nummer – auf Shopseiten, bei Herstellern oder in Verzeichnissen für Strichcodes.

Ein Treffer zählt nur, wenn auf der Seite genau diese Nummer zu dem Produkt steht. Nichts raten, nichts aus ähnlichen Nummern schließen: Findest du sie nicht, ist gefunden false.

So soll die Antwort aussehen:
- name: was es ist, kurz und auf Deutsch, wie man es selbst nennen würde – mit Farbe oder Sorte, wenn sie dasteht: „Lippenstift Ruby Woo“, „Weiße Sneaker Air Force 1“.
- marke: die Marke.
- liste: ${namen.length ? `welche dieser Listen passt – genau so geschrieben: ${namen.join(', ')}. Passt keine, leer.` : 'leer.'}
- tags: bis zu drei kurze Tags, etwa Farbe, Stoff oder Anlass.
- url: die Adresse der Seite, auf der die Nummer steht – genau so, wie sie in den Suchergebnissen stand.
- seite: die Seite, kurz, etwa „douglas.de“.

Antworte zum Schluss nur mit diesem JSON, ohne Text davor oder danach:
{"gefunden": true, "name": "", "marke": "", "liste": "", "tags": [], "url": "", "seite": ""}
Alles auf Deutsch.`;
}

/** Die Anfrage an Claude (kiMitWerkzeugen, ohne Berater): nur die Nummer und die Namen der Listen. */
export function rumpfNachschlagen({ code, listen = [] }) {
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 6000,
    system: nachschlagenSystem({ listen }),
    tools: [SUCHE_STRICHCODE],
    messages: [{ role: 'user', content: [{ type: 'text', text: `Die Nummer unter dem Strichcode: ${codeBereinigen(code)}` }] }],
  };
}

/**
 * Was Claude gefunden hat, als Treffer wie bei produktAus (ohne Bild) – oder
 * null: nichts gefunden, oder die Seite stand in keinem Suchergebnis (quellen
 * aus kiMitWerkzeugen) und wäre damit ausgedacht. listen: [{ id, name }].
 */
export function gesuchtBereinigen(roh, { quellen = [], listen = [] } = {}) {
  const r = roh && typeof roh === 'object' ? roh : {};
  if (r.gefunden === false) return null;
  const url = sichereUrl(r.url);
  const bekannt = new Set((Array.isArray(quellen) ? quellen : []).map((q) => urlSchluessel(sichereUrl(q?.url))).filter(Boolean));
  if (!url || !bekannt.has(urlSchluessel(url))) return null;
  const name = zeile(r.name, MAX_NAME);
  const marke = zeile(r.marke, MAX_MARKE);
  if (!name && !marke) return null;
  const wunsch = zeile(r.liste, 80).toLocaleLowerCase('de');
  const liste = wunsch ? (listen.find((l) => String(l.name || '').trim().toLocaleLowerCase('de') === wunsch)?.id || '') : '';
  return {
    name,
    marke,
    liste,
    tags: tagsBereinigen(Array.isArray(r.tags) ? r.tags.slice(0, 3) : []),
    bild: '',
    klein: '',
    quelle: quelleBereinigen({ name: zeile(r.seite, 40) || seiteVon(url), url }),
  };
}
