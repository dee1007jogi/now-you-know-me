// chandelier.js
function createChandelier(scene, posX, posY, posZ) {
    const group = new THREE.Group();

    // Materials
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37, // Metallic gold
        metalness: 0.9,
        roughness: 0.1
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.9, // glass-like
        transparent: true,
        opacity: 1,
        clearcoat: 1.0
    });
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xfffae6
    });

    // Central rod (chain/pole)
    // Starts from posY (ceiling) down 6 units
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 6, 8);
    const pole = new THREE.Mesh(poleGeo, goldMat);
    pole.position.y = -3; // relative to group origin
    group.add(pole);

    // Main hub
    const hubGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16);
    const hub = new THREE.Mesh(hubGeo, goldMat);
    hub.position.y = -6;
    group.add(hub);

    // Arms and lights
    const numArms = 8;
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8);
    const bulbGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const glowGeo = new THREE.SphereGeometry(0.12, 8, 8);

    for(let i=0; i<numArms; i++) {
        const angle = (i / numArms) * Math.PI * 2;
        
        const armGroup = new THREE.Group();
        armGroup.rotation.y = angle;
        armGroup.position.y = -6;

        // Arm stretching outwards
        const arm = new THREE.Mesh(armGeo, goldMat);
        arm.position.x = 1.25;
        arm.rotation.z = Math.PI / 2;
        armGroup.add(arm);

        // Glass crystal/bulb at the end of the arm
        const bulb = new THREE.Mesh(bulbGeo, glassMat);
        bulb.position.set(2.5, 0.4, 0);
        armGroup.add(bulb);
        
        // Inner glowing filament
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(bulb.position);
        armGroup.add(glow);

        // Subtle point light for each bulb
        const light = new THREE.PointLight(0xfff5e6, 0.3, 15);
        light.position.copy(bulb.position);
        armGroup.add(light);

        group.add(armGroup);
    }

    // A large central glowing crystal at the bottom of the hub
    const centerBulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), glassMat);
    centerBulb.position.y = -6.5;
    group.add(centerBulb);
    
    const centerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), glowMat);
    centerGlow.position.y = -6.5;
    group.add(centerGlow);

    const centerLight = new THREE.PointLight(0xfff5e6, 0.8, 30);
    centerLight.position.y = -6.5;
    group.add(centerLight);

    group.position.set(posX, posY, posZ);
    // Scale it so it fits nicely in the scene
    group.scale.set(1.5, 1.5, 1.5);
    scene.add(group);
}
window.createChandelier = createChandelier;
