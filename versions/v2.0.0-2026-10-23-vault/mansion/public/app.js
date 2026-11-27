const map = L.map('map').setView([34.0522, -118.2437], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

// Unified UI update
function updateIntelligence(content) {
    document.getElementById('intelligenceContent').innerHTML = content;
}

async function safeFetch(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
        return await res.json();
    } catch (err) {
        console.error('Fetch error:', err);
        updateIntelligence(`<span class="text-red-400">Error: ${err.message}</span>`);
        return null;
    }
}

async function loadTelemetry() {
    const data = await safeFetch('/api/telemetry');
    if (!data) return;
    const telDiv = document.getElementById('telemetry');
    telDiv.innerHTML = `
        <p>CPU Load: ${data.system.cpuUsage[0].toFixed(2)}</p>
        <p>Free Memory: ${(data.system.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB</p>
        <p>Log Entries: ${data.dbMetrics.interactionCount}</p>
        <p class="mt-2 font-bold text-white">Instance: ${window.location.port}</p>
    `;
}

async function loadData() {
    updateIntelligence('Loading map data...');
    const matches = await safeFetch('/api/matches');
    if (!matches) return;
    
    const body = document.getElementById('matchesBody');
    body.innerHTML = '';
    
    matches.forEach(m => {
        L.marker([m.latitude, m.longitude]).addTo(map)
          .bindPopup(`Score: ${m.distress_score}<br>${m.address}`);
        
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-800';
        row.innerHTML = `
            <td class="p-3">${m.address}</td>
            <td class="p-3 font-mono text-purple-400">${m.distress_score}</td>
            <td class="p-3">${m.acquisition_pathway}</td>
            <td class="p-3 space-x-1">
                <button onclick="runAnalysis(${m.id})" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">Analyze</button>
                <button onclick="runPrediction(${m.id})" class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">Predict</button>
                <button onclick="sendOutreach('${m.owner_name}', '${m.address}')" class="text-xs bg-purple-700 hover:bg-purple-600 px-2 py-1 rounded">Outreach</button>
            </td>
        `;
        body.appendChild(row);
    });
    updateIntelligence('Dashboard loaded.');
}

async function loadNearbyProperties() {
    updateIntelligence('Locating...');
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const data = await safeFetch(`/api/properties/nearby?lat=${latitude}&lng=${longitude}`);
        if (!data) return;
        updateIntelligence('<h3>Closest Abandoned Assets</h3>' + data.map(p => `<p class="border-b border-gray-700 py-1">${p.address} <span class="text-xs text-gray-500">(Dist: ${p.distance.toFixed(4)})</span></p>`).join(''));
    }, (err) => {
        updateIntelligence(`<span class="text-red-400">Geolocation failed: ${err.message}</span>`);
    });
}

async function runAnalysis(id) {
    updateIntelligence('Analyzing structure...');
    const data = await safeFetch(`/api/property/analysis/${id}`);
    if (data) updateIntelligence(`<pre class="text-xs">${JSON.stringify(data, null, 2)}</pre>`);
}

async function runPrediction(id) {
    updateIntelligence('Predicting...');
    const data = await safeFetch(`/api/property/predict/${id}`);
    if (data) updateIntelligence(`Abandonment Probability: <strong class="text-xl">${(data.probability * 100).toFixed(1)}%</strong>`);
}

async function sendOutreach(ownerName, address) {
    updateIntelligence('Generating outreach...');
    const data = await safeFetch('/api/outreach', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ownerName, address })
    });
    if (data) alert(data.message);
    updateIntelligence('Outreach generated.');
}

async function runSearch() {
    const query = document.getElementById('searchQuery').value;
    updateIntelligence('Searching...');
    const data = await safeFetch('/api/search', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ query })
    });
    if (data) updateIntelligence(`<pre class="text-xs">${JSON.stringify(data, null, 2)}</pre>`);
}

loadTelemetry();
loadData();
