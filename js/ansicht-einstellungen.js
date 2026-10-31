/*
 * Reiter „Einstellungen“: alles, was man einmal einstellt, an einem Ort.
 *
 *   Gemeinsame Liste   Einrichten, Link fürs zweite Handy, Tablet, Trennen –
 *                      zeichnet ansicht-liste.js in #e-zugang und #teilen
 *   Push-Nachrichten   ansicht-push.js in #push-bereich
 *   KI-Schlüssel       ansehen, ändern, entfernen (zugang.js)
 *   Reiter unten       welche Reiter die Leiste zeigt – nur dieses Gerät
 *   Gelernt und gemerkt  Tempo, Wege durch die Läden, Preisalarme, Preise
 *                      vom Bon – mit Vergessen und Löschen
 *   Über die App       Fassung, nach Updates suchen
 *
 * Die Einstellungen selbst sind immer in der Leiste (sonst käme man nicht
 * mehr zurück); breit gibt es oben das Zahnrad, und der Punkt „Geteilt“ oben
 * führt auch hierher.
 */
import { app, $, $$, ansicht, zeigeReiter, melde, lese, schreibe, istSchmal } from './kern.js';
import { esc, tagKurz, menge } from './format.js';
import { euro } from './kosten.js';
import { ladeKi, speichereKi, loescheKi, kiAus } from './zugang.js';
import { ANBIETER, anbieterVon } from './ki.js';
import { tempoInfo, GRUPPEN_TEXT } from './tempo.js';
import { preisJe } from './angebote.js';
import { opBon, opBonWeg } from './liste.js';
import { nameSchluessel } from './bereiche.js';
import { statusZeichnen } from './ansicht-liste.js';

/* ------------------------------------------------------------ Reiter */

const REITER_AUS = 'boxenstopp.reiter.v1'; // { aus: ['amy'] } – welche Reiter unten fehlen, nur dieses Gerät
/** Die Reiter, die sich ausblenden lassen – die Einstellungen bleiben immer. */
export const REITER_WAHL = [['rezepte', 'Rezepte'], ['amy', 'Amys Rezepte'], ['einkauf', 'Einkaufsliste'], ['angebote', 'Angebote']];

/** Welche Reiter ausgeblendet sind – mindestens einer bleibt. */
export function reiterAus() {
  const x = lese(REITER_AUS, null);
  const aus = Array.isArray(x?.aus) ? [...new Set(x.aus.filter((t) => REITER_WAHL.some(([k]) => k === t)))] : [];
  return aus.length >= REITER_WAHL.length ? [] : aus;
}

/**
 * Die Leiste unten nach der Wahl: Ausgeblendetes weg, die Karte „Amys
 * Rezepte“ bei den Rezepten dafür auch schmal (CSS: data-reiter-aus).
 * wechseln: Steht man gerade auf einem ausgeblendeten Reiter, zum ersten
 * sichtbaren.
 */
export function reiterAnwenden({ wechseln = false } = {}) {
  const aus = reiterAus();
  for (const b of $$('.tabbar .tab')) b.hidden = aus.includes(b.dataset.tab);
  document.documentElement.dataset.reiterAus = aus.join(' ');
  if (wechseln && aus.includes(ansicht.tab)) zeigeReiter(REITER_WAHL.map(([k]) => k).find((k) => !aus.includes(k)) || 'einstellungen', true);
  tabbarAnpassen();
}

/** Passen die Beschriftungen nicht nebeneinander, die kurzen nehmen („Liste“, „Amy“). */
export function tabbarAnpassen() {
  const bar = $('.tabbar');
  if (!bar) return;
  bar.classList.remove('kurz');
  if (!istSchmal()) return;
  const eng = $$('.tab:not([hidden]) span:not(.badge):not(.tab-k)', bar).some((s) => s.scrollWidth > s.clientWidth + 1);
  bar.classList.toggle('kurz', eng);
}

function reiterHTML() {
  const aus = reiterAus();
  const symbol = (t) => $(`.tabbar .tab[data-tab="${t}"] .ic`)?.outerHTML || '';
  const an = REITER_WAHL.filter(([k]) => !aus.includes(k)).length;
  const zeilen = REITER_WAHL.map(([k, name]) => {
    const sichtbar = !aus.includes(k);
    const letzter = sichtbar && an === 1;
    return `<label class="e-schalter">${symbol(k)}<span>${esc(name)}${letzter ? ' <small>– einer bleibt</small>' : ''}</span><input type="checkbox" data-reiter="${k}"${sichtbar ? ' checked' : ''}${letzter ? ' disabled' : ''}></label>`;
  }).join('');
  return `<div class="e-reiter" role="group" aria-label="Reiter unten">${zeilen}<label class="e-schalter fest">${symbol('einstellungen')}<span>Einstellungen <small>– immer da</small></span><input type="checkbox" checked disabled></label></div>
<p class="fine">Gilt für die Leiste unten auf diesem Gerät. Amys Rezepte und die Angebote bleiben auch ausgeblendet über ihre Karte bei den Rezepten erreichbar.</p>`;
}

