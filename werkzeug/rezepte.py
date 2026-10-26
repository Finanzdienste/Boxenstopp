"""
Die Rezepte von Boxenstopp – und daraus daten/rezepte.json.

    python3 werkzeug/rezepte.py

Jedes Rezept ergibt 8 Boxen. Ziel pro Box: 443 kcal, 33 g Protein, 39 g KH,
15,4 g Fett (ZIEL). Für die fünf ersten Rezepte stehen die Nährwertzeilen fest
in `nut` (so wurden sie damals einzeln gerechnet); alle anderen rechnet
`nutrows` aus den Werten pro 100 g in naehrwerte.py.

Mengen immer in Supermarkt-Packungen denken: 400 g Hähnchen, 500 g Hack,
Dosen, Becher. Wer ein Rezept ändert, lässt das Skript laufen und schaut in
die Tabelle am Ende: kcal, P, KH, F pro Box. tests/test-rezepte.mjs prüft
die Grenzen.

Katalog: jede Zutat der Einkaufsliste hat einen festen Schlüssel (CAT). Er
entscheidet, welche Rezepte sich auf der Liste eine Zeile teilen, und in
welcher Abteilung sie steht.
"""
import json, pathlib, sys
HIER = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HIER))
from naehrwerte import N, T

ZIEL = {'kcal': T[0], 'p': T[1], 'kh': T[2], 'f': T[3]}
# ---------------------------------------------------------------- Katalog (Einkaufsliste)
CAT = {
 # Fleisch & Geflügel
 'rinderhack': ('Rinderhackfleisch', 'fleisch'), 'putenhack': ('Putenhackfleisch', 'fleisch'),
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
 'skyr': ('Skyr natur', 'kuehl'), 'magerquark': ('Magerquark', 'kuehl'), 'huettenkaese': ('Hüttenkäse', 'kuehl'),
 'frischkaese': ('Frischkäse leicht', 'kuehl'), 'kochsahne': ('Kochsahne 15 %', 'kuehl'), 'schlagsahne': ('Schlagsahne 30 %', 'kuehl'),
 'schmand': ('Schmand', 'kuehl'), 'milch': ('Milch 1,5 %', 'kuehl'), 'cheddar': ('Cheddar', 'kuehl'),
 'mozzarella-light': ('Mozzarella light', 'kuehl'), 'parmesan': ('Parmesan', 'kuehl'), 'feta': ('Feta', 'kuehl'),
 'gnocchi': ('Gnocchi', 'trocken'), 'butter': ('Butter', 'kuehl'),
 # Tiefkühl
 'tk-kraeuter': ('TK-Kräuter (8-Kräuter)', 'tk'),
 # Konserven & Gläser – in der App unter „Trockenes“
 'tomaten-dose': ('Stückige Tomaten, Dose à 400 g', 'konserven'), 'passata': ('Passierte Tomaten', 'konserven'),
 'tomatenmark': ('Tomatenmark', 'konserven'), 'kidney': ('Kidneybohnen, Dose à 400 g', 'konserven'),
 'schwarze-bohnen': ('Schwarze Bohnen, Dose à 400 g', 'konserven'), 'mais': ('Mais, Dose à 425 ml', 'konserven'),
 'kokosmilch': ('Kokosmilch, Dose à 400 ml', 'konserven'), 'currypaste': ('Rote Currypaste', 'konserven'),
 'ajvar': ('Ajvar, mild', 'konserven'), 'getr-tomaten': ('Getrocknete Tomaten in Öl', 'konserven'),
 'erdnussbutter': ('Erdnussbutter', 'konserven'),
 # Nudeln, Reis & Co.
 'reis': ('Basmati- oder Jasminreis', 'trocken'), 'penne': ('Penne', 'trocken'), 'spaghetti': ('Spaghetti', 'trocken'),
 'hoernchen': ('Hörnchennudeln oder Makkaroni', 'trocken'), 'kritharaki': ('Kritharaki', 'trocken'),
 'lasagne': ('Lasagneplatten (ohne Vorkochen)', 'trocken'), 'mie': ('Mie-Nudeln', 'trocken'), 'sesam': ('Sesam', 'trocken'),
 # Vorrat (Öle, Saucen, Backzutaten) – in der App unter „Trockenes“
 'oel': ('Öl, neutral', 'vorrat'), 'olivenoel': ('Olivenöl', 'vorrat'), 'sesamoel': ('Sesamöl', 'vorrat'),
 'butterschmalz': ('Butterschmalz', 'vorrat'), 'honig': ('Honig', 'vorrat'), 'zucker': ('Zucker', 'vorrat'),
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

R = []

# ======================================================================= 1 Chili
R.append(dict(
 id='chili', name='Chili con Carne mit Süßkartoffel', short='Chili con Carne',
 desc='Rind und Pute, Bohnen, Mais und Süßkartoffel im Chili. Schmeckt am zweiten Tag noch besser.',
 protein='Rind & Pute', base='Süßkartoffel', method='Topf', time=60, timeNote='davon 35 Min. köcheln', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch (max. 20 % Fett)', '500 g', 'rinderhack', 500, 'g', '1 × 500 g'),
  I('Putenhackfleisch', '500 g', 'putenhack', 500, 'g', '1 × 500 g'),
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
  I('Zucker', '1 TL (5 g)', 'zucker', pantry=True),
  I('Rinderbrühe', '2 Würfel für 400 ml', 'bruehe-rind', pantry=True),
 ],
 spices=[S('Kreuzkümmel, gemahlen','2 gehäufte EL','kreuzkuemmel'), S('Paprika edelsüß','2 EL','paprika-edelsuess'),
  S('Paprika geräuchert','1 EL','paprika-geraeuchert'), S('Oregano','1 EL','oregano'), S('Chiliflocken','1–2 TL','chiliflocken'),
  S('Cayennepfeffer','1 TL','cayenne'), S('Zimt','½ TL','zimt'), S('Lorbeerblätter','2 Stück','lorbeer'),
  S('Salz','1 TL + zum Abschmecken','salz'), S('Pfeffer','1 TL','pfeffer')],
 steps=[
  ('Vorbereiten', '3 Zwiebeln (300 g) fein würfeln, 4 Knoblauchzehen hacken. 3 Paprika (450 g) in 1-cm-Würfel schneiden, 600 g Süßkartoffel schälen und in 1,5-cm-Würfel schneiden. 2 Dosen Kidneybohnen und 1 Dose Mais im Sieb kalt abspülen. 400 ml Wasser mit 2 Brühwürfeln aufkochen. Den leeren Topf wiegen.'),
  ('Rinderhack anbraten', 'Topf stark erhitzen, 500 g Rinderhack ohne Öl hineingeben und 2 Minuten liegen lassen. Dann krümelig braten, bis es braun ist und Röstaromen hat. Das Fett vom Rind reicht zum Anbraten.'),
  ('Putenhack dazu', '500 g Putenhack dazugeben, krümelig braten und mit 1 TL Salz würzen. Das dauert etwa 5 Minuten.'),
  ('Zwiebeln', 'Hitze auf mittel, die Zwiebeln (300 g) 5 Minuten glasig dünsten, den Knoblauch (4 Zehen) 1 Minute mitbraten.'),
  ('Gewürze anrösten', '70 g Tomatenmark, 2 gehäufte EL Kreuzkümmel, 2 EL Paprika edelsüß, 1 EL Paprika geräuchert, 1 EL Oregano, 1–2 TL Chiliflocken, 1 TL Cayenne, ½ TL Zimt und 1 EL Backkakao (10 g) 2 Minuten unter Rühren rösten, bis es intensiv duftet. Das ist der wichtigste Schritt für den Geschmack.'),
  ('Ablöschen', 'Mit der Brühe (400 ml) ablöschen und den Bodensatz loskratzen. 2 Dosen stückige Tomaten, 2 Lorbeerblätter, 1 TL Zucker, die Paprika (450 g) und die Süßkartoffel (600 g) dazugeben und aufkochen.'),
  ('Köcheln', 'Zugedeckt 25 Minuten bei kleiner Hitze köcheln, zwischendurch zweimal umrühren. Die Süßkartoffel soll weich sein, aber nicht zerfallen.'),
  ('Bohnen und Mais', 'Kidneybohnen (510 g abgetropft) und Mais (285 g abgetropft) unterrühren und 10 Minuten offen köcheln, bis die Sauce sämig ist.'),
  ('Abschmecken', 'Lorbeer herausnehmen. Saft von 1 Limette, 1 TL Pfeffer und Salz nach Geschmack dazu. Lieber leicht unterschärfen, Chili wird über Nacht kräftiger.'),
 ],
 tips=['Varianten mit gleichen Werten: 150 g Basmati (roh) statt Süßkartoffel, separat gekocht und auf die Boxen verteilt.',
       'Nur Rind: 1 kg mageres Rinderhack (max. 8 % Fett) plus 1 EL Öl zum Anbraten, dann ca. 430 kcal und 13 g Fett pro Portion.'],
 nut=[['Rinderhackfleisch','500 g',1175,92.5,0,85.0],['Putenhackfleisch','500 g',625,100.0,0,24.5],['Kidneybohnen, abgetropft','510 g',484,38.2,61.2,3.1],
      ['Mais, abgetropft','285 g',228,7.1,34.2,3.7],['Stückige Tomaten','800 g',176,8.0,28.0,1.6],['Tomatenmark','70 g',63,3.1,10.5,0.3],
      ['Zwiebeln','300 g',105,3.6,18.0,0.3],['Paprika','450 g',126,4.5,20.2,1.4],['Knoblauch','20 g',30,1.3,6.0,0.1],
      ['Süßkartoffel','600 g',516,9.6,120.0,0.6],['Backkakao','10 g',36,2.2,1.0,1.1],['Zucker','5 g',20,0,5.0,0]],
))

