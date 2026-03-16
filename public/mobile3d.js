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

        return [
            {
                path: '/assets/69b52873-a10a-422d-b509-a3aa87e0f391.glb', // Bunny
                name: 'bunny',
                pos: { x: mobile ? -3.0 : -1.0, y: mobile ? 1.0 : 1.9, z: mobile ? 36.0 : 40.0 },
                scale: mobile ? 2.7 : 4.5, // 4.5 desktop * 0.6 = 2.7 mobile
                rot: 0.5,
                tooltipText: "Let's play!",
                audio: '/audio/bunny-welcome.mp3'
            },
            {
                path: '/assets/347b088b-f8fc-4296-84a6-a7db8acfa651.glb', // Owl (Center)
                name: 'owl',
                pos: { x: mobile ? 1.0 : 5.0, y: mobile ? 1.4 : 2.8, z: mobile ? 36.0 : 43.0 },
                scale: mobile ? 3.88 : 4.8, // 4.8 desktop * 0.6 = 2.88 mobile
                rot: 0,
                tooltipText: "Hi, I'm Prof. Hoot!",
                audio: '/audio/owl-welcome.mp3'
            },
            {
                path: '/assets/35047d21-41d2-40fe-b199-5cb585ed6d35.glb', // Fox (Right)
                name: 'fox',
                pos: { x: mobile ? 5.0 : 10.0, y: mobile ? 0.8 : 1.4, z: mobile ? 36.0 : 40.0 },
                scale: mobile ? 2.28 : 3.8, // 3.8 desktop * 0.6 = 2.28 mobile
                rot: -0.5,
                tooltipText: "Enter your name!",
                audio: '/audio/fox-welcome.mp3'
            },
            {
                path: '/assets/301dc167-6e59-4aaf-b3bc-d9a13ab05c6b.glb', // New Selfie Bunny
                name: 'selfie_bunny',
                pos: { x: mobile ? 25.0 : 20.0, y: mobile ? -10.0 : -8.0, z: mobile ? 50.0 : 40.0 },
                scale: mobile ? 2.4 : 4.0, // 4.0 desktop * 0.6 = 2.4 mobile
                rot: -0.8,
                tooltipText: "Say Cheese!",
                audio: '/audio/bunny-welcome.mp3'
            }
        ];
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
            return { z: mobile ? 120 : 95, y: mobile ? 14 : 12, x: -2 };
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
            width: mobile ? 45 : 60,
            height: mobile ? 22.5 : 30,
            x: mobile ? -2 : -18,
            y: mobile ? 12 : 15,
            z: -4.5
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
            spacingX: mobile ? 12 : 10,
            spacingY: mobile ? 10 : 9,
            startY: mobile ? 6 : 4, // Lower start for mobile to avoid card overlap
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
            owl: { x: 0, y: mobile ? 4 : 6, z: -22, scale: mobile ? 5 : 7 },
            fox: { x: mobile ? 4 : 6, y: mobile ? 5 : 7, z: 0, scale: mobile ? 3 : 4 },
            bunny: { x: mobile ? -4 : -6, y: mobile ? 6 : 8, z: 0, scale: mobile ? 3 : 4 }
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
