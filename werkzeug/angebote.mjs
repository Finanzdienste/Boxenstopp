#!/usr/bin/env node
/*
 * Holt die Angebote der Woche und schreibt daten/angebote.json – läuft
 * montags und donnerstags als GitHub Action (.github/workflows/angebote.yml),
 * zur Not auch von Hand:
 *
 *     node werkzeug/angebote.mjs                # alle Quellen
 *     node werkzeug/angebote.mjs aldi penny     # nur diese
 *
 * Quellen – nur öffentliche Seiten, die ein normaler Abruf ohne Tricks
 * bekommt (eine ehrliche Kennung, zweimal die Woche, robots.txt beachtet):
 *
 *   Aldi      www.aldi-nord.de/angebote.html – die Seite hat alle Artikel der
 *             Woche als JSON eingebettet (Preis, Packung, Grundpreis, gültig bis).
 *   Kaufland  filiale.kaufland.de/angebote/uebersicht.html – Artikelkacheln im
 *             HTML, nach Warengruppen, mit Gültigkeit je Gruppe. Bundesweit.
 *   Penny     www.penny.de/.rest/offers/by-category/<Jahr>-<KW>/<Gruppe> – JSON.
 *   Lidl      Der Aktionsprospekt (lidl.de/l/prospekte) liegt als Seitenbilder
 *             vor, ohne Text. Die Bilder liest Gemini aus – dafür braucht der
 *             Lauf den Schlüssel in GEMINI_KEY (bei GitHub als Secret). Ohne
 *             Schlüssel fällt Lidl aus, der Rest läuft.
 *
 *   Rewe, Netto und Edeka sperren automatische Abrufe (403 bzw. eine
 *   Scherzantwort) – die bleiben draußen, das steht auch in der App.
 *
 * Was nicht zum Kochen taugt (Getränke, Süßes, Drogerie), fliegt raus, ebenso
 * Schwein und Fisch (ki-rezept.js VERBOTEN). Jedes Angebot bekommt, wenn es
 * eine Rezeptzutat ist, den Katalog-Schlüssel (angebote.js schluesselRaten),
 * damit die App die passenden Rezepte findet.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { angeboteBereinigen, schluesselRaten, mengeAus, istTabu, stabileId, rumpfAngebote } from '../js/angebote.js';
import { kiAnfragen, ANBIETER } from '../js/ki.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, '..');
const ZIEL = path.join(ROOT, 'daten', 'angebote.json');
const UA = 'Boxenstopp-Angebote/1.0 (+https://github.com/Finanzdienste/Boxenstopp)';
const KATALOG = JSON.parse(readFileSync(path.join(ROOT, 'daten', 'rezepte.json'), 'utf8')).katalog;
const GEMINI_KEY = process.env.GEMINI_KEY || '';
const nur = process.argv.slice(2).map((s) => s.toLowerCase());
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

// Was nicht in den Topf gehört – Getränke, Süßes, Drogerie, Tierbedarf.
const NICHT_KOCHEN = /\b(?:bier|pils|weizenbier|wein|sekt|prosecco|spirituos|wodka|vodka|whisk|rum\b|likör|gin\b|cola|limo|energy|mineralwasser|wasser|saft(?!ig)|nektar|schorle|kaffee(?!sahne)|espresso|cappuccino|tee\b|kakao(?!pulver)|schokolade|schoko|praline|bonbon|dragee|kaudragee|lutscher|fruchtgummi|gummi|kaugummi|keks|cookie|chips|cracker|riegel|eis\b|eiscreme|speiseeis|lebkuchen|stollen|spekulatius|dominostein|marzipan|kuchen|torte|waffel|müsli|cerealien|flakes|zigarett|tabak|wasch|spül|windel|zahn|shampoo|dusch|deo\b|kerze|batterie|toiletten|küchenrolle|müll|taschentuch|lotion|tablette|kapsel|vitamin|katze|hund|tier|futter|streu|blume|pflanze|strauß|rose\b|tulpe|orchidee|pizza|fertiggericht|nugget|burger|pommes|frikadelle|bratwurst|wiener|würstchen|salami|schinken|leberkäse|mett|pastete|brotaufstrich|brot\b|brötchen|toast|baguette|croissant|pudding|dessert|knabber|erdnussflips|popcorn|studentenfutter|datteln|feigen|trockenfr|pangasius|tilapia|hering|matjes|scholle|dorsch|sardine|makrele|seelachs|zander|mentos|pringles|lay['’]?s|chio|funny|lorenz|haribo|milka|ferrero|kinder\b|katjes|ritter sport|lindt|toblerone|snickers|mars\b|twix|kitkat|oreo|leibniz|bahlsen|jacobs|dallmayr|tchibo|melitta|nescaf|coca|fanta|sprite|pepsi|red bull|monster|volvic|evian|gerolsteiner|krombacher|beck['’]?s|warsteiner|bitburger|veltins|jever|paulaner|erdinger|franziskaner|radeberger|heineken|corona|guinness|budweiser|tyskie|karamalz)/i;
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
    aus.push({ id: stabileId('Aldi', name, preis), laden: 'Aldi', name, preis, menge, einheit, von: pp.validFromLocalDate || '', bis: pp.validUntilLocalDate || p.validUntilLocalDate || samstagDieserWoche(bezug), k });
  }
  return aus;
}

async function aldi() {
  const html = await hole('https://www.aldi-nord.de/angebote.html');
  return { angebote: aldiLesen(html), hinweis: 'Aldi Nord, bundesweit' };
}

/* --------------------------------------------------------- Kaufland */

