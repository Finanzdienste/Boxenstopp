/*
 * Was eine Änderung an der Liste genau getan hat – für den Überblick des
 * Gastgebers (ansicht-gaeste.js).
 *
 * Die Commit-Nachricht sagt das nur grob („Amy: Einkaufsliste, 3 Änderungen –
 * 2 abgehakt“), ältere gar nicht („1 Änderung“). Hier steht es aus den beiden
 * Ständen von liste.json vor und nach dem Commit: welche Sachen auf die Liste
 * kamen und mit welcher Menge, was abgehakt wurde, welcher Schritt beim
 * Kochen dran war, welche Aufgabe im Putzplan, welches Ziel. Das geht auch
 * für alte Commits und für Commits von einer älteren App-Fassung – es braucht
 * nur die beiden Stände (speicher.js fassungLesen).
 *
 * Ohne DOM und ohne Netz; tests/test-einzelheiten.mjs prüft es in Node.
 *
 *   einzelheiten(vorher, nachher, hilfe) → [{ b, a, x }]
 *     b  der Bereich wie im Überblick (gaeste.js BEREICHE)
 *     a  was passiert ist: „Abgehakt“, „Für Chili auf die Liste“,
 *        „Kocht Bueno Kuchen (10 Schritte)“ …
 *     x  die Sachen dazu, in der Reihenfolge der Liste – kann leer sein
 *        („Alles eingekauft“)
 *   hilfe: was die App über die festen Rezepte und den Katalog weiß –
 *     { rezeptName(rid), rezept(rid) → { ablauf, items }, zutatName(k) }.
 *     Amys Rezepte und die behaltenen aus der Resteverwertung stehen im Stand
 *     selbst – so, wie sie damals waren.
 *
 *   zusammenlegen([[…], […], …]) – mehrere Änderungen (eine Sitzung im
 *     Überblick) als eine Liste: dasselbe „was“ einmal, die Sachen zusammen.
 */
import { leer, teileVon, erledigt, istExtra, leerHaushalt, vorherAngleichen } from './liste.js';
import { menge, platzhalter, nameSchluessel } from './format.js';
import { amyAblauf } from './amy.js';
import { RAUM, wdhText } from './haushalt.js';
import { ABTEILUNG_NAME } from './weg.js';
import { BEREICHE } from './gaeste.js';

/** Hochzählen, wenn sich ändert, was hier herauskommt – dann rechnet der Überblick neu (ansicht-gaeste.js). */
export const EINZELHEITEN_FASSUNG = 1;

