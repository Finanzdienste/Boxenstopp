/*
 * Einstieg: Rezepte laden, den richtigen Speicher für die Einkaufsliste
 * wählen, Klicks verteilen, Service Worker anmelden.
 *
 * Ohne Schlüssel liegt die Liste nur auf diesem Handy (speicher.js lokal).
 * Mit Schlüssel liegt sie im privaten Repo Boxenstopp-Daten (github), und
 * beide Handys sehen dieselbe Liste. Ein Gast mit eigener Liste (Marielle)
 * hat sein eigenes Repo; wo, steht im Zugang (zugang.js ortVon). Öffnet ein
 * Gast seine Einladung auf einem Gerät ohne Liste, verbindet die App gleich
 * und begrüßt ihn (ansicht-willkommen.js).
 *
 * Für die Tests lassen sich zwei Dinge über den localStorage verstellen:
 * __api (statt https://api.github.com) und __takt (Abgleich in ms).
 */
import { app, $, ansicht, zeigeReiter, melde, lese, reiterBeobachten } from './kern.js';
import { lokal, github, lokalerStand, lokalLoeschen, githubVergessen, pruefeSchluessel, privatLesen, bekanntesProfil, API } from './speicher.js';
import { opZusammen, opPerson, opEinePerson } from './liste.js';
import { preiseMitBons } from './kosten.js';
import { ladeZugang, speichereZugang, loescheZugang, linkAusAdresse, kiAusAdresse, speichereKi, ortVon, eigeneListe, KI_DATEI, geteiltenKiUebernehmen } from './zugang.js';
import { filterZeichnen, rasterZeichnen, oeffneRezept, schliesseRezept, offenesRezept, detailAktualisieren, klickRezepte, eingabeRezepte, aenderungRezepte, absendenRezepte, timerZeichnen, zuSchritt, abschnittGeklappt, kochstandZeichnen } from './ansicht-rezepte.js';
import { timerAnmelden, leisteHTML, klickTimer } from './timer.js';
import { listeZeichnen, zahlZeichnen, statusZeichnen, zugangZeichnen, formularMitSchluessel, klickListe, absendenListe, aenderungListe, wegPruefen, eingabeZugang } from './ansicht-liste.js';
import { kiStart, kiAbgleichen, resteZeichnen, klickKi, eingabeKi, aenderungKi, absendenKi } from './ansicht-ki.js';
import { anpassenStart, klickAnpassen, eingabeAnpassen, absendenAnpassen } from './ansicht-anpassen.js';
import { lobStart, klickLob } from './lob.js';
import { angeboteZeichnen, angeboteAutoSetzen, angebotePrivatVergessen, zahlZeichnen as angeboteZahl, klickAngebote, eingabeAngebote, aenderungAngebote, absendenAngebote } from './ansicht-angebote.js';
import { amyZeichnen, amyVorbereiten, amyStart, amyZuSchritt, amyTimerZeichnen, klickAmy, eingabeAmy, aenderungAmy, absendenAmy, tasteAmy } from './ansicht-amy.js';
import { tabletPruefen, klickTablet } from './ansicht-tablet.js';
import { kochstandAbgleichen, kochstandStart } from './kochstand.js';
import { klickPush, aenderungPush, pushAnmelden, pushZeichnen, pushHinweisPruefen } from './ansicht-push.js';
import { einstellungenStart, einstellungenZeichnen, klickEinstellungen, aenderungEinstellungen, absendenEinstellungen, tabbarAnpassen, waageTestAus } from './ansicht-einstellungen.js';
import { waageStart, waageNeu } from './waage.js';
import { kochmodusAnmelden, kochmodusNeu, kochmodusTimerZeichnen, klickKochmodus, tasteKochmodus, wischStart, wischEnde } from './kochmodus.js';
import { haushaltStart, haushaltZeichnen, haushaltGezeigt, klickHaushalt, aenderungHaushalt, absendenHaushalt, tasteHaushalt } from './ansicht-haushalt.js';
import { todoHolen, klickTodo, absendenTodo } from './ansicht-todo.js';
import { zielAnwenden, klickZiel, absendenZiel, eingabeZiel, aenderungZiel } from './ansicht-ziel.js';
import { profilAnwenden, farbeSetzen, istEigen } from './profil.js';
import { klickSpeisekarte, absendenSpeisekarte, eingabeSpeisekarte, aenderungSpeisekarte, speisekarteNeu } from './ansicht-speisekarte.js';
import { klickGaeste, absendenGaeste, eingabeGaeste, aenderungGaeste, gaesteAusAdresse } from './ansicht-gaeste.js';
import { klickWillkommen, absendenWillkommen, aenderungWillkommen, eingabeWillkommen, willkommenPruefen } from './ansicht-willkommen.js';
import { boxenZeichnen, klickBoxen } from './ansicht-boxen.js';
import { klickReste } from './ansicht-reste.js';
import { katalogStart, katalogVorab, katalogLaden, klickKatalog } from './ansicht-katalog.js';
import { klickDoppel, doppelNeu } from './ansicht-doppel.js';
import { boxenText } from './boxen.js';

