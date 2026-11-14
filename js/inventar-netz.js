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
 * sich die Quelle (quelle) und zeigt sie mit Link an. Mitgenommen wird, was
 * da ist: Name, Marke, Bild, Kategorie und Siegel (als Tags), Menge,
 * Haltbarkeit nach dem Öffnen und Inhaltsstoffe (in die Notiz).
 *
 * Kennt keine die Nummer, sucht – nur mit einem Schlüssel von Anthropic, die
 * Internetsuche läuft nur über Claude – Claude im Internet und liest die
 * Produktseite (rumpfNachschlagen): Name, Marke, Farbe, Größe, Material,
 * Preis, eine kurze Beschreibung. Ein Treffer zählt nur, wenn seine Seite
 * (oder wenigstens die Website) in den Such- oder Leseergebnissen stand
 * (gesuchtBereinigen). Ein Bild gibt es dabei nicht: Bilder von Shops kann
 * der Browser nicht holen (CORS), und Claude bekommt die Seiten nur als Text.
 */
import { ANBIETER } from './ki.js';
import { WEBSUCHE, SEITE_LESEN, sichereUrl, urlSchluessel } from './amy-import.js';
import { tagsBereinigen } from './amy.js';
import { codeBereinigen, quelleBereinigen, MAX_NAME, MAX_MARKE, MAX_NOTIZ } from './inventar.js';

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
const FELDER = ['code', 'product_name', 'product_name_de', 'generic_name', 'generic_name_de', 'brands', 'image_front_url', 'product_type', 'quantity', 'periods_after_opening', 'periods_after_opening_tags', 'labels_tags', 'categories_tags', 'ingredients_text', 'ingredients_text_de'];
const INHALT = 700; // so viel von den Inhaltsstoffen kommt in die Notiz

/** Siegel der Datenbanken → Tags. */
const SIEGEL = {
  'en:vegan': 'vegan', 'en:the-vegan-society': 'vegan', 'en:vegetarian': 'vegetarisch',
  'en:cruelty-free': 'tierversuchsfrei', 'en:not-tested-on-animals': 'tierversuchsfrei', 'en:leaping-bunny': 'tierversuchsfrei', 'en:peta-cruelty-free': 'tierversuchsfrei',
  'en:organic': 'bio', 'en:eu-organic': 'bio', 'en:natural-cosmetics': 'Naturkosmetik', 'en:natrue': 'Naturkosmetik', 'en:bdih': 'Naturkosmetik',
  'en:cosmos-natural': 'Naturkosmetik', 'en:cosmos-organic': 'Naturkosmetik', 'en:ecocert': 'Naturkosmetik', 'en:fair-trade': 'fair',
  'en:palm-oil-free': 'ohne Palmöl', 'en:silicone-free': 'ohne Silikone', 'en:paraben-free': 'ohne Parabene', 'en:no-parabens': 'ohne Parabene', 'en:microplastic-free': 'ohne Mikroplastik',
};
/** Häufige Kategorien auf Englisch → deutsch (die deutschen, de:…, nimmt die App so). */
const KATEGORIEN = {
  'en:lipsticks': 'Lippenstift', 'en:lip-glosses': 'Lipgloss', 'en:lip-balms': 'Lippenpflege', 'en:mascaras': 'Mascara', 'en:eyeliners': 'Eyeliner',
  'en:eyeshadows': 'Lidschatten', 'en:eye-shadows': 'Lidschatten', 'en:foundations': 'Foundation', 'en:concealers': 'Concealer', 'en:powders': 'Puder',
  'en:blushes': 'Rouge', 'en:nail-polishes': 'Nagellack', 'en:perfumes': 'Parfüm', 'en:eaux-de-toilette': 'Eau de Toilette', 'en:eaux-de-parfum': 'Eau de Parfum',
  'en:shampoos': 'Shampoo', 'en:conditioners': 'Spülung', 'en:hair-masks': 'Haarkur', 'en:hair-sprays': 'Haarspray', 'en:shower-gels': 'Duschgel',
  'en:soaps': 'Seife', 'en:deodorants': 'Deo', 'en:antiperspirants': 'Deo', 'en:body-lotions': 'Bodylotion', 'en:body-creams': 'Körpercreme',
  'en:hand-creams': 'Handcreme', 'en:face-creams': 'Gesichtscreme', 'en:day-creams': 'Tagescreme', 'en:night-creams': 'Nachtcreme', 'en:serums': 'Serum',
  'en:face-cleansers': 'Reinigung', 'en:micellar-waters': 'Mizellenwasser', 'en:sunscreens': 'Sonnenschutz', 'en:after-sun': 'After Sun',
  'en:toothpastes': 'Zahnpasta', 'en:mouthwashes': 'Mundspülung', 'en:shaving-foams': 'Rasierschaum', 'en:razors': 'Rasierer',
};
/** Zu allgemein für einen Tag. */
const ZU_ALLGEMEIN = /^de:(?:drogerie|kosmetik|pflege|beauty|non-food|produkt|sonstig)/;
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
const hostVon = (url) => { try { return new URL(url).hostname.replace(/^(?:www|m)\./, '').toLowerCase(); } catch { return ''; } };
const liste = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/** Die Kategorie als Tag: die genaueste deutsche (de:…), sonst eine bekannte englische. */
function kategorieVon(tags) {
  const de = tags.filter((t) => /^de:[\p{L}0-9-]{3,}$/u.test(t) && !ZU_ALLGEMEIN.test(t)).at(-1);
  if (de) return vornGross(de.slice(3).replace(/-/g, ' '));
  return tags.map((t) => KATEGORIEN[t.toLowerCase()]).filter(Boolean).at(-1) || '';
}

