"""
Richtpreise je Katalogschlüssel – was die Packung beim Discounter kostet
(Aldi/Lidl-Niveau, Hamburg, Stand Oktober 2026; Fleisch an Aldi-Preisen
geeicht: Hähnchenbrust 600 g 6,79 €, Rinderhack 5 % 400 g 5,49 €, Puten-
geschnetzeltes 800 g 8,99 €).

    schlüssel: (euro, menge, einheit)

Die Einheit ist die, in der die Zutat im Rezept steht (g, ml, Stk, Dose,
Zehe, Bund, Stange, Glas, Pck). rezepte.py rechnet daraus einen Preis je
Gramm (über EINHEIT_G) und damit die Kosten der *verwendeten* Menge, nicht
der ganzen Packung: Wer 280 g Reis braucht, zahlt im Rezept 280 g, auch wenn
das Kilo im Schrank steht. Gewürze gehen pauschal nach Gramm rein.

Richtwerte, keine Tagespreise – in der App steht „ca.“ dran.
"""

PREISE = {
 # Fleisch & Geflügel
 'rinderhack': (5.79, 500, 'g'), 'rinderhack-mager': (5.49, 400, 'g'), 'rindergulasch': (6.49, 500, 'g'),
 'haehnchenbrust': (6.79, 600, 'g'), 'haehnchenkeule': (5.49, 600, 'g'), 'putenbrust': (8.99, 800, 'g'),
 'rinderhuefte': (7.49, 400, 'g'),
 # Obst & Gemüse
 'zwiebeln': (1.29, 1000, 'g'), 'rote-zwiebeln': (1.49, 1000, 'g'), 'knoblauch': (1.19, 30, 'Zehe'),
 'ingwer': (0.69, 200, 'g'), 'paprika': (2.49, 3, 'Stk'), 'zucchini': (0.79, 1, 'Stk'), 'brokkoli': (1.19, 500, 'g'),
 'moehren': (0.99, 1000, 'g'), 'champignons': (1.69, 400, 'g'), 'spinat': (1.29, 125, 'g'),
 'zuckerschoten': (1.99, 200, 'g'), 'fruehlingszwiebeln': (0.99, 1, 'Bund'), 'spitzkohl': (1.49, 1000, 'g'),
 'gurke': (0.79, 1, 'Stk'), 'tomaten': (2.49, 1000, 'g'), 'kirschtomaten': (1.99, 500, 'g'),
 'kartoffeln': (2.49, 2500, 'g'), 'suesskartoffel': (2.29, 1000, 'g'),
 'staudensellerie': (1.49, 8, 'Stange'), 'limette': (0.39, 1, 'Stk'), 'zitrone': (0.39, 1, 'Stk'),
 'blumenkohl': (1.99, 1, 'Stk'), 'bohnen-gruen': (2.49, 500, 'g'), 'aubergine': (0.99, 1, 'Stk'),
 'lauch': (1.49, 1, 'Stange'), 'kohlrabi': (0.69, 1, 'Stk'), 'weisskohl': (1.29, 1000, 'g'),
 'koriander': (0.99, 1, 'Bund'), 'basilikum': (1.19, 1, 'Topf'), 'petersilie': (0.99, 1, 'Bund'), 'dill': (0.99, 1, 'Bund'),
 # Kühlregal & Käse
 'skyr': (1.29, 500, 'g'), 'magerquark': (0.99, 500, 'g'), 'frischkaese': (1.19, 200, 'g'),
 'kochsahne': (0.79, 200, 'g'), 'schlagsahne': (0.99, 200, 'g'), 'schmand': (0.79, 200, 'g'), 'milch': (1.09, 1000, 'ml'),
 'cheddar': (2.19, 200, 'g'), 'parmesan': (1.99, 100, 'g'), 'feta': (1.39, 150, 'g'), 'gnocchi': (1.49, 500, 'g'),
 'butter': (2.19, 250, 'g'), 'mozzarella': (0.89, 125, 'g'), 'mozzarella-light': (0.89, 125, 'g'),
 'joghurt': (0.99, 500, 'g'), 'eier': (2.49, 10, 'Stk'), 'tofu': (1.49, 400, 'g'),
 # Tiefkühl
 'tk-kraeuter': (0.99, 1, 'Pck'), 'erbsen': (1.19, 450, 'g'), 'tk-brokkoli': (1.19, 750, 'g'),
 'tk-blumenkohl': (1.19, 750, 'g'), 'tk-bohnen': (1.49, 450, 'g'), 'tk-spinat': (1.29, 450, 'g'),
 # Konserven & Gläser
 'tomaten-dose': (0.69, 1, 'Dose'), 'passata': (0.69, 500, 'g'), 'tomatenmark': (0.69, 200, 'g'),
 'kidney': (0.69, 1, 'Dose'), 'schwarze-bohnen': (0.89, 1, 'Dose'), 'mais': (0.79, 1, 'Dose'),
 'kokosmilch': (1.19, 1, 'Dose'), 'kokosmilch-light': (1.19, 1, 'Dose'), 'currypaste': (1.49, 1, 'Glas'),
 'ajvar': (1.99, 1, 'Glas'), 'getr-tomaten': (2.29, 1, 'Glas'), 'erdnussbutter': (2.49, 350, 'g'),
 'kichererbsen': (0.69, 1, 'Dose'), 'linsen-dose': (0.79, 1, 'Dose'), 'pesto': (1.39, 190, 'g'),
 'ananas-dose': (1.29, 1, 'Dose'), 'gewuerzgurken': (1.29, 360, 'g'), 'oliven': (1.29, 170, 'g'),
 # Nudeln, Reis & Co.
 'reis': (2.29, 1000, 'g'), 'penne': (0.99, 500, 'g'), 'spaghetti': (0.99, 500, 'g'), 'hoernchen': (0.99, 500, 'g'),
 'kritharaki': (1.49, 500, 'g'), 'lasagne': (1.29, 500, 'g'), 'mie': (1.29, 250, 'g'), 'sesam': (1.29, 100, 'g'),
 'vollkornnudeln': (1.29, 500, 'g'), 'couscous': (1.49, 500, 'g'), 'bulgur': (1.29, 500, 'g'), 'linsen-rot': (1.79, 500, 'g'),
 'bandnudeln': (1.19, 500, 'g'), 'tortillas': (1.29, 1, 'Pck'), 'erdnuesse': (1.49, 200, 'g'),
 'semmelbroesel': (0.79, 400, 'g'), 'mandeln': (1.29, 100, 'g'), 'rosinen': (1.29, 250, 'g'), 'cashews': (2.99, 200, 'g'),
 # Vorrat
 'oel': (2.49, 1000, 'g'), 'olivenoel': (6.99, 750, 'g'), 'sesamoel': (2.99, 250, 'g'), 'butterschmalz': (2.49, 250, 'g'),
 'honig': (3.99, 500, 'g'), 'zucker': (0.99, 1000, 'g'), 'mehl': (0.69, 1000, 'g'), 'sojasauce': (1.19, 150, 'ml'),
 'staerke': (0.99, 400, 'g'), 'sweetchili': (1.29, 200, 'g'), 'bbq-sauce': (1.49, 500, 'g'), 'ketchup': (1.29, 500, 'g'),
 'senf': (0.79, 250, 'g'), 'balsamico': (1.99, 500, 'ml'), 'essig': (0.99, 500, 'ml'), 'kakao': (1.99, 250, 'g'),
 'sriracha': (1.99, 200, 'ml'),
 'bruehe-rind': (0.35, 1000, 'ml'), 'bruehe-gemuese': (0.35, 1000, 'ml'), 'bruehe-huhn': (0.35, 1000, 'ml'),
 # Frühstück
 'haferflocken': (0.69, 500, 'g'), 'erdnuss-crunch': (1.99, 200, 'g'), 'aepfel': (2.29, 1000, 'g'), 'whey-vanille': (19.99, 1000, 'g'),
}

# Gewürze pauschal: ein gut sortiertes Regal kostet im Schnitt etwa so viel je Gramm.
GEWUERZ_JE_G = 0.012
STAND = 'Okt. 2026'
