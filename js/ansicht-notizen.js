/*
 * Amys Bereich → Notizen: Blätter wie bei OneNote. Links (breit) oder als
 * Liste (schmal) die Blätter mit Farbe, Titel und Vorschau, darüber die
 * Tags zum Filtern; rechts bzw. allein das offene Blatt: Titel, Farbe, Tags,
 * freier Text. Für Ideen, die bleiben – „ganz allgemeine Sachen zur Inspo“.
 *
 * Gespeichert wird beim Tippen (nach einem Augenblick Ruhe, und sofort, wenn
 * die App in den Hintergrund geht) als ganzes Blatt (notizbuch.js opBlatt);
 * eine noch nicht gesendete Fassung ersetzt die vorige. Solange ein Blatt
 * offen ist, baut die App es nicht neu – sonst wäre der Cursor weg; nur die
 * Liste daneben und „Gespeichert“ ziehen nach. Ein leeres Blatt verschwindet
 * wieder, wenn man es verlässt.
 *
 * Die Blätter liegen in der gemeinsamen Liste (Tobi sieht sie auch – so
 * gewollt). Ihre Zeilen tauchen beim Planen im Essensplan als Inspiration auf.
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc } from './format.js';
import { person, wessen, istEigen } from './profil.js';
import { opZusammen } from './liste.js';
import { opBlatt, opBlattWeg, neueBlattId, blaetter, blattTitel, blattVorschau, blattLeer, blattTags, BLATT_FARBEN, FARBE_NAME, MAX_TEXT, MAX_TITEL } from './notizbuch.js';
import { tagsBereinigen, tagFarbe, alleTags, TAG_VORSCHLAEGE, MAX_TAGS } from './amy.js';

const ANSICHT = 'boxenstopp.notizen.ansicht.v1'; // { offen: 'nb-…' | null, tag: '' } – nur auf diesem Gerät
const SPEICHERN_NACH = 700;

let zustand = (() => {
  const z = lese(ANSICHT, null);
  return { offen: typeof z?.offen === 'string' ? z.offen : null, tag: typeof z?.tag === 'string' ? z.tag : '' };
})();
let timer = null;
const merken = () => schreibe(ANSICHT, zustand);
const blatt = (id) => (id && app.stand.notizbuch?.[id]) || null;
const gleich = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

const PLUS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ZURUECK = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const BLATT_IC = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14 3.5V8h5M9 12.5h7M9 16h5"/></svg>';

/** Wie viele Blätter es gibt (für den Schalter oben). */
export const notizenZahl = () => Object.keys(app.stand.notizbuch || {}).length;

function wann(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const heute = new Date();
  const gestern = new Date(Date.now() - 864e5);
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === heute.toDateString()) return `heute ${uhr}`;
  if (d.toDateString() === gestern.toDateString()) return `gestern ${uhr}`;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', ...(d.getFullYear() !== heute.getFullYear() ? { year: '2-digit' } : {}) });
}

const tagPille = (t, extra = '') => `<span class="amy-tag tf${tagFarbe(t)}${extra}">${esc(t)}</span>`;

/* ------------------------------------------------------------ Zeichnen */

