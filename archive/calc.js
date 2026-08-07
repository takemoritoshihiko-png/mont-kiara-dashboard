const condos = [
{n:'10 Mont Kiara (MK10)',szMax:7500,psfMid:1350,rMax:20000,units:332},
{n:'11 Mont Kiara (MK11)',szMax:6705,psfMid:1150,rMax:20000,units:339},
{n:'28 Mont Kiara (MK28)',szMax:3000,psfMid:900,rMax:15000,units:460},
{n:'Agile Mont Kiara',szMax:5090,psfMid:1025,rMax:15000,units:813},
{n:'Allevia Mont Kiara',szMax:2634,psfMid:1100,rMax:20000,units:294},
{n:'Almaspuri Mont Kiara',szMax:1600,psfMid:650,rMax:6000,units:132},
{n:'Aman Mont Kiara',szMax:4647,psfMid:700,rMax:10000,units:345},
{n:'Angkupuri Mont Kiara',szMax:1550,psfMid:525,rMax:4500,units:210},
{n:'Arcoris Mont Kiara',szMax:4241,psfMid:1125,rMax:15000,units:697},
{n:'Arte Mont Kiara',szMax:1851,psfMid:950,rMax:7000,units:1707},
{n:'Astana Mont Kiara',szMax:1690,psfMid:650,rMax:6500,units:281},
{n:'Aston Kiara 3',szMax:1598,psfMid:375,rMax:3000,units:160},
{n:'Astrea Mont Kiara',szMax:1859,psfMid:950,rMax:9000,units:240},
{n:'Banyan Mont Kiara',szMax:2648,psfMid:700,rMax:10000,units:147},
{n:'Bayu Mont Kiara',szMax:2300,psfMid:650,rMax:4000,units:398},
{n:'Casa Kiara 1',szMax:1268,psfMid:525,rMax:4000,units:223},
{n:'Casa Kiara 2',szMax:1574,psfMid:650,rMax:4500,units:206},
{n:'Ceriaan Kiara',szMax:2208,psfMid:525,rMax:6000,units:238},
{n:'Damai Mont Kiara',szMax:5700,psfMid:850,rMax:16000,units:230},
{n:'Flora Murni Mont Kiara',szMax:5490,psfMid:800,rMax:20000,units:71},
{n:'Gateway Kiaramas',szMax:3563,psfMid:700,rMax:5000,units:168},
{n:'Hartamas Regency 1',szMax:2935,psfMid:575,rMax:6000,units:244},
{n:'Hartamas Regency 2',szMax:3380,psfMid:575,rMax:6000,units:210},
{n:'Hijauan Kiara',szMax:5045,psfMid:650,rMax:12000,units:188},
{n:'Icon Residence',szMax:4719,psfMid:850,rMax:12000,units:260},
{n:'Inspirasi Mont Kiara',szMax:1015,psfMid:800,rMax:4500,units:640},
{n:'Kami Mont Kiara',szMax:1604,psfMid:1150,rMax:10000,units:168},
{n:'i-Zen Kiara 1',szMax:1407,psfMid:725,rMax:5500,units:302},
{n:'i-Zen Kiara 2',szMax:1701,psfMid:625,rMax:6500,units:238},
{n:'Kiara 1888',szMax:3982,psfMid:575,rMax:9000,units:182},
{n:'Kiara 9 Residency',szMax:2691,psfMid:750,rMax:15000,units:192},
{n:'Kiara Designer Suites',szMax:1600,psfMid:625,rMax:4500,units:324},
{n:'Kiaramas Ayuria',szMax:4000,psfMid:625,rMax:8000,units:480},
{n:'Kiaramas Cendana',szMax:4530,psfMid:700,rMax:8000,units:184},
{n:'Kiaramas Danai',szMax:2498,psfMid:850,rMax:10000,units:274},
{n:'Kiaramas Sutera',szMax:4100,psfMid:575,rMax:7000,units:315},
{n:'Kiaraville',szMax:3935,psfMid:750,rMax:15000,units:404},
{n:'La Grande Mont Kiara',szMax:2047,psfMid:575,rMax:6000,units:298},
{n:'Laman Suria Mont Kiara',szMax:1178,psfMid:625,rMax:5000,units:202},
{n:'Lanai Kiara',szMax:4300,psfMid:425,rMax:6000,units:181},
{n:'Lumina Kiara',szMax:3152,psfMid:650,rMax:15000,units:104},
{n:'Meridin Mont Kiara',szMax:2513,psfMid:575,rMax:8000,units:228},
{n:'OOAK Kiara 163',szMax:1016,psfMid:1250,rMax:9000,units:336},
{n:'Palma Mont Kiara',szMax:1390,psfMid:725,rMax:6000,units:402},
{n:'Pavilion Hilltop',szMax:3671,psfMid:1100,rMax:20000,units:621},
{n:'Pelangi Mont Kiara',szMax:1390,psfMid:625,rMax:6000,units:302},
{n:'Pentamont Mont Kiara',szMax:2125,psfMid:1000,rMax:15000,units:330},
{n:'Pines Mont Kiara',szMax:1428,psfMid:625,rMax:6000,units:508},
{n:'Residensi 22',szMax:3043,psfMid:1300,rMax:20000,units:534},
{n:'Residensi Sefina',szMax:1771,psfMid:825,rMax:8000,units:245},
{n:'Richmond Mont Kiara',szMax:2148,psfMid:375,rMax:4000,units:96},
{n:'Seni Mont Kiara',szMax:3531,psfMid:850,rMax:20000,units:605},
{n:'Solaris Dutamas (Publika)',szMax:1238,psfMid:875,rMax:6000,units:800},
{n:'Solaris Parq',szMax:1423,psfMid:1250,rMax:9000,units:576},
{n:'Sophia Mont Kiara',szMax:1386,psfMid:675,rMax:6000,units:238},
{n:'Sunway Mont',szMax:1906,psfMid:900,rMax:9000,units:288},
{n:'Sunway Vivaldi',szMax:3983,psfMid:875,rMax:20000,units:208},
{n:'Tiffani Kiara',szMax:3729,psfMid:750,rMax:12000,units:399},
{n:'TWY Mont Kiara',szMax:1385,psfMid:950,rMax:7000,units:484},
{n:'Verve Suites Mont Kiara',szMax:1394,psfMid:925,rMax:6000,units:933},
{n:'Vista Kiara',szMax:1410,psfMid:525,rMax:4500,units:409}
];

