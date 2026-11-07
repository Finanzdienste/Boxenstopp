/*
 * Wiegen mit der Küchenwaage – ohne DOM, damit die Tests es direkt prüfen.
 *
 * Die Waage (werkzeug/waage, ein ESP32 mit Wägezelle) schickt nur Gramm
 * (waage.js). Alles andere passiert hier: Welcher Schritt eines Rezepts
 * gewogen wird (wiegeplan), wann ein Wert „steht“ (Stabilität) und der
 * Ablauf im Schritt (Wiegung): Tara beim Anfang, mitzählen, was in die
 * Schale kommt, fertig melden, wenn das Ziel erreicht ist, „zu viel“ sagen,
 * „Nehmen wir so“ annehmen – und beim Portionieren Box für Box.
 *
 *   zutat     „3 Paprika (450 g) … → Schale 3“, „{tomatenmark} Tomatenmark
 *             abwiegen → Schale 2“: Ziel in Gramm, Bildchen der Zutat.
 *             Beim Schälen und Entkernen bleibt weniger übrig, dann gilt
 *             „ca.“ (70–112 %), sonst ± 2 % (mindestens ± 4 g).
 *   leer      „Den Topf leer wiegen …“ – der Wert kommt in den Rechner.
 *   voll      „Den Topf mit dem Essen wiegen …“ – genauso.
 *   boxen     „8 Boxen nacheinander auf die Waage stellen …“: Box für Box
 *             bis zur Menge aus dem Rechner – mit der Box auf der Waage
 *             (zählt hoch) oder mit dem Topf auf der Waage (zählt herunter).
 *   anzeige   „… auf die Waage, Tara drücken … durch 8 teilen“: nur das
 *             Gewicht und die Rechnung.
 *
 * Gewürze (EL, TL), Dosen, Milliliter und Stück ohne Gramm werden nicht
 * gewogen; Schritte mit zwei Mengen (Feta und Oliven) auch nicht.
 */
import { platzhalter } from './format.js';
import { bildName } from './bilder.js';
import { zahlLesen } from './boxen.js';

/** So lange muss ein Wert im Ziel stehen, bis der Schritt fertig ist. */
export const FERTIG_MS = 1500;
/** Ein Wert steht, wenn er sich so lange um höchstens so viel bewegt. */
const RUHE_MS = 1000;
const RUHE_G = 2;
/** Nach so viel Stillstand ohne Nachricht gilt die Waage als weg (waage.js meldet das). */
export const STILL_MS = 40000;

