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
 # Obst & Gemüse
 'zwiebeln': ('Zwiebeln', 'obst'), 'rote-zwiebeln': ('Rote Zwiebeln', 'obst'), 'knoblauch': ('Knoblauch', 'obst'),
 'ingwer': ('Ingwer', 'obst'), 'paprika': ('Paprika', 'obst'), 'zucchini': ('Zucchini', 'obst'), 'brokkoli': ('Brokkoli', 'obst'),
 'moehren': ('Möhren', 'obst'), 'champignons': ('Champignons', 'obst'), 'spinat': ('Babyspinat', 'obst'),
 'zuckerschoten': ('Zuckerschoten', 'obst'), 'fruehlingszwiebeln': ('Frühlingszwiebeln', 'obst'), 'spitzkohl': ('Spitzkohl', 'obst'),
 'gurke': ('Salatgurke', 'obst'), 'tomaten': ('Tomaten', 'obst'), 'kirschtomaten': ('Kirschtomaten', 'obst'),
 'kartoffeln': ('Kartoffeln, festkochend', 'obst'), 'suesskartoffel': ('Süßkartoffeln', 'obst'),
 'staudensellerie': ('Staudensellerie', 'obst'), 'limette': ('Limetten', 'obst'), 'zitrone': ('Zitronen', 'obst'),
 'koriander': ('Koriander, frisch', 'obst'), 'basilikum': ('Basilikum, frisch', 'obst'), 'petersilie': ('Petersilie, frisch', 'obst'),
 'dill': ('Dill oder Minze, frisch', 'obst'),
 # Kühlregal & Käse
 'skyr': ('Skyr natur', 'kuehl'), 'magerquark': ('Magerquark', 'kuehl'),
 'frischkaese': ('Frischkäse leicht', 'kuehl'), 'kochsahne': ('Kochsahne 15 %', 'kuehl'), 'schlagsahne': ('Schlagsahne 30 %', 'kuehl'),
 'schmand': ('Schmand', 'kuehl'), 'milch': ('Milch 1,5 %', 'kuehl'), 'cheddar': ('Cheddar', 'kuehl'),
 'parmesan': ('Parmesan', 'kuehl'), 'feta': ('Feta', 'kuehl'),
 'gnocchi': ('Gnocchi', 'trocken'), 'butter': ('Butter', 'kuehl'),
 # Tiefkühl
 'tk-kraeuter': ('TK-Kräuter (8-Kräuter)', 'tk'),
 # Konserven & Gläser – in der App unter „Trockenes“
 'tomaten-dose': ('Stückige Tomaten, Dose à 400 g', 'konserven'), 'passata': ('Passierte Tomaten', 'konserven'),
 'tomatenmark': ('Tomatenmark', 'konserven'), 'kidney': ('Kidneybohnen, Dose à 400 g', 'konserven'),
 'schwarze-bohnen': ('Schwarze Bohnen, Dose à 400 g', 'konserven'), 'mais': ('Mais, Dose à 425 ml', 'konserven'),
 'kokosmilch': ('Kokosmilch, Dose à 400 ml', 'konserven'), 'currypaste': ('Rote Currypaste, vegan', 'konserven'),
 'ajvar': ('Ajvar, mild', 'konserven'), 'getr-tomaten': ('Getrocknete Tomaten in Öl', 'konserven'),
 'erdnussbutter': ('Erdnussbutter', 'konserven'),
 # Nudeln, Reis & Co.
 'reis': ('Basmati- oder Jasminreis', 'trocken'), 'penne': ('Penne', 'trocken'), 'spaghetti': ('Spaghetti', 'trocken'),
 'hoernchen': ('Hörnchennudeln oder Makkaroni', 'trocken'), 'kritharaki': ('Kritharaki', 'trocken'),
 'lasagne': ('Lasagneplatten (ohne Vorkochen)', 'trocken'), 'mie': ('Mie-Nudeln', 'trocken'), 'sesam': ('Sesam', 'trocken'),
 # Vorrat (Öle, Saucen, Backzutaten) – in der App unter „Trockenes“
 'oel': ('Öl, neutral', 'vorrat'), 'olivenoel': ('Olivenöl', 'vorrat'), 'sesamoel': ('Sesamöl', 'vorrat'),
 'butterschmalz': ('Butterschmalz', 'vorrat'), 'honig': ('Honig', 'vorrat'), 'zucker': ('Zucker', 'vorrat'),
 'mehl': ('Weizenmehl', 'vorrat'),
 'sojasauce': ('Sojasauce', 'vorrat'), 'staerke': ('Speisestärke', 'vorrat'), 'bruehe-rind': ('Rinderbrühe', 'gewuerz'),
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
 'boxen': ('Meal-Prep-Boxen (8 Stück)', 'haushalt'), 'backpapier': ('Backpapier', 'haushalt'),
 'doeschen': ('Kleine Döschen mit Deckel', 'haushalt'),
 # Frühstück
 'haferflocken': ('Haferflocken', 'trocken'), 'erdnuss-crunch': ('Erdnuss-Crunch', 'trocken'),
 'aepfel': ('Äpfel', 'obst'), 'whey-vanille': ('Whey Vanille', 'trocken'),
}

