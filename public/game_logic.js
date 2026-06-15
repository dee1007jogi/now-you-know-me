let playerId = localStorage.getItem("playerId");

const socket = io();

/* ---- 3D ENGINE & MASCOT SETUP ---- */
let mascots = {};
let isEngineReady = false; // Flag to prevent race conditions
let boardTexture, boardCanvas, boardCtx, boardMesh, screenBorder;
let matchScreenGroup, holographicCard, photoSpheres = [];
let currentCardDetails = null;
let bgPanorama;
let slideIndex = 1; // For Bestiary Slides
let engineReadyPromise; // 🔏 Sync lock for 3D transitions

const playerTargetConfig = {
    'owl': { pos: { x: 15, y: 3.5, z: 5 }, scale: 9.0, rot: -0.2, noFloat: true },
    'bunny': { pos: { x: 20, y: 5.5, z: 21 }, scale: 15.5, rot: -0.6 },
    'fox': { pos: { x: -20, y: 4.0, z: 6 }, scale: 13.2, rot: 0.2 }
};

const mascotsData = window.Mobile3D.getLoginMascotData();


window.initPlayerGame = function () {
    engine = window.engine;
    playerId = localStorage.getItem("playerId");
    if (!playerId) return;

    // Pan the camera to the right
    const joinScreen = document.getElementById("joinScreen");
    if (joinScreen) joinScreen.style.display = "none";

    if (window.gsap && window.engine) {
        const boardTarget = new THREE.Vector3(0, 6, -4.0);
        gsap.to(engine.camera.position, {
            x: 0,
            y: 6,
            z: 75,
            duration: 3.5,
            ease: "power3.inOut",
            onUpdate: () => {
                engine.camera.lookAt(boardTarget);
            }
        });

        // Move mascots to their player page positions
        if (window._mascots) {
            let activeTargetConfig = playerTargetConfig;
            if (window.innerWidth <= 768 && window.Mobile3D && window.Mobile3D.getQuestionsMascotConfig()) {
                const mobConf = window.Mobile3D.getQuestionsMascotConfig();
                activeTargetConfig = {
                    'owl': { pos: { x: mobConf.owl.x, y: mobConf.owl.y, z: mobConf.owl.z }, scale: mobConf.owl.scale, rot: mobConf.owl.rot },
                    'bunny': { pos: { x: mobConf.bunny.x, y: mobConf.bunny.y, z: mobConf.bunny.z }, scale: mobConf.bunny.scale, rot: mobConf.bunny.rot },
                    'fox': { pos: { x: mobConf.fox.x, y: mobConf.fox.y, z: mobConf.fox.z }, scale: mobConf.fox.scale, rot: mobConf.fox.rot }
                };
            }

            for (const key in activeTargetConfig) {
                if (window._mascots[key]) {
                    const mascot = window._mascots[key].model;
                    const target = activeTargetConfig[key];
                    gsap.to(mascot.position, { x: target.pos.x, y: target.pos.y, z: target.pos.z, duration: 3.5, ease: "power3.inOut" });
                    gsap.to(mascot.rotation, { y: target.rot, duration: 3.5, ease: "power3.inOut" });
                    gsap.to(mascot.scale, { x: target.scale, y: target.scale, z: target.scale, duration: 3.5, ease: "power3.inOut" });
                }
            }
        }
    }

    // Build the questions board
    initBoard();

    // Connect to game state
    checkShowWaiting();
};

function initBoard() {
    // Dynamic Conference Board (Black Board)
    const isMobile = window.innerWidth <= 768;
    boardCanvas = document.createElement('canvas');
    boardCanvas.width = 1024;
    boardCanvas.height = isMobile ? 768 : 490;
    boardCtx = boardCanvas.getContext('2d');
    boardTexture = new THREE.CanvasTexture(boardCanvas);

    const boardConfig = window.Mobile3D ? window.Mobile3D.getQuestionsBoardConfig() : { width: 30, height: 15, x: 0, y: 7, z: -4.0 };
    const boardWidth = boardConfig.width;
    const boardHeight = boardConfig.height;

    const screenGeo = new THREE.PlaneGeometry(boardWidth, boardHeight);
    const screenMat = new THREE.MeshBasicMaterial({ map: boardTexture, transparent: false });
    boardMesh = new THREE.Mesh(screenGeo, screenMat);

    // Set to the center wall
    boardMesh.position.set(0, 7, boardConfig.z);
    boardMesh.userData.noHoverScale = true;
    engine.scene.add(boardMesh);

    // Make Board Interactive (Click + Hover)
    engine.addInteractable(boardMesh, (intersect) => {
        const u = intersect.uv.x;
        const v = intersect.uv.y;
        const optIndex = getOptIndexFromUV(u, v);

        const q = questions[currentQuestionIndex];
        if (q && q.options && optIndex >= 0 && optIndex < q.options.length) {
            selectOption(q.id, q.options[optIndex]);
        }
    });

    boardMesh.userData.onHoverMove = (intersect) => {
        const u = intersect.uv.x;
        const v = intersect.uv.y;
        const optIndex = getOptIndexFromUV(u, v);

        if (boardMesh.userData.lastHoverIdx !== optIndex) {
            let baseText = questions[currentQuestionIndex]?.text || "Board";
            if (userAnswers && userAnswers.surprisingSkill) baseText = "Answers saved! Waiting for admin to start... ⏳";
            
            boardMesh.userData.lastHoverIdx = optIndex;
            updateBoardText(baseText, optIndex);
        }
    };

    boardMesh.userData.onHoverLeave = () => {
        boardMesh.userData.isHoveringBoard = false;
        boardMesh.userData.lastHoverIdx = -1;
        let baseText = questions[currentQuestionIndex]?.text || "Board";
        if (userAnswers && userAnswers.surprisingSkill) baseText = "Answers saved! Waiting for admin to start... ⏳";
        updateBoardText(baseText, -1);
    };

    if (!engine.interactables.includes(boardMesh)) engine.interactables.push(boardMesh);

    // Draw initial state
    updateBoardText("Waiting for everyone to join...");
}

