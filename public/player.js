const playerId = localStorage.getItem("playerId");
if (!playerId) location.href = "/";

const socket = io();

/* ---- 3D ENGINE & MASCOT SETUP ---- */
let engine;
let mascots = {};
let isEngineReady = false; // Flag to prevent race conditions
let boardTexture, boardCanvas, boardCtx, boardMesh, screenBorder;
let matchScreenGroup, holographicCard, photoSpheres = [];
let currentCardDetails = null;
let bgPanorama;
let slideIndex = 1; // For Bestiary Slides
let engineReadyPromise; // 🔏 Sync lock for 3D transitions

const mascotsData = [
    {
        path: '/assets/60bd7e44-65fb-40c5-9aa3-2e50b4515dea.glb', // Sitting Owl
        name: 'owl',
        pos: { x: 20, y: 3.8, z: -2 }, // Adjusted Y to sit perfectly on chair
        scale: 7.0,
        rot: -0.4,
        entranceAnim: 'spin',
        noFloat: true
    },
    {
        path: '/assets/69b52873-a10a-422d-b509-a3aa87e0f391.glb', // Bunny Analyst
        name: 'bunny',
        pos: { x: -40, y: 3.5, z: 10 }, // Behind table at z:13
        scale: 5.0,
        rot: 1.9
    },
    {
        path: '/assets/35047d21-41d2-40fe-b199-5cb585ed6d35.glb', // Playful Fox
        name: 'fox',
        pos: { x: 32, y: 2.5, z: 7 }, // On the right side table
        scale: 5.2,
        rot: -0.6,
        hiddenInitially: false
    }
];

window.addEventListener('load', () => {
    // 🏗️ Engine Initialization (Sync with Assets)
    engineReadyPromise = new Promise(async (resolve) => {
        try {
            if (!engine) {
                engine = new WebGLEngine("webgl-container");
                initLibrary();

                // Adopt the Async Loading Pattern from Login Page
                await loadAllMascots();

                isEngineReady = true;
                console.log("3D Engine & Mascots Ready");
                resolve(true);

                // Re-sync current state now that mascots are physically present
                if (appState.status === "lobby") {
                    checkShowWaiting();
                } else if (appState.status === "live") {
                    transitionTo("live");
                    loadCards();
                }
            }
        } catch (e) {
            console.error("Initialization error:", e);
            document.body.innerHTML += `<div style="position:fixed; bottom:10px; left:10px; color:red; z-index:9999; background:white; padding:10px;">3D Load Error: ${e.message}</div>`;
            resolve(false);
        }
    });
});

