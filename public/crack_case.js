const socket = io();
const playerId = localStorage.getItem("playerId");

if (!playerId) {
    window.location.href = "/";
}

let currentSliderIndex = 0;
let currentCardId = null;
let allPlayers = [];
let localCards = [];
let selectedSuspectId = null;

const clueIcons = {
    "Work style": "💼",
    "Team role": "👥",
    "Meeting superpower": "📝",
    "Ideal break": "🚶",
    "Updates via": "📱",
    "Recharge": "🎮",
    "Morning fuel": "☕",
    "Workspace quirk": "🖥️",
    "Weekend routine": "🌴",
    "Surprising skill": "🃏"
};

// Connect to socket and update score pill
socket.on("connect", () => {
    socket.emit("playerJoin", { id: playerId, name: localStorage.getItem("playerName") });
});

socket.on("state", (s) => {
    const currentUserData = s.leaderboard.find(p => p.id === playerId);
    if (currentUserData) {
        document.getElementById("pillValue").innerText = currentUserData.score;
    }
    
    // Cache leaderboard data for suspect images
    allPlayers = s.leaderboard;
    renderSuspectGrid();

    if (s.status === "live" && localCards.length === 0 && !document.getElementById("endedStage").classList.contains("hidden")) {
        document.getElementById("endedStage").classList.add("hidden");
        loadCards();
    } else if (s.status === "live" && localCards.length === 0) {
        loadCards();
    }

    if (s.status === "ended") {
        document.getElementById("endedStage").classList.remove("hidden");
        if (currentUserData) {
            const rank = s.leaderboard.findIndex(x => x.id === playerId) + 1;
            document.getElementById("finalScore").innerHTML = `⭐ ${currentUserData.score} pts<br/><small>Rank #${rank}</small><br/><small style="font-size: 1rem; color: #94a3b8; display: block; margin-top: 15px;">Redirecting to TV...</small>`;
        }
        setTimeout(() => {
            window.location.href = '/tv';
        }, 4000);
    }
});

async function loadCards() {
    try {
        const res = await fetch(`/api/current-card/${playerId}`);
        const data = await res.json();
        
        if (data.pendingSelfie) {
            showSelfieModal(data.guessedName);
            return;
        }

        if (data.finished) {
            document.getElementById("endedStage").classList.remove("hidden");
            document.getElementById("finalScore").innerHTML = `✨ ALL CAUGHT! ✨<br/><small style="font-size: 1.2rem; color: #94a3b8; display: block; margin-top: 15px;">Redirecting to Leaderboard...</small>`;
            setTimeout(() => {
                window.location.href = '/tv';
            }, 4000);
            return;
        }

        if (data.cardId) {
            localCards = [data];
            currentSliderIndex = data.cardIndex;
            renderCurrentCase(data);
        }
    } catch (e) {
        console.error("Failed to load cards:", e);
    }
}

function showSelfieModal(targetName) {
    const modal = document.getElementById("resultModal");
    const title = document.getElementById("resultModalTitle");
    const text = document.getElementById("resultModalText");
    const btnCancel = document.getElementById("btnCancel");
    const btnCrack = document.getElementById("btnCrack");
    const btnCamera = document.getElementById("btnCamera");
    const btnNext = document.getElementById("btnNext");

    title.innerText = "Selfie Time! 📸";
    title.style.color = "#38bdf8";
    text.innerHTML = `Go find <strong>${targetName}</strong> and take a selfie with them to prove it!`;

    btnCancel.classList.add("hidden");
    btnCrack.classList.add("hidden");
    btnNext.classList.add("hidden");
    btnCamera.classList.remove("hidden");

    btnCamera.onclick = () => {
        openCamera();
    };

    modal.classList.remove("hidden");
}

let timerInterval = null;
let currentElapsed = 0;