function updateBoardText(text, hoverIdx = -1) {
    if (!boardCtx || !boardTexture) return;
    const isMobile = boardCanvas.height > 500;
    const height = boardCanvas.height;
    
    boardCtx.clearRect(0, 0, 1024, height);

    // Distinct background so the board doesn't blend into the wall
    boardCtx.fillStyle = '#00091fff';
    boardCtx.fillRect(4, 4, 1016, height - 8);

    // Cyan border to highlight the edges and corners
    boardCtx.strokeStyle = '#386c96ff';
    boardCtx.lineWidth = 6;
    boardCtx.strokeRect(4, 4, 1016, height - 8);

    const q = questions[currentQuestionIndex];
    const hasOptions = q && q.options && q.options.length > 0;

    boardCtx.fillStyle = '#ffffffff'; // Cyan text
    boardCtx.textAlign = 'center';
    boardCtx.textBaseline = 'middle';

    if (isMobile) {
        // MOBILE LOGIC
        boardCtx.font = 'bold 54px sans-serif';
        if (hasOptions) {
            const words = text.split(" ");
            let line1 = text, line2 = "";
            if (words.length >= 4 && text.length > 20) {
                 const mid = Math.ceil(words.length / 2);
                 line1 = words.slice(0, mid).join(" ");
                 line2 = words.slice(mid).join(" ");
            }
            if (line2) {
                boardCtx.fillText(line1, 512, 100);
                boardCtx.fillText(line2, 512, 170);
            } else {
                boardCtx.fillText(line1, 512, 135);
            }

            q.options.forEach((opt, idx) => {
                const row = Math.floor(idx / 2);
                const col = idx % 2;
                const bw = 420;
                const bh = 150;
                const bx = 72 + col * 460;
                const by = 280 + row * 190;

                boardCtx.fillStyle = (idx === hoverIdx) ? '#a5c0cdff' : '#1e293b';
                boardCtx.fillRect(bx, by, bw, bh);
                boardCtx.fillStyle = (idx === hoverIdx) ? '#050a11' : '#e2e8f0';

                boardCtx.font = '36px sans-serif';
                boardCtx.fillText(opt, bx + bw / 2, by + bh / 2);
            });
        } else {
            boardCtx.fillText(text, 512, height / 2);
        }
    } else {
        // DESKTOP LOGIC
        boardCtx.font = 'bold 44px sans-serif';
        if (hasOptions) {
            boardCtx.fillText(text, 512, 120);

            q.options.forEach((opt, idx) => {
                const row = Math.floor(idx / 2);
                const col = idx % 2;
                const bw = 400;
                const bh = 80;
                const bx = 82 + col * 460;
                const by = 230 + row * 110;

                boardCtx.fillStyle = (idx === hoverIdx) ? '#a5c0cdff' : '#1e293b';
                boardCtx.fillRect(bx, by, bw, bh);
                boardCtx.fillStyle = (idx === hoverIdx) ? '#050a11' : '#e2e8f0';

                boardCtx.font = '28px sans-serif';
                boardCtx.fillText(opt, bx + bw / 2, by + bh / 2);
            });
        } else {
            boardCtx.fillText(text, 512, height / 2);
        }
    }

    boardTexture.needsUpdate = true;
}

function getOptIndexFromUV(u, v) {
    const isMobile = boardCanvas.height > 500;
    const height = boardCanvas.height;
    const px = u * 1024;
    const py = height - (v * height); // v=0 is bottom in Three.js

    for (let idx = 0; idx < 4; idx++) {
        const row = Math.floor(idx / 2);
        const col = idx % 2;
        let bw, bh, bx, by;

        if (isMobile) {
            bw = 420; bh = 150;
            bx = 72 + col * 460;
            by = 280 + row * 190;
        } else {
            bw = 400; bh = 80;
            bx = 82 + col * 460;
            by = 230 + row * 110;
        }

        if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
            return idx;
        }
    }
    return -1;
}



/* ---- APP LOGIC ---- */
const stages = {
    photo: document.getElementById("photoStage"),
    questions: document.getElementById("questionsStage"),
    waiting: document.getElementById("waitingStage"),
    live: document.getElementById("liveStage"),
    ended: document.getElementById("endedStage")
};

const setupHeader = document.getElementById("setupHeader");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const questionText = document.getElementById("questionText");
const optionsGrid = document.getElementById("optionsGrid");

let appState = { status: "lobby", leaderboard: [] };
let currentUserData = null;
let currentQuestionIndex = 0;
let userAnswers = {};