function initLibrary() {
    const scene = engine.scene;

    // 1. UNIFIED CINEMATIC LIGHTING (Matches Login Office)
    const warmLight = new THREE.PointLight(0xffcc88, 3.0, 100); // AMBER DESK LAMP
    warmLight.position.set(20, 10, 5); // Near Owl's Royal Table
    scene.add(warmLight);

    const blueFill = new THREE.DirectionalLight(0xbae6fd, 0.8);
    blueFill.position.set(-20, 10, -5);
    scene.add(blueFill);

    const rimLight = new THREE.PointLight(0xffffff, 1.0, 50);
    rimLight.position.set(0, 5, -10); // Rim light behind board for silhouette
    scene.add(rimLight);

    // 2. UNIFIED OFFICE FLOOR (Exact copy from Login)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x020617, // Darker, premium slate
        roughness: 0.1,  // High gloss reflectivity
        metalness: 0.5
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(5, -2.5, 95); // Matching room origin
    floor.receiveShadow = true;
    scene.add(floor);

    // 3. EXECUTIVE CONFERENCE TABLE (Matches Hall Scale)
    const tableGeo = new THREE.BoxGeometry(32, 1, 16);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.4 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(-10, -2, 12); // Moved Bit Right (from -18)
    table.receiveShadow = true;
    table.castShadow = true;
    scene.add(table);

    // 4. DRAMATIC DUSK PANORAMA (Bengaluru City Skyline)
    const panoTex = new THREE.TextureLoader().load("C:/Users/deeva/.gemini/antigravity/brain/92ae109b-d41a-4636-be17-96b22e9ed40b/match_page_bg_office_dusk_1773043123423.png");
    panoTex.encoding = THREE.sRGBEncoding;
    const panoGeo = new THREE.SphereGeometry(150, 32, 24);
    const panoMat = new THREE.MeshBasicMaterial({
        map: panoTex,
        side: THREE.BackSide,
        opacity: 0.7,
        transparent: true
    });
    bgPanorama = new THREE.Mesh(panoGeo, panoMat);
    bgPanorama.rotation.y = -Math.PI / 2.3;
    scene.add(bgPanorama);

    // 5. FLOATING BACKGROUND CLUES (Atmospheric Drift)
    const driftGroup = new THREE.Group();
    scene.add(driftGroup);
    const driftGeo = new THREE.PlaneGeometry(3, 1.5);
    const driftMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.1,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.3
    });
    for (let i = 0; i < 12; i++) {
        const card = new THREE.Mesh(driftGeo, driftMat);
        card.position.set((Math.random() - 0.5) * 120, Math.random() * 50, -40 + Math.random() * 20);
        card.rotation.set(Math.random(), Math.random(), Math.random());
        driftGroup.add(card);
        gsap.to(card.position, {
            y: "+=15", x: "+=5",
            duration: 25 + Math.random() * 20,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
        gsap.to(card.rotation, {
            x: "+=2", y: "+=2",
            duration: 40 + Math.random() * 20,
            repeat: -1,
            ease: "none"
        });
    }

    // Dynamic Conference Board (Black Board)
    boardCanvas = document.createElement('canvas');
    boardCanvas.width = 1024;
    boardCanvas.height = 512;
    boardCtx = boardCanvas.getContext('2d');
    boardTexture = new THREE.CanvasTexture(boardCanvas);

    const boardConfig = window.Mobile3D ? window.Mobile3D.getQuestionsBoardConfig() : {
        width: 60, height: 30, x: -18, y: 15, z: -4.5
    };
    const boardWidth = boardConfig.width;
    const boardHeight = boardConfig.height;

    const screenGeo = new THREE.PlaneGeometry(boardWidth, boardHeight); // Adaptive Size
    const screenMat = new THREE.MeshBasicMaterial({ map: boardTexture, transparent: true });
    boardMesh = new THREE.Mesh(screenGeo, screenMat);
    // On mobile, board should be centered and slightly lower to fit in frame
    boardMesh.position.set(boardConfig.x, boardConfig.y, boardConfig.z);
    boardMesh.userData.noHoverScale = true; // Added to prevent board pulsing
    scene.add(boardMesh);

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
            boardMesh.userData.lastHoverIdx = optIndex;
            updateBoardText(questions[currentQuestionIndex]?.text || "Board", optIndex);
        }
    };

    boardMesh.userData.onHoverLeave = () => {
        boardMesh.userData.isHoveringBoard = false;
        boardMesh.userData.lastHoverIdx = -1;
        updateBoardText(questions[currentQuestionIndex]?.text || "Board", -1);
    };

    // Add board to engine interactables
    if (!engine.interactables.includes(boardMesh)) engine.interactables.push(boardMesh);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.7 });
    screenBorder = new THREE.Mesh(new THREE.BoxGeometry(boardWidth + 4, boardHeight + 4, 0.2), frameMat);
    screenBorder.position.set(boardConfig.x, boardConfig.y, boardConfig.z - 0.1);
    scene.add(screenBorder);

    // 6. MATCH SCREEN 3D (Holographic Lab)
    matchScreenGroup = new THREE.Group();
    matchScreenGroup.visible = false;
    scene.add(matchScreenGroup);

    // Holographic Card (Center Top)
    const holoCanvas = document.createElement('canvas');
    holoCanvas.width = 1024; holoCanvas.height = 512; // Higher resolution for sharp text
    const holoTexture = new THREE.CanvasTexture(holoCanvas);
    const holoConf = window.Mobile3D ? window.Mobile3D.getHolographicCardConfig() : { width: 24, height: 12, y: 24 };
    const holoGeo = new THREE.PlaneGeometry(holoConf.width, holoConf.height);
    const holoMat = new THREE.MeshStandardMaterial({
        map: holoTexture,
        transparent: true,
        opacity: 0.95,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.8 // Brighter glow
    });
    holographicCard = new THREE.Mesh(holoGeo, holoMat);
    holographicCard.position.set(0, holoConf.y, -2); // Moved lower and scaled on mobile to avoid overlap
    holographicCard.userData.canvas = holoCanvas;
    holographicCard.userData.ctx = holoCanvas.getContext('2d');
    holographicCard.userData.texture = holoTexture;
    matchScreenGroup.add(holographicCard);

    // Initial clear
    updateBoardText("Welcome to the Hall");

    // 5. CEILING & CONFERENCE LIGHTING - REMOVED TO PREVENT BOARD CLIPPING

    // 6. BACKGROUND WORKSTATIONS (Peripheral Hall Detail)
    function createWorkstation(x, z) {
        const group = new THREE.Group();
        group.position.set(x, -2.5, z); // Aligned to floor height

        // Desk Top
        const topGeo = new THREE.BoxGeometry(8, 0.2, 4);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.y = 5.0; // Sits on top of 5-unit legs
        group.add(top);

        // Legs (Metallic) - NOW 5 UNITS HIGH
        const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 5);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
        const positions = [[-3.5, -1.5], [3.5, -1.5], [-3.5, 1.5], [3.5, 1.5]];
        positions.forEach(p => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(p[0], 2.5, p[1]); // Center is height/2
            group.add(leg);
        });

        // Monitor
        const monGeo = new THREE.BoxGeometry(3, 1.8, 0.1);
        const monMat = new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0x0ea5e9, emissiveIntensity: 0.3 });
        const monitor = new THREE.Mesh(monGeo, monMat);
        monitor.position.set(0, 6.0, -1.5); // Adjusted for taller desk
        group.add(monitor);

        scene.add(group);
    }

    // 7. ROYAL WORKSTATION (Exclusive for Professor Owl)
    function createRoyalWorkstation(x, z) {
        const group = new THREE.Group();
        group.position.set(x, -2.5, z);

        // Gold Trim Base
        const trim = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.4, 4.5), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 }));
        trim.position.y = 5.2;
        group.add(trim);

        // Velvet Top
        const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }));
        top.position.y = 5.5;
        group.add(top);

        // 5-Unit Gold Legs
        const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 5);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
        const goldRing = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 1 }));
        [[-3.7, -1.7], [3.7, -1.7], [-3.7, 1.7], [3.7, 1.7]].forEach(p => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(p[0], 2.5, p[1]);
            group.add(leg);
            const ring = goldRing.clone();
            ring.position.set(p[0], 0.25, p[1]);
            group.add(ring);
        });

        // Neon Accents
        const neon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 2 }));
        [[-4, 2], [4, 2], [-4, -2], [4, -2]].forEach(p => {
            const n = neon.clone();
            n.position.set(p[0], 5.3, p[1]);
            group.add(n);
        });

        scene.add(group);
    }

    for (let x = -60; x <= 60; x += 30) {
        // Far perimeter only to keep the mascot areas clear
        if (Math.abs(x) > 50) {
            createWorkstation(x, 5);
            createWorkstation(x, 40);
        }
    }

    // 8. MASCOT WORKSTATIONS (In front of Bunny & Fox)
    createWorkstation(-32, 13); // In front of Bunny Analyst
    createWorkstation(32, 13); // In front of Playful Fox
    createRoyalWorkstation(20, 8); // ROYAL TABLE IN FRONT OF OWL (x:20)

    // 8. 3D CLUE BOOK REMOVED (By User Request)
}

