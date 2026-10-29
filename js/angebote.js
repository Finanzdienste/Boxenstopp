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

export const LAEDEN = ['Aldi', 'Lidl', 'Rewe', 'Kaufland', 'Penny', 'Edeka', 'Norma'];
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
  const von = /^\d{4}-\d{2}-\d{2}$/.test(String(roh.von || '')) ? String(roh.von) : '';
  // Das Produktfoto des Händlers (nur aus dem Abruf): nur https, nichts, was aus dem Attribut ausbrechen könnte
  const bild = typeof roh.bild === 'string' && /^https:\/\/[^\s"'<>]{8,480}$/.test(roh.bild.trim()) ? roh.bild.trim() : '';
  return {
    id: ID.test(String(roh.id || '')) ? roh.id : neueId(),
    laden: ladenName(roh.laden) || 'Sonstige',
    name,
    preis: Math.round(preis * 100) / 100,
    menge: menge > 0 && einheit ? menge : null,
    einheit: menge > 0 && einheit ? einheit : '',
    bis,
    ...(von ? { von } : {}),
    k,
    ...(bild ? { bild } : {}),
  };
}

/**
 * Eine Liste bereinigen, doppelte (gleicher Laden, Name, Preis und Beginn)
 * raus, höchstens MAX_ANGEBOTE. Dasselbe Angebot diese und nächste Woche
 * bleibt zweimal – es gilt ja zweimal.
 */
