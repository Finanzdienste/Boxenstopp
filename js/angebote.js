/*
 * Angebote der Woche – ohne DOM.
 *
 * Woher die Angebote kommen: Fotos der Prospektseiten oder Screenshots aus
 * den Apps von Aldi, Lidl, Rewe, Kaufland & Co., die die KI ausliest
 * (rumpfAngebote + angeboteBereinigen), oder eine getippte Zeile wie
 * „Aldi Hähnchenbrustfilet 1 kg 7,49“ (zeileLesen). Einen offiziellen,
 * kostenlosen Datenfeed mit allen Angeboten gibt es nicht – die Prospekt-
 * Seiten wollen nicht automatisch abgegrast werden, und die inoffiziellen
 * Schnittstellen brauchen Schlüssel, die man aus deren Webseite klauben
 * müsste. Deshalb: Foto rein, fertig.
 *
 * Was die App damit macht: jedes Angebot bekommt, wenn möglich, den Katalog-
 * Schlüssel der Zutat (k). Damit findet sie die Rezepte, die davon leben
 * (rezeptTreffer), rechnet die Ersparnis gegen die Richtpreise und baut den
 * Text für die KI, die daraus ein neues Rezept auf die Ziele macht.
 */

import { VERBOTEN } from './ki-rezept.js';

export const LAEDEN = ['Aldi', 'Lidl', 'Rewe', 'Kaufland', 'Penny', 'Netto', 'Edeka', 'Norma'];
export const MAX_ANGEBOTE = 120;
const EINHEITEN = ['g', 'kg', 'ml', 'l', 'Stk', 'Dose', 'Pck', 'Glas', 'Bund', 'Stange', 'Zehe', 'Becher', 'Flasche', 'Netz', 'Schale', 'Beutel'];
const ID = /^a-[a-z0-9]{4,16}$/;

