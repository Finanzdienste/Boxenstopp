#!/usr/bin/env node
/*
 * Holt die Angebote der Woche und schreibt daten/angebote.json – läuft
 * montags, donnerstags und sonntags als GitHub Action (.github/workflows/angebote.yml),
 * zur Not auch von Hand:
 *
 *     node werkzeug/angebote.mjs                # Aldi, Lidl, Kaufland, Penny → daten/angebote.json
 *     node werkzeug/angebote.mjs aldi penny     # nur diese
 *     KAUFDA_STADT=… node werkzeug/angebote.mjs --privat --ziel pfad/angebote-privat.json
 *                                               # Rewe und Edeka über kaufDA → privat
 *
 * Quellen – nur öffentliche Seiten, die ein normaler Abruf ohne Tricks
 * bekommt (eine ehrliche Kennung, zweimal die Woche, robots.txt beachtet):
 *
 *   Aldi      www.aldi-nord.de/angebote.html – die Seite hat alle Artikel der
 *             Woche als JSON eingebettet (Preis, Packung, Grundpreis, gültig
 *             von/bis); angebote-vorschau.html genauso für die nächste Woche
 *             (ab Donnerstag online).
 *   Kaufland  filiale.kaufland.de/angebote/uebersicht.html – Artikelkacheln im
 *             HTML, nach Warengruppen, mit Gültigkeit je Gruppe. Bundesweit.
 *             Mit ?kloffer-week=next die nächste Woche (anfangs nur Vorwerbung).
 *   Penny     www.penny.de/.rest/offers/by-category/<Jahr>-<KW>/<Gruppe> – JSON,
 *             für diese und die nächste Kalenderwoche (die kommt am Wochenende).
 *
 * Zusätzlich zu montags und donnerstags läuft der Abruf sonntags: Dann sind
 * die Angebote der nächsten Woche überall da, und die App zeigt sie unter
 * „Nächste Woche“.
 *   Lidl      Der Aktionsprospekt (lidl.de/l/prospekte) liegt als Seitenbilder
 *             vor, ohne Text. Die Lebensmittel-Seiten (lidlSeitenWahl) liest
 *             Gemini aus, vier je Anfrage – dafür braucht der Lauf den
 *             Schlüssel in GEMINI_KEY (bei GitHub als Secret). Ohne Schlüssel
 *             fällt Lidl aus, der Rest läuft.
 *
 *   Rewe, Edeka  Die eigenen Seiten sperren automatische Abrufe (403
 *             bzw. eine Scherzantwort). Ihre Angebote stehen aber bei kaufDA
 *             (Bonial, der Prospektdienst der Händler) auf öffentlichen
 *             Seiten je Stichwort und Stadt – mit Produkt, Marke, Preis,
 *             Packung und Gültigkeit; die robots.txt erlaubt es (Crawl-Delay
 *             2 s). Je Seite stehen bis zu 16 Angebote, darum fragt der Lauf
 *             gezielt die Stichwörter der Rezeptzutaten ab (KAUFDA_WORTE),
 *             für die Stadt in KAUFDA_STADT.
 *
 *             kaufDA erlaubt die Nutzung nur privat, nicht das Veröffentlichen
 *             (AGB § 3 e). Darum ist das ein eigener Lauf (--privat), und
 *             seine Datei liegt nur im privaten Daten-Repo neben liste.json –
 *             die App liest sie dort mit ihrem Schlüssel. Ins öffentliche
 *             daten/angebote.json kommt nichts davon, die Stadt steht auch
 *             nicht im Code.
 *
 * Was nicht zum Kochen taugt (Getränke, Süßes, Drogerie), fliegt raus, ebenso
 * Schwein und Fisch (ki-rezept.js VERBOTEN). Jedes Angebot bekommt, wenn es
 * eine Rezeptzutat ist, den Katalog-Schlüssel (angebote.js schluesselRaten),
 * damit die App die passenden Rezepte findet.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { angeboteBereinigen, schluesselRaten, mengeAus, istTabu, stabileId, systemTextAngebote, nutzerTextAngebote, ANGEBOTE_SCHEMA } from '../js/angebote.js';
import { ANBIETER, kiFehler, artVonStatus } from '../js/ki.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, '..');
const ARGS = process.argv.slice(2);
const zielBei = ARGS.indexOf('--ziel');
const PRIVAT_LAUF = ARGS.includes('--privat');
const ZIEL = zielBei >= 0 && ARGS[zielBei + 1] ? path.resolve(ARGS[zielBei + 1]) : PRIVAT_LAUF ? path.resolve('angebote-privat.json') : path.join(ROOT, 'daten', 'angebote.json');
const UA = 'Boxenstopp-Angebote/1.0 (+https://github.com/Finanzdienste/Boxenstopp)';
const KATALOG = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8')).katalog;
const GEMINI_KEY = process.env.GEMINI_KEY || '';
const LIDL_MAX = Number(process.env.LIDL_MAX) || 0; // Probelauf: höchstens so viele Lidl-Seiten
const nur = ARGS.filter((s, i) => !s.startsWith('--') && !(zielBei >= 0 && i === zielBei + 1)).map((s) => s.toLowerCase());
const will = (q) => !nur.length || nur.includes(q);

/* ------------------------------------------------------------ Hilfen */

