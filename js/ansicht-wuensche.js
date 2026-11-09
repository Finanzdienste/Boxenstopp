/*
 * Amys Bereich → Vorschläge: Amy schreibt auf, was Tobi besser machen soll
 * (an der App oder sonst), Tobi sieht es in seiner App, hakt ab, was
 * erledigt ist, und antwortet kurz. „Alle offenen kopieren“ gibt sie als
 * Text weiter. Nur in der gemeinsamen Liste (wuensche.js, liste.json
 * `wuensche`), nicht in eigenen Listen.
 */
import { app, $, melde } from './kern.js';
import { esc } from './format.js';
import { person } from './profil.js';
import { opZusammen } from './liste.js';
import { opWunsch, opWunschErledigt, opWunschAntwort, opWunschWeg, neueWunschId, wuenscheSortiert, wuenscheText } from './wuensche.js';

let antwortOffen = null; // der Vorschlag, unter dem gerade eine Antwort getippt wird
let erledigteZeigen = false;

export const wuenscheOffen = () => wuenscheSortiert(app.stand.wuensche).offen.length;

/** Wer schreibt (Amy) und für wen (der andere in der Liste, sonst Tobi). */
function wer() {
  const sie = person();
  const ich = app.name() || '';
  const andere = Object.values(app.stand.leute || {}).find((n) => String(n).toLowerCase() !== sie.toLowerCase()) || 'Tobi';
  return { sie, andere, ichBinSie: ich.toLowerCase() === sie.toLowerCase() };
}

const datum = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }); };
const absaetze = (t) => esc(t).replace(/\n/g, '<br>');

function eintragHTML(w) {
  const von = w.by ? (w.by === app.name() ? 'du' : esc(w.by)) : '';
  const fertig = w.erledigt ? ` · erledigt ${esc(datum(w.erledigt))}${w.erledigtVon && w.erledigtVon !== w.by ? ` von ${w.erledigtVon === app.name() ? 'dir' : esc(w.erledigtVon)}` : ''}` : '';
  const antwort = w.antwort ? `<p class="ws-antwort"><b>${w.antwortVon === app.name() ? 'Du' : esc(w.antwortVon || 'Antwort')}:</b> ${absaetze(w.antwort)}</p>` : '';
  const form = antwortOffen === w.id
    ? `<form class="ws-antwort-form" data-ws-antwort="${esc(w.id)}" autocomplete="off"><input type="text" name="antwort" maxlength="500" value="${esc(w.antwort || '')}" placeholder="Kurze Antwort, z. B. „ist drin ♡“" aria-label="Antwort"><button type="submit" class="btn">Senden</button><button type="button" class="btn btn-quiet" data-act="ws-antwort-zu">Abbrechen</button></form>`
    : `<button type="button" class="linkbtn ws-antworten" data-ws-antworten="${esc(w.id)}">${w.antwort ? 'Antwort ändern' : 'Antworten'}</button>`;
  return `<li class="ws-e${w.erledigt ? ' ist-fertig' : ''}">
<button type="button" class="cb" role="checkbox" aria-checked="${!!w.erledigt}" data-ws-fertig="${esc(w.id)}" aria-label="${w.erledigt ? 'Wieder offen' : 'Erledigt'}"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg></button>
<div class="ws-inhalt"><p class="ws-text">${absaetze(w.text)}</p><p class="ws-wer">${[von, esc(datum(w.at))].filter(Boolean).join(' · ')}${fertig}</p>${antwort}${form}</div>
<button type="button" class="x" data-ws-weg="${esc(w.id)}" aria-label="Vorschlag löschen">×</button>
</li>`;
}

/** Der Teil „Vorschläge“ in Amys Bereich. */
export function wuenscheHTML() {
  const { sie, andere, ichBinSie } = wer();
  const { offen, fertig } = wuenscheSortiert(app.stand.wuensche);
  const lead = ichBinSie
    ? `Was soll besser werden – an der App oder sonst? Schreib's auf, ${esc(andere)} sieht es in seiner App und hakt ab, was erledigt ist.`
    : `${esc(sie)}s Vorschläge für dich. Hak ab, was erledigt ist – sie sieht es, und deine Antwort auch.`;
  const form = `<form class="ws-form" id="ws-form" autocomplete="off"><label class="sr" for="ws-text">Neuer Vorschlag</label><textarea id="ws-text" rows="3" maxlength="1000" placeholder="${ichBinSie ? 'z. B. „Auf der Liste soll man …“' : 'Ein Vorschlag …'}"></textarea><div class="ws-form-btns"><button type="submit" class="amy-btn">${ichBinSie ? `An ${esc(andere)}` : 'Eintragen'}</button></div></form>`;
  const kopieren = offen.length ? `<button type="button" class="btn ws-kopieren" data-act="ws-kopieren">Alle offenen kopieren<span class="btn-n">${offen.length}</span></button>` : '';
  const liste = offen.length ? `<ul class="ws-liste">${offen.map(eintragHTML).join('')}</ul>` : `<p class="ws-leer">${ichBinSie ? 'Noch nichts offen.' : 'Gerade nichts offen ♡'}</p>`;
  const erledigt = fertig.length ? `<button type="button" class="linkbtn ws-fertig-auf" data-act="ws-erledigte" aria-expanded="${erledigteZeigen}">${erledigteZeigen ? 'Erledigte ausblenden' : `Erledigt (${fertig.length})`}</button>${erledigteZeigen ? `<ul class="ws-liste ws-erledigt">${fertig.map(eintragHTML).join('')}</ul>` : ''}` : '';
  return `<section class="ws" id="ws" aria-label="Vorschläge"><p class="vt-lead">${lead}</p>${app.listeDa ? `${form}<div class="ws-kopf"><h2 class="ws-k">Offen</h2>${kopieren}</div>${liste}${erledigt}` : '<p class="loading">Wird geladen…</p>'}</section>`;
}

