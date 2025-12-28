/**
 * TRANSIT MAP - Inhabited Space Route Planner
 * 
 * K-Tube transit network visualization and route planning
 * for the EXU universe (2370 SolUT)
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // STATION DATA
    // ═══════════════════════════════════════════════════════════════

    const stations = {
        // UPLB Systems
        'Sol': {x: 800, y: 500, pop: 10440, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Gamov': {x: 950, y: 300, pop: 631, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Wolf': {x: 650, y: 250, pop: 432, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        'Luyten': {x: 500, y: 400, pop: 322, faction: 'UPLB', labelOffset: {x: -60, y: 0}},
        'Gowjin': {x: 500, y: 600, pop: 317, faction: 'UPLB', labelOffset: {x: -60, y: 0}},
        'Issetock': {x: 650, y: 700, pop: 283, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
        'Nursia': {x: 950, y: 700, pop: 411, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
        'Bakunawa': {x: 800, y: 150, pop: 215, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
        // SWI Systems
        'Vega': {x: 1150, y: 450, pop: 262, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Ya Ke': {x: 1400, y: 350, pop: 579, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Zi Wei Yuan': {x: 1400, y: 600, pop: 259, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        'Sipapu': {x: 1150, y: 700, pop: 254, faction: 'SWI', labelOffset: {x: 60, y: 0}},
        // Homeworlds Systems
        'Proxima': {x: 300, y: 700, pop: 397, faction: 'HW', labelOffset: {x: -60, y: 10}},
        'Rigil': {x: 400, y: 850, pop: 649, faction: 'HW', labelOffset: {x: -50, y: 25}},
        'Toliman': {x: 480, y: 820, pop: 7, faction: 'HW', labelOffset: {x: 0, y: -25}},
        'Tartarus': {x: 250, y: 550, pop: 231, faction: 'HW', labelOffset: {x: -60, y: 0}},
        'Tau Ceti': {x: 550, y: 900, pop: 228, faction: 'HW', labelOffset: {x: 0, y: 25}},
        'Barnard': {x: 200, y: 850, pop: 455, faction: 'HW', labelOffset: {x: -60, y: 10}}
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

    let svg = null;
    let plannedRoute = [];
    let routeCircles = {};
    let routeLines = {};

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    function init() {
        svg = document.getElementById('transit-map');
        if (!svg) {
            console.error('[TransitMap] SVG element #transit-map not found');
            return;
        }

        drawRoutes();
        drawStations();
        
        console.log('[TransitMap] Initialized with', Object.keys(stations).length, 'stations and', routes.length, 'routes');
    }

    // ═══════════════════════════════════════════════════════════════
    // DRAWING
    // ═══════════════════════════════════════════════════════════════

    function drawRoutes() {
        routes.forEach((route, idx) => {
            const from = stations[route.from];
            const to = stations[route.to];
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
            line.classList.add('route-line', `${route.type}-route`);
            line.dataset.from = route.from;
            line.dataset.to = route.to;
            
            const key = `${route.from}-${route.to}`;
            routeLines[key] = line;
            const reverseKey = `${route.to}-${route.from}`;
            routeLines[reverseKey] = line;
            
            svg.appendChild(line);
        });
    }

    function drawStations() {
        Object.entries(stations).forEach(([name, data]) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.classList.add('station-group');
            
            // Large invisible hit area for easier clicking
            const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            hitArea.classList.add('station-hit-area');
            const hitX = data.x - 30 + Math.min(0, data.labelOffset.x);
            const hitY = data.y - 30 + Math.min(0, data.labelOffset.y);
            const hitW = 60 + Math.abs(data.labelOffset.x);
            const hitH = 60 + Math.abs(data.labelOffset.y);
            hitArea.setAttribute('x', hitX);
            hitArea.setAttribute('y', hitY);
            hitArea.setAttribute('width', hitW);
            hitArea.setAttribute('height', hitH);
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.classList.add('station-circle', `faction-${data.faction.toLowerCase()}`);
            circle.setAttribute('cx', data.x);
            circle.setAttribute('cy', data.y);
            circle.setAttribute('r', 9);
            
            routeCircles[name] = circle;
            
            const labelX = data.x + data.labelOffset.x;
            const labelY = data.y + data.labelOffset.y;
            
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('station-label');
            label.setAttribute('x', labelX);
            label.setAttribute('y', labelY);
            label.setAttribute('text-anchor', data.labelOffset.x > 0 ? 'start' : data.labelOffset.x < 0 ? 'end' : 'middle');
            label.textContent = name;
            
            const sublabelY = data.labelOffset.y < 0 ? labelY - 15 : labelY + 15;
            const sublabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            sublabel.classList.add('station-sublabel');
            sublabel.setAttribute('x', labelX);
            sublabel.setAttribute('y', sublabelY);
            sublabel.setAttribute('text-anchor', data.labelOffset.x > 0 ? 'start' : data.labelOffset.x < 0 ? 'end' : 'middle');
            sublabel.textContent = `${data.pop}M`;
            
            g.appendChild(hitArea);
            g.appendChild(circle);
            g.appendChild(label);
            g.appendChild(sublabel);
            svg.appendChild(g);
            
            g.addEventListener('click', (e) => {
                e.stopPropagation();
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
                    path.forEach(station => {
                        if (station !== lastStation) {
                            plannedRoute.push(station);
                        }
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
            
            if (current === end) {
                return path;
            }
            
            const neighbors = routes
                .filter(r => r.from === current || r.to === current)
                .map(r => r.from === current ? r.to : r.from)
                .filter(n => !visited.has(n));
            
            for (const neighbor of neighbors) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
        
        return null;
    }

    function findRoute(from, to) {
        let route = routes.find(r => 
            (r.from === from && r.to === to) || 
            (r.from === to && r.to === from)
        );
        
        if (route && route.from !== from) {
            return {...route, from: to, to: from};
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
        // Update station circles
        Object.entries(routeCircles).forEach(([name, circle]) => {
            circle.classList.remove('selected', 'in-route');
            if (plannedRoute.includes(name)) {
                if (name === plannedRoute[plannedRoute.length - 1]) {
                    circle.classList.add('selected');
                } else {
                    circle.classList.add('in-route');
                }
            }
        });
        
        // Update route lines
        Object.values(routeLines).forEach(line => {
            line.classList.remove('active');
        });
        
        for (let i = 0; i < plannedRoute.length - 1; i++) {
            const key = `${plannedRoute[i]}-${plannedRoute[i + 1]}`;
            if (routeLines[key]) {
                routeLines[key].classList.add('active');
            }
        }
        
        // Update route panel
        const routeContent = document.getElementById('route-content');
        if (!routeContent) return;
        
        if (plannedRoute.length === 0) {
            routeContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✧</div>
                    <div class="empty-state-text">Click stations on the map to plan your route</div>
                </div>
            `;
            return;
        }
        
        let html = '<div class="route-display">';
        plannedRoute.forEach((station, idx) => {
            html += `
                <div class="route-stop">
                    <div class="stop-number">${idx + 1}</div>
                    <div class="stop-name">${station}</div>
                </div>
            `;
            if (idx < plannedRoute.length - 1) {
                html += '<div class="stop-arrow">→</div>';
            }
        });
        html += '</div>';
        
        // Calculate totals
        let totalProper = 0;
        let totalTau = 0;
        let totalFdr = 0;
        let legs = [];
        
        for (let i = 0; i < plannedRoute.length - 1; i++) {
            const route = findRoute(plannedRoute[i], plannedRoute[i + 1]);
            if (route) {
                totalProper += route.proper;
                totalTau += route.tau || 0;
                totalFdr += route.fdr || 0;
                legs.push({
                    from: plannedRoute[i],
                    to: plannedRoute[i + 1],
                    ...route
                });
            } else {
                legs.push({
                    from: plannedRoute[i],
                    to: plannedRoute[i + 1],
                    noRoute: true
                });
            }
        }
        
        if (plannedRoute.length > 1) {
            html += '<div class="totals-section">';
            html += `
                <div class="total-box">
                    <div class="total-label">Total Proper Time</div>
                    <div class="total-value">${totalProper.toFixed(1)}<span class="total-unit">days</span></div>
                </div>
            `;
            
            if (totalTau > 0) {
                html += `
                    <div class="total-box">
                        <div class="total-label">Total Tau Time</div>
                        <div class="total-value">${totalTau.toFixed(1)}<span class="total-unit">hours</span></div>
                    </div>
                `;
            }
            
            if (totalFdr > 0) {
                html += `
                    <div class="total-box">
                        <div class="total-label">Total FDR Burn</div>
                        <div class="total-value">${totalFdr.toFixed(1)}<span class="total-unit">hours</span></div>
                    </div>
                `;
            }
            html += '</div>';
            
            // Leg details
            html += '<div class="leg-details">';
            html += '<h3>ROUTE SEGMENTS</h3>';
            legs.forEach((leg, idx) => {
                if (leg.noRoute) {
                    html += `
                        <div class="leg-item" style="border-left-color: var(--pink);">
                            <div class="leg-route">${idx + 1}. ${leg.from} → ${leg.to}</div>
                            <div class="leg-times" style="color: var(--pink);">No direct route available</div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="leg-item">
                            <div class="leg-route">${idx + 1}. ${leg.from} → ${leg.to}</div>
                            <div class="leg-times">
                                <div class="leg-time">
                                    <span class="leg-time-label">Proper:</span>
                                    <span class="leg-time-value">${leg.proper.toFixed(1)}d</span>
                                </div>
                    `;
                    if (leg.tau) {
                        html += `
                                <div class="leg-time">
                                    <span class="leg-time-label">Tau:</span>
                                    <span class="leg-time-value">${leg.tau.toFixed(1)}h</span>
                                </div>
                        `;
                    }
                    if (leg.fdr) {
                        html += `
                                <div class="leg-time">
                                    <span class="leg-time-label">FDR:</span>
                                    <span class="leg-time-value">${leg.fdr.toFixed(1)}h</span>
                                </div>
                        `;
                    }
                    html += `
                            </div>
                        </div>
                    `;
                }
            });
            html += '</div>';
        }
        
        routeContent.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    window.TransitMap = {
        clearRoute: clearRoute,
        getPlannedRoute: () => [...plannedRoute],
        getStations: () => ({...stations}),
        getRoutes: () => [...routes],
        addStation: addStationToRoute
    };

    // Expose clearRoute globally for onclick
    window.clearRoute = clearRoute;

})();