const DAUMEN_TEXT = { hoch: 'Daumen hoch', mittel: 'geht so', runter: 'Daumen runter' };
const TODO_ART = { verbinden: 'verbinden', trennen: 'trennen', abgleichen: 'abgleichen' };
const ERINNERN = { morgens: 'morgens', mittags: 'mittags', abends: 'abends' };

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const gleich = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const nf = (x) => Number(x).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const euro = (x) => `${Number(x).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const zitat = (s) => `„${s}“`;

/** Ein Text in einer Zeile, höchstens max Zeichen. */
export function kurz(s, max = 90) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** „n:dino-nuggets“ → „Dino nuggets“ – wenn sonst nichts den Namen kennt. */
function schoen(k) {
  const s = String(k || '').replace(/^(?:n:|amyz-|ki-|c-|x-)/, '').replace(/-/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : String(k || '');
}

/** Menge eines Teils: „280 g“, „2 EL“ – oder ''. */
const teilText = (p) => (typeof p?.q === 'number' && p.u ? menge(p.q, p.u) : (typeof p?.t === 'string' ? p.t : ''));
/** Wie auf einem Einkaufszettel: „500 g Rinderhackfleisch“, „2 EL Kreuzkümmel“. */
const mitMenge = (name, p) => { const m = teilText(p); return m ? `${m} ${name}` : name; };

/** Ein Schritt, wie er beim Kochen dastand – kurz, ohne „→ Schale 2“. */
function schrittZeile(liste, i) {
  const d = liste?.[i];
  if (!d) return `Schritt ${i + 1}`;
  return `${i + 1}. ${kurz(String(d).replace(/\{[^}]*\}\s*/g, '').replace(/\s*→.*$/, ''), 80)}`;
}

const makros = (z) => `${nf(z.kcal)} kcal · ${nf(z.p)} g P · ${nf(z.kh)} g KH · ${nf(z.f)} g F`;
const gleicheMakros = (a, b) => ['kcal', 'p', 'kh', 'f'].every((k) => a?.[k] === b?.[k]);

/** Was sich an einem eigenen Rezept geändert hat – Zeile für Zeile. */
function rezeptAenderungen(alt, neu) {
  const z = [];
  if (alt.name !== neu.name) z.push(`Name: ${zitat(alt.name)} → ${zitat(neu.name)}`);
  const plus = (a, b, wort) => {
    const vorher = a || [];
    const nachher = b || [];
    for (const x of nachher.filter((y) => !vorher.includes(y)).slice(0, 8)) z.push(`+ ${wort}${kurz(x, 60)}`);
    for (const x of vorher.filter((y) => !nachher.includes(y)).slice(0, 8)) z.push(`− ${wort}${kurz(x, 60)}`);
  };
  plus(alt.zutaten, neu.zutaten, '');
  plus(alt.schritte, neu.schritte, 'Schritt: ');
  if ((alt.notiz || '') !== (neu.notiz || '')) z.push(neu.notiz ? `Notiz: ${zitat(kurz(neu.notiz, 80))}` : 'Notiz gelöscht');
  if (alt.portionen !== neu.portionen) z.push(`Portionen: ${alt.portionen} → ${neu.portionen}`);
  if ((alt.zeit || 0) !== (neu.zeit || 0)) z.push(`Zeit: ${neu.zeit ? `${neu.zeit} Min.` : 'ohne Angabe'}`);
  if (alt.bild !== neu.bild) z.push('anderes Bild');
  return z;
}

/** Was sich an einem Putztag geändert hat. */
function planAenderungen(alt, neu) {
  const z = [];
  if (alt.name !== neu.name) z.push(`heißt jetzt ${zitat(neu.name)}`);
  const vorher = new Map((alt.aufgaben || []).map((a) => [a.id, a]));
  const nachher = new Map((neu.aufgaben || []).map((a) => [a.id, a]));
  for (const [id, a] of nachher) {
    const v = vorher.get(id);
    if (!v) z.push(`+ ${a.t}`);
    else if (v.t !== a.t) z.push(`${v.t} → ${a.t}`);
    else if ((v.jedes || 1) !== (a.jedes || 1)) z.push(`${a.t}: ${(a.jedes || 1) > 1 ? `jedes ${a.jedes}. Mal` : 'jedes Mal'}`);
  }
  for (const [id, a] of vorher) if (!nachher.has(id)) z.push(`− ${a.t}`);
  if (!gleich(alt.wdh, neu.wdh)) z.push(`jetzt ${wdhText(neu.wdh)}`);
  if ((alt.wer || '') !== (neu.wer || '')) z.push(neu.wer ? `macht ${neu.wer}` : 'machen beide');
  if ((alt.erinnern || '') !== (neu.erinnern || '')) z.push(neu.erinnern ? `Erinnerung ${ERINNERN[neu.erinnern] || neu.erinnern}` : 'ohne Erinnerung');
  for (const m of (neu.material || []).filter((x) => !(alt.material || []).includes(x))) z.push(`+ ${m}`);
  for (const m of (alt.material || []).filter((x) => !(neu.material || []).includes(x))) z.push(`− ${m}`);
  return z;
}

export function einzelheiten(vorher, nachher, hilfe = {}) {
  const n = nachher || leer();
  const { v, umbenannt } = vorherAngleichen(vorher || leer(), n);
  const raus = new Map();
  const dazu = (b, a, x = []) => {
    const k = `${b}|${a}`;
    if (!raus.has(k)) raus.set(k, { b, a, x: [] });
    const e = raus.get(k);
    for (const y of [].concat(x)) {
      const t = kurz(y, 140);
      if (t && !e.x.includes(t)) e.x.push(t);
    }
  };

  // Namen: Zeilen der Liste (vorher und nachher, auch unter ihrem Namen-Schlüssel), dann der Katalog
  const bekannt = new Map();
  for (const s of [v, n]) {
    for (const [k, d] of Object.entries(s.items || {})) {
      if (!d?.name) continue;
      bekannt.set(k, d.name);
      bekannt.set(nameSchluessel(d.name), d.name);
    }
  }
  const zutat = (k) => bekannt.get(k) || hilfe.zutatName?.(k) || schoen(k);
  const eigenes = (rid) => n.amy?.[rid] || v.amy?.[rid] || null;
  const kiRezept = (rid) => n.ki?.[rid]?.r || v.ki?.[rid]?.r || null;
  const rn = (rid) => eigenes(rid)?.name || kiRezept(rid)?.name || hilfe.rezeptName?.(rid) || (istExtra(rid) ? 'mehr davon' : schoen(rid));
  /** Die Schritte eines Rezepts als Texte, so gezählt wie im Kochmodus (alle Abschnitte hintereinander). */
  const schritte = (rid) => {
    const amy = eigenes(rid);
    if (amy) return amyAblauf(amy).flatMap((p) => p.schritte).map((s) => s.d);
    const r = hilfe.rezept?.(rid) || kiRezept(rid);
    if (!Array.isArray(r?.ablauf)) return null;
    const items = Array.isArray(r.items) ? r.items : [];
    return r.ablauf.flatMap((p) => (Array.isArray(p?.schritte) ? p.schritte : [])).map((s) => {
      const d = platzhalter(typeof s === 'string' ? s : s?.d, items);
      return Array.isArray(s?.liste) && s.liste.length ? `${d} ${s.liste.map((x) => platzhalter(x, items)).join(', ')}` : d;
    });
  };

  /* ---------------------------------------------------------- Einkauf */
  const vi = v.items || {};
  const ni = n.items || {};
  for (const [k, d] of Object.entries(ni)) {
    const alt = vi[k];
    const name = d.name || zutat(k);
    if (!alt) {
      const teile = teileVon(d);
      if (!teile.length) dazu('Einkauf', 'Auf die Liste', name);
      for (const [rid, p] of teile) dazu('Einkauf', istExtra(rid) ? 'Auf die Liste' : `Für ${rn(rid)} auf die Liste`, mitMenge(name, p));
      continue;
    }
    if (alt.name && d.name && alt.name !== d.name) dazu('Einkauf', 'Umbenannt', `${alt.name} → ${d.name}`);
    const ta = istObj(alt.parts) ? alt.parts : {};
    const tn = istObj(d.parts) ? d.parts : {};
    for (const [rid, p] of Object.entries(tn)) {
      const q = ta[rid];
      if (!q) dazu('Einkauf', istExtra(rid) ? 'Mehr davon' : `Für ${rn(rid)} auf die Liste`, mitMenge(name, p));
      else if (teilText(q) !== teilText(p)) dazu('Einkauf', 'Menge geändert', `${name}: ${teilText(q) || '–'} → ${teilText(p) || '–'}`);
    }
    for (const rid of Object.keys(ta)) {
      if (tn[rid]) continue;
      // Was schon im Wagen war, räumt „Erledigtes weg“ aus der Zeile – der Rest bleibt
      if (ta[rid].done === true) dazu('Einkauf', 'Erledigtes weggeräumt', name);
      else dazu('Einkauf', istExtra(rid) ? 'Mehr davon weg' : `Für ${rn(rid)} von der Liste`, name);
    }
    // Abgehakt: alle Teile (eigene Einträge: der Haken). Ein neues Teil oder eine neue Menge macht eine Zeile wieder
    // offen – das ist „auf die Liste“ bzw. „Menge geändert“, nicht „wieder offen“.
    const beide = Object.keys(tn).filter((rid) => ta[rid]);
    const zu = beide.filter((rid) => ta[rid].done !== true && tn[rid].done === true);
    const auf = beide.filter((rid) => ta[rid].done === true && tn[rid].done !== true && teilText(ta[rid]) === teilText(tn[rid]));
    const ohneTeile = !Object.keys(tn).length && !Object.keys(ta).length;
    if (!erledigt(alt) && erledigt(d)) dazu('Einkauf', 'Abgehakt', name);
    else if (ohneTeile ? alt.checked === true && d.checked !== true : auf.length > 0) dazu('Einkauf', 'Wieder offen', name);
    else if (zu.length) dazu('Einkauf', 'Teilweise abgehakt', `${name} (für ${zu.map(rn).join(', ')})`);
  }
  const weg = Object.entries(vi).filter(([k]) => !ni[k]);
  if (weg.length) {
    const namen = weg.map(([k, d]) => d?.name || zutat(k));
    if (!Object.keys(ni).length) dazu('Einkauf', 'Liste geleert', namen);
    else if (weg.every(([, d]) => erledigt(d))) dazu('Einkauf', 'Erledigtes weggeräumt', namen);
    else dazu('Einkauf', 'Von der Liste', namen);
  }
  const offenVorher = Object.values(vi).filter((d) => !erledigt(d)).length;
  if (offenVorher > 0 && Object.keys(ni).length && Object.values(ni).every(erledigt)) dazu('Einkauf', 'Alles eingekauft');
  for (const [k, abt] of Object.entries(n.abteilungen || {})) if (v.abteilungen?.[k] !== abt) dazu('Einkauf', 'In eine andere Abteilung', `${zutat(k)} → ${ABTEILUNG_NAME[abt] || abt}`);
  for (const k of Object.keys(v.abteilungen || {})) if (!n.abteilungen?.[k]) dazu('Einkauf', 'Zurück in die übliche Abteilung', zutat(k));
  for (const [von, nach] of Object.entries(n.gleich || {})) if (v.gleich?.[von] !== nach) dazu('Einkauf', 'Zusammengelegt', `${zutat(von)} = ${zutat(nach)}`);
  for (const von of Object.keys(v.gleich || {})) if (!n.gleich?.[von]) dazu('Einkauf', 'Wieder getrennt', zutat(von));
  for (const paar of n.ungleich || []) {
    if ((v.ungleich || []).includes(paar)) continue;
    const [a, b] = String(paar).split('|');
    dazu('Einkauf', 'Als verschieden markiert', `${zutat(a)} ≠ ${zutat(b)}`);
  }
  for (const [k, f] of Object.entries(n.fehlt || {})) if (!gleich(f, v.fehlt?.[k])) dazu('Einkauf', 'Gab es nicht', `${zutat(k)}${f?.laden ? ` (${f.laden})` : ''}`);
  for (const [k, liste] of Object.entries(n.bons || {})) {
    const alt = new Set((v.bons?.[k] || []).map((b) => b.at));
    for (const b of liste || []) {
      if (alt.has(b.at)) continue;
      dazu('Einkauf', 'Bon', `${zutat(k)}: ${euro(b.eur)}${typeof b.q === 'number' && b.u ? ` für ${menge(b.q, b.u)}` : ''}${b.laden ? ` bei ${b.laden}` : ''}`);
    }
  }
  for (const [k, a] of Object.entries(n.preisalarm || {})) if (!gleich(a, v.preisalarm?.[k])) dazu('Einkauf', 'Preisalarm', `${a.name || zutat(k)}: bis ${euro(a.max)}/${a.u}`);
  for (const [k, a] of Object.entries(v.preisalarm || {})) if (!n.preisalarm?.[k]) dazu('Einkauf', 'Preisalarm aus', a.name || zutat(k));
  for (const [laden, w] of Object.entries(n.wege || {})) if (!gleich(w, v.wege?.[laden])) dazu('Einkauf', 'Weg durch den Laden gemerkt', laden);
  for (const laden of Object.keys(v.wege || {})) if (!n.wege?.[laden]) dazu('Einkauf', 'Weg durch den Laden vergessen', laden);

  /* ----------------------------------------------------------- Kochen */
  for (const [rid, c] of Object.entries(n.cooked || {})) if (c?.at !== v.cooked?.[rid]?.at) dazu('Kochen', 'Gekocht', rn(rid));
  for (const rid of Object.keys(v.cooked || {})) if (!n.cooked?.[rid]) dazu('Kochen', '„Gekocht“ zurückgenommen', rn(rid));
  for (const [wer, k] of Object.entries(n.kochen || {})) {
    const alt = v.kochen?.[wer];
    if (alt && alt.at === k.at) continue;
    const rids = [...new Set([...Object.keys(k.schritte || {}), ...Object.keys(alt?.schritte || {})])];
    for (const rid of rids) {
      const a = new Set(alt?.schritte?.[rid] || []);
      const b = new Set(k.schritte?.[rid] || []);
      const neu = [...b].filter((i) => !a.has(i)).sort((x, y) => x - y);
      const offen = [...a].filter((i) => !b.has(i)).sort((x, y) => x - y);
      if (!neu.length && !offen.length) continue;
      const liste = schritte(rid);
      const name = rn(rid);
      if (neu.length) dazu('Kochen', `Kocht ${name}${liste?.length ? ` (${liste.length} Schritte)` : ''}`, neu.map((i) => schrittZeile(liste, i)));
      if (offen.length && !b.size) dazu('Kochen', 'Haken zurückgesetzt', name);
      else if (offen.length) dazu('Kochen', `${name}: wieder offen`, offen.map((i) => schrittZeile(liste, i)));
    }
    const alteTimer = new Set((alt?.timer || []).map((t) => t.id));
    for (const t of k.timer || []) if (!alteTimer.has(t.id)) dazu('Kochen', 'Timer gestellt', `${t.label || rn(t.rid)}${t.minuten ? ` (${nf(t.minuten)} Min.)` : ''}`);
  }

  /* ---------------------------------------------------------- Rezepte */
  for (const rid of new Set([...Object.keys(v.bewertung || {}), ...Object.keys(n.bewertung || {})])) {
    const a = v.bewertung?.[rid]?.wert;
    const b = n.bewertung?.[rid]?.wert;
    if (a === b) continue;
    if (b) dazu('Rezepte', 'Bewertet', `${rn(rid)}: ${DAUMEN_TEXT[b] || b}`);
    else dazu('Rezepte', 'Bewertung zurückgenommen', rn(rid));
  }
  for (const [rid, ns] of Object.entries(n.notizen || {})) {
    for (const x of ns || []) {
      const alt = (v.notizen?.[rid] || []).find((y) => y.id === x.id);
      if (!alt || alt.text !== x.text) dazu('Rezepte', `Notiz zu ${rn(rid)}`, zitat(x.text));
    }
  }
  for (const [rid, ns] of Object.entries(v.notizen || {})) {
    for (const x of ns || []) if (!(n.notizen?.[rid] || []).some((y) => y.id === x.id)) dazu('Rezepte', `Notiz zu ${rn(rid)} gelöscht`, zitat(x.text));
  }
  for (const rid of Object.keys(n.gepinnt || {})) if (!v.gepinnt?.[rid]) dazu('Rezepte', 'Angepinnt', rn(rid));
  for (const rid of Object.keys(v.gepinnt || {})) if (!n.gepinnt?.[rid]) dazu('Rezepte', 'Nicht mehr angepinnt', rn(rid));
  for (const [id, r] of Object.entries(n.amy || {})) {
    const alt = v.amy?.[id];
    if (!alt) {
      const zahl = amyAblauf(r).reduce((s, p) => s + p.schritte.length, 0);
      dazu('Rezepte', 'Neues Rezept', `${zitat(r.name)} – ${(r.zutaten || []).length} Zutaten, ${zahl} Schritte`);
      continue;
    }
    const z = gleich(alt, r) ? [] : rezeptAenderungen(alt, r);
    if (z.length) dazu('Rezepte', `${zitat(r.name)} geändert`, z);
  }
  for (const [id, r] of Object.entries(v.amy || {})) if (!n.amy?.[id]) dazu('Rezepte', 'Rezept gelöscht', zitat(r.name));
  for (const id of new Set([...Object.keys(v.amyTags || {}), ...Object.keys(n.amyTags || {})])) {
    if (gleich(v.amyTags?.[id] || [], n.amyTags?.[id] || [])) continue;
    const tags = n.amyTags?.[id] || [];
    dazu('Rezepte', `Tags für ${rn(id)}`, tags.length ? tags : 'keine mehr');
  }
  for (const [id, x] of Object.entries(n.ki || {})) if (!v.ki?.[id]) dazu('Rezepte', 'Aus der Resteverwertung behalten', zitat(x?.r?.name || id));
  for (const [id, x] of Object.entries(v.ki || {})) if (!n.ki?.[id]) dazu('Rezepte', 'Aus der Resteverwertung entfernt', zitat(x?.r?.name || id));

  /* --------------------------------------------------------- Haushalt */
  const hv = v.haushalt || leerHaushalt();
  const hn = n.haushalt || leerHaushalt();
  const plan = (id) => hn.plaene?.[id] || hv.plaene?.[id] || null;
  const planName = (p) => p?.name || RAUM[p?.raum]?.name || 'Putzplan';
  const aufgabe = (id, aid) => (plan(id)?.aufgaben || []).find((a) => a.id === aid)?.t || 'eine Aufgabe';
  for (const id of new Set([...Object.keys(hv.stand || {}), ...Object.keys(hn.stand || {})])) {
    const a = hv.stand?.[id];
    const b = hn.stand?.[id];
    if (!b || gleich(a, b)) continue;
    const vorherHaken = new Set(a && a.datum === b.datum ? a.haken : []);
    const nachherHaken = new Set(b.haken || []);
    const titel = `Putzplan ${planName(plan(id))}`;
    const neu = [...nachherHaken].filter((x) => !vorherHaken.has(x));
    const offen = [...vorherHaken].filter((x) => !nachherHaken.has(x));
    if (neu.length) dazu('Haushalt', titel, neu.map((x) => `✓ ${aufgabe(id, x)}`));
    if (offen.length) dazu('Haushalt', titel, offen.map((x) => `${aufgabe(id, x)} wieder offen`));
    if (b.fertig && !(a?.fertig && a.datum === b.datum)) dazu('Haushalt', titel, 'alles erledigt');
  }
  for (const [id, p] of Object.entries(hn.plaene || {})) {
    const alt = hv.plaene?.[id];
    if (!alt) {
      dazu('Haushalt', 'Putzplan angelegt', `${planName(p)} – ${wdhText(p.wdh)}${(p.aufgaben || []).length ? `, ${p.aufgaben.length} Aufgaben` : ''}`);
      continue;
    }
    const z = gleich(alt, p) ? [] : planAenderungen(alt, p);
    if (z.length) dazu('Haushalt', `Putzplan ${planName(p)} geändert`, z);
  }
  for (const [id, p] of Object.entries(hv.plaene || {})) if (!hn.plaene?.[id]) dazu('Haushalt', 'Putzplan gelöscht', planName(p));
  for (const [id, s] of Object.entries(hn.sachen || {})) if (!hv.sachen?.[id]) dazu('Haushalt', 'Haushaltssache dazu', s.name);
  for (const [id, s] of Object.entries(hv.sachen || {})) if (!hn.sachen?.[id]) dazu('Haushalt', 'Haushaltssache weg', s.name);
  for (const [k, w] of Object.entries(hn.todoWunsch || {})) if (!gleich(w, hv.todoWunsch?.[k])) dazu('Haushalt', 'Microsoft To Do', `${w.name || k}: ${TODO_ART[w.art] || w.art}`);
  for (const [k, z] of Object.entries(hn.todoZiel || {})) if (!gleich(z, hv.todoZiel?.[k])) dazu('Haushalt', 'Microsoft To Do', `Liste ${zitat(z.name)}${z.geteilt ? ' (geteilt)' : ''}`);
  if (hn.todoApp && hn.todoApp !== hv.todoApp) dazu('Haushalt', 'Microsoft To Do', 'App-ID eingetragen');

  /* ------------------------------------------------------------- Ziel */
  const zv = v.profil?.ziel;
  const zn = n.profil?.ziel;
  if (zn && !gleicheMakros(zv, zn)) dazu('Ziel', 'Ziel pro Box', zv ? `${makros(zv)} → ${makros(zn)}` : makros(zn));
  else if (!zn && zv) dazu('Ziel', 'Ziel pro Box', 'zurück auf das Ziel der Rezepte');
  const bv = v.profil?.boxen || 8;
  const bn = n.profil?.boxen || 8;
  if (bv !== bn) dazu('Ziel', 'Boxen pro Rezept', `${bv} → ${bn}`);

  /* -------------------------------------------------------- Sonstiges */
  const neueLeute = Object.entries(n.leute || {}).filter(([k]) => !v.leute?.[k]).map(([, x]) => x);
  if (neueLeute.length) dazu('Sonstiges', 'Zum ersten Mal dabei', neueLeute);
  if (umbenannt.length) dazu('Sonstiges', 'Umbenannt', umbenannt.map((x) => `${x} → ${n.profil.person}`));
  if (n.profil?.person && n.profil.person !== v.profil?.person) dazu('Sonstiges', 'Eigene Liste', `für ${n.profil.person}`);
  if ((n.profil?.farbe || '') !== (v.profil?.farbe || '')) dazu('Sonstiges', 'Farbe der App', n.profil?.farbe || 'blau');
  const angVorher = v.angebote?.eintraege || [];
  const angNachher = n.angebote?.eintraege || [];
  const angIds = new Set(angVorher.map((e) => e.id));
  const angNeu = angNachher.filter((e) => !angIds.has(e.id));
  const angWeg = angVorher.filter((e) => !angNachher.some((x) => x.id === e.id));
  const angebot = (e) => `${e.laden ? `${e.laden}: ` : ''}${e.name}${typeof e.preis === 'number' ? ` ${euro(e.preis)}` : ''}`;
  const viele = (xs) => `${xs.length} Angebote (${[...new Set(xs.map((e) => e.laden).filter(Boolean))].join(', ') || 'ohne Laden'})`;
  if (angNeu.length) dazu('Sonstiges', 'Angebote eingetragen', angNeu.length > 12 ? viele(angNeu) : angNeu.map(angebot));
  if (angWeg.length) dazu('Sonstiges', 'Angebote entfernt', angWeg.length > 12 ? viele(angWeg) : angWeg.map((e) => e.name));

  return BEREICHE.flatMap((b) => [...raus.values()].filter((e) => e.b === b));
}

/** Mehrere Änderungen (ältere zuerst) als eine Liste: dasselbe „was“ einmal, die Sachen zusammen. */
export function zusammenlegen(listen) {
  const raus = new Map();
  for (const l of listen || []) {
    for (const e of Array.isArray(l) ? l : []) {
      if (!e || typeof e.a !== 'string') continue;
      const k = `${e.b}|${e.a}`;
      if (!raus.has(k)) raus.set(k, { b: e.b, a: e.a, x: [] });
      const z = raus.get(k);
      for (const x of Array.isArray(e.x) ? e.x : []) if (!z.x.includes(x)) z.x.push(x);
    }
  }
  return BEREICHE.flatMap((b) => [...raus.values()].filter((e) => e.b === b));
}
