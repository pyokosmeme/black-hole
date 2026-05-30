        // Schematic positions optimized for readability
        const stations = {
            'Sol': {x: 800, y: 500, pop: 10440, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
            'Gamov': {x: 950, y: 300, pop: 631, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
            'Wolf': {x: 650, y: 250, pop: 432, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
            'Luyten': {x: 500, y: 400, pop: 322, faction: 'UPLB', labelOffset: {x: -60, y: 0}},
            'Gowjin': {x: 500, y: 600, pop: 317, faction: 'UPLB', labelOffset: {x: -60, y: 0}},
            'Issetock': {x: 650, y: 700, pop: 283, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
            'Nursia': {x: 950, y: 700, pop: 411, faction: 'UPLB', labelOffset: {x: 0, y: 25}},
            'Bakunawa': {x: 800, y: 150, pop: 215, faction: 'UPLB', labelOffset: {x: 0, y: -25}},
            'Vega': {x: 1150, y: 450, pop: 262, faction: 'SWI', labelOffset: {x: 60, y: 0}},
            'Ya Ke': {x: 1400, y: 350, pop: 579, faction: 'SWI', labelOffset: {x: 60, y: 0}},
            'Zi Wei Yuan': {x: 1400, y: 600, pop: 259, faction: 'SWI', labelOffset: {x: 60, y: 0}},
            'Sipapu': {x: 1150, y: 700, pop: 254, faction: 'SWI', labelOffset: {x: 60, y: 0}},
            'Proxima': {x: 300, y: 700, pop: 397, faction: 'HW', labelOffset: {x: -60, y: 10}},
            'Rigil': {x: 400, y: 850, pop: 649, faction: 'HW', labelOffset: {x: 0, y: 25}},
            'Tartarus': {x: 250, y: 550, pop: 231, faction: 'HW', labelOffset: {x: -60, y: 0}},
            'Tau Ceti': {x: 550, y: 900, pop: 228, faction: 'HW', labelOffset: {x: 0, y: 25}},
            'Barnard': {x: 200, y: 850, pop: 455, faction: 'HW', labelOffset: {x: -60, y: 10}}
        };
        
        const routes = [
            {from: 'Sol', to: 'Gamov', proper: 55.58, tau: 6.0, fdr: 24, type: 'uplb'},
            {from: 'Sol', to: 'Wolf', proper: 19.17, tau: 1.92, fdr: 24, type: 'uplb'},
            {from: 'Sol', to: 'Luyten', proper: 17.32, tau: null, fdr: null, type: 'uplb'},
            {from: 'Sol', to: 'Gowjin', proper: 20.78, tau: null, fdr: null, type: 'uplb'},
            {from: 'Sol', to: 'Issetock', proper: 28.48, tau: null, fdr: null, type: 'uplb'},
            {from: 'Sol', to: 'Nursia', proper: 54.86, tau: null, fdr: null, type: 'uplb'},
            {from: 'Sol', to: 'Bakunawa', proper: 56.8, tau: null, fdr: null, type: 'uplb'},
            {from: 'Wolf', to: 'Gamov', proper: 31.55, tau: 3.128, fdr: 48, type: 'uplb'},
            {from: 'Vega', to: 'Ya Ke', proper: 87.23, tau: 12.25, fdr: 48, type: 'swi'},
            {from: 'Ya Ke', to: 'Sipapu', proper: 45.45, tau: 4.51, fdr: 24, type: 'swi'},
            {from: 'Gamov', to: 'Zi Wei Yuan', proper: 76.87, tau: 7.62, fdr: 24, type: 'swi'},
            {from: 'Zi Wei Yuan', to: 'Vega', proper: 82.87, tau: 8.22, fdr: 10, type: 'swi'},
            {from: 'Sol', to: 'Proxima', proper: 5.90, tau: 1.0, fdr: 20, type: 'hw'},
            {from: 'Sol', to: 'Rigil', proper: 5.90, tau: 1.0, fdr: 20, type: 'hw'},
            {from: 'Sol', to: 'Tartarus', proper: 15.13, tau: 1.51, fdr: 24, type: 'hw'},
            {from: 'Sol', to: 'Tau Ceti', proper: 16.5, tau: null, fdr: null, type: 'hw'},
            {from: 'Sol', to: 'Barnard', proper: 8.31, tau: null, fdr: null, type: 'hw'},
            {from: 'Sol', to: 'Vega', proper: 35.43, tau: 3.54, fdr: 10, type: 'inter'},
            {from: 'Wolf', to: 'Vega', proper: 21.69, tau: 2.99, fdr: 1, type: 'inter'},
            {from: 'Gamov', to: 'Vega', proper: 74.18, tau: 7.35, fdr: 48, type: 'inter'},
            {from: 'Gamov', to: 'Ya Ke', proper: 76.22, tau: 7.56, fdr: 20, type: 'inter'},
            {from: 'Gamov', to: 'Sipapu', proper: 40.48, tau: 4.01, fdr: 4, type: 'inter'},
            {from: 'Sol', to: 'Ya Ke', proper: 89.5, tau: 8.95, fdr: 48, type: 'inter'},
            {from: 'Sol', to: 'Zi Wei Yuan', proper: 94.48, tau: 9.45, fdr: 10, type: 'inter'},
            {from: 'Sol', to: 'Sipapu', proper: 56.97, tau: 5.697, fdr: 24, type: 'inter'}
        ];
        
        const svg = document.getElementById('transit-map');
        let plannedRoute = [];
        let routeCircles = {};
        let routeLines = {};
        
        // Draw routes
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
        
        // Draw stations
        Object.entries(stations).forEach(([name, data]) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.classList.add('station-group');
            
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.classList.add('station-circle');
            circle.setAttribute('cx', data.x);
            circle.setAttribute('cy', data.y);
            circle.setAttribute('r', 9);
            circle.setAttribute('fill', '#0a0a1a');
            circle.setAttribute('stroke', 
                data.faction === 'UPLB' ? '#4a9eff' : 
                data.faction === 'SWI' ? '#51cf66' : '#a78bfa');
            circle.setAttribute('stroke-width', 3);
            
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
            
            g.appendChild(circle);
            g.appendChild(label);
            g.appendChild(sublabel);
            svg.appendChild(g);
            
            g.addEventListener('click', (e) => {
                e.stopPropagation();
                addStationToRoute(name);
            });
        });
        
        function addStationToRoute(stationName) {
            // If clicking the same station as last, do nothing
            if (plannedRoute.length > 0 && plannedRoute[plannedRoute.length - 1] === stationName) {
                return;
            }
            
            // If this is the first station or directly connected, just add it
            if (plannedRoute.length === 0) {
                plannedRoute.push(stationName);
            } else {
                const lastStation = plannedRoute[plannedRoute.length - 1];
                const directRoute = findRoute(lastStation, stationName);
                
                if (directRoute) {
                    // Direct connection exists
                    plannedRoute.push(stationName);
                } else {
                    // No direct connection - find a path
                    const path = findPath(lastStation, stationName);
                    if (path && path.length > 0) {
                        // Add all intermediate stations
                        path.forEach(station => {
                            if (station !== lastStation) {
                                plannedRoute.push(station);
                            }
                        });
                    } else {
                        // No path found, add anyway (will show as no route)
                        plannedRoute.push(stationName);
                    }
                }
            }
            
            updateRouteDisplay();
        }
        
        function findPath(start, end) {
            // BFS to find shortest path
            const queue = [[start]];
            const visited = new Set([start]);
            
            while (queue.length > 0) {
                const path = queue.shift();
                const current = path[path.length - 1];
                
                if (current === end) {
                    return path;
                }
                
                // Find all neighbors
                const neighbors = routes
                    .filter(r => r.from === current || r.to === current)
                    .map(r => r.from === current ? r.to : r.from)
                    .filter(n => !visited.has(n));
                
                for (const neighbor of neighbors) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
            
            return null; // No path found
        }
        
        function clearRoute() {
            plannedRoute = [];
            updateRouteDisplay();
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
        
        function updateRouteDisplay() {
            // Update circle styles
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
            
            // Update line styles
            Object.values(routeLines).forEach(line => {
                line.classList.remove('active');
            });
            
            for (let i = 0; i < plannedRoute.length - 1; i++) {
                const key = `${plannedRoute[i]}-${plannedRoute[i + 1]}`;
                if (routeLines[key]) {
                    routeLines[key].classList.add('active');
                }
            }
            
            // Update bottom panel
            const routeContent = document.getElementById('route-content');
            
            if (plannedRoute.length === 0) {
                routeContent.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🚀</div>
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
            let hasIncomplete = false;
            
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
                    hasIncomplete = true;
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
                            <div class="leg-item" style="border-left-color: #ff6b6b;">
                                <div class="leg-route">${idx + 1}. ${leg.from} → ${leg.to}</div>
                                <div class="leg-times" style="color: #ff6b6b;">No direct route available</div>
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