/** Wie lange es nach dem Öffnen hält („12 months“, en:12-months) – in Monaten, sonst 0. */
function monateVon(p) {
  const t = [String(p.periods_after_opening || ''), ...liste(p.periods_after_opening_tags)].join(' ');
  const m = t.match(/(\d{1,2})\s*-?\s*(?:months?|m\b|monate?)/i);
  return m ? Number(m[1]) : 0;
}

/** Was in die Notiz kommt: Menge, Haltbarkeit nach dem Öffnen, Inhaltsstoffe – Zeile für Zeile. */
function notizVon(p) {
  const zeilen = [];
  const menge = zeile(p.quantity, 60);
  if (menge) zeilen.push(`Menge: ${menge}`);
  const monate = monateVon(p);
  if (monate) zeilen.push(`Nach dem Öffnen ${monate} ${monate === 1 ? 'Monat' : 'Monate'} haltbar`);
  const inhalt = zeile(p.ingredients_text_de, 4000) || zeile(p.ingredients_text, 4000);
  if (inhalt) zeilen.push(`Inhaltsstoffe: ${inhalt.length > INHALT ? `${inhalt.slice(0, INHALT).replace(/[\s,;]+\S*$/, '')} …` : inhalt}`);
  return zeilen.join('\n').slice(0, MAX_NOTIZ);
}

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
 * Die Antwort einer Datenbank als Treffer: { name, marke, liste: '', tags,
 * notiz, bild, klein, quelle } – tags Kategorie und Siegel, notiz Menge,
 * Haltbarkeit und Inhaltsstoffe, bild in voller Größe, klein mit 400 px
 * (beide '' ohne Bild). null, wenn nichts Brauchbares darin steht.
 */
