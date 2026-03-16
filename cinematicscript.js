const fs = require('fs');

const file = 'public/index.html';
const content = fs.readFileSync(file, 'utf8');

// 1. Add dialogue box and update button
let newContent = content.replace(
    '<div id="webgl-container"',
    `<!-- CINEMATIC DIALOGUE UI -->
    <div id="dialogueBox" style="display:none; position:absolute; bottom:40px; left:50%; transform:translateX(-50%) translateY(20px); width:90%; max-width:600px; background:rgba(15,23,42,0.95); border:2px solid #0ea5e9; border-radius:16px; padding:20px; z-index:4000; color:white; font-family:sans-serif; text-align:center; box-shadow:0 15px 35px rgba(0,0,0,0.6), inset 0 0 15px rgba(14,165,233,0.3); opacity:0; pointer-events:none; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
        <div id="dialogueName" style="color:#facc15; font-weight:900; font-size:1.1rem; margin-bottom:8px; text-transform:uppercase; letter-spacing: 2px;">Name</div>
        <div id="dialogueText" style="font-size:1.4rem; font-weight:600; line-height:1.4; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Text</div>
    </div>
    
    <div id="webgl-container"`
);

newContent = newContent.replace(
    '<button id="joinBtn" class="btn btn-gradient shine-effect" style="margin-top: 24px;">Join the Game</button>',
    '<button id="joinBtn" class="btn btn-gradient shine-effect" style="margin-top: 24px; opacity: 0; pointer-events: none; transform: translateY(20px);">Join the Mystery!</button>'
);
newContent = newContent.replace(
    '<span>Join the Game</span>',
    '<span>Join the Mystery!</span>'
);

// 2. Rewrite loadAllMascots
const startMarker = 'async function loadAllMascots() {';
const startIndex = newContent.indexOf(startMarker);
const endIndexStr = 'loadAllMascots();';
let endIndex = newContent.indexOf(endIndexStr, startIndex);
if (endIndex === -1) { process.exit(1); }
endIndex += endIndexStr.length;

