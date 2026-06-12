const fs = require('fs');

const htmlFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\admin.html';
const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\admin.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

// ---- PATCH HTML ----

// Add Chart.js to head
if (!html.includes('chart.js')) {
    html = html.replace('<link rel="stylesheet" href="/mobile.css">', '<link rel="stylesheet" href="/mobile.css">\n    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
}

// Add Nav Button
const newSidebarHtml = `                    <button id="navAdminBtn" class="sidebar-link active">
                        <span>🔧 Admin Panel</span>
                    </button>
                    <button id="navTelemetryBtn" class="sidebar-link">
                        <span>📈 Telemetry</span>
                    </button>`;
html = html.replace(/<button id="navAdminBtn" class="sidebar-link active">\s*<span>🔧 Admin Panel<\/span>\s*<\/button>/, newSidebarHtml);

// Add Content Tab after VIEW 2: ADMIN CONTENT ends
// VIEW 2 ends at </main> minus the closing div of tabAdminContent
// Let's find the end of tabAdminContent. It's right before </main> or </div> <!-- views-container -->
const telemetryHtml = `
                <!-- VIEW 3: TELEMETRY CONTENT -->
                <div id="tabTelemetryContent" class="hidden">
                    <div style="display: flex; flex-direction: column; gap: 30px; max-width: 1400px; margin: 0 auto; padding-bottom: 50px;">
                        <h2 style="color:var(--gold-bright); text-transform:uppercase; font-family:'Inter'; letter-spacing:2px; font-weight:800; font-size:1.5rem;">Network Telemetry</h2>
                        
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                            <div class="glass-card" style="height: 350px; position:relative; padding:20px;">
                                <h3 style="margin-bottom: 10px;">Global Accuracy</h3>
                                <div style="position:relative; height: 260px; width: 100%;">
                                    <canvas id="chartAccuracy"></canvas>
                                </div>
                            </div>
                            <div class="glass-card" style="height: 350px; position:relative; padding:20px;">
                                <h3 style="margin-bottom: 10px;">Agent Velocity (Top 5)</h3>
                                <div style="position:relative; height: 260px; width: 100%;">
                                    <canvas id="chartVelocity"></canvas>
                                </div>
                            </div>
                            <div class="glass-card" style="height: 350px; position:relative; padding:20px;">
                                <h3 style="margin-bottom: 10px;">Score Distribution</h3>
                                <div style="position:relative; height: 260px; width: 100%;">
                                    <canvas id="chartScores"></canvas>
                                </div>
                            </div>
                            <div class="glass-card" style="height: 350px; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px;">
                                <h3>Network Health Radar</h3>
                                <div id="radarWrapper" style="margin-top:30px; position:relative; width:150px; height:150px; display:flex; justify-content:center; align-items:center;">
                                    <div id="radarPulse" style="position:absolute; width:100%; height:100%; border-radius:50%; border:2px solid var(--neon-cyan); box-shadow: 0 0 20px rgba(0,229,255,0.2);"></div>
                                    <div id="radarCore" style="width:30px; height:30px; background:var(--neon-cyan); border-radius:50%; box-shadow: 0 0 30px rgba(0,229,255,0.8);"></div>
                                </div>
                                <span id="radarStatus" style="margin-top:40px; color:var(--success); font-weight:800; font-family:'Inter'; letter-spacing:1px;">STABLE (AWAITING PACKETS)</span>
                            </div>
                        </div>
                    </div>
                </div>
`;

// Find `</div>` followed by `</div>` and `</main>` at the end of the views container
const targetHtml = `                </div>\n                \n            </div>\n        </main>`;
if (html.includes('                </div>\n                \n            </div>\n        </main>')) {
    html = html.replace('                </div>\n                \n            </div>\n        </main>', '                </div>\n' + telemetryHtml + '\n            </div>\n        </main>');
} else {
    // try fallback
    html = html.replace(/<\/div>\s*<\/main>/, '</div>\n' + telemetryHtml + '\n            </div>\n        </main>');
}

fs.writeFileSync(htmlFile, html);

// ---- PATCH JS ----

const newJsNavVars = `const navIntelligenceBtn = document.getElementById("navIntelligenceBtn");
const navAdminBtn = document.getElementById("navAdminBtn");
const navTelemetryBtn = document.getElementById("navTelemetryBtn");

const tabIntelligenceContent = document.getElementById("tabIntelligenceContent");
const tabAdminContent = document.getElementById("tabAdminContent");
const tabTelemetryContent = document.getElementById("tabTelemetryContent");`;

js = js.replace(/const navIntelligenceBtn = document.getElementById\("navIntelligenceBtn"\);\nconst navAdminBtn = document.getElementById\("navAdminBtn"\);\n\nconst tabIntelligenceContent = document.getElementById\("tabIntelligenceContent"\);\nconst tabAdminContent = document.getElementById\("tabAdminContent"\);/, newJsNavVars);

js = js.replace(/\[navIntelligenceBtn, navAdminBtn\]\.forEach/g, "[navIntelligenceBtn, navAdminBtn, navTelemetryBtn].forEach");
js = js.replace(/\[tabIntelligenceContent, tabAdminContent\]\.forEach/g, "[tabIntelligenceContent, tabAdminContent, tabTelemetryContent].forEach");

const newJsClickers = `if (navIntelligenceBtn) navIntelligenceBtn.onclick = () => switchTab(navIntelligenceBtn, tabIntelligenceContent);
if (navAdminBtn) navAdminBtn.onclick = () => switchTab(navAdminBtn, tabAdminContent);
if (navTelemetryBtn) navTelemetryBtn.onclick = () => switchTab(navTelemetryBtn, tabTelemetryContent);`;

js = js.replace(/if \(navIntelligenceBtn\).*?\nif \(navAdminBtn\).*?;/g, newJsClickers);

const hookCode = `
    // Update playerCountText if it exists
    const pct = document.getElementById("playerCountText");
    if (pct) pct.innerText = \`\${s.playersCount || 0} Agents\`;

    if (typeof updateTelemetryData === 'function') {
        updateTelemetryData(s);
    }
}
`;

js = js.replace(/    \/\/ Update playerCountText if it exists[\s\S]*?\}\n/, hookCode);

