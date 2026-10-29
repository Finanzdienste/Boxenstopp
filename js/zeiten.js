/*
 * Wie lange ein Rezept dauert – aus seinen Schritten gerechnet.
 *
 * Ein Rezept hat drei Abschnitte (Vorbereiten, Kochen, Portionieren), jeder
 * Schritt `min` Minuten, in denen man beschäftigt ist. Dazu:
 *
 *   ruhe   läuft nach dem Schritt im Hintergrund weiter (Marinieren, Ofen
 *          vorheizen, Reis quellen). Der Abschnitt ist erst fertig, wenn
 *          auch das vorbei ist.
 *   neben  „währenddessen“: passiert in der Zeit des Hauptschritts davor
 *          (Reis aufsetzen, während die Sauce köchelt) und kostet keine
 *          zusätzliche Zeit.
 *
 * Abschnitte werden auf 5 Minuten gerundet, die Gesamtzeit ist ihre Summe.
 * werkzeug/rezepte.py rechnet genauso (phase_minuten); tests/test-rezepte.mjs
 * prüft, dass beide dasselbe ergeben. Ohne DOM, damit die Tests es direkt
 * nutzen und die KI-Rezepte dieselbe Rechnung bekommen.
 */

export function phasenMinuten(schritte = []) {
  let t = 0;
  let ende = 0;
  let nebenAb = 0;
  for (const s of schritte) {
    const min = Number(s.min) || 0;
    const ruhe = Number(s.ruhe) || 0;
    if (s.neben) {
      const start = nebenAb;
      nebenAb += min;
      ende = Math.max(ende, start + min + ruhe);
    } else {
      const start = t;
      t += min;
      nebenAb = start;
      ende = Math.max(ende, t + ruhe);
    }
  }
  return Math.max(t, ende);
}

export const runden5 = (m) => Math.max(5, 5 * Math.floor(m / 5 + 0.5));

/** { phasen: [45, 60, 10], gesamt: 115 } */
export function zeitVon(r) {
  const phasen = (r.ablauf || []).map((p) => runden5(phasenMinuten(p.schritte)));
  return { phasen, gesamt: phasen.reduce((a, b) => a + b, 0) };
}

