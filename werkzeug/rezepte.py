"""
Die Rezepte von Boxenstopp – und daraus daten/rezepte.json.

    python3 werkzeug/rezepte.py

Jedes Rezept ergibt 8 Boxen. Ziel pro Box: 443 kcal, 33 g Protein, 39 g KH,
15,4 g Fett (ZIEL). Für die ersten Rezepte stehen die Nährwertzeilen fest in
`nut` (so wurden sie damals einzeln gerechnet); alle anderen rechnet
`nutrows` aus den Werten pro 100 g in naehrwerte.py.

Mengen immer in Supermarkt-Packungen denken: 400 g Hähnchen, 500 g Hack,
Dosen, Becher. Kein Fisch, kein Schwein, kein Putenhack. Wer ein Rezept
ändert, lässt das Skript laufen und schaut in die Tabelle am Ende: kcal, P,
KH, F pro Box und die Zeiten. tests/test-rezepte.mjs prüft die Grenzen.

Zubereitung als Mise en place
-----------------------------
Jedes Rezept hat drei Abschnitte: Vorbereiten, Kochen, Portionieren.

- Vorbereiten: Alles wird geschnitten, abgewogen und abgemessen, bevor der
  Herd angeht – und landet in nummerierten Schalen („→ Schale 2“). Die
  Nummern folgen der Reihenfolge, in der die Schalen beim Kochen gebraucht
  werden. Fleisch kommt zuletzt aufs Brett, danach Brett und Messer abwaschen.
- Kochen: nur noch „Schale 2 dazu“. Was während einer langen Wartezeit
  nebenbei geht (Reis, Kartoffeln schälen, während das Gulasch schmort),
  steht als „währenddessen“ darunter.
- Ein Schritt ist eine Handlung, eine Zeile, abhakbar.

Zeiten: `min` ist die Zeit, die man in dem Schritt beschäftigt ist; `ruhe`
läuft danach im Hintergrund weiter (Marinieren, Ofen vorheizen, Reis
quellen), `neben` heißt: passiert in der Zeit des Schritts davor. Für das
Schneiden gelten die Normen in NORM – gemütliches Tempo zu Hause, mit
Waschen, Schälen und Abfall wegräumen. Lieber zu großzügig als zu knapp.

Katalog: jede Zutat der Einkaufsliste hat einen festen Schlüssel (CAT). Er
entscheidet, welche Rezepte sich auf der Liste eine Zeile teilen, und in
welcher Abteilung sie steht.
"""
import json, pathlib, re, sys
HIER = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))
from naehrwerte import N, T as ZIELWERTE

ZIEL = {'kcal': ZIELWERTE[0], 'p': ZIELWERTE[1], 'kh': ZIELWERTE[2], 'f': ZIELWERTE[3]}
# ---------------------------------------------------------------- Katalog (Einkaufsliste)
CAT = {
 # Fleisch & Geflügel
 'rinderhack': ('Rinderhackfleisch', 'fleisch'), 'rinderhack-mager': ('Rinderhackfleisch mager, max. 5 % Fett', 'fleisch'),
 'rindergulasch': ('Rindergulasch, mager', 'fleisch'), 'haehnchenbrust': ('Hähnchenbrustfilet', 'fleisch'),
 'haehnchenkeule': ('Hähnchen-Oberkeulenfilet', 'fleisch'), 'putenbrust': ('Putenbrust, geschnetzelt', 'fleisch'),
 'rinderhuefte': ('Rinderhüftsteak', 'fleisch'),
 # Obst & Gemüse
 'zwiebeln': ('Zwiebeln', 'obst'), 'rote-zwiebeln': ('Rote Zwiebeln', 'obst'), 'knoblauch': ('Knoblauch', 'obst'),
 'ingwer': ('Ingwer', 'obst'), 'paprika': ('Paprika', 'obst'), 'zucchini': ('Zucchini', 'obst'), 'brokkoli': ('Brokkoli', 'obst'),
 'moehren': ('Möhren', 'obst'), 'champignons': ('Champignons', 'obst'), 'spinat': ('Babyspinat', 'obst'),
 'zuckerschoten': ('Zuckerschoten', 'obst'), 'fruehlingszwiebeln': ('Frühlingszwiebeln', 'obst'), 'spitzkohl': ('Spitzkohl', 'obst'),
 'gurke': ('Salatgurke', 'obst'), 'tomaten': ('Tomaten', 'obst'), 'kirschtomaten': ('Kirschtomaten', 'obst'),
 'kartoffeln': ('Kartoffeln, festkochend', 'obst'), 'suesskartoffel': ('Süßkartoffeln', 'obst'),
 'staudensellerie': ('Staudensellerie', 'obst'), 'limette': ('Limetten', 'obst'), 'zitrone': ('Zitronen', 'obst'),
 'blumenkohl': ('Blumenkohl', 'obst'), 'bohnen-gruen': ('Grüne Bohnen', 'obst'), 'aubergine': ('Aubergine', 'obst'),
 'lauch': ('Lauch', 'obst'), 'kohlrabi': ('Kohlrabi', 'obst'), 'weisskohl': ('Weißkohl', 'obst'),
 'koriander': ('Koriander, frisch', 'obst'), 'basilikum': ('Basilikum, frisch', 'obst'), 'petersilie': ('Petersilie, frisch', 'obst'),
 'dill': ('Dill oder Minze, frisch', 'obst'),
 # Kühlregal & Käse
 'skyr': ('Skyr natur', 'kuehl'), 'magerquark': ('Magerquark', 'kuehl'),
 'frischkaese': ('Frischkäse leicht', 'kuehl'), 'kochsahne': ('Kochsahne 15 %', 'kuehl'), 'schlagsahne': ('Schlagsahne 30 %', 'kuehl'),
 'schmand': ('Schmand', 'kuehl'), 'milch': ('Milch 1,5 %', 'kuehl'), 'cheddar': ('Cheddar', 'kuehl'),
 'parmesan': ('Parmesan', 'kuehl'), 'feta': ('Feta', 'kuehl'),
 'gnocchi': ('Gnocchi', 'trocken'), 'butter': ('Butter', 'kuehl'),
 'mozzarella': ('Mozzarella', 'kuehl'), 'mozzarella-light': ('Mozzarella light', 'kuehl'), 'joghurt': ('Joghurt 1,5 %', 'kuehl'),
 'eier': ('Eier', 'kuehl'), 'tofu': ('Tofu natur', 'kuehl'),
 # Tiefkühl
 'tk-kraeuter': ('TK-Kräuter (8-Kräuter)', 'tk'), 'erbsen': ('TK-Erbsen', 'tk'), 'tk-brokkoli': ('TK-Brokkoli', 'tk'),
 'tk-blumenkohl': ('TK-Blumenkohl', 'tk'), 'tk-bohnen': ('TK-Bohnen, grün', 'tk'), 'tk-spinat': ('TK-Blattspinat', 'tk'),
 # Konserven & Gläser – in der App unter „Trockenes“
 'tomaten-dose': ('Stückige Tomaten, Dose à 400 g', 'konserven'), 'passata': ('Passierte Tomaten', 'konserven'),
 'tomatenmark': ('Tomatenmark', 'konserven'), 'kidney': ('Kidneybohnen, Dose à 400 g', 'konserven'),
 'schwarze-bohnen': ('Schwarze Bohnen, Dose à 400 g', 'konserven'), 'mais': ('Mais, Dose à 425 ml', 'konserven'),
 'kokosmilch': ('Kokosmilch, Dose à 400 ml', 'konserven'), 'kokosmilch-light': ('Kokosmilch light, Dose à 400 ml', 'konserven'),
 'currypaste': ('Rote Currypaste, vegan', 'konserven'),
 'ajvar': ('Ajvar, mild', 'konserven'), 'getr-tomaten': ('Getrocknete Tomaten in Öl', 'konserven'),
 'erdnussbutter': ('Erdnussbutter', 'konserven'), 'kichererbsen': ('Kichererbsen, Dose à 400 g', 'konserven'),
 'linsen-dose': ('Linsen, Dose à 400 g', 'konserven'), 'pesto': ('Pesto Genovese', 'konserven'),
 'ananas-dose': ('Ananas in Saft, Dose à 565 g', 'konserven'), 'gewuerzgurken': ('Gewürzgurken', 'konserven'),
 'oliven': ('Schwarze Oliven, entsteint', 'konserven'),
 # Nudeln, Reis & Co.
 'reis': ('Basmati- oder Jasminreis', 'trocken'), 'penne': ('Penne', 'trocken'), 'spaghetti': ('Spaghetti', 'trocken'),
 'hoernchen': ('Hörnchennudeln oder Makkaroni', 'trocken'), 'kritharaki': ('Kritharaki', 'trocken'),
 'lasagne': ('Lasagneplatten (ohne Vorkochen)', 'trocken'), 'mie': ('Mie-Nudeln', 'trocken'), 'sesam': ('Sesam', 'trocken'),
 'vollkornnudeln': ('Vollkornnudeln', 'trocken'), 'couscous': ('Couscous', 'trocken'), 'bulgur': ('Bulgur', 'trocken'),
 'linsen-rot': ('Rote Linsen', 'trocken'), 'bandnudeln': ('Bandnudeln', 'trocken'), 'tortillas': ('Weizentortillas, 8 Stück', 'trocken'),
 'erdnuesse': ('Erdnüsse, geröstet, ungesalzen', 'trocken'), 'semmelbroesel': ('Semmelbrösel', 'trocken'), 'mandeln': ('Mandeln, gehobelt', 'trocken'),
 'rosinen': ('Rosinen', 'trocken'), 'cashews': ('Cashewkerne', 'trocken'),
 # Vorrat (Öle, Saucen, Backzutaten) – in der App unter „Trockenes“
 'oel': ('Öl, neutral', 'vorrat'), 'olivenoel': ('Olivenöl', 'vorrat'), 'sesamoel': ('Sesamöl', 'vorrat'),
 'butterschmalz': ('Butterschmalz', 'vorrat'), 'honig': ('Honig', 'vorrat'), 'zucker': ('Zucker', 'vorrat'),
 'mehl': ('Weizenmehl', 'vorrat'),
 'sojasauce': ('Sojasauce', 'vorrat'), 'staerke': ('Speisestärke', 'vorrat'), 'bruehe-rind': ('Rinderbrühe', 'gewuerz'),
 'sweetchili': ('Sweet-Chili-Sauce', 'vorrat'), 'bbq-sauce': ('BBQ-Sauce', 'vorrat'), 'ketchup': ('Ketchup', 'vorrat'),
 'bruehe-gemuese': ('Gemüsebrühe', 'gewuerz'), 'bruehe-huhn': ('Hühnerbrühe', 'gewuerz'), 'senf': ('Senf, mittelscharf', 'vorrat'),
 'balsamico': ('Balsamico', 'vorrat'), 'essig': ('Reis- oder Apfelessig', 'vorrat'), 'kakao': ('Backkakao', 'vorrat'),
 'sriracha': ('Sriracha', 'vorrat'), 'kreuzkuemmel': ('Kreuzkümmel, gemahlen', 'gewuerz'),
 'paprika-edelsuess': ('Paprikapulver edelsüß', 'gewuerz'), 'paprika-geraeuchert': ('Paprikapulver geräuchert', 'gewuerz'),
 'paprika-rosenscharf': ('Paprikapulver rosenscharf', 'gewuerz'), 'oregano': ('Oregano, getrocknet', 'gewuerz'),
 'chiliflocken': ('Chiliflocken', 'gewuerz'), 'cayenne': ('Cayennepfeffer', 'gewuerz'), 'zimt': ('Zimt', 'gewuerz'),
 'lorbeer': ('Lorbeerblätter', 'gewuerz'), 'garam-masala': ('Garam Masala', 'gewuerz'), 'kurkuma': ('Kurkuma', 'gewuerz'),
 'chilipulver': ('Chilipulver', 'gewuerz'), 'kasuri-methi': ('Kasuri Methi (Bockshornkleeblätter)', 'gewuerz'),
 'kuemmel': ('Kümmel, gemahlen', 'gewuerz'), 'majoran': ('Majoran, getrocknet', 'gewuerz'),
 'ital-kraeuter': ('Italienische Kräuter', 'gewuerz'), 'knoblauchpulver': ('Knoblauchpulver', 'gewuerz'),
 'zwiebelpulver': ('Zwiebelgranulat', 'gewuerz'), 'muskat': ('Muskatnuss', 'gewuerz'), 'thymian': ('Thymian, getrocknet', 'gewuerz'),
 'rosmarin': ('Rosmarin, getrocknet', 'gewuerz'), 'basilikum-getr': ('Basilikum, getrocknet', 'gewuerz'),
 'koriander-gem': ('Koriander, gemahlen', 'gewuerz'), 'salz': ('Salz', 'gewuerz'), 'pfeffer': ('Pfeffer', 'gewuerz'),
 'currypulver': ('Currypulver', 'gewuerz'), 'cajun': ('Cajun-Gewürz', 'gewuerz'), 'ras-el-hanout': ('Ras el Hanout', 'gewuerz'),
 'piment': ('Piment, gemahlen', 'gewuerz'), 'dill-getr': ('Dill, getrocknet', 'gewuerz'), 'ingwer-gem': ('Ingwer, gemahlen', 'gewuerz'),
 'boxen': ('Meal-Prep-Boxen (8 Stück)', 'haushalt'), 'backpapier': ('Backpapier', 'haushalt'),
 'doeschen': ('Kleine Döschen mit Deckel', 'haushalt'),
 # Frühstück
 'haferflocken': ('Haferflocken', 'trocken'), 'erdnuss-crunch': ('Erdnuss-Crunch', 'trocken'),
 'aepfel': ('Äpfel', 'obst'), 'whey-vanille': ('Whey Vanille', 'trocken'),
}

# ---------------------------------------------------------------- Nährwerte je Zutat
# Schlüssel in naehrwerte.N, wo er anders heißt als im Katalog.
NK = {
 'tomaten-dose': 'tomatendose', 'schwarze-bohnen': 'schwarzebohnen', 'staudensellerie': 'sellerie', 'getr-tomaten': 'getrtomaten',
 'rote-zwiebeln': 'zwiebeln', 'kirschtomaten': 'tomaten', 'olivenoel': 'oel', 'sesamoel': 'oel',
 'bruehe-rind': 'bruehe', 'bruehe-gemuese': 'bruehe', 'bruehe-huhn': 'bruehe',
 'penne': 'nudeln', 'spaghetti': 'nudeln', 'hoernchen': 'nudeln', 'kritharaki': 'nudeln', 'lasagne': 'nudeln', 'vollkornnudeln': 'vollkornnudeln',
 'zitrone': 'limette', 'mozzarella-light': 'mozzalight', 'eier': 'ei', 'tk-brokkoli': 'brokkoli', 'tk-blumenkohl': 'blumenkohl',
 'tk-bohnen': 'bohnengruen', 'bohnen-gruen': 'bohnengruen', 'tk-spinat': 'spinat', 'linsen-dose': 'linsendose', 'linsen-rot': 'linsenrot',
 'whey-vanille': 'whey', 'erdnuss-crunch': 'erdnusscrunch',
 'ananas-dose': 'ananas', 'bbq-sauce': 'bbq', 'bandnudeln': 'nudeln', 'sweetchili': 'sweetchili', 'kokosmilch-light': 'kokosmilchlight',
}
# Gramm je Einheit für alles, was nicht in Gramm gekauft wird (Dose: abgetropft).
EINHEIT_G = {
 'kidney': ('Dose', 255), 'mais': ('Dose', 285), 'schwarze-bohnen': ('Dose', 240), 'tomaten-dose': ('Dose', 400), 'kokosmilch': ('Dose', 400),
 'kichererbsen': ('Dose', 240), 'linsen-dose': ('Dose', 240), 'kokosmilch-light': ('Dose', 400), 'ananas-dose': ('Dose', 340), 'tortillas': ('Pck', 320), 'lauch': ('Stange', 250),
 'paprika': ('Stk', 160), 'zucchini': ('Stk', 300), 'gurke': ('Stk', 300), 'limette': ('Stk', 30), 'zitrone': ('Stk', 30), 'eier': ('Stk', 60),
 'aubergine': ('Stk', 300), 'kohlrabi': ('Stk', 250), 'blumenkohl': ('Stk', 800),
 'knoblauch': ('Zehe', 4), 'fruehlingszwiebeln': ('Bund', 100), 'staudensellerie': ('Stange', 75),
 'getr-tomaten': ('Glas', 150), 'currypaste': ('Glas', 70), 'ajvar': ('Glas', 350), 'tk-kraeuter': ('Pck', 0),
}
# Was die App beim Anpassen verschieben darf, um die Werte zu treffen (N-Schlüssel):
# Proteine, Sättigungsbeilagen, Fette. Gemüse und Stückware bleiben, wie sie sind.
ANPASSBAR_MEHR = {'pesto', 'erdnuesse', 'cashews', 'tortillas', 'semmelbroesel', 'mandeln', 'oliven', 'sweetchili', 'bbq', 'ketchup', 'kokosmilchlight'}
ANPASSBAR = {
 'haehnchenbrust', 'haehnchenkeule', 'putenbrust', 'rinderhack', 'rinderhack-mager', 'rindergulasch', 'rinderhuefte', 'ei', 'tofu',
 'reis', 'nudeln', 'vollkornnudeln', 'mie', 'gnocchi', 'kartoffeln', 'suesskartoffel', 'couscous', 'bulgur', 'linsenrot', 'linsendose', 'kichererbsen', 'erbsen',
 'oel', 'butter', 'butterschmalz', 'cheddar', 'parmesan', 'feta', 'mozzarella', 'mozzalight', 'kochsahne', 'schlagsahne', 'schmand',
 'skyr', 'magerquark', 'frischkaese', 'joghurt', 'milch', 'erdnussbutter', 'honig', 'zucker', 'mehl', 'staerke', 'kokosmilch',
} | ANPASSBAR_MEHR
MENGE_RE = re.compile(r'(\d+(?:[.,]\d+)?)\s?(kg|g|ml|l)\b')

def nk_von(k): return NK.get(k, k)

def gramm_von(it):
    """Gramm (bzw. ml) der Zutat, so wie sie in die Nährwerte eingeht."""
    if it.get('g') is not None: return it['g'], it.get('gu') or ('ml' if it['u'] == 'ml' else 'g')
    if isinstance(it['q'], (int, float)):
        if it['u'] in ('g', 'ml'): return it['q'], it['u']
        if it['k'] in EINHEIT_G: return it['q'] * EINHEIT_G[it['k']][1], 'ml' if it['k'].startswith('kokosmilch') else 'g'
    m = MENGE_RE.search(it['a'] or '')
    if m:
        z = float(m.group(1).replace('.', '').replace(',', '.')) if m.group(2) in ('g', 'ml') else float(m.group(1).replace(',', '.')) * 1000
        return z, 'ml' if m.group(2) in ('ml', 'l') else 'g'
    return 0, 'g'

def I(name, amount, k=None, q=None, u=None, h='', pantry=False, opt=False, haus=False, g=None, fest=False):
    """g: Gramm für die Nährwerte, wenn sie nicht aus q/u folgen (Kartoffeln geschält, halbe Zitrone).
    fest: darf die App beim Anpassen nicht verschieben."""
    return {'n': name, 'a': amount, 'k': k, 'q': q, 'u': u, 'h': h, 'pantry': pantry, 'opt': opt, 'haus': haus, 'g': g, 'fest': fest}

# Haushalt: was ein Rezept an Verbrauchsmaterial braucht (Backpapier, Döschen …).
# Steht unter „Extras“ und kommt nur auf die Liste, wenn man es antippt.
def H(name, amount, k):
    return I(name, amount, k, haus=True)

def S(name, amount, k):
    return {'n': name, 'a': amount, 'k': k}

# ---------------------------------------------------------------- Zeiten
# Minuten zu Hause in ruhigem Tempo, mit Waschen, Schälen, Abfall wegräumen.
NORM = {
 'zwiebel-wuerfel': 3,     # je 100 g (1 mittlere Zwiebel): schälen, fein würfeln
 'zwiebel-streifen': 2,    # je 100 g: schälen, Streifen oder Spalten
 'knoblauch': 1,           # je Zehe: schälen, hacken, reiben oder pressen
 'ingwer': 3,              # je Stück bis 30 g: schälen, fein reiben
 'paprika-wuerfel': 3,     # je Schote: waschen, entkernen, 1-cm-Würfel
 'paprika-streifen': 2,    # je Schote: Streifen
 'paprika-stuecke': 1.5,   # je Schote: grobe Stücke
 'zucchini-wuerfel': 3,    # je Zucchini (300 g)
 'zucchini-scheiben': 2,   # je Zucchini: Scheiben oder Halbmonde
 'moehre-scheiben': 1.5,   # je Möhre (100 g): schälen, Scheiben
 'moehre-fein': 3,         # je Möhre: schälen, fein würfeln oder Stifte
 'sellerie-fein': 1.5,     # je Stange
 'brokkoli': 1,            # je 100 g: Röschen, Strunk schälen und würfeln
 'champignons': 1.5,       # je 100 g: putzen, Scheiben
 'spitzkohl': 1.25,        # je 100 g: feine Streifen
 'fruehlingszwiebeln': 3,  # je Bund: Ringe
 'kartoffel-schaelen': 1,  # je 100 g
 'kartoffel-wuerfel': 0.7, # je 100 g
 'kartoffel-waschen': 0.25,# je 100 g, mit Schale schrubben
 'suesskartoffel': 1.3,    # je 100 g: schälen, würfeln
 'tomate-wuerfel': 1.5,    # je Tomate
 'kirschtomaten': 1,       # je 100 g: halbieren
 'zuckerschoten': 1.5,     # je 100 g
 'fleisch': 0.9,           # je 100 g: trocken tupfen, Würfel oder Streifen
 'kaese-reiben': 2,        # je 100 g
 'gewuerze': 0.5,          # je Gewürz abmessen
}

def Z(art, menge=1):
    """Minuten nach Norm, kaufmännisch gerundet, mindestens 1."""
    return max(1, int(NORM[art] * menge + 0.5))

def X(d, m, ruhe=0, neben=False, liste=None):
    s = {'d': d, 'min': m}
    if ruhe: s['ruhe'] = ruhe
    if neben: s['neben'] = True
    if liste: s['liste'] = liste
    return s

def W(d, m, **kw):
    """„währenddessen“: läuft in der Zeit des Schritts davor."""
    return X(d, m, neben=True, **kw)

def leer_wiegen(gefaess):
    return X(f'{gefaess} leer wiegen und unten im Rechner bei „Gefäß leer“ eintragen', 1)

ABWASCHEN = X('Brett und Messer heiß abwaschen, Hände waschen', 2)

def fuellen(gefaess='Den Topf'):
    return [X(f'{gefaess} mit dem Essen wiegen und im Rechner bei „Mit Essen“ eintragen', 1),
            X('8 Boxen nacheinander auf die Waage stellen und je die Menge aus dem Rechner einfüllen', 8)]

ABKUEHLEN = X('Offen abkühlen lassen, höchstens 1–2 Std., dann Deckel drauf und kalt stellen', 1)

def reis_vorbereiten(g, ml, salz=True):
    return X(f'{g} g Reis im Sieb waschen, bis das Wasser klar ist, mit {ml} ml Wasser{" und 1 Prise Salz" if salz else ""} in den kleinen Topf', 3)

REIS_KOCHEN = X('Reistopf aufkochen, dann zugedeckt 12 Min. auf kleinster Hitze garen und 10 Min. ruhen lassen', 2, ruhe=22)

R = []

# ======================================================================= 1 Chili
R.append(dict(
 id='chili', name='Chili con Carne mit Süßkartoffel', short='Chili con Carne',
 desc='Zweierlei Rinderhack, Bohnen, Mais und Süßkartoffel in kräftig gewürztem Chili. Schmeckt am zweiten Tag noch besser.',
 protein='Rind', base='Süßkartoffel', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch (max. 20 % Fett)', '500 g', 'rinderhack', 500, 'g', '1 × 500 g'),
  I('Rinderhackfleisch mager (max. 5 % Fett)', '400 g', 'rinderhack-mager', 400, 'g', '1 × 400 g'),
  I('Kidneybohnen', '2 Dosen à 400 g (510 g abgetropft)', 'kidney', 2, 'Dose'),
  I('Mais', '1 Dose à 425 ml (285 g abgetropft)', 'mais', 1, 'Dose'),
  I('Stückige Tomaten', '2 Dosen à 400 g', 'tomaten-dose', 2, 'Dose'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Zwiebeln', '3 mittlere (300 g)', 'zwiebeln', 300, 'g'),
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 450 g)', 'paprika', 3, 'Stk', '3er-Pack', g=450),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Süßkartoffel', '600 g (1 große oder 2 mittlere)', 'suesskartoffel', 600, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Backkakao', '1 EL (10 g)', 'kakao', pantry=True),
  I('Rinderbrühe', '2 Würfel für 400 ml', 'bruehe-rind', pantry=True),
 ],
 spices=[S('Kreuzkümmel, gemahlen','2 gehäufte EL','kreuzkuemmel'), S('Paprika edelsüß','2 EL','paprika-edelsuess'),
  S('Paprika geräuchert','1 EL','paprika-geraeuchert'), S('Oregano','1 EL','oregano'), S('Chiliflocken','1–2 TL','chiliflocken'),
  S('Cayennepfeffer','1 TL','cayenne'), S('Zimt','½ TL','zimt'), S('Lorbeerblätter','2 Stück','lorbeer'),
  S('Salz','1 TL + zum Abschmecken','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Zwiebeln & Knoblauch', 'mittel'), ('Gewürze', 'klein'), ('Paprika & Süßkartoffel', 'groß'),
          ('Bohnen & Mais', 'groß'), ('Limettensaft', 'klein')],
 geraete=['großer Topf (mind. 5 l)', 'Sieb', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   X('3 Zwiebeln (300 g) schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 3)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 1', Z('knoblauch', 4)),
   X('3 Paprika (450 g) waschen, entkernen und in 1-cm-Würfel schneiden → Schale 3', Z('paprika-wuerfel', 3)),
   X('600 g Süßkartoffel schälen und in 1,5-cm-Würfel schneiden → Schale 3', Z('suesskartoffel', 6)),
   X('70 g Tomatenmark abwiegen → Schale 2', 1),
   X('In Schale 2 abmessen:', Z('gewuerze', 10), liste=['2 gehäufte EL Kreuzkümmel', '2 EL Paprika edelsüß',
     '1 EL Paprika geräuchert', '1 EL Oregano', '1–2 TL Chiliflocken', '1 TL Cayennepfeffer', '½ TL Zimt', '1 EL Backkakao (10 g)',
     '1 TL Salz', '1 TL Pfeffer']),
   X('2 Dosen Kidneybohnen und 1 Dose Mais öffnen, im Sieb kalt abspülen, abtropfen lassen → Schale 4', 4),
   X('2 Dosen stückige Tomaten öffnen, 2 Lorbeerblätter danebenlegen', 1),
   X('2 Brühwürfel in 400 ml heißem Wasser auflösen → Messbecher', 2),
   X('1 Limette auspressen → Schale 5', 1),
   leer_wiegen('Den großen Topf'),
  ]),
  ('Kochen', [
   X('Topf stark erhitzen, 500 g Rinderhack (20 %) ohne Öl hineingeben und 2 Min. liegen lassen', 3),
   X('Krümelig braten, bis es braun ist und Röstaromen hat', 5),
   X('400 g mageres Rinderhack dazu und krümelig braten', 5),
   X('Hitze auf mittel, Schale 1 dazu und 5 Min. glasig dünsten', 5),
   X('Schale 2 einrühren und 2 Min. rösten, bis es intensiv duftet – der wichtigste Schritt für den Geschmack', 2),
   X('Mit der Brühe aus dem Messbecher ablöschen und den Bodensatz loskratzen', 1),
   X('Stückige Tomaten, Lorbeer und Schale 3 dazu, aufkochen', 3),
   X('Zugedeckt 25 Min. leise köcheln, zweimal umrühren', 25),
   X('Schale 4 unterrühren und offen 10 Min. köcheln, bis die Sauce sämig ist', 10),
   X('Lorbeer herausnehmen', 1),
   X('Schale 5 einrühren', 1),
   X('Mit Salz abschmecken, lieber etwas mild: Über Nacht wird es kräftiger', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Mit Reis statt Süßkartoffel: 150 g Basmati (roh) separat kochen und auf die Boxen verteilen, die Werte bleiben fast gleich.',
       'Schärfer: 1 frische Chili fein gehackt mit in Schale 1.'],
 pauschal=[('Gewürze', 35)],
))