const apiBasis = () => lese('__api', null) || API;
/** Rewe und Edeka (kaufDA) liegen nur im privaten Daten-Repo – mit dem Schlüssel nebenbei holen (eine eigene Liste hat sie nicht). */
const privateAngebote = () => {
  if (!app.zugang?.token || eigeneListe(app.zugang)) return;
  privatLesen('angebote-privat.json', { token: app.zugang.token, api: apiBasis() }).then((a) => { if (a) angeboteAutoSetzen(a, { privat: true }); });
};
/*
 * Der für alle Handys der Liste freigegebene KI-Schlüssel (ki.json im Daten-Repo,
 * zugang.js): holen und übernehmen, wenn dieses Handy keinen eigenen, neueren hat.
 * Was drinsteht, merkt sich app.kiGeteilt für die Einstellungen.
 */
const geteiltenKiHolen = async () => {
  if (!app.zugang?.token) return;
  const k = await privatLesen(KI_DATEI, { token: app.zugang.token, api: apiBasis(), ort: ortVon(app.zugang) });
  app.kiGeteilt = k && typeof k === 'object' && !Array.isArray(k) ? k : null;
  if (!app.kiGeteilt) return;
  if (geteiltenKiUebernehmen(app.kiGeteilt)) {
    einstellungenZeichnen();
    resteZeichnen();
    melde(`KI-Schlüssel${app.kiGeteilt.von ? ` von ${app.kiGeteilt.von}` : ''} übernommen – für alle Handys dieser Liste.`);
  } else {
    einstellungenZeichnen();
  }
};
const takt = () => Number(lese('__takt', 0)) || 8000;
/** Der kurze Name eines Rezepts für die Commit-Nachricht („Chili auf die Liste“). */
const rezeptName = (rid) => app.nachId[rid]?.short || app.amyNach?.[rid]?.short || app.extras?.[rid]?.short || '';
const speicherFuer = (z) => github({ ...z, ort: ortVon(z), api: apiBasis(), takt: takt(), rezeptName });

const eyebrowZeichnen = () => { $('#r-eyebrow').textContent = `${app.rezepte.length} Rezepte · je ${boxenText(app.boxen)}`; };
/*
 * Der Katalog hat sich geändert (ansicht-katalog.js): neu rechnen und zeichnen.
 * Ein offenes Katalogrezept zeichnet sich neu, ein herausgenommenes schließt;
 * ein anderes offenes Rezept bleibt in Ruhe, das Raster kommt beim Schließen.
 */
