/*
 * Einstellungen → Microsoft To Do: der Putzplan als Aufgaben in To Do (die
 * Aufgaben eines Putztags als Schritte, abhaken geht dort und hier). Nach dem
 * Verbinden wählt man die Liste: eine eigene neue „Haushalt“ (die eigenen
 * Putztage) oder eine vorhandene – in einer gemeinsamen stehen alle
 * Putztage, mit Namen, und die andere Person muss nichts tun.
 *
 * Die Arbeit macht werkzeug/todo.mjs im Daten-Repo (haushalt.yml). Die App
 * schreibt nur Wünsche in liste.json – die App-ID von Microsoft (einmal,
 * Tobis Registrierung), verbinden, abgleichen, trennen (haushalt.todoWunsch,
 * mit „· To Do“ in der Commit-Nachricht) – und liest todo.json: den Code zum
 * Anmelden, ob jemand verbunden ist, wann zuletzt abgeglichen wurde. Tokens
 * sieht sie nie.
 */
import { app, $, melde, lese, ansicht } from './kern.js';
import { istEigen } from './profil.js';
import { esc, uhrzeit } from './format.js';
import { privatLesen, API } from './speicher.js';
import { opTodoApp, opTodoWunsch, opTodoZiel, TODO_APP_ID } from './liste.js';

let todo = null; // todo.json, zuletzt gelesen
let holt = false;
let timer = null;
let appIdOffen = false;
let trennenFragen = false;
let listeWaehlen = false;

const api = () => lese('__api', null) || API;
const ich = () => String(app.name() || '').trim().toLowerCase();
/** Wie oft nachsehen, solange ein Code kommt oder angezeigt wird (in den Tests schneller). */
const schnell = () => Math.min(4000, Number(lese('__takt', 0)) || 4000);

/** Mein Wunsch, den der Lauf im Daten-Repo noch nicht erledigt hat – oder null. */
function wartet() {
  const w = app.stand.haushalt?.todoWunsch?.[ich()];
  const p = todo?.personen?.[ich()];
  if (w && (!p?.wunsch || p.wunsch < w.at)) return w;
  // Eine neu gewählte Liste, die der Lauf noch nicht übernommen hat
  const z = app.stand.haushalt?.todoZiel?.[ich()];
  return z && p?.status === 'verbunden' && p.zielAt !== z.at ? { art: 'ziel', at: z.at } : null;
}
/** Wer schon über eine gemeinsame Liste verbunden ist (dann muss sonst niemand) – oder null. */
function gemeinsamUeber() {
  for (const [n, x] of Object.entries(todo?.personen || {})) if (n !== ich() && x?.status === 'verbunden' && x.geteilt && x.listeName) return { wer: x.name || n, liste: x.listeName };
  return null;
}
const codeGilt = (p) => p?.status === 'code' && p.code && Date.parse(p.bis) > Date.now();

function planen() {
  clearTimeout(timer);
  if (ansicht.tab !== 'einstellungen' || !app.zugang || !app.stand.haushalt?.todoApp) return;
  const eilig = wartet() || codeGilt(todo?.personen?.[ich()]);
  timer = setTimeout(todoHolen, eilig ? schnell() : 60000);
}

/** todo.json holen und zeichnen – in den Einstellungen, solange sie offen sind. */
export async function todoHolen() {
  if (!app.zugang || holt || !app.stand.haushalt?.todoApp || istEigen()) { todoZeichnen(); return; }
  holt = true;
  try {
    const t = await privatLesen('todo.json', { token: app.zugang.token, api: api() });
    todo = t && typeof t === 'object' && t.personen && typeof t.personen === 'object' ? t : { personen: {} };
  } finally {
    holt = false;
  }
  todoZeichnen();
  planen();
}

const WIE = 'Ist ein Putztag dran, steht er in To Do als Aufgabe, fällig an seinem Tag, mit den Aufgaben als Schritten – in einer neuen Liste „Haushalt“ oder in einer, die ihr schon habt (auch einer gemeinsamen). Abhaken geht dort und hier; abgeglichen wird dreimal am Tag und gleich, wenn sich hier etwas tut.';

