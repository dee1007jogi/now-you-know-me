// mobile3d.js - Centralized 3D Mobile Optimization Configuration

window.Mobile3D = {
    isMobile: function () {
        return window.innerWidth <= 768;
    },

    // ----------------------------------------------------
    // index.html - Login/Lobby & Selfie Screen
    // ----------------------------------------------------
    getLoginMascotData: function () {
        const mobile = this.isMobile();

        if (mobile) {
            return [
                {
                    path: '/assets/Hitem3d-1780989765459.glb', // Bunny
                    name: 'bunny',
                    pos: { x: -3.2, y: 1.5, z: 35.0 },
                    scale: 6.5,
                    rot: 0.6,
                    tooltipText: "Let's play!",
                    audio: '/assets/audio/bgm.mp3'
                },
                {
                    path: '/assets/Hitem3d-1780986032048.glb', // Hitem3d (Center)
                    name: 'owl',
                    pos: { x: 0.0, y: 1.4, z: 36.0 }, // Centered exactly at x: 0 on mobile width
                    scale: 5.5, // Optimized mobile scale
                    rot: 0.0,
                    tooltipText: "Hello there!",
                    audio: '/assets/audio/bgm.mp3'
                },
                {
                    path: '/assets/Hitem3d-1780989244767.glb', // Fox (Right)
                    name: 'fox',
                    pos: { x: 3.2, y: 1.5, z: 35.0 },
                    scale: 6.2,
                    rot: -0.6,
                    tooltipText: "Enter your name!",
                    audio: '/assets/audio/bgm.mp3'
                },
                {
                    path: '/assets/Hitem3d-1780989765459.glb', // New Selfie Bunny
                    name: 'selfie_bunny',
                    pos: { x: 25.0, y: -10.0, z: 50.0 },
                    scale: 5.4,
                    rot: -0.8,
                    tooltipText: "Say Cheese!",
                    audio: '/assets/audio/bgm.mp3'
                }
            ];
        } else {
            return [
                {
                    path: '/assets/Hitem3d-1780989765459.glb', // Bunny
                    name: 'bunny',
                    pos: { x: -1.0, y: 1.5, z: 50.0 },
                    scale: 8.0,
                    rot: 0.3,
                    tooltipText: "Let's play!",
                    audio: '/assets/audio/bgm.mp3'
                },
                {
                    path: '/assets/Hitem3d-1780986032048.glb', // Hitem3d (Center)
                    name: 'owl',
                    pos: { x: 2.0, y: 0.8, z: 58.0 },
                    scale: 4.8,
                    rot: -0.3,
                    tooltipText: "Hello there!",
                    audio: '/assets/audio/bgm.mp3'
                },
                {
                    path: '/assets/Hitem3d-1780989244767.glb', // Fox (Right)
                    name: 'fox',
                    pos: { x: 6.4, y: 1.4, z: 55.0 },
                    scale: 6.5,
                    rot: -0.3,
                    tooltipText: "Enter your name!",
                    audio: '/assets/audio/bgm.mp3'
                },
                {
                    path: '/assets/Hitem3d-1780989765459.glb', // New Selfie Bunny
                    name: 'selfie_bunny',
                    pos: { x: 20.0, y: -8.0, z: 40.0 },
                    scale: 7.0,
                    rot: -0.8,
                    tooltipText: "Say Cheese!",
                    audio: '/assets/audio/bgm.mp3'
                }
            ];
        }
    },

    getSelfiePhaseConfig: function () {
        const mobile = this.isMobile();
        return {
            bunnyExitX: mobile ? -20 : -30,
            owlExitX: mobile ? 20 : 30,
            foxX: mobile ? -6.0 : -8.5,
            foxY: mobile ? 0.2 : 2.0,
            foxZ: mobile ? 62 : 45, // Increased Z for "front" depth priority
            foxScale: mobile ? 3.2 : 4.0,
            selfieBunnyX: mobile ? 6.0 : 8.5,
            selfieBunnyY: mobile ? 0.2 : 1.8,
            selfieBunnyZ: mobile ? 62 : 45, // Increased Z for "front" depth priority
            selfieBunnyScale: mobile ? 3.2 : 4.0
        };
    },

    // ----------------------------------------------------
    // player.js - Interactive Game Boards & Live Matches
    // ----------------------------------------------------
    getCameraConfig: function (stageName) {
        const mobile = this.isMobile();
        if (stageName === "questions") {
            return { z: mobile ? 65 : 95, y: mobile ? 12 : 12, x: 0 };
        }
        if (stageName === "live") {
            return { z: mobile ? 100 : 75, y: mobile ? 15 : 11, x: mobile ? -5 : -20 };
        }
        return { z: 75, y: 20, x: 0 };
    },

    getLiveLabMascotConfig: function () {
        const mobile = this.isMobile();
        return {
            bunny: { x: mobile ? -15 : -37, y: 3.5, z: mobile ? 15 : 20, rot: 1.2, scale: mobile ? 2.94 : 4.2 },
            fox: { x: mobile ? 5 : -10, y: mobile ? 4.5 : 7.5, z: mobile ? 18 : 25, rot: -0.8, scale: mobile ? 4.76 : 6.8 },
            owl: { x: mobile ? 0 : 10, y: 3.5, z: mobile ? 0 : 10, rot: -0.2, scale: mobile ? 3.15 : 4.5 }
        };
    },

    getQuestionsBoardConfig: function () {
        const mobile = this.isMobile();
        return {
            width: mobile ? 22 : 40,
            height: mobile ? 16.5 : 17, // Desktop height restored to 17
            x: 0,
            y: mobile ? 25 : 15, 
            z: -4.0
        };
    },

    getQuestionsMascotConfig: function () {
        const mobile = this.isMobile();
        if (!mobile) return null;
        return {
            fox: { x: -9, y: 2.5, z: 6, rot: 0.4, scale: 9.0 }, // Sherlock (Left)
            owl: { x: 7.5, y: 2.0, z: 5, rot: -0.4, scale: 7.5 }, // Man (Right)
            bunny: { x: 8.5, y: 2.5, z: 12, rot: -0.6, scale: 11.0 } // Woman (Far Right)
        };
    },

    getHolographicCardConfig: function () {
        const mobile = this.isMobile();
        return {
            width: mobile ? 18 : 24,
            height: mobile ? 9 : 12,
            y: mobile ? 20 : 24
        };
    },

    getPeopleGridConfig: function () {
        const mobile = this.isMobile();
        return {
            cols: mobile ? 2 : 3,
            spacingX: mobile ? 16 : 10,
            spacingY: mobile ? 12 : 9,
            startY: mobile ? -14 : 4, // Lower start for mobile to clear space for card at top
            startZ: mobile ? 0 : 0
        };
    },

    // ----------------------------------------------------
    // tv.html - Global Leaderboard High-Fidelity Logic
    // ----------------------------------------------------
    getTVCameraConfig: function () {
        const mobile = this.isMobile();
        return {
            x: 0,
            y: mobile ? 18 : 12,
            z: mobile ? 75 : 45,
            lookAt: { x: 0, y: mobile ? 6 : 4, z: -10 }
        };
    },

    getTVMascotConfig: function () {
        const mobile = this.isMobile();
        return {
            owl: { x: 0, y: mobile ? 4 : 6, z: -22, scale: mobile ? 5 : 12 },
            fox: { x: mobile ? 4 : 6, y: mobile ? 5 : 7, z: 0, scale: mobile ? 3 : 12 },
            bunny: { x: mobile ? -4 : -6, y: mobile ? 6 : 8, z: 0, scale: mobile ? 3 : 12 }
        };
    },

    getTVPodiumConfig: function (rank) {
        const mobile = this.isMobile();
        // Shift podiums closer together on mobile (X) and maybe smaller scale
        const xOffset = mobile ? 0.6 : 1.0;
        const yOffset = mobile ? 1.5 : 1.0; // Higher Y for better mobile visibility
        const scoreMod = mobile ? 0.8 : 1.0;

        if (rank === 1) return { x: 0, y: (mobile ? 0 : -2), z: 0, scale: mobile ? 1.0 : 1.5 };
        if (rank === 2) return { x: (mobile ? -5 : -8), y: (mobile ? -2 : -4), z: 2, scale: mobile ? 0.8 : 1.1 };
        if (rank === 3) return { x: (mobile ? 5 : 8), y: (mobile ? -2 : -4), z: 2, scale: mobile ? 0.8 : 1.1 };

        if (rank === 4) return { x: (mobile ? -9 : -14), y: (mobile ? -4 : -6), z: 5, scale: mobile ? 0.6 : 0.8 };
        if (rank === 5) return { x: 0, y: (mobile ? -4 : -6), z: 6, scale: mobile ? 0.6 : 0.8 };
        if (rank === 6) return { x: (mobile ? 9 : 14), y: (mobile ? -4 : -6), z: 5, scale: mobile ? 0.6 : 0.8 };

        const rawX = ((rank - 7.5) * 10);
        return {
            x: rawX * (mobile ? 0.5 : 1.0),
            y: mobile ? -5.5 : -7,
            z: 10,
            scale: mobile ? 0.45 : 0.6
        };
    },

    // ----------------------------------------------------
    // admin.html - Mission Control High-Fidelity Logic
    // ----------------------------------------------------
    getAdminCameraConfig: function () {
        const mobile = this.isMobile();
        return {
            x: 0,
            y: mobile ? 25 : 15,
            z: mobile ? 45 : 25,
            lookAt: { x: 0, y: mobile ? -5 : 0, z: 0 }
        };
    },

    getAdminMascotConfig: function () {
        const mobile = this.isMobile();
        return {
            owl: {
                x: 0,
                y: mobile ? -1 : 1.5,
                z: mobile ? -5 : -2,
                scale: mobile ? 3 : 4
            }
        };
    },

    getAdminLeverConfig: function (leverName) {
        const mobile = this.isMobile();
        // Shift levers to center on mobile
        const xOffsets = {
            lobby: mobile ? 2 : 8,
            live: mobile ? 5 : 11,
            ended: mobile ? 8 : 14
        };
        const zOffset = mobile ? 2 : -2;

        return {
            x: xOffsets[leverName],
            z: zOffset
        };
    },

    getDialogueConfig: function (side) {
        const mobile = this.isMobile();
        return {
            headOffsetY: side === 'above' ? (mobile ? 4.0 : 5.5) : (mobile ? 2.0 : 2.5),
            bubbleScale: mobile ? 0.85 : 1.0
        };
    },

    getTooltipConfig: function () {
        const mobile = this.isMobile();
        return {
            headOffsetY: mobile ? 3.5 : 4.5
        };
    }
};
