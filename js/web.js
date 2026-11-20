/*
 * Rezepte aus dem Netz ohne Claude (Tobi, 20.11.2026): die Supabase-Funktion
 * rezept-web (Repo Amy) liest eine Seite (das Rezept aus ihrem JSON-LD, sonst
 * ihren Text – robots.txt zuerst) und sucht mit Tavily. Gemini schreibt dann
 * aus den Treffern, was sonst Claude mit seiner eigenen Suche schreibt.
 *
 *   seiteLesen(url)      → { url, titel, rezept | null, text }
 *   suchen(q)            → [{ titel, url, text }]
 *   mitWebsuche(rumpf)   wie ki.js kiMitWerkzeugen ({ text, quellen, usage }) –
 *                        mit Claude, wenn es geht (Schlüssel von Anthropic, Guthaben da);
 *                        sonst Tavily + Gemini (der Hauptschlüssel, wenn er von
 *                        Google ist, oder der Ersatz)
 *   alsAmyRezept(r, url) das Rezept einer Seite im Format von „Rezept übernehmen“
 *
 * Die Funktion weist sich mit der Prüfsumme des Schlüssels aus (wie
 * produkt-bild), nie mit dem Schlüssel selbst. Gemini mit Google-Suche wird
 * nicht benutzt – gesucht wird nur über Tavily.
 */
import { kiMitWerkzeugen, kiAnfragen, alsGemini, anbieterVon, schluesselPruefsumme, claudeLeer, claudeLeerMerken, ersatzSchluessel } from './ki.js';

export const REZEPT_WEB = 'https://vjyohppohmvhhxgwouti.supabase.co/functions/v1/rezept-web';
let adresse = REZEPT_WEB;
/** Für die Tests: eine andere Adresse der Funktion. */
export const webAdresse = (a) => { adresse = a || REZEPT_WEB; };

const MELDUNG = {
  401: 'Die Suche kennt euren Schlüssel nicht.',
  403: 'Die Suche kennt euren Schlüssel nicht – seine Prüfsumme gehört in Supabase unter ERLAUBTE_SCHLUESSEL (Einstellungen → KI-Schlüssel → Prüfsumme kopieren).',
  415: 'Das ist keine Webseite.',
  422: 'Diese Adresse liest die App nicht.',
  429: 'Das Gratis-Kontingent der Suche ist für diesen Monat aufgebraucht.',
  451: 'Diese Seite möchte nicht von Programmen gelesen werden. Kopier das Rezept lieber als Text hinein.',
  503: 'Die Suche ist noch nicht eingerichtet.',
};
const fehlerVon = (status, text) => Object.assign(new Error(MELDUNG[status] || text || 'Das Netz ging gerade nicht.'), { art: status === 429 ? 'grenze' : 'web', status });

/** Die Schlüssel, mit denen die Funktion es versucht: der Hauptschlüssel, dann der Ersatz. */
const schluesselFuer = (haupt) => [...new Set([haupt, ersatzSchluessel()].filter((s) => anbieterVon(s)))];

async function fragen(eingabe, { schluessel, signal } = {}) {
  let letzter = null;
  for (const s of schluesselFuer(schluessel)) {
    let res;
    try {
      res = await fetch(adresse, { method: 'POST', headers: { 'content-type': 'application/json', 'x-schluessel-hash': await schluesselPruefsumme(s) }, body: JSON.stringify(eingabe), signal });
    } catch (e) {
      if (e?.name === 'AbortError') throw Object.assign(new Error('Abgebrochen.'), { art: 'abbruch' });
      throw fehlerVon(0, 'Keine Verbindung – ohne Netz?');
    }
    if (res.ok) return res.json();
    letzter = fehlerVon(res.status, await res.text().catch(() => ''));
    // Kennt die Funktion den einen Schlüssel nicht, vielleicht den anderen
    if (res.status !== 403) throw letzter;
  }
  throw letzter || fehlerVon(401);
}

export const seiteLesen = (seite, opt) => fragen({ art: 'seite', seite }, opt);
export const suchen = async (q, { max = 5, seiten = true, ...opt } = {}) => (await fragen({ art: 'suche', q, max, seiten }, opt))?.ergebnisse || [];

/** Das Rezept einer Seite (JSON-LD) im Format von „Rezept übernehmen“ (amy-import.js importBereinigen). */
export const alsAmyRezept = (r, url) => ({ name: r.name, portionen: r.portionen || 4, zeit: r.minuten || 0, zutaten: r.zutaten, schritte: r.schritte, notiz: url ? `Quelle: ${url}` : '', tags: [] });

/** Die Treffer als Text für Gemini. */
export function trefferText(treffer) {
  return treffer.map((t, i) => `[${i + 1}] ${t.titel || '(ohne Titel)'}\n${t.url}\n${String(t.text || '').slice(0, 4000)}`).join('\n\n');
}

const HINWEIS = 'Du kannst hier nicht selbst im Internet suchen oder Seiten öffnen. Die Suche ist schon gemacht – die Treffer stehen unten in der Anfrage. Nimm nur, was dort steht; als Quelle oder Seite nur Adressen aus diesen Treffern, nichts erfinden. Steht dort nichts Passendes, sag das so, wie es das Format vorsieht.';

/**
 * Suchen und schreiben: mit Claude (Websuche), wenn es geht – sonst Tavily
 * (suche: { q, max, seiten }) und Gemini (mit schema als festem Format). Gibt { text, quellen, usage, anbieter }.
 */
export async function mitWebsuche(rumpf, { schluessel, signal, berater = true, suche, schema = null }) {
  const claude = anbieterVon(schluessel) === 'anthropic' && !claudeLeer();
  if (claude) {
    try {
      return { ...(await kiMitWerkzeugen(rumpf, { schluessel, signal, berater })), anbieter: 'anthropic' };
    } catch (e) {
      if (e?.art !== 'guthaben' || !ersatzSchluessel()) throw e;
      claudeLeerMerken();
    }
  }
  const gemini = anbieterVon(schluessel) === 'gemini' ? schluessel : ersatzSchluessel();
  if (!gemini) throw Object.assign(new Error('Für die Suche braucht es Claude-Guthaben oder einen Gemini-Schlüssel als Ersatz (Einstellungen → KI-Schlüssel).'), { art: 'guthaben' });
  const treffer = await suchen(suche.q, { max: suche.max || 5, seiten: suche.seiten !== false, schluessel, signal });
  const g = alsGemini({ ...rumpf, tools: [] });
  if (!g) throw Object.assign(new Error('Das geht nur mit Claude.'), { art: 'antwort' });
  if (schema) g.response_format = { type: 'text', mime_type: 'application/json', schema };
  g.system_instruction = `${g.system_instruction ? `${g.system_instruction}\n\n` : ''}${HINWEIS}`;
  g.input = [...g.input, { type: 'text', text: `Treffer der Suche nach „${suche.q}“:\n\n${treffer.length ? trefferText(treffer) : '(keine Treffer)'}` }];
  const antwort = await kiAnfragen(g, { schluessel: gemini, signal, roh: true });
  return { text: antwort.text, quellen: treffer.map((t) => ({ url: t.url, titel: t.titel })), usage: antwort.usage, anbieter: 'gemini' };
}