function getOptIndexFromUV(u, v) {
    // High-Precision Quadrant Mapping (Tuned to canvas Y-coords):
    // v=1 is top, v=0 is bottom.
    // Question text takes v=1.0 to v=0.5.
    // Buttons live in v=0.06 to v=0.5.

    if (v > 0.28 && v < 0.52) { // Top Row
        return (u < 0.5) ? 0 : 1;
    } else if (v > 0.04 && v < 0.26) { // Bottom Row
        return (u < 0.5) ? 2 : 3;
    }
    return -1;
}

function updateBoardText(text, hoverIdx = -1) {
    if (!boardCtx || !boardTexture || !isEngineReady) {
        console.warn("Skipping board update: Engine not ready");
        return;
    }

    // Deep Charcoal Background
    boardCtx.fillStyle = "#0c111c";
    boardCtx.fillRect(0, 0, 1024, 512);

    // Grid Pattern (Optimized)
    boardCtx.strokeStyle = "rgba(14, 165, 233, 0.1)";
    boardCtx.lineWidth = 1;
    for (let i = 0; i < 1024; i += 128) {
        boardCtx.beginPath(); boardCtx.moveTo(i, 0); boardCtx.lineTo(i, 512); boardCtx.stroke();
    }
    for (let i = 0; i < 512; i += 128) {
        boardCtx.beginPath(); boardCtx.moveTo(0, i); boardCtx.lineTo(1024, i); boardCtx.stroke();
    }

    // Question Text (No Shadows)
    boardCtx.fillStyle = "#ffffff";
    boardCtx.font = "900 64px Nunito, sans-serif";
    boardCtx.textAlign = "center";
    boardCtx.textBaseline = "middle";

    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + words[i].length < 30) currentLine += " " + words[i];
        else { lines.push(currentLine); currentLine = words[i]; }
    }
    lines.push(currentLine);

    lines.forEach((line, i) => {
        boardCtx.fillText(line, 512, 100 + i * 80);
    });

    // Options Buttons (Optimized: No shadowBlur)
    const q = questions[currentQuestionIndex];
    if (q && q.options) {
        q.options.forEach((opt, idx) => {
            const isHovered = (idx === hoverIdx);
            const x = (idx % 2 === 0) ? 60 : 540;
            const y = (idx < 2) ? 260 : 380;
            const w = 420;
            const h = 100;

            if (isHovered) {
                boardCtx.fillStyle = "rgba(14, 165, 233, 0.3)";
                boardCtx.strokeStyle = "#38bdf8";
                boardCtx.lineWidth = 6;
            } else {
                boardCtx.fillStyle = "rgba(14, 165, 233, 0.08)";
                boardCtx.strokeStyle = "rgba(14, 165, 233, 0.25)";
                boardCtx.lineWidth = 2;
            }

            boardCtx.beginPath();
            boardCtx.roundRect(x, y, w, h, 20);
            boardCtx.fill();
            boardCtx.stroke();

            // Highlight Marker
            if (isHovered) {
                boardCtx.fillStyle = "#38bdf8";
                boardCtx.fillRect(x + 12, y + 25, 4, 50);
            }

            // Option Text
            boardCtx.fillStyle = isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.9)";
            boardCtx.font = isHovered ? "bold 38px Nunito, sans-serif" : "bold 36px Nunito, sans-serif";
            boardCtx.textAlign = "left";
            const icon = q.icons ? q.icons[idx] : "💎";
            boardCtx.fillText(`${icon} ${opt}`, x + 40, y + 50);
        });
    }

    boardTexture.needsUpdate = true;
}

