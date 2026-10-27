"""
Nährwerte pro 100 g: (kcal, Protein, Kohlenhydrate, Fett) – typische
Etikettenwerte aus dem Supermarkt. Roh gewogen, Reis und Nudeln trocken.

T ist das Ziel pro Box (kcal, P, KH, F). pp() teilt eine Zutatenliste durch
8 Boxen, err() bewertet, wie weit eine Box vom Ziel weg ist (Fett zählt
1,5-fach, kcal durch 8) – damit wurden die Mengen gesucht.
"""
N = {
 'haehnchenbrust':(106,23,0,1.5), 'haehnchenkeule':(146,18.7,0,7.9), 'putenbrust':(105,24,0,1.0),
 'rinderhack':(235,18.5,0,17), 'rinderhack-mager':(129,21,0,5), 'rindergulasch':(128,21,0,5),
 'reis':(350,8,77,0.6), 'nudeln':(356,12.5,70.5,1.8), 'mie':(362,13,70,2.5), 'gnocchi':(150,3.6,32,0.5),
 'kartoffeln':(72,2,15.5,0.1), 'suesskartoffel':(86,1.6,20,0.1),
 'zwiebeln':(35,1.2,6,0.1), 'knoblauch':(149,6.4,30,0.5), 'ingwer':(80,1.8,15.8,0.8), 'paprika':(28,1,4.5,0.3),
 'zucchini':(19,1.5,2.2,0.4), 'brokkoli':(34,3,3,0.4), 'moehren':(36,0.9,7,0.2), 'champignons':(22,3,0.5,0.3),
 'spinat':(23,2.8,1,0.4), 'zuckerschoten':(42,3,7,0.2), 'fruehlingszwiebeln':(30,1.8,4.5,0.3), 'spitzkohl':(25,1.3,4,0.2),
 'gurke':(13,0.6,2,0.1), 'tomaten':(20,1,3,0.2), 'erbsen':(75,5.5,10,0.4), 'sellerie':(16,0.7,2.2,0.2),
 'mais':(80,2.5,12,1.3), 'kidney':(95,7.5,12,0.6), 'schwarzebohnen':(100,7.5,13,0.6),
 'tomatendose':(22,1,3.5,0.2), 'passata':(26,1.3,4.3,0.2), 'tomatenmark':(90,4.5,15,0.5), 'ajvar':(90,1.5,9,5),
 'kokosmilch':(180,1.6,3,18), 'kokosmilchlight':(80,0.7,2,7.5), 'currypaste':(150,3,13,9),
 'skyr':(63,11,4,0.2), 'magerquark':(67,12,4,0.2), 'frischkaese':(145,7,4.5,11),
 'kochsahne':(160,2.8,3.8,15), 'schlagsahne':(292,2.4,3.3,30), 'schmand':(240,2.6,3.5,24), 'milch':(47,3.4,4.8,1.5),
 'cheddar':(400,25,0,33), 'mozzarella':(240,18,1,18), 'mozzalight':(160,19,1,9), 'parmesan':(390,33,0,28), 'feta':(270,17,0.5,22),
 'ei':(145,12.5,0.7,10), 'oel':(900,0,0,100), 'butter':(741,0.7,0.6,82), 'butterschmalz':(898,0,0,99.8),
 'sesam':(580,18,10,50), 'cashews':(600,20,26,46), 'erdnussbutter':(600,25,12,50),
 'honig':(320,0.4,80,0), 'zucker':(400,0,100,0), 'mehl':(348,10,72,1), 'sojasauce':(70,9,5,0), 'staerke':(350,0.3,86,0.1),
 'bruehe':(4,0.2,0.4,0.2), 'senf':(90,6,5,4), 'limette':(25,0.4,2.5,0.1), 'gewuerze':(320,13,30,12),
 'kakao':(360,22,10,11), 'getrtomaten':(215,5,15,14), 'balsamico':(100,0.5,20,0), 'essig':(20,0,1,0), 'sriracha':(100,2,20,1),
 # fürs Anpassen in der App (Zutat tauschen)
 'blumenkohl':(25,2.5,2.3,0.3), 'bohnengruen':(31,1.8,5,0.2), 'aubergine':(24,1,3,0.2), 'lauch':(30,2,3,0.3), 'kohlrabi':(27,2,3.7,0.1),
 'weisskohl':(25,1.3,4,0.2), 'kichererbsen':(120,7,16,2.5), 'linsendose':(95,6.5,12,0.6), 'linsenrot':(340,24,52,2), 'tofu':(125,13,1,7),
 'couscous':(360,12,72,2), 'bulgur':(350,12,70,1.5), 'vollkornnudeln':(340,13,62,2.5), 'joghurt':(50,4,5,1.5),
 'haferflocken':(370,13,59,7), 'aepfel':(52,0.3,12,0.2), 'whey':(380,78,6,5), 'erdnusscrunch':(600,25,12,50),
}
T = (443,33,39,15.4)
def tot(rows):
    t=[0.0]*4
    for k,g in rows:
        v=N[k]
        for i in range(4): t[i]+=v[i]*g/100
    return t
def pp(rows): return [x/8 for x in tot(rows)]
def err(p): return (p[1]-T[1])**2+(p[2]-T[2])**2+1.5*(p[3]-T[3])**2+((p[0]-T[0])/8)**2