function appIdHTML(aktuell) {
  return `<p class="fine">Damit Boxenstopp an To Do darf, braucht es einmal eine App-ID von Microsoft – angelegt in ein paar Minuten, kostenlos, wie bei der Workout-App. Sie ist kein Geheimnis: Sie sagt Microsoft nur, wer fragt. Danach verbindet jeder sein eigenes To Do.</p>
<details class="todo-anleitung"><summary>So bekommst du die App-ID</summary><ol>
<li>Auf <b>portal.azure.com</b> mit dem Microsoft-Konto anmelden, mit dem du auch die Workout-App registriert hast.</li>
<li><b>App-Registrierungen</b> → <b>Neue Registrierung</b>: Name „Boxenstopp“, Kontotypen <b>Nur persönliche Microsoft-Konten</b>, Umleitungs-URI leer lassen → <b>Registrieren</b>.</li>
<li>Links <b>Authentifizierung</b> → unten <b>Öffentliche Clientflows zulassen</b> auf <b>Ja</b> → Speichern.</li>
<li><b>API-Berechtigungen</b> → <b>Berechtigung hinzufügen</b> → Microsoft Graph → <b>Delegierte Berechtigungen</b> → <b>Tasks.ReadWrite</b> → hinzufügen.</li>
<li>Unter <b>Übersicht</b> die <b>Anwendungs-ID (Client)</b> kopieren und hier einfügen.</li>
</ol></details>
<form class="e-ki-form" id="todo-app-form" autocomplete="off"><input id="todo-app-input" type="text" inputmode="text" spellcheck="false" autocapitalize="off" placeholder="z. B. 1a2b3c4d-5e6f-…" aria-label="Anwendungs-ID von Microsoft" value="${esc(aktuell || '')}"><div class="zugang-btns"><button type="submit" class="btn">Speichern</button>${aktuell ? '<button type="button" class="btn btn-quiet" data-act="todo-appid-zu">Abbrechen</button>' : ''}</div></form>`;
}

function codeHTML(p) {
  const bis = new Date(p.bis);
  // Nur eine Adresse bei Microsoft (todo.mjs prüft sie schon – todo.json ließe sich aber von Hand ändern)
  const url = /^https:\/\/([a-z0-9-]+\.)*(microsoft\.com|microsoftonline\.com|live\.com|aka\.ms)\//i.test(String(p.url || '')) ? p.url : 'https://www.microsoft.com/link';
  return `<p>Fast fertig: Bei Microsoft anmelden und diesen Code eingeben.</p>
<div class="todo-code"><b id="todo-code">${esc(p.code)}</b><button type="button" class="btn btn-klein" data-act="todo-kopieren">Kopieren</button></div>
<div class="zugang-btns"><a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Code bei Microsoft eingeben</a></div>
<p class="fine">Mit dem Microsoft-Konto anmelden, in dem dein To Do ist, und „Boxenstopp“ den Zugriff erlauben. Der Code gilt bis ${esc(uhrzeit(bis))} Uhr. Danach einfach hierher zurück – die App merkt es von selbst.</p>`;
}

function zuletztText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const heute = new Date();
  const gleich = d.toDateString() === heute.toDateString();
  return `${gleich ? 'heute' : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })} ${uhrzeit(d)} Uhr`;
}

function wahlHTML(p) {
  const listen = Array.isArray(p.listen) ? p.listen : [];
  const jetzt = app.stand.haushalt?.todoZiel?.[ich()]?.id;
  // Vorgewählt: die jetzige – sonst eine gemeinsame, wenn es eine gibt
  const vor = jetzt || listen.find((l) => l.geteilt)?.id || 'neu';
  const zeile = (id, name, klein) => `<label class="todo-wahl"><input type="radio" name="todo-ziel" value="${esc(id)}"${id === vor ? ' checked' : ''}><span><b>${esc(name)}</b><small>${esc(klein)}</small></span></label>`;
  const andere = Object.entries(todo?.personen || {}).filter(([n, x]) => n !== ich() && x?.status === 'verbunden').map(([n, x]) => x.name || n);
  return `<p>${p.wahl && !jetzt ? '✓ Verbunden. Noch eins: ' : ''}In welche Liste in To Do sollen die Putztage?</p>
${p.fehler ? `<p class="todo-fehler" role="alert">${esc(p.fehler)}</p>` : ''}
<form class="todo-ziel" id="todo-ziel-form">
${zeile('neu', 'Neue Liste „Haushalt“', 'nur deine Putztage')}
${listen.map((l) => zeile(l.id, l.name, l.geteilt ? 'gemeinsame Liste – alle Putztage, mit Namen' : 'nur deine Putztage')).join('')}
<div class="zugang-btns"><button type="submit" class="btn btn-primary">Übernehmen</button>${jetzt ? '<button type="button" class="btn btn-quiet" data-act="todo-liste-zu">Abbrechen</button>' : ''}</div>
</form>
<p class="fine">In einer gemeinsamen Liste seht ihr beide alles und könnt beide abhaken – dann reicht es, wenn einer verbunden ist. Zuweisen lässt Microsoft Apps nicht: Dafür steht im Titel, wer dran ist („Bad · Amy“).${andere.length ? ` ${esc(andere.join(' und '))} ist auch verbunden – bei einer gemeinsamen Liste dort trennen, sonst steht es doppelt da.` : ''}</p>`;
}

