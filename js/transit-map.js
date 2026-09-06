/**
 * TRANSIT MAP - Inhabited Space Route Planner
 *
 * K-Tube transit network visualization and route planning
 * for the EXU universe (2370 SolUT)
 *
 * World-built names mapped to catalog (real) stars.
 * Supports 2D pan/zoom + optional 3D map mode (three.js r73).
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // STATION DATA
    // x/y = 2D map coordinates (1600x1000 viewBox)
    // real = catalog star, spec = spectral class, pop = population in millions
    // ═══════════════════════════════════════════════════════════════

    const stations = {
        // dist = true distance from Sol in light years; ang = schematic angle
        // (deg) on the nested-ring subway layout. x/y are computed below.
        // UPLB Systems
        'Sol':        {dist: 0,    ang: 0,     real: 'Sol', spec: 'G-Type', pop: 10440, faction: 'UPLB', labelOffset: {x: 0, y: -28}},
        'Gamov':      {dist: 41.0, ang: -155, real: 'Copernicus (55 Cancri A)', spec: 'G-Type', pop: 630.6, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Wolf':       {dist: 14.05, ang: -30, real: 'Wolf 1061', spec: 'Red Dwarf', pop: 432, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Luyten':     {dist: 12.2, ang: 5,    real: "Luyten's Star", spec: 'Red Dwarf', pop: 322, faction: 'UPLB', labelOffset: {x: 60, y: 0}},
        'Gowjin':     {dist: 15.2, ang: 55,   real: 'Gliese 876', spec: 'Red Dwarf', pop: 317, faction: 'UPLB', labelOffset: {x: 0, y: 28}},
        'Issetock':   {dist: 20.4, ang: 30,   real: 'Gliese 581', spec: 'Red Dwarf', pop: 28.3, faction: 'UPLB', labelOffset: {x: 0, y: 28}},
        'Nursia':     {dist: 40.7, ang: 80,   real: 'TRAPPIST-1', spec: 'Red Dwarf', pop: 411, faction: 'UPLB', labelOffset: {x: 0, y: 28}},
        'Bakunawa':   {dist: 48.8, ang: 120,  real: 'LHS 1140', spec: 'Red Dwarf', pop: 215, faction: 'UPLB', labelOffset: {x: 0, y: 28}},
        // SWI Systems
        'Vega':       {dist: 25.0, ang: -75,  real: 'Vega', spec: 'A-Type (Blue Dwarf)', pop: 262, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Ya Ke':      {dist: 64.3, ang: 175,  real: 'Nu2 Canis Majoris', spec: 'K-Type Giant', pop: 579.4, faction: 'SWI', labelOffset: {x: -60, y: 0}},
        'Zi Wei Yuan':{dist: 68.2, ang: -135, real: 'HD 33564', spec: 'Yellow-White Dwarf', pop: 258.6, faction: 'SWI', labelOffset: {x: 0, y: -25}},
        'Sipapu':     {dist: 41.0, ang: -20,  real: 'HD 69830 (285 G. Puppis)', spec: 'Yellow Dwarf', pop: 254, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        // Homeworlds Systems
        'Proxima':    {dist: 4.24, ang: 85, rn: 30, real: 'Proxima Centauri', spec: 'Red Dwarf', pop: 397, faction: 'HW', label: 'Proxima Astraeus', labelOffset: {x: 0, y: 28}},
        'Toliman':    {dist: 4.37, ang: 160, rn: 30, real: 'Alpha Centauri B', spec: 'K-Type', pop: 7, faction: 'HW', labelOffset: {x: -60, y: 0}},
        'Tartarus':   {dist: 11.0, ang: 95,   real: 'Ross 128', spec: 'Red Dwarf', pop: 231, faction: 'HW', labelOffset: {x: -60, y: 0}},
        'Tau Ceti':   {dist: 11.9, ang: 155,  real: 'Tian Cang (Tau Ceti)', spec: 'G-Type', pop: 228.3, faction: 'HW', labelOffset: {x: -60, y: 0}},
        'Barnard':    {dist: 5.96, ang: 182, rn: 8,  real: "Barnard's Star", spec: 'Red Dwarf', pop: 454.7, faction: 'HW', labelOffset: {x: -60, y: 10}},
        // Rigil last so its marker draws on top of the Homeworlds knot
        'Rigil':      {dist: 4.37, ang: 115, rn: 36, real: 'Alpha Centauri A', spec: 'G-Type', pop: 649, faction: 'HW', labelOffset: {x: -55, y: 12}}
    };

    // Classic (original freeform) 2D layout coordinates
    const CLASSIC_XY = {
        'Sol': [800, 500],   'Gamov': [950, 300],  'Wolf': [650, 250],
        'Luyten': [500, 400],'Gowjin': [500, 600], 'Issetock': [650, 700],
        'Nursia': [950, 700],'Bakunawa': [800,150],'Vega': [1150, 450],
        'Ya Ke': [1400, 350],'Zi Wei Yuan': [1400, 600], 'Sipapu': [1150, 700],
        'Proxima': [300, 700], 'Rigil': [400, 850], 'Toliman': [480, 820],
        'Tartarus': [250, 550], 'Tau Ceti': [550, 900], 'Barnard': [200, 850]
    };
    Object.keys(CLASSIC_XY).forEach(function(name) {
        stations[name].x = CLASSIC_XY[name][0];
        stations[name].y = CLASSIC_XY[name][1];
    });

    // ═══════════════════════════════════════════════════════════════
    // ROUTE DATA
    // ═══════════════════════════════════════════════════════════════

    // Estimated Sol links: FDR hours = |heliocentric radial km/s| * 24 / 30,
    // rounded to 0.1 h. Present-day radial motion only; 1 day per 30 km/s.
    // Luyten 18.36: https://simbad.u-strasbg.fr/simbad/sim-id?Ident=GJ+273
    // Gowjin 1.47: https://simbad.cds.unistra.fr/simbad/sim-id?Ident=GJ+876
    // Issetock 9.75: https://www.aanda.org/articles/aa/pdf/2024/08/aa49375-24.pdf
    // Nursia 52.003101: https://simbad.u-strasbg.fr/simbad/sim-id?Ident=TRAPPIST-1
    // Bakunawa 13.329: https://simbad.u-strasbg.fr/simbad/sim-id?Ident=LHS+1140
    // Tau Ceti 16.597: https://simbad.cds.unistra.fr/simbad/sim-id?Ident=tau+Cet
    // Barnard 110.11: https://simbad.u-strasbg.fr/simbad/sim-id?Ident=Barnard%27s+star
    const routes = [
        // UPLB routes
        {from: 'Sol', to: 'Gamov', proper: 55.58, tau: 6.0, fdr: 24, type: 'uplb'},
        {from: 'Sol', to: 'Wolf', proper: 19.17, tau: 1.92, fdr: 24, type: 'uplb'},
        {from: 'Sol', to: 'Luyten', proper: 17.32, tau: null, fdr: 14.7, fdrEstimated: true, type: 'uplb'},
        {from: 'Sol', to: 'Gowjin', proper: 20.78, tau: null, fdr: 1.2, fdrEstimated: true, type: 'uplb'},
        {from: 'Sol', to: 'Issetock', proper: 28.48, tau: null, fdr: 7.8, fdrEstimated: true, type: 'uplb'},
        {from: 'Sol', to: 'Nursia', proper: 54.86, tau: null, fdr: 41.6, fdrEstimated: true, type: 'uplb'},
        {from: 'Sol', to: 'Bakunawa', proper: 56.8, tau: null, fdr: 10.7, fdrEstimated: true, type: 'uplb'},
        {from: 'Wolf', to: 'Gamov', proper: 31.55, tau: 3.128, fdr: 48, type: 'uplb'},
    
        // SWI internal routes (note: "All None Listed SWI To SWI routes are Prohibitively Long/Expensive")
        {from: 'Ya Ke', to: 'Sipapu', proper: 45.45, tau: 4.51, fdr: 24, type: 'swi'},
        {from: 'Zi Wei Yuan', to: 'Vega', proper: 82.87, tau: 8.22, fdr: 10, type: 'swi'},
        {from: 'Sipapu', to: 'Vega', proper: 87.23, tau: 12.25, fdr: 48, type: 'swi'},
        // SWI to UPLB routes (via Gamov hub)
        {from: 'Gamov', to: 'Zi Wei Yuan', proper: 76.87, tau: 7.62, fdr: 24, type: 'inter'},

        // Homeworlds routes - Sol connections (inter-faction since UPLB ↔ HW)
        {from: 'Sol', to: 'Proxima', proper: 5.90, tau: 1.0, fdr: 20, type: 'inter'},
        {from: 'Sol', to: 'Rigil', proper: 5.90, tau: 1.0, fdr: 20, type: 'inter'},
        {from: 'Sol', to: 'Toliman', proper: 5.90, tau: 1.0, fdr: 20, type: 'inter'},
        {from: 'Sol', to: 'Tartarus', proper: 15.13, tau: 1.51, fdr: 24, type: 'inter'},
        {from: 'Sol', to: 'Tau Ceti', proper: 16.5, tau: null, fdr: 13.3, fdrEstimated: true, type: 'inter'},
        {from: 'Sol', to: 'Barnard', proper: 8.31, tau: null, fdr: 88.1, fdrEstimated: true, type: 'inter'},

        // Homeworlds internal routes - Rigil/Toliman (AL only, same binary system)
        {from: 'Rigil', to: 'Toliman', proper: 0.01, tau: 0.05, fdr: 0.1, type: 'hw'},

        // Homeworlds internal routes - Adeyemi Balanza-Llach cloud connections
        {from: 'Proxima', to: 'Rigil', proper: 0.8, tau: 0.15, fdr: 2, type: 'hw'},
        {from: 'Proxima', to: 'Toliman', proper: 0.8, tau: 0.15, fdr: 2, type: 'hw'},

        // Homeworlds internal routes - Federation interconnections
        {from: 'Proxima', to: 'Tartarus', proper: 12.4, tau: 1.2, fdr: 18, type: 'hw'},
        {from: 'Proxima', to: 'Tau Ceti', proper: 13.8, tau: 1.35, fdr: 20, type: 'hw'},
        {from: 'Rigil', to: 'Tartarus', proper: 12.4, tau: 1.2, fdr: 18, type: 'hw'},
        {from: 'Rigil', to: 'Tau Ceti', proper: 13.2, tau: 1.3, fdr: 18, type: 'hw'},
        {from: 'Toliman', to: 'Tartarus', proper: 12.4, tau: 1.2, fdr: 18, type: 'hw'},
        {from: 'Toliman', to: 'Tau Ceti', proper: 13.2, tau: 1.3, fdr: 18, type: 'hw'},
        {from: 'Tartarus', to: 'Tau Ceti', proper: 18.7, tau: 1.85, fdr: 24, type: 'hw'},

        // Barnard's Star - isolated, only Sol and Proxima connections
        {from: 'Barnard', to: 'Proxima', proper: 6.5, tau: 0.65, fdr: 12, type: 'hw'},

        // Inter-faction routes
        {from: 'Sol', to: 'Vega', proper: 35.43, tau: 3.54, fdr: 10, type: 'inter'},
        {from: 'Wolf', to: 'Vega', proper: 21.69, tau: 2.99, fdr: 1, type: 'inter'},
        {from: 'Gamov', to: 'Vega', proper: 74.18, tau: 7.35, fdr: 48, type: 'inter'},
        {from: 'Gamov', to: 'Ya Ke', proper: 76.22, tau: 7.56, fdr: 20, type: 'inter'},
        {from: 'Gamov', to: 'Sipapu', proper: 40.48, tau: 4.01, fdr: 4, type: 'inter'},
        {from: 'Sol', to: 'Ya Ke', proper: 89.5, tau: 8.95, fdr: 2, type: 'inter'},
        {from: 'Sol', to: 'Zi Wei Yuan', proper: 94.48, tau: 9.45, fdr: 10, type: 'inter'},
        {from: 'Sol', to: 'Sipapu', proper: 56.97, tau: 5.697, fdr: 24, type: 'inter'}
    ];

    // Subway mode is deliberately operational rather than geographic. Its
    // time axis uses the fastest known proper-time journey from Sol, while
    // the perpendicular axis separates faction/service lanes for clarity.
    const SUBWAY_MAX_DAYS = 100;
    const SUBWAY_TRACKS = {
        'Sol':         {desktop: 500, mobile: 300, desktopLabel: [18, -12], mobileLabel: [18, -12]},
        'Proxima':     {desktop: 170, mobile: 100, desktopLabel: [-16, -8], mobileLabel: [0, -25]},
        'Rigil':       {desktop: 245, mobile: 170, desktopLabel: [16, -8],  mobileLabel: [-12, 28]},
        'Toliman':     {desktop: 320, mobile: 240, desktopLabel: [-16, 20], mobileLabel: [12, -14]},
        'Barnard':     {desktop: 395, mobile: 145, desktopLabel: [16, 20],  mobileLabel: [-12, 22]},
        'Tartarus':    {desktop: 170, mobile: 90,  desktopLabel: [16, -8],  mobileLabel: [-12, -14]},
        'Tau Ceti':    {desktop: 320, mobile: 205, desktopLabel: [16, 20],  mobileLabel: [12, 24]},
        'Luyten':      {desktop: 430, mobile: 275, desktopLabel: [16, -10], mobileLabel: [12, -10]},
        'Wolf':        {desktop: 500, mobile: 345, desktopLabel: [16, -10], mobileLabel: [12, -10]},
        'Gowjin':      {desktop: 570, mobile: 275, desktopLabel: [16, -10], mobileLabel: [-12, 20]},
        'Issetock':    {desktop: 640, mobile: 345, desktopLabel: [16, 22],  mobileLabel: [12, -10]},
        'Gamov':       {desktop: 430, mobile: 275, desktopLabel: [16, -10], mobileLabel: [-12, -10]},
        'Nursia':      {desktop: 570, mobile: 275, desktopLabel: [16, -10], mobileLabel: [-12, -10]},
        'Bakunawa':    {desktop: 640, mobile: 345, desktopLabel: [-16, 22], mobileLabel: [12, 20]},
        'Vega':        {desktop: 745, mobile: 440, desktopLabel: [16, -10], mobileLabel: [-12, -10]},
        'Sipapu':      {desktop: 820, mobile: 515, desktopLabel: [16, 22],  mobileLabel: [-12, -14]},
        'Ya Ke':       {desktop: 745, mobile: 440, desktopLabel: [16, -10], mobileLabel: [-12, -10]},
        'Zi Wei Yuan': {desktop: 840, mobile: 485, desktopLabel: [-16, 22], mobileLabel: [-12, 20]}
    };

    function calculateProperTimesFromSol() {
        const times = Object.create(null);
        const pending = Object.keys(stations);
        pending.forEach(function(name) { times[name] = Infinity; });
        times.Sol = 0;

        while (pending.length > 0) {
            pending.sort(function(a, b) { return times[a] - times[b]; });
            const current = pending.shift();
            if (!Number.isFinite(times[current])) break;
            routes.forEach(function(route) {
                if (route.from !== current && route.to !== current) return;
                const neighbor = route.from === current ? route.to : route.from;
                const candidate = times[current] + route.proper;
                if (candidate < times[neighbor]) times[neighbor] = candidate;
            });
        }
        return times;
    }

    const SUBWAY_PROPER_TIMES = calculateProperTimesFromSol();

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const FACTION_COLORS = {UPLB: '#4a9eff', SWI: '#51cf66', HW: '#a78bfa'};
    const ROUTE_COLORS = {uplb: 0x4a9eff, swi: 0x51cf66, hw: 0xa78bfa, inter: 0xfbbf24};
    const BRIGHT_ROUTE_COLORS = {uplb: 0x9fd0ff, swi: 0x8dffb0, hw: 0xd0b8ff, inter: 0xffde85};
    const SPEC_COLORS = {
        'G-Type': 0xffd27d,
        'Red Dwarf': 0xff6b4a,
        'A-Type (Blue Dwarf)': 0x9db4ff,
        'K-Type': 0xffa54f,
        'K-Type Giant': 0xffab60,
        'Yellow-White Dwarf': 0xfff4e0,
        'Yellow Dwarf': 0xfff2a1
    };

    let svg = null;
    let world = null;          // pan/zoom transform group
    let plannedRoute = [];
    let routeCircles = {};
    let routeLines = {};
    let dragState = {pointers: new Map(), moved: 0, lastDist: 0, lastMid: null, active: false};
    let view = {x: 0, y: 0, k: 1};
    let mapMode = localStorage.getItem('transit-map-mode') || '2d';
    let layout = localStorage.getItem('transit-map-layout') || 'classic';
    let subwayMobile = window.innerWidth <= 768;
    let routingMode = localStorage.getItem('transit-routing-mode') || 'fastest';
    if (['fastest', 'transfers', 'burn'].indexOf(routingMode) === -1) routingMode = 'fastest';

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function displayName(name) {
        return stations[name].label || name;
    }

    function fmtPop(m) {
        if (m == null) return '—';
        if (m >= 1000) return (m / 1000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + 'B';
        return (m % 1 ? m.toFixed(1) : String(m)) + 'M';
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function init() {
        svg = document.getElementById('transit-map');
        if (!svg) {
            console.error('[TransitMap] SVG element #transit-map not found');
            return;
        }

        world = document.createElementNS(SVG_NS, 'g');
        world.id = 'map-world';
        svg.appendChild(world);

        buildToolbar();
        buildRoutingControls();
        applyLayout();

        if (mapMode === '3d') {
            setMode('3d', true);
        } else {
            updateModeButtons();
        }

        window.addEventListener('resize', onResize);
        console.log('[TransitMap] Initialized with', Object.keys(stations).length, 'stations and', routes.length, 'routes');
    }

    function onResize() {
        if (t3 && t3.active) resize3d();
        const nextSubwayMobile = window.innerWidth <= 768;
        if (mapMode === '2d' && layout === 'subway' && nextSubwayMobile !== subwayMobile) {
            subwayMobile = nextSubwayMobile;
            applyLayout();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TOOLBAR (mode toggle + zoom controls)
    // ═══════════════════════════════════════════════════════════════

    function buildToolbar() {
        const container = document.getElementById('map-container');
        if (!container) return;

        const bar = document.createElement('div');
        bar.className = 'map-toolbar';
        bar.innerHTML =
            '<button id="btn-2d" class="map-btn" type="button" aria-pressed="false">▦ 2D MAP</button>' +
            '<button id="btn-sub" class="map-btn" type="button" aria-pressed="false">◌ SUBWAY</button>' +
            '<button id="btn-3d" class="map-btn" type="button" aria-pressed="false">◈ 3D MAP</button>';
        container.appendChild(bar);

        const hint = document.createElement('div');
        hint.className = 'map-hint';
        hint.textContent = 'CLICK STATIONS TO PLAN ROUTE · 3D: DRAG ROTATES · PINCH OR SCROLL ZOOMS · RIGHT-DRAG PANS';
        container.appendChild(hint);

        document.getElementById('btn-2d').addEventListener('click', function() { setMode('2d', false, 'classic'); });
        document.getElementById('btn-sub').addEventListener('click', function() { setMode('2d', false, 'subway'); });
        document.getElementById('btn-3d').addEventListener('click', function() { setMode('3d'); });

        updateModeButtons();
    }

    function updateModeButtons() {
        const b2 = document.getElementById('btn-2d');
        const b3 = document.getElementById('btn-3d');
        const bs = document.getElementById('btn-sub');
        if (!b2 || !b3) return;
        b2.classList.toggle('active', mapMode === '2d' && layout === 'classic');
        bs.classList.toggle('active', mapMode === '2d' && layout === 'subway');
        b3.classList.toggle('active', mapMode === '3d');
        b2.setAttribute('aria-pressed', mapMode === '2d' && layout === 'classic');
        bs.setAttribute('aria-pressed', mapMode === '2d' && layout === 'subway');
        b3.setAttribute('aria-pressed', mapMode === '3d');
    }

    function buildRoutingControls() {
        const planner = document.querySelector('.route-planner');
        const routeContent = document.getElementById('route-content');
        if (!planner || !routeContent || document.getElementById('route-priority')) return;

        const controls = document.createElement('div');
        controls.id = 'route-priority';
        controls.className = 'route-priority';
        controls.innerHTML =
            '<div class="route-priority-heading">OPTIMIZE ROUTE</div>' +
            '<div class="route-priority-options" role="group" aria-label="Route optimization priority">' +
            '<button class="route-priority-btn" type="button" data-routing-mode="fastest" aria-pressed="false">' +
            '<span class="route-priority-name">FASTEST</span><span class="route-priority-detail">proper time</span></button>' +
            '<button class="route-priority-btn" type="button" data-routing-mode="transfers" aria-pressed="false">' +
            '<span class="route-priority-name">FEWEST TRANSFERS</span><span class="route-priority-detail">number of jumps</span></button>' +
            '<button class="route-priority-btn" type="button" data-routing-mode="burn" aria-pressed="false">' +
            '<span class="route-priority-name">LOWEST BURN</span><span class="route-priority-detail">FDR hours</span></button>' +
            '</div>' +
            '<div id="route-priority-note" class="route-priority-note" aria-live="polite"></div>';
        planner.insertBefore(controls, routeContent);

        Array.from(controls.querySelectorAll('.route-priority-btn')).forEach(function(button) {
            button.addEventListener('click', function() {
                setRoutingMode(button.dataset.routingMode);
            });
        });
        updateRoutingControls();
    }

    function setRoutingMode(mode) {
        if (['fastest', 'transfers', 'burn'].indexOf(mode) === -1) return;
        routingMode = mode;
        localStorage.setItem('transit-routing-mode', routingMode);
        updateRoutingControls();
        updateRouteDisplay();
    }

    function updateRoutingControls() {
        const buttons = document.querySelectorAll('.route-priority-btn');
        Array.from(buttons).forEach(function(button) {
            const active = button.dataset.routingMode === routingMode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        const note = document.getElementById('route-priority-note');
        if (!note) return;
        if (routingMode === 'fastest') {
            note.textContent = 'MINIMIZES TOTAL PROPER TIME';
        } else if (routingMode === 'transfers') {
            note.textContent = 'MINIMIZES JUMPS · FASTEST ROUTE WINS TIES';
        } else {
            note.textContent = 'MINIMIZES FDR BURN · INCLUDES ESTIMATES';
        }
    }

    function setMode(mode, silent, layoutChoice) {
        let layoutChanged = false;
        if (layoutChoice && layout !== layoutChoice) {
            layout = layoutChoice;
            localStorage.setItem('transit-map-layout', layout);
            layoutChanged = true;
        }
        if (mode === mapMode && !silent) {
            if (layoutChanged && mode === '2d') applyLayout();
            updateModeButtons();
            return;
        }
        if (mode === '3d') {
            const b3 = document.getElementById('btn-3d');
            if (b3) { b3.textContent = '◈ LOADING…'; b3.disabled = true; }
            init3d(function(err) {
                if (b3) { b3.textContent = '◈ 3D MAP'; b3.disabled = false; }
                if (err) {
                    console.error('[TransitMap] 3D mode unavailable:', err);
                    mapMode = '2d';
                    localStorage.setItem('transit-map-mode', '2d');
                    applyLayout();
                    updateModeButtons();
                    return;
                }
                mapMode = '3d';
                localStorage.setItem('transit-map-mode', '3d');
                activate3d();
                updateModeButtons();
            });
            return;
        }
        mapMode = '2d';
        localStorage.setItem('transit-map-mode', '2d');
        deactivate3d();
        applyLayout();
        updateModeButtons();
    }

    // ═══════════════════════════════════════════════════════════════
    // 2D PAN / ZOOM
    // ═══════════════════════════════════════════════════════════════

    function applyLayout() {
        const container = document.getElementById('map-container');
        subwayMobile = window.innerWidth <= 768;
        svg.setAttribute('viewBox', layout === 'subway'
            ? (subwayMobile ? '0 0 600 1450' : '0 0 1600 1000')
            : '0 0 1600 1000');
        if (container) container.classList.toggle('mode-subway', layout === 'subway');
        world.innerHTML = '';
        routeCircles = {};
        routeLines = {};
        drawSubwayGuide();
        drawRoutes();
        drawStations();
        updateRouteDisplay();
        view = {x: 0, y: 0, k: 1};
        applyView();
        svg.style.touchAction = 'auto'; // 2D maps are static
    }

    function applyView() {
        world.setAttribute('transform', 'translate(' + view.x + ' ' + view.y + ') scale(' + view.k + ')');
    }

    function clientToSvg(clientX, clientY) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function zoomBy(factor, cx, cy) {
        const k2 = Math.min(10, Math.max(0.5, view.k * factor));
        const f = k2 / view.k;
        view.x = cx - (cx - view.x) * f;
        view.y = cy - (cy - view.y) * f;
        view.k = k2;
        applyView();
    }

    function resetView() {
        view = {x: 0, y: 0, k: 1};
        applyView();
    }

    function initPanZoom() {
        svg.style.touchAction = 'none';

        svg.addEventListener('wheel', function(e) {
            if (layout === 'classic') return; // classic map is static
            e.preventDefault();
            const p = clientToSvg(e.clientX, e.clientY);
            zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
        }, {passive: false});

        svg.addEventListener('pointerdown', function(e) {
            if (layout === 'classic') return; // classic map is static
            dragState.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
            dragState.moved = 0;
            dragState.captured = false;
            if (dragState.pointers.size === 1) {
                dragState.active = true;
            } else if (dragState.pointers.size === 2) {
                const pts = Array.from(dragState.pointers.values());
                dragState.lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                dragState.lastMid = {x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2};
            }
        });

        svg.addEventListener('pointermove', function(e) {
            if (layout === 'classic') return;
            if (!dragState.pointers.has(e.pointerId)) return;
            const prev = dragState.pointers.get(e.pointerId);
            dragState.moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
            dragState.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});

            // Capture lazily: only once it is a real drag. Capturing on
            // pointerdown retargets the subsequent click to the svg root,
            // which breaks station click handlers.
            if (dragState.active && !dragState.captured && dragState.moved > 4 && dragState.pointers.size === 1) {
                dragState.captured = true;
                try { svg.setPointerCapture(e.pointerId); } catch (err) {}
            }

            if (dragState.pointers.size === 1 && dragState.active) {
                const inv = svg.getScreenCTM().inverse();
                const dx = (e.clientX - prev.x) * inv.a;
                const dy = (e.clientY - prev.y) * inv.d;
                view.x += dx;
                view.y += dy;
                applyView();
            } else if (dragState.pointers.size === 2) {
                const pts = Array.from(dragState.pointers.values());
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const mid = {x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2};
                const s = clientToSvg(mid.x, mid.y);
                if (dragState.lastDist > 0) {
                    zoomBy(dist / dragState.lastDist, s.x, s.y);
                }
                const inv = svg.getScreenCTM().inverse();
                view.x += (mid.x - dragState.lastMid.x) * inv.a;
                view.y += (mid.y - dragState.lastMid.y) * inv.d;
                applyView();
                dragState.lastDist = dist;
                dragState.lastMid = mid;
            }
        });

        function endPointer(e) {
            dragState.pointers.delete(e.pointerId);
            if (dragState.pointers.size === 0) {
                dragState.active = false;
            } else if (dragState.pointers.size === 1) {
                dragState.lastDist = 0;
            }
        }
        svg.addEventListener('pointerup', endPointer);
        svg.addEventListener('pointercancel', endPointer);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2D DRAWING
    // ═══════════════════════════════════════════════════════════════

    function subwayTimeX(days) {
        return 170 + Math.min(days, SUBWAY_MAX_DAYS) / SUBWAY_MAX_DAYS * 1280;
    }

    function subwayTimeY(days) {
        return 180 + Math.min(days, SUBWAY_MAX_DAYS) / SUBWAY_MAX_DAYS * 1130;
    }

    function P(name, station) {
        if (layout !== 'subway') return {x: station.x, y: station.y};
        const track = SUBWAY_TRACKS[name];
        const time = SUBWAY_PROPER_TIMES[name];
        return subwayMobile
            ? {x: track.mobile, y: subwayTimeY(time)}
            : {x: subwayTimeX(time), y: track.desktop};
    }

    function stationLabelOffset(name, station) {
        if (layout !== 'subway') return station.labelOffset;
        const offset = subwayMobile
            ? SUBWAY_TRACKS[name].mobileLabel
            : SUBWAY_TRACKS[name].desktopLabel;
        return {x: offset[0], y: offset[1]};
    }

    function svgGuideElement(tag, className) {
        const el = document.createElementNS(SVG_NS, tag);
        el.setAttribute('class', className);
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    function drawSubwayGuide() {
        if (layout !== 'subway') return;

        const guide = svgGuideElement('g', 'subway-guide');
        const title = svgGuideElement('text', 'subway-guide-title');
        const subtitle = svgGuideElement('text', 'subway-guide-subtitle');
        title.textContent = 'PROPER-TIME NETWORK';
        subtitle.textContent = subwayMobile
            ? 'FASTEST KNOWN JOURNEY FROM SOL · DAYS ↓'
            : 'SHORTEST PROPER TIME FROM SOL · DAYS';

        if (subwayMobile) {
            title.setAttribute('x', 300);
            title.setAttribute('y', 82);
            title.setAttribute('text-anchor', 'middle');
            subtitle.setAttribute('x', 300);
            subtitle.setAttribute('y', 111);
            subtitle.setAttribute('text-anchor', 'middle');

            [
                {x: 70, width: 165, label: 'HOMEWORLDS', color: 'hw'},
                {x: 240, width: 150, label: 'UPLB', color: 'uplb'},
                {x: 395, width: 175, label: 'SWI', color: 'swi'}
            ].forEach(function(lane) {
                const band = svgGuideElement('rect', 'subway-lane subway-lane-' + lane.color);
                band.setAttribute('x', lane.x);
                band.setAttribute('y', 150);
                band.setAttribute('width', lane.width);
                band.setAttribute('height', 1185);
                guide.appendChild(band);

                const label = svgGuideElement('text', 'subway-lane-label subway-lane-label-' + lane.color);
                label.setAttribute('x', lane.x + lane.width / 2);
                label.setAttribute('y', 145);
                label.setAttribute('text-anchor', 'middle');
                label.textContent = lane.label;
                guide.appendChild(label);
            });

            for (let day = 0; day <= SUBWAY_MAX_DAYS; day += 10) {
                const y = subwayTimeY(day);
                const tick = svgGuideElement('line', 'subway-time-grid' + (day % 20 === 0 ? ' major' : ''));
                tick.setAttribute('x1', 56);
                tick.setAttribute('x2', 570);
                tick.setAttribute('y1', y);
                tick.setAttribute('y2', y);
                guide.appendChild(tick);

                const label = svgGuideElement('text', 'subway-time-label');
                label.setAttribute('x', 48);
                label.setAttribute('y', y + 5);
                label.setAttribute('text-anchor', 'end');
                label.textContent = day;
                guide.appendChild(label);
            }
        } else {
            title.setAttribute('x', 1450);
            title.setAttribute('y', 92);
            title.setAttribute('text-anchor', 'end');
            subtitle.setAttribute('x', 1450);
            subtitle.setAttribute('y', 121);
            subtitle.setAttribute('text-anchor', 'end');

            [
                {y: 140, height: 275, label: 'HOMEWORLDS', color: 'hw'},
                {y: 420, height: 250, label: 'UPLB', color: 'uplb'},
                {y: 690, height: 185, label: 'SWI', color: 'swi'}
            ].forEach(function(lane) {
                const band = svgGuideElement('rect', 'subway-lane subway-lane-' + lane.color);
                band.setAttribute('x', 145);
                band.setAttribute('y', lane.y);
                band.setAttribute('width', 1330);
                band.setAttribute('height', lane.height);
                guide.appendChild(band);

                const label = svgGuideElement('text', 'subway-lane-label subway-lane-label-' + lane.color);
                label.setAttribute('x', 1460);
                label.setAttribute('y', lane.y + 23);
                label.setAttribute('text-anchor', 'end');
                label.textContent = lane.label;
                guide.appendChild(label);
            });

            for (let day = 0; day <= SUBWAY_MAX_DAYS; day += 10) {
                const x = subwayTimeX(day);
                const tick = svgGuideElement('line', 'subway-time-grid' + (day % 20 === 0 ? ' major' : ''));
                tick.setAttribute('x1', x);
                tick.setAttribute('x2', x);
                tick.setAttribute('y1', 135);
                tick.setAttribute('y2', 900);
                guide.appendChild(tick);

                const label = svgGuideElement('text', 'subway-time-label');
                label.setAttribute('x', x);
                label.setAttribute('y', 930);
                label.setAttribute('text-anchor', 'middle');
                label.textContent = day;
                guide.appendChild(label);
            }

            const axis = svgGuideElement('text', 'subway-axis-title');
            axis.setAttribute('x', 810);
            axis.setAttribute('y', 970);
            axis.setAttribute('text-anchor', 'middle');
            axis.textContent = 'SHORTEST PROPER TIME FROM SOL (DAYS)';
            guide.appendChild(axis);
        }

        guide.appendChild(title);
        guide.appendChild(subtitle);
        world.appendChild(guide);
    }

    function drawRoutes() {
        routes.forEach(function(route) {
            const fromS = stations[route.from];
            const toS = stations[route.to];
            const a = P(route.from, fromS);
            const b = P(route.to, toS);
            let el;

            if (layout !== 'subway') {
                el = document.createElementNS(SVG_NS, 'line');
                el.setAttribute('x1', a.x);
                el.setAttribute('y1', a.y);
                el.setAttribute('x2', b.x);
                el.setAttribute('y2', b.y);
            } else {
                el = document.createElementNS(SVG_NS, 'path');
                if (subwayMobile) {
                    const midY = (a.y + b.y) / 2;
                    el.setAttribute('d', 'M ' + a.x + ' ' + a.y +
                        ' C ' + a.x + ' ' + midY + ', ' + b.x + ' ' + midY + ', ' + b.x + ' ' + b.y);
                } else {
                    const midX = (a.x + b.x) / 2;
                    el.setAttribute('d', 'M ' + a.x + ' ' + a.y +
                        ' C ' + midX + ' ' + a.y + ', ' + midX + ' ' + b.y + ', ' + b.x + ' ' + b.y);
                }
                el.setAttribute('fill', 'none');
            }
            el.classList.add('route-line', route.type + '-route');
            el.dataset.from = route.from;
            el.dataset.to = route.to;

            routeLines[route.from + '-' + route.to] = el;
            routeLines[route.to + '-' + route.from] = el;

            world.appendChild(el);
        });
    }

    function drawStations() {
        Object.keys(stations).forEach(function(name) {
            const data = stations[name];
            const pos = P(name, data);
            const labelOffset = stationLabelOffset(name, data);
            const g = document.createElementNS(SVG_NS, 'g');
            g.classList.add('station-group');
            g.dataset.station = name;
            g.setAttribute('role', 'button');
            g.setAttribute('tabindex', '0');
            g.setAttribute('aria-label', layout === 'subway'
                ? displayName(name) + ', ' + SUBWAY_PROPER_TIMES[name].toFixed(1) + ' days from Sol'
                : displayName(name));

            const tooltip = document.createElementNS(SVG_NS, 'title');
            tooltip.textContent = layout === 'subway'
                ? displayName(name) + ' — ' + SUBWAY_PROPER_TIMES[name].toFixed(1) + ' days from Sol'
                : displayName(name);

            const hitArea = document.createElementNS(SVG_NS, 'rect');
            hitArea.classList.add('station-hit-area');
            const hitX = pos.x - 30 + Math.min(0, labelOffset.x);
            const hitY = pos.y - 30 + Math.min(0, labelOffset.y);
            hitArea.setAttribute('x', hitX);
            hitArea.setAttribute('y', hitY);
            hitArea.setAttribute('width', 60 + Math.abs(labelOffset.x));
            hitArea.setAttribute('height', 60 + Math.abs(labelOffset.y));

            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.classList.add('station-circle', 'faction-' + data.faction.toLowerCase());
            const connectionCount = routes.filter(function(route) {
                return route.from === name || route.to === name;
            }).length;
            if (layout === 'subway' && connectionCount > 2) circle.classList.add('transfer-station');
            if (layout === 'subway' && name === 'Sol') circle.classList.add('sol-station');
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            circle.setAttribute('r', layout === 'subway' && name === 'Sol' ? 14 :
                (layout === 'subway' && connectionCount > 2 ? 11 : 9));

            routeCircles[name] = circle;

            const labelX = pos.x + labelOffset.x;
            const labelY = pos.y + labelOffset.y;
            const anchor = labelOffset.x > 0 ? 'start' : (labelOffset.x < 0 ? 'end' : 'middle');

            const label = document.createElementNS(SVG_NS, 'text');
            label.classList.add('station-label');
            label.setAttribute('x', labelX);
            label.setAttribute('y', labelY);
            label.setAttribute('text-anchor', anchor);
            label.textContent = displayName(name);

            g.appendChild(tooltip);
            g.appendChild(hitArea);
            g.appendChild(circle);
            g.appendChild(label);
            world.appendChild(g);

            g.addEventListener('click', function(e) {
                e.stopPropagation();
                if (dragState.moved > 8) return; // ignore click at end of a drag
                addStationToRoute(name);
            });
            g.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                addStationToRoute(name);
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ROUTE PLANNING
    // ═══════════════════════════════════════════════════════════════

    function addStationToRoute(stationName) {
        if (plannedRoute.length > 0 && plannedRoute[plannedRoute.length - 1] === stationName) {
            return;
        }

        plannedRoute.push(stationName);
        updateRouteDisplay();
    }

    // Expand the planned picks into actual network hops (transfers through
    // Sol or other hubs are implicit, not extra stops).
    function plannedHops() {
        const hops = [];
        for (let i = 0; i < plannedRoute.length - 1; i++) {
            if (plannedRoute[i] === plannedRoute[i + 1]) continue;
            const path = findPath(plannedRoute[i], plannedRoute[i + 1]);
            if (!path) {
                hops.push({
                    from: plannedRoute[i],
                    to: plannedRoute[i + 1],
                    noRoute: true,
                    reason: routingMode === 'burn' ? 'missing-burn-data' : 'unreachable'
                });
                continue;
            }
            for (let j = 0; j < path.length - 1; j++) {
                hops.push({from: path[j], to: path[j + 1]});
            }
        }
        return hops;
    }

    function routeScore(route) {
        if (routingMode === 'burn') {
            // A missing burn figure is unknown, not a free zero-cost leg.
            if (route.fdr == null || !Number.isFinite(route.fdr)) return null;
            return [route.fdr, route.proper];
        }
        if (routingMode === 'transfers') return [1, route.proper];
        return [route.proper, 1];
    }

    function compareScores(a, b) {
        if (Math.abs(a[0] - b[0]) > 0.000001) return a[0] - b[0];
        return a[1] - b[1];
    }

    // Dijkstra with a two-part score. Fastest and lowest-burn routes use
    // their respective totals first; fewest-transfers uses hop count first.
    function findPath(start, end) {
        if (start === end) return [start];

        const queue = [{station: start, path: [start], score: [0, 0]}];
        const best = Object.create(null);
        best[start] = [0, 0];

        while (queue.length > 0) {
            queue.sort(function(a, b) { return compareScores(a.score, b.score); });
            const current = queue.shift();
            if (compareScores(current.score, best[current.station]) > 0) continue;
            if (current.station === end) return current.path;

            routes
                .filter(function(route) {
                    return route.from === current.station || route.to === current.station;
                })
                .forEach(function(route) {
                    const edgeScore = routeScore(route);
                    if (!edgeScore) return;
                    const neighbor = route.from === current.station ? route.to : route.from;
                    const nextScore = [
                        current.score[0] + edgeScore[0],
                        current.score[1] + edgeScore[1]
                    ];
                    if (!best[neighbor] || compareScores(nextScore, best[neighbor]) < 0) {
                        best[neighbor] = nextScore;
                        queue.push({
                            station: neighbor,
                            path: current.path.concat([neighbor]),
                            score: nextScore
                        });
                    }
                });
        }

        return null;
    }

    function findRoute(from, to) {
        const route = routes.find(function(r) {
            return (r.from === from && r.to === to) || (r.from === to && r.to === from);
        });

        if (route && route.from !== from) {
            return Object.assign({}, route, {from: to, to: from});
        }

        return route;
    }

    function clearRoute() {
        plannedRoute = [];
        updateRouteDisplay();
    }

    // ═══════════════════════════════════════════════════════════════
    // DISPLAY UPDATE
    // ═══════════════════════════════════════════════════════════════

    function updateRouteDisplay() {
        // Update station circles (2D)
        Object.keys(routeCircles).forEach(function(name) {
            const circle = routeCircles[name];
            circle.classList.remove('selected', 'in-route');
            if (plannedRoute.indexOf(name) !== -1) {
                if (name === plannedRoute[plannedRoute.length - 1]) {
                    circle.classList.add('selected');
                } else {
                    circle.classList.add('in-route');
                }
            }
        });

        // Update route lines (2D)
        Object.keys(routeLines).forEach(function(key) {
            routeLines[key].classList.remove('active');
        });

        plannedHops().forEach(function(hop) {
            if (!hop || hop.noRoute) return;
            const key = hop.from + '-' + hop.to;
            if (routeLines[key]) routeLines[key].classList.add('active');
        });

        // Sync 3D view if active
        if (t3 && t3.active) apply3dSelection();

        updateRoutePanel();
    }

    function updateRoutePanel() {
        const routeContent = document.getElementById('route-content');
        if (!routeContent) return;

        if (plannedRoute.length === 0) {
            routeContent.innerHTML =
                '<div class="empty-state">' +
                '<div class="empty-state-icon">✧</div>' +
                '<div class="empty-state-text">Click stations on the map to plan your route</div>' +
                '</div>';
            return;
        }

        let html = '<div class="route-display">';
        plannedRoute.forEach(function(station, idx) {
            html +=
                '<div class="route-stop">' +
                '<div class="stop-number">' + (idx + 1) + '</div>' +
                '<div class="stop-name">' + esc(displayName(station)) + '</div>' +
                '</div>';
            if (idx < plannedRoute.length - 1) {
                html += '<div class="stop-arrow">→</div>';
            }
        });
        html += '</div>';

        let totalProper = 0;
        let totalTau = 0;
        let totalFdr = 0;
        let allFdrKnown = true;
        let hasFdrEstimate = false;
        const legs = [];

        plannedHops().forEach(function(hop) {
            if (!hop || hop.noRoute) {
                legs.push(hop || {noRoute: true});
                return;
            }
            const route = findRoute(hop.from, hop.to);
            if (route) {
                totalProper += route.proper;
                totalTau += route.tau || 0;
                if (route.fdr == null) {
                    allFdrKnown = false;
                } else {
                    totalFdr += route.fdr;
                    if (route.fdrEstimated) hasFdrEstimate = true;
                }
                legs.push(Object.assign({}, route, {from: hop.from, to: hop.to}));
            } else {
                legs.push({from: hop.from, to: hop.to, noRoute: true});
            }
        });

        if (plannedRoute.length > 1) {
            const hasGap = legs.some(function(leg) { return leg.noRoute; });
            if (hasGap) {
                html +=
                    '<div class="route-warning">' +
                    (routingMode === 'burn'
                        ? 'NO FULLY COSTED ROUTE · ONE OR MORE REQUIRED LEGS HAVE NO FDR BURN DATA'
                        : 'NO COMPLETE ROUTE AVAILABLE') +
                    '</div>';
            } else {
                html += '<div class="totals-section">';
                html +=
                    '<div class="total-box">' +
                    '<div class="total-label">Total Proper Time</div>' +
                    '<div class="total-value">' + totalProper.toFixed(1) + '<span class="total-unit">days</span></div>' +
                    '</div>';

                if (totalTau > 0) {
                    html +=
                        '<div class="total-box">' +
                        '<div class="total-label">Total Tau Time</div>' +
                        '<div class="total-value">' + totalTau.toFixed(1) + '<span class="total-unit">hours</span></div>' +
                        '</div>';
                }

                html +=
                    '<div class="total-box">' +
                    '<div class="total-label">Total FDR Burn' + (hasFdrEstimate ? ' (estimated)' : '') + '</div>' +
                    (allFdrKnown
                        ? '<div class="total-value">' + totalFdr.toFixed(1) + '<span class="total-unit">hours</span></div>'
                        : '<div class="total-value total-unknown">UNKNOWN</div>') +
                    '</div>';
                html += '</div>';
            }

            html += '<div class="leg-details">';
            html += '<h3>ROUTE SEGMENTS</h3>';
            legs.forEach(function(leg, idx) {
                const fromName = esc(displayName(leg.from));
                const toName = esc(displayName(leg.to));
                if (leg.noRoute) {
                    html +=
                        '<div class="leg-item" style="border-left-color: var(--pink);">' +
                        '<div class="leg-route">' + (idx + 1) + '. ' + fromName + ' → ' + toName + '</div>' +
                        '<div class="leg-times" style="color: var(--pink);">' +
                        (leg.reason === 'missing-burn-data'
                            ? 'No route with complete FDR burn data'
                            : 'No route available') +
                        '</div>' +
                        '</div>';
                } else {
                    html +=
                        '<div class="leg-item">' +
                        '<div class="leg-route">' + (idx + 1) + '. ' + fromName + ' → ' + toName + '</div>' +
                        '<div class="leg-times">' +
                        '<div class="leg-time"><span class="leg-time-label">Proper:</span>' +
                        '<span class="leg-time-value">' + leg.proper.toFixed(1) + 'd</span></div>';
                    if (leg.tau) {
                        html +=
                            '<div class="leg-time"><span class="leg-time-label">Tau:</span>' +
                            '<span class="leg-time-value">' + leg.tau.toFixed(1) + 'h</span></div>';
                    }
                    if (leg.fdr) {
                        html +=
                            '<div class="leg-time"><span class="leg-time-label">FDR' + (leg.fdrEstimated ? ' (est.)' : '') + ':</span>' +
                            '<span class="leg-time-value">' + leg.fdr.toFixed(1) + 'h</span></div>';
                    }
                    html += '</div></div>';
                }
            });
            html += '</div>';
        }

        routeContent.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3D MAP MODE (three.js r73, real galactic coordinates, custom orbit rig)
    // ═══════════════════════════════════════════════════════════════

    let t3 = null; // 3D state (built lazily)

    function loadScript(src, cb) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = function() { cb(null); };
        s.onerror = function() { cb(new Error('failed to load ' + src)); };
        document.head.appendChild(s);
    }

    function ensureThree(cb) {
        if (window.THREE) { cb(null); return; }
        loadScript('js-libs/three.min.js', cb);
    }

    // Approximate real galactic coordinates in light years, derived from the
    // catalog stars (galactic longitude/latitude/distance). Scene axes:
    // x/z = galactic plane, y = galactic north. These are TRUE distances —
    // mapTo3d() applies a sqrt compression for display so nearby systems
    // stay readable.
    const COORD3 = {
        'Sol':        [0, 0, 0],
        'Rigil':      [3.03, -0.05, -3.15],
        'Toliman':    [3.20, -0.06, -3.05],
        'Proxima':    [2.93, 0.14, -3.06],
        'Barnard':    [-5.55, -1.30, 1.76],
        'Tau Ceti':   [-3.36, -11.41, 0.47],
        'Vega':       [4.63, 21.94, 11.15],
        'Gamov':      [-22.48, 32.49, -10.95],
        'Luyten':     [-8.03, 7.71, -4.97],
        'Wolf':       [-4.56, -0.48, -13.28],
        'Gowjin':     [5.06, -11.40, -8.69],
        'Issetock':   [-4.69, -17.16, 9.98],
        'Nursia':     [-9.50, -39.55, -1.45],
        'Bakunawa':   [-33.11, -34.07, -11.11],
        'Zi Wei Yuan':[-44.38, 28.68, 42.81],
        'Sipapu':     [-19.42, -14.37, -33.11],
        'Ya Ke':      [-30.04, -11.55, -55.33],
        'Tartarus':   [6.82, 7.68, -3.94]
    };

    // Display scale: r_scene = 22 * sqrt(r_ly). Keeps relative ordering and
    // direction from Sol, but expands the crowded solar neighbourhood so
    // labels don't overlap (Sol/α Cen trio are within ~4.4 ly in reality).
    // Hand-spread exceptions below break pure scaling for the tightest cluster.
    const LABEL_SPREAD = {
        'Rigil':      [52, -3, -46],
        'Toliman':    [32, 3, -58],
        'Proxima':    [36, 12, -33],
    };

    function mapTo3d(name) {
        if (LABEL_SPREAD[name]) {
            const s = LABEL_SPREAD[name];
            return new THREE.Vector3(s[0], s[1], s[2]);
        }
        const c = COORD3[name] || [0, 0, 0];
        const v = new THREE.Vector3(c[0], c[1], c[2]);
        const r = v.length();
        if (r > 0.0001) v.multiplyScalar(22 * Math.sqrt(r) / r);
        return v;
    }

    // Minimal orbit control rig (custom). Left-drag: rotate. Wheel or pinch:
    // zoom. Right-drag / two-finger drag: pan. Pointer Events cover mouse
    // + touch uniformly.
    function SimpleOrbit(camera, dom) {
        this.camera = camera;
        this.dom = dom;
        this.target = new THREE.Vector3(-9, -11, -9);
        this.radius = 290;
        this.theta = Math.PI * 0.25;
        this.phi = Math.PI * 0.38;
        this.pointers = {};
        this.pinchDist = 0;

        const self = this;

        dom.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        dom.addEventListener('pointerdown', function(e) {
            e.preventDefault(); // keep drags from selecting overlay text
            self.pointers[e.pointerId] = {x: e.clientX, y: e.clientY, button: e.button};
            if (dom.setPointerCapture) {
                try { dom.setPointerCapture(e.pointerId); } catch (err) {}
            }
            const ids = Object.keys(self.pointers);
            if (ids.length === 2) {
                const p1 = self.pointers[ids[0]], p2 = self.pointers[ids[1]];
                self.pinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            }
        });

        dom.addEventListener('pointermove', function(e) {
            const p = self.pointers[e.pointerId];
            if (!p) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y;
            p.x = e.clientX;
            p.y = e.clientY;
            const ids = Object.keys(self.pointers);

            if (ids.length >= 2) {
                const p1 = self.pointers[ids[0]], p2 = self.pointers[ids[1]];
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (self.pinchDist > 0 && dist > 0) {
                    self.radius *= self.pinchDist / dist;
                    self.clampRadius();
                }
                self.pinchDist = dist;
            } else if (p.button === 2) {
                self.pan(dx, dy);
            } else {
                self.theta -= dx * 0.005;
                self.phi = Math.max(0.05, Math.min(Math.PI - 0.05, self.phi - dy * 0.005));
            }
        });

        function release(e) {
            delete self.pointers[e.pointerId];
            self.pinchDist = 0;
        }
        dom.addEventListener('pointerup', release);
        dom.addEventListener('pointercancel', release);

        dom.addEventListener('wheel', function(e) {
            e.preventDefault();
            self.radius *= Math.exp(e.deltaY * 0.001);
            self.clampRadius();
        }, {passive: false});
    }

    SimpleOrbit.prototype.clampRadius = function() {
        this.radius = Math.max(8, Math.min(900, this.radius));
    };

    SimpleOrbit.prototype.pan = function(dx, dy) {
        const scale = this.radius * 0.0016;
        this.camera.updateMatrixWorld();
        const m = this.camera.matrixWorld.elements;
        const right = new THREE.Vector3(m[0], m[1], m[2]);
        const up = new THREE.Vector3(m[4], m[5], m[6]);
        this.target.addScaledVector(right, -dx * scale);
        this.target.addScaledVector(up, dy * scale);
    };

    SimpleOrbit.prototype.positionCamera = function() {
        const sinPhi = Math.sin(this.phi);
        this.camera.position.set(
            this.target.x + this.radius * sinPhi * Math.sin(this.theta),
            this.target.y + this.radius * Math.cos(this.phi),
            this.target.z + this.radius * sinPhi * Math.cos(this.theta)
        );
        this.camera.lookAt(this.target);
    };

    function init3d(ready) {
        if (t3) { ready(null); return; }
        ensureThree(function(err) {
            if (err) { ready(err); return; }
            try {
                build3d();
                ready(null);
            } catch (e) {
                ready(e);
            }
        });
    }

    function build3d() {
        const container = document.getElementById('map-container');
        // Use the same theme color as both SVG maps' selected routes.
        const routeHighlightColor = new THREE.Color(
            getComputedStyle(container).getPropertyValue('--pink').trim() || '#ff0099'
        );
        const wrap = document.createElement('div');
        wrap.className = 't3d-wrap';
        wrap.style.display = 'none';
        wrap.innerHTML = '<canvas class="t3d-canvas"></canvas><div class="t3d-labels"></div>';
        container.appendChild(wrap);

        const canvas = wrap.querySelector('canvas');
        const labelsWrap = wrap.querySelector('.t3d-labels');

        const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true, alpha: true});
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);

        const controls = new SimpleOrbit(camera, canvas);
        controls.positionCamera();

        // Starfield backdrop
        const starGeo = new THREE.Geometry();
        for (let i = 0; i < 700; i++) {
            const v = new THREE.Vector3(
                Math.random() * 1800 - 900,
                Math.random() * 700 - 280,
                Math.random() * 1800 - 900
            );
            if (v.length() > 220) starGeo.vertices.push(v);
        }
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
            color: 0x88aaff, size: 2.2, transparent: true, opacity: 0.6
        })));

        // A compact compass rose marks Sol as the origin and hints at the
        // galactic plane without covering the whole scene in a grid.
        const solRays = new THREE.Group();
        solRays.position.copy(mapTo3d('Sol'));
        const innerRayGeo = new THREE.Geometry();
        const outerRayGeo = new THREE.Geometry();
        for (let ray = 0; ray < 16; ray++) {
            const angle = ray * Math.PI / 8;
            const dx = Math.cos(angle);
            const dz = Math.sin(angle);
            const length = ray % 4 === 0 ? 38 : (ray % 2 === 0 ? 28 : 20);
            innerRayGeo.vertices.push(
                new THREE.Vector3(dx * 4.5, 0, dz * 4.5),
                new THREE.Vector3(dx * 14, 0, dz * 14)
            );
            outerRayGeo.vertices.push(
                new THREE.Vector3(dx * 14, 0, dz * 14),
                new THREE.Vector3(dx * length, 0, dz * length)
            );
        }
        solRays.add(new THREE.LineSegments(innerRayGeo, new THREE.LineBasicMaterial({
            color: 0xffdf66,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })));
        solRays.add(new THREE.LineSegments(outerRayGeo, new THREE.LineBasicMaterial({
            color: 0xffdf66,
            transparent: true,
            opacity: 0.09,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })));
        scene.add(solRays);

        // Route lines: faction-coloured network lines plus a soft pink tube
        // that is only shown around selected legs. WebGL lineWidth is ignored
        // by most browsers, so geometry is needed for a visible halo.
        const lineObjs = {};
        const glowObjs = {};
        const selectionGlowObjs = {};
        routes.forEach(function(route) {
            const start = mapTo3d(route.from);
            const end = mapTo3d(route.to);
            const geo = new THREE.Geometry();
            geo.vertices.push(start, end);
            const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
                color: ROUTE_COLORS[route.type], transparent: true, opacity: 0.5
            }));
            line.userData = {type: route.type};
            scene.add(line);
            lineObjs[route.from + '|' + route.to] = line;
            lineObjs[route.to + '|' + route.from] = line;

            const glow = new THREE.Line(geo, new THREE.LineBasicMaterial({
                color: ROUTE_COLORS[route.type], transparent: true, opacity: 0.22,
                blending: THREE.AdditiveBlending, depthWrite: false
            }));
            glow.userData = {type: route.type};
            scene.add(glow);
            glowObjs[route.from + '|' + route.to] = glow;
            glowObjs[route.to + '|' + route.from] = glow;

            const delta = new THREE.Vector3().subVectors(end, start);
            const length = delta.length();
            const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            const rotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0), delta.clone().normalize()
            );
            const selectionGlow = new THREE.Group();
            [
                {radius: 0.65, opacity: 0.16},
                {radius: 1.35, opacity: 0.06}
            ].forEach(function(layer) {
                const shell = new THREE.Mesh(
                    new THREE.CylinderGeometry(layer.radius, layer.radius, length, 12, 1, true),
                    new THREE.MeshBasicMaterial({
                        color: routeHighlightColor,
                        transparent: true,
                        opacity: layer.opacity,
                        blending: THREE.AdditiveBlending,
                        depthTest: false,
                        depthWrite: false
                    })
                );
                shell.position.copy(midpoint);
                shell.quaternion.copy(rotation);
                shell.renderOrder = 997;
                selectionGlow.add(shell);
            });
            selectionGlow.visible = false;
            scene.add(selectionGlow);
            selectionGlowObjs[route.from + '|' + route.to] = selectionGlow;
            selectionGlowObjs[route.to + '|' + route.from] = selectionGlow;
        });

        // Station spheres (core colored by spectral class, halo by faction)
        const meshObjs = {};
        const haloObjs = {};
        const pickObjs = {};
        const pos = {};
        Object.keys(stations).forEach(function(name) {
            const d = stations[name];
            const p = mapTo3d(name);
            pos[name] = p;
            const isHome = (name === 'Sol');

            const specColor = SPEC_COLORS[d.spec] != null ? SPEC_COLORS[d.spec] : ROUTE_COLORS.uplb;
            const core = new THREE.Mesh(
                new THREE.SphereGeometry(isHome ? 1.8 : 1.1, 20, 14),
                new THREE.MeshBasicMaterial({color: specColor})
            );
            core.position.copy(p);
            core.userData = {name: name};
            scene.add(core);
            meshObjs[name] = core;

            const halo = new THREE.Mesh(
                new THREE.SphereGeometry(isHome ? 3.6 : 2.4, 16, 12),
                new THREE.MeshBasicMaterial({
                    color: ROUTE_COLORS[d.faction.toLowerCase()] || 0xffffff,
                    transparent: true, opacity: 0.14,
                    blending: THREE.AdditiveBlending, depthWrite: false
                })
            );
            halo.position.copy(p);
            scene.add(halo);
            haloObjs[name] = halo;

            // Invisible oversized sphere so taps/clicks reliably land
            const pick = new THREE.Mesh(
                new THREE.SphereGeometry(6, 8, 6),
                new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false})
            );
            pick.position.copy(p);
            pick.userData = {name: name};
            scene.add(pick);
            pickObjs[name] = pick;
        });

        // HTML overlay labels projected each frame
        const labelEls = {};
        Object.keys(stations).forEach(function(name) {
            const d = stations[name];
            const el = document.createElement('div');
            el.className = 't3d-label';
            el.innerHTML =
                '<span class="t3d-name">' + esc(displayName(name)) + '</span>';
            el.addEventListener('click', function() { addStationToRoute(name); });
            labelsWrap.appendChild(el);
            labelEls[name] = el;
        });

        // Tap/click picking (distinguished from orbit drags)
        const raycaster = new THREE.Raycaster();
        let downPos = null;
        canvas.addEventListener('pointerdown', function(e) { downPos = {x: e.clientX, y: e.clientY}; });
        canvas.addEventListener('pointerup', function(e) {
            if (!downPos) return;
            const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
            downPos = null;
            if (moved > 6) return;
            const rect = canvas.getBoundingClientRect();
            const ndc = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycaster.setFromCamera(ndc, camera);
            const hits = raycaster.intersectObjects(Object.keys(pickObjs).map(function(k) { return pickObjs[k]; }));
            if (hits.length) addStationToRoute(hits[0].object.userData.name);
        });

        t3 = {
            active: false,
            wrap: wrap, canvas: canvas,
            renderer: renderer, scene: scene, camera: camera, controls: controls,
            meshObjs: meshObjs, haloObjs: haloObjs, lineObjs: lineObjs, glowObjs: glowObjs,
            routeHighlightColor: routeHighlightColor,
            selectionGlowObjs: selectionGlowObjs,
            labelEls: labelEls, pos: pos,
            width: 1, height: 1, rafId: null, tmp: new THREE.Vector3()
        };

        resize3d();
    }

    function resize3d() {
        if (!t3) return;
        const container = document.getElementById('map-container');
        const w = container.clientWidth || 800;
        const h = container.clientHeight || 600;
        t3.width = w;
        t3.height = h;
        t3.renderer.setSize(w, h, false);
        t3.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        t3.camera.aspect = w / h;
        t3.camera.updateProjectionMatrix();
    }

    function render3d() {
        if (!t3 || !t3.active) return;
        t3.rafId = requestAnimationFrame(render3d);
        t3.controls.positionCamera();

        t3.renderer.render(t3.scene, t3.camera);

        // Project labels
        Object.keys(t3.labelEls).forEach(function(name) {
            const el = t3.labelEls[name];
            t3.tmp.copy(t3.pos[name]);
            t3.tmp.project(t3.camera);
            if (t3.tmp.z > 1 || t3.tmp.z < -1) {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'block';
            const sx = (t3.tmp.x * 0.5 + 0.5) * t3.width;
            const sy = (-t3.tmp.y * 0.5 + 0.5) * t3.height;
            const dist = t3.camera.position.distanceTo(t3.pos[name]);
            el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-130%)';
            el.style.opacity = Math.max(0.35, Math.min(1, 1.7 - dist / 600)).toFixed(2);
        });
    }

    function apply3dSelection() {
        if (!t3) return;
        Object.keys(t3.meshObjs).forEach(function(name) {
            const d = stations[name];
            let color = SPEC_COLORS[d.spec] != null ? SPEC_COLORS[d.spec] : 0x4a9eff;
            if (plannedRoute.indexOf(name) !== -1) {
                color = (name === plannedRoute[plannedRoute.length - 1]) ? 0x00ffff : 0xbf00ff;
            }
            t3.meshObjs[name].material.color.setHex(color);
        });
        // Active legs come from the hop expansion, not raw picks
        const activeHops = {};
        plannedHops().forEach(function(hop) {
            if (!hop || hop.noRoute) return;
            activeHops[hop.from + '|' + hop.to] = true;
            activeHops[hop.to + '|' + hop.from] = true;
        });
        Object.keys(t3.lineObjs).forEach(function(key) {
            const line = t3.lineObjs[key];
            const glow = t3.glowObjs ? t3.glowObjs[key] : null;
            const selectionGlow = t3.selectionGlowObjs ? t3.selectionGlowObjs[key] : null;
            const active = !!activeHops[key];
            const base = ROUTE_COLORS[line.userData.type] || 0xffffff;
            line.userData.active = active;
            // Selected legs: subway pink and drawn on top of everything so
            // they can't hide behind halos, grid, or other geometry.
            line.material.opacity = active ? 1 : 0.5;
            if (active) line.material.color.copy(t3.routeHighlightColor);
            else line.material.color.setHex(base);
            line.material.depthTest = !active;
            line.renderOrder = active ? 999 : 0;
            if (glow) {
                glow.userData.active = active;
                glow.material.opacity = active ? 0.6 : 0.22;
                if (active) glow.material.color.copy(t3.routeHighlightColor);
                else glow.material.color.setHex(base);
                glow.material.depthTest = !active;
                glow.renderOrder = active ? 998 : 0;
            }
            if (selectionGlow) selectionGlow.visible = active;
        });

        // Traveling pulse beacons removed — static highlight only.
        t3.activeLegs = [];
    }

    function activate3d() {
        if (!t3) return;
        t3.wrap.style.display = 'block';
        svg.style.display = 'none';
        document.getElementById('map-container').classList.add('mode-3d');
        t3.active = true;
        resize3d();
        apply3dSelection();
        render3d();
    }

    function deactivate3d() {
        if (!t3 || !t3.active) return;
        t3.active = false;
        if (t3.rafId) cancelAnimationFrame(t3.rafId);
        t3.wrap.style.display = 'none';
        svg.style.display = 'block';
        document.getElementById('map-container').classList.remove('mode-3d');
    }

    // ═══════════════════════════════════════════════════════════════
    // BOOT + PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TransitMap = {
        clearRoute: clearRoute,
        getPlannedRoute: function() { return plannedRoute.slice(); },
        getStations: function() { return Object.assign({}, stations); },
        getRoutes: function() { return routes.slice(); },
        getRoutingMode: function() { return routingMode; },
        getResolvedHops: function() { return plannedHops().map(function(hop) { return Object.assign({}, hop); }); },
        addStation: addStationToRoute,
        setRoutingMode: setRoutingMode,
        setViewMode: setMode
    };

    // Expose clearRoute globally for onclick
    window.clearRoute = clearRoute;

})();
