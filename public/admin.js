/* admin.js – Mission Control High-Fidelity Logic */
const socket = io();
const lbContainer = document.getElementById("lb");
const readyCount = document.getElementById("readyCount");
const joinedTotal = document.getElementById("joinedTotal");
const displayCode = document.getElementById("displayCode");

let engine;
let mascots = {};
let holographicGlobe;
let playerBusts = {};
let levers = {};

// QR Code Setup
const qrcode = new QRCode(document.getElementById("qrcode"), {
  text: window.location.origin,
  width: 256, height: 256,
  colorDark: "#020617",
  colorLight: "#ffffff",
  correctLevel: QRCode.CorrectLevel.H
});

window.addEventListener('load', () => {
  try {
    engine = new WebGLEngine("webgl-container");
    initAdmin3D();
    updateMissionCode();
  } catch (e) {
    console.error("WebGL Setup Failed:", e);
  }
});

/* ---- 3D MISSION CONTROL ENVIRONMENT ---- */
function initAdmin3D() {
  const scene = engine.scene;

  // 1. CINEMATIC LIGHTING (Executive Office)
  const amberDeskLight = new THREE.PointLight(0xffb266, 1.5, 30);
  amberDeskLight.position.set(0, 5, 5);
  scene.add(amberDeskLight);

  const cyanHoloLight = new THREE.PointLight(0x22d3ee, 1.0, 40);
  cyanHoloLight.position.set(-10, 2, -5);
  scene.add(cyanHoloLight);

  const goldRim = new THREE.DirectionalLight(0xfbbf24, 0.8);
  goldRim.position.set(20, 10, -10);
  scene.add(goldRim);

  // 2. THE ROYAL EXECUTIVE DESK
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, -4.0, 0);

  // Main Desk Body (Premium Navy)
  const deskGeo = new THREE.BoxGeometry(25, 1.2, 12);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.4 });
  const desk = new THREE.Mesh(deskGeo, deskMat);
  desk.position.y = 5.0;
  desk.receiveShadow = true;
  deskGroup.add(desk);

  // Gold Trim (Royal Border)
  const trimGeo = new THREE.BoxGeometry(25.5, 0.4, 12.5);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.1 });
  const trim = new THREE.Mesh(trimGeo, trimMat);
  trim.position.y = 5.4; // Slightly above desk surface
  deskGroup.add(trim);

  // Deep Navy Inlay (Velvet feel)
  const inlayGeo = new THREE.BoxGeometry(23, 0.1, 10);
  const inlayMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
  const inlay = new THREE.Mesh(inlayGeo, inlayMat);
  inlay.position.y = 5.61;
  deskGroup.add(inlay);

  // Royal Legs with Gold Accents
  const legGeo = new THREE.CylinderGeometry(0.3, 0.3, 5);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
  const goldRingGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5);

  [[-11, -5], [11, -5], [-11, 5], [11, 5]].forEach(p => {
    // Main Leg
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(p[0], 2.5, p[1]);
    deskGroup.add(leg);

    // Gold Base Ring
    const ring = new THREE.Mesh(goldRingGeo, trimMat);
    ring.position.set(p[0], 0.25, p[1]);
    deskGroup.add(ring);
  });

  // Corner Glow Accents (Cyan)
  const cornerGeo = new THREE.BoxGeometry(1, 0.5, 1);
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.5 });
  [[-12, -5.5], [12, -5.5], [-12, 5.5], [12, 5.5]].forEach(p => {
    const glow = new THREE.Mesh(cornerGeo, cornerMat);
    glow.position.set(p[0], 5.4, p[1]);
    deskGroup.add(glow);
  });

  scene.add(deskGroup);

  // Placeholder for Royal Chair (Regal Colors)
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(10, 16, 1.5), new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.3 }));
  chairBack.position.set(0, 4, -4);
  scene.add(chairBack);

  // 3. THE WISE OWL (Detective)
  engine.loadGLTF('/assets/60bd7e44-65fb-40c5-9aa3-2e50b4515dea.glb', (model) => {
    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = 0.5;
          node.material.metalness = 0.2;
        }
      }
    });
    const masConf = window.Mobile3D ? window.Mobile3D.getAdminMascotConfig() : { owl: { scale: 4, x: 0, y: 1.5, z: -2 } };
    model.scale.set(masConf.owl.scale, masConf.owl.scale, masConf.owl.scale);
    model.position.set(masConf.owl.x, masConf.owl.y, masConf.owl.z);
    scene.add(model);
    mascots.owl = model;

    // Subtle breathing
    gsap.to(model.position, { y: "-=0.2", duration: 2.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
  });

  // 4. READINESS GLOBE (Holographic Sphere)
  const globeGeo = new THREE.IcosahedronGeometry(4, 2);
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    wireframe: true,
    transparent: true,
    opacity: 0.1,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.4
  });
  holographicGlobe = new THREE.Mesh(globeGeo, globeMat);
  holographicGlobe.position.set(-15, 2, -8);
  scene.add(holographicGlobe);

  // Orbital dust
  const partGeo = new THREE.BufferGeometry();
  const posArr = [];
  for (let i = 0; i < 300; i++) {
    posArr.push((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
  }
  partGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  const particles = new THREE.Points(partGeo, new THREE.PointsMaterial({ size: 0.1, color: 0x22d3ee, transparent: true, opacity: 0.5 }));
  holographicGlobe.add(particles);

  // 5. THE COMMAND LEVERS (3D Controls)
  function create3DLever(x, z, label, color) {
    const group = new THREE.Group();
    group.position.set(x, -2.5, z);

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2), deskMat);
    group.add(base);

    // Lever Stick
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 }));
    stick.position.y = 1.5;
    group.add(stick);

    // Handle (Orb)
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 }));
    handle.position.y = 3;
    group.add(handle);

    scene.add(group);
    return group;
  }

  const lobbyPos = window.Mobile3D ? window.Mobile3D.getAdminLeverConfig("lobby") : { x: 8, z: -2 };
  levers.lobby = create3DLever(lobbyPos.x, lobbyPos.z, "Lobby", 0xfbbf24);

  const livePos = window.Mobile3D ? window.Mobile3D.getAdminLeverConfig("live") : { x: 11, z: -2 };
  levers.live = create3DLever(livePos.x, livePos.z, "Live", 0x10b981);

  const endedPos = window.Mobile3D ? window.Mobile3D.getAdminLeverConfig("ended") : { x: 14, z: -2 };
  levers.ended = create3DLever(endedPos.x, endedPos.z, "Ended", 0xef4444);

  // 6. CAMERA PARALLAX
  window.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 4;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    const camConf = window.Mobile3D ? window.Mobile3D.getAdminCameraConfig() : { x: 0, y: 15, z: 25 };
    gsap.to(engine.camera.position, { x: x + camConf.x, y: camConf.y - y, duration: 1.5, ease: "power2.out" });
    if (mascots.owl) {
      gsap.to(mascots.owl.rotation, { y: x * 0.1, x: y * 0.1, duration: 1, ease: "power2.out" });
    }
  });

  const camConf = window.Mobile3D ? window.Mobile3D.getAdminCameraConfig() : { x: 0, y: 15, z: 25, lookAt: { x: 0, y: 0, z: 0 } };
  engine.camera.position.set(camConf.x, camConf.y, camConf.z);
  engine.camera.lookAt(camConf.lookAt.x, camConf.lookAt.y, camConf.lookAt.z);
}

