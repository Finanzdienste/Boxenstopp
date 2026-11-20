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
 * Amys Sachen sind seit v83 eine eigene App (sachen/) mit eigener Datei
 * sachen.json im Daten-Repo. Was in der gemeinsamen Liste noch unter
 * inventar steht – von vor v83 oder von einer älteren App-Fassung wieder
 * hingeschrieben –, zieht diese App dorthin um (sachenUmzug, sachen.js).
 *
 * Für die Tests lassen sich drei Dinge über den localStorage verstellen:
 * __api (statt https://api.github.com), __takt (Abgleich in ms) und
 * __umzugPause (die Pause des Umzugs der Sachen in ms, sonst 60 s).
 */
// Als erstes: Fehler mitschreiben (Einstellungen → Über die App), auch beim Laden der anderen Teile
import { sicher, fehlerMerken } from './fehler.js';
import { kostenMeldenAn, KOSTEN_MELDEN, kiErsatzAn } from './ki.js';
import { app, $, ansicht, zeigeReiter, melde, lese, schreibe, reiterBeobachten, breiteAnwenden } from './kern.js';
import { lokal, github, lokalerStand, lokalLoeschen, githubVergessen, pruefeSchluessel, privatLesen, bekanntesProfil, offeneListe, API } from './speicher.js';
import { opZusammen, opPerson, opEinePerson } from './liste.js';
import { hatInventar, opUmgezogen, inventarZusammen } from './inventar.js';
import { umzugInSachen, umzugNoetig, umzugZusammen, wegInSachen, ART_SACHEN } from './sachen.js';
import { preiseMitBons } from './kosten.js';
import { ladeZugang, speichereZugang, loescheZugang, linkAusAdresse, kiAusAdresse, speichereKi, ortVon, eigeneListe, KI_DATEI, geteiltenKiUebernehmen, geteiltenErsatzUebernehmen, ladeKiErsatz } from './zugang.js';
import { filterZeichnen, rasterZeichnen, oeffneRezept, schliesseRezept, offenesRezept, detailAktualisieren, klickRezepte, eingabeRezepte, aenderungRezepte, absendenRezepte, timerZeichnen, zuSchritt, abschnittGeklappt, kochstandZeichnen, pinsPruefen } from './ansicht-rezepte.js';
import { timerAnmelden, leisteHTML, klickTimer } from './timer.js';
import { listeZeichnen, zahlZeichnen, statusZeichnen, zugangZeichnen, formularMitSchluessel, klickListe, absendenListe, aenderungListe, wegPruefen, eingabeZugang, GETRENNT, anderesGeraet } from './ansicht-liste.js';
import { kiStart, kiAbgleichen, resteZeichnen, klickKi, eingabeKi, aenderungKi, absendenKi } from './ansicht-ki.js';
import { anpassenStart, klickAnpassen, eingabeAnpassen, absendenAnpassen } from './ansicht-anpassen.js';
import { lobStart, klickLob } from './lob.js';
import { angeboteZeichnen, angeboteAutoSetzen, angebotePrivatVergessen, zahlZeichnen as angeboteZahl, klickAngebote, eingabeAngebote, aenderungAngebote, absendenAngebote } from './ansicht-angebote.js';
import { amyZeichnen, amyVorbereiten, amyStart, amyZuSchritt, amyTimerZeichnen, klickAmy, eingabeAmy, aenderungAmy, absendenAmy, tasteAmy } from './ansicht-amy.js';
import { tabletPruefen, klickTablet } from './ansicht-tablet.js';
import { safariVormerken, safariHinweis, einfuegenPruefen, klickIphone } from './ansicht-iphone.js';
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
import { klickGaeste, absendenGaeste, eingabeGaeste, aenderungGaeste, gaesteAusAdresse, dashboardHinweisPruefen, dashboardMitziehen } from './ansicht-gaeste.js';
import { klickWillkommen, absendenWillkommen, aenderungWillkommen, eingabeWillkommen, willkommenPruefen } from './ansicht-willkommen.js';
import { boxenZeichnen, klickBoxen } from './ansicht-boxen.js';
import { klickReste } from './ansicht-reste.js';
import { katalogStart, katalogVorab, katalogLaden, klickKatalog } from './ansicht-katalog.js';
import { klickDoppel, doppelNeu } from './ansicht-doppel.js';
import { planZeichnen, planGezeigt, klickPlan, eingabePlan, tastePlan } from './ansicht-essensplan.js';
import { boxenText } from './boxen.js';
import { bildschirmzeitStart, klickBildschirmzeit } from './ansicht-bildschirmzeit.js';
import { klickSachenApp, sachenHinweisPruefen } from './ansicht-sachen-app.js';

/*
 * Als Erstes nach den Importen, vor allem, was die Adresse liest (start()
 * unten: #zugang=, #ki=, #gaeste=, Reiter, Rezept): Ein Link aus Tobis
 * Bildschirmzeit-Widget (#bildschirmzeit=…) verbindet und ist danach aus der
 * Adresse – die App startet, als wäre er nie da gewesen. Ohne ihn passiert
 * nichts (ansicht-bildschirmzeit.js). Die Module oben lesen die Adresse beim
 * Laden nicht, und keins hört auf hashchange (test-bildschirmzeit.mjs).
 */
sicher('Bildschirmzeit', bildschirmzeitStart);

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
  geteiltenErsatzUebernehmen(app.kiGeteilt);
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
// Die gemeinsame Liste legt fehlendes inventar nie wieder dazu – Amys Sachen liegen in sachen.json. Lässt eine sehr alte
// Fassung (vor v70) sie weg, bevor sie umgezogen sind, gehen sie an den Umzug (sachenVormerken, speicher.js listeNachtrag)
const speicherFuer = (z) => github({ ...z, ort: ortVon(z), api: apiBasis(), takt: takt(), rezeptName, ohneInventar: eigeneListe(z) ? false : (inv) => sachenVormerken(inv) });

/*
 * Der Umzug der Sachen (sachen.js): Steht in der gemeinsamen Liste noch etwas
 * unter inventar, kommt es nach sachen.json (nach id und geaendert
 * zusammengeführt, Gelöschtes bleibt gelöscht) – erst danach nimmt diese App
 * genau das Umgezogene aus liste.json (opUmgezogen, ein eigener Commit
 * „Umzug: Sachen nach sachen.json“). Klappt sachen.json nicht, bleibt
 * liste.json, wie sie ist. Beides geht beliebig oft: Schreibt eine ältere
 * App-Fassung die Sachen zurück, zieht sie das nächste Mal wieder um.
 *
 * Angestoßen bei jeder Änderung und jedem Abgleich, aber erst, wenn die Liste
 * in dieser Sitzung einmal frisch gelesen ist (status.zuletzt – der
 * zwischengespeicherte Stand kann veraltet sein und Gelöschtes wiederbringen).
 * Nie zweimal gleichzeitig; mit denselben Sachen wie beim letzten Versuch
 * frühestens nach umzugPause() wieder (nach einem Fehler, und damit eine ältere
 * App-Fassung, die sie zurückschreibt, nicht alle paar Sekunden einen Commit
 * auslöst). UMZUG_REST: Sachen, die vor dem Verbinden nur auf diesem Gerät
 * standen (app.verbinden) – bis sie in sachen.json sind.
 */
const UMZUG_REST = 'boxenstopp.sachen.umzug.v1';
/*
 * UMZUG_WEG: Löschungen von Sachen, die dieses Gerät noch mit einer älteren
 * Fassung gemacht und nicht abgeschickt hatte (dingWeg, invListeWeg in
 * boxenstopp.offen.v1). Sie gehen weiter an liste.json – ist die Sache dort
 * schon umgezogen, liefen sie ins Leere; darum auch auf sachen.json (wegInSachen).
 */
const UMZUG_WEG = 'boxenstopp.sachen.umzug.weg.v1';
// 60 s; für die Tests kürzer (localStorage __umzugPause in ms, wie __takt) – test-umzug.mjs wartet sonst minutenlang
const umzugPause = () => Number(lese('__umzugPause', 0)) || 60 * 1000;
let umzugLaeuft = false;
let umzugZuletzt = { at: 0, abdruck: '' };
let umzugMelden = false;
/** Sachen für den Umzug auf dem Gerät vormerken (UMZUG_REST) – je Liste und Sache die neuere Fassung. */
function sachenVormerken(inventar) {
  if (!hatInventar(inventar)) return;
  const rest = umzugZusammen({ inventar: lese(UMZUG_REST, null) || {} }, inventar).stand.inventar;
  schreibe(UMZUG_REST, rest);
  umzugZuletzt = { at: 0, abdruck: '' };
  setTimeout(() => sicher('Umzug der Sachen', sachenUmzug), 0);
}

/** Beim Start: Löschungen der Sachen, die aus einer älteren Fassung noch offen sind, für sachen.json vormerken. */
function loeschungenVormerken() {
  const neu = offeneListe().filter((o) => o && (o.typ === 'dingWeg' || o.typ === 'invListeWeg') && typeof o.id === 'string');
  if (!neu.length) return;
  const alt = lese(UMZUG_WEG, []);
  const alle = [...(Array.isArray(alt) ? alt : []), ...neu];
  const k = (o) => `${o.typ}|${o.id}|${o.at || ''}`;
  schreibe(UMZUG_WEG, alle.filter((o, i) => alle.findIndex((x) => k(x) === k(o)) === i).slice(-200));
}

function sachenUmzug() {
  const z = app.zugang;
  if (umzugLaeuft || !z?.token || eigeneListe(z) || !app.listeDa || !app.status?.zuletzt) return;
  const rest = lese(UMZUG_REST, null);
  const wegOps = (() => { const w = lese(UMZUG_WEG, []); return Array.isArray(w) ? w : []; })();
  const inventar = umzugNoetig(app.stand) ? app.stand.inventar : null;
  if (!inventar && !hatInventar(rest) && !wegOps.length) return;
  const abdruck = JSON.stringify([inventar, rest, wegOps]);
  if (abdruck === umzugZuletzt.abdruck && Date.now() - umzugZuletzt.at < umzugPause()) return;
  umzugZuletzt = { at: Date.now(), abdruck };
  umzugLaeuft = true;
  const api = apiBasis();
  // Die Meldung nur für die Sachen von diesem Gerät (nach dem Verbinden) – der Rest geht still, bis es klappt
  let melden = umzugMelden && hatInventar(rest);
  (async () => {
    // Erst die offenen Löschungen (dann bleibt, was gelöscht ist, auch beim Umzug weg), dann die Sachen
    if (wegOps.length) {
      await wegInSachen(wegOps, { token: z.token, api });
      const jetzt = lese(UMZUG_WEG, []);
      const erledigt = new Set(wegOps.map((o) => JSON.stringify(o)));
      const bleibt = (Array.isArray(jetzt) ? jetzt : []).filter((o) => !erledigt.has(JSON.stringify(o)));
      if (bleibt.length) schreibe(UMZUG_WEG, bleibt); else { try { localStorage.removeItem(UMZUG_WEG); } catch { /* egal */ } }
    }
    if (hatInventar(rest)) {
      const { umgezogen: drueben } = await umzugInSachen(rest, { token: z.token, api });
      melden = false;
      umzugMelden = false;
      // Vergessen wird nur, was drüben ist: Passt etwas nicht mehr hinein (sachen.json voll, MAX_LISTEN/MAX_DINGE),
      // bleibt es hier gemerkt, bis Platz ist – sonst wäre es weg (die lokale Liste ist seit dem Verbinden gelöscht)
      const ohne = (xs, da) => Object.fromEntries(Object.entries(xs || {}).filter(([id]) => !da?.[id]));
      const bleibt = { listen: ohne(rest.listen, drueben.listen), dinge: ohne(rest.dinge, drueben.dinge) };
      if (JSON.stringify(lese(UMZUG_REST, null)) === JSON.stringify(rest)) {
        if (hatInventar(bleibt)) schreibe(UMZUG_REST, bleibt);
        else { try { localStorage.removeItem(UMZUG_REST); } catch { /* egal */ } }
      }
    }
    if (!inventar) return;
    const { umgezogen } = await umzugInSachen(inventar, { token: z.token, api });
    // Inzwischen getrennt oder mit einer anderen Liste verbunden: dort nichts herausnehmen
    if (app.zugang?.token !== z.token || eigeneListe(app.zugang)) return;
    // Nur, was noch in der Liste steht – sonst ein Commit ohne Änderung
    const da = app.stand.inventar || {};
    const nur = (art) => Object.fromEntries(Object.entries(umgezogen[art] || {}).filter(([id]) => da[art]?.[id]));
    const weg = { listen: nur('listen'), dinge: nur('dinge') };
    if (Object.keys(weg.listen).length || Object.keys(weg.dinge).length) app.aendern(opUmgezogen(weg));
  })().catch((e) => {
    fehlerMerken('Umzug der Sachen', e);
    if (melden) { umzugMelden = false; melde(`Die Sachen von diesem Gerät sind noch nicht in der Sachen-App: ${e?.message || 'GitHub wollte nicht.'} Die App versucht es gleich noch einmal.`); }
  }).finally(() => { umzugLaeuft = false; });
}

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
  // Der Essensplan (zeichnet nur, wenn der Reiter offen ist – sonst beim Hinwechseln)
  if (ansicht.tab === 'plan') planZeichnen();
  // Putzplan und Haushaltssachen (zeichnet nur, wenn der Reiter offen ist – sonst beim Hinwechseln)
  haushaltZeichnen();
  // Preisalarme, Bons, Wege: was dort steht, kann sich geändert haben
  if (ansicht.tab === 'einstellungen') einstellungenZeichnen();
  // Ein Gast mit eigener Liste: einmal das Willkommen
  willkommenPruefen();
  // Steht im Dashboard gerade Amys Reiter offen, zieht er mit (ansicht-gaeste.js)
  dashboardMitziehen();
  // Stehen in der gemeinsamen Liste noch Sachen, ziehen sie nach sachen.json um
  sicher('Umzug der Sachen', sachenUmzug);
}
function beiStatus(s) {
  app.status = s;
  sicher('Status', statusZeichnen);
  // Abgeglichen: Ist Push eingerichtet, aber hier noch aus, fragt die App einmal (ansicht-push.js);
  // wem Tobis Dashboard etwas zeigt, der erfährt es einmal (ansicht-gaeste.js), und Amy, dass Sachen
  // jetzt eine eigene App ist (ansicht-sachen-app.js – wartet, bis kein anderes Fenster offen ist);
  // stehen noch Sachen in der Liste, ziehen sie um; was seit über einer Woche angepinnt ist und
  // für das nichts mehr offen ist, läuft nicht mehr (ansicht-rezepte.js)
  if (s.zustand === 'ok') {
    setTimeout(() => sicher('Angepinnt', pinsPruefen), 1500);
    setTimeout(pushHinweisPruefen, 2500);
    setTimeout(dashboardHinweisPruefen, 2500);
    setTimeout(sachenHinweisPruefen, 2500);
    sicher('Umzug der Sachen', sachenUmzug);
  }
}