app.rezepteNeu = () => {
  if (!zielAnwenden()) return;
  eyebrowZeichnen();
  const rid = offenesRezept();
  if (rid && !app.nachId[rid]) schliesseRezept();
  else if (rid && app.nachId[rid].katalog) oeffneRezept(rid, { still: true });
  else if (!rid) rasterZeichnen();
  resteZeichnen();
  listeZeichnen();
};
let einePersonGeschickt = '';
function beiAenderung(stand) {
  app.stand = stand;
  app.listeDa = true;
  // Ein eigenes Ziel pro Box: die Rezepte darauf (ansicht-ziel.js); Name und Farbe der Liste (profil.js)
  const zielNeu = zielAnwenden();
  profilAnwenden();
  // Für wie viele Boxen: oben bei den Rezepten und in den Einstellungen (ansicht-boxen.js)
  if (zielNeu) eyebrowZeichnen();
  boxenZeichnen();
  // Eine eigene Liste hat eine Person, auf jedem Gerät: Hat sich dieses Gerät anders genannt („Marielli“), heißt es
  // jetzt wie die Liste („Marielle“) – und was es unter dem anderen Namen gemacht hat, steht bei ihr (opEinePerson)
  const person = istEigen() ? stand.profil?.person : '';
  if (person && app.zugang && app.zugang.name !== person) {
    app.zugang = { ...app.zugang, name: person };
    speichereZugang(app.zugang);
    app.speicher?.umbenennen?.(person);
  }
  const anders = person ? Object.keys(stand.leute || {}).filter((k) => k !== person.toLowerCase()).sort().join() : '';
  if (anders && anders !== einePersonGeschickt) {
    einePersonGeschickt = anders;
    setTimeout(() => app.aendern(opEinePerson(person)), 0);
  }
  // Wer die Liste teilt, steht einmal drin – damit man im Putzplan „Wer“ wählen kann. Eine eigene Liste hat
  // eine Person: ein weiteres Gerät, auf dem sie sich anders nennt (Marielle, Marielli), kommt nicht als Zweite dazu
  const ich = app.zugang?.name?.trim();
  const neuDabei = (s) => !!ich && !s.leute?.[ich.toLowerCase()] && !(istEigen() && Object.keys(s.leute || {}).length);
  if (neuDabei(stand)) setTimeout(() => { if (app.zugang?.name?.trim() === ich && neuDabei(app.stand)) app.aendern(opPerson(ich)); }, 0);
  // Was ihr wirklich bezahlt habt (Bons auf der Liste), gilt vor dem Richtpreis
  app.preise = preiseMitBons(app.richtpreise, stand.bons, app.naehrwerte);
  // Hat dieselbe Person auf einem anderen Gerät weitergekocht? Dann gilt hier ihr Stand (kochstand.js)
  const kochNeu = kochstandAbgleichen(stand);
  // Die Waage der Liste (profil.waage) kann sich geändert haben – neu verbinden, wenn gerade jemand zuhört
  waageNeu();
  kiAbgleichen();
  amyVorbereiten();
  listeZeichnen();
  zahlZeichnen();
  angeboteZeichnen();
  angeboteZahl();
  amyZeichnen();
  tabletPruefen();
  // Ein Rezept aus der Resteverwertung kann auf dem anderen Handy gelöscht worden sein.
  if (offenesRezept() && !app.nachId[offenesRezept()]) schliesseRezept();
  if (offenesRezept() && zielNeu) oeffneRezept(offenesRezept(), { still: true });
  else if (offenesRezept()) detailAktualisieren(); else { rasterZeichnen(); resteZeichnen(); }
  if (zielNeu) speisekarteNeu();
  if (kochNeu) { kochstandZeichnen(); kochmodusNeu(); }
  // Zwei auf einmal: Liste und Haken stehen im Plan
  doppelNeu();
  // Putzplan und Haushaltssachen (zeichnet nur, wenn der Reiter offen ist – sonst beim Hinwechseln)
  haushaltZeichnen();
  // Preisalarme, Bons, Wege: was dort steht, kann sich geändert haben
  if (ansicht.tab === 'einstellungen') einstellungenZeichnen();
  // Ein Gast mit eigener Liste: einmal das Willkommen
  willkommenPruefen();
}
function beiStatus(s) {
  app.status = s;
  statusZeichnen();
  // Abgeglichen: Ist Push eingerichtet, aber hier noch aus, fragt die App einmal (ansicht-push.js)
  if (s.zustand === 'ok') setTimeout(pushHinweisPruefen, 2500);
}

function nimmSpeicher(neu) {
  if (app.speicher) app.speicher.stop();
  app.speicher = neu;
  neu.start(beiAenderung, beiStatus);
}

