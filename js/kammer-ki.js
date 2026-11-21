/*
 * Die Speisekammer per Foto füllen: Regal, Kühlschrank, Einkaufstüte – die KI
 * (derselbe Schlüssel wie bei der Resteverwertung) sagt, was zu sehen ist,
 * mit ungefährer Menge. Die App liest jede Zeile wie eine von Amys Zutaten
 * (amy.js zutatLesen) und findet so den Schlüssel im Katalog. Ohne DOM,
 * tests/test-speisekammer.mjs prüft Anfrage und Antwort.
 */
import { ANBIETER, ausgabeFuerClaude } from './ki.js';
import { zutatLesen } from './amy.js';

export const MAX_ERKANNT = 40;

export const KAMMER_SCHEMA = {
  type: 'object',
  properties: {
    sachen: {
      type: 'array',
      description: 'alle Lebensmittel, die zu sehen sind',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'was es ist, kurz auf Deutsch, wie im Supermarkt: „Basmatireis“, „Kokosmilch“, „Hähnchenbrustfilet“' },
          menge: { type: 'number', description: 'ungefähr wie viel noch da ist – 0, wenn nicht zu schätzen' },
          einheit: { type: 'string', description: 'g, ml oder Stk – leer, wenn menge 0 ist' },
        },
        required: ['name', 'menge', 'einheit'],
      },
    },
  },
  required: ['sachen'],
};

export const kammerSystem = () => `Du hilfst, eine digitale Speisekammer zu füllen. Du bekommst Fotos von Regal, Kühlschrank, Vorrat oder dem Einkauf.

Nenne jedes Lebensmittel, das zu sehen ist – Packungen, Dosen, Gläser, Obst und Gemüse, Kühlregal, Tiefkühl, Gewürze. Keine Haushaltssachen (Spülmittel, Küchenrolle), keine Möbel oder Geräte.
- name: kurz und auf Deutsch, so wie man es auf einen Einkaufszettel schreibt: „Basmatireis“, „Passierte Tomaten“, „Feta“, „Eier“. Steht der Produktname groß auf der Packung, nimm die Sorte, nicht die Marke.
- menge und einheit: ungefähr, wie viel noch da ist – eine volle 500-g-Packung 500 g, eine halbe 250 g; ein Becher 200 g; 6 Eier 6 Stk; eine Dose Kokosmilch 400 ml. Lässt es sich nicht schätzen, menge 0 und einheit leer.
- Dasselbe zweimal (zwei Dosen Mais): einmal, mit der Menge zusammen.
- Nichts erfinden, was nicht zu sehen ist.

Antworte nur mit dem JSON, ohne Text davor oder danach.`;

/** Der Rumpf für Gemini (Interactions-API) oder Claude (Messages-API, JSON nach Schema). */
export function rumpfKammer({ anbieter, fotos = [] }) {
  const text = fotos.length === 1 ? 'Was ist auf dem Foto?' : `Was ist auf den ${fotos.length} Fotos?`;
  if (anbieter === 'gemini') {
    return {
      model: ANBIETER.gemini.modell,
      system_instruction: kammerSystem(),
      input: [...fotos.map((b64) => ({ type: 'image', data: b64, mime_type: 'image/jpeg' })), { type: 'text', text }],
      response_format: { type: 'text', mime_type: 'application/json', schema: KAMMER_SCHEMA },
      generation_config: { max_output_tokens: 4000 },
      store: false,
      stream: true,
    };
  }
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 4000,
    system: kammerSystem(),
    ...ausgabeFuerClaude(KAMMER_SCHEMA),
    messages: [{ role: 'user', content: [...fotos.map((b64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })), { type: 'text', text }] }],
  };
}

const zeile = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

const ZAEHLEN = new Set(['Stk', 'Dose', 'Pck', 'Glas', 'Bund', 'Becher', 'Packung', 'Zehe']);

/** Ein unbekanntes Wort („Hackfleisch“): der kürzeste Katalog-Name, der es enthält („Rinderhackfleisch“). */
function imKatalog(name, katalog) {
  const w = String(name || '').toLocaleLowerCase('de');
  if (w.length < 4) return '';
  const treffer = Object.entries(katalog).filter(([, e]) => String(e?.n || '').toLocaleLowerCase('de').split(',')[0].includes(w));
  treffer.sort(([, a], [, b]) => String(a.n).length - String(b.n).length);
  return treffer[0]?.[0] || '';
}