// Tausender mit Punkt („1.275 g“), Dezimalstellen mit Komma oder Punkt („1,5 kg“, „35.0 g“)
const GRAMM = /(?<![\w,.])(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s?(kg|g)(?![\wäöüß])/g;
const DAVON = /davon\s+(\d+(?:[.,]\d+)?)\s?g/i;
const CA = /schälen|entkernen|putzen|Strunk|Kerngehäuse|abziehen|häuten|parieren|entfernen|ausdrücken|entstielen/i;
const istZahl = (x) => typeof x === 'number' && Number.isFinite(x);
const zahl = (t) => zahlLesen(t);
const rund = (x) => Math.round(x);

/** Wie viel Gramm im Text stehen – als Liste (kg umgerechnet). */
export function grammIm(text) {
  const aus = [];
  for (const m of String(text || '').matchAll(GRAMM)) {
    const z = zahl(m[1]);
    if (Number.isFinite(z)) aus.push(m[2] === 'kg' ? z * 1000 : z);
  }
  return aus;
}

/** Der kurze Name einer Zutat: „Rinderhackfleisch (max. 20 % Fett)“ → „Rinderhackfleisch“. */
const kurzName = (n) => String(n || '').replace(/\s*\(.*$/, '').trim();

/** Die Zutat des Rezepts, die im Text vorkommt – über den Wortstamm des Namens („Zwiebeln“ passt auf „3 Zwiebeln“). */
function zutatImText(text, items) {
  const t = String(text || '').toLowerCase();
  let beste = null;
  for (const it of items || []) {
    const name = kurzName(it.n).toLowerCase();
    const stamm = name.split(/[\s,-]/)[0];
    if (stamm.length < 4) continue;
    const such = stamm.slice(0, Math.max(4, stamm.length - 2));
    if (t.includes(such) && (!beste || such.length > beste.such.length)) beste = { it, such };
  }
  return beste?.it || null;
}

/** Ein Name aus dem Text, wenn keine Zutat passt: das Wort vor „(450 g)“ oder nach „600 g“. */
function nameAusText(text) {
  const vor = /(\p{Lu}[\p{L}-]{2,})\s*\(\s*\d/u.exec(text);
  if (vor) return vor[1];
  const nach = /\d+(?:[.,]\d+)?\s?(?:kg|g)\s+(?:vom\s+|von\s+)?(\p{Lu}[\p{L}-]{2,})/u.exec(text);
  return nach ? nach[1] : 'Zutat';
}

/** Toleranz: ca. beim Schälen (70–112 %), sonst ± 2 %, mindestens ± 4 g. */
export function toleranz(ziel, ca) {
  if (ca) return [rund(ziel * 0.7), rund(ziel * 1.12)];
  const t = Math.max(4, rund(ziel * 0.02));
  return [ziel - t, ziel + t];
}

/**
 * Welcher Schritt gewogen wird. s: der Schritt ({ d, liste … }), r: das
 * Rezept (auf Ziel und Boxen gerechnet), phase: der Titel des Abschnitts,
 * boxen: für wie viele Boxen gekocht wird. Gibt null zurück, wenn die Waage
 * hier nichts zu tun hat.
 */
export function wiegeplan(s, r, { phase = '', boxen = 8 } = {}) {
  const roh = String(s?.d || '');
  if (!roh) return null;
  if (/leer wiegen|Gefäß leer/i.test(roh)) return { art: 'leer' };
  if (/mit dem Essen wiegen|Mit Essen/i.test(roh)) return { art: 'voll' };
  if (/auf die Waage/i.test(roh)) {
    if (/durch \d+ teilen/i.test(roh)) return { art: 'anzeige', n: boxen };
    return { art: 'boxen', n: boxen };
  }
  // Zutaten nur beim Vorbereiten – im Topf wird nicht mehr gewogen
  if (phase && !/vorbereit/i.test(phase)) return null;
  if (!/→|wiegen/i.test(roh)) return null;
  const items = r?.items || [];
  const schluessel = [...roh.matchAll(/\{([A-Za-z0-9_.-]{1,60})\}/g)].map((m) => m[1]);
  const gramm = schluessel.map((k) => items.find((x) => x.k === k || x.id === k)).filter((it) => it && it.u === 'g' && istZahl(it.q));
  const text = platzhalter(roh, items, r?.weg || {});
  const imText = grammIm(text);
  let ziel = null;
  let it = null;
  if (gramm.length === 1) { it = gramm[0]; ziel = it.q; } else if (gramm.length === 0 && imText.length === 1) { ziel = imText[0]; it = zutatImText(text, items); } else return null;
  // „30 g Ingwer schälen, davon 10 g fein reiben“: in die Schale kommen die 10 g
  const davon = DAVON.exec(text);
  if (davon) ziel = zahl(davon[1]);
  if (!istZahl(ziel) || ziel < 5 || ziel > 15000) return null;
  const ca = CA.test(roh) && !davon;
  const [von, bis] = toleranz(ziel, ca);
  const schale = /Schale (\d+)/.exec(text);
  return {
    art: 'zutat',
    ziel,
    von,
    bis,
    ca,
    name: it ? kurzName(it.n) : nameAusText(text),
    bild: bildName(it?.k || '', { name: it ? kurzName(it.n) : nameAusText(text) }),
    k: it?.k || '',
    schale: schale ? Number(schale[1]) : 0,
  };
}

/* ------------------------------------------------------------ Stabilität */

/** Die letzten Werte: steht die Waage? */
export class Ruhe {
  constructor() { this.werte = []; }
  dazu(g, at) {
    this.werte.push([g, at]);
    while (this.werte.length && at - this.werte[0][1] > RUHE_MS * 2) this.werte.shift();
  }
  /** true, wenn die letzten RUHE_MS Millisekunden um höchstens RUHE_G geschwankt haben. */
  steht(at) {
    const jung = this.werte.filter(([, t]) => at - t <= RUHE_MS);
    if (jung.length < 3 || at - jung[0][1] < RUHE_MS * 0.6) return false;
    let min = Infinity;
    let max = -Infinity;
    for (const [g] of jung) { if (g < min) min = g; if (g > max) max = g; }
    return max - min <= RUHE_G;
  }
  mittel(at) {
    const jung = this.werte.filter(([, t]) => at - t <= RUHE_MS);
    if (!jung.length) return null;
    return jung.reduce((s, [g]) => s + g, 0) / jung.length;
  }
}

/* ---------------------------------------------------------------- Ablauf */

/**
 * Eine Wiegung zu einem Plan. lesen({ g, at }) nimmt jeden Wert der Waage und
 * gibt den Stand zurück; tara() setzt den Nullpunkt neu, so() nimmt die
 * Menge, wie sie ist („Nehmen wir so“). mehr: { proBox, leer, n } fürs
 * Portionieren.
 *
 * Stand (je nach Art):
 *   zutat    { ist, ziel, von, bis, anteil, steht, fertig, zuViel, hinweis }
 *   leer/voll { ist, steht, bereit }
 *   boxen    { box, n, proBox, ist, von, bis, steht, fertig, zuViel, boxen: [g…], modus, warten }
 *   anzeige  { ist, steht, proBox }
 */
export class Wiegung {
  constructor(plan, mehr = {}) {
    this.plan = plan;
    this.mehr = mehr;
    this.ruhe = new Ruhe();
    this.roh = null; // letzter Wert der Waage
    this.tara0 = null; // Nullpunkt (null: noch nicht gesetzt)
    this.seit = null; // seit wann der Wert im Ziel steht
    this.vorher = null; // der letzte stehende Wert (für die Schale, die zu spät draufkommt)
    this.hinweis = '';
    this.frage = false; // „Schale draufgestellt?“ – ein Sprung, der Schale oder Zutat sein kann
    this.frageIst = 0;
    this.fertig = false;
    this.angenommen = null; // „Nehmen wir so“: die Menge
    // Portionieren
    this.boxen = [];
    this.modus = null; // 'topf' | 'box'
    this.start = null; // topf: das Gewicht, als die Box begann; box: das Leergewicht der Box
    this.warten = plan?.art === 'boxen' ? 'box' : null; // box: auf die nächste Box, weg: bis sie runter ist
    this.stand = this.standVon(null, 0, false);
  }

  get ist() {
    if (this.roh === null) return 0;
    if (this.plan.art === 'zutat') return this.tara0 === null ? 0 : this.roh - this.tara0;
    return this.roh;
  }

  /** Der Nullpunkt ist jetzt: Was auf der Waage liegt, zählt nicht mit. */
  tara() {
    if (this.roh === null) return;
    this.tara0 = this.roh;
    this.vorher = this.roh;
    this.seit = null;
    this.hinweis = '';
    this.frage = false;
    this.fertig = false;
    this.stand = this.standVon(this.roh, this.stand.at || 0, this.stand.steht);
  }

  /** „Nehmen wir so“ – bei einer Zutat die Menge, beim Portionieren die laufende Box. */
  so() {
    let g = rund(this.ist);
    if (this.plan.art === 'zutat') {
      this.angenommen = Math.max(0, g);
      this.frage = false;
      this.fertig = true;
      g = this.angenommen;
    } else if (this.plan.art === 'boxen') {
      g = Math.max(0, rund(this.gefuellt()));
      this.boxFertig(g);
    }
    this.stand = this.standVon(this.roh, this.stand.at || 0, this.stand.steht);
    return g;
  }

  /** Beim Portionieren: wie viel in der laufenden Box ist. */
  gefuellt() {
    if (this.roh === null || this.start === null) return 0;
    return this.modus === 'topf' ? this.start - this.roh : this.roh - this.start;
  }

  boxFertig(g) {
    this.boxen.push(g);
    this.seit = null;
    if (this.boxen.length >= this.plan.n) { this.fertig = true; this.warten = null; return; }
    if (this.modus === 'topf') this.start = this.roh;
    else { this.warten = 'weg'; this.start = null; }
  }

  lesen({ g, at = Date.now() }) {
    if (!istZahl(g)) return this.stand;
    this.roh = g;
    this.ruhe.dazu(g, at);
    const steht = this.ruhe.steht(at);
    const art = this.plan.art;
    if (art === 'zutat') this.zutat(g, at, steht);
    else if (art === 'boxen') this.portion(g, at, steht);
    this.stand = this.standVon(g, at, steht);
    return this.stand;
  }

  zutat(g, at, steht) {
    const { von, bis } = this.plan;
    if (this.fertig) return;
    if (this.tara0 === null) {
      // Der erste stehende Wert ist der Nullpunkt – die Schale (oder nichts) steht schon drauf
      if (steht) { this.tara0 = this.ruhe.mittel(at); this.vorher = this.tara0; }
      return;
    }
    if (!steht) { this.seit = null; return; }
    const ist = g - this.tara0;
    const vorherIst = this.vorher - this.tara0;
    const sprung = g - this.vorher;
    this.vorher = g;
    // Eine Schale, die erst jetzt draufkommt (vorher war nichts drin): weit über dem Ziel ist es sicher eine –
    // sonst könnte es auch die Zutat auf einmal sein, dann fragt der Kochmodus nach („Schale draufgestellt? → Tara“)
    if (vorherIst < 15 && sprung >= 100) {
      if (ist > bis * 1.3) {
        this.tara0 = g;
        this.hinweis = 'Schale erkannt – ab jetzt zählt, was reinkommt';
        this.frage = false;
        this.seit = null;
        return;
      }
      // Genau die Menge einer Packung (Hack, Nudeln) ist keine Schale; beim Schälen und Schnippeln kommt nichts auf einmal
      if (this.plan.ca || ist < von || ist > bis) { this.frage = true; this.frageIst = ist; }
    } else if (this.frage && ist > this.frageIst + 15) this.frage = false;
    if (ist >= von && ist <= bis) {
      if (this.seit === null) this.seit = at;
      // Mit offener Frage länger warten, damit noch Zeit für Tara bleibt
      if (at - this.seit >= (this.frage ? FERTIG_MS * 4 : FERTIG_MS)) { this.fertig = true; this.angenommen = rund(ist); }
    } else this.seit = null;
  }

  portion(g, at, steht) {
    if (this.fertig) return;
    const { proBox } = this.mehr;
    if (!istZahl(proBox) || proBox <= 0) return;
    const [von, bis] = toleranz(proBox, false);
    if (this.modus === null) {
      // Steht der Topf auf der Waage (viel mehr als eine Box) oder eine leere Box?
      if (!steht) return;
      if (g >= proBox * 1.5) { this.modus = 'topf'; this.start = g; this.warten = null; } else { this.modus = 'box'; this.warten = g >= 15 ? null : 'box'; this.start = g >= 15 ? g : null; }
      return;
    }
    if (this.modus === 'box') {
      if (this.warten === 'weg') { if (g < 15) this.warten = 'box'; return; }
      if (this.warten === 'box') { if (steht && g >= 15) { this.warten = null; this.start = g; } return; }
    }
    const ist = this.gefuellt();
    const letzte = this.boxen.length === this.plan.n - 1;
    // Die letzte Box bekommt den Rest: Beim Topf, bis er leer ist (Leergewicht aus dem Rechner)
    const ziel = letzte && this.modus === 'topf' && istZahl(this.mehr.leer) && this.start - this.mehr.leer > 0 ? [this.start - this.mehr.leer - Math.max(4, rund(proBox * 0.02)), Infinity] : [von, bis];
    if (steht && ist >= ziel[0] && ist <= ziel[1]) {
      if (this.seit === null) this.seit = at;
      if (at - this.seit >= FERTIG_MS) this.boxFertig(rund(ist));
    } else this.seit = null;
  }

  standVon(g, at, steht) {
    const p = this.plan;
    const basis = { art: p.art, at, steht, roh: g === null ? null : rund(g), da: g !== null };
    if (p.art === 'zutat') {
      const ist = g === null || this.tara0 === null ? 0 : rund(g - this.tara0);
      return { ...basis, ist, ziel: p.ziel, von: p.von, bis: p.bis, ca: p.ca, anteil: Math.max(0, Math.min(1, ist / p.ziel)), fertig: this.fertig, angenommen: this.angenommen, zuViel: !this.fertig && ist > p.bis ? ist - p.ziel : 0, fehlt: this.fertig ? 0 : Math.max(0, p.ziel - ist), tara: this.tara0 !== null, hinweis: this.hinweis, frage: this.frage && !this.fertig };
    }
    if (p.art === 'leer' || p.art === 'voll') {
      const ist = g === null ? 0 : rund(g);
      return { ...basis, ist, bereit: !!steht && ist >= (p.art === 'leer' ? 100 : 300) };
    }
    if (p.art === 'boxen') {
      const proBox = istZahl(this.mehr.proBox) ? rund(this.mehr.proBox) : 0;
      const [von, bis] = proBox ? toleranz(proBox, false) : [0, 0];
      const ist = Math.max(0, rund(this.gefuellt()));
      const laeuft = this.modus !== null && this.warten === null && !this.fertig;
      return { ...basis, box: Math.min(p.n, this.boxen.length + 1), n: p.n, proBox, ist: laeuft ? ist : 0, von, bis, anteil: proBox && laeuft ? Math.max(0, Math.min(1, ist / proBox)) : 0, fertig: this.fertig, zuViel: laeuft && ist > bis ? ist - proBox : 0, fehlt: laeuft ? Math.max(0, proBox - ist) : proBox, boxen: [...this.boxen], modus: this.modus, warten: this.warten };
    }
    const ist = g === null ? 0 : rund(g);
    return { ...basis, ist, proBox: p.n ? rund(ist / p.n) : ist };
  }
}

/* ------------------------------------------------------- Gewogene Mengen */

/**
 * Die Nährwerte fürs ganze Rezept mit dem, was wirklich gewogen wurde
 * (gewogen: { <k>: g }): vom Gesamt die Differenz je Zutat (pro 100 g).
 * Gibt { kcal, p, kh, f } für alle Boxen zurück.
 */
export function naehrwerteGewogen(r, gewogen = {}) {
  const t = Array.isArray(r?.total) ? r.total : [0, 0, 0, 0];
  const aus = { kcal: t[0], p: t[1], kh: t[2], f: t[3] };
  for (const it of r?.items || []) {
    const g = gewogen[it.k];
    if (!it.k || !istZahl(g) || !it.pro100 || !istZahl(it.g)) continue;
    const d = (g - it.g) / 100;
    aus.kcal += (it.pro100.kcal || 0) * d;
    aus.p += (it.pro100.p || 0) * d;
    aus.kh += (it.pro100.kh || 0) * d;
    aus.f += (it.pro100.f || 0) * d;
  }
  return aus;
}

/** Die Nährwerte je Box nach den gewogenen Boxen (boxen: [g…]) – jede Box ihren Anteil am Ganzen. */
export function boxenNaehrwerte(gesamt, boxen = []) {
  const summe = boxen.reduce((s, g) => s + (istZahl(g) ? g : 0), 0);
  if (!summe) return [];
  return boxen.map((g) => {
    const a = g / summe;
    return { g, kcal: rund(gesamt.kcal * a), p: Math.round(gesamt.p * a * 10) / 10, kh: Math.round(gesamt.kh * a * 10) / 10, f: Math.round(gesamt.f * a * 10) / 10 };
  });
}
