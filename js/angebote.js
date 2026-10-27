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
export function angeboteBereinigen(liste, katalog = null) {
  const aus = [];
  const gesehen = new Set();
  for (const roh of Array.isArray(liste) ? liste : []) {
    const a = angebotBereinigen(roh, katalog);
    if (!a) continue;
    const s = `${a.laden}|${a.name.toLowerCase()}|${a.preis}`;
    if (gesehen.has(s)) continue;
    gesehen.add(s);
    aus.push(a);
    if (aus.length >= MAX_ANGEBOTE) break;
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

/** Den Katalog-Schlüssel zu einem Angebotstext raten – nur sichere Treffer. */
export function schluesselRaten(name, katalog = {}) {
  const n = String(name || '').toLowerCase();
  const REGELN = [
    [/hähnchen.?brust|hühnerbrust|chicken breast/, 'haehnchenbrust'],
    [/oberkeule|hähnchen.?keule|hähnchenschenkel.*filet/, 'haehnchenkeule'],
    [/puten.?brust|puten.?geschnetz/, 'putenbrust'],
    [/rind.*hack.*(5|mager)|mager.*rind.*hack|tatar/, 'rinderhack-mager'],
    [/rinder?.?hack|hack.*rind/, 'rinderhack'],
    [/gulasch/, 'rindergulasch'],
    [/hüft|huft|rumpsteak/, 'rinderhuefte'],
    [/süßkartoffel|suesskartoffel/, 'suesskartoffel'],
    [/kartoffel/, 'kartoffeln'],
    [/rote zwiebel/, 'rote-zwiebeln'],
    [/zwiebel/, 'zwiebeln'],
    [/knoblauch/, 'knoblauch'],
    [/ingwer/, 'ingwer'],
    [/paprika/, 'paprika'],
    [/zucchini/, 'zucchini'],
    [/brokkoli|broccoli/, 'brokkoli'],
    [/möhre|moehre|karotte/, 'moehren'],
    [/champignon/, 'champignons'],
    [/spinat/, 'spinat'],
    [/zuckerschote/, 'zuckerschoten'],
    [/frühlingszwiebel|lauchzwiebel/, 'fruehlingszwiebeln'],
    [/spitzkohl/, 'spitzkohl'],
    [/weißkohl|weisskohl/, 'weisskohl'],
    [/salatgurke|\bgurke/, 'gurke'],
    [/kirschtomate|cherrytomate|cocktailtomate/, 'kirschtomaten'],
    [/passata|passierte tomaten/, 'passata'],
    [/stückige tomaten|gehackte tomaten|tomaten.*dose|dosentomaten|tomaten.*stück/, 'tomaten-dose'],
    [/tomatenmark/, 'tomatenmark'],
    [/tomate/, 'tomaten'],
    [/staudensellerie/, 'staudensellerie'],
    [/limette/, 'limette'],
    [/zitrone/, 'zitrone'],
    [/blumenkohl/, 'blumenkohl'],
    [/aubergine/, 'aubergine'],
    [/lauch|porree/, 'lauch'],
    [/kohlrabi/, 'kohlrabi'],
    [/skyr/, 'skyr'],
    [/magerquark/, 'magerquark'],
    [/frischkäse/, 'frischkaese'],
    [/kochsahne|sahne zum kochen/, 'kochsahne'],
    [/schlagsahne/, 'schlagsahne'],
    [/schmand/, 'schmand'],
    [/\bmilch\b/, 'milch'],
    [/cheddar/, 'cheddar'],
    [/parmesan|grana/, 'parmesan'],
    [/feta|hirtenkäse/, 'feta'],
    [/gnocchi/, 'gnocchi'],
    [/butter(?!schmalz)/, 'butter'],
    [/mozzarella.*light|light.*mozzarella/, 'mozzarella-light'],
    [/mozzarella/, 'mozzarella'],
    [/joghurt/, 'joghurt'],
    [/\beier\b|\bei\b/, 'eier'],
    [/tofu/, 'tofu'],
    [/erbsen/, 'erbsen'],
    [/kokosmilch/, 'kokosmilch'],
    [/kidney/, 'kidney'],
    [/schwarze bohnen/, 'schwarze-bohnen'],
    [/\bmais\b/, 'mais'],
    [/kichererbsen/, 'kichererbsen'],
    [/rote linsen/, 'linsen-rot'],
    [/pesto/, 'pesto'],
    [/ananas/, 'ananas-dose'],
    [/gewürzgurke|cornichon/, 'gewuerzgurken'],
    [/oliven/, 'oliven'],
    [/basmati|jasmin|\breis\b/, 'reis'],
    [/penne/, 'penne'],
    [/spaghetti/, 'spaghetti'],
    [/hörnchen|makkaroni|maccheroni/, 'hoernchen'],
    [/kritharaki|orzo/, 'kritharaki'],
    [/lasagne/, 'lasagne'],
    [/mie.?nudel/, 'mie'],
    [/bandnudel|tagliatelle/, 'bandnudeln'],
    [/vollkorn.*nudel/, 'vollkornnudeln'],
    [/couscous/, 'couscous'],
    [/bulgur/, 'bulgur'],
    [/tortilla|wrap/, 'tortillas'],
    [/erdnüsse|erdnuss(?!butter)(?!.?crunch)/, 'erdnuesse'],
    [/cashew/, 'cashews'],
    [/mandel/, 'mandeln'],
    [/rosinen/, 'rosinen'],
    [/olivenöl/, 'olivenoel'],
    [/rapsöl|sonnenblumenöl|pflanzenöl/, 'oel'],
    [/honig/, 'honig'],
    [/sojasauce|sojasoße/, 'sojasauce'],
    [/haferflocken/, 'haferflocken'],
    [/äpfel|apfel/, 'aepfel'],
    [/whey|proteinpulver/, 'whey-vanille'],
  ];
  for (const [re, k] of REGELN) if (re.test(n) && katalog[k]) return k;
  return '';
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
