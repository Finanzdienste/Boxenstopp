/*
 * Reiter „Einkaufsliste“: die Liste nach Bereichen (bereiche.js), Kopieren
 * als Text, eigene Einträge, das Frühstück für die Woche – und oben bzw.
 * unten das Einrichten der gemeinsamen Liste.
 *
 * listeZeichnen() läuft bei jeder Änderung, auch wenn sie vom anderen Handy
 * kommt. Darum fasst sie die Eingabefelder (Eintrag hinzufügen, Einrichten)
 * nicht an – sonst wäre beim Tippen plötzlich der Text weg.
 */
import { app, $, melde } from './kern.js';
import { esc, menge, ungefaehr, abteilung, uhrzeit } from './format.js';
import { teileVon, erledigt, summen, rezeptStand, rezepteAufListe, offeneAnzahl, opHaken, opLoeschen, opSetzen, opEigener, opErledigteWeg, opLeeren } from './liste.js';
import { rezeptAufListe, rezeptVonListe, ic } from './ansicht-rezepte.js';
import { einladungsLink, schluesselAus, kiAus, ladeKi, speichereKi } from './zugang.js';
import { nachBereichen, alsText } from './bereiche.js';
const X = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';

let leerenFragen = false;
let trennenFragen = false;
let formular = null; // null | { token, name, fehler } – token kann aus einem Link kommen

const kurzName = (rid) => app.nachId[rid]?.short || app.extras[rid]?.short || rid;

/* -------------------------------------------------------------- Einträge */

function zeile([k, d]) {
  const fertig = erledigt(d);
  const teile = teileVon(d);
  const s = summen(d);
  const mengeText = Object.entries(s).map(([u, q]) => menge(q, u)).join(' + ');
  const etwa = d.custom ? '' : ungefaehr(k, s);
  const herkunft = teile.map(([rid, p]) => {
    let t = esc(kurzName(rid));
    if (typeof p.q === 'number') t += ` ${esc(menge(p.q, p.u))}`;
    else if (p.t) t += `: ${esc(p.t)}`;
    if (p.h) t += ` <span class="hint">(${esc(p.h)})</span>`;
    if (p.done === true && !fertig) t += ' <span class="got">✓</span>';
    return `<span>${t}</span>`;
  }).join('');
  const von = fertig && d.by ? `<span class="item-by">abgehakt von ${d.by === app.name() ? 'dir' : esc(d.by)}</span>` : '';
  return `<li class="item${fertig ? ' is-done' : ''}">
<button type="button" class="cb" role="checkbox" aria-checked="${fertig}" data-check="${esc(k)}" aria-label="${esc(d.name)}">${ic('check')}</button>
<div class="item-main"><span class="item-name">${esc(d.name)}</span>${herkunft ? `<span class="item-sub">${herkunft}</span>` : ''}${von}</div>
<span class="item-qty">${esc(mengeText)}${etwa ? `<small>${esc(etwa)}</small>` : ''}</span>
<button type="button" class="x" data-del="${esc(k)}" aria-label="${esc(d.name)} löschen">${X}</button>
</li>`;
}

export function listeZeichnen() {
  const body = $('#list-body');
  fuerZeichnen();
  fruehstueckZeichnen();
  if (!app.listeDa) {
    body.innerHTML = '<p class="loading">Liste wird geladen…</p>';
    $('#l-count').textContent = '';
    $('#l-foot').innerHTML = '';
    return;
  }
  const eintraege = Object.entries(app.stand.items);
  const gruppen = nachBereichen(app.stand, app.katalog);
  const offen = gruppen.reduce((n, g) => n + g.eintraege.length, 0);
  const fertig = eintraege.filter(([, d]) => erledigt(d));
  const nachName = (a, b) => String(a[1].name).localeCompare(String(b[1].name), 'de');
  let html = '';
  if (!eintraege.length) {
    html = '<div class="empty-state"><p class="es-t">Noch nichts auf der Liste.</p><p>Öffne ein Rezept und tippe auf „Alles auf die Einkaufsliste“. Alles andere schreibt ihr oben ins Feld.</p></div>';
  } else {
    if (!offen) html += '<div class="alldone"><b>Alles im Wagen.</b> Erledigtes könnt ihr unten entfernen.</div>';
    for (const { bereich, eintraege: g } of gruppen) {
      html += `<section class="grp" data-bereich="${bereich.id}"><h3><span class="grp-name">${esc(bereich.name)}${bereich.hinweis ? ` <small>${esc(bereich.hinweis)}</small>` : ''}</span><span class="num">${g.length}</span></h3><ul class="items">${g.map(zeile).join('')}</ul></section>`;
    }
    if (fertig.length) {
      html += `<section class="grp grp-done"><h3><span>Im Wagen</span><span class="num">${fertig.length}</span></h3><ul class="items">${fertig.sort(nachName).map(zeile).join('')}</ul></section>`;
    }
  }
  body.innerHTML = html;
  $('#l-count').textContent = eintraege.length ? `${offen} offen${fertig.length ? ` · ${fertig.length} erledigt` : ''}` : '';
  $('#kopieren').hidden = !offen;
  if (!offen) $('#kopie-feld').hidden = true;
  fussZeichnen(fertig.length);
}