const questions = [
    { id: "workStyle", text: "What is your work style? 💼", options: ["Deep focus", "Collaborative", "Structured", "Flexible"], icons: ["🧘‍♂️", "🤝", "📐", "🌊"] },
    { id: "teamRole", text: "What's your secret team role? 🧩", options: ["Planner", "Problem-solver", "Creative", "Calm anchor"], icons: ["📅", "🛠️", "🎨", "⚓"] },
    { id: "meetingPower", text: "Your meeting superpower is... ⚡", options: ["Summarizing", "Asking sharp questions", "Spotting risks", "Keeping energy up"], icons: ["📝", "💡", "🛡️", "🎉"] },
    { id: "breakStyle", text: "Your ideal office break? ☕", options: ["Coffee chat", "Quiet time", "Short walk", "Music"], icons: ["☕", "🤫", "🚶", "🎧"] },
    { id: "updatesVia", text: "How do you prefer updates? 📱", options: ["Email", "WhatsApp", "Call", "In-person"], icons: ["📧", "🟢", "📞", "🤝"] },
    { id: "recharge", text: "How do you recharge? 🔋", options: ["People", "Solo time", "Exercise", "Entertainment"], icons: ["👩‍👩‍👦", "🧘", "🏃", "🎬"] },
    { id: "surprisingSkill", text: "And finally... one surprising skill? ✨", type: "text" }
];

/* ---- APP LOGIC ---- */

async function transitionTo(stageName) {
    if (engineReadyPromise) await engineReadyPromise; // Ensure mascots exist before moving them

    Object.values(stages).filter(s => s).forEach(s => s.classList.add("hidden"));
    if (stages[stageName]) stages[stageName].classList.remove("hidden");

    // Header only for setup
    if (stageName === "questions" || stageName === "photo") setupHeader.classList.remove("hidden");
    else setupHeader.classList.add("hidden");

    // Hide joinScreen on reload if we are past the lobby
    const joinScreen = document.getElementById("joinScreen");
    if (joinScreen && stageName !== "lobby") {
        joinScreen.style.display = "none";
    }

    // Wide Angle Cinematic View for the Hall (Long Shot)
    if (stageName === "questions" && engine) {
        const camConf = window.Mobile3D ? window.Mobile3D.getCameraConfig("questions") : { z: 95, y: 12, x: -2 };
        gsap.to(engine.camera.position, {
            z: camConf.z,
            y: camConf.y,
            x: camConf.x,
            duration: 3.0,
            ease: "power2.inOut",
            overwrite: "auto"
        });
        if (matchScreenGroup) matchScreenGroup.visible = false;
        if (boardMesh) boardMesh.visible = true;
        if (screenBorder) screenBorder.visible = true;

        // Reset Mascots to Office Positions (Questions Page Style)
        if (window._mascots) {
            let activeTargetConfig = playerTargetConfig;
            if (window.innerWidth <= 768 && window.Mobile3D && window.Mobile3D.getQuestionsMascotConfig()) {
                const mobConf = window.Mobile3D.getQuestionsMascotConfig();
                activeTargetConfig = {
                    'owl': { pos: { x: mobConf.owl.x, y: mobConf.owl.y, z: mobConf.owl.z }, scale: mobConf.owl.scale, rot: mobConf.owl.rot },
                    'bunny': { pos: { x: mobConf.bunny.x, y: mobConf.bunny.y, z: mobConf.bunny.z }, scale: mobConf.bunny.scale, rot: mobConf.bunny.rot },
                    'fox': { pos: { x: mobConf.fox.x, y: mobConf.fox.y, z: mobConf.fox.z }, scale: mobConf.fox.scale, rot: mobConf.fox.rot }
                };
            }

            for (const key in activeTargetConfig) {
                if (window._mascots[key]) {
                    const m = window._mascots[key];
                    const target = activeTargetConfig[key];
                    gsap.to(m.model.position, { x: target.pos.x, y: target.pos.y, z: target.pos.z, duration: 2, ease: "power2.inOut", overwrite: "auto" });
                    gsap.to(m.model.rotation, { y: target.rot || 0, duration: 2, ease: "power2.inOut", overwrite: "auto" });
                    gsap.to(m.model.scale, { x: target.scale, y: target.scale, z: target.scale, duration: 2, ease: "power2.inOut", overwrite: "auto" });
                }
            }
        }
    }

    // Cinematic Depth for Matching Lab (Centered & Calibrated grid)
    if (stageName === "live" && engine) {
        const camConf = window.Mobile3D ? window.Mobile3D.getCameraConfig("live") : { z: 75, y: 11, x: -20 };
        gsap.to(engine.camera.position, {
            z: camConf.z,
            y: camConf.y,
            x: camConf.x,
            duration: 2.2,
            ease: "expo.out",
            overwrite: "auto"
        });

        // 🕵️‍♀️ INVESTIGATIVE MASCOT MOBILIZATION (Login Page Methodology)
        // Adjust these values (x, y, z, rot, scale) to Frame your Lab perfectly!
        // Hide 3D models out of the way during live stage
        const liveMascots = ["detective", "boss", "agent", "bunny", "fox", "owl"];
        liveMascots.forEach(name => {
            if (mascots[name] && mascots[name].model) {
                mascots[name].model.visible = false;
            }
        });

        if (matchScreenGroup) matchScreenGroup.visible = false;
        if (boardMesh) boardMesh.visible = false;
        if (screenBorder) screenBorder.visible = false;
        if (holographicCard) holographicCard.visible = false;

        if (boardMesh) boardMesh.visible = false;
        if (screenBorder) screenBorder.visible = false;

        document.getElementById("scorePill").classList.remove("hidden");
    }
}

