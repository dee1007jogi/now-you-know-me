/* tv.js – Global Leaderboard High-Fidelity Logic (Refactored for 2D Cinematic Overlay) */
const socket = io();
const displayCode = document.getElementById("displayCode");
const participantCount = document.getElementById("participantCount");
let lastPlayerCount = 0;
let appState = { status: "lobby", leaderboard: [] };
let finaleTriggered = false;

window.addEventListener('load', () => {
    updateMissionCode();
});

function updateMissionCode() {
    fetch("/api/session").then(r => r.json()).then(d => {
        if(displayCode) displayCode.innerText = d.code;
    });
}

socket.on("connect", () => console.log("TV Connected"));

socket.on("state", (s) => {
    appState = s;
    updateUI(s);

    if (window.bgmController) window.bgmController.syncWithState(s);

    if (s.status === "ended" && !finaleTriggered) {
        finaleTriggered = true;
        triggerCinematicFinale(s.leaderboard);
    }
});

function updateUI(s) {
    if (s.playersCount > lastPlayerCount) {
        // New player joined! Swell volume
        if (window.bgmController) {
            window.bgmController.setVolume(window.bgmController.volumes[s.status || 'lobby'] + 0.1, 400);
            setTimeout(() => window.bgmController.syncWithState(s), 1500);
        }
    }
    lastPlayerCount = s.playersCount;
    if (participantCount) {
        participantCount.innerText = s.playersCount;
    }

    const mainTitle = document.getElementById("tvMainTitle");
    const subTitle = document.getElementById("tvSubTitle");
    const cta = document.getElementById("tvCallToAction");

    if (s.status === "ended") {
        if (mainTitle) mainTitle.innerText = "🏆 TOP DETECTIVES 🏆";
        if (subTitle) subTitle.innerText = "OPERATION CONCLUDED";
        if (cta) {
            cta.innerText = "Congratulations to our winners!";
            cta.style.color = "var(--gold)";
        }
    } else {
        if (mainTitle) mainTitle.innerText = "TEAM LEADERS";
        if (subTitle) subTitle.innerText = "MISSION: DISCOVERY";
        if (cta) {
            cta.innerText = "Mingle & Find Your Clues! 🤝";
            cta.style.color = "white";
        }
    }
}

function triggerCinematicFinale(leaderboard) {
    const winner = leaderboard[0];
    if (!winner) return;
    
    // Hide the normal TV UI
    const tvUi = document.querySelector('.tv-ui');
    if (tvUi) {
        gsap.to(tvUi, { opacity: 0, duration: 1 });
    }

    // Populate Center Text
    const centerName = document.getElementById("winnerCenterName");
    if (centerName) centerName.innerText = winner.name || "UNKNOWN";
    
    const centerScore = document.getElementById("winnerCenterScore");
    if (centerScore) centerScore.innerText = (winner.score || 0) + " POINTS";
    
    const centerSelfies = document.getElementById("winnerCenterSelfies");
    if (centerSelfies) centerSelfies.innerText = (winner.correct || 0) + " SELFIES";

    // Trigger WinnerText animation if exists
    triggerWinnerText();

    // Fade in Center Text Overlay
    setTimeout(() => {
        const centerOverlay = document.getElementById("winnerCenterOverlay");
        if (centerOverlay) centerOverlay.style.opacity = '1';
        
        // Add a slight pop animation using gsap
        gsap.fromTo(centerOverlay, 
            { scale: 0.8, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 1.5, ease: "elastic.out(1, 0.5)" }
        );
    }, 1500);
}

function triggerWinnerText() {
    const letters = document.querySelectorAll('.winner-letter');
    if(letters.length === 0) return;
    
    // Set initial random positions
    letters.forEach(letter => {
        gsap.set(letter, {
            x: (Math.random() - 0.5) * window.innerWidth * 2,
            y: (Math.random() - 0.5) * window.innerHeight * 2,
            rotation: (Math.random() - 0.5) * 720,
            scale: 5 + Math.random() * 5,
            opacity: 0
        });
    });

    // Animate them converging to their final position one by one
    gsap.to(letters, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        duration: 1.5,
        ease: "power4.out",
        stagger: 0.15
    });
}