/* -------------------------------------------------------- KI-Schlüssel */

let kiOffen = false; // „Schlüssel ändern“ offen
let kiFehler = '';

function kiFormHTML(mitAbbrechen) {
  return `<form class="e-ki-form" id="e-ki-form" novalidate>
<label class="sr" for="e-ki-feld">KI-Schlüssel</label>
<input id="e-ki-feld" type="password" autocomplete="off" spellcheck="false" placeholder="AQ.… (Google), sk-ant-… (Anthropic) oder der Link">
${kiFehler ? `<p class="zugang-fehler" role="alert">${esc(kiFehler)}</p>` : ''}
<div class="zugang-btns"><button type="submit" class="btn btn-primary">Speichern</button>${mitAbbrechen ? '<button type="button" class="btn btn-quiet" data-act="e-ki-zu">Abbrechen</button>' : ''}</div>
</form>`;
}

function kiHTML() {
  const da = anbieterVon(ladeKi());
  const wofuer = 'Für die Resteverwertung, „Mit KI ändern“, Rezepte übernehmen und Prospektfotos bei den Angeboten.';
  const bleibt = 'Der Schlüssel bleibt nur auf diesem Gerät; aufs andere kommt er mit dem Link fürs zweite Handy.';
  if (!da) {
    return `<p>${wofuer} Kostenlos mit einem Google-Konto: auf <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> „Create API key“, den Schlüssel hier einfügen.</p>
${kiFormHTML(false)}
<p class="fine">${bleibt} Ein Anthropic-Schlüssel (sk-ant-…) geht auch – der kostet ein paar Cent pro Rezept.</p>`;
  }
  const a = ANBIETER[da];
  return `<p class="e-ki-da"><span class="e-ok">✓</span> Ein Schlüssel von <b>${esc(a.name)}</b> ist eingetragen (${esc(a.modell)})${da === 'gemini' ? ' – kostenlos' : ' – ein paar Cent pro Rezept'}.</p>
${kiOffen ? kiFormHTML(true) : '<div class="zugang-btns"><button type="button" class="btn" data-act="e-ki-aendern">Schlüssel ändern</button><button type="button" class="btn btn-quiet" data-act="e-ki-weg">Entfernen</button></div>'}
<p class="fine">${wofuer} ${bleibt}</p>`;
}

/* --------------------------------------------------- Gelernt und gemerkt */

