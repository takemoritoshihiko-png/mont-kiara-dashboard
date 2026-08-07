import json

condos = [
{"name":"10 Mont Kiara (MK10)","sizeMin":3478,"sizeMax":7500,"rentMin":15000,"rentMax":20000,"salePsfMin":1200,"salePsfMax":1500,"units":332,"year":2009},
{"name":"11 Mont Kiara (MK11)","sizeMin":2707,"sizeMax":6705,"rentMin":13000,"rentMax":20000,"salePsfMin":1000,"salePsfMax":1300,"units":339,"year":2011},
{"name":"28 Mont Kiara (MK28)","sizeMin":2535,"sizeMax":3000,"rentMin":9000,"rentMax":15000,"salePsfMin":850,"salePsfMax":950,"units":460,"year":2012},
{"name":"Agile Mont Kiara","sizeMin":1215,"sizeMax":5090,"rentMin":5000,"rentMax":15000,"salePsfMin":950,"salePsfMax":1100,"units":813,"year":2020},
{"name":"Allevia Mont Kiara","sizeMin":1703,"sizeMax":2634,"rentMin":10000,"rentMax":20000,"salePsfMin":1000,"salePsfMax":1200,"units":294,"year":2025},
{"name":"Almaspuri Mont Kiara","sizeMin":1550,"sizeMax":1600,"rentMin":4500,"rentMax":6000,"salePsfMin":600,"salePsfMax":700,"units":132,"year":2003},
{"name":"Aman Mont Kiara","sizeMin":1668,"sizeMax":4647,"rentMin":6000,"rentMax":10000,"salePsfMin":650,"salePsfMax":750,"units":345,"year":2005},
{"name":"Angkupuri Mont Kiara","sizeMin":1249,"sizeMax":1550,"rentMin":3000,"rentMax":4500,"salePsfMin":500,"salePsfMax":550,"units":210,"year":1998},
{"name":"Arcoris Mont Kiara","sizeMin":496,"sizeMax":4241,"rentMin":3000,"rentMax":15000,"salePsfMin":950,"salePsfMax":1300,"units":697,"year":2016},
{"name":"Arte Mont Kiara","sizeMin":442,"sizeMax":1851,"rentMin":2000,"rentMax":7000,"salePsfMin":900,"salePsfMax":1000,"units":1707,"year":2020},
{"name":"Astana Mont Kiara","sizeMin":1241,"sizeMax":1690,"rentMin":4000,"rentMax":6500,"salePsfMin":600,"salePsfMax":700,"units":281,"year":2000},
{"name":"Aston Kiara 3","sizeMin":1517,"sizeMax":1598,"rentMin":2500,"rentMax":3000,"salePsfMin":350,"salePsfMax":400,"units":160,"year":2011},
{"name":"Astrea Mont Kiara","sizeMin":1364,"sizeMax":1859,"rentMin":4500,"rentMax":9000,"salePsfMin":900,"salePsfMax":1000,"units":240,"year":2024},
{"name":"Banyan Mont Kiara","sizeMin":1838,"sizeMax":2648,"rentMin":6000,"rentMax":10000,"salePsfMin":650,"salePsfMax":750,"units":147,"year":2007},
{"name":"Bayu Mont Kiara","sizeMin":798,"sizeMax":2300,"rentMin":2200,"rentMax":4000,"salePsfMin":600,"salePsfMax":700,"units":398,"year":2002},
{"name":"Casa Kiara 1","sizeMin":1235,"sizeMax":1268,"rentMin":3000,"rentMax":4000,"salePsfMin":500,"salePsfMax":550,"units":223,"year":2006},
{"name":"Casa Kiara 2","sizeMin":1375,"sizeMax":1574,"rentMin":3500,"rentMax":4500,"salePsfMin":600,"salePsfMax":700,"units":206,"year":2009},
{"name":"Ceriaan Kiara","sizeMin":1828,"sizeMax":2208,"rentMin":4000,"rentMax":6000,"salePsfMin":500,"salePsfMax":550,"units":238,"year":2009},
{"name":"Damai Mont Kiara","sizeMin":2272,"sizeMax":5700,"rentMin":8000,"rentMax":16000,"salePsfMin":800,"salePsfMax":900,"units":230,"year":2004},
{"name":"Flora Murni Mont Kiara","sizeMin":1615,"sizeMax":5490,"rentMin":7000,"rentMax":20000,"salePsfMin":600,"salePsfMax":1000,"units":71,"year":2006},
{"name":"Gateway Kiaramas","sizeMin":743,"sizeMax":3563,"rentMin":2500,"rentMax":5000,"salePsfMin":550,"salePsfMax":850,"units":168,"year":2010},
{"name":"Hartamas Regency 1","sizeMin":1181,"sizeMax":2935,"rentMin":3000,"rentMax":6000,"salePsfMin":550,"salePsfMax":600,"units":244,"year":2005},
{"name":"Hartamas Regency 2","sizeMin":1315,"sizeMax":3380,"rentMin":3000,"rentMax":6000,"salePsfMin":550,"salePsfMax":600,"units":210,"year":2007},
{"name":"Hijauan Kiara","sizeMin":2090,"sizeMax":5045,"rentMin":6500,"rentMax":12000,"salePsfMin":600,"salePsfMax":700,"units":188,"year":2008},
{"name":"Icon Residence","sizeMin":673,"sizeMax":4719,"rentMin":3000,"rentMax":12000,"salePsfMin":800,"salePsfMax":900,"units":260,"year":2014},
{"name":"Inspirasi Mont Kiara","sizeMin":940,"sizeMax":1015,"rentMin":3000,"rentMax":4500,"salePsfMin":750,"salePsfMax":850,"units":640,"year":2022},
{"name":"Kami Mont Kiara","sizeMin":840,"sizeMax":1604,"rentMin":4000,"rentMax":10000,"salePsfMin":1100,"salePsfMax":1200,"units":168,"year":2025},
{"name":"i-Zen Kiara 1","sizeMin":805,"sizeMax":1407,"rentMin":2500,"rentMax":5500,"salePsfMin":700,"salePsfMax":750,"units":302,"year":2008},
{"name":"i-Zen Kiara 2","sizeMin":725,"sizeMax":1701,"rentMin":2500,"rentMax":6500,"salePsfMin":600,"salePsfMax":650,"units":238,"year":2006},
{"name":"Kiara 1888","sizeMin":1238,"sizeMax":3982,"rentMin":3500,"rentMax":9000,"salePsfMin":550,"salePsfMax":600,"units":182,"year":2008},
{"name":"Kiara 9 Residency","sizeMin":1661,"sizeMax":2691,"rentMin":5000,"rentMax":15000,"salePsfMin":700,"salePsfMax":800,"units":192,"year":2011},
{"name":"Kiara Designer Suites","sizeMin":1088,"sizeMax":1600,"rentMin":3000,"rentMax":4500,"salePsfMin":600,"salePsfMax":650,"units":324,"year":2007},
{"name":"Kiaramas Ayuria","sizeMin":1605,"sizeMax":4000,"rentMin":4000,"rentMax":8000,"salePsfMin":600,"salePsfMax":650,"units":480,"year":2008},
{"name":"Kiaramas Cendana","sizeMin":1650,"sizeMax":4530,"rentMin":4500,"rentMax":8000,"salePsfMin":650,"salePsfMax":750,"units":184,"year":2006},
{"name":"Kiaramas Danai","sizeMin":2025,"sizeMax":2498,"rentMin":6500,"rentMax":10000,"salePsfMin":800,"salePsfMax":900,"units":274,"year":2013},
{"name":"Kiaramas Sutera","sizeMin":1347,"sizeMax":4100,"rentMin":3000,"rentMax":7000,"salePsfMin":550,"salePsfMax":600,"units":315,"year":2004},
{"name":"Kiaraville","sizeMin":1593,"sizeMax":3935,"rentMin":5500,"rentMax":15000,"salePsfMin":700,"salePsfMax":800,"units":404,"year":2008},
{"name":"La Grande Mont Kiara","sizeMin":1961,"sizeMax":2047,"rentMin":4000,"rentMax":6000,"salePsfMin":550,"salePsfMax":600,"units":298,"year":2005},
{"name":"Laman Suria Mont Kiara","sizeMin":931,"sizeMax":1178,"rentMin":2500,"rentMax":5000,"salePsfMin":600,"salePsfMax":650,"units":202,"year":2004},
{"name":"Lanai Kiara","sizeMin":1400,"sizeMax":4300,"rentMin":3000,"rentMax":6000,"salePsfMin":400,"salePsfMax":450,"units":181,"year":1998},
{"name":"Lumina Kiara","sizeMin":1448,"sizeMax":3152,"rentMin":4500,"rentMax":15000,"salePsfMin":600,"salePsfMax":700,"units":104,"year":2010},
{"name":"Meridin Mont Kiara","sizeMin":1787,"sizeMax":2513,"rentMin":4500,"rentMax":8000,"salePsfMin":550,"salePsfMax":600,"units":228,"year":2009},
{"name":"OOAK Kiara 163","sizeMin":696,"sizeMax":1016,"rentMin":3000,"rentMax":9000,"salePsfMin":1200,"salePsfMax":1300,"units":336,"year":2022},
{"name":"Palma Mont Kiara","sizeMin":1208,"sizeMax":1390,"rentMin":4000,"rentMax":6000,"salePsfMin":700,"salePsfMax":750,"units":402,"year":1994},
{"name":"Pavilion Hilltop","sizeMin":1200,"sizeMax":3671,"rentMin":5000,"rentMax":20000,"salePsfMin":1000,"salePsfMax":1200,"units":621,"year":2018},
{"name":"Pelangi Mont Kiara","sizeMin":1208,"sizeMax":1390,"rentMin":3500,"rentMax":6000,"salePsfMin":600,"salePsfMax":650,"units":302,"year":1994},
{"name":"Pentamont Mont Kiara","sizeMin":1379,"sizeMax":2125,"rentMin":5000,"rentMax":15000,"salePsfMin":900,"salePsfMax":1100,"units":330,"year":2023},
{"name":"Pines Mont Kiara","sizeMin":1208,"sizeMax":1428,"rentMin":3000,"rentMax":6000,"salePsfMin":600,"salePsfMax":650,"units":508,"year":1993},
{"name":"Residensi 22","sizeMin":1878,"sizeMax":3043,"rentMin":9000,"rentMax":20000,"salePsfMin":1200,"salePsfMax":1400,"units":534,"year":2017},
{"name":"Residensi Sefina","sizeMin":1333,"sizeMax":1771,"rentMin":4500,"rentMax":8000,"salePsfMin":800,"salePsfMax":850,"units":245,"year":2019},
{"name":"Richmond Mont Kiara","sizeMin":1931,"sizeMax":2148,"rentMin":3000,"rentMax":4000,"salePsfMin":350,"salePsfMax":400,"units":96,"year":2014},
{"name":"Seni Mont Kiara","sizeMin":2437,"sizeMax":3531,"rentMin":8000,"rentMax":20000,"salePsfMin":800,"salePsfMax":900,"units":605,"year":2010},
{"name":"Solaris Dutamas (Publika)","sizeMin":672,"sizeMax":1238,"rentMin":2500,"rentMax":6000,"salePsfMin":800,"salePsfMax":950,"units":800,"year":2009},
{"name":"Solaris Parq","sizeMin":721,"sizeMax":1423,"rentMin":3500,"rentMax":9000,"salePsfMin":1200,"salePsfMax":1300,"units":576,"year":2023},
{"name":"Sophia Mont Kiara","sizeMin":750,"sizeMax":1386,"rentMin":3000,"rentMax":6000,"salePsfMin":650,"salePsfMax":700,"units":238,"year":1997},
{"name":"Sunway Mont","sizeMin":1122,"sizeMax":1906,"rentMin":4000,"rentMax":9000,"salePsfMin":850,"salePsfMax":950,"units":288,"year":2020},
{"name":"Sunway Vivaldi","sizeMin":2573,"sizeMax":3983,"rentMin":9000,"rentMax":20000,"salePsfMin":800,"salePsfMax":950,"units":208,"year":2011},
{"name":"Tiffani Kiara","sizeMin":815,"sizeMax":3729,"rentMin":3000,"rentMax":12000,"salePsfMin":700,"salePsfMax":800,"units":399,"year":2009},
{"name":"TWY Mont Kiara","sizeMin":662,"sizeMax":1385,"rentMin":2500,"rentMax":7000,"salePsfMin":900,"salePsfMax":1000,"units":484,"year":2021},
{"name":"Verve Suites Mont Kiara","sizeMin":462,"sizeMax":1394,"rentMin":2000,"rentMax":6000,"salePsfMin":850,"salePsfMax":1000,"units":933,"year":2013},
{"name":"Vista Kiara","sizeMin":1230,"sizeMax":1410,"rentMin":3000,"rentMax":4500,"salePsfMin":500,"salePsfMax":550,"units":409,"year":1997},
]