function updateProgress() {
    const pct = ((currentQuestionIndex) / questions.length) * 100;
    if (progressBar) gsap.to(progressBar, { width: Math.max(5, pct) + "%", duration: 1, ease: "elastic.out(1, 0.5)" });
    if (progressText) progressText.innerText = `Step ${currentQuestionIndex + 1} / ${questions.length}`;
}

function renderQuestion() {
    const q = questions[currentQuestionIndex];
    if (!q) return;

    if (questionText) questionText.innerText = q.text;
    updateBoardText(q.text); // Sync with 3D Board

    // 3rd QUESTION SPECIAL: Fox Entry
    if (currentQuestionIndex === 2 && mascots.fox && mascots.fox.model.scale.x < 0.1) {
        const fox = mascots.fox.model;
        const targetS = mascots.fox.data.scale;
        gsap.to(fox.scale, { x: targetS, y: targetS, z: targetS, duration: 0.8, ease: "back.out(1.7)" });
        gsap.to(fox.position, { y: mascots.fox.data.pos.y + 2, duration: 0.4, yoyo: true, repeat: 1, ease: "power2.out" });
        fireConfetti(20);
    }

    const textInputWrap = document.getElementById("textInputWrap");
    if (textInputWrap) {
        textInputWrap.classList.add("hidden");
        textInputWrap.style.opacity = "0"; // Reset opacity
        textInputWrap.style.pointerEvents = "none";
    }

    const qCard = document.getElementById("qCard");

    if (q.type === "text") {
        if (textInputWrap) {
            textInputWrap.classList.remove("hidden");
            // Beautiful popup animation
            gsap.to(textInputWrap, {
                opacity: 1,
                scale: 1,
                duration: 0.6,
                ease: "back.out(1.5)",
                onStart: () => {
                    textInputWrap.style.pointerEvents = "auto";
                }
            });
        }
        if (qCard) {
            qCard.style.background = ""; // Restore css default
            qCard.style.backdropFilter = "";
            qCard.style.border = "";
            qCard.style.pointerEvents = "auto";
            qCard.style.boxShadow = "";
        }
    } else {
        if (qCard) {
            qCard.style.background = "transparent";
            qCard.style.backdropFilter = "none";
            qCard.style.border = "none";
            qCard.style.pointerEvents = "none";
            qCard.style.boxShadow = "none";
        }

        if (optionsGrid) {
            optionsGrid.innerHTML = ""; // Clear old 2D items just in case
            q.options.forEach((opt, idx) => {
                const orb = document.createElement("div");
                orb.className = "option-orb animate-pop";
                orb.style.animationDelay = (idx * 0.1) + "s";
                orb.innerHTML = `<div class="option-icon">${q.icons[idx]}</div> <span>${opt}</span>`;
                orb.onclick = () => selectOption(q.id, opt);
                optionsGrid.appendChild(orb);
            });
        }
    }
    updateProgress();
}

function selectOption(qId, value) {
    userAnswers[qId] = value;

    // 1. MASCOT CELEBRATION
    if (mascots.owl) {
        const owl = mascots.owl.model;
        gsap.to(owl.rotation, { y: "+=12.56", duration: 1, ease: "power2.inOut" }); // Majestic spin
    }
    if (mascots.bunny) {
        const bunny = mascots.bunny.model;
        gsap.to(bunny.position, { y: 3.5, duration: 0.3, yoyo: true, repeat: 1, ease: "power1.out" });
    }
    if (mascots.fox && mascots.fox.model.scale.x > 0.1) {
        const fox = mascots.fox.model;
        gsap.to(fox.scale, { x: 4.5, y: 4.5, z: 4.5, duration: 0.2, yoyo: true, repeat: 1 });
    }

    // 2. BOARD FEEDBACK
    if (boardMesh) {
        gsap.to(boardMesh.scale, { x: 1.05, y: 1.05, duration: 0.1, yoyo: true, repeat: 1 });
    }

    // 3. ADVANCE TO NEXT QUESTION
    if (currentQuestionIndex < questions.length - 1) {
        gsap.to("#qCard", {
            opacity: 0, scale: 0.9, duration: 0.3,
            onComplete: () => {
                currentQuestionIndex++;
                renderQuestion();
                gsap.to("#qCard", { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.5)" });
            }
        });
    } else {
        submitFinalAnswers();
    }
}



document.getElementById("submitAnswersBtn").onclick = async () => {
    const skill = document.getElementById("surprisingSkill").value.trim();
    if (!skill) return alert("Tell us your surprising skill! 🐰");

    userAnswers.surprisingSkill = skill;
    const btn = document.getElementById("submitAnswersBtn");
    btn.innerText = "⏳ Saving...";
    btn.disabled = true;

    try {
        console.log("Submitting answers for:", playerId);
        const res = await fetch("/api/submit-answers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, answers: userAnswers })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Submit Failed");
        }

        // Update local state immediately so checkShowWaiting can transition even before socket update
        if (!currentUserData) currentUserData = { id: playerId };
        currentUserData.answers = userAnswers;

        console.log("Submit success, transitioning...");
        const textInputWrap = document.getElementById("textInputWrap");
        if (textInputWrap) {
            gsap.to(textInputWrap, { opacity: 0, scale: 0.8, duration: 0.3, onComplete: () => {
                textInputWrap.classList.add("hidden");
                textInputWrap.style.pointerEvents = "none";
            }});
        }
        
        // Show wait message on the board
        updateBoardText("Answers saved! Waiting for admin to start... ⏳");

        checkShowWaiting();
    } catch (e) {
        console.error("Submit error:", e);
        btn.innerText = "Retry Submit";
        btn.disabled = false;
        alert("Saving failed: " + e.message + ". Please check your connection.");
    }
};