const KAUFLAND_GRUPPEN = /TopArticle|K-Card|Obst__Gemuese|Fleisch__Gefluegel|Molkereiprodukte|Tiefkuehlkost|Feinkost__Konserven|Grundnahrungsmittel|Foodknueller|XXL|Bio|Regio|Eigenmarken|MultiBuy|Bester_Preis/;

export function kauflandLesen(html, bezug = new Date()) {
  const aus = [];
  const sektionen = html.split(/<div class="k-product-section /).slice(1);
  if (!sektionen.length) throw new Error('keine Warengruppen');
  for (const sek of sektionen) {
    const id = (sek.match(/id="(cat_[^"]+)"/) || [])[1] || '';
    if (!KAUFLAND_GRUPPEN.test(id) || /Frischer_Fisch/.test(id)) continue;
    const sub = entities((sek.match(/k-product-section__subheadline">(.*?)<\/div>/s) || [])[1]);
    const bisM = sub.match(/bis\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)/) || sub.match(/am\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)/);
    const vonM = sub.match(/vom\s+(\d{1,2}\.\d{1,2}\.(?:\d{4})?)/);
    const bis = bisM ? datumAus(bisM[1], bezug) : samstagDieserWoche(bezug);
    const von = vonM ? datumAus(vonM[1], bezug) : '';
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
      aus.push({ id: stabileId('Kaufland', name, preis), laden: 'Kaufland', name, preis, menge, einheit, von, bis, k });
    }
  }
  return aus;
}

async function kaufland() {
  const html = await hole('https://filiale.kaufland.de/angebote/uebersicht.html');
  return { angebote: kauflandLesen(html), hinweis: 'bundesweite Angebote, regional kann es abweichen' };
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
      aus.push({ id: stabileId('Penny', name, preis), laden: 'Penny', name, preis, menge, einheit, von, bis: samstagDieserWoche(bezug), k });
    }
  }
  return aus;
}

async function penny() {
  const kw = kalenderwoche();
  const gruppen = [];
  for (const g of PENNY_GRUPPEN) {
    try { gruppen.push([g, await hole(`https://www.penny.de/.rest/offers/by-category/${kw}/${g}`, { json: true })]); } catch (e) { if (!/404/.test(e.message)) throw e; }
  }
  if (!gruppen.length) throw new Error('keine Warengruppe geantwortet');
  return { angebote: pennyLesen(gruppen), hinweis: `KW ${kw.slice(5)}, bundesweit` };
}

/* ------------------------------------------------------------- Lidl */

const LIDL_SEITEN = 40; // Lebensmittel stehen vorn im Prospekt, hinten kommt Non-Food
const LIDL_JE_ANFRAGE = 6;

/** Die Aktionsprospekte auf lidl.de/l/prospekte mit ihren Daten. */
export function lidlProspekte(html) {
  const aus = new Map();
  for (const m of html.matchAll(/aktionsprospekt-(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{2})-(\d{4})-([a-f0-9]+)/g)) {
    aus.set(m[0], { id: m[0], von: `${m[3]}-${m[2]}-${m[1]}`, bis: `${m[6]}-${m[5]}-${m[4]}` });
  }
  return [...aus.values()].sort((a, b) => a.von.localeCompare(b.von));
}

