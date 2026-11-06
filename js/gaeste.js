/*
 * Gäste und der Überblick des Gastgebers – der Rechenteil, ohne DOM
 * (tests/test-gaeste.mjs prüft ihn direkt in Node).
 *
 * Ein Gast (Marielle) hat eine eigene Liste in einem eigenen privaten Repo.
 * Eingeladen wird auf Tobis Handy (ansicht-gaeste.js); das merkt sich, wen
 * es eingeladen hat – mit dem Schlüssel des Gasts, nur in seinem
 * localStorage, damit der Überblick ihre Liste lesen kann.
 *
 * Der Überblick liest keine Inhalte, sondern die Commits an liste.json
 * (speicher.js commitsLesen): Jeder Commit der App heißt
 * „Amy: Einkaufsliste, 3 Änderungen – Chili auf die Liste; 2 abgehakt“ –
 * wer, wann, wie viel, was. Ältere Commits haben das „was“ noch nicht.
 * Daraus: je Person zuletzt, Änderungen je Tag und Bereich, und ein Verlauf
 * mit Sitzungen (was eine Person in einem Rutsch gemacht hat).
 *
 * Die Liste eines Gasts hat eine Person – auf jedem Gerät, wie sie sich dort
 * auch nennt: Auf dem einen Gerät heißt Marielle „Marielle“ (aus dem Link),
 * auf dem nächsten hat sie „Marielli“ eingetippt. Dort zählt also alles für
 * den Gast, mit dem Namen aus der Einladung; nur die Einladung selbst bleibt
 * beim Gastgeber. Und „zum ersten Mal dabei“ gibt es je Person einmal – das
 * nächste ist ein weiteres Gerät.
 */

const NAME = /^[\p{L}\p{N} ._-]{1,30}$/u;
const REPO = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
/** Was nicht von einer Person kommt, sondern von den Abläufen im Daten-Repo. */
const AUTOMATIK = /^(?:Push|Haushalt|Angebote(?: \(privat\))?|To Do|Microsoft|Bescheid)$/i;
export const BEREICHE = ['Einkauf', 'Kochen', 'Rezepte', 'Haushalt', 'Ziel', 'Sonstiges'];
/** So lange gehören zwei Commits derselben Person zu einer Sitzung. */
const SITZUNG_MIN = 20;

/** Die Gäste aus dem Speicher dieses Geräts – nur was gültig aussieht. */
export function gaesteBereinigen(x) {
  if (!Array.isArray(x)) return [];
  const gesehen = new Set();
  return x.filter((g) => g && typeof g === 'object' && NAME.test(String(g.name || '')) && REPO.test(String(g.daten || '')) && /^[A-Za-z0-9_]{20,255}$/.test(String(g.token || '')))
    .filter((g) => (gesehen.has(g.daten) ? false : gesehen.add(g.daten)))
    .map((g) => ({ name: g.name, daten: g.daten, token: g.token, farbe: g.farbe === 'lila' ? 'lila' : '', at: typeof g.at === 'string' ? g.at : '', ki: g.ki === true }))
    .slice(0, 12);
}

/** Aus einem Namen der Vorschlag fürs Repo: „Marielle“ → „Boxenstopp-Marielle“. */
export function repoVorschlag(name) {
  const s = String(name || '').trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s ? `Boxenstopp-${s}` : '';
}

/**
 * Eine Commit-Nachricht lesen: { wer, auto, anzahl, was: ['Chili auf die Liste', …] }.
 * Nicht von der App (von Hand, unbekannt): wer ''.
 */