async function loadAllMascots() {
    const loader = new THREE.GLTFLoader();

    // Preparation for standard interaction
    const loadModel = (data) => new Promise(resolve => {
        loader.load(data.path, (gltf) => resolve({ model: gltf.scene, data }));
    });

    const loadedAssets = await Promise.all(mascotsData.map(loadModel));

    loadedAssets.forEach(({ model, data }) => {
        mascots[data.name] = { model, data };
        window._mascots = mascots; // Global access for debug/consistency

        model.scale.set(data.scale, data.scale, data.scale);
        model.rotation.y = data.rot || 0;
        model.position.set(data.pos.x, data.pos.y, data.pos.z);

        model.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = window.innerWidth > 768; // Mobile Optimization
                child.castShadow = true;
                if (child.material) {
                    child.material.roughness = 0.55;
                    child.material.metalness = 0.15;
                }
            }
        });

        engine.scene.add(model);

        // Entrance Special: Owl Spin
        if (data.entranceAnim === 'spin') {
            gsap.from(model.rotation, { y: Math.PI * 4, duration: 1.5, ease: "power2.out" });
            gsap.from(model.position, { y: data.pos.y + 5, duration: 1, ease: "back.out(1.2)" });
        }

        // Floating Animation (Skip for Owl)
        if (!data.noFloat) {
            gsap.to(model.position, { y: "+=0.2", duration: 2, yoyo: true, repeat: -1, ease: "sine.inOut" });
        }

        // Attach general interactions 
        model.traverse((child) => {
            if (child.isMesh) {
                engine.addInteractable(child, () => {
                    gsap.to(model.position, { y: "+=1", duration: 0.3, yoyo: true, repeat: 1 });
                });
            }
        });
    });

    // Add magical floating sparkles
    const partCount = 80;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount * 3; i++) partPos[i] = (Math.random() - 0.5) * 40;
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const partMat = new THREE.PointsMaterial({ size: 0.15, color: 0xfef08a, transparent: true, opacity: 0.8 });
    const particles = new THREE.Points(partGeo, partMat);
    engine.scene.add(particles);
    gsap.to(particles.rotation, { y: Math.PI * 2, duration: 60, repeat: -1, ease: "none" });
}

