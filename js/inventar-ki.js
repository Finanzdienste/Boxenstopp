/*
 * Sachen erkennen: ein Foto an die KI (derselbe Schlüssel wie bei der
 * Resteverwertung) – was ist das, welche Marke, welche ihrer Listen passt,
 * ein paar Tags und die Nummer unter dem Strichcode, wenn er zu sehen ist.
 * So füllt ein Foto die Felder einer neuen Sache, und wo der Browser keinen
 * Strichcode lesen kann (Safari auf iPhone und iPad kennt BarcodeDetector
 * nicht), liest ihn die KI vom Foto. Ohne DOM, tests/test-inventar.mjs prüft
 * Anfrage und Antwort.
 */
import { ANBIETER, ausgabeFuerClaude } from './ki.js';
import { tagsBereinigen } from './amy.js';
import { codeBereinigen, eanOk, MAX_NAME, MAX_MARKE } from './inventar.js';

export const ERKENNEN_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'was es ist, kurz und auf Deutsch, z. B. „Schwarze Lederjacke“ oder „Mascara Lash Sensational“ – leer, wenn nichts zu erkennen ist' },
    marke: { type: 'string', description: 'die Marke, wenn sie zu sehen ist – sonst leer' },
    liste: { type: 'string', description: 'welche ihrer Listen passt: genau einer der Namen aus der Anfrage – sonst leer' },
    tags: { type: 'array', items: { type: 'string' }, description: 'bis zu drei kurze Tags, etwa Farbe, Stoff oder Anlass' },
    code: { type: 'string', description: 'die Ziffern unter dem Strichcode, wenn einer zu sehen ist – nur Ziffern, sonst leer' },
  },
  required: ['name', 'marke', 'liste', 'tags', 'code'],
};

/** Der Auftrag. nurCode: Es geht nur um den Strichcode (der Rest ist dann egal). */
export function erkennenSystem({ listen = [], nurCode = false } = {}) {
  const namen = listen.filter(Boolean).slice(0, 30);
  return `Du hilfst, Sachen in einer App für eigene Listen einzutragen (Kleidung, Make-up, Schmuck und so weiter). Du bekommst ein Foto einer Sache – oder ihres Strichcodes.

So soll die Antwort aussehen:
- name: was es ist, kurz und auf Deutsch, wie man es selbst nennen würde: „Schwarze Lederjacke“, „Lippenstift Ruby Woo“, „Weiße Sneaker“. Steht der Produktname auf der Verpackung, nimm ihn.
- marke: die Marke, wenn sie zu lesen oder eindeutig zu erkennen ist – sonst leer. Nichts raten.
- liste: ${namen.length ? `welche dieser Listen passt – genau so geschrieben: ${namen.join(', ')}. Passt keine, leer.` : 'leer.'}
- tags: bis zu drei kurze Tags, die beim Sortieren helfen – Farbe, Stoff, Anlass oder Jahreszeit, etwa „schwarz“, „Leder“, „Winter“.
- code: Ist ein Strichcode zu sehen, die Ziffern darunter, ohne Leerzeichen – genau abgelesen, nicht geraten. Sonst leer.
${nurCode ? '\nHier geht es vor allem um den Strichcode: Lies die Ziffern besonders sorgfältig.\n' : ''}
Antworte nur mit dem JSON, ohne Text davor oder danach. Alles auf Deutsch.`;
}

/** Der Rumpf der Anfrage für Gemini (Interactions-API) oder Claude (Messages-API, JSON nach Schema). */
export function rumpfErkennen({ anbieter, b64, listen = [], nurCode = false }) {
  const text = nurCode ? 'Das ist der Strichcode einer Sache.' : 'Das ist die Sache.';
  if (anbieter === 'gemini') {
    return {
      model: ANBIETER.gemini.modell,
      system_instruction: erkennenSystem({ listen, nurCode }),
      input: [{ type: 'image', data: b64, mime_type: 'image/jpeg' }, { type: 'text', text }],
      response_format: { type: 'text', mime_type: 'application/json', schema: ERKENNEN_SCHEMA },
      generation_config: { max_output_tokens: 2000 },
      store: false,
      stream: true,
    };
  }
  return {
    model: ANBIETER.anthropic.modell,
    max_tokens: 2000,
    system: erkennenSystem({ listen, nurCode }),
    ...ausgabeFuerClaude(ERKENNEN_SCHEMA),
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text }] }],
  };
}

const zeile = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/**
 * Die Antwort für die Felder: { name, marke, liste (die id der passenden
 * Liste oder ''), tags, code }. Einen Code nimmt die App nur mit stimmender
 * Prüfziffer – lieber keiner als ein falsch abgelesener.
 * listen: [{ id, name }].
 */
export function erkanntBereinigen(roh, listen = []) {
  const r = roh && typeof roh === 'object' ? roh : {};
  const wunsch = zeile(r.liste, 80).toLocaleLowerCase('de');
  const liste = wunsch ? (listen.find((l) => String(l.name || '').trim().toLocaleLowerCase('de') === wunsch)?.id || '') : '';
  const code = codeBereinigen(r.code);
  return {
    name: zeile(r.name, MAX_NAME),
    marke: zeile(r.marke, MAX_MARKE),
    liste,
    tags: tagsBereinigen(Array.isArray(r.tags) ? r.tags.slice(0, 3) : []),
    code: eanOk(code) ? code : '',
  };
}
