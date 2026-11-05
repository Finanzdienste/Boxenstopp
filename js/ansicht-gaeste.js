/*
 * Einstellungen → „Gäste & Überblick“ (nur in der Liste von Tobi und Amy):
 *
 *   Einladen    Jemand bekommt eine eigene Liste (eigenes privates Repo,
 *               eigener Schlüssel nur dafür). Die App prüft den Schlüssel –
 *               auch, dass er NICHT an Tobis und Amys Liste kommt –, legt die
 *               Liste mit Name und Farbe an und macht den Link zum Schicken.
 *               Wen dieses Gerät eingeladen hat, merkt es sich (gaeste.js).
 *   Überblick   Wer wann was gemacht hat, in allen Listen, die dieses Gerät
 *               kennt – aus den Commits (gaeste.js zusammenfassen). Was das
 *               Gerät schon geholt hat, merkt es sich (VERLAUF); beim Öffnen
 *               kommt nur das Neue dazu.
 *
 * Schlüssel stehen nur im localStorage dieses Geräts und im Link für den Gast.
 */
import { app, $, melde, lese, schreibe } from './kern.js';
import { esc, tagKurz } from './format.js';
import { DATEN, API, listeAnlegen, commitsLesen, pruefeSchluessel } from './speicher.js';
import { schluesselAus, einladungsLink, ladeKi, ortVon } from './zugang.js';
import { gaesteBereinigen, repoVorschlag, zusammenfassen, verlaufMischen, BEREICHE } from './gaeste.js';
import { istEigen, wessen } from './profil.js';

const GAESTE = 'boxenstopp.gaeste.v1';
const VERLAUF = 'boxenstopp.verlauf.v1'; // { <id>: [{ sha, at, nachricht }] }
const api = () => lese('__api', null) || API;
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';

export const ladeGaeste = () => gaesteBereinigen(lese(GAESTE, []));
const merkeGaeste = (g) => schreibe(GAESTE, gaesteBereinigen(g));

let einladen = null; // { name, farbe, repo, repoFest, ki, fehler, laeuft }
let fertig = null; // { name, link }

const linkFuer = (g) => einladungsLink(g.token, g.ki ? ladeKi() : '', { daten: g.daten, fuer: g.name, farbe: g.farbe || 'blau' });
const besitzer = DATEN.owner;
const repoLink = (repo) => `https://github.com/new?${new URLSearchParams({ name: repo, owner: besitzer, visibility: 'private', description: 'Boxenstopp: eigene Liste' })}`;
const tokenLink = (name, repo) => `https://github.com/settings/personal-access-tokens/new?${new URLSearchParams({ name: `Boxenstopp ${name || 'Gast'}`.slice(0, 40), description: `Nur für ${repo} – die Liste in Boxenstopp`, target_name: besitzer, expires_in: 'none', contents: 'write' })}`;

/* ------------------------------------------------------- Einstellungen */

