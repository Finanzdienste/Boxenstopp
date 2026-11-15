/*
 * Angepinnt („Läuft gerade“, liste.json gepinnt) – wann ein Rezept nicht
 * mehr läuft. Neben „Heute gekocht“ und dem letzten abgehakten Schritt
 * (ansicht-rezepte.js) gibt es zwei Wege:
 *
 *   hakenZaehlen  Wer nach dem Anpinnen PIN_HAKEN Schritte abhakt, kocht es
 *                 gerade. Gezählt wird auf dem Gerät, das abhakt, und nur,
 *                 was nach dem Anpinnen dazukommt – Haken von früher bleiben
 *                 stehen, bis man sie zurücksetzt, und zählen nicht. Nach
 *                 „Wieder anpinnen“ bleibt es angepinnt (bleibtMerken).
 *   abgelaufen    Länger als PIN_TAGE angepinnt und nichts mehr offen dafür:
 *                 nichts davon auf der Einkaufsliste, nichts ab heute im
 *                 Essensplan. Dann ist es wohl längst gekocht – auch ohne
 *                 einen Haken und ohne „Heute gekocht“.
 *
 * Ohne DOM; tests/test-liste.mjs prüft es in Node.
 */

export const PIN_HAKEN = 3;
export const PIN_TAGE = 7;

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const tagIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Ein neuer Haken an einem angepinnten Rezept. merk: { <rid>: { pin, n, bleibt? } }
 * (das Gerät merkt es sich), pinAt: wann es angepinnt wurde – ein anderer
 * Zeitpunkt heißt neu angepinnt, dann fängt das Zählen von vorn an.
 * → { merk, gekocht }: gekocht, sobald PIN_HAKEN Haken beisammen sind.
 */
export function hakenZaehlen(merk, rid, pinAt) {
  const m = istObj(merk) ? { ...merk } : {};
  const alt = istObj(m[rid]) && m[rid].pin === pinAt ? m[rid] : null;
  if (alt?.bleibt) return { merk: m, gekocht: false };
  const n = (Number(alt?.n) || 0) + 1;
  if (n >= PIN_HAKEN) {
    delete m[rid];
    return { merk: m, gekocht: true };
  }
  m[rid] = { pin: pinAt, n };
  return { merk: m, gekocht: false };
}

/** Nach „Wieder anpinnen“: Dieses Anpinnen bleibt, egal wie viel noch abgehakt wird. */
export const bleibtMerken = (merk, rid, pinAt) => ({ ...(istObj(merk) ? merk : {}), [rid]: { pin: pinAt, n: 0, bleibt: true } });

/** Was das Gerät sich zu Rezepten merkt, die gar nicht mehr angepinnt sind, kann weg. */
export function merkAufraeumen(merk, gepinnt) {
  const g = istObj(gepinnt) ? gepinnt : {};
  return Object.fromEntries(Object.entries(istObj(merk) ? merk : {}).filter(([rid, e]) => istObj(e) && g[rid]?.at === e.pin));
}

/** Länger als PIN_TAGE angepinnt und nichts mehr offen dafür (Einkaufsliste, Essensplan ab heute)? */
export function abgelaufen(rid, pin, stand, jetzt = new Date()) {
  const t = Date.parse(pin?.at || '');
  if (!Number.isFinite(t) || jetzt.getTime() - t < PIN_TAGE * 864e5) return false;
  const s = istObj(stand) ? stand : {};
  const aufListe = Object.values(istObj(s.items) ? s.items : {}).some((d) => istObj(d?.parts?.[rid]) && !d.parts[rid].done);
  if (aufListe) return false;
  const heute = tagIso(jetzt);
  const tage = istObj(s.essensplan?.tage) ? s.essensplan.tage : {};
  return !Object.entries(tage).some(([tag, t2]) => tag >= heute && ['mittag', 'abend', 'kochen'].some((m) => (Array.isArray(t2?.[m]) ? t2[m] : []).some((e) => e?.rid === rid)));
}