export function angeboteBereinigen(liste, katalog = null, max = MAX_ANGEBOTE) {
  const aus = [];
  const gesehen = new Set();
  for (const roh of Array.isArray(liste) ? liste : []) {
    const a = angebotBereinigen(roh, katalog);
    if (!a) continue;
    const s = `${a.laden}|${a.name.toLowerCase()}|${a.preis}|${a.von || ''}`;
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
const VERARBEITET = /sauce|soße|sosse|creme|crème|shot|drink|smoothie|rolle\b|rollen\b|\btorte|torten\b|kuchen\b|gebäck|chips|flips|pulver|gewürz|dressing|aufstrich|mäuse|riegel|snack|pizza|suppe|eintopf|fertig|salat|marinade|mariniert|paniert|gefüllt|gegrillt|püree|sirup|konfitüre|marmelade|gelee|likör|bonbon|keks|waffel|cracker|nudel|teig|burger|nugget|schnitzel|spieß|würstchen|wurst|füllung|pastete|frikadelle|bällchen|röllchen|taschen|schnitte|strudel|laugen|knusper|aufschnitt|delikatess|dulano|bratkartoffel|geräuchert|geraeuchert|gemahlen|granuliert|gerebelt|edelsüß|erdbeer|pfirsich|maracuja|vanill|himbeer|heidelbeer|stracciatella|sahnejoghurt|auf frucht|fruchtjoghurt|rahm-|rahmspinat|rahmgemüse|crunchy|crispy|patties|cordon|hacksteak|roulade|\b(?:dip|mix|tee|wrap|bowl)\b|dr\. ?oetker|wagner|frosta|knorr|maggi|lay['’]?s|pringles|funny|chio|lorenz|bahlsen|milka|ferrero|haribo|kinder\b|nestl[eé]/i;

export function schluesselRaten(name, katalog = {}) {
  const n = String(name || '').toLowerCase().replace(/ß/g, 'ß');
  const verarbeitet = VERARBEITET.test(n);
  // [Muster, Schlüssel, nur roh?]
  const REGELN = [
    [/hähnchen.?brust|hühnerbrust|chicken breast|hähnchen.?innenfilet|hähnchen.?geschnetz|hähnchen.?streifen|hähnchen.?filet/, 'haehnchenbrust', true],
    [/oberkeule|hähnchen.?keule|hähnchenschenkel.*filet|hähnchen.?schenkel.?filet/, 'haehnchenkeule', true],
    [/puten.?brust|puten.?geschnetz|puten.?filet|puten.?mini.?filet|puten.?innen.?filet|puten.?steak/, 'putenbrust', true],
    [/rind.*hack.*(?:5 ?%|mager)|mager.*rind.*hack|tatar|rinder.?tatar/, 'rinderhack-mager', true],
    [/rinder?.?hack|hack.*rind|rinderhackfleisch/, 'rinderhack', true],
    [/rinder?.?gulasch|gulasch.*rind/, 'rindergulasch', true],
    [/rinder?.?hüft|hüftsteak|huftsteak|rumpsteak|aus der hüfte/, 'rinderhuefte', true],
    [/süßkartoffel|suesskartoffel|süsskartoffel/, 'suesskartoffel', true],
    [/kartoffel/, 'kartoffeln', true],
    [/frühlingszwiebel|lauchzwiebel|bundzwiebel/, 'fruehlingszwiebeln', true],
    [/rote (?:speise)?zwiebel|zwiebeln?,? rot/, 'rote-zwiebeln', true],
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
    [/kirschtomate|cherrytomate|cocktailtomate|romatomate|minitomate|miniroma|datteltomate|mini.?pflaumen.?tomate|pflaumentomate/, 'kirschtomaten', true],
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
    [/\bmais\b(?!\s*-?\s*h[äa]hn)|gemüsemais|zuckermais/, 'mais', false],
    [/kichererbsen/, 'kichererbsen', false],
    [/rote linsen/, 'linsen-rot', false],
    // Im Katalog steht Pesto Genovese – Pesto Rosso (getrocknete Tomaten) ist etwas anderes
    [/pesto(?![\s-]*rosso)/, 'pesto', false],
    [/ananas/, 'ananas-dose', false],
    [/gewürzgurke|cornichon/, 'gewuerzgurken', false],
    [/olivenöl|olivenoel/, 'olivenoel', false],
    [/oliven/, 'oliven', false],
    // Sushi- und Risottoreis kleben – kein Ersatz für Basmati oder Jasmin
    [/basmati|jasminreis|langkorn|parboiled|(?<!sushi.|risotto.|rundkorn.)\breis\b/, 'reis', true],
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
    [/weizenmehl|\bmehl\b/, 'mehl', false],
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
export function stabileId(laden, name, preis, von = '') {
  const t = `${laden}|${String(name).toLowerCase()}|${preis}${von ? `|${von}` : ''}`;
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

const MASSE = { g: 1, kg: 1000, ml: 1, l: 1000 };
/*
 * Gramm je Stück (Bund, Stange …), wie man es kauft – fürs Vergleichen, wenn
 * Angebot und Richtpreis verschiedene Einheiten haben (Zucchini „1 kg“ gegen
 * „1 Stück“). Sonst aus den Nährwerten (je); die zählen aber bei Zitrone und
 * Limette nur den Saft und bei Dosen und Gläsern das Abgetropfte – dort also
 * eigene Werte oder gar kein Vergleich über Gramm.
 */
const KAUF_G = {
  zitrone: 110, limette: 70,
  // Dosen mit Füllmenge, wie sie auf dem Angebot steht (400 g) – nicht abgetropft
  kidney: 400, 'schwarze-bohnen': 400, kichererbsen: 400, 'linsen-dose': 400, 'tomaten-dose': 400, kokosmilch: 400, 'kokosmilch-light': 400,
};
const OHNE_KAUFGEWICHT = new Set(['Dose', 'Glas', 'Pck', 'Zehe']);
function kaufGramm(k, einheit, naehrwerte) {
  if (MASSE[einheit]) return MASSE[einheit];
  if ((einheit === 'Stk' || einheit === 'Dose') && KAUF_G[k]) return KAUF_G[k];
  if (OHNE_KAUFGEWICHT.has(einheit)) return 0;
  const n = naehrwerte?.[k];
  return n && n.u === einheit && n.je > 0 ? n.je : 0;
}

/**
 * Wie viel günstiger ein Angebot ist als der Richtpreis seiner Zutat (der
 * übliche Discounter-Preis aus werkzeug/preise.py): 0.25 heißt 25 % günstiger,
 * negativ teurer. Gleiche Einheit: je Einheit; sonst je Gramm über das
 * Kaufgewicht. null, wenn es sich nicht ehrlich vergleichen lässt – keine
 * Rezeptzutat, keine Menge, Dose gegen Gramm.
 */
export function angebotRabatt(a, { preise, naehrwerte } = {}) {
  const r = a?.k ? preise?.[a.k] : null;
  if (!r || !(r.eur > 0) || !(r.menge > 0) || !(a.preis > 0) || !(a.menge > 0) || !a.einheit) return null;
  if (a.einheit === r.u) return 1 - (a.preis / a.menge) / (r.eur / r.menge);
  const gA = a.menge * kaufGramm(a.k, a.einheit, naehrwerte);
  const gR = r.menge * kaufGramm(a.k, r.u, naehrwerte);
  if (!gA || !gR) return null;
  return 1 - (a.preis / gA) / (r.eur / gR);
}

/**
 * „8,65 €/kg“ – je Kilo oder Liter, wenn die Packung in Gramm oder Litern
 * steht. Bei genau 1 kg oder 1 l nur mit immer: true (sonst steht es doppelt da).
 */
export function grundpreis(a, { immer = false } = {}) {
  const f = MASSE[a?.einheit];
  if (!f || !(a.menge > 0) || !(a.preis > 0) || (a.menge * f === 1000 && !immer)) return '';
  return `${((a.preis / (a.menge * f)) * 1000).toFixed(2).replace('.', ',')} €/${a.einheit === 'ml' || a.einheit === 'l' ? 'l' : 'kg'}`;
}

/** Ist das Hähnchen? Die Rezeptzutaten Brust und Keule – und anderes rohes Hähnchen (Schenkel, Flügel), keine Fertigware. */
const HAEHNCHEN_K = new Set(['haehnchenbrust', 'haehnchenkeule']);
export function istHaehnchen(a) {
  if (HAEHNCHEN_K.has(a?.k)) return true;
  const n = String(a?.name || '').toLowerCase();
  // Minutenschnitzel sind rohe, dünne Brustscheiben – sonst ist „Schnitzel“ meist paniert
  return /hähnchen|haehnchen|hühnchen|hühnerbrust|hühnerschenkel|hühnerkeule|huhn\b|chicken/.test(n) && !VERARBEITET.test(n.replace(/minuten(?:schnitzel|steaks?)/g, 'minuten'));
}

/**
 * Die besten Angebote zuerst: nach Rabatt gegen den Richtpreis, absteigend.
 * Was sich nicht vergleichen lässt, behält seine Reihenfolge und kommt ans Ende.
 */
export function nachRabatt(liste, daten) {
  return liste
    .map((a, i) => ({ a, i, r: angebotRabatt(a, daten) }))
    .sort((x, y) => (x.r === null) - (y.r === null) || (y.r ?? 0) - (x.r ?? 0) || x.i - y.i)
    .map((x) => x.a);
}

/** Ab diesem Rabatt gegen den Richtpreis zählt ein Angebot als günstig (Liste, Empfehlung, Plakette). */
export const GUENSTIG_AB = 0.05;

/** Je Zutat das Angebot mit dem größten Rabatt (ab GUENSTIG_AB), auf Wunsch nur aus einem Laden: Map k → { a, rabatt }. */
export function besteJeZutat(angebote, daten, { laden = '', ab = GUENSTIG_AB } = {}) {
  const m = new Map();
  for (const a of angebote || []) {
    if (!a?.k || (laden && a.laden !== laden)) continue;
    const rabatt = angebotRabatt(a, daten);
    if (rabatt === null || rabatt < ab) continue;
    const vorher = m.get(a.k);
    if (!vorher || rabatt > vorher.rabatt) m.set(a.k, { a, rabatt });
  }
  return m;
}

/**
 * Wo sich der Einkauf lohnt: je Laden, was dessen Angebote am Bedarf sparen.
 * bedarf: { k: Euro zum Richtpreis } – die offenen Einträge der Liste, oder
 * was ein Rezept im Schnitt davon braucht. Die übrigen Sachen sind gleich
 * teuer gerechnet (Richtpreis). Absteigend nach Ersparnis:
 * [{ laden, ersparnis, treffer: [{ k, a, rabatt, ersparnis }] }].
 */
export function ladenWahl(bedarf, angebote, daten, { ab = GUENSTIG_AB } = {}) {
  const laeden = [...new Set((angebote || []).map((a) => a.laden).filter(Boolean))];
  return laeden
    .map((laden) => {
      const beste = besteJeZutat(angebote, daten, { laden, ab });
      const treffer = [];
      for (const [k, eur] of Object.entries(bedarf || {})) {
        const b = beste.get(k);
        if (b && eur > 0) treffer.push({ k, a: b.a, rabatt: b.rabatt, ersparnis: b.rabatt * eur });
      }
      treffer.sort((x, y) => y.ersparnis - x.ersparnis);
      return { laden, ersparnis: treffer.reduce((s, t) => s + t.ersparnis, 0), treffer };
    })
    .filter((x) => x.treffer.length)
    .sort((x, y) => y.ersparnis - x.ersparnis || y.treffer.length - x.treffer.length || x.laden.localeCompare(y.laden, 'de'));
}

/** „−24 %“ */
export const rabattText = (r) => `−${Math.round(r * 100)} %`;

/**
 * Für die Einkaufsliste: je Zutat die Angebote aller Läden, je Laden nur das
 * beste, das günstigste zuerst (größter Rabatt gegen den Richtpreis, also
 * auch der niedrigste Preis je kg; Unvergleichbares danach).
 * Map k → [{ a, rabatt }].
 */
export function angeboteJeZutat(angebote, daten) {
  const m = new Map();
  for (const a of angebote || []) {
    if (!a?.k) continue;
    if (!m.has(a.k)) m.set(a.k, []);
    m.get(a.k).push({ a, rabatt: angebotRabatt(a, daten) });
  }
  for (const [k, liste] of m) {
    liste.sort((x, y) => (x.rabatt === null) - (y.rabatt === null) || (y.rabatt ?? 0) - (x.rabatt ?? 0));
    const gesehen = new Set();
    m.set(k, liste.filter((x) => !gesehen.has(x.a.laden) && gesehen.add(x.a.laden)));
  }
  return m;
}

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
    // Das Angebot mit dem größten Rabatt zählt – auf die Menge, die das Rezept braucht
    let best = null;
    for (const a of passende) {
      const rabatt = angebotRabatt(a, { preise, naehrwerte });
      const richt = richtJeG(it.k, preise);
      const g = it.g || 0;
      const sp = rabatt !== null && richt !== null && g ? Math.max(0, rabatt * richt * g) : 0;
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

/*
 * Wochen: Angebote gelten Montag bis Samstag. „Diese Woche“ heißt vom
 * nächsten Einkaufstag (heute, sonntags schon der Montag) bis Samstag,
 * „nächste Woche“ die Woche danach. Ein Angebot gehört zu einer Woche, wenn
 * es an einem ihrer Tage gilt – was Donnerstag bis Mittwoch läuft, steht in
 * beiden. Gerechnet in der Zeit des Handys.
 */
const zwei = (n) => String(n).padStart(2, '0');
const tagText = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
/** ISO-Kalenderwoche eines Datums: 45 */
export function kalenderwoche(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 3 - ((x.getUTCDay() + 6) % 7));
  const erster = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((x - erster) / 86400000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7);
}
/** { von, bis, kw, montag } der Woche – art 'diese' oder 'naechste'. */
export function woche(art = 'diese', jetzt = new Date()) {
  const start = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  if (start.getDay() === 0) start.setDate(start.getDate() + 1);
  const montag = new Date(start);
  montag.setDate(start.getDate() - ((start.getDay() + 6) % 7) + (art === 'naechste' ? 7 : 0));
  const samstag = new Date(montag);
  samstag.setDate(montag.getDate() + 5);
  return { von: tagText(art === 'naechste' ? montag : start), bis: tagText(samstag), kw: kalenderwoche(montag), montag: tagText(montag) };
}
/** Gilt das Angebot an einem Tag dieser Woche? */
export const giltIn = (a, w) => (!a.bis || a.bis >= w.von) && (!a.von || a.von <= w.bis);
export const inWoche = (liste, w) => (liste || []).filter((a) => giltIn(a, w));
/** „ab Do.“, wenn ein Angebot erst später in der Woche beginnt – sonst leer. */
export function abText(a, w) {
  if (!a.von || a.von <= w.von) return '';
  const d = new Date(`${a.von}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : `ab ${['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][d.getDay()]}`;
}

/**
 * Das beste Rezept, wenn man nur in einen Laden geht: das mit den meisten
 * Zutaten dort im Angebot, bei Gleichstand das, was am meisten spart.
 * Für jeden Laden eins: [{ laden, r, treffer, ersparnisBox }], beste zuerst.
 */
export function besteJeLaden(rezepte, angebote, daten) {
  const laeden = [...new Set(angebote.filter((a) => a.k).map((a) => a.laden))];
  return laeden.map((laden) => {
    const [best] = topRezepte(rezepte, angebote.filter((a) => a.laden === laden), daten, 1);
    return best ? { laden, ...best } : null;
  }).filter(Boolean)
    .sort((a, b) => b.treffer.length - a.treffer.length || b.ersparnisBox - a.ersparnisBox || LAEDEN.indexOf(a.laden) - LAEDEN.indexOf(b.laden));
}

/** Preis je kg, l oder Stück: { wert, u } – null, wenn es sich nicht rechnen lässt. */
export function einheitsPreis(a) {
  if (!(a?.preis > 0) || !(a.menge > 0)) return null;
  const f = MASSE[a.einheit];
  if (f) return { wert: (a.preis / (a.menge * f)) * 1000, u: a.einheit === 'ml' || a.einheit === 'l' ? 'l' : 'kg' };
  if (/^(?:stk|stück|st)\.?$/i.test(String(a.einheit))) return { wert: a.preis / a.menge, u: 'Stk' };
  return null;
}
/** „5,99 €/kg“ */
export const preisJe = (wert, u) => `${Number(wert).toFixed(2).replace('.', ',')} €/${u}`;

const wortStaemme = (t) => String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2).map((w) => w.slice(0, Math.max(4, w.length - 2)));
/**
 * Passt ein Angebot zu einem Preisalarm? Katalog-Zutaten über den Schlüssel,
 * Eigenes („Dino Nuggets“) über den Namen: Jedes Wort des Alarms steckt im
 * Namen des Angebots.
 */
export function passtZumAlarm(a, k, alarm, katalog = {}) {
  if (katalog[k]) return a?.k === k;
  const woerter = wortStaemme(alarm?.name || '');
  if (!woerter.length) return false;
  const name = String(a?.name || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  return woerter.every((w) => name.includes(w));
}
/** Die Treffer aller Preisalarme in den Angeboten: [{ k, alarm, a, preis }] – je Alarm das günstigste. */
export function preisalarmTreffer(alarme, angebote, katalog = {}) {
  const aus = [];
  for (const [k, alarm] of Object.entries(alarme || {})) {
    let best = null;
    for (const a of angebote || []) {
      const ep = einheitsPreis(a);
      if (!ep || ep.u !== alarm.u || ep.wert > alarm.max + 1e-9 || !passtZumAlarm(a, k, alarm, katalog)) continue;
      if (!best || ep.wert < best.preis) best = { k, alarm, a, preis: ep.wert };
    }
    if (best) aus.push(best);
  }
  return aus.sort((x, y) => x.preis / x.alarm.max - y.preis / y.alarm.max);
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
          laden: { type: 'string', description: 'Aldi, Lidl, Rewe, Kaufland, Penny, Edeka, Norma oder wie im Prospekt' },
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

Je Angebot: laden (steht meist auf der Seite oder im Screenshot; wenn nicht erkennbar, aus dem Text des Nutzers), name kurz wie im Prospekt, preis als Zahl in Euro (der Angebotspreis für alle, nicht der Streichpreis und nicht ein Preis, der nur mit App oder Kundenkarte gilt – Lidl Plus, Kaufland Card, Payback), menge und einheit der Packung (1 kg → menge 1, einheit kg; 500 g → 500, g; 3 Stück → 3, Stk; Dose → 1, Dose), bis als JJJJ-MM-TT, wenn eine Gültigkeit zu sehen ist, sonst leer.
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
      // Auslesen braucht kein langes Nachdenken – und die Denk-Tokens zählen mit in die Ausgabegrenze
      generation_config: { max_output_tokens: 32000, thinking_level: 'low' },
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