function einladenHTML() {
  const e = einladen;
  const name = e.name.trim();
  const repo = e.repoFest ? e.repo : repoVorschlag(name) || 'Boxenstopp-Name';
  const ki = ladeKi();
  return `<form class="zugang-form g-form" id="g-form" novalidate>
<label for="g-name">Wie heißt sie oder er?</label>
<input id="g-name" type="text" maxlength="30" autocomplete="off" placeholder="z. B. Marielle" value="${esc(e.name)}">
<fieldset class="g-farbe"><legend>Farbe der App</legend>
<label class="e-wahl${e.farbe === 'lila' ? ' an' : ''}"><input type="radio" name="g-farbe" value="lila"${e.farbe === 'lila' ? ' checked' : ''}><span class="g-punkt g-lila" aria-hidden="true"></span><span>Lila</span></label>
<label class="e-wahl${e.farbe !== 'lila' ? ' an' : ''}"><input type="radio" name="g-farbe" value="blau"${e.farbe !== 'lila' ? ' checked' : ''}><span class="g-punkt g-blau" aria-hidden="true"></span><span>Blau</span></label>
</fieldset>
<ol class="g-schritte">
<li><b>Ein eigenes Repo bei GitHub</b><span>privat, Name <code id="g-repo-name">${esc(repo)}</code>, mit Häkchen bei „Add a README file“</span><a class="btn" id="g-repo-link" href="${esc(repoLink(repo))}" target="_blank" rel="noopener">Repo anlegen</a></li>
<li><b>Ein Schlüssel nur dafür</b><span>Bei „Repository access“ <i>Only select repositories</i> → <i id="g-repo-name2">${esc(repo)}</i>. „Contents: Read and write“ ist schon gewählt.</span><a class="btn" id="g-token-link" href="${esc(tokenLink(name, repo))}" target="_blank" rel="noopener">Schlüssel anlegen</a></li>
<li><b>Den Schlüssel hier einfügen</b><label class="sr" for="g-token">Schlüssel</label><input id="g-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></li>
</ol>
${ki ? `<label class="k-check"><input type="checkbox" id="g-ki"${e.ki ? ' checked' : ''}><span>Deinen KI-Schlüssel mitgeben – für Resteverwertung, Speisekarte und „Mit KI ändern“ (läuft dann über deinen)</span></label>` : ''}
<details class="g-mehr"${e.repoFest ? ' open' : ''}><summary>Repo heißt anders</summary><label class="sr" for="g-repo">Repo</label><input id="g-repo" type="text" autocomplete="off" spellcheck="false" value="${esc(`${besitzer}/${repo}`)}"></details>
<p class="zugang-fehler" id="g-fehler"${e.fehler ? '' : ' hidden'}>${esc(e.fehler || '')}</p>
<div class="zugang-btns"><button type="submit" class="btn btn-primary" id="g-los"${e.laeuft ? ' disabled' : ''}>${e.laeuft ? 'Prüfe …' : 'Prüfen und Link machen'}</button><button type="button" class="btn btn-quiet" data-act="g-abbrechen">Abbrechen</button></div>
<p class="fine">Die App prüft den Schlüssel, legt die Liste mit Name und Farbe an und macht den Link. Kommt der Schlüssel auch an eure Liste, nimmt sie ihn nicht.</p>
</form>`;
}

function fertigHTML() {
  const wa = `https://wa.me/?text=${encodeURIComponent(`Hallo ${fertig.name}, hier ist deine Boxenstopp-App mit deiner eigenen Liste: ${fertig.link}`)}`;
  return `<div class="g-fertig" role="status">
<p><b>${esc(wessen(fertig.name))} Liste ist bereit.</b> Schick den Link – beim Öffnen erklärt die App alles und fragt nach den Makros.</p>
<label class="sr" for="g-linkfeld">Link für ${esc(fertig.name)}</label><input class="z-linkfeld" id="g-linkfeld" type="text" readonly value="${esc(fertig.link)}">
<div class="zugang-btns"><button type="button" class="btn btn-primary" data-act="g-kopieren">Link kopieren</button><a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Per WhatsApp schicken</a><button type="button" class="btn btn-quiet" data-act="g-fertig-zu">Fertig</button></div>
<p class="fine">Im Link steckt der Schlüssel – er kommt nur an das eine Repo, nicht an eure Liste. Schick ihn nur an ${esc(fertig.name)}.</p>
</div>`;
}

export function gaesteZeichnen() {
  const karte = $('#e-gaeste-karte');
  const el = $('#e-gaeste');
  if (!karte || !el) return;
  karte.hidden = istEigen();
  if (karte.hidden) return;
  if (el.contains(document.activeElement) && document.activeElement.matches('input')) return;
  const gaeste = ladeGaeste();
  const liste = gaeste.length
    ? `<ul class="e-liste g-liste">${gaeste.map((g) => `<li><span class="g-punkt ${g.farbe === 'lila' ? 'g-lila' : 'g-blau'}" aria-hidden="true"></span><span>${esc(g.name)}<small>${esc(g.daten.split('/')[1])}${g.at ? ` · eingeladen ${esc(tagKurz(g.at.slice(0, 10)))}` : ''}</small></span><button type="button" class="linkbtn" data-g-link="${esc(g.daten)}">Link</button><button type="button" class="x" data-g-weg="${esc(g.daten)}" aria-label="${esc(g.name)} von diesem Gerät entfernen">${X}</button></li>`).join('')}</ul>`
    : '';
  const kopf = `<p>Will jemand Boxenstopp mit eigener Liste – eigene Einkaufsliste, eigene Makros, eigene Rezepte? Dann bekommt sie ein eigenes privates Repo; an eure Liste kommt sie damit nicht.</p>`;
  let rumpf = '';
  if (fertig) rumpf = fertigHTML();
  else if (einladen) rumpf = einladenHTML();
  const knoepfe = einladen || fertig ? '' : `<div class="zugang-btns"><button type="button" class="btn" data-act="g-einladen"${app.zugang ? '' : ' disabled'}>Jemanden einladen</button><button type="button" class="btn" data-act="ub-oeffnen"${app.zugang ? '' : ' disabled'}>Überblick</button></div>`;
  el.innerHTML = `${kopf}${liste}${rumpf}${knoepfe}${app.zugang ? '' : '<p class="fine">Erst die gemeinsame Liste einrichten.</p>'}`;
}