function verbundenHTML(p, w) {
  const zuletzt = p.zuletzt ? zuletztText(p.zuletzt) : '';
  if (w?.art === 'ziel') return '<p class="todo-warte" role="status">Wird umgestellt – gleich stehen die Putztage in der gewählten Liste …</p>';
  if (listeWaehlen || (p.wahl && Array.isArray(p.listen))) return wahlHTML(p);
  if (trennenFragen) {
    return `<p>To Do trennen? Offene Putz-Aufgaben verschwinden aus deinem To Do, erledigte und die Liste „Haushalt“ bleiben.</p>
<div class="zugang-btns"><button type="button" class="btn btn-danger" data-act="todo-trennen-ja">Ja, trennen</button><button type="button" class="btn btn-quiet" data-act="todo-trennen-nein">Abbrechen</button></div>`;
  }
  const liste = p.listeName || app.stand.haushalt?.todoZiel?.[ich()]?.name || 'Haushalt';
  return `<p class="e-ok todo-an">✓ Verbunden – ${p.geteilt ? `alle Putztage stehen in eurer gemeinsamen Liste „${esc(liste)}“.` : `deine Putztage stehen in der Liste „${esc(liste)}“.`}</p>
<p class="fine">${zuletzt ? `Zuletzt abgeglichen: ${esc(zuletzt)}.` : 'Der erste Abgleich läuft gleich.'}${p.fehler ? ` ${esc(p.fehler)}` : ''}</p>
<div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="todo-jetzt"${w?.art === 'abgleichen' ? ' disabled' : ''}>${w?.art === 'abgleichen' ? 'Gleicht ab …' : 'Jetzt abgleichen'}</button><button type="button" class="btn btn-quiet" data-act="todo-liste">Andere Liste</button><button type="button" class="btn btn-quiet" data-act="todo-trennen">Trennen</button></div>`;
}

function todoHTML() {
  if (!app.zugang) return `<p class="fine">${esc(WIE)} Das geht, sobald die gemeinsame Liste eingerichtet ist.</p>`;
  const h = app.stand.haushalt || {};
  if (!h.todoApp || appIdOffen) return appIdHTML(h.todoApp);
  if (!todo) return '<p class="fine">Wird geprüft …</p>';
  const p = todo.personen?.[ich()] || null;
  const w = wartet();
  let meins;
  if (w?.art === 'verbinden') meins = '<p class="todo-warte" role="status">Microsoft gibt gleich einen Code – das dauert etwa eine halbe Minute …</p>';
  else if (w?.art === 'trennen') meins = '<p class="todo-warte" role="status">Wird getrennt …</p>';
  else if (codeGilt(p)) meins = codeHTML(p);
  else if (p?.status === 'verbunden') meins = verbundenHTML(p, w);
  else if (gemeinsamUeber()) {
    const g = gemeinsamUeber();
    meins = `<p class="e-ok todo-an">✓ Die Putztage stehen schon in eurer gemeinsamen Liste „${esc(g.liste)}“ (über ${esc(g.wer)}) – für dich ist hier nichts zu tun.</p>`;
  } else {
    meins = `${p?.fehler ? `<p class="todo-fehler" role="alert">${esc(p.fehler)}</p>` : ''}<p class="fine">${esc(WIE)}</p>
<div class="zugang-btns"><button type="button" class="btn" data-act="todo-verbinden">Mit Microsoft To Do verbinden</button></div>`;
  }
  const andere = gemeinsamUeber() ? [] : Object.entries(todo.personen || {}).filter(([n, x]) => n !== ich() && x?.status === 'verbunden').map(([n, x]) => x.name || n);
  return `${meins}${andere.length ? `<p class="fine">Auch verbunden: ${esc(andere.join(', '))}.</p>` : ''}
<p class="fine todo-fuss"><button type="button" class="linkbtn" data-act="todo-appid">App-ID von Microsoft ändern</button></p>`;
}