function fussZeichnen(fertigAnzahl) {
  const fuss = $('#l-foot');
  const anzahl = Object.keys(app.stand.items).length;
  if (!anzahl) { fuss.innerHTML = ''; leerenFragen = false; return; }
  if (leerenFragen) {
    fuss.innerHTML = `<div class="confirm" role="group" aria-label="Liste leeren"><span>Alle ${anzahl} Einträge löschen? Das gilt auch auf dem anderen Handy.</span><div class="confirm-btns"><button type="button" class="btn btn-danger" data-act="leeren-ja">Ja, Liste leeren</button><button type="button" class="btn btn-quiet" data-act="leeren-nein">Abbrechen</button></div></div>`;
    return;
  }
  fuss.innerHTML = `${fertigAnzahl ? `<button type="button" class="btn" data-act="erledigte-weg">Erledigte entfernen<span class="btn-n">${fertigAnzahl}</span></button>` : ''}<button type="button" class="btn btn-quiet" data-act="leeren">Liste leeren</button>`;
}

function fuerZeichnen() {
  const el = $('#forrow');
  const rids = rezepteAufListe(app.stand);
  if (!rids.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<span class="for-k">Für</span>' + rids.map((rid) => {
    const nm = esc(kurzName(rid));
    const offen = app.nachId[rid] ? ` data-open="${esc(rid)}"` : ' disabled';
    return `<span class="forchip"><button type="button" class="for-open"${offen}>${nm}</button><button type="button" class="for-x" data-rmrec="${esc(rid)}" aria-label="${nm} von der Liste nehmen">${X}</button></span>`;
  }).join('');
}

function fruehstueckZeichnen() {
  const b = $('#quick-breakfast');
  const f = app.extras.fruehstueck;
  if (!f) { b.parentElement.hidden = true; return; }
  const drauf = rezeptStand(app.stand, f).drauf;
  b.setAttribute('aria-pressed', String(drauf));
  b.innerHTML = drauf ? `${ic('check')}Frühstück steht drauf` : `${ic('plus')}Frühstück für ${f.tage || 7} Tage`;
  b.disabled = !app.listeDa;
}

export function zahlZeichnen() {
  const n = offeneAnzahl(app.stand);
  const b = $('#badge');
  b.textContent = String(n);
  b.hidden = !n;
}

/* -------------------------------------------------- gemeinsame Liste */

const STATUS_TEXT = { lokal: 'Nur lokal', ok: 'Geteilt', sendet: 'Speichert…', offline: 'Offline', zugang: 'Schlüssel prüfen' };

export function statusZeichnen() {
  const { zustand, offen, zuletzt } = app.status;
  const chip = $('#sync');
  chip.dataset.state = zustand;
  $('#sync-text').textContent = STATUS_TEXT[zustand] || '';
  const note = $('#l-note');
  let t = '';
  if (zustand === 'offline') t = `Gerade keine Verbindung zu GitHub.${offen ? ` ${offen} ${offen === 1 ? 'Änderung wird' : 'Änderungen werden'} gespeichert, sobald das Handy wieder online ist.` : ''}`;
  note.textContent = t;
  note.hidden = !t;
  note.dataset.tone = zustand === 'offline' ? 'warn' : '';
  teilenZeichnen(zuletzt);
  // Ein offenes Formular bleibt, wie es ist – sonst wäre Getipptes weg.
  if (!formular) zugangZeichnen();
}