function seitenHTML() {
  const alle = blaetter(app.stand.notizbuch);
  const tags = blattTags(app.stand.notizbuch);
  const filter = tags.some(([t]) => gleich(t, zustand.tag)) ? zustand.tag : '';
  const liste = filter ? alle.filter((b) => (b.tags || []).some((t) => gleich(t, filter))) : alle;
  const chips = tags.length ? `<div class="amy-filter nb-filter" role="group" aria-label="Blätter nach Tags filtern"><button type="button" class="amy-chip" data-nb-tag="" aria-pressed="${!filter}">Alle</button>${tags.map(([t, n]) => `<button type="button" class="amy-chip tf${tagFarbe(t)}" data-nb-tag="${esc(t)}" aria-pressed="${gleich(t, filter)}">${esc(t)}<span class="n">${n}</span></button>`).join('')}</div>` : '';
  const zeilen = liste.map((b) => `<li><button type="button" class="nb-tab f-${b.farbe}" data-nb-open="${esc(b.id)}"${b.id === zustand.offen ? ' aria-current="page"' : ''}><b>${esc(blattTitel(b))}</b>${blattVorschau(b) ? `<small>${esc(blattVorschau(b))}</small>` : ''}<span class="nb-tab-fuss">${(b.tags || []).slice(0, 3).map((t) => tagPille(t, ' klein')).join('')}<span class="nb-wann">${esc(wann(b.geaendert))}</span></span></button></li>`).join('');
  const leer = !alle.length
    ? `<div class="amy-leer nb-leer">${BLATT_IC}<p><b>Noch keine Blätter.</b></p><p>Für alles, was dich inspiriert – Ideen, Gerichte zum Ausprobieren, Gedanken. Ein Blatt je Thema, mit Farbe und Tags.</p></div>`
    : !liste.length ? '<p class="nb-nichts">Kein Blatt mit diesem Tag.</p>' : '';
  const wem = istEigen() ? '' : `<p class="fine nb-fein">Die Blätter liegen in eurer gemeinsamen Liste – ihr seht sie beide. Beim Planen zeigt der Essensplan ${person() === app.name() ? 'deine' : `${esc(wessen(person()))}`} Ideen als Inspiration.</p>`;
  return `<button type="button" class="amy-btn nb-neu" data-act="nb-neu"${app.listeDa ? '' : ' disabled'}>${PLUS}Neues Blatt</button>
${chips}<ul class="nb-liste" id="nb-liste">${zeilen}</ul>${leer}${wem}`;
}