// Angebote oder Laden geändert (ansicht-angebote.js): die Hinweise auf der Liste mitziehen
app.listeNeu = () => listeZeichnen();
// Tempo vergessen (ansicht-rezepte.js, auch aus den Einstellungen): die Zeiten bei Amy und die Einstellungen
app.tempoNeu = () => { amyZeichnen(); einstellungenZeichnen(); };
// In die Einstellungen: dort frisch zeichnen und Push nachsehen; die Leiste unten passt ihre Beschriftungen an
reiterBeobachten((t) => {
  if (t === 'einstellungen') { einstellungenZeichnen(); pushZeichnen(); todoHolen(); } else waageTestAus();
  if (t === 'haushalt') haushaltGezeigt();
  tabbarAnpassen();
});

/** Verbinden – daten: das Repo einer eigenen Liste (Gast), farbe: wie sie aussieht. */
app.verbinden = async (token, name, { daten = '', farbe = '' } = {}) => {
  const ort = ortVon({ daten });
  const ergebnis = await pruefeSchluessel(token, { api: apiBasis(), ort });
  if (ergebnis !== 'ok') return ergebnis;
  // Was bisher nur auf diesem Handy stand, kommt mit in die gemeinsame Liste.
  const bisher = app.zugang ? null : lokalerStand();
  // Eine andere Liste als bisher: was von der alten noch vorgemerkt ist, gehört nicht in die neue
  const ortName = (o) => `${o.owner}/${o.repo}`;
  if (app.zugang && ortName(ortVon(app.zugang)) !== ortName(ort)) { githubVergessen(); app.listeDa = false; }
  app.zugang = { token, name, ...(eigeneListe({ daten }) ? { daten } : {}) };
  speichereZugang(app.zugang);
  if (farbe) farbeSetzen(farbe === 'blau' ? '' : farbe);
  nimmSpeicher(speicherFuer(app.zugang));
  if (bisher && (Object.keys(bisher.items).length || Object.keys(bisher.ki).length || Object.keys(bisher.amy || {}).length)) app.aendern(opZusammen(bisher.items, bisher.ki, { amy: bisher.amy, amyTags: bisher.amyTags, abteilungen: bisher.abteilungen, gleich: bisher.gleich, ungleich: bisher.ungleich, wege: bisher.wege }));
  lokalLoeschen();
  statusZeichnen();
  privateAngebote();
  geteiltenKiHolen();
  katalogVorab();
  app.rezepteNeu();
  katalogLaden({ abgleich: true });
  return 'ok';
};

app.trennen = () => {
  loescheZugang();
  githubVergessen();
  app.zugang = null;
  app.kiGeteilt = null;
  app.listeDa = false;
  angebotePrivatVergessen();
  katalogVorab();
  app.rezepteNeu();
  nimmSpeicher(lokal());
  zugangZeichnen();
  melde('Getrennt. Die Liste bleibt in GitHub, hier ist sie jetzt leer.');
};

/* --------------------------------------------------------------- Klicks */