# ======================================================================= 2 Butter Chicken
R.append(dict(
 id='butter-chicken', name='Butter Chicken mit Reis', short='Butter Chicken',
 desc='Hähnchen in Skyr-Marinade aus dem Ofen, cremige Tomaten-Butter-Sauce und Basmati.',
 protein='Hähnchen', base='Reis', method='Ofen + Topf', time=60, timeNote='+ 30 Min. Marinieren', fridge='4 Tage', freeze='3 Monate',
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
 steps=[
  ('Marinieren', '800 g Hähnchenbrust in 3-cm-Würfel schneiden. 2 Knoblauchzehen und 10 g Ingwer fein reiben, mit 300 g Skyr, 10 g Öl, dem Saft von ½ Zitrone, 1 TL Garam Masala, 1 TL Kurkuma, 1 TL Paprika edelsüß, ½ TL Kreuzkümmel, ½ TL Chili und 1 TL Salz verrühren. Hähnchen untermischen und mindestens 30 Minuten kühl stellen, über Nacht wird es noch zarter.'),
  ('Vorbereiten', 'Ofen auf 230 °C Umluft vorheizen, ein Blech mit Backpapier belegen. 2 große Zwiebeln (300 g) fein würfeln, die restlichen 4 Knoblauchzehen und 20 g Ingwer fein reiben. Den leeren Topf wiegen.'),
  ('Hähnchen im Ofen', 'Das Hähnchen (800 g) mit der Marinade auf dem Blech verteilen und 12–15 Minuten im oberen Drittel garen, bis die Ränder gebräunt sind. Es muss noch nicht ganz durch sein. Alternativ im Airfryer in 2–3 Durchgängen je 10 Minuten bei 200 °C.'),
  ('Sauce ansetzen', 'Parallel 30 g Butter im großen Topf schmelzen und die Zwiebeln (300 g) 8–10 Minuten goldbraun braten. Knoblauch (4 Zehen) und Ingwer (20 g) 1 Minute mitbraten. 70 g Tomatenmark, 1 EL Garam Masala, 1 TL Kreuzkümmel, 2 TL Paprika edelsüß und ½–1 TL Chili 1–2 Minuten anrösten.'),
  ('Köcheln', '500 g passierte Tomaten, 200 ml Wasser, 1 TL Honig (10 g) und 1 TL Salz dazugeben und 15 Minuten halb zugedeckt köcheln. Für eine glatte Sauce wie im Restaurant jetzt pürieren.'),
  ('Reis', '280 g Basmati waschen, bis das Wasser klar ist. Mit 420 ml Wasser und 1 Prise Salz aufkochen, zugedeckt 12 Minuten auf kleinster Hitze garen und 10 Minuten ruhen lassen.'),
  ('Hähnchen in die Sauce', 'Das Hähnchen (800 g) samt Bratensaft in die Sauce geben und 8–10 Minuten leise köcheln, bis es innen nicht mehr rosa ist.'),
  ('Fertigstellen', '200 g Sahne, die restlichen 10 g Butter und optional 2 EL zerriebene Kasuri Methi einrühren. Nicht mehr sprudelnd kochen. Mit Salz und dem Saft der zweiten ½ Zitrone abschmecken.'),
  ('Portionieren', 'Curry-Topf wiegen, Leergewicht abziehen und durch 8 teilen. Den Reis (280 g roh) separat wiegen und ebenfalls durch 8 teilen, das sind etwa 80–90 g pro Box. Koriander erst beim Essen drüber.'),
 ],
 tips=['Kasuri Methi bringt den typischen Restaurant-Geschmack. Gibt es im Asia-Laden oder online.',
       'Mit Kochsahne 15 % (400 g) statt Schlagsahne wird die Sauce leichter, dann 270 g Reis nehmen.'],
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
 protein='Rind', base='Kartoffeln', method='Topf', time=165, timeNote='davon 2 Std. schmoren', fridge='4 Tage', freeze='3 Monate',
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
 steps=[
  ('Vorbereiten', '1 kg Rindergulasch trocken tupfen und auf 3–4 cm schneiden. 1 kg Zwiebeln in feine Streifen, 6 Knoblauchzehen hacken, 3 rote Paprika (480 g) in 2-cm-Stücke schneiden. 1,5 kg Kartoffeln schälen, davon 1.275 g abwiegen, in 3-cm-Würfel schneiden und in kaltes Wasser legen. Den leeren Topf wiegen.'),
  ('Fleisch anbraten', '25 g Butterschmalz stark erhitzen und das Fleisch (1 kg) in 3 Portionen rundum kräftig braun anbraten, dann herausnehmen. Alles auf einmal würde im eigenen Saft kochen.'),
  ('Zwiebeln bräunen', 'Die restlichen 40 g Butterschmalz in den Topf geben. Die Zwiebeln (1 kg) bei mittlerer Hitze 15–20 Minuten goldbraun schmoren und den Bratensatz lösen. Hier entsteht die Sauce.'),
  ('Würzen', 'Knoblauch (6 Zehen) und 70 g Tomatenmark 2 Minuten mitrösten. Topf vom Herd ziehen und 3 EL Paprika edelsüß, 1 TL Paprika rosenscharf, 1 TL Paprika geräuchert, 2 TL Kümmel und 2 TL Majoran einrühren. Paprikapulver wird auf voller Hitze schnell bitter.'),
  ('Schmoren', 'Sofort mit 750 ml Rinderbrühe ablöschen, Fleisch samt Saft und 2 Lorbeerblätter dazu. Zugedeckt 90 Minuten bei kleiner Hitze schmoren, alle 20 Minuten umrühren.'),
  ('Kartoffeln und Paprika', 'Die Kartoffeln (1.275 g) abgießen und mit der Paprika (480 g) und ca. 300 ml Wasser in den Topf geben. Zugedeckt 25–30 Minuten köcheln, bis alles weich ist.'),
  ('Abschmecken', 'Lorbeer herausnehmen. Mit 2–3 TL Salz, Pfeffer, 1 EL Balsamico und optional dem Abrieb von 1 Bio-Zitrone abschmecken. Zu dünn? Offen 5–10 Minuten einkochen.'),
 ],
 tips=['Beim Fleisch schwankt der Fettgehalt stark. Nimm Keule statt Nacken, das ist deutlich magerer.'],
 nut=[['Rindergulasch, mager','1.000 g',1280,210.0,0,50.0],['Butterschmalz','65 g',584,0,0,64.9],['Zwiebeln','1.000 g',350,12.0,60.0,1.0],
      ['Knoblauch','24 g',36,1.5,7.2,0.1],['Tomatenmark','70 g',63,3.2,10.5,0.4],['Rote Paprika','480 g',144,4.8,24.0,1.4],
      ['Kartoffeln, geschält','1.275 g',918,25.5,197.6,1.3],['Rinderbrühe','750 ml',30,1.5,3.0,1.5],['Gewürze & Balsamico','ca. 50 g',126,5.1,9.8,4.3]],
))

