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
        // UPLB Systems
        'Sol':        {x: 800,  y: 500, real: 'Sol', spec: 'G-Type', pop: 10440, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Gamov':      {x: 950,  y: 300, real: 'Copernicus (55 Cancri A)', spec: 'G-Type', pop: 630.6, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Cancri 55 B':{x: 1040, y: 340, real: '55 Cancri B', spec: 'Red Dwarf', pop: 3.8, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
        'Wolf':       {x: 650,  y: 250, real: 'Wolf 1061', spec: 'Red Dwarf', pop: 432, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Luyten':     {x: 500,  y: 400, real: "Luyten's Star", spec: 'Red Dwarf', pop: 322, faction: 'UPLB', labelOffset: {x: -60, y: 0}},
        'Gowjin':     {x: 500,  y: 600, real: 'Gliese 876', spec: 'Red Dwarf', pop: 317, faction: 'UPLB', labelOffset: {x: -60, y: 0}},
        'Issetock':   {x: 650,  y: 700, real: 'Gliese 581', spec: 'Red Dwarf', pop: 28.3, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
        'Nursia':     {x: 950,  y: 700, real: 'TRAPPIST-1', spec: 'Red Dwarf', pop: 411, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
        'Bakunawa':   {x: 800,  y: 150, real: 'LHS 1140', spec: 'Red Dwarf', pop: 215, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        // SWI Systems
        'Vega':       {x: 1150, y: 450, real: 'Vega', spec: 'A-Type (Blue Dwarf)', pop: 262, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Ya Ke':      {x: 1400, y: 350, real: 'Nu2 Canis Majoris', spec: 'K-Type Giant', pop: 579.4, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Zi Wei Yuan':{x: 1400, y: 600, real: 'HD 33564', spec: 'Yellow-White Dwarf', pop: 258.6, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Sipapu':     {x: 1150, y: 700, real: 'HD 69830 (285 G. Puppis)', spec: 'Yellow Dwarf', pop: 254, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        // Homeworlds Systems
        'Proxima':    {x: 300,  y: 700, real: 'Proxima Centauri', spec: 'Red Dwarf', pop: 397, faction: 'HW', label: 'Proxima Astraeus', labelOffset: {x: -60, y: 10}},
        'Rigil':      {x: 400,  y: 850, real: 'Alpha Centauri A', spec: 'G-Type', pop: 649, faction: 'HW', labelOffset: {x: -50, y: 25}},
        'Toliman':    {x: 480,  y: 820, real: 'Alpha Centauri B', spec: 'K-Type', pop: 7, faction: 'HW', labelOffset: {x: 0, y: -25}},
        'Tartarus':   {x: 250,  y: 550, real: 'Ross 128', spec: 'Red Dwarf', pop: 231, faction: 'HW', labelOffset: {x: -60, y: 0}},
        'Tau Ceti':   {x: 550,  y: 900, real: 'Tian Cang (Tau Ceti)', spec: 'G-Type', pop: 228.3, faction: 'HW', labelOffset: {x: 0, y: 25}},
        'Barnard':    {x: 200,  y: 850, real: "Barnard's Star", spec: 'Red Dwarf', pop: 454.7, faction: 'HW', labelOffset: {x: -60, y: 10}}
    };

    // ═══════════════════════════════════════════════════════════════
    // ROUTE DATA
    // ═══════════════════════════════════════════════════════════════

    const routes = [
        // UPLB routes
        {from: 'Sol', to: 'Gamov', proper: 55.58, tau: 6.0, fdr: 24, type: 'uplb'},
        {from: 'Sol', to: 'Wolf', proper: 19.17, tau: 1.92, fdr: 24, type: 'uplb'},
        {from: 'Sol', to: 'Luyten', proper: 17.32, tau: null, fdr: null, type: 'uplb'},
        {from: 'Sol', to: 'Gowjin', proper: 20.78, tau: null, fdr: null, type: 'uplb'},
        {from: 'Sol', to: 'Issetock', proper: 28.48, tau: null, fdr: null, type: 'uplb'},
        {from: 'Sol', to: 'Nursia', proper: 54.86, tau: null, fdr: null, type: 'uplb'},
        {from: 'Sol', to: 'Bakunawa', proper: 56.8, tau: null, fdr: null, type: 'uplb'},
        {from: 'Wolf', to: 'Gamov', proper: 31.55, tau: 3.128, fdr: 48, type: 'uplb'},
        {from: 'Gamov', to: 'Cancri 55 B', proper: 0.2, tau: null, fdr: null, type: 'uplb'},

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
        {from: 'Sol', to: 'Tau Ceti', proper: 16.5, tau: null, fdr: null, type: 'inter'},
        {from: 'Sol', to: 'Barnard', proper: 8.31, tau: null, fdr: null, type: 'inter'},

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

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const FACTION_COLORS = {UPLB: '#4a9eff', SWI: '#51cf66', HW: '#a78bfa'};
    const ROUTE_COLORS = {uplb: 0x4a9eff, swi: 0x51cf66, hw: 0xa78bfa, inter: 0xfbbf24};
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
        initPanZoom();
        drawRoutes();
        drawStations();

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
            '<button id="btn-3d" class="map-btn" type="button" aria-pressed="false">◈ 3D MAP</button>';
        container.appendChild(bar);

        const zoom = document.createElement('div');
        zoom.className = 'zoom-controls';
        zoom.innerHTML =
            '<button class="zoom-btn" id="zoom-in" type="button" aria-label="Zoom in">+</button>' +
            '<button class="zoom-btn" id="zoom-out" type="button" aria-label="Zoom out">−</button>' +
            '<button class="zoom-btn" id="zoom-reset" type="button" aria-label="Reset view">⌂</button>';
        container.appendChild(zoom);

        const hint = document.createElement('div');
        hint.className = 'map-hint';
        hint.textContent = 'WORLD NAME / CATALOG STAR · PINCH OR SCROLL TO ZOOM · DRAG TO PAN';
        container.appendChild(hint);

        document.getElementById('btn-2d').addEventListener('click', function() { setMode('2d'); });
        document.getElementById('btn-3d').addEventListener('click', function() { setMode('3d'); });
        document.getElementById('zoom-in').addEventListener('click', function() { zoomBy(1.35, svg.clientWidth / 2, svg.clientHeight / 2); });
        document.getElementById('zoom-out').addEventListener('click', function() { zoomBy(1 / 1.35, svg.clientWidth / 2, svg.clientHeight / 2); });
        document.getElementById('zoom-reset').addEventListener('click', resetView);

        updateModeButtons();
    }

    function updateModeButtons() {
        const b2 = document.getElementById('btn-2d');
        const b3 = document.getElementById('btn-3d');
        if (!b2 || !b3) return;
        b2.classList.toggle('active', mapMode === '2d');
        b3.classList.toggle('active', mapMode === '3d');
        b2.setAttribute('aria-pressed', mapMode === '2d');
        b3.setAttribute('aria-pressed', mapMode === '3d');
    }

    function setMode(mode, silent) {
        if (mode === mapMode && !silent) return;
        if (mode === '3d') {
            const b3 = document.getElementById('btn-3d');
            if (b3) { b3.textContent = '◈ LOADING…'; b3.disabled = true; }
            init3d(function(err) {
                if (b3) { b3.textContent = '◈ 3D MAP'; b3.disabled = false; }
                if (err) {
                    console.error('[TransitMap] 3D mode unavailable:', err);
                    mapMode = '2d';
                    localStorage.setItem('transit-map-mode', '2d');
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
        updateModeButtons();
    }

    // ═══════════════════════════════════════════════════════════════
    // 2D PAN / ZOOM
    // ═══════════════════════════════════════════════════════════════

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
            e.preventDefault();
            const p = clientToSvg(e.clientX, e.clientY);
            zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
        }, {passive: false});

        svg.addEventListener('pointerdown', function(e) {
            dragState.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
            dragState.moved = 0;
            if (dragState.pointers.size === 1) {
                dragState.active = true;
                try { svg.setPointerCapture(e.pointerId); } catch (err) {}
            } else if (dragState.pointers.size === 2) {
                const pts = Array.from(dragState.pointers.values());
                dragState.lastDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                dragState.lastMid = {x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2};
            }
        });

        svg.addEventListener('pointermove', function(e) {
            if (!dragState.pointers.has(e.pointerId)) return;
            const prev = dragState.pointers.get(e.pointerId);
            dragState.moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
            dragState.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});

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

    function drawRoutes() {
        routes.forEach(function(route) {
            const from = stations[route.from];
            const to = stations[route.to];

            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
            line.classList.add('route-line', route.type + '-route');
            line.dataset.from = route.from;
            line.dataset.to = route.to;

            routeLines[route.from + '-' + route.to] = line;
            routeLines[route.to + '-' + route.from] = line;

            world.appendChild(line);
        });
    }

    function drawStations() {
        Object.keys(stations).forEach(function(name) {
            const data = stations[name];
            const g = document.createElementNS(SVG_NS, 'g');
            g.classList.add('station-group');

            const hitArea = document.createElementNS(SVG_NS, 'rect');
            hitArea.classList.add('station-hit-area');
            const hitX = data.x - 30 + Math.min(0, data.labelOffset.x);
            const hitY = data.y - 30 + Math.min(0, data.labelOffset.y);
            hitArea.setAttribute('x', hitX);
            hitArea.setAttribute('y', hitY);
            hitArea.setAttribute('width', 60 + Math.abs(data.labelOffset.x));
            hitArea.setAttribute('height', 60 + Math.abs(data.labelOffset.y));

            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.classList.add('station-circle', 'faction-' + data.faction.toLowerCase());
            circle.setAttribute('cx', data.x);
            circle.setAttribute('cy', data.y);
            circle.setAttribute('r', 9);

            routeCircles[name] = circle;

            const labelX = data.x + data.labelOffset.x;
            const labelY = data.y + data.labelOffset.y;
            const anchor = data.labelOffset.x > 0 ? 'start' : (data.labelOffset.x < 0 ? 'end' : 'middle');

            const label = document.createElementNS(SVG_NS, 'text');
            label.classList.add('station-label');
            label.setAttribute('x', labelX);
            label.setAttribute('y', labelY);
            label.setAttribute('text-anchor', anchor);
            label.textContent = displayName(name);

            // Catalog star + spectral class sublabel
            const real = document.createElementNS(SVG_NS, 'text');
            real.classList.add('station-reallabel');
            const realY = data.labelOffset.y < 0 ? labelY - 16 : (data.labelOffset.y > 0 ? labelY + 16 : labelY + 15);
            real.setAttribute('x', labelX);
            real.setAttribute('y', realY);
            real.setAttribute('text-anchor', anchor);
            real.textContent = '★ ' + data.real + ' · ' + data.spec;

            // Population sublabel
            const pop = document.createElementNS(SVG_NS, 'text');
            pop.classList.add('station-sublabel');
            const popY = data.labelOffset.y < 0 ? realY - 15 : realY + 15;
            pop.setAttribute('x', labelX);
            pop.setAttribute('y', popY);
            pop.setAttribute('text-anchor', anchor);
            pop.textContent = 'POP ' + fmtPop(data.pop);

            g.appendChild(hitArea);
            g.appendChild(circle);
            g.appendChild(label);
            g.appendChild(real);
            g.appendChild(pop);
            world.appendChild(g);

            g.addEventListener('click', function(e) {
                e.stopPropagation();
                if (dragState.moved > 8) return; // ignore click at end of a drag
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

        if (plannedRoute.length === 0) {
            plannedRoute.push(stationName);
        } else {
            const lastStation = plannedRoute[plannedRoute.length - 1];
            const directRoute = findRoute(lastStation, stationName);

            if (directRoute) {
                plannedRoute.push(stationName);
            } else {
                const path = findPath(lastStation, stationName);
                if (path && path.length > 0) {
                    path.forEach(function(station) {
                        if (station !== lastStation) plannedRoute.push(station);
                    });
                } else {
                    plannedRoute.push(stationName);
                }
            }
        }

        updateRouteDisplay();
    }

    function findPath(start, end) {
        const queue = [[start]];
        const visited = new Set([start]);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (current === end) return path;

            routes
                .filter(function(r) { return r.from === current || r.to === current; })
                .map(function(r) { return r.from === current ? r.to : r.from; })
                .filter(function(n) { return !visited.has(n); })
                .forEach(function(neighbor) {
                    visited.add(neighbor);
                    queue.push(path.concat([neighbor]));
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

        for (let i = 0; i < plannedRoute.length - 1; i++) {
            const key = plannedRoute[i] + '-' + plannedRoute[i + 1];
            if (routeLines[key]) routeLines[key].classList.add('active');
        }

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
        const legs = [];

        for (let i = 0; i < plannedRoute.length - 1; i++) {
            const route = findRoute(plannedRoute[i], plannedRoute[i + 1]);
            if (route) {
                totalProper += route.proper;
                totalTau += route.tau || 0;
                totalFdr += route.fdr || 0;
                legs.push(Object.assign({from: plannedRoute[i], to: plannedRoute[i + 1]}, route));
            } else {
                legs.push({from: plannedRoute[i], to: plannedRoute[i + 1], noRoute: true});
            }
        }

        if (plannedRoute.length > 1) {
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

            if (totalFdr > 0) {
                html +=
                    '<div class="total-box">' +
                    '<div class="total-label">Total FDR Burn</div>' +
                    '<div class="total-value">' + totalFdr.toFixed(1) + '<span class="total-unit">hours</span></div>' +
                    '</div>';
            }
            html += '</div>';

            html += '<div class="leg-details">';
            html += '<h3>ROUTE SEGMENTS</h3>';
            legs.forEach(function(leg, idx) {
                const fromName = esc(displayName(leg.from));
                const toName = esc(displayName(leg.to));
                if (leg.noRoute) {
                    html +=
                        '<div class="leg-item" style="border-left-color: var(--pink);">' +
                        '<div class="leg-route">' + (idx + 1) + '. ' + fromName + ' → ' + toName + '</div>' +
                        '<div class="leg-times" style="color: var(--pink);">No direct route available</div>' +
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
                            '<div class="leg-time"><span class="leg-time-label">FDR:</span>' +
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
    // 3D MAP MODE (three.js r73 + OrbitControls from js-libs)
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
        if (window.THREE && window.THREE.OrbitControls) { cb(null); return; }
        if (!window.THREE) {
            loadScript('js-libs/three.min.js', function(err) {
                if (err) { cb(err); return; }
                ensureThree(cb);
            });
            return;
        }
        loadScript('js-libs/OrbitControls.js', cb);
    }

    function mapTo3d(x, y) {
        return new THREE.Vector3((x - 800) / 30, 0, (y - 500) / 30);
    }

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
        camera.position.set(0, 190, 300);

        const controls = new THREE.OrbitControls(camera, canvas);
        controls.minDistance = 30;
        controls.maxDistance = 1000;

        // Starfield backdrop
        const starGeo = new THREE.Geometry();
        for (let i = 0; i < 700; i++) {
            const v = new THREE.Vector3(
                Math.random() * 2400 - 1200,
                Math.random() * 1200 - 400,
                Math.random() * 2400 - 1200
            );
            if (v.length() > 150) starGeo.vertices.push(v);
        }
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
            color: 0x88aaff, size: 1.6, transparent: true, opacity: 0.6
        })));

        // Nav grid plane
        scene.add(new THREE.GridHelper(180, 36, 0x4a1868, 0x2a0a3a));

        // Route lines
        const lineObjs = {};
        routes.forEach(function(route) {
            const from = stations[route.from];
            const to = stations[route.to];
            const geo = new THREE.Geometry();
            geo.vertices.push(mapTo3d(from.x, from.y), mapTo3d(to.x, to.y));
            const mat = new THREE.LineBasicMaterial({
                color: ROUTE_COLORS[route.type], transparent: true, opacity: 0.3
            });
            const line = new THREE.Line(geo, mat);
            scene.add(line);
            lineObjs[route.from + '|' + route.to] = line;
            lineObjs[route.to + '|' + route.from] = line;
        });

        // Station spheres (core colored by spectral class, halo by faction)
        const meshObjs = {};
        const haloObjs = {};
        const pos = {};
        Object.keys(stations).forEach(function(name) {
            const d = stations[name];
            const p = mapTo3d(d.x, d.y);
            pos[name] = p;

            const specColor = SPEC_COLORS[d.spec] != null ? SPEC_COLORS[d.spec] : ROUTE_COLORS.uplb;
            const core = new THREE.Mesh(
                new THREE.SphereGeometry(name === 'Sol' ? 2.6 : 1.8, 20, 14),
                new THREE.MeshBasicMaterial({color: specColor})
            );
            core.position.copy(p);
            core.userData = {name: name};
            scene.add(core);
            meshObjs[name] = core;

            const halo = new THREE.Mesh(
                new THREE.SphereGeometry(name === 'Sol' ? 5.2 : 3.6, 16, 12),
                new THREE.MeshBasicMaterial({
                    color: ROUTE_COLORS[d.faction.toLowerCase()] || 0xffffff,
                    transparent: true, opacity: 0.14,
                    blending: THREE.AdditiveBlending, depthWrite: false
                })
            );
            halo.position.copy(p);
            scene.add(halo);
            haloObjs[name] = halo;
        });

        // HTML overlay labels projected each frame
        const labelEls = {};
        Object.keys(stations).forEach(function(name) {
            const d = stations[name];
            const el = document.createElement('div');
            el.className = 't3d-label';
            el.innerHTML =
                '<span class="t3d-name">' + esc(displayName(name)) + '</span>' +
                '<span class="t3d-real">★ ' + esc(d.real) + ' · ' + esc(fmtPop(d.pop)) + '</span>';
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
            const hits = raycaster.intersectObjects(Object.keys(meshObjs).map(function(k) { return meshObjs[k]; }));
            if (hits.length) addStationToRoute(hits[0].object.userData.name);
        });

        t3 = {
            active: false,
            wrap: wrap, canvas: canvas,
            renderer: renderer, scene: scene, camera: camera, controls: controls,
            meshObjs: meshObjs, haloObjs: haloObjs, lineObjs: lineObjs,
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
        t3.controls.update();
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
        Object.keys(t3.lineObjs).forEach(function(key) {
            const line = t3.lineObjs[key];
            const parts = key.split('|');
            let active = false;
            for (let i = 0; i < plannedRoute.length - 1; i++) {
                if (plannedRoute[i] === parts[0] && plannedRoute[i + 1] === parts[1]) active = true;
            }
            line.material.opacity = active ? 1 : 0.3;
        });
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
        addStation: addStationToRoute,
        setViewMode: setMode
    };

    // Expose clearRoute globally for onclick
    window.clearRoute = clearRoute;

})();