function checkShowWaiting() {
    // If we have local answers/photoUrl, we can transition even if socket state hasn't caught up
    const hasAnswers = (currentUserData && currentUserData.answers) || (userAnswers && userAnswers.surprisingSkill);
    const hasPhoto = (currentUserData && currentUserData.photoUrl) || (currentUserData && currentUserData.photoUrl === "done");

    console.log("Checking transition status:", { hasPhoto, hasAnswers, status: appState.status });

    if (!hasAnswers) {
        transitionTo("questions");
        renderQuestion();
    } else {
        transitionTo("waiting");
        if (appState.status === "lobby") fireConfetti(20);
    }
}

/* ---- SOCKET SYNC ---- */
socket.on("connect", () => console.log("Connected as", playerId));

socket.on("state", (s) => {
    appState = s;
    currentUserData = s.leaderboard.find(p => p.id === playerId);

    if (currentUserData) {
        document.getElementById("pillValue").innerText = currentUserData.score;
        const minusEl = document.getElementById("minusValue");
        if (minusEl) minusEl.innerText = (currentUserData.wrong || 0) * -20;
    }

    if (s.status === "lobby") {
        checkShowWaiting();
    } else if (s.status === "live") {
        // Instantly redirect to the dedicated 2D Crack Case page
        window.location.href = '/crack_case.html';
    } else if (s.status === "ended") {
        transitionTo("ended");
        if (currentUserData) {
            const rank = s.leaderboard.findIndex(x => x.id === playerId) + 1;
            document.getElementById("finalScore").innerHTML = `⭐ ${currentUserData.score} pts<br/><small>Rank #${rank}</small>`;
        }
    }
});

/* ---- LIVE GAME LOGIC (3D Mystery Matching) ---- */
let currentSliderIndex = 0;
async function loadCards() {
    try {
        const res = await fetch(`/api/cards/${playerId}`);
        const data = await res.json();
        const row = document.getElementById("bestiaryRow");
        row.innerHTML = "";

        if (data.cards && data.cards.length > 0) {
            data.cards.forEach((card, idx) => {
                const cardEl = createBestiaryCard(card, idx);
                row.appendChild(cardEl);
            });
            updateSliderView();
        } else {
            // All cards matched! Redirect to leaderboard view.
            if (appState && appState.status === "live") {
                console.log("Missions complete! Redirecting to endgame screen.");
                transitionTo("ended");
                if (currentUserData) {
                    const rank = appState.leaderboard.findIndex(x => x.id === playerId) + 1;
                    document.getElementById("finalScore").innerHTML = `✨ ALL CAUGHT! ✨<br/>⭐ ${currentUserData.score} pts<br/><small>Rank #${rank || '?'}</small>`;
                }
            }
        }
    } catch (e) {
        console.error("Failed to load cards:", e);
    }
}

function updateSliderView() {
    const row = document.getElementById("bestiaryRow");
    const cards = document.querySelectorAll(".bestiary-case");
    if (!row || cards.length === 0) return;

    const cardEl = cards[0];
    const isMobile = window.innerWidth <= 768;
    const gap = isMobile ? 10 : 30;
    const cardWidth = cardEl.getBoundingClientRect().width + gap; // Dynamic width + gap
    const xOffset = -currentSliderIndex * cardWidth;

    gsap.to(row, { x: xOffset, duration: 0.6, ease: "power3.out" });

    // Hide/Show Arrows
    document.getElementById("prevCardBtn").style.opacity = currentSliderIndex === 0 ? "0.3" : "1";
    document.getElementById("nextCardBtn").style.opacity = currentSliderIndex >= cards.length - 1 ? "0.3" : "1";
}

// Touch Gestures for Slider
let touchStartX = 0;
let touchEndX = 0;
const sliderContainer = document.getElementById("cardFocusContainer");
if (sliderContainer) {
    sliderContainer.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    sliderContainer.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);
}

function handleSwipe() {
    if (touchEndX < touchStartX - 50) { // Swipe Left -> Next
        const cards = document.querySelectorAll(".bestiary-case");
        if (currentSliderIndex < cards.length - 1) {
            currentSliderIndex++;
            updateSliderView();
        }
    }
    if (touchEndX > touchStartX + 50) { // Swipe Right -> Prev
        if (currentSliderIndex > 0) {
            currentSliderIndex--;
            updateSliderView();
        }
    }
}

