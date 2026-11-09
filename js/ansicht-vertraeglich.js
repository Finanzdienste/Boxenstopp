/*
 * Amys Bereich → Verträglich: was sie verträgt und was nicht – sie trägt es
 * selbst ein (geht / nur wenig / geht nicht, mit Notiz). Gespeichert in der
 * privaten Liste (liste.json `vertraeglich`, vertraeglich.js), nie im Code.
 *
 * Und überall, wo es zählt, sagt die App Bescheid: an den Rezepten (Karte,
 * Rezept, einzelne Zutaten), in Amys eigenen Rezepten, im Essensplan bei
 * allem, was sie mitisst – dazu der Filter „Passt für Amy“ bei den Rezepten.
 * Wer gerade schaut, bestimmt die Worte: Amy liest „für dich“, Tobi „für Amy“.
 */
import { app, $, melde, zeigeReiter, ansicht } from './kern.js';
import { esc } from './format.js';
import { nameSchluessel } from './format.js';
import { person, wessen } from './profil.js';
import { STUFEN, STUFE_TEXT, STUFE_ZEICHEN, opVertraeglich, eintraegeVon, pruefen, namenKurz, zutatenFest, personSchluessel } from './vertraeglich.js';

let stufe = 'nicht'; // was im Formular gewählt ist
let bearbeiten = null; // Schlüssel des Eintrags, der gerade im Formular steht

/** Die Person des rosa Bereichs (bei euch Amy) und ob sie selbst schaut. */
export function wem() {
  const name = person();
  const ich = !!app.name() && app.name().toLowerCase() === name.toLowerCase();
  return { name, ich, fuer: ich ? 'dich' : name };
}

const eintraege = () => eintraegeVon(app.stand, person());
export const vertraeglichZahl = () => eintraege().length;
/** Gibt es überhaupt eine Liste – sonst zeigt die App nirgends etwas an. */
export const hatVertraeglich = () => eintraege().length > 0;

/** Ein festes Rezept (oder eins aus Katalog/Resteverwertung) prüfen: { nicht, wenig, geht }. */
export function pruefeFest(r) {
  const e = eintraege();
  return e.length && r ? pruefen(zutatenFest(r, app.katalog), e) : { nicht: [], wenig: [], geht: [] };
}

/** Zutaten [{ k, name }] prüfen – für Amys Rezepte und den Essensplan. */
export function pruefeZutaten(zutaten) {
  const e = eintraege();
  return e.length ? pruefen(zutaten, e) : { nicht: [], wenig: [], geht: [] };
}

/** Die Stufe einer Zutat aus einem Ergebnis von pruefen – 'nicht', 'wenig' oder ''. */
export function stufeVon(ergebnis, zutat) {
  for (const s of ['nicht', 'wenig']) if (ergebnis[s].some((t) => t.zutat === zutat || (t.zutat.k && t.zutat.k === zutat.k) || t.zutat.name === zutat.name)) return s;
  return '';
}

/** Kleine Pille an der Rezeptkarte: „✗ nicht für Amy“ / „~ wenig für dich“ – oder ''. */
export function pilleHTML(ergebnis) {
  const w = wem();
  if (ergebnis.nicht.length) return `<span class="pill pill-vt vt-nicht" title="${esc(`Geht nicht für ${w.fuer}: ${namenKurz(ergebnis.nicht)}`)}">✗ nicht für ${esc(w.fuer)}</span>`;
  if (ergebnis.wenig.length) return `<span class="pill pill-vt vt-wenig" title="${esc(`Nur wenig für ${w.fuer}: ${namenKurz(ergebnis.wenig)}`)}">~ wenig für ${esc(w.fuer)}</span>`;
  return '';
}

/** Der Hinweis im Rezept: was nicht geht und was nur wenig – mit Notizen. */
export function hinweisHTML(ergebnis) {
  const w = wem();
  if (!ergebnis.nicht.length && !ergebnis.wenig.length) {
    return hatVertraeglich() ? `<p class="vt-hinweis vt-passt"><b>✓ Passt für ${esc(w.fuer)}</b> – nichts drin, was ${w.ich ? 'du' : `${esc(w.name)}`} nicht ${w.ich ? 'verträgst' : 'verträgt'}.</p>` : '';
  }
  const zeile = (s, liste) => (liste.length ? `<li class="vt-${s}"><b>${STUFE_ZEICHEN[s]} ${s === 'nicht' ? 'Geht nicht' : 'Nur wenig'}:</b> ${liste.map((t) => `${esc(t.zutat.name)}${normalAnders(t) ? ` <small>(wegen „${esc(t.eintrag.name)}“)</small>` : ''}${t.eintrag.notiz ? ` <small>– ${esc(t.eintrag.notiz)}</small>` : ''}`).join(', ')}</li>` : '');
  return `<div class="vt-hinweis${ergebnis.nicht.length ? ' vt-ist-nicht' : ' vt-ist-wenig'}" role="note"><p class="vt-k">Für ${esc(w.fuer)}</p><ul>${zeile('nicht', ergebnis.nicht)}${zeile('wenig', ergebnis.wenig)}</ul><button type="button" class="linkbtn" data-act="vt-zeigen">${w.ich ? 'Deine Liste' : `${esc(wessen(w.name))} Liste`} ansehen</button></div>`;
}
const normalAnders = (t) => t.zutat.name.toLowerCase() !== t.eintrag.name.toLowerCase();