function startVisualTimer(initialElapsed = 0) {
    currentElapsed = initialElapsed;
    const timerDisplay = document.getElementById("timerDisplay");
    timerDisplay.classList.remove("hidden");
    
    if (timerInterval) clearInterval(timerInterval);
    
    const updateTimer = () => {
        const mins = Math.floor(currentElapsed / 60).toString().padStart(2, '0');
        const secs = (currentElapsed % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${mins}:${secs}`;
    };
    
    updateTimer();
    
    timerInterval = setInterval(() => {
        currentElapsed++;
        updateTimer();
    }, 1000);
}

function stopVisualTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) {
        timerDisplay.classList.add("hidden");
        timerDisplay.innerText = "00:00";
    }
}

function renderCurrentCase(data) {
    if (localCards.length === 0) return;
    
    const card = localCards[0];
    currentCardId = card.cardId;

    // Update Clues (now on the back of the card)
    const clueList = document.getElementById("clueList");
    if (clueList) {
        clueList.innerHTML = card.clues.map(c => {
            let val = c.value;
            if (!val || val === "undefined") val = "—";
            const icon = clueIcons[c.label] || "📌";
            return `
                <li class="clue-item">
                    <span class="clue-label">${icon} ${c.label}</span>
                    <span class="clue-value">${val}</span>
                </li>
            `;
        }).join("");
    }
    
    stopVisualTimer();
    
    if (data && data.elapsed > 0) {
        // Card was already opened
        playCardEntrance(true);
        startVisualTimer(data.elapsed);
    } else {
        // Reset 3D card animation
        playCardEntrance(false);
    }
}

const prevCardBtn = document.getElementById("prevCardBtn");
if (prevCardBtn) {
    prevCardBtn.onclick = () => {
        if (currentSliderIndex > 0) {
            currentSliderIndex--;
            renderCurrentCase();
        }
    };
}

const nextCardBtn = document.getElementById("nextCardBtn");
if (nextCardBtn) {
    nextCardBtn.onclick = () => {
        if (currentSliderIndex < localCards.length - 1) {
            currentSliderIndex++;
            renderCurrentCase();
        }
    };
}

function renderSuspectGrid() {
    const container = document.getElementById("suspectImagesContainer");
    if (!container) return;
    container.innerHTML = "";
    
    allPlayers.forEach(p => {
        if (p.id === playerId) return; // Hide own profile

        const photoUrl = p.photoUrl || '/assets/default_avatar.png';
        const div = document.createElement("div");
        div.className = "suspect-card fade-anim";
        if (selectedSuspectId === p.id) {
            div.classList.add("selected");
        }
        
        div.innerHTML = `
            <div class="suspect-avatar">
                <img src="${photoUrl}" alt="Avatar">
            </div>
            <div>
                <strong style="font-size:18px;">${p.name}</strong><br>
                <span style="color:#475569;">Colleague</span>
            </div>
        `;
        div.onclick = () => selectSuspect(p.id, div);
        container.appendChild(div);
    });
}

window.selectSuspect = function(id, element) {
    selectedSuspectId = id;
    
    const allCards = document.querySelectorAll(".suspect-card");
    allCards.forEach(c => c.classList.remove("selected"));
    
    if (element) {
        element.classList.add("selected");
    }
    
    const suspectName = element.querySelector("strong").innerText;

    // Show Confirmation Modal
    const modal = document.getElementById("resultModal");
    const title = document.getElementById("resultModalTitle");
    const text = document.getElementById("resultModalText");
    const btnCancel = document.getElementById("btnCancel");
    const btnCrack = document.getElementById("btnCrack");
    const btnCamera = document.getElementById("btnCamera");
    const btnNext = document.getElementById("btnNext");

    title.innerText = "Confirm Suspect";
    title.style.color = "#fbbf24";
    text.innerHTML = `Do you want to crack the case with <strong>${suspectName}</strong>?`;
    
    btnCancel.classList.remove("hidden");
    btnCrack.classList.remove("hidden");
    btnCamera.classList.add("hidden");
    btnNext.classList.add("hidden");

    btnCancel.onclick = () => {
        modal.classList.add("hidden");
        selectedSuspectId = null;
        allCards.forEach(c => c.classList.remove("selected"));
    };

    btnCrack.onclick = () => {
        // Switch to selfie prompt
        title.innerText = "Selfie Time! 📸";
        title.style.color = "#38bdf8";
        text.innerHTML = `Go find <strong>${suspectName}</strong> and take a selfie with them to prove it!`;

        btnCancel.classList.add("hidden");
        btnCrack.classList.add("hidden");
        btnCamera.classList.remove("hidden");

        btnCamera.onclick = () => {
            openCamera();
        };
    };

    modal.classList.remove("hidden");
}

let currentStream = null;

window.openCamera = async function() {
    document.getElementById("cameraModal").classList.remove("hidden");
    const video = document.getElementById("cameraVideo");
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" } 
        });
        video.srcObject = currentStream;
    } catch (err) {
        console.error("Camera access denied", err);
        alert("Camera access is required to take a selfie. Please grant permissions.");
        closeCamera();
    }
}

window.closeCamera = function() {
    document.getElementById("cameraModal").classList.add("hidden");
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

window.takeSnapshot = function() {
    const video = document.getElementById("cameraVideo");
    const canvas = document.getElementById("cameraCanvas");
    const ctx = canvas.getContext("2d");
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
        closeCamera();
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        processGuessAndSelfie(file);
    }, "image/jpeg", 0.9);
}

window.processGuessAndSelfie = async function(file) {
    if (!file) return;

    const modal = document.getElementById("resultModal");
    const title = document.getElementById("resultModalTitle");
    const text = document.getElementById("resultModalText");
    const btnCamera = document.getElementById("btnCamera");
    const btnNext = document.getElementById("btnNext");
    
    title.innerText = "Analyzing...";
    title.style.color = "#fbbf24";
    text.innerText = "Uploading photo and verifying match...";
    btnCamera.classList.add("hidden");

    try {
        // 1. Submit guess to server
        const guessRes = await fetch("/api/guess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, guessedPersonId: selectedSuspectId })
        });
        const guessResult = await guessRes.json();

        if (!guessResult.success && guessResult.isCorrect === undefined) {
            alert(guessResult.error || "Attempt failed.");
            closeResultModal();
            return;
        }

        // 2. Upload selfie
        const formData = new FormData();
        formData.append("playerId", playerId);
        formData.append("photo", file);

        const selfieRes = await fetch("/api/submit-selfie", {
            method: "POST",
            body: formData
        });
        const selfieResult = await selfieRes.json();

        if (selfieResult.success || selfieResult.ok) {
            
            if (guessResult.isCorrect) {
                title.innerText = "Correct! 🎉";
                title.style.color = "#10b981"; // Green
                text.innerText = `You correctly identified ${guessResult.targetName} and gained ${guessResult.scoreDelta} points! Moving to next case...`;
            } else {
                title.innerText = "Wrong! ❌";
                title.style.color = "#ef4444"; // Red
                text.innerText = `That was actually ${guessResult.guessedName}, not the target! You lost 30 points. Try this case again!`;
            }

            btnNext.innerText = "CONTINUE";
            btnNext.onclick = () => {
                closeResultModal();
                selectedSuspectId = null;
                renderSuspectGrid();
                loadCards(); 
            };
            btnNext.classList.remove("hidden");
        } else {
            alert(selfieResult.error || "Upload failed");
            closeResultModal();
        }
    } catch (e) {
        console.error("Upload failed:", e);
        alert("An error occurred during verification.");
        closeResultModal();
    }
}


window.closeResultModal = function() {
    document.getElementById("resultModal").classList.add("hidden");
}

// 3D Card Interactions
const card3d = document.getElementById('card');
let isDragging = false, startX, startY, rotX = 0, rotY = 0, flipped = false;
let dragDistance = 0;
let cardOpened = false;

if (card3d) {
    card3d.addEventListener('mousedown', e => { 
        isDragging = true; 
        startX = e.clientX; 
        startY = e.clientY; 
        dragDistance = 0;
        card3d.style.cursor = 'grabbing'; 
        card3d.style.transition = 'none';
    });
    
    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        dragDistance += Math.abs(e.movementX) + Math.abs(e.movementY);
        rotY = Math.max(Math.min((e.clientX - startX) * 0.6, 35), -35);
        rotX = Math.max(Math.min(-(e.clientY - startY) * 0.55, 35), -35);
        card3d.style.transform = `rotateX(${rotX}deg) rotateY(${flipped ? 180 + rotY : rotY}deg)`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            card3d.style.cursor = 'grab';
            card3d.style.transition = 'transform 0.8s cubic-bezier(0.23,1,0.32,1)';
            card3d.style.transform = `rotateX(0deg) rotateY(${flipped ? 180 : 0}deg)`;
        }
    });

    card3d.addEventListener('click', () => {
        if (dragDistance > 10) return; // It was a drag, not a click
        
        flipped = !flipped;
        card3d.style.transition = 'transform 1.1s';
        card3d.style.transform = flipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
        
        // Start the timer when flipped to the back for the first time
        if (flipped && !cardOpened && currentCardId) {
            cardOpened = true;
            startVisualTimer(0);
            fetch("/api/open-card", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId, cardId: currentCardId })
            }).catch(e => console.warn("Timer start failed:", e));
        }
    });
}

function playCardEntrance(alreadyOpened = false) {
    if (!card3d) return;
    flipped = alreadyOpened;
    cardOpened = alreadyOpened;
    card3d.style.transition = 'none';
    card3d.style.transform = 'translateY(140px) rotateX(-40deg) rotateY(-50deg) scale(0.65)';
    card3d.style.opacity = '0';
    setTimeout(() => {
        card3d.style.transition = 'all 1.8s cubic-bezier(0.34,1.56,0.64,1)';
        card3d.style.transform = alreadyOpened ? 'translateY(0) rotateX(0) rotateY(180deg) scale(1)' : 'translateY(0) rotateX(0) rotateY(0) scale(1)';
        card3d.style.opacity = '1';
    }, 80);
}

loadCards();
