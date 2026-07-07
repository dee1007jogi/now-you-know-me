// fancyDesk.js - Procedural Fancy C-Shape Desk

function createFancyDesk(scene, posX, posY, posZ) {
    const deskGroup = new THREE.Group();

    // 1. Create the C-shape profile
    const deskShape = new THREE.Shape();
    // Start at outer left foot
    deskShape.moveTo(-10, 0);
    // Left outer curve
    deskShape.bezierCurveTo(-16, 0, -18, 3, -18, 8);
    // Top surface
    deskShape.lineTo(18, 8);
    // Right outer curve
    deskShape.bezierCurveTo(18, 3, 16, 0, 10, 0);
    // Right foot bottom
    deskShape.lineTo(4, 0);
    // Right foot inner height
    deskShape.lineTo(4, 1.2);
    // Right inner curve
    deskShape.bezierCurveTo(10, 1.2, 14, 3, 14, 6.8);
    // Underside
    deskShape.lineTo(-14, 6.8);
    // Left inner curve
    deskShape.bezierCurveTo(-14, 3, -10, 1.2, -4, 1.2);
    // Left foot inner height
    deskShape.lineTo(-4, 0);
    // Back to start
    deskShape.lineTo(-10, 0);

    const extrudeSettings = {
        depth: 14,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 2,
        bevelSize: 0.15,
        bevelThickness: 0.15
    };
    const deskGeo = new THREE.ExtrudeGeometry(deskShape, extrudeSettings);
    // Center it along Z
    deskGeo.translate(0, 0, -7);

    // 2. Materials
    const deskMat = new THREE.MeshPhysicalMaterial({
        color: 0x4a2b16, // dark rich wood color
        metalness: 0.3,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMapIntensity: 2.0
    });

    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.castShadow = true;
    deskMesh.receiveShadow = true;
    deskGroup.add(deskMesh);

    // 3. Add Props (Pad, Pen holder)
    // Desk Pad
    const padGeo = new THREE.BoxGeometry(14, 0.1, 9);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 8.05, 0);
    pad.castShadow = true;
    pad.receiveShadow = true;
    deskGroup.add(pad);

    // Pen Holder
    const holderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 32);
    const holderMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
    const holder = new THREE.Mesh(holderGeo, holderMat);
    holder.position.set(10, 8.7, -2);
    holder.castShadow = true;
    holder.receiveShadow = true;
    deskGroup.add(holder);

    // Pens
    for (let i = 0; i < 4; i++) {
        const penGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8);
        const penMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
        const pen = new THREE.Mesh(penGeo, penMat);
        pen.position.set(10 + (Math.random() - 0.5) * 0.4, 8.9, -2 + (Math.random() - 0.5) * 0.4);
        pen.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        pen.castShadow = true;
        pen.receiveShadow = true;
        deskGroup.add(pen);
    }

    // Small box
    const boxGeo = new THREE.BoxGeometry(3, 1, 2);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.3, roughness: 0.5 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(-12, 8.5, -1);
    box.castShadow = true;
    box.receiveShadow = true;
    deskGroup.add(box);

    deskGroup.position.set(posX, posY, posZ);
    // Increase height specifically while keeping it relatively compact
    deskGroup.scale.set(0.18, 0.35, 0.20);

    scene.add(deskGroup);
}
window.createFancyDesk = createFancyDesk;
