const fs = require('fs');

const htmlFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.html';
const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

// ---- PATCH HTML ----

// Add Chart.js to head
if (!html.includes('chart.js')) {
    html = html.replace('<link rel="stylesheet" href="/mobile.css">', '<link rel="stylesheet" href="/mobile.css">\n    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
}

// Add Overlay & FAB before </body>
const dossierHtml = `
    <!-- Personal Dossier FAB -->
    <button id="openDossierBtn" style="position:fixed; bottom:20px; right:20px; width:60px; height:60px; border-radius:50%; background:#00E5FF; color:#0A0F1A; border:none; box-shadow:0 0 20px rgba(0,229,255,0.4); z-index:9000; padding:0; display:flex; align-items:center; justify-content:center; font-size:1.8rem; cursor:pointer;">👤</button>

    <!-- Personal Dossier Overlay -->
    <div id="personalDossierOverlay" class="hidden" style="position:fixed; inset:0; z-index:9500; background:rgba(10,15,26,0.95); backdrop-filter:blur(20px); overflow-y:auto; padding:30px 20px; color:white; font-family:'Inter', sans-serif;">
        <button id="closeDossierBtn" style="position:absolute; top:20px; right:20px; background:transparent; border:none; color:white; font-size:2rem; cursor:pointer;">×</button>
        
        <div style="text-align:center; margin-bottom:30px;">
            <h1 style="color:#00E5FF; font-weight:900; margin-bottom:5px; text-transform:uppercase; letter-spacing:2px; font-family:'Inter', sans-serif;">My Dossier</h1>
            <p style="color:rgba(255,255,255,0.5);">Real-time Personal Analytics</p>
        </div>

        <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(0,229,255,0.2); border-radius:20px; padding:20px; text-align:center; margin-bottom:30px;">
            <img id="myDossierPhoto" src="/assets/detective_sketch.png" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:15px; border:3px solid #00E5FF;" />
            <h2 id="myDossierName" style="font-size:1.5rem; font-weight:800; margin-bottom:5px; font-family:'Inter', sans-serif;">Agent</h2>
            <div id="myDossierLevel" style="display:inline-block; background:rgba(0,229,255,0.15); color:#00E5FF; padding:5px 15px; border-radius:15px; font-size:0.8rem; font-weight:800; text-transform:uppercase; font-family:'Inter', sans-serif;">Fresh Recruit</div>
            <div style="margin-top:15px; font-size:2rem; font-weight:900; color:white;"><span id="myDossierScore">0</span> <span style="font-size:1rem; opacity:0.5;">pts</span></div>
        </div>

        <h3 style="margin-bottom:15px; font-size:1rem; text-transform:uppercase; color:rgba(255,255,255,0.7); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; font-family:'Inter', sans-serif;">Skill Radar</h3>
        <div style="background:rgba(255,255,255,0.02); border-radius:20px; padding:15px; margin-bottom:30px; height:250px;">
            <canvas id="myRadarChart"></canvas>
        </div>

        <h3 style="margin-bottom:15px; font-size:1rem; text-transform:uppercase; color:rgba(255,255,255,0.7); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; font-family:'Inter', sans-serif;">Speed vs Network</h3>
        <div style="background:rgba(255,255,255,0.02); border-radius:20px; padding:15px; margin-bottom:30px; height:200px;">
            <canvas id="myBarChart"></canvas>
        </div>
    </div>
`;

if (!html.includes('id="personalDossierOverlay"')) {
    html = html.replace('</body>', dossierHtml + '\n</body>');
}

fs.writeFileSync(htmlFile, html);

// ---- PATCH JS ----

const dossierLogic = `
/* --- PERSONAL DOSSIER LOGIC --- */
const openDossierBtn = document.getElementById("openDossierBtn");
const closeDossierBtn = document.getElementById("closeDossierBtn");
const personalDossierOverlay = document.getElementById("personalDossierOverlay");

if(openDossierBtn) {
    openDossierBtn.onclick = () => {
        personalDossierOverlay.classList.remove("hidden");
        updatePersonalDossier();
    };
}
if(closeDossierBtn) {
    closeDossierBtn.onclick = () => personalDossierOverlay.classList.add("hidden");
}

let myRadarChart, myBarChart;

function updatePersonalDossier() {
    if(!appState || !appState.leaderboard) return;
    const myId = localStorage.getItem("playerId");
    if(!myId) return;
    const me = appState.leaderboard.find(x => x.id === myId);
    if(!me) return;

    document.getElementById("myDossierName").innerText = me.name || "Agent";
    document.getElementById("myDossierPhoto").src = me.photoUrl || "/assets/detective_sketch.png";
    document.getElementById("myDossierScore").innerText = me.score || 0;

    const speed = me.avgCorrectSec;
    const correct = me.correct || 0;
    let level = "Fresh Recruit 🕵️";
    if (me.score >= 400) level = "Elite Investigator 🎖️";
    else if (correct >= 3) level = "Social Matchmaker 🤝";
    else if (speed !== null && speed <= 20) level = "Speedy Detective ⚡";
    document.getElementById("myDossierLevel").innerText = level;

    if(typeof Chart === 'undefined') return;
    Chart.defaults.color = 'rgba(255,255,255,0.5)';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const totalCorrect = me.correct || 0;
    const totalGuesses = totalCorrect + (me.wrong || 0);
    const accuracy = totalGuesses ? (totalCorrect / totalGuesses) * 100 : 0;
    
    const mySpeed = me.avgCorrectSec !== null ? me.avgCorrectSec : 0;
    const allSpeeds = appState.leaderboard.filter(p => p.avgCorrectSec !== null).map(p => p.avgCorrectSec);
    const avgNetworkSpeed = allSpeeds.length ? (allSpeeds.reduce((a,b)=>a+b,0)/allSpeeds.length) : 0;

    const speedScore = mySpeed ? Math.max(0, 100 - (mySpeed * 2)) : 0;
    const creativity = me.score ? Math.min(100, (me.score / Math.max(1, correct)) * 1.5) : 0;

    if(!myRadarChart) {
        myRadarChart = new Chart(document.getElementById('myRadarChart'), {
            type: 'radar',
            data: {
                labels: ['Accuracy', 'Speed', 'Creativity', 'Activity'],
                datasets: [{
                    label: 'Skill Profile',
                    data: [accuracy, speedScore, creativity, Math.min(100, totalGuesses*10)],
                    backgroundColor: 'rgba(0, 229, 255, 0.2)',
                    borderColor: '#00E5FF',
                    pointBackgroundColor: '#00E5FF'
                }]
            },
            options: { scales: { r: { angleLines: {color: 'rgba(255,255,255,0.1)'}, grid: {color: 'rgba(255,255,255,0.1)'}, ticks: {display:false}, min: 0, max: 100 } }, responsive: true, maintainAspectRatio: false }
        });
    } else {
        myRadarChart.data.datasets[0].data = [accuracy, speedScore, creativity, Math.min(100, totalGuesses*10)];
        myRadarChart.update();
    }

    if(!myBarChart) {
        myBarChart = new Chart(document.getElementById('myBarChart'), {
            type: 'bar',
            data: {
                labels: ['You', 'Network Avg'],
                datasets: [{
                    label: 'Response Time (s)',
                    data: [mySpeed, avgNetworkSpeed],
                    backgroundColor: ['#00E5FF', 'rgba(255,255,255,0.2)'],
                    borderRadius: 10
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: {color: 'rgba(255,255,255,0.05)'} }, x: { grid: {display:false} } } }
        });
    } else {
        myBarChart.data.datasets[0].data = [mySpeed, avgNetworkSpeed];
        myBarChart.update();
    }
}
`;

if (!js.includes('updatePersonalDossier()')) {
    js += '\n' + dossierLogic;
}

fs.writeFileSync(jsFile, js);
console.log("Successfully injected player dossier.");
