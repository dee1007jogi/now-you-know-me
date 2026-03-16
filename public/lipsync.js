// Custom LipSync Manager based on RMS audio energy
class LipSyncManager {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.activeModel = null;
        this.isActive = false;
        this.audioSource = null;
        this.currentAudio = null;
    }

    init() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.85;
    }

    playAndSync(model, audioUrl) {
        if (!this.audioContext) this.init();

        this.activeModel = model;
        this.isActive = true;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            if (this.audioSource) {
                this.audioSource.disconnect();
            }
        }

        return new Promise((resolve, reject) => {
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.crossOrigin = "anonymous";

            this.currentAudio.onplay = () => {
                try {
                    this.audioSource = this.audioContext.createMediaElementSource(this.currentAudio);
                    this.audioSource.connect(this.analyser);
                    this.analyser.connect(this.audioContext.destination);
                    this.startAnimationLoop();
                } catch (e) {
                    // Ignore if already connected
                }
            };

            this.currentAudio.onended = () => {
                this.stop();
                resolve();
            };

            this.currentAudio.onerror = (e) => {
                console.warn("Audio failed to load (probably dummy path), simulating fallback lip sync...", audioUrl);
                this.simulateFallbackLipSync();
                resolve(); // resolve anyway so game continues
            };

            this.currentAudio.play().catch(e => {
                console.warn("Autoplay blocked or audio missing, simulating fallback lip sync.", e);
                this.simulateFallbackLipSync();
                resolve();
            });
        });
    }

    simulateFallbackLipSync() {
        this.isActive = true;
        let count = 0;
        const interval = setInterval(() => {
            if (!this.isActive || count > 15) {
                clearInterval(interval);
                this.stop();
                return;
            }
            if (this.activeModel && window.gsap) {
                // Find a morph target
                let dict = null;
                this.activeModel.traverse((child) => {
                    if (child.isMesh && child.morphTargetDictionary) {
                        dict = child.morphTargetDictionary;
                        let targetInfluence = Object.values(dict)[0]; // Just grab first available morph if mouthOpen absent
                        if (targetInfluence !== undefined) {
                            gsap.to(child.morphTargetInfluences, {
                                [targetInfluence]: Math.random() * 0.8,
                                duration: 0.1,
                                ease: "none"
                            });
                        }
                    }
                });
            }
            count++;
        }, 150);
    }

    stop() {
        this.isActive = false;
        if (this.activeModel && window.gsap) {
            this.activeModel.traverse((child) => {
                if (child.isMesh && child.morphTargetInfluences) {
                    for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                        gsap.to(child.morphTargetInfluences, {
                            [i]: 0,
                            duration: 0.2
                        });
                    }
                }
            });
        }
        this.activeModel = null;
    }

    update() {
        if (!this.isActive || !this.activeModel || !this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength) / 255;
        const mouthOpenValue = Math.min(rms * 4, 1);

        this.activeModel.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                const mouthOpenIndex = child.morphTargetDictionary['mouthOpen'] || child.morphTargetDictionary['jawOpen'] || 0;
                if (child.morphTargetInfluences && child.morphTargetInfluences.length > mouthOpenIndex) {
                    gsap.to(child.morphTargetInfluences, {
                        [mouthOpenIndex]: mouthOpenValue,
                        duration: 0.08,
                        ease: "none",
                        overwrite: "auto"
                    });
                }
            }
        });

        // Subtle head nod
        if (rms > 0.4 && window.gsap) {
            gsap.to(this.activeModel.rotation, {
                x: "+=0.02",
                duration: 0.12,
                yoyo: true,
                ease: "sine.inOut"
            });
        }
    }

    startAnimationLoop() {
        if (this.isActive) {
            this.update();
            requestAnimationFrame(() => this.startAnimationLoop());
        }
    }
}

window.lipSyncManager = new LipSyncManager();