const heute = () => new Date().toISOString().slice(0, 10);
const tag = (d) => d.toISOString().slice(0, 10);
const samstagDieserWoche = (d = new Date()) => wochentag(d, 5);
/** Der n-te Tag dieser Woche (0 = Montag) als JJJJ-MM-TT. */
function wochentag(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7) + n);
  return tag(x);
}
/** ISO-Kalenderwoche als „2026-44“. */
export function kalenderwoche(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wt = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - wt + 3);
  const jahr = x.getUTCFullYear();
  const erster = new Date(Date.UTC(jahr, 0, 4));
  const kw = 1 + Math.round(((x - erster) / 86400000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
  return `${jahr}-${String(kw).padStart(2, '0')}`;
}
/** „26.10.“ oder „26.10.2026“ → JJJJ-MM-TT (Jahr: das nächstliegende). */
function datumAus(t, bezug = new Date()) {
  const m = String(t || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
  if (!m) return '';
  let jahr = m[3] ? Number(m[3]) : bezug.getUTCFullYear();
  const mon = Number(m[2]);
  if (!m[3] && bezug.getUTCMonth() === 11 && mon === 1) jahr += 1;
  if (!m[3] && bezug.getUTCMonth() === 0 && mon === 12) jahr -= 1;
  return `${jahr}-${String(mon).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

async function hole(url, { json = false, bin = false, timeout = 30000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : bin ? 'image/*' : 'text/html,application/json' }, signal: ac.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (json) return res.json();
    if (bin) return Buffer.from(await res.arrayBuffer());
    return res.text();
  } finally { clearTimeout(t); }
}

/** „MEINE METZGEREI“ → „Meine Metzgerei“; was schon gemischt geschrieben ist, bleibt. */
const schoeneMarke = (m) => String(m || '').trim().replace(/\b([A-ZÄÖÜ])([A-ZÄÖÜ'’]{1,})\b/g, (_, a, b) => a + b.toLowerCase());
const entities = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&#39;/g, '\'').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const zahl = (s) => { const m = String(s || '').replace(',', '.').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; };
/** Ein Produktfoto der Händler – nur https, ohne Leerzeichen und Anführungszeichen, nicht ewig lang. */
export const bildUrl = (u) => { const t = String(u || '').trim().replace(/&amp;/g, '&'); return /^https:\/\/[^\s"'<>]{8,480}$/.test(t) ? t : ''; };

// Was nicht in den Topf gehört – Getränke, Süßes, Drogerie, Tierbedarf.
const NICHT_KOCHEN = /\b(?:bier|pils|weizenbier|wein|sekt|prosecco|spirituos|wodka|vodka|whisk|rum\b|likör|gin\b|cola|limo|energy|mineralwasser|wasser|saft(?!ig)|nektar|schorle|kaffee(?!sahne)|espresso|cappuccino|tee\b|kakao(?!pulver)|schokolade|schoko|praline|bonbon|dragee|kaudragee|lutscher|fruchtgummi|gummi|kaugummi|keks|cookie|chips|cracker|riegel|eis\b|eiscreme|speiseeis|lebkuchen|stollen|spekulatius|dominostein|marzipan|kuchen|torte|waffel|müsli|cerealien|flakes|zigarett|tabak|wasch|spül|windel|zahn|shampoo|dusch|deo\b|kerze|batterie|toiletten|küchenrolle|müll|taschentuch|lotion|tablette|kapsel|vitamin|katze|hund|tier|futter|streu|blume|pflanze|strauß|rose\b|tulpe|orchidee|pizza|fertiggericht|nugget|knusperchen|cordon bleu|burger|pommes|frikadelle|bratwurst|wiener|würstchen|salami|schinken|leberkäse|mett|pastete|aufschnitt|delikatess|dulano|risbellis|reiswaffel|snacks?\b|käsesnack|drink\b|actimel|fix\b|strudel|laugen|nudelsuppe|nutella|nuss-nugat|knoppers|tupperware|salatsauce|dressing|keramik|dekoration|bepflanzt|reise\b|rundreise|kombireise|flugreise|busreise|urlaub|hotel|kreuzfahrt|brotaufstrich|brot\b|brötchen|toast|baguette|croissant|pudding|dessert|knabber|erdnussflips|popcorn|studentenfutter|datteln|feigen|trockenfr|pangasius|tilapia|hering|matjes|scholle|dorsch|sardine|makrele|seelachs|zander|mentos|pringles|lay['’]?s|chio|funny|lorenz|haribo|milka|ferrero|kinder\b|katjes|ritter sport|lindt|toblerone|snickers|mars\b|twix|kitkat|oreo|leibniz|bahlsen|jacobs|dallmayr|tchibo|melitta|nescaf|coca|fanta|sprite|pepsi|red bull|monster|volvic|evian|gerolsteiner|krombacher|beck['’]?s|warsteiner|bitburger|veltins|jever|paulaner|erdinger|franziskaner|radeberger|heineken|corona|guinness|budweiser|tyskie|karamalz)/i;
const istZumKochen = (name) => !NICHT_KOCHEN.test(name) && !istTabu(name);

/* ------------------------------------------------------------- Aldi */

export function aldiLesen(html, bezug = new Date()) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error('kein __NEXT_DATA__');
  const api = JSON.parse(JSON.parse(m[1]).props.pageProps.apiData);
  const offer = api.find((e) => e[0] === 'OFFER_GET');
  const produkte = Object.values(offer?.[1]?.res?.algoliaDataMap || {});
  const aus = [];
  for (const p of produkte) {
    const name = entities([schoeneMarke(p.brandName), p.name].filter(Boolean).join(' '));
    const preis = Number(p.currentPrice?.priceValue);
    if (!name || !(preis > 0)) continue;
    const bp = p.currentPrice?.basePrice?.[0];
    const obst = (p.categoryIDs || []).includes('frisches-obst-gemuese');
    const k = schluesselRaten(name, KATALOG);
    const lebensmittel = k || obst || /^(kg|g|liter|l|ml)$/i.test(String(bp?.basePriceScale || '').replace(/\s*\(.*/, ''));
    if (!lebensmittel || !istZumKochen(`${name} ${p.shortDescription || ''}`)) continue;
    let { menge, einheit } = mengeAus(p.salesUnit);
    // Ohne Packungsangabe hilft der Grundpreis: 1,99 € bei 10,61 €/kg sind 188 g
    if (!menge && bp?.basePriceValue && /^kg$/i.test(bp.basePriceScale)) { menge = Math.round(preis / bp.basePriceValue * 1000); einheit = 'g'; }
    if (!menge && bp?.basePriceValue && /^(liter|l)$/i.test(bp.basePriceScale)) { menge = Math.round(preis / bp.basePriceValue * 1000); einheit = 'ml'; }
    const pp = (p.promotionPrices || [])[0] || {};
    const foto = (p.assets || []).find((x) => x?.type === 'primary') || (p.assets || [])[0];
    const bild = foto?.url ? bildUrl(`${foto.url}${foto.url.includes('?') ? '&' : '?'}wid=200&hei=200`) : '';
    aus.push({ id: stabileId('Aldi', name, preis), laden: 'Aldi', name, preis, menge, einheit, von: pp.validFromLocalDate || '', bis: pp.validUntilLocalDate || p.validUntilLocalDate || samstagDieserWoche(bezug), k, bild });
  }
  return aus;
}

/** Montag in einer Woche (+7 Tage) als Date – Bezug fürs Lesen der nächsten Woche. */
const naechsterMontag = (d = new Date()) => new Date(`${wochentag(d, 7)}T12:00:00Z`);

async function aldi() {
  const html = await hole('https://www.aldi-nord.de/angebote.html');
  const angebote = aldiLesen(html);
  // Die Vorschau auf die nächste Woche – fehlt sie gerade, ist das kein Fehler
  let vorschau = [];
  try { vorschau = aldiLesen(await hole('https://www.aldi-nord.de/angebote-vorschau.html'), naechsterMontag()); } catch (e) { console.log(`  Aldi Vorschau: ${e?.message || e}`); }
  return { angebote: [...angebote, ...vorschau], hinweis: `Aldi Nord, bundesweit${vorschau.length ? `, mit Vorschau auf nächste Woche (${vorschau.length})` : ''}` };
}

/* --------------------------------------------------------- Kaufland */

const KAUFLAND_GRUPPEN = /TopArticle|K-Card|Obst__Gemuese|Fleisch__Gefluegel|Molkereiprodukte|Tiefkuehlkost|Feinkost__Konserven|Grundnahrungsmittel|Foodknueller|XXL|Bio|Regio|Eigenmarken|MultiBuy|Bester_Preis|Vorwerbung/;

export function kauflandLesen(html, bezug = new Date()) {
  const aus = [];
  const sektionen = html.split(/<div class="k-product-section /).slice(1);
  if (!sektionen.length) throw new Error('keine Warengruppen');
  for (const sek of sektionen) {
    const id = (sek.match(/id="(cat_[^"]+)"/) || [])[1] || '';
    if (!KAUFLAND_GRUPPEN.test(id) || /Frischer_Fisch/.test(id)) continue;
    const sub = entities((sek.match(/k-product-section__subheadline">(.*?)<\/div>/s) || [])[1]);
    const amM = sub.match(/am\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)/);
    const bisM = sub.match(/bis\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)/) || amM;
    const vonM = sub.match(/vom\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)/);
    const bis = bisM ? datumAus(bisM[1], bezug) : samstagDieserWoche(bezug);
    // „gültig am 02.11.“ gilt nur an dem Tag – sonst stünde es schon in dieser Woche
    const von = vonM ? datumAus(vonM[1], bezug) : (amM && bisM === amM ? bis : '');
    for (const t of sek.split('<a class="k-product-tile"').slice(1)) {
      const feld = (cls) => entities((t.match(new RegExp(`class="${cls}">(.*?)</div>`, 's')) || [])[1]);
      const marke = feld('k-product-tile__title');
      const produkt = feld('k-product-tile__subtitle');
      const preis = zahl(feld('k-price-tag__price'));
      // Bei Obst und Gemüse steht alles im Titel („Dtsch. Möhren, lose“), sonst Marke + Produkt
      const name = entities(produkt ? `${schoeneMarke(marke)} ${produkt}` : marke);
      if (!name || !(preis > 0)) continue;
      const grund = feld('k-product-tile__base-price');
      const k = schluesselRaten(name, KATALOG);
      const lebensmittel = k || /\(1 (kg|l) =/.test(grund) || /Obst__Gemuese|Fleisch|Molkerei|Grundnahrung|Feinkost|Tiefkuehl/.test(id);
      if (!lebensmittel || !istZumKochen(name)) continue;
      const { menge, einheit } = mengeAus(feld('k-product-tile__unit-price'));
      const img = t.match(/<img[^>]*class="[^"]*k-product-tile__main-image[^"]*"[^>]*>/s)?.[0] || '';
      const klein = (img.match(/srcset="([^"]+)"/)?.[1] || '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean)[0];
      const bild = bildUrl(klein || img.match(/\ssrc="([^"]+)"/)?.[1]);
      aus.push({ id: stabileId('Kaufland', name, preis), laden: 'Kaufland', name, preis, menge, einheit, von, bis, k, bild });
    }
  }
  return aus;
}

async function kaufland() {
  const html = await hole('https://filiale.kaufland.de/angebote/uebersicht.html');
  const angebote = kauflandLesen(html);
  let naechste = [];
  try { naechste = kauflandLesen(await hole('https://filiale.kaufland.de/angebote/uebersicht.html?kloffer-week=next'), naechsterMontag()); } catch (e) { console.log(`  Kaufland nächste Woche: ${e?.message || e}`); }
  return { angebote: [...angebote, ...naechste], hinweis: `bundesweite Angebote, regional kann es abweichen${naechste.length ? `; nächste Woche ${naechste.length}` : ''}` };
}

/* ------------------------------------------------------------ Penny */

const PENNY_GRUPPEN = ['top-angebote', 'obst-und-gemuese', 'fleisch-und-wurst', 'kuehlregal', 'kochen-und-backen', 'food-highlights-fuer-alle', 'xxl-lebensmittel-fuer-alle', 'obst-und-gemuese1', 'weitere-angebote'];

export function pennyLesen(gruppen, bezug = new Date()) {
  const aus = [];
  for (const [gruppe, daten] of gruppen) {
    for (const t of daten?.offerTiles || []) {
      if (t.type && t.type !== 'food') continue;
      const name = entities(String(t.title || '').replace(/\*+$/, ''));
      const preis = zahl(t.price);
      if (!name || !(preis > 0)) continue;
      const k = schluesselRaten(name, KATALOG);
      if (!istZumKochen(name)) continue;
      let { menge, einheit } = mengeAus(t.quantity);
      const bpm = String(t.basePrice || '').match(/1 (kg|l) = (\d+(?:[.,]\d+)?)/);
      if (!menge && bpm) { menge = Math.round(preis / Number(bpm[2].replace(',', '.')) * 1000); einheit = bpm[1] === 'kg' ? 'g' : 'ml'; }
      // Die Gruppen „ab Donnerstag“ (Obst 1, Food-Highlights, XXL) gelten kürzer, Ende ist immer der Samstag
      const von = /1$|highlights|xxl/.test(gruppe) ? wochentag(bezug, 3) : wochentag(bezug, 0);
      // 120 px reichen fürs Vorschaubild (44 px auf dem Handy) – das 200er ist als PNG dreimal so schwer
      const bild = bildUrl(String(t.imageRendition?.tileSm || t.imageRendition?.tileXs || '').replace(/([?&]imwidth=)\d+/, '$1120'));
      aus.push({ id: stabileId('Penny', name, preis), laden: 'Penny', name, preis, menge, einheit, von, bis: samstagDieserWoche(bezug), k, bild });
    }
  }
  return aus;
}

async function penny() {
  // Diese und die nächste Kalenderwoche; die nächste gibt es meist erst ab dem Wochenende (sonst 404)
  const angebote = [];
  const wochen = [];
  for (const bezug of [new Date(), naechsterMontag()]) {
    const kw = kalenderwoche(bezug);
    const gruppen = [];
    for (const g of PENNY_GRUPPEN) {
      try { gruppen.push([g, await hole(`https://www.penny.de/.rest/offers/by-category/${kw}/${g}`, { json: true })]); } catch (e) { if (!/404/.test(e.message)) throw e; }
    }
    if (gruppen.length) { angebote.push(...pennyLesen(gruppen, bezug)); wochen.push(kw.slice(5)); }
  }
  if (!wochen.length) throw new Error('keine Warengruppe geantwortet');
  return { angebote, hinweis: `KW ${wochen.join(' und ')}, bundesweit` };
}

