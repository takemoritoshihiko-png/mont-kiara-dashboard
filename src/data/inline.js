// Static reference data, extracted verbatim from the original index.html.
// Pure constants only — no DOM, no fetching.

// FIABCI Malaysia Property Award winners (2010-2025)
export const FIABCI_AWARDS = {
  '10 Mont Kiara (MK10)':          {year:2011, category:'High-Rise'},
  '28 Mont Kiara (MK28)':          {year:2012, category:'High-Rise'},
  'Seni Mont Kiara':               {year:2013, category:'High-Rise'},
  'Verve Suites Mont Kiara':       {year:2014, category:'High-Rise'},
  'Pentamont Mont Kiara':          {year:2024, category:'Housing Residential High-Rise'},
  'Solaris Parq':                  {year:2024, category:'Commercial Residential High-Rise'},
  'The Estate':                    {year:2023, category:'High-Rise'},
  'Dedaun':                        {year:2013, category:'Mid-Rise'},
  'U-Thant Residence':             {year:2012, category:'High-Rise'},
  'Setia V Residences':            {year:2022, category:'High-Rise'},
  'Infinity Beachfront':           {year:2011, category:'High-Rise'},
  'Springtide Residences':         {year:2010, category:'High-Rise'},
  'By The Sea':                    {year:2016, category:'Mid-Rise'},
  'Alila2':                        {year:2021, category:'High-Rise'},
  'One Tanjong':                   {year:2016, category:'High-Rise'},
  'Queens Residences Q1':          {year:2023, category:'Mid-Rise'},
  'i-Santorini':                   {year:2024, category:'Affordable Housing High-Rise'},
  'TreeO':                         {year:2025, category:'Affordable Housing Super High-Rise'}
};

// ============================================================
// PENANG SCHOOL FINDER DATA
// ============================================================
export const SF_SCHOOLS = [
  {key:'Uplands',    name:'Uplands',    curriculum:'IB (PYP/IGCSE/DP)',   maxLevel:'Y13', color:'#1565c0', students:'~520',     nat:37, lat:5.46998,lng:100.24947},
  {key:'Dalat',      name:'Dalat',      curriculum:'American',            maxLevel:'G12', color:'#e65100', students:'~735',     nat:25, lat:5.46661,lng:100.28982},
  {key:'POWIIS',     name:'POWIIS',     curriculum:'British (IGCSE/A-Lv)',maxLevel:'Y13', color:'#2e7d32', students:'~450',     nat:43, lat:5.45700,lng:100.27800},
  {key:'Stonyhurst', name:'Stonyhurst', curriculum:'British (IGCSE/A-Lv)',maxLevel:'Y13', color:'#7b1fa2', students:'~300+',    nat:33, lat:5.45999,lng:100.31005},
  {key:'Straits',    name:'Straits',    curriculum:'Cambridge',           maxLevel:'Y11', color:'#00838f', students:'N/A',      nat:17, lat:5.29759,lng:100.26780},
  {key:'Tenby',      name:'Tenby',      curriculum:'Cambridge IGCSE',     maxLevel:'Y11', color:'#bf360c', students:'~560',     nat:33, lat:5.45803,lng:100.28244},
  {key:'SCIPS',      name:'SCIPS',      curriculum:'British (IPC)',       maxLevel:'Y8',  color:'#f57f17', students:'~580',     nat:35, lat:5.42210,lng:100.31450},
  {key:'Pelita',     name:'Pelita',     curriculum:'Cambridge IGCSE',     maxLevel:'Y11', color:'#78909c', students:'~300',     nat:0,  lat:5.46530,lng:100.28430},
  {key:'Fairview',   name:'Fairview',   curriculum:'IB (PYP/MYP)',        maxLevel:'Y11*',color:'#c62828', students:'~300-500', nat:20, lat:5.34592,lng:100.27482}
];
export const SF_FEES = {
  Uplands:   {4:24800,5:30200,6:37200,7:44200,8:44200,9:53000,10:53000,11:68000,12:68000,13:68000,14:68000,15:68000,16:70800,17:70800},
  Dalat:     {3:21000,4:21000,5:26000,6:30500,7:30500,8:40500,9:40500,10:49800,11:49800,12:55500,13:55500,14:57200,15:57200,16:57200,17:57200},
  POWIIS:    {3:17040,4:21840,5:24570,6:24570,7:30900,8:30900,9:36570,10:36570,11:49500,12:49500,13:57720,14:59100,15:59100,16:62970,17:62970},
  Stonyhurst:{3:16500,4:18975,5:27468,6:27468,7:34335,8:34335,9:41202,10:41202,11:53424,12:53424,13:53424,14:56604,15:56604,16:57498,17:57498},
  Straits:   {3:14580,4:15660,5:19590,6:21630,7:23700,8:25770,9:26280,10:27840,11:29400,12:30450,13:31500,14:32010,15:32520},
  Tenby:     {3:14763,4:15000,5:20430,6:24609,7:29661,8:33009,9:38001,10:39810,11:43848,12:47562,13:50355,14:54594,15:84636},
  SCIPS:     {3:15000,4:17700,5:21300,6:21300,7:28200,8:28200,9:33000,10:33000,11:37200,12:37200},
  Pelita:    {3:9360,4:13110,5:15480,6:15480,7:19440,8:19440,9:21240,10:21240,11:25185,12:27600,13:30015,14:31050,15:33810},
  // age10(Year 6)は公表バンドが存在しない(PYP 4-5は8-9歳まで・次はMYP 1-3=11-13歳)ので
  // 載せない — 公表されていない学年の額を補間・外挿しない(CLAUDE.mdの絶対則)。
  Fairview:  {3:15000,4:15000,5:20000,6:25000,7:25000,8:32000,9:32000,11:38000,12:38000,13:38000,14:48000,15:48000} // 2026-08-07: age6/age8を公表実額(schools_detail)に整合(PYP1年ズレの修正)
};