function nimmSpeicher(neu) {
  if (app.speicher) app.speicher.stop();
  app.speicher = neu;
  // Hakt das Zeichnen, läuft der Abgleich trotzdem weiter (und zeigt nicht „Offline“)
  neu.start((stand) => sicher('Anzeigen', () => beiAenderung(stand)), beiStatus);
}

// Angebote oder Laden geändert (ansicht-angebote.js): die Hinweise auf der Liste mitziehen
app.listeNeu = () => listeZeichnen();
// Tempo vergessen (ansicht-rezepte.js, auch aus den Einstellungen): die Zeiten bei Amy und die Einstellungen
app.tempoNeu = () => { amyZeichnen(); einstellungenZeichnen(); };
// In die Einstellungen: dort frisch zeichnen und Push nachsehen; die Leiste unten passt ihre Beschriftungen an
reiterBeobachten((t) => {
  if (t === 'einstellungen') { einstellungenZeichnen(); pushZeichnen(); todoHolen(); } else waageTestAus();
  if (t === 'haushalt') haushaltGezeigt();
  if (t === 'plan') planGezeigt();
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
  lokalUebernehmen(bisher);
  try { localStorage.removeItem(GETRENNT); } catch { /* egal */ }
  statusZeichnen();
  privateAngebote();
  geteiltenKiHolen();
  katalogVorab();
  app.rezepteNeu();
  katalogLaden({ abgleich: true });
  return 'ok';
};

/*
 * Was bisher nur auf diesem Gerät stand (lokalerStand), in die Liste: auch
 * Notizen, Essensplan, Verträglichkeit, Vorschläge, Wörter und Sachen – die
 * Sachen nur in eine eigene Liste (Gast); in der gemeinsamen Liste kommen sie
 * nach sachen.json (sachenUmzug, Fehler: Meldung). Danach ist die lokale Liste
 * leer. Beim Verbinden – und beim Start, wenn ein Zugang da ist, aber noch
 * eine lokale Liste: Dann hat die Sachen-App verbunden (Android, derselbe
 * Speicher), ohne das hier zu können.
 */
function lokalUebernehmen(bisher) {
  if (!bisher || !app.zugang) return;
  const gemeinsam = !eigeneListe(app.zugang);
  const sachen = bisher && hatInventar(bisher.inventar) ? bisher.inventar : null;
  const mehr = bisher ? { amy: bisher.amy, amyTags: bisher.amyTags, abteilungen: bisher.abteilungen, gleich: bisher.gleich, ungleich: bisher.ungleich, wege: bisher.wege, gemeint: bisher.gemeint, notizbuch: bisher.notizbuch, essensplan: bisher.essensplan, vertraeglich: bisher.vertraeglich, wuensche: bisher.wuensche, speisekammer: bisher.speisekammer, ...(gemeinsam ? {} : { inventar: bisher.inventar }) } : {};
  const hatWas = bisher && (Object.keys(bisher.items).length || Object.keys(bisher.ki).length || ['amy', 'gemeint', 'notizbuch', 'vertraeglich', 'wuensche', 'speisekammer'].some((k) => Object.keys(bisher[k] || {}).length) || Object.keys(bisher.essensplan?.tage || {}).length || (!gemeinsam && !!sachen));
  if (hatWas) app.aendern(opZusammen(bisher.items, bisher.ki, mehr));
  if (gemeinsam && sachen) {
    // Erst auf dem Gerät merken (lokalLoeschen räumt gleich die Liste weg), dann umziehen, sobald die Liste gelesen ist –
    // dazu, was von einem früheren Versuch noch wartet
    const rest = { inventar: lese(UMZUG_REST, null) };
    inventarZusammen(rest, sachen);
    schreibe(UMZUG_REST, rest.inventar);
    umzugMelden = true;
    umzugZuletzt = { at: 0, abdruck: '' };
  }
  lokalLoeschen();
}

app.trennen = () => {
  // Gemerkt, damit der Hinweis über der Liste sagen kann, dass dieses Gerät schon verbunden war
  try { localStorage.setItem(GETRENNT, JSON.stringify({ at: new Date().toISOString(), name: app.zugang?.name || '' })); } catch { /* egal */ }
  loescheZugang();
  githubVergessen();
  // Auch Amys Sachen auf diesem Gerät (die Sachen-App teilt hier den Speicher) – was nur auf dem Gerät auf den Umzug wartet, bleibt
  for (const k of Object.values(ART_SACHEN.speicher)) { try { localStorage.removeItem(k); } catch { /* egal */ } }
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
  if (klickIphone(el)) return;
  if (klickPush(el)) return;
  if (klickTodo(el)) return;
  if (klickBildschirmzeit(el)) return;
  if (klickEinstellungen(el)) return;
  if (klickWillkommen(el)) return;
  if (klickBoxen(el)) return;
  if (klickGaeste(el)) return;
  if (klickSachenApp(el)) return;
  if (klickZiel(el)) return;
  if (klickSpeisekarte(el)) return;
  if (klickHaushalt(el)) return;
  if (klickPlan(el)) return;
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
  if (ev.key === 'Enter' && !ev.isComposing && tastePlan(ev.target)) ev.preventDefault();
  // Enter in einer Aufgabe des Putzplans: die nächste Zeile, nicht speichern
  if (ev.key === 'Enter' && !ev.isComposing && tasteHaushalt(ev.target)) ev.preventDefault();
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (eingabeZiel(t) || eingabeWillkommen(t) || eingabeGaeste(t) || eingabeSpeisekarte(t) || eingabeZugang(t)) return;
  if (!eingabeAmy(t) && !eingabePlan(t) && !eingabeAnpassen(t) && !eingabeKi(t) && !eingabeAngebote(t)) eingabeRezepte(t);
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
  breiteAnwenden(); // falls index.html es nicht schon gesetzt hat
  // Kosten an „Frag mal“ melden – nur in der echten App, nicht in den Tests
  if (location.hostname === 'finanzdienste.github.io') kostenMeldenAn(KOSTEN_MELDEN);
  // Kein Guthaben bei Anthropic: der Gemini-Schlüssel springt ein (Einstellungen → KI-Schlüssel)
  kiErsatzAn(ladeKiErsatz, { beiWechsel: () => melde('Claude-Guthaben leer – Gemini springt ein (eine Stunde lang).') });
  let daten;
  // Die Fotos der gewünschten und Amys Rezepte (werkzeug/eigene-fotos.mjs) – nebenher; ohne sie gibt es die Bildchen
  const fotos = fetch('daten/fotos.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
  const f = await fotos;
  app.fotos = f?.fotos && typeof f.fotos === 'object' && !Array.isArray(f.fotos) ? f.fotos : {};
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

  /*
   * Ab hier jeder Teil für sich (sicher): Hakt einer, laufen die anderen
   * weiter – vor allem der Abgleich unten. Sonst blieb oben „Nur lokal“
   * stehen, und nichts kam bei den anderen an. Was hakte, steht unter
   * Einstellungen → Über die App.
   */
  let hash = '';
  try { hash = decodeURIComponent((location.hash || '').slice(1)); } catch { /* kaputte Adresse */ }
  const kiLink = sicher('KI-Link', kiAusAdresse, null);
  if (kiLink) sicher('KI-Link', () => speichereKi(kiLink));
  const link = sicher('Link', linkAusAdresse, null) || {};
  const ausLink = link.token;
  // Ziel, Farbe und Namen der Liste schon vor dem ersten Zeichnen – wie das Gerät sie zuletzt kannte
  app.zugang = ladeZugang();
  // Die Gäste vom alten Handy (…#gaeste=…): in den Einstellungen einmal nachfragen
  const gaesteLink = sicher('Gäste-Link', gaesteAusAdresse, null);
  // Der gemeinsame Katalog: was das Gerät zuletzt kannte, gleich mit den Rezepten
  sicher('Katalog', katalogStart);
  sicher('KI-Schlüssel', geteiltenKiHolen);
  sicher('Profil', () => {
    app.stand = { ...app.stand, profil: bekanntesProfil(app.zugang ? ortVon(app.zugang) : null) };
    zielAnwenden();
    profilAnwenden();
    eyebrowZeichnen();
  });
  // Eine Einladung (…&fuer=Marielle, …&fuer=Amy) auf einem Gerät ohne Liste: gleich verbinden, das Willkommen erklärt den Rest.
  // War hier zuletzt jemand anderes verbunden (getrennt), lieber das Formular mit dem bisherigen Namen.
  const einladung = !!ausLink && !app.zugang && !!link.fuer && !sicher('Getrennt', () => anderesGeraet(link.fuer), '');
  // iPhone/iPad: Der Link verbindet Safari (oder Safari war schon verbunden) – danach sagt ein Popup, was die App vom
  // Home-Bildschirm noch braucht (ansicht-iphone.js); das iPad-Popup wartet so lange
  if (einladung || (ausLink && ausLink === app.zugang?.token)) sicher('iPhone', safariVormerken);
  if (link.farbe && (einladung || (ausLink && ausLink === app.zugang?.token))) sicher('Farbe', () => farbeSetzen(link.farbe === 'blau' ? '' : link.farbe));
  sicher('Resteverwertung', kiStart);
  sicher('Anpassen', anpassenStart);
  sicher('Lob', lobStart);
  sicher('Timer', () => timerAnmelden(() => {
    const leiste = $('#timerleiste');
    const html = leisteHTML();
    if (leiste.innerHTML !== html) leiste.innerHTML = html;
    leiste.hidden = !html;
    timerZeichnen();
    amyTimerZeichnen();
    kochmodusTimerZeichnen();
  }));
  sicher('Kochstand', kochstandStart);
  sicher('Kochmodus', kochmodusAnmelden);
  sicher('Waage', waageStart);
  sicher('Push', pushAnmelden);
  sicher('Filter', filterZeichnen);
  sicher('Rezepte', rasterZeichnen);
  sicher('Liste', listeZeichnen);
  sicher('Angebote', angeboteZeichnen);
  sicher('Amy', amyStart);
  sicher('Haushalt', haushaltStart);
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
  if (hash === 'plan') ansicht.tab = 'plan';
  if (hash === 'vorschlaege') ansicht.tab = 'amy';
  if (gaesteLink) ansicht.tab = 'einstellungen';
  sicher('Reiter', () => zeigeReiter(ansicht.tab, true));
  // Welche Reiter unten stehen – stand der gemerkte auf einem ausgeblendeten, zum ersten sichtbaren
  sicher('Einstellungen', () => einstellungenStart({ wechseln: !hash && !ausLink }));
  if (gaesteLink) window.requestAnimationFrame(() => $('#e-gaeste-karte')?.scrollIntoView({ block: 'center' }));
  const rezept = app.nachId[hash] ? hash : (app.nachId[ansicht.rezept] ? ansicht.rezept : null);
  if (hash === 'reste' || (kiLink && !ausLink)) sicher('Resteverwertung', () => kiStart({ oeffnen: true }));
  else if (rezept) sicher('Rezept', () => oeffneRezept(rezept, { still: true }));
  // Aus der Push-Nachricht „Vorschlag von Amy“: gleich die Vorschläge
  if (hash === 'vorschlaege') sicher('Vorschläge', () => app.amyTeilZeigen?.('wuensche'));
  if (kiLink && !einladung) melde('KI-Schlüssel übernommen – die Resteverwertung ist bereit.');

  // Der Abgleich startet auf jeden Fall
  if (app.zugang) {
    // Gemeinsame Liste: Löschungen der Sachen, die eine ältere Fassung noch nicht abgeschickt hat, auch für sachen.json
    if (!eigeneListe(app.zugang)) sicher('Umzug der Sachen', loeschungenVormerken);
    nimmSpeicher(speicherFuer(app.zugang));
    // Hat die Sachen-App verbunden (gleicher Speicher), steht hier vielleicht noch eine lokale Liste – jetzt übernehmen
    sicher('Lokale Liste', () => { const l = lokalerStand(); if (Object.keys(l.items || {}).length || Object.keys(l.ki || {}).length || ['amy', 'gemeint', 'notizbuch', 'vertraeglich', 'wuensche', 'speisekammer'].some((k) => Object.keys(l[k] || {}).length) || Object.keys(l.essensplan?.tage || {}).length || hatInventar(l.inventar)) lokalUebernehmen(l); });
  } else nimmSpeicher(lokal());
  sicher('Angebote (privat)', privateAngebote);
  sicher('Katalog', () => katalogLaden({ abgleich: true }));

  if (einladung) {
    app.verbinden(ausLink, link.fuer, { daten: link.daten, farbe: link.farbe }).then((e) => {
      zugangZeichnen();
      if (e === 'ok') { sicher('iPhone', safariHinweis); return; }
      formularMitSchluessel(ausLink, link);
      zeigeReiter('einstellungen');
      melde(e === 'falsch' ? 'Der Schlüssel aus dem Link geht nicht – frag nach einem neuen Link.' : 'Gerade keine Verbindung – der Link ist eingetragen, tipp gleich auf „Verbinden“.');
    });
  } else if (ausLink && ausLink !== app.zugang?.token) sicher('Link', () => formularMitSchluessel(ausLink, link));
  else {
    sicher('Zugang', zugangZeichnen);
    // Safari war mit dem Link schon verbunden – die App vom Home-Bildschirm vielleicht noch nicht
    if (ausLink) setTimeout(() => sicher('iPhone', safariHinweis), 900);
  }
  // Die App vom Home-Bildschirm ohne Liste: gleich nach dem Link fragen
  sicher('iPhone', einfuegenPruefen);
  sicher('Wege', wegPruefen);
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
    else if (schritt && app.nachId[ziel]) { zeigeReiter('rezepte'); zuSchritt(ziel, Number(schritt)); } else if (app.nachId[ziel]) { zeigeReiter('rezepte'); oeffneRezept(ziel); } else if (ziel === 'vorschlaege') app.amyTeilZeigen?.('wuensche'); else zeigeReiter(['einkauf', 'angebote', 'amy', 'haushalt', 'plan'].includes(ziel) ? ziel : 'rezepte');
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
