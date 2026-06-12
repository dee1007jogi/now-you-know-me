const fs = require('fs');

const htmlFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\admin.html';
const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\admin.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

// ---- PATCH HTML ----
const oldHeader = `<div class="column-header">
                                <h3>📊 Ranking List</h3>
                                <span id="playerCountText" style="font-size: 0.75rem; color: rgba(255,255,255,0.4); font-weight: 800;">0 Agents</span>
                            </div>`;

const newHeader = `<div class="column-header" style="flex-direction: column; align-items: stretch; gap: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h3>📊 Ranking List</h3>
                                    <span id="playerCountText" style="font-size: 0.75rem; color: rgba(255,255,255,0.4); font-weight: 800;">0 Agents</span>
                                </div>
                                <div class="leaderboard-filters" style="display:flex; gap:10px;">
                                    <button class="filter-btn active" style="flex:1; background:var(--neon-cyan); color:var(--navy-deep); border:none; padding:5px; border-radius:5px; font-weight:700; font-size:0.75rem; cursor:pointer;" onclick="setLeaderboardFilter('all', this)">All</button>
                                    <button class="filter-btn" style="flex:1; background:rgba(255,255,255,0.05); color:white; border:none; padding:5px; border-radius:5px; font-weight:700; font-size:0.75rem; cursor:pointer;" onclick="setLeaderboardFilter('ready', this)">Answers</button>
                                    <button class="filter-btn" style="flex:1; background:rgba(255,255,255,0.05); color:white; border:none; padding:5px; border-radius:5px; font-weight:700; font-size:0.75rem; cursor:pointer;" onclick="setLeaderboardFilter('pending', this)">Names Only</button>
                                </div>
                            </div>`;

html = html.replace(oldHeader, newHeader);
fs.writeFileSync(htmlFile, html);

// ---- PATCH JS ----

const filterFunctions = `
// --- Leaderboard Filters ---
window.currentLeaderboardFilter = 'all';

window.setLeaderboardFilter = function(filter, btn) {
    window.currentLeaderboardFilter = filter;
    
    // Update button styles
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(b => {
        b.style.background = 'rgba(255,255,255,0.05)';
        b.style.color = 'white';
    });
    btn.style.background = 'var(--neon-cyan)';
    btn.style.color = 'var(--navy-deep)';

    // Rerender
    if (window.renderLeaderboardList) window.renderLeaderboardList();
};

`;

js = js.replace('// --- Live Leaderboard Tab State ---', filterFunctions + '\n// --- Live Leaderboard Tab State ---');

const oldRenderListBegin = `    if (!appState || !appState.leaderboard || appState.leaderboard.length === 0) {
        container.innerHTML = \`<div style="padding:40px; text-align:center; opacity:0.3; color:white;">Waiting for agents to join...</div>\`;
        return;
    }

    appState.leaderboard.forEach((p, i) => {`;

const newRenderListBegin = `    if (!appState || !appState.leaderboard || appState.leaderboard.length === 0) {
        container.innerHTML = \`<div style="padding:40px; text-align:center; opacity:0.3; color:white;">Waiting for agents to join...</div>\`;
        return;
    }

    let filteredPlayers = appState.leaderboard;
    if (window.currentLeaderboardFilter === 'ready') {
        filteredPlayers = filteredPlayers.filter(p => p.answers && Object.keys(p.answers).length >= 7);
    } else if (window.currentLeaderboardFilter === 'pending') {
        filteredPlayers = filteredPlayers.filter(p => !p.answers || Object.keys(p.answers).length < 7);
    }

    if (filteredPlayers.length === 0) {
        container.innerHTML = \`<div style="padding:40px; text-align:center; opacity:0.3; color:white;">No agents match this filter.</div>\`;
        return;
    }

    filteredPlayers.forEach((p, i) => {`;

js = js.replace(oldRenderListBegin, newRenderListBegin);

fs.writeFileSync(jsFile, js);
console.log("Successfully added filters.");