/**
 * Getipptes oder Erkanntes als Posten für die Speisekammer: „500 g Hackfleisch“
 * → { k: 'rinderhack', name, cat, q: 500, u: 'g' }. Ohne Menge q null. Die
 * Einheit wird die, mit der die Rezepte rechnen (mehr.einheiten): „1 Dose
 * Kokosmilch“ bleibt 1 Dose, „1 Packung Feta“ wird 150 g (mehr.preise) – so
 * zieht „Heute gekocht“ später richtig ab.
 * mehr: { gleich, abteilungen, gemeint, einheiten, preise }.
 */
export function postenAusText(t, katalog = {}, mehr = {}) {
  const roh = zeile(t, 120);
  if (!roh) return null;
  const z = zutatLesen(roh, katalog, mehr);
  if (!z?.k || !z.kaufen) return null;
  let { k } = z;
  if (!katalog[k] && k.startsWith('amyz-')) k = imKatalog(z.name, katalog) || k;
  let q = typeof z.q === 'number' && z.q > 0 ? z.q : null;
  let u = q === null ? '' : z.u;
  const soll = mehr.einheiten?.[k];
  if (q !== null && soll && u !== soll) {
    const pack = mehr.preise?.[k];
    if (ZAEHLEN.has(u) && ZAEHLEN.has(soll)) u = soll;
    else if (ZAEHLEN.has(u) && pack?.u === soll && pack.menge > 0) { q *= pack.menge; u = soll; }
    else if (u === 'kg' && soll === 'g') { q *= 1000; u = 'g'; } else if (u === 'l' && soll === 'ml') { q *= 1000; u = 'ml'; } else if (['g', 'ml', 'kg', 'l'].includes(u) && ZAEHLEN.has(soll)) {
      // „400 ml Kokosmilch“, die Rezepte zählen Dosen: die Packung steht im Katalog („Dose à 400 ml“)
      const m = String(katalog[k]?.n || '').match(/(\d+(?:[.,]\d+)?)\s*(g|ml|kg|l)\b/i);
      const gross = m ? Number(m[1].replace(',', '.')) * (/^(?:kg|l)$/i.test(m[2]) ? 1000 : 1) : 0;
      const menge = q * (/^(?:kg|l)$/.test(u) ? 1000 : 1);
      if (gross > 0) { q = Math.round((menge / gross) * 4) / 4 || 1; u = soll; }
    }
  }
  const name = String(katalog[k]?.n || z.kat?.n || z.name).split(',')[0].trim();
  return { k, name, cat: katalog[k]?.c || z.kat?.c || 'sonstiges', q, u };
}

/** Mehrere Zeilen (Komma, Semikolon oder Zeilenumbruch) auf einmal. */
export const postenAusZeilen = (t, katalog = {}, mehr = {}) => String(t || '').split(/[\n;]+|,(?!\d)/).map((x) => postenAusText(x, katalog, mehr)).filter(Boolean);

/** Die Antwort der KI als Posten – dieselbe Zutat einmal (die Mengen zusammen, wenn die Einheit passt). */
export function erkanntAlsPosten(roh, katalog = {}, mehr = {}) {
  const sachen = Array.isArray(roh?.sachen) ? roh.sachen.slice(0, MAX_ERKANNT) : [];
  const aus = new Map();
  for (const s of sachen) {
    const name = zeile(s?.name, 80);
    if (!name) continue;
    const menge = typeof s.menge === 'number' && s.menge > 0 && s.menge < 1e5 ? s.menge : 0;
    const einheit = ['g', 'ml', 'Stk'].includes(s.einheit) ? s.einheit : '';
    const p = postenAusText(menge ? `${menge}${einheit === 'Stk' ? '' : ` ${einheit}`} ${name}` : name, katalog, mehr);
    if (!p) continue;
    const alt = aus.get(p.k);
    if (!alt) aus.set(p.k, p);
    else if (alt.q !== null && p.q !== null && alt.u === p.u) alt.q += p.q;
  }
  return [...aus.values()];
}

/**
 * Ein gescannter Strichcode, nachgeschlagen in Open Food Facts & Co.
 * (inventar-netz.js nachschlagen → { name, marke, notiz „Menge: 400 ml“ … }),
 * als Posten für die Speisekammer – oder null, wenn nichts Brauchbares dabei ist.
 */
export function kammerAusProdukt(treffer, katalog = {}, mehr = {}) {
  const name = zeile(treffer?.name, 80) || zeile(treffer?.marke, 60);
  if (!name) return null;
  const menge = zeile(String(treffer?.notiz || '').match(/^Menge:\s*(.+)$/m)?.[1] || '', 30).replace(/^(\d+)\s*[x×]\s*/i, '').match(/^\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cl)\b/i)?.[0].replace(/cl$/i, '0 ml') || '';
  return postenAusText(menge ? `${menge} ${name}` : name, katalog, mehr) || { k: `n:${name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`, name, cat: 'sonstiges', q: null, u: '' };
}