const telemetryFunctions = `
/* --- TELEMETRY LOGIC --- */
let chartAccuracy, chartVelocity, chartScores;
let hasInitializedCharts = false;

function initTelemetryCharts() {
    if (hasInitializedCharts || typeof Chart === 'undefined') return;
    
    Chart.defaults.color = 'rgba(255,255,255,0.5)';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const ctxAcc = document.getElementById('chartAccuracy');
    if (ctxAcc) {
        chartAccuracy = new Chart(ctxAcc, {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#00C853', '#FF1744'],
                    borderColor: '#0A0F1A',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxVel = document.getElementById('chartVelocity');
    if (ctxVel) {
        chartVelocity = new Chart(ctxVel, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Avg Response (s)',
                    data: [],
                    backgroundColor: 'rgba(0, 229, 255, 0.5)',
                    borderColor: '#00E5FF',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    }

    const ctxSco = document.getElementById('chartScores');
    if (ctxSco) {
        chartScores = new Chart(ctxSco, {
            type: 'bar',
            indexAxis: 'y',
            data: {
                labels: [],
                datasets: [{
                    label: 'Score (pts)',
                    data: [],
                    backgroundColor: 'rgba(192, 132, 252, 0.5)',
                    borderColor: '#c084fc',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true } } }
        });
    }
    
    hasInitializedCharts = true;
}

function updateTelemetryData(s) {
    if (!hasInitializedCharts) initTelemetryCharts();
    if (!chartAccuracy || !s.leaderboard) return;

    const totalGuesses = s.selfies ? s.selfies.length : 0;
    const correct = s.selfies ? s.selfies.filter(x => x.isCorrect).length : 0;
    chartAccuracy.data.datasets[0].data = [correct, totalGuesses - correct];
    chartAccuracy.update();

    const validPlayers = s.leaderboard.filter(p => p.avgCorrectSec !== null);
    const sortedSpeed = [...validPlayers].sort((a,b) => a.avgCorrectSec - b.avgCorrectSec).slice(0,5);
    chartVelocity.data.labels = sortedSpeed.map(p => p.name || 'Agent');
    chartVelocity.data.datasets[0].data = sortedSpeed.map(p => p.avgCorrectSec);
    chartVelocity.update();

    const sortedScores = [...s.leaderboard].sort((a,b) => b.score - a.score).slice(0,5);
    chartScores.data.labels = sortedScores.map(p => p.name || 'Agent');
    chartScores.data.datasets[0].data = sortedScores.map(p => p.score || 0);
    chartScores.update();

    if (window.lastSelfieCount !== undefined && s.selfies && s.selfies.length > window.lastSelfieCount) {
        const radar = document.getElementById('radarPulse');
        const status = document.getElementById('radarStatus');
        if (radar && typeof gsap !== 'undefined') {
            gsap.fromTo(radar, { scale: 1, borderColor: "rgba(0, 229, 255, 1)" }, { scale: 1.8, borderColor: "rgba(0, 229, 255, 0)", duration: 1.2, ease: "power2.out" });
            if (status) {
                status.innerText = "PACKET RECEIVED ⚡";
                setTimeout(() => { status.innerText = "STABLE (AWAITING PACKETS)"; }, 2000);
            }
        }
    }
    window.lastSelfieCount = s.selfies ? s.selfies.length : 0;
}
`;

js += telemetryFunctions;

fs.writeFileSync(jsFile, js);
console.log("Successfully added Telemetry tab logic and structure.");