/* ---- DOM REFS ---- */
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
const textInputWrap = document.getElementById("textInputWrap");

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

        // Reset Mascots to Office Positions (Login Page Style)
        Object.values(mascots).forEach(m => {
            gsap.to(m.model.position, { x: m.data.pos.x, y: m.data.pos.y, z: m.data.pos.z, duration: 2, ease: "power2.inOut", overwrite: "auto" });
            gsap.to(m.model.rotation, { y: m.data.rot || 0, duration: 2, ease: "power2.inOut", overwrite: "auto" });
            gsap.to(m.model.scale, { x: m.data.scale, y: m.data.scale, z: m.data.scale, duration: 2, ease: "power2.inOut", overwrite: "auto" });
        });
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
        const config = window.Mobile3D ? window.Mobile3D.getLiveLabMascotConfig() : {
            bunny: { x: -37, y: 3.5, z: 20, rot: 1.2, scale: 4.2 },
            fox: { x: -10, y: 7.5, z: 25, rot: -0.8, scale: 6.8 },
            owl: { x: 10, y: 3.5, z: 10, rot: -0.2, scale: 4.5 }
        };

        Object.keys(config).forEach(name => {
            if (mascots[name]) {
                const c = config[name];
                const model = mascots[name].model;
                gsap.to(model.position, { x: c.x, y: c.y, z: c.z, duration: 2.5, ease: "power2.inOut", overwrite: "auto" });
                gsap.to(model.rotation, { y: c.rot, duration: 2.5, overwrite: "auto" });
                gsap.to(model.scale, { x: c.scale, y: c.scale, z: c.scale, duration: 2.5, overwrite: "auto" });
            }
        });

        if (matchScreenGroup) matchScreenGroup.visible = true;
        if (holographicCard) holographicCard.visible = false;

        if (boardMesh) boardMesh.visible = false;
        if (screenBorder) screenBorder.visible = false;

        document.getElementById("scorePill").classList.remove("hidden");
    }
}

function updateProgress() {
    const pct = ((currentQuestionIndex) / questions.length) * 100;
    gsap.to(progressBar, { width: Math.max(5, pct) + "%", duration: 1, ease: "elastic.out(1, 0.5)" });
    progressText.innerText = `Step ${currentQuestionIndex + 1} / ${questions.length}`;
}

