const fs = require('fs');

const htmlFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.html';
const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

// 1. Inject HTML for timer
if (!html.includes('id="speedTimerOverlay"')) {
    const timerHtml = `
            <!-- Speed Timer Overlay -->
            <div id="speedTimerOverlay" class="hidden" style="position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:1000; text-align:center; background:rgba(10,15,26,0.8); border:1px solid #00E5FF; padding:10px 20px; border-radius:30px; backdrop-filter:blur(10px); box-shadow:0 0 20px rgba(0,229,255,0.2);">
                <div style="font-size:0.8rem; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:1px; font-family:'Inter', sans-serif;">Investigation Time</div>
                <div id="speedTimerValue" style="font-size:2.5rem; font-weight:900; color:#4ade80; font-family:'Inter', sans-serif; text-shadow:0 0 10px currentColor;">0.0s</div>
                <div style="font-size:0.75rem; color:#fef08a; margin-top:5px; text-transform:uppercase; font-family:'Inter', sans-serif;">⚡ Faster guess = Higher points!</div>
            </div>`;
    html = html.replace('<!-- Cooldown Overlay -->', timerHtml + '\n\n            <!-- Cooldown Overlay -->');
    fs.writeFileSync(htmlFile, html);
    console.log("Injected timer HTML");
}

// 2. Inject JS logic
if (!js.includes('let speedTimerInterval')) {
    js = `let speedTimerInterval;\nlet speedTimerStart;\n` + js;
    
    // Inject start timer in selectCard
    const startTimerLogic = `
    // Start UI Timer
    const timerUI = document.getElementById("speedTimerOverlay");
    const timerVal = document.getElementById("speedTimerValue");
    if(timerUI && timerVal) {
        timerUI.classList.remove("hidden");
        speedTimerStart = Date.now();
        clearInterval(speedTimerInterval);
        speedTimerInterval = setInterval(() => {
            const sec = (Date.now() - speedTimerStart) / 1000;
            timerVal.innerText = sec.toFixed(1) + "s";
            if (sec > 30) timerVal.style.color = "#f87171";
            else if (sec > 15) timerVal.style.color = "#fb923c";
            else timerVal.style.color = "#4ade80";
        }, 100);
    }
`;
    js = js.replace('// High-Fidelity Scan Pulse', startTimerLogic + '\n    // High-Fidelity Scan Pulse');

    // Inject stop timer in engine.addInteractable
    js = js.replace('pendingGuess = p;', 'pendingGuess = p;\n            clearInterval(speedTimerInterval);');

    // Inject hide timer in resetCaseGrid
    js = js.replace('currentCardId = null;', 'currentCardId = null;\n    clearInterval(speedTimerInterval);\n    document.getElementById("speedTimerOverlay")?.classList.add("hidden");');
    
    // Inject hide timer in closeModal
    js = js.replace('resetCameraToLive();', 'resetCameraToLive();\n    document.getElementById("speedTimerOverlay")?.classList.add("hidden");');

    fs.writeFileSync(jsFile, js);
    console.log("Injected timer JS");
}