const anzahl = (n, eins, mehr) => `${n} ${n === 1 ? eins : mehr}`;
/** Ein Name für einen Schlüssel: Katalog, eine Zeile mit dem Namen, sonst aus dem Schlüssel. */
function nameVon(k, gemerkt = '') {
  if (app.katalog[k]) return app.katalog[k].n;
  if (gemerkt) return gemerkt;
  const zeile = Object.values(app.stand.items || {}).find((d) => nameSchluessel(d.name) === k);
  if (zeile) return zeile.name;
  const t = String(k).replace(/^n:/, '').replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function gemerktHTML() {
  const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
  const teile = [];
  // Tempo
  const info = tempoInfo();
  const faktoren = Object.entries(info.faktor || {}).filter(([k, f]) => k !== 'alle' && Math.abs(f - 1) >= 0.1).map(([k, f]) => `${GRUPPEN_TEXT[k] || k} ${String(f).replace('.', ',')}×`);
  // „Tobis Tempo“, aber „Klaus’ Tempo“
  const wessen = app.name() ? (/[sßxz]$/i.test(app.name()) ? `${app.name()}’` : `${app.name()}s`) : '';
  teile.push(`<div class="e-gruppe" id="e-tempo"><h3>${wessen ? `${esc(wessen)} Tempo` : 'Dein Tempo'}</h3>${info.proben
    ? `<p>Gelernt aus ${anzahl(info.proben, 'abgehakten Schritt', 'abgehakten Schritten')}${info.rezepte ? ` und ${anzahl(info.rezepte, 'ganzen Rezept', 'ganzen Rezepten')}` : ''}${faktoren.length ? ` – ${esc(faktoren.join(', '))} so lange wie Standard` : ''}. Gilt auf allen deinen Geräten.</p><div class="zugang-btns"><button type="button" class="btn btn-quiet" data-act="tempo-weg">Tempo vergessen</button></div>`
    : '<p class="fine">Noch nichts gelernt – hak beim Kochen die Schritte ab, dann lernt die App, wie lange du brauchst.</p>'}</div>`);
  // Wege durch die Läden
  const wege = Object.entries(app.stand.wege || {}).sort(([a], [b]) => a.localeCompare(b, 'de'));
  teile.push(`<div class="e-gruppe" id="e-wege"><h3>Wege durch die Läden</h3>${wege.length
    ? `<ul class="e-liste">${wege.map(([laden, w]) => `<li><span>${esc(laden)}<small>gelernt aus ${anzahl(w.n || 0, 'Einkauf', 'Einkäufen')}${w.at ? `, zuletzt ${esc(tagKurz(String(w.at).slice(0, 10)))}` : ''}</small></span><button type="button" class="linkbtn" data-act="weg-vergessen" data-laden="${esc(laden)}">Vergessen</button></li>`).join('')}</ul>`
    : '<p class="fine">Noch keiner – wähl über der Einkaufsliste den Laden, dann merkt sich die App die Reihenfolge, in der ihr abhakt.</p>'}</div>`);
  // Preisalarme
  const alarme = Object.entries(app.stand.preisalarm || {});
  teile.push(`<div class="e-gruppe" id="e-alarme"><h3>Preisalarme</h3>${alarme.length
    ? `<ul class="e-liste">${alarme.map(([k, a]) => `<li><span>${esc(nameVon(k, a.name))}<small>höchstens ${esc(preisJe(a.max, a.u))}${a.by ? ` · von ${esc(a.by)}` : ''}</small></span><button type="button" class="x" data-alarm-weg="${esc(k)}" aria-label="Preisalarm für ${esc(nameVon(k, a.name))} löschen">${X}</button></li>`).join('')}</ul>`
    : '<p class="fine">Keiner – setz einen mit der Glocke an einem Angebot oder in einer Zeile der Einkaufsliste.</p>'}</div>`);
  // Preise vom Bon
  const bons = Object.entries(app.stand.bons || {}).filter(([, l]) => Array.isArray(l) && l.length);
  teile.push(`<div class="e-gruppe" id="e-bons"><h3>Eure Preise vom Bon</h3>${bons.length
    ? `<p class="fine">Damit rechnen die Kosten statt mit dem Richtpreis.</p><ul class="e-liste">${bons.map(([k, l]) => { const b = l[l.length - 1]; return `<li><span>${esc(nameVon(k))}<small>zuletzt ${esc(euro(b.eur))} für ${esc(menge(b.q, b.u))}${b.laden ? ` bei ${esc(b.laden)}` : ''}${l.length > 1 ? ` · ${l.length} Bons` : ''}</small></span><button type="button" class="x" data-e-bons-weg="${esc(k)}" aria-label="Preise für ${esc(nameVon(k))} löschen">${X}</button></li>`; }).join('')}</ul>`
    : '<p class="fine">Noch keine – in einer Zeile der Einkaufsliste „Was hat’s gekostet?“ eintippen.</p>'}</div>`);
  return teile.join('');
}

/* ----------------------------------------------------------- Über */

let fassung = '';
let fassungLaeuft = false;
/** Welche Fassung läuft: der Vorrat des Service Workers heißt boxenstopp-v… */
async function fassungHolen() {
  try {
    const namen = await window.caches?.keys?.() || [];
    const v = namen.map((n) => /^boxenstopp-v(\d+)$/.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => b - a)[0];
    return v ? `v${v}` : '';
  } catch { return ''; }
}

function ueberHTML() {
  return `<p>Boxenstopp${fassung ? ` <b class="e-fassung">${esc(fassung)}</b>` : ''}${app.rezepte.length ? ` · ${app.rezepte.length} Rezepte` : ''}</p>
<div class="zugang-btns"><button type="button" class="btn" data-act="e-update">Nach Updates suchen</button><a class="btn btn-quiet" href="https://github.com/Finanzdienste/Boxenstopp#readme" target="_blank" rel="noopener">Anleitung</a></div>`;
}

/* ---------------------------------------------------------- Zeichnen */

/** Die eigenen Teile der Einstellungen neu – die Formulare nur, wenn darin nichts getippt wird. */
export function einstellungenZeichnen() {
  if (!$('#view-einstellungen')) return;
  const ki = $('#e-ki');
  if (ki && !(ki.contains(document.activeElement) && document.activeElement.matches('input'))) ki.innerHTML = kiHTML();
  const r = $('#e-reiter');
  if (r) r.innerHTML = reiterHTML();
  const g = $('#e-gemerkt');
  if (g) g.innerHTML = gemerktHTML();
  const u = $('#e-ueber');
  if (u) u.innerHTML = ueberHTML();
  // Beim ersten Besuch ist der Service Worker evtl. erst nach dem Start fertig – dann jetzt nachsehen
  if (!fassung && ansicht.tab === 'einstellungen' && !fassungLaeuft) {
    fassungLaeuft = true;
    fassungHolen().then((f) => { fassungLaeuft = false; if (f) { fassung = f; const el = $('#e-ueber'); if (el) el.innerHTML = ueberHTML(); } });
  }
}

/* ----------------------------------------------------------- Klicks */

export function klickEinstellungen(el) {
  const d = el.dataset;
  if (d.eBonsWeg) {
    const k = d.eBonsWeg;
    const alt = (app.stand.bons?.[k] || []).map((b) => ({ ...b }));
    if (!alt.length) return true;
    app.aendern(alt.map((b) => opBonWeg(k, b.at)));
    melde(`Preise für „${nameVon(k)}“ gelöscht`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(alt.map((b) => opBon(k, b, b.by))) });
    return true;
  }
  switch (d.act) {
    case 'e-ki-aendern': kiOffen = true; kiFehler = ''; einstellungenZeichnen(); $('#e-ki-feld')?.focus(); return true;
    case 'e-ki-zu': kiOffen = false; kiFehler = ''; einstellungenZeichnen(); return true;
    case 'e-ki-weg': {
      const alt = ladeKi();
      loescheKi();
      kiOffen = false;
      einstellungenZeichnen();
      statusZeichnen();
      melde('KI-Schlüssel entfernt', { knopf: 'Rückgängig', beiKnopf: () => { speichereKi(alt); einstellungenZeichnen(); statusZeichnen(); } });
      return true;
    }
    case 'e-update': {
      if (!navigator.serviceWorker?.getRegistration) { melde('Hier einfach neu laden – dann ist die neueste Fassung da.'); return true; }
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        if (!reg) { melde('Hier einfach neu laden – dann ist die neueste Fassung da.'); return; }
        await reg.update();
        if (reg.installing || reg.waiting) melde('Eine neue Fassung wird geladen – die App lädt gleich neu.');
        else melde('Du hast die neueste Fassung.');
      }).catch(() => melde('Gerade keine Verbindung – später nochmal.'));
      return true;
    }
    default: return false;
  }
}

