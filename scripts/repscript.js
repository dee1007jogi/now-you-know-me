const fs = require('fs');
const file = 'public/index.html';
const content = fs.readFileSync(file, 'utf8');
const startIndex = content.indexOf('function loadAllMascots() {');
const endIndexStr = '// Load all mascots\n            loadAllMascots();';
let endIndex = content.indexOf(endIndexStr);
if (endIndex === -1) {
    console.error("Could not find endIndex marker!");
    process.exit(1);
}
endIndex += endIndexStr.length;

const newCode = `async function loadAllMascots() {
                engine.interactables = [];

                // Build the 3D Floor (Full Office Room Style)
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

                // --- Build Office Window / Glass Wall Background ---
                const windowGroup = new THREE.Group();
                windowGroup.position.set(5, 5, -5); 
                
                const glassGeo = new THREE.PlaneGeometry(50, 25);
                const glassMat = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff, transparent: true, opacity: 0.15,
                    roughness: 0.05, transmission: 0.9, thickness: 0.5,
                });
                const glassPane = new THREE.Mesh(glassGeo, glassMat);
                windowGroup.add(glassPane);

                const frameMat = new THREE.MeshStandardMaterial({ 
                    color: 0x1e293b, roughness: 0.4, metalness: 0.7 
                });
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

                // Load models as promises
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
                            
                            // add interactions
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
                                gsap.to(model.position, { y: data.pos.y + 1, duration: 0.3, yoyo: true, repeat: 1, ease: "power1.inOut" });
                                if (window.lipSyncManager) {
                                    window.lipSyncManager.playAndSync(model, data.audio);
                                    tooltip.innerHTML = data.tooltipText;
                                    tooltip.style.opacity = "1";
                                    tooltip.style.transform = "translate(-50%, -50%) scale(1)";
                                    setTimeout(() => { tooltip.style.opacity = "0"; }, 2000);
                                }
                            });
                        }
                    });
                    
                    // Hide initially beneath floor
                    model.position.set(0, -100, 0); 
                    engine.scene.add(model);
                });

                const owl = mascots['owl'];
                const bunny = mascots['bunny'];
                const fox = mascots['fox'];

                // --- 1. OWL SEQUENCE ---
                const jetpack = new THREE.Group();
                const tankGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 16);
                const tankMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 });
                const leftTank = new THREE.Mesh(tankGeo, tankMat);
                leftTank.position.set(-0.15, 0.8, -0.4);
                const rightTank = new THREE.Mesh(tankGeo, tankMat);
                rightTank.position.set(0.15, 0.8, -0.4);
                
                const flameGeo = new THREE.ConeGeometry(0.08, 0.4, 16);
                const flameMat = new THREE.MeshBasicMaterial({ color: 0xff4400 }); // Deep Fire color
                const leftFlame = new THREE.Mesh(flameGeo, flameMat);
                leftFlame.position.set(-0.15, 0.5, -0.4);
                leftFlame.rotation.x = Math.PI;
                const rightFlame = new THREE.Mesh(flameGeo, flameMat);
                rightFlame.position.set(0.15, 0.5, -0.4);
                rightFlame.rotation.x = Math.PI;

                const flameInnerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Bright center
                const leftInner = new THREE.Mesh(flameGeo, flameInnerMat);
                leftInner.scale.set(0.5, 0.5, 0.5); leftInner.position.y = -0.1;
                leftFlame.add(leftInner);
                const rightInner = new THREE.Mesh(flameGeo, flameInnerMat);
                rightInner.scale.set(0.5, 0.5, 0.5); rightInner.position.y = -0.1;
                rightFlame.add(rightInner);

                gsap.to([leftFlame.scale, rightFlame.scale], { y: 1.5, x: 1.2, z: 1.2, duration: 0.05, yoyo: true, repeat: -1 });

                jetpack.add(leftTank, rightTank, leftFlame, rightFlame);
                owl.model.add(jetpack);

                owl.model.position.set(5, 5, -40); // Deep outside
                owl.model.rotation.set(0, 0, 0);

                // Glass break effects
                function shatterGlass() {
                    const shardGeo = new THREE.ConeGeometry(0.2, 0.5, 3);
                    const shardMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transmission: 0.9, transparent: true, opacity: 0.8 });
                    for(let i=0; i<40; i++) {
                        const shard = new THREE.Mesh(shardGeo, shardMat);
                        shard.position.set(5 + (Math.random()-0.5)*4, 1 + Math.random()*4, -5);
                        shard.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
                        engine.scene.add(shard);
                        
                        gsap.to(shard.position, {
                            x: "+=" + (Math.random()-0.5)*15,
                            y: "-=" + (Math.random()*5 + 2),
                            z: "+=" + (Math.random()*15 + 2), // Fly forward toward screen
                            duration: 1 + Math.random(),
                            ease: "power2.out"
                        });
                        gsap.to(shard.rotation, {
                            x: "+=" + Math.random()*10, y: "+=" + Math.random()*10,
                            duration: 1 + Math.random()
                        });
                        gsap.to(shard.material, { opacity: 0, duration: 0.5, delay: 1, onComplete: () => engine.scene.remove(shard) });
                    }
                    // Flash screen
                    const fl = document.createElement("div");
                    fl.style.position = "fixed"; fl.style.inset = "0"; fl.style.background = "white"; fl.style.zIndex="9999"; fl.style.pointerEvents="none";
                    document.body.appendChild(fl);
                    gsap.to(fl, { opacity: 0, duration: 0.1, onComplete: ()=>fl.remove() });
                }

                await new Promise(resolve => {
                    const tl = gsap.timeline({ onComplete: resolve });
                    // Fast fly from deep background up to window pane
                    tl.to(owl.model.position, { z: -5, y: 1, duration: 0.8, ease: "power2.in", onComplete: shatterGlass })
                      // Swoop effect inside
                      .to(owl.model.position, { z: 5, y: 3, x: 2, duration: 1, ease: "power1.out" })
                      .to(owl.model.rotation, { y: -Math.PI, x: 0.2, duration: 1 }, "-=1")
                      // Land
                      .to(owl.model.position, { x: owl.data.pos.x, y: owl.data.pos.y, z: owl.data.pos.z, duration: 1.2, ease: "power2.out" })
                      .to(owl.model.rotation, { x: 0, y: Math.PI - 0.5, z: 0, duration: 1.2, ease: "power2.out" }, "-=1.2");
                });
                
                leftFlame.visible = false;
                rightFlame.visible = false;

                if (window.lipSyncManager) {
                    tooltip.innerHTML = owl.data.tooltipText; tooltip.style.opacity="1"; tooltip.style.transform="translate(-50%,-50%) scale(1)";
                    await window.lipSyncManager.playAndSync(owl.model, owl.data.audio);
                    tooltip.style.opacity="0";
                }

                // --- 2. BUNNY SEQUENCE ---
                bunny.model.position.set(-20, bunny.data.pos.y, bunny.data.pos.z);
                bunny.model.rotation.y = -Math.PI / 5;
                
                const tLight = new THREE.PointLight(0xffffff, 0, 50);
                tLight.position.set(2, 5, 2);
                engine.scene.add(tLight);

                await new Promise(resolve => {
                    gsap.to(tLight, { intensity: 15, duration: 0.1, yoyo: true, repeat: 3 });
                    gsap.to(bunny.model.position, { x: bunny.data.pos.x, duration: 0.4, ease: "power4.out", onComplete: resolve });
                });
                engine.scene.remove(tLight);

                if (window.lipSyncManager) {
                    tooltip.innerHTML = bunny.data.tooltipText; tooltip.style.opacity="1"; tooltip.style.transform="translate(-50%,-50%) scale(1)";
                    await window.lipSyncManager.playAndSync(bunny.model, bunny.data.audio);
                    tooltip.style.opacity="0";
                }

                // --- 3. FOX SEQUENCE ---
                fox.model.position.set(fox.data.pos.x, -12, fox.data.pos.z);
                await new Promise(resolve => {
                    gsap.fromTo(fox.model.position, 
                        { y: -15 }, 
                        { y: fox.data.pos.y, duration: 1.5, ease: "power2.out" }
                    );
                    gsap.fromTo(fox.model.rotation,
                        { y: Math.PI },
                        { y: Math.PI - 0.5, duration: 1.5, ease: "power2.out", onComplete: resolve }
                    );
                });

                if (window.lipSyncManager) {
                    tooltip.innerHTML = fox.data.tooltipText; tooltip.style.opacity="1"; tooltip.style.transform="translate(-50%,-50%) scale(1)";
                    await window.lipSyncManager.playAndSync(fox.model, fox.data.audio);
                    tooltip.style.opacity="0";
                }
            }

            // Load all mascots
            loadAllMascots();`

fs.writeFileSync(file, content.substring(0, startIndex) + newCode + content.substring(endIndex));
console.log('Script updated successfully!');
