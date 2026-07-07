/* tv.js – Global Leaderboard High-Fidelity Logic */
const socket = io();
const displayCode = document.getElementById("displayCode");
const participantCount = document.getElementById("participantCount");
let lastPlayerCount = 0;

let engine;
let mascots = { owl: null, fox: null, bunny: null };
let podiums = []; // Array of podium objects { mesh, bust, label, id }
let appState = { status: "lobby", leaderboard: [] };

let orbitControls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

window.addEventListener('load', async () => {
  try {
    engine = new WebGLEngine("webgl-container");
    await initTV3D();
    updateMissionCode();
  } catch (e) {
    console.error("WebGL Setup Failed:", e);
  }
});

/* ---- ASTEROID UTILS ---- */
function createAsteroid(size) {
  const geo = new THREE.IcosahedronGeometry(size, 2);
  const posAttribute = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttribute.count; i++) {
    v.fromBufferAttribute(posAttribute, i);
    v.normalize().multiplyScalar(size + (Math.random() * size * 0.3));
    posAttribute.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true
  });
  return new THREE.Mesh(geo, mat);
}

let bgAsteroids = [];

/* ---- 3D LEADERBOARD ENVIRONMENT ---- */
async function initTV3D() {
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
  const loadModel = (url) => new Promise(resolve => engine.loadGLTF(url, resolve));

  const foxModel = await loadModel('/assets/Hitem3d-1780989244767.glb');

  // Fox (Cheerleader) -> Sherlock
  foxModel.traverse(node => {
    if (node.isMesh) {
      node.castShadow = true;
      if (node.material) {
        node.material.roughness = 0.4;
        node.material.metalness = 0.1;
      }
    }
  });
  const isMobile = window.innerWidth <= 768;
  const layout = {
    foxX: isMobile ? -15 : -28,
    foxY: isMobile ? 4 : -1,
    foxZ: isMobile ? -2 : -1,
    foxScale: isMobile ? 12.5 : 14,
    redPlanetX: isMobile ? -25 : -80,
    redPlanetY: isMobile ? 25 : 30,
    redPlanetZ: isMobile ? -60 : -100,
    redPlanetR: isMobile ? 15 : 40,
    jumpStartX: isMobile ? -35 : -120,
    mountainX: isMobile ? -15 : -30,
    mountain2X: isMobile ? -2 : -37,
    mountain3X: isMobile ? -2 : -22,
    mountainY: isMobile ? -15 : -25,
    mountain2Y: isMobile ? -10 : -30,
    mountain3Y: isMobile ? -20 : -35,
    lightX: isMobile ? -15 : -30,
  };

  let masConf = { fox: { x: layout.foxX, y: layout.foxY, z: layout.foxZ, scale: layout.foxScale } };

  // Create a rotating group platform
  const sherlockGroup = new THREE.Group();
  sherlockGroup.position.set(masConf.fox.x, masConf.fox.y, masConf.fox.z);
  sherlockGroup.rotation.y = Math.PI / 3; // Angle slightly towards center

  // Add Sherlock to the group
  foxModel.scale.set(masConf.fox.scale, masConf.fox.scale, masConf.fox.scale);
  foxModel.position.set(0, 0, 0); // Stand directly at group origin
  foxModel.rotation.y = 0;
  sherlockGroup.add(foxModel);

  scene.add(sherlockGroup);
  mascots.fox = sherlockGroup;

  // 3D Waving Cape
  const capeLength = 18;
  const capeMaxWidth = 8;
  const capeSegments = 40;
  const widthSegments = 10;
  const capeGeo = new THREE.PlaneGeometry(capeMaxWidth, capeLength, widthSegments, capeSegments);
  capeGeo.translate(0, -capeLength / 2, 0); // Origin at top

  // Taper the top so it bunches at the neck
  const capePosAttribute = capeGeo.attributes.position;
  const capeOrigPos = [];
  for (let i = 0; i < capePosAttribute.count; i++) {
    let x = capePosAttribute.getX(i);
    const y = capePosAttribute.getY(i);
    const z = capePosAttribute.getZ(i);

    // Taper factor: 0 at top (neck), 1 at bottom
    const factor = Math.abs(y) / capeLength;

    // Narrow top width to about 1.5 units, smoothly expanding to capeMaxWidth
    const targetWidth = 1.5 + (capeMaxWidth - 1.5) * factor;
    // Current x goes from -capeMaxWidth/2 to capeMaxWidth/2. 
    // Scale it down based on targetWidth
    x = x * (targetWidth / capeMaxWidth);

    // Give it a natural curve around the shoulders
    const curveZ = Math.cos((x / capeMaxWidth) * Math.PI) * 1.5 * (1 - factor);

    capePosAttribute.setXYZ(i, x, y, z + curveZ);

    capeOrigPos.push({ x, y, z: z + curveZ });
  }
  capeGeo.computeVertexNormals();

  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x000000, // Pitch black
    side: THREE.DoubleSide,
    roughness: 1.0, // Fully matte to absorb light
    metalness: 0.0
  });

  const cape = new THREE.Mesh(capeGeo, capeMat);
  cape.position.set(0, 4.8, -1.0); // Attach to upper back / neck
  // Initial angle for the cape blowing back and left
  cape.rotation.x = Math.PI / 12; // Slanted backwards slightly
  cape.rotation.z = -Math.PI / 16;
  sherlockGroup.add(cape);

  gsap.ticker.add((time) => {
    for (let i = 0; i < capePosAttribute.count; i++) {
      const orig = capeOrigPos[i];
      const factor = Math.abs(orig.y) / capeLength;

      // Complex wind waving (flapping)
      // Different frequencies for main wave and edge ripples
      const mainWaveZ = Math.sin(time * 5 + orig.y * 1.5) * 1.5 * factor;
      const edgeRippleZ = Math.cos(time * 8 + orig.x * 2) * 0.5 * factor;

      const waveX = Math.sin(time * 4 + orig.y) * 1.5 * factor;
      const waveY = Math.sin(time * 3 + orig.y) * 2.0 * factor;

      // Strong upward wind lift (makes the cape blow horizontally or upwards)
      const constantLiftY = factor * 22;

      // Constant wind pushing left (-x), heavily up (+y), and back (-z)
      capePosAttribute.setXYZ(
        i,
        orig.x + waveX - (factor * 10),
        orig.y + waveY + constantLiftY,
        orig.z + mainWaveZ + edgeRippleZ - (factor * 6)
      );
    }
    capePosAttribute.needsUpdate = true;
    capeGeo.computeVertexNormals();
  });

  function triggerLandingDust() {
    const dustCount = 20; // Minimal dust
    const dustGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const dustMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7 });

    for (let i = 0; i < dustCount; i++) {
      const dust = new THREE.Mesh(dustGeo, dustMat);
      // Start near his feet
      dust.position.set(
        masConf.fox.x + (Math.random() - 0.5) * 8,
        masConf.fox.y,
        masConf.fox.z + (Math.random() - 0.5) * 8
      );
      scene.add(dust);

      gsap.to(dust.position, {
        x: dust.position.x + (Math.random() - 0.5) * 25,
        y: dust.position.y + Math.random() * 15,
        z: dust.position.z + (Math.random() - 0.5) * 25,
        duration: 1 + Math.random() * 0.5,
        ease: "power2.out"
      });

      gsap.to(dust.material, {
        opacity: 0,
        duration: 1 + Math.random() * 0.5,
        ease: "power2.out",
        onComplete: () => { scene.remove(dust); }
      });

      gsap.to(dust.rotation, {
        x: Math.random() * Math.PI * 4,
        y: Math.random() * Math.PI * 4,
        duration: 1 + Math.random() * 0.5
      });
    }
  }

  function triggerWinnerText() {
    const letters = document.querySelectorAll('.winner-letter');
    if (letters.length === 0) return;

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

  // Cinematic Entrance Jump
  sherlockGroup.position.set(layout.jumpStartX, 100, 50); // Start top-left
  sherlockGroup.rotation.z = Math.PI / 2; // Tilted sideways during fall

  gsap.to(sherlockGroup.position, {
    x: masConf.fox.x,
    y: masConf.fox.y,
    z: masConf.fox.z,
    duration: 1.5,
    ease: "power3.in",
    onComplete: () => {
      triggerLandingDust();
      triggerWinnerText();
      // Camera Impact Shake
      const origCamY = engine.camera.position.y;
      gsap.fromTo(engine.camera.position,
        { y: origCamY - 4 },
        { y: origCamY, duration: 0.8, ease: "elastic.out(1.5, 0.2)" }
      );
    }
  });

  gsap.to(sherlockGroup.rotation, {
    z: 0,
    duration: 1.5,
    ease: "power2.inOut"
  });
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen && window.gsap) {
    gsap.to(loadingScreen, { opacity: 0, duration: 0.5, onComplete: () => loadingScreen.style.display = "none" });
  } else if (loadingScreen) {
    loadingScreen.style.display = "none";
  }

  // 3. SPACE BACKGROUND (STARS & PLANETS)
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 1500;
  const posArray = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 500;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const starsMat = new THREE.PointsMaterial({ size: 0.7, color: 0xffffff, transparent: true, opacity: 0.8 });
  const starsMesh = new THREE.Points(starsGeo, starsMat);
  scene.add(starsMesh);

  // Add Rocky Mountains Below
  const mtnGeo = new THREE.ConeGeometry(20, 30, 7);
  const mtnPosAttribute = mtnGeo.attributes.position;
  for (let i = 0; i < mtnPosAttribute.count; i++) {
    const y = mtnPosAttribute.getY(i);
    if (y > -10) {
      mtnPosAttribute.setX(i, mtnPosAttribute.getX(i) + (Math.random() - 0.5) * 5);
      mtnPosAttribute.setZ(i, mtnPosAttribute.getZ(i) + (Math.random() - 0.5) * 5);
    }
  }
  mtnGeo.computeVertexNormals();
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 1.0, flatShading: true });

  const mountain = new THREE.Mesh(mtnGeo, mtnMat);
  // Match Sherlock's X but lower down
  mountain.position.set(layout.mountainX, -25, -10);
  mountain.rotation.y = Math.PI / 4;
  scene.add(mountain);

  const mountain2 = new THREE.Mesh(mtnGeo, mtnMat);
  mountain2.position.set(layout.mountain2X, -30, -5);
  mountain2.rotation.y = Math.PI / 2;
  scene.add(mountain2);

  const mountain3 = new THREE.Mesh(mtnGeo, mtnMat);
  mountain3.position.set(layout.mountain3X, -35, -15);
  mountain3.rotation.y = Math.PI;
  scene.add(mountain3);

  // Add Red Planet Behind Head
  // Make it perfectly circular and huge behind him
  const redPlanetGeo = new THREE.SphereGeometry(layout.redPlanetR, 64, 64);
  const redPlanetMat = new THREE.MeshBasicMaterial({ color: 0xff1111 }); // Basic so it's a solid, vibrant red circle without shading
  const redPlanet = new THREE.Mesh(redPlanetGeo, redPlanetMat);
  redPlanet.position.set(layout.redPlanetX, layout.redPlanetY, layout.redPlanetZ);
  scene.add(redPlanet);

  // Red glow emitting from the planet
  const planetLight = new THREE.DirectionalLight(0xff0000, 2.5);
  planetLight.position.set(layout.lightX, 20, -100);
  planetLight.target.position.set(layout.mountainX, -25, -10); // Point towards mountains
  scene.add(planetLight);
  scene.add(planetLight.target);

  // 4. PODIUM INITIALIZATION
  createPodiumLayout();

  // 5. CAMERA SETUP
  // Fixed frame angle matching screenshot, zoomed out
  const camConf = { x: 0, y: 10, z: 90, lookAt: { x: 0, y: 4, z: -10 } };
  engine.camera.position.set(camConf.x, camConf.y, camConf.z);
  engine.camera.lookAt(camConf.lookAt.x, camConf.lookAt.y, camConf.lookAt.z);

  setupInteractions();
}