// ============================================================
// DEVELOPER DATABASE & BRAND SCORING
// Sources: The Edge Top Property Developers Awards 2024, industry reputation
// ============================================================
export const DEVELOPERS = {
  // S-tier: Ultra premium brand recognition
  'Pavilion Group':       {tier:'S', score:100, note:'Pavilion KL Mall developer, ultra-luxury brand'},
  // A-tier: Top national developers with strong luxury track record
  'UEM Sunrise':          {tier:'A', score:80, note:'Top 8 nationally, dominant Mont Kiara developer (fka Sunrise)'},
  'Sunway Property':      {tier:'A', score:80, note:'Top 2-3 nationally, integrated conglomerate'},
  'Bukit Kiara Properties':{tier:'A',score:80, note:'Dato Alan Tong, iconic Mont Kiara pioneer'},
  // B-tier: Established reputable developers
  'Tropicana':            {tier:'B', score:60, note:'Top 10, premium locations focus'},
  'Mah Sing':             {tier:'B', score:60, note:'Top 7 nationally'},
  'Asia Quest':           {tier:'B', score:55, note:'Kiaramas series specialist'},
  'Ireka':                {tier:'B', score:55, note:'i-Zen & Tiffani series'},
  'Naza TTDI':            {tier:'B', score:55, note:'OOAK/Kiara 163 developer'},
  'OSK Property':         {tier:'B', score:55, note:'Established mid-luxury'},
  'Trinity Group':        {tier:'B', score:50, note:'Pentamont developer'},
  'Bolton':               {tier:'B', score:50, note:'Kiara 1888 developer'},
  'Mitrajaya':            {tier:'B', score:50, note:'Kiara 9 developer'},
  // A-tier: Desa ParkCity master developer + CapitaLand JV
  'ParkCity & CapitaLand':{tier:'A', score:85, note:'Perdana ParkCity + CapitaLand Singapore JV, premium brand'},
  'Perdana ParkCity':     {tier:'A', score:80, note:'Desa ParkCity master developer (Samling Group)'},
  // B-tier: Reputable national developer
  'Kerjaya Prospek':      {tier:'B', score:55, note:'Papyrus developer, established builder'},
  'BRDB':                 {tier:'B', score:60, note:'Miranda Hill developer, established luxury'},
  'Bon Estates':          {tier:'B', score:55, note:'Bon Kiara developer'},
  'Bon Estates (Land Marker)':{tier:'B', score:55, note:'Bon Kiara developer'},
  'WCT Land':             {tier:'A', score:75, note:'Pavilion Mont Kiara developer'},
  'WCT Land (Pavilion Group)':{tier:'A', score:75, note:'Pavilion Mont Kiara developer'},
  // A-tier: Bangsar premium developers
  'Bandar Raya Developments':{tier:'A',score:80, note:'One Menerung, Serai, Sri Penaga developer'},
  'Ken Holdings':         {tier:'A', score:75, note:'Ken Bangsar developer, luxury brand'},
  'Hap Seng Land':        {tier:'A', score:75, note:'Nadi Bangsar developer'},
  'Bolton':               {tier:'B', score:55, note:'Bangsar Peak developer'},
  'UDA':                  {tier:'B', score:55, note:'Residensi 38 Bangsar developer'},
  'UM Land':              {tier:'B', score:50, note:'Suasana Bangsar developer'},
  // C-tier: Smaller/foreign developers
  'Agile':                {tier:'C', score:40, note:'Major Chinese developer, less local luxury recognition'},
  'Arte Corp':            {tier:'C', score:35, note:'Arte Mont Kiara developer'},
  // A-tier: KLGCC Resort master developer
  'Sime Darby Property':  {tier:'A', score:80, note:'KLGCC Resort master developer, top 5 nationally'},
  // A-tier: KLCC / Ampang / Damansara Heights developers
  'KLCC Property Holdings':{tier:'A', score:85, note:'Petronas subsidiary, The Binjai developer'},
  'GuocoLand (Hong Leong Group)':{tier:'A', score:80, note:'The Oval KLCC developer'},
  'Hong Leong Group':     {tier:'A', score:75, note:'3 Kia Peng developer'},
  'Wing Tai Malaysia':    {tier:'A', score:75, note:'Le Nouvel KLCC developer'},
  'Tan & Tan (IGB)':      {tier:'A', score:80, note:'IGB Bhd, Cendana/U-Thant/Stonor 3 developer'},
  'Tan & Tan / Mitsubishi Jisho':{tier:'A', score:70, note:'Stonor 3 JV developer'},
  'CMY Capital':          {tier:'B', score:60, note:'One KL developer'},
  'Berjaya Corp':         {tier:'B', score:60, note:'Ritz-Carlton Residences KL developer'},
  'Venus Assets':         {tier:'B', score:60, note:'Four Seasons Place developer'},
  'KSK Land':             {tier:'B', score:50, note:'8 Conlay (YOO8) developer'},
  'MRCB':                 {tier:'B', score:60, note:'St Regis Residences, national infra developer'},
  'Selangor Dredging Bhd (SDB)':{tier:'B', score:60, note:'Dedaun, luxury boutique developer'},
  'Beverly Group':        {tier:'C', score:40, note:'Marc Residences KLCC developer'},
  'Magna Prima':          {tier:'C', score:40, note:'The Avare KLCC developer'},
  'Glomac Bhd':           {tier:'B', score:60, note:'Suria Stonor developer'},
  'Prinaissance':         {tier:'C', score:40, note:'Gallery U-Thant developer'},
  'Amphil Corp':          {tier:'B', score:50, note:'Rimbun Embassy Row developer'},
  'Revival Capital':      {tier:'C', score:40, note:'Residensi R8 developer'},
  'Clearwater Development':{tier:'C', score:40, note:'Clearwater Residences developer'},
  'Selangor Properties':  {tier:'B', score:60, note:'AIRA Residence developer'},
  'E&O / Mitsui Fudosan': {tier:'A', score:85, note:'The Peak DH, E&O + Mitsui Fudosan JV'},
  'Satin Magic':          {tier:'C', score:40, note:'The Cedar DH developer'},
  'SP Setia':             {tier:'A', score:85, note:'Top 1 nationally, Setia Sky Seputeh developer'},
  'Avaland':              {tier:'B', score:55, note:'Aetas Seputeh developer (Ayala Land subsidiary)'},
  'Mammoth Empire Holdings':{tier:'C', score:30, note:'The Luxe developer'},
  'Other':                {tier:'C', score:30, note:'Various smaller developers'}
};