/* ---- SOCKET SYNC ---- */
socket.on("state", (s) => {
  updateUI(s);
  syncBusts(s.leaderboard);
});

function updateUI(s) {
  // Basic stats
  readyCount.innerText = s.readyCount;
  joinedTotal.innerText = s.playersCount;
  document.getElementById("cardsCount").innerText = `${s.cardsCount} Generated`;

  // Status update
  const statusMap = { lobby: "Lobby ⏳", live: "Live 🟢", ended: "Ended 🏁" };
  document.getElementById("pillStatus").innerText = statusMap[s.status] || s.status;
  document.getElementById("pillStatus").style.color = s.status === 'live' ? '#10b981' : (s.status === 'ended' ? '#ef4444' : '#fbbf24');

  // Lever update
  document.querySelectorAll('.lever-card').forEach(l => l.classList.remove('active'));
  if (s.status === "lobby") {
    document.getElementById("leverLobby").classList.add("active");
    if (levers.live) gsap.to(levers.live.rotation, { x: 0, duration: 0.5 });
  }
  if (s.status === "live") {
    document.getElementById("leverLive").classList.add("active");
    if (levers.live) gsap.to(levers.live.rotation, { x: -Math.PI / 4, duration: 0.5 });
  }
  if (s.status === "ended") {
    document.getElementById("leverEnded").classList.add("active");
  }

  // Leaderboard
  renderLeaderboard(s.leaderboard);

  // Participant Grid
  renderParticipantGrid(s.leaderboard);
}