function setupInteractions() {
  window.addEventListener('click', onDocumentMouseClick, false);
}

function onDocumentMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, engine.camera);

  const bustMeshes = podiums.filter(p => p.activeThisFrame).map(p => p.bust);
  const intersects = raycaster.intersectObjects(bustMeshes);

  if (intersects.length > 0) {
    const hitBust = intersects[0].object;
    const podiumInfo = podiums.find(p => p.bust === hitBust);
    if (podiumInfo && podiumInfo.playerId) {
      showWinnerModal(podiumInfo);
    }
  } else {
    const modal = document.getElementById('winnerStatsModal');
    if (modal) {
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
    }
  }
}

function showWinnerModal(podiumInfo) {
  const player = appState.leaderboard.find(p => p.id === podiumInfo.playerId);
  if (!player) return;

  const modalImg = document.getElementById("winnerModalImg");
  if (modalImg) modalImg.src = player.photoUrl || '';

  const modalName = document.getElementById("winnerModalName");
  if (modalName) modalName.innerText = player.name;

  const modalScore = document.getElementById("winnerModalScore");
  if (modalScore) modalScore.innerText = player.score;

  const modalSelfies = document.getElementById("winnerModalSelfies");
  if (modalSelfies) modalSelfies.innerText = player.selfiesCount || 0;

  const modalSolved = document.getElementById("winnerModalSolved");
  if (modalSolved) modalSolved.innerText = player.correct || 0;

  const modalRank = document.getElementById("winnerModalRank");
  if (modalRank) modalRank.innerText = "#" + podiumInfo.lastRank;

  const modal = document.getElementById("winnerStatsModal");
  if (modal) {
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
  }
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

function updateTextLabel(label, name, score, selfiesCount = 0) {
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
  ctx.font = 'bold 45px Plus Jakarta Sans';
  ctx.textAlign = 'center';
  ctx.fillText(name, 256, 40);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 35px Outfit';
  ctx.fillText(`${score} PTS | ${selfiesCount} Selfies`, 256, 95);

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

let finaleTriggered = false;

socket.on("state", (s) => {
  appState = s;

  updateUI(s);
  syncPodiums(s.leaderboard);
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
    // Occasionally fire confetti during ended state
    if (Math.random() < 0.05) fireConfetti();
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

  const top1 = leaderboard.slice(0, 1);
  const sequence = gsap.timeline({
    onComplete: () => {
        // Trigger Winner Modal after camera pans
      setTimeout(() => {
        const winner = leaderboard[0];
        if (!winner) return;

        const modalName = document.getElementById("winnerModalName");
        if (modalName) modalName.innerText = "CHAMPION: " + winner.name;
        const modalScore = document.getElementById("winnerModalScore");
        if (modalScore) modalScore.innerText = winner.score;
        
        const modalSelfies = document.getElementById("winnerModalSelfies");
        if (modalSelfies) modalSelfies.innerText = winner.selfiesCount || 0;
        
        const modalSolved = document.getElementById("winnerModalSolved");
        if (modalSolved) modalSolved.innerText = winner.correct || 0;
        
        const modalRank = document.getElementById("winnerModalRank");
        if (modalRank) modalRank.innerText = "#1";
        const modalImg = document.getElementById("winnerModalImg");
        if (modalImg && winner.photoUrl) {
          modalImg.src = winner.photoUrl;
        }

        const modal = document.getElementById("winnerStatsModal");
        if (modal) {
          modal.style.opacity = '1';
          modal.style.pointerEvents = 'auto';
          modal.style.transform = "translate(-50%, -50%) scale(1.2)";
        }
      }, 500);
    }
  });

  // Ensure timeline always plays and fires onComplete
  sequence.to({}, { duration: 0.1 });

  const focusPodium = (rankIndex, duration) => {
    if (!top1[rankIndex]) return;
    const podInfo = podiums.find(p => p.playerId === top1[rankIndex].id);
    if (!podInfo) return;

    const rankPos = getRankPos(rankIndex + 1);
    const targetPos = new THREE.Vector3(rankPos.x, rankPos.y + 2.5, rankPos.z);

    sequence.to(engine.camera.position, {
      x: targetPos.x,
      y: targetPos.y + 5,
      z: targetPos.z + 15,
      duration: duration,
      ease: "power2.inOut",
      onUpdate: () => {
        engine.camera.lookAt(targetPos);
      }
    });
  };

  if (top1.length > 0) focusPodium(0, 4); // focus 1st place
}

function syncPodiums(leaderboard) {
  // Only show the final winner, and only when the game has ended
  const top = appState.status === "ended" ? leaderboard.slice(0, 1) : [];

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
      }
    }

    if (pod) {
      pod.activeThisFrame = true;
      pod.group.visible = true;

      // Update photo if it has changed (e.g. correct guess selfie uploaded)
      if (player.photoUrl && pod.lastPhotoUrl !== player.photoUrl) {
        pod.lastPhotoUrl = player.photoUrl;
        new THREE.TextureLoader().load(player.photoUrl, (tex) => {
          pod.bustMat.map = tex;
          pod.bustMat.color.set(0xffffff);
          pod.bustMat.needsUpdate = true;
        });
      }

      // Update labels
      updateTextLabel(pod.label, player.name, player.score, player.correct);

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
        if (window.bgmController) {
          window.bgmController.setVolume(window.bgmController.volumes[appState.status || 'lobby'] + 0.2, 500);
          setTimeout(() => window.bgmController.syncWithState(appState), 2000);
        }
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
