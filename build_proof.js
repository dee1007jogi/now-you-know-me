const fs = require('fs');

const htmlFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.html';
const jsFile = 'c:\\Users\\deeva\\.gemini\\antigravity\\scratch\\now-you-know-me\\public\\player.js';

let html = fs.readFileSync(htmlFile, 'utf8');
let js = fs.readFileSync(jsFile, 'utf8');

// 1. Inject HTML for proofStage
if (!html.includes('id="proofStage"')) {
    const proofHtml = `
        <!-- ========== PROOF OF MATCH STAGE ========== -->
        <div id="proofStage" class="clue-book-overlay hidden" style="z-index: 6000;">
            <div class="book-content animate-pop" style="max-width:380px;">
                <h1 class="q-title" style="font-size:1.8rem; color:#4ade80;">Target Found!</h1>
                <p style="text-align:center; color:rgba(255,255,255,0.7); margin-bottom:30px;">
                    You found <span id="proofTargetName" style="color:#00E5FF; font-weight:bold;">Agent</span>! 
                    <br/>Now prove it. Take a selfie with them to claim your points!
                </p>
                <div style="text-align:center;">
                    <input id="proofInput" type="file" accept="image/*" capture="user" class="hidden" />
                    <button id="proofCameraBtn" class="btn-pixar" style="background:var(--neon-blue); margin-top:0;">📸 Take Evidence Photo</button>
                    <div id="proofPreviewWrap" class="hidden"
                        style="margin-top:20px; border-radius:20px; overflow:hidden; border:4px solid var(--neon-blue); height: 320px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3);">
                        <img id="proofPreview" style="max-width:100%; max-height:100%; object-fit:contain; display:block;" />
                    </div>
                </div>
                <button id="proofUploadBtn" class="btn-pixar hidden" style="background: linear-gradient(135deg, #10b981, #059669);">Submit Evidence ✨</button>
                <p id="proofMsg" style="text-align:center; margin-top:15px; font-size:0.9rem;"></p>
            </div>
        </div>`;
    html = html.replace('<!-- ========== WAITING SCREEN ========== -->', proofHtml + '\n\n        <!-- ========== WAITING SCREEN ========== -->');
    fs.writeFileSync(htmlFile, html);
    console.log("Injected proofStage HTML");
}

// 2. Inject JS logic for proofStage and rewrite modalConfirm.onclick
const newModalConfirmLogic = `
const modalConfirm = document.getElementById("modalConfirm");
if (modalConfirm) modalConfirm.onclick = async () => {
    try {
        const res = await fetch("/api/guess", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, guessedPersonId: pendingGuess.id })
        });
        const out = await res.json();

        if (!res.ok) {
            if (out.error && out.error.includes("Cooldown")) {
                document.getElementById("confirmModal").classList.add("hidden");
                showCooldown(30);
            } else {
                alert(out.error || "Attempt failed");
            }
            return;
        }

        document.getElementById("confirmModal").classList.add("hidden");
        document.getElementById("speedTimerOverlay")?.classList.add("hidden");

        if (out.isCorrect) {
            // Target found! Go to proof stage
            document.getElementById("proofTargetName").innerText = out.targetName || "them";
            document.getElementById("proofStage").classList.remove("hidden");
            
            // Visual Celebration on Sphere (in background)
            const correctSphere = photoSpheres.find(s => s.userData.person.id === pendingGuess.id);
            if (correctSphere) {
                gsap.to(correctSphere.scale, { x: 2, y: 2, z: 2, duration: 0.5, ease: "elastic.out" });
                correctSphere.material.emissive.setHex(0x4ade80);
                correctSphere.material.emissiveIntensity = 1;
            }
        } else {
            // Wrong Guess
            resetCameraToLive();
            mascotPenalty();
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
            setTimeout(() => showCooldown(30), 1000);
        }
    } catch (e) {
        console.error("Attempt error:", e);
        alert("Connection lost. Try again.");
    }
};

/* --- PROOF STAGE LOGIC --- */
const proofInput = document.getElementById("proofInput");
const proofCameraBtn = document.getElementById("proofCameraBtn");
const proofPreviewWrap = document.getElementById("proofPreviewWrap");
const proofPreview = document.getElementById("proofPreview");
const proofUploadBtn = document.getElementById("proofUploadBtn");
const proofMsg = document.getElementById("proofMsg");

if (proofCameraBtn && proofInput) {
    proofCameraBtn.onclick = () => proofInput.click();
    proofInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
            proofPreview.src = URL.createObjectURL(e.target.files[0]);
            proofPreviewWrap.classList.remove("hidden");
            proofUploadBtn.classList.remove("hidden");
        }
    };
}

if (proofUploadBtn) {
    proofUploadBtn.onclick = async () => {
        const file = proofInput.files[0];
        if (!file) return;

        proofUploadBtn.innerText = "⏳ Uploading Evidence...";
        proofUploadBtn.disabled = true;

        const formData = new FormData();
        formData.append("playerId", playerId);
        formData.append("photo", file);

        try {
            const res = await fetch("/api/submit-selfie", {
                method: "POST",
                body: formData
            });
            const out = await res.json();

            if (!res.ok) throw new Error(out.error || "Upload failed");

            proofMsg.innerText = "✅ Evidence Accepted!";
            proofMsg.style.color = "#4ade80";

            // Final Triumphant Celebration
            mascotTriumph();
            fireConfetti(50);
            
            // Assume the previous guess returned scoreDelta, but we don't have it locally.
            // Oh wait, /api/submit-selfie returns \`score\`.
            animatePointsPopup(\`Success!\`); // The UI doesn't know exact delta here, but score updates

            setTimeout(() => {
                if (currentUserData) currentUserData.score = out.score;
                document.getElementById("pillValue").innerText = currentUserData?.score || 0;
                document.getElementById("proofStage").classList.add("hidden");
                resetCameraToLive();
                
                // Reset proof stage for next time
                proofPreviewWrap.classList.add("hidden");
                proofUploadBtn.classList.add("hidden");
                proofUploadBtn.innerText = "Submit Evidence ✨";
                proofUploadBtn.disabled = false;
                proofMsg.innerText = "";
                proofInput.value = "";
                
                loadCards();
            }, 2500);

        } catch (e) {
            console.error(e);
            proofMsg.innerText = "❌ " + e.message;
            proofMsg.style.color = "#f87171";
            proofUploadBtn.innerText = "Retry Submission";
            proofUploadBtn.disabled = false;
        }
    };
}
`;

// Find where modalConfirm logic starts and replace it
const startIndex = js.indexOf('const modalConfirm = document.getElementById("modalConfirm");');
if (startIndex !== -1 && !js.includes('/* --- PROOF STAGE LOGIC --- */')) {
    // Find where the next function starts after modalConfirm
    const nextFuncIndex = js.indexOf('function showCooldown', startIndex);
    
    const before = js.substring(0, startIndex);
    const after = js.substring(nextFuncIndex);
    
    fs.writeFileSync(jsFile, before + newModalConfirmLogic + '\n' + after);
    console.log("Rewrote modalConfirm and added proof logic to JS");
} else {
    console.log("Already updated or couldn't find hooks.");
}