/** Häkchen bei den Reitern (change). true, wenn es hierher gehörte. */
export function aenderungEinstellungen(ziel) {
  const t = ziel.dataset?.reiter;
  if (!t) return false;
  const aus = new Set(reiterAus());
  if (ziel.checked) aus.delete(t); else aus.add(t);
  if (aus.size >= REITER_WAHL.length) { ziel.checked = true; return true; }
  schreibe(REITER_AUS, { aus: [...aus] });
  reiterAnwenden();
  einstellungenZeichnen();
  return true;
}

export function absendenEinstellungen(ev) {
  if (ev.target.id !== 'e-ki-form') return false;
  ev.preventDefault();
  const s = kiAus($('#e-ki-feld')?.value || '');
  if (!s) {
    kiFehler = 'Das sieht nicht nach einem Schlüssel aus. Er beginnt mit AQ. oder AIza (Google) oder sk-ant- (Anthropic).';
    $('#e-ki').innerHTML = kiHTML();
    $('#e-ki-feld')?.focus();
    return true;
  }
  speichereKi(s);
  kiOffen = false;
  kiFehler = '';
  $('#e-ki').innerHTML = kiHTML();
  einstellungenZeichnen();
  statusZeichnen(); // der Link fürs zweite Handy nimmt den Schlüssel mit
  melde(`Gespeichert: ein Schlüssel von ${ANBIETER[anbieterVon(s)]?.name || 'der KI'}.`);
  return true;
}

/**
 * Beim Start: Leiste nach der Wahl, Beschriftungen an die Breite, Fassung
 * holen. wechseln: Der gemerkte Reiter ist ausgeblendet (nicht, wenn die
 * Adresse ihn ausdrücklich will, etwa #amy).
 */
export function einstellungenStart({ wechseln = true } = {}) {
  reiterAnwenden({ wechseln });
  let warten = null;
  window.addEventListener('resize', () => { clearTimeout(warten); warten = setTimeout(tabbarAnpassen, 150); });
  // Die Schrift kommt evtl. erst nach dem ersten Zeichnen – dann noch einmal messen
  document.fonts?.ready?.then(tabbarAnpassen).catch(() => {});
  fassungHolen().then((f) => { fassung = f; einstellungenZeichnen(); });
  einstellungenZeichnen();
}