/** 115 → „1 Std. 55 Min.“, 45 → „45 Min.“, 120 → „2 Std.“ */
export function dauer(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} Min.`;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

/*
 * Braucht ein Schritt einen Timer? Nur, wenn danach etwas eine feste Zeit
 * läuft und man am Ende etwas tun muss: köcheln, backen, braten, garen,
 * marinieren, ruhen lassen. Wasser aufsetzen und Ofen vorheizen merkt man
 * von selbst, und was unter 3 Minuten dauert, zählt man im Kopf.
 *
 * Die Zeit steht im Text („15 Min. köcheln“; bei „8–10 Min.“ die kürzere,
 * dann nachsehen), sonst gilt die Wartezeit (ruhe). Verweise auf andere
 * Timer („sobald die 10–12 Min. um sind“, „4 Min. bevor der Timer
 * klingelt“, „alle 20 Min. umrühren“) sind keine eigene Zeit.
 *
 * Zwei Zeiten hintereinander werden zwei Stufen – der Timer meldet sich
 * nach der ersten mit dem, was jetzt zu tun ist, und läuft weiter:
 *   „12 Min. garen und 10 Min. ruhen lassen“  → 12, dann 10
 *   „35 Min. backen, nach 20 Min. wenden“     → 20 (wenden), dann 15
 *   „je Seite 5 Min. braten“                  → 5 (umdrehen), dann 5
 *
 * Ergebnis: { stufen: [{ min, dann }], min } – dann ist, was am Ende der
 * Stufe zu tun ist (leer bei der letzten), min die Summe. Sonst null.
 */
const DAUER = /(\d+(?:[,.]\d+)?)(?:\s*[–-]\s*\d+(?:[,.]\d+)?)?\s*(Min\.?|Minuten|Std\.?|Stunden?)(?![a-zäöüß])/gi;
const VERWEISE = [
  /sobald (?:die|der|das) [^,;:]*? um (?:sind|ist)/gi,
  /\d+(?:[,.]\d+)?\s*Min\.?\s*(?:bevor|nachdem) der Timer[^,;:]*/gi,
  /\balle \d+(?:[,.]\d+)?\s*(?:Min\.?|Minuten)/gi,
  /\d+(?:[,.]\d+)?\s*Min\.?\s*(?:weniger|kürzer)(?: kochen)? als (?:auf der Packung|angegeben)/gi,
  /^\s*nach \d+(?:[,.]\d+)?\s*(?:Min\.?|Minuten|Std\.?):/i,
];
const NUR_AUFHEIZEN = /\b(?:aufsetzen|vorheizen)\b/i;
const MIN_TIMER = 3;
const minuten = (zahl, einheit) => Math.round(parseFloat(String(zahl).replace(',', '.')) * (/^s/i.test(einheit) ? 60 : 1));

/** Der Text ohne Verweise auf andere Timer (gleich lang, damit die Stellen passen) und die Zeiten darin. */
function zeitenImText(text) {
  let rest = String(text || '');
  for (const re of VERWEISE) rest = rest.replace(re, (m) => ' '.repeat(m.length));
  return { rest, zeiten: [...rest.matchAll(DAUER)].map((m) => ({ min: minuten(m[1], m[2]), von: m.index, bis: m.index + m[0].length })) };
}

/**
 * Steht eine Garzeit im Schritt („15 Min. köcheln“, auch „2 Min. rösten“)?
 * Dann dauert er bei jedem gleich lang – das Tempo (tempo.js) rechnet ihn
 * nicht um. Schritte mit Wartezeit sind Arbeit plus Warten: Die Arbeit zählt.
 */
export const hatGarzeit = (s) => !Number(s?.ruhe) && zeitenImText(s?.d).zeiten.length > 0;

/** Die Minuten, die im Text stehen, zusammen („12 Min. garen und 10 Min. ruhen“ → 22) – 0, wenn keine. */
export const textMinuten = (text) => zeitenImText(text).zeiten.reduce((n, z) => n + z.min, 0);

export function timerPlan(s) {
  const text = String(s?.d || '');
  // „Timer auf 1 Min. weniger als auf der Packung (meist 8 Min.)“ → 7
  const packung = text.match(/(\d+)\s*Min\.?\s*(?:weniger|kürzer) als auf der Packung[^(]*\((?:meist|ca\.)\s*(\d+)\s*Min/i);
  if (packung) return plan([{ min: Number(packung[2]) - Number(packung[1]), dann: '' }]);
  const { rest, zeiten } = zeitenImText(text);
  if (!zeiten.length) {
    const ruhe = Number(s?.ruhe) || 0;
    return ruhe && !NUR_AUFHEIZEN.test(rest) ? plan([{ min: ruhe, dann: '' }]) : null;
  }
  const [a, b] = zeiten;
  const je = /je Seite\s*$/i.test(rest.slice(0, a.von));
  if (je && zeiten.length === 1) return plan([{ min: a.min, dann: 'umdrehen' }, { min: a.min, dann: '' }]);
  if (zeiten.length === 2) {
    // „35 Min. backen, nach 20 Min. wenden“ – die Zwischenzeit steht hinter „nach“
    if (/\bnach\s*$/i.test(rest.slice(0, b.von)) && b.min < a.min) {
      if (b.min < MIN_TIMER) return plan([{ min: a.min, dann: '' }]);
      const was = rest.slice(b.bis).match(/^\s*([^,;.]+)/)?.[1].trim() || 'weiter';
      return plan([{ min: b.min, dann: was }, { min: a.min - b.min, dann: '' }]);
    }
    // „12 Min. garen und 10 Min. ruhen lassen“, „…, dann Herd aus und 10 Min. ziehen lassen“
    const dazwischen = rest.slice(a.bis, b.von);
    const trenner = dazwischen.match(/,?\s*(?:und\s+)?dann\s+|\s+und\s+/);
    if (trenner) {
      const ab = a.bis + trenner.index + trenner[0].length;
      const was = text.slice(ab).match(/^[^,;.]*(?:\.(?=\s*[a-zäöü])[^,;.]*)*/)?.[0].trim();
      return plan([{ min: a.min, dann: was || 'weiter' }, { min: b.min, dann: '' }]);
    }
  }
  return plan([{ min: a.min, dann: '' }]);
}
function plan(stufen) {
  if (!stufen.every((x) => x.min > 0 && x.min <= 600)) return null;
  // „1 Min. rösten, dann 10 Min. köcheln“: die kurze erste Zeit zählt man im Kopf
  let s = stufen;
  while (s.length > 1 && s[0].min < MIN_TIMER) s = s.slice(1);
  if (s[0].min < MIN_TIMER) return null;
  return { stufen: s, min: s.reduce((n, x) => n + x.min, 0) };
}
/** „30 Min.“, „12 + 10 Min.“, „1 Std.“ – was auf dem Timer-Knopf steht. */
export function timerDauer(p) {
  if (!p) return '';
  if (p.stufen.length === 1) return dauer(p.min);
  return p.stufen.every((x) => x.min < 60) ? `${p.stufen.map((x) => x.min).join(' + ')} Min.` : p.stufen.map((x) => dauer(x.min)).join(' + ');
}

/**
 * Passen die „währenddessen“-Schritte in die Zeit, neben der sie laufen?
 * Gibt die Stellen zurück, an denen nicht: [{ phase, schritt, braucht, hat }].
 */
export function nebenZuLang(r) {
  const fehler = [];
  (r.ablauf || []).forEach((p, pi) => {
    let hat = 0;
    let braucht = 0;
    let ab = -1;
    const pruefe = () => { if (ab >= 0 && braucht > hat) fehler.push({ phase: pi, schritt: ab, braucht, hat }); };
    p.schritte.forEach((s, si) => {
      if (s.neben && ab < 0) { fehler.push({ phase: pi, schritt: si, braucht: Number(s.min) || 0, hat: 0 }); return; }
      if (s.neben) { braucht += Number(s.min) || 0; return; }
      pruefe();
      hat = (Number(s.min) || 0) + (Number(s.ruhe) || 0);
      braucht = 0;
      ab = si;
    });
    pruefe();
  });
  return fehler;
}