const newCode = `async function loadAllMascots() {
                engine.interactables = [];

                // Dialog Helper
                function showDialogue(name, text, durationS) {
                    return new Promise(resolve => {
                        const box = document.getElementById("dialogueBox");
                        document.getElementById("dialogueName").textContent = name;
                        document.getElementById("dialogueText").textContent = text;
                        box.style.display = "block";
                        
                        // Pop in
                        if (window.gsap) {
                            gsap.to(box, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(1.7)" });
                            
                            // Let the lipSync manager know to open/close mouth purely for visual effect if audio is missing
                            // We won't strictly tie it to an audio file for now to ensure it fires smoothly 
                            
                            setTimeout(() => {
                                gsap.to(box, { opacity: 0, y: 20, duration: 0.3, ease: "power2.in", onComplete: () => {
                                    box.style.display = "none";
                                    resolve();
                                }});
                            }, durationS * 1000);
                        } else resolve();
                    });
                }

                // Build the 3D Floor
                const floorGeo = new THREE.PlaneGeometry(200, 200);
                const floorMat = new THREE.MeshStandardMaterial({
                    color: 0x050a11, roughness: 0.15, metalness: 0.4,
                });
                const floor = new THREE.Mesh(floorGeo, floorMat);
                floor.rotation.x = -Math.PI / 2;
                floor.position.set(5, -2.5, 95);
                floor.receiveShadow = true;
                engine.scene.add(floor);

                const gridHelper = new THREE.GridHelper(200, 40, 0x0ea5e9, 0x0ea5e9);
                gridHelper.position.set(5, -2.48, 95);
                gridHelper.material.opacity = 0.15;
                gridHelper.material.transparent = true;
                engine.scene.add(gridHelper);

                // Build Glass Wall 
                const windowGroup = new THREE.Group();
                windowGroup.position.set(5, 5, -5); 
                
                const glassGeo = new THREE.PlaneGeometry(50, 25);
                const glassMat = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff, transparent: true, opacity: 0.15,
                    roughness: 0.05, transmission: 0.9, thickness: 0.5,
                });
                const glassPane = new THREE.Mesh(glassGeo, glassMat);
                windowGroup.add(glassPane);

                const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
                const hBeamGeo = new THREE.BoxGeometry(50, 0.4, 0.4);
                [-5, 0, 5, 10].forEach(yPos => {
                    const hBeam = new THREE.Mesh(hBeamGeo, frameMat);
                    hBeam.position.set(0, yPos, 0.1);
                    windowGroup.add(hBeam);
                });
                const vBeamGeo = new THREE.BoxGeometry(0.4, 25, 0.4);
                [-20, -10, 0, 10, 20].forEach(xPos => {
                    const vBeam = new THREE.Mesh(vBeamGeo, frameMat);
                    vBeam.position.set(xPos, 0, 0.1);
                    windowGroup.add(vBeam);
                });
                engine.scene.add(windowGroup);

                // Load models
                const loadModel = (data) => new Promise(resolve => {
                    engine.loadGLTF(data.path, (model) => resolve({ model, data }));
                });
                const loadedAssets = await Promise.all(mascotsData.map(loadModel));

                const mascots = {};
                loadedAssets.forEach(({ model, data }) => {
                    mascots[data.name] = { model, data };
                    model.scale.set(data.scale, data.scale, data.scale);
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.receiveShadow = true;
                            child.castShadow = true;
                            if (child.material) {
                                child.material.roughness = 0.6;
                                child.material.metalness = 0.1;
                                if (child.material.emissive) child.material.emissive.setHex(0x000000);
                            }
                        }
                    });
                    model.position.set(0, -100, 0); // Hide initially
                    engine.scene.add(model);
                });

                const owl = mascots['owl'];
                const bunny = mascots['bunny'];
                const fox = mascots['fox'];

                // --- CINEMATIC NARRATIVE SEQUENCE ---
                
                // 1. OWL ENTERS [0:00 - 0:04]
                // Owl bounces in from bottom right
                owl.model.position.set(15, -5, 2); 
                owl.model.rotation.set(0, 0, 0); // face forward

                await new Promise(resolve => {
                    const tl = gsap.timeline({ onComplete: resolve });
                    tl.to(owl.model.position, { x: owl.data.pos.x, y: owl.data.pos.y, duration: 1.5, ease: "back.out(1.2)" });
                    // Wave wing high logic via rotation if it had a bone, but we apply an overall happy wobble
                    tl.to(owl.model.rotation, { z: -0.1, yoyo: true, repeat: 3, duration: 0.3 }, "-=1.0");
                });

                // Owl says: "Welcome, detectives..."
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🕵️‍♂️ Wise Owl", "Welcome, detectives of the corporate jungle! 🌴", 4.0);

                // 2. OWL STANDS TALL [0:05 - 0:11]
                gsap.to(owl.model.position, { y: owl.data.pos.y + 0.5, duration: 0.5, ease: "power2.out" }); // stand tall
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🦉 Professor Hoot", "I'm Professor Hoot — your guide for tonight. Ready to uncover who your colleagues REALLY are… behind the emails, the stand-ups, and the Zoom smiles? 🔍", 6.0);
                gsap.to(owl.model.position, { y: owl.data.pos.y, duration: 0.5, ease: "power2.out" }); // relax
                
                // 3. OWL INTRODUCES BUNNY [0:12 - 0:16]
                gsap.to(owl.model.rotation, { y: Math.PI / 8, duration: 0.5, ease: "power2.out" }); // turn slightly left
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🦉 Professor Hoot", "Meet our thoughtful analyst… the one who always sees the deeper connections. 🧠✨", 4.0);

                // 4. BUNNY SLIDES IN [0:17 - 0:19]
                bunny.model.position.set(-10, bunny.data.pos.y, bunny.data.pos.z);
                bunny.model.rotation.set(0, 0.2, 0); // face slightly right/forward
                await new Promise(resolve => {
                    gsap.to(bunny.model.position, { x: bunny.data.pos.x, duration: 1.2, ease: "power2.out", onComplete: resolve });
                    // Floppy ears sway via wobble
                    gsap.to(bunny.model.rotation, { z: 0.05, yoyo: true, repeat: 1, duration: 0.5, delay: 1.0 });
                });
                await new Promise(r => setTimeout(r, 1000)); // silent warm eye contact

                // 5. OWL CALLS LOUDLY [0:20 - 0:24]
                gsap.to(owl.model.rotation, { y: -Math.PI / 8, duration: 0.5, ease: "power2.out" }); // turn slightly right
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🦉 Professor Hoot", "And now… our energetic partner in crime! Come on out, you wild one! 🏃‍♂️🔥", 4.0);

                // 6. FOX ENTERS DRamatically (back turned) [0:25 - 0:27]
                fox.model.position.set(15, fox.data.pos.y, fox.data.pos.z);
                // Fox faces entirely away from camera (Math.PI)
                fox.model.rotation.set(0, Math.PI, 0); 
                
                await new Promise(resolve => {
                    gsap.to(fox.model.position, { x: fox.data.pos.x, duration: 1.0, ease: "power3.out", onComplete: resolve });
                    // Tail swish (simulated by slight horizontal wobble)
                    gsap.to(fox.model.position, { x: fox.data.pos.x + 0.2, yoyo: true, repeat: 1, duration: 0.2, delay: 1.0 });
                });
                await new Promise(r => setTimeout(r, 1000)); // confident back-turned pose

                // 7. OWL POINTS AT FOX [0:28 - 0:33]
                gsap.to(owl.model.position, { y: owl.data.pos.y + 0.3, duration: 0.2, yoyo: true, repeat: 1 }); // laugh shake
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🦉 Professor Hoot", "Hey crazy! 🤦‍♂️ You’re showing your tail to them! Please turn, sir…", 5.0);

                // 8. FOX SPINS [0:34 - 0:36]
                await new Promise(resolve => {
                    // spin quickly and land facing camera
                    gsap.to(fox.model.rotation, { y: -0.2, duration: 0.6, ease: "back.out(2)" });
                    gsap.to(fox.model.position, { y: fox.data.pos.y + 1, duration: 0.3, yoyo: true, repeat: 1 }); // flourish hop
                    setTimeout(resolve, 1000);
                });

                // 9. OWL CHUCKLES [0:37 - 0:40]
                gsap.to(owl.model.rotation, { y: 0, duration: 0.5 }); // face camera with knowing smile
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🦉 Professor Hoot", "Yaa… he is bit crazy. 🤭", 3.0);

                // 10. FOX STEPS FORWARD [0:41 - 0:46]
                gsap.to(fox.model.position, { z: fox.data.pos.z + 1.5, duration: 0.5, ease: "power1.out" });
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(fox.model, fox.data.audio);
                await showDialogue("🦊 Playful Fox", "Hey everyone! Fox here — ready to sniff out all the secrets… and maybe cause a little fun chaos along the way. 🕵️‍♂️🌪️", 5.0);
                gsap.to(fox.model.position, { z: fox.data.pos.z, duration: 0.5, ease: "power2.in" }); // step back into line

                // 11. OWL NODS PROUDLY [0:47 - 0:50]
                gsap.to(owl.model.rotation, { y: 0.2, duration: 0.3, yoyo:true, repeat:1 }); // face bunny
                setTimeout(() => gsap.to(owl.model.rotation, { y: -0.2, duration: 0.3, yoyo:true, repeat:1 }), 600); // face fox
                
                if (window.lipSyncManager) window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                await showDialogue("🦉 Professor Hoot", "Now that the whole team is here… let’s get this mystery started! 🚀", 3.0);

                // 12. ALL THREE BUTTON RISE [0:51]
                if (window.lipSyncManager) {
                    window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                    window.lipSyncManager.playAndSync(bunny.model, bunny.data.audio);
                    window.lipSyncManager.playAndSync(fox.model, fox.data.audio);
                }
                
                // Joyful bounce
                [owl, bunny, fox].forEach(m => {
                    gsap.to(m.model.position, { y: m.data.pos.y + 0.8, duration: 0.3, yoyo: true, repeat: 1, ease: "power1.out" });
                });
                await showDialogue("🦉🐰🦊 ALL THREE", "Join the Mystery! ✨", 2.0);

                // Button Rises with Sparkles
                const btn = document.getElementById("joinBtn");
                btn.style.pointerEvents = "auto";
                gsap.to(btn, { 
                    opacity: 1, 
                    y: 0, 
                    duration: 1.0, 
                    ease: "elastic.out(1, 0.5)" 
                });
                // Pulse the button
                gsap.to(btn, { scale: 1.05, duration: 0.8, yoyo: true, repeat: -1 });

                // Attach general interactions back
                loadedAssets.forEach(({ model, data }) => {
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.userData.onHoverEnter = () => {
                                tooltip.innerHTML = data.tooltipText;
                                tooltip.style.opacity = "1";
                                tooltip.style.transform = "translate(-50%, -50%) scale(1)";
                            };
                            child.userData.onHoverLeave = () => {
                                tooltip.style.opacity = "0";
                                tooltip.style.transform = "translate(-50%, -50%) scale(0.9)";
                            };
                            engine.addInteractable(child, () => {
                                gsap.to(model.position, { y: data.pos.y + 1, duration: 0.3, yoyo: true, repeat: 1 });
                                if (window.lipSyncManager && !window.lipSyncManager.isActive) {
                                    window.lipSyncManager.playAndSync(model, data.audio);
                                }
                            });
                        }
                    });
                });
            }

            // Load all mascots
            loadAllMascots();`;

fs.writeFileSync(file, newContent.substring(0, startIndex) + newCode + newContent.substring(endIndex));
console.log('Script updated successfully!');
