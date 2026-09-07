/* Ya Ke atlas: curated from the author's supplied worldbuilding and five
 * reference sheets. Distances are source values, phases are display choices.
 * No settlement coordinates or orbital elements are inferred from artwork.
 * Conflicting values are preserved in notes rather than reconciled silently. */
window.YAKE_ATLAS = {
  // Presentation only: preserve source counts while rounding small populations.
  summaryStats(world) {
    return (world.stats || []).slice(0,4).map(([label,value]) => [label,
      /population|residents/i.test(label) ? value.replace(/[\d,]+(?:\.\d+)?\s*(million|M|thousand|k)?\b/gi, (match,unit) => {
        const count=parseFloat(match.replace(/,/g,''))*(/^(million|m)$/i.test(unit||'')?1e6:/^(thousand|k)$/i.test(unit||'')?1e3:1);
        return count<1e6 ? (Math.round(count/500)/2).toLocaleString('en-US',{maximumFractionDigits:1})+' thousand' : match;
      }) : value]);
  },
  worlds: [
    {id:'yake', name:'Ya Ke / 野雞', no:'02', kind:'K-type giant · system primary', color:'#edc575',
      intro:'The political heart of the Spanning Worlds Independence, connected to Sol by long journeys and comparatively economical burns.',
      stats:[['Catalog identity','Nu² Canis Majoris'],['System extent','152 AU charted'],['Population in system notes','579.4 million']],
      paragraphs:['Low relative velocity made Ya Ke attractive after the advent of the ERR-AL drive. The time cost of travel helped local government remain fiercely independent, while relatively low propellant costs sustained the exchange of goods, resources, and culture.','The populated system runs from the industrial moons of Jin and Shu to oceanic Celosia and the far-flung trans-Celosian settlements.'],
      notes:['The quoted system population conflicts with the local populations below; these records are not an additive census. Supplied position: {47.359, −13.1765, −41.6169}; coordinate frame and units were not specified.'],
      related:['celosia','jin','shu','gullinkambi','chanticleer','xuan','five','kukkuta']},
    {id:'jin', name:'Jin / 金', no:'02', kind:'Gas giant · food & helium economy', parent:'yake', au:1.78, color:'#d5bd7f',
      intro:'An industrial giant surrounded by inhabited moons, helium extraction sites, and agricultural stations.',
      stats:[['Orbit','1.78 AU'],['Population','19.37M + 4.65M in orbit'],['Exclusion zone','1,560,000 km'],['Eccentricity','0.14'],['Mass, primary value','1.895 Jupiter masses'],['Radius, primary value','12.1 Earth radii']],
      paragraphs:['Outside the deadly radiation belts, Jin’s magnetic field provides shielding from galactic cosmic rays. Farming communes support the industrial settlements; food is Jin’s principal export within the system.','The reference sheet lists 79 moons, seven of them primary. Prata is heavily irradiated and uninhabited. Vas, Skarda, and Plomo hold most of the moon population.'],
      notes:['The notes also give 3.2 Jupiter masses and 14.4 Earth radii in parentheses. These alternatives are retained here rather than used to derive periods.'],
      image:'jin-reference.png', imageLabel:'Moons of Jin reference sheet',
      related:['prata','kobber','vas','skarda','plomo','suseong','peng','dajinmen','marassa','fengsheng']},
    {id:'shu', name:'Shu / 水', no:'03', kind:'Gas giant · industrial ocean moons', parent:'yake', au:2.142, color:'#a4b9e3',
      intro:'Jin’s 4:3 resonant companion, with volcanic moons, cryovolcanic oceans, and chemical industries.',
      stats:[['Orbit','2.142 AU'],['Eccentricity','0.046'],['Mass','0.906 Jupiter masses'],['Radius','10.8 Earth radii'],['Exclusion zone','1,599,180 km'],['Population in heading','1.136M + 1.764M in orbit']],
      paragraphs:['The four major moons range from Io-like Jouki to the outer frozen world Buz. Pani’s seas supply sulfur, battery metals, chemical feedstock, and research into high-temperature, saline, acidic environments.'],
      notes:['Population needs reconciliation: Buz is separately assigned 3.079 million, exceeding Shu’s heading total. Another sentence assigns 3.079 million to smaller moons. DTO is listed at 0.336 million without a clear accounting boundary.'],
      related:['jouki','mizu','pani','buz']},
    {id:'celosia', name:'Celosia', no:'01', kind:'Ocean world · SWI capital', parent:'yake', au:6.13, color:'#6fc6d5', art:'celosia',
      intro:'Three inhabited continents, a cold blue ocean, and the political capital of the Spanning Worlds Independence.',
      stats:[['Orbit, provisional','6.13 AU'],['Surface population','520.64 million'],['Orbital population','17.36 million'],['Gravity','0.890 g₀'],['Radius','0.942 Earth radii'],['Exclusion zone','22,354 km'],['Atmosphere','138 kPa'],['Oxygen partial pressure','12.6 kPa at sea level'],['Inclination','4.78°']],
      paragraphs:['Settlement is concentrated around Tiantang’s cosmodrome, although all three continents carry significant population. Cold temperatures, reduced gravity, and low oxygen partial pressure shape daily life and the experience of interstellar arrivals.','The supplied continental mean temperatures are approximately 7–9°C, with seasonal conditions ranging from −8 to 32°C. Celosia has abundant water, relatively few metals, and a weak magnetic field.'],
      places:[['Fusang','Arctic in the north; Tiantang is cold but arable. The humid south resembles coastal California in temperature.'],['Mu','Northern climate compared to Busan; the south is an intense desert. Its major city is also named Mu.'],['Diyu','Climate compared to northern Mu and southern Fusang. Its major city is also named Diyu.'],['Tiantang','Sprawling major population center, home to most of Celosia’s population.'],['Yushan City','At the foot of Yushan Mons on Fusang, closer to Tiantang than Penglai.'],['Penglai','Fifth-largest city, deep in Fusang’s interior at the foot of Penglai Mons.']],
      notes:['The source gives “6.13 (4.55 AU)”; this chart provisionally uses 6.13 AU. UV notes contain differing comparisons and atmospheric assumptions, so no single exposure index is assigned. The 138 kPa atmosphere is high in total pressure but low in oxygen partial pressure.'],
      image:'celosia-reference.png', imageLabel:'Celosia atmosphere and world reference', related:['celosia-hubs']},
    {id:'xuan', name:'Xuan / 玄', no:'04', kind:'Ice giant · outer-system anchor', parent:'yake', au:67.4, color:'#a6d0e0', art:'xuan',
      intro:'An ice giant anchoring the resonant architecture of the outer system.',
      stats:[['Orbit','67.4 AU'],['Period','~553 standard years'],['Mass','16.7 Earth masses'],['Population','0.7744 million'],['Exclusion zone','237,000 km']],
      paragraphs:['Gullinkambi and Chanticleer occupy the inner 3:2 resonance region, while Five Islands lies in the outer 3:2 resonance. The largest moon, Kaʻauhelemoa, supports atmospheric collection operations at Xuan.'],
      image:'xuan-reference.png', imageLabel:'Xuan reference sheet', related:['kaau','gullinkambi','chanticleer','five']},
    {id:'gullinkambi', name:'Gullinkambi', no:'05', kind:'Outer world · the Golden Comb', parent:'yake', au:51.4, color:'#edc575', art:'gullinkambi',
      intro:'A comb of rust and gold: part ore body, part four-billion-year time machine.',
      stats:[['Orbit','51.4 AU'],['Population','108.4 thousand'],['Resonance','Inner 3:2 with Xuan'],['Spin-hab clearance','300+ km from the Comb']],
      paragraphs:['The Golden Comb — 金冠, Jīnguān — records episodic eruptions from a slowly freezing brine ocean. A tidally fixed fissure province built thick sequences of hydrothermal sediment, punctuated by million-year gaps.','Iron-rich brines weathered into golden ochre while colloidal gold precipitated into the fresh rust. The province grades from dark, active vents to ancient golden deposits. Its informal mineral name is yakeite.','Water fields, chemical feedstocks, iron and sulfur mines, copper–zinc–cobalt–nickel districts, and precious metals support the local economy. Gullinkambi is neutral ground between hive and non-hive trans-Celosian cultures.'],
      places:[['The Golden Comb / 金冠','Goethite–akaganeite ochre, native gold nanoparticles, sulfides, ice, and ancient refractory material.'],['Spin habitats','100 km radius; 991 m/s; 0.095 RPM. Sixteen trains made of 2, 3, and 5 km cars. The quoted volume supports 11.4816 million people at 250 m³/person.']],
      image:'gullinkambi-reference.png', imageLabel:'Golden Comb geology and landscape reference', related:['chanticleer','xuan']},
    {id:'chanticleer', name:'Chanticleer', no:'06', kind:'Outer world · resonant counterpart', parent:'yake', au:51.4, color:'#bf9ddb',
      intro:'Across the orbit from Gullinkambi, in the same inner resonance with Xuan.',
      stats:[['Orbit','51.4 AU'],['Population','105.2 thousand'],['Resonance','Inner 3:2 with Xuan']],
      paragraphs:['The supplied system layout places Chanticleer opposite Gullinkambi. Their opposing placement is preserved in the overview; the absolute orbital phase is schematic.'], related:['gullinkambi','xuan']},
    {id:'five', name:'Five Islands', no:'07', kind:'Hierarchical quintuple', parent:'yake', au:88.3, color:'#81b5ac',
      intro:'Mun is the central body, with two tight binary pairs: In–Sin and Mu–Yong. The assembly orbits Ya Ke as one compact unit.',
      stats:[['Orbit','88.3 AU'],['Population','112 thousand'],['Binary barycenter periods','2:3 resonance'],['System orbit','Outer 3:2 with Xuan']],
      paragraphs:['The first known natural hierarchical binary resonance. Internal separations, orbital phases, and individual population shares are unspecified; the chart shows schematic spacing.'],
      places:[['0701 / Mun','Five Islands member'],['0702 / In','Five Islands member'],['0703 / Sin','Five Islands member'],['0704 / Mu','Five Islands member; distinct from Celosia’s continent Mu.'],['0705 / Yong','Five Islands member']], related:['mun','in','sin','island-mu','yong','xuan']},
    {id:'mun', name:'Mun', no:'0701', kind:'Five Islands · central body', parent:'five', color:'#b9c4a5', radiusKm:1611, massKg:3.68e22, density:2.1, intro:'The central and largest body of the hierarchical quintuple.', stats:[['Radius','1,611 km'],['Mass','3.68 × 10²² kg'],['Density','2.1 g/cm³'],['Escape speed','1.746 km/s']], related:['five','in','sin','island-mu','yong']},
    {id:'in', name:'In', no:'0702', kind:'Five Islands · In–Sin binary', parent:'five', color:'#9eadaf', radiusKm:1068, massKg:9.19e21, density:1.8, intro:'An intermittently venting world in the tight In–Sin binary.', stats:[['Radius','1,068 km'],['Mass','9.19 × 10²¹ kg'],['Density','1.8 g/cm³'],['Escape speed','1.072 km/s']], related:['five','sin']},
    {id:'sin', name:'Sin', no:'0703', kind:'Five Islands · In–Sin binary', parent:'five', color:'#b9a7b5', radiusKm:1049, massKg:9.19e21, density:1.9, intro:'Smooth plains and frost cycles mark In’s binary companion.', stats:[['Radius','1,049 km'],['Mass','9.19 × 10²¹ kg'],['Density','1.9 g/cm³'],['Escape speed','1.081 km/s']], related:['five','in']},
    {id:'island-mu', name:'Mu', no:'0704', kind:'Five Islands · Mu–Yong binary', parent:'five', color:'#a2b3c5', radiusKm:1031, massKg:9.19e21, density:2.0, intro:'Yong’s binary companion and the reference body for CTHS; distinct from Celosia’s Mu.', stats:[['Radius','1,031 km'],['Mass','9.19 × 10²¹ kg'],['Density','2.0 g/cm³'],['Escape speed','1.091 km/s']], related:['five','yong']},
    {id:'yong', name:'Yong', no:'0705', kind:'Five Islands · Mu–Yong binary', parent:'five', color:'#e4ebef', radiusKm:999, massKg:9.19e21, density:2.2, intro:'Crystalline water-ice plains give Yong the highest albedo of the Five Islands.', stats:[['Radius','999 km'],['Mass','9.19 × 10²¹ kg'],['Density','2.2 g/cm³'],['Escape speed','1.108 km/s']], related:['five','island-mu']},
    {id:'kukkuta', name:'Kukkuta', no:'08', kind:'Far outer world', parent:'yake', au:152, color:'#c1abc9',
      intro:'The most distant named destination in this chart.',
      stats:[['Orbit','152 AU'],['Population','20 thousand']], paragraphs:['Kukkuta extends the inhabited system well beyond Five Islands. Further physical and settlement details have not yet been supplied.'], related:['five']},
    {id:'prata', name:'Prata', kind:'Jin moon · silver', parent:'jin', km:256389, color:'#b9bec5',
      intro:'Jin’s innermost named moon, inside the exclusion zone and exposed to severe radiation.', stats:[['Orbit around Jin','256,389 km'],['Surface habitation','Uninhabited']], paragraphs:['The Jin reference identifies Prata as the exception among its primary moons: its radiation environment prevents settlement.']},
    {id:'kobber', name:'Kobber', kind:'Jin moon · copper', parent:'jin', km:1052112, color:'#bf8b68',
      intro:'A copper-named moon inside Jin’s exclusion boundary.', stats:[['Orbit around Jin','1,052,112 km'],['Population','~0.576 million']], paragraphs:['Detailed settlement locations are not supplied.']},
    {id:'vas', name:'Vas', kind:'Jin moon · iron', parent:'jin', km:1413613, color:'#e0c892',
      intro:'A major inhabited moon with low gravity and two named cosmodromes.',
      stats:[['Orbit around Jin','1,413,613 km'],['Surface population','7.30 million'],['Orbital population','1.75 million'],['Gravity','0.34 g₀'],['Radius','2,432.96 km'],['Mass','2.95999 × 10²³ kg']],
      places:[['Vas Central Cosmodrome','Surface port; coordinates not supplied.'],['Infernis Planitia Cosmodrome','Surface port; coordinates not supplied.']],
      paragraphs:['The flight notes give an approximately 25-minute transfer to a 400 km orbit, with 2.955 km/s delta-v and a 112.38-minute low-orbit period. These are source mission figures, not dynamically computed routes.'], related:['fengsheng','jin']},
    {id:'skarda', name:'Skarda', kind:'Jin moon · tin', parent:'jin', km:2836675, color:'#85becb',
      intro:'Blue plains, crowded celariums, and cosmodromes serving Jin’s agricultural economy.',
      stats:[['Orbit around Jin','2,836,675 km'],['Surface population','8.52 million'],['Orbital population','2.05 million'],['Gravity','0.26 g₀'],['Radius','~2,235 km'],['Daylight interval','~9 standard days']],
      paragraphs:['Tidally locked to Jin, Skarda has a long surface daylight interval. Its major celariums combine stacked agricultural space, compact housing, and port infrastructure. Stars below mark settlements identified as having cosmodromes in the notes.'],
      places:[['Lapis Arco Lazuli ★','Lapis Lazuli Planitia · 1,356,000'],['Azure Arcbeam / Babel Azure Lazuli Portu','Lapis Lazuli Planitia · 721,668; a separate 65,000 figure is also listed.'],['Cobalt Fons Bokee Doti','626,211'],['Tey Jinchang ★','622,149'],['Baire Stonebow / Jinshu Lacus','Baire Valles · 605,901'],['Baire Obodo','Baire Valles · 557,109'],['Baire Arco Posadkea Fastigium','Baire Valles · 614,464'],['Nova Chuanwu ★','512,054'],['Dichu Arcolective / Hong Silva','Baire Planum · 482,344'],['Arckibuz Silva Diban Insula','Baire Planum · 464,318'],['Heise Nix','Heise Mons · 426,628'],['Portu Grond Nuevo Arcadia ★','Kobber Planitia · 414,080'],['Unnamed Celarium 2 / Cobalt Fons','394,451']],
      related:['marassa','jin']},
    {id:'plomo', name:'Plomo', kind:'Jin moon · lead', parent:'jin', color:'#b5a2ad',
      intro:'One of Jin’s three principal inhabited moons.', stats:[['Population in notes','1.82182 million'],['Orbital population, sheet','0.39 million'],['Gravity, sheet','0.21 g₀']],
      places:[['Anchuan Hefushe','Cosmodrome'],['Arco Sweet Water','Cosmodrome'],['Bul Agua Arcbeam','Cosmodrome']], notes:['Orbital radius not supplied; placement in the moon view is schematic.']},
    {id:'suseong', name:'Suseong', kind:'Jin moon · mercury', parent:'jin', color:'#b1b5bf', intro:'One of Jin’s seven primary moons.', stats:[['Population','~0.5 million']], notes:['Orbital radius not supplied.']},
    {id:'peng', name:'Peng', kind:'Jin moon · boron', parent:'jin', color:'#c2a58b', intro:'One of Jin’s seven primary moons.', stats:[['Population','~0.5 million']], notes:['Orbital radius not supplied.']},
    {id:'jouki', name:'Jouki', kind:'Shu moon · steam', parent:'shu', km:408000, color:'#d98c6c', intro:'A hostile, Io-like world deep inside Shu’s exclusion zone.', stats:[['Orbit around Shu','408,000 km'],['Mass','0.655 Titan masses'],['Atmospheric pressure','100 Pa']], paragraphs:['The supplied atmosphere is roughly 70% sulfur dioxide, 20% sodium, and 10% potassium.']},
    {id:'mizu', name:'Mizu', kind:'Shu moon · water', parent:'shu', km:649000, color:'#94c6d6', intro:'A cryovolcanic moon with a substantial subsurface ocean and lethal radiation zones.', stats:[['Orbit around Shu','649,000 km'],['Mass','0.352 Titan masses'],['Atmospheric pressure','1 kPa']], paragraphs:['Albedo 0.7. The supplied atmosphere is 95% carbon dioxide and 2.7% nitrogen.']},
    {id:'pani', name:'Pani', kind:'Shu moon · industrial seas', parent:'shu', km:1036000, color:'#5cbbb4', intro:'Dark teal seas under a peach sky: hot brines, mineral extraction, and extremophile research.',
      stats:[['Orbit around Shu','1,036,000 km'],['Population','~780,150'],['Atmospheric pressure','95 kPa'],['Ocean temperature','330–360 K (57–87°C)'],['Mass','1.087 Titan masses'],['Gravity','0.14 g₀']],
      atmosphere:{pressureKPa:95,composition:[['N₂',75],['CO₂',15],['H₂O vapor',4],['SO₂',3],['Methanol',2],['Formaldehyde',1]],sky:'Reddish-orange / peach with pastel clouds'},
      paragraphs:['About 85% of residents live in Eosphora; the notes also list roughly 150,000 CADSS without a defined accounting boundary. Water, methanol, formaldehyde, dissolved gases, salts, and minerals form a chemically complex ocean averaging 3.739 km deep.','Sulfur mining, deep-sea lithium, cobalt and rare-earth extraction, methane harvesting, and brine processing support the industrial economy.'],
      places:[['Eosphora','Principal city'],['The Caustic Expanse','Largest sea'],['The Phlegethon Deep','Deep basin'],['Mare Tenebris · The Viridian Void · The Lethe Basin','Major seas'],['The Mephitic Gulf · Charybdis Sound · The Stygian Shoals','Gulfs and shallows'],['The Mordant Mere · Thanatos Reach','Smaller waters']], related:['shu']},
    {id:'buz', name:'Buz', kind:'Shu moon · frozen outer world', parent:'shu', km:1821760, color:'#c4d4df', intro:'A frozen moon beyond Shu’s exclusion boundary.', stats:[['Orbit around Shu','1,821,760 km'],['Mass','0.280 Titan masses'],['Atmospheric pressure','100 Pa']], paragraphs:['The supplied atmosphere is 70% nitrogen, 25% methane, and 5% carbon monoxide.'], notes:['The 3.079 million population appears both beside Buz and in a description of smaller moons; it is not assigned as a settled Buz census.'], related:['shu']},
    {id:'kaau', name:'Kaʻauhelemoa', no:'0401', kind:'Xuan’s largest moon', parent:'xuan', km:275888, color:'#b9c9d7',
      intro:'A base for helium-skimming missions to the nearby ice giant.', stats:[['Orbit around Xuan','275,888 km'],['Mass','~2.26 × 10²² kg'],['Skim round-trip Δv','2.83 km/s']],
      paragraphs:['A collection mission leaves the orbital station, coasts 6–8 hours to atmospheric interface, makes a 20–30-minute high-speed collection pass, burns at periapsis, and coasts 6–8 hours home.'], image:'kaau-reference.png', imageLabel:'Kaʻauhelemoa mission and world reference', related:['xuan']},
    {id:'dajinmen', name:'Dajinmen Ring', mapLabel:'K-stations', kind:'Jin–Ya Ke L5 · arrival control', parent:'jin', color:'#edc575',
      intro:'The Great Golden Gate Ring: home to Domot Get Grond Dey near the K-station network.',
      stats:[['Location','Jin–Ya Ke L5'],['Arrival-only zone','1,000 km diameter'],['Primary control spaces','6']],
      paragraphs:['The arrival control volume is described from the center looking outward. Only arrivals may enter the no-go zone. Dajinmen is distinct from Dadanshui, the Great Plain Water Ring.'], related:['jin','marassa']},
    {id:'marassa', name:'Horizon’s Edge', kind:'Marassa Jumeaux · twin Stanford toruses', parent:'jin', color:'#c6a2d5',
      intro:'Two coaxial, counter-rotating Stanford toruses joined through bearing hubs by a non-rotating spine: Buka grows the food; Chawkee makes, repairs, and trades.',
      stats:[['Usual population','~60,000 (both rings)'],['Weekly visitor population (est.)','~10,000 (station-wide)'],['Hoop radius','1,492 m'],['Gravity','1 g₀'],['Structure radius','122 m'],['Volume per ring','5.48 × 10⁷ m³'],['Location','Just outside Jin’s exclusion zone'],['Jin EZ radius','1,560,000 km']],
      paragraphs:['Horizon’s Edge sits just outside Jin’s exclusion boundary.','The rings share a working ecology of agriculture, cargo handling, chemical industry, transport, and public space. Nearby Jin Orbitguard stations, smaller habitat pods, and temporary orbital stays become especially strained when interstellar traffic is ordered to shelter in place. During Ergo, nearly 20,000 people are in orbit nearby.'], notes:['The station’s exact orbital radius and angular position are unspecified; its clearance from the EZ is schematic.'], related:['buka','chawkee','skarda']},
    {id:'buka', name:'Buka / Primus', kind:'Marassa Jumeaux · agricultural ring', parent:'marassa', color:'#85c7a3',
      intro:'Stacked farms and open landscapes around Central City, with Antipode on the far side of the ring.', stats:[['Usual population','~5,000'],['Permanent residents','~3,200'],['Food production','~100,000 people/day']],
      paragraphs:['Twelve agricultural stories and a vertical farming multiplier of roughly 55 support rice, herbs, wheat, yams, and other crops. Most residents live in Central City, with smaller automated cargo and processing hubs elsewhere on the ring.','After A Mote in Shadow, temporary housing fills about half the park space. Courtyard cargo-container stacks house roughly 550 people and another 200 shelter in the surrounding fields. Antipode, informally Circle’s End, becomes a focal point of unrest.'],
      places:[['Central City','Main habitat, manufacturing cargo, and docking complex; approximately 3,000 residents.'],['Antipode / Circle’s End','Settlement opposite Central City.']], related:['marassa','chawkee']},
    {id:'chawkee', name:'Chawkee / Secundus', kind:'Marassa Jumeaux · industrial ring', parent:'marassa', color:'#9bafe1',
      intro:'An industrial and cultural ring organized around the Central Gap market.', stats:[['Usual population','~55,000'],['Weekly visitor population (est.)','~10,000 (station-wide)'],['Transport layers','People / goods']],
      paragraphs:['Housing, manufacturing, and chemical facilities fill much of the ring volume. High-speed transport layers connect to recycling, utilities, eight vertical transport spaces, and dry docks.','Population initially doubles during the disruption after A Mote in Shadow, then settles into a new, still elevated normal.'], related:['marassa','buka']},
    {id:'fengsheng', name:'Fengsheng', hidden:true, kind:'Jin system · weather station', parent:'jin', color:'#a4c9c2', intro:'A weather station in a polar orbit inside Jin’s exclusion zone; not a K-station.', stats:[['Orbit type','Polar'],['Location','Inside Jin’s exclusion zone'],['Orbital period','6 days 2 hours'],['Flyby interval','~3 days 1 hour'],['Flyby distance','51,200 km']], notes:['Not plotted. Exact orbital radius and phase are unspecified; the period and flyby figures are retained from the earlier notes.'], related:['vas']},
    {id:'dto', name:'DTO', hidden:true, kind:'Shu system · hive', parent:'shu', color:'#b6b5df', intro:'Day Tey-hab gah Obstaw get Grond Dey.', stats:[['Population in notes','0.336 million']], notes:['Exact orbit and relationship to Shu’s aggregate orbital census are unspecified.'], related:['shu']},
    {id:'celosia-hubs', name:'Celosia L4 / L5', mapLabel:'K-stations', kind:'URAL hub network', parent:'celosia', color:'#76b8c7', intro:'Orbital hubs in the Celosia–Ya Ke Lagrange neighborhoods.', paragraphs:['The source assigns 2.71 million people collectively to URAL hubs around Jin and Celosia. No split between individual L4/L5 locations is supplied.'], related:['celosia','dajinmen']},
    {id:'minor', name:'Small-body settlements', kind:'Asteroids · trojans · planetesimals', parent:'yake', color:'#9fa8b7', intro:'Dispersed communities between the named worlds.', stats:[['Planetesimals','0.4356 million'],['Other small bodies, quoted','1.21 million']], paragraphs:['The notes mention asteroids, trojans, and trans-Celosian objects. The accounting relationship between the planetesimal and small-body figures is unspecified; no individual orbits are plotted.']}
  ],
  // Short public additions only; do not expose the draft narrative wholesale.
  cardDetails: {
    jin:'Food is Jin’s principal system export. Beyond the radiation belts, farming communes benefit from its magnetic shielding against galactic cosmic rays.',
    shu:'Pani’s seas supply sulfur, battery metals, and chemical feedstocks; Jouki is volcanic, Mizu cryovolcanic, and Buz frozen.',
    celosia:'Most residents live in sprawling Tiantang on Fusang. The cities Mu and Diyu are each about the size of Yushan City; Penglai is the fifth-largest city.',
    xuan:'Kaʻauhelemoa is its largest moon. Gullinkambi and Chanticleer occupy the inner resonance region; Five Islands lies beyond Xuan.',
    gullinkambi:'The Golden Comb (金冠, Jīnguān) records brine eruptions, iron-rich ochre, and precipitated gold. Gullinkambi is neutral ground between hive and non-hive cultures.',
    chanticleer:'Chanticleer and Gullinkambi occupy opposite sides of their shared orbital region.',
    five:'The two binary barycenters are locked in a 2:3 mean-motion resonance: the first known natural hierarchical binary resonance.',
    mun:'Composition: 60% rocky core, 35% H₂O, and 5% CH₄/N₂.',
    in:'The In–Sin and Mu–Yong barycenters share a 2:3 mean-motion resonance around Mun.',
    sin:'The In–Sin and Mu–Yong barycenters share a 2:3 mean-motion resonance around Mun.',
    'island-mu':'A thin N₂/CH₄ atmosphere has a pressure of 0.1–3 mbar.',
    yong:'Mu and Yong form one of the two tight binary pairs around Mun.',
    kukkuta:'At 152 AU, Kukkuta lies beyond both Xuan and Five Islands.',
    prata:'Its severe radiation environment prevents surface habitation.',
    kobber:'Kobber orbits inward of Vas; both lie inside Jin’s exclusion zone.',
    vas:'Vas lies inside Jin’s 1,560,000 km exclusion boundary. Its low gravity supports surface-to-orbit traffic.',
    skarda:'Its celariums combine stacked agriculture, housing, and ports. A tidally locked rotation gives roughly nine standard days from sunrise to sunset.',
    plomo:'Plomo lies farther from Jin than Skarda. Its exact orbital radius is unspecified.',
    suseong:'Suseong lies farther out than Skarda; its exact orbital radius is unspecified.',
    peng:'Peng lies farther out than Skarda; its exact orbital radius is unspecified.',
    jouki:'Its thin atmosphere is approximately 70% sulfur dioxide, 20% sodium, and 10% potassium.',
    mizu:'A reflective icy surface overlies a substantial ocean. Its thin atmosphere is predominantly carbon dioxide.',
    pani:'Atmosphere: 75% N₂, 15% CO₂, 4% water vapor, 3% SO₂, 2% methanol, 1% formaldehyde. About 85% of residents live in Eosphora, beside hot chemical seas averaging 3.739 km deep.',
    buz:'Its thin atmosphere is approximately 70% nitrogen, 25% methane, and 5% carbon monoxide.',
    kaau:'Collection flights coast 6–8 hours each way, with a 20–30-minute atmospheric pass at Xuan.',
    dajinmen:'Only arrivals may enter the control zone. Dajinmen is distinct from Dadanshui, the Great Plain Water Ring.',
    marassa:'Just outside Jin’s exclusion zone, inward of Skarda. Select either torus to inspect Buka or Chawkee individually.',
    buka:'Twelve agricultural stories grow rice, herbs, wheat, and yams. Antipode is also called Circle’s End.',
    chawkee:'Housing and manufacturing fill much of the ring; separate transport layers carry people and goods to utilities and dry docks.',
    'celosia-hubs':'These hubs share the URAL network with Jin’s hubs. Their individual population shares are not specified.'
  },
  continents: {
    fusang:{name:'Fusang',intro:'Arctic in the north; cold but arable around Tiantang. The humid south ranges from San Francisco to Southern California in temperature.',detail:'Sprawling Tiantang holds most of Celosia’s population. Yushan City lies nearby at Yushan Mons. Penglai, the fifth-largest city, is deep inland at Penglai Mons.'},
    mu:{name:'Mu',intro:'The north resembles Busan; the south is an intense desert comparable to Saudi Arabia.',detail:'The continent’s major city is also named Mu, and is about the size of Yushan City on Fusang.'},
    diyu:{name:'Diyu',intro:'A climate comparable to northern Mu and southern Fusang.',detail:'The continent’s major city is also named Diyu, and is about the size of Yushan City on Fusang.'}
  },
  views: {
    system:{title:'System overview',parent:'yake',unit:'AU',caption:'COMPRESSED ORBIT SPACING · SCHEMATIC PHASES',nodes:[['jin',70,-25],['shu',104,145],['celosia',146,60],['gullinkambi',202,-155],['chanticleer',202,25],['xuan',242,-65],['five',280,160],['kukkuta',316,-15]],locals:[['dajinmen',70,-85],['celosia-hubs',146,120]]},
    // Locals have display positions only: they deliberately do not acquire km values or physical orbit tracks.
    // Relative ordering only: Plomo, Suseong and Peng are all beyond Skarda.
    // Plomo's 1.82182 million is a population, not an orbital distance.
    jin:{title:'The moons of Jin',parent:'jin',unit:'km',caption:'JIN · SEVEN PRIMARY MOONS & HORIZON’S EDGE',ez:1560000,nodes:[['prata',80,-40],['kobber',145,155],['vas',210,25],['skarda',300,-65]],locals:[['plomo',370,-140],['suseong',340,65],['peng',370,95]],ezLocals:[{id:'marassa',angle:-125}]},
    shu:{title:'The moons of Shu',parent:'shu',unit:'km',caption:'COMPRESSED MOON ORBITS · DISTANCES FROM SHU',ez:1599180,nodes:[['jouki',86,-40],['mizu',152,145],['pani',220,25],['buz',301,-65]]},
    xuan:{title:'Xuan & Kaʻauhelemoa',parent:'xuan',unit:'km',caption:'KAʻAUHELEMOA / 0401 · XUAN’S LARGEST MOON',ez:237000,nodes:[['kaau',235,155]]},
    outer:{title:'Beyond Celosia',parent:'yake',unit:'AU',caption:'RESONANT OUTER WORLDS · SCHEMATIC PHASES',nodes:[['gullinkambi',130,-155],['chanticleer',130,25],['xuan',200,-65],['five',264,155],['kukkuta',318,-10]],unplaced:['minor']},
    five:{title:'The Five Islands',parent:'five',cluster:true,unit:'region',caption:'HIERARCHICAL QUINTUPLE · SCHEMATIC SPACING',nodes:[],hierarchy:{central:'mun',periodRatio:[2,3],pairs:[{members:['in','sin'],center:[-130,-100],offset:[32,-28]},{members:['island-mu','yong'],center:[150,155],offset:[-30,30]}]}}
  }
};
// Illustrative internal spacing only, shared by the overview glyph and detail
// view. No kilometer distances or orbital periods are invented here.
{
  const view=window.YAKE_ATLAS.views.five;
  view.nodes.push([view.hierarchy.central,0,0]);
  view.hierarchy.pairs.forEach(pair=>pair.members.forEach((id,i)=>{
    const side=i?1:-1,x=pair.center[0]+side*pair.offset[0],z=pair.center[1]+side*pair.offset[1];
    view.nodes.push([id,Math.hypot(x,z),Math.atan2(z,x)*180/Math.PI]);
  }));
}