/** Das Zeichen an einer Zutat im Rezept. */
export function zeichenHTML(s) {
  if (!s) return '';
  const w = wem();
  return `<span class="vt-zeichen vt-${s}" title="${esc(`${STUFE_TEXT[s]} für ${w.fuer}`)}" aria-label="${esc(`${STUFE_TEXT[s]} für ${w.fuer}`)}">${STUFE_ZEICHEN[s]}</span>`;
}

/* ------------------------------------------------------- Der Teil selbst */

function formularHTML() {
  const e = bearbeiten ? app.stand.vertraeglich?.[personSchluessel(person())]?.[bearbeiten] : null;
  const namen = [...new Set(Object.values(app.katalog || {}).map((x) => x.n).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  return `<form class="vt-form" id="vt-form" autocomplete="off" novalidate>
<p class="vt-form-k">${e ? `„${esc(e.name)}“ ändern` : 'Zutat eintragen'}</p>
<input class="vt-name" id="vt-name" type="text" maxlength="60" list="vt-namen" placeholder="z. B. Zwiebeln" value="${esc(e?.name || '')}" aria-label="Zutat"${e ? ' readonly' : ''}>
<div class="vt-stufen" role="radiogroup" aria-label="Wie gut">${STUFEN.map((s) => `<button type="button" class="vt-stufe vt-${s}" role="radio" data-vt-stufe="${s}" aria-checked="${s === stufe}">${STUFE_ZEICHEN[s]} ${STUFE_TEXT[s]}</button>`).join('')}</div>
<input class="vt-notiz" id="vt-notiz" type="text" maxlength="120" placeholder="Notiz, z. B. gekocht geht" value="${esc(e?.notiz || '')}" aria-label="Notiz (freiwillig)">
<div class="vt-form-btns"><button type="submit" class="amy-btn">${e ? 'Ändern' : 'Eintragen'}</button>${e ? '<button type="button" class="btn btn-quiet" data-act="vt-abbrechen">Abbrechen</button>' : ''}</div>
<datalist id="vt-namen">${namen.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
</form>`;
}

function gruppenHTML() {
  const alle = eintraege();
  if (!alle.length) return '';
  const KOPF = { nicht: '✗ Geht nicht', wenig: '~ Nur wenig', geht: '✓ Geht gut' };
  return `<div class="vt-gruppen">${['nicht', 'wenig', 'geht'].map((s) => {
    const l = alle.filter(([, e]) => e.stufe === s);
    if (!l.length) return '';
    return `<section class="vt-gruppe vt-${s}"><h3 class="vt-gruppe-k">${KOPF[s]}<span class="n">${l.length}</span></h3><ul>${l.map(([k, e]) => `<li><button type="button" class="vt-e" data-vt-bearbeiten="${esc(k)}" aria-label="„${esc(e.name)}“ ändern"><b>${esc(e.name)}</b>${e.notiz ? `<small>${esc(e.notiz)}</small>` : ''}</button><button type="button" class="vt-x" data-vt-weg="${esc(k)}" aria-label="„${esc(e.name)}“ entfernen">×</button></li>`).join('')}</ul></section>`;
  }).join('')}</div>`;
}

function passtHTML() {
  if (!hatVertraeglich()) return '';
  const rezepte = app.rezepte || [];
  const passt = rezepte.filter((r) => !pruefeFest(r).nicht.length).length;
  const w = wem();
  return `<p class="vt-passt-zahl">Von ${rezepte.length} Rezepten ${passt === 1 ? 'passt eins' : `passen ${passt}`} für ${esc(w.fuer)}. <button type="button" class="linkbtn" data-act="vt-zu-rezepten">Zeigen</button></p>`;
}

/** Der Teil „Verträglich“ in Amys Bereich. */
export function vertraeglichHTML() {
  const w = wem();
  const lead = w.ich
    ? 'Trag ein, was dir bekommt und was nicht. Die App sagt es dann bei den Rezepten, in deinen eigenen und im Essensplan.'
    : `Was ${esc(w.name)} verträgt – sie trägt es selbst ein. Die App sagt es bei den Rezepten und im Essensplan, wenn ${esc(w.name)} mitisst.`;
  return `<section class="vt" id="vt" aria-label="Verträglich">
<p class="vt-lead">${lead}</p>
${app.listeDa ? `${formularHTML()}${gruppenHTML()}${passtHTML()}` : '<p class="loading">Wird geladen…</p>'}
<p class="fine vt-fein">Liegt nur in eurer privaten Liste – nicht im Code der App. Die App vergleicht nach Namen: „Zwiebel“ trifft auch Frühlingszwiebeln; was genauer drinsteht, gilt („laktosefreie Milch: geht“ vor „Milch: geht nicht“).</p>
</section>`;
}

/** Nach einer Änderung der Liste: das Formular in Ruhe lassen, wenn darin getippt wird. true, wenn so aktualisiert. */
export function vertraeglichAktualisieren(el) {
  const form = el.querySelector('#vt-form');
  if (!form || !form.contains(document.activeElement)) return false;
  const vt = el.querySelector('#vt');
  if (!vt) return false;
  vt.querySelector('.vt-gruppen')?.remove();
  vt.querySelector('.vt-passt-zahl')?.remove();
  form.insertAdjacentHTML('afterend', gruppenHTML() + passtHTML());
  return true;
}

function neu() {
  app.amyNeuZeichnen?.();
}

/** Schlüssel für einen Namen: der Katalog-Schlüssel, wenn es die Zutat dort genau so gibt, sonst n:… */
function schluesselFuer(name) {
  const n = name.toLowerCase();
  const k = Object.entries(app.katalog || {}).find(([, x]) => String(x.n || '').toLowerCase() === n)?.[0];
  return k || nameSchluessel(name);
}

/** true, wenn der Klick hierher gehörte. */
export function klickVertraeglich(el) {
  const d = el.dataset;
  if (d.vtStufe && el.closest('#vt-form')) {
    stufe = STUFEN.includes(d.vtStufe) ? d.vtStufe : 'nicht';
    for (const b of el.closest('.vt-stufen').querySelectorAll('[data-vt-stufe]')) b.setAttribute('aria-checked', String(b.dataset.vtStufe === stufe));
    return true;
  }
  if (d.vtBearbeiten) {
    const e = app.stand.vertraeglich?.[personSchluessel(person())]?.[d.vtBearbeiten];
    if (!e) return true;
    bearbeiten = d.vtBearbeiten;
    stufe = e.stufe;
    neu();
    window.requestAnimationFrame(() => { $('#vt-form')?.scrollIntoView({ block: 'center' }); $('#vt-notiz')?.focus({ preventScroll: true }); });
    return true;
  }
  if (d.vtWeg) {
    const alt = app.stand.vertraeglich?.[personSchluessel(person())]?.[d.vtWeg];
    if (!alt) return true;
    if (bearbeiten === d.vtWeg) bearbeiten = null;
    app.aendern(opVertraeglich(person(), { [d.vtWeg]: null }, app.name()));
    melde(`„${alt.name}“ entfernt`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opVertraeglich(person(), { [d.vtWeg]: alt }, alt.by || app.name())) });
    return true;
  }
  switch (d.act) {
    case 'vt-abbrechen': bearbeiten = null; neu(); return true;
    case 'vt-zeigen': app.amyTeilZeigen?.('vertraeglich'); return true;
    case 'vt-zu-rezepten':
      ansicht.filter = 'vertraeglich';
      zeigeReiter('rezepte');
      app.rezepteNeu?.();
      window.requestAnimationFrame(() => window.scrollTo(0, 0));
      return true;
    default: return false;
  }
}

/** Eintragen oder ändern. true, wenn das Formular hierher gehörte. */
export function absendenVertraeglich(ev) {
  if (ev.target.id !== 'vt-form') return false;
  ev.preventDefault();
  const name = String($('#vt-name')?.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name) { $('#vt-name')?.focus(); return true; }
  const k = bearbeiten || schluesselFuer(name);
  const notiz = String($('#vt-notiz')?.value || '').trim().slice(0, 120);
  const alt = app.stand.vertraeglich?.[personSchluessel(person())]?.[k] || null;
  app.aendern(opVertraeglich(person(), { [k]: { name: alt?.name || name, stufe, notiz } }, app.name()));
  melde(`${alt?.name || name}: ${STUFE_TEXT[stufe]}`, alt ? {} : { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opVertraeglich(person(), { [k]: null }, app.name())) });
  bearbeiten = null;
  neu();
  window.requestAnimationFrame(() => $('#vt-name')?.focus({ preventScroll: true }));
  return true;
}