# Raw metrics
for c in condos:
    c['sizeMid'] = (c['sizeMin'] + c['sizeMax']) / 2
    c['sizeUpper'] = c['sizeMax']
    c['salePsfMid'] = (c['salePsfMin'] + c['salePsfMax']) / 2
    c['rentMid'] = (c['rentMin'] + c['rentMax']) / 2
    c['estPriceMax'] = c['salePsfMax'] * c['sizeMax']
    c['estPriceMid'] = c['salePsfMid'] * c['sizeMid']

def norm(vals, inv=False):
    mn, mx = min(vals), max(vals)
    if mx == mn: return [50]*len(vals)
    if inv: return [100*(1-(v-mn)/(mx-mn)) for v in vals]
    return [100*(v-mn)/(mx-mn) for v in vals]

# Luxury factors:
# 1. Max unit size (25%) - bigger available units = more luxury
# 2. Sale PSF (20%) - higher price/sqft = more premium
# 3. Max rent (20%) - higher top rent = more luxury
# 4. Estimated max total price (20%) - higher total = more luxury
# 5. Exclusivity: fewer units (15%) - low density = exclusive

n_sz = norm([c['sizeUpper'] for c in condos])
n_psf = norm([c['salePsfMid'] for c in condos])
n_rn = norm([c['rentMax'] for c in condos])
n_pr = norm([c['estPriceMax'] for c in condos])
n_ex = norm([c['units'] for c in condos], inv=True)

