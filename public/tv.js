/* tv.js – Global Leaderboard High-Fidelity Logic */
const socket = io();
const displayCode = document.getElementById("displayCode");
const participantCount = document.getElementById("participantCount");

let engine;
let mascots = { owl: null, fox: null, bunny: null };
let podiums = []; // Array of podium objects { mesh, bust, label, id }
let appState = { status: "lobby", leaderboard: [] };

window.addEventListener('load', () => {
  try {
    engine = new WebGLEngine("webgl-container");
    initTV3D();
    updateMissionCode();
  } catch (e) {
    console.error("WebGL Setup Failed:", e);
  }
});

/* ---- 3D LEADERBOARD ENVIRONMENT ---- */
function initTV3D() {
  const scene = engine.scene;

  // 1. CINEMATIC GALA LIGHTING
  const amberSpot = new THREE.SpotLight(0xffb266, 2.0, 100, Math.PI / 6, 0.5);
  amberSpot.position.set(0, 30, 20);
  amberSpot.target.position.set(0, 0, -10);
  scene.add(amberSpot);
  scene.add(amberSpot.target);

  const cyanFill = new THREE.PointLight(0x22d3ee, 1.0, 60);
  cyanFill.position.set(-20, 10, 5);
  scene.add(cyanFill);

  const rimLight = new THREE.PointLight(0xffffff, 1.2, 50);
  rimLight.position.set(0, 15, -20);
  scene.add(rimLight);

  // 2. THE BACKGROUND OFFICE & MASCOTS
  // Owl as Master of Ceremonies
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
    const masConf = window.Mobile3D ? window.Mobile3D.getTVMascotConfig() : { owl: { x: 0, y: 6, z: -22, scale: 7 } };
    model.scale.set(masConf.owl.scale, masConf.owl.scale, masConf.owl.scale);
    model.position.set(masConf.owl.x, masConf.owl.y, masConf.owl.z);
    scene.add(model);
    mascots.owl = model;
  });

  // Fox & Bunny (Cheerleaders)
  engine.loadGLTF('/assets/35047d21-41d2-40fe-b199-5cb585ed6d35.glb', (model) => {
    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        if (node.material) {
          node.material.roughness = 0.4;
          node.material.metalness = 0.1;
        }
      }
    });
    const masConf = window.Mobile3D ? window.Mobile3D.getTVMascotConfig() : { fox: { x: 6, y: 7, z: 0, scale: 4 } };
    model.scale.set(masConf.fox.scale, masConf.fox.scale, masConf.fox.scale);
    model.position.set(masConf.fox.x, masConf.fox.y, masConf.fox.z);
    model.rotation.y = -Math.PI / -9;
    scene.add(model);
    mascots.fox = model;
    gsap.to(model.position, { y: "-=0.5", duration: 2, yoyo: true, repeat: -1, ease: "sine.inOut" });
  });

  engine.loadGLTF('/assets/69b52873-a10a-422d-b509-a3aa87e0f391.glb', (model) => {
    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        if (node.material) {
          node.material.roughness = 0.4;
          node.material.metalness = 0.1;
        }
      }
    });
    const masConf = window.Mobile3D ? window.Mobile3D.getTVMascotConfig() : { bunny: { x: -6, y: 8, z: 0, scale: 4 } };
    model.scale.set(masConf.bunny.scale, masConf.bunny.scale, masConf.bunny.scale);
    model.position.set(masConf.bunny.x, masConf.bunny.y, masConf.bunny.z);
    model.rotation.y = Math.PI / -9;
    scene.add(model);
    mascots.bunny = model;
    gsap.to(model.position, { y: "-=0.5", duration: 2.5, yoyo: true, repeat: -1, ease: "sine.inOut" });
  });

  // 3. FLOOR
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x011627, roughness: 0.1, metalness: 0.4 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  floor.receiveShadow = true;
  scene.add(floor);

  // 4. PODIUM INITIALIZATION
  createPodiumLayout();

  // 5. CAMERA SETUP
  const camConf = window.Mobile3D ? window.Mobile3D.getTVCameraConfig() : { x: 0, y: 12, z: 45, lookAt: { x: 0, y: 4, z: -10 } };
  engine.camera.position.set(camConf.x, camConf.y, camConf.z);
  engine.camera.lookAt(camConf.lookAt.x, camConf.lookAt.y, camConf.lookAt.z);
}

function createPodiumLayout() {
  // We pre-create 10 podiums and animate them based on rank
  const scene = engine.scene;
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });

  for (let i = 0; i < 10; i++) {
    const group = new THREE.Group();

    // Base
    const baseGeo = new THREE.CylinderGeometry(2, 2.2, 1, 32);
    const base = new THREE.Mesh(baseGeo, goldMat);
    group.add(base);

    // Photo Bust (Initial placeholder)
    const bustGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const bustMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    const bust = new THREE.Mesh(bustGeo, bustMat);
    bust.position.y = 2.5;
    group.add(bust);

    // Label Panel (Canvas)
    const label = createTextLabel("Detective");
    label.position.y = 0.8;
    group.add(label);

    scene.add(group);

    // Dynamic hiding initially
    group.visible = false;

    podiums.push({ group, bust, label, bustMat, id: null });
  }
}

function createTextLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.roundRect(0, 0, 512, 128, 20);
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px Plus Jakarta Sans';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(6, 1.5, 1);
  return sprite;
}

function updateTextLabel(label, name, score) {
  const canvas = label.material.map.image;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 128, 20);
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 50px Plus Jakarta Sans';
  ctx.textAlign = 'center';
  ctx.fillText(name, 256, 50);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 40px Outfit';
  ctx.fillText(`${score} PTS`, 256, 100);

  label.material.map.needsUpdate = true;
}

/* ---- RANK LAYOUT LOGIC ---- */
function getRankPos(rank) {
  if (window.Mobile3D) {
    return window.Mobile3D.getTVPodiumConfig(rank);
  }
  
  // 1-indexed rank
  if (rank === 1) return { x: 0, y: -2, z: 0, scale: 1.5 };
  if (rank === 2) return { x: -8, y: -4, z: 2, scale: 1.1 };
  if (rank === 3) return { x: 8, y: -4, z: 2, scale: 1.1 };

  // 4-6
  if (rank === 4) return { x: -14, y: -6, z: 5, scale: 0.8 };
  if (rank === 5) return { x: 0, y: -6, z: 6, scale: 0.8 };
  if (rank === 6) return { x: 14, y: -6, z: 5, scale: 0.8 };

  // 7-10
  const x = ((rank - 7.5) * 10);
  return { x: x, y: -7, z: 10, scale: 0.6 };
}

/* ---- SOCKET SYNC ---- */
socket.on("connect", () => console.log("TV Connected"));

socket.on("state", (s) => {
  appState = s;
  updateUI(s);
  syncPodiums(s.leaderboard);
});

function updateUI(s) {
  participantCount.innerText = s.playersCount;
}

function syncPodiums(leaderboard) {
  const top = leaderboard.slice(0, 10);

  // Reset all podium visibility flags
  podiums.forEach(p => p.activeThisFrame = false);

  top.forEach((player, i) => {
    const rank = i + 1;
    const target = getRankPos(rank);

    // Find existing or pick cheapest available
    let pod = podiums.find(p => p.playerId === player.id);
    if (!pod) {
      pod = podiums.find(p => !p.activeThisFrame && !p.playerId);
      if (pod) {
        pod.playerId = player.id;
        // Instant transport for new entry
        pod.group.position.set(target.x, target.y - 10, target.z);
        // Update photo
        if (player.photoUrl) {
          new THREE.TextureLoader().load(player.photoUrl, (tex) => {
            pod.bustMat.map = tex;
            pod.bustMat.color.set(0xffffff);
            pod.bustMat.needsUpdate = true;
          });
        }
      }
    }

    if (pod) {
      pod.activeThisFrame = true;
      pod.group.visible = true;

      // Update labels
      updateTextLabel(pod.label, player.name, player.score);

      // Animate to rank position
      gsap.to(pod.group.position, {
        x: target.x, y: target.y, z: target.z,
        duration: 1.2, ease: "power2.inOut"
      });
      gsap.to(pod.group.scale, {
        x: target.scale, y: target.scale, z: target.scale,
        duration: 1.2, ease: "back.out(1.2)"
      });

      // Special: Confetti for Rank 1 change?
      if (rank === 1 && pod.lastRank !== 1) {
        fireConfetti();
        if (mascots.owl) gsap.from(mascots.owl.scale, { x: 12, y: 12, z: 12, duration: 0.5, yoyo: true, repeat: 1 });
      }
      pod.lastRank = rank;
    }
  });

  // Hide inactive podiums
  podiums.forEach(p => {
    if (!p.activeThisFrame) {
      p.group.visible = false;
      p.playerId = null;
    }
  });
}

function updateMissionCode() {
  fetch("/api/session").then(r => r.json()).then(d => {
    displayCode.innerText = d.code;
  });
}

function fireConfetti() {
  // Simple 3D particle burst
  const scene = engine.scene;
  const geometry = new THREE.BufferGeometry();
  const count = 200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0; positions[i * 3 + 1] = 0; positions[i * 3 + 2] = 0;
    colors[i * 3] = Math.random(); colors[i * 3 + 1] = Math.random(); colors[i * 3 + 2] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true });
  const particles = new THREE.Points(geometry, material);
  particles.position.set(0, 10, -5);
  scene.add(particles);

  // Explode
  for (let i = 0; i < count; i++) {
    const vel = new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
    gsap.to({ t: 0 }, {
      t: 1, duration: 2, onUpdate: function () {
        positions[i * 3] += vel.x * 0.01;
        positions[i * 3 + 1] += vel.y * 0.01 - 0.05; // Gravity
        positions[i * 3 + 2] += vel.z * 0.01;
        geometry.attributes.position.needsUpdate = true;
      },
      onComplete: () => scene.remove(particles)
    });
  }
}