function teilenZeichnen(zuletzt) {
  const el = $('#teilen');
  if (!app.zugang || app.status.zustand === 'zugang') { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const wer = app.name() ? ` · du bist ${esc(app.name())}` : '';
  const wann = zuletzt ? ` · abgeglichen ${uhrzeit(zuletzt)}` : '';
  if (trennenFragen) {
    const offen = app.status.offen;
    el.innerHTML = `<div class="confirm" role="group" aria-label="Trennen"><span>Dieses Handy von der gemeinsamen Liste trennen? Die Liste bleibt in GitHub.${offen ? ` ${offen} ${offen === 1 ? 'Änderung ist' : 'Änderungen sind'} noch nicht gespeichert und gehen verloren.` : ''}</span><div class="confirm-btns"><button type="button" class="btn btn-danger" data-act="z-trennen-ja">Ja, trennen</button><button type="button" class="btn btn-quiet" data-act="z-trennen-nein">Abbrechen</button></div></div>`;
    return;
  }
  const ki = ladeKi();
  const link = einladungsLink(app.zugang.token, ki);
  const wa = `https://wa.me/?text=${encodeURIComponent(`Unsere Einkaufsliste in Boxenstopp: ${link}`)}`;
  el.innerHTML = `<p><b>Gemeinsame Liste</b>${wer}${wann}</p>
<div class="zugang-btns"><button type="button" class="btn" data-act="z-link">Link fürs zweite Handy kopieren</button><a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">Per WhatsApp schicken</a><button type="button" class="btn btn-quiet" data-act="z-trennen">Trennen</button></div>
<input class="z-linkfeld" id="z-linkfeld" type="text" readonly value="${esc(link)}" aria-label="Link fürs zweite Handy" hidden>
<p class="fine">Wer den Link hat, kann eure Liste ändern${ki ? ' und mit eurem KI-Schlüssel Rezepte machen lassen' : ''}. Schick ihn nur an die Person, mit der du die Liste teilst.</p>`;
}

export function zugangZeichnen() {
  const el = $('#zugang');
  const kaputt = app.zugang && app.status.zustand === 'zugang';
  if (formular) {
    const ausLink = !!formular.token;
    el.innerHTML = `<form class="zugang-form" id="z-form" novalidate>
<p class="z-titel">Gemeinsame Liste einrichten</p>
<p class="z-text">${ausLink ? 'Der Schlüssel aus dem Link ist schon eingetragen. Es fehlt nur noch dein Name.' : 'Den Schlüssel legst du einmal bei GitHub an, die Anleitung steht im README. Das zweite Handy bekommt ihn danach über einen Link aus der App.'}</p>
<label for="z-name">Dein Name</label>
<input id="z-name" type="text" maxlength="30" autocomplete="given-name" placeholder="z. B. Tobi" value="${esc(formular.name ?? app.zugang?.name ?? '')}">
<label for="z-token">Schlüssel</label>
<input id="z-token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_… oder der Link" value="${esc(formular.token)}">
<p class="zugang-fehler" id="z-fehler"${formular.fehler ? '' : ' hidden'}>${esc(formular.fehler)}</p>
<div class="zugang-btns"><button type="submit" class="btn btn-primary" id="z-los">Verbinden</button><button type="button" class="btn btn-quiet" data-act="z-abbrechen">Abbrechen</button></div>
</form>`;
    return;
  }
  if (kaputt) {
    el.innerHTML = `<div class="zugang-banner warn"><p><b>Der Schlüssel funktioniert nicht.</b> Er ist abgelaufen, gelöscht oder hat keine Rechte mehr für Boxenstopp-Daten. Änderungen bleiben vorgemerkt.</p><button type="button" class="btn" data-act="z-oeffnen">Neuen Schlüssel eintragen</button></div>`;
    return;
  }
  if (!app.zugang) {
    el.innerHTML = '<div class="zugang-banner"><p><b>Nur auf diesem Handy.</b> Richte die gemeinsame Liste ein, dann seht ihr beide dasselbe.</p><button type="button" class="btn" data-act="z-oeffnen">Einrichten</button></div>';
    return;
  }
  el.innerHTML = '';
}

/** Vom Start aus: Ein Link mit Schlüssel wurde geöffnet. */
export function formularMitSchluessel(token) {
  formular = { token, name: null, fehler: '' };
  zugangZeichnen();
}

async function formularAbschicken() {
  const name = $('#z-name').value.trim().replace(/\s+/g, ' ').slice(0, 30);
  const token = schluesselAus($('#z-token').value);
  const fehler = (t) => { formular = { token: $('#z-token').value, name: $('#z-name').value, fehler: t }; zugangZeichnen(); };
  if (!name) { fehler('Trag deinen Namen ein, dann sieht der andere, wer was abgehakt hat.'); return; }
  if (!token) { fehler('Das sieht nicht nach einem Schlüssel aus. Er beginnt mit github_pat_.'); return; }
  const los = $('#z-los');
  los.disabled = true;
  los.textContent = 'Prüfe…';
  const ki = kiAus($('#z-token').value);
  const ergebnis = await app.verbinden(token, name);
  if (ergebnis === 'ok') {
    if (ki) speichereKi(ki);
    formular = null;
    zugangZeichnen();
    melde(`Verbunden. Ihr teilt jetzt eine Liste, ${name}.`);
    return;
  }
  fehler(ergebnis === 'falsch'
    ? 'GitHub lehnt den Schlüssel ab. Er muss für Boxenstopp-Daten gelten und „Contents: Read and write“ haben.'
    : 'Keine Verbindung zu GitHub. Versuch es gleich nochmal.');
}

/* --------------------------------------------------------------- Klicks */

export function klickListe(el) {
  const d = el.dataset;
  if (d.check) {
    const e = app.stand.items[d.check];
    if (e) app.aendern(opHaken(app.stand, d.check, !erledigt(e), app.name()));
    return true;
  }
  if (d.del) {
    const e = app.stand.items[d.del];
    if (!e) return true;
    const k = d.del;
    const vorher = JSON.parse(JSON.stringify(e));
    app.aendern(opLoeschen(k));
    melde(`„${vorher.name}“ gelöscht`, { knopf: 'Rückgängig', beiKnopf: () => app.aendern(opSetzen(k, vorher)) });
    return true;
  }
  if (d.rmrec) { rezeptVonListe(d.rmrec); return true; }
  switch (d.act) {
    case 'fruehstueck':
      if (rezeptStand(app.stand, app.extras.fruehstueck).drauf) rezeptVonListe('fruehstueck');
      else rezeptAufListe('fruehstueck');
      return true;
    case 'kopieren': {
      const text = alsText(app.stand, app.katalog);
      const feld = $('#kopie-feld');
      const zeigen = () => {
        feld.value = text;
        feld.hidden = false;
        feld.focus();
        feld.select();
        melde('Kopieren klappt hier nicht. Der Text steht markiert im Feld, lange drücken zum Kopieren.');
      };
      if (!text) { melde('Gerade ist nichts offen.'); return true; }
      try {
        navigator.clipboard.writeText(text).then(() => { feld.hidden = true; melde('Liste kopiert. Jetzt in deine Einkaufsliste einfügen.'); }, zeigen);
      } catch { zeigen(); }
      return true;
    }
    case 'erledigte-weg': app.aendern(opErledigteWeg()); melde('Erledigtes entfernt'); return true;
    case 'leeren': leerenFragen = true; listeZeichnen(); return true;
    case 'leeren-nein': leerenFragen = false; listeZeichnen(); return true;
    case 'leeren-ja': leerenFragen = false; app.aendern(opLeeren()); melde('Liste geleert'); return true;
    case 'z-oeffnen': formular = { token: '', name: null, fehler: '' }; zugangZeichnen(); $('#z-name')?.focus(); return true;
    case 'z-abbrechen': formular = null; zugangZeichnen(); return true;
    case 'z-link': {
      const link = einladungsLink(app.zugang.token, ladeKi());
      const feld = $('#z-linkfeld');
      const zeigen = () => { if (feld) { feld.hidden = false; feld.select(); } melde('Kopieren klappt hier nicht. Der Link steht jetzt im Feld darunter.'); };
      try {
        navigator.clipboard.writeText(link).then(() => melde('Link kopiert. Schick ihn an das zweite Handy.'), zeigen);
      } catch { zeigen(); }
      return true;
    }
    case 'z-trennen': trennenFragen = true; teilenZeichnen(app.status.zuletzt); return true;
    case 'z-trennen-nein': trennenFragen = false; teilenZeichnen(app.status.zuletzt); return true;
    case 'z-trennen-ja': trennenFragen = false; app.trennen(); return true;
    default: return false;
  }
}

export function absendenListe(ev) {
  if (ev.target.id === 'addform') {
    ev.preventDefault();
    const feld = $('#add-input');
    const name = feld.value.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name) return true;
    feld.value = '';
    const id = `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    app.aendern(opEigener(id, name, abteilung(name, app.katalog)));
    feld.focus();
    return true;
  }
  if (ev.target.id === 'z-form') {
    ev.preventDefault();
    formularAbschicken();
    return true;
  }
  return false;
}