def I(name, amount, k=None, q=None, u=None, h='', pantry=False, opt=False, haus=False):
    return {'n': name, 'a': amount, 'k': k, 'q': q, 'u': u, 'h': h, 'pantry': pantry, 'opt': opt, 'haus': haus}

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
  I('Paprika (rot, gelb, grün)', '3 Stück (ca. 450 g)', 'paprika', 3, 'Stk', '3er-Pack'),
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
 nutrows=[('Rinderhackfleisch','500 g','rinderhack',500),('Rinderhackfleisch mager','400 g','rinderhack-mager',400),
   ('Kidneybohnen, abgetropft','510 g','kidney',510),('Mais, abgetropft','285 g','mais',285),('Stückige Tomaten','800 g','tomatendose',800),
   ('Tomatenmark','70 g','tomatenmark',70),('Zwiebeln','300 g','zwiebeln',300),('Paprika','450 g','paprika',450),('Knoblauch','16 g','knoblauch',16),
   ('Süßkartoffel','600 g','suesskartoffel',600),('Backkakao','10 g','kakao',10),('Limettensaft','30 g','limette',30),('Gewürze','ca. 35 g','gewuerze',35)],
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
 nut=[['Hähnchenbrustfilet','800 g',848,184.0,0,12.0],['Skyr natur','300 g',189,33.0,12.0,0.6],['Öl','10 g',90,0,0,10.0],
      ['Butter','40 g',296,0.3,0.2,32.8],['Zwiebeln','300 g',105,3.6,18.0,0.3],['Knoblauch','24 g',36,1.5,7.2,0.1],
      ['Ingwer','30 g',24,0.5,4.7,0.2],['Tomatenmark','70 g',63,3.2,10.5,0.4],['Passierte Tomaten','500 g',130,6.5,21.5,1.0],
      ['Honig','10 g',32,0,8.0,0],['Schlagsahne 30 %','200 g',584,4.8,6.6,60.0],['Gewürze & Zitronensaft','ca. 26 g',94,3.6,8.2,3.5],
      ['Basmatireis, roh','280 g',980,22.4,215.6,1.7]],
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
  I('Kartoffeln, festkochend', '1.275 g geschält', 'kartoffeln', 1500, 'g', 'Beutel 1,5 kg'),
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
 nut=[['Rindergulasch, mager','1.000 g',1280,210.0,0,50.0],['Butterschmalz','65 g',584,0,0,64.9],['Zwiebeln','1.000 g',350,12.0,60.0,1.0],
      ['Knoblauch','24 g',36,1.5,7.2,0.1],['Tomatenmark','70 g',63,3.2,10.5,0.4],['Rote Paprika','480 g',144,4.8,24.0,1.4],
      ['Kartoffeln, geschält','1.275 g',918,25.5,197.6,1.3],['Rinderbrühe','750 ml',30,1.5,3.0,1.5],['Gewürze & Balsamico','ca. 50 g',126,5.1,9.8,4.3]],
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
 nut=[['Hähnchenbrustfilet','700 g',742,161.0,0,10.5],['Penne, roh','320 g',1139,40.0,225.6,5.8],['Getr. Tomaten, abgetropft','150 g',323,7.5,22.5,21.0],
      ['Öl aus dem Tomatenglas','16 g',144,0,0,16.0],['Passierte Tomaten','500 g',130,6.5,21.5,1.0],['Kochsahne 15 %','200 g',320,5.6,7.6,30.0],
      ['Frischkäse leicht','200 g',290,14.0,9.0,22.0],['Parmesan','50 g',195,16.5,0,14.0],['Babyspinat','250 g',58,7.0,2.5,1.0],
      ['Zwiebeln','200 g',70,2.4,12.0,0.2],['Knoblauch','20 g',30,1.3,6.0,0.1],['Gewürze & Brühpulver','ca. 19 g',54,2.2,5.1,1.6]],
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
  I('Senf, mittelscharf', '1 EL', 'senf', pantry=True),
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
 nutrows=[('Makkaroni, roh','310 g','nudeln',310),('Hähnchenbrustfilet','500 g','haehnchenbrust',500),('Brokkoli','1.000 g','brokkoli',1000),
   ('Milch 1,5 %','700 ml','milch',700),('Cheddar','200 g','cheddar',200),('Butter','25 g','butter',25),('Weizenmehl','35 g','mehl',35),
   ('Öl','10 g','oel',10),('Knoblauch','12 g','knoblauch',12),('Senf','15 g','senf',15),('Gewürze','ca. 8 g','gewuerze',8)],
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
 nutrows=[('Hähnchen-Oberkeulenfilet','1.000 g','haehnchenkeule',1000),('Basmatireis, roh','240 g','reis',240),('Brokkoli','1.000 g','brokkoli',1000),
   ('Möhren','300 g','moehren',300),('Frühlingszwiebeln','100 g','fruehlingszwiebeln',100),('Sojasauce','120 ml','sojasauce',120),
   ('Honig','50 g','honig',50),('Knoblauch','16 g','knoblauch',16),('Ingwer','30 g','ingwer',30),('Speisestärke','15 g','staerke',15),
   ('Öl & Sesamöl','25 g','oel',25),('Sesam','30 g','sesam',30),('Gewürze','ca. 3 g','gewuerze',3)],
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
 nutrows=[('Hähnchenbrustfilet','1.000 g','haehnchenbrust',1000),('Kokosmilch','400 ml','kokosmilch',400),('Rote Currypaste','70 g','currypaste',70),
   ('Paprika','480 g','paprika',480),('Zucchini','300 g','zucchini',300),('Zuckerschoten','200 g','zuckerschoten',200),('Zwiebel','100 g','zwiebeln',100),
   ('Knoblauch','16 g','knoblauch',16),('Ingwer','20 g','ingwer',20),('Sojasauce','30 ml','sojasauce',30),('Zucker','10 g','zucker',10),
   ('Limettensaft','30 g','limette',30),('Öl','20 g','oel',20),('Jasminreis, roh','290 g','reis',290)],
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
 nutrows=[('Hähnchenbrustfilet','800 g','haehnchenbrust',800),('Reis, roh','240 g','reis',240),('Schwarze Bohnen, abgetropft','240 g','schwarzebohnen',240),
   ('Mais, abgetropft','285 g','mais',285),('Paprika','480 g','paprika',480),('Zwiebeln','200 g','zwiebeln',200),('Tomaten','300 g','tomaten',300),
   ('Limettensaft','60 g','limette',60),('Öl','5 g','oel',5),('Cheddar','150 g','cheddar',150),('Schmand','200 g','schmand',200),('Gewürze','ca. 20 g','gewuerze',20)],
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
 nutrows=[('Hähnchenbrustfilet','500 g','haehnchenbrust',500),('Zwiebeln','300 g','zwiebeln',300),('Olivenöl','60 g','oel',60),('Gyros-Gewürze','ca. 20 g','gewuerze',20),
   ('Kritharaki, roh','320 g','nudeln',320),('Passierte Tomaten','500 g','passata',500),('Tomatenmark','70 g','tomatenmark',70),('Gemüsebrühe','600 ml','bruehe',600),
   ('Skyr natur','500 g','skyr',500),('Salatgurke','300 g','gurke',300),('Knoblauch','16 g','knoblauch',16),('Feta','200 g','feta',200)],
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
 nutrows=[('Rinderhackfleisch','500 g','rinderhack',500),('Rinderhackfleisch mager','400 g','rinderhack-mager',400),('Spaghetti, roh','320 g','nudeln',320),
   ('Zwiebeln','200 g','zwiebeln',200),('Möhren','200 g','moehren',200),('Staudensellerie','150 g','sellerie',150),('Knoblauch','16 g','knoblauch',16),
   ('Stückige Tomaten','800 g','tomatendose',800),('Tomatenmark','70 g','tomatenmark',70),('Milch 1,5 %','100 ml','milch',100),
   ('Parmesan','60 g','parmesan',60),('Zucker','5 g','zucker',5),('Gewürze','ca. 8 g','gewuerze',8)],
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
 nutrows=[('Rinderhackfleisch mager','800 g','rinderhack-mager',800),('Öl','10 g','oel',10),('Lasagneplatten, roh','225 g','nudeln',225),
   ('Zwiebeln','150 g','zwiebeln',150),('Möhren','150 g','moehren',150),('Zucchini','300 g','zucchini',300),('Knoblauch','12 g','knoblauch',12),
   ('Passierte Tomaten','1.000 g','passata',1000),('Tomatenmark','70 g','tomatenmark',70),('Butter','50 g','butter',50),('Weizenmehl','50 g','mehl',50),
   ('Milch 1,5 %','700 ml','milch',700),('Parmesan','50 g','parmesan',50),('Gewürze','ca. 8 g','gewuerze',8)],
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
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk'),
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
 nutrows=[('Hähnchenbrustfilet','400 g','haehnchenbrust',400),('Hähnchen-Oberkeulenfilet','500 g','haehnchenkeule',500),('Kartoffeln','1.500 g','kartoffeln',1500),
   ('Paprika','480 g','paprika',480),('Zucchini','600 g','zucchini',600),('Rote Zwiebeln','300 g','zwiebeln',300),('Olivenöl','70 g','oel',70),
   ('Gewürze','ca. 20 g','gewuerze',20),('Knoblauch','30 g','knoblauch',30),('Magerquark','250 g','magerquark',250),('Zitronensaft','20 g','limette',20)],
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
 nutrows=[('Hähnchenbrustfilet','800 g','haehnchenbrust',800),('Mie-Nudeln, roh','250 g','mie',250),('Paprika','480 g','paprika',480),
   ('Möhren','300 g','moehren',300),('Spitzkohl','400 g','spitzkohl',400),('Frühlingszwiebeln','100 g','fruehlingszwiebeln',100),
   ('Erdnussbutter','140 g','erdnussbutter',140),('Sojasauce','100 ml','sojasauce',100),('Honig','40 g','honig',40),('Limettensaft','60 g','limette',60),
   ('Knoblauch','16 g','knoblauch',16),('Ingwer','20 g','ingwer',20),('Öl','30 g','oel',30),('Gewürze & Sriracha','ca. 3 g','gewuerze',3)],
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
  I('Senf, mittelscharf', '1 EL', 'senf', pantry=True),
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
 nutrows=[('Putenbrust','800 g','putenbrust',800),('Champignons','800 g','champignons',800),('Zwiebeln','200 g','zwiebeln',200),('Knoblauch','8 g','knoblauch',8),
   ('Kochsahne 15 %','400 g','kochsahne',400),('Schmand','200 g','schmand',200),('Brühe','300 ml','bruehe',300),('Senf','15 g','senf',15),
   ('Speisestärke','10 g','staerke',10),('Öl','10 g','oel',10),('Basmatireis, roh','330 g','reis',330),('Gewürze','ca. 6 g','gewuerze',6)],
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
  I('Zitrone', '½ Stück', 'zitrone', 1, 'Stk'),
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
 nutrows=[('Rinderhackfleisch mager','800 g','rinderhack-mager',800),('Kartoffeln','1.450 g','kartoffeln',1450),('Paprika','480 g','paprika',480),
   ('Zwiebeln','300 g','zwiebeln',300),('Knoblauch','20 g','knoblauch',20),('Ajvar','350 g','ajvar',350),('Gemüsebrühe','300 ml','bruehe',300),
   ('Feta','200 g','feta',200),('Skyr natur','250 g','skyr',250),('Zitronensaft','15 g','limette',15),('Öl','15 g','oel',15),('Gewürze','ca. 15 g','gewuerze',15)],
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
 nutrows=[('Hähnchenbrustfilet','800 g','haehnchenbrust',800),('Gnocchi','800 g','gnocchi',800),('Kirschtomaten','500 g','tomaten',500),
   ('Babyspinat','200 g','spinat',200),('Zwiebel','100 g','zwiebeln',100),('Knoblauch','16 g','knoblauch',16),('Passierte Tomaten','500 g','passata',500),
   ('Frischkäse leicht','200 g','frischkaese',200),('Kochsahne 15 %','200 g','kochsahne',200),('Parmesan','50 g','parmesan',50),('Olivenöl','35 g','oel',35),
   ('Gewürze & Brühpulver','ca. 6 g','gewuerze',6)],
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

def nutrows(rows):
    out=[]
    for label, amount, key, g in rows:
        v=N[key]; out.append([label, amount] + [round(x*g/100, 1) for x in v])
    return out

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
    if 'nutrows' in r:
        r['nut'] = nutrows(r.pop('nutrows'))
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
    'extras': EXTRAS,
}
ziel.write_text(json.dumps(daten, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(out)} Rezepte → {ziel.relative_to(HIER.parent)}')