for i, c in enumerate(condos):
    c['lux'] = round(n_sz[i]*0.25 + n_psf[i]*0.20 + n_rn[i]*0.20 + n_pr[i]*0.20 + n_ex[i]*0.15, 1)
    c['_sz'] = round(n_sz[i],1)
    c['_psf'] = round(n_psf[i],1)
    c['_rn'] = round(n_rn[i],1)
    c['_pr'] = round(n_pr[i],1)
    c['_ex'] = round(n_ex[i],1)

condos.sort(key=lambda c: c['lux'], reverse=True)

print()
print(f"{'#':<3} {'Name':<30} {'LUX':>5} | {'Size':>5} {'PSF':>5} {'Rent':>5} {'Price':>5} {'Excl':>5} | {'MaxSF':>7} {'PSF':>6} {'RentMax':>8} {'PriceMax':>13} {'Units':>5}")
print("-"*135)
for i, c in enumerate(condos):
    tier = "S" if c['lux']>=75 else "A" if c['lux']>=55 else "B" if c['lux']>=35 else "C"
    print(f"{i+1:<3} {c['name']:<30} {c['lux']:>4} {tier} | {c['_sz']:>5} {c['_psf']:>5} {c['_rn']:>5} {c['_pr']:>5} {c['_ex']:>5} | {c['sizeUpper']:>7,} {c['salePsfMid']:>5,.0f} {c['rentMax']:>8,} RM{c['estPriceMax']:>11,} {c['units']:>5}")

print()
print("=== TIER SUMMARY ===")
for tier, mn, mx in [("S (Super Luxury)",75,101),("A (Luxury)",55,75),("B (Mid-Range)",35,55),("C (Standard)",0,35)]:
    members = [c for c in condos if mn <= c['lux'] < mx]
    print(f"\n{tier}: {len(members)} properties")
    for c in members:
        print(f"  {c['name']}: {c['lux']}")