# ======================================================================= 2 Butter Chicken
R.append(dict(
 id='butter-chicken', name='Butter Chicken mit Reis', short='Butter Chicken',
 desc='Hähnchen in Skyr-Marinade aus dem Ofen, cremige Tomaten-Butter-Sauce und Basmati.',
 protein='Hähnchen', base='Reis', method='Ofen + Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Skyr natur', '300 g', 'skyr', 300, 'g', '2 Becher à 150 g'),
  I('Schlagsahne 30 %', '200 g', 'schlagsahne', 200, 'g', '1 Becher'),
  I('Passierte Tomaten', '500 g', 'passata', 500, 'g', '1 Packung'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Zwiebeln', '2 große (300 g)', 'zwiebeln', 300, 'g'),
  I('Knoblauch', '6 Zehen', 'knoblauch', 6, 'Zehe'),
  I('Ingwer', '30 g (daumengroß)', 'ingwer', 30, 'g'),
  I('Zitrone', '1 Stück', 'zitrone', 1, 'Stk'),
  I('Basmatireis', '280 g', 'reis', 280, 'g'),
  I('Butter', '40 g', 'butter', pantry=True),
  I('Öl', '10 g', 'oel', pantry=True),
  I('Honig', '1 TL (10 g)', 'honig', pantry=True),
  I('Koriander, frisch', 'zum Servieren', 'koriander', opt=True),
  H('Backpapier', '1 Blatt fürs Blech', 'backpapier'),
 ],
 spices=[S('Garam Masala','1 EL + 1 TL','garam-masala'), S('Kurkuma','1 TL','kurkuma'), S('Paprika edelsüß','1 EL','paprika-edelsuess'),
  S('Kreuzkümmel, gemahlen','1½ TL','kreuzkuemmel'), S('Chilipulver oder Cayenne','1–1½ TL','chilipulver'), S('Salz','2 TL','salz'),
  S('Kasuri Methi (optional, Asia-Laden)','2 EL','kasuri-methi')],
 schalen=[('Zwiebeln', 'mittel'), ('Hähnchen in Marinade', 'groß'), ('Knoblauch & Ingwer', 'klein'),
          ('Gewürze & Tomatenmark', 'klein'), ('Zum Schluss', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Backblech', 'Messbecher', 'Schüssel zum Wiegen', 'Pürierstab (optional)'],
 ablauf=[
  ('Vorbereiten', [
   X('2 Knoblauchzehen schälen und fein reiben → Schale 2', Z('knoblauch', 2)),
   X('30 g Ingwer schälen, davon 10 g fein reiben → Schale 2', 2),
   X('½ Zitrone auspressen → Schale 2', 1),
   X('In Schale 2 dazugeben und verrühren:', 3, liste=['300 g Skyr', '10 g Öl', '1 TL Garam Masala', '1 TL Kurkuma',
     '1 TL Paprika edelsüß', '½ TL Kreuzkümmel', '½ TL Chilipulver', '1 TL Salz']),
   X('800 g Hähnchenbrust in 3-cm-Würfel schneiden → Schale 2 und mit der Marinade mischen. Abgedeckt kalt stellen, mind. 30 Min.',
     Z('fleisch', 8), ruhe=30),
   ABWASCHEN,
   X('2 große Zwiebeln (300 g) schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 3)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 4)),
   X('Die restlichen 20 g Ingwer fein reiben → Schale 3', 2),
   X('Ofen auf 230 °C Umluft vorheizen', 1, ruhe=10),
   X('Blech mit Backpapier belegen', 1),
   X('In Schale 4 abmessen:', 3, liste=['70 g Tomatenmark', '1 EL Garam Masala', '1 TL Kreuzkümmel', '2 TL Paprika edelsüß', '½–1 TL Chilipulver']),
   X('Die andere Zitronenhälfte auspressen → Schale 5', 1),
   X('In Schale 5 dazu: 10 g Butter und 2 EL Kasuri Methi, zwischen den Fingern zerrieben (optional)', 1),
   leer_wiegen('Den großen Topf'),
   X('30 g Butter abwiegen → in den großen Topf', 1),
   X('500 g passierte Tomaten öffnen', 1),
   X('200 ml Wasser, 10 g Honig und 1 TL Salz im Messbecher verrühren', 2),
   reis_vorbereiten(280, 420),
  ]),
  ('Kochen', [
   X('Den großen Topf mit der Butter auf mittlere Hitze, Schale 1 darin 8–10 Min. goldbraun braten', 10),
   W('Schale 2 mit der ganzen Marinade auf dem Blech verteilen', 2),
   W('Blech oben in den Ofen, 10–12 Min. garen, bis die Ränder braun sind – es muss noch nicht ganz durch sein', 1, ruhe=11),
   W('Hände waschen', 1),
   X('Schale 3 zu den Zwiebeln und 1 Min. mitbraten', 1),
   X('Schale 4 einrühren und 1–2 Min. anrösten', 2),
   X('Die passierten Tomaten (500 g) und den Messbecher einrühren', 1),
   X('Halb zugedeckt 15 Min. köcheln', 15),
   W('Blech herausnehmen, sobald die 10–12 Min. um sind, Ofen aus', 1),
   W(REIS_KOCHEN['d'], REIS_KOCHEN['min'], ruhe=REIS_KOCHEN['ruhe']),
   X('Für eine glatte Sauce wie im Restaurant jetzt pürieren (optional)', 2),
   X('Hähnchen samt Bratensaft vom Blech in die Sauce, 5 Min. leise köcheln, bis es innen nicht mehr rosa ist', 5),
   X('200 g Sahne und Schale 5 einrühren, ab jetzt nicht mehr sprudelnd kochen', 1),
   X('Mit Salz abschmecken', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Curry-Topf') + [ABKUEHLEN]),
 ],
 tips=['Über Nacht mariniert wird das Hähnchen noch zarter, und die 30 Min. Wartezeit fallen weg.',
       'Kasuri Methi bringt den typischen Restaurant-Geschmack. Gibt es im Asia-Laden oder online.',
       'Mit Kochsahne 15 % (400 g) statt Schlagsahne wird die Sauce leichter, dann 270 g Reis nehmen.',
       'Koriander erst beim Essen drüberstreuen.'],
 pauschal=[('Gewürze', 24)],
))

# ======================================================================= 3 Gulasch
R.append(dict(
 id='gulasch', name='Rindergulasch mit Kartoffeln', short='Rindergulasch',
 desc='Mageres Rind, viel Zwiebeln und Paprika in kräftiger Schmorsauce. Aufgewärmt noch besser.',
 protein='Rind', base='Kartoffeln', method='Bräter', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rindergulasch, mager (Keule oder Schulter)', '1 kg', 'rindergulasch', 1000, 'g', '2 × 500 g'),
  I('Zwiebeln', '1 kg', 'zwiebeln', 1000, 'g', '1 Netz'),
  I('Rote Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Kartoffeln, festkochend', '1.275 g geschält', 'kartoffeln', 1500, 'g', 'Beutel 1,5 kg', g=1275),
  I('Knoblauch', '6 Zehen', 'knoblauch', 6, 'Zehe'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Butterschmalz', '65 g', 'butterschmalz', pantry=True),
  I('Rinderbrühe', '750 ml', 'bruehe-rind', pantry=True),
  I('Balsamico oder Rotweinessig', '1 EL', 'balsamico', pantry=True),
  I('Zitrone (Abrieb)', '1 Bio-Zitrone', 'zitrone', opt=True),
 ],
 spices=[S('Paprika edelsüß','3 EL','paprika-edelsuess'), S('Paprika rosenscharf','1 TL','paprika-rosenscharf'),
  S('Paprika geräuchert','1 TL','paprika-geraeuchert'), S('Kümmel, gemahlen','2 TL','kuemmel'), S('Majoran','2 TL','majoran'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','2–3 TL','salz'), S('Pfeffer','frisch gemahlen','pfeffer')],
 schalen=[('Fleisch', 'groß'), ('Zwiebeln', 'groß'), ('Knoblauch & Tomatenmark', 'klein'), ('Gewürze', 'klein'),
          ('Kartoffeln', 'groß'), ('Paprika', 'mittel')],
 geraete=['Bräter oder großer Topf mit Deckel (mind. 5 l)', 'Teller fürs angebratene Fleisch', 'Messbecher', 'Sieb', 'Tasse', 'Untertasse'],
 ablauf=[
  ('Vorbereiten', [
   X('1 kg Zwiebeln schälen und in feine Streifen schneiden → Schale 2', Z('zwiebel-streifen', 10)),
   X('6 Knoblauchzehen schälen und hacken → Schale 3', Z('knoblauch', 6)),
   X('70 g Tomatenmark abwiegen → Schale 3', 1),
   X('In Schale 4 abmessen:', 3, liste=['3 EL Paprika edelsüß', '1 TL Paprika rosenscharf', '1 TL Paprika geräuchert', '2 TL Kümmel',
     '2 TL Majoran', '1 TL Salz']),
   X('750 ml heiße Rinderbrühe anrühren → Messbecher, 2 Lorbeerblätter danebenlegen', 2),
   leer_wiegen('Den Bräter'),
   X('25 g Butterschmalz in den Bräter geben', 1),
   X('40 g Butterschmalz abwiegen → Schale 2', 1),
   X('1 kg Rindergulasch trocken tupfen, große Stücke auf 3–4 cm nachschneiden → Schale 1', Z('fleisch', 10)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Den Bräter mit dem Butterschmalz stark erhitzen', 2),
   X('Ein Drittel aus Schale 1 rundum kräftig braun anbraten, auf den Teller', 4),
   X('Das zweite Drittel genauso', 4),
   X('Das letzte Drittel genauso – alles auf einmal würde im eigenen Saft kochen', 4),
   X('Hitze auf mittel, Schale 2 in den Bräter und 15–20 Min. goldbraun schmoren, ab und zu rühren und den Bratensatz lösen', 18),
   X('Schale 3 dazu und 2 Min. mitrösten', 2),
   X('Bräter vom Herd ziehen und Schale 4 einrühren – Paprikapulver wird auf voller Hitze schnell bitter', 1),
   X('Sofort mit der Brühe ablöschen und den Bratensatz lösen', 1),
   X('Fleisch samt Saft vom Teller und den Lorbeer dazu, zurück auf den Herd und aufkochen', 3),
   X('Zugedeckt 90 Min. bei kleiner Hitze schmoren, alle 20 Min. umrühren', 90),
   W('1,5 kg Kartoffeln schälen, davon 1.275 g abwiegen', Z('kartoffel-schaelen', 15)),
   W('Die Kartoffeln in 3-cm-Würfel schneiden → Schale 5, mit kaltem Wasser bedecken', Z('kartoffel-wuerfel', 12.75)),
   W('3 rote Paprika (480 g) in 2-cm-Stücke schneiden → Schale 6', Z('paprika-stuecke', 3)),
   W('300 ml Wasser und 1 TL Salz → Messbecher', 1),
   W('1 EL Balsamico abmessen → Tasse', 1),
   W('Wer mag: Abrieb von 1 Bio-Zitrone → Untertasse', 1),
   X('Schale 5 abgießen', 1),
   X('Kartoffeln, Schale 6 und das Wasser aus dem Messbecher in den Bräter, aufkochen', 3),
   X('Zugedeckt 25–30 Min. köcheln, bis alles weich ist', 28),
   X('Lorbeer herausnehmen', 1),
   X('Balsamico aus der Tasse einrühren, mit Salz und Pfeffer abschmecken', 2),
   X('Zu dünn? Offen 5–10 Min. einkochen', 1),
   X('Wer mag: den Zitronenabrieb darüberstreuen', 1),
  ]),
  ('Portionieren', fuellen('Den Bräter') + [ABKUEHLEN]),
 ],
 tips=['Beim Fleisch schwankt der Fettgehalt stark. Nimm Keule statt Nacken, das ist deutlich magerer.',
       'Die Zwiebeln gehen im Zerkleinerer in 5 Min. statt 20.'],
 pauschal=[('Gewürze & Balsamico', 50)],
))

# ======================================================================= 4 Tomaten-Hähnchen-Pasta
R.append(dict(
 id='tomaten-pasta', name='Creamy Tomaten-Hähnchen-Pasta', short='Tomaten-Pasta',
 desc='Penne in cremiger Tomatensauce mit getrockneten Tomaten, Spinat und Parmesan.',
 protein='Hähnchen', base='Nudeln', method='Pfanne + Topf', fridge='3 Tage', freeze='2–3 Monate',
 items=[
  I('Hähnchenbrustfilet', '700 g', 'haehnchenbrust', 700, 'g', 'Theke oder 2 × 400 g'),
  I('Penne', '320 g', 'penne', 320, 'g', 'aus 500-g-Packung'),
  I('Getrocknete Tomaten in Öl', '1 Glas (ca. 280 g, 150 g abgetropft)', 'getr-tomaten', 1, 'Glas'),
  I('Passierte Tomaten', '500 g', 'passata', 500, 'g', '1 Packung'),
  I('Kochsahne 15 %', '200 g', 'kochsahne', 200, 'g', '1 Becher'),
  I('Frischkäse leicht', '200 g', 'frischkaese', 200, 'g', '1 Packung'),
  I('Parmesan', '50 g', 'parmesan', 50, 'g'),
  I('Babyspinat', '250 g', 'spinat', 250, 'g', '2 × 125 g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '5 Zehen', 'knoblauch', 5, 'Zehe'),
  I('Gemüsebrühe (Pulver)', '1 TL', 'bruehe-gemuese', pantry=True),
  I('Basilikum, frisch', 'zum Servieren', 'basilikum', opt=True),
 ],
 spices=[S('Paprika edelsüß','2 TL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Italienische Kräuter','2 TL','ital-kraeuter'), S('Oregano','1 TL','oregano'), S('Chiliflocken','½ TL','chiliflocken'),
  S('Knoblauchpulver','½ TL','knoblauchpulver'), S('Salz','nach Geschmack','salz'), S('Pfeffer','nach Geschmack','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Penne', 'mittel'), ('Zwiebeln & Knoblauch', 'mittel'), ('Tomaten & Gewürze', 'klein'), ('Käse', 'klein')],
 geraete=['große Pfanne', 'großer Nudeltopf', 'Sieb', 'Messbecher (1 l)', 'Tasse fürs Tomatenöl', 'Becher fürs Nudelwasser', 'Teller'],
 ablauf=[
  ('Vorbereiten', [
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 3', Z('zwiebel-wuerfel', 2)),
   X('5 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 5)),
   X('Getrocknete Tomaten im Sieb über einer Schüssel abtropfen lassen', 1),
   X('16 g vom Tomatenöl in die Tasse abwiegen', 1),
   X('Die Tomaten (150 g) in Streifen schneiden → Schale 4', 3),
   X('In Schale 4 dazu:', Z('gewuerze', 5), liste=['1 TL Paprika edelsüß', '1 TL Paprika geräuchert', '1 TL italienische Kräuter',
     '1 TL Oregano', '½ TL Chiliflocken']),
   X('500 g passierte Tomaten, 200 g Kochsahne und 1 TL Gemüsebrühe (Pulver) im Messbecher verrühren', 2),
   X('50 g Parmesan fein reiben → Schale 5, 200 g Frischkäse dazu', 2),
   X('320 g Penne abwiegen → Schale 2', 1),
   leer_wiegen('Den großen Topf'),
   X('Den großen Topf mit Salzwasser für die Nudeln aufsetzen', 1, ruhe=12),
   X('In Schale 1 abmessen: 1 TL Paprika edelsüß, ½ TL Knoblauchpulver, 1 TL italienische Kräuter, ½ TL Salz, ½ TL Pfeffer', Z('gewuerze', 5)),
   X('700 g Hähnchenbrust in 2–3-cm-Stücke schneiden → Schale 1 und mit den Gewürzen mischen', Z('fleisch', 7)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Die Hälfte vom Tomatenöl in der Pfanne stark erhitzen', 1),
   X('Schale 1 in 2 Portionen je 3–4 Min. goldbraun braten, auf den Teller', 8),
   X('Schale 2 ins kochende Wasser, Timer auf 2 Min. weniger als auf der Packung', 1, ruhe=9),
   X('Hitze auf mittel, restliches Tomatenöl in die Pfanne, Schale 3 darin 3–4 Min. glasig braten', 4),
   X('Schale 4 dazu und 1 Min. mitbraten', 1),
   X('Den Messbecher einrühren und 5 Min. köcheln', 5),
   W('Wenn der Timer klingelt: 300 ml Nudelwasser in den Becher schöpfen', 1),
   W('Die Nudeln abgießen und zurück in den großen Topf', 1),
   X('250 g Babyspinat handvollweise unterheben', 2),
   X('Hähnchen samt Saft zurück in die Pfanne, 4–5 Min. leise köcheln, bis es durch ist', 5),
   X('Pfanne vom Herd, Schale 5 einrühren, bis der Frischkäse geschmolzen ist', 2),
   X('Die Sauce zu den Nudeln in den Topf und mischen', 2),
   X('Mit Nudelwasser (bis 300 ml) cremig rühren – die Nudeln saugen in der Box noch nach', 1),
   X('Mit Salz und Pfeffer abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Frischkäse leicht nehmen (ca. 11 % Fett). Doppelrahmstufe bringt pro Portion rund 3,5 g Fett mehr.',
       'Frisches Basilikum erst beim Essen drüberzupfen.',
       'Vollkorn: 370 g Vollkorn-Penne und nur 12 g Öl, dann ca. 452 kcal bei gleichen Makros.'],
 pauschal=[('Öl aus dem Tomatenglas', 16, 'oel'), ('Gewürze & Brühpulver', 19)],
))

# ======================================================================= 5 Mac & Cheese
R.append(dict(
 id='mac-cheese', name='Chicken Mac & Cheese mit Brokkoli', short='Mac & Cheese',
 desc='Makkaroni in echter Cheddar-Sauce mit Senf und Rauchpaprika, dazu gebratenes Hähnchen und viel Brokkoli.',
 protein='Hähnchen', base='Nudeln', method='Topf + Pfanne', fridge='3 Tage', freeze='2 Monate',
 items=[
  I('Hörnchennudeln oder Makkaroni', '310 g', 'hoernchen', 310, 'g', 'aus 500-g-Packung'),
  I('Hähnchenbrustfilet', '500 g', 'haehnchenbrust', 500, 'g', '1 × 500 g'),
  I('Brokkoli', '1 kg', 'brokkoli', 1000, 'g', '2 Köpfe oder TK'),
  I('Milch 1,5 %', '700 ml', 'milch', 700, 'ml'),
  I('Cheddar, kräftig (am Stück)', '200 g', 'cheddar', 200, 'g', '1 Packung'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Butter', '25 g', 'butter', pantry=True),
  I('Weizenmehl', '35 g', 'mehl', pantry=True),
  I('Senf, mittelscharf', '1 EL (15 g)', 'senf', pantry=True),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
 ],
 spices=[S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Zwiebelgranulat','1 TL','zwiebelpulver'), S('Cayennepfeffer','¼–½ TL','cayenne'),
  S('Muskat','1 Prise','muskat'), S('Salz','1 TL + fürs Nudelwasser','salz'), S('Pfeffer','½ TL + zum Abschmecken','pfeffer')],
 schalen=[('Nudeln', 'mittel'), ('Hähnchen', 'mittel'), ('Brokkoli', 'groß'), ('Mehl & Knoblauch', 'klein'), ('Käse & Würze', 'mittel')],
 geraete=['großer Topf', 'mittlerer Topf', 'Pfanne', 'Schneebesen', 'Reibe', 'Sieb', 'Messbecher', 'Becher fürs Kochwasser'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('1 kg Brokkoli in kleine Röschen teilen, den Strunk schälen und würfeln → Schale 3', Z('brokkoli', 10)),
   X('3 Knoblauchzehen schälen und fein hacken oder pressen → Schale 4', Z('knoblauch', 3)),
   X('35 g Mehl abwiegen → Schale 4', 1),
   X('25 g Butter abwiegen → in den mittleren Topf', 1),
   X('700 ml Milch abmessen → Messbecher', 1),
   X('200 g Cheddar fein reiben → Schale 5', Z('kaese-reiben', 2)),
   X('In Schale 5 dazu:', Z('gewuerze', 6), liste=['1 EL Senf', '1 TL Paprika geräuchert', '1 TL Zwiebelgranulat',
     '¼ TL Cayennepfeffer', '1 Prise Muskat', '½ TL Salz']),
   X('310 g Makkaroni abwiegen → Schale 1', 1),
   X('Den großen Topf mit Salzwasser aufsetzen (ca. 4 l)', 1, ruhe=12),
   X('10 g Öl abwiegen → in die Pfanne', 1),
   X('In Schale 2 abmessen: 1 TL Paprika edelsüß, 1 TL Knoblauchpulver, ½ TL Salz, ½ TL Pfeffer', Z('gewuerze', 4)),
   X('500 g Hähnchenbrust in 2-cm-Würfel schneiden → Schale 2 und mit den Gewürzen mischen', Z('fleisch', 5)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Schale 1 ins kochende Salzwasser, Timer auf 1 Min. weniger als auf der Packung (meist 8 Min.)', 1),
   X('Die Pfanne mit dem Öl stark erhitzen, Schale 2 darin 6–7 Min. rundum goldbraun braten, bis es durch ist', 7),
   W('4 Min. bevor der Timer klingelt: Schale 3 zu den Nudeln', 1),
   X('Wenn der Timer klingelt: 200 ml Kochwasser in den Becher schöpfen', 1),
   X('Nudeln und Brokkoli abgießen und zurück in den großen Topf', 1),
   X('Das Hähnchen dazugeben', 1),
   X('Den mittleren Topf mit der Butter auf mittlere Hitze; wenn sie schäumt, Schale 4 einrühren und 1–2 Min. anschwitzen, nicht bräunen', 2),
   X('Die Milch in 3 Portionen dazugießen, jedes Mal glatt rühren', 3),
   X('Unter Rühren aufkochen und 3 Min. köcheln, bis die Sauce andickt', 4),
   X('Topf vom Herd ziehen und Schale 5 einrühren, bis der Käse geschmolzen ist – nicht mehr kochen, sonst wird sie körnig', 2),
   X('Die Sauce über Nudeln, Brokkoli und Hähnchen gießen und alles mischen', 2),
   X('Mit Kochwasser (bis 200 ml) cremig ziehen', 1),
   X('Mit Salz und Pfeffer abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den großen Topf') + [ABKUEHLEN]),
 ],
 tips=['Cheddar selbst reiben: Geriebener aus der Tüte hat Trennmittel und macht die Sauce schnell körnig.',
       'Knuspriges Topping: 40 g Panko trocken rösten, mit 30 g Parmesan mischen und erst beim Essen drüberstreuen. Pro Portion +33 kcal.',
       'Beim Aufwärmen 1–2 EL Milch dazu, dann wird es wieder cremig.'],
 pauschal=[('Gewürze', 8)],
))

# ======================================================================= 6 Teriyaki
R.append(dict(
 id='teriyaki', name='Chicken Teriyaki Bowl', short='Teriyaki Bowl',
 desc='Saftige Hähnchenkeule in glänzender Teriyaki-Sauce mit Brokkoli, Möhren und Sesam.',
 protein='Hähnchen', base='Reis', method='Wok / Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1 kg', 'haehnchenkeule', 1000, 'g', '2 × 500 g'),
  I('Basmati- oder Jasminreis', '240 g', 'reis', 240, 'g'),
  I('Brokkoli', '1 kg', 'brokkoli', 1000, 'g', '2 Köpfe'),
  I('Möhren', '300 g (3 Stück)', 'moehren', 300, 'g'),
  I('Frühlingszwiebeln', '1 Bund', 'fruehlingszwiebeln', 1, 'Bund'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '30 g (daumengroß)', 'ingwer', 30, 'g'),
  I('Sesam', '30 g', 'sesam', 30, 'g', 'Tüte'),
  I('Sojasauce', '120 ml', 'sojasauce', pantry=True),
  I('Honig', '50 g (2½ EL)', 'honig', pantry=True),
  I('Reis- oder Apfelessig', '2 EL', 'essig', pantry=True),
  I('Speisestärke', '15 g (1½ EL)', 'staerke', pantry=True),
  I('Öl, neutral', '15 g', 'oel', pantry=True),
  I('Sesamöl', '10 g', 'sesamoel', pantry=True),
 ],
 spices=[S('Chiliflocken','½–1 TL','chiliflocken'), S('Salz','1 Prise für den Reis + fürs Gemüsewasser','salz')],
 schalen=[('Brokkoli & Möhren', 'groß'), ('Hähnchen', 'groß'), ('Teriyaki-Sauce', 'mittel'), ('Sesam & Frühlingszwiebeln', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Wok oder große Pfanne', 'Sieb', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(240, 360),
   X('1 kg Brokkoli in Röschen teilen, den Strunk schälen und würfeln → Schale 1', Z('brokkoli', 10)),
   X('3 Möhren (300 g) schälen und schräg in dünne Scheiben schneiden → Schale 1', Z('moehre-scheiben', 3)),
   X('1 Bund Frühlingszwiebeln in feine Ringe schneiden → Schale 4', Z('fruehlingszwiebeln')),
   X('4 Knoblauchzehen schälen und fein reiben → Schale 3', Z('knoblauch', 4)),
   X('30 g Ingwer schälen und fein reiben → Schale 3', Z('ingwer')),
   X('In Schale 3 dazu und glatt rühren:', 4, liste=['120 ml Sojasauce', '50 g Honig', '2 EL Essig', '15 g Speisestärke',
     '½–1 TL Chiliflocken', '10 g Sesamöl', '150 ml Wasser']),
   X('30 g Sesam im trockenen Wok 2 Min. goldbraun rösten → Schale 4', 3),
   X('15 g Öl abwiegen und in den Wok geben', 1),
   X('Den großen Topf mit Salzwasser fürs Gemüse aufsetzen', 1, ruhe=12),
   X('1 kg Hähnchen-Oberkeulenfilet in 3-cm-Stücke schneiden, grobes Fett wegschneiden → Schale 2', Z('fleisch', 10)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Schale 1 ins kochende Salzwasser und 3–4 Min. blanchieren – es soll bissfest bleiben, beim Aufwärmen gart es nach', 4),
   X('Abgießen, kurz kalt abschrecken und im Sieb abtropfen lassen', 2),
   X('Wok mit dem Öl stark erhitzen, die Hälfte aus Schale 2 hinein und 4–5 Min. goldbraun braten, in den großen Topf', 5),
   X('Die zweite Hälfte genauso braten', 5),
   X('Alles Hähnchen zurück in den Wok, Schale 3 umrühren und dazugießen', 1),
   X('2 Min. köcheln, bis die Sauce andickt und glänzt', 2),
   X('Reis, Gemüse und Teriyaki-Hähnchen im großen Topf gut mischen', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Schale 4 über die 8 Boxen streuen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Oberkeule bleibt beim Aufwärmen viel saftiger als Brust. Mit 1 kg Brust fehlen dir pro Portion ca. 6 g Fett, dann 2 EL Öl mehr nehmen.'],
 pauschal=[('Gewürze', 3)],
))

# ======================================================================= 7 Thai-Curry
R.append(dict(
 id='thai-curry', name='Rotes Thai-Curry mit Hähnchen', short='Thai-Curry',
 desc='Hähnchen und knackiges Gemüse in Kokos-Currysauce mit Limette, dazu Jasminreis.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '1 kg', 'haehnchenbrust', 1000, 'g', '2 × 500 g'),
  I('Kokosmilch (nicht light)', '1 Dose à 400 ml', 'kokosmilch', 1, 'Dose'),
  I('Rote Currypaste, vegan', '70 g', 'currypaste', 1, 'Glas', 'ohne Garnelen – Zutaten prüfen'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Zucchini', '1 Stück (ca. 300 g)', 'zucchini', 1, 'Stk'),
  I('Zuckerschoten', '200 g', 'zuckerschoten', 200, 'g'),
  I('Zwiebel', '1 Stück (100 g)', 'zwiebeln', 100, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g', 'ingwer', 20, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Jasminreis', '290 g', 'reis', 290, 'g'),
  I('Sojasauce', '2 EL (30 ml)', 'sojasauce', pantry=True),
  I('Zucker', '2 TL (10 g)', 'zucker', pantry=True),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Thai-Basilikum oder Koriander', 'zum Servieren', 'koriander', opt=True),
 ],
 spices=[S('Chiliflocken (optional)','nach Schärfe','chiliflocken'), S('Salz','nach Geschmack','salz')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebel', 'klein'), ('Knoblauch, Ingwer & Paste', 'klein'), ('Paprika & Zucchini', 'groß'),
          ('Zuckerschoten', 'mittel'), ('Limettensaft', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Sieb', 'Messbecher', 'Tasse fürs Öl', 'Teller'],
 ablauf=[
  ('Vorbereiten', [
   reis_vorbereiten(290, 435, salz=False),
   X('1 Zwiebel (100 g) schälen und in Streifen schneiden → Schale 2', Z('zwiebel-streifen')),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein hacken → Schale 3', Z('ingwer')),
   X('70 g Currypaste abwiegen → Schale 3', 1),
   X('3 Paprika (480 g) in Streifen schneiden → Schale 4', Z('paprika-streifen', 3)),
   X('1 Zucchini (300 g) längs halbieren und in Halbmonde schneiden → Schale 4', Z('zucchini-scheiben')),
   X('200 g Zuckerschoten waschen und schräg halbieren → Schale 5', Z('zuckerschoten', 2)),
   X('1 Limette auspressen → Schale 6', 1),
   X('200 ml Wasser, 30 ml Sojasauce und 10 g Zucker im Messbecher verrühren', 2),
   X('Kokosmilch öffnen, nicht schütteln – oben sitzt die dicke Creme', 1),
   X('20 g Öl abwiegen → Tasse', 1),
   leer_wiegen('Den großen Topf'),
   X('1 kg Hähnchenbrust in mundgerechte Stücke schneiden → Schale 1', Z('fleisch', 10)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Die Hälfte vom Öl im großen Topf stark erhitzen, Schale 1 in 2 Portionen je 3 Min. anbraten, auf den Teller – noch nicht durch', 6),
   X('Restliches Öl in den Topf, Schale 2 darin 2 Min. braten', 2),
   X('Schale 3 dazu und 1 Min. rösten', 1),
   X('Die dicke Kokoscreme oben aus der Dose dazu und 1 Min. mitrösten – das bringt den Geschmack', 1),
   X('Restliche Kokosmilch und den Messbecher einrühren', 1),
   X('Schale 4 dazu und 5 Min. köcheln', 5),
   X('Hähnchen samt Saft und Schale 5 dazu, 4–5 Min. leise köcheln, bis das Hähnchen durch ist', 5),
   X('Schale 6 einrühren', 1),
   X('Mit Salz oder Sojasauce abschmecken, wer mag mit Chiliflocken schärfen', 1),
   X('Den Reis unter das Curry heben', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Viele rote Currypasten (z. B. Mae Ploy) enthalten Garnelenpaste. Auf die Zutatenliste schauen – vegane gibt es im Asia-Laden und im Bio-Regal.',
       'Currypasten sind unterschiedlich scharf. Bei einer neuen Sorte erst nur 50 g in Schale 3 geben.',
       'Thai-Basilikum oder Koriander erst beim Essen drüberstreuen.'],
 pauschal=[],
))

# ======================================================================= 8 Burrito Bowl
R.append(dict(
 id='burrito-bowl', name='Burrito Bowl mit Hähnchen', short='Burrito Bowl',
 desc='Taco-Hähnchen, Limettenreis, Bohnen, Mais, Fajita-Gemüse, Salsa, Cheddar und Limetten-Schmand.',
 protein='Hähnchen', base='Reis', method='Pfanne', fridge='4 Tage', freeze='2 Monate, ohne Salsa und Schmand',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Langkorn- oder Basmatireis', '240 g', 'reis', 240, 'g'),
  I('Schwarze Bohnen', '1 Dose à 400 g (240 g abgetropft)', 'schwarze-bohnen', 1, 'Dose'),
  I('Mais', '1 Dose à 425 ml (285 g abgetropft)', 'mais', 1, 'Dose'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Zwiebel', '1 Stück (100 g)', 'zwiebeln', 100, 'g'),
  I('Rote Zwiebel', '1 Stück (100 g)', 'rote-zwiebeln', 100, 'g'),
  I('Tomaten', '3 Stück (300 g)', 'tomaten', 300, 'g'),
  I('Limetten', '2 Stück', 'limette', 2, 'Stk'),
  I('Cheddar, gerieben', '150 g', 'cheddar', 150, 'g', '1 Beutel'),
  I('Schmand', '200 g', 'schmand', 200, 'g', '1 Becher'),
  I('Öl', '1 TL (5 g)', 'oel', pantry=True),
  I('Koriander, frisch', '½ Bund', 'koriander', opt=True),
  H('Kleine Döschen mit Deckel', '16 Stück für Salsa und Schmand', 'doeschen'),
 ],
 spices=[S('Paprika edelsüß','2 TL','paprika-edelsuess'), S('Paprika geräuchert','2 TL','paprika-geraeuchert'),
  S('Kreuzkümmel, gemahlen','2 TL','kreuzkuemmel'), S('Oregano','1 TL','oregano'), S('Knoblauchpulver','1 TL','knoblauchpulver'),
  S('Zwiebelgranulat','1 TL','zwiebelpulver'), S('Chiliflocken oder Cayenne','½–1 TL','chiliflocken'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Fajita-Gemüse', 'groß'), ('Hähnchen & Gewürze', 'groß'), ('Bohnen & Mais', 'mittel'), ('Limette für den Reis', 'klein'),
          ('Salsa', 'mittel'), ('Limetten-Schmand', 'klein')],
 geraete=['große Pfanne', 'kleiner Topf mit Deckel', 'Sieb', 'Zitruspresse', 'Teller', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   reis_vorbereiten(240, 360),
   X('3 Tomaten (300 g) würfeln → Schale 5', Z('tomate-wuerfel', 3)),
   X('1 rote Zwiebel (100 g) schälen und fein würfeln → Schale 5', Z('zwiebel-wuerfel')),
   X('½ Bund Koriander hacken (optional) → Schale 5', 2),
   X('½ Limette über Schale 5 auspressen, ½ TL Salz und etwas Pfeffer dazu, mischen – die Salsa ist fertig', 2),
   X('200 g Schmand → Schale 6, ½ Limette darüber auspressen, 1 Prise Salz dazu und glatt rühren', 2),
   X('3 Paprika (480 g) in Streifen schneiden → Schale 1', Z('paprika-streifen', 3)),
   X('1 gelbe Zwiebel (100 g) schälen und in Streifen schneiden → Schale 1', Z('zwiebel-streifen')),
   X('½ Limette auspressen → Schale 4', 1),
   X('1 Dose schwarze Bohnen und 1 Dose Mais öffnen, im Sieb abspülen → Schale 3', 3),
   X('In Schale 2 abmessen:', Z('gewuerze', 11), liste=['Saft von ½ Limette', '5 g Öl', '2 TL Paprika edelsüß', '2 TL Paprika geräuchert',
     '2 TL Kreuzkümmel', '1 TL Oregano', '1 TL Knoblauchpulver', '1 TL Zwiebelgranulat', '½–1 TL Chiliflocken', '1 TL Pfeffer', '1 TL Salz']),
   X('800 g Hähnchenbrust in 2-cm-Würfel schneiden → Schale 2 und gut mit den Gewürzen mischen', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Schale 1 in der großen Pfanne ohne Fett 6–8 Min. kräftig anrösten', 7),
   X('Mit 1 Prise Salz würzen und zurück in Schale 1', 1),
   X('Die Hälfte aus Schale 2 bei mittelstarker Hitze 3–4 Min. braten, bis sie durch ist, auf den Teller', 4),
   X('Die zweite Hälfte genauso braten, dann alles Hähnchen zurück in die Pfanne', 4),
   X('Schale 3 zum Hähnchen und 2 Min. miterwärmen', 2),
   X('Sobald der Reis fertig ist: Schale 4 unterheben', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
   X('Genauso mit Hähnchen, Bohnen und Mais: in die Schüssel, wiegen, durch 8 teilen, verteilen', 4),
   X('Das Fajita-Gemüse aus Schale 1 gleichmäßig obendrauf verteilen', 2),
   X('150 g Cheddar über die Boxen streuen, knapp 19 g pro Box', 2),
   X('Die Salsa (Schale 5) in 8 Döschen füllen, je ca. 50 g', 3),
   X('Den Limetten-Schmand (Schale 6) in 8 Döschen füllen, je ca. 27 g', 2),
   X('Die Döschen gleich mit Deckel kalt stellen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Statt schwarzer Bohnen gehen Kidneybohnen genauso.',
       'Zum Aufwärmen Salsa und Schmand vorher herausnehmen und kalt dazu essen.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 9 Gyros
R.append(dict(
 id='gyros', name='Hähnchen-Gyros mit Kritharaki & Tzatziki', short='Gyros-Kritharaki',
 desc='Scharf angebratenes Gyros mit Zwiebeln auf Tomaten-Kritharaki, Feta und Skyr-Tzatziki.',
 protein='Hähnchen', base='Nudeln', method='Pfanne + Topf', fridge='4 Tage', freeze='2 Monate, ohne Tzatziki',
 items=[
  I('Hähnchenbrustfilet', '500 g', 'haehnchenbrust', 500, 'g', '1 × 500 g'),
  I('Kritharaki', '320 g', 'kritharaki', 320, 'g', 'aus 500-g-Packung'),
  I('Zwiebeln', '3 Stück (300 g)', 'zwiebeln', 300, 'g'),
  I('Passierte Tomaten', '500 g', 'passata', 500, 'g', '1 Packung'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Skyr natur', '500 g', 'skyr', 500, 'g', '1 großer Becher'),
  I('Salatgurke', '1 Stück (ca. 300 g)', 'gurke', 1, 'Stk'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Feta', '200 g', 'feta', 200, 'g', '1 Packung'),
  I('Olivenöl', '60 g (davon 10 g fürs Tzatziki)', 'olivenoel', pantry=True),
  I('Gemüsebrühe', '600 ml', 'bruehe-gemuese', pantry=True),
  I('Dill oder Minze, frisch', 'fürs Tzatziki', 'dill', opt=True),
  H('Kleine Döschen mit Deckel', '8 Stück fürs Tzatziki', 'doeschen'),
 ],
 spices=[S('Paprika edelsüß','2 TL','paprika-edelsuess'), S('Oregano','2 TL + 1 TL für die Kritharaki','oregano'),
  S('Thymian','1 TL','thymian'), S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Knoblauchpulver','1 TL','knoblauchpulver'),
  S('Zwiebelgranulat','1 TL','zwiebelpulver'), S('Koriander, gemahlen','½ TL','koriander-gem'), S('Cayennepfeffer','¼ TL','cayenne'),
  S('Salz','2 TL + 1 Prise','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Tomatenmark & Oregano', 'klein'), ('Kritharaki', 'mittel'), ('Gyros in Marinade', 'groß'), ('Zwiebeln', 'mittel'),
          ('Tzatziki', 'mittel')],
 geraete=['großer Topf', 'große Pfanne', 'Teller fürs Gyros', 'Reibe', 'Sieb und Schüssel für die Gurke', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   X('In Schale 3 abmessen:', Z('gewuerze', 10), liste=['30 g Olivenöl', '2 TL Paprika edelsüß', '2 TL Oregano', '1 TL Thymian',
     '1 TL Kreuzkümmel', '1 TL Knoblauchpulver', '1 TL Zwiebelgranulat', '½ TL Koriander, gemahlen', '¼ TL Cayennepfeffer', '1 TL Salz']),
   X('2 Knoblauchzehen schälen und fein reiben → Schale 3', Z('knoblauch', 2)),
   X('500 g Hähnchenbrust in dünne Streifen schneiden → Schale 3 und gut mischen. Abgedeckt kalt stellen, mind. 30 Min.',
     Z('fleisch', 6), ruhe=30),
   ABWASCHEN,
   X('1 Salatgurke (300 g) in ein Sieb über einer Schüssel grob raspeln', 3),
   X('Mit ½ TL Salz mischen und 10 Min. ziehen lassen', 1, ruhe=10),
   X('3 Zwiebeln (300 g) schälen und in Streifen schneiden → Schale 4', Z('zwiebel-streifen', 3)),
   X('70 g Tomatenmark abwiegen → Schale 1, 1 TL Oregano und ½ TL Salz dazu', 1),
   X('320 g Kritharaki abwiegen → Schale 2', 1),
   X('600 ml heiße Gemüsebrühe anrühren → Messbecher', 2),
   X('Die Gurke mit den Händen kräftig ausdrücken → Schale 5', 2),
   X('2 Knoblauchzehen schälen und fein reiben → Schale 5', Z('knoblauch', 2)),
   X('In Schale 5 dazu und verrühren, dann kalt stellen:', 2, liste=['500 g Skyr', '10 g Olivenöl', '1 TL Pfeffer', '1 Prise Salz',
     'wer mag: Dill oder Minze, gehackt']),
   leer_wiegen('Den großen Topf'),
   X('5 g Olivenöl abwiegen → in den großen Topf', 1),
   X('15 g Olivenöl abwiegen → in die große Pfanne', 1),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl auf mittlere Hitze, Schale 1 darin 1 Min. unter Rühren anrösten', 2),
   X('500 g passierte Tomaten und die Brühe dazu, aufkochen', 3),
   X('Schale 2 einrühren und 10–12 Min. unter häufigem Rühren köcheln, bis die Kritharaki gar und sämig sind', 11),
   X('Abschmecken, Deckel drauf und beiseitestellen', 1),
   X('Die Pfanne mit dem Olivenöl sehr heiß werden lassen', 2),
   X('Ein Drittel aus Schale 3 scharf anbraten, bis es Röstränder hat (3–4 Min.), auf den Teller', 4),
   X('Das zweite Drittel genauso', 4),
   X('Das letzte Drittel mit Schale 4 zusammen 4–5 Min. braten, dann alles Gyros zurück in die Pfanne', 5),
  ]),
  ('Portionieren', fuellen('Den Kritharaki-Topf') + [
   X('Das Gyros mit den Zwiebeln gleichmäßig auf die 8 Boxen verteilen', 3),
   X('200 g Feta über die Boxen bröseln, je 25 g', 2),
   X('Das Tzatziki (Schale 5) in 8 Döschen füllen, je ca. 90 g', 3),
   X('Die Döschen gleich mit Deckel kalt stellen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Kritharaki sind griechische Nudeln in Reisform, du findest sie neben der Pasta. Orzo ist dasselbe.'],
 pauschal=[('Gyros-Gewürze', 20)],
))

# ======================================================================= 10 Bolognese
R.append(dict(
 id='bolognese', name='Spaghetti Bolognese', short='Bolognese',
 desc='Langsam geschmortes Ragù aus zweierlei Rinderhack mit Soffritto und einem Schuss Milch, Spaghetti und Parmesan.',
 protein='Rind', base='Nudeln', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch (max. 20 % Fett)', '500 g', 'rinderhack', 500, 'g', '1 × 500 g'),
  I('Rinderhackfleisch mager (max. 5 % Fett)', '400 g', 'rinderhack-mager', 400, 'g', '1 × 400 g'),
  I('Spaghetti', '320 g', 'spaghetti', 320, 'g', 'aus 500-g-Packung'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Möhren', '2 Stück (200 g)', 'moehren', 200, 'g'),
  I('Staudensellerie', '2 Stangen (150 g)', 'staudensellerie', 2, 'Stange'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Stückige Tomaten', '2 Dosen à 400 g', 'tomaten-dose', 2, 'Dose'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Milch 1,5 %', '100 ml', 'milch', 100, 'ml'),
  I('Parmesan', '60 g', 'parmesan', 60, 'g'),
  I('Rinderbrühe', '200 ml', 'bruehe-rind', pantry=True),
  I('Zucker', '1 TL (5 g)', 'zucker', pantry=True),
  I('Basilikum, frisch', 'zum Servieren', 'basilikum', opt=True),
 ],
 spices=[S('Oregano','2 TL','oregano'), S('Basilikum, getrocknet','1 TL','basilikum-getr'), S('Thymian','1 TL','thymian'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Muskat','1 Prise','muskat'), S('Chiliflocken (optional)','½ TL','chiliflocken'),
  S('Salz','1 TL + zum Abschmecken + fürs Nudelwasser','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Soffritto', 'groß'), ('Knoblauch & Tomatenmark', 'klein'), ('Kräuter & Würze', 'klein'), ('Parmesan', 'klein')],
 geraete=['großer Topf mit Deckel', 'zweiter Topf für die Nudeln', 'Sieb', 'Messbecher', 'Tasse', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('2 Zwiebeln (200 g) schälen und sehr fein würfeln → Schale 1', Z('zwiebel-wuerfel', 2)),
   X('2 Möhren (200 g) schälen und sehr fein würfeln → Schale 1', Z('moehre-fein', 2)),
   X('2 Stangen Staudensellerie (150 g) waschen und sehr fein würfeln → Schale 1', Z('sellerie-fein', 2)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 4)),
   X('70 g Tomatenmark abwiegen → Schale 2', 1),
   X('In Schale 3 abmessen:', Z('gewuerze', 7), liste=['2 TL Oregano', '1 TL Basilikum', '1 TL Thymian', '1 TL Zucker',
     '1 TL Salz', '1 TL Pfeffer', 'wer mag: ½ TL Chiliflocken']),
   X('2 Dosen stückige Tomaten öffnen, 2 Lorbeerblätter danebenlegen', 1),
   X('200 ml heiße Rinderbrühe anrühren → Messbecher', 2),
   X('100 ml Milch abmessen → Tasse', 1),
   X('60 g Parmesan fein reiben → Schale 4, 1 Prise Muskat dazu', Z('kaese-reiben', 0.6) + 1),
   X('320 g Spaghetti abwiegen und neben den Herd legen', 1),
   leer_wiegen('Den großen Topf'),
  ]),
  ('Kochen', [
   X('Topf stark erhitzen, 500 g Rinderhack (20 %) ohne Öl hinein und 2 Min. liegen lassen', 3),
   X('Krümelig braun braten', 4),
   X('400 g mageres Rinderhack dazu und alles braun braten', 5),
   X('Schale 1 dazu und 6–8 Min. weich dünsten', 7),
   X('Schale 2 dazu und 2 Min. mitrösten', 2),
   X('Die Milch (100 ml) dazugießen und köcheln, bis sie fast verkocht ist – macht das Fleisch zart', 3),
   X('Tomaten, Brühe, Schale 3 und Lorbeer einrühren und aufkochen', 2),
   X('Zugedeckt mind. 45 Min. leise köcheln, ab und zu umrühren – länger schadet nicht', 45),
   W('Nach 30 Min.: im zweiten Topf Nudelwasser aufsetzen und salzen', 1, ruhe=10),
   W('Die Spaghetti 2 Min. kürzer kochen als auf der Packung', 1, ruhe=8),
   W('Etwas Kochwasser in die Tasse von der Milch schöpfen, Spaghetti abgießen', 1),
   X('Lorbeer herausnehmen', 1),
   X('Mit Salz abschmecken', 1),
   X('Spaghetti und Schale 4 unter das Ragù mischen, mit etwas Kochwasser geschmeidig ziehen', 3),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Das Ragù schmeckt am nächsten Tag noch runder. Du kannst es auch am Vorabend kochen und die Nudeln frisch dazu machen.',
       'Soffritto geht im Zerkleinerer in 5 Min.',
       'Frisches Basilikum erst beim Essen drüberzupfen.'],
 pauschal=[('Gewürze', 8)],
))

# ======================================================================= 11 Lasagne
R.append(dict(
 id='lasagne', name='Lasagne mit Rinder-Ragù & Béchamel', short='Lasagne',
 desc='Ragù aus magerem Rind mit Zucchini, echte Béchamel aus Butter, Mehl und Milch, oben Parmesan. Als Blech in 8 Stücke geschnitten.',
 protein='Rind', base='Nudeln', method='Ofen', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '800 g', 'rinderhack-mager', 800, 'g', '2 × 400 g'),
  I('Lasagneplatten (ohne Vorkochen)', '225 g', 'lasagne', 225, 'g', 'aus 500-g-Packung'),
  I('Zwiebeln', '1–2 Stück (150 g)', 'zwiebeln', 150, 'g'),
  I('Möhren', '1–2 Stück (150 g)', 'moehren', 150, 'g'),
  I('Zucchini', '1 Stück (ca. 300 g)', 'zucchini', 1, 'Stk'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Passierte Tomaten', '1 kg', 'passata', 1000, 'g', '2 × 500 g'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Milch 1,5 %', '700 ml', 'milch', 700, 'ml'),
  I('Parmesan', '50 g', 'parmesan', 50, 'g'),
  I('Butter', '50 g', 'butter', pantry=True),
  I('Weizenmehl', '50 g', 'mehl', pantry=True),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Rinderbrühe', '200 ml', 'bruehe-rind', pantry=True),
 ],
 spices=[S('Oregano','2 TL','oregano'), S('Basilikum, getrocknet','1 TL','basilikum-getr'), S('Thymian','1 TL','thymian'),
  S('Lorbeerblatt','1 Stück','lorbeer'), S('Muskat','frisch gerieben','muskat'), S('Chiliflocken (optional)','½ TL','chiliflocken'),
  S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Soffritto', 'mittel'), ('Tomatenmark & Kräuter', 'klein'), ('Mehl & Würze', 'klein'), ('Parmesan', 'klein'), ('Zucchini', 'mittel')],
 geraete=['großer Topf', 'kleiner Topf', 'Schneebesen', 'Auflaufform ca. 25 × 30 cm, mind. 6 cm hoch', 'Messbecher', 'Tasse', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('150 g Zwiebeln schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 1.5)),
   X('150 g Möhren schälen und fein würfeln → Schale 1', Z('moehre-fein', 1.5)),
   X('3 Knoblauchzehen schälen und hacken → Schale 1', Z('knoblauch', 3)),
   X('1 Zucchini (300 g) in 1-cm-Würfel schneiden → Schale 5', Z('zucchini-wuerfel')),
   X('70 g Tomatenmark abwiegen → Schale 2', 1),
   X('In Schale 2 dazu: 2 TL Oregano, 1 TL Basilikum, 1 TL Thymian, wer mag ½ TL Chiliflocken', Z('gewuerze', 4)),
   X('2 Packungen passierte Tomaten (1 kg) öffnen, 1 Lorbeerblatt danebenlegen', 1),
   X('200 ml heiße Rinderbrühe anrühren → Tasse, 1 TL Salz und ½ TL Pfeffer einrühren', 2),
   X('10 g Öl abwiegen → in den großen Topf', 1),
   X('50 g Butter abwiegen → in den kleinen Topf', 1),
   X('50 g Mehl abwiegen → Schale 3, 1 TL Salz, ½ TL Pfeffer und 1 kräftige Prise Muskat dazu', 2),
   X('700 ml Milch abmessen → Messbecher', 1),
   X('50 g Parmesan fein reiben → Schale 4', Z('kaese-reiben', 0.5) + 1),
   X('225 g Lasagneplatten abwiegen', 1),
   leer_wiegen('Die Auflaufform'),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, 800 g mageres Rinderhack krümelig braun braten', 8),
   X('Schale 1 dazu und 5 Min. mitbraten', 5),
   X('Schale 2 dazu und 2 Min. rösten', 2),
   X('Passierte Tomaten, die Brühe aus der Tasse und das Lorbeerblatt dazu, aufkochen', 2),
   X('Halb zugedeckt 20 Min. köcheln', 20),
   W('Ofen auf 180 °C Umluft vorheizen', 1, ruhe=10),
   W('Den kleinen Topf mit der Butter auf mittlere Hitze; wenn sie schäumt, Schale 3 einrühren und 1–2 Min. anschwitzen', 2),
   W('Die kalte Milch in 3 Portionen einrühren, aufkochen und 3–4 Min. köcheln, bis die Béchamel andickt', 6),
   W('Vom Herd nehmen und die Hälfte von Schale 4 einrühren', 1),
   X('Schale 5 unterrühren und 5 Min. weiterköcheln – die Sauce darf flüssig sein, die Platten saugen', 5),
   X('Lorbeer herausnehmen', 1),
   X('Etwas Ragù auf den Boden der Form streichen', 1),
   X('Abwechselnd Platten, Ragù und Béchamel schichten: 3 Lagen, oben Béchamel – Platten passend brechen', 6),
   X('Den restlichen Parmesan aus Schale 4 darüberstreuen', 1),
   X('35–40 Min. backen, bis die Oberfläche goldbraun ist und ein Messer leicht durch die Platten geht', 38),
   X('10 Min. ruhen lassen', 10),
  ]),
  ('Portionieren', [
   X('Die Form wiegen und im Rechner bei „Mit Essen“ eintragen', 1),
   X('In 2 × 4 gleich große Stücke schneiden und in die Boxen heben', 5),
   ABKUEHLEN,
  ]),
 ],
 tips=['Die Béchamel wird klumpenfrei, wenn die Milch kalt ist und in drei Portionen kommt.',
       'Für mehr Volumen passt eine Handvoll Babyspinat in die Ragù-Schicht, das ändert die Werte kaum.'],
 pauschal=[('Gewürze', 8)],
))

# ======================================================================= 12 Ofen-Hähnchen
R.append(dict(
 id='ofen-haehnchen', name='Ofen-Hähnchen mit Kartoffeln & Kräuterquark', short='Ofen-Hähnchen',
 desc='Hähnchen, Kartoffeln, Paprika und Zucchini vom Blech mit Rosmarin, dazu kalter Kräuterquark.',
 protein='Hähnchen', base='Kartoffeln', method='Ofen', fridge='4 Tage', freeze='2 Monate, ohne Quark',
 items=[
  I('Hähnchenbrustfilet', '400 g', 'haehnchenbrust', 400, 'g', '1 × 400 g'),
  I('Hähnchen-Oberkeulenfilet', '500 g', 'haehnchenkeule', 500, 'g', '1 × 500 g'),
  I('Kartoffeln, festkochend', '1,5 kg', 'kartoffeln', 1500, 'g', 'aus 2-kg-Beutel'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Zucchini', '2 Stück (ca. 600 g)', 'zucchini', 2, 'Stk'),
  I('Rote Zwiebeln', '3 Stück (300 g)', 'rote-zwiebeln', 300, 'g'),
  I('Knoblauch', '1 Knolle (8 Zehen)', 'knoblauch', 8, 'Zehe'),
  I('Magerquark', '250 g', 'magerquark', 250, 'g', '1 Becher'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=20),
  I('TK-Kräuter', '2 EL', 'tk-kraeuter', 1, 'Pck', 'oder frische Kräuter'),
  I('Olivenöl', '70 g', 'olivenoel', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
  H('Kleine Döschen mit Deckel', '8 Stück für den Kräuterquark', 'doeschen'),
 ],
 spices=[S('Paprika edelsüß','2 EL','paprika-edelsuess'), S('Paprika geräuchert','2 TL','paprika-geraeuchert'),
  S('Rosmarin, getrocknet','1 EL','rosmarin'), S('Thymian','1 TL','thymian'), S('Oregano','1 TL','oregano'),
  S('Chiliflocken','½ TL','chiliflocken'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Hähnchen', 'groß'), ('Gemüse', 'groß'), ('Kräuterquark', 'mittel')],
 geraete=['2 Backbleche', 'große Schüssel zum Mischen', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('Ofen auf 200 °C Umluft vorheizen – zwei Bleche gehen nur mit Umluft', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('1,5 kg Kartoffeln gründlich waschen und ungeschält in 2-cm-Würfel schneiden → Schale 1',
     Z('kartoffel-waschen', 15) + Z('kartoffel-wuerfel', 15)),
   X('In Schale 1 mischen: 40 g Olivenöl, 1 EL Paprika edelsüß, 1 EL Rosmarin, 1 TL Salz', 2),
   X('In Schale 2 abmessen:', 4, liste=['20 g Olivenöl', '1 EL Paprika edelsüß', '2 TL Paprika geräuchert', '1 TL Thymian',
     '1 TL Oregano', '½ TL Chiliflocken', '½ TL Pfeffer', '1 TL Salz']),
   X('400 g Hähnchenbrust und 500 g Oberkeulenfilet in 3-cm-Stücke schneiden → Schale 2 und gut mischen', Z('fleisch', 9)),
   ABWASCHEN,
   leer_wiegen('Die große Schüssel'),
  ]),
  ('Kochen', [
   X('Schale 1 auf beide Bleche verteilen', 2),
   X('Bleche in den Ofen, 20 Min. backen', 20),
   W('3 Paprika (480 g) in grobe Stücke schneiden → Schale 3', Z('paprika-stuecke', 3)),
   W('2 Zucchini (600 g) in dicke Halbmonde schneiden → Schale 3', Z('zucchini-scheiben', 2)),
   W('3 rote Zwiebeln (300 g) schälen und in Spalten schneiden → Schale 3', Z('zwiebel-streifen', 3)),
   W('7 Knoblauchzehen ungeschält mit dem Messerrücken andrücken → Schale 3', 1),
   W('10 g Olivenöl und ½ TL Salz in Schale 3 geben und alles mischen', 1),
   X('Bleche herausnehmen', 1),
   X('Schale 2 und Schale 3 je zur Hälfte auf beide Bleche verteilen und alles wenden', 3),
   X('Hände waschen', 1),
   X('20–25 Min. weiterbacken, bis das Hähnchen durch ist und die Kartoffeln goldbraun sind', 23),
   W('Die letzte Knoblauchzehe schälen und fein reiben → Schale 4', 1),
   W('In Schale 4 dazu und glatt rühren:', 3, liste=['250 g Magerquark', '2 EL TK-Kräuter', 'Saft von ½ Zitrone', '½ TL Pfeffer',
     '1 Prise Salz', '2–3 EL Wasser']),
  ]),
  ('Portionieren', [
   X('Alles vom Blech in die große Schüssel', 2),
   X('Den gerösteten Knoblauch aus der Haut drücken und alles gut mischen', 2),
  ] + fuellen('Die Schüssel') + [
   X('Den Kräuterquark (Schale 4) in 8 Döschen füllen, je ca. 40 g', 3),
   X('Die Döschen gleich mit Deckel kalt stellen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Nicht zu voll packen: Liegt alles übereinander, dämpft es statt zu rösten. Lieber auf zwei Bleche verteilen.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 13 Erdnuss-Nudeln
R.append(dict(
 id='erdnuss-nudeln', name='Erdnuss-Nudelpfanne mit Hähnchen', short='Erdnuss-Nudeln',
 desc='Mie-Nudeln, Hähnchen und viel knackiges Gemüse in Erdnuss-Limetten-Sauce.',
 protein='Hähnchen', base='Nudeln', method='Wok / Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Mie-Nudeln', '250 g', 'mie', 250, 'g', '1 Packung'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Möhren', '3 Stück (300 g)', 'moehren', 300, 'g'),
  I('Spitzkohl', '400 g (ca. ½ Kopf)', 'spitzkohl', 400, 'g'),
  I('Frühlingszwiebeln', '1 Bund', 'fruehlingszwiebeln', 1, 'Bund'),
  I('Erdnussbutter (creamy oder crunchy)', '140 g', 'erdnussbutter', 140, 'g', 'Glas'),
  I('Limetten', '2 Stück', 'limette', 2, 'Stk'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g', 'ingwer', 20, 'g'),
  I('Sojasauce', '100 ml', 'sojasauce', pantry=True),
  I('Honig', '40 g (2 EL)', 'honig', pantry=True),
  I('Öl, neutral', '30 g', 'oel', pantry=True),
  I('Sriracha', '1–2 TL', 'sriracha', pantry=True),
 ],
 spices=[S('Chiliflocken (optional)','nach Schärfe','chiliflocken'), S('Salz','für das Nudelwasser','salz')],
 schalen=[('Hähnchen', 'groß'), ('Paprika & Möhren', 'groß'), ('Spitzkohl', 'groß'), ('Erdnuss-Sauce', 'mittel'), ('Frühlingszwiebeln', 'klein')],
 geraete=['Wok oder große Pfanne', 'großer Topf', 'Sieb', 'Reibe', 'Tasse fürs Öl'],
 ablauf=[
  ('Vorbereiten', [
   X('4 Knoblauchzehen schälen und fein reiben → Schale 4', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 4', Z('ingwer')),
   X('2 Limetten auspressen → Schale 4', 2),
   X('In Schale 4 dazu und glatt rühren, bis es dickflüssig ist:', 4, liste=['140 g Erdnussbutter', '100 ml Sojasauce', '40 g Honig',
     '1–2 TL Sriracha', 'wer mag: ½ TL Chiliflocken', '150 ml heißes Wasser']),
   X('3 Paprika (480 g) in Streifen schneiden → Schale 2', Z('paprika-streifen', 3)),
   X('3 Möhren (300 g) schälen und in feine Stifte schneiden → Schale 2', Z('moehre-fein', 3)),
   X('400 g Spitzkohl in feine Streifen schneiden → Schale 3', Z('spitzkohl', 4)),
   X('1 Bund Frühlingszwiebeln in Ringe schneiden → Schale 5', Z('fruehlingszwiebeln')),
   leer_wiegen('Den großen Topf'),
   X('Nudelwasser im großen Topf aufsetzen und salzen', 1, ruhe=10),
   X('30 g Öl abwiegen → Tasse', 1),
   X('800 g Hähnchenbrust in Streifen schneiden → Schale 1', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('250 g Mie-Nudeln nach Packung kochen, meist 4 Min.', 4),
   X('Abgießen, kurz kalt abschrecken, damit sie nicht weiter garen', 2),
   X('Die Nudeln zurück in den großen Topf', 1),
   X('Die Hälfte vom Öl im Wok stark erhitzen, Schale 1 in 2 Portionen je 4 Min. braten, in den großen Topf', 9),
   X('Restliches Öl in den Wok, Schale 2 darin 3 Min. braten', 3),
   X('Schale 3 dazu und 2 Min. mitbraten – das Gemüse soll knackig bleiben, dann in den großen Topf', 2),
   X('Schale 4 in den großen Topf und alles bei mittlerer Hitze 2 Min. schwenken', 2),
   X('Schale 5 unterheben', 1),
   X('Abschmecken, bei Bedarf mit einem Schuss Sojasauce', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Vor dem Aufwärmen 1–2 EL Wasser dazugeben, die Erdnusssauce dickt im Kühlschrank nach.',
       'Mit einem Julienne-Schäler gehen die Möhrenstifte doppelt so schnell.'],
 pauschal=[('Gewürze & Sriracha', 3)],
))

# ======================================================================= 14 Geschnetzeltes
R.append(dict(
 id='geschnetzeltes', name='Puten-Geschnetzeltes mit Champignons & Reis', short='Geschnetzeltes',
 desc='Zarte Putenstreifen und kräftig gebratene Champignons in Rahmsauce mit Senf und Thymian.',
 protein='Pute', base='Reis', method='Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Putenbrust, geschnetzelt', '800 g', 'putenbrust', 800, 'g', '2 × 400 g'),
  I('Champignons', '800 g', 'champignons', 800, 'g', '2 × 400 g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '2 Zehen', 'knoblauch', 2, 'Zehe'),
  I('Kochsahne 15 %', '400 g', 'kochsahne', 400, 'g', '2 Becher à 200 g'),
  I('Schmand', '200 g', 'schmand', 200, 'g', '1 Becher'),
  I('Basmatireis', '330 g', 'reis', 330, 'g'),
  I('Hühner- oder Gemüsebrühe', '300 ml', 'bruehe-huhn', pantry=True),
  I('Senf, mittelscharf', '1 EL (15 g)', 'senf', pantry=True),
  I('Speisestärke', '10 g', 'staerke', pantry=True),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Petersilie, frisch', '½ Bund', 'petersilie', opt=True),
 ],
 spices=[S('Paprika edelsüß','2 TL','paprika-edelsuess'), S('Thymian','1 TL','thymian'), S('Muskat','1 Prise','muskat'),
  S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Pute', 'groß'), ('Champignons', 'groß'), ('Zwiebeln & Knoblauch', 'mittel'), ('Sahne-Schmand', 'mittel'), ('Stärke', 'klein')],
 geraete=['Bräter oder Schmorpfanne (mind. 4 l)', 'kleiner Topf mit Deckel', 'Sieb', 'Messbecher', '2 Teller'],
 ablauf=[
  ('Vorbereiten', [
   reis_vorbereiten(330, 500),
   X('800 g Champignons putzen und in Scheiben schneiden → Schale 2', Z('champignons', 8)),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 3', Z('zwiebel-wuerfel', 2)),
   X('2 Knoblauchzehen schälen und hacken → Schale 3', Z('knoblauch', 2)),
   X('In Schale 4 glatt rühren:', 3, liste=['400 g Kochsahne', '200 g Schmand', '1 EL Senf', '1 TL Thymian', '1 TL Salz',
     '½ TL Pfeffer', '1 Prise Muskat']),
   X('10 g Speisestärke mit 3 EL kaltem Wasser verrühren → Schale 5', 1),
   X('300 ml heiße Brühe anrühren → Messbecher', 2),
   leer_wiegen('Den Bräter'),
   X('10 g Öl abwiegen → in den Bräter', 1),
   X('In Schale 1 abmessen: 2 TL Paprika edelsüß, 1 TL Salz, ½ TL Pfeffer', Z('gewuerze', 3)),
   X('800 g Putenbrust trocken tupfen → Schale 1 und mit den Gewürzen mischen', 3),
   X('Hände und Brett waschen', 1),
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den Bräter mit dem Öl stark erhitzen, Schale 1 in 2 Portionen je 2–3 Min. scharf anbraten, auf einen Teller – sie gart später fertig', 6),
   X('Die Hälfte aus Schale 2 in den heißen Bräter, 4 Min. nicht rühren, dann rundum bräunen, auf den zweiten Teller', 6),
   X('Die zweite Hälfte genauso, dann alle Pilze zurück in den Bräter', 6),
   X('Schale 3 dazu und 3 Min. mitbraten', 3),
   X('Mit der Brühe ablöschen und den Bratensatz lösen', 1),
   X('Schale 4 einrühren und aufkochen', 2),
   X('Schale 5 aufrühren, in die Sauce rühren und 1 Min. köcheln, bis sie bindet', 1),
   X('Pute samt Saft zurück und bei kleiner Hitze 3–4 Min. ziehen lassen, bis sie innen nicht mehr rosa ist – nicht sprudelnd kochen', 4),
   X('Mit Salz abschmecken', 1),
   X('Den Reis unterheben', 2),
  ]),
  ('Portionieren', fuellen('Den Bräter') + [ABKUEHLEN]),
 ],
 tips=['Putenbrust wird schnell trocken. Lieber kurz und heiß anbraten und in der Sauce nur ziehen lassen.',
       'Petersilie erst beim Essen drüberstreuen.'],
 pauschal=[('Gewürze', 6)],
))

# ======================================================================= 15 Balkan-Hackpfanne
R.append(dict(
 id='balkan-pfanne', name='Balkan-Hackpfanne mit Kartoffeln, Ajvar & Feta', short='Balkan-Hackpfanne',
 desc='Gewürztes Rinderhack, angebratene Kartoffeln und Paprika, geschmort in Ajvar, mit Feta und kaltem Knoblauch-Skyr.',
 protein='Rind', base='Kartoffeln', method='Pfanne', fridge='4 Tage', freeze='2 Monate, ohne Skyr',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '800 g', 'rinderhack-mager', 800, 'g', '2 × 400 g'),
  I('Kartoffeln, festkochend', '1,45 kg', 'kartoffeln', 1450, 'g', 'aus 2-kg-Beutel'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Zwiebeln', '3 Stück (300 g)', 'zwiebeln', 300, 'g'),
  I('Knoblauch', '5 Zehen', 'knoblauch', 5, 'Zehe'),
  I('Ajvar, mild', '1 Glas (350 g)', 'ajvar', 1, 'Glas'),
  I('Feta', '200 g', 'feta', 200, 'g', '1 Packung'),
  I('Skyr natur', '250 g', 'skyr', 250, 'g', 'aus 500-g-Becher'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=15),
  I('Öl, neutral', '15 g', 'oel', pantry=True),
  I('Gemüsebrühe', '300 ml', 'bruehe-gemuese', pantry=True),
  I('Petersilie, frisch', '½ Bund', 'petersilie', opt=True),
  H('Kleine Döschen mit Deckel', '8 Stück für den Knoblauch-Skyr', 'doeschen'),
 ],
 spices=[S('Paprika edelsüß','1 EL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Oregano','1 TL','oregano'), S('Majoran','1 TL','majoran'),
  S('Chiliflocken','½ TL','chiliflocken'), S('Knoblauchpulver','½ TL','knoblauchpulver'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Hack-Gewürze', 'klein'), ('Zwiebeln & Paprika', 'groß'), ('Knoblauch', 'klein'), ('Knoblauch-Skyr', 'mittel')],
 geraete=['großer Bräter (mind. 5 l)', 'großer Topf', 'Sieb', 'Messbecher (1 l)', 'Teller fürs Hack'],
 ablauf=[
  ('Vorbereiten', [
   X('1,45 kg Kartoffeln waschen und ungeschält in 1,5-cm-Würfel schneiden → Schale 1',
     Z('kartoffel-waschen', 14.5) + Z('kartoffel-wuerfel', 14.5) + 1),
   X('3 Zwiebeln (300 g) schälen und in Streifen schneiden → Schale 3', Z('zwiebel-streifen', 3)),
   X('3 Paprika (480 g) in mundgerechte Stücke schneiden → Schale 3', Z('paprika-stuecke', 3)),
   X('4 Knoblauchzehen schälen und hacken → Schale 4', Z('knoblauch', 4)),
   X('Großen Topf mit Salzwasser für die Kartoffeln aufsetzen', 1, ruhe=12),
   X('1 Knoblauchzehe schälen und fein reiben → Schale 5', Z('knoblauch')),
   X('In Schale 5 dazu und verrühren, dann kalt stellen:', 2, liste=['250 g Skyr', 'Saft von ½ Zitrone', '½ TL Salz', '1 Prise Pfeffer']),
   X('In Schale 2 abmessen: 1 EL Paprika edelsüß, 1 TL Paprika geräuchert, 1 TL Kreuzkümmel, ½ TL Knoblauchpulver, 1 TL Salz', Z('gewuerze', 5)),
   X('Im Messbecher verrühren:', 3, liste=['1 Glas Ajvar (350 g)', '300 ml heiße Gemüsebrühe', '1 TL Oregano', '1 TL Majoran',
     '½ TL Chiliflocken', '1 TL Pfeffer']),
   leer_wiegen('Den Bräter'),
   X('15 g Öl abwiegen → in den Bräter', 1),
  ]),
  ('Kochen', [
   X('Schale 1 ins kochende Salzwasser und 7–8 Min. vorkochen – sie sollen noch Biss haben', 8),
   X('Abgießen und im Sieb ausdampfen lassen', 2),
   X('Den Bräter mit dem Öl stark erhitzen, 800 g mageres Rinderhack krümelig braun braten', 8),
   X('Hitze auf mittel, Schale 2 darüberstreuen und unter Rühren 30 Sek. mitbraten', 1),
   X('Das Hack auf den Teller', 1),
   X('Schale 3 in den Bräter und 5 Min. braten', 5),
   X('Schale 4 dazu und 1 Min. mitbraten', 1),
   X('Die Kartoffeln dazu und 8–10 Min. braten, bis sie etwas Farbe haben', 9),
   X('Hack und den Messbecher dazu, 5 Min. schmoren, bis alles sämig ist', 5),
   X('Mit Salz abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Bräter') + [
   X('200 g Feta über die Boxen bröseln, je 25 g', 2),
   X('Den Knoblauch-Skyr (Schale 5) in 8 Döschen füllen, je ca. 32 g', 3),
   X('Die Döschen gleich mit Deckel kalt stellen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Ajvar gibt es mild und scharf. Mit scharfem Ajvar kannst du die Chiliflocken weglassen.',
       'Petersilie erst beim Essen drüberstreuen.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 16 Gnocchi
R.append(dict(
 id='gnocchi', name='Hähnchen-Gnocchi-Pfanne mit Tomate & Spinat', short='Gnocchi-Pfanne',
 desc='Knusprig gebratene Gnocchi, Hähnchen und Kirschtomaten in cremiger Tomatensauce mit Parmesan.',
 protein='Hähnchen', base='Gnocchi', method='Pfanne', fridge='3 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Gnocchi (Kühlregal)', '800 g', 'gnocchi', 800, 'g', '2 × 400 g'),
  I('Kirschtomaten', '500 g', 'kirschtomaten', 500, 'g', '2 Schalen à 250 g'),
  I('Babyspinat', '200 g', 'spinat', 200, 'g', '1 Beutel'),
  I('Zwiebel', '1 Stück (100 g)', 'zwiebeln', 100, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Passierte Tomaten', '500 g', 'passata', 500, 'g', '1 Packung'),
  I('Frischkäse leicht', '200 g', 'frischkaese', 200, 'g', '1 Packung'),
  I('Kochsahne 15 %', '200 g', 'kochsahne', 200, 'g', '1 Becher'),
  I('Parmesan', '50 g', 'parmesan', 50, 'g'),
  I('Olivenöl', '35 g', 'olivenoel', pantry=True),
  I('Gemüsebrühe (Pulver)', '1 TL', 'bruehe-gemuese', pantry=True),
  I('Basilikum, frisch', 'zum Servieren', 'basilikum', opt=True),
 ],
 spices=[S('Italienische Kräuter','2 TL','ital-kraeuter'), S('Paprika edelsüß','1 TL','paprika-edelsuess'),
  S('Chiliflocken','½ TL','chiliflocken'), S('Salz','1½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebel & Knoblauch', 'klein'), ('Kirschtomaten', 'mittel'), ('Parmesan', 'klein')],
 geraete=['große Pfanne', 'großer Topf zum Mischen', 'Messbecher (1 l)', 'Schneebesen', 'Tasse fürs Öl', 'Teller'],
 ablauf=[
  ('Vorbereiten', [
   X('1 Zwiebel (100 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel')),
   X('4 Knoblauchzehen schälen und hacken → Schale 2', Z('knoblauch', 4)),
   X('500 g Kirschtomaten waschen und halbieren → Schale 3', Z('kirschtomaten', 5)),
   X('Im Messbecher glatt rühren:', 3, liste=['500 g passierte Tomaten', '200 g Kochsahne', '200 g Frischkäse',
     '1 TL Gemüsebrühe (Pulver)', '2 TL italienische Kräuter', '½ TL Chiliflocken', '½ TL Salz', '½ TL Pfeffer']),
   X('50 g Parmesan fein reiben → Schale 4', Z('kaese-reiben', 0.5) + 1),
   X('35 g Olivenöl abwiegen → Tasse', 1),
   leer_wiegen('Den großen Topf'),
   X('In Schale 1 abmessen: 1 TL Paprika edelsüß, 1 TL Salz, ½ TL Pfeffer', Z('gewuerze', 3)),
   X('800 g Hähnchenbrust in Würfel schneiden → Schale 1 und mit den Gewürzen mischen', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Ein Viertel vom Öl in der Pfanne erhitzen, die erste Packung Gnocchi 6–8 Min. goldbraun braten – nicht vorher kochen', 8),
   X('Die Gnocchi in den großen Topf', 1),
   X('Das nächste Viertel Öl in die Pfanne und die zweite Packung genauso braten', 8),
   X('Ebenfalls in den großen Topf', 1),
   X('Das dritte Viertel Öl in die Pfanne, Schale 1 in 2 Portionen je 3 Min. anbraten, auf den Teller', 7),
   X('Restliches Öl in die Pfanne, Schale 2 darin 3 Min. braten', 3),
   X('Schale 3 dazu und 3 Min. mitbraten, bis die Tomaten leicht aufplatzen', 3),
   X('Den Messbecher einrühren und 5 Min. köcheln', 5),
   X('200 g Babyspinat handvollweise unterheben', 2),
   X('Hähnchen zurück und 4 Min. ziehen lassen, bis es durch ist', 4),
   X('Schale 4 einrühren', 1),
   X('Alles zu den Gnocchi in den Topf und mischen', 2),
   X('Mit Salz abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Die Gnocchi werden in der Box weicher. Wer sie knusprig mag, lagert sie getrennt und brät sie beim Aufwärmen kurz an.',
       'Frisches Basilikum erst beim Essen drüberzupfen.'],
 pauschal=[('Gewürze & Brühpulver', 6)],
))

# ======================================================================= 17 Gelbes Curry
R.append(dict(
 id='gelbes-curry', name='Gelbes Hähnchen-Curry mit Süßkartoffel & Spinat', short='Gelbes Curry',
 desc='Mildes Kokos-Curry mit Hähnchen, Süßkartoffel, Spinat und Limette, dazu Basmati.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '1 kg', 'haehnchenbrust', 1000, 'g', '2 × 500 g'),
  I('Süßkartoffel', '500 g (1 große)', 'suesskartoffel', 500, 'g'),
  I('Basmati- oder Jasminreis', '220 g', 'reis', 220, 'g'),
  I('Kokosmilch', '1 Dose à 400 ml', 'kokosmilch', 1, 'Dose'),
  I('Babyspinat', '250 g', 'spinat', 250, 'g', '2 × 125 g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Öl, neutral', '30 g', 'oel', pantry=True),
  I('Hühnerbrühe', '300 ml', 'bruehe-huhn', pantry=True),
 ],
 spices=[S('Currypulver','2 EL','currypulver'), S('Kurkuma','1 TL','kurkuma'), S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'),
  S('Koriander, gemahlen','1 TL','koriander-gem'), S('Chiliflocken','½–1 TL','chiliflocken'), S('Salz','2 TL + zum Abschmecken','salz'),
  S('Pfeffer','½ TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln, Knobi & Ingwer', 'mittel'), ('Gewürze', 'klein'), ('Süßkartoffel', 'groß'),
          ('Limettensaft', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Teller fürs Hähnchen', 'Messbecher', 'Sieb', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(220, 330),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 2', Z('ingwer')),
   X('In Schale 3 abmessen:', Z('gewuerze', 6), liste=['2 EL Currypulver', '1 TL Kurkuma', '1 TL Kreuzkümmel', '1 TL Koriander, gemahlen',
     '½–1 TL Chiliflocken', '½ TL Pfeffer']),
   X('500 g Süßkartoffel schälen und in 2-cm-Würfel schneiden → Schale 4', Z('suesskartoffel', 5)),
   X('300 ml heiße Hühnerbrühe anrühren → Messbecher', 2),
   X('1 Dose Kokosmilch öffnen und mit dem Löffel glatt rühren', 1),
   X('1 Limette auspressen → Schale 5', 1),
   X('30 g Öl abwiegen und in den großen Topf geben', 1),
   X('1 kg Hähnchenbrust in 3-cm-Würfel schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 10)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 3–4 Min. braten, bis es Farbe hat, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 4 Min. glasig dünsten', 4),
   X('Schale 3 einrühren und 1 Min. rösten, bis es duftet', 1),
   X('Mit der Brühe aus dem Messbecher ablöschen, Kokosmilch und Schale 4 dazu, aufkochen', 3),
   X('Zugedeckt 12 Min. köcheln, bis die Süßkartoffel fast weich ist', 12),
   X('Hähnchen samt Saft vom Teller dazu und 5 Min. offen köcheln, bis es durch ist', 5),
   X('250 g Babyspinat handvollweise einrühren, bis er zusammenfällt', 2),
   X('Schale 5 einrühren, mit Salz abschmecken', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Curry-Topf') + [ABKUEHLEN]),
 ],
 tips=['Mit TK-Blattspinat (250 g, aufgetaut und ausgedrückt) geht es genauso.',
       'Schärfer: 1 frische Chili fein gehackt mit in Schale 2.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 18 Shawarma-Bowl
R.append(dict(
 id='shawarma-bowl', name='Hähnchen-Shawarma-Bowl mit Bulgur & Joghurt-Sauce', short='Shawarma-Bowl',
 desc='Kräftig gewürzte Hähnchenkeule aus dem Ofen auf Bulgur mit Tomaten-Gurken-Salat und kalter Knoblauch-Joghurt-Sauce.',
 protein='Hähnchen', base='Bulgur', method='Ofen + Topf', fridge='4 Tage', freeze='2 Monate, ohne Salat und Sauce',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1 kg', 'haehnchenkeule', 1000, 'g', '2 × 500 g'),
  I('Bulgur', '360 g', 'bulgur', 360, 'g', 'aus 500-g-Packung'),
  I('Tomaten', '400 g (4 Stück)', 'tomaten', 400, 'g'),
  I('Salatgurke', '1 Stück (ca. 300 g)', 'gurke', 1, 'Stk'),
  I('Rote Zwiebeln', '1 Stück (100 g)', 'rote-zwiebeln', 100, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Zitrone', '1 Stück', 'zitrone', 1, 'Stk'),
  I('Skyr natur', '300 g', 'skyr', 300, 'g', '2 Becher à 150 g'),
  I('Joghurt 1,5 %', '150 g', 'joghurt', 150, 'g', '1 Becher'),
  I('Olivenöl', '30 g', 'olivenoel', pantry=True),
  I('Gemüsebrühe', '600 ml', 'bruehe-gemuese', pantry=True),
  I('Petersilie, frisch', '1 Bund für den Salat', 'petersilie', opt=True),
  H('Backpapier', '1 Blatt fürs Blech', 'backpapier'),
  H('Kleine Döschen mit Deckel', '8 Stück für die Sauce', 'doeschen'),
 ],
 spices=[S('Kreuzkümmel, gemahlen','2 TL','kreuzkuemmel'), S('Paprika edelsüß','2 TL','paprika-edelsuess'),
  S('Paprika geräuchert','1 TL','paprika-geraeuchert'), S('Koriander, gemahlen','1 TL','koriander-gem'), S('Kurkuma','1 TL','kurkuma'),
  S('Zimt','½ TL','zimt'), S('Piment, gemahlen','½ TL','piment'), S('Cayennepfeffer','½ TL','cayenne'),
  S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen in Marinade', 'groß'), ('Bulgur', 'mittel'), ('Salat', 'groß'), ('Joghurt-Sauce', 'mittel')],
 geraete=['Backblech', 'mittlerer Topf mit Deckel', 'Messbecher', 'Reibe', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   X('In Schale 1 abmessen und verrühren:', Z('gewuerze', 11), liste=['20 g Olivenöl', '2 TL Kreuzkümmel', '2 TL Paprika edelsüß',
     '1 TL Paprika geräuchert', '1 TL Koriander, gemahlen', '1 TL Kurkuma', '½ TL Zimt', '½ TL Piment', '½ TL Cayennepfeffer',
     '1 TL Knoblauchpulver', '1½ TL Salz', '1 TL Pfeffer']),
   X('½ Zitrone auspressen → Schale 1', 1),
   X('1 kg Hähnchen-Oberkeulenfilet in 2-cm-Streifen schneiden → Schale 1 und mit der Marinade mischen', Z('fleisch', 10)),
   X('Schale 1 abgedeckt kalt stellen, mind. 30 Min.', 1, ruhe=30),
   ABWASCHEN,
   X('Ofen auf 220 °C Umluft vorheizen', 1, ruhe=12),
   X('Blech mit Backpapier belegen', 1),
   X('360 g Bulgur abwiegen → Schale 2', 1),
   X('600 ml heiße Gemüsebrühe anrühren → Messbecher', 2),
   X('4 Tomaten (400 g) in 1-cm-Würfel schneiden → Schale 3', Z('tomate-wuerfel', 4)),
   X('1 Salatgurke (300 g) längs halbieren, Kerne mit dem Löffel herauskratzen, in Würfel schneiden → Schale 3', 3),
   X('1 rote Zwiebel (100 g) schälen und sehr fein würfeln → Schale 3', Z('zwiebel-wuerfel', 1)),
   X('In Schale 3 dazu: 10 g Olivenöl, Saft der anderen Zitronenhälfte, ½ TL Salz, gehackte Petersilie (wer mag), mischen', 2),
   X('3 Knoblauchzehen schälen und fein reiben → Schale 4', Z('knoblauch', 3)),
   X('In Schale 4 dazu und glatt rühren, dann kalt stellen:', 2, liste=['300 g Skyr', '150 g Joghurt', '½ TL Salz', '1 Prise Pfeffer']),
  ]),
  ('Kochen', [
   X('Schale 1 mit der ganzen Marinade auf dem Blech verteilen, nicht stapeln', 2),
   X('Blech oben in den Ofen, 18–20 Min. backen, bis die Ränder dunkel sind', 1, ruhe=19),
   W('Hände waschen', 1),
   W('Die Brühe im Topf aufkochen, Schale 2 einrühren', 2),
   W('Zugedeckt 10 Min. auf kleinster Hitze quellen lassen, dann vom Herd und 5 Min. ruhen lassen', 1, ruhe=15),
   X('Blech herausnehmen, Ofen aus', 1),
   X('Den Bulgur mit der Gabel auflockern', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Bulgur hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Bulgur auf die 8 Boxen verteilen', 3),
   X('Das Hähnchen samt Bratensaft vom Blech gleichmäßig auf die Boxen verteilen', 3),
   X('Schale 3 auf die Boxen verteilen, in die freie Ecke', 2),
   X('Die Sauce (Schale 4) in 8 Döschen füllen, je ca. 55 g', 3),
   X('Die Döschen gleich mit Deckel kalt stellen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Über Nacht mariniert schmeckt es noch mehr nach Imbiss, und die 30 Min. Wartezeit fallen weg.',
       'Die Sauce erst beim Essen über alles geben, sonst wird der Bulgur matschig.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 19 Jambalaya
R.append(dict(
 id='jambalaya', name='Jambalaya mit Hähnchen', short='Jambalaya',
 desc='Reis, Hähnchenkeule, Paprika, Sellerie und Bohnen aus einem Topf, würzig nach Cajun-Art.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1,2 kg', 'haehnchenkeule', 1200, 'g', '2 × 600 g'),
  I('Basmati- oder Jasminreis', '270 g', 'reis', 270, 'g'),
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk', '3er-Pack'),
  I('Staudensellerie', '2 Stangen', 'staudensellerie', 2, 'Stange'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Stückige Tomaten', '1 Dose à 400 g', 'tomaten-dose', 1, 'Dose'),
  I('Kidneybohnen', '1 Dose à 400 g (255 g abgetropft)', 'kidney', 1, 'Dose'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Hühnerbrühe', '700 ml', 'bruehe-huhn', pantry=True),
 ],
 spices=[S('Cajun-Gewürz','2 EL','cajun'), S('Paprika geräuchert','2 TL','paprika-geraeuchert'), S('Thymian','1 TL','thymian'),
  S('Oregano','1 TL','oregano'), S('Cayennepfeffer','½–1 TL','cayenne'), S('Lorbeerblätter','2 Stück','lorbeer'),
  S('Salz','1½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln, Sellerie & Co.', 'groß'), ('Knoblauch & Tomatenmark', 'klein'), ('Gewürze', 'klein'),
          ('Reis', 'mittel'), ('Bohnen', 'mittel')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Teller fürs Hähnchen', 'Messbecher', 'Sieb'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('2 Stangen Staudensellerie waschen und in kleine Würfel schneiden → Schale 2', Z('sellerie-fein', 2)),
   X('3 Paprika (480 g) waschen, entkernen und in 1-cm-Würfel schneiden → Schale 2', Z('paprika-wuerfel', 3)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 4)),
   X('35 g Tomatenmark abwiegen → Schale 3', 1),
   X('In Schale 4 abmessen:', Z('gewuerze', 7), liste=['2 EL Cajun-Gewürz', '2 TL Paprika geräuchert', '1 TL Thymian', '1 TL Oregano',
     '½–1 TL Cayennepfeffer', '1 TL Pfeffer', '1 TL Salz']),
   X('270 g Reis im Sieb waschen, bis das Wasser klar ist, abtropfen lassen → Schale 5', 3),
   X('1 Dose Kidneybohnen öffnen, im Sieb abspülen und abtropfen lassen → Schale 6', 2),
   X('1 Dose stückige Tomaten öffnen, 2 Lorbeerblätter danebenlegen', 1),
   X('700 ml heiße Hühnerbrühe anrühren → Messbecher', 2),
   X('20 g Öl abwiegen und in den großen Topf geben', 1),
   X('1,2 kg Hähnchen-Oberkeulenfilet in 3-cm-Stücke schneiden, grobes Fett wegschneiden, mit ½ TL Salz mischen → Schale 1', Z('fleisch', 12)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 4–5 Min. kräftig anbraten, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 6 Min. anschwitzen, bis die Zwiebeln glasig sind', 6),
   X('Schale 3 dazu und 2 Min. rösten', 2),
   X('Schale 4 einrühren und 1 Min. mitrösten', 1),
   X('Stückige Tomaten, Lorbeer und die Brühe aus dem Messbecher dazu, den Bodensatz loskratzen, aufkochen', 3),
   X('Hähnchen samt Saft vom Teller und Schale 5 einrühren', 1),
   X('Deckel drauf und 15 Min. auf kleinster Hitze köcheln – nicht umrühren, sonst wird der Reis klebrig', 15),
   X('Schale 6 obenauf geben, Deckel wieder drauf, Herd aus und 10 Min. ziehen lassen', 1, ruhe=10),
   X('Lorbeer herausnehmen, mit der Gabel auflockern und abschmecken', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Cajun-Gewürz gibt es fertig im Gewürzregal. Ersatz: je 1 TL Paprika, Knoblauchpulver, Zwiebelgranulat, Oregano, Thymian und ½ TL Cayenne.',
       'Klassisch kommt noch scharfe Wurst rein – mit ein paar Tropfen Sriracha pro Box kommst du dem Geschmack nahe.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 20 Frikassee
R.append(dict(
 id='frikassee', name='Hähnchen-Frikassee mit Reis', short='Frikassee',
 desc='Der Klassiker: Hähnchen, Erbsen, Möhren und Champignons in heller Zitronen-Rahmsauce, dazu Reis.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='3 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '900 g', 'haehnchenbrust', 900, 'g', 'Theke oder 1 × 500 g + 1 × 400 g'),
  I('Basmatireis', '260 g', 'reis', 260, 'g'),
  I('TK-Erbsen', '300 g', 'erbsen', 300, 'g', 'aus 450-g-Beutel'),
  I('Möhren', '300 g (3 Stück)', 'moehren', 300, 'g'),
  I('Champignons', '400 g', 'champignons', 400, 'g', '1 Schale'),
  I('Zwiebeln', '1 große (150 g)', 'zwiebeln', 150, 'g'),
  I('Kochsahne 15 %', '250 g', 'kochsahne', 250, 'g', '1 Becher'),
  I('Zitrone', '1 Stück', 'zitrone', 1, 'Stk'),
  I('Butter', '80 g', 'butter', pantry=True),
  I('Weizenmehl', '40 g', 'mehl', pantry=True),
  I('Hühnerbrühe', '800 ml', 'bruehe-huhn', pantry=True),
  I('Petersilie, frisch', 'zum Servieren', 'petersilie', opt=True),
 ],
 spices=[S('Muskatnuss','½ TL, frisch gerieben','muskat'), S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','2 TL','salz'),
  S('Pfeffer, weiß oder schwarz','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln', 'klein'), ('Champignons', 'mittel'), ('Mehl', 'klein'), ('Möhren', 'mittel'),
          ('Zum Schluss', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Teller fürs Hähnchen', 'Messbecher', 'Schneebesen', 'Sieb', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(260, 390),
   X('1 große Zwiebel (150 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 1.5)),
   X('400 g Champignons putzen und in Scheiben schneiden → Schale 3', Z('champignons', 4)),
   X('3 Möhren (300 g) schälen und in dünne Scheiben schneiden → Schale 5', Z('moehre-scheiben', 3)),
   X('40 g Weizenmehl abwiegen → Schale 4', 1),
   X('800 ml heiße Hühnerbrühe anrühren → Messbecher, 2 Lorbeerblätter danebenlegen', 2),
   X('1 Zitrone auspressen → Schale 6', 1),
   X('In Schale 6 dazu: 250 g Kochsahne, ½ TL Muskatnuss, 1 TL Pfeffer', 1),
   X('300 g TK-Erbsen abwiegen, bleiben gefroren', 1),
   X('80 g Butter abwiegen und in den großen Topf geben', 1),
   X('900 g Hähnchenbrust in 2-cm-Würfel schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 9)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den großen Topf mit der Butter auf mittlere Hitze, die Hälfte aus Schale 1 darin 3 Min. anbraten – nur hell, nicht braun –, auf den Teller', 4),
   X('Die zweite Hälfte genauso, auf den Teller', 4),
   X('Schale 2 in den Topf und 3 Min. glasig dünsten', 3),
   X('Schale 3 dazu und 5 Min. braten, bis die Champignons Wasser gelassen haben und es wieder weg ist', 5),
   X('Schale 4 darüberstäuben und 1 Min. unter Rühren anschwitzen', 1),
   X('Die Brühe aus dem Messbecher nach und nach mit dem Schneebesen einrühren, bis keine Klümpchen mehr da sind', 3),
   X('Lorbeer und Schale 5 dazu, aufkochen und 10 Min. köcheln', 10),
   X('Hähnchen samt Saft vom Teller und die Erbsen dazu, 5 Min. leise köcheln, bis das Hähnchen durch ist', 5),
   X('Lorbeer herausnehmen', 1),
   X('Schale 6 einrühren, nicht mehr kochen lassen, mit Salz abschmecken', 2),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Frikassee-Topf') + [ABKUEHLEN]),
 ],
 tips=['Wer es klassisch mag: 1 EL Kapern und ein Glas Spargelstücke (abgetropft) mit den Erbsen dazu, das ändert die Werte kaum.',
       'Die Sauce dickt in der Box nach. Beim Aufwärmen 1–2 EL Wasser dazu.'],
 pauschal=[('Gewürze', 10)],
))

# ======================================================================= 21 Kung Pao
R.append(dict(
 id='kung-pao', name='Kung-Pao-Hähnchen mit Erdnüssen & Reis', short='Kung Pao',
 desc='Hähnchen, Paprika und Zucchini aus dem Wok in süß-scharfer Soja-Sauce mit gerösteten Erdnüssen.',
 protein='Hähnchen', base='Reis', method='Wok / Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Basmati- oder Jasminreis', '280 g', 'reis', 280, 'g'),
  I('Erdnüsse, geröstet, ungesalzen', '140 g', 'erdnuesse', 140, 'g', 'aus 200-g-Tüte'),
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk', '3er-Pack'),
  I('Zucchini', '1 Stück (ca. 300 g)', 'zucchini', 1, 'Stk'),
  I('Frühlingszwiebeln', '1 Bund', 'fruehlingszwiebeln', 1, 'Bund'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Sojasauce', '90 ml', 'sojasauce', pantry=True),
  I('Honig', '30 g (1½ EL)', 'honig', pantry=True),
  I('Reis- oder Apfelessig', '3 EL', 'essig', pantry=True),
  I('Speisestärke', '15 g (1½ EL)', 'staerke', pantry=True),
  I('Öl, neutral', '40 g', 'oel', pantry=True),
 ],
 spices=[S('Chiliflocken','1–2 TL','chiliflocken'), S('Pfeffer','1 TL, am besten Szechuan','pfeffer'), S('Salz','1 Prise für den Reis','salz')],
 schalen=[('Hähnchen', 'groß'), ('Paprika & Zucchini', 'groß'), ('Knoblauch, Ingwer & Chili', 'klein'), ('Sauce', 'mittel'),
          ('Erdnüsse & Lauchzwiebeln', 'klein')],
 geraete=['Wok oder große Pfanne', 'kleiner Topf mit Deckel', 'großer Topf oder große Schüssel zum Mischen', 'Teller fürs Hähnchen', 'Reibe', 'Sieb'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(280, 420),
   X('3 Paprika (480 g) waschen, entkernen und in 2-cm-Stücke schneiden → Schale 2', Z('paprika-stuecke', 3)),
   X('1 Zucchini (300 g) längs vierteln und in 1-cm-Stücke schneiden → Schale 2', Z('zucchini-wuerfel', 1)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 3', Z('ingwer')),
   X('1–2 TL Chiliflocken → Schale 3', 1),
   X('In Schale 4 abmessen und glatt rühren:', 4, liste=['90 ml Sojasauce', '30 g Honig', '3 EL Essig', '15 g Speisestärke',
     '1 TL Pfeffer', '100 ml Wasser']),
   X('1 Bund Frühlingszwiebeln in Ringe schneiden → Schale 5', Z('fruehlingszwiebeln')),
   X('140 g Erdnüsse im trockenen Wok 3 Min. rösten, bis sie duften → Schale 5', 4),
   X('40 g Öl abwiegen und in den Wok geben', 1),
   X('800 g Hähnchenbrust in 2-cm-Würfel schneiden → Schale 1', Z('fleisch', 8)),
   X('2 EL aus Schale 4 über das Hähnchen geben und mischen – so wird es zart', 1),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Wok mit dem Öl sehr stark erhitzen, die Hälfte aus Schale 1 darin 3–4 Min. braten, bis es Röstränder hat, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Schale 2 in den Wok und 4 Min. unter Rühren braten, das Gemüse soll Biss behalten', 4),
   X('Schale 3 dazu und 30 Sek. rühren, bis es duftet', 1),
   X('Hähnchen zurück in den Wok, Schale 4 umrühren und dazugießen', 1),
   X('1–2 Min. kochen, bis die Sauce andickt und alles glänzend überzieht', 2),
   X('Wok vom Herd, Schale 5 unterheben', 1),
   X('Reis in den großen Topf, das Wok-Hähnchen darauf und alles mischen', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Szechuanpfeffer macht das typische Kribbeln. Gibt es im Asia-Laden, sonst normaler Pfeffer.',
       'Milder: nur ½ TL Chiliflocken. Schärfer: 2–3 getrocknete Chilis mit in Schale 3.'],
 pauschal=[('Gewürze', 5)],
))

# ======================================================================= 22 Honig-Senf-Hähnchen
R.append(dict(
 id='honig-senf', name='Honig-Senf-Hähnchen mit Ofenkartoffeln & Brokkoli', short='Honig-Senf-Hähnchen',
 desc='Hähnchen in Honig-Senf-Glasur und knusprige Kartoffelwürfel vom Blech, dazu kurz blanchierter Brokkoli.',
 protein='Hähnchen', base='Kartoffeln', method='Ofen + Topf', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '600 g', 'haehnchenkeule', 600, 'g', '1 × 600 g'),
  I('Hähnchenbrustfilet', '400 g', 'haehnchenbrust', 400, 'g', '1 × 400 g'),
  I('Kartoffeln, festkochend', '1,6 kg', 'kartoffeln', 1600, 'g', 'aus 2-kg-Beutel'),
  I('Brokkoli', '800 g', 'brokkoli', 800, 'g', '2 Köpfe oder TK'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=20),
  I('Senf, mittelscharf', '60 g (3 EL)', 'senf', pantry=True),
  I('Honig', '40 g (2 EL)', 'honig', pantry=True),
  I('Olivenöl', '60 g', 'olivenoel', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
 ],
 spices=[S('Paprika edelsüß','2 TL','paprika-edelsuess'), S('Rosmarin, getrocknet','1 EL','rosmarin'), S('Thymian','1 TL','thymian'),
  S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Brokkoli', 'groß'), ('Hähnchen in Marinade', 'groß')],
 geraete=['2 Backbleche', 'großer Topf', 'Sieb', 'große Schüssel zum Mischen', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('Ofen auf 200 °C Umluft vorheizen – zwei Bleche gehen nur mit Umluft', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('1,6 kg Kartoffeln gründlich waschen und ungeschält in 2-cm-Würfel schneiden → Schale 1',
     Z('kartoffel-waschen', 16) + Z('kartoffel-wuerfel', 16)),
   X('In Schale 1 mischen: 30 g Olivenöl, 1 EL Rosmarin, 1 TL Paprika edelsüß, 1 TL Salz, ½ TL Pfeffer', 2),
   X('3 Knoblauchzehen schälen und fein reiben → Schale 3', Z('knoblauch', 3)),
   X('½ Zitrone auspressen → Schale 3', 1),
   X('In Schale 3 dazu und verrühren:', Z('gewuerze', 8), liste=['60 g Senf', '40 g Honig', '30 g Olivenöl', '1 TL Paprika edelsüß',
     '1 TL Thymian', '1 TL Knoblauchpulver', '1 TL Salz', '½ TL Pfeffer']),
   X('600 g Oberkeulenfilet und 400 g Hähnchenbrust in 3-cm-Stücke schneiden → Schale 3 und gut mischen', Z('fleisch', 10)),
   ABWASCHEN,
   X('800 g Brokkoli in Röschen teilen, den Strunk schälen und würfeln → Schale 2', Z('brokkoli', 8)),
   X('Den großen Topf mit Salzwasser für den Brokkoli aufsetzen', 1, ruhe=12),
   leer_wiegen('Die große Schüssel'),
  ]),
  ('Kochen', [
   X('Schale 1 auf beide Bleche verteilen, 20 Min. backen', 20),
   W('Schale 2 ins kochende Salzwasser und 3 Min. blanchieren – er soll knackig bleiben', 3),
   W('Abgießen, kalt abschrecken und im Sieb abtropfen lassen', 2),
   X('Bleche herausnehmen, Kartoffeln wenden und zu den Rändern schieben', 2),
   X('Schale 3 mit der ganzen Marinade je zur Hälfte in die Mitte beider Bleche', 2),
   X('Hände waschen', 1),
   X('20 Min. weiterbacken, bis das Hähnchen dunkle Ränder hat und die Kartoffeln knusprig sind', 20),
   X('Bleche herausnehmen, Ofen aus', 1),
  ]),
  ('Portionieren', [
   X('Alles von den Blechen samt Glasur in die große Schüssel, Brokkoli dazu und vorsichtig mischen', 3),
  ] + fuellen('Die Schüssel') + [ABKUEHLEN]),
 ],
 tips=['Mit grobem Senf statt mittelscharfem wird es rustikaler, die Werte bleiben gleich.',
       'Nicht zu voll packen: Liegt alles übereinander, dämpft es statt zu rösten.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 23 Pesto-Nudelsalat
R.append(dict(
 id='pesto-nudelsalat', name='Pesto-Nudelsalat mit Hähnchen, Kirschtomaten & Mozzarella', short='Pesto-Nudelsalat',
 desc='Kalt aus dem Kühlschrank: Penne mit Pesto, gebratenem Hähnchen, Kirschtomaten, Spinat und Mozzarella light.',
 protein='Hähnchen', base='Nudeln', method='Topf + Pfanne', fridge='3 Tage', freeze='nicht geeignet',
 items=[
  I('Hähnchenbrustfilet', '700 g', 'haehnchenbrust', 700, 'g', 'Theke oder 2 × 400 g'),
  I('Penne', '400 g', 'penne', 400, 'g', 'aus 500-g-Packung'),
  I('Pesto Genovese', '120 g', 'pesto', 120, 'g', 'aus 190-g-Glas'),
  I('Mozzarella light', '250 g', 'mozzarella-light', 250, 'g', '2 Kugeln à 125 g'),
  I('Kirschtomaten', '500 g', 'kirschtomaten', 500, 'g', '1 große Schale'),
  I('Babyspinat', '100 g', 'spinat', 100, 'g', '1 Packung'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=20),
  I('Olivenöl', '30 g', 'olivenoel', pantry=True),
  I('Basilikum, frisch', '1 Topf', 'basilikum', opt=True),
 ],
 spices=[S('Italienische Kräuter','2 TL','ital-kraeuter'), S('Knoblauchpulver','1 TL','knoblauchpulver'),
  S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Salz','1 TL + fürs Nudelwasser','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Penne', 'mittel'), ('Hähnchen', 'groß'), ('Pesto-Dressing', 'klein'), ('Tomaten, Spinat & Mozza', 'groß')],
 geraete=['großer Nudeltopf', 'große Pfanne', 'Sieb', 'Teller fürs Hähnchen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('Den großen Topf mit Salzwasser für die Nudeln aufsetzen', 1, ruhe=12),
   X('400 g Penne abwiegen → Schale 1', 1),
   X('In Schale 3 verrühren: 120 g Pesto, 10 g Olivenöl, Saft von ½ Zitrone, ½ TL Pfeffer', 2),
   X('500 g Kirschtomaten waschen und halbieren → Schale 4', Z('kirschtomaten', 5)),
   X('2 Kugeln Mozzarella light (250 g) abtropfen lassen und in 1-cm-Würfel schneiden → Schale 4', 3),
   X('100 g Babyspinat waschen, trocken schleudern und grob schneiden → Schale 4', 3),
   X('20 g Olivenöl abwiegen und in die Pfanne geben', 1),
   X('In Schale 2 abmessen: 2 TL italienische Kräuter, 1 TL Knoblauchpulver, 1 TL Paprika edelsüß, 1 TL Salz, ½ TL Pfeffer', Z('gewuerze', 5)),
   X('700 g Hähnchenbrust in 2-cm-Würfel schneiden → Schale 2 und mit den Gewürzen mischen', Z('fleisch', 7)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Schale 1 ins kochende Salzwasser, Timer auf 1 Min. weniger als auf der Packung – sie sollen bissfest sein', 1, ruhe=10),
   X('Die Pfanne mit dem Öl stark erhitzen, die Hälfte aus Schale 2 darin 4 Min. goldbraun braten, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Nudeln abgießen, kurz kalt abschrecken und gut abtropfen lassen, zurück in den großen Topf', 3),
   X('Schale 3 unter die lauwarmen Nudeln mischen', 1),
   X('Das Hähnchen samt Saft vom Teller dazu', 1),
   X('Schale 4 dazu und vorsichtig unterheben, damit der Mozzarella nicht zerfällt', 2),
   X('Mit Salz und Pfeffer abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Wer mag: Basilikumblätter zerzupfen und auf die Boxen verteilen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Wird kalt gegessen, nicht aufwärmen. Vor dem Essen 10 Min. aus dem Kühlschrank nehmen, dann schmeckt das Pesto wieder.',
       'Der Salat zieht nach: Zu trocken? 1 EL Wasser oder etwas Zitronensaft unterrühren.'],
 pauschal=[('Gewürze', 5)],
))

# ======================================================================= 24 Sweet-Chili-Hähnchen
R.append(dict(
 id='sweet-chili', name='Sweet-Chili-Hähnchen mit Cashews, Gemüse & Reis', short='Sweet-Chili-Hähnchen',
 desc='Knuspriges Hähnchen mit Paprika, Brokkoli und Möhren in Sweet-Chili-Soja-Sauce, mit gerösteten Cashews.',
 protein='Hähnchen', base='Reis', method='Wok / Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Basmati- oder Jasminreis', '200 g', 'reis', 200, 'g'),
  I('Cashewkerne', '160 g', 'cashews', 160, 'g', 'aus 200-g-Tüte'),
  I('Sweet-Chili-Sauce', '120 g', 'sweetchili', 120, 'g', 'aus der Flasche'),
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk', '3er-Pack'),
  I('Brokkoli', '500 g', 'brokkoli', 500, 'g', '1 Kopf'),
  I('Möhren', '200 g (2 Stück)', 'moehren', 200, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Sojasauce', '60 ml', 'sojasauce', pantry=True),
  I('Öl, neutral', '30 g', 'oel', pantry=True),
 ],
 spices=[S('Chiliflocken','½ TL','chiliflocken'), S('Pfeffer','½ TL','pfeffer'), S('Salz','1 Prise für den Reis','salz')],
 schalen=[('Hähnchen', 'groß'), ('Brokkoli & Möhren', 'groß'), ('Paprika', 'groß'), ('Knoblauch & Ingwer', 'klein'), ('Sauce', 'mittel'),
          ('Cashews', 'klein')],
 geraete=['Wok oder große Pfanne', 'kleiner Topf mit Deckel', 'großer Topf zum Mischen', 'Teller fürs Hähnchen', 'Reibe', 'Sieb'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(200, 300),
   X('500 g Brokkoli in kleine Röschen teilen, den Strunk schälen und würfeln → Schale 2', Z('brokkoli', 5)),
   X('2 Möhren (200 g) schälen und in dünne Stifte schneiden → Schale 2', Z('moehre-fein', 2)),
   X('3 Paprika (480 g) waschen, entkernen und in Streifen schneiden → Schale 3', Z('paprika-streifen', 3)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 4', Z('knoblauch', 3)),
   X('20 g Ingwer schälen und fein reiben → Schale 4', Z('ingwer')),
   X('1 Limette auspressen → Schale 5', 1),
   X('In Schale 5 dazu und verrühren: 120 g Sweet-Chili-Sauce, 60 ml Sojasauce, ½ TL Chiliflocken, 100 ml Wasser', 2),
   X('160 g Cashewkerne im trockenen Wok 3 Min. rösten, bis sie leicht braun sind → Schale 6', 4),
   X('30 g Öl abwiegen und in den Wok geben', 1),
   X('800 g Hähnchenbrust in 2-cm-Würfel schneiden, mit ½ TL Pfeffer mischen → Schale 1', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Wok mit dem Öl sehr stark erhitzen, die Hälfte aus Schale 1 darin 4 Min. braten, bis es Röstränder hat, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Schale 2 in den Wok, einen Schluck Wasser dazu und zugedeckt 3 Min. dämpfen', 3),
   X('Schale 3 dazu und 3 Min. offen unter Rühren braten', 3),
   X('Schale 4 dazu und 30 Sek. rühren, bis es duftet', 1),
   X('Hähnchen zurück in den Wok, Schale 5 dazugießen und 2 Min. kochen, bis die Sauce andickt', 2),
   X('Wok vom Herd, Schale 6 unterheben', 1),
   X('Reis in den großen Topf, das Wok-Hähnchen darauf und alles mischen', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Sweet-Chili-Saucen sind unterschiedlich süß. Ist deine sehr süß, 1 EL mehr Sojasauce dazu.',
       'Die Cashews bleiben knackiger, wenn du sie erst beim Essen drüberstreust: dann in ein Döschen.'],
 pauschal=[('Gewürze', 5)],
))

# ======================================================================= 25 Zitronen-Hähnchen mit Couscous
R.append(dict(
 id='zitronen-couscous', name='Zitronen-Kräuter-Hähnchen mit Couscous & Ofengemüse', short='Zitronen-Couscous',
 desc='Hähnchen in Zitronen-Kräuter-Marinade und Zucchini, Paprika und rote Zwiebeln vom Blech, auf Couscous mit Feta und Oliven.',
 protein='Hähnchen', base='Couscous', method='Ofen + Topf', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Couscous', '360 g', 'couscous', 360, 'g', 'aus 500-g-Packung'),
  I('Feta', '150 g', 'feta', 150, 'g', '1 Packung'),
  I('Zucchini', '2 Stück (ca. 600 g)', 'zucchini', 2, 'Stk'),
  I('Paprika', '2 Stück (ca. 320 g)', 'paprika', 2, 'Stk'),
  I('Rote Zwiebeln', '2 Stück (200 g)', 'rote-zwiebeln', 200, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Zitrone', '1 große (Saft und Abrieb)', 'zitrone', 1, 'Stk', g=40),
  I('Schwarze Oliven, entsteint', '60 g', 'oliven', 60, 'g', 'aus dem Glas'),
  I('Olivenöl', '60 g', 'olivenoel', pantry=True),
  I('Gemüsebrühe', '450 ml', 'bruehe-gemuese', pantry=True),
  I('Petersilie, frisch', '1 Bund', 'petersilie', opt=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
 ],
 spices=[S('Oregano','2 TL','oregano'), S('Thymian','1 TL','thymian'), S('Paprika edelsüß','2 TL','paprika-edelsuess'),
  S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Chiliflocken','½ TL','chiliflocken'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Gemüse', 'groß'), ('Hähnchen in Marinade', 'groß'), ('Couscous', 'mittel'), ('Feta & Oliven', 'klein')],
 geraete=['2 Backbleche', 'mittlerer Topf mit Deckel', 'Messbecher', 'Reibe', 'große Schüssel zum Mischen'],
 ablauf=[
  ('Vorbereiten', [
   X('Ofen auf 220 °C Umluft vorheizen', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('2 Zucchini (600 g) in 2-cm-Würfel schneiden → Schale 1', Z('zucchini-wuerfel', 2)),
   X('2 Paprika (320 g) waschen, entkernen und in 2-cm-Stücke schneiden → Schale 1', Z('paprika-stuecke', 2)),
   X('2 rote Zwiebeln (200 g) schälen und in Spalten schneiden → Schale 1', Z('zwiebel-streifen', 2)),
   X('In Schale 1 mischen: 20 g Olivenöl, 1 TL Oregano, 1 TL Paprika edelsüß, 1 TL Salz, ½ TL Pfeffer', 2),
   X('1 Zitrone heiß abwaschen, die Schale fein abreiben → Schale 2, dann auspressen → Schale 2', 3),
   X('4 Knoblauchzehen schälen und fein reiben → Schale 2', Z('knoblauch', 4)),
   X('In Schale 2 dazu und verrühren:', Z('gewuerze', 8), liste=['40 g Olivenöl', '1 TL Oregano', '1 TL Thymian', '1 TL Paprika edelsüß',
     '1 TL Kreuzkümmel', '½ TL Chiliflocken', '1 TL Salz', '½ TL Pfeffer']),
   X('800 g Hähnchenbrust in 3-cm-Stücke schneiden → Schale 2 und gut mischen', Z('fleisch', 8)),
   ABWASCHEN,
   X('360 g Couscous abwiegen → Schale 3', 1),
   X('450 ml heiße Gemüsebrühe anrühren → Messbecher', 2),
   X('150 g Feta würfeln → Schale 4, 60 g schwarze Oliven halbieren → Schale 4', 3),
   leer_wiegen('Die große Schüssel'),
  ]),
  ('Kochen', [
   X('Schale 1 auf beide Bleche verteilen, 12 Min. backen', 12),
   X('Bleche herausnehmen, Gemüse an die Ränder schieben, Schale 2 mit der ganzen Marinade in die Mitte beider Bleche', 3),
   X('Hände waschen', 1),
   X('15 Min. weiterbacken, bis das Hähnchen goldbraun ist', 15),
   W('Die Brühe im Topf aufkochen, Herd aus, Schale 3 einrühren', 2),
   W('Deckel drauf und 8 Min. quellen lassen, dann mit der Gabel auflockern', 1, ruhe=8),
   X('Bleche herausnehmen, Ofen aus', 1),
  ]),
  ('Portionieren', [
   X('Den Couscous in die große Schüssel, alles von den Blechen samt Saft dazu und mischen', 3),
   X('Schale 4 unterheben, mit ½ TL Salz abschmecken', 2),
   X('Wer mag: gehackte Petersilie dazu', 1),
  ] + fuellen('Die Schüssel') + [ABKUEHLEN]),
 ],
 tips=['Couscous saugt in der Box nach. Beim Aufwärmen 1–2 EL Wasser dazu, oder kalt als Salat essen.',
       'Mit Bulgur (360 g, 10 Min. in der Brühe köcheln) wird es nussiger, die Werte sind fast gleich.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 26 Biryani
R.append(dict(
 id='biryani', name='Hähnchen-Biryani', short='Biryani',
 desc='Hähnchenkeule in Joghurt-Gewürz-Marinade, geschichtet mit Basmati, Röstzwiebeln und Erbsen, im Topf gedämpft.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1,2 kg', 'haehnchenkeule', 1200, 'g', '2 × 600 g'),
  I('Basmatireis', '300 g', 'reis', 300, 'g'),
  I('Zwiebeln', '3 Stück (300 g)', 'zwiebeln', 300, 'g'),
  I('Tomaten', '300 g (3 Stück)', 'tomaten', 300, 'g'),
  I('Joghurt 1,5 %', '200 g', 'joghurt', 200, 'g', '1 Becher'),
  I('TK-Erbsen', '200 g', 'erbsen', 200, 'g', 'aus 450-g-Beutel'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=20),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Butter', '10 g', 'butter', pantry=True),
  I('Koriander, frisch', '1 Bund', 'koriander', opt=True),
 ],
 spices=[S('Garam Masala','1 EL','garam-masala'), S('Kurkuma','1 TL + ½ TL für den Reis','kurkuma'), S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'),
  S('Koriander, gemahlen','1 TL','koriander-gem'), S('Chilipulver','1 TL','chilipulver'), S('Zimt','½ TL','zimt'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','3 TL','salz'), S('Pfeffer','½ TL','pfeffer')],
 schalen=[('Zwiebeln', 'mittel'), ('Reis', 'mittel'), ('Hähnchen in Marinade', 'groß'), ('Tomaten', 'mittel'), ('Erbsen & Butter', 'klein')],
 geraete=['großer Topf mit Deckel', 'mittlerer Topf für den Reis', 'Sieb', 'Reibe', 'Teller'],
 ablauf=[
  ('Vorbereiten', [
   X('4 Knoblauchzehen schälen und fein reiben → Schale 3', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 3', Z('ingwer')),
   X('½ Zitrone auspressen → Schale 3', 1),
   X('In Schale 3 dazu und verrühren:', Z('gewuerze', 9), liste=['200 g Joghurt', '1 EL Garam Masala', '1 TL Kurkuma', '1 TL Kreuzkümmel',
     '1 TL Koriander, gemahlen', '1 TL Chilipulver', '½ TL Zimt', '1½ TL Salz', '½ TL Pfeffer']),
   X('1,2 kg Hähnchen-Oberkeulenfilet in 3-cm-Stücke schneiden, grobes Fett wegschneiden → Schale 3 und mischen', Z('fleisch', 12)),
   X('Schale 3 abgedeckt kalt stellen, mind. 30 Min.', 1, ruhe=30),
   ABWASCHEN,
   X('3 Zwiebeln (300 g) schälen und in feine Streifen schneiden → Schale 1', Z('zwiebel-streifen', 3)),
   X('3 Tomaten (300 g) würfeln → Schale 4', Z('tomate-wuerfel', 3)),
   X('300 g Reis im Sieb waschen, bis das Wasser klar ist, und in kaltem Wasser 20 Min. einweichen → Schale 2', 3, ruhe=20),
   X('200 g TK-Erbsen und 10 g Butter → Schale 5', 1),
   X('10 g Öl abwiegen und in den großen Topf geben', 1),
   X('Den mittleren Topf mit 1,5 l Wasser, 1 TL Salz, ½ TL Kurkuma und 2 Lorbeerblättern aufsetzen', 2, ruhe=10),
   leer_wiegen('Den großen Topf'),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl auf mittlere Hitze, Schale 1 darin 12–15 Min. dunkel goldbraun braten, ab und zu rühren', 14),
   W('Schale 2 abgießen, in das kochende Lorbeer-Wasser geben und 5 Min. kochen – der Reis bleibt innen hart', 6),
   W('Reis abgießen, Lorbeer herausnehmen', 1),
   X('Ein Drittel der Zwiebeln auf den Teller legen', 1),
   X('Hitze hoch, Schale 3 mit der ganzen Marinade zu den Zwiebeln und 5 Min. braten', 5),
   X('Schale 4 dazu, 10 Min. köcheln, bis die Sauce dick ist, mit Salz abschmecken', 10),
   X('Den Reis gleichmäßig auf das Hähnchen schichten, nicht umrühren', 1),
   X('Schale 5 obendrauf, die Zwiebeln vom Teller darüber', 1),
   X('Deckel fest drauf, 20 Min. auf kleinster Hitze dämpfen, dann Herd aus und 10 Min. ziehen lassen', 1, ruhe=30),
   X('Vorsichtig von unten nach oben durchmischen', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Wer mag: Koriander gehackt auf die Boxen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Über Nacht mariniert wird es noch besser, und die 30 Min. Wartezeit fallen weg.',
       'Ein Schuss Rosenwasser oder ein paar Safranfäden im Reiswasser machen es wie im Restaurant.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 27 Enchilada-Auflauf
R.append(dict(
 id='enchilada', name='Hähnchen-Enchilada-Auflauf', short='Enchilada-Auflauf',
 desc='Tortillas geschichtet mit Hähnchen, schwarzen Bohnen, Mais und Paprika in würziger Tomatensauce, mit Cheddar überbacken.',
 protein='Hähnchen', base='Tortillas', method='Pfanne + Ofen', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '600 g', 'haehnchenbrust', 600, 'g', '1 × 600 g oder Theke'),
  I('Weizentortillas', '1 Packung (8 Stück, 320 g)', 'tortillas', 1, 'Pck'),
  I('Mais', '2 Dosen à 425 ml (570 g abgetropft)', 'mais', 2, 'Dose'),
  I('Schwarze Bohnen', '1 Dose à 400 g (240 g abgetropft)', 'schwarze-bohnen', 1, 'Dose'),
  I('Cheddar', '200 g', 'cheddar', 200, 'g', '1 Packung'),
  I('Paprika', '2 Stück (ca. 320 g)', 'paprika', 2, 'Stk'),
  I('Zwiebeln', '1 große (150 g)', 'zwiebeln', 150, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Passierte Tomaten', '500 g', 'passata', 500, 'g', '1 Packung'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Koriander, frisch', 'zum Servieren', 'koriander', opt=True),
 ],
 spices=[S('Kreuzkümmel, gemahlen','1 EL','kreuzkuemmel'), S('Paprika geräuchert','1 EL','paprika-geraeuchert'),
  S('Chilipulver','2 TL','chilipulver'), S('Oregano','1 EL','oregano'), S('Knoblauchpulver','1 TL','knoblauchpulver'),
  S('Zwiebelgranulat','1 TL','zwiebelpulver'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln, Knobi & Paprika', 'groß'), ('Gewürze & Tomatenmark', 'klein'), ('Bohnen & Mais', 'groß'),
          ('Cheddar', 'mittel')],
 geraete=['große Pfanne', 'große Auflaufform (ca. 30 × 40 cm) oder zwei kleine', 'Sieb', 'Reibe', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   X('1 große Zwiebel (150 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 1.5)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 3)),
   X('2 Paprika (320 g) waschen, entkernen und in 1-cm-Würfel schneiden → Schale 2', Z('paprika-wuerfel', 2)),
   X('35 g Tomatenmark abwiegen → Schale 3', 1),
   X('In Schale 3 dazu:', Z('gewuerze', 8), liste=['1 EL Kreuzkümmel', '1 EL Paprika geräuchert', '2 TL Chilipulver', '1 EL Oregano',
     '1 TL Knoblauchpulver', '1 TL Zwiebelgranulat', '1 TL Salz', '1 TL Pfeffer']),
   X('2 Dosen Mais und 1 Dose schwarze Bohnen öffnen, im Sieb abspülen und abtropfen lassen → Schale 4', 4),
   X('500 g passierte Tomaten und 200 ml Wasser → Messbecher', 1),
   X('200 g Cheddar reiben → Schale 5', Z('kaese-reiben', 2)),
   X('10 g Öl abwiegen und in die Pfanne geben', 1),
   X('600 g Hähnchenbrust in 1-cm-Würfel schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 6)),
   ABWASCHEN,
   X('Ofen auf 200 °C Ober-/Unterhitze vorheizen', 1, ruhe=12),
   leer_wiegen('Die Auflaufform'),
  ]),
  ('Kochen', [
   X('Pfanne mit dem Öl stark erhitzen, Schale 1 darin 5 Min. braten, bis es Farbe hat', 5),
   X('Hitze auf mittel, Schale 2 dazu und 5 Min. anschwitzen', 5),
   X('Schale 3 einrühren und 1 Min. rösten', 1),
   X('Den Messbecher dazugießen, aufkochen und 5 Min. köcheln', 5),
   X('Schale 4 unterrühren, abschmecken, Pfanne vom Herd', 2),
   X('Ein Drittel der Füllung in die Auflaufform streichen', 1),
   X('4 Tortillas darauflegen, notfalls zuschneiden, bis der Boden bedeckt ist', 2),
   X('Das zweite Drittel der Füllung darauf, die Hälfte aus Schale 5 darüber', 2),
   X('Die restlichen 4 Tortillas darauf, der Rest der Füllung, der Rest aus Schale 5', 2),
   X('Ohne Deckel 20 Min. backen, bis der Käse goldbraun ist', 20),
   X('Form herausnehmen, 10 Min. ruhen lassen, dann lässt es sich schneiden', 1, ruhe=10),
  ]),
  ('Portionieren', [
   X('Die Form mit dem Auflauf wiegen und im Rechner bei „Mit Essen“ eintragen', 1),
   X('In 8 gleiche Stücke schneiden und je 1 Stück in eine Box – die Waage kontrolliert', 6),
   X('Wer mag: Koriander gehackt auf die Boxen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Schärfer: 1 Dose Jalapeños (abgetropft) mit in Schale 4.',
       'Beim Aufwärmen in der Mikrowelle wird der Käse wieder weich. Noch besser: 10 Min. im Ofen bei 180 °C.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 28 Schaschlik-Pfanne
R.append(dict(
 id='schaschlik', name='Hähnchen-Schaschlik-Pfanne mit Reis', short='Schaschlik-Pfanne',
 desc='Wie vom Imbiss, nur ohne Spieß: Hähnchenkeule, Paprika und Zwiebeln in süß-würziger Schaschlik-Sauce, dazu Reis.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1,2 kg', 'haehnchenkeule', 1200, 'g', '2 × 600 g'),
  I('Basmati- oder Jasminreis', '280 g', 'reis', 280, 'g'),
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk', '3er-Pack'),
  I('Zwiebeln', '3 Stück (300 g)', 'zwiebeln', 300, 'g'),
  I('Knoblauch', '2 Zehen', 'knoblauch', 2, 'Zehe'),
  I('Ketchup', '150 g', 'ketchup', 150, 'g', 'aus der Flasche'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Zucker', '10 g (2 TL)', 'zucker', pantry=True),
  I('Hühnerbrühe', '400 ml', 'bruehe-huhn', pantry=True),
  I('Reis- oder Apfelessig', '1 EL', 'essig', pantry=True),
 ],
 spices=[S('Currypulver','1 EL','currypulver'), S('Paprika edelsüß','2 EL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Cayennepfeffer','½ TL','cayenne'), S('Majoran','1 TL','majoran'), S('Lorbeerblätter','2 Stück','lorbeer'),
  S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln & Paprika', 'groß'), ('Tomatenmark & Gewürze', 'klein'), ('Sauce', 'mittel')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Teller fürs Hähnchen', 'Messbecher', 'Sieb', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(280, 420),
   X('3 Zwiebeln (300 g) schälen und in grobe Stücke schneiden → Schale 2', Z('zwiebel-streifen', 3)),
   X('3 Paprika (480 g) waschen, entkernen und in 3-cm-Stücke schneiden → Schale 2', Z('paprika-stuecke', 3)),
   X('2 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 2)),
   X('70 g Tomatenmark abwiegen → Schale 3', 1),
   X('In Schale 3 dazu:', Z('gewuerze', 7), liste=['1 EL Currypulver', '2 EL Paprika edelsüß', '1 TL Paprika geräuchert', '½ TL Cayennepfeffer',
     '1 TL Majoran', '1 TL Pfeffer', '10 g Zucker']),
   X('400 ml heiße Hühnerbrühe anrühren → Messbecher, 2 Lorbeerblätter danebenlegen', 2),
   X('In Schale 4 verrühren: 150 g Ketchup, 1 EL Essig', 1),
   X('20 g Öl abwiegen und in den großen Topf geben', 1),
   X('1,2 kg Hähnchen-Oberkeulenfilet in 3-cm-Stücke schneiden, grobes Fett wegschneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 12)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 5 Min. kräftig anbraten, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 6 Min. anbraten, bis die Zwiebeln Farbe haben', 6),
   X('Schale 3 dazu und 2 Min. rösten – das Paprikapulver darf nicht schwarz werden', 2),
   X('Mit der Brühe aus dem Messbecher ablöschen, Lorbeer dazu, den Bodensatz loskratzen', 1),
   X('Hähnchen samt Saft vom Teller dazu, aufkochen und zugedeckt 15 Min. köcheln', 15),
   X('Schale 4 einrühren und offen 5 Min. einkochen, bis die Sauce sämig ist', 5),
   X('Lorbeer herausnehmen, mit Salz abschmecken', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Schaschlik-Topf') + [ABKUEHLEN]),
 ],
 tips=['Mit Pommes statt Reis wird es echter Imbiss, aber die Werte passen dann nicht mehr. Reis bleibt die Box-Variante.',
       'Die Sauce wird über Nacht kräftiger: Beim Salz lieber vorsichtig sein.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 29 Paprikahuhn
R.append(dict(
 id='paprikahuhn', name='Paprikahuhn mit Bandnudeln', short='Paprikahuhn',
 desc='Ungarisch: Hähnchen in samtiger Paprika-Schmand-Sauce mit viel Paprika und Zwiebeln, dazu Bandnudeln.',
 protein='Hähnchen', base='Nudeln', method='Topf', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '600 g', 'haehnchenkeule', 600, 'g', '1 × 600 g'),
  I('Hähnchenbrustfilet', '400 g', 'haehnchenbrust', 400, 'g', '1 × 400 g'),
  I('Bandnudeln', '340 g', 'bandnudeln', 340, 'g', 'aus 500-g-Packung'),
  I('Rote Paprika', '4 Stück (ca. 640 g)', 'paprika', 4, 'Stk'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Schmand', '150 g', 'schmand', 150, 'g', '1 Becher à 200 g, Rest fürs Brot'),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Speisestärke', '10 g (1 EL)', 'staerke', pantry=True),
  I('Hühnerbrühe', '500 ml', 'bruehe-huhn', pantry=True),
 ],
 spices=[S('Paprika edelsüß','3 EL','paprika-edelsuess'), S('Paprika rosenscharf','1 TL','paprika-rosenscharf'),
  S('Paprika geräuchert','1 TL','paprika-geraeuchert'), S('Kümmel, gemahlen','1 TL','kuemmel'), S('Majoran','1 TL','majoran'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln & Knoblauch', 'mittel'), ('Paprika', 'groß'), ('Gewürze & Tomatenmark', 'klein'),
          ('Nudeln', 'mittel'), ('Schmand & Stärke', 'klein')],
 geraete=['großer Topf mit Deckel', 'großer Nudeltopf', 'Teller fürs Hähnchen', 'Messbecher', 'Sieb', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 3)),
   X('4 rote Paprika (640 g) waschen, entkernen und in 1-cm-Streifen schneiden → Schale 3', Z('paprika-streifen', 4)),
   X('70 g Tomatenmark abwiegen → Schale 4', 1),
   X('In Schale 4 dazu:', Z('gewuerze', 6), liste=['3 EL Paprika edelsüß', '1 TL Paprika rosenscharf', '1 TL Paprika geräuchert',
     '1 TL Kümmel', '1 TL Majoran', '1 TL Pfeffer']),
   X('340 g Bandnudeln abwiegen → Schale 5', 1),
   X('In Schale 6 glatt rühren: 150 g Schmand, 10 g Speisestärke, 3 EL Wasser', 2),
   X('500 ml heiße Hühnerbrühe anrühren → Messbecher, 2 Lorbeerblätter danebenlegen', 2),
   X('20 g Öl abwiegen und in den großen Topf geben', 1),
   X('600 g Oberkeulenfilet und 400 g Hähnchenbrust in 3-cm-Stücke schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 10)),
   ABWASCHEN,
   X('Den Nudeltopf mit Salzwasser aufsetzen', 1, ruhe=12),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 4 Min. anbraten, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 5 Min. glasig dünsten', 5),
   X('Schale 3 dazu und 5 Min. mitbraten', 5),
   X('Topf vom Herd ziehen, Schale 4 einrühren – Paprikapulver wird auf voller Hitze schnell bitter', 1),
   X('Sofort mit der Brühe aus dem Messbecher ablöschen, Lorbeer dazu, zurück auf den Herd', 1),
   X('Hähnchen samt Saft vom Teller dazu, aufkochen und zugedeckt 15 Min. köcheln', 15),
   W('Schale 5 ins kochende Salzwasser, Timer auf 2 Min. weniger als auf der Packung', 1, ruhe=8),
   W('Nudeln abgießen', 1),
   X('Lorbeer herausnehmen, Schale 6 einrühren und 2 Min. köcheln, bis die Sauce bindet', 2),
   X('Mit Salz abschmecken', 1),
   X('Die Nudeln in den Topf und mischen', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Nicht sprudelnd kochen, nachdem der Schmand drin ist, sonst flockt er aus.',
       'Für mehr Sauce beim Aufwärmen 1–2 EL Wasser dazu.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 30 Gebratener Reis
R.append(dict(
 id='gebratener-reis', name='Gebratener Reis mit Hähnchen & Ei', short='Gebratener Reis',
 desc='Wie beim Chinesen: Reis mit Hähnchenkeule, Ei, Erbsen, Möhren und Frühlingszwiebeln aus dem Wok.',
 protein='Hähnchen', base='Reis', method='Wok / Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1 kg', 'haehnchenkeule', 1000, 'g', '2 × 500 g'),
  I('Basmati- oder Jasminreis', '340 g', 'reis', 340, 'g'),
  I('Eier', '3 Stück', 'eier', 3, 'Stk'),
  I('TK-Erbsen', '250 g', 'erbsen', 250, 'g', 'aus 450-g-Beutel'),
  I('Möhren', '200 g (2 Stück)', 'moehren', 200, 'g'),
  I('Frühlingszwiebeln', '1 Bund', 'fruehlingszwiebeln', 1, 'Bund'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Sojasauce', '90 ml', 'sojasauce', pantry=True),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Sesamöl', '10 g', 'sesamoel', pantry=True),
 ],
 spices=[S('Pfeffer, weiß oder schwarz','1 TL','pfeffer'), S('Chiliflocken','½ TL','chiliflocken'), S('Salz','1 TL','salz')],
 schalen=[('Hähnchen', 'groß'), ('Eier', 'klein'), ('Möhren & Erbsen', 'mittel'), ('Knoblauch & Ingwer', 'klein'), ('Sauce', 'klein'),
          ('Frühlingszwiebeln', 'klein')],
 geraete=['Wok oder große Pfanne', 'kleiner Topf mit Deckel', 'großer Topf zum Mischen', 'Teller fürs Hähnchen', 'Reibe', 'Sieb'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(340, 480, salz=False),
   X('3 Eier in Schale 2 aufschlagen, mit 1 Prise Salz verquirlen', 1),
   X('2 Möhren (200 g) schälen und in kleine Würfel schneiden → Schale 3', Z('moehre-fein', 2)),
   X('250 g TK-Erbsen → Schale 3, bleiben gefroren', 1),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 4', Z('knoblauch', 3)),
   X('20 g Ingwer schälen und fein reiben → Schale 4', Z('ingwer')),
   X('In Schale 5 verrühren: 90 ml Sojasauce, 10 g Sesamöl, 1 TL Pfeffer, ½ TL Chiliflocken', 2),
   X('1 Bund Frühlingszwiebeln in Ringe schneiden → Schale 6', Z('fruehlingszwiebeln')),
   X('10 g Öl abwiegen und in den Wok geben', 1),
   X('1 kg Hähnchen-Oberkeulenfilet in 1,5-cm-Würfel schneiden, grobes Fett wegschneiden, mit ½ TL Salz mischen → Schale 1', Z('fleisch', 10)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Reistopf aufkochen, dann zugedeckt 10 Min. auf kleinster Hitze garen – etwas kürzer als sonst, er wird noch gebraten', 2, ruhe=10),
   X('Den Reis in den großen Topf schütten und offen ausdampfen lassen', 1),
   X('Wok mit dem Öl sehr stark erhitzen, die Hälfte aus Schale 1 darin 5 Min. braten, bis es Röstränder hat, auf den Teller', 6),
   X('Die zweite Hälfte genauso, auf den Teller', 6),
   X('Schale 2 in den Wok und unter Rühren 1 Min. stocken lassen, in kleine Stücke zerteilen, auf den Teller', 2),
   X('Schale 3 in den Wok und 3 Min. braten', 3),
   X('Schale 4 dazu und 30 Sek. rühren, bis es duftet', 1),
   X('Den Reis dazu und 3 Min. unter Rühren braten, bis er leicht röstet', 3),
   X('Hähnchen und Ei vom Teller zurück in den Wok', 1),
   X('Schale 5 darübergießen und 2 Min. rühren, bis alles gleichmäßig braun ist', 2),
   X('Wok vom Herd, Schale 6 unterheben, abschmecken', 1),
   X('Alles zurück in den großen Topf', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Am besten wird es mit Reis vom Vortag: Dann den Reis am Abend vorher kochen und kalt stellen.',
       'Der Wok muss richtig heiß sein, sonst wird der Reis matschig statt röstig. Lieber in zwei Portionen braten.'],
 pauschal=[('Gewürze', 5)],
))

# ======================================================================= 31 Hähnchen-Eintopf
R.append(dict(
 id='haehnchen-eintopf', name='Hähnchen-Kartoffel-Eintopf mit Lauch & Möhren', short='Hähnchen-Eintopf',
 desc='Sämiger Eintopf mit Hähnchen, Kartoffeln, Lauch, Möhren, Sellerie und Erbsen – deftig, aber leicht.',
 protein='Hähnchen', base='Kartoffeln', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchen-Oberkeulenfilet', '600 g', 'haehnchenkeule', 600, 'g', '1 × 600 g'),
  I('Hähnchenbrustfilet', '400 g', 'haehnchenbrust', 400, 'g', '1 × 400 g'),
  I('Kartoffeln, festkochend', '1,4 kg geschält', 'kartoffeln', 1500, 'g', 'Beutel 1,5 kg', g=1400),
  I('Lauch', '2 Stangen', 'lauch', 2, 'Stange'),
  I('Möhren', '400 g (4 Stück)', 'moehren', 400, 'g'),
  I('Staudensellerie', '2 Stangen', 'staudensellerie', 2, 'Stange'),
  I('Zwiebeln', '1 große (150 g)', 'zwiebeln', 150, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('TK-Erbsen', '200 g', 'erbsen', 200, 'g', 'aus 450-g-Beutel'),
  I('Kochsahne 15 %', '200 g', 'kochsahne', 200, 'g', '1 Becher'),
  I('Öl, neutral', '30 g', 'oel', pantry=True),
  I('Hühnerbrühe', '1,5 l', 'bruehe-huhn', pantry=True),
  I('Petersilie, frisch', '1 Bund', 'petersilie', opt=True),
 ],
 spices=[S('Thymian','1 TL','thymian'), S('Majoran','1 TL','majoran'), S('Lorbeerblätter','2 Stück','lorbeer'),
  S('Muskatnuss','½ TL, frisch gerieben','muskat'), S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln, Knobi & Sellerie', 'mittel'), ('Möhren & Kartoffeln', 'groß'), ('Gewürze', 'klein'),
          ('Lauch', 'groß'), ('Erbsen', 'klein')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Teller fürs Hähnchen', 'Messbecher (1 l)', 'Sieb', 'Kartoffelstampfer'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('1 große Zwiebel (150 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 1.5)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 3)),
   X('2 Stangen Staudensellerie waschen und in kleine Würfel schneiden → Schale 2', Z('sellerie-fein', 2)),
   X('4 Möhren (400 g) schälen und in dicke Scheiben schneiden → Schale 3', Z('moehre-scheiben', 4)),
   X('1,5 kg Kartoffeln schälen, davon 1,4 kg abwiegen', Z('kartoffel-schaelen', 15)),
   X('Die Kartoffeln in 2-cm-Würfel schneiden → Schale 3', Z('kartoffel-wuerfel', 14)),
   X('In Schale 4 abmessen: 1 TL Thymian, 1 TL Majoran, 1 TL Paprika edelsüß, 1 TL Pfeffer', Z('gewuerze', 4)),
   X('2 Stangen Lauch längs halbieren, gründlich waschen und in 1-cm-Ringe schneiden → Schale 5', 5),
   X('200 g TK-Erbsen → Schale 6, bleiben gefroren', 1),
   X('1,5 l heiße Hühnerbrühe anrühren → Messbecher, 2 Lorbeerblätter danebenlegen', 3),
   X('200 g Kochsahne und ½ TL Muskatnuss bereitstellen', 1),
   X('30 g Öl abwiegen und in den großen Topf geben', 1),
   X('600 g Oberkeulenfilet und 400 g Hähnchenbrust in 2-cm-Stücke schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 10)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 4 Min. anbraten, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 4 Min. anschwitzen', 4),
   X('Schale 3 dazu und 2 Min. mitbraten', 2),
   X('Schale 4 einrühren', 1),
   X('Mit der Brühe aus dem Messbecher aufgießen, Lorbeer dazu, aufkochen', 3),
   X('Zugedeckt 15 Min. köcheln, bis die Kartoffeln fast weich sind', 15),
   X('Schale 5 und das Hähnchen samt Saft vom Teller dazu, 8 Min. köcheln', 8),
   X('Schale 6 dazu und 2 Min. mitkochen', 2),
   X('Lorbeer herausnehmen, mit dem Stampfer ein paarmal hineindrücken, damit der Eintopf sämig wird', 1),
   X('Kochsahne und Muskat einrühren, mit Salz und Pfeffer abschmecken', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Wer mag: Petersilie gehackt auf die Boxen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Der Eintopf dickt in der Box nach. Beim Aufwärmen einen Schluck Wasser dazu.',
       'Ein Spritzer Zitrone oder Essig am Ende macht ihn frischer.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 32 Pasta al Limone
R.append(dict(
 id='pasta-limone', name='Pasta al Limone mit Hähnchen & Brokkoli', short='Pasta al Limone',
 desc='Spaghetti in cremiger Zitronen-Parmesan-Sauce mit gebratenem Hähnchen und bissfestem Brokkoli.',
 protein='Hähnchen', base='Nudeln', method='Topf + Pfanne', fridge='3 Tage', freeze='nicht geeignet',
 items=[
  I('Hähnchenbrustfilet', '700 g', 'haehnchenbrust', 700, 'g', 'Theke oder 2 × 400 g'),
  I('Spaghetti', '380 g', 'spaghetti', 380, 'g', 'aus 500-g-Packung'),
  I('Brokkoli', '800 g', 'brokkoli', 800, 'g', '2 Köpfe oder TK'),
  I('Kochsahne 15 %', '250 g', 'kochsahne', 250, 'g', '1 Becher'),
  I('Parmesan', '60 g', 'parmesan', 60, 'g'),
  I('Zitronen', '2 Stück (Bio, Saft und Abrieb)', 'zitrone', 2, 'Stk'),
  I('Zwiebeln', '1 Stück (100 g)', 'zwiebeln', 100, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Olivenöl', '30 g', 'olivenoel', pantry=True),
  I('Butter', '20 g', 'butter', pantry=True),
  I('Gemüsebrühe', '300 ml', 'bruehe-gemuese', pantry=True),
  I('Basilikum, frisch', 'zum Servieren', 'basilikum', opt=True),
 ],
 spices=[S('Italienische Kräuter','1 TL','ital-kraeuter'), S('Chiliflocken','½ TL','chiliflocken'), S('Salz','2 TL + fürs Nudelwasser','salz'),
  S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Spaghetti', 'mittel'), ('Zwiebeln & Knoblauch', 'klein'), ('Brokkoli', 'groß'), ('Zitrone & Parmesan', 'klein')],
 geraete=['großer Nudeltopf', 'große Pfanne', 'Sieb', 'Teller fürs Hähnchen', 'Reibe', 'Messbecher', 'Becher fürs Nudelwasser'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('Den großen Topf mit Salzwasser für die Nudeln aufsetzen', 1, ruhe=12),
   X('380 g Spaghetti abwiegen → Schale 2', 1),
   X('800 g Brokkoli in kleine Röschen teilen, den Strunk schälen und würfeln → Schale 4', Z('brokkoli', 8)),
   X('1 Zwiebel (100 g) schälen und fein würfeln → Schale 3', Z('zwiebel-wuerfel', 1)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 3)),
   X('2 Zitronen heiß abwaschen, die Schale fein abreiben → Schale 5, dann auspressen → Schale 5', 4),
   X('60 g Parmesan fein reiben → Schale 5', 2),
   X('250 g Kochsahne und 300 ml heiße Gemüsebrühe im Messbecher verrühren', 2),
   X('30 g Olivenöl abwiegen und in die Pfanne geben, 20 g Butter danebenlegen', 1),
   X('In Schale 1 abmessen: 1 TL italienische Kräuter, ½ TL Chiliflocken, 1 TL Salz, ½ TL Pfeffer', Z('gewuerze', 4)),
   X('700 g Hähnchenbrust in 2-cm-Stücke schneiden → Schale 1 und mit den Gewürzen mischen', Z('fleisch', 7)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Pfanne mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 4 Min. goldbraun braten, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Schale 2 ins kochende Salzwasser, Timer auf 3 Min. weniger als auf der Packung', 1, ruhe=7),
   X('Hitze auf mittel, Butter in die Pfanne, Schale 3 darin 3 Min. glasig dünsten', 3),
   X('Den Messbecher dazugießen, aufkochen und 3 Min. köcheln', 3),
   X('Wenn der Timer klingelt: Schale 4 zu den Nudeln ins Wasser und 3 Min. mitkochen', 3),
   X('300 ml Nudelwasser in den Becher schöpfen, Nudeln und Brokkoli abgießen, zurück in den großen Topf', 2),
   X('Hähnchen samt Saft in die Sauce, 2 Min. köcheln, bis es durch ist', 2),
   X('Pfanne vom Herd, Schale 5 einrühren', 1),
   X('Die Sauce zu den Nudeln in den Topf und mischen', 2),
   X('Mit Nudelwasser (bis 300 ml) cremig rühren, mit Salz und Pfeffer abschmecken', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Beim Aufwärmen 1–2 EL Wasser dazu, die Nudeln saugen in der Box nach.',
       'Frisches Basilikum erst beim Essen drüberzupfen.'],
 pauschal=[('Gewürze', 10)],
))

# ======================================================================= 33 Kichererbsen-Curry
R.append(dict(
 id='kichererbsen-curry', name='Hähnchen-Kichererbsen-Curry mit Spinat & Reis', short='Kichererbsen-Curry',
 desc='Indisch gewürztes Tomaten-Kokos-Curry mit Hähnchen, Kichererbsen und Spinat, dazu Basmati.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Basmatireis', '240 g', 'reis', 240, 'g'),
  I('Kichererbsen', '2 Dosen à 400 g (480 g abgetropft)', 'kichererbsen', 2, 'Dose'),
  I('Kokosmilch', '1 Dose à 400 ml', 'kokosmilch', 1, 'Dose'),
  I('Stückige Tomaten', '1 Dose à 400 g', 'tomaten-dose', 1, 'Dose'),
  I('Babyspinat', '250 g', 'spinat', 250, 'g', '2 × 125 g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Koriander, frisch', 'zum Servieren', 'koriander', opt=True),
 ],
 spices=[S('Garam Masala','1 EL','garam-masala'), S('Kreuzkümmel, gemahlen','2 TL','kreuzkuemmel'), S('Koriander, gemahlen','2 TL','koriander-gem'),
  S('Kurkuma','1 TL','kurkuma'), S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Chilipulver','1 TL','chilipulver'),
  S('Salz','2 TL','salz'), S('Pfeffer','½ TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln, Knobi & Ingwer', 'mittel'), ('Gewürze', 'klein'), ('Kichererbsen', 'mittel'),
          ('Limettensaft', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Teller fürs Hähnchen', 'Sieb', 'Reibe', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(240, 360),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 2', Z('ingwer')),
   X('In Schale 3 abmessen:', Z('gewuerze', 7), liste=['1 EL Garam Masala', '2 TL Kreuzkümmel', '2 TL Koriander, gemahlen', '1 TL Kurkuma',
     '1 TL Paprika edelsüß', '1 TL Chilipulver', '½ TL Pfeffer']),
   X('2 Dosen Kichererbsen öffnen, im Sieb abspülen und abtropfen lassen → Schale 4', 2),
   X('1 Dose stückige Tomaten und 1 Dose Kokosmilch öffnen', 1),
   X('1 Limette auspressen → Schale 5', 1),
   X('20 g Öl abwiegen und in den großen Topf geben', 1),
   X('800 g Hähnchenbrust in 2-cm-Würfel schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 3–4 Min. braten, bis es Farbe hat, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 5 Min. glasig dünsten', 5),
   X('Schale 3 einrühren und 1 Min. rösten, bis es duftet', 1),
   X('Stückige Tomaten dazu und 5 Min. köcheln, bis es dick wird', 5),
   X('Kokosmilch und Schale 4 dazu, aufkochen und 10 Min. köcheln', 10),
   X('Hähnchen samt Saft vom Teller dazu und 5 Min. köcheln, bis es durch ist', 5),
   X('250 g Babyspinat handvollweise einrühren, bis er zusammenfällt', 2),
   X('Schale 5 einrühren, mit Salz abschmecken', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Curry-Topf') + [
   X('Wer mag: Koriander gehackt auf die Boxen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Ohne Hähnchen und mit 3 Dosen Kichererbsen wird es vegetarisch – dann fehlen pro Box etwa 10 g Eiweiß.',
       'Schmeckt am zweiten Tag noch runder.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 34 Süßkartoffel-Blech
R.append(dict(
 id='suesskartoffel-blech', name='Süßkartoffel-Hähnchen-Blech mit Paprika & Feta', short='Süßkartoffel-Blech',
 desc='Süßkartoffel, Paprika und rote Zwiebeln mit Hähnchen vom Blech, mit Feta und Spinat gemischt.',
 protein='Hähnchen', base='Süßkartoffel', method='Ofen', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Süßkartoffeln', '1,3 kg', 'suesskartoffel', 1300, 'g', '3–4 Stück'),
  I('Feta', '300 g', 'feta', 300, 'g', '2 Packungen à 150 g'),
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk', '3er-Pack'),
  I('Rote Zwiebeln', '2 Stück (200 g)', 'rote-zwiebeln', 200, 'g'),
  I('Babyspinat', '150 g', 'spinat', 150, 'g', '1 Packung à 125–150 g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=20),
  I('Olivenöl', '40 g', 'olivenoel', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
 ],
 spices=[S('Paprika geräuchert','2 TL','paprika-geraeuchert'), S('Paprika edelsüß','1 TL','paprika-edelsuess'),
  S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Oregano','1 TL','oregano'), S('Chiliflocken','½ TL','chiliflocken'),
  S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Süßkartoffel & Paprika', 'groß'), ('Hähnchen in Marinade', 'groß'), ('Zwiebeln', 'mittel'), ('Feta', 'klein')],
 geraete=['2 Backbleche', 'große Schüssel zum Mischen', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('Ofen auf 200 °C Umluft vorheizen – zwei Bleche gehen nur mit Umluft', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('1,3 kg Süßkartoffeln schälen und in 2-cm-Würfel schneiden → Schale 1', Z('suesskartoffel', 13)),
   X('3 Paprika (480 g) waschen, entkernen und in 3-cm-Stücke schneiden → Schale 1', Z('paprika-stuecke', 3)),
   X('In Schale 1 mischen: 20 g Olivenöl, 1 TL Paprika geräuchert, 1 TL Paprika edelsüß, 1 TL Kreuzkümmel, 1 TL Salz, ½ TL Pfeffer', 2),
   X('3 Knoblauchzehen schälen und fein reiben → Schale 2', Z('knoblauch', 3)),
   X('½ Zitrone auspressen → Schale 2', 1),
   X('In Schale 2 dazu und verrühren:', Z('gewuerze', 7), liste=['20 g Olivenöl', '1 TL Paprika geräuchert', '1 TL Oregano', '½ TL Chiliflocken',
     '1 TL Knoblauchpulver', '1 TL Salz', '½ TL Pfeffer']),
   X('800 g Hähnchenbrust in 3-cm-Stücke schneiden → Schale 2 und gut mischen', Z('fleisch', 8)),
   ABWASCHEN,
   X('2 rote Zwiebeln (200 g) schälen und in Spalten schneiden → Schale 3', Z('zwiebel-streifen', 2)),
   X('300 g Feta in 1-cm-Würfel schneiden → Schale 4', 2),
   leer_wiegen('Die große Schüssel'),
  ]),
  ('Kochen', [
   X('Schale 1 auf beide Bleche verteilen, 15 Min. backen', 15),
   X('Bleche herausnehmen, Gemüse an die Ränder schieben, Schale 2 mit der ganzen Marinade in die Mitte beider Bleche', 3),
   X('Schale 3 darüberstreuen', 1),
   X('Hände waschen', 1),
   X('18 Min. weiterbacken, bis das Hähnchen durch ist und die Süßkartoffel weich', 18),
   X('Bleche herausnehmen, Ofen aus', 1),
  ]),
  ('Portionieren', [
   X('Alles von den Blechen samt Saft in die große Schüssel', 2),
   X('150 g Babyspinat unterheben – er fällt in der Hitze zusammen', 2),
   X('Schale 4 vorsichtig unterheben', 1),
  ] + fuellen('Die Schüssel') + [ABKUEHLEN]),
 ],
 tips=['Nicht zu voll packen: Liegt alles übereinander, dämpft es statt zu rösten.',
       'Schmeckt auch kalt als Salat – dann die Boxen ohne Aufwärmen essen.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 35 Beef & Broccoli
R.append(dict(
 id='beef-broccoli', name='Beef & Broccoli mit Reis', short='Beef & Broccoli',
 desc='Rinderhüfte in dünnen Streifen mit Brokkoli in glänzender Soja-Ingwer-Sauce, Sesam und Cashews, dazu Reis.',
 protein='Rind', base='Reis', method='Wok / Pfanne', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Rinderhüftsteak', '900 g', 'rinderhuefte', 900, 'g', 'Theke oder 2 × 450 g'),
  I('Basmati- oder Jasminreis', '280 g', 'reis', 280, 'g'),
  I('Brokkoli', '900 g', 'brokkoli', 900, 'g', '2 Köpfe'),
  I('Cashewkerne', '60 g', 'cashews', 60, 'g', 'aus 200-g-Tüte'),
  I('Sesam', '20 g', 'sesam', 20, 'g', 'Tüte'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Sojasauce', '90 ml', 'sojasauce', pantry=True),
  I('Honig', '30 g (1½ EL)', 'honig', pantry=True),
  I('Speisestärke', '15 g (1½ EL)', 'staerke', pantry=True),
  I('Öl, neutral', '40 g', 'oel', pantry=True),
  I('Sesamöl', '10 g', 'sesamoel', pantry=True),
  I('Rinderbrühe', '200 ml', 'bruehe-rind', pantry=True),
 ],
 spices=[S('Pfeffer','1 TL','pfeffer'), S('Chiliflocken','½ TL','chiliflocken'), S('Salz','1 Prise für den Reis + fürs Gemüsewasser','salz')],
 schalen=[('Brokkoli', 'groß'), ('Rind', 'groß'), ('Knoblauch & Ingwer', 'klein'), ('Sauce', 'mittel'), ('Sesam & Cashews', 'klein')],
 geraete=['Wok oder große Pfanne', 'kleiner Topf mit Deckel', 'großer Topf', 'Sieb', 'Teller fürs Fleisch', 'Reibe', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(280, 420),
   X('900 g Brokkoli in kleine Röschen teilen, den Strunk schälen und in Scheiben schneiden → Schale 1', Z('brokkoli', 9)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 3', Z('ingwer')),
   X('200 ml heiße Rinderbrühe anrühren → Messbecher', 2),
   X('In Schale 4 abmessen und glatt rühren:', 3, liste=['90 ml Sojasauce', '30 g Honig', '10 g Speisestärke', '10 g Sesamöl',
     '½ TL Chiliflocken', 'die Brühe aus dem Messbecher']),
   X('20 g Sesam und 60 g Cashewkerne im trockenen Wok 3 Min. rösten → Schale 5', 4),
   X('40 g Öl abwiegen und in den Wok geben', 1),
   X('Den großen Topf mit Salzwasser für den Brokkoli aufsetzen', 1, ruhe=12),
   X('900 g Rinderhüftsteak quer zur Faser in dünne Streifen schneiden → Schale 2', Z('fleisch', 9)),
   X('In Schale 2 dazu und mischen: 5 g Speisestärke, 1 TL Pfeffer, 1 EL Wasser – so bleibt das Fleisch zart', 1),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Schale 1 ins kochende Salzwasser und 3 Min. blanchieren, abgießen, kalt abschrecken, abtropfen lassen', 5),
   X('Wok mit dem Öl sehr stark erhitzen, ein Drittel aus Schale 2 darin 2 Min. scharf anbraten, auf den Teller', 3),
   X('Das zweite Drittel genauso', 3),
   X('Das letzte Drittel genauso – alles auf einmal würde kochen statt braten', 3),
   X('Hitze auf mittel, Schale 3 in den Wok und 30 Sek. rühren', 1),
   X('Schale 4 umrühren, dazugießen und 1–2 Min. kochen, bis die Sauce andickt und glänzt', 2),
   X('Fleisch samt Saft und den Brokkoli dazu, 1 Min. durchschwenken', 1),
   X('Reis in den großen Topf, das Wok-Fleisch darauf, Schale 5 dazu und alles mischen', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Das Fleisch kurz anfrieren (30 Min.), dann lässt es sich viel dünner schneiden.',
       'Statt Hüfte geht auch Rinderfilet-Rest oder Roastbeef, Hauptsache mager und quer zur Faser geschnitten.'],
 pauschal=[('Gewürze', 5)],
))

# ======================================================================= 36 Köttbullar
R.append(dict(
 id='koettbullar', name='Köttbullar mit Kartoffelpüree, Rahmsauce & Erbsen', short='Köttbullar',
 desc='Schwedische Hackbällchen aus magerem Rind in brauner Rahmsauce, dazu Kartoffelpüree und Erbsen.',
 protein='Rind', base='Kartoffeln', method='Pfanne + Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '900 g', 'rinderhack-mager', 900, 'g', 'Theke oder 1 × 500 g + 1 × 400 g'),
  I('Kartoffeln, mehligkochend', '1,2 kg geschält', 'kartoffeln', 1500, 'g', 'Beutel 1,5 kg', g=1200),
  I('TK-Erbsen', '400 g', 'erbsen', 400, 'g', 'aus 450-g-Beutel'),
  I('Zwiebeln', '1 große (150 g)', 'zwiebeln', 150, 'g'),
  I('Eier', '1 Stück', 'eier', 1, 'Stk'),
  I('Semmelbrösel', '60 g', 'semmelbroesel', 60, 'g'),
  I('Milch 1,5 %', '250 ml', 'milch', 250, 'ml'),
  I('Kochsahne 15 %', '200 g', 'kochsahne', 200, 'g', '1 Becher'),
  I('Butter', '40 g', 'butter', pantry=True),
  I('Speisestärke', '10 g (1 EL)', 'staerke', pantry=True),
  I('Rinderbrühe', '500 ml', 'bruehe-rind', pantry=True),
  I('Sojasauce', '1 EL', 'sojasauce', pantry=True),
 ],
 spices=[S('Piment, gemahlen','1 TL','piment'), S('Muskatnuss','1 TL, frisch gerieben','muskat'), S('Zwiebelgranulat','1 TL','zwiebelpulver'),
  S('Salz','3 TL','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Hackmasse', 'groß'), ('Stärke', 'klein'), ('Fürs Püree', 'klein'), ('Erbsen', 'mittel')],
 geraete=['große Pfanne mit Deckel', 'großer Topf', 'Kartoffelstampfer', 'Messbecher', 'Sieb', 'Teller'],
 ablauf=[
  ('Vorbereiten', [
   X('1,5 kg Kartoffeln schälen, davon 1,2 kg abwiegen', Z('kartoffel-schaelen', 15)),
   X('Die Kartoffeln in grobe Stücke schneiden → Schale 1, mit kaltem Wasser bedecken', Z('kartoffel-wuerfel', 12)),
   X('1 große Zwiebel (150 g) schälen und sehr fein würfeln → Schale 2', Z('zwiebel-wuerfel', 1.5)),
   X('250 ml Milch abmessen, 100 ml davon → Schale 2, der Rest → Schale 4', 1),
   X('In Schale 2 dazu: 60 g Semmelbrösel, 5 Min. quellen lassen', 1, ruhe=5),
   X('In Schale 2 dazu und mit den Händen gut verkneten:', 5, liste=['900 g Rinderhackfleisch', '1 Ei', '1 TL Piment', '½ TL Muskatnuss',
     '1 TL Zwiebelgranulat', '1½ TL Salz', '1 TL Pfeffer']),
   X('Aus Schale 2 40 kleine Bällchen formen (je ca. 25 g, walnussgroß), auf den Teller', 12),
   ABWASCHEN,
   X('500 ml heiße Rinderbrühe anrühren → Messbecher, 1 EL Sojasauce dazu', 2),
   X('In Schale 3 verrühren: 10 g Speisestärke, 200 g Kochsahne', 1),
   X('400 g TK-Erbsen → Schale 5, bleiben gefroren', 1),
   X('In Schale 4 dazu: 20 g Butter, ½ TL Muskatnuss, 1 TL Salz', 1),
   X('20 g Butter abwiegen und in die Pfanne geben', 1),
   leer_wiegen('Den großen Topf'),
  ]),
  ('Kochen', [
   X('Schale 1 abgießen, in den großen Topf, knapp mit Salzwasser bedecken, aufkochen und 20 Min. kochen, bis sie weich sind', 3, ruhe=20),
   X('Pfanne mit der Butter auf mittlere bis hohe Hitze, die Hälfte der Bällchen darin 6 Min. rundum braun braten, auf den Teller', 7),
   X('Die zweite Hälfte genauso, auf den Teller', 7),
   X('Die Brühe aus dem Messbecher in die Pfanne, den Bratensatz loskratzen, aufkochen', 2),
   X('Schale 3 einrühren und 2 Min. köcheln, bis die Sauce bindet', 2),
   X('Alle Bällchen zurück in die Pfanne, Deckel drauf, 5 Min. leise köcheln', 5),
   X('Kartoffeln abgießen, kurz ausdampfen lassen', 1),
   X('Schale 4 dazu und zu Püree stampfen', 4),
   X('Schale 5 im Sieb unter heißem Wasser auftauen, abtropfen lassen und unter das Püree heben', 2),
   X('Die Sauce mit Salz und Pfeffer abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Püree-Topf') + [
   X('Je 5 Bällchen in jede Box, die Sauce gleichmäßig darüber', 4),
   ABKUEHLEN,
  ]),
 ],
 tips=['Mit einem Klecks Preiselbeeren pro Box wird es richtig schwedisch – 1 TL sind nur rund 15 kcal.',
       'Die Bällchen lassen sich super roh einfrieren: dann direkt aus dem Tiefkühler 2 Min. länger braten.'],
 pauschal=[('Gewürze & Sojasauce', 15)],
))

# ======================================================================= 37 Cottage Pie
R.append(dict(
 id='cottage-pie', name='Cottage Pie', short='Cottage Pie',
 desc='Englischer Auflauf: Rinderhack mit Möhren, Erbsen und Sellerie in dunkler Sauce, bedeckt mit Kartoffelpüree und Cheddar.',
 protein='Rind', base='Kartoffeln', method='Pfanne + Ofen', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '900 g', 'rinderhack-mager', 900, 'g', 'Theke oder 1 × 500 g + 1 × 400 g'),
  I('Kartoffeln, mehligkochend', '1,5 kg geschält', 'kartoffeln', 1750, 'g', 'aus 2-kg-Beutel', g=1500),
  I('Cheddar', '100 g', 'cheddar', 100, 'g', 'aus 200-g-Packung'),
  I('Möhren', '300 g (3 Stück)', 'moehren', 300, 'g'),
  I('Staudensellerie', '1 Stange', 'staudensellerie', 1, 'Stange'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '2 Zehen', 'knoblauch', 2, 'Zehe'),
  I('TK-Erbsen', '250 g', 'erbsen', 250, 'g', 'aus 450-g-Beutel'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Milch 1,5 %', '150 ml', 'milch', 150, 'ml'),
  I('Butter', '20 g', 'butter', pantry=True),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Rinderbrühe', '400 ml', 'bruehe-rind', pantry=True),
  I('Sojasauce', '2 EL', 'sojasauce', pantry=True),
  I('Weizenmehl', '15 g', 'mehl', pantry=True),
 ],
 spices=[S('Thymian','2 TL','thymian'), S('Rosmarin, getrocknet','1 TL','rosmarin'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Muskatnuss','½ TL, frisch gerieben','muskat'), S('Salz','3 TL','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Zwiebeln, Möhren, Sellerie', 'groß'), ('Tomatenmark & Gewürze', 'klein'), ('Erbsen', 'mittel'),
          ('Fürs Püree', 'klein'), ('Cheddar', 'klein')],
 geraete=['große Pfanne', 'großer Topf', 'große Auflaufform (ca. 30 × 40 cm)', 'Kartoffelstampfer', 'Messbecher', 'Reibe', 'Sieb'],
 ablauf=[
  ('Vorbereiten', [
   X('1,75 kg Kartoffeln schälen, davon 1,5 kg abwiegen', Z('kartoffel-schaelen', 17.5)),
   X('Die Kartoffeln in grobe Stücke schneiden → Schale 1, mit kaltem Wasser bedecken', Z('kartoffel-wuerfel', 15)),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('2 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 2)),
   X('3 Möhren (300 g) schälen und in kleine Würfel schneiden → Schale 2', Z('moehre-fein', 3)),
   X('1 Stange Staudensellerie waschen und in kleine Würfel schneiden → Schale 2', Z('sellerie-fein', 1)),
   X('35 g Tomatenmark und 15 g Weizenmehl abwiegen → Schale 3', 1),
   X('In Schale 3 dazu: 2 TL Thymian, 1 TL Rosmarin, 1 TL Paprika geräuchert, 1 TL Pfeffer', Z('gewuerze', 4)),
   X('400 ml heiße Rinderbrühe anrühren → Messbecher, 2 EL Sojasauce dazu, 2 Lorbeerblätter danebenlegen', 2),
   X('250 g TK-Erbsen → Schale 4, bleiben gefroren', 1),
   X('In Schale 5: 20 g Butter, 150 ml Milch, ½ TL Muskatnuss, 1 TL Salz, ½ TL Pfeffer', 1),
   X('100 g Cheddar reiben → Schale 6', Z('kaese-reiben', 1)),
   X('20 g Öl abwiegen und in die Pfanne geben', 1),
   X('Ofen auf 200 °C Ober-/Unterhitze vorheizen', 1, ruhe=12),
   leer_wiegen('Die Auflaufform'),
  ]),
  ('Kochen', [
   X('Schale 1 abgießen, in den großen Topf, knapp mit Salzwasser bedecken, aufkochen und 20 Min. kochen, bis sie weich sind', 3, ruhe=20),
   X('Pfanne mit dem Öl stark erhitzen, 900 g Rinderhackfleisch darin krümelig und braun braten', 8),
   X('Hitze auf mittel, Schale 2 dazu und 6 Min. anschwitzen', 6),
   X('Schale 3 einrühren und 1 Min. rösten', 1),
   X('Den Messbecher dazugießen, Lorbeer dazu, aufkochen und 10 Min. köcheln, bis die Sauce dick ist', 10),
   X('Schale 4 unterrühren, Lorbeer herausnehmen, mit Salz abschmecken', 1),
   X('Kartoffeln abgießen, kurz ausdampfen lassen, Schale 5 dazu und zu Püree stampfen', 5),
   X('Das Hack in die Auflaufform streichen, das Püree darauf verteilen und mit der Gabel Rillen hineinziehen', 4),
   X('Schale 6 darüberstreuen', 1),
   X('20 Min. backen, bis die Oberfläche goldbraun ist', 20),
   X('Form herausnehmen, 10 Min. ruhen lassen', 1, ruhe=10),
  ]),
  ('Portionieren', [
   X('Die Form mit dem Auflauf wiegen und im Rechner bei „Mit Essen“ eintragen', 1),
   X('In 8 gleiche Stücke schneiden und je 1 Stück in eine Box – die Waage kontrolliert', 6),
   ABKUEHLEN,
  ]),
 ],
 tips=['Ein Schuss Worcestersauce statt Sojasauce ist das Original.',
       'Hält sich super im Tiefkühler: Fertige Stücke einfrieren und im Ofen bei 180 °C aufwärmen.'],
 pauschal=[('Gewürze & Sojasauce', 15)],
))

# ======================================================================= 38 Moussaka
R.append(dict(
 id='moussaka', name='Moussaka', short='Moussaka',
 desc='Griechischer Auflauf aus Auberginen, Kartoffeln und Zimt-Hackragout unter einer Béchamel mit Parmesan.',
 protein='Rind', base='Kartoffeln', method='Ofen + Pfanne', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '900 g', 'rinderhack-mager', 900, 'g', 'Theke oder 1 × 500 g + 1 × 400 g'),
  I('Aubergine', '3 Stück (ca. 900 g)', 'aubergine', 3, 'Stk'),
  I('Kartoffeln, festkochend', '1,2 kg geschält', 'kartoffeln', 1500, 'g', 'Beutel 1,5 kg', g=1200),
  I('Stückige Tomaten', '1 Dose à 400 g', 'tomaten-dose', 1, 'Dose'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Milch 1,5 %', '500 ml', 'milch', 500, 'ml'),
  I('Parmesan', '30 g', 'parmesan', 30, 'g'),
  I('Weizenmehl', '40 g', 'mehl', pantry=True),
  I('Butter', '20 g', 'butter', pantry=True),
  I('Olivenöl', '40 g', 'olivenoel', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
 ],
 spices=[S('Zimt','1 TL','zimt'), S('Oregano','2 TL','oregano'), S('Piment, gemahlen','½ TL','piment'), S('Muskatnuss','½ TL, frisch gerieben','muskat'),
  S('Lorbeerblätter','1 Stück','lorbeer'), S('Salz','3 TL','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Auberginen', 'groß'), ('Kartoffeln', 'groß'), ('Zwiebeln & Knoblauch', 'mittel'), ('Tomatenmark & Gewürze', 'klein'),
          ('Mehl', 'klein'), ('Parmesan', 'klein')],
 geraete=['2 Backbleche', 'große Pfanne', 'mittlerer Topf', 'große Auflaufform (ca. 30 × 40 cm)', 'Schneebesen', 'Messbecher', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('Ofen auf 220 °C Umluft vorheizen', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('3 Auberginen (900 g) in 1-cm-Scheiben schneiden → Schale 1', 6),
   X('In Schale 1 mischen: 20 g Olivenöl, 1 TL Salz', 1),
   X('1,5 kg Kartoffeln schälen, davon 1,2 kg abwiegen', Z('kartoffel-schaelen', 15)),
   X('Die Kartoffeln in ½-cm-Scheiben schneiden → Schale 2, mit 10 g Olivenöl und ½ TL Salz mischen', 6),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 3', Z('zwiebel-wuerfel', 2)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 3', Z('knoblauch', 3)),
   X('35 g Tomatenmark abwiegen → Schale 4', 1),
   X('In Schale 4 dazu: 1 TL Zimt, 2 TL Oregano, ½ TL Piment, 1 TL Pfeffer', Z('gewuerze', 4)),
   X('1 Dose stückige Tomaten öffnen, 1 Lorbeerblatt danebenlegen', 1),
   X('40 g Weizenmehl abwiegen → Schale 5', 1),
   X('500 ml Milch abmessen → Messbecher (1 l)', 1),
   X('30 g Parmesan fein reiben → Schale 6, ½ TL Muskatnuss, ½ TL Salz und ½ TL Pfeffer dazu', 1),
   X('150 ml Wasser abmessen → Messbecher', 1),
   X('10 g Olivenöl abwiegen und in die Pfanne geben, 20 g Butter in den mittleren Topf', 1),
   leer_wiegen('Die Auflaufform'),
  ]),
  ('Kochen', [
   X('Schale 1 auf ein Blech, Schale 2 auf das andere, beide in den Ofen, 20 Min. rösten', 20),
   X('Pfanne mit dem Öl stark erhitzen, 900 g Rinderhackfleisch darin krümelig und braun braten', 8),
   X('Hitze auf mittel, Schale 3 dazu und 5 Min. anschwitzen', 5),
   X('Schale 4 einrühren und 1 Min. rösten', 1),
   X('Stückige Tomaten, Lorbeer und den Messbecher mit Wasser dazu, 10 Min. köcheln, bis das Ragout dick ist, mit Salz abschmecken', 10),
   X('Bleche herausnehmen, Ofen auf 180 °C stellen', 1),
   X('Die Butter im mittleren Topf schmelzen, Schale 5 einrühren und 1 Min. anschwitzen', 2),
   X('Die Milch nach und nach mit dem Schneebesen einrühren, 5 Min. köcheln, bis die Béchamel dick ist', 6),
   X('Béchamel mit Schale 6 verrühren und abschmecken', 1),
   X('Lorbeer aus dem Ragout nehmen', 1),
   X('Schichten: Kartoffeln auf den Boden der Form, die Hälfte der Auberginen, das Ragout, der Rest der Auberginen, die Béchamel obendrauf', 5),
   X('35 Min. bei 180 °C backen, bis die Oberfläche goldbraun ist', 35),
   X('Form herausnehmen, 15 Min. ruhen lassen, dann lässt es sich schneiden', 1, ruhe=15),
  ]),
  ('Portionieren', [
   X('Die Form mit dem Auflauf wiegen und im Rechner bei „Mit Essen“ eintragen', 1),
   X('In 8 gleiche Stücke schneiden und je 1 Stück in eine Box – die Waage kontrolliert', 6),
   ABKUEHLEN,
  ]),
 ],
 tips=['Am zweiten Tag ist die Moussaka fester und schmeckt besser – sie ist wie gemacht fürs Meal-Prep.',
       'Mit 2 Eigelb in der Béchamel wird die Haube fester, das kostet pro Box rund 15 kcal.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 39 Taco-Reis-Pfanne
R.append(dict(
 id='taco-reis', name='Taco-Reis-Pfanne mit Rinderhack', short='Taco-Reis-Pfanne',
 desc='Alles aus einer Pfanne: Rinderhack, Reis, Paprika, Mais und Kidneybohnen in Taco-Würze, mit Cheddar geschmolzen.',
 protein='Rind', base='Reis', method='Pfanne', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '800 g', 'rinderhack-mager', 800, 'g', '2 × 400 g'),
  I('Basmati- oder Jasminreis', '240 g', 'reis', 240, 'g'),
  I('Cheddar', '140 g', 'cheddar', 140, 'g', 'aus 200-g-Packung'),
  I('Paprika', '2 Stück (ca. 320 g)', 'paprika', 2, 'Stk'),
  I('Mais', '1 Dose à 425 ml (285 g abgetropft)', 'mais', 1, 'Dose'),
  I('Kidneybohnen', '1 Dose à 400 g (255 g abgetropft)', 'kidney', 1, 'Dose'),
  I('Passierte Tomaten', '500 g', 'passata', 500, 'g', '1 Packung'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Rinderbrühe', '500 ml', 'bruehe-rind', pantry=True),
  I('Koriander, frisch', 'zum Servieren', 'koriander', opt=True),
 ],
 spices=[S('Kreuzkümmel, gemahlen','1 EL','kreuzkuemmel'), S('Paprika geräuchert','1 EL','paprika-geraeuchert'), S('Chilipulver','2 TL','chilipulver'),
  S('Oregano','1 EL','oregano'), S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Zwiebelgranulat','1 TL','zwiebelpulver'),
  S('Cayennepfeffer','½ TL','cayenne'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Zwiebeln, Knobi & Paprika', 'groß'), ('Gewürze & Tomatenmark', 'klein'), ('Reis', 'mittel'), ('Bohnen & Mais', 'groß'), ('Cheddar', 'mittel')],
 geraete=['große Pfanne mit Deckel (hoher Rand) oder großer Topf', 'Sieb', 'Messbecher', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Die Pfanne'),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 2)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 1', Z('knoblauch', 3)),
   X('2 Paprika (320 g) waschen, entkernen und in 1-cm-Würfel schneiden → Schale 1', Z('paprika-wuerfel', 2)),
   X('35 g Tomatenmark abwiegen → Schale 2', 1),
   X('In Schale 2 dazu:', Z('gewuerze', 9), liste=['1 EL Kreuzkümmel', '1 EL Paprika geräuchert', '2 TL Chilipulver', '1 EL Oregano',
     '1 TL Knoblauchpulver', '1 TL Zwiebelgranulat', '½ TL Cayennepfeffer', '1 TL Salz', '1 TL Pfeffer']),
   X('240 g Reis im Sieb waschen, bis das Wasser klar ist, abtropfen lassen → Schale 3', 3),
   X('1 Dose Mais und 1 Dose Kidneybohnen öffnen, im Sieb abspülen und abtropfen lassen → Schale 4', 3),
   X('500 ml heiße Rinderbrühe und 500 g passierte Tomaten → Messbecher', 2),
   X('140 g Cheddar reiben → Schale 5', Z('kaese-reiben', 1.4)),
   X('20 g Öl abwiegen und in die Pfanne geben', 1),
  ]),
  ('Kochen', [
   X('Pfanne mit dem Öl stark erhitzen, 800 g Rinderhackfleisch darin krümelig und braun braten', 8),
   X('Hitze auf mittel, Schale 1 dazu und 5 Min. anschwitzen', 5),
   X('Schale 2 einrühren und 1 Min. rösten', 1),
   X('Schale 3 einrühren, den Messbecher dazugießen, aufkochen', 2),
   X('Deckel drauf, 15 Min. auf kleinster Hitze köcheln, einmal umrühren', 15),
   X('Schale 4 unterrühren, Deckel drauf, Herd aus, 8 Min. ziehen lassen, bis der Reis gar ist', 1, ruhe=8),
   X('Mit Salz abschmecken', 1),
   X('Schale 5 darüberstreuen, Deckel drauf, 2 Min. schmelzen lassen', 2),
  ]),
  ('Portionieren', fuellen('Die Pfanne') + [
   X('Wer mag: Koriander gehackt auf die Boxen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Mit 1 Dose Jalapeños (abgetropft) in Schale 4 wird es scharf.',
       'Beim Aufwärmen 1–2 EL Wasser dazu, der Reis saugt nach.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 40 Hackbällchen in Tomatensauce
R.append(dict(
 id='hackbaellchen', name='Hackbällchen in Tomatensauce mit Spaghetti', short='Hackbällchen-Pasta',
 desc='Saftige Rinder-Hackbällchen in Knoblauch-Tomatensauce auf Spaghetti, mit Parmesan.',
 protein='Rind', base='Nudeln', method='Pfanne + Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '900 g', 'rinderhack-mager', 900, 'g', 'Theke oder 1 × 500 g + 1 × 400 g'),
  I('Spaghetti', '300 g', 'spaghetti', 300, 'g', 'aus 500-g-Packung'),
  I('Passierte Tomaten', '1 kg', 'passata', 1000, 'g', '2 Packungen'),
  I('Parmesan', '50 g', 'parmesan', 50, 'g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Eier', '1 Stück', 'eier', 1, 'Stk'),
  I('Semmelbrösel', '40 g', 'semmelbroesel', 40, 'g'),
  I('Olivenöl', '50 g', 'olivenoel', pantry=True),
  I('Zucker', '5 g (1 TL)', 'zucker', pantry=True),
  I('Basilikum, frisch', '1 Topf', 'basilikum', opt=True),
 ],
 spices=[S('Oregano','2 TL','oregano'), S('Italienische Kräuter','2 TL','ital-kraeuter'), S('Paprika edelsüß','1 TL','paprika-edelsuess'),
  S('Chiliflocken','½ TL','chiliflocken'), S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Salz','3 TL + fürs Nudelwasser','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Hackmasse', 'groß'), ('Zwiebeln & Knoblauch', 'mittel'), ('Gewürze für die Sauce', 'klein'), ('Spaghetti', 'mittel'), ('Parmesan', 'klein')],
 geraete=['große Pfanne mit Deckel', 'großer Nudeltopf', 'Sieb', 'Teller', 'Reibe'],
 ablauf=[
  ('Vorbereiten', [
   X('2 Zwiebeln (200 g) schälen und fein würfeln, die Hälfte → Schale 1, die andere Hälfte → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('4 Knoblauchzehen schälen, 1 fein reiben → Schale 1, 3 fein hacken → Schale 2', Z('knoblauch', 4)),
   X('In Schale 1 dazu und mit den Händen gut verkneten:', 5, liste=['900 g Rinderhackfleisch', '1 Ei', '40 g Semmelbrösel', '2 TL italienische Kräuter',
     '1 TL Paprika edelsüß', '1 TL Knoblauchpulver', '1½ TL Salz', '1 TL Pfeffer']),
   X('Aus Schale 1 32 Bällchen formen (je ca. 30 g), auf den Teller', 10),
   ABWASCHEN,
   X('In Schale 3 abmessen: 2 TL Oregano, ½ TL Chiliflocken, 5 g Zucker, 1 TL Salz, ½ TL Pfeffer', Z('gewuerze', 5)),
   X('300 g Spaghetti abwiegen → Schale 4', 1),
   X('50 g Parmesan fein reiben → Schale 5', 2),
   X('1 kg passierte Tomaten öffnen, 200 ml Wasser abmessen → Messbecher', 1),
   X('50 g Olivenöl abwiegen und in die Pfanne geben', 1),
   leer_wiegen('Den großen Topf'),
   X('Den großen Topf mit Salzwasser für die Nudeln aufsetzen', 1, ruhe=12),
  ]),
  ('Kochen', [
   X('Pfanne mit dem Öl auf mittlere bis hohe Hitze, die Hälfte der Bällchen darin 6 Min. rundum braun braten, auf den Teller', 7),
   X('Die zweite Hälfte genauso, auf den Teller', 7),
   X('Hitze auf mittel, Schale 2 in die Pfanne und 4 Min. glasig dünsten', 4),
   X('Schale 3 dazu und 30 Sek. rösten', 1),
   X('1 kg passierte Tomaten und den Messbecher mit Wasser dazu, aufkochen', 2),
   X('Alle Bällchen samt Saft in die Sauce, Deckel drauf, 15 Min. leise köcheln', 15),
   W('Schale 4 ins kochende Salzwasser, Timer auf 2 Min. weniger als auf der Packung', 1, ruhe=9),
   W('Nudeln abgießen, zurück in den großen Topf', 2),
   X('Sauce abschmecken', 1),
   X('Die Sauce ohne die Bällchen zu den Nudeln in den Topf und mischen', 3),
  ]),
  ('Portionieren', fuellen('Den Nudel-Topf') + [
   X('Je 4 Bällchen in jede Box', 2),
   X('Schale 5 über die Boxen streuen, wer mag Basilikum dazu', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Die Bällchen nicht zu fest kneten, sonst werden sie hart. Mit nassen Händen formen, dann klebt nichts.',
       'Doppelte Menge Bällchen machen und die Hälfte roh einfrieren – beim nächsten Mal sind sie in 20 Min. fertig.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 41 Kohl-Hack-Pfanne
R.append(dict(
 id='kohl-hack', name='Kohl-Hack-Pfanne mit Kartoffeln', short='Kohl-Hack-Pfanne',
 desc='Deftig und günstig: Rinderhack mit Weißkohl, Möhren und Kartoffeln, mit Kümmel und Paprika, Schmand zum Schluss.',
 protein='Rind', base='Kartoffeln', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '1 kg', 'rinderhack-mager', 1000, 'g', '2 × 500 g'),
  I('Kartoffeln, festkochend', '1,4 kg geschält', 'kartoffeln', 1500, 'g', 'Beutel 1,5 kg', g=1400),
  I('Weißkohl', '1 kg (1 kleiner Kopf)', 'weisskohl', 1000, 'g'),
  I('Möhren', '250 g (2–3 Stück)', 'moehren', 250, 'g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '2 Zehen', 'knoblauch', 2, 'Zehe'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Schmand', '150 g', 'schmand', 150, 'g', '1 Becher à 200 g, Rest fürs Brot'),
  I('Öl, neutral', '30 g', 'oel', pantry=True),
  I('Rinderbrühe', '500 ml', 'bruehe-rind', pantry=True),
 ],
 spices=[S('Kümmel, gemahlen','2 TL','kuemmel'), S('Paprika edelsüß','2 EL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Majoran','2 TL','majoran'), S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','3 TL','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Zwiebeln & Knoblauch', 'mittel'), ('Tomatenmark & Gewürze', 'klein'), ('Kohl & Möhren', 'groß'), ('Kartoffeln', 'groß'), ('Schmand', 'klein')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 2)),
   X('2 Knoblauchzehen schälen und fein hacken → Schale 1', Z('knoblauch', 2)),
   X('70 g Tomatenmark abwiegen → Schale 2', 1),
   X('In Schale 2 dazu: 2 TL Kümmel, 2 EL Paprika edelsüß, 1 TL Paprika geräuchert, 2 TL Majoran, 1 TL Pfeffer', Z('gewuerze', 5)),
   X('1 kg Weißkohl vierteln, Strunk herausschneiden und in 1-cm-Streifen schneiden → Schale 3', Z('spitzkohl', 10)),
   X('2–3 Möhren (250 g) schälen und in Scheiben schneiden → Schale 3', Z('moehre-scheiben', 2.5)),
   X('1,5 kg Kartoffeln schälen, davon 1,4 kg abwiegen', Z('kartoffel-schaelen', 15)),
   X('Die Kartoffeln in 2-cm-Würfel schneiden → Schale 4, mit kaltem Wasser bedecken', Z('kartoffel-wuerfel', 14)),
   X('500 ml heiße Rinderbrühe anrühren → Messbecher, 2 Lorbeerblätter danebenlegen', 2),
   X('150 g Schmand → Schale 5', 1),
   X('30 g Öl abwiegen und in den großen Topf geben', 1),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, 1 kg Rinderhackfleisch darin krümelig und braun braten', 8),
   X('Hitze auf mittel, Schale 1 dazu und 4 Min. anschwitzen', 4),
   X('Schale 2 einrühren und 1 Min. rösten', 1),
   X('Schale 3 dazu und 5 Min. mitbraten, bis der Kohl zusammenfällt', 5),
   X('Schale 4 abgießen, Kartoffeln in den Topf, Brühe aus dem Messbecher und Lorbeer dazu, aufkochen', 3),
   X('Zugedeckt 25 Min. köcheln, zweimal umrühren, bis die Kartoffeln weich sind', 25),
   X('Lorbeer herausnehmen, Schale 5 einrühren', 1),
   X('Mit 1½ TL Salz und Pfeffer abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Mit Spitzkohl statt Weißkohl ist es zarter und schneller gar (15 statt 25 Min.).',
       'Am zweiten Tag noch besser. Ein Spritzer Essig beim Essen macht es frischer.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 42 Frikadellen mit Kartoffelsalat
R.append(dict(
 id='frikadellen', name='Frikadellen mit Joghurt-Kartoffelsalat', short='Frikadellen',
 desc='Rinder-Frikadellen aus der Pfanne und leichter Kartoffelsalat mit Joghurt-Senf-Dressing, Gurke und Gewürzgurken – kalt oder warm.',
 protein='Rind', base='Kartoffeln', method='Topf + Pfanne', fridge='3 Tage', freeze='Frikadellen 3 Monate, Salat nicht',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '1 kg', 'rinderhack-mager', 1000, 'g', '2 × 500 g'),
  I('Kartoffeln, festkochend', '1,4 kg', 'kartoffeln', 1400, 'g', 'Beutel 1,5 kg'),
  I('Joghurt 1,5 %', '300 g', 'joghurt', 300, 'g', '1 Becher à 500 g'),
  I('Salatgurke', '1 Stück (ca. 300 g)', 'gurke', 1, 'Stk'),
  I('Gewürzgurken', '150 g', 'gewuerzgurken', 150, 'g', 'aus dem Glas, plus 4 EL Gurkenwasser'),
  I('Zwiebeln', '2–3 Stück (250 g)', 'zwiebeln', 250, 'g'),
  I('Eier', '1 Stück', 'eier', 1, 'Stk'),
  I('Semmelbrösel', '60 g', 'semmelbroesel', 60, 'g'),
  I('Senf, mittelscharf', '30 g (2 EL)', 'senf', pantry=True),
  I('Reis- oder Apfelessig', '20 ml (2 EL)', 'essig', pantry=True),
  I('Öl, neutral', '60 g', 'oel', pantry=True),
  I('Gemüsebrühe (Pulver)', '1 TL', 'bruehe-gemuese', pantry=True),
  I('Dill oder Minze, frisch', 'Dill für den Salat', 'dill', opt=True),
  H('Kleine Döschen mit Deckel', '8 Stück für den Salat, falls die Boxen keine Trennwand haben', 'doeschen'),
 ],
 spices=[S('Paprika edelsüß','2 TL','paprika-edelsuess'), S('Majoran','1 TL','majoran'), S('Zwiebelgranulat','1 TL','zwiebelpulver'),
  S('Salz','3 TL + 1 TL fürs Kochwasser','salz'), S('Pfeffer','2 TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Hackmasse', 'groß'), ('Dressing', 'mittel'), ('Gurken & Zwiebeln', 'mittel')],
 geraete=['großer Topf', 'große Pfanne', 'Teller', 'Sieb', 'große Schüssel für den Salat'],
 ablauf=[
  ('Vorbereiten', [
   X('1,4 kg Kartoffeln waschen, ungeschält → Schale 1', Z('kartoffel-waschen', 14)),
   X('Schale 1 in den großen Topf, mit Wasser bedecken, 1 TL Salz, aufkochen und 20–25 Min. kochen, bis sie gar sind', 3, ruhe=23),
   X('2–3 Zwiebeln (250 g) schälen und sehr fein würfeln, 100 g davon → Schale 2, der Rest → Schale 4', Z('zwiebel-wuerfel', 2.5)),
   X('In Schale 2 dazu und mit den Händen gut verkneten:', 5, liste=['1 kg Rinderhackfleisch', '1 Ei', '60 g Semmelbrösel', '10 g Senf',
     '2 TL Paprika edelsüß', '1 TL Majoran', '1 TL Zwiebelgranulat', '1½ TL Salz', '1 TL Pfeffer']),
   X('Aus Schale 2 16 Frikadellen formen (je ca. 75 g), flach drücken, auf den Teller', 8),
   ABWASCHEN,
   X('In Schale 3 verrühren: 300 g Joghurt, 20 g Senf, 2 EL Essig, 4 EL Gurkenwasser, 1 TL Gemüsebrühe (Pulver), 1 TL Salz, 1 TL Pfeffer', 2),
   X('1 Salatgurke (300 g) längs halbieren, Kerne herauskratzen, in Würfel schneiden → Schale 4', 3),
   X('150 g Gewürzgurken fein würfeln → Schale 4', 2),
   X('Wer mag: Dill fein hacken → Schale 4', 1),
   X('Kartoffeln abgießen, 10 Min. ausdampfen lassen, dann noch warm pellen und in Scheiben schneiden → in die große Schüssel', 15),
   X('Schale 3 über die warmen Kartoffeln geben und vorsichtig mischen – warm ziehen sie das Dressing besser auf', 2),
   X('Schale 4 unterheben, mit Salz und Pfeffer abschmecken', 2),
   X('60 g Öl abwiegen und in die Pfanne geben', 1),
   leer_wiegen('Die Schüssel'),
  ]),
  ('Kochen', [
   X('Pfanne mit dem Öl auf mittlere Hitze, 8 Frikadellen darin je Seite 5 Min. braten, bis sie dunkelbraun sind, auf den Teller', 11),
   X('Die zweiten 8 genauso', 11),
  ]),
  ('Portionieren', fuellen('Die Salat-Schüssel') + [
   X('Je 2 Frikadellen in jede Box, in die andere Hälfte oder ins Döschen', 3),
   ABKUEHLEN,
  ]),
 ],
 tips=['Der Salat schmeckt am zweiten Tag am besten. Zu trocken? 1–2 EL Wasser oder Gurkenwasser dazu.',
       'Die Frikadellen kalt zum Salat oder kurz in der Mikrowelle – beides geht.'],
 pauschal=[('Gewürze & Brühpulver', 15)],
))

# ======================================================================= 43 Giouvetsi
R.append(dict(
 id='giouvetsi', name='Giouvetsi – Kritharaki-Hack-Pfanne mit Feta', short='Giouvetsi',
 desc='Griechisch: Kritharaki garen direkt in der Zimt-Tomaten-Hacksauce mit Zucchini, obendrauf Feta.',
 protein='Rind', base='Nudeln', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '800 g', 'rinderhack-mager', 800, 'g', '2 × 400 g'),
  I('Kritharaki', '360 g', 'kritharaki', 360, 'g', 'aus 500-g-Packung'),
  I('Feta', '200 g', 'feta', 200, 'g', '1 Packung'),
  I('Stückige Tomaten', '2 Dosen à 400 g', 'tomaten-dose', 2, 'Dose'),
  I('Zucchini', '1 Stück (ca. 300 g)', 'zucchini', 1, 'Stk'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Olivenöl', '30 g', 'olivenoel', pantry=True),
  I('Rinderbrühe', '800 ml', 'bruehe-rind', pantry=True),
 ],
 spices=[S('Zimt','1 TL','zimt'), S('Oregano','1 EL','oregano'), S('Piment, gemahlen','½ TL','piment'), S('Paprika edelsüß','1 TL','paprika-edelsuess'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Zwiebeln & Knoblauch', 'mittel'), ('Tomatenmark & Gewürze', 'klein'), ('Zucchini', 'mittel'), ('Kritharaki', 'mittel'), ('Feta', 'klein')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Messbecher (1 l)'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 2)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 1', Z('knoblauch', 3)),
   X('35 g Tomatenmark abwiegen → Schale 2', 1),
   X('In Schale 2 dazu: 1 TL Zimt, 1 EL Oregano, ½ TL Piment, 1 TL Paprika edelsüß, 1 TL Pfeffer', Z('gewuerze', 5)),
   X('1 Zucchini (300 g) in 1-cm-Würfel schneiden → Schale 3', Z('zucchini-wuerfel', 1)),
   X('360 g Kritharaki abwiegen → Schale 4', 1),
   X('200 g Feta grob zerbröseln → Schale 5', 1),
   X('2 Dosen stückige Tomaten öffnen, 2 Lorbeerblätter danebenlegen', 1),
   X('800 ml heiße Rinderbrühe anrühren → Messbecher', 2),
   X('30 g Olivenöl abwiegen und in den großen Topf geben', 1),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, 800 g Rinderhackfleisch darin krümelig und braun braten', 8),
   X('Hitze auf mittel, Schale 1 dazu und 4 Min. anschwitzen', 4),
   X('Schale 2 einrühren und 1 Min. rösten', 1),
   X('Stückige Tomaten, Lorbeer und die Brühe aus dem Messbecher dazu, aufkochen', 3),
   X('Zugedeckt 10 Min. köcheln', 10),
   X('Schale 3 und Schale 4 einrühren', 1),
   X('Offen 12–14 Min. köcheln und oft umrühren, bis die Kritharaki gar und die Sauce sämig sind – sie setzen gern an', 13),
   X('Lorbeer herausnehmen, mit Salz abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Schale 5 über die Boxen streuen, je 25 g', 2),
   ABKUEHLEN,
  ]),
 ],
 tips=['Die Kritharaki saugen in der Box nach. Beim Aufwärmen 2–3 EL Wasser dazu.',
       'Klassisch wird Giouvetsi im Ofen gemacht: Nach dem Einrühren der Kritharaki 25 Min. bei 200 °C in der Auflaufform, das geht genauso.'],
 pauschal=[('Gewürze', 15)],
))

# ======================================================================= 44 Orientalische Hack-Kichererbsen-Pfanne
R.append(dict(
 id='orient-bulgur', name='Orientalische Hack-Kichererbsen-Pfanne mit Bulgur', short='Orient-Hackpfanne',
 desc='Rinderhack mit Kichererbsen, Paprika und Zucchini in Ras-el-Hanout-Tomatensauce, mit Bulgur und Feta.',
 protein='Rind', base='Bulgur', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '800 g', 'rinderhack-mager', 800, 'g', '2 × 400 g'),
  I('Bulgur', '240 g', 'bulgur', 240, 'g', 'aus 500-g-Packung'),
  I('Kichererbsen', '2 Dosen à 400 g (480 g abgetropft)', 'kichererbsen', 2, 'Dose'),
  I('Feta', '100 g', 'feta', 100, 'g', 'aus 150-g-Packung'),
  I('Paprika', '2 Stück (ca. 320 g)', 'paprika', 2, 'Stk'),
  I('Zucchini', '1 Stück (ca. 300 g)', 'zucchini', 1, 'Stk'),
  I('Stückige Tomaten', '1 Dose à 400 g', 'tomaten-dose', 1, 'Dose'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Joghurt 1,5 %', '200 g', 'joghurt', 200, 'g', '1 Becher'),
  I('Olivenöl', '40 g', 'olivenoel', pantry=True),
  I('Gemüsebrühe', '400 ml', 'bruehe-gemuese', pantry=True),
  I('Petersilie, frisch', '1 Bund', 'petersilie', opt=True),
  H('Kleine Döschen mit Deckel', '8 Stück für den Joghurt', 'doeschen'),
 ],
 spices=[S('Ras el Hanout','2 EL','ras-el-hanout'), S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Paprika edelsüß','1 TL','paprika-edelsuess'),
  S('Zimt','½ TL','zimt'), S('Chiliflocken','½ TL','chiliflocken'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Zwiebeln & Knoblauch', 'mittel'), ('Gewürze', 'klein'), ('Paprika & Zucchini', 'groß'), ('Kichererbsen', 'mittel'), ('Bulgur', 'mittel'),
          ('Feta', 'klein')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Sieb', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 1', Z('zwiebel-wuerfel', 2)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 1', Z('knoblauch', 3)),
   X('In Schale 2 abmessen: 2 EL Ras el Hanout, 1 TL Kreuzkümmel, 1 TL Paprika edelsüß, ½ TL Zimt, ½ TL Chiliflocken, 1 TL Pfeffer', Z('gewuerze', 6)),
   X('2 Paprika (320 g) waschen, entkernen und in 1-cm-Würfel schneiden → Schale 3', Z('paprika-wuerfel', 2)),
   X('1 Zucchini (300 g) in 1-cm-Würfel schneiden → Schale 3', Z('zucchini-wuerfel', 1)),
   X('2 Dosen Kichererbsen öffnen, im Sieb abspülen und abtropfen lassen → Schale 4', 2),
   X('240 g Bulgur abwiegen → Schale 5', 1),
   X('100 g Feta zerbröseln → Schale 6', 1),
   X('1 Dose stückige Tomaten öffnen', 1),
   X('400 ml heiße Gemüsebrühe anrühren → Messbecher', 2),
   X('200 g Joghurt mit 1 Prise Salz verrühren und in 8 Döschen füllen, je 25 g, kalt stellen', 3),
   X('40 g Olivenöl abwiegen und in den großen Topf geben', 1),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, 800 g Rinderhackfleisch darin krümelig und braun braten', 8),
   X('Hitze auf mittel, Schale 1 dazu und 4 Min. anschwitzen', 4),
   X('Schale 2 einrühren und 1 Min. rösten, bis es duftet', 1),
   X('Schale 3 dazu und 3 Min. mitbraten', 3),
   X('Stückige Tomaten, Schale 4 und die Brühe aus dem Messbecher dazu, aufkochen', 2),
   X('Schale 5 einrühren, Deckel drauf, 12 Min. auf kleinster Hitze köcheln, einmal umrühren', 12),
   X('Herd aus, 5 Min. ziehen lassen, bis der Bulgur gar ist', 1, ruhe=5),
   X('Mit 1½ TL Salz abschmecken', 1),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Schale 6 über die Boxen streuen, wer mag Petersilie dazu', 2),
   X('Die Joghurt-Döschen kommen beim Essen obendrauf', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Ras el Hanout gibt es im Gewürzregal oder im türkischen Laden. Ersatz: je 1 TL Kreuzkümmel, Koriander, Kurkuma, Paprika, ½ TL Zimt, ¼ TL Nelke.',
       'Mit 2 EL Rosinen in der Sauce wird es süßlich-orientalisch, das sind pro Box 10 kcal mehr.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 45 Massaman-Rindercurry
R.append(dict(
 id='massaman', name='Rinder-Kokos-Curry mit Kartoffeln (Massaman-Art)', short='Massaman-Curry',
 desc='Thailändisch-mild: Rinderhüfte, Kartoffeln, Zwiebeln und grüne Bohnen in Kokos-Curry mit Erdnüssen und Zimt.',
 protein='Rind', base='Kartoffeln', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhüftsteak', '900 g', 'rinderhuefte', 900, 'g', 'Theke oder 2 × 450 g'),
  I('Kartoffeln, festkochend', '1,6 kg geschält', 'kartoffeln', 1800, 'g', 'aus 2-kg-Beutel', g=1600),
  I('Kokosmilch light', '1 Dose à 400 ml', 'kokosmilch-light', 1, 'Dose'),
  I('Rote Currypaste', '1 Glas (70 g)', 'currypaste', 1, 'Glas'),
  I('Erdnüsse, geröstet, ungesalzen', '80 g', 'erdnuesse', 80, 'g', 'aus 200-g-Tüte'),
  I('TK-Bohnen, grün', '300 g', 'tk-bohnen', 300, 'g', 'aus 450-g-Beutel'),
  I('Zwiebeln', '2–3 Stück (250 g)', 'zwiebeln', 250, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Zucker', '10 g (2 TL)', 'zucker', pantry=True),
  I('Rinderbrühe', '500 ml', 'bruehe-rind', pantry=True),
  I('Sojasauce', '2 EL','sojasauce', pantry=True),
 ],
 spices=[S('Zimt','1 TL','zimt'), S('Piment, gemahlen','½ TL','piment'), S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'),
  S('Koriander, gemahlen','1 TL','koriander-gem'), S('Lorbeerblätter','2 Stück','lorbeer'), S('Salz','1½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Rind', 'groß'), ('Zwiebeln', 'mittel'), ('Currypaste & Gewürze', 'klein'), ('Kartoffeln', 'groß'), ('Bohnen', 'mittel'),
          ('Erdnüsse & Limette', 'klein')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Teller fürs Fleisch', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('2–3 Zwiebeln (250 g) schälen und in Spalten schneiden → Schale 2', Z('zwiebel-streifen', 2.5)),
   X('1 Glas rote Currypaste (70 g) → Schale 3', 1),
   X('In Schale 3 dazu: 1 TL Zimt, ½ TL Piment, 1 TL Kreuzkümmel, 1 TL Koriander, gemahlen', Z('gewuerze', 4)),
   X('1,8 kg Kartoffeln schälen, davon 1,6 kg abwiegen', Z('kartoffel-schaelen', 18)),
   X('Die Kartoffeln in 3-cm-Würfel schneiden → Schale 4, mit kaltem Wasser bedecken', Z('kartoffel-wuerfel', 16)),
   X('300 g TK-Bohnen → Schale 5, bleiben gefroren', 1),
   X('80 g Erdnüsse grob hacken → Schale 6', 2),
   X('1 Limette auspressen → Schale 6', 1),
   X('500 ml heiße Rinderbrühe anrühren → Messbecher, 2 EL Sojasauce und 10 g Zucker einrühren, 2 Lorbeerblätter danebenlegen', 2),
   X('1 Dose Kokosmilch light öffnen', 1),
   X('10 g Öl abwiegen und in den großen Topf geben', 1),
   X('900 g Rinderhüftsteak in 3-cm-Würfel schneiden, mit 1 TL Salz und 1 TL Pfeffer mischen → Schale 1', Z('fleisch', 9)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl sehr stark erhitzen, die Hälfte aus Schale 1 darin 3 Min. scharf anbraten, auf den Teller', 4),
   X('Die zweite Hälfte genauso, auf den Teller', 4),
   X('Hitze auf mittel, Schale 2 in den Topf und 5 Min. anbraten', 5),
   X('Schale 3 dazu und 2 Min. rösten, bis es duftet', 2),
   X('Die Hälfte der Kokosmilch einrühren und 2 Min. köcheln', 2),
   X('Fleisch samt Saft vom Teller, Lorbeer und die Brühe aus dem Messbecher dazu, aufkochen', 2),
   X('Zugedeckt 40 Min. leise schmoren, zweimal umrühren', 40),
   X('Schale 4 abgießen, Kartoffeln und die restliche Kokosmilch in den Topf, aufkochen', 2),
   X('Zugedeckt 20 Min. köcheln, bis die Kartoffeln weich sind und das Fleisch zart ist', 20),
   X('Schale 5 dazu und 5 Min. offen köcheln', 5),
   X('Lorbeer herausnehmen, Schale 6 einrühren, mit Salz abschmecken', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [ABKUEHLEN]),
 ],
 tips=['Mit Massaman-Paste aus dem Asia-Laden (70 g) statt roter Currypaste und Gewürzen wird es originaler.',
       'Rindergulasch statt Hüfte geht auch, dann 90 statt 40 Min. schmoren.'],
 pauschal=[('Gewürze, Sojasauce & Zucker', 20)],
))

# ======================================================================= 46 Puten-Ananas-Curry
R.append(dict(
 id='puten-ananas-curry', name='Puten-Curry mit Ananas & Reis', short='Puten-Ananas-Curry',
 desc='Fruchtig-mildes Kokos-Curry mit Putenbrust, Ananas, Paprika und Erbsen, dazu Reis.',
 protein='Pute', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Putenbrust, geschnetzelt', '900 g', 'putenbrust', 900, 'g', 'Theke oder 2 × 450 g'),
  I('Basmati- oder Jasminreis', '260 g', 'reis', 260, 'g'),
  I('Ananas in Saft', '1 Dose à 565 g (340 g abgetropft)', 'ananas-dose', 1, 'Dose'),
  I('Kokosmilch', '1 Dose à 400 ml', 'kokosmilch', 1, 'Dose'),
  I('Paprika', '2 Stück (ca. 320 g)', 'paprika', 2, 'Stk'),
  I('TK-Erbsen', '200 g', 'erbsen', 200, 'g', 'aus 450-g-Beutel'),
  I('Zwiebeln', '1 große (150 g)', 'zwiebeln', 150, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Öl, neutral', '40 g', 'oel', pantry=True),
  I('Hühnerbrühe', '200 ml', 'bruehe-huhn', pantry=True),
  I('Sojasauce', '2 EL', 'sojasauce', pantry=True),
 ],
 spices=[S('Currypulver','2 EL','currypulver'), S('Kurkuma','1 TL','kurkuma'), S('Paprika edelsüß','1 TL','paprika-edelsuess'),
  S('Chiliflocken','½–1 TL','chiliflocken'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Pute', 'groß'), ('Zwiebeln, Knobi & Ingwer', 'mittel'), ('Gewürze', 'klein'), ('Paprika', 'mittel'), ('Ananas', 'mittel'),
          ('Erbsen', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Teller für die Pute', 'Sieb', 'Messbecher', 'Reibe', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(260, 390),
   X('1 große Zwiebel (150 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 1.5)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 3)),
   X('20 g Ingwer schälen und fein reiben → Schale 2', Z('ingwer')),
   X('In Schale 3 abmessen: 2 EL Currypulver, 1 TL Kurkuma, 1 TL Paprika edelsüß, ½–1 TL Chiliflocken, 1 TL Pfeffer', Z('gewuerze', 5)),
   X('2 Paprika (320 g) waschen, entkernen und in 2-cm-Stücke schneiden → Schale 4', Z('paprika-stuecke', 2)),
   X('1 Dose Ananas im Sieb abtropfen lassen, 100 ml vom Saft in den Messbecher, die Stücke → Schale 5', 2),
   X('200 ml heiße Hühnerbrühe und 2 EL Sojasauce → Messbecher', 2),
   X('200 g TK-Erbsen → Schale 6, bleiben gefroren', 1),
   X('1 Dose Kokosmilch öffnen', 1),
   X('40 g Öl abwiegen und in den großen Topf geben', 1),
   X('900 g Putenbrust trocken tupfen, große Stücke nachschneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 9)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 3 Min. anbraten, auf den Teller', 4),
   X('Die zweite Hälfte genauso, auf den Teller', 4),
   X('Hitze auf mittel, Schale 2 in den Topf und 4 Min. glasig dünsten', 4),
   X('Schale 3 einrühren und 1 Min. rösten, bis es duftet', 1),
   X('Schale 4 dazu und 2 Min. mitbraten', 2),
   X('Kokosmilch und den Messbecher dazu, aufkochen und 8 Min. köcheln', 8),
   X('Pute samt Saft vom Teller, Schale 5 und Schale 6 dazu, 5 Min. köcheln, bis die Pute durch ist', 5),
   X('Mit Salz abschmecken', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Curry-Topf') + [ABKUEHLEN]),
 ],
 tips=['Putenbrust wird schnell trocken: nur kurz anbraten und am Ende nicht länger köcheln als nötig.',
       'Mit 1 EL Erdnussbutter in der Sauce wird es cremiger – kostet pro Box rund 10 kcal.'],
 pauschal=[('Gewürze & Sojasauce', 20)],
))

# ======================================================================= 47 Puten-Pilaw
R.append(dict(
 id='puten-pilaw', name='Puten-Pilaw mit Kichererbsen, Rosinen & Mandeln', short='Puten-Pilaw',
 desc='Orientalischer Reis aus einem Topf: Pute, Möhren, Kichererbsen, Rosinen und geröstete Mandeln, dazu Joghurt.',
 protein='Pute', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Putenbrust, geschnetzelt', '800 g', 'putenbrust', 800, 'g', '2 × 400 g'),
  I('Basmatireis', '240 g', 'reis', 240, 'g'),
  I('Kichererbsen', '1 Dose à 400 g (240 g abgetropft)', 'kichererbsen', 1, 'Dose'),
  I('Mandeln, gehobelt', '80 g', 'mandeln', 80, 'g', '1 Tüte à 100 g'),
  I('Rosinen', '40 g', 'rosinen', 40, 'g'),
  I('Zwiebeln', '3 Stück (300 g)', 'zwiebeln', 300, 'g'),
  I('Möhren', '300 g (3 Stück)', 'moehren', 300, 'g'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk', g=20),
  I('Joghurt 1,5 %', '200 g', 'joghurt', 200, 'g', '1 Becher'),
  I('Öl, neutral', '60 g', 'oel', pantry=True),
  I('Hühnerbrühe', '600 ml', 'bruehe-huhn', pantry=True),
  I('Petersilie, frisch', '1 Bund', 'petersilie', opt=True),
  H('Kleine Döschen mit Deckel', '8 Stück für den Joghurt', 'doeschen'),
 ],
 spices=[S('Kreuzkümmel, gemahlen','2 TL','kreuzkuemmel'), S('Kurkuma','1 TL','kurkuma'), S('Zimt','1 TL','zimt'),
  S('Koriander, gemahlen','1 TL','koriander-gem'), S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Piment, gemahlen','½ TL','piment'),
  S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 schalen=[('Pute', 'groß'), ('Zwiebeln, Knobi & Möhren', 'groß'), ('Gewürze', 'klein'), ('Reis', 'mittel'), ('Kichererbsen & Rosinen', 'mittel'),
          ('Mandeln & Zitrone', 'klein')],
 geraete=['großer Topf mit Deckel (mind. 5 l)', 'Teller für die Pute', 'Sieb', 'Messbecher'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   X('3 Zwiebeln (300 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 3)),
   X('3 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 3)),
   X('3 Möhren (300 g) schälen und in kleine Würfel schneiden → Schale 2', Z('moehre-fein', 3)),
   X('In Schale 3 abmessen: 2 TL Kreuzkümmel, 1 TL Kurkuma, 1 TL Zimt, 1 TL Koriander, gemahlen, 1 TL Paprika edelsüß, ½ TL Piment, 1 TL Pfeffer', Z('gewuerze', 7)),
   X('240 g Reis im Sieb waschen, bis das Wasser klar ist, abtropfen lassen → Schale 4', 3),
   X('1 Dose Kichererbsen öffnen, im Sieb abspülen und abtropfen lassen → Schale 5, 40 g Rosinen dazu', 2),
   X('80 g Mandeln im trockenen großen Topf 2 Min. goldbraun rösten, dabei rühren → Schale 6', 3),
   X('½ Zitrone auspressen → Schale 6', 1),
   X('600 ml heiße Hühnerbrühe anrühren → Messbecher', 2),
   X('200 g Joghurt mit 1 Prise Salz verrühren und in 8 Döschen füllen, je 25 g, kalt stellen', 3),
   X('60 g Öl abwiegen und in den großen Topf geben', 1),
   X('800 g Putenbrust trocken tupfen, große Stücke nachschneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 3 Min. anbraten, auf den Teller', 4),
   X('Die zweite Hälfte genauso, auf den Teller', 4),
   X('Hitze auf mittel, Schale 2 in den Topf und 6 Min. anschwitzen', 6),
   X('Schale 3 einrühren und 1 Min. rösten, bis es duftet', 1),
   X('Schale 4 dazu und 1 Min. im Fett rühren, bis die Körner glasig sind', 1),
   X('Die Brühe aus dem Messbecher und Schale 5 dazu, aufkochen', 2),
   X('Deckel drauf, 12 Min. auf kleinster Hitze köcheln – nicht umrühren', 12),
   X('Pute samt Saft vom Teller obenauf legen, Deckel wieder drauf, Herd aus, 10 Min. ziehen lassen', 1, ruhe=10),
   X('Schale 6 unterheben, mit 1½ TL Salz abschmecken, mit der Gabel auflockern', 2),
  ]),
  ('Portionieren', fuellen('Den Topf') + [
   X('Wer mag: Petersilie gehackt auf die Boxen', 1),
   X('Die Joghurt-Döschen kommen beim Essen obendrauf', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Die Mandeln bleiben knackiger, wenn du sie erst beim Essen drüberstreust: dann mit in die Joghurt-Döschen.',
       'Mit Hähnchenbrust statt Pute ändert sich nichts an den Werten.'],
 pauschal=[('Gewürze', 20)],
))

# ======================================================================= 48 Hähnchen-Dal
R.append(dict(
 id='dal', name='Hähnchen-Dal mit roten Linsen & Reis', short='Hähnchen-Dal',
 desc='Cremiges Linsen-Kokos-Dal mit Tomaten, Spinat und Hähnchen, indisch gewürzt, dazu Basmati.',
 protein='Hähnchen', base='Reis', method='Topf', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '800 g', 'haehnchenbrust', 800, 'g', '2 × 400 g'),
  I('Rote Linsen', '160 g', 'linsen-rot', 160, 'g', 'aus 500-g-Packung'),
  I('Basmatireis', '220 g', 'reis', 220, 'g'),
  I('Kokosmilch', '1 Dose à 400 ml', 'kokosmilch', 1, 'Dose'),
  I('Stückige Tomaten', '1 Dose à 400 g', 'tomaten-dose', 1, 'Dose'),
  I('Babyspinat', '250 g', 'spinat', 250, 'g', '2 × 125 g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ingwer', '20 g (daumengroß)', 'ingwer', 20, 'g'),
  I('Limette', '1 Stück', 'limette', 1, 'Stk'),
  I('Öl, neutral', '30 g', 'oel', pantry=True),
  I('Gemüsebrühe', '600 ml', 'bruehe-gemuese', pantry=True),
  I('Koriander, frisch', 'zum Servieren', 'koriander', opt=True),
 ],
 spices=[S('Kurkuma','1½ TL','kurkuma'), S('Kreuzkümmel, gemahlen','2 TL','kreuzkuemmel'), S('Koriander, gemahlen','1 TL','koriander-gem'),
  S('Garam Masala','1 EL','garam-masala'), S('Chilipulver','1 TL','chilipulver'), S('Ingwer, gemahlen','½ TL','ingwer-gem'),
  S('Salz','2 TL','salz'), S('Pfeffer','½ TL','pfeffer')],
 schalen=[('Hähnchen', 'groß'), ('Zwiebeln, Knobi & Ingwer', 'mittel'), ('Gewürze', 'klein'), ('Linsen', 'mittel'), ('Limettensaft', 'klein')],
 geraete=['großer Topf', 'kleiner Topf mit Deckel', 'Teller fürs Hähnchen', 'Sieb', 'Messbecher', 'Reibe', 'Schüssel zum Wiegen'],
 ablauf=[
  ('Vorbereiten', [
   leer_wiegen('Den großen Topf'),
   reis_vorbereiten(220, 330),
   X('2 Zwiebeln (200 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2)),
   X('4 Knoblauchzehen schälen und fein hacken → Schale 2', Z('knoblauch', 4)),
   X('20 g Ingwer schälen und fein reiben → Schale 2', Z('ingwer')),
   X('In Schale 3 abmessen:', Z('gewuerze', 7), liste=['1½ TL Kurkuma', '2 TL Kreuzkümmel', '1 TL Koriander, gemahlen', '1 EL Garam Masala',
     '1 TL Chilipulver', '½ TL Ingwer, gemahlen', '½ TL Pfeffer']),
   X('160 g rote Linsen im Sieb abspülen → Schale 4', 1),
   X('600 ml heiße Gemüsebrühe anrühren → Messbecher', 2),
   X('1 Dose stückige Tomaten und 1 Dose Kokosmilch öffnen', 1),
   X('1 Limette auspressen → Schale 5', 1),
   X('30 g Öl abwiegen und in den großen Topf geben', 1),
   X('800 g Hähnchenbrust in 2-cm-Würfel schneiden, mit 1 TL Salz mischen → Schale 1', Z('fleisch', 8)),
   ABWASCHEN,
  ]),
  ('Kochen', [
   REIS_KOCHEN,
   X('Den großen Topf mit dem Öl stark erhitzen, die Hälfte aus Schale 1 darin 3–4 Min. braten, bis es Farbe hat, auf den Teller', 5),
   X('Die zweite Hälfte genauso, auf den Teller', 5),
   X('Hitze auf mittel, Schale 2 in den Topf und 5 Min. glasig dünsten', 5),
   X('Schale 3 einrühren und 1 Min. rösten, bis es duftet', 1),
   X('Schale 4, stückige Tomaten und die Brühe aus dem Messbecher dazu, aufkochen', 2),
   X('Offen 15 Min. köcheln und ab und zu rühren, bis die Linsen zerfallen', 15),
   X('Kokosmilch und das Hähnchen samt Saft vom Teller dazu, 5 Min. köcheln, bis es durch ist', 5),
   X('250 g Babyspinat handvollweise einrühren, bis er zusammenfällt', 2),
   X('Schale 5 einrühren, mit Salz abschmecken', 1),
  ]),
  ('Portionieren', [
   X('Eine Schüssel auf die Waage, Tara drücken, den Reis hineinfüllen und das Gewicht durch 8 teilen', 2),
   X('Den Reis auf die 8 Boxen verteilen', 3),
  ] + fuellen('Den Dal-Topf') + [
   X('Wer mag: Koriander gehackt auf die Boxen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['Das Dal dickt in der Box stark nach. Beim Aufwärmen 2–3 EL Wasser dazu.',
       'Ohne Hähnchen und mit 300 g Linsen wird es vegetarisch, dann fehlen pro Box rund 12 g Eiweiß.'],
 pauschal=[('Gewürze', 25)],
))

# ======================================================================= 49 Cheeseburger-Pfanne
R.append(dict(
 id='cheeseburger', name='Cheeseburger-Pfanne mit Kartoffeln', short='Cheeseburger-Pfanne',
 desc='Schmeckt wie ein Cheeseburger: Rinderhack, Zwiebeln, Gewürzgurken, Ketchup-Senf-Sauce und geschmolzener Cheddar auf Bratkartoffeln.',
 protein='Rind', base='Kartoffeln', method='Ofen + Pfanne', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch mager (max. 5 % Fett)', '800 g', 'rinderhack-mager', 800, 'g', '2 × 400 g'),
  I('Kartoffeln, festkochend', '1,6 kg', 'kartoffeln', 1600, 'g', 'aus 2-kg-Beutel'),
  I('Cheddar', '200 g', 'cheddar', 200, 'g', '1 Packung'),
  I('Zwiebeln', '2–3 Stück (250 g)', 'zwiebeln', 250, 'g'),
  I('Gewürzgurken', '150 g', 'gewuerzgurken', 150, 'g', 'aus dem Glas'),
  I('Ketchup', '100 g', 'ketchup', 100, 'g', 'aus der Flasche'),
  I('Tomatenmark', '35 g', 'tomatenmark', 35, 'g', 'kleine Dose, Rest einfrieren'),
  I('Senf, mittelscharf', '20 g (1 EL)', 'senf', pantry=True),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Rinderbrühe', '400 ml', 'bruehe-rind', pantry=True),
  I('Reis- oder Apfelessig', '1 EL', 'essig', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
 ],
 spices=[S('Paprika geräuchert','2 TL','paprika-geraeuchert'), S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Zwiebelgranulat','1 TL','zwiebelpulver'),
  S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Salz','2½ TL','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Kartoffeln', 'groß'), ('Zwiebeln', 'mittel'), ('Tomatenmark & Gewürze', 'klein'), ('Sauce', 'klein'), ('Gewürzgurken', 'klein'),
          ('Cheddar', 'mittel')],
 geraete=['2 Backbleche', 'große Pfanne mit Deckel', 'Messbecher', 'Reibe', 'große Schüssel zum Mischen'],
 ablauf=[
  ('Vorbereiten', [
   X('Ofen auf 200 °C Umluft vorheizen – zwei Bleche gehen nur mit Umluft', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('1,6 kg Kartoffeln gründlich waschen und ungeschält in 2-cm-Würfel schneiden → Schale 1',
     Z('kartoffel-waschen', 16) + Z('kartoffel-wuerfel', 16)),
   X('In Schale 1 mischen: 10 g Öl, 1 TL Paprika edelsüß, 1 TL Salz, ½ TL Pfeffer', 2),
   X('2–3 Zwiebeln (250 g) schälen und fein würfeln → Schale 2', Z('zwiebel-wuerfel', 2.5)),
   X('35 g Tomatenmark abwiegen → Schale 3', 1),
   X('In Schale 3 dazu: 2 TL Paprika geräuchert, 1 TL Knoblauchpulver, 1 TL Zwiebelgranulat, 1 TL Pfeffer', Z('gewuerze', 4)),
   X('In Schale 4 verrühren: 100 g Ketchup, 20 g Senf, 1 EL Essig', 1),
   X('150 g Gewürzgurken fein würfeln → Schale 5', 2),
   X('200 g Cheddar reiben → Schale 6', Z('kaese-reiben', 2)),
   X('400 ml heiße Rinderbrühe anrühren → Messbecher', 2),
   X('10 g Öl abwiegen und in die Pfanne geben', 1),
   leer_wiegen('Die große Schüssel'),
  ]),
  ('Kochen', [
   X('Schale 1 auf beide Bleche verteilen, 35 Min. backen, nach 20 Min. wenden, bis sie goldbraun sind', 35),
   W('Pfanne mit dem Öl stark erhitzen, 800 g Rinderhackfleisch darin krümelig und braun braten', 8),
   W('Hitze auf mittel, Schale 2 dazu und 6 Min. anschwitzen', 6),
   W('Schale 3 einrühren und 1 Min. rösten', 1),
   W('Die Brühe aus dem Messbecher dazu, aufkochen und 8 Min. einkochen, bis kaum noch Flüssigkeit da ist', 8),
   W('Schale 4 und Schale 5 unterrühren, mit 1 TL Salz abschmecken, Herd aus', 2),
   X('Bleche herausnehmen, Ofen aus', 1),
   X('Die Kartoffeln in die große Schüssel, das Hack darauf und mischen', 2),
   X('Schale 6 unterheben, bis der Käse in der Hitze schmilzt', 2),
  ]),
  ('Portionieren', fuellen('Die Schüssel') + [ABKUEHLEN]),
 ],
 tips=['Noch mehr Burger: 1 TL Sesam pro Box drüber und ein Blatt Eisbergsalat beim Essen dazu.',
       'Die Kartoffeln werden knuspriger, wenn sie nicht übereinanderliegen – lieber zwei Bleche.'],
 pauschal=[('Gewürze & Essig', 15)],
))

# ======================================================================= 50 Pulled Chicken BBQ
R.append(dict(
 id='pulled-chicken', name='Pulled Chicken BBQ mit Ofenkartoffeln & Coleslaw', short='Pulled Chicken',
 desc='Zart gezupfte Hähnchenkeule in BBQ-Sauce, Ofenkartoffeln und ein leichter Joghurt-Coleslaw.',
 protein='Hähnchen', base='Kartoffeln', method='Topf + Ofen', fridge='4 Tage', freeze='3 Monate, ohne Coleslaw',
 items=[
  I('Hähnchen-Oberkeulenfilet', '1,2 kg', 'haehnchenkeule', 1200, 'g', '2 × 600 g'),
  I('Kartoffeln, festkochend', '1,2 kg', 'kartoffeln', 1200, 'g', 'Beutel 1,5 kg'),
  I('BBQ-Sauce', '250 g', 'bbq-sauce', 250, 'g', 'aus der Flasche'),
  I('Weißkohl', '600 g (½ Kopf)', 'weisskohl', 600, 'g'),
  I('Möhren', '200 g (2 Stück)', 'moehren', 200, 'g'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Joghurt 1,5 %', '200 g', 'joghurt', 200, 'g', '1 Becher'),
  I('Reis- oder Apfelessig', '20 ml (2 EL)', 'essig', pantry=True),
  I('Öl, neutral', '20 g', 'oel', pantry=True),
  I('Hühnerbrühe', '300 ml', 'bruehe-huhn', pantry=True),
  I('Senf, mittelscharf', '1 TL', 'senf', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
  H('Kleine Döschen mit Deckel', '8 Stück für den Coleslaw', 'doeschen'),
 ],
 spices=[S('Paprika geräuchert','1 EL','paprika-geraeuchert'), S('Paprika edelsüß','1 EL','paprika-edelsuess'), S('Knoblauchpulver','1 TL','knoblauchpulver'),
  S('Zwiebelgranulat','1 TL','zwiebelpulver'), S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Cayennepfeffer','½ TL','cayenne'),
  S('Salz','3 TL','salz'), S('Pfeffer','1½ TL','pfeffer')],
 schalen=[('Hähnchen mit Rub', 'groß'), ('Zwiebeln', 'klein'), ('Kartoffeln', 'groß'), ('Coleslaw', 'groß')],
 geraete=['großer Topf mit Deckel', 'großer Topf mit Deckel', '2 Backbleche', 'Messbecher', '2 Gabeln zum Zupfen', 'Reibe oder Hobel'],
 ablauf=[
  ('Vorbereiten', [
   X('In Schale 1 abmessen und mischen:', Z('gewuerze', 8), liste=['1 EL Paprika geräuchert', '1 EL Paprika edelsüß', '1 TL Knoblauchpulver',
     '1 TL Zwiebelgranulat', '1 TL Kreuzkümmel', '½ TL Cayennepfeffer', '1½ TL Salz', '1 TL Pfeffer']),
   X('1,2 kg Hähnchen-Oberkeulenfilet im Ganzen lassen, grobes Fett wegschneiden → Schale 1 und im Rub wälzen', 4),
   ABWASCHEN,
   X('2 Zwiebeln (200 g) schälen und in Streifen schneiden → Schale 2', Z('zwiebel-streifen', 2)),
   X('300 ml heiße Hühnerbrühe anrühren → Messbecher', 2),
   X('20 g Öl abwiegen und in den großen Topf geben', 1),
   X('Ofen auf 200 °C Umluft vorheizen – zwei Bleche gehen nur mit Umluft', 1, ruhe=12),
   X('2 Bleche mit Backpapier belegen', 1),
   X('1,2 kg Kartoffeln gründlich waschen und ungeschält in Spalten schneiden → Schale 3', Z('kartoffel-waschen', 12) + Z('kartoffel-wuerfel', 12)),
   X('In Schale 3 mischen: 1 TL Salz, ½ TL Pfeffer – das Öl ist schon im Topf, die Kartoffeln bleiben ohne', 1),
   X('600 g Weißkohl sehr fein hobeln oder schneiden → Schale 4', Z('spitzkohl', 6)),
   X('2 Möhren (200 g) schälen und grob raspeln → Schale 4', Z('moehre-fein', 2)),
   X('In Schale 4 dazu und gut mischen: 200 g Joghurt, 2 EL Essig, 1 TL Senf, ½ TL Salz, 1 Prise Pfeffer', 2),
   X('Schale 4 abgedeckt kalt stellen, mind. 30 Min. – der Kohl wird dabei weicher', 1, ruhe=30),
   leer_wiegen('Den Hähnchen-Topf'),
  ]),
  ('Kochen', [
   X('Den großen Topf mit dem Öl stark erhitzen, Schale 1 darin je Seite 3 Min. anbraten, in zwei Portionen', 8),
   X('Schale 2 dazu und 2 Min. mitbraten', 2),
   X('Mit der Brühe aus dem Messbecher ablöschen, Deckel drauf, 35 Min. leise köcheln, bis sich das Fleisch leicht zerzupfen lässt', 35),
   W('Schale 3 auf beide Bleche verteilen, 30 Min. backen, nach 15 Min. wenden', 30),
   X('Deckel ab, das Hähnchen mit zwei Gabeln im Topf zerzupfen', 4),
   X('250 g BBQ-Sauce einrühren und offen 5 Min. einkochen, bis die Sauce am Fleisch klebt', 5),
   X('Mit Salz abschmecken', 1),
   X('Bleche herausnehmen, Ofen aus', 1),
  ]),
  ('Portionieren', fuellen('Den Hähnchen-Topf') + [
   X('Die Kartoffeln von den Blechen gleichmäßig auf die 8 Boxen verteilen', 3),
   X('Den Coleslaw (Schale 4) in 8 Döschen füllen, je ca. 110 g', 3),
   X('Die Döschen gleich mit Deckel kalt stellen', 1),
   ABKUEHLEN,
  ]),
 ],
 tips=['BBQ-Saucen sind unterschiedlich süß und dick. Ist deine sehr dick, 2–3 EL Wasser mit einrühren.',
       'Der Coleslaw hält sich 3 Tage, danach wird er wässrig. Die Hähnchen-Boxen halten länger.'],
 pauschal=[('Gewürze', 20)],
))

# ---------------------------------------------------------------- Ausgabe
# Frühstück für 7 Tage: Tobis Standardfrühstück (141 g Skyr, 9 g Vanille-Whey,
# 27 g Haferflocken, 25 g Erdnuss-Crunch, 125 g Apfel) mal sieben.
EXTRAS = {
 'fruehstueck': {'id': 'fruehstueck', 'short': 'Frühstück', 'tage': 7, 'items': [
   {'k': 'skyr', 'q': 987, 'u': 'g', 'h': '7 × 141 g'},
   {'k': 'haferflocken', 'q': 189, 'u': 'g', 'h': '7 × 27 g'},
   {'k': 'erdnuss-crunch', 'q': 175, 'u': 'g', 'h': '7 × 25 g'},
   {'k': 'aepfel', 'q': 875, 'u': 'g', 'h': '7 × 125 g'},
   {'k': 'whey-vanille', 'q': 63, 'u': 'g', 'h': '7 × 9 g'},
 ]},
}

PHASEN = ['Vorbereiten', 'Kochen', 'Portionieren']

def menge_text(q, u):
    """Wie menge() in js/format.js: 1500 g → „1,5 kg“, 700 ml → „700 ml“."""
    if u == 'g' and q >= 1000: return f"{q / 1000:g}".replace('.', ',') + ' kg'
    if u == 'ml' and q >= 1000: return f"{q / 1000:g}".replace('.', ',') + ' l'
    return f"{int(q) if float(q).is_integer() else q} {u}"

STOPP = {'oder', 'mit', 'max', 'fett', 'light', 'natur', 'leicht', 'kräftig', 'frisch', 'roh', 'ohne', 'mager', 'festkochend', 'gemahlen', 'getrocknet', 'edelsüß', 'kühlregal', 'stück', 'creamy', 'crunchy'}
# Wortteile, die in den Schritten anders vorkommen als im Namen („Basmatireis“ → „Reis“, „Schlagsahne“ → „Sahne“).
SYNONYM = [('reis', 'reis'), ('sahne', 'sahne'), ('mehl', 'mehl'), ('nudeln', 'nudel'), ('öl', 'öl'), ('hack', 'hack')]
# Ein Adjektiv vorn im Namen muss im Schritt dabeistehen („Rote Zwiebeln“ ≠ „Zwiebeln“).
ADJEKTIV = {'rote', 'gelbe', 'grüne', 'schwarze', 'weiße', 'getrocknete', 'passierte', 'stückige'}
def staemme(name):
    """(muss, kann): Wortstämme, die alle bzw. von denen einer neben der Menge stehen muss."""
    n = name.lower()
    woerter = [w.strip('.%') for w in re.split(r'[\s,()/-]+', n)]
    muss = [w[:5] for w in woerter[:1] if w in ADJEKTIV]
    kann = [w[:5] for w in woerter if len(w) >= 4 and w not in STOPP and w not in ADJEKTIV and not re.match(r'^\d', w)]
    kann += [stamm for teil, stamm in SYNONYM if teil in n and stamm not in kann]
    return muss, kann

def platzhalter(text, it):
    """Die Menge einer Zutat im Schritt („600 g Süßkartoffel“, „3 Zwiebeln (300 g)“) wird zu {schlüssel},
    damit die App sie beim Anpassen neu einsetzen kann. Nur, wenn der Name der Zutat danebensteht."""
    q, u = gramm_von(it)
    if not q or it['u'] not in ('g', 'ml', None) or (it['u'] is None and not it['pantry']): return text
    if isinstance(it['q'], (int, float)): q, u = it['q'], it['u']
    m = menge_text(q, u)
    muss, kann = staemme(it['n'])
    if not kann: return text
    aus = text
    for match in list(re.finditer(re.escape(m) + r'(?![\w,.])', text))[::-1]:
        davor = re.split(r'[\s,()/-]+', text[max(0, match.start() - 34):match.start()].lower())
        danach = re.split(r'[\s,()/-]+', text[match.end():match.end() + 44].lower())
        umfeld = [w for w in danach[:4] + davor[-3:] if w]
        da = lambda s_: any(w.startswith(s_) for w in umfeld)
        if all(da(s_) for s_ in muss) and any(da(s_) for s_ in kann):
            aus = aus[:match.start()] + '{' + it['k'] + '}' + aus[match.end():]
    return aus

def naehrwert_zeilen(r):
    """Die Tabelle: jede Zutat mit Gramm und Werten, dazu die Pauschalen (Gewürze …)."""
    zeilen = []
    for it in r['items']:
        if it['opt'] or it['haus'] or not it['k']: continue
        nk = nk_von(it['k'])
        g, gu = gramm_von(it)
        if not g or nk not in N: continue
        v = N[nk]
        zeilen.append([it['n'].split(' (')[0], menge_text(g, gu), *[round(x * g / 100, 1) for x in v]])
    for label, g, *rest in r.get('pauschal', []):
        v = N[rest[0] if rest else 'gewuerze']
        zeilen.append([label, f'ca. {g} g', *[round(x * g / 100, 1) for x in v]])
    return zeilen

def phase_minuten(schritte):
    """Wie js/zeiten.js: Hauptschritte nacheinander, „neben“ in der Zeit des
    Schritts davor, „ruhe“ läuft im Hintergrund weiter."""
    t = 0; ende = 0; neben_ab = 0
    for s in schritte:
        if s.get('neben'):
            start = neben_ab; neben_ab += s['min']
            ende = max(ende, start + s['min'] + s.get('ruhe', 0))
        else:
            start = t; t += s['min']; neben_ab = start
            ende = max(ende, t + s.get('ruhe', 0))
    return max(t, ende)

def runden5(m): return max(5, 5 * int(m / 5 + 0.5))

SCHALE = re.compile(r'Schale (\d+)')

out=[]
for r in R:
    # Nährwerte je Zutat, fürs Etikett und fürs Anpassen in der App
    for it in r['items']:
        nk = nk_von(it['k']) if it['k'] else None
        g, gu = gramm_von(it)
        it['g'] = g
        it['gu'] = gu
        it['pro100'] = dict(zip(('kcal', 'p', 'kh', 'f'), N[nk])) if nk in N and g and not it['opt'] and not it['haus'] else None
        it['anpassbar'] = bool(it['pro100']) and nk in ANPASSBAR and not it['fest']
        it['min'] = round(g * 0.5) if it['anpassbar'] else g
        it['max'] = round(g * 1.6) if it['anpassbar'] else g
        del it['fest']
        if it['pantry'] and not isinstance(it['q'], (int, float)) and g:
            it['q'], it['u'] = g, gu
    r['nut'] = naehrwert_zeilen(r)
    r['pauschal'] = [{'n': z[0], 'g': z[1], 'nk': z[2] if len(z) > 2 else 'gewuerze', 'pro100': dict(zip(('kcal', 'p', 'kh', 'f'), N[z[2] if len(z) > 2 else 'gewuerze']))} for z in r.get('pauschal', [])]
    # Platzhalter: genauere Namen zuerst („Rote Zwiebeln“ vor „Zwiebeln“), jede Menge nur einmal.
    for t_, schritte in r['ablauf']:
        for s_ in schritte:
            for it in sorted(r['items'], key=lambda x: (-len(staemme(x['n'])[0]), -len(x['n']))):
                if it['k']:
                    s_['d'] = platzhalter(s_['d'], it)
                    if s_.get('liste'): s_['liste'] = [platzhalter(x, it) for x in s_['liste']]
    tot=[round(sum(row[i] for row in r['nut']),1) for i in range(2,6)]
    r['total']=tot
    r['m']={'kcal':round(tot[0]/8),'p':round(tot[1]/8,1),'kh':round(tot[2]/8,1),'f':round(tot[3]/8,1)}
    r['schalen'] = [{'n': i + 1, 'name': n, 'gr': g} for i, (n, g) in enumerate(r['schalen'])]
    r['ablauf'] = [{'t': t, 'schritte': s} for t, s in r['ablauf']]
    if [p['t'] for p in r['ablauf']] != PHASEN: raise SystemExit(f"{r['id']}: Abschnitte müssen {PHASEN} sein")
    phasen = [runden5(phase_minuten(p['schritte'])) for p in r['ablauf']]
    r['zeit'] = {'phasen': phasen, 'gesamt': sum(phasen)}
    r['time'] = r['zeit']['gesamt']
    # Schalen: jede wird gefüllt, bevor sie gebraucht wird, und jede wird gebraucht.
    gefuellt, gebraucht = set(), set()
    for p in r['ablauf']:
        for s in p['schritte']:
            text = s['d'] + ' ' + ' '.join(s.get('liste', []))
            for m in re.finditer(r'(?:→|in|In) Schale (\d+)', text): gefuellt.add(int(m.group(1)))
            for m in SCHALE.finditer(text):
                n = int(m.group(1))
                if n > len(r['schalen']): raise SystemExit(f"{r['id']}: Schale {n} gibt es nicht")
                vor = text[max(0, m.start() - 3):m.start()]
                if not re.search(r'(→ |in |In )$', vor):
                    if n not in gefuellt: raise SystemExit(f"{r['id']}: Schale {n} wird gebraucht, bevor sie gefüllt ist: {s['d']}")
                    gebraucht.add(n)
    leer = {s['n'] for s in r['schalen']} - gebraucht
    if leer: raise SystemExit(f"{r['id']}: Schale(n) {sorted(leer)} werden nie gebraucht")
    # Die Nummern folgen der Reihenfolge, in der die Schalen beim Kochen gebraucht werden.
    reihe = []
    for p in r['ablauf'][1:]:
        for s in p['schritte']:
            text = s['d'] + ' ' + ' '.join(s.get('liste', []))
            for m in SCHALE.finditer(text):
                n = int(m.group(1))
                if not re.search(r'(→ |in |In )$', text[max(0, m.start() - 3):m.start()]) and n not in reihe: reihe.append(n)
    if reihe != sorted(reihe): raise SystemExit(f"{r['id']}: Schalen werden in der Reihenfolge {reihe} gebraucht – bitte so nummerieren")
    for it in r['items']:
        if it['k'] and it['k'] not in CAT: raise SystemExit('Schlüssel fehlt im Katalog: '+it['k'])
    for s_ in r['spices']:
        if s_['k'] not in CAT: raise SystemExit('Schlüssel fehlt im Katalog: '+s_['k'])
    keys=[it['k'] for it in r['items'] if it['k']]+[s_['k'] for s_ in r['spices']]
    dup={k for k in keys if keys.count(k)>1}
    if dup: raise SystemExit(f"Doppelter Schlüssel in {r['id']}: {dup}")
    out.append(r)
for e in EXTRAS.values():
    for it in e['items']:
        if it['k'] not in CAT: raise SystemExit('Schlüssel fehlt im Katalog: '+it['k'])

print(f"{'Rezept':16s} {'kcal':>4s} {'P':>5s} {'KH':>5s} {'F':>5s}   {'Zeit':>12s}   Schalen")
for r in out:
    z = r['zeit']
    print(f"{r['id']:16s} {r['m']['kcal']:4d} {r['m']['p']:5.1f} {r['m']['kh']:5.1f} {r['m']['f']:5.1f}   "
          f"{'+'.join(map(str, z['phasen'])):>8s}={z['gesamt']:3d}   {len(r['schalen'])}")

ziel = HIER.parent / 'daten' / 'rezepte.json'
daten = {
    'version': 1,
    'ziel': ZIEL,
    'rezepte': out,
    'katalog': {k: {'n': v[0], 'c': v[1]} for k, v in CAT.items()},
    # Fürs Anpassen: Werte pro 100 g je Katalog-Schlüssel, Einheit und Gramm je Einheit
    'naehrwerte': {k: {'pro100': dict(zip(('kcal', 'p', 'kh', 'f'), N[nk_von(k)])), 'u': EINHEIT_G.get(k, ('g',))[0], 'je': EINHEIT_G.get(k, ('g', 100))[1] if k in EINHEIT_G else 100,
                       'anpassbar': nk_von(k) in ANPASSBAR}
                   for k in CAT if nk_von(k) in N and CAT[k][1] not in ('gewuerz', 'haushalt')},
    'extras': EXTRAS,
}
ziel.write_text(json.dumps(daten, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(out)} Rezepte → {ziel.relative_to(HIER.parent)}')