/** Beim Tippen des Namens: Repo-Name und die beiden Links mitziehen (ohne neu zu zeichnen). */
export function eingabeGaeste(ziel) {
  if (!einladen) return false;
  if (ziel.id === 'g-name') {
    einladen.name = ziel.value;
    if (!einladen.repoFest) {
      const repo = repoVorschlag(ziel.value) || 'Boxenstopp-Name';
      for (const id of ['#g-repo-name', '#g-repo-name2']) { const x = $(id); if (x) x.textContent = repo; }
      $('#g-repo-link')?.setAttribute('href', repoLink(repo));
      $('#g-token-link')?.setAttribute('href', tokenLink(ziel.value.trim(), repo));
      const f = $('#g-repo');
      if (f) f.value = `${besitzer}/${repo}`;
    }
    return true;
  }
  if (ziel.id === 'g-repo') { einladen.repoFest = true; einladen.repo = String(ziel.value).split('/').pop(); return true; }
  return ziel.id === 'g-token';
}

export function aenderungGaeste(ziel) {
  if (!einladen) return false;
  if (ziel.name === 'g-farbe') {
    einladen.farbe = ziel.value === 'lila' ? 'lila' : '';
    for (const l of ziel.closest('fieldset')?.querySelectorAll('.e-wahl') || []) l.classList.toggle('an', l.contains(ziel));
    return true;
  }
  if (ziel.id === 'g-ki') { einladen.ki = ziel.checked; return true; }
  return false;
}

export function absendenGaeste(ev) {
  if (ev.target.id !== 'g-form') return false;
  ev.preventDefault();
  if (!einladen || einladen.laeuft) return true;
  const name = $('#g-name').value.trim().replace(/\s+/g, ' ').slice(0, 30);
  const tokenText = $('#g-token').value;
  const token = schluesselAus(tokenText);
  const repoFeld = String($('#g-repo')?.value || '').trim();
  const daten = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repoFeld) ? repoFeld : `${besitzer}/${repoVorschlag(name)}`;
  einladen = { ...einladen, name, ki: $('#g-ki')?.checked ?? einladen.ki };
  const fehler = (t) => { einladen.fehler = t; einladen.laeuft = false; gaesteZeichnen(); $('#g-token').value = tokenText; };
  if (!/^[\p{L}\p{N} ._-]{1,30}$/u.test(name)) { fehler('Trag den Namen ein – so heißt dann auch der Reiter mit ihren Rezepten.'); return true; }
  if (!token) { fehler('Das sieht nicht nach einem Schlüssel aus. Er beginnt mit github_pat_.'); return true; }
  if (token === app.zugang?.token) { fehler('Das ist euer Schlüssel. Leg einen eigenen an, der nur für das neue Repo gilt.'); return true; }
  if (`${DATEN.owner}/${DATEN.repo}` === daten) { fehler('Das ist das Repo eurer Liste. Der Gast braucht ein eigenes.'); return true; }
  einladen.laeuft = true;
  einladen.fehler = '';
  gaesteZeichnen();
  (async () => {
    // Kommt der Schlüssel an eure Liste, wäre sie für den Gast offen – dann nicht
    const auchEure = await pruefeSchluessel(token, { api: api(), ort: DATEN });
    if (auchEure === 'ok') { fehler('Dieser Schlüssel kommt auch an eure Liste. Leg einen an, der nur für das neue Repo gilt („Only select repositories“).'); return; }
    if (auchEure === 'netz') { fehler('Keine Verbindung zu GitHub. Versuch es gleich nochmal.'); return; }
    const ergebnis = await listeAnlegen(token, ortVon({ daten }), { person: name, ...(einladen.farbe ? { farbe: einladen.farbe } : {}) }, { api: api(), wer: app.name() });
    if (ergebnis !== 'ok') {
      fehler(ergebnis === 'falsch'
        ? `GitHub lässt nicht schreiben. Gibt es das private Repo ${daten.split('/')[1]}, und gilt der Schlüssel dafür mit „Contents: Read and write“?`
        : 'Keine Verbindung zu GitHub. Versuch es gleich nochmal.');
      return;
    }
    const gast = { name, daten, token, farbe: einladen.farbe, at: new Date().toISOString(), ki: !!einladen.ki && !!ladeKi() };
    merkeGaeste([gast, ...ladeGaeste().filter((g) => g.daten !== daten)]);
    fertig = { name, link: linkFuer(gast) };
    einladen = null;
    gaesteZeichnen();
    $('#g-linkfeld')?.select();
  })();
  return true;
}