export function produktAus(json, code, art = ZUERST) {
  const p = json && json.status === 'success' ? json.product : null;
  if (!p || typeof p !== 'object') return null;
  const name = vornGross(zeile(p.product_name_de, MAX_NAME) || zeile(p.product_name, MAX_NAME) || zeile(p.generic_name_de, MAX_NAME) || zeile(p.generic_name, MAX_NAME));
  const marke = markeVon(p.brands);
  if (!name && !marke) return null;
  const typ = DATENBANKEN[p.product_type] ? p.product_type : art;
  const siegel = liste(p.labels_tags).map((t) => SIEGEL[t.toLowerCase()]).filter(Boolean);
  return {
    name,
    marke,
    liste: '',
    tags: tagsBereinigen([kategorieVon(liste(p.categories_tags)), ...siegel].filter(Boolean)).slice(0, 4),
    notiz: notizVon(p),
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

/** Die Websuche für den Strichcode (höchstens fünf Suchen) und das Lesen der Produktseite (höchstens drei). */
export const SUCHE_STRICHCODE = { ...WEBSUCHE, max_uses: 5 };
export const LESEN_STRICHCODE = { ...SEITE_LESEN(3), max_content_tokens: 12000 };

export function nachschlagenSystem({ listen = [] } = {}) {
  const namen = listen.filter(Boolean).slice(0, 30);
  return `Du schlägst für eine App mit eigenen Listen (Kleidung, Make-up, Schmuck und so weiter) nach, welches Produkt zu einer Nummer unter einem Strichcode gehört (EAN, GTIN oder UPC). Such mit der Websuche nach genau dieser Nummer – auf Shopseiten, bei Herstellern oder in Verzeichnissen für Strichcodes – und lies die beste Produktseite mit dem Werkzeug zum Lesen von Seiten, damit du möglichst viel über das Produkt weißt.

Ein Treffer zählt nur, wenn auf einer Seite genau diese Nummer zu dem Produkt steht. Nichts raten, nichts aus ähnlichen Nummern schließen: Findest du sie nicht, ist gefunden false.

So soll die Antwort aussehen – je mehr davon, desto besser, aber nur, was wirklich dasteht:
- name: was es ist, kurz und auf Deutsch, wie man es selbst nennen würde – mit Farbe oder Sorte, wenn sie dasteht: „Lippenstift Ruby Woo“, „Weiße Sneaker Air Force 1“.
- marke: die Marke.
- liste: ${namen.length ? `welche dieser Listen passt – genau so geschrieben: ${namen.join(', ')}. Passt keine, leer.` : 'leer.'}
- tags: bis zu vier kurze Tags, etwa Art, Farbe, Stoff oder Anlass.
- details: kurze Angaben als „Feld: Wert“, etwa „Farbe: Schwarz“, „Größe: M“, „Material: 100 % Baumwolle“, „Inhalt: 50 ml“, „Nuance: 102“, „Passform: Regular Fit“ – höchstens acht.
- preis: der Preis auf der Seite mit Währung, etwa „29,99 €“ – sonst leer.
- beschreibung: ein, zwei Sätze, was es ist, auf Deutsch – sonst leer.
- url: die Adresse der Seite, auf der die Nummer steht – genau so, wie sie in den Such- oder Leseergebnissen stand.
- seite: die Seite, kurz, etwa „douglas.de“.

Antworte zum Schluss nur mit diesem JSON, ohne Text davor oder danach:
{"gefunden": true, "name": "", "marke": "", "liste": "", "tags": [], "details": [], "preis": "", "beschreibung": "", "url": "", "seite": ""}
Alles auf Deutsch.`;
}

/** Die Anfrage an Claude (kiMitWerkzeugen, ohne Berater): nur die Nummer und die Namen der Listen. */
export function rumpfNachschlagen({ code, listen = [] }) {
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 8000,
    system: nachschlagenSystem({ listen }),
    tools: [SUCHE_STRICHCODE, LESEN_STRICHCODE],
    messages: [{ role: 'user', content: [{ type: 'text', text: `Die Nummer unter dem Strichcode: ${codeBereinigen(code)}` }] }],
  };
}

const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

/**
 * Was Claude gefunden hat, als Treffer wie bei produktAus (ohne Bild; in der
 * Notiz die Angaben, der Preis mit Seite und Monat, die Beschreibung) – oder
 * null: nichts gefunden, oder weder die Seite noch ihre Website kam in einem
 * Such- oder Leseergebnis vor (quellen aus kiMitWerkzeugen) – das wäre
 * ausgedacht. listen: [{ id, name }]; heute für den Monat beim Preis.
 */
export function gesuchtBereinigen(roh, { quellen = [], listen = [], heute = new Date() } = {}) {
  const r = roh && typeof roh === 'object' ? roh : {};
  if (r.gefunden === false) return null;
  const url = sichereUrl(r.url);
  const qs = (Array.isArray(quellen) ? quellen : []).map((q) => sichereUrl(q?.url)).filter(Boolean);
  if (!url || !(qs.some((q) => urlSchluessel(q) === urlSchluessel(url)) || qs.some((q) => hostVon(q) === hostVon(url)))) return null;
  const name = zeile(r.name, MAX_NAME);
  const marke = zeile(r.marke, MAX_MARKE);
  if (!name && !marke) return null;
  const wunsch = zeile(r.liste, 80).toLocaleLowerCase('de');
  const listeId = wunsch ? (listen.find((l) => String(l.name || '').trim().toLocaleLowerCase('de') === wunsch)?.id || '') : '';
  const seite = zeile(r.seite, 40) || seiteVon(url);
  const details = liste(r.details).map((d) => zeile(d, 80)).filter((d) => /^[^:]{2,30}:\s*\S/.test(d)).slice(0, 8);
  const preis = zeile(r.preis, 30);
  const zeilen = [details.join(' · '), preis ? `Preis: ${preis} bei ${seite} (${MONATE[heute.getMonth()]} ${heute.getFullYear()})` : '', zeile(r.beschreibung, 400)].filter(Boolean);
  return {
    name,
    marke,
    liste: listeId,
    tags: tagsBereinigen(liste(r.tags).slice(0, 4)),
    notiz: zeilen.join('\n').slice(0, MAX_NOTIZ),
    bild: '',
    klein: '',
    quelle: quelleBereinigen({ name: seite, url }),
  };
}