condos.forEach(c => { c.prMax = c.psfMid * c.szMax; });

const norm = (arr, inv) => {
  const mn = Math.min(...arr), mx = Math.max(...arr);
  return arr.map(v => inv ? 100*(1-(v-mn)/(mx-mn)) : 100*(v-mn)/(mx-mn));
};

const nSz = norm(condos.map(c=>c.szMax));
const nPsf = norm(condos.map(c=>c.psfMid));
const nRn = norm(condos.map(c=>c.rMax));
const nPr = norm(condos.map(c=>c.prMax));
const nEx = norm(condos.map(c=>c.units), true);

condos.forEach((c,i) => {
  c.lux = Math.round((nSz[i]*.25 + nPsf[i]*.20 + nRn[i]*.20 + nPr[i]*.20 + nEx[i]*.15)*10)/10;
});

condos.sort((a,b) => b.lux - a.lux);

console.log('');
console.log('MONT KIARA LUXURY INDEX (0-100)');
console.log('Weights: MaxSize 25% | SalePSF 20% | MaxRent 20% | MaxTotalPrice 20% | Exclusivity(fewer units) 15%');
console.log('='.repeat(120));
console.log('#   Name                            LUX  Tier   MaxSqft   PSF_RM   RentMax       PriceMax   Units');
console.log('-'.repeat(120));

condos.forEach((c,i) => {
  const t = c.lux>=75?'S':c.lux>=55?'A':c.lux>=35?'B':'C';
  const line = String(i+1).padEnd(4)
    + c.n.padEnd(32)
    + String(c.lux).padStart(5) + '  ' + t + '  '
    + String(c.szMax.toLocaleString()).padStart(8)
    + ('RM'+c.psfMid).padStart(9)
    + ('RM'+c.rMax.toLocaleString()).padStart(10)
    + ('RM'+c.prMax.toLocaleString()).padStart(15)
    + String(c.units).padStart(7);
  console.log(line);
});

console.log('');
console.log('=== TIER BREAKDOWN ===');
const tiers = [['S - Super Luxury',75,101],['A - Luxury',55,75],['B - Mid-Range',35,55],['C - Standard',0,35]];
tiers.forEach(([label,mn,mx]) => {
  const m = condos.filter(c => c.lux>=mn && c.lux<mx);
  console.log(`\n${label} (${m.length} properties):`);
  m.forEach(c => console.log(`  ${c.lux.toString().padStart(5)} - ${c.n}`));
});