/** Ein Timer oben in der Leiste: zum Schritt springen – bei Amys Rezepten in ihren Reiter. */
function zumTimerSchritt(tm) {
  const rid = tm.dataset.timerZu;
  if (rid.startsWith('amy-')) amyZuSchritt(rid, Number(tm.dataset.timerSchritt)); else zuSchritt(rid, Number(tm.dataset.timerSchritt));
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('button');
  if (!el) {
    // Die Timer oben sind keine Knöpfe (darin stecken +1 und ×) – antippen springt zum Schritt
    const tm = ev.target.closest('[data-timer-zu]');
    if (tm) zumTimerSchritt(tm);
    return;
  }
  if (el.disabled) return;
  if (klickKochmodus(el)) return;
  if (el.dataset.tab) { zeigeReiter(el.dataset.tab); return; }
  if (klickLob(el)) return;
  if (klickTimer(el)) return;
  if (klickTablet(el)) return;
  if (klickPush(el)) return;
  if (klickTodo(el)) return;
  if (klickEinstellungen(el)) return;
  if (klickWillkommen(el)) return;
  if (klickBoxen(el)) return;
  if (klickGaeste(el)) return;
  if (klickZiel(el)) return;
  if (klickSpeisekarte(el)) return;
  if (klickHaushalt(el)) return;
  if (klickAmy(el)) return;
  if (klickReste(el)) return;
  if (klickKatalog(el)) return;
  if (klickDoppel(el)) return;
  if (klickListe(el)) return;
  if (klickAngebote(el)) return;
  if (klickAnpassen(el)) return;
  if (klickKi(el)) return;
  klickRezepte(el);
});
// Ein Produktfoto, das nicht lädt (Händler hat es weggenommen, kein Netz): das Bildchen der Zutat zeigen
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (img?.tagName !== 'IMG' || !img.dataset.ersatz) return;
  const ersatz = img.dataset.ersatz;
  delete img.dataset.ersatz;
  img.src = ersatz;
  img.parentElement?.classList.add('a-bild-zb');
}, true);
document.addEventListener('keydown', (ev) => {
  if (tasteKochmodus(ev)) { ev.preventDefault(); return; }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target?.matches?.('[data-timer-zu]')) { ev.preventDefault(); zumTimerSchritt(ev.target); }
  // Enter im Tag-Feld legt den Tag an, statt das Rezept zu speichern
  if (ev.key === 'Enter' && !ev.isComposing && tasteAmy(ev.target)) ev.preventDefault();
  // Enter in einer Aufgabe des Putzplans: die nächste Zeile, nicht speichern
  if (ev.key === 'Enter' && !ev.isComposing && tasteHaushalt(ev.target)) ev.preventDefault();
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (eingabeZiel(t) || eingabeWillkommen(t) || eingabeGaeste(t) || eingabeSpeisekarte(t) || eingabeZugang(t)) return;
  if (!eingabeAmy(t) && !eingabeAnpassen(t) && !eingabeKi(t) && !eingabeAngebote(t)) eingabeRezepte(t);
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (aenderungZiel(t) || aenderungWillkommen(t) || aenderungGaeste(t) || aenderungSpeisekarte(t)) return;
  if (!aenderungKi(t) && !aenderungAmy(t) && !aenderungPush(t) && !aenderungEinstellungen(t) && !aenderungHaushalt(t) && !aenderungRezepte(t) && !aenderungListe(t)) aenderungAngebote(t);
});
// Im Kochmodus: wischen zum Blättern
document.addEventListener('touchstart', wischStart, { passive: true });
document.addEventListener('touchend', wischEnde, { passive: true });
// Ein Einkauf, der lange ruht, ist vorbei – auch wenn die App zwischendurch zu war
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wegPruefen(); });
// Bereiche im Rezept auf- und zuklappen: „toggle“ steigt nicht auf, darum in der Capture-Phase
document.addEventListener('toggle', (ev) => abschnittGeklappt(ev.target), true);
document.addEventListener('submit', (ev) => {
  if (absendenZiel(ev) || absendenWillkommen(ev) || absendenGaeste(ev) || absendenSpeisekarte(ev)) return;
  if (!absendenAmy(ev) && !absendenAnpassen(ev) && !absendenKi(ev) && !absendenAngebote(ev) && !absendenEinstellungen(ev) && !absendenTodo(ev) && !absendenHaushalt(ev) && !absendenRezepte(ev)) absendenListe(ev);
});

/* ----------------------------------------------------------------- Start */