export function todoZeichnen() {
  const el = $('#todo-bereich');
  if (!el) return;
  // Noch nie geholt (die App ist gleich in den Einstellungen aufgegangen, bevor
  // Schlüssel und Liste da waren): jetzt holen – sonst bliebe „Wird geprüft …“ stehen
  if (!todo && !holt && app.zugang && app.stand.haushalt?.todoApp && ansicht.tab === 'einstellungen') { todoHolen(); return; }
  // Beim Tippen der App-ID nicht neu zeichnen
  if (el.contains(document.activeElement) && document.activeElement.matches('input')) return;
  const html = todoHTML();
  if (el.innerHTML !== html) el.innerHTML = html;
}

/** Klicks in der Karte. true, wenn es hierher gehörte. */
export function klickTodo(el) {
  const act = el.dataset.act || '';
  if (!act.startsWith('todo-')) return false;
  switch (act) {
    case 'todo-verbinden':
      if (!ich()) { melde('Erst in der gemeinsamen Liste einen Namen eintragen.'); return true; }
      app.aendern(opTodoWunsch(app.name(), 'verbinden'));
      todoZeichnen();
      planen();
      return true;
    case 'todo-kopieren': {
      const code = $('#todo-code')?.textContent || '';
      try { navigator.clipboard.writeText(code).then(() => melde('Code kopiert – jetzt bei Microsoft einfügen'), () => melde(`Der Code: ${code}`)); } catch { melde(`Der Code: ${code}`); }
      return true;
    }
    case 'todo-jetzt':
      app.aendern(opTodoWunsch(app.name(), 'abgleichen'));
      melde('Gleich abgeglichen – das dauert etwa eine Minute.');
      todoZeichnen();
      planen();
      return true;
    case 'todo-liste': listeWaehlen = true; todoZeichnen(); return true;
    case 'todo-liste-zu': listeWaehlen = false; todoZeichnen(); return true;
    case 'todo-trennen': trennenFragen = true; todoZeichnen(); return true;
    case 'todo-trennen-nein': trennenFragen = false; todoZeichnen(); return true;
    case 'todo-trennen-ja':
      trennenFragen = false;
      app.aendern(opTodoWunsch(app.name(), 'trennen'));
      todoZeichnen();
      planen();
      return true;
    case 'todo-appid': appIdOffen = true; todoZeichnen(); $('#todo-app-input')?.focus(); return true;
    case 'todo-appid-zu': appIdOffen = false; $('#todo-app-input')?.blur(); todoZeichnen(); return true;
    default: return false;
  }
}

/** Die App-ID speichern – oder die Liste in To Do wählen. */
export function absendenTodo(ev) {
  if (ev.target.id === 'todo-ziel-form') {
    ev.preventDefault();
    const id = String(new window.FormData(ev.target).get('todo-ziel') || '');
    if (!id) return true;
    const l = (todo?.personen?.[ich()]?.listen || []).find((x) => x.id === id);
    if (id !== 'neu' && !l) { melde('Die Liste gibt es nicht mehr – bitte eine andere wählen.'); return true; }
    app.aendern(opTodoZiel(app.name(), id, id === 'neu' ? 'Haushalt' : l.name, !!l?.geteilt));
    listeWaehlen = false;
    melde(l?.geteilt ? `Gemerkt – alle Putztage kommen in „${l.name}“.` : 'Gemerkt – gleich stehen deine Putztage in To Do.');
    todoZeichnen();
    planen();
    return true;
  }
  if (ev.target.id !== 'todo-app-form') return false;
  ev.preventDefault();
  const feld = $('#todo-app-input');
  const id = String(feld?.value || '').trim().replace(/[{}\s]/g, '');
  if (!TODO_APP_ID.test(id)) { melde('Das ist keine App-ID – sie sieht so aus: 1a2b3c4d-1234-5678-9abc-def012345678'); return true; }
  app.aendern(opTodoApp(id.toLowerCase()));
  appIdOffen = false;
  feld.blur();
  melde('App-ID gespeichert – jetzt kann jeder von euch sein To Do verbinden.');
  todoHolen();
  return true;
}