# ======================================================================= 4 Tomaten-Hähnchen-Pasta
R.append(dict(
 id='tomaten-pasta', name='Creamy Tomaten-Hähnchen-Pasta', short='Tomaten-Pasta',
 desc='Penne in cremiger Tomatensauce mit getrockneten Tomaten, Spinat und Parmesan.',
 protein='Hähnchen', base='Nudeln', method='Pfanne', time=45, timeNote='', fridge='3 Tage', freeze='2–3 Monate',
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
 steps=[
  ('Vorbereiten', '700 g Hähnchenbrust in 2–3-cm-Stücke schneiden und mit 1 TL Paprika edelsüß, ½ TL Knoblauchpulver, 1 TL italienischen Kräutern, Salz und Pfeffer würzen. 2 Zwiebeln (200 g) würfeln, 5 Knoblauchzehen hacken. 1 Glas getrocknete Tomaten abtropfen lassen, das Öl auffangen, die Tomaten (150 g) in Streifen schneiden. Die große Pfanne leer wiegen.'),
  ('Nudeln', '320 g Penne in Salzwasser 2 Minuten kürzer kochen als auf der Packung angegeben. Vor dem Abgießen 300 ml Nudelwasser abschöpfen.'),
  ('Hähnchen anbraten', '8 g Öl aus dem Tomatenglas (gut 1 EL) stark erhitzen und das Hähnchen (700 g) in 2 Portionen je 3–4 Minuten goldbraun braten. Herausnehmen.'),
  ('Sauce ansetzen', 'Die restlichen 8 g Tomatenöl in die Pfanne, die Zwiebeln (200 g) 3–4 Minuten glasig braten. Knoblauch (5 Zehen) und getrocknete Tomaten (150 g) 1 Minute mitbraten, dann 1 TL Paprika edelsüß, 1 TL Paprika geräuchert, 1 TL italienische Kräuter, 1 TL Oregano und ½ TL Chiliflocken kurz mitrösten.'),
  ('Köcheln', '500 g passierte Tomaten, 200 g Kochsahne und 1 TL Gemüsebrühe (Pulver) einrühren und 5 Minuten köcheln. 200 g Frischkäse einrühren, bis er geschmolzen ist, 50 g Parmesan unterziehen.'),
  ('Spinat und Hähnchen', '250 g Babyspinat handvollweise unterheben. Das Hähnchen (700 g) samt Saft zurückgeben und 4–5 Minuten leise köcheln, bis es durch ist.'),
  ('Mischen', 'Die Penne (320 g roh) untermischen und mit dem Nudelwasser (bis 300 ml) cremig ziehen. Fürs Meal Prep darf die Sauce etwas dünner sein, die Nudeln saugen nach.'),
 ],
 tips=['Frischkäse leicht nehmen (ca. 11 % Fett). Doppelrahmstufe bringt pro Portion rund 3,5 g Fett mehr.',
       'Vollkorn: 370 g Vollkorn-Penne und nur 12 g Öl, dann ca. 452 kcal bei gleichen Makros.'],
 nut=[['Hähnchenbrustfilet','700 g',742,161.0,0,10.5],['Penne, roh','320 g',1139,40.0,225.6,5.8],['Getr. Tomaten, abgetropft','150 g',323,7.5,22.5,21.0],
      ['Öl aus dem Tomatenglas','16 g',144,0,0,16.0],['Passierte Tomaten','500 g',130,6.5,21.5,1.0],['Kochsahne 15 %','200 g',320,5.6,7.6,30.0],
      ['Frischkäse leicht','200 g',290,14.0,9.0,22.0],['Parmesan','50 g',195,16.5,0,14.0],['Babyspinat','250 g',58,7.0,2.5,1.0],
      ['Zwiebeln','200 g',70,2.4,12.0,0.2],['Knoblauch','20 g',30,1.3,6.0,0.1],['Gewürze & Brühpulver','ca. 19 g',54,2.2,5.1,1.6]],
))

# ======================================================================= 5 Mac & Cheese
R.append(dict(
 id='mac-cheese', name='Protein-Mac & Cheese mit Brokkoli', short='Mac & Cheese',
 desc='Käsesauce aus Hüttenkäse, Quark und kräftigem Cheddar, glatt gemixt. Ganz ohne Fleisch.',
 protein='Vegetarisch', base='Nudeln', method='Topf', time=30, timeNote='', fridge='3 Tage', freeze='2 Monate',
 items=[
  I('Hörnchennudeln oder Makkaroni', '310 g', 'hoernchen', 310, 'g', 'aus 500-g-Packung'),
  I('Brokkoli', '1,2 kg', 'brokkoli', 1200, 'g', '3 Köpfe oder TK'),
  I('Hüttenkäse', '800 g', 'huettenkaese', 800, 'g', '4 × 200 g'),
  I('Magerquark', '250 g', 'magerquark', 250, 'g', '1 Becher'),
  I('Milch 1,5 %', '250 ml', 'milch', 250, 'ml'),
  I('Cheddar, kräftig', '200 g', 'cheddar', 200, 'g', '1 Packung'),
  I('Butter', '10 g', 'butter', pantry=True),
  I('Speisestärke', '10 g', 'staerke', pantry=True),
  I('Senf, mittelscharf', '2 EL', 'senf', pantry=True),
 ],
 spices=[S('Paprika edelsüß','1 TL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Knoblauchpulver','1 TL','knoblauchpulver'), S('Zwiebelgranulat','1 TL','zwiebelpulver'), S('Cayennepfeffer','¼–½ TL','cayenne'),
  S('Muskat','1 Prise','muskat'), S('Salz','½ TL','salz'), S('Pfeffer','ordentlich','pfeffer')],
 steps=[
  ('Vorbereiten', 'Den leeren großen Topf wiegen. 200 g Cheddar reiben, 1,2 kg Brokkoli in kleine Röschen teilen, den Strunk schälen und würfeln.'),
  ('Käsesauce mixen', '800 g Hüttenkäse, 250 g Magerquark, 250 ml Milch, 10 g Speisestärke, 2 EL Senf, 1 TL Paprika edelsüß, 1 TL Paprika geräuchert, 1 TL Knoblauchpulver, 1 TL Zwiebelgranulat, ¼ TL Cayenne, 1 Prise Muskat und ½ TL Salz in ein hohes Gefäß geben und mit dem Pürierstab ganz glatt mixen. Je glatter, desto cremiger.'),
  ('Nudeln und Brokkoli', '310 g Hörnchennudeln in Salzwasser 1 Minute kürzer kochen als angegeben, den Brokkoli (1,2 kg) die letzten 4 Minuten mitkochen. 200 ml Kochwasser abschöpfen, dann abgießen.'),
  ('Sauce erhitzen', '10 g Butter im leeren Topf schmelzen, die Sauce dazu und bei mittlerer Hitze erwärmen, bis sie dampft. Nicht sprudelnd kochen, sonst wird sie krisselig. Den Cheddar (200 g) nach und nach einrühren.'),
  ('Mischen', 'Nudeln und Brokkoli unterheben und mit etwas Kochwasser (bis 200 ml) cremig ziehen. Mit Salz, Pfeffer und Cayenne (bis ½ TL insgesamt) abschmecken.'),
 ],
 tips=['Knuspriges Topping: 40 g Panko trocken rösten, mit 30 g Parmesan mischen und erst beim Essen drüberstreuen. Pro Portion +33 kcal.',
       '1–2 EL Hefeflocken in der Sauce machen sie noch käsiger.'],
 nut=[['Hörnchennudeln, roh','310 g',1104,38.8,218.6,5.6],['Brokkoli','1.200 g',408,36.0,36.0,4.8],['Hüttenkäse','800 g',768,96.0,20.0,34.4],
      ['Magerquark','250 g',168,30.0,10.0,0.5],['Milch 1,5 %','250 ml',118,8.5,12.0,3.8],['Cheddar','200 g',800,50.0,0,66.0],
      ['Butter','10 g',74,0.1,0.1,8.2],['Speisestärke','10 g',35,0,8.6,0],['Senf & Gewürze','ca. 44 g',72,3.6,7.2,2.3]],
))