async function start() {
  let daten;
  try {
    const r = await fetch('daten/rezepte.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    daten = await r.json();
  } catch {
    $('#grid').innerHTML = '<p class="empty">Die Rezepte ließen sich nicht laden. Prüf die Verbindung und öffne die App noch einmal.</p>';
    return;
  }
  app.rezepteBasis = daten.rezepte;
  app.rezepte = daten.rezepte;
  app.datenVersion = String(daten.version || '');
  app.katalog = daten.katalog;
  app.extras = daten.extras || {};
  app.naehrwerte = daten.naehrwerte || {};
  app.richtpreise = daten.preise || {};
  app.preise = app.richtpreise;
  app.preiseStand = daten.preise_stand || '';
  if (daten.ziel) { app.ziel = { ...daten.ziel }; app.zielStandard = { ...daten.ziel }; }
  for (const r of app.rezepte) app.nachId[r.id] = r;
  // Welche Einheit ein Katalog-Schlüssel hat – damit die Resteverwertung nur
  // dann eine Zeile mit einem festen Rezept teilt, wenn sich Mengen addieren lassen.
  for (const r of app.rezepte) for (const it of r.items) if (it.k && typeof it.q === 'number') app.einheiten[it.k] = it.u;
  eyebrowZeichnen();

  let hash = '';
  try { hash = decodeURIComponent((location.hash || '').slice(1)); } catch { /* kaputte Adresse */ }
  const kiLink = kiAusAdresse();
  if (kiLink) speichereKi(kiLink);
  const link = linkAusAdresse();
  const ausLink = link.token;
  // Ziel, Farbe und Namen der Liste schon vor dem ersten Zeichnen – wie das Gerät sie zuletzt kannte
  app.zugang = ladeZugang();
  // Die Gäste vom alten Handy (…#gaeste=…): in den Einstellungen einmal nachfragen
  const gaesteLink = gaesteAusAdresse();
  // Der gemeinsame Katalog: was das Gerät zuletzt kannte, gleich mit den Rezepten
  katalogStart();
  geteiltenKiHolen();
  app.stand = { ...app.stand, profil: bekanntesProfil(app.zugang ? ortVon(app.zugang) : null) };
  zielAnwenden();
  profilAnwenden();
  eyebrowZeichnen();
  // Eine Einladung (…&fuer=Marielle) auf einem Gerät ohne Liste: gleich verbinden, das Willkommen erklärt den Rest
  const einladung = !!ausLink && !app.zugang && !!link.fuer;
  if (link.farbe && (einladung || (ausLink && ausLink === app.zugang?.token))) farbeSetzen(link.farbe === 'blau' ? '' : link.farbe);
  kiStart();
  anpassenStart();
  lobStart();
  timerAnmelden(() => {
    const leiste = $('#timerleiste');
    const html = leisteHTML();
    if (leiste.innerHTML !== html) leiste.innerHTML = html;
    leiste.hidden = !html;
    timerZeichnen();
    amyTimerZeichnen();
    kochmodusTimerZeichnen();
  });
  kochstandStart();
  kochmodusAnmelden();
  waageStart();
  pushAnmelden();
  filterZeichnen();
  rasterZeichnen();
  listeZeichnen();
  angeboteZeichnen();
  amyStart();
  haushaltStart();
  // Die Angebote der Woche kommen nebenbei – ohne Netz bleibt der letzte Stand aus dem Speicher.
  fetch('daten/angebote.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((a) => { if (a) angeboteAutoSetzen(a); }).catch(() => {});
  // Wie günstig es in den letzten Wochen war (werkzeug/preisverlauf.mjs)
  fetch('daten/preisverlauf.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((v) => {
    if (v && typeof v === 'object' && v.je) { app.preisverlauf = v; listeZeichnen(); angeboteZeichnen(); }
  }).catch(() => {});

  // Ein Link mit einem neuen Schlüssel: das Einrichten steht in den Einstellungen
  const neuerSchluessel = !!ausLink && ausLink !== app.zugang?.token;
  if (einladung) ansicht.tab = 'rezepte';
  else if (neuerSchluessel) ansicht.tab = 'einstellungen';
  else if (hash === 'einkauf' || hash === 'liste' || ausLink) ansicht.tab = 'einkauf';
  if (hash === 'angebote') ansicht.tab = 'angebote';
  if (hash === 'amy') ansicht.tab = 'amy';
  if (hash === 'einstellungen') ansicht.tab = 'einstellungen';
  if (hash === 'haushalt') ansicht.tab = 'haushalt';
  if (gaesteLink) ansicht.tab = 'einstellungen';
  zeigeReiter(ansicht.tab, true);
  // Welche Reiter unten stehen – stand der gemerkte auf einem ausgeblendeten, zum ersten sichtbaren
  einstellungenStart({ wechseln: !hash && !ausLink });
  if (gaesteLink) window.requestAnimationFrame(() => $('#e-gaeste-karte')?.scrollIntoView({ block: 'center' }));
  const rezept = app.nachId[hash] ? hash : (app.nachId[ansicht.rezept] ? ansicht.rezept : null);
  if (hash === 'reste' || (kiLink && !ausLink)) kiStart({ oeffnen: true });
  else if (rezept) oeffneRezept(rezept, { still: true });
  if (kiLink && !einladung) melde('KI-Schlüssel übernommen – die Resteverwertung ist bereit.');

  if (app.zugang) nimmSpeicher(speicherFuer(app.zugang));
  else nimmSpeicher(lokal());
  privateAngebote();
  katalogLaden({ abgleich: true });

  if (einladung) {
    app.verbinden(ausLink, link.fuer, { daten: link.daten, farbe: link.farbe }).then((e) => {
      zugangZeichnen();
      if (e === 'ok') return;
      formularMitSchluessel(ausLink, link);
      zeigeReiter('einstellungen');
      melde(e === 'falsch' ? 'Der Schlüssel aus dem Link geht nicht – frag nach einem neuen Link.' : 'Gerade keine Verbindung – der Link ist eingetragen, tipp gleich auf „Verbinden“.');
    });
  } else if (ausLink && ausLink !== app.zugang?.token) formularMitSchluessel(ausLink, link);
  else zugangZeichnen();
  wegPruefen();
}

start();

/*
 * Service Worker: macht die App offline benutzbar. Eine neue Fassung lädt
 * die Seite einmal neu (wie bei Freizeit und Workout), aber nur, wenn vorher
 * schon ein Worker da war – beim allerersten Besuch nicht.
 */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Eine Push-Mitteilung angetippt, die App war schon offen: an den passenden Reiter
  navigator.serviceWorker.addEventListener('message', (ev) => {
    if (ev.data?.boxenstopp !== 'zeige') return;
    // „chili#5“: ein Timer – zum Schritt; sonst ein Reiter oder ein Rezept
    const [ziel, schritt] = String(ev.data.ziel || '').split('#');
    if (schritt && ziel.startsWith('amy-')) amyZuSchritt(ziel, Number(schritt));
    else if (schritt && app.nachId[ziel]) { zeigeReiter('rezepte'); zuSchritt(ziel, Number(schritt)); } else if (app.nachId[ziel]) { zeigeReiter('rezepte'); oeffneRezept(ziel); } else zeigeReiter(['einkauf', 'angebote', 'amy', 'haushalt'].includes(ziel) ? ziel : 'rezepte');
  });
  const eigenerWorker = new URL('./sw.js', location.href).href;
  const hatteWorker = navigator.serviceWorker.controller?.scriptURL === eigenerWorker;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteWorker) return;
    try {
      if (sessionStorage.getItem('boxenstopp.neugeladen')) return;
      sessionStorage.setItem('boxenstopp.neugeladen', '1');
    } catch { return; }
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* dann ohne Offline-Betrieb */ });
    hintergrundAnmelden();
  });
  /*
   * Auf dem neuesten Stand bleiben, ohne die App neu zu starten: Kommt sie nach
   * einer halben Stunde oder mehr wieder nach vorn, holt der Service Worker
   * Rezepte, Angebote, Preisverlauf und fehlende Fotos frisch in den Vorrat
   * (unverändert kostet das nur ein kurzes Nachfragen) und schaut nach einer
   * neuen Fassung – so ist es beim nächsten Öffnen ohne Netz aktuell.
   */
  let aufgefrischt = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - aufgefrischt < 30 * 60 * 1000 || !navigator.onLine) return;
    aufgefrischt = Date.now();
    navigator.serviceWorker.controller?.postMessage({ boxenstopp: 'aktualisieren' });
  });
}

/*
 * Auf Android (Chrome, als App installiert) darf der Service Worker das auch
 * im Hintergrund, ab und zu über den Tag – wie oft, entscheidet Chrome.
 * iPhone und iPad lassen das bei Web-Apps nicht zu; dort frischt die App
 * auf, sobald sie offen ist.
 */
async function hintergrundAnmelden() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.periodicSync) return;
    const erlaubt = await navigator.permissions?.query({ name: 'periodic-background-sync' });
    if (erlaubt?.state !== 'granted') return;
    if (!(await reg.periodicSync.getTags()).includes('boxenstopp-aktualisieren')) await reg.periodicSync.register('boxenstopp-aktualisieren', { minInterval: 4 * 60 * 60 * 1000 });
  } catch { /* geht hier nicht – dann eben beim Öffnen */ }
}
