/* bgm_controller.js – Intelligent Background Music Management */
class GameBGMController {
    constructor(url) {
        this.url = url;
        this.bgm = null;
        this.currentStatus = null;
        this.isStarted = false;

        // Configuration for "Wise" volume levels
        this.volumes = {
            'lobby': 0.4,       // Chill but audible
            'live': 0.7,        // High energy
            'ended': 0.3,       // Results
            'default': 0.5
        };

        this.init();
    }

    init() {
        if (typeof Howl === 'undefined') {
            console.warn("Howler.js not found. BGM Controller waiting...");
            return;
        }

        this.bgm = new Howl({
            src: [this.url],
            loop: true,
            volume: 0, // Start at 0, fade in
            html5: false, // Use Web Audio to avoid HTML5 pool exhaustion
            preload: true
        });

        console.log("🎵 BGM Controller Initialized with:", this.url);

        // Resume play on user interaction (Browser Policy)
        ['click', 'touchstart', 'keydown'].forEach(evt => {
            window.addEventListener(evt, () => {
                setTimeout(() => this.start(), 100);
            }, { once: true });
        });
    }

    start() {
        if (this.isStarted || !this.bgm) return;
        this.isStarted = true;

        if (Howler.ctx && Howler.ctx.state === 'suspended') {
            Howler.ctx.resume();
        }
        this.bgm.play();
        this.bgm.fade(0, this.volumes['lobby'], 2000);
        console.log("🎵 BGM Started");
    }

    syncWithState(state) {
        if (!state || !this.bgm) return;

        const newStatus = state.status || 'lobby';
        if (newStatus === this.currentStatus) return;

        const targetVolume = this.volumes[newStatus] || this.volumes['default'];

        console.log(`🎵 BGM Sync: ${this.currentStatus} -> ${newStatus} | Volume: ${targetVolume}`);

        // Wise transitions: Smooth fades between states
        this.bgm.fade(this.bgm.volume(), targetVolume, 1500);

        // Special case: If game just went LIVE, maybe a little "swell" for excitement
        if (newStatus === 'live') {
            setTimeout(() => {
                this.bgm.fade(targetVolume, targetVolume + 0.15, 500);
                setTimeout(() => {
                    this.bgm.fade(targetVolume + 0.15, targetVolume, 2000);
                }, 1000);
            }, 100);
        }

        this.currentStatus = newStatus;
    }

    setVolume(val, duration = 1000) {
        if (this.bgm) {
            this.bgm.fade(this.bgm.volume(), val, duration);
        }
    }
}

// Create global instance
window.bgmController = new GameBGMController('/assets/audio/bgm.mp3');
