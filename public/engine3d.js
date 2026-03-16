class WebGLEngine {
    constructor(canvasContainerId, transparent = true) {
        this.container = document.getElementById(canvasContainerId);
        if (!this.container) {
            console.warn("WebGLEngine: Container not found");
            return;
        }

        // Three.js Setup
        this.scene = new THREE.Scene();

        // Add some soft Pixar-style lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Brighter ambient
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); // Brighter directional
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        const fillLight = new THREE.PointLight(0xbae6fd, 0.8); // Brighter sky blue fill
        fillLight.position.set(-10, 0, -10);
        this.scene.add(fillLight);

        this.camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 75; // Balanced depth for cinematic 32 FOV

        const isMobile = window.innerWidth <= 768;
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: transparent, 
            antialias: !isMobile, 
            powerPreference: "high-performance",
            precision: isMobile ? "mediump" : "highp"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Performant pixel ratio
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Cannon.js Physics World Setup
        if (window.CANNON) {
            this.world = new CANNON.World();
            this.world.gravity.set(0, -9.82, 0); // Earth gravity
            this.world.broadphase = new CANNON.NaiveBroadphase();
            this.world.solver.iterations = 10;
            this.physicsObjects = []; // To sync Three.js meshes with Cannon.js bodies
        }

        // Interaction setup
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactables = [];

        // Bind event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        window.addEventListener('mousedown', this.onClick.bind(this));

        // Start render loop
        this.animate = this.animate.bind(this);
        this.clock = new THREE.Clock();
        this.animate();
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.handleHover();
    }

    onTouchStart(event) {
        if (event.touches.length > 0) {
            this.mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
            this.handleHover();
            this.onClick(event);
        }
    }

    handleHover() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactables, true);

        // Reset emissive for non-hovered
        this.interactables.forEach(obj => {
            if (obj.userData.isHovered && (!intersects.length || intersects[0].object !== obj)) {
                obj.userData.isHovered = false;
                if (window.gsap) {
                    gsap.to(obj.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: "back.out(1.7)" });
                }
                if (obj.material && obj.userData.originalEmissive) {
                    obj.material.emissive.copy(obj.userData.originalEmissive);
                }
                if (obj.userData.onHoverLeave) obj.userData.onHoverLeave();
            }
        });

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (!obj.userData.isHovered) {
                obj.userData.isHovered = true;

                // Elastic scale up (Optional)
                if (window.gsap && !obj.userData.noHoverScale) {
                    gsap.to(obj.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.4, ease: "elastic.out(1, 0.3)" });
                }
                if (obj.userData.onHoverEnter) obj.userData.onHoverEnter(intersects[0]);
            } else {
                // Already hovered, trigger move
                if (obj.userData.onHoverMove) obj.userData.onHoverMove(intersects[0]);
            }
        }
    }

    onClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactables, true);
        if (intersects.length > 0) {
            const obj = intersects[0].object;

            // Squash effect on click
            if (window.gsap) {
                gsap.to(obj.scale, {
                    x: 0.9, y: 0.9, z: 0.9,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1,
                    ease: "power1.inOut"
                });
            }

            // Physics bounce if it has a body
            if (obj.userData.physicsBody) {
                obj.userData.physicsBody.velocity.set(0, 5, 0); // Pop up
                obj.userData.physicsBody.angularVelocity.set(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5
                );
            }

            // Emit custom event with intersection data
            if (obj.userData.onClick) obj.userData.onClick(intersects[0]);
        }
    }

    addPhysicsObject(mesh, body) {
        this.scene.add(mesh);
        if (this.world) this.world.addBody(body);
        mesh.userData.physicsBody = body;
        this.physicsObjects.push({ mesh, body });
    }

    addInteractable(mesh, onClickCallback) {
        mesh.userData.onClick = onClickCallback;
        this.interactables.push(mesh);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const dt = this.clock.getDelta();

        // Step physics world
        if (this.world) {
            this.world.step(1 / 60, dt, 3);

            // Sync meshes with bodies
            this.physicsObjects.forEach(obj => {
                obj.mesh.position.copy(obj.body.position);
                obj.mesh.quaternion.copy(obj.body.quaternion);
            });
        }

        // Render scene
        if (this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // Create a Pixar-style glossy box material
    static createGlossyMaterial(colorHex) {
        return new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.2, // Glossy plastic
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
        });
    }

    // Helper to load GLTF/GLB models
    loadGLTF(url, callback) {
        if (!window.THREE.GLTFLoader) {
            console.error("GLTFLoader is not available. Please include the GLTFLoader script.");
            return;
        }
        const loader = new THREE.GLTFLoader();
        loader.load(url, (gltf) => {
            if (callback) callback(gltf.scene);
        }, undefined, (error) => {
            console.error("Error loading GLTF:", error);
        });
    }
}
window.WebGLEngine = WebGLEngine;
