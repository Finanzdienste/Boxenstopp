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