document.getElementById("prevCardBtn").onclick = () => {
    if (currentSliderIndex > 0) {
        currentSliderIndex--;
        updateSliderView();
    }
};

document.getElementById("nextCardBtn").onclick = () => {
    const cards = document.querySelectorAll(".bestiary-case");
    if (currentSliderIndex < cards.length - 1) {
        currentSliderIndex++;
        updateSliderView();
    }
};

function createBestiaryCard(card, idx) {
    const cluesHtml = card.clues.map(c => `
        <div class="bestiary-detail">
            <h6>${c.label.toUpperCase()}</h6>
            <p>${c.value}</p>
        </div>
    `).join("");

    const div = document.createElement("div");
    div.className = "bestiary-case fade-anim";
    div.dataset.index = idx;
    div.innerHTML = `
        <div class="back-arrow hidden" style="position: absolute; top: 15px; left: 15px; width: 40px; height: 40px; background: rgba(56,189,248,0.1); border: 1px solid var(--neon-blue); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; z-index: 10;" onclick="resetCaseGrid(event)">
            ‹
        </div>
        <div class="bestiary-title" style="color: white; font-size: 1.2rem; letter-spacing: 3px; font-weight: normal; border-bottom: 2px solid #38bdf8; text-align: center; padding: 15px 0; margin: 0;">CASE FILE #${idx + 1}</div>
        <figure class="bestiary-figure" style="background: #0f4f41; border-bottom: 2px solid #38bdf8;">
            <img src="/assets/${(idx % 30) + 1}.png" alt="Detective">
            <div class="card-shimmer"></div>
        </figure>
        <div class="bestiary-content" style="text-align: center;">
            <h3 style="margin-bottom: 20px; font-size: 1.2rem; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px;">Target<br>Investigation</h3>
            <div class="bestiary-footer" style="display: grid; grid-template-columns: 1fr 1fr; border:0; gap: 8px; max-height: 250px; overflow-y: auto;">
                ${cluesHtml}
            </div>
        </div>
    `;
    div.onclick = () => selectCard(card, div, idx);
    return div;
}

function resetCaseGrid(e) {
    if (e) e.stopPropagation();
    const allCards = document.querySelectorAll(".bestiary-case");
    allCards.forEach(c => {
        c.classList.remove("hidden");
        c.classList.remove("active");
        c.querySelector(".back-arrow")?.classList.add("hidden");
        gsap.to(c, { opacity: 1, scale: 1, x: 0, translateY: 0, duration: 0.5, ease: "power2.out" });
    });

    document.getElementById("prevCardBtn").classList.remove("hidden");
    document.getElementById("nextCardBtn").classList.remove("hidden");
    updateSliderView();

    // Clear the suspect grid
    photoSpheres.forEach(s => matchScreenGroup.remove(s));
    photoSpheres = [];
    currentCardId = null;
}

function selectCard(card, element, idx = 1) {
    const allCards = document.querySelectorAll(".bestiary-case");

    // Hide others
    allCards.forEach(c => {
        if (c !== element) {
            gsap.to(c, { opacity: 0, scale: 0.5, duration: 0.4, onComplete: () => c.classList.add("hidden") });
        }
    });

    element.classList.add("active");
    element.querySelector(".back-arrow")?.classList.remove("hidden");

    // Hide Nav Arrows while investigating
    document.getElementById("prevCardBtn").classList.add("hidden");
    document.getElementById("nextCardBtn").classList.add("hidden");

    // Center Focus for investigation
    gsap.to(element, {
        opacity: 1,
        scale: 1.0,
        zIndex: 100,
        x: 0, // Perfectly centered
        translateY: -30,
        duration: 0.6,
        ease: "power3.out"
    });

    currentCardId = card.cardId;
    currentCardDetails = card;

    // Trigger suspect grid load - shifted further left to avoid overlap
    loadPeopleGrid(idx);

    // Notify server to start speed timer
    fetch("/api/open-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, cardId: card.cardId })
    }).catch(e => console.warn("Timer sync failed"));

    // High-Fidelity Scan Pulse
    const scan = document.getElementById("scanOverlay");
    if (scan) {
        gsap.fromTo(scan, { opacity: 0.6, scale: 0.8 }, { opacity: 0, scale: 1.5, duration: 1, ease: "power2.out" });
    }

    // Mascot Focus
    if (mascots.owl) {
        gsap.to(mascots.owl.model.rotation, { y: -0.4, duration: 0.5 });
    }
}

// ---- Bestiary Layout (The Witcher Style) ----
// Pagination removed for row layout

async function openCard(card) {
    // Legacy support for other parts of the app
    currentCardId = card.cardId;
    currentCardDetails = card;
    loadPeopleGrid();
}