function kopieren(link, feld) {
  const zeigen = () => { if (feld) { feld.hidden = false; feld.select(); } melde('Kopieren klappt hier nicht – der Link steht markiert im Feld.'); };
  try { navigator.clipboard.writeText(link).then(() => melde('Link kopiert.'), zeigen); } catch { zeigen(); }
}

export function klickGaeste(el) {
  const d = el.dataset;
  if (d.gLink) {
    const g = ladeGaeste().find((x) => x.daten === d.gLink);
    if (!g) return true;
    fertig = { name: g.name, link: linkFuer(g) };
    einladen = null;
    gaesteZeichnen();
    return true;
  }
  if (d.gWeg) {
    const alle = ladeGaeste();
    const g = alle.find((x) => x.daten === d.gWeg);
    if (!g) return true;
    merkeGaeste(alle.filter((x) => x.daten !== d.gWeg));
    gaesteZeichnen();
    melde(`${g.name} von diesem Gerät entfernt – ihre Liste bleibt in GitHub.`, { knopf: 'Rückgängig', beiKnopf: () => { merkeGaeste([g, ...ladeGaeste()]); gaesteZeichnen(); } });
    return true;
  }
  switch (d.act) {
    case 'g-einladen': einladen = { name: '', farbe: 'lila', repo: '', repoFest: false, ki: true, fehler: '', laeuft: false }; fertig = null; gaesteZeichnen(); $('#g-name')?.focus(); return true;
    case 'g-abbrechen': einladen = null; gaesteZeichnen(); return true;
    case 'g-fertig-zu': fertig = null; gaesteZeichnen(); return true;
    case 'g-kopieren': if (fertig) kopieren(fertig.link, $('#g-linkfeld')); return true;
    case 'ub-oeffnen': ueberblickOeffnen(); return true;
    case 'ub-zu': { const dlg = $('#ueberblick-dlg'); if (dlg?.open) dlg.close(); return true; }
    case 'ub-neu': ueberblickLaden(true); return true;
    default:
      if (d.ubTage) { tage = Number(d.ubTage) === 30 ? 30 : 7; ueberblickZeichnen(); return true; }
      if (d.act === 'ub-mehr') { mehr = true; ueberblickZeichnen(); return true; }
      return false;
  }
}

/* ------------------------------------------------------------ Überblick */

let tage = 7;
let mehr = false;
let laedt = false;
let fehlerJe = {}; // id → Text
let geholt = null;

/** Die Listen, die dieses Gerät kennt: eure (mit eurem Schlüssel) und die der Gäste. */
function listen() {
  if (!app.zugang) return [];
  return [
    { id: 'haupt', name: 'Eure Liste', farbe: '', token: app.zugang.token, ort: DATEN },
    ...ladeGaeste().map((g) => ({ id: g.daten, name: g.name, farbe: g.farbe, token: g.token, ort: ortVon({ daten: g.daten }) })),
  ];
}

const gemerkterVerlauf = () => { const v = lese(VERLAUF, {}); return v && typeof v === 'object' ? v : {}; };