export const neueId = () => `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** „Aldi Nord“ → „Aldi“, „REWE Center“ → „Rewe“, sonst wie geschrieben (gekürzt). */
export function ladenName(s) {
  const t = String(s || '').trim();
  const treffer = LAEDEN.find((l) => new RegExp(l, 'i').test(t));
  return treffer || t.slice(0, 24);
}

const istObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const txt = (x, n) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').slice(0, n) : '');
const zahl = (x) => {
  if (typeof x === 'number') return Number.isFinite(x) ? x : NaN;
  return parseFloat(String(x || '').replace(',', '.'));
};

/** Einheit normieren: „Stück“ → Stk, „Packung“ → Pck, „Liter“ → l. */
export function einheitNorm(u) {
  const t = String(u || '').trim().toLowerCase().replace(/\.$/, '');
  if (!t) return '';
  if (/^(st|stk|stück|stueck|stuck)$/.test(t)) return 'Stk';
  if (/^(pck|pkg|packung|pack|päckchen)$/.test(t)) return 'Pck';
  if (/^(l|liter|ltr)$/.test(t)) return 'l';
  if (/^(ml|milliliter)$/.test(t)) return 'ml';
  if (/^(kg|kilo|kilogramm)$/.test(t)) return 'kg';
  if (/^(g|gr|gramm)$/.test(t)) return 'g';
  if (/^(dose|dosen)$/.test(t)) return 'Dose';
  if (/^(glas|gläser)$/.test(t)) return 'Glas';
  if (/^(bund|bd)$/.test(t)) return 'Bund';
  if (/^(stange|stangen)$/.test(t)) return 'Stange';
  if (/^(becher)$/.test(t)) return 'Becher';
  if (/^(flasche|fl)$/.test(t)) return 'Flasche';
  if (/^(netz)$/.test(t)) return 'Netz';
  if (/^(schale)$/.test(t)) return 'Schale';
  if (/^(beutel|btl)$/.test(t)) return 'Beutel';
  const hit = EINHEITEN.find((e) => e.toLowerCase() === t);
  return hit || '';
}

/**
 * Ein Angebot aus beliebigem JSON (KI-Antwort oder Speicher). null, wenn es
 * nichts taugt. `katalog` prüft den Schlüssel.
 */
export function angebotBereinigen(roh, katalog = null) {
  if (!istObj(roh)) return null;
  const name = txt(roh.name, 80);
  const preis = zahl(roh.preis);
  if (!name || !(preis > 0) || preis > 500) return null;
  const menge = zahl(roh.menge);
  const einheit = einheitNorm(roh.einheit);
  // katalog = null: nicht prüfen (liste.js kennt den Katalog nicht), sonst muss der Schlüssel drinstehen
  const gilt = (x) => typeof x === 'string' && (katalog ? !!katalog[x] : /^[a-z0-9-]{1,40}$/.test(x));
  const k = gilt(roh.k) ? roh.k : (gilt(roh.katalog) ? roh.katalog : '');
  const bis = /^\d{4}-\d{2}-\d{2}$/.test(String(roh.bis || '')) ? String(roh.bis) : '';
  return {
    id: ID.test(String(roh.id || '')) ? roh.id : neueId(),
    laden: ladenName(roh.laden) || 'Sonstige',
    name,
    preis: Math.round(preis * 100) / 100,
    menge: menge > 0 && einheit ? menge : null,
    einheit: menge > 0 && einheit ? einheit : '',
    bis,
    k,
  };
}

/** Eine Liste bereinigen, doppelte (gleicher Laden, gleicher Name) raus, höchstens MAX_ANGEBOTE. */
export function angeboteBereinigen(liste, katalog = null, max = MAX_ANGEBOTE) {
  const aus = [];
  const gesehen = new Set();
  for (const roh of Array.isArray(liste) ? liste : []) {
    const a = angebotBereinigen(roh, katalog);
    if (!a) continue;
    const s = `${a.laden}|${a.name.toLowerCase()}|${a.preis}`;
    if (gesehen.has(s)) continue;
    gesehen.add(s);
    aus.push(a);
    if (aus.length >= max) break;
  }
  return aus;
}

/**
 * Eine getippte Zeile: „Aldi Hähnchenbrustfilet 1 kg 7,49“, „Lidl: Paprika 500 g 1.29 €“,
 * „Rewe Skyr 500g 0,99“. Laden vorn (optional), Preis hinten.
 */
export function zeileLesen(zeile, katalog = {}) {
  let t = String(zeile || '').trim();
  if (!t) return null;
  let laden = '';
  const l = t.match(new RegExp(`^(${LAEDEN.join('|')})\\b[\\s:,-]*`, 'i'));
  if (l) { laden = ladenName(l[1]); t = t.slice(l[0].length); }
  const p = t.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?\s*$/i);
  if (!p) return null;
  const preis = zahl(p[1]);
  t = t.slice(0, p.index).trim().replace(/[\s,:-]+$/, '');
  let menge = null;
  let einheit = '';
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|stk|stück|stueck|st|dosen?|pck|packung(?:en)?|gl[aä]s(?:er)?|bund|stangen?|becher|flaschen?|netz|beutel)\b\.?\s*$/i);
  if (m) {
    menge = zahl(m[1]);
    einheit = einheitNorm(m[2]);
    t = t.slice(0, m.index).trim().replace(/[\s,:-]+$/, '');
  }
  if (!t) return null;
  return angebotBereinigen({ laden, name: t, preis, menge, einheit, k: schluesselRaten(t, katalog) }, katalog);
}

/**
 * Den Katalog-Schlüssel zu einem Angebotstext raten – nur sichere Treffer.
 * Verarbeitetes (Sauce, Creme, Chips, Shot …) ist keine Rezeptzutat, auch
 * wenn „Paprika“ oder „Reis“ im Namen steht; die Regeln mit roh: true gelten
 * nur für unverarbeitete Ware.
 */
const VERARBEITET = /sauce|soße|sosse|creme|crème|shot|drink|smoothie|rolle|torte|kuchen|gebäck|chips|flips|pulver|gewürz|dressing|aufstrich|mäuse|riegel|snack|pizza|suppe|eintopf|fertig|salat|marinade|mariniert|paniert|gefüllt|gegrillt|püree|sirup|konfitüre|marmelade|gelee|likör|bonbon|keks|waffel|cracker|nudel|teig|burger|nugget|schnitzel|spieß|würstchen|wurst|füllung|pastete|frikadelle|bällchen|röllchen|taschen|schnitte|knusper|rahm-|rahmspinat|rahmgemüse|\b(?:dip|mix|tee|wrap|bowl)\b|dr\. ?oetker|wagner|frosta|knorr|maggi|lay['’]?s|pringles|funny|chio|lorenz|bahlsen|milka|ferrero|haribo|kinder\b|nestl[eé]/i;

export function schluesselRaten(name, katalog = {}) {
  const n = String(name || '').toLowerCase().replace(/ß/g, 'ß');
  const verarbeitet = VERARBEITET.test(n);
  // [Muster, Schlüssel, nur roh?]
  const REGELN = [
    [/hähnchen.?brust|hühnerbrust|chicken breast|hähnchen.?innenfilet/, 'haehnchenbrust', true],
    [/oberkeule|hähnchen.?keule|hähnchenschenkel.*filet|hähnchen.?schenkel.?filet/, 'haehnchenkeule', true],
    [/puten.?brust|puten.?geschnetz|puten.?filet|puten.?steak/, 'putenbrust', true],
    [/rind.*hack.*(?:5 ?%|mager)|mager.*rind.*hack|tatar|rinder.?tatar/, 'rinderhack-mager', true],
    [/rinder?.?hack|hack.*rind|rinderhackfleisch/, 'rinderhack', true],
    [/rinder?.?gulasch|gulasch.*rind/, 'rindergulasch', true],
    [/rinder?.?hüft|hüftsteak|huftsteak|rumpsteak|aus der hüfte/, 'rinderhuefte', true],
    [/süßkartoffel|suesskartoffel|süsskartoffel/, 'suesskartoffel', true],
    [/kartoffel/, 'kartoffeln', true],
    [/frühlingszwiebel|lauchzwiebel|bundzwiebel/, 'fruehlingszwiebeln', true],
    [/rote zwiebel|zwiebeln?,? rot/, 'rote-zwiebeln', true],
    [/zwiebel/, 'zwiebeln', true],
    [/knoblauch/, 'knoblauch', true],
    [/ingwer/, 'ingwer', true],
    [/paprika/, 'paprika', true],
    [/zucchini/, 'zucchini', true],
    [/brokkoli|broccoli/, 'brokkoli', true],
    [/möhre|moehre|karotte/, 'moehren', true],
    [/champignon/, 'champignons', true],
    [/spinat/, 'spinat', true],
    [/zuckerschote|zuckererbse/, 'zuckerschoten', true],
    [/spitzkohl/, 'spitzkohl', true],
    [/weißkohl|weisskohl/, 'weisskohl', true],
    [/salatgurke|\bgurke/, 'gurke', true],
    [/kirschtomate|cherrytomate|cocktailtomate|rispentomate|romatomate|minitomate|miniroma|datteltomate/, 'kirschtomaten', true],
    [/passata|passierte tomaten/, 'passata', false],
    [/stückige tomaten|gehackte tomaten|tomaten.*dose|dosentomaten|tomaten.*stück|tomaten.*(?:in stücken|gestückelt)/, 'tomaten-dose', false],
    [/tomatenmark/, 'tomatenmark', false],
    [/getrocknete tomaten|tomaten.*getrocknet/, 'getr-tomaten', false],
    [/tomate/, 'tomaten', true],
    [/staudensellerie|stangensellerie/, 'staudensellerie', true],
    [/limette/, 'limette', true],
    [/zitrone/, 'zitrone', true],
    [/blumenkohl/, 'blumenkohl', true],
    [/aubergine/, 'aubergine', true],
    [/\blauch\b|porree/, 'lauch', true],
    [/kohlrabi/, 'kohlrabi', true],
    [/skyr/, 'skyr', true],
    [/magerquark|quark.*mager/, 'magerquark', false],
    [/frischkäse/, 'frischkaese', false],
    [/kochsahne|sahne zum kochen|küchensahne/, 'kochsahne', false],
    [/schlagsahne|schlagrahm/, 'schlagsahne', false],
    [/schmand/, 'schmand', false],
    [/\bmilch\b|frischmilch|vollmilch|h-milch|haltbare milch/, 'milch', true],
    [/cheddar/, 'cheddar', false],
    [/parmesan|parmigiano|\bgrana padano\b/, 'parmesan', false],
    [/\bfeta\b|hirtenkäse|schafskäse/, 'feta', false],
    [/gnocchi/, 'gnocchi', false],
    [/\bbutter\b(?!schmalz)/, 'butter', true],
    [/mozzarella.*light|light.*mozzarella/, 'mozzarella-light', false],
    [/mozzarella/, 'mozzarella', false],
    [/joghurt|jogurt/, 'joghurt', true],
    [/\beier\b|freilandeier|bodenhaltung.*eier/, 'eier', true],
    [/tofu/, 'tofu', false],
    [/erbsen/, 'erbsen', true],
    [/kokosmilch|kokosnussmilch/, 'kokosmilch', false],
    [/kidney/, 'kidney', false],
    [/schwarze bohnen/, 'schwarze-bohnen', false],
    [/\bmais\b|gemüsemais|zuckermais/, 'mais', false],
    [/kichererbsen/, 'kichererbsen', false],
    [/rote linsen/, 'linsen-rot', false],
    [/pesto/, 'pesto', false],
    [/ananas/, 'ananas-dose', false],
    [/gewürzgurke|cornichon/, 'gewuerzgurken', false],
    [/olivenöl|olivenoel/, 'olivenoel', false],
    [/oliven/, 'oliven', false],
    [/basmati|jasminreis|langkorn|parboiled|\breis\b/, 'reis', true],
    [/penne/, 'penne', false],
    [/spaghetti/, 'spaghetti', false],
    [/hörnchen|makkaroni|maccheroni/, 'hoernchen', false],
    [/kritharaki|orzo/, 'kritharaki', false],
    [/lasagne.?platten|lasagneblätter/, 'lasagne', false],
    [/mie.?nudel/, 'mie', false],
    [/bandnudel|tagliatelle/, 'bandnudeln', false],
    [/vollkorn.*nudel|vollkornpasta/, 'vollkornnudeln', false],
    [/couscous/, 'couscous', false],
    [/bulgur/, 'bulgur', false],
    [/tortilla|wraps?\b/, 'tortillas', true],
    [/erdnüsse|erdnusskerne|erdnuss(?!butter)(?!.?crunch)(?!öl)(?!.?öl)(?!.?flips)/, 'erdnuesse', true],
    [/cashew/, 'cashews', true],
    [/mandel/, 'mandeln', true],
    [/rosinen|sultaninen/, 'rosinen', true],
    [/rapsöl|sonnenblumenöl|pflanzenöl|bratöl/, 'oel', false],
    [/\bhonig\b|imkerhonig|blütenhonig|waldhonig/, 'honig', true],
    [/soja.?sauce|soja.?soße|sojasosse/, 'sojasauce', false],
    [/haferflocken/, 'haferflocken', false],
    [/äpfel|\bapfel\b|tafeläpfel/, 'aepfel', true],
    [/whey|proteinpulver|eiweißpulver/, 'whey-vanille', false],
    [/sweet.?chili.?(?:sauce|soße)/, 'sweetchili', false],
    [/(?:bbq|barbecue|grill).?(?:sauce|soße)/, 'bbq-sauce', false],
    [/ketchup/, 'ketchup', false],
    [/curry.?paste/, 'currypaste', false],
    [/ajvar/, 'ajvar', false],
    [/erdnussbutter|erdnussmus/, 'erdnussbutter', false],
    [/semmelbrösel|paniermehl/, 'semmelbroesel', false],
    [/speisestärke/, 'staerke', false],
    [/senf/, 'senf', false],
  ];
  for (const [re, k, roh] of REGELN) {
    if (!re.test(n) || !katalog[k]) continue;
    if (roh && verarbeitet) return '';
    return k;
  }
  return '';
}

/**
 * Packungsmenge aus einem Text, wie ihn die Läden schreiben: „je 500-g-Packung“,
 * „z. B. 1.000 g“, „4x85-g-Packung“, „je Ka. 20 x 0,5-l-Fl.“, „je 385 - 415-g-Packg.“
 * (dann die kleinere), „kg-Preis“, „je kg“, „Stück“, „3er-Packung“.
 * { menge, einheit } oder { menge: null, einheit: '' }.
 */
export function mengeAus(text) {
  let t = String(text || '').replace(/(\d)\.(\d{3})\b/g, '$1$2').replace(/,/g, '.').trim();
  if (!t) return { menge: null, einheit: '' };
  const multi = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*-?\s*(kg|g|ml|l)\b/i);
  if (multi) return { menge: Number(multi[1]) * Number(multi[2]), einheit: einheitNorm(multi[3]) };
  const m = t.match(/(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*-?\s*(kg|g|ml|l)\b/i);
  if (m) return { menge: Number(m[1]), einheit: einheitNorm(m[2]) };
  if (/\b(kg|kilo)\b/i.test(t) && /preis|je|pro/i.test(t)) return { menge: 1, einheit: 'kg' };
  if (/^(kg|je kg|kg-preis)$/i.test(t)) return { menge: 1, einheit: 'kg' };
  const er = t.match(/(\d+)\s*er(?:-| )?(?:packung|pack|set|tray)/i);
  if (er) return { menge: Number(er[1]), einheit: 'Stk' };
  const st = t.match(/(\d+)\s*(?:stück|stk|st\.)/i);
  if (st) return { menge: Number(st[1]), einheit: 'Stk' };
  if (/stück|^st\.?$|je st/i.test(t)) return { menge: 1, einheit: 'Stk' };
  if (/bund/i.test(t)) return { menge: 1, einheit: 'Bund' };
  if (/dose/i.test(t)) return { menge: 1, einheit: 'Dose' };
  if (/glas/i.test(t)) return { menge: 1, einheit: 'Glas' };
  return { menge: null, einheit: '' };
}

/** Schwein, Fisch & Co. – was die beiden nicht essen – fliegt aus den Angeboten raus. */
export const istTabu = (name) => VERBOTEN.test(String(name || ''));

/** Eine feste id aus Laden, Name und Preis – damit derselbe Artikel bei jedem Abruf dieselbe hat. */
export function stabileId(laden, name, preis) {
  const t = `${laden}|${String(name).toLowerCase()}|${preis}`;
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return `a-${h.toString(36).padStart(7, '0')}`;
}

/** Gramm je Einheit fürs Vergleichen – aus den Nährwerten (je) oder den festen Umrechnungen. */
function grammJe(a, naehrwerte) {
  if (!a.menge || !a.einheit) return 0;
  if (a.einheit === 'g' || a.einheit === 'ml') return a.menge;
  if (a.einheit === 'kg' || a.einheit === 'l') return a.menge * 1000;
  const n = a.k ? naehrwerte?.[a.k] : null;
  if (n && n.u === a.einheit && n.je) return a.menge * n.je;
  return 0;
}

/** Euro je Gramm eines Angebots – null, wenn die Menge fehlt. */
export function angebotJeG(a, naehrwerte) {
  const g = grammJe(a, naehrwerte);
  return g ? a.preis / g : null;
}

/** Richtpreis je Gramm aus daten.preise. */
const richtJeG = (k, preise) => preise?.[k]?.je_g ?? null;

/**
 * Welche Zutaten eines Rezepts im Angebot sind und was das pro Box spart
 * (gegen die Richtpreise). { treffer: [{ it, a, ersparnis }], ersparnisBox }.
 */
export function rezeptTreffer(r, angebote, { preise, naehrwerte } = {}) {
  const treffer = [];
  let ersparnis = 0;
  for (const it of r.items || []) {
    if (!it.k || it.opt || it.haus) continue;
    const passende = angebote.filter((a) => a.k === it.k);
    if (!passende.length) continue;
    // Das günstigste Angebot je Gramm zählt
    let best = null;
    for (const a of passende) {
      const je = angebotJeG(a, naehrwerte);
      const richt = richtJeG(it.k, preise);
      const g = it.g || 0;
      const sp = je !== null && richt !== null && g ? Math.max(0, (richt - je) * g) : 0;
      if (!best || sp > best.ersparnis) best = { it, a, ersparnis: sp };
    }
    treffer.push(best);
    ersparnis += best.ersparnis;
  }
  const n = r.portionen || 8;
  return { treffer, ersparnisBox: ersparnis / n };
}

/** Die Rezepte, die am meisten von den Angeboten haben: erst nach Treffern, dann nach Ersparnis. */
export function topRezepte(rezepte, angebote, daten, max = 12) {
  if (!angebote.length) return [];
  return rezepte
    .map((r) => ({ r, ...rezeptTreffer(r, angebote, daten) }))
    .filter((x) => x.treffer.length)
    .sort((a, b) => b.treffer.length - a.treffer.length || b.ersparnisBox - a.ersparnisBox)
    .slice(0, max);
}

/** Nur, was noch gilt (bis heute einschließlich) oder kein Datum hat. */
export function aktuelle(angebote, heute = new Date().toISOString().slice(0, 10)) {
  return (angebote || []).filter((a) => !a.bis || a.bis >= heute);
}

/** „1 kg 7,49 €“ */
export function angebotMenge(a) {
  const preis = `${a.preis.toFixed(2).replace('.', ',')} €`;
  if (!a.menge) return preis;
  const m = Number.isInteger(a.menge) ? String(a.menge) : String(a.menge).replace('.', ',');
  return `${m} ${a.einheit} ${preis}`;
}

/** Was die KI fürs Rezept zu sehen bekommt: eine Zeile je Angebot, nach Laden. */
export function angeboteText(angebote) {
  const nachLaden = {};
  for (const a of angebote) (nachLaden[a.laden] = nachLaden[a.laden] || []).push(a);
  return Object.entries(nachLaden)
    .map(([laden, liste]) => `${laden}: ${liste.map((a) => `${a.name} ${angebotMenge(a)}`).join('; ')}`)
    .join('\n');
}

/* ------------------------------------------------- die KI liest Prospekte */

export const ANGEBOTE_SCHEMA = {
  type: 'object',
  title: 'angebote',
  properties: {
    angebote: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          laden: { type: 'string', description: 'Aldi, Lidl, Rewe, Kaufland, Penny, Netto, Edeka, Norma oder wie im Prospekt' },
          name: { type: 'string', description: 'Produkt, wie es im Prospekt steht, kurz' },
          preis: { type: 'number', description: 'Angebotspreis in Euro, z. B. 7.49' },
          menge: { type: 'number', description: 'Packungsmenge, z. B. 1 bei 1 kg, 500 bei 500 g' },
          einheit: { type: 'string', description: 'g, kg, ml, l, Stk, Dose, Pck, Glas, Bund, Becher, Flasche, Netz, Beutel' },
          bis: { type: 'string', description: 'Letzter Gültigkeitstag als JJJJ-MM-TT, sonst leer' },
          katalog: { type: 'string', description: 'Schlüssel aus dem Katalog, wenn es die Zutat dort gibt, sonst leer' },
        },
        required: ['laden', 'name', 'preis'],
      },
    },
  },
  required: ['angebote'],
};

export function systemTextAngebote({ katalog, anbieter = 'gemini' }) {
  const kat = Object.entries(katalog || {})
    .filter(([, v]) => !['haushalt', 'gewuerz'].includes(v.c))
    .map(([k, v]) => `${k}=${v.n}`)
    .join('; ');
  return `Du liest Supermarkt-Angebote aus Fotos von Prospektseiten, Screenshots aus Supermarkt-Apps und getippten Zeilen heraus und gibst sie ${anbieter === 'gemini' ? 'als JSON genau nach dem vorgegebenen Schema' : 'mit dem Werkzeug angebote_ausgeben'} aus.