// ============================================================
// YEAR COLOR SCALE (new=blue, old=amber/brown)
// ============================================================
export const YEAR_MIN = 1993, YEAR_MAX = 2026;
export const YEAR_COLORS = ['#8d6e63','#bcaaa4','#90a4ae','#64b5f6','#1565c0']; // brown->blue

export const TIER_COLORS = {S:'#7b1fa2',A:'#1565c0',B:'#2e7d32',C:'#78909c',D:'#bdbdbd'};

// ============================================================
// MICHELIN wording (dining layer)
// The ledger stores an enum ('2star' | '1star' | 'bib' | 'sel' | 'none'); these
// are the only two places it is turned into Japanese. They live here — the
// shared constants file — because the card, the map marker's accessible label
// and the detail panel all need them, and the wording must be identical in all
// three. The long form is the guide's own vocabulary, as used in ledger v9.
// ============================================================
/** Short form, for a card chip and a marker label. 'none' has no badge. */
export const MICHELIN_BADGES = {'2star':'二つ星','1star':'一つ星',bib:'ビブ',sel:'掲載店'};
/** Long form, for the detail panel — including what 'none' means. */
export const MICHELIN_LABELS = {'2star':'二つ星','1star':'一つ星',bib:'ビブグルマン',sel:'掲載店',none:'掲載なし'};