/** Nach einer Änderung: Wird gerade getippt, bleibt das Feld stehen. true, wenn so aktualisiert. */
export function wuenscheAktualisieren(el) {
  const aktiv = document.activeElement;
  const ws = el.querySelector('#ws');
  if (!ws || !aktiv || !ws.contains(aktiv) || !aktiv.matches('textarea, input')) return false;
  // Nur die Liste neu – das Feld, in dem getippt wird, bleibt
  const tmp = document.createElement('div');
  tmp.innerHTML = wuenscheHTML();
  for (const sel of ['.ws-kopf', '.ws-liste:not(.ws-erledigt)', '.ws-leer']) {
    const alt = ws.querySelector(sel);
    const neu = tmp.querySelector(sel);
    if (alt && neu && !alt.contains(aktiv)) alt.replaceWith(neu);
  }
  return true;
}

const neu = () => app.amyNeuZeichnen?.();

/** true, wenn der Klick hierher gehörte. */
export function klickWuensche(el) {
  const d = el.dataset;
  if (d.wsFertig) {
    const w = app.stand.wuensche?.[d.wsFertig];
    if (w) app.aendern(opWunschErledigt(w.id, !w.erledigt, app.name()));
    return true;
  }
  if (d.wsAntworten) { antwortOffen = d.wsAntworten; neu(); window.requestAnimationFrame(() => $(`form[data-ws-antwort="${d.wsAntworten}"] input`)?.focus()); return true; }
  if (d.wsWeg) {
    const w = app.stand.wuensche?.[d.wsWeg];
    if (!w) return true;
    app.aendern(opWunschWeg(w.id));
    melde('Vorschlag gelöscht', { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opZusammen({}, {}, { wuensche: { [w.id]: w } })) });
    return true;
  }
  switch (d.act) {
    case 'ws-antwort-zu': antwortOffen = null; neu(); return true;
    case 'ws-erledigte': erledigteZeigen = !erledigteZeigen; neu(); return true;
    case 'ws-kopieren': {
      const text = `Vorschläge von ${wer().sie} für Boxenstopp:\n${wuenscheText(app.stand.wuensche)}`;
      const zeigen = () => {
        const ws = $('#ws');
        if (!ws || ws.querySelector('.ws-feld')) return;
        ws.querySelector('.ws-kopf')?.insertAdjacentHTML('afterend', `<textarea class="e-fehler-feld ws-feld" readonly rows="6" aria-label="Die offenen Vorschläge zum Kopieren">${esc(text)}</textarea>`);
        ws.querySelector('.ws-feld')?.select();
      };
      try { navigator.clipboard.writeText(text).then(() => melde('Kopiert – jetzt einfügen und weitergeben'), zeigen); } catch { zeigen(); }
      return true;
    }
    default: return false;
  }
}

/** Neuer Vorschlag oder eine Antwort. true, wenn das Formular hierher gehörte. */
export function absendenWuensche(ev) {
  const f = ev.target;
  if (f.id === 'ws-form') {
    ev.preventDefault();
    const feld = $('#ws-text');
    const text = String(feld?.value || '').trim();
    if (!text) { feld?.focus(); return true; }
    app.aendern(opWunsch(neueWunschId(), text, app.name()));
    feld.value = '';
    const { andere, ichBinSie } = wer();
    melde(ichBinSie ? `Ist bei ${andere} ♡` : 'Eingetragen');
    neu();
    return true;
  }
  if (f.matches?.('form[data-ws-antwort]')) {
    ev.preventDefault();
    const id = f.dataset.wsAntwort;
    app.aendern(opWunschAntwort(id, String(f.elements.antwort?.value || ''), app.name()));
    antwortOffen = null;
    neu();
    return true;
  }
  return false;
}