function renderQuestion() {
    const q = questions[currentQuestionIndex];
    if (!q) return;

    questionText.innerText = q.text;
    updateBoardText(q.text); // Sync with 3D Board

    // 3rd QUESTION SPECIAL: Fox Entry
    if (currentQuestionIndex === 2 && mascots.fox && mascots.fox.model.scale.x < 0.1) {
        const fox = mascots.fox.model;
        const targetS = mascots.fox.data.scale;
        gsap.to(fox.scale, { x: targetS, y: targetS, z: targetS, duration: 0.8, ease: "back.out(1.7)" });
        gsap.to(fox.position, { y: mascots.fox.data.pos.y + 2, duration: 0.4, yoyo: true, repeat: 1, ease: "power2.out" });
        fireConfetti(20);
    }
    if (textInputWrap) textInputWrap.classList.add("hidden");

    const qCard = document.getElementById("qCard");

    if (q.type === "text") {
        if (textInputWrap) textInputWrap.classList.remove("hidden");
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

// Handling photo upload from UI
document.getElementById("cameraBtn").onclick = () => document.getElementById("photoInput").click();
document.getElementById("photoInput").onchange = () => {
    const f = document.getElementById("photoInput").files[0];
    if (f) {
        document.getElementById("preview").src = URL.createObjectURL(f);
        document.getElementById("previewWrap").classList.remove("hidden");
        document.getElementById("uploadBtn").classList.remove("hidden");
    }
};

document.getElementById("uploadBtn").onclick = async () => {
    const file = document.getElementById("photoInput").files[0];
    const btn = document.getElementById("uploadBtn");
    btn.innerText = "⏳ Uploading...";
    btn.disabled = true;

    const form = new FormData();
    form.append("playerId", playerId);
    form.append("photo", file);

    try {
        const res = await fetch("/api/upload-photo", { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload Failed");
        currentUserData.photoUrl = "done"; // local flag
        checkShowWaiting();
    } catch (e) {
        btn.innerText = "Error - Try again";
        btn.disabled = false;
    }
};

document.getElementById("submitAnswersBtn").onclick = async () => {
    const skill = document.getElementById("surprisingSkill").value.trim();
    if (!skill) return alert("Tell us your surprising skill! 🐰");

    userAnswers.surprisingSkill = skill;
    const btn = document.getElementById("submitAnswersBtn");
    btn.innerText = "⏳ Saving...";
    btn.disabled = true;

    try {
        const res = await fetch("/api/submit-answers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, answers: userAnswers })
        });
        if (!res.ok) throw new Error("Submit Failed");
        currentUserData.answers = userAnswers;
        checkShowWaiting();
    } catch (e) {
        btn.innerText = "Retry Submit";
        btn.disabled = false;
    }
};

function checkShowWaiting() {
    if (!currentUserData) return;

    if (!currentUserData.photoUrl) {
        transitionTo("photo");
    } else if (!currentUserData.answers) {
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
    }

    if (s.status === "lobby") {
        checkShowWaiting();
    } else if (s.status === "live") {
        if (!stages.live.classList.contains("hidden")) return; // Prevent flickering syncs
        transitionTo("live");
        loadCards();
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
        }
    } catch (e) { }
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
        <h1 class="bestiary-title">CASE FILE #${idx + 1}</h1>
        <figure class="bestiary-figure">
            <img src="/assets/${(idx % 30) + 1}.png" alt="Detective">
            <div class="card-shimmer"></div>
        </figure>
        <div class="bestiary-content" style="text-align: center;">
            <h3 style="margin-bottom: 20px; font-size: 1.5rem; color: #38bdf8; text-transform: uppercase; letter-spacing: 2px;">Target Investigation</h3>
            <div class="bestiary-footer" style="flex-wrap: wrap; justify-content: center; border:0; gap: 8px; max-height: 250px; overflow-y: auto;">
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

function animatePointsPopup(text) {
    const p = document.getElementById("pointsPopup");
    p.innerText = text;
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
