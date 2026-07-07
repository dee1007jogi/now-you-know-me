// plant.js - Procedural Ultra-Lush Potted Plant

function createUltraLushPlant(scene, posX, posY, posZ) {
    // ---------- 2D Perlin-like noise for wind variation ----------
    function noise2D(x, y) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const topRight = new THREE.Vector2(xf - 1.0, yf - 1.0);
      const topLeft = new THREE.Vector2(xf, yf - 1.0);
      const bottomRight = new THREE.Vector2(xf - 1.0, yf);
      const bottomLeft = new THREE.Vector2(xf, yf);
      const valueTopRight = pseudoRandom(X + 1, Y + 1);
      const valueTopLeft = pseudoRandom(X, Y + 1);
      const valueBottomRight = pseudoRandom(X + 1, Y);
      const valueBottomLeft = pseudoRandom(X, Y);
      const dotTopRight = topRight.dot(new THREE.Vector2(valueTopRight, valueTopRight));
      const dotTopLeft = topLeft.dot(new THREE.Vector2(valueTopLeft, valueTopLeft));
      const dotBottomRight = bottomRight.dot(new THREE.Vector2(valueBottomRight, valueBottomRight));
      const dotBottomLeft = bottomLeft.dot(new THREE.Vector2(valueBottomLeft, valueBottomLeft));
      const u = fade(xf);
      const v = fade(yf);
      return lerp(
        lerp(dotBottomLeft, dotBottomRight, u),
        lerp(dotTopLeft, dotTopRight, u),
        v
      );
    }

    function pseudoRandom(x, y) {
      let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    }

    function fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function lerp(a, b, t) {
      return a + t * (b - a);
    }

    // ---------- Procedural Textures ----------
    function createBumpTexture(size = 128) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const val = (noise2D(x * 0.1, y * 0.1) * 0.5 + 0.5) * 255;
          const index = (y * size + x) * 4;
          imageData.data[index] = val;
          imageData.data[index + 1] = val;
          imageData.data[index + 2] = val;
          imageData.data[index + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      return texture;
    }

    function createLeafTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(128, 460);
      ctx.bezierCurveTo(80, 300, 30, 100, 128, 30);
      ctx.bezierCurveTo(226, 100, 176, 300, 128, 460);
      ctx.closePath();
      
      const gradient = ctx.createLinearGradient(128, 460, 128, 30);
      gradient.addColorStop(0, '#1e4d2b');
      gradient.addColorStop(0.4, '#2e6b38');
      gradient.addColorStop(0.8, '#4c8b4a');
      gradient.addColorStop(1, '#6ba85a');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(128, 460);
      ctx.lineTo(128, 30);
      ctx.strokeStyle = '#1a3a1a';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.strokeStyle = '#2a4a2a';
      ctx.lineWidth = 1.2;
      for (let i = 1; i < 8; i++) {
        const y = 460 - i * 55;
        ctx.beginPath();
        ctx.moveTo(128, y);
        ctx.quadraticCurveTo(90, y - 20, 60, y - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(128, y);
        ctx.quadraticCurveTo(166, y - 20, 196, y - 10);
        ctx.stroke();
      }
      
      ctx.restore();
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      return texture;
    }

    const bumpTexture = createBumpTexture();
    const leafTexture = createLeafTexture();

    // ---------- Leaf Shader Material ----------
    const leafShaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uLightDirection: { value: new THREE.Vector3(8, 12, 3).normalize() },
        uLightColor: { value: new THREE.Color(1, 0.95, 0.8) },
        uAmbientColor: { value: new THREE.Color(0.15, 0.2, 0.1) },
        uTranslucentColor: { value: new THREE.Color(0.3, 0.7, 0.2) },
        uTranslucentStrength: { value: 0.7 },
        uMap: { value: leafTexture }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        uniform vec3 uLightDirection;
        uniform vec3 uLightColor;
        uniform vec3 uAmbientColor;
        uniform vec3 uTranslucentColor;
        uniform float uTranslucentStrength;
        uniform sampler2D uMap;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 lightDir = normalize(uLightDirection);
          float NdotL = max(0.0, dot(normal, lightDir));
          float backLight = max(0.0, dot(-normal, lightDir));
          
          vec4 texColor = texture2D(uMap, vUv);
          vec3 baseColor = texColor.rgb;
          
          vec3 diffuse = baseColor * uLightColor * NdotL;
          vec3 ambient = baseColor * uAmbientColor;
          vec3 translucent = uTranslucentColor * uTranslucentStrength * backLight;
          
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 halfVec = normalize(lightDir + viewDir);
          float spec = pow(max(0.0, dot(normal, halfVec)), 32.0) * 0.15;
          
          vec3 finalColor = ambient + diffuse + translucent + spec * uLightColor;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      lights: false
    });

    // ---------- Materials ----------
    const potMaterial = new THREE.MeshStandardMaterial({
      color: 0xc47e5a,
      roughness: 0.65,
      metalness: 0.1,
      bumpMap: bumpTexture,
      bumpScale: 0.03
    });

    const soilMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.95,
      bumpMap: bumpTexture,
      bumpScale: 0.08
    });

    const barkMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4a3a,
      roughness: 0.85,
      bumpMap: bumpTexture,
      bumpScale: 0.05
    });

    const rootGroup = new THREE.Group();
    rootGroup.position.set(posX, posY, posZ);
    // Increase size so it looks lush in the large scene
    rootGroup.scale.set(10, 10, 10); 
    scene.add(rootGroup);

    // ---------- Build Pot ----------
    const potGroup = new THREE.Group();
    
    const potBodyGeo = new THREE.CylinderGeometry(0.52, 0.44, 0.9, 32);
    const potBody = new THREE.Mesh(potBodyGeo, potMaterial);
    potBody.position.y = 0.0;
    potBody.castShadow = true;
    potBody.receiveShadow = true;
    potGroup.add(potBody);
    
    const rimGeo = new THREE.TorusGeometry(0.5, 0.04, 16, 32);
    const rim = new THREE.Mesh(rimGeo, potMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.45;
    rim.castShadow = true;
    rim.receiveShadow = true;
    potGroup.add(rim);
    
    const soilGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.08, 32);
    const soil = new THREE.Mesh(soilGeo, soilMaterial);
    soil.position.y = 0.49;
    soil.castShadow = true;
    soil.receiveShadow = true;
    potGroup.add(soil);
    
    potGroup.position.y = 0.45;
    rootGroup.add(potGroup);

    // ---------- Plant Hierarchy ----------
    const plantRootGroup = new THREE.Group();
    plantRootGroup.position.set(0, 0.55, 0);
    potGroup.add(plantRootGroup);

    const trunkPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.03, 0.5, 0.02),
      new THREE.Vector3(0.01, 0.9, -0.01),
      new THREE.Vector3(-0.02, 1.2, 0.01)
    ];
    const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints);
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 40, 0.045, 8, false);
    const trunkMesh = new THREE.Mesh(trunkGeo, barkMaterial);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    plantRootGroup.add(trunkMesh);

    // Main branches (unchanged count, will get extra top leaves via clusters)
    const branchDefs = [
      { t: 0.75, angleAround: 0.4, angleOut: 0.5, length: 0.65, thickness: 0.025, subBranches: 5 },
      { t: 0.65, angleAround: 2.3, angleOut: 0.45, length: 0.55, thickness: 0.022, subBranches: 4 },
      { t: 0.55, angleAround: 4.2, angleOut: 0.6, length: 0.5, thickness: 0.02, subBranches: 5 },
      { t: 0.45, angleAround: 1.8, angleOut: 0.35, length: 0.45, thickness: 0.018, subBranches: 4 },
      { t: 0.85, angleAround: 5.5, angleOut: 0.55, length: 0.6, thickness: 0.024, subBranches: 6 },
      { t: 0.35, angleAround: 0.9, angleOut: 0.65, length: 0.4, thickness: 0.016, subBranches: 4 },
      { t: 0.7, angleAround: 3.8, angleOut: 0.4, length: 0.5, thickness: 0.021, subBranches: 5 },
      { t: 0.25, angleAround: 2.8, angleOut: 0.7, length: 0.38, thickness: 0.015, subBranches: 4 },
      { t: 0.9, angleAround: 1.2, angleOut: 0.6, length: 0.55, thickness: 0.019, subBranches: 5 },
      { t: 0.15, angleAround: 3.5, angleOut: 0.8, length: 0.32, thickness: 0.013, subBranches: 3 },
      { t: 0.5, angleAround: 5.9, angleOut: 0.5, length: 0.48, thickness: 0.017, subBranches: 4 }
    ];

    const branchNodes = [];
    const allLeafGroups = [];

    function createLeafGroup(phaseOffset = 0) {
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, -0.12);
      leafShape.bezierCurveTo(0.04, -0.04, 0.05, 0.04, 0, 0.12);
      leafShape.bezierCurveTo(-0.05, 0.04, -0.04, -0.04, 0, -0.12);
      const leafGeo = new THREE.ShapeGeometry(leafShape);
      const leafMesh = new THREE.Mesh(leafGeo, leafShaderMaterial);
      leafMesh.castShadow = false;
      leafMesh.receiveShadow = false;
      const group = new THREE.Group();
      group.add(leafMesh);
      return { group, phase: phaseOffset + Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.5, amplitude: 0.15 + Math.random() * 0.25 };
    }

    function addLeavesToBranch(branchGroup, length, angleAroundOffset) {
      const leafCount = Math.floor(length * 35);
      for (let i = 0; i < leafCount; i++) {
        const t = (i + 1) / (leafCount + 1);
        const yPos = t * length;
        const leafGroup = new THREE.Group();
        leafGroup.position.set(0, yPos, 0);
        const leafData = createLeafGroup(i * 0.15);
        leafGroup.add(leafData.group);
        const angle = (i / leafCount) * Math.PI * 2 + angleAroundOffset;
        leafGroup.rotation.y = angle;
        leafGroup.rotation.x = 0.6;
        leafGroup.rotation.z = (Math.random() - 0.5) * 0.5;
        branchGroup.add(leafGroup);
        allLeafGroups.push({
          group: leafGroup,
          baseRotX: leafGroup.rotation.x,
          baseRotZ: leafGroup.rotation.z,
          phase: leafData.phase,
          speed: leafData.speed,
          amplitude: leafData.amplitude
        });
      }
    }

    function addSubBranch(parentBranchGroup, parentLength, subIndex, totalSubs) {
      const t = 0.2 + (subIndex / (totalSubs + 1)) * 0.7;
      const yPos = t * parentLength;
      const subLength = 0.14 + Math.random() * 0.18;
      const subThickness = 0.005;
      const subGroup = new THREE.Group();
      subGroup.position.set(0, yPos, 0);
      const subCurve = new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, subLength, 0)
      );
      const subGeo = new THREE.TubeGeometry(subCurve, 5, subThickness, 4, false);
      const subMesh = new THREE.Mesh(subGeo, barkMaterial);
      subMesh.castShadow = true;
      subMesh.receiveShadow = true;
      subGroup.add(subMesh);
      const outAngle = 0.6 + Math.random() * 0.7;
      const aroundAngle = Math.random() * Math.PI * 2;
      subGroup.rotation.x = outAngle;
      subGroup.rotation.y = aroundAngle;
      const leafCount = 10 + Math.floor(Math.random() * 12);
      for (let i = 0; i < leafCount; i++) {
        const lt = (i + 1) / (leafCount + 1);
        const lyPos = lt * subLength;
        const leafGroup = new THREE.Group();
        leafGroup.position.set(0, lyPos, 0);
        const leafData = createLeafGroup(subIndex * 20 + i);
        leafGroup.add(leafData.group);
        leafGroup.rotation.y = Math.random() * Math.PI * 2;
        leafGroup.rotation.x = 0.6 + (Math.random() - 0.5) * 0.6;
        leafGroup.rotation.z = (Math.random() - 0.5) * 0.6;
        subGroup.add(leafGroup);
        allLeafGroups.push({
          group: leafGroup,
          baseRotX: leafGroup.rotation.x,
          baseRotZ: leafGroup.rotation.z,
          phase: leafData.phase,
          speed: leafData.speed,
          amplitude: leafData.amplitude * 0.5
        });
      }
      parentBranchGroup.add(subGroup);
    }

    branchDefs.forEach((def) => {
      const pt = trunkCurve.getPointAt(def.t);
      const tangent = trunkCurve.getTangentAt(def.t).normalize();
      const branchGroup = new THREE.Group();
      branchGroup.position.copy(pt);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      branchGroup.quaternion.copy(quat);
      const rotAround = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), def.angleAround);
      const rotOut = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), def.angleOut);
      branchGroup.quaternion.multiply(rotAround).multiply(rotOut);
      const restLocalQuat = branchGroup.quaternion.clone();
      const branchCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, def.length, 0));
      const branchGeo = new THREE.TubeGeometry(branchCurve, 12, def.thickness, 6, false);
      const branchMesh = new THREE.Mesh(branchGeo, barkMaterial);
      branchMesh.castShadow = true;
      branchMesh.receiveShadow = true;
      branchGroup.add(branchMesh);
      addLeavesToBranch(branchGroup, def.length, def.angleAround);
      for (let s = 0; s < def.subBranches; s++) {
        addSubBranch(branchGroup, def.length, s, def.subBranches);
      }
      const tipClusterCount = 8;
      for (let i = 0; i < tipClusterCount; i++) {
        const clusterGroup = new THREE.Group();
        clusterGroup.position.set(0, def.length * 0.92, 0);
        for (let j = 0; j < 6; j++) {
          const leafData = createLeafGroup(i * 0.7 + j);
          const miniLeaf = leafData.group;
          miniLeaf.position.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12);
          miniLeaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          clusterGroup.add(miniLeaf);
          allLeafGroups.push({
            group: miniLeaf,
            baseRotX: miniLeaf.rotation.x,
            baseRotZ: miniLeaf.rotation.z,
            phase: leafData.phase,
            speed: leafData.speed,
            amplitude: leafData.amplitude * 0.6
          });
        }
        branchGroup.add(clusterGroup);
      }
      plantRootGroup.add(branchGroup);
      branchNodes.push({
        group: branchGroup,
        restLocalQuat: restLocalQuat,
        currentLocalQuat: restLocalQuat.clone(),
        length: def.length,
        stiffness: 2.5 + Math.random() * 1.5,
        maxAngle: 0.35 * def.length
      });
    });

    // Trunk leaves (densely packed)
    for (let i = 0; i < 130; i++) {
      const t = 0.1 + (i / 130) * 0.78;
      const pt = trunkCurve.getPointAt(t);
      const leafGroup = new THREE.Group();
      leafGroup.position.copy(pt);
      const leafData = createLeafGroup(i);
      leafGroup.add(leafData.group);
      leafGroup.rotation.z = Math.PI / 2;
      leafGroup.rotation.y = Math.random() * Math.PI * 2;
      leafGroup.rotation.x = (Math.random() - 0.5) * 0.4;
      plantRootGroup.add(leafGroup);
      allLeafGroups.push({
        group: leafGroup,
        baseRotX: leafGroup.rotation.x,
        baseRotZ: leafGroup.rotation.z,
        phase: leafData.phase,
        speed: leafData.speed,
        amplitude: leafData.amplitude
      });
    }

    // Extra top trunk leaves (t > 0.85)
    for (let i = 0; i < 60; i++) {
      const t = 0.86 + (i / 60) * 0.14;
      const pt = trunkCurve.getPointAt(Math.min(t, 0.99));
      const leafGroup = new THREE.Group();
      leafGroup.position.copy(pt);
      const leafData = createLeafGroup(500 + i);
      leafGroup.add(leafData.group);
      leafGroup.rotation.z = Math.PI / 2;
      leafGroup.rotation.y = Math.random() * Math.PI * 2;
      leafGroup.rotation.x = (Math.random() - 0.5) * 0.5;
      plantRootGroup.add(leafGroup);
      allLeafGroups.push({
        group: leafGroup,
        baseRotX: leafGroup.rotation.x,
        baseRotZ: leafGroup.rotation.z,
        phase: leafData.phase,
        speed: leafData.speed,
        amplitude: leafData.amplitude * 1.2
      });
    }

    // Tiny branches from trunk
    for (let i = 0; i < 25; i++) {
      const t = 0.12 + Math.random() * 0.72;
      const pt = trunkCurve.getPointAt(t);
      const tinyBranchGroup = new THREE.Group();
      tinyBranchGroup.position.copy(pt);
      const tinyLength = 0.12 + Math.random() * 0.22;
      const tinyCurve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, tinyLength, 0));
      const tinyGeo = new THREE.TubeGeometry(tinyCurve, 4, 0.005, 4, false);
      const tinyMesh = new THREE.Mesh(tinyGeo, barkMaterial);
      tinyMesh.castShadow = true;
      tinyMesh.receiveShadow = true;
      tinyBranchGroup.add(tinyMesh);
      tinyBranchGroup.rotation.x = 0.4 + Math.random() * 0.9;
      tinyBranchGroup.rotation.y = Math.random() * Math.PI * 2;
      const leafCount = 8 + Math.floor(Math.random() * 10);
      for (let j = 0; j < leafCount; j++) {
        const lt = (j + 1) / (leafCount + 1);
        const lyPos = lt * tinyLength;
        const leafGroup = new THREE.Group();
        leafGroup.position.set(0, lyPos, 0);
        const leafData = createLeafGroup(i * 20 + j);
        leafGroup.add(leafData.group);
        leafGroup.rotation.y = Math.random() * Math.PI * 2;
        leafGroup.rotation.x = 0.5 + Math.random() * 0.6;
        leafGroup.rotation.z = (Math.random() - 0.5) * 0.6;
        tinyBranchGroup.add(leafGroup);
        allLeafGroups.push({
          group: leafGroup,
          baseRotX: leafGroup.rotation.x,
          baseRotZ: leafGroup.rotation.z,
          phase: leafData.phase,
          speed: leafData.speed,
          amplitude: leafData.amplitude * 0.5
        });
      }
      plantRootGroup.add(tinyBranchGroup);
    }

    // 🔥 DENSE CROWN CLUSTERS – massively increased to fill the top
    for (let i = 0; i < 50; i++) {
      const clusterGroup = new THREE.Group();
      const t = 0.94 + Math.random() * 0.06;
      const pt = trunkCurve.getPointAt(Math.min(t, 0.999));
      clusterGroup.position.copy(pt);
      const leavesPerCluster = 15;
      for (let j = 0; j < leavesPerCluster; j++) {
        const leafData = createLeafGroup(i * 10 + j);
        const miniLeaf = leafData.group;
        miniLeaf.position.set(
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25
        );
        miniLeaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        clusterGroup.add(miniLeaf);
        allLeafGroups.push({
          group: miniLeaf,
          baseRotX: miniLeaf.rotation.x,
          baseRotZ: miniLeaf.rotation.z,
          phase: leafData.phase,
          speed: leafData.speed,
          amplitude: leafData.amplitude * 0.6
        });
      }
      plantRootGroup.add(clusterGroup);
    }

    const plantRootNode = {
      group: plantRootGroup,
      restLocalQuat: new THREE.Quaternion(),
      currentLocalQuat: new THREE.Quaternion(),
      length: 1.2,
      stiffness: 1.8,
      maxAngle: 0.12
    };

    // ---------- Wind System ----------
    function updateWindDirection(time) {
      const windAngle = noise2D(time * 0.08, 0) * Math.PI * 2;
      const windStrengthBase = Math.abs(noise2D(time * 0.15, 10)) * 0.8 + 0.2;
      const gust = Math.pow(Math.abs(noise2D(time * 0.3, 20)), 3) * 0.6;
      const strength = Math.min(windStrengthBase + gust, 1.0);
      const dirX = Math.cos(windAngle);
      const dirZ = Math.sin(windAngle);
      return { direction: new THREE.Vector3(dirX, 0.02, dirZ).normalize(), strength };
    }

    function updateNodePhysics(node, windDir, windStrength, dt, parentWorldQuat = null) {
      const parentWorld = parentWorldQuat ? parentWorldQuat.clone() : new THREE.Quaternion();
      const restLocal = node.restLocalQuat.clone();
      const restWorldDir = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(parentWorld)
        .applyQuaternion(restLocal)
        .normalize();
      const dot = restWorldDir.dot(windDir);
      const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
      const maxDeflect = node.maxAngle * windStrength;
      const deflectAngle = Math.min(angle, maxDeflect);
      const axis = new THREE.Vector3().crossVectors(restWorldDir, windDir).normalize();
      if (axis.length() < 0.001) axis.set(0, 1, 0);
      const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, deflectAngle);
      const restWorldQuat = parentWorld.clone().multiply(restLocal);
      const worldTargetQuat = deltaQuat.clone().multiply(restWorldQuat);
      const parentWorldInverse = parentWorld.clone().invert();
      const localTargetQuat = parentWorldInverse.multiply(worldTargetQuat);
      const smoothFactor = 1 - Math.exp(-node.stiffness * dt);
      node.currentLocalQuat.slerp(localTargetQuat, smoothFactor);
      node.group.quaternion.copy(node.currentLocalQuat);
      return node.group.getWorldQuaternion(new THREE.Quaternion());
    }

    // Start animation loop for the plant
    let clock = new THREE.Clock();
    function animatePlant() {
      requestAnimationFrame(animatePlant);
      const dt = Math.min(clock.getDelta(), 0.1);
      const time = performance.now() * 0.001;
      const wind = updateWindDirection(time);
      const rootWorldQuat = updateNodePhysics(plantRootNode, wind.direction, wind.strength, dt);
      branchNodes.forEach(node => {
        updateNodePhysics(node, wind.direction, wind.strength, dt, rootWorldQuat);
      });
      allLeafGroups.forEach(leaf => {
        const flutter = Math.sin(time * leaf.speed * 5 + leaf.phase) * leaf.amplitude * wind.strength;
        leaf.group.rotation.x = leaf.baseRotX + flutter;
        leaf.group.rotation.z = leaf.baseRotZ + flutter * 0.5;
      });
    }
    animatePlant();
    return potGroup;
}
window.createUltraLushPlant = createUltraLushPlant;
