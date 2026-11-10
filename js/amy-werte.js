/*
 * Nährwerte und Preis für Zutaten, die die App nicht kennt („Dino Nuggies“,
 * „1 Handvoll Parmesan“, „Gouda“, „Feta“ ohne Menge): Die KI schätzt je
 * Zeile, wie viel davon im Rezept steckt, die Werte pro 100 g und was diese
 * Menge im Supermarkt kostet. Das steht dann in der Liste unter
 * amyWerte[Rezept] – für alle Geräte –, und amyNaehrwerte/amyKosten (amy.js)
 * rechnen damit, wo der Katalog nichts weiß. Ohne DOM.
 *
 * Gefragt wird nur nach den offenen Zeilen (offeneZeilen in amy.js); die
 * Antwort ist JSON nach Schema (Gemini response_format, Claude output_config).
 */
import { ANBIETER, ausgabeFuerClaude } from './ki.js';
import { zeileSchluessel, wertBereinigen } from './amy.js';

/** Höchstens so viele Zeilen je Anfrage – mehr hat ein Rezept selten offen. */
export const MAX_ZEILEN = 40;

export const WERTE_SCHEMA = {
  type: 'object',
  properties: {
    zutaten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          zeile: { type: 'string', description: 'die Zeile genau so, wie sie in der Liste stand' },
          gramm: { type: 'number', description: 'wie viel davon im ganzen Rezept steckt, in Gramm (Flüssiges: ml wie g)' },
          kcal: { type: 'number', description: 'kcal pro 100 g' },
          p: { type: 'number', description: 'Eiweiß in g pro 100 g' },
          kh: { type: 'number', description: 'Kohlenhydrate in g pro 100 g' },
          f: { type: 'number', description: 'Fett in g pro 100 g' },
          eur: { type: 'number', description: 'was diese Menge im Supermarkt ungefähr kostet, in Euro' },
        },
        required: ['zeile', 'gramm', 'kcal', 'p', 'kh', 'f', 'eur'],
      },
    },
  },
  required: ['zutaten'],
};

export function werteSystem() {
  return `Du schätzt für eine Rezepte-App Nährwerte und Preise von Zutaten. Du bekommst den Namen eines Rezepts, für wie viele Portionen es ist, und einige Zutatenzeilen, so wie sie jemand getippt hat – auch mit Spitznamen („Nudlis“, „Dino Nuggies“ = Chicken Nuggets in Dinoform), englischen Wörtern oder ganz ohne Menge.

Für jede Zeile:
- zeile: die Zeile genau so, wie sie dastand.
- gramm: wie viel davon im ganzen Rezept steckt, in Gramm (Flüssiges: ml wie g). Steht keine Menge da, schätz, was für dieses Rezept und diese Portionen üblich ist. Steht da eine ganze Packung oder Flasche, aber gebraucht wird sicher nur ein Teil (Dressing, Soße, Öl), schätz den Teil. „1 Handvoll“ Käse oder Croutons sind etwa 20–30 g, ein Wrap etwa 60 g.
- kcal, p, kh, f: pro 100 g, wie auf einer typischen Packung in Deutschland.
- eur: was diese Menge im Supermarkt in Deutschland ungefähr kostet (normaler Preis, Eigenmarke oder Markenware wie üblich) – anteilig, wenn nur ein Teil der Packung gebraucht wird.

Schätz lieber realistisch als vorsichtig. Antworte nur mit dem JSON.`;
}

/** Was die KI bekommt: Rezept, Portionen und die offenen Zeilen. */
export function werteText(r, zeilen) {
  return `Rezept: ${String(r?.name || '').slice(0, 80)} (für ${Math.max(1, Number(r?.portionen) || 4)} Portionen)\nZutaten:\n${zeilen.slice(0, MAX_ZEILEN).map((z) => `- ${z}`).join('\n')}`;
}

export function rumpfWerte({ anbieter, r, zeilen }) {
  const text = werteText(r, zeilen);
  if (anbieter === 'gemini') {
    return {
      model: ANBIETER.gemini.modell,
      system_instruction: werteSystem(),
      input: [{ type: 'text', text }],
      response_format: { type: 'text', mime_type: 'application/json', schema: WERTE_SCHEMA },
      generation_config: { max_output_tokens: 4000 },
      store: false,
      stream: true,
    };
  }
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 4000,
    system: werteSystem(),
    ...ausgabeFuerClaude(WERTE_SCHEMA),
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
  };
}

/**
 * Die Antwort der KI → { [zeileSchluessel]: { g, kcal, p, kh, f, eur } } –
 * nur für Zeilen, nach denen gefragt war (zeilen).
 */
export function werteBereinigen(roh, zeilen) {
  const gefragt = new Set((zeilen || []).map(zeileSchluessel));
  const z = {};
  for (const x of Array.isArray(roh?.zutaten) ? roh.zutaten : []) {
    const k = zeileSchluessel(x?.zeile);
    const w = wertBereinigen(x);
    if (k && w && gefragt.has(k)) z[k] = w;
  }
  return z;
}

/** Ein kurzer Fingerabdruck der offenen Zeilen – damit ein Gerät dieselbe Frage nicht ständig neu stellt. */
export function zeilenAbdruck(zeilen) {
  let h = 0;
  for (const c of [...zeilen].map(zeileSchluessel).sort().join('\n')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
