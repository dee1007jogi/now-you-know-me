/* admin.js – Redesigned Mission Control High-Fidelity Logic */
window.onerror = function(msg, url, line, col, error) {
    console.error("GLOBAL ERROR:", msg, "at", url, ":", line, ":", col, error);
    const div = document.createElement("div");
    div.style.cssText = "position:fixed; top:0; left:0; right:0; background:red; color:white; z-index:99999; padding:20px; font-family:monospace; font-size:14px; word-break:break-all;";
    div.innerText = `GLOBAL ERROR: ${msg}\nLine: ${line}\nURL: ${url}\nError: ${error ? error.stack : ''}`;
    document.body.appendChild(div);
    return false;
};

const socket = io();
const readyCount = document.getElementById("readyCount");
const joinedTotal = document.getElementById("joinedTotal");
const displayCode = document.getElementById("displayCode");

let appState = null;

// QR Code Setup
const qrcodeEl = document.getElementById("qrcode");
let qrcode = null;
if (qrcodeEl) {
  qrcode = new QRCode(qrcodeEl, {
    text: window.location.origin,
    width: 256, height: 256,
    colorDark: "#0c0c0e",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

window.addEventListener('load', () => {
  try {
    updateMissionCode();
  } catch (e) {
    console.error("Setup Failed:", e);
  }
});

/* ---- SOCKET SYNC ---- */
socket.on("state", (s) => {
  appState = s;
  updateUI(s);
  if (window.bgmController) window.bgmController.syncWithState(s);
});

function updateUI(s) {
  // Basic stats
  if (readyCount) readyCount.innerText = s.readyCount;
  if (joinedTotal) joinedTotal.innerText = s.playersCount;
  
  const cardsCountEl = document.getElementById("cardsCount");
  if (cardsCountEl) cardsCountEl.innerText = `${s.cardsCount} Generated`;

  // Launch validation: Always active
  const warningEl = document.getElementById("startWarning");
  if (warningEl) warningEl.style.display = "none";
  const launchButtons = document.querySelectorAll(".btn-launch");
  launchButtons.forEach(btn => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
  });

  // Status update
  const statusMap = { lobby: "Lobby ⏳", live: "Live 🟢", ended: "Ended 🏁" };
  const pillStatusEl = document.getElementById("pillStatus");
  if (pillStatusEl) {
    pillStatusEl.innerText = statusMap[s.status] || s.status;
    pillStatusEl.style.color = s.status === 'live' ? '#10b981' : (s.status === 'ended' ? '#ef4444' : '#fbbf24');
  }

  // Lever updates
  document.querySelectorAll('.lever-card').forEach(l => l.classList.remove('active'));
  if (s.status === "lobby") {
    const el = document.getElementById("leverLobby");
    if (el) el.classList.add("active");
  }
  if (s.status === "live") {
    const el = document.getElementById("leverLive");
    if (el) el.classList.add("active");
  }
  if (s.status === "ended") {
    const el = document.getElementById("leverEnded");
    if (el) el.classList.add("active");
  }

  // Lobby tab participant grid
  renderParticipantGrid(s.leaderboard);

  // Pending Selfies Moderation
  const pendingSelfies = s.selfies ? s.selfies.filter(x => x.status === "pending") : [];
  const pendingCountEl = document.getElementById("pendingSelfieCount");
  if (pendingCountEl) pendingCountEl.innerText = pendingSelfies.length;
  renderModerationList(pendingSelfies);

  // Compute and Update Metrics Row
  updateMetricsRow(s);

  // Update Professor Owl's insights
  updateOwlInsight(s);

  // Update live event logs
  renderEventLog(s.selfies);

  // Update Leaderboard Tab Elements
  const tabLeaderboardContent = document.getElementById("tabLeaderboardContent");
  if (tabLeaderboardContent && !tabLeaderboardContent.classList.contains("hidden")) {
      renderLeaderboardList();
      renderSelfieStream();
      if (selectedPlayerId) {
          renderDossierDetail(selectedPlayerId);
      }
  }
  
  // Update playerCountText if it exists
  const pct = document.getElementById("playerCountText");
  if (pct) pct.innerText = `${s.playersCount || 0} Agents`;
}

// Compute Metrics Row (Active, Avg Response, Match Rate, Creativity Pool)
function updateMetricsRow(s) {
    // 1. Active Players card
    const activeEl = document.getElementById("metricActivePlayers");
    if (activeEl) {
        activeEl.innerText = `${s.readyCount} / ${s.playersCount}`;
    }

    // 2. Average Response Speed
    const speedEl = document.getElementById("metricAvgResponse");
    if (speedEl) {
        const playersWithSpeed = s.leaderboard.filter(p => p.avgCorrectSec !== null);
        const avgSpeed = playersWithSpeed.length 
            ? (playersWithSpeed.reduce((sum, p) => sum + p.avgCorrectSec, 0) / playersWithSpeed.length).toFixed(1) + 's' 
            : '--s';
        speedEl.innerText = avgSpeed;
    }

    // 3. Match Rate
    const rateEl = document.getElementById("metricMatchRate");
    if (rateEl) {
        const totalGuesses = s.selfies ? s.selfies.length : 0;
        const correctGuesses = s.selfies ? s.selfies.filter(x => x.isCorrect).length : 0;
        const matchRate = totalGuesses ? Math.round((correctGuesses / totalGuesses) * 100) + '%' : '0%';
        rateEl.innerText = matchRate;
    }

    // 4. Creativity Pool points
    const poolEl = document.getElementById("metricCreativityPool");
    if (poolEl) {
        const creativitySum = s.selfies 
            ? s.selfies.reduce((sum, x) => sum + (x.creativityPoints || 0), 0) 
            : 0;
        poolEl.innerText = `${creativitySum} pts`;
    }
}

// Render dynamic Professor Owl insights
function updateOwlInsight(s) {
    const textEl = document.getElementById("owlInsightText");
    if (!textEl) return;
    
    if (s.playersCount === 0) {
        textEl.innerText = "Waiting for detectives to join the network. Scanning coordinates...";
        return;
    }
    
    if (s.status === "lobby") {
        const fullyReady = s.readyCount;
        textEl.innerText = `Onboarding in progress. ${fullyReady} of ${s.playersCount} agents are fully registered. Encourage the remaining agents to submit their sketch photos and dossier files!`;
        return;
    }
    
    if (s.status === "ended") {
        textEl.innerText = "Operation complete! Review the final Leaderboard scores. Export the results to CSV for record keeping.";
        return;
    }
    
    const totalGuesses = s.selfies ? s.selfies.length : 0;
    if (totalGuesses === 0) {
        textEl.innerText = "Operation is live! Advise agents to look around the room, identify their targets, and submit guesses via their mobile device.";
        return;
    }
    
    const correctGuesses = s.selfies.filter(x => x.isCorrect).length;
    const accuracy = Math.round((correctGuesses / totalGuesses) * 100);
    
    if (accuracy >= 70) {
        textEl.innerText = `Outstanding accuracy of ${accuracy}%! The detectives are identifying targets with high precision. Consider activating Chaos Mode to increase the difficulty!`;
    } else if (accuracy <= 40) {
        textEl.innerText = `Low match accuracy detected (${accuracy}%). Advise players to consult the Dossier Files carefully before taking snaps!`;
    } else {
        textEl.innerText = `Match operation is active. Accuracy is holding at ${accuracy}%. Remind players that speed and correctness both multiply final point payouts!`;
    }
}

// Render Game Event Log Card
function renderEventLog(selfies) {
    const container = document.getElementById("eventLogContainer");
    if (!container) return;
    
    container.innerHTML = "";
    if (!selfies || selfies.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; opacity: 0.3; font-size: 0.85rem; color: white;">No match events recorded yet.</div>`;
        return;
    }
    
    const sorted = [...selfies].reverse(); // latest first
    
    sorted.forEach(s => {
        const item = document.createElement("div");
        item.className = "log-item animate-pop";
        item.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 0.85rem;
            color: #e2e8f0;
        `;
        
        const timeText = s.elapsed !== undefined ? `${s.elapsed}s` : '?s';
        if (s.isCorrect) {
            item.innerHTML = `
                <div>
                    <span style="color: var(--neon-cyan); font-weight: 700;">${s.playerName}</span> 
                    matched 
                    <span style="color: #fff; font-weight: 700;">${s.targetName}</span>
                </div>
                <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); display: flex; gap: 8px; align-items: center;">
                    <span>${timeText}</span>
                    <span style="color: var(--neon-cyan);">✅</span>
                </div>
            `;
        } else {
            item.innerHTML = `
                <div>
                    <span style="color: #ef4444; font-weight: 700;">${s.playerName}</span> 
                    guessed 
                    <span style="color: rgba(255,255,255,0.6);">${s.guessedName}</span>
                </div>
                <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); display: flex; gap: 8px; align-items: center;">
                    <span>${timeText}</span>
                    <span style="color: #ef4444;">❌</span>
                </div>
            `;
        }
        container.appendChild(item);
    });
}

function renderModerationList(pendingSelfies) {
    const list = document.getElementById("moderationList");
    if (!list) return;

    list.innerHTML = "";

    if (pendingSelfies.length === 0) {
        list.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.3; color:white;">No selfies pending review. 🕵️</div>`;
        return;
    }

    pendingSelfies.forEach(s => {
        const item = document.createElement("div");
        item.className = "inc-row animate-pop";
        item.style.cssText = `
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 15px !important;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 20px;
            margin-bottom: 15px;
        `;

        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:900; font-size:1.1rem; color:var(--gold-bright);">${s.playerName}</span>
                <span style="font-size:0.8rem; background:${s.isCorrect ? '#10b981' : '#ef4444'}; color:white; padding:4px 10px; border-radius:8px; font-weight:800;">Guessed: ${s.guessedName} (${s.isCorrect ? 'Correct' : 'Wrong'})</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:rgba(255,255,255,0.4); font-weight:700; margin-top:-5px;">
                <span>Target player was: ${s.targetName}</span>
                <span>⏱️ Time taken: <strong style="color:var(--neon-cyan);">${s.elapsed !== undefined ? s.elapsed : '?'}s</strong></span>
            </div>
            <div style="width:100%; height:280px; overflow:hidden; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:#000;">
                <img src="${s.photoUrl}" style="width:100%; height:100%; object-fit:cover;" />
            </div>
            <div style="display:flex; gap:15px; align-items:center; flex-wrap:wrap;">
                <span style="font-weight:700; font-size:0.9rem; color:rgba(255,255,255,0.6);">Creativity Points (0-80):</span>
                <input type="range" min="0" max="80" value="40" class="creativity-slider" style="flex:1; accent-color:var(--neon-cyan); height:6px; border-radius:3px;" oninput="this.nextElementSibling.innerText = this.value" />
                <span style="font-weight:800; color:var(--neon-cyan); min-width:30px; text-align:right; font-size:1.1rem;">40</span>
                <button class="btn-incomplete" style="width:auto; padding:10px 25px; margin:0;" onclick="scoreSelfie('${s.id}', this.previousElementSibling.previousElementSibling.value, this)">Award Points</button>
            </div>
        `;
        list.appendChild(item);
    });
}

window.scoreSelfie = async function(selfieId, score, btn) {
    if (btn) {
        btn.innerText = "⏳ Saving...";
        btn.disabled = true;
    }
    
    try {
        const headers = { "Content-Type": "application/json" };
        if (window.adminAuthToken) headers["Authorization"] = "Basic " + window.adminAuthToken;
        
        const res = await fetch("/api/admin/score-selfie", {
            method: "POST",
            headers,
            body: JSON.stringify({ selfieId, score })
        });
        const out = await res.json();
        
        if (!res.ok) {
            alert(out.error || "Scoring failed");
            if (btn) {
                btn.innerText = "Award Points";
                btn.disabled = false;
            }
        }
    } catch(e) {
        console.error("Score selfie failed:", e);
        alert("Connection lost. Try again.");
        if (btn) {
            btn.innerText = "Award Points";
            btn.disabled = false;
        }
    }
};

function renderParticipantGrid(players) {
  const grid = document.getElementById("participantGrid");
  if (!grid) return;
  grid.innerHTML = "";
  
  const completed = players.filter(p => p.name && p.photoUrl && p.answers && Object.keys(p.answers).length >= 7);
  
  completed.forEach(p => {
    const div = document.createElement("div");
    div.className = `mini-bust ready`;
    div.style.cursor = "pointer";
    div.onclick = () => showPlayerProfile(p.id);
    div.innerHTML = `<img src="${p.photoUrl}" />`;
    grid.appendChild(div);
  });

  if (completed.length === 0) {
     grid.innerHTML = '<div style="opacity:0.2; font-size:0.7rem; text-align:center; padding:20px; grid-column:1/-1;">No agents fully ready yet...</div>';
  }

  // Update the onboarding gaps overlay grid if open
  renderIncompleteGrid(players);
}

function getPlayerLobbyStatus(p) {
  const hasAnswers = p.answers && Object.keys(p.answers).length >= 7;
  if (hasAnswers || p.lobbyQuestionIndex === 10) {
    return {
      text: "Successfully Submitted",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.15)",
      border: "1px solid rgba(16, 185, 129, 0.3)"
    };
  }
  
  if (p.lobbyQuestionIndex !== undefined && p.lobbyQuestionIndex >= 0) {
    const qNum = p.lobbyQuestionIndex + 1;
    return {
      text: `Answering Q${qNum}`,
      color: "#22d3ee",
      bg: "rgba(34, 211, 238, 0.15)",
      border: "1px solid rgba(34, 211, 238, 0.3)"
    };
  }
  
  const hasPhoto = p.photoUrl && p.photoUrl !== "/assets/detective_sketch.png";
  if (hasPhoto) {
    return {
      text: "Not Yet Answered",
      color: "#fbbf24",
      bg: "rgba(251, 191, 36, 0.15)",
      border: "1px solid rgba(251, 191, 36, 0.3)"
    };
  }
  
  return {
    text: "Joined the Game",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.15)",
    border: "1px solid rgba(148, 163, 184, 0.3)"
  };
}

function renderIncompleteGrid(players) {
    const grid = document.getElementById("incompleteGrid");
    if (!grid) return;
    
    grid.innerHTML = "";

    if (players.length === 0) {
        grid.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.3; color:white;">No agents in lobby...</div>';
        return;
    }

    const sortedPlayers = [...players].sort((a, b) => {
        const statusA = getPlayerLobbyStatus(a);
        const statusB = getPlayerLobbyStatus(b);
        
        const order = {
            "Joined the Game": 1,
            "Not Yet Answered": 2,
            "Answering Q": 3,
            "Successfully Submitted": 4
        };
        
        const getBaseStatus = (text) => {
            if (text.startsWith("Answering Q")) return "Answering Q";
            return text;
        };
        
        const priorityA = order[getBaseStatus(statusA.text)] || 5;
        const priorityB = order[getBaseStatus(statusB.text)] || 5;
        
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        if (priorityA === 3) {
            return a.lobbyQuestionIndex - b.lobbyQuestionIndex;
        }
        
        return (a.name || "").localeCompare(b.name || "");
    });

    sortedPlayers.forEach(p => {
        const row = document.createElement("div");
        row.className = "inc-row animate-pop";
        row.style.cursor = "pointer";
        row.onclick = () => {
            document.getElementById("incompleteOverlay").classList.remove("active");
            showPlayerProfile(p.id);
        };
        
        const status = getPlayerLobbyStatus(p);
        
        row.innerHTML = `
            <div class="inc-p-info">
                <img src="${p.photoUrl || '/assets/detective_sketch.png'}" class="inc-avatar" style="width:40px; height:40px; border-radius:12px; object-fit:cover;" />
                <span style="font-weight:700; font-size:1rem; color:white;">${p.name || 'Anonymous Intelligence'}</span>
            </div>
            <div class="inc-status-pills">
                <span class="inc-status-pill" style="font-size:0.75rem; padding:6px 12px; border-radius:8px; font-weight:800; color:${status.color}; background:${status.bg}; border:${status.border}; letter-spacing:0.5px;">
                    ${status.text.toUpperCase()}
                </span>
            </div>
        `;
        grid.appendChild(row);
    });
}

// Button Handlers for Incomplete Modal
const viewIncompleteBtn = document.getElementById("viewIncompleteBtn");
if (viewIncompleteBtn) {
    viewIncompleteBtn.onclick = () => {
        document.getElementById("incompleteOverlay").classList.add("active");
    };
}
const closeIncomplete = document.getElementById("closeIncomplete");
if (closeIncomplete) {
    closeIncomplete.onclick = () => {
        document.getElementById("incompleteOverlay").classList.remove("active");
    };
}

function updateMissionCode() {
  fetch("/api/session").then(r => r.json()).then(d => {
    if (displayCode) displayCode.innerText = d.code;
    const sessionCodeHeader = document.querySelector(".session-code-header");
    if (sessionCodeHeader) sessionCodeHeader.innerText = d.code;
    const joinUrl = window.location.origin;
    const joinUrlEl = document.getElementById("joinUrl");
    if (joinUrlEl) joinUrlEl.innerText = joinUrl.replace("https://", "").replace("http://", "");
    
    if (qrcode) {
        qrcode.clear();
        qrcode.makeCode(`${joinUrl}/?code=${d.code}`);
    }
  });
}

/* ---- UI HANDLERS (Dual-Control Support) ---- */
function setupButton(selector, endpoint, isConfirm = false) {
  const msgEl = document.getElementById("adminMsg");
  document.querySelectorAll(selector).forEach(btn => {
    btn.onclick = async () => {
      if (isConfirm && !confirm("Are you sure?")) return;

      try {
        if (endpoint.includes("export")) {
          window.location.href = endpoint;
          return;
        }

        const headers = window.adminAuthToken ? { "Authorization": "Basic " + window.adminAuthToken } : {};
        const res = await fetch(endpoint, { method: "POST", headers });
        const data = await res.json();

        if (!res.ok) {
          if (msgEl) {
            msgEl.innerText = `⚠️ ${data.error || 'Failed'}`;
            msgEl.style.color = "#ef4444";
            gsap.from(msgEl, { y: 10, opacity: 0, duration: 0.3 });
            setTimeout(() => { if (msgEl.style.color === "rgb(239, 68, 68)") msgEl.innerText = ""; }, 5000);
          }
          return;
        }

        if (msgEl) {
          msgEl.innerText = "✅ Command Transmitted";
          msgEl.style.color = "var(--neon-cyan)";
          setTimeout(() => { if (msgEl.innerText.includes("✅")) msgEl.innerText = ""; }, 3000);
        }
      } catch (e) {
        console.error("Button Action Failed:", e);
        if (msgEl) msgEl.innerText = "❌ Connection Error";
      }
    };
  });
}

setupButton(".btn-launch", "/api/admin/start");
setupButton(".btn-danger", "/api/admin/end", true);
setupButton(".btn-secondary", "/api/admin/export");
setupButton("#resetBtn", "/api/admin/reset", true);

// QR Overlay close
const closeQr = document.getElementById("closeQr");
if (closeQr) {
    closeQr.onclick = () => document.getElementById("qrOverlay").classList.remove("active");
}

// Exit game logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = () => {
        localStorage.clear();
        location.href = "/";
    };
}

// --- Sidebar Tab Switching Handler ---
const navIntelligenceBtn = document.getElementById("navIntelligenceBtn");
const navAdminBtn = document.getElementById("navAdminBtn");
const navTelemetryBtn = document.getElementById("navTelemetryBtn");

const tabIntelligenceContent = document.getElementById("tabIntelligenceContent");
const tabAdminContent = document.getElementById("tabAdminContent");
const tabTelemetryContent = document.getElementById("tabTelemetryContent");

function switchTab(activeBtn, activeContent) {
    const activeId = activeBtn ? activeBtn.id : "none";
    const contentId = activeContent ? activeContent.id : "none";
    console.log(`switchTab activeBtn: ${activeId}, activeContent: ${contentId}`);

    let dbg = document.getElementById("debugTabOverlay");
    if (!dbg) {
        dbg = document.createElement("div");
        dbg.id = "debugTabOverlay";
        dbg.style.cssText = "position:fixed; bottom:10px; right:10px; background:rgba(0,0,255,0.8); color:white; z-index:99999; padding:10px 20px; font-family:monospace; font-size:12px; border-radius:8px;";
        document.body.appendChild(dbg);
    }
    dbg.innerText = `switchTab: ${activeId} -> ${contentId} (processing...)`;

    [navIntelligenceBtn, navAdminBtn, navTelemetryBtn].forEach(btn => {
        if (btn) btn.classList.remove("active");
    });
    [tabIntelligenceContent, tabAdminContent, tabTelemetryContent].forEach(content => {
        if (content) content.classList.add("hidden");
    });

    if (activeBtn) activeBtn.classList.add("active");
    if (activeContent) activeContent.classList.remove("hidden");
    
    // Rerender leaderboard lists if active
    if (activeBtn === navIntelligenceBtn && appState) {
        dbg.innerText += ` | rendering leaderboard...`;
        renderLeaderboardList();
        renderSelfieStream();
        if (selectedPlayerId) {
            renderDossierDetail(selectedPlayerId);
        }
    }
    // Force close mobile sidebar on switch
    const sidebar = document.querySelector(".sidebar");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
    }
    if (sidebarOverlay && sidebarOverlay.classList.contains("active")) {
        sidebarOverlay.classList.remove("active");
    }

    dbg.innerText = `switchTab: ${activeId} -> ${contentId} (done)`;
}

if (navIntelligenceBtn) navIntelligenceBtn.onclick = () => switchTab(navIntelligenceBtn, tabIntelligenceContent);
if (navAdminBtn) navAdminBtn.onclick = () => switchTab(navAdminBtn, tabAdminContent);
if (navTelemetryBtn) navTelemetryBtn.onclick = () => switchTab(navTelemetryBtn, tabTelemetryContent);

// Close profile modal listener
const closeProfileBtn = document.getElementById("closeProfileBtn");
if (closeProfileBtn) {
    closeProfileBtn.onclick = () => {
        document.getElementById("profileOverlay").classList.remove("active");
    };
}

// Compute player interaction level rank dynamically
function getInteractionLevel(p, selfiesCount) {
    const score = p.score || 0;
    const speed = p.avgCorrectSec;
    const correct = p.correct || 0;
    
    if (score >= 400 || (correct >= 4 && speed !== null && speed <= 25)) {
        return {
            text: "Elite Investigator 🎖️",
            color: "#c084fc",
            bg: "rgba(192, 132, 252, 0.15)",
            border: "1px solid rgba(192, 132, 252, 0.3)"
        };
    } else if (selfiesCount >= 3 || correct >= 3) {
        return {
            text: "Social Matchmaker 🤝",
            color: "#22d3ee",
            bg: "rgba(34, 211, 238, 0.15)",
            border: "1px solid rgba(34, 211, 238, 0.3)"
        };
    } else if (speed !== null && speed <= 20) {
        return {
            text: "Speedy Detective ⚡",
            color: "#f59e0b",
            bg: "rgba(245, 158, 11, 0.15)",
            border: "1px solid rgba(245, 158, 11, 0.3)"
        };
    } else if (correct > 0) {
        return {
            text: "Steady Observer 🔍",
            color: "#10b981",
            bg: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)"
        };
    } else {
        return {
            text: "Fresh Recruit 🕵️",
            color: "#94a3b8",
            bg: "rgba(148, 163, 184, 0.15)",
            border: "1px solid rgba(148, 163, 184, 0.3)"
        };
    }
}

// Open player profile modal overlay with real-time stats
window.showPlayerProfile = function(playerId) {
    const p = appState.leaderboard.find(x => x.id === playerId);
    if (!p) return;

    const playerSelfies = appState.selfies ? appState.selfies.filter(s => s.playerId === playerId) : [];

    document.getElementById("profileName").innerText = p.name;
    document.getElementById("profilePhoto").src = p.photoUrl || "/assets/detective_sketch.png";

    const level = getInteractionLevel(p, playerSelfies.length);
    const lvlEl = document.getElementById("profileInteractionLevel");
    lvlEl.innerText = `LEVEL OF INTERACTION: ${level.text}`;
    lvlEl.style.color = level.color;
    lvlEl.style.background = level.bg;
    lvlEl.style.border = level.border;

    document.getElementById("profileScore").innerText = `${p.score} pts`;
    document.getElementById("profileWrong").innerText = `${p.wrong} (${p.wrong * -30} pts)`;

    const speedVal = p.avgCorrectSec !== null ? `${p.avgCorrectSec}s avg` : "--s avg";
    const accuracyVal = p.accuracy !== undefined ? `${p.accuracy}% acc` : "";
    document.getElementById("profileSpeed").innerHTML = `${speedVal}<br/><span style="font-size:0.75rem; opacity:0.6;">${accuracyVal}</span>`;

    const answersContainer = document.getElementById("profileAnswers");
    answersContainer.innerHTML = "";
    if (p.answers) {
        const labelsMap = {
            workStyle: "Work Style",
            teamRole: "Team Role",
            meetingPower: "Meeting Superpower",
            breakStyle: "Ideal Break",
            updatesVia: "Updates via",
            recharge: "Recharge Method",
            morningFuel: "Morning Fuel",
            workspaceQuirk: "Workspace Quirk",
            weekendRoutine: "Weekend Routine",
            surprisingSkill: "Surprising Skill"
        };
        Object.keys(p.answers).forEach(key => {
            const label = labelsMap[key] || key;
            const val = p.answers[key];
            const div = document.createElement("div");
            div.style.cssText = "background:rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);";
            div.innerHTML = `<strong style="color:var(--neon-cyan); display:block; font-size:0.7rem; text-transform:uppercase;">${label}</strong><span style="color:white; font-weight:600;">${val}</span>`;
            answersContainer.appendChild(div);
        });
    } else {
        answersContainer.innerHTML = "<div style='grid-column: 1/-1; opacity:0.3; padding:10px; text-align:center;'>No clues answered yet.</div>";
    }

    const selfiesContainer = document.getElementById("profileSelfies");
    selfiesContainer.innerHTML = "";
    if (playerSelfies.length > 0) {
        playerSelfies.forEach(s => {
            const div = document.createElement("div");
            div.style.cssText = "position:relative; width:100%; aspect-ratio:1; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);";
            div.innerHTML = `
                <img src="${s.photoUrl}" style="width:100%; height:100%; object-fit:cover;" />
                <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); padding:4px; font-size:0.6rem; text-align:center; font-weight:800; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Guessed: ${s.guessedName}">
                    vs ${s.guessedName}
                </div>
            `;
            selfiesContainer.appendChild(div);
        });
    } else {
        selfiesContainer.innerHTML = "<div style='grid-column: 1/-1; opacity:0.3; padding:10px; text-align:center; color:white;'>No selfies taken yet.</div>";
    }

    document.getElementById("profileOverlay").classList.add("active");
};



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


// --- Live Leaderboard Tab State ---
let selectedPlayerId = null;

// 1. Render Left Column (Leaderboard list in main tab)
window.renderLeaderboardList = function() {
    const container = document.getElementById("leaderboardList");
    if (!container) return;
    container.innerHTML = "";

    if (!appState || !appState.leaderboard || appState.leaderboard.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.3; color:white;">Waiting for agents to join...</div>`;
        return;
    }

    let filteredPlayers = appState.leaderboard;
    if (window.currentLeaderboardFilter === 'ready') {
        filteredPlayers = filteredPlayers.filter(p => p.answers && Object.keys(p.answers).length >= 7);
    } else if (window.currentLeaderboardFilter === 'pending') {
        filteredPlayers = filteredPlayers.filter(p => !p.answers || Object.keys(p.answers).length < 7);
    }

    if (filteredPlayers.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.3; color:white;">No agents match this filter.</div>`;
        return;
    }

    filteredPlayers.forEach((p, i) => {
        const rank = i + 1;
        let rankClass = "";
        let rankMedal = "";
        if (rank === 1) { rankClass = "rank-1"; rankMedal = "🥇 "; }
        else if (rank === 2) { rankClass = "rank-2"; rankMedal = "🥈 "; }
        else if (rank === 3) { rankClass = "rank-3"; rankMedal = "🥉 "; }

        const wrongPenalty = (p.wrong || 0) * 30; // 30 pts penalty per wrong answer
        const penaltyHtml = wrongPenalty > 0 ? `<span class="player-penalty" style="color: #ef4444; font-size: 0.8rem; font-weight: 800; margin-right: 10px; text-shadow: 0 0 8px rgba(239,68,68,0.5);">(-${wrongPenalty})</span>` : "";

        const row = document.createElement("div");
        row.className = `leaderboard-row animate-pop ${p.id === selectedPlayerId ? 'active' : ''} ${rankClass}`;
        row.onclick = () => {
            document.querySelectorAll(".leaderboard-row").forEach(r => r.classList.remove("active"));
            row.classList.add("active");

            selectedPlayerId = p.id;
            renderDossierDetail(p.id);
        };

        let lobbyStatusBadge = "";
        if (appState.status === "lobby") {
            const status = getPlayerLobbyStatus(p);
            lobbyStatusBadge = `
                <span style="font-size:0.6rem; padding:2px 6px; border-radius:6px; font-weight:800; text-transform:uppercase; color:${status.color}; background:${status.bg}; border:${status.border}; margin-left:8px; display:inline-block; vertical-align:middle; letter-spacing:0.5px;">
                    ${status.text}
                </span>
            `;
        }

        row.innerHTML = `
            <div class="leaderboard-player">
                <span class="player-rank">${rankMedal}#${rank}</span>
                <img src="${p.photoUrl || '/assets/detective_sketch.png'}" class="player-avatar" />
                <div class="player-info">
                    <span class="player-name">${p.name || 'Anonymous Intelligence'} ${lobbyStatusBadge}</span>
                </div>
            </div>
            <div style="display:flex; align-items:center;">
                ${penaltyHtml}
                <span class="player-score">${p.score || 0} <span>pts</span></span>
            </div>
        `;

        container.appendChild(row);
    });
};

// 2. Render Middle Column (Dossier detail in main tab)
window.renderDossierDetail = function(playerId) {
    const container = document.getElementById("dossierContent");
    if (!container) return;
    const p = appState.leaderboard.find(x => x.id === playerId);

    if (!p) {
        container.innerHTML = `
            <div class="dossier-placeholder">
                <span>🕵️</span>
                <p>Select an investigator row on the left to pull up their target dossier file & captured match selfies.</p>
            </div>
        `;
        return;
    }

    const playerSelfies = appState.selfies ? appState.selfies.filter(s => s.playerId === playerId) : [];
    const level = getInteractionLevel(p, playerSelfies.length);

    let cluesHtml = "";
    if (p.answers) {
        const labelsMap = {
            workStyle: "Work Style",
            teamRole: "Team Role",
            meetingPower: "Meeting Superpower",
            breakStyle: "Ideal Break",
            updatesVia: "Updates via",
            recharge: "Recharge Method",
            morningFuel: "Morning Fuel",
            workspaceQuirk: "Workspace Quirk",
            weekendRoutine: "Weekend Routine",
            surprisingSkill: "Surprising Skill"
        };
        Object.keys(p.answers).forEach(key => {
            const label = labelsMap[key] || key;
            const val = p.answers[key];
            cluesHtml += `
                <div class="dossier-clue-card">
                    <span class="dossier-clue-label">${label}</span>
                    <span class="dossier-clue-val">${val}</span>
                </div>
            `;
        });
    } else {
        cluesHtml = `<div style="grid-column:1/-1; opacity:0.3; text-align:center; padding:10px;">No clue data completed.</div>`;
    }

    let selfiesHtml = "";
    if (playerSelfies.length > 0) {
        playerSelfies.forEach(s => {
            selfiesHtml += `
                <div class="dossier-selfie-card">
                    <img src="${s.photoUrl}" alt="Selfie" />
                    <div class="dossier-selfie-vs">vs ${s.guessedName}</div>
                </div>
            `;
        });
    } else {
        selfiesHtml = `<div style="grid-column:1/-1; opacity:0.3; text-align:center; padding:15px; color:white;">No selfies captured yet.</div>`;
    }

    const speedText = p.avgCorrectSec !== null ? `${p.avgCorrectSec}s avg` : "--s";
    const accuracyText = p.accuracy !== undefined ? `${p.accuracy}% acc` : "--% acc";

    container.innerHTML = `
        <!-- Dossier Header -->
        <div class="dossier-profile">
            <img src="${p.photoUrl || '/assets/detective_sketch.png'}" class="dossier-avatar" />
            <div>
                <h2 class="dossier-name">${p.name || 'Anonymous Investigator'}</h2>
                <span class="dossier-level" style="color:${level.color}; background:${level.bg}; border:${level.border};">
                    ${level.text}
                </span>
            </div>
        </div>

        <!-- Dossier Metrics -->
        <div class="dossier-metrics">
            <div class="dossier-metric-box">
                <h6>Score</h6>
                <span class="dossier-metric-val" style="color:var(--neon-blue);">${p.score || 0} pts</span>
            </div>
            <div class="dossier-metric-box">
                <h6>Accuracy/Speed</h6>
                <span class="dossier-metric-val" style="color:var(--gold-bright); font-size: 0.8rem; line-height: 1.2; display:block; margin-top:3px;">
                    ${speedText}<br/>${accuracyText}
                </span>
            </div>
            <div class="dossier-metric-box">
                <h6>Wrong Guesses</h6>
                <span class="dossier-metric-val" style="color:#ef4444;">${p.wrong || 0} <small style="font-size:0.6rem; display:block; margin-top:2px;">(${(p.wrong || 0) * -30} pts)</small></span>
            </div>
        </div>

        <!-- Clues Grid -->
        <h4 style="font-size: 0.75rem; text-transform:uppercase; color:var(--gold-bright); letter-spacing:1px; margin: 15px 0 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:5px;">🔍 Dossier File Clues</h4>
        <div class="dossier-clues">
            ${cluesHtml}
        </div>

        <!-- Captured Selfies Grid -->
        <h4 style="font-size: 0.75rem; text-transform:uppercase; color:var(--gold-bright); letter-spacing:1px; margin: 25px 0 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:5px;">📸 Target Captured Selfies</h4>
        <div class="dossier-selfies">
            ${selfiesHtml}
        </div>
    `;
};

// 3. Render Right Column (Live chronological selfie feed in main tab)
window.renderSelfieStream = function() {
    const container = document.getElementById("selfiesStream");
    if (!container) return;
    const countEl = document.getElementById("selfiesCountText");

    if (!appState || !appState.selfies || appState.selfies.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; opacity:0.3; color:white;">No selfies captured in this session yet. 📸</div>`;
        if (countEl) countEl.innerText = "0 Snaps";
        return;
    }

    const selfies = [...appState.selfies].reverse();
    if (countEl) countEl.innerText = `${selfies.length} Snaps`;
    container.innerHTML = "";

    selfies.forEach(s => {
        const card = document.createElement("div");
        card.className = "stream-card";
        card.style.borderColor = s.isCorrect ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";

        const correctBadge = s.isCorrect 
            ? `<span class="stream-badge badge-correct">Correct Match</span>`
            : `<span class="stream-badge badge-wrong">Wrong Match</span>`;

        const pointsBadge = s.status === "approved"
            ? `<span class="stream-badge badge-pts">✨ +${s.creativityPoints} pts</span>`
            : `<span class="stream-badge" style="background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.5);">⏳ Reviewing</span>`;

        card.innerHTML = `
            <div class="stream-img-container">
                <img src="${s.photoUrl}" alt="Selfie Snapshot" />
                <div class="stream-badges">
                    ${correctBadge}
                    ${pointsBadge}
                </div>
            </div>
            <div class="stream-info">
                <div class="stream-players">
                    <span>${s.playerName}</span> guessed <strong>${s.guessedName}</strong>
                </div>
                <div class="stream-time">
                    Target was: <strong>${s.targetName}</strong> | Response: ${s.elapsed !== undefined ? s.elapsed : '?'}s
                </div>
            </div>
        `;

        container.appendChild(card);
    });
};

/* --- Global Event Trigger Toast Banners --- */
const msgEl = document.getElementById("adminMsg");
function showAdminToast(message, isSuccess = true) {
    if (!msgEl) return;
    msgEl.innerText = message;
    msgEl.style.color = isSuccess ? "var(--neon-cyan)" : "#ef4444";
    gsap.fromTo(msgEl, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });
    setTimeout(() => {
        if (msgEl.innerText === message) msgEl.innerText = "";
    }, 4000);
}