export async function ueberblickLaden(neu = false) {
  if (laedt) return;
  laedt = true;
  fehlerJe = {};
  ueberblickZeichnen();
  const verlauf = gemerkterVerlauf();
  const seit = new Date(Date.now() - 31 * 86400000).toISOString();
  await Promise.all(listen().map(async (l) => {
    const alt = Array.isArray(verlauf[l.id]) ? verlauf[l.id] : [];
    try {
      const frisch = await commitsLesen(l.token, l.ort, { api: api(), bis: neu ? '' : alt[0]?.sha || '', seit: alt.length && !neu ? '' : seit, seiten: alt.length && !neu ? 3 : 8 });
      verlauf[l.id] = verlaufMischen(alt, frisch);
    } catch (e) {
      fehlerJe[l.id] = e.message === 'falsch' ? 'Der Schlüssel geht nicht mehr (abgelaufen oder gelöscht).' : 'Gerade keine Verbindung zu GitHub.';
    }
  }));
  // Was es nicht mehr gibt (entfernte Gäste), vergessen
  const ids = new Set(listen().map((l) => l.id));
  for (const k of Object.keys(verlauf)) if (!ids.has(k)) delete verlauf[k];
  schreibe(VERLAUF, verlauf);
  geholt = new Date();
  laedt = false;
  ueberblickZeichnen();
}

function ueberblickOeffnen() {
  const dlg = $('#ueberblick-dlg');
  if (!dlg) return;
  mehr = false;
  ueberblickZeichnen();
  if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  ueberblickLaden();
}

const AUTO_TEXT = { push: 'Push-Nachrichten', haushalt: 'Putzplan erinnert', 'angebote (privat)': 'Angebote geholt', angebote: 'Angebote geholt', 'to do': 'To Do abgeglichen' };
const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const uhr = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function tagName(tag) {
  const d = new Date(`${tag}T12:00:00`);
  const heute = new Date();
  heute.setHours(12, 0, 0, 0);
  const diff = Math.round((heute - d) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return `${WOCHENTAG[d.getDay()]} ${tagKurz(tag)}`;
}
function zuletztText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const t = tagName(tag);
  return `${t === 'Heute' || t === 'Gestern' ? t.toLowerCase() : t} ${uhr(iso)}`;
}
const listenName = (l) => (!l || l.id === 'haupt' ? 'eure Liste' : `${wessen(l.name)} Liste`);
const farbeVon = (l, name) => (l?.farbe === 'lila' ? 'lila' : /^amy$/i.test(name) ? 'rosa' : 'blau');

