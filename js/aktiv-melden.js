/*
 * Wer in Boxenstopp etwas tut – für Tobis Übersicht „Meine Apps“
 * (https://finanzdienste.github.io/Apps/, Repo Finanzdienste/Apps).
 *
 * Tobi, 26.11.2026: „Boxenstopp soll natürlich auch marielle und Amy melden“.
 *
 * Neu erhoben wird dafür nichts: Das Dashboard (Einstellungen → Gäste &
 * Überblick) liest schon aus den Commits der Listen, wer wann was ändert –
 * Amy und den Gästen hat die App das einmal gesagt („Tobi hat jetzt ein
 * Dashboard … wann du was änderst“, ansicht-gaeste.js DASH_HINWEIS). Von dort
 * geht nur die Zahl der Änderungen je Person und Tag an Tobis Supabase-Projekt
 * (boxenstopp_aktiv_melden, SQL im Repo Apps: tools/apps-uebersicht.sql) –
 * nie, was geändert wurde.
 *
 * Nur auf Tobis Gerät (eure Liste, Name „Tobi“): Auf Amys oder einem Gast-
 * Gerät schickt diese Datei nichts. Höchstens stündlich, und nur, wenn sich
 * seit dem letzten Mal etwas geändert hat. Ohne Netz bleibt alles, wie es
 * war; beim nächsten Start, bei „online“ oder beim Zurückkommen geht es.
 * Eine Liste, deren Verlauf gerade nicht kam, wird nicht gemeldet – so
 * leert ein Fehler nie ihre Tage in der Übersicht.
 */
import { app, lese, schreibe } from './kern.js';
import { istEigen } from './profil.js';
import { aktivitaetFuerUebersicht } from './ansicht-gaeste.js';
import { listeVon, zeilenFuerUebersicht } from './gaeste.js';

export const ADRESSE = 'https://vjyohppohmvhhxgwouti.supabase.co/rest/v1/rpc/boxenstopp_aktiv_melden';
// Der öffentliche Schlüssel des Projekts (wie in bildschirmzeit.js): Er erlaubt nur, was die Funktionen zulassen.
const OEFFENTLICH = 'sb_publishable_wTUNShIKMFjCOmZzQuuN-A_vFHPkKUI';
const ZULETZT = 'boxenstopp.aktivgemeldet.v1';
export const ABSTAND = 60 * 60 * 1000;
export const TAGE = 31;

/** Meldet dieses Gerät? Nur Tobi, in eurer Liste. */
export function meldetHier(zugang = app.zugang, eigen = istEigen()) {
  return !!zugang?.token && !eigen && /^tobi$/i.test(String(zugang.name || '').trim());
}

let laeuft = null;

/** Schickt die Tage, wenn es dran ist. Wirft nie; läuft schon eins, wartet es auf dieses. */
export function aktivMelden(optionen = {}) {
  if (!laeuft) laeuft = melden(optionen).finally(() => { laeuft = null; });
  return laeuft;
}

async function melden({ jetzt = Date.now(), holen = (...a) => fetch(...a) } = {}) {
  try {
    if (!meldetHier() || !navigator.onLine) return false;
    const alt = lese(ZULETZT, null);
    if (alt && Number.isFinite(alt.um) && jetzt - alt.um < ABSTAND) return false;
    const { ls, z, fehler } = await aktivitaetFuerUebersicht(TAGE);
    const gut = ls.filter((l) => !fehler[l.id]);
    if (!gut.length || !z.tage?.length) return false;
    const body = { p_von: z.tage[0], p_listen: gut.map(listeVon), p_tage: zeilenFuerUebersicht(z, gut) };
    const fingerabdruck = JSON.stringify(body);
    if (alt && alt.fp === fingerabdruck) {
      schreibe(ZULETZT, { ...alt, um: jetzt });
      return false;
    }
    const res = await holen(ADRESSE, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: OEFFENTLICH },
      body: fingerabdruck,
    });
    if (res.ok) schreibe(ZULETZT, { um: jetzt, fp: fingerabdruck });
    return res.ok;
  } catch {
    return false;
  }
}