const speedBtn = document.getElementById("triggerSpeedBtn");
if (speedBtn) {
    speedBtn.onclick = () => {
        showAdminToast("⚡ Speed Round Activated: Double points payout for the next 60 seconds!");
        socket.emit("admin-trigger-speed"); // broadcast speed round parameter if supported by server.js
    };
}

const chaosBtn = document.getElementById("triggerChaosBtn");
if (chaosBtn) {
    chaosBtn.onclick = () => {
        showAdminToast("🌀 Chaos Mode Triggered: Target questions and clues have been randomized!");
        socket.emit("admin-trigger-chaos");
    };
}

const nudgeBtn = document.getElementById("triggerNudgeBtn");
if (nudgeBtn) {
    nudgeBtn.onclick = () => {
        showAdminToast("🔔 Nudge All Transmitted: Sent a push reminder to all incomplete detectives!");
        socket.emit("admin-nudge-all");
    };
}

// Sidebar collapse logic (Desktop & Mobile)
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

if (sidebarToggleBtn && sidebar && sidebarOverlay) {
    sidebarToggleBtn.onclick = () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.add("open");
            sidebarOverlay.classList.add("active");
        } else {
            sidebar.classList.toggle("collapsed");
        }
    };

    sidebarOverlay.onclick = () => {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("active");
    };

    const sidebarCloseBtnMobile = document.getElementById("sidebarCloseBtnMobile");
    if (sidebarCloseBtnMobile) {
        sidebarCloseBtnMobile.onclick = () => {
            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("active");
        };
    }

    // Close sidebar on navigation action (mobile only)
    const sidebarLinks = sidebar.querySelectorAll(".sidebar-link");
    sidebarLinks.forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove("open");
                sidebarOverlay.classList.remove("active");
            }
        });
    });
}

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