export function ueberblickZeichnen() {
  const dlg = $('#ueberblick-dlg');
  if (!dlg) return;
  const ls = listen();
  const nachId = Object.fromEntries(ls.map((l) => [l.id, l]));
  const verlauf = gemerkterVerlauf();
  const z = zusammenfassen(ls.map((l) => ({ id: l.id, name: l.name, farbe: l.farbe, eintraege: verlauf[l.id] || [] })), { tage });
  const leer = !z.personen.length;
  const personen = z.personen.map((p) => {
    const l = nachId[p.liste];
    const max = Math.max(1, ...p.jeTag);
    const balken = p.jeTag.map((n, i) => {
      const tag = z.tage[i];
      const d = new Date(`${tag}T12:00:00`);
      return `<span class="ub-tag" title="${esc(`${WOCHENTAG[d.getDay()]} ${tagKurz(tag)}: ${n}`)}"><i style="height:${Math.round((n / max) * 100)}%"></i>${tage === 7 ? `<small>${WOCHENTAG[d.getDay()]}</small>` : ''}</span>`;
    }).join('');
    const bereiche = BEREICHE.filter((b) => p.bereiche[b]).map((b) => `${b} ${p.bereiche[b]}`).join(' · ');
    return `<article class="ub-person ub-${farbeVon(l, p.name)}">
<div class="ub-kopf"><span class="ub-kreis" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</span><div class="ub-wer"><b>${esc(p.name)}</b><small>${esc(listenName(l))} · zuletzt ${esc(zuletztText(p.zuletzt))}</small></div><span class="ub-zahl"><b>${p.anzahl}</b><small>${p.anzahl === 1 ? 'Änderung' : 'Änderungen'}</small></span></div>
<div class="ub-balken${tage === 30 ? ' dicht' : ''}" role="img" aria-label="${esc(`Änderungen je Tag: ${p.jeTag.join(', ')}`)}">${balken}</div>
${bereiche ? `<p class="ub-bereiche">${esc(bereiche)}</p>` : ''}
</article>`;
  }).join('');
  // Wer in einer Liste noch nichts gemacht hat
  const still = ls.filter((l) => l.id !== 'haupt' && !z.personen.some((p) => p.liste === l.id)).map((l) => `<article class="ub-person ub-${farbeVon(l, l.name)} ub-still"><div class="ub-kopf"><span class="ub-kreis" aria-hidden="true">${esc(l.name.slice(0, 1).toUpperCase())}</span><div class="ub-wer"><b>${esc(l.name)}</b><small>${esc(listenName(l))} · in ${tage} Tagen nichts geändert</small></div></div></article>`).join('');
  const sitzungen = [];
  for (const t of z.verlauf) for (const s of t.sitzungen) sitzungen.push({ tag: t.tag, ...s });
  const zeigen = mehr ? sitzungen : sitzungen.slice(0, 25);
  let tagJetzt = '';
  const zeilen = zeigen.map((s) => {
    const kopf = s.tag !== tagJetzt ? `${tagJetzt ? '</ul>' : ''}<h4 class="ub-tag-k">${esc(tagName(s.tag))}</h4><ul class="ub-liste">` : '';
    tagJetzt = s.tag;
    const l = nachId[s.liste];
    const zeit = uhr(s.von) === uhr(s.bis) ? uhr(s.von) : `${uhr(s.von)}–${uhr(s.bis)}`;
    const was = s.was.length ? s.was.join(', ') : `${s.anzahl} ${s.anzahl === 1 ? 'Änderung' : 'Änderungen'}`;
    return `${kopf}<li class="ub-${farbeVon(l, s.wer)}"><time>${esc(zeit)}</time><span class="ub-name">${esc(s.wer)}${l?.id !== 'haupt' ? '' : ''}</span><span class="ub-was">${esc(was)}${s.was.length && s.anzahl > 1 ? ` <small>(${s.anzahl})</small>` : ''}</span></li>`;
  }).join('') + (zeigen.length ? '</ul>' : '');
  const auto = Object.entries(z.automatik).map(([id, a]) => {
    const teile = Object.entries(a).map(([w, n]) => `${n}× ${AUTO_TEXT[w.toLowerCase()] || w}`);
    return teile.length ? `<p class="fine">${esc(nachId[id]?.name || id)}, automatisch: ${esc(teile.join(', '))}.</p>` : '';
  }).join('');
  const fehler = Object.entries(fehlerJe).map(([id, t]) => `<p class="zugang-fehler">${esc(nachId[id]?.name || id)}: ${esc(t)}</p>`).join('');
  dlg.innerHTML = `<button type="button" class="tablet-zu" data-act="ub-zu" aria-label="Schließen">${X}</button>
<h2 class="ub-titel" id="ub-titel">Überblick</h2>
<p class="ub-lead">Wer wann was gemacht hat – aus dem, was in den Listen gespeichert wurde.</p>
<div class="e-design ub-zeitraum" role="group" aria-label="Zeitraum"><button type="button" class="e-wahl${tage === 7 ? ' an' : ''}" data-ub-tage="7" aria-pressed="${tage === 7}">7 Tage</button><button type="button" class="e-wahl${tage === 30 ? ' an' : ''}" data-ub-tage="30" aria-pressed="${tage === 30}">30 Tage</button></div>
${fehler}
${laedt && leer ? '<p class="loading">Holt die Änderungen …</p>' : ''}
${!laedt && leer && !still ? `<p class="sk-leer">In den letzten ${tage} Tagen hat niemand etwas geändert.</p>` : ''}
<section class="ub-personen" aria-label="Personen">${personen}${still}</section>
${zeilen ? `<section class="ub-verlauf" aria-labelledby="ub-verlauf-t"><h3 id="ub-verlauf-t" class="sub-h">Verlauf</h3>${zeilen}${!mehr && sitzungen.length > zeigen.length ? `<button type="button" class="linkbtn" data-act="ub-mehr">Alle ${sitzungen.length} zeigen</button>` : ''}</section>` : ''}
${auto}
<p class="fine">Gezählt wird, was gespeichert wird – nicht, wer die App nur anschaut. Ältere Einträge nennen nur die Zahl der Änderungen.${geholt ? ` Stand ${esc(uhr(geholt.toISOString()))}.` : ''} <button type="button" class="linkbtn" data-act="ub-neu"${laedt ? ' disabled' : ''}>${laedt ? 'Holt …' : 'Neu holen'}</button></p>`;
}