# ---------------------------------------------------------------- neue Rezepte: Nährwerte werden berechnet
def nutrows(rows):
    out=[]
    for label, amount, key, g in rows:
        v=N[key]; out.append([label, amount] + [round(x*g/100, 1) for x in v])
    return out

# ======================================================================= 6 Teriyaki
R.append(dict(
 id='teriyaki', name='Chicken Teriyaki Bowl', short='Teriyaki Bowl',
 desc='Saftige Hähnchenkeule in glänzender Teriyaki-Sauce mit Brokkoli, Möhren und Sesam.',
 protein='Hähnchen', base='Reis', method='Wok / Pfanne', time=45, timeNote='', fridge='4 Tage', freeze='2 Monate',
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
 spices=[S('Chiliflocken','½–1 TL','chiliflocken'), S('Salz','1 Prise für den Reis','salz')],
 steps=[
  ('Vorbereiten', '1 kg Hähnchen-Oberkeulenfilet in 3-cm-Stücke schneiden. 1 kg Brokkoli in Röschen teilen, Strunk schälen und würfeln. 3 Möhren (300 g) schräg in dünne Scheiben, 1 Bund Frühlingszwiebeln in Ringe schneiden, Hell und Grün getrennt. 4 Knoblauchzehen und 30 g Ingwer fein reiben. Den großen Topf, in dem du am Ende alles mischst, leer wiegen.'),
  ('Sauce anrühren', '120 ml Sojasauce, 50 g Honig, 2 EL Essig, den Knoblauch (4 Zehen), den Ingwer (30 g), 15 g Speisestärke, ½–1 TL Chiliflocken und 150 ml Wasser glatt rühren.'),
  ('Reis', '240 g Reis waschen, im kleinen Topf mit 360 ml Wasser und 1 Prise Salz aufkochen, zugedeckt 12 Minuten auf kleinster Hitze garen und 10 Minuten ruhen lassen.'),
  ('Gemüse', 'Brokkoli (1 kg) und Möhren (300 g) 3–4 Minuten in Salzwasser blanchieren. Sie sollen bissfest bleiben, beim Aufwärmen garen sie nach. Abgießen.'),
  ('Hähnchen braten', '15 g Öl im Wok oder in der großen Pfanne stark erhitzen. Das Hähnchen (1 kg) in 2 Portionen je 4–5 Minuten goldbraun braten.'),
  ('Glasieren', 'Alles Hähnchen zurück in die Pfanne, das Helle der Frühlingszwiebeln 1 Minute mitbraten. Die Sauce einrühren und 2 Minuten köcheln, bis sie andickt und glänzt. 10 g Sesamöl unterrühren.'),
  ('Sesam rösten', '30 g Sesam in einer trockenen Pfanne 2 Minuten goldbraun rösten.'),
  ('Mischen', 'Reis (240 g roh), Gemüse und Teriyaki-Hähnchen im gewogenen großen Topf gut mischen, wiegen und portionieren. Sesam (30 g) und das Frühlingszwiebelgrün drüberstreuen.'),
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
 protein='Hähnchen', base='Reis', method='Topf', time=40, timeNote='', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Hähnchenbrustfilet', '1 kg', 'haehnchenbrust', 1000, 'g', '2 × 500 g'),
  I('Kokosmilch (nicht light)', '1 Dose à 400 ml', 'kokosmilch', 1, 'Dose'),
  I('Rote Currypaste', '70 g', 'currypaste', 1, 'Glas', 'du brauchst 70 g'),
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
 steps=[
  ('Vorbereiten', '1 kg Hähnchenbrust in mundgerechte Stücke schneiden. 3 Paprika (480 g) in Streifen, 1 Zucchini (300 g) in Halbmonde schneiden, 200 g Zuckerschoten halbieren, 1 Zwiebel (100 g) in Streifen schneiden. 4 Knoblauchzehen und 20 g Ingwer fein hacken. Den leeren Topf wiegen.'),
  ('Reis', '290 g Jasminreis waschen, mit 435 ml Wasser aufkochen, zugedeckt 12 Minuten auf kleinster Hitze garen und 10 Minuten ruhen lassen.'),
  ('Hähnchen anbraten', '10 g Öl im großen Topf stark erhitzen und das Hähnchen (1 kg) in 2 Portionen kurz anbraten. Herausnehmen, es muss noch nicht durch sein.'),
  ('Paste anrösten', 'Die restlichen 10 g Öl in den Topf, die Zwiebel (100 g) 2 Minuten braten. Knoblauch (4 Zehen), Ingwer (20 g) und 70 g Currypaste 1 Minute rösten. Die dicke Kokoscreme oben aus der Dose (400 ml) dazugeben und 1 Minute mitrösten, das bringt den Geschmack.'),
  ('Köcheln', 'Die restliche Kokosmilch, 200 ml Wasser, 2 EL Sojasauce (30 ml) und 2 TL Zucker (10 g) einrühren. Paprika (480 g) und Zucchini (300 g) 5 Minuten köcheln.'),
  ('Fertig garen', 'Hähnchen (1 kg) und Zuckerschoten (200 g) dazugeben und 4–5 Minuten leise köcheln, bis das Hähnchen durch ist.'),
  ('Abschmecken', 'Saft von 1 Limette einrühren, mit Salz oder Sojasauce abschmecken. Wer es schärfer mag, nimmt Chiliflocken.'),
  ('Mischen', 'Den Reis (290 g roh) unter das Curry heben, dann wiegen und portionieren.'),
 ],
 tips=['Currypasten sind unterschiedlich scharf. Fang mit 50 g an und gib den Rest erst nach dem Probieren dazu.'],
 nutrows=[('Hähnchenbrustfilet','1.000 g','haehnchenbrust',1000),('Kokosmilch','400 ml','kokosmilch',400),('Rote Currypaste','70 g','currypaste',70),
   ('Paprika','480 g','paprika',480),('Zucchini','300 g','zucchini',300),('Zuckerschoten','200 g','zuckerschoten',200),('Zwiebel','100 g','zwiebeln',100),
   ('Knoblauch','16 g','knoblauch',16),('Ingwer','20 g','ingwer',20),('Sojasauce','30 ml','sojasauce',30),('Zucker','10 g','zucker',10),
   ('Limettensaft','30 g','limette',30),('Öl','20 g','oel',20),('Jasminreis, roh','290 g','reis',290)],
))

# ======================================================================= 8 Burrito Bowl
R.append(dict(
 id='burrito-bowl', name='Burrito Bowl mit Hähnchen', short='Burrito Bowl',
 desc='Taco-Hähnchen, Limettenreis, Bohnen, Mais, Fajita-Gemüse, Salsa, Cheddar und Limetten-Schmand.',
 protein='Hähnchen', base='Reis', method='Pfanne', time=40, timeNote='', fridge='4 Tage', freeze='2 Monate, ohne Salsa und Schmand',
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
 steps=[
  ('Marinieren', '800 g Hähnchenbrust in 2-cm-Würfel schneiden, mit 2 TL Paprika edelsüß, 2 TL Paprika geräuchert, 2 TL Kreuzkümmel, 1 TL Oregano, 1 TL Knoblauchpulver, 1 TL Zwiebelgranulat, ½–1 TL Chiliflocken, 1 TL Pfeffer, dem Saft von ½ Limette und 1 TL Salz mischen.'),
  ('Limettenreis', '240 g Reis waschen, mit 360 ml Wasser und 1 Prise Salz aufkochen, zugedeckt 12 Minuten garen, 10 Minuten ruhen lassen. Saft von ½ Limette und optional ½ Bund gehackten Koriander unterheben.'),
  ('Salsa', '3 Tomaten (300 g) würfeln, 1 rote Zwiebel (100 g) fein würfeln und mit dem Saft von ½ Limette, Salz und Pfeffer mischen.'),
  ('Fajita-Gemüse', '3 Paprika (480 g) und 1 gelbe Zwiebel (100 g) in Streifen schneiden und in der großen Pfanne ohne Fett 6–8 Minuten kräftig anrösten, salzen und herausnehmen.'),
  ('Hähnchen braten', '1 TL Öl (5 g) in die Pfanne, das Hähnchen (800 g) in 2 Portionen je 3–4 Minuten braten, bis es durch ist.'),
  ('Bohnen und Mais', '1 Dose schwarze Bohnen (240 g abgetropft) und 1 Dose Mais (285 g abgetropft) abspülen, zum Hähnchen geben und 2 Minuten mit erwärmen.'),
  ('Limetten-Schmand', '200 g Schmand mit dem Saft der letzten ½ Limette und 1 Prise Salz glatt rühren.'),
  ('Portionieren', 'Reis, Hähnchen mit Bohnen und Mais und das Gemüse jeweils wiegen, durch 8 teilen und in die Boxen schichten. 150 g Cheddar verteilen, knapp 19 g pro Box. Salsa und Schmand (je ca. 25 g) in 16 kleine Döschen, dann bleiben sie frisch.'),
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
 protein='Hähnchen', base='Nudeln', method='Pfanne + Topf', time=45, timeNote='+ 30 Min. Marinieren', fridge='4 Tage', freeze='2 Monate, ohne Tzatziki',
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
  S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 steps=[
  ('Marinieren', '500 g Hähnchenbrust in dünne Streifen schneiden. Mit 30 g Olivenöl, 2 TL Paprika edelsüß, 2 TL Oregano, 1 TL Thymian, 1 TL Kreuzkümmel, 1 TL Knoblauchpulver, 1 TL Zwiebelgranulat, ½ TL gemahlenem Koriander, ¼ TL Cayenne, 2 geriebenen Knoblauchzehen und 1 TL Salz mischen und mindestens 30 Minuten ziehen lassen. 3 Zwiebeln (300 g) in Streifen schneiden.'),
  ('Tzatziki', '1 Salatgurke (300 g) grob raspeln, mit ½ TL Salz 10 Minuten ziehen lassen und kräftig ausdrücken. Mit 500 g Skyr, 2 geriebenen Knoblauchzehen, 10 g Olivenöl, 1 TL Pfeffer und optional Dill oder Minze verrühren. Kalt stellen.'),
  ('Kritharaki', 'Den leeren Topf wiegen. 70 g Tomatenmark darin 1 Minute anrösten, 500 g passierte Tomaten und 600 ml Gemüsebrühe dazu und aufkochen. 320 g Kritharaki einrühren und 10–12 Minuten unter häufigem Rühren köcheln, bis sie gar und sämig sind. Mit ½ TL Salz und 1 TL Oregano abschmecken.'),
  ('Gyros braten', '20 g Olivenöl in der großen Pfanne sehr heiß werden lassen. Das Hähnchen (500 g) in 2–3 Portionen scharf anbraten, bis es Röstränder hat. Die Zwiebeln (300 g) mit der letzten Portion 3–4 Minuten mitbraten.'),
  ('Portionieren', 'Kritharaki wiegen und durch 8 teilen, das Gyros ebenso darauf verteilen. 200 g Feta drüberbröseln, je 25 g pro Box. Das Tzatziki in 8 kleine Döschen füllen, je ca. 100 g.'),
 ],
 tips=['Kritharaki sind griechische Nudeln in Reisform, du findest sie neben der Pasta. Orzo ist dasselbe.'],
 nutrows=[('Hähnchenbrustfilet','500 g','haehnchenbrust',500),('Zwiebeln','300 g','zwiebeln',300),('Olivenöl','60 g','oel',60),('Gyros-Gewürze','ca. 20 g','gewuerze',20),
   ('Kritharaki, roh','320 g','nudeln',320),('Passierte Tomaten','500 g','passata',500),('Tomatenmark','70 g','tomatenmark',70),('Gemüsebrühe','600 ml','bruehe',600),
   ('Skyr natur','500 g','skyr',500),('Salatgurke','300 g','gurke',300),('Knoblauch','16 g','knoblauch',16),('Feta','200 g','feta',200)],
))

# ======================================================================= 10 Bolognese
R.append(dict(
 id='bolognese', name='Spaghetti Bolognese', short='Bolognese',
 desc='Langsam geschmortes Ragù aus Rind und Pute mit Soffritto, Spaghetti und Parmesan.',
 protein='Rind & Pute', base='Nudeln', method='Topf', time=75, timeNote='davon 45 Min. schmoren', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch (max. 20 % Fett)', '500 g', 'rinderhack', 500, 'g', '1 × 500 g'),
  I('Putenhackfleisch', '500 g', 'putenhack', 500, 'g', '1 × 500 g'),
  I('Spaghetti', '330 g', 'spaghetti', 330, 'g', 'aus 500-g-Packung'),
  I('Zwiebeln', '2 Stück (200 g)', 'zwiebeln', 200, 'g'),
  I('Möhren', '2 Stück (200 g)', 'moehren', 200, 'g'),
  I('Staudensellerie', '2 Stangen (150 g)', 'staudensellerie', 2, 'Stange'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Stückige Tomaten', '2 Dosen à 400 g', 'tomaten-dose', 2, 'Dose'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Parmesan', '30 g', 'parmesan', 30, 'g'),
  I('Rinderbrühe', '200 ml', 'bruehe-rind', pantry=True),
  I('Zucker', '1 TL (5 g)', 'zucker', pantry=True),
  I('Basilikum, frisch', 'zum Servieren', 'basilikum', opt=True),
 ],
 spices=[S('Oregano','2 TL','oregano'), S('Basilikum, getrocknet','1 TL','basilikum-getr'), S('Thymian','1 TL','thymian'),
  S('Lorbeerblätter','2 Stück','lorbeer'), S('Muskat','1 Prise','muskat'), S('Chiliflocken (optional)','½ TL','chiliflocken'),
  S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 steps=[
  ('Vorbereiten', '2 Zwiebeln (200 g), 2 Möhren (200 g) und 2 Stangen Staudensellerie (150 g) sehr fein würfeln (oder im Zerkleinerer), 4 Knoblauchzehen hacken. Den leeren Topf wiegen.'),
  ('Hack braten', '500 g Rinderhack im großen Topf ohne Öl scharf krümelig braten, dann 500 g Putenhack dazu und alles braun braten.'),
  ('Soffritto', 'Zwiebeln (200 g), Möhren (200 g) und Sellerie (150 g) dazugeben und 6–8 Minuten weich dünsten, den Knoblauch (4 Zehen) 1 Minute mit.'),
  ('Tomatenmark', '70 g Tomatenmark 2 Minuten mitrösten.'),
  ('Schmoren', '2 Dosen stückige Tomaten, 200 ml Rinderbrühe, 2 Lorbeerblätter, 2 TL Oregano, 1 TL Basilikum, 1 TL Thymian, optional ½ TL Chiliflocken und 1 TL Zucker dazu. Zugedeckt mindestens 45 Minuten leise köcheln, gelegentlich umrühren. Länger schadet nicht. Mit 2 TL Salz, 1 TL Pfeffer und 1 Prise Muskat abschmecken.'),
  ('Spaghetti', '330 g Spaghetti in Salzwasser 2 Minuten kürzer kochen als angegeben, etwas Kochwasser aufheben, abgießen.'),
  ('Mischen', 'Lorbeer herausnehmen. Die Spaghetti (330 g roh) mit dem Ragù und 30 g Parmesan mischen, mit etwas Kochwasser geschmeidig ziehen. Gemischt lässt es sich genau portionieren.'),
 ],
 tips=['Das Ragù schmeckt am nächsten Tag noch runder. Du kannst es auch am Vorabend kochen und die Nudeln frisch dazu machen.'],
 nutrows=[('Rinderhackfleisch','500 g','rinderhack',500),('Putenhackfleisch','500 g','putenhack',500),('Spaghetti, roh','330 g','nudeln',330),
   ('Zwiebeln','200 g','zwiebeln',200),('Möhren','200 g','moehren',200),('Staudensellerie','150 g','sellerie',150),('Knoblauch','16 g','knoblauch',16),
   ('Stückige Tomaten','800 g','tomatendose',800),('Tomatenmark','70 g','tomatenmark',70),('Parmesan','30 g','parmesan',30),('Zucker','5 g','zucker',5),
   ('Gewürze','ca. 8 g','gewuerze',8)],
))

# ======================================================================= 11 Lasagne
R.append(dict(
 id='lasagne', name='Protein-Lasagne', short='Lasagne',
 desc='Rinder-Ragù mit Zucchini, cremige Quark-Béchamel und Mozzarella. Als Blech in 8 Stücke geschnitten.',
 protein='Rind', base='Nudeln', method='Ofen', time=90, timeNote='davon 40 Min. backen', fridge='4 Tage', freeze='3 Monate',
 items=[
  I('Rinderhackfleisch (max. 20 % Fett)', '500 g', 'rinderhack', 500, 'g', '1 × 500 g'),
  I('Lasagneplatten (ohne Vorkochen)', '250 g', 'lasagne', 250, 'g', '1 Packung'),
  I('Zwiebeln', '1–2 Stück (150 g)', 'zwiebeln', 150, 'g'),
  I('Möhren', '1–2 Stück (150 g)', 'moehren', 150, 'g'),
  I('Zucchini', '1 Stück (ca. 300 g)', 'zucchini', 1, 'Stk'),
  I('Knoblauch', '3 Zehen', 'knoblauch', 3, 'Zehe'),
  I('Passierte Tomaten', '1 kg', 'passata', 1000, 'g', '2 × 500 g'),
  I('Tomatenmark', '70 g', 'tomatenmark', 70, 'g', 'kleine Dose'),
  I('Magerquark', '500 g', 'magerquark', 500, 'g', '2 × 250 g'),
  I('Milch 1,5 %', '500 ml', 'milch', 500, 'ml'),
  I('Parmesan', '30 g', 'parmesan', 30, 'g'),
  I('Mozzarella light', '125 g', 'mozzarella-light', 125, 'g', '1 Kugel'),
  I('Speisestärke', '15 g', 'staerke', pantry=True),
 ],
 spices=[S('Oregano','2 TL','oregano'), S('Basilikum, getrocknet','1 TL','basilikum-getr'), S('Thymian','1 TL','thymian'),
  S('Muskat','frisch gerieben','muskat'), S('Chiliflocken (optional)','½ TL','chiliflocken'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 steps=[
  ('Ragù', '150 g Zwiebeln und 150 g Möhren fein würfeln, 1 Zucchini (300 g) in 1-cm-Würfel schneiden, 3 Knoblauchzehen hacken. 500 g Rinderhack im Topf ohne Öl krümelig braun braten. Zwiebeln und Möhren 5 Minuten mitbraten, Knoblauch und 70 g Tomatenmark 2 Minuten rösten. 1 kg passierte Tomaten, 200 ml Wasser, 2 TL Oregano, 1 TL Basilikum, 1 TL Thymian, optional ½ TL Chiliflocken, 1 TL Salz und ½ TL Pfeffer dazu und 15 Minuten köcheln, die Zucchini die letzten 5 Minuten. Die Sauce darf ruhig flüssig sein, die Platten saugen.'),
  ('Quark-Béchamel', '500 ml Milch mit 15 g Speisestärke glatt rühren und unter Rühren aufkochen, bis sie andickt. Vom Herd nehmen, 500 g Magerquark und 30 g Parmesan einrühren und mit 1 TL Salz, ½ TL Pfeffer und Muskat würzen.'),
  ('Schichten', 'Ofen auf 180 °C Umluft vorheizen. Eine große Auflaufform (ca. 30 × 40 cm) leer wiegen. Etwas Ragù auf den Boden, dann abwechselnd die Lasagneplatten (250 g), Ragù und Béchamel in 3–4 Lagen. Oben Béchamel und 125 g zerzupfter Mozzarella light.'),
  ('Backen', '35–40 Minuten backen, bis die Oberfläche goldbraun ist und ein Messer leicht durch die Platten geht. 10 Minuten ruhen lassen.'),
  ('Portionieren', 'In 2 × 4 gleich große Stücke schneiden. Genauer: Form wiegen, Leergewicht abziehen, durch 8 teilen.'),
 ],
 tips=['Für mehr Volumen passt eine Handvoll Babyspinat in die Ragù-Schicht, das ändert die Werte kaum.'],
 nutrows=[('Rinderhackfleisch','500 g','rinderhack',500),('Lasagneplatten, roh','250 g','nudeln',250),('Zwiebeln','150 g','zwiebeln',150),
   ('Möhren','150 g','moehren',150),('Zucchini','300 g','zucchini',300),('Knoblauch','12 g','knoblauch',12),('Passierte Tomaten','1.000 g','passata',1000),
   ('Tomatenmark','70 g','tomatenmark',70),('Magerquark','500 g','magerquark',500),('Milch 1,5 %','500 ml','milch',500),('Speisestärke','15 g','staerke',15),
   ('Parmesan','30 g','parmesan',30),('Mozzarella light','125 g','mozzalight',125),('Gewürze','ca. 8 g','gewuerze',8)],
))

# ======================================================================= 12 Ofen-Hähnchen
R.append(dict(
 id='ofen-haehnchen', name='Ofen-Hähnchen mit Kartoffeln & Kräuterquark', short='Ofen-Hähnchen',
 desc='Hähnchen, Kartoffeln, Paprika und Zucchini vom Blech mit Rosmarin, dazu kalter Kräuterquark.',
 protein='Hähnchen', base='Kartoffeln', method='Ofen', time=60, timeNote='davon 45 Min. im Ofen', fridge='4 Tage', freeze='2 Monate, ohne Quark',
 items=[
  I('Hähnchenbrustfilet', '400 g', 'haehnchenbrust', 400, 'g', '1 × 400 g'),
  I('Hähnchen-Oberkeulenfilet', '500 g', 'haehnchenkeule', 500, 'g', '1 × 500 g'),
  I('Kartoffeln, festkochend', '1,5 kg', 'kartoffeln', 1500, 'g', 'aus 2-kg-Beutel'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Zucchini', '2 Stück (ca. 600 g)', 'zucchini', 2, 'Stk'),
  I('Rote Zwiebeln', '3 Stück (300 g)', 'rote-zwiebeln', 300, 'g'),
  I('Knoblauch', '1 Knolle (8 Zehen)', 'knoblauch', 8, 'Zehe'),
  I('Magerquark', '250 g', 'magerquark', 250, 'g', '1 Becher'),
  I('Zitrone', '1 Stück', 'zitrone', 1, 'Stk'),
  I('TK-Kräuter', '2 EL', 'tk-kraeuter', 1, 'Pck', 'oder frische Kräuter'),
  I('Olivenöl', '70 g', 'olivenoel', pantry=True),
  H('Backpapier', '2 Blätter für zwei Bleche', 'backpapier'),
  H('Kleine Döschen mit Deckel', '8 Stück für den Kräuterquark', 'doeschen'),
 ],
 spices=[S('Paprika edelsüß','2 EL','paprika-edelsuess'), S('Paprika geräuchert','2 TL','paprika-geraeuchert'),
  S('Rosmarin, getrocknet','1 EL','rosmarin'), S('Thymian','1 TL','thymian'), S('Oregano','1 TL','oregano'),
  S('Chiliflocken','½ TL','chiliflocken'), S('Salz','2½ TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 steps=[
  ('Ofen', 'Ofen auf 220 °C Ober-/Unterhitze (200 °C Umluft) vorheizen. Zwei Bleche mit Backpapier belegen.'),
  ('Kartoffeln vorbacken', '1,5 kg Kartoffeln gründlich waschen, mit Schale in 2-cm-Würfel schneiden. Mit 40 g Olivenöl, 1 EL Paprika edelsüß, 1 EL Rosmarin und 1 TL Salz mischen, auf beide Bleche verteilen und 20 Minuten backen.'),
  ('Hähnchen und Gemüse', '400 g Hähnchenbrust und 500 g Oberkeulenfilet in 3-cm-Stücke schneiden, mit 20 g Olivenöl, 1 EL Paprika edelsüß, 2 TL Paprika geräuchert, 1 TL Thymian, 1 TL Oregano, ½ TL Chiliflocken, ½ TL Pfeffer und 1 TL Salz mischen. 3 Paprika (480 g), 2 Zucchini (600 g) und 3 rote Zwiebeln (300 g) grob schneiden, mit 10 g Olivenöl und ½ TL Salz mischen. 7 Knoblauchzehen ungeschält andrücken, die achte für den Quark aufheben.'),
  ('Fertig backen', 'Hähnchen (900 g), Gemüse und die 7 Knoblauchzehen zu den Kartoffeln geben, alles wenden und 20–25 Minuten weiterbacken, bis das Hähnchen durch ist und die Kartoffeln goldbraun sind.'),
  ('Kräuterquark', '250 g Magerquark mit 2 EL TK-Kräutern, dem Saft von ½ Zitrone, der geriebenen achten Knoblauchzehe, Salz, ½ TL Pfeffer und 2–3 EL Wasser glatt rühren. In 8 kleine Döschen füllen, je ca. 32 g.'),
  ('Portionieren', 'Alles vom Blech in eine große Schüssel geben, gut mischen, wiegen und durch 8 teilen. Den gerösteten Knoblauch aus der Schale drücken und untermischen.'),
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
 protein='Hähnchen', base='Nudeln', method='Wok / Pfanne', time=35, timeNote='', fridge='4 Tage', freeze='2 Monate',
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
 steps=[
  ('Sauce anrühren', '140 g Erdnussbutter, 100 ml Sojasauce, 2 EL Honig (40 g), den Saft von 2 Limetten, 4 geriebene Knoblauchzehen, 20 g geriebenen Ingwer, 1–2 TL Sriracha und 150 ml heißes Wasser glatt rühren. Sie soll dickflüssig sein.'),
  ('Vorbereiten', '800 g Hähnchenbrust in Streifen schneiden. 3 Paprika (480 g) in Streifen, 3 Möhren (300 g) in feine Stifte, 400 g Spitzkohl in feine Streifen, 1 Bund Frühlingszwiebeln in Ringe schneiden. Den leeren Topf wiegen.'),
  ('Nudeln', '250 g Mie-Nudeln nach Packung kochen (meist 4 Minuten), abgießen und kurz kalt abschrecken, damit sie nicht weiter garen.'),
  ('Hähnchen braten', '15 g Öl im Wok oder in der großen Pfanne stark erhitzen und das Hähnchen (800 g) in 2 Portionen je 4 Minuten braten. Herausnehmen.'),
  ('Gemüse', 'Die restlichen 15 g Öl in die Pfanne, Möhren (300 g) und Paprika (480 g) 3 Minuten braten, den Spitzkohl (400 g) 2 Minuten mit. Das Gemüse soll knackig bleiben.'),
  ('Alles zusammen', 'Nudeln (250 g roh), Hähnchen und die Sauce in den großen Topf geben und 2 Minuten schwenken. Die Frühlingszwiebeln (1 Bund) unterheben und mit Sojasauce und Limette abschmecken.'),
 ],
 tips=['Vor dem Aufwärmen 1–2 EL Wasser dazugeben, die Erdnusssauce dickt im Kühlschrank nach.'],
 nutrows=[('Hähnchenbrustfilet','800 g','haehnchenbrust',800),('Mie-Nudeln, roh','250 g','mie',250),('Paprika','480 g','paprika',480),
   ('Möhren','300 g','moehren',300),('Spitzkohl','400 g','spitzkohl',400),('Frühlingszwiebeln','100 g','fruehlingszwiebeln',100),
   ('Erdnussbutter','140 g','erdnussbutter',140),('Sojasauce','100 ml','sojasauce',100),('Honig','40 g','honig',40),('Limettensaft','60 g','limette',60),
   ('Knoblauch','16 g','knoblauch',16),('Ingwer','20 g','ingwer',20),('Öl','30 g','oel',30),('Gewürze & Sriracha','ca. 3 g','gewuerze',3)],
))

# ======================================================================= 14 Geschnetzeltes
R.append(dict(
 id='geschnetzeltes', name='Puten-Geschnetzeltes mit Champignons & Reis', short='Geschnetzeltes',
 desc='Zarte Putenstreifen und kräftig gebratene Champignons in Rahmsauce mit Senf und Thymian.',
 protein='Pute', base='Reis', method='Pfanne', time=40, timeNote='', fridge='4 Tage', freeze='2 Monate',
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
 steps=[
  ('Reis', '330 g Basmati waschen, mit 500 ml Wasser und 1 Prise Salz aufkochen, zugedeckt 12 Minuten auf kleinster Hitze garen und 10 Minuten ruhen lassen.'),
  ('Vorbereiten', '800 g Champignons in Scheiben, 2 Zwiebeln (200 g) in feine Würfel schneiden, 2 Knoblauchzehen hacken. 800 g Putenbrust trocken tupfen und mit 2 TL Paprika edelsüß, 1 TL Salz und ½ TL Pfeffer würzen. Die leere Pfanne oder den Bräter wiegen.'),
  ('Pute anbraten', '10 g Öl in der großen Pfanne stark erhitzen und die Pute (800 g) in 2 Portionen je 2–3 Minuten scharf anbraten. Herausnehmen, sie gart später fertig.'),
  ('Champignons', 'Die Champignons (800 g) in die heiße Pfanne geben und 4 Minuten nicht rühren, damit sie bräunen statt Wasser zu ziehen. Dann die Zwiebeln (200 g) 3 Minuten und den Knoblauch (2 Zehen) 1 Minute mitbraten.'),
  ('Sauce', 'Mit 300 ml Brühe ablöschen und den Bratensatz lösen. 400 g Kochsahne, 200 g Schmand, 1 EL Senf und 1 TL Thymian einrühren und aufkochen. 10 g Speisestärke in 3 EL Wasser verrühren und die Sauce damit binden.'),
  ('Fertig garen', 'Die Pute (800 g) samt Saft zurückgeben und 3 Minuten ziehen lassen, nicht mehr kochen. Mit 1 TL Salz, ½ TL Pfeffer und 1 Prise Muskat abschmecken.'),
  ('Mischen', 'Den Reis (330 g roh) unterheben, wiegen und portionieren. ½ Bund Petersilie erst beim Essen drüber.'),
 ],
 tips=['Putenbrust wird schnell trocken. Lieber kurz und heiß anbraten und in der Sauce nur ziehen lassen.'],
 nutrows=[('Putenbrust','800 g','putenbrust',800),('Champignons','800 g','champignons',800),('Zwiebeln','200 g','zwiebeln',200),('Knoblauch','8 g','knoblauch',8),
   ('Kochsahne 15 %','400 g','kochsahne',400),('Schmand','200 g','schmand',200),('Brühe','300 ml','bruehe',300),('Senf','15 g','senf',15),
   ('Speisestärke','10 g','staerke',10),('Öl','10 g','oel',10),('Basmatireis, roh','330 g','reis',330),('Gewürze','ca. 6 g','gewuerze',6)],
))

# ======================================================================= 15 Balkan-Hackpfanne
R.append(dict(
 id='balkan-pfanne', name='Balkan-Hackpfanne mit Kartoffeln, Ajvar & Feta', short='Balkan-Hackpfanne',
 desc='Gewürztes Putenhack, angebratene Kartoffeln und Paprika, geschmort in Ajvar, mit Feta obendrauf.',
 protein='Pute', base='Kartoffeln', method='Pfanne', time=45, timeNote='', fridge='4 Tage', freeze='2 Monate',
 items=[
  I('Putenhackfleisch', '1 kg', 'putenhack', 1000, 'g', '2 × 500 g'),
  I('Kartoffeln, festkochend', '1,45 kg', 'kartoffeln', 1450, 'g', 'aus 2-kg-Beutel'),
  I('Paprika', '3 Stück (ca. 480 g)', 'paprika', 3, 'Stk'),
  I('Zwiebeln', '3 Stück (300 g)', 'zwiebeln', 300, 'g'),
  I('Knoblauch', '4 Zehen', 'knoblauch', 4, 'Zehe'),
  I('Ajvar, mild', '1 Glas (350 g)', 'ajvar', 1, 'Glas'),
  I('Feta', '200 g', 'feta', 200, 'g', '1 Packung'),
  I('Öl, neutral', '10 g', 'oel', pantry=True),
  I('Gemüsebrühe', '300 ml', 'bruehe-gemuese', pantry=True),
  I('Petersilie, frisch', '½ Bund', 'petersilie', opt=True),
 ],
 spices=[S('Paprika edelsüß','1 EL','paprika-edelsuess'), S('Paprika geräuchert','1 TL','paprika-geraeuchert'),
  S('Kreuzkümmel, gemahlen','1 TL','kreuzkuemmel'), S('Oregano','1 TL','oregano'), S('Majoran','1 TL','majoran'),
  S('Chiliflocken','½ TL','chiliflocken'), S('Knoblauchpulver','½ TL','knoblauchpulver'), S('Salz','2 TL','salz'), S('Pfeffer','1 TL','pfeffer')],
 steps=[
  ('Kartoffeln vorgaren', '1,45 kg Kartoffeln mit Schale in 1,5-cm-Würfel schneiden und 7–8 Minuten in Salzwasser vorkochen, sie sollen noch Biss haben. Abgießen und ausdampfen lassen.'),
  ('Hack braten', '10 g Öl im großen Bräter oder in der größten Pfanne erhitzen, 1 kg Putenhack krümelig braun braten und mit 1 EL Paprika edelsüß, 1 TL Paprika geräuchert, 1 TL Kreuzkümmel, ½ TL Knoblauchpulver und 1 TL Salz würzen. Herausnehmen. Den leeren Topf vorher wiegen, falls du darin portionierst.'),
  ('Gemüse', '3 Zwiebeln (300 g) in Streifen und 3 Paprika (480 g) in Stücke schneiden, in der Pfanne 5 Minuten braten, 4 gehackte Knoblauchzehen 1 Minute mit.'),
  ('Kartoffeln anbraten', 'Die Kartoffeln (1,45 kg) dazugeben und 8–10 Minuten braten, bis die Ränder bräunen.'),
  ('Schmoren', 'Das Hack (1 kg), 1 Glas Ajvar (350 g), 300 ml Gemüsebrühe, 1 TL Oregano, 1 TL Majoran und ½ TL Chiliflocken dazu und 5 Minuten schmoren, bis alles sämig ist. Mit 1 TL Salz und 1 TL Pfeffer abschmecken.'),
  ('Portionieren', 'Wiegen und durch 8 teilen. 200 g Feta über die Boxen bröseln, je 25 g. ½ Bund Petersilie erst beim Essen.'),
 ],
 tips=['Ajvar gibt es mild und scharf. Mit scharfem Ajvar kannst du die Chiliflocken weglassen.'],
 nutrows=[('Putenhackfleisch','1.000 g','putenhack',1000),('Kartoffeln','1.450 g','kartoffeln',1450),('Paprika','480 g','paprika',480),
   ('Zwiebeln','300 g','zwiebeln',300),('Knoblauch','16 g','knoblauch',16),('Ajvar','350 g','ajvar',350),('Gemüsebrühe','300 ml','bruehe',300),
   ('Feta','200 g','feta',200),('Öl','10 g','oel',10),('Gewürze','ca. 15 g','gewuerze',15)],
))

# ======================================================================= 16 Gnocchi
R.append(dict(
 id='gnocchi', name='Hähnchen-Gnocchi-Pfanne mit Tomate & Spinat', short='Gnocchi-Pfanne',
 desc='Knusprig gebratene Gnocchi, Hähnchen und Kirschtomaten in cremiger Tomatensauce mit Parmesan.',
 protein='Hähnchen', base='Gnocchi', method='Pfanne', time=35, timeNote='', fridge='3 Tage', freeze='2 Monate',
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
 steps=[
  ('Gnocchi braten', '800 g Gnocchi direkt aus der Packung mit 15 g Olivenöl in der großen Pfanne 6–8 Minuten goldbraun braten, nicht kochen. Herausnehmen. Den großen Topf zum Mischen leer wiegen.'),
  ('Hähnchen', '800 g Hähnchenbrust in Würfel schneiden, mit 1 TL Paprika edelsüß, 1 TL Salz und ½ TL Pfeffer würzen und mit 15 g Olivenöl in 2 Portionen je 3 Minuten anbraten. Herausnehmen.'),
  ('Tomaten', 'Die restlichen 5 g Olivenöl in die Pfanne, 1 Zwiebel (100 g) 3 Minuten, 4 Knoblauchzehen 1 Minute braten. 500 g Kirschtomaten halbieren und 3 Minuten mitbraten, bis sie leicht aufplatzen.'),
  ('Sauce', '500 g passierte Tomaten, 200 g Kochsahne, 200 g Frischkäse, 1 TL Gemüsebrühe (Pulver), 2 TL italienische Kräuter und ½ TL Chiliflocken einrühren und 5 Minuten köcheln.'),
  ('Spinat und Hähnchen', '200 g Babyspinat handvollweise unterheben. Das Hähnchen (800 g) zurückgeben und 4 Minuten ziehen lassen, bis es durch ist. 50 g Parmesan einrühren.'),
  ('Mischen', 'Alles mit den Gnocchi (800 g) im großen Topf mischen, mit ½ TL Salz und ½ TL Pfeffer abschmecken, wiegen und portionieren.'),
 ],
 tips=['Die Gnocchi werden in der Box weicher. Wer sie knusprig mag, lagert sie getrennt und brät sie beim Aufwärmen kurz an.'],
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

out=[]
for r in R:
    if 'nutrows' in r:
        r['nut'] = nutrows(r.pop('nutrows'))
    tot=[round(sum(row[i] for row in r['nut']),1) for i in range(2,6)]
    r['total']=tot
    r['m']={'kcal':round(tot[0]/8),'p':round(tot[1]/8,1),'kh':round(tot[2]/8,1),'f':round(tot[3]/8,1)}
    r['steps']=[{'t':t,'d':d} for t,d in r['steps']]
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

print(f"{'Rezept':16s} {'kcal':>4s} {'P':>5s} {'KH':>5s} {'F':>5s}   pro Box")
for r in out:
    print(f"{r['id']:16s} {r['m']['kcal']:4d} {r['m']['p']:5.1f} {r['m']['kh']:5.1f} {r['m']['f']:5.1f}")

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