function syncBusts(players) {
  if (!holographicGlobe) return;

  players.forEach((p, idx) => {
    if (!playerBusts[p.id]) {
      const bust = create3DBust(p);
      playerBusts[p.id] = bust;
      holographicGlobe.add(bust);

      // Random orbit position
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 2;
      bust.position.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 5, Math.sin(angle) * dist);
      bust.userData.orbitSpeed = 0.005 + Math.random() * 0.01;
      bust.userData.orbitRadius = dist;
      bust.userData.orbitAngle = angle;

      gsap.from(bust.scale, { x: 0, y: 0, z: 0, duration: 0.8, ease: "back.out(1.7)" });
    }
  });
}

function create3DBust(player) {
  const group = new THREE.Group();
  const photoMat = new THREE.MeshBasicMaterial({ color: player.photoUrl ? 0xffffff : 0x475569 });

  if (player.photoUrl && player.photoUrl !== "done") {
    new THREE.TextureLoader().load(player.photoUrl, (tex) => { photoMat.map = tex; photoMat.needsUpdate = true; });
  }

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 32), photoMat);
  group.add(sphere);

  // Glow ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.05, 16, 100),
    new THREE.MeshBasicMaterial({ color: (player.answers && player.photoUrl) ? 0x10b981 : 0xef4444, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  return group;
}

// Orbit loop
function updateOrbits() {
  if (holographicGlobe) {
    holographicGlobe.rotation.y += 0.002;
    Object.values(playerBusts).forEach(bust => {
      bust.userData.orbitAngle += bust.userData.orbitSpeed;
      bust.position.x = Math.cos(bust.userData.orbitAngle) * bust.userData.orbitRadius;
      bust.position.z = Math.sin(bust.userData.orbitAngle) * bust.userData.orbitRadius;
      bust.lookAt(holographicGlobe.position);
    });
  }
  requestAnimationFrame(updateOrbits);
}
updateOrbits();

function renderLeaderboard(players) {
  lbContainer.innerHTML = "";
  players.slice(0, 10).forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "lb-row animate-pop";
    row.innerHTML = `
            <div class="lb-player">
                <span class="lb-rank">#${i + 1}</span>
                <img src="${p.photoUrl || 'https://via.placeholder.com/40'}" class="lb-avatar" />
                <span class="lb-name">${p.name}</span>
            </div>
            <div class="lb-score-wrap">
                <span class="lb-score">${p.score} <span>pts</span></span>
            </div>
        `;
    lbContainer.appendChild(row);
  });

  if (players.length === 0) {
    lbContainer.innerHTML = '<div style="padding:40px; text-align:center; opacity:0.3;">Waiting for detectives to join...</div>';
  }
}

function renderParticipantGrid(players) {
  const grid = document.getElementById("participantGrid");
  grid.innerHTML = "";
  players.forEach(p => {
    const div = document.createElement("div");
    div.className = `mini-bust ${p.photoUrl && p.answers ? 'ready' : 'waiting'}`;
    div.innerHTML = `<img src="${p.photoUrl || 'https://via.placeholder.com/40'}" />`;
    grid.appendChild(div);
  });
}

function updateMissionCode() {
  fetch("/api/session").then(r => r.json()).then(d => {
    displayCode.innerText = d.code;
    const joinUrl = window.location.origin;
    document.getElementById("joinUrl").innerText = joinUrl.replace("https://", "").replace("http://", "");
    // Update QR
    qrcode.clear();
    qrcode.makeCode(`${joinUrl}/?code=${d.code}`);
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

        const res = await fetch(endpoint, { method: "POST" });
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

        if (endpoint.includes("start") && mascots.owl) {
          gsap.to(mascots.owl.scale, { x: 8, y: 8, z: 8, duration: 0.5, yoyo: true, repeat: 1 });
        }

        if (msgEl) {
          msgEl.innerText = "✅ Command Transmitted";
          msgEl.style.color = "var(--gold-bright)";
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

// QR OVERLAY removed title and code handler to simplify header
document.getElementById("closeQr").onclick = () => document.getElementById("qrOverlay").classList.remove("active");

document.getElementById("logoutBtn").onclick = () => {
  localStorage.clear();
  location.href = "/";
};