export function nachrichtLesen(text) {
  const t = String(text || '').split('\n')[0].trim();
  const m = /^([^:]{1,40}):\s*(.*)$/.exec(t);
  if (!m) return { wer: '', auto: false, anzahl: 1, was: [] };
  const wer = m[1].trim();
  let rest = m[2].replace(/\s*·\s*(?:Bescheid|To Do|Test)\b/g, '').trim();
  if (AUTOMATIK.test(wer)) return { wer, auto: true, anzahl: 1, was: rest ? [rest] : [] };
  const n = /^Einkaufsliste,\s*(\d+)\s+Änderung(?:en)?/.exec(rest);
  const anzahl = n ? Math.max(1, Number(n[1])) : 1;
  if (n) {
    const i = rest.indexOf(' – ');
    rest = i >= 0 ? rest.slice(i + 3) : '';
  }
  const was = rest.split(/;\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  return { wer, auto: false, anzahl, was };
}

/** Zu welchem Bereich ein Stück „was“ gehört. */
export function bereichVon(was) {
  const s = String(was || '');
  if (/Putzplan|Haushalt/.test(s)) return 'Haushalt';
  if (/auf die Liste|abgehakt|von der Liste|Liste geleert|eingekauft|Bon|Preisalarm|Weg durch/.test(s)) return 'Einkauf';
  if (/gekocht|^kocht /.test(s)) return 'Kochen';
  if (/Rezept|bewertet|Notiz|behalten|Einladung/.test(s)) return 'Rezepte';
  if (/Ziel|dabei/.test(s)) return 'Ziel';
  return 'Sonstiges';
}

const tagVon = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DABEI = 'zum ersten Mal dabei';
const NOCH_EIN_GERAET = 'auf einem weiteren Gerät dabei';

/**
 * Den Verlauf mehrerer Listen zusammenfassen.
 * listen: [{ id, name, farbe, gast, eintraege: [{ sha, at, nachricht }] }]
 *   gast: in der Liste eines Gasts sein Name – dann ist jeder dort der Gast
 * → { personen, tage, verlauf, automatik }
 *   personen: [{ name, liste, zuletzt, anzahl, jeTag: [n …], bereiche: { Einkauf: n } }] (zuletzt aktiv zuerst)
 *   tage: die Tage des Zeitraums (YYYY-MM-DD, ältester zuerst)
 *   verlauf: [{ tag, sitzungen: [{ von, bis, wer, liste, anzahl, was, shas }] }] (neuester zuerst;
 *            shas: die Commits der Sitzung, ältester zuerst – für die Einzelheiten)
 *   automatik: { <liste>: { <wer>: n } }
 */
export function zusammenfassen(listen, { tage = 7, jetzt = new Date() } = {}) {
  const heute = new Date(jetzt);
  heute.setHours(0, 0, 0, 0);
  const ab = new Date(heute);
  ab.setDate(ab.getDate() - (tage - 1));
  const tagListe = [];
  for (let d = new Date(ab); d <= heute; d.setDate(d.getDate() + 1)) tagListe.push(tagVon(d));
  const personen = new Map();
  const automatik = {};
  const roh = [];
  // Alle Commits der Reihe nach, ältester zuerst – auch die vor dem Zeitraum, damit „zum ersten Mal dabei“ stimmt
  const alle = [];
  for (const l of listen || []) {
    for (const e of l.eintraege || []) {
      const zeit = new Date(e.at);
      if (Number.isNaN(zeit.getTime())) continue;
      const n = nachrichtLesen(e.nachricht);
      if (n.wer) alle.push({ zeit, l, n, sha: typeof e.sha === 'string' ? e.sha : '' });
    }
  }
  alle.sort((a, b) => a.zeit - b.zeit);
  const dabei = new Set();
  for (const { zeit, l, n, sha } of alle) {
    if (n.auto) {
      if (zeit < ab) continue;
      automatik[l.id] = automatik[l.id] || {};
      automatik[l.id][n.wer] = (automatik[l.id][n.wer] || 0) + 1;
      continue;
    }
    // Die Einladung legt der Gastgeber in der Liste des Gasts an – das steht im Verlauf, zählt aber nicht als seine Arbeit dort
    const einladung = /^Einladung für /.test(n.was[0] || '');
    const wer = l.gast && !einladung ? String(l.gast) : n.wer;
    const schluessel = `${l.id}|${wer.toLowerCase()}`;
    const was = n.was.map((w) => {
      if (w !== DABEI) return w;
      if (dabei.has(schluessel)) return NOCH_EIN_GERAET;
      dabei.add(schluessel);
      return w;
    }).filter((w, i, a) => a.indexOf(w) === i);
    if (zeit < ab) continue;
    roh.push({ zeit, liste: l.id, wer, anzahl: n.anzahl, was, sha });
    if (einladung) continue;
    const p = personen.get(schluessel) || { name: wer, liste: l.id, zuletzt: '', anzahl: 0, jeTag: tagListe.map(() => 0), bereiche: {} };
    p.anzahl += n.anzahl;
    if (!p.zuletzt || zeit.toISOString() > p.zuletzt) p.zuletzt = zeit.toISOString();
    const i = tagListe.indexOf(tagVon(zeit));
    if (i >= 0) p.jeTag[i] += n.anzahl;
    // Ältere Commits sagen nicht, was – die zählen nur mit, nicht in einem Bereich
    for (const b of new Set(was.map(bereichVon))) p.bereiche[b] = (p.bereiche[b] || 0) + 1;
    personen.set(schluessel, p);
  }
  // Sitzungen: dieselbe Person in derselben Liste, höchstens SITZUNG_MIN Minuten Pause
  roh.sort((a, b) => a.zeit - b.zeit);
  const sitzungen = [];
  const offen = new Map();
  for (const c of roh) {
    const k = `${c.liste}|${c.wer.toLowerCase()}`;
    const s = offen.get(k);
    if (s && c.zeit - s.bisZeit <= SITZUNG_MIN * 60000 && tagVon(c.zeit) === tagVon(s.bisZeit)) {
      s.bisZeit = c.zeit;
      s.anzahl += c.anzahl;
      for (const w of c.was) if (!s.was.includes(w)) s.was.push(w);
      if (c.sha) s.shas.push(c.sha);
      continue;
    }
    const neu = { vonZeit: c.zeit, bisZeit: c.zeit, wer: c.wer, liste: c.liste, anzahl: c.anzahl, was: [...c.was], shas: c.sha ? [c.sha] : [] };
    offen.set(k, neu);
    sitzungen.push(neu);
  }
  const jeTag = new Map();
  for (const s of sitzungen.reverse()) {
    const tag = tagVon(s.vonZeit);
    if (!jeTag.has(tag)) jeTag.set(tag, []);
    jeTag.get(tag).push({ von: s.vonZeit.toISOString(), bis: s.bisZeit.toISOString(), wer: s.wer, liste: s.liste, anzahl: s.anzahl, was: s.was.slice(0, 6), shas: s.shas });
  }
  return {
    personen: [...personen.values()].sort((a, b) => b.zuletzt.localeCompare(a.zuletzt)),
    tage: tagListe,
    verlauf: [...jeTag.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([tag, s]) => ({ tag, sitzungen: s })),
    automatik,
  };
}

/** Neue Commits (neueste zuerst) vor die gemerkten; älter als tage fällt weg. */
export function verlaufMischen(alt, neu, { tage = 31, jetzt = new Date() } = {}) {
  const grenze = new Date(jetzt.getTime() - tage * 86400000).toISOString();
  const shas = new Set();
  return [...(neu || []), ...(alt || [])]
    .filter((e) => e && typeof e.sha === 'string' && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)) && !shas.has(e.sha) && shas.add(e.sha))
    .filter((e) => new Date(e.at).toISOString() >= grenze)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3000);
}