async function lidl() {
  if (!GEMINI_KEY) return { angebote: [], hinweis: 'ohne GEMINI_KEY nicht gelesen', ok: false };
  const html = await hole('https://www.lidl.de/c/online-prospekte/s10005610');
  const alle = lidlProspekte(html);
  const h = heute();
  // Der laufende Prospekt und, ab Freitag, auch der nächste
  const passende = alle.filter((p) => p.bis >= h && (p.von <= h || new Date().getUTCDay() >= 5 || new Date().getUTCDay() === 0)).slice(0, 2);
  if (!passende.length) throw new Error('kein laufender Aktionsprospekt gefunden');
  const angebote = [];
  for (const p of passende) {
    const f = (await hole(`https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${p.id}&region_id=0&region_code=0`, { json: true })).flyer;
    const seiten = (f?.pages || []).filter((s) => s.image).slice(0, LIDL_SEITEN);
    const bis = (f?.offerEndDate || f?.endDate || p.bis).slice(0, 10);
    const von = (f?.offerStartDate || f?.startDate || p.von).slice(0, 10);
    for (let i = 0; i < seiten.length; i += LIDL_JE_ANFRAGE) {
      const stapel = seiten.slice(i, i + LIDL_JE_ANFRAGE);
      const fotos = [];
      for (const s of stapel) fotos.push((await hole(s.image, { bin: true })).toString('base64'));
      const rumpf = rumpfAngebote('gemini', { fotos, text: `Lidl Aktionsprospekt, gültig ${von} bis ${bis}, Seiten ${stapel[0].number}–${stapel.at(-1).number}. Laden: Lidl.`, katalog: KATALOG, modell: { gemini: ANBIETER.gemini.modell, anthropic: ANBIETER.anthropic.modell } });
      let antwort;
      try {
        antwort = await kiAnfragen(rumpf, { schluessel: GEMINI_KEY });
      } catch (e) {
        if (e?.art === 'grenze') { await new Promise((r) => { setTimeout(r, 65000); }); antwort = await kiAnfragen(rumpf, { schluessel: GEMINI_KEY }); } else throw e;
      }
      for (const a of angeboteBereinigen(antwort.eingabe?.angebote, KATALOG)) {
        if (!istZumKochen(a.name)) continue;
        angebote.push({ ...a, id: stabileId('Lidl', a.name, a.preis), laden: 'Lidl', von, bis: a.bis || bis, k: a.k || schluesselRaten(a.name, KATALOG) });
      }
      // Gratis-Kontingent: nicht zu schnell hintereinander
      await new Promise((r) => { setTimeout(r, 7000); });
    }
  }
  return { angebote, hinweis: `aus dem Aktionsprospekt gelesen (${passende.map((p) => `${p.von.slice(8)}.${p.von.slice(5, 7)}.–${p.bis.slice(8)}.${p.bis.slice(5, 7)}.`).join(', ')}), Lesefehler möglich` };
}

/* ------------------------------------------------------------ Ablauf */

const QUELLEN = { aldi, lidl, kaufland, penny };

async function main() {
  const alt = (() => { try { return JSON.parse(readFileSync(ZIEL, 'utf8')); } catch { return null; } })();
  const quellen = [];
  let angebote = [];
  for (const [name, fn] of Object.entries(QUELLEN)) {
    const laden = name.charAt(0).toUpperCase() + name.slice(1);
    if (!will(name)) { // nicht angefragt: das Alte behalten
      const vorher = alt?.quellen?.find((q) => q.laden === laden);
      if (vorher) { quellen.push(vorher); angebote.push(...(alt.angebote || []).filter((a) => a.laden === laden)); }
      continue;
    }
    try {
      const { angebote: neu, hinweis, ok = true } = await fn();
      quellen.push({ laden, ok, anzahl: neu.length, hinweis, stand: new Date().toISOString() });
      angebote.push(...neu);
      console.log(`${laden.padEnd(9)} ${String(neu.length).padStart(4)} Angebote${hinweis ? ` – ${hinweis}` : ''}`);
    } catch (e) {
      // Fällt eine Quelle aus, bleiben ihre alten Angebote, solange sie gelten
      const vorher = (alt?.angebote || []).filter((a) => a.laden === laden && (!a.bis || a.bis >= heute()));
      quellen.push({ laden, ok: false, anzahl: vorher.length, hinweis: `heute nicht erreichbar (${String(e?.message || e).slice(0, 80)})`, stand: alt?.quellen?.find((q) => q.laden === laden)?.stand || '' });
      angebote.push(...vorher);
      console.log(`${laden.padEnd(9)} FEHLER ${e?.message || e}${vorher.length ? ` – ${vorher.length} alte behalten` : ''}`);
    }
  }
  // Rezeptzutaten zuerst, dann der Rest – und deutlich mehr Platz als die von Hand eingetragene Liste
  const gueltig = angebote.filter((a) => !a.bis || a.bis >= heute()).map((a) => ({ ...a, k: a.k || '' }));
  gueltig.sort((a, b) => (b.k ? 1 : 0) - (a.k ? 1 : 0) || a.laden.localeCompare(b.laden) || a.name.localeCompare(b.name, 'de'));
  angebote = angeboteBereinigen(gueltig, KATALOG, 800).map((a) => ({ ...a, id: stabileId(a.laden, a.name, a.preis) }));
  const daten = {
    stand: new Date().toISOString(),
    woche: kalenderwoche(),
    gesperrt: ['Rewe', 'Netto', 'Edeka'],
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