async function loadPeopleGrid(cardIdx = 1) {
    const res = await fetch(`/api/people/${playerId}`);
    const data = await res.json();

    // Complete Cleanup: Remove all old projectors, beams, and labels
    matchScreenGroup.clear();
    photoSpheres = [];

    const count = data.people.length;
    const gridConfig = window.Mobile3D ? window.Mobile3D.getPeopleGridConfig() : { cols: 3, spacingX: 10, spacingY: 9, startY: 20, startZ: -2 };
    const cols = gridConfig.cols;
    const spacingX = gridConfig.spacingX;
    const spacingY = gridConfig.spacingY;

    // Shift Grid for best framing with the 3DS slider
    const isMobile = window.innerWidth <= 768;
    const groupOffsetX = isMobile ? -5 : -48; // Shifted right for better mobile view
    const groupOffsetY = isMobile ? -5 : 0; // Shifted down for mobile to keep top clear

    // Shared Geometry for absolute uniformity
    const sphereGeo = new THREE.SphereGeometry(3.0, 32, 32);

    data.people.forEach((p, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = groupOffsetX + (col - (cols - 1) / 2) * spacingX;
        const y = gridConfig.startY - (row * spacingY);

        // Person Container (Holds Sphere + Label)
        const personGroup = new THREE.Group();
        personGroup.position.set(x, y, -2); // Centered vertically with camera
        matchScreenGroup.add(personGroup);

        // 1. Identity Globe (Classic Spherical Photo)
        const loader = new THREE.TextureLoader();
        const tex = loader.load(p.photoUrl);

        const sphereMat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.1,
            metalness: 0.2,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.1
        });

        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        personGroup.add(sphere);
        sphere.userData.person = p;

        // 2. Identity Label (Directly below globe)
        const nameCanvas = document.createElement("canvas");
        nameCanvas.width = 512; nameCanvas.height = 128;
        const nctx = nameCanvas.getContext("2d");
        nctx.fillStyle = "rgba(10,18,40,0.95)";
        nctx.roundRect(0, 0, 512, 128, 64); nctx.fill();
        nctx.strokeStyle = "#38bdf8"; nctx.lineWidth = 10; nctx.stroke();

        nctx.shadowColor = "#38bdf8"; nctx.shadowBlur = 15;
        nctx.fillStyle = "white";
        nctx.font = "bold 65px Outfit"; nctx.textAlign = "center";
        nctx.fillText(p.name.toUpperCase(), 256, 88);

        const nameTex = new THREE.CanvasTexture(nameCanvas);
        const namePlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true }));
        namePlane.position.set(0, -5.5, 0.5);
        personGroup.add(namePlane);

        // Track interactable spheres
        photoSpheres.push(sphere);

        // Entrance Sequence & Continuous Rotation
        gsap.from(personGroup.scale, { x: 0, y: 0, z: 0, duration: 0.8, delay: i * 0.1, ease: "back.out" });
        gsap.to(sphere.rotation, { y: Math.PI * 2, duration: 15 + Math.random() * 5, repeat: -1, ease: "none" });

        gsap.to(personGroup.position, {
            y: y,
            duration: 1.2,
            delay: i * 0.15,
            ease: "elastic.out(1, 0.5)",
            onComplete: () => {
                // Gentle float
                gsap.to(personGroup.position, {
                    y: "+=0.3",
                    duration: 1.5 + Math.random(),
                    yoyo: true,
                    repeat: -1,
                    ease: "sine.inOut"
                });
            }
        });

        // Interactable
        engine.addInteractable(sphere, () => {
            if (!currentCardId) return;
            pendingGuess = p;

            // 🎥 CINEMATIC GLIDE ZOOM (Direct Path into Evidence)
            // Traveling in a straight line through (x, y) to z:-8
            gsap.to(engine.camera.position, {
                x: x,
                y: y,
                z: -8,
                duration: 3.5,
                ease: "sine.inOut",
                onStart: () => {
                    document.getElementById("modalPhoto").src = p.photoUrl;
                    document.getElementById("modalName").innerText = p.name;
                },
                onComplete: () => {
                    document.getElementById("confirmModal").classList.remove("hidden");
                }
            });
        });

        // Hover Feedback
        sphere.userData.onHoverEnter = () => {
            gsap.to(sphere.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 0.3, ease: "back.out" });
            sphere.material.emissiveIntensity = 0.5;
        };
        sphere.userData.onHoverLeave = () => {
            gsap.to(sphere.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
            sphere.material.emissiveIntensity = 0.1;
        };
    });
}

let pendingGuess = null;
let currentCardId = null;

function resetCameraToLive() {
    gsap.to(engine.camera.position, {
        z: 75, y: 11, x: -22, // Reset to calibrated center
        duration: 2.2,
        ease: "sine.inOut"
    });
}

// modalCancel removed as it doesn't exist in HTML. Use modalArrowBack instead which has inline onclick.

function mascotTriumph() {
    if (mascots.owl) gsap.to(mascots.owl.model.position, { y: mascots.owl.data.pos.y + 2, duration: 0.3, yoyo: true, repeat: 3 });
    if (mascots.fox) gsap.to(mascots.fox.model.rotation, { y: Math.PI * 2, duration: 1, ease: "back.out" });
    if (mascots.bunny) gsap.to(mascots.bunny.model.scale, { x: 4.5, y: 4.5, z: 4.5, duration: 0.3, yoyo: true, repeat: 1 });
}

function mascotPenalty() {
    if (mascots.owl) gsap.to(mascots.owl.model.rotation, { z: 0.2, duration: 0.2, yoyo: true, repeat: 5 });
    if (mascots.fox) gsap.to(mascots.fox.model.position, { x: mascots.fox.data.pos.x + 1, duration: 0.1, yoyo: true, repeat: 5 });
}