/* ------------------------------------------------------------- Lidl */

const LIDL_JE_ANFRAGE = 6; // Seiten je Anfrage; wird die Antwort zu lang, halbiert sich der Stapel
const LIDL_PAUSE = 15000; // zwischen zwei Anfragen – das Gratis-Kontingent zählt Anfragen je Minute
const LIDL_SEITEN_MAX = 48; // höchstens so viele Seiten je Prospekt
const LIDL_ZEIT = 18 * 60e3; // danach nichts mehr anfragen (der Lauf darf 30 Minuten)
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_ZEIT = 60000; // je Anfrage; ein gesundes Modell braucht für vier Seiten 3–15 s
// Das Modell der App zuerst; antwortet es nicht oder ist es überlastet (im
// Gratis-Kontingent hängt mal das eine, mal das andere), das nächste – und
// nach dem letzten wieder das erste. Namen laut Modellliste des Schlüssels
// (steht im Log, wenn etwas ungelesen bleibt); 2.5-flash gibt Google neuen
// Konten nicht mehr.
const GEMINI_MODELLE = [ANBIETER.gemini.modell, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const GEMINI_WARTEN = [15000, 30000]; // Pausen vor dem 2. und 3. Versuch bei Überlastung (503)
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Die Modelle, die der Schlüssel für generateContent nutzen darf (nur Namen, fürs Log). */
export async function geminiModelle(schluessel, api = GEMINI_API) {
  const res = await fetch(`${api}?pageSize=200`, { headers: { 'x-goog-api-key': schluessel } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name || '').replace(/^models\//, '')).filter((n) => /gemini/.test(n)).sort();
}

/*
 * geminiAnfragen mit Ausweichen: bei Überlastung (503) bis zu drei Versuche
 * mit Pause, beim Kontingent (429) zwei mit der Wartezeit, die Google nennt
 * (sonst 65 s), dann – wie bei Zeitablauf sofort – das nächste Modell aus
 * der Kette, nach dem letzten wieder das erste, bis jedes einmal dran war
 * (das Kontingent gilt je Modell). Ein Modell, das es nicht (mehr) gibt,
 * fällt aus der Kette. Das Modell, das geantwortet hat, bleibt für die
 * folgenden Anfragen und steht in der Antwort (modell). anfragen(rumpf, opt)
 * ist austauschbar (Tests), warten die Pausen, grenzeWarten die beim Kontingent.
 */
export function mitAusweichen({ schluessel, modelle = GEMINI_MODELLE, warten = GEMINI_WARTEN, grenzeWarten = 65000, anfragen = geminiAnfragen, melde = () => {} }) {
  const kette = [...modelle];
  let i = 0;
  const f = async (rumpf) => {
    let wechsel = 0;
    for (let versuch = 0; ; versuch++) {
      if (!kette.length) throw kiFehler('modell', 'kein Modell übrig', 'gemini');
      const modell = kette[i % kette.length];
      try {
        return { ...await anfragen(rumpf, { schluessel, modell }), modell };
      } catch (e) {
        if (e?.art === 'modell') {
          melde(`${modell} gibt es nicht (mehr)`);
          kette.splice(i % kette.length, 1);
          if (!kette.length) throw e;
          i %= kette.length;
          versuch = -1;
          continue;
        }
        if (e?.art === 'ueberlastet' && !e.zeitablauf && versuch < warten.length) {
          melde(`${modell} überlastet, ${Math.round(warten[versuch] / 1000)} s warten`);
          await pause(warten[versuch]);
          continue;
        }
        if (e?.art === 'grenze' && versuch < 2) {
          melde(`${modell} am Kontingent (${e.detail || ''}), ${Math.round((e.wartezeit || grenzeWarten) / 1000)} s warten`);
          await pause(e.wartezeit || grenzeWarten);
          continue;
        }
        if ((e?.art === 'ueberlastet' || e?.art === 'grenze') && wechsel < kette.length - 1) {
          i = (i + 1) % kette.length;
          wechsel++;
          versuch = -1;
          melde(`${modell} ${e.art === 'grenze' ? 'am Kontingent' : e.zeitablauf ? 'antwortet nicht' : 'überlastet'}, weiter mit ${kette[i]}`);
          continue;
        }
        throw e;
      }
    }
  };
  f.modell = () => kette[i % kette.length] || '';
  return f;
}

/*
 * Der Rumpf für Geminis models/<modell>:generateContent – ohne Streaming,
 * die Antwort als JSON nach ANGEBOTE_SCHEMA. Auslesen braucht kein langes
 * Nachdenken (thinkingLevel LOW); die Temperatur bleibt auf Googles Vorgabe,
 * niedrigere Werte lassen Gemini 3 eher in Schleifen laufen.
 */
export function geminiRumpf({ fotos = [], text = '', katalog = {} }) {
  return {
    system_instruction: { parts: [{ text: systemTextAngebote({ katalog, anbieter: 'gemini' }) }] },
    contents: [{ role: 'user', parts: [...fotos.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } })), { text: nutzerTextAngebote({ text, fotos: fotos.length }) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ANGEBOTE_SCHEMA,
      maxOutputTokens: 32000,
      thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}

/*
 * Die Anfrage an Gemini schicken. Gibt { eingabe, usage, dauer, grund }
 * zurück und wirft Fehler mit .art wie ki.js (schluessel, grenze,
 * ueberlastet, zulang, sicherheit, antwort, netz) – lidlStapelLesen richtet
 * sich danach. Kennt das Modell die Denkstufe nicht, einmal ohne sie.
 */
export async function geminiAnfragen(rumpf, { schluessel, modell = ANBIETER.gemini.modell, api = GEMINI_API, timeout = GEMINI_ZEIT } = {}) {
  const start = Date.now();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  let res;
  let text = '';
  try {
    res = await fetch(`${api}/${modell}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': schluessel }, body: JSON.stringify(rumpf), signal: ac.signal });
    text = await res.text();
  } catch (e) {
    if (e?.name === 'AbortError') {
      // Keine Antwort in der Zeit: das Modell ist überlastet, mitAusweichen nimmt dann das nächste
      const f = kiFehler('ueberlastet', `keine Antwort nach ${Math.round(timeout / 1000)} s`, 'gemini');
      f.zeitablauf = true;
      throw f;
    }
    throw kiFehler('netz', e?.message, 'gemini');
  } finally { clearTimeout(t); }
  let info = null;
  try { info = JSON.parse(text); } catch { /* kein JSON */ }
  if (Array.isArray(info)) info = info[0];
  if (!res.ok) {
    const meldung = info?.error?.message || `HTTP ${res.status}`;
    if (res.status === 400 && /thinking/i.test(meldung) && rumpf.generationConfig?.thinkingConfig) {
      const ohne = { ...rumpf.generationConfig };
      delete ohne.thinkingConfig;
      return geminiAnfragen({ ...rumpf, generationConfig: ohne }, { schluessel, modell, api, timeout });
    }
    // Beim Kontingent sagt Google, welche Grenze (quotaId) und wie lange warten (retryDelay)
    const details = Array.isArray(info?.error?.details) ? info.error.details : [];
    const grenzen = details.flatMap((d) => d.violations || []).map((v) => `${v.quotaId || v.quotaMetric || '?'}${v.quotaValue ? `=${v.quotaValue}` : ''}`);
    const warte = details.map((d) => d.retryDelay).find(Boolean);
    const f = kiFehler(artVonStatus(res.status, info), `${meldung.split('\n')[0].slice(0, 160)}${grenzen.length ? ` · ${grenzen.join(', ')}` : ''}${warte ? ` · warten ${warte}` : ''}`, 'gemini');
    if (warte) f.wartezeit = Math.min(Math.ceil(parseFloat(warte) || 0) * 1000, 120000);
    throw f;
  }
  const kandidat = info?.candidates?.[0];
  const grund = kandidat?.finishReason || info?.promptFeedback?.blockReason || '';
  const u = info?.usageMetadata || {};
  const usage = { ein: u.promptTokenCount || 0, aus: u.candidatesTokenCount || 0, denken: u.thoughtsTokenCount || 0 };
  const dauer = Date.now() - start;
  const lage = `${usage.ein}/${usage.aus}+${usage.denken} Tokens, ${Math.round(dauer / 1000)} s`;
  if (grund === 'MAX_TOKENS') throw kiFehler('zulang', lage, 'gemini');
  if (/SAFETY|RECITATION|BLOCKLIST|PROHIBITED|SPII/i.test(grund)) throw kiFehler('sicherheit', grund, 'gemini');
  const roh = (kandidat?.content?.parts || []).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!roh) throw kiFehler('antwort', `keine Antwort (${grund || 'ohne finishReason'}, ${lage})`, 'gemini');
  try {
    return { eingabe: JSON.parse(roh), usage, dauer, grund };
  } catch {
    throw kiFehler('antwort', `JSON kaputt (${grund}, ${roh.length} Zeichen, ${lage})`, 'gemini');
  }
}

/** Die Aktionsprospekte auf lidl.de/l/prospekte mit ihren Daten. */
export function lidlProspekte(html) {
  const aus = new Map();
  for (const m of html.matchAll(/aktionsprospekt-(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{2})-(\d{4})-([a-f0-9]+)/g)) {
    aus.set(m[0], { id: m[0], von: `${m[3]}-${m[2]}-${m[1]}`, bis: `${m[6]}-${m[5]}-${m[4]}` });
  }
  return [...aus.values()].sort((a, b) => a.von.localeCompare(b.von));
}

/*
 * Welche Prospektseiten sich zu lesen lohnen. Der Prospekt hat gut 70 Seiten,
 * mehr als die Hälfte ist Werkzeug, Kleidung, Möbel, Spielzeug, Reisen. Die
 * Seitendaten verraten es: Lebensmittel tragen Links zu rezepte.lidl.de,
 * Non-Food und Wein tragen Onlineshop-Produkte, Reise- und Aktionsseiten nur
 * Aktionslinks. Seiten ganz ohne Links (Frische, Kühlregal) bleiben drin.
 * Kommt dabei zu wenig heraus (anderer Aufbau), die ersten Seiten.
 */
export function lidlSeitenWahl(pages, max = LIDL_SEITEN_MAX) {
  const alle = (pages || []).filter((s) => s.image);
  const lohnt = (s) => !(s.links || []).length || (s.links || []).some((l) => l.displayType === 'recipe');
  let wahl = alle.filter(lohnt);
  if (wahl.length < 12) wahl = alle;
  return wahl.slice(0, max);
}

/*
 * Einen Stapel Seiten ({ number, b64 }) von Gemini lesen lassen. Bricht die
 * Antwort ab, weil sie zu lang wird, liest es den Stapel in zwei Hälften.
 * anfragen(rumpf) ist austauschbar (Tests; sonst mitAusweichen), melde(text)
 * bekommt den Verlauf.
 */
export async function lidlStapelLesen(stapel, { von, bis, anfragen, melde = () => {} }) {
  const bereich = `Seiten ${stapel[0].number}–${stapel.at(-1).number}`;
  const rumpf = geminiRumpf({ fotos: stapel.map((s) => s.b64), text: `Lidl Aktionsprospekt, gültig ${von} bis ${bis}, ${bereich}. Laden: Lidl.`, katalog: KATALOG });
  const start = Date.now();
  let antwort;
  try {
    antwort = await anfragen(rumpf);
  } catch (e) {
    if (e?.art === 'zulang' && stapel.length > 1) {
      melde(`${bereich}: Antwort zu lang, halbiert`);
      const mitte = Math.ceil(stapel.length / 2);
      return [...await lidlStapelLesen(stapel.slice(0, mitte), { von, bis, anfragen, melde }), ...await lidlStapelLesen(stapel.slice(mitte), { von, bis, anfragen, melde })];
    }
    throw e;
  }
  const roh = Array.isArray(antwort?.eingabe?.angebote) ? antwort.eingabe.angebote : [];
  const u = antwort?.usage || {};
  melde(`${bereich}: ${roh.length} gelesen, ${u.ein || '?'}/${u.aus || '?'}${u.denken ? `+${u.denken}` : ''} Tokens, ${Math.round((Date.now() - start) / 1000)} s`);
  return roh;
}

async function lidl(alt) {
  if (!GEMINI_KEY) return { angebote: [], hinweis: 'ohne GEMINI_KEY nicht gelesen', ok: false };
  const html = await hole('https://www.lidl.de/c/online-prospekte/s10005610');
  const alle = lidlProspekte(html);
  const h = heute();
  // Der laufende Prospekt und, ab Freitag, auch der nächste
  const passende = alle.filter((p) => p.bis >= h && (p.von <= h || new Date().getUTCDay() >= 5 || new Date().getUTCDay() === 0)).slice(0, 2);
  if (!passende.length) throw new Error('kein laufender Aktionsprospekt gefunden');
  const melde = (s) => console.log(`  Lidl ${s}`);
  // Das Modell, das beim letzten Lauf geantwortet hat, zuerst – das neueste ist oft überlastet
  const zuletzt = alt?.quellen?.find((q) => q.laden === 'Lidl')?.modell;
  const modelle = [...new Set([zuletzt, ...GEMINI_MODELLE].filter(Boolean))];
  const anfragen = mitAusweichen({ schluessel: GEMINI_KEY, modelle, melde });
  const start = Date.now();
  const angebote = [];
  let gelesen = 0;
  let letzter = null;
  let zeitUm = false;
  let modellGenutzt = '';
  const uebernehmen = (roh, von, bis) => {
    for (const a of angeboteBereinigen(roh, KATALOG)) {
      if (!istZumKochen(a.name)) continue;
      angebote.push({ ...a, id: stabileId('Lidl', a.name, a.preis), laden: 'Lidl', von, bis: a.bis || bis, k: a.k || schluesselRaten(a.name, KATALOG) });
    }
  };
  // Ein Stapel: { seiten: [{ number, b64 }], von, bis, name }
  const lesen = async (st) => {
    if (Date.now() - start > LIDL_ZEIT) { zeitUm = true; return false; }
    try {
      uebernehmen(await lidlStapelLesen(st.seiten, { von: st.von, bis: st.bis, anfragen, melde }), st.von, st.bis);
      gelesen += st.seiten.length;
      modellGenutzt = anfragen.modell();
      return true;
    } catch (e) {
      if (e?.art === 'schluessel') throw e; // falscher Schlüssel: weitere Anfragen sind sinnlos
      letzter = e;
      melde(`Seiten ${st.name} übersprungen: ${e?.message || e}${e?.detail ? ` [${e.detail}]` : ''}`);
      return false;
    } finally {
      // Gratis-Kontingent: nicht zu schnell hintereinander
      await pause(LIDL_PAUSE);
    }
  };
  let uebrig = [];
  for (const p of passende) {
    const f = (await hole(`https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${p.id}&region_id=0&region_code=0`, { json: true })).flyer;
    const seiten = lidlSeitenWahl(f?.pages, LIDL_MAX || LIDL_SEITEN_MAX);
    melde(`${p.id}: ${seiten.length} von ${(f?.pages || []).length} Seiten lesen`);
    const bis = (f?.offerEndDate || f?.endDate || p.bis).slice(0, 10);
    const von = (f?.offerStartDate || f?.startDate || p.von).slice(0, 10);
    for (let i = 0; i < seiten.length && !zeitUm; i += LIDL_JE_ANFRAGE) {
      const teil = seiten.slice(i, i + LIDL_JE_ANFRAGE);
      const st = { seiten: [], von, bis, name: `${teil[0].number}–${teil.at(-1).number}` };
      for (const x of teil) st.seiten.push({ number: x.number, b64: (await hole(x.image, { bin: true })).toString('base64') });
      if (!await lesen(st) && !zeitUm) uebrig.push(st);
    }
    if (zeitUm) break;
  }
  // Zweiter Durchgang für das, was beim ersten hing – oft klappt es dann
  if (uebrig.length && !zeitUm) {
    melde(`zweiter Durchgang für Seiten ${uebrig.map((st) => st.name).join(', ')}`);
    const nochmal = uebrig;
    uebrig = [];
    for (const st of nochmal) if (!await lesen(st) && !zeitUm) uebrig.push(st);
  }
  const nichtLesbar = uebrig.map((st) => st.name);
  if (nichtLesbar.length) {
    // Fürs Log: welche Modelle der Schlüssel überhaupt nutzen darf
    try { melde(`Modelle mit diesem Schlüssel: ${(await geminiModelle(GEMINI_KEY)).join(', ')}`); } catch (e) { melde(`Modellliste nicht lesbar (${e?.message || e})`); }
  }
  if (!gelesen) throw new Error(letzter ? `keine Seite lesbar (${String(letzter.message || letzter).slice(0, 60)})` : 'keine Seiten im Prospekt');
  const teile = [`aus dem Aktionsprospekt gelesen (${passende.map((p) => `${p.von.slice(8)}.${p.von.slice(5, 7)}.–${p.bis.slice(8)}.${p.bis.slice(5, 7)}.`).join(', ')})`];
  if (nichtLesbar.length) teile.push(`Seiten ${nichtLesbar.join(', ')} nicht lesbar`);
  if (zeitUm) teile.push('Zeit um, Rest nicht gelesen');
  teile.push('Lesefehler möglich');
  melde(`gelesen mit ${modellGenutzt}`);
  return { angebote, hinweis: teile.join(', '), modell: modellGenutzt };
}

/* ------------------------------------------------------------ kaufDA */

// Die Stadt kommt aus der Umgebung des privaten Laufs – sie steht bewusst nicht im öffentlichen Code.
const KAUFDA_STADT = process.env.KAUFDA_STADT || '';
const KAUFDA_PAUSE = 4000; // robots.txt: Crawl-Delay 2 – wir lassen doppelt so viel Luft
const KAUFDA_NOCHMAL = 30000; // antwortet eine Seite nicht (503), einmal so lange warten
// Welche Händler bei kaufDA wie heißen – nur die, die wir sonst nicht bekommen
// (Netto nicht: da kauft ihr nicht ein)
const KAUFDA_LAEDEN = { REWE: 'Rewe', EDEKA: 'Edeka', 'EDEKA center': 'Edeka', 'E center': 'Edeka', 'EDEKA Frischemarkt': 'Edeka', 'E neukauf': 'Edeka', 'E aktiv markt': 'Edeka' };
// Die Stichwörter (so, wie kaufDA sie in der Adresse schreibt: ae/oe/ue). Nur Wörter, zu denen
// kaufDA eine Seite hat (Stand Oktober 2026) – andere geben 404. Je Seite bis zu 16 Angebote.
const KAUFDA_WORTE = [
  'Haehnchenbrust', 'Haehnchen', 'Huhn', 'Gefluegel', 'Pute', 'Putenbrust', 'Hackfleisch', 'Rindfleisch', 'Gulasch', 'Fleisch',
  'Gemuese', 'Paprika', 'Zucchini', 'Tomaten', 'Kartoffeln', 'Champignons', 'Blumenkohl', 'Zitronen', 'Obst', 'Aepfel',
  'Milch', 'Joghurt', 'Quark', 'Sahne', 'Butter', 'Eier', 'Kaese', 'Mozzarella', 'Feta',
  'Reis', 'Nudeln', 'Pasta', 'Bohnen', 'Mais', 'Nuesse', 'Mehl', 'Honig', 'Olivenoel',
];

const tagBerlin = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

/*
 * Die Packung aus einer kaufDA-Beschreibung. Die verkaufte Menge steht dort
 * meist am Ende („Abtropfg.: 265 g 400 g“, „ca. 2,5 kg 1 kg“, „450 g + 50 g
 * gratis = 500 g“) – also die letzte Mengenangabe; ohne eine „St.“ → 1 Stück.
 */
export function kaufdaMenge(text) {
  const t = String(text || '');
  let letzte = null;
  for (const m of t.matchAll(/(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*-?\s*(?:kg|g|ml|l)\b/gi)) letzte = m[0];
  if (letzte) return mengeAus(letzte);
  const r = mengeAus(t);
  if (!r.menge && /\bst\.?$|\bstück\b/i.test(t.trim())) return { menge: 1, einheit: 'Stk' };
  return r;
}

/** Ein Titel ganz in Großbuchstaben („SPEISE-KARTOFFELN“) wie ein normaler Name. */
const kaufdaTitel = (t) => { const s = entities(t).replace(/[„“”"]/g, '').trim(); return /[a-zäöüß]/.test(s) ? s : schoeneMarke(s); };

/** Die Angebote einer kaufDA-Stichwortseite (Rewe und Edeka – die anderen haben wir direkt). */
export function kaufdaLesen(html, laeden = KAUFDA_LAEDEN) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error('kein __NEXT_DATA__');
  const items = JSON.parse(m[1])?.props?.pageProps?.pageInformation?.offers?.main?.items || [];
  const aus = [];
  for (const it of items) {
    const laden = laeden[it.publisherName];
    if (!laden || it.type !== 'OFFER') continue;
    // Nur, was kaufDA (auch) unter Lebensmittel führt – keine Reisen, Dosen zum Aufbewahren, Tierfutter
    const pfade = Array.isArray(it.categoryPaths) ? it.categoryPaths : [];
    if (pfade.length && !pfade.some((p) => p?.[0]?.name === 'Lebensmittel und Getränke')) continue;
    const titel = kaufdaTitel(it.title || '');
    const marke = schoeneMarke(entities(it.brand || '').replace(/[„“”"]/g, ''));
    const name = marke && !titel.toLowerCase().includes(marke.toLowerCase()) ? `${marke} ${titel}` : titel;
    // „bis zu 23g Protein pro 100g 400 g“: die Nährwert-Floskel darf nicht als Packung gelten
    const beschreibung = entities(it.description || '').replace(/\d+\s?g\s+(?:protein|eiweiß)\s+pro\s+\d+\s?g/gi, ' ');
    const preis = Number(it.prices?.mainPrice);
    if (!name || !(preis > 0) || !istZumKochen(`${name} ${beschreibung}`)) continue;
    const { menge, einheit } = kaufdaMenge(beschreibung);
    // Geräuchert, gegart, paniert … steht oft nur in der Beschreibung – dann ist es keine Rezeptzutat
    const k = /geräuchert|gegart|gekocht|paniert|mariniert|gewürzt|gegrillt/i.test(beschreibung) ? '' : schluesselRaten(name, KATALOG);
    const bild = bildUrl(it.offerImages?.url?.thumbnail || it.offerImages?.url?.normal);
    aus.push({ laden, name, preis, menge, einheit, von: tagBerlin(it.validFrom), bis: tagBerlin(it.validUntil), k, bild, kern: kaufdaKern(it.title) });
  }
  return aus;
}

/** Der Kern eines Produktnamens, um dasselbe Angebot aus den Prospektvarianten zu erkennen („Frisches Hähnchen-Brustfilet“ ≈ „Hähnchen-Brustfilet“). */
const kaufdaKern = (titel) => String(titel || '').toLowerCase().replace(/frische[sr]?\b|\bbio\b|original|\bje\b/g, '').replace(/[^a-zäöüß]/g, '');

/** Dasselbe Angebot schon da? Gleicher Laden, Preis und Packung, und der eine Name steckt im anderen. */
export const kaufdaDoppelt = (liste, a) => liste.some((b) => b.laden === a.laden && b.preis === a.preis && (b.menge || null) === (a.menge || null) && (b.einheit || '') === (a.einheit || '') && a.kern && b.kern && (a.kern.includes(b.kern) || b.kern.includes(a.kern)));

/*
 * Rewe und Edeka über kaufDA: je Stichwort eine Seite, Dubletten einmal.
 * Gemächlich (4 s zwischen den Seiten). Antwortet eine Seite nicht, einmal
 * nach 30 s nochmal, sonst weiter mit dem nächsten Wort; dreimal hintereinander
 * nichts heißt: kaufDA will gerade nicht – dann aufhören und behalten, was da ist.
 */
async function kaufda() {
  if (!KAUFDA_STADT) throw new Error('KAUFDA_STADT fehlt');
  const angebote = [];
  const gesehen = new Set();
  let seiten = 0;
  let fehlerFolge = 0;
  let abgebrochen = false;
  const holeWort = async (wort) => {
    const url = `https://www.kaufda.de/${encodeURIComponent(KAUFDA_STADT)}/Angebote/${wort}`;
    try {
      return await hole(url);
    } catch (e) {
      if (/HTTP 404/.test(e.message)) return null; // zu dem Wort gibt es gerade keine Seite
      await pause(KAUFDA_NOCHMAL);
      return hole(url);
    }
  };
  for (const wort of KAUFDA_WORTE) {
    let html = null;
    try {
      html = await holeWort(wort);
      fehlerFolge = 0;
    } catch (e) {
      fehlerFolge++;
      console.log(`  kaufDA ${wort}: ${e?.message || e}`);
      if (fehlerFolge >= 3) { abgebrochen = true; break; }
    }
    if (html) {
      seiten++;
      for (const a of kaufdaLesen(html)) {
        const id = stabileId(a.laden, a.name, a.preis);
        if (gesehen.has(id) || kaufdaDoppelt(angebote, a)) continue;
        gesehen.add(id);
        angebote.push(a);
      }
    }
    await pause(KAUFDA_PAUSE);
  }
  if (!seiten) throw new Error('keine Stichwortseite erreichbar');
  const hinweis = `über kaufDA, gezielt nach ${seiten} Stichwörtern für Rezeptzutaten gesucht – nicht das ganze Prospekt${abgebrochen ? ' (kaufDA hat zwischendurch nicht geantwortet, unvollständig)' : ''}`;
  return { angebote: angebote.map(({ kern, ...a }) => a), hinweis };
}
kaufda.laeden = ['Rewe', 'Edeka'];

/* ------------------------------------------------------------ Ablauf */

/*
 * Zwei Läufe mit derselben Mechanik:
 *   öffentlich  Aldi, Lidl, Kaufland, Penny → daten/angebote.json (öffentliches Repo)
 *   --privat    Rewe und Edeka über kaufDA → angebote-privat.json (privates Daten-Repo)
 */
const QUELLEN = PRIVAT_LAUF ? { kaufda } : { aldi, lidl, kaufland, penny };

async function main() {
  const alt = (() => { try { return JSON.parse(readFileSync(ZIEL, 'utf8')); } catch { return null; } })();
  const quellen = [];
  let angebote = [];
  for (const [name, fn] of Object.entries(QUELLEN)) {
    // Eine Quelle liefert meist einen Laden (aldi → Aldi), kaufDA drei
    const laeden = fn.laeden || [name.charAt(0).toUpperCase() + name.slice(1)];
    const alteVon = (laden) => (alt?.angebote || []).filter((a) => a.laden === laden);
    if (!will(name) && !laeden.some((l) => will(l.toLowerCase()))) { // nicht angefragt: das Alte behalten
      for (const laden of laeden) {
        const vorher = alt?.quellen?.find((q) => q.laden === laden);
        if (vorher) { quellen.push(vorher); angebote.push(...alteVon(laden)); }
      }
      continue;
    }
    try {
      const { angebote: neu, hinweis, ok = true, modell } = await fn(alt);
      for (const laden of laeden) {
        const meine = neu.filter((a) => a.laden === laden);
        quellen.push({ laden, ok, anzahl: meine.length, hinweis, stand: new Date().toISOString(), ...(modell ? { modell } : {}) });
        console.log(`${laden.padEnd(9)} ${String(meine.length).padStart(4)} Angebote${hinweis ? ` – ${hinweis}` : ''}`);
      }
      angebote.push(...neu);
    } catch (e) {
      // Fällt eine Quelle aus, bleiben ihre alten Angebote, solange sie gelten
      for (const laden of laeden) {
        const vorher = alteVon(laden).filter((a) => !a.bis || a.bis >= heute());
        const q = alt?.quellen?.find((x) => x.laden === laden);
        quellen.push({ laden, ok: false, anzahl: vorher.length, hinweis: `heute nicht erreichbar (${String(e?.message || e).slice(0, 80)})`, stand: q?.stand || '', ...(q?.modell ? { modell: q.modell } : {}) });
        angebote.push(...vorher);
        console.log(`${laden.padEnd(9)} FEHLER ${e?.message || e}${vorher.length ? ` – ${vorher.length} alte behalten` : ''}`);
      }
    }
  }
  // Rezeptzutaten zuerst, dann der Rest – und deutlich mehr Platz als die von Hand eingetragene Liste
  const gueltig = angebote.filter((a) => !a.bis || a.bis >= heute()).map((a) => ({ ...a, k: a.k || '' }));
  gueltig.sort((a, b) => (b.k ? 1 : 0) - (a.k ? 1 : 0) || a.laden.localeCompare(b.laden) || a.name.localeCompare(b.name, 'de'));
  // Diese und nächste Woche zusammen – darum doppelt so viel Platz wie früher
  angebote = angeboteBereinigen(gueltig, KATALOG, 1600).map((a) => ({ ...a, id: stabileId(a.laden, a.name, a.preis, a.von) }));
  const daten = {
    stand: new Date().toISOString(),
    woche: kalenderwoche(),
    // Im öffentlichen Feed stehen Rewe und Edeka nicht – die kommen, wenn überhaupt, privat über kaufDA
    gesperrt: PRIVAT_LAUF ? [] : ['Rewe', 'Edeka'],
    quellen,
    angebote,
  };
  mkdirSync(path.dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, `${JSON.stringify(daten, null, 1)}\n`);
  console.log(`${angebote.length} Angebote (${angebote.filter((a) => a.k).length} Rezeptzutaten) → ${path.relative(ROOT, ZIEL)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