Nimm nur Lebensmittel, die sich zum Kochen eignen: Fleisch (kein Schwein, kein Fisch), Geflügel, Eier, Milchprodukte, Käse, Gemüse, Obst, Hülsenfrüchte, Reis, Nudeln, Kartoffeln, Konserven, Öl, Saucen, Nüsse. Keine Süßigkeiten, Getränke, Fertiggerichte, Wurst, Fisch, Schweinefleisch, Non-Food.

Je Angebot: laden (steht meist auf der Seite oder im Screenshot; wenn nicht erkennbar, aus dem Text des Nutzers), name kurz wie im Prospekt, preis als Zahl in Euro (der Angebotspreis, nicht der Streichpreis), menge und einheit der Packung (1 kg → menge 1, einheit kg; 500 g → 500, g; 3 Stück → 3, Stk; Dose → 1, Dose), bis als JJJJ-MM-TT, wenn eine Gültigkeit zu sehen ist, sonst leer.
katalog: der passende Schlüssel aus dieser Liste, wenn das Produkt dieser Zutat entspricht (Hähnchenbrustfilet → haehnchenbrust, Basmati → reis), sonst leer: ${kat}

Lies sorgfältig, erfinde nichts, lass Unleserliches weg. ${anbieter === 'gemini' ? 'Antworte nur mit dem JSON, ohne Text davor oder danach' : 'Antworte nur mit dem Werkzeug'}, Namen auf Deutsch.`;
}

export function nutzerTextAngebote({ text, fotos = 0 }) {
  const zeilen = [];
  if (fotos) zeilen.push(`${fotos === 1 ? 'Das Bild zeigt' : `Die ${fotos} Bilder zeigen`} Prospektseiten oder Screenshots mit Angeboten.`);
  const t = String(text || '').trim();
  if (t) zeilen.push('', 'Dazu getippt:', t);
  if (!zeilen.length) zeilen.push('Lies die Angebote aus.');
  return zeilen.join('\n');
}

/** Der Rumpf der Anfrage für den Anbieter – wie rumpfFuer in ki.js, nur fürs Auslesen. */
export function rumpfAngebote(anbieter, { fotos = [], text = '', katalog = {}, modell = {} }) {
  if (anbieter === 'gemini') {
    const input = fotos.map((b64) => ({ type: 'image', data: b64, mime_type: 'image/jpeg' }));
    input.push({ type: 'text', text: nutzerTextAngebote({ text, fotos: fotos.length }) });
    return {
      model: modell.gemini,
      system_instruction: systemTextAngebote({ katalog, anbieter }),
      input,
      response_format: { type: 'text', mime_type: 'application/json', schema: ANGEBOTE_SCHEMA },
      generation_config: { max_output_tokens: 12000 },
      store: false,
      stream: true,
    };
  }
  const inhalt = fotos.map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }));
  inhalt.push({ type: 'text', text: nutzerTextAngebote({ text, fotos: fotos.length }) });
  return {
    model: modell.anthropic,
    max_tokens: 12000,
    system: systemTextAngebote({ katalog, anbieter: 'anthropic' }),
    tools: [{ name: 'angebote_ausgeben', description: 'Gibt die gelesenen Angebote an die App.', input_schema: ANGEBOTE_SCHEMA }],
    tool_choice: { type: 'tool', name: 'angebote_ausgeben' },
    messages: [{ role: 'user', content: inhalt }],
  };
}