const modalConfirm = document.getElementById("modalConfirm");
if (modalConfirm) modalConfirm.onclick = async () => {
    try {
        const res = await fetch("/api/attempt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, cardId: currentCardId, guessedPersonId: pendingGuess.id })
        });
        const out = await res.json();

        if (!res.ok) {
            if (out.error && out.error.includes("Cooldown")) {
                document.getElementById("confirmModal").classList.add("hidden");
                showCooldown(30); // Approximate, or server could send remaining
            } else {
                alert(out.error || "Attempt failed");
            }
            return;
        }

        document.getElementById("confirmModal").classList.add("hidden");
        resetCameraToLive();

        if (out.correct) {
            mascotTriumph();
            fireConfetti(50);
            animatePointsPopup(`+${out.delta}!`);

            // Visual Celebration on Sphere
            const correctSphere = photoSpheres.find(s => s.userData.person.id === pendingGuess.id);
            if (correctSphere) {
                gsap.to(correctSphere.scale, { x: 2, y: 2, z: 2, duration: 0.5, ease: "elastic.out" });
                correctSphere.material.emissive.setHex(0x4ade80);
                correctSphere.material.emissiveIntensity = 1;
            }

            setTimeout(() => {
                // Updated score
                if (currentUserData) currentUserData.score = out.score;
                document.getElementById("pillValue").innerText = currentUserData?.score || 0;
                loadCards();
                closeModal(); // Also auto-close on success
            }, 2000);
        } else {
            mascotPenalty();
            
            // Show negative points popup
            animatePointsPopup(`${out.delta} PTS`, true);

            // Shake Screen
            gsap.to(engine.camera.position, { x: 0.5, duration: 0.1, yoyo: true, repeat: 5 });

            const wrongSphere = photoSpheres.find(s => s.userData.person.id === pendingGuess.id);
            if (wrongSphere) {
                gsap.to(wrongSphere.position, { x: wrongSphere.position.x + 0.2, duration: 0.1, yoyo: true, repeat: 5 });
                wrongSphere.material.emissive.setHex(0xf87171);
                wrongSphere.material.emissiveIntensity = 0.8;
                setTimeout(() => {
                    wrongSphere.material.emissive.setHex(0x0ea5e9);
                    wrongSphere.material.emissiveIntensity = 0.1;
                }, 1000);
            }

            // Immediately update the score display
            if (currentUserData) currentUserData.score = out.score;
            if (currentUserData) currentUserData.wrong = out.wrong; // Ensure wrong count is updated
            document.getElementById("pillValue").innerText = currentUserData?.score || 0;
            const minusEl = document.getElementById("minusValue");
            if (minusEl) minusEl.innerText = (currentUserData?.wrong || 0) * -20;

            // Show cooldown after wrong guess
            setTimeout(() => showCooldown(30), 1000);
        }
    } catch (e) {
        console.error("Attempt error:", e);
        alert("Connection lost. Try again.");
    }
};

function showCooldown(seconds) {
    const overlay = document.getElementById("cooldownOverlay");
    const timer = document.getElementById("cooldownTimer");
    if (!overlay || !timer) return;

    overlay.classList.remove("hidden");
    let remaining = seconds;
    timer.innerText = `${remaining}s`;

    const int = setInterval(() => {
        remaining--;
        timer.innerText = `${remaining}s`;
        if (remaining <= 0) {
            clearInterval(int);
            overlay.classList.add("hidden");
            resetCameraToLive();
        }
    }, 1000);
}

/* ---- UTILS ---- */
function fireConfetti(n) {
    for (let i = 0; i < n; i++) {
        const c = document.createElement("div");
        c.style.position = "fixed";
        c.style.width = "10px"; c.style.height = "10px";
        c.style.backgroundColor = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc"][Math.floor(Math.random() * 4)];
        c.style.left = Math.random() * 100 + "vw";
        c.style.top = "-10px";
        c.style.zIndex = 10000;
        document.body.appendChild(c);
        gsap.to(c, { y: window.innerHeight + 20, rotation: 360, duration: 2 + Math.random() * 2, onComplete: () => c.remove() });
    }
}

function animatePointsPopup(text, isNegative = false) {
    const p = document.getElementById("pointsPopup");
    p.innerText = text;
    
    // Change text color and glow based on score
    if (isNegative) {
        p.style.color = "#f87171"; // Red
        p.style.textShadow = "0 0 20px rgba(248,113,113,0.8), 2px 2px 0 #991b1b";
    } else {
        p.style.color = "#facc15"; // Yellow
        p.style.textShadow = "0 0 20px rgba(250,204,21,0.8), 2px 2px 0 #ca8a04";
    }

    gsap.fromTo(p, { opacity: 0, scale: 0.5, y: -20 }, { opacity: 1, scale: 1, y: -100, duration: 1, onComplete: () => gsap.to(p, { opacity: 0, duration: 0.5 }) });
}
// ---- Close Identification Modal (Sleek Camera Rollback) ----
function closeModal() {
    document.getElementById("confirmModal").classList.add("hidden");
    resetCameraToLive();
}

function resetCameraToLive() {
    const camConf = window.Mobile3D ? window.Mobile3D.getCameraConfig("live") : { z: 75, y: 11, x: -20 };
    gsap.to(engine.camera.position, {
        x: camConf.x,
        y: camConf.y,
        z: camConf.z,
        duration: 1.5,
        ease: "power2.inOut"
    });
}