function tagsHTML(b) {
  const da = b.tags || [];
  const bekannt = [...blattTags(app.stand.notizbuch), ...alleTags(app.stand.amyTags)].map(([t]) => t);
  const vorschlaege = [...new Set([...bekannt, ...TAG_VORSCHLAEGE])].filter((t) => !da.some((x) => gleich(x, t))).slice(0, 6);
  return `<div class="nb-tags" role="group" aria-label="Tags dieses Blatts">${da.map((t, i) => `<span class="amy-tag tf${tagFarbe(t)} mit-x">${esc(t)}<button type="button" data-nb-tag-weg="${i}" aria-label="Tag „${esc(t)}“ entfernen">×</button></span>`).join('')}${da.length < MAX_TAGS ? `<input class="nb-tag-feld" id="nb-tag-text" type="text" maxlength="24" placeholder="${da.length ? 'Tag dazu' : 'Tags, z. B. herbst'}" enterkeyhint="done" autocomplete="off" aria-label="Tag dazu">` : ''}</div>
${da.length < MAX_TAGS && vorschlaege.length ? `<div class="nb-tag-vorschlaege">${vorschlaege.map((t) => `<button type="button" class="amy-tag tf${tagFarbe(t)} vorschlag" data-nb-tag-dazu="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>` : ''}`;
}

function farbenHTML(b) {
  return `<div class="nb-farben" role="radiogroup" aria-label="Farbe des Blatts">${BLATT_FARBEN.map((f) => `<button type="button" class="nb-farbe f-${f}" role="radio" data-nb-farbe="${f}" aria-checked="${b.farbe === f}" aria-label="${FARBE_NAME[f]}"></button>`).join('')}</div>`;
}

const standText = (b) => (b ? `Gespeichert · ${wann(b.geaendert)}${b.by && b.by !== app.name() ? ` · zuletzt von ${b.by}` : ''}` : '');

function blattHTML(b) {
  if (!b) return `<div class="nb-blatt nb-blatt-leer" id="nb-blatt-leer"><p>${BLATT_IC}Wähl links ein Blatt – oder leg ein neues an.</p></div>`;
  return `<div class="nb-blatt f-${b.farbe}" id="nb-blatt" data-id="${esc(b.id)}">
<button type="button" class="back nb-zurueck" data-act="nb-zu">${ZURUECK}Alle Blätter</button>
<input class="nb-titel" id="nb-titel" type="text" maxlength="${MAX_TITEL}" value="${esc(b.titel)}" placeholder="Titel" autocomplete="off" aria-label="Titel des Blatts">
<div class="nb-werkzeug">${farbenHTML(b)}</div>
<div class="nb-tag-teil" id="nb-tag-teil">${tagsHTML(b)}</div>
<textarea class="nb-text" id="nb-text" maxlength="${MAX_TEXT}" placeholder="Ideen, Gerichte zum Ausprobieren, Gedanken …&#10;Eine Idee je Zeile – die tauchen beim Planen auf." aria-label="Text des Blatts">${esc(b.text)}</textarea>
<div class="nb-fuss"><span class="nb-stand" id="nb-stand" role="status">${esc(standText(b))}</span><button type="button" class="btn btn-quiet" data-act="nb-weg">Blatt löschen</button></div>
</div>`;
}

/** Der Teil „Notizen“ in Amys Bereich. */
export function notizenHTML() {
  if (zustand.offen && !blatt(zustand.offen) && app.listeDa) { zustand.offen = null; merken(); }
  const b = blatt(zustand.offen);
  return `<section class="nb${b ? ' ist-offen' : ''}" id="nb" aria-label="Notizen"><div class="nb-innen">
<div class="nb-seiten" id="nb-seiten">${app.listeDa ? seitenHTML() : '<p class="loading">Wird geladen…</p>'}</div>
${blattHTML(b)}
</div></section>`;
}

/**
 * Nach einer Änderung der Liste: Ist das Blatt offen, das gerade bearbeitet
 * wird, bleibt es stehen – nur die Liste daneben, die Tags und „Gespeichert“
 * kommen neu. true, wenn so aktualisiert wurde (sonst baut ansicht-amy.js neu).
 */
export function notizenAktualisieren(el) {
  const offen = el.querySelector('#nb-blatt');
  if (!offen || offen.dataset.id !== zustand.offen) return false;
  const b = blatt(zustand.offen);
  if (!b) return false;
  const seiten = el.querySelector('#nb-seiten');
  if (seiten && !seiten.contains(document.activeElement)) seiten.innerHTML = seitenHTML();
  // Vom anderen Gerät geändert und hier gerade nicht in Arbeit: übernehmen
  const titel = el.querySelector('#nb-titel');
  const text = el.querySelector('#nb-text');
  if (!timer && titel && document.activeElement !== titel && titel.value !== b.titel) titel.value = b.titel;
  if (!timer && text && document.activeElement !== text && text.value !== b.text) text.value = b.text;
  offen.className = `nb-blatt f-${b.farbe}`;
  const w = el.querySelector('.nb-werkzeug');
  if (w) w.innerHTML = farbenHTML(b);
  const tags = el.querySelector('#nb-tag-teil');
  if (tags) {
    const fokus = document.activeElement?.id === 'nb-tag-text';
    tags.innerHTML = tagsHTML(b);
    if (fokus) tags.querySelector('#nb-tag-text')?.focus({ preventScroll: true });
  }
  if (!timer) { const st = el.querySelector('#nb-stand'); if (st) st.textContent = standText(b); }
  return true;
}

/* ----------------------------------------------------------- Speichern */

/** Was im offenen Blatt steht, als Blatt – oder null. */
function ausFormular() {
  const el = $('#nb-blatt');
  const alt = blatt(el?.dataset.id);
  if (!el || !alt) return null;
  return { ...alt, titel: $('#nb-titel')?.value ?? alt.titel, text: $('#nb-text')?.value ?? alt.text };
}

function speichern(b) {
  if (!b) return;
  const alt = blatt(b.id);
  if (alt && alt.titel === b.titel && alt.text === b.text && alt.farbe === b.farbe && JSON.stringify(alt.tags) === JSON.stringify(tagsBereinigen(b.tags))) return;
  app.aendern(opBlatt(b, app.name()));
}

/** Gleich speichern, was getippt ist (vor dem Wechseln, beim Weggehen). */
export function notizJetztSpeichern() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  speichern(ausFormular());
}

function spaeterSpeichern() {
  clearTimeout(timer);
  const st = $('#nb-stand');
  if (st) st.textContent = 'Speichert …';
  timer = setTimeout(() => { timer = null; speichern(ausFormular()); }, SPEICHERN_NACH);
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') notizJetztSpeichern(); });
window.addEventListener('pagehide', notizJetztSpeichern);

/** Ein leeres Blatt, das man verlässt, verschwindet wieder. */
function verlassen() {
  notizJetztSpeichern();
  const b = blatt(zustand.offen);
  if (b && blattLeer(b)) app.aendern(opBlattWeg(b.id));
}

function neuZeichnen() {
  app.amyNeuZeichnen?.();
}

/* -------------------------------------------------------------- Klicks */

/** true, wenn der Klick hierher gehörte. */
export function klickNotizen(el) {
  const d = el.dataset;
  if ('nbOpen' in d) {
    if (d.nbOpen === zustand.offen) return true;
    verlassen();
    zustand.offen = d.nbOpen;
    merken();
    neuZeichnen();
    window.requestAnimationFrame(() => { if (window.matchMedia('(max-width: 719.98px)').matches) $('#nb')?.scrollIntoView({ block: 'start' }); });
    return true;
  }
  if ('nbTag' in d) { zustand.tag = d.nbTag; merken(); const s = $('#nb-seiten'); if (s) s.innerHTML = seitenHTML(); return true; }
  if ('nbFarbe' in d) {
    const b = ausFormular();
    if (b && BLATT_FARBEN.includes(d.nbFarbe)) { clearTimeout(timer); timer = null; speichern({ ...b, farbe: d.nbFarbe }); }
    return true;
  }
  if ('nbTagWeg' in d) {
    const b = ausFormular();
    if (b) { clearTimeout(timer); timer = null; speichern({ ...b, tags: (b.tags || []).filter((_, i) => i !== Number(d.nbTagWeg)) }); $('#nb-tag-text')?.focus({ preventScroll: true }); }
    return true;
  }
  if ('nbTagDazu' in d) { tagDazu(d.nbTagDazu); return true; }
  switch (d.act) {
    case 'nb-neu': {
      if (!app.listeDa) return true;
      verlassen();
      const id = neueBlattId();
      // Neue Blätter wechseln die Farbe, wie Abschnitte bei OneNote
      const farbe = BLATT_FARBEN[notizenZahl() % BLATT_FARBEN.length];
      app.aendern(opBlatt({ id, titel: '', text: '', farbe, tags: zustand.tag ? [zustand.tag] : [] }, app.name()));
      zustand.offen = id;
      merken();
      neuZeichnen();
      window.requestAnimationFrame(() => $('#nb-titel')?.focus());
      return true;
    }
    case 'nb-zu':
      verlassen();
      zustand.offen = null;
      merken();
      neuZeichnen();
      return true;
    case 'nb-weg': {
      notizJetztSpeichern();
      const b = blatt(zustand.offen);
      if (!b) return true;
      zustand.offen = null;
      merken();
      app.aendern(opBlattWeg(b.id));
      neuZeichnen();
      if (!blattLeer(b)) melde(`„${blattTitel(b)}“ gelöscht`, { knopf: 'Rückgängig', beiKnopf: () => { app.aendern(opZusammen({}, {}, { notizbuch: { [b.id]: b } })); zustand.offen = b.id; merken(); neuZeichnen(); } });
      return true;
    }
    default: return false;
  }
}

function tagDazu(roh) {
  const b = ausFormular();
  if (!b) return;
  const neu = tagsBereinigen([...(b.tags || []), ...String(roh).split(/[,;]/)]);
  clearTimeout(timer);
  timer = null;
  speichern({ ...b, tags: neu });
  const f = $('#nb-tag-text');
  if (f) { f.value = ''; f.focus({ preventScroll: true }); }
}

/** Tippen im Blatt: später speichern; im Tag-Feld macht ein Komma den Tag fertig. */
export function eingabeNotizen(ziel) {
  if (ziel.id === 'nb-titel' || ziel.id === 'nb-text') { spaeterSpeichern(); return true; }
  if (ziel.id === 'nb-tag-text') {
    if (/[,;]/.test(ziel.value)) {
      const teile = ziel.value.split(/[,;]/);
      const rest = teile.pop();
      tagDazu(teile.join(','));
      const f = $('#nb-tag-text');
      if (f) f.value = rest.trimStart();
    }
    return true;
  }
  return false;
}

/** Enter im Tag-Feld legt den Tag an, im Titel springt es in den Text. */
export function tasteNotizen(ziel) {
  if (ziel?.id === 'nb-tag-text') { if (ziel.value.trim()) tagDazu(ziel.value); return true; }
  if (ziel?.id === 'nb-titel') { $('#nb-text')?.focus(); return true; }
  return false;
}
