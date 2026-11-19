/*
 * Das Dashboard des Gastgebers: was in einer Liste drin ist – auf einen Blick
 * (ansicht-gaeste.js zeichnet es, neben dem Verlauf „Aktivität“). Ohne DOM;
 * tests/test-gaeste.mjs prüft es in Node.
 *
 *   inhaltVon(stand, { hilfe, heute }) → {
 *     sachen:   { anzahl, listen: [{ id, name, bild, dinge: [{ id, name, marke, tags, notiz, foto, code, quelle, wertung }] }] }
 *               (eigene Reihenfolge; Sachen ohne Liste zuletzt unter „Ohne Liste“)
 *     einkauf:  { offen: [Name], erledigt: n }     die Einkaufsliste (offen nach Namen)
 *     rezepte:  [{ name, tags }]                   eigene Rezepte (amy), nach Namen
 *     notizen:  [{ titel, tags, geaendert }]       Notizblätter, das neueste zuerst
 *     plan:     [{ tag, mittag: [Text], abend: [Text] }]   der Essensplan ab heute, sieben Tage
 *     wuensche: { offen, erledigt }                Vorschläge (nur, wie viele)
 *   }
 *
 * Nicht dabei: was jemand verträgt (Gesundheit) und was jemand der KI
 * geschrieben hat – das Dashboard zeigt, was jemand in der App hat, nicht mehr.
 * hilfe: { rezeptName(rid), zutatName(k) } wie bei einzelheiten.js.
 */
import { inventarBereinigen, listenVon, dingeIn, sortiert, dingName } from './inventar.js';
import { erledigt } from './liste.js';
import { tagsBereinigen } from './amy.js';

const istObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const tagVon = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nachName = (a, b) => String(a).localeCompare(String(b), 'de', { sensitivity: 'base' });

/** „n:dino-nuggets“ → „Dino nuggets“ – wenn sonst nichts den Namen kennt. */
function schoen(k) {
  const t = String(k || '').replace(/^(?:n:|amyz-|ki-|c-|x-)/, '').replace(/-/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : String(k || '');
}

const dingKurz = (d) => ({
  id: d.id,
  name: dingName(d),
  marke: String(d.name || '').trim() ? d.marke : '',
  tags: d.tags || [],
  notiz: d.notiz || '',
  foto: d.foto?.pfad || '',
  code: d.code || '',
  quelle: d.quelle?.name || '',
  wertung: Number(d.wertung) || 0,
});

export function inhaltVon(stand, { hilfe = {}, heute = new Date() } = {}) {
  const s = istObj(stand) ? stand : {};

  // Sachen – in ihren Listen, in der eigenen Reihenfolge
  const inv = inventarBereinigen(s.inventar);
  const listen = listenVon(inv).map((l) => ({ id: l.id, name: String(l.name || '').trim() || 'Ohne Namen', bild: l.bild, dinge: sortiert(dingeIn(inv, l.id), 'eigen').map(dingKurz) }));
  const ohne = dingeIn(inv, null);
  if (ohne.length) listen.push({ id: '', name: 'Ohne Liste', bild: 'package', dinge: sortiert(ohne, 'eigen').map(dingKurz) });

  // Die Einkaufsliste
  const offen = [];
  let fertig = 0;
  for (const [k, d] of Object.entries(istObj(s.items) ? s.items : {})) {
    if (!istObj(d)) continue;
    if (erledigt(d)) fertig += 1;
    else offen.push(String(d.name || '').trim() || hilfe.zutatName?.(k) || schoen(k));
  }
  offen.sort(nachName);

  // Eigene Rezepte
  const amyTags = istObj(s.amyTags) ? s.amyTags : {};
  const rezepte = Object.entries(istObj(s.amy) ? s.amy : {})
    .filter(([, r]) => istObj(r) && String(r.name || '').trim())
    .map(([id, r]) => ({ name: String(r.name).trim(), tags: tagsBereinigen(amyTags[id] || []) }))
    .sort((a, b) => nachName(a.name, b.name));

  // Notizblätter
  const notizen = Object.values(istObj(s.notizbuch) ? s.notizbuch : {})
    .filter(istObj)
    .map((b) => ({ titel: String(b.titel || '').trim() || 'Ohne Titel', tags: tagsBereinigen(b.tags || []), geaendert: String(b.geaendert || b.at || '') }))
    .sort((a, b) => b.geaendert.localeCompare(a.geaendert));

  // Der Essensplan ab heute, sieben Tage
  const tage = istObj(s.essensplan?.tage) ? s.essensplan.tage : {};
  const gericht = (e) => {
    if (!istObj(e)) return '';
    if (String(e.text || '').trim()) return String(e.text).trim();
    const rid = e.rid;
    if (!rid) return '';
    return String(s.amy?.[rid]?.name || s.ki?.[rid]?.r?.name || hilfe.rezeptName?.(rid) || schoen(rid));
  };
  const plan = [];
  for (let i = 0; i < 7; i++) {
    const tag = tagVon(new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + i));
    const t = tage[tag];
    if (!istObj(t)) continue;
    const mittag = [...new Set((Array.isArray(t.mittag) ? t.mittag : []).map(gericht).filter(Boolean))];
    const abend = [...new Set((Array.isArray(t.abend) ? t.abend : []).map(gericht).filter(Boolean))];
    if (mittag.length || abend.length) plan.push({ tag, mittag, abend });
  }

  // Vorschläge – nur, wie viele
  const w = Object.values(istObj(s.wuensche) ? s.wuensche : {}).filter(istObj);

  return {
    sachen: { anzahl: listen.reduce((n, l) => n + l.dinge.length, 0), listen },
    einkauf: { offen, erledigt: fertig },
    rezepte,
    notizen,
    plan,
    wuensche: { offen: w.filter((x) => !x.erledigt).length, erledigt: w.filter((x) => x.erledigt).length },
  };
}
